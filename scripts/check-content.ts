/**
 * 正式部署前的內容檢查：必填欄位有沒有空的、build 產物裡有沒有佔位符。
 * 執行：`npm run check:content`（會先重新 build，避免檢查到舊的產物）；有問題就以 exit code 1 結束。
 * 這項檢查不在 `npm run verify` 內，內容還沒定案時它會失敗，不該擋住開發。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { facts } from '../src/data/facts';
import { site } from '../src/data/site';

/** 必填欄位檢查的結果。 */
export interface RequiredFieldsResult {
  /** 全部填齊時為 `true`。 */
  ok: boolean;
  /** 沒填的欄位，例如 `contactEmails.work`。 */
  missing: string[];
}

/** 一筆佔位符。 */
export interface PlaceholderProblem {
  /** 檔案路徑。 */
  file: string;
  /** 行號，從 1 開始。 */
  line: number;
  /** 命中的文字。 */
  text: string;
}

/**
 * 佔位符：方括號包住、三個字以上的大寫英文（例 `[PRICE]`、`[YOUR_NAME]`），
 * 以及「待定」「待補」「待確認」「TODO」「TBD」「FIXME」。
 */
const PLACEHOLDER_PATTERN = /\[[A-Z][A-Z_]{2,}\]|待定|待補|待確認|\b(?:TODO|TBD|FIXME)\b/g;

/** 走訪物件，收集值為 `null`、`undefined` 或空字串的欄位路徑。 */
function collectMissing(value: unknown, path: string, ignore: ReadonlySet<string>): string[] {
  if (ignore.has(path)) return [];
  if (value === null || value === undefined) return [path];
  if (typeof value === 'string') return value.trim() === '' ? [path] : [];
  if (typeof value === 'number') return Number.isNaN(value) ? [path] : [];
  if (typeof value !== 'object') return [];

  return Object.entries(value).flatMap(([key, child]) => collectMissing(child, path ? `${path}.${key}` : key, ignore));
}

/**
 * 檢查物件裡有沒有還沒填的欄位。
 * @param value 要檢查的物件，例如 `site`。
 * @param options.ignore 可以留空的欄位路徑，例如 `['avatar']`。
 */
export function checkRequiredFields(value: unknown, options: { ignore?: string[] } = {}): RequiredFieldsResult {
  const missing = collectMissing(value, '', new Set(options.ignore ?? []));
  return { ok: missing.length === 0, missing };
}

/**
 * 找出文字裡的佔位符。
 * @param text 檔案內容。
 * @param file 檔案路徑，只用來回報。
 */
export function findPlaceholders(text: string, file: string): PlaceholderProblem[] {
  const problems: PlaceholderProblem[] = [];
  text.split('\n').forEach((lineText, index) => {
    for (const match of lineText.matchAll(PLACEHOLDER_PATTERN)) {
      problems.push({ file, line: index + 1, text: match[0] });
    }
  });
  return problems;
}

/** 讀取 dist 內全部 HTML 與純文字檔。 */
function readDistTextFiles(distDir: string): { file: string; content: string }[] {
  return readdirSync(distDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(html|txt|xml)$/.test(entry.name))
    .map((entry) => resolve(entry.parentPath, entry.name))
    .map((absolutePath) => ({
      file: `dist/${absolutePath.slice(distDir.length + 1).replaceAll('\\', '/')}`,
      content: readFileSync(absolutePath, 'utf8'),
    }));
}

/** 指令進入點。 */
function main(): void {
  const distDir = resolve(fileURLToPath(new URL('..', import.meta.url)), 'dist');
  const messages: string[] = [];

  for (const field of checkRequiredFields(site, { ignore: ['avatar'] }).missing) {
    messages.push(`src/data/site.ts  欄位 ${field} 還沒填`);
  }
  for (const field of checkRequiredFields(facts).missing) {
    messages.push(`src/data/facts.ts  欄位 ${field} 還沒填`);
  }

  if (existsSync(distDir)) {
    for (const { file, content } of readDistTextFiles(distDir)) {
      for (const problem of findPlaceholders(content, file)) {
        messages.push(`${problem.file}:${problem.line}  佔位符 ${problem.text}`);
      }
    }
  } else {
    messages.push('找不到 dist/，請先執行 npm run build');
  }

  for (const message of messages) console.error(message);
  console.log(`check:content 找到 ${messages.length} 個問題`);
  process.exitCode = messages.length > 0 ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
