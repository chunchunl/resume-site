/**
 * 檢查事實數字有沒有被寫死在 `facts.ts` 以外的原始碼。
 * 執行：`npm run check:facts`；找到任何一筆就以 exit code 1 結束。
 *
 * 範圍與限制：
 * - 只看 `src/` 內的 `.ts` 與 `.astro`。之後若把內容放進 Markdown、JSON 或 `public/`，要同步擴充 `shouldCheckSource`。
 * - 只檢查 3 位數以上的整數與比例；位數少的值由內容函式的單元測試用兩組假資料驗證。
 * - 寬高、座標這類剛好同值的版面數字會被當成寫死，遇到時把數字改成具名常數或移到圖表元件。
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { facts } from '../src/data/facts';

/** 要檢查的一個原始檔。 */
export interface SourceFile {
  /** 相對於專案根目錄的路徑。 */
  file: string;
  /** 檔案內容。 */
  content: string;
}

/** 一筆寫死的事實。 */
export interface FactHit {
  /** 相對於專案根目錄的路徑。 */
  file: string;
  /** 行號，從 1 開始。 */
  line: number;
  /** 這個值在 facts 物件裡的位置，例如 `eventPlatform.backendTests`。 */
  factPath: string;
  /** 命中的文字。 */
  text: string;
}

/** 一個事實值對應的比對樣式。 */
interface FactPattern {
  /** 這個值在 facts 物件裡的位置。 */
  factPath: string;
  /** 用來在原始碼裡找這個值的樣式。 */
  pattern: RegExp;
}

/** 只檢查 3 位數以上的整數；位數太少的數字到處都是，會誤報。 */
const MIN_CHECKED_VALUE = 100;

// 數字前面不能緊鄰數字、小數點、#、英文字母或底線（色碼、識別字的一部分）。
const BEFORE_NUMBER = String.raw`(?<![\d.#A-Za-z_])`;
// 3 位數的值前面若是「數字加分隔符號」，它是更大數字的一節（例如 1,547 裡的 547），不算。
const BEFORE_THREE_DIGITS = String.raw`(?<!\d[,_])`;
// 後面不能緊鄰數字、「小數點加數字」、看起來像千分位的下一節，或英文字母（單位、科學記號）。
const AFTER_NUMBER = String.raw`(?!\d)(?!\.\d)(?![,_]\d{3}(?!\d))(?![A-Za-z_])`;

/** 把正規表示式的特殊字元跳脫掉。 */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 判斷一個值是不是 `{ passed, total }` 形狀的比例。 */
function isRatio(value: object): value is { passed: number; total: number } {
  const record = value as Record<string, unknown>;
  return typeof record.passed === 'number' && typeof record.total === 'number';
}

/** 走訪 facts 物件，產生每個值要比對的樣式。 */
function buildPatterns(value: unknown, path: string): FactPattern[] {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || Math.abs(value) < MIN_CHECKED_VALUE) return [];
    // 原值、千分位（1,144）、程式碼的底線分隔（1_144）三種寫法都比對。
    const grouped = value.toLocaleString('en-US');
    const forms = [String(value), grouped, grouped.replaceAll(',', '_')].map(escapeRegExp);
    const alternatives = [...new Set(forms)].join('|');
    const before = Math.abs(value) < 1000 ? `${BEFORE_NUMBER}${BEFORE_THREE_DIGITS}` : BEFORE_NUMBER;
    return [{ factPath: path, pattern: new RegExp(`${before}(?:${alternatives})${AFTER_NUMBER}`, 'g') }];
  }

  if (value === null || typeof value !== 'object') return [];

  const patterns: FactPattern[] = [];
  if (isRatio(value)) {
    // 比例：半形與全形斜線都算，斜線前後可以有空白。
    patterns.push({
      factPath: path,
      pattern: new RegExp(String.raw`(?<![\d.])${value.passed}\s*[/／]\s*${value.total}(?!\d)`, 'g'),
    });
  }
  for (const [key, child] of Object.entries(value)) {
    patterns.push(...buildPatterns(child, path ? `${path}.${key}` : key));
  }
  return patterns;
}

/**
 * 在原始檔裡找出寫死的事實數字。
 * @param factsObject 事實物件（測試時可以傳假的）。
 * @param sources 要檢查的原始檔。
 */
export function findHardcodedFacts(factsObject: unknown, sources: SourceFile[]): FactHit[] {
  const patterns = buildPatterns(factsObject, '');
  const hits: FactHit[] = [];

  for (const { file, content } of sources) {
    content.split('\n').forEach((lineText, index) => {
      for (const { factPath, pattern } of patterns) {
        for (const match of lineText.matchAll(pattern)) {
          hits.push({ file, line: index + 1, factPath, text: match[0] });
        }
      }
    });
  }
  return hits;
}

/** 判斷 `src/` 內的檔案要不要檢查。 */
export function shouldCheckSource(relativePath: string): boolean {
  const path = relativePath.replaceAll('\\', '/');
  if (!/\.(ts|astro)$/.test(path)) return false;
  if (path.endsWith('.test.ts')) return false;
  if (path === 'src/data/facts.ts') return false;
  // 圖表元件裡的座標數字不是事實。
  if (path.startsWith('src/components/diagrams/')) return false;
  return true;
}

/** 讀取 `src/` 內要檢查的原始檔。 */
function readSources(root: string): SourceFile[] {
  const rootPath = resolve(root);
  return readdirSync(resolve(rootPath, 'src'), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => resolve(entry.parentPath, entry.name))
    .map((absolutePath) => ({
      absolutePath,
      file: absolutePath.slice(rootPath.length + 1).replaceAll('\\', '/'),
    }))
    .filter(({ file }) => shouldCheckSource(file))
    .map(({ absolutePath, file }) => ({ file, content: readFileSync(absolutePath, 'utf8') }));
}

/** 指令進入點。 */
function main(): void {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const sources = readSources(root);
  if (sources.length === 0) {
    // 一個檔都沒讀到代表檢查本身壞了，不能當成通過。
    console.error('check:facts 沒有讀到任何原始檔，請確認 src/ 是否存在');
    process.exitCode = 1;
    return;
  }

  const hits = findHardcodedFacts(facts, sources);
  for (const hit of hits) {
    console.error(`${hit.file}:${hit.line}  寫死了 ${hit.factPath}（${hit.text}），請改成讀 facts.ts`);
  }
  console.log(`check:facts 檢查 ${sources.length} 個原始檔，找到 ${hits.length} 筆寫死的事實數字`);
  process.exitCode = hits.length > 0 ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
