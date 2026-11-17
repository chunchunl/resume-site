/**
 * 產生公開的 PDF 履歷：`public/resume/erica-lin-resume-zh.pdf`。
 * 執行：`npm run build:pdf`（需要瀏覽器，所以不在 `verify` 內）。
 * 想順便留一張列印樣式的截圖：`npm run build:pdf -- --screenshot <資料夾>`（截圖不進版控）。
 *
 * 步驟：build 網站 → 在本機起只服務 `dist/` 的靜態服務 → 用瀏覽器以列印樣式開求職頁，輸出 A4 PDF
 * → 改寫中繼資料 → 存到 `public/` → 再 build 一次，讓 PDF 進 `dist/`。
 *
 * 瀏覽器：預設用 Playwright 的 Chromium（第一次要先 `npx playwright install chromium`）。
 * 設環境變數 `PDF_BROWSER_CHANNEL=msedge` 或 `chrome`，可改用本機已安裝的 Edge 或 Chrome，不用另外下載。
 *
 * 字型：網站只用系統字型，所以 PDF 的版面跟著執行機器的字型走。進版控的 PDF 是在 Windows
 * （微軟正黑體）產生的；換到其他作業系統重產，版面與字型都可能不同，請重看一次截圖與頁數。
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef } from 'pdf-lib';
import { chromium } from 'playwright';
import { facts } from '../src/data/facts';
import { buildResume, RESUME_PDF_HREF } from '../src/data/resume';
import { site } from '../src/data/site';

/** 依副檔名對應的 Content-Type；沒列到的一律當成二進位。 */
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
};

/** 會從 PDF 中繼資料移除的欄位：作者等個人資料，以及每次產生都不同的日期。 */
const REMOVED_INFO_KEYS = ['Author', 'Subject', 'Keywords', 'CreationDate', 'ModDate'];

/**
 * 改寫 PDF 的中繼資料：Title 換成頁面標題，Creator 與 Producer 換成固定字串，
 * 並移除 Author、Subject、Keywords、建立與修改日期，以及文件目錄上的 XMP（`/Metadata`）。
 * 瀏覽器會把含版本號的識別字串寫進 Creator 與 Producer，每次升版都不同，所以一律蓋掉；
 * 目前的瀏覽器沒有輸出 XMP，但 XMP 的 CreatorTool 也會帶版本號，所以一併移除。
 * @param bytes 瀏覽器輸出的 PDF。
 * @param title 文件標題（與頁面的 title 相同）。
 * @param creator Creator 與 Producer 的固定字串。
 */
export async function rewritePdfMetadata(bytes: Uint8Array, title: string, creator: string): Promise<Uint8Array> {
  // updateMetadata: false，pdf-lib 才不會自己補上 Producer 與日期。
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  doc.setTitle(title);
  doc.setCreator(creator);
  doc.setProducer(creator);

  const info = doc.context.lookup(doc.context.trailerInfo.Info, PDFDict);
  for (const key of REMOVED_INFO_KEYS) info.delete(PDFName.of(key));
  doc.catalog.delete(PDFName.of('Metadata'));

  return doc.save();
}

/** 判斷字碼是否落在康熙部首與中日韓部首補充的範圍（U+2E80–U+2FDF）。 */
function isRadical(code: number): boolean {
  return code >= 0x2e80 && code <= 0x2fdf;
}

/** 把四位十六進位字碼的部首換成 NFKC 對應的一般漢字；不是部首或沒有對應時回傳 `null`。 */
function unifiedHexOf(hex: string): string | null {
  const code = Number.parseInt(hex, 16);
  if (!isRadical(code)) return null;
  const normalized = String.fromCharCode(code).normalize('NFKC');
  if (normalized.length !== 1 || normalized.charCodeAt(0) === code) return null;
  return normalized.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
}

/**
 * 把 ToUnicode CMap 裡寫成部首的字換成一般漢字。
 * 微軟正黑體這類字型把「工」與部首「⼯」畫成同一個字形，瀏覽器輸出 PDF 時可能把文字層寫成部首，
 * 搜尋與履歷解析系統就讀不到「工程師」。只改 `bfchar` 一對一的對應；
 * `bfrange` 一次對應一整段字碼，部首換掉後就不連續，所以遇到時直接失敗，不輸出錯的 PDF。
 * 假設 CMap 是瀏覽器（Skia）輸出的格式：一行一組對應、目的字碼是 4 位十六進位。
 * 不符合這個格式的寫法會漏改；dist 測試「文字層沒有部首字」會擋下結果。
 * @param cmap 解壓後的 CMap 文字。
 * @returns 改好的 CMap 與替換的筆數。
 */
export function fixCmapRadicals(cmap: string): { cmap: string; replaced: number } {
  let replaced = 0;
  let section: 'bfchar' | 'bfrange' | null = null;

  const lines = cmap.split('\n').map((line) => {
    const trimmed = line.trim();
    if (trimmed.endsWith('beginbfchar')) section = 'bfchar';
    else if (trimmed.endsWith('beginbfrange')) section = 'bfrange';
    else if (trimmed === 'endbfchar' || trimmed === 'endbfrange') section = null;
    else if (section === 'bfchar') {
      return line.replace(/^(\s*<[0-9A-Fa-f]+>\s*)<([0-9A-Fa-f]{4})>/, (whole, prefix: string, hex: string) => {
        const unified = unifiedHexOf(hex);
        if (unified === null) return whole;
        replaced += 1;
        return `${prefix}<${unified}>`;
      });
    } else if (section === 'bfrange') {
      const [from, to, ...targets] = [...trimmed.matchAll(/<([0-9A-Fa-f]+)>/g)].map((match) => Number.parseInt(match[1]!, 16));
      if (from === undefined || to === undefined) return line;
      // 單一起點的寫法，對應範圍是起點到起點加上長度；陣列寫法則逐一列出。
      const codes = trimmed.includes('[') ? targets : targets.slice(0, 1).flatMap((start) => [start, start + to - from]);
      const hitsRadicals = trimmed.includes('[')
        ? codes.some(isRadical)
        : codes.length === 2 && codes[0]! <= 0x2fdf && codes[1]! >= 0x2e80;
      if (hitsRadicals) throw new Error(`ToUnicode 的 bfrange 落在部首範圍，無法逐字替換：${trimmed}`);
    }
    return line;
  });

  return { cmap: lines.join('\n'), replaced };
}

/**
 * 解開 PDF 串流的內容。只認得沒有壓縮與 FlateDecode（單一名稱，或只有一個元素的陣列）；
 * 其他壓縮方式直接失敗，不把壓縮內容當成明文、無聲跳過修正。
 * @param stream PDF 串流。
 */
function decodeStream(stream: PDFRawStream): Uint8Array {
  const filter = stream.dict.get(PDFName.of('Filter'));
  const filters = filter instanceof PDFArray ? filter.asArray() : filter === undefined ? [] : [filter];
  if (filters.length === 0) return stream.contents;
  if (filters.length === 1 && filters[0] === PDFName.of('FlateDecode')) return inflateSync(stream.contents);
  throw new Error(`不認得的串流壓縮方式：${String(filter)}`);
}

/**
 * 修正 PDF 內每個字型的 ToUnicode 對照表，讓文字層的部首換成一般漢字（見 `fixCmapRadicals`）。
 * 只改文字層的對照，畫面上的字形不變。
 * @param bytes 原始 PDF。
 * @returns 修正後的 PDF 與替換的筆數。
 */
export async function fixPdfRadicals(bytes: Uint8Array): Promise<{ bytes: Uint8Array; replaced: number }> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  let replaced = 0;

  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict) || object.get(PDFName.of('Type')) !== PDFName.of('Font')) continue;
    const toUnicodeRef = object.get(PDFName.of('ToUnicode'));
    const stream = toUnicodeRef ? doc.context.lookup(toUnicodeRef) : undefined;
    if (!(stream instanceof PDFRawStream)) continue;

    const original = Buffer.from(decodeStream(stream)).toString('latin1');
    const fixed = fixCmapRadicals(original);
    if (fixed.replaced === 0) continue;

    replaced += fixed.replaced;
    const replacement = doc.context.flateStream(Buffer.from(fixed.cmap, 'latin1'));
    if (toUnicodeRef instanceof PDFRef) doc.context.assign(toUnicodeRef, replacement);
    else object.set(PDFName.of('ToUnicode'), replacement);
  }

  return { bytes: await doc.save(), replaced };
}

/**
 * 依副檔名回傳 Content-Type。
 * @param path 檔案路徑（副檔名不分大小寫）。
 */
export function contentTypeOf(path: string): string {
  return CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * 在 127.0.0.1 的隨機埠起一個只服務 `root` 資料夾的靜態服務。
 * 網址以 `/` 結尾時讀該資料夾的 `index.html`；`root` 以外的路徑一律回 404。
 * 網址解碼失敗（例如不成對的 `%`）也回 404，不會讓程序結束。
 * @param root 要服務的資料夾（絕對路徑）。
 * @returns 服務本身（用完要 `close()`）與網址開頭。
 */
export async function startStaticServer(root: string): Promise<{ server: Server; origin: string }> {
  const base = resolve(root);
  const server = createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
      const filePath = resolve(base, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
      if (!filePath.startsWith(base + sep) || !statSync(filePath).isFile()) throw new Error('not found');
      response.writeHead(200, { 'Content-Type': contentTypeOf(filePath) });
      response.end(readFileSync(filePath));
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('not found');
    }
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as AddressInfo;
  return { server, origin: `http://127.0.0.1:${port}` };
}

/** 讀取 `--screenshot <資料夾>` 參數；沒給時回傳 `null`。 */
function screenshotDirFromArgs(args: string[]): string | null {
  const index = args.indexOf('--screenshot');
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value) throw new Error('--screenshot 後面要接資料夾路徑');
  return resolve(value);
}

/** 執行 `astro build`。 */
function buildSite(root: string): void {
  execFileSync(process.execPath, [join(root, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build'], {
    cwd: root,
    stdio: 'inherit',
  });
}

/** 指令進入點。 */
async function main(): Promise<void> {
  const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
  const screenshotDir = screenshotDirFromArgs(process.argv.slice(2));
  const content = buildResume(facts, site);
  const outputPath = join(root, 'public', ...RESUME_PDF_HREF.split('/').filter(Boolean));

  buildSite(root);

  const { server, origin } = await startStaticServer(join(root, 'dist'));
  const channel = process.env.PDF_BROWSER_CHANNEL || undefined;
  const browser = await chromium.launch(channel ? { channel } : {});
  try {
    // A4 寬度約 794 px（96 dpi），截圖的版面才接近 PDF。
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    const response = await page.goto(`${origin}/resume/`, { waitUntil: 'networkidle' });
    if (!response?.ok()) throw new Error(`求職頁讀取失敗：${response?.status() ?? '沒有回應'}`);
    if ((await page.title()) !== content.title) throw new Error(`求職頁標題與內容函式不同：${await page.title()}`);
    await page.emulateMedia({ media: 'print' });

    if (screenshotDir) {
      mkdirSync(screenshotDir, { recursive: true });
      await page.screenshot({ path: join(screenshotDir, 'resume-print.png'), fullPage: true });
    }

    const raw = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: false, tagged: true, outline: true });
    const original = await PDFDocument.load(raw, { updateMetadata: false });
    console.log(`瀏覽器原始中繼資料：Creator「${original.getCreator() ?? ''}」、Producer「${original.getProducer() ?? ''}」`);

    const fixed = await fixPdfRadicals(raw);
    const rewritten = await rewritePdfMetadata(fixed.bytes, content.title, content.name);
    mkdirSync(join(outputPath, '..'), { recursive: true });
    writeFileSync(outputPath, rewritten);
    console.log(
      `已產生 ${RESUME_PDF_HREF}：${original.getPageCount()} 頁，${rewritten.byteLength} bytes；文字層部首字修正 ${fixed.replaced} 個字形`,
    );
  } finally {
    await browser.close();
    server.close();
  }

  buildSite(root);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
