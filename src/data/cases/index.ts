/**
 * 案例清單：依語系組出全部案例，檢查後依 order 排序。
 * 任何案例沒通過檢查就丟例外，讓 build 直接失敗。
 */
import type { Locale } from '../../lib/format';
import type { Facts } from '../facts';
import { validateCase, type CaseContent } from './types';
import { buildCase as buildEventTicketingPlatform } from './zh-TW/event-ticketing-platform';
import { buildCase as buildMemberMilestoneRewards } from './zh-TW/member-milestone-rewards';
import { buildCase as buildPersonalRagKnowledgePlatform } from './zh-TW/personal-rag-knowledge-platform';
import { buildCase as buildInventorySystemPlanning } from './zh-TW/inventory-system-planning';

/** 產生一個案例的函式。 */
export type CaseBuilder = (facts: Facts) => CaseContent;

/** 各語系有哪些案例。英文版在第二批補上。 */
const CASE_BUILDERS: Record<Locale, CaseBuilder[]> = {
  'zh-TW': [
    buildEventTicketingPlatform,
    buildMemberMilestoneRewards,
    buildPersonalRagKnowledgePlatform,
    buildInventorySystemPlanning,
  ],
  en: [],
};

/**
 * 用一組產生函式組出案例清單：逐一檢查、確認網址代號不重複，再依 order 排序。
 * @param lang 有給時，每個案例的語系都必須相同。
 * @throws 任何案例沒通過檢查、語系不符，或網址代號重複時。
 */
export function buildCaseList(builders: CaseBuilder[], facts: Facts, lang?: Locale): CaseContent[] {
  const cases = builders.map((build) => build(facts));
  const seen = new Set<string>();

  for (const content of cases) {
    const errors = validateCase(content);
    if (errors.length > 0) throw new Error(`案例「${content.slug}」沒通過檢查：\n${errors.join('\n')}`);
    if (lang !== undefined && content.lang !== lang) {
      throw new Error(`案例「${content.slug}」的 lang 是 ${content.lang}，應該是 ${lang}`);
    }
    if (seen.has(content.slug)) throw new Error(`案例網址代號重複：${content.slug}`);
    seen.add(content.slug);
  }

  return [...cases].sort((a, b) => a.order - b.order);
}

/** 取得某個語系的全部案例，依 order 排序。 */
export function getCases(lang: Locale, facts: Facts): CaseContent[] {
  return buildCaseList(CASE_BUILDERS[lang], facts, lang);
}

/** 用網址代號取得單一案例；找不到時回傳 `undefined`。 */
export function getCase(lang: Locale, slug: string, facts: Facts): CaseContent | undefined {
  return getCases(lang, facts).find((content) => content.slug === slug);
}
