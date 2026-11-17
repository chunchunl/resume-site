import { readdirSync, readFileSync } from 'node:fs';
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

/** 把連續空白收成一個空格，方便比對跨元素的文字。 */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
