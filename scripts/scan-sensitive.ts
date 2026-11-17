/**
 * 敏感內容掃描：檢查版控範圍內的檔案與 build 產物，有沒有不該公開的內容。
 * 執行：`npm run scan:sensitive`；找到任何一筆就以 exit code 1 結束。
 * 規則、白名單與排除清單在 `scan-sensitive.rules.ts`。
 *
 * 掃不到的東西（要人工確認）：
 * - 圖片、字型這類二進位檔的內容（只掃檔名，執行時會列出來）。PDF 會掃文字層、中繼資料與連結註記，
 *   但圖片裡的字讀不到；整份抽不出文字的 PDF 會直接回報。
 * - 刻意變形的寫法，以及無法用樣式判斷的內容（例如日期能不能公開）。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { extractText, getDocumentProxy, getMeta } from 'unpdf';
import {
  ALLOWED_FINDINGS,
  BINARY_EXTENSIONS,
  EXCLUDED_DIRECTORIES,
  EXCLUDED_FILES,
  LOCAL_DENYLIST_FILE,
  PDF_EXTENSION,
  rules,
  type AllowedFinding,
} from './scan-sensitive.rules';

/** 一筆掃描結果。 */
export interface Finding {
  /** 相對於專案根目錄的路徑。 */
  file: string;
  /** 行號，從 1 開始；0 表示問題在檔名或整個檔案。PDF 的文字層寫頁碼，中繼資料與連結註記寫 0。 */
  line: number;
  /** 命中的規則代號。 */
  rule: string;
  /** 命中的文字。 */
  match: string;
}

/** 把路徑統一成斜線、去掉開頭的 `./`。 */
function normalizePath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\//, '');
}

/** 掃描一行文字。 */
function scanLine(lineText: string, file: string, line: number, denylist: readonly string[]): Finding[] {
  // 先正規化，全形數字與符號才比對得到。
  const text = lineText.normalize('NFKC');
  const findings: Finding[] = [];

  for (const rule of rules) {
    const target = rule.mask ? text.replace(rule.mask, (masked) => ' '.repeat(masked.length)) : text;
    for (const match of target.matchAll(rule.pattern)) {
      if (rule.shouldReport && !rule.shouldReport(match)) continue;
      findings.push({ file, line, rule: rule.id, match: match[0] });
    }
  }

  const lowered = text.toLowerCase();
  for (const term of denylist) {
    if (lowered.includes(term.normalize('NFKC').toLowerCase())) {
      findings.push({ file, line, rule: 'local-denylist', match: term });
    }
  }
  return findings;
}

/**
 * 掃描一段文字。
 * @param content 檔案內容。
 * @param file 檔案路徑，只用來回報。
 * @param denylist 本機拒絕清單的字串（不分大小寫比對）。
 */
export function scanText(content: string, file: string, denylist: readonly string[] = []): Finding[] {
  return content.split('\n').flatMap((lineText, index) => scanLine(lineText, file, index + 1, denylist));
}

/** 判斷檔案是否在排除清單內。 */
export function isExcluded(path: string): boolean {
  const normalized = normalizePath(path);
  return (
    EXCLUDED_FILES.includes(normalized) || EXCLUDED_DIRECTORIES.some((directory) => normalized.startsWith(directory))
  );
}

/** 判斷檔案是否為內容無法掃描的二進位檔。 */
function isBinary(path: string): boolean {
  return BINARY_EXTENSIONS.includes(extname(path).toLowerCase());
}

/** 判斷檔案是否為 PDF（內容由 `scanPdf` 另外掃）。 */
export function isPdf(path: string): boolean {
  return extname(path).toLowerCase() === PDF_EXTENSION;
}

/**
 * 列出「只掃了檔名、內容沒掃」的二進位檔，讓執行結果可以提醒人工確認。
 * @param paths 相對於根目錄的檔案路徑。
 */
export function listUnscannedBinaries(paths: string[]): string[] {
  return paths.map(normalizePath).filter((path) => !isExcluded(path) && isBinary(path));
}

/**
 * 套用逐筆允許清單：檔案、規則與命中文字都相同的那一筆才放行。
 * @param findings 掃描結果。
 * @param allowed 允許清單，預設用規則檔裡的 `ALLOWED_FINDINGS`。
 */
export function applyAllowlist(findings: Finding[], allowed: readonly AllowedFinding[] = ALLOWED_FINDINGS): Finding[] {
  return findings.filter(
    (finding) =>
      !allowed.some((entry) => entry.file === finding.file && entry.rule === finding.rule && entry.match === finding.match),
  );
}

/**
 * 讀取本機拒絕清單（不進版控的 JSON 字串陣列）。檔案不存在時回傳空清單。
 * @param root 專案根目錄。
 */
export function loadLocalDenylist(root: string): string[] {
  const path = resolve(root, LOCAL_DENYLIST_FILE);
  if (!existsSync(path)) return [];

  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(parsed) || parsed.some((term) => typeof term !== 'string')) {
    throw new Error(`${LOCAL_DENYLIST_FILE} 的內容必須是字串陣列`);
  }
  return (parsed as string[]).map((term) => term.trim()).filter((term) => term !== '');
}

/** 把檔案內容解碼成文字；讀不懂時回傳 `null`。 */
function decodeText(buffer: Buffer): string | null {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString('utf16le');
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return Buffer.from(buffer.subarray(2)).swap16().toString('utf16le');

  const text = buffer.toString('utf8');
  return text.includes('\u0000') ? null : text;
}

/**
 * 掃描指定的檔案。排除清單內與不存在的檔案會跳過；檔名一律會掃；
 * 已知的二進位檔只掃檔名；其餘讀不懂的檔案直接回報，不會無聲通過。
 * @param root 專案根目錄。
 * @param paths 相對於根目錄的檔案路徑。
 * @param denylist 本機拒絕清單的字串。
 */
export function scanFiles(root: string, paths: string[], denylist: readonly string[] = []): Finding[] {
  const findings: Finding[] = [];
  for (const path of paths.map(normalizePath)) {
    if (isExcluded(path)) continue;

    const absolutePath = resolve(root, path);
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) continue;

    findings.push(...scanLine(path, path, 0, denylist));
    // PDF 內含 \0，當文字解碼會被誤判成讀不懂；內容交給 scanPdf。
    if (isBinary(path) || isPdf(path)) continue;

    const content = decodeText(readFileSync(absolutePath));
    if (content === null) {
      findings.push({ file: path, line: 0, rule: 'unscannable-file', match: '內容不是文字，無法掃描' });
      continue;
    }
    findings.push(...scanText(content, path, denylist));
  }
  return applyAllowlist(findings);
}

/** 取出物件裡全部的字串值（中繼資料用）。 */
function collectStringValues(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStringValues);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(collectStringValues);
  return [];
}

/** 去掉全部空白與換行。 */
function squashWhitespace(text: string): string {
  return text.replace(/\s+/g, '');
}

/**
 * 掃描 PDF 一頁的文字：先逐行掃，再掃整頁一次，因為 PDF 可以在任兩個字之間換行。
 * 同一頁同一個規則、同一段命中文字只算一筆。
 * @param pageText 一頁的文字。
 * @param file 檔案路徑，只用來回報。
 * @param page 頁碼，從 1 開始，寫在 `line`。
 * @param denylist 本機拒絕清單的字串。
 */
function scanPdfPageText(pageText: string, file: string, page: number, denylist: readonly string[]): Finding[] {
  const findings = pageText.split('\n').flatMap((lineText) => scanLine(lineText, file, page, denylist));

  // 規則：整頁收成一行（換行與連續空白都換成一個空格）再掃，被換行切開的號碼也抓得到。
  // 不能把空白全部去掉，不然相鄰兩行會黏在一起（例如信箱接上下一行的網址，網域就變了）。
  findings.push(...scanLine(pageText.replace(/\s+/g, ' '), file, page, []));
  // 拒絕清單：兩邊都去掉全部空白再比，中文字串在任兩個字之間被換行切開也抓得到。
  const squashed = squashWhitespace(pageText.normalize('NFKC')).toLowerCase();
  for (const term of denylist) {
    if (squashed.includes(squashWhitespace(term.normalize('NFKC')).toLowerCase())) {
      findings.push({ file, line: page, rule: 'local-denylist', match: term });
    }
  }

  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.rule}\u0000${finding.match.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 取出每頁註記裡的字串：連結網址（含 `file:` 這類非網頁協定，pdf.js 放在 `unsafeUrl`）
 * 與註記的說明文字；同一個值只回傳一次（一般網址的 `url` 與 `unsafeUrl` 相同）。
 * @param pdf 已開啟的 PDF。
 */
async function collectAnnotationStrings(pdf: Awaited<ReturnType<typeof getDocumentProxy>>): Promise<string[]> {
  const values: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const annotations = (await page.getAnnotations()) as {
      url?: unknown;
      unsafeUrl?: unknown;
      contentsObj?: { str?: unknown };
    }[];
    for (const annotation of annotations) {
      for (const value of [annotation.url, annotation.unsafeUrl, annotation.contentsObj?.str]) {
        if (typeof value === 'string' && value !== '') values.push(value);
      }
    }
  }
  return [...new Set(values)];
}

/**
 * 掃描一份 PDF 的內容：每頁的文字層、中繼資料（Title、Author、Creator、Producer 等與 XMP）
 * 與連結註記的網址，套用全部規則與本機拒絕清單。檔名不在這裡掃（`scanFiles` 已掃）。
 * 讀不懂的檔案、抽不出文字的頁面都回報 `unscannable-file`（頁面寫頁碼），不會無聲通過。
 * 排除清單內與不存在的檔案回傳空陣列。
 * @param root 專案根目錄。
 * @param path 相對於根目錄的 PDF 路徑。
 * @param denylist 本機拒絕清單的字串。
 * @param allowed 逐筆允許清單，預設用規則檔裡的 `ALLOWED_FINDINGS`。
 */
export async function scanPdf(
  root: string,
  path: string,
  denylist: readonly string[] = [],
  allowed: readonly AllowedFinding[] = ALLOWED_FINDINGS,
): Promise<Finding[]> {
  const file = normalizePath(path);
  const absolutePath = resolve(root, file);
  if (isExcluded(file) || !existsSync(absolutePath) || !statSync(absolutePath).isFile()) return [];

  const unscannable = (line: number, reason: string): Finding => ({ file, line, rule: 'unscannable-file', match: reason });

  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    pdf = await getDocumentProxy(new Uint8Array(readFileSync(absolutePath)));
  } catch {
    return applyAllowlist([unscannable(0, 'PDF 讀不懂，無法掃描')], allowed);
  }

  try {
    const findings: Finding[] = [];
    const { text: pages } = await extractText(pdf, { mergePages: false });
    pages.forEach((pageText, index) => {
      if (pageText.trim() === '') findings.push(unscannable(index + 1, `第 ${index + 1} 頁抽不出文字，無法掃描`));
      else findings.push(...scanPdfPageText(pageText, file, index + 1, denylist));
    });

    const { info, metadata } = await getMeta(pdf);
    // 沒有 XMP 時 unpdf 回傳空物件，不是 null，所以先確認有 getRaw 再讀原始 XMP。
    const xmp: unknown = typeof metadata?.getRaw === 'function' ? metadata.getRaw() : '';
    const metaStrings = [...collectStringValues(info), ...collectStringValues(xmp)];
    for (const value of metaStrings) findings.push(...scanLine(value, file, 0, denylist));

    for (const value of await collectAnnotationStrings(pdf)) findings.push(...scanLine(value, file, 0, denylist));

    return applyAllowlist(findings, allowed);
  } catch (error) {
    // 帶出錯誤訊息：這裡失敗多半是程式問題，不是 PDF 本身有問題。
    const message = error instanceof Error ? error.message : String(error);
    return applyAllowlist([unscannable(0, `PDF 內容讀取失敗：${message}`)], allowed);
  } finally {
    await pdf.loadingTask.destroy();
  }
}

/**
 * 列出掃描範圍：版控內的檔案、尚未加入版控但沒被忽略的檔案，以及 `dist/` 內全部檔案。
 * 把還沒 commit 的檔案也算進來，是為了在 commit 之前就擋下來。
 */
export function listTargets(root: string): string[] {
  const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\u0000')
    .filter(Boolean)
    .map(normalizePath);

  const distDir = resolve(root, 'dist');
  const built = existsSync(distDir)
    ? readdirSync(distDir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => normalizePath(`dist/${resolve(entry.parentPath, entry.name).slice(distDir.length + 1)}`))
    : [];

  return [...new Set([...tracked, ...built])];
}

/** 指令進入點。 */
async function main(): Promise<void> {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const denylist = loadLocalDenylist(root);
  const targets = listTargets(root);
  const pdfs = targets.filter((path) => !isExcluded(path) && isPdf(path));
  const findings = scanFiles(root, targets, denylist);
  for (const path of pdfs) findings.push(...(await scanPdf(root, path, denylist)));
  const unscanned = listUnscannedBinaries(targets);

  for (const finding of findings) {
    const position = finding.line > 0 ? `${finding.file}:${finding.line}` : finding.file;
    console.error(`${position}  [${finding.rule}] ${finding.match.slice(0, 60)}`);
  }
  if (unscanned.length > 0) {
    console.log(`以下 ${unscanned.length} 個二進位檔只掃了檔名，內容請人工確認：`);
    for (const path of unscanned) console.log(`  ${path}`);
  }
  if (!existsSync(resolve(root, 'dist'))) {
    console.log('提醒：找不到 dist/，這次只掃了原始檔。');
  }

  if (pdfs.length > 0) {
    console.log(`以下 ${pdfs.length} 個 PDF 已掃文字層、中繼資料與連結註記：`);
    for (const path of pdfs) console.log(`  ${path}`);
  }

  const scanned = targets.filter((path) => !isExcluded(path) && !isBinary(path)).length;
  console.log(
    `scan:sensitive 掃描 ${scanned} 個檔案（含 ${pdfs.length} 個 PDF；本機拒絕清單 ${denylist.length} 個字串），${findings.length} findings`,
  );
  process.exitCode = findings.length > 0 ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
