import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** build 產物資料夾的絕對路徑（一律用斜線，結尾不帶斜線）。 */
export const distDir = fileURLToPath(new URL('../../dist', import.meta.url)).replaceAll('\\', '/').replace(/\/$/, '');

/** 讀取 build 產物內的檔案。 */
export function readDist(relativePath: string): string {
  return readFileSync(`${distDir}/${relativePath}`, 'utf8');
}

/** 列出 dist 內全部檔案（相對路徑，一律用斜線）。 */
export function listDistFiles(): string[] {
  return readdirSync(distDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `${entry.parentPath}/${entry.name}`.replaceAll('\\', '/'))
    .map((path) => path.slice(distDir.length).replace(/^\/+/, ''));
}

/** 列出 dist 內全部 HTML 檔。 */
export function listHtmlFiles(): string[] {
  return listDistFiles().filter((file) => file.endsWith('.html'));
}

/**
 * 把站內路徑換成 dist 內對應的檔案（相對路徑）：先去掉 `#` 與 `?` 之後的部分並解碼，
 * 結尾是 `/` 的對 `index.html`（`/x/` 對 `x/index.html`），其他直接對檔案。
 * @param path `/` 開頭的站內路徑，例如 `/work/` 或 `/resume/erica-lin-resume-zh.pdf`。
 */
export function distFileForPath(path: string): string {
  const pathname = decodeURIComponent(path.replace(/[?#].*$/, ''));
  const file = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  return file.replace(/^\/+/, '');
}

/** 站內路徑在 dist 裡有沒有對應的檔案；只有資料夾、沒有檔案的不算（正式站會回 404）。 */
export function existsInDist(path: string): boolean {
  return statSync(`${distDir}/${distFileForPath(path)}`, { throwIfNoEntry: false })?.isFile() === true;
}

/** 判斷網址是不是站內路徑：`/` 開頭、但不是 `//` 開頭（`//` 是省略協定的外部網址）。 */
export function isSitePath(url: string | undefined): boolean {
  return typeof url === 'string' && /^\/(?!\/)/.test(url);
}

/** 把連續空白收成一個空格，方便比對跨元素的文字。 */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
