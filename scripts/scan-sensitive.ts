/**
 * 敏感內容掃描：檢查版控範圍內的檔案與 build 產物，有沒有不該公開的內容。
 * 執行：`npm run scan:sensitive`；找到任何一筆就以 exit code 1 結束。
 * 規則、白名單與排除清單在 `scan-sensitive.rules.ts`。
 *
 * 掃不到的東西（要人工確認）：
 * - 圖片、字型、PDF 這類二進位檔的內容（只掃檔名，執行時會列出來）。
 * - 刻意變形的寫法，以及無法用樣式判斷的內容（例如日期能不能公開）。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  ALLOWED_FINDINGS,
  BINARY_EXTENSIONS,
  EXCLUDED_DIRECTORIES,
  EXCLUDED_FILES,
  LOCAL_DENYLIST_FILE,
  rules,
  type AllowedFinding,
} from './scan-sensitive.rules';

/** 一筆掃描結果。 */
export interface Finding {
  /** 相對於專案根目錄的路徑。 */
  file: string;
  /** 行號，從 1 開始；0 表示問題在檔名或整個檔案。 */
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
    if (isBinary(path)) continue;

    const content = decodeText(readFileSync(absolutePath));
    if (content === null) {
      findings.push({ file: path, line: 0, rule: 'unscannable-file', match: '內容不是文字，無法掃描' });
      continue;
    }
    findings.push(...scanText(content, path, denylist));
  }
  return applyAllowlist(findings);
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
function main(): void {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const denylist = loadLocalDenylist(root);
  const targets = listTargets(root);
  const findings = scanFiles(root, targets, denylist);
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

  const scanned = targets.filter((path) => !isExcluded(path) && !isBinary(path)).length;
  console.log(`scan:sensitive 掃描 ${scanned} 個檔案（本機拒絕清單 ${denylist.length} 個字串），${findings.length} findings`);
  process.exitCode = findings.length > 0 ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
