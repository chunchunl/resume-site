/**
 * 案例內容單元測試共用的小工具。只給測試用，頁面不會匯入。
 */
import type { CaseContent } from './types';

/** 西元年-月-日、西元年/月/日、西元年.月.日與「年月日」寫法的完整日期。 */
export const FULL_DATE_PATTERN = /\d{4}\s*[-/.年]\s*\d{1,2}\s*[-/.月]\s*\d{1,2}/;

/** 預計上線日的其他寫法（沒有西元年的月日、「預計」「上線日」）。 */
export const LAUNCH_DATE_PATTERN = /預計|上線日|\d{1,2}\s*月\s*\d{1,2}\s*日/;

/** 四段式版本號。 */
export const FOUR_PART_VERSION_PATTERN = /\d+\.\d+\.\d+\.\d+/;

/** 取出案例內容裡全部的字串（含網址代號與圖代號）。 */
export function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(collectStrings);
  return [];
}

/** 頁面會顯示的文字（不含網址代號與圖代號）。 */
export function visibleStrings(content: CaseContent): string[] {
  return [
    content.title,
    content.summary,
    content.period,
    content.role,
    ...content.tech,
    content.maturity,
    ...content.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
    ...content.results,
    ...content.faq.flatMap((item) => [item.question, item.answer]),
    content.aiNote,
  ];
}

/** 計算一段文字在全文裡出現幾次。 */
export function countOccurrences(text: string, part: string): number {
  return text.split(part).length - 1;
}

/**
 * 確認文案符合公開寫作規則：不用破折號、不用套話、每段不超過 3 句。
 * 違反時讓測試失敗，訊息帶出違反的段落。
 */
export function writingRuleViolations(strings: string[]): string[] {
  const violations: string[] = [];
  for (const paragraph of strings) {
    if (/[—─]|--/.test(paragraph)) violations.push(`破折號：${paragraph}`);
    if (/我們|打造|賦能|不只是/.test(paragraph)) violations.push(`套話：${paragraph}`);
    const sentences = paragraph.split(/[。！？]/).filter((part) => part.trim() !== '');
    if (sentences.length > 3) violations.push(`超過 3 句：${paragraph}`);
  }
  return violations;
}
