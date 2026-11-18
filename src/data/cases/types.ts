/**
 * 案例內容的資料形狀與檢查。
 * 每個案例是一個「接收事實、回傳 CaseContent」的純函式；頁面與 JSON-LD 讀同一份物件，
 * 所以 FAQ 的問答在頁面上與結構化資料裡逐字相同。
 */
import type { Locale } from '../../lib/format';

/** 案例頁可以使用的圖；代號對應的元件在案例頁模板裡用對照表取得。 */
export const DIAGRAM_IDS = ['event-flow', 'event-architecture', 'reward-states', 'rag-data-flow', 'inventory-planning-flow'] as const;

/** 圖的代號。 */
export type DiagramId = (typeof DIAGRAM_IDS)[number];

/** 案例頁的一個段落，標題輸出成 h2。 */
export interface CaseSection {
  /** 段落標題，建議用問句。 */
  heading: string;
  /** 純文字段落。 */
  paragraphs: string[];
  /** 放在段落之後的圖。 */
  diagram?: DiagramId;
}

/** 一組常見問題；FAQPage JSON-LD 只讀這裡。 */
export interface CaseFaq {
  /** 問題。 */
  question: string;
  /** 答案，限單段純文字，不含換行與標記。 */
  answer: string;
}

/** 一個案例頁的全部內容。 */
export interface CaseContent {
  /** 網址代號，頁面在 `/work/{slug}/`。 */
  slug: string;
  /** 內容語系。 */
  lang: Locale;
  /** 在列表裡的順序，數字小的在前。 */
  order: number;
  /** 案例名稱，輸出成 h1。 */
  title: string;
  /** 一句話摘要。 */
  summary: string;
  /** 期間。 */
  period: string;
  /** 我的角色。 */
  role: string;
  /** 使用的技術。 */
  tech: string[];
  /** 成熟度（上線狀態）。 */
  maturity: string;
  /** 問句式段落。 */
  sections: CaseSection[];
  /** 結果條列，輸出在「結果為何？」段落內。 */
  results: string[];
  /** 常見問題，至少 3 組。 */
  faq: CaseFaq[];
  /** AI 協作責任說明，單段純文字。 */
  aiNote: string;
}

/** 網址代號的格式：小寫英文、數字與連字號。 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** FAQ 至少要有幾組。 */
export const MIN_FAQ_COUNT = 3;

const REQUIRED_TEXT_FIELDS = ['slug', 'lang', 'title', 'summary', 'period', 'role', 'maturity', 'aiNote'] as const;

/** 判斷是不是有內容的字串。 */
function isFilledText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** 判斷是不是每一項都有內容的非空字串陣列。 */
function isFilledTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isFilledText);
}

/** 判斷是不是單段純文字（沒有換行、沒有 HTML 標記）。 */
function isPlainParagraph(value: unknown): boolean {
  return isFilledText(value) && !/[\r\n]/.test(value) && !/[<>]/.test(value);
}

/** 檢查段落清單，回傳錯誤。 */
function validateSections(sections: unknown): string[] {
  if (!Array.isArray(sections) || sections.length === 0) return ['sections：至少要有一個段落'];

  return sections.flatMap((section: Partial<CaseSection> | undefined, index) => {
    const errors: string[] = [];
    if (!isFilledText(section?.heading)) errors.push(`sections[${index}].heading：標題是空的`);
    if (!isFilledTextList(section?.paragraphs)) errors.push(`sections[${index}].paragraphs：至少要有一段文字`);
    if (section?.diagram !== undefined && !(DIAGRAM_IDS as readonly string[]).includes(section.diagram)) {
      errors.push(`sections[${index}].diagram：不認得的圖代號「${String(section.diagram)}」`);
    }
    return errors;
  });
}

/** 檢查常見問題，回傳錯誤。 */
function validateFaq(faq: unknown): string[] {
  if (!Array.isArray(faq) || faq.length < MIN_FAQ_COUNT) return [`faq：至少要有 ${MIN_FAQ_COUNT} 組問答`];

  return faq.flatMap((item: Partial<CaseFaq> | undefined, index) => {
    const errors: string[] = [];
    if (!isFilledText(item?.question)) errors.push(`faq[${index}].question：問題是空的`);
    if (!isPlainParagraph(item?.answer)) errors.push(`faq[${index}].answer：答案要是單段純文字`);
    return errors;
  });
}

/**
 * 檢查案例內容；必填欄位缺少、FAQ 不足或格式不對時，回傳錯誤清單（每筆含欄位名稱）。
 * 沒有錯誤時回傳空陣列。
 */
export function validateCase(content: unknown): string[] {
  if (content === null || typeof content !== 'object') return ['content：不是物件'];
  const record = content as Record<string, unknown>;

  const errors: string[] = [];
  for (const field of REQUIRED_TEXT_FIELDS) {
    if (!isFilledText(record[field])) errors.push(`${field}：必填`);
  }
  if (isFilledText(record.slug) && !SLUG_PATTERN.test(record.slug)) {
    errors.push('slug：只能有小寫英文、數字與連字號');
  }
  if (isFilledText(record.aiNote) && !isPlainParagraph(record.aiNote)) errors.push('aiNote：要是單段純文字');
  if (typeof record.order !== 'number' || !Number.isFinite(record.order)) errors.push('order：必須是數字');
  if (!isFilledTextList(record.tech)) errors.push('tech：至少要有一項技術');
  if (!isFilledTextList(record.results)) errors.push('results：至少要有一個結果');

  return [...errors, ...validateSections(record.sections), ...validateFaq(record.faq)];
}
