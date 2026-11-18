import { describe, expect, it } from 'vitest';
import { formatNumber } from '../../../lib/format';
import { facts, type Facts } from '../../facts';
import {
  collectStrings,
  countOccurrences,
  FOUR_PART_VERSION_PATTERN,
  FULL_DATE_PATTERN,
  LAUNCH_DATE_PATTERN,
  visibleStrings,
  writingRuleViolations,
} from '../test-utils';
import type { CaseContent } from '../types';
import { validateCase } from '../types';
import { buildCase } from './inventory-system-planning';

/**
 * 只改庫存欄位的兩組假事實。每個值彼此不同、也不同於正式的事實，
 * 而且不用期間裡出現的數字，避免「不含另一組」誤判。
 */
const factsA: Facts = { ...facts, inventory: { alignmentMeetings: 7, gapItems: 38 } };
const factsB: Facts = { ...facts, inventory: { alignmentMeetings: 9, gapItems: 43 } };

/** 一組事實在頁面上的寫法。1 位數的值不單獨比對數字，只比對寫法字串。 */
function formattedValues(input: Facts): string[] {
  const { inventory } = input;
  return [`前 ${formatNumber(inventory.alignmentMeetings)} 場`, `${formatNumber(inventory.gapItems)} 項落差`];
}

/** 公開測試只寫通用樣式；內部名稱本身由本機拒絕清單擋。 */
const MONEY_PATTERN = /\d[\d,]*\s*(元|萬)/;
const DAYS_PATTERN = /\d+\s*天/;
const CAMEL_CASE_PATTERN = /[a-z][A-Z]/;
const URL_PATTERN = /https?:\/\//;
const ALLOWED_ACRONYMS = ['ERP', 'API', 'AI'];

/** 不含技術標籤的可見文字（技術標籤是工具名稱，例如有大寫或駝峰的產品名）。 */
function proseStrings(content: CaseContent): string[] {
  const tech = new Set(content.tech);
  return visibleStrings(content).filter((text) => !tech.has(text));
}

describe('庫存管理系統規劃案例', () => {
  it('inventory buildCase 通過驗證', () => {
    const content = buildCase(facts);
    const questions = content.sections.map((section) => section.heading).filter((heading) => heading.endsWith('？'));

    expect(validateCase(content)).toEqual([]);
    expect(content.slug).toBe('inventory-system-planning');
    expect(content.lang).toBe('zh-TW');
    expect(content.order).toBe(4);
    expect(content.title).toBe('庫存管理系統規劃');
    expect(questions.length).toBeGreaterThanOrEqual(5);
    expect(content.faq.length).toBeGreaterThanOrEqual(4);
    expect(content.sections.some((section) => section.diagram === 'inventory-planning-flow')).toBe(true);
  });

  it('inventory buildCase 寫明責任', () => {
    const text = visibleStrings(buildCase(facts)).join('\n');

    expect(text).toContain('程式由其他工程師實作');
    for (const claim of ['我開發', '我實作', '唯一開發者']) expect(text).not.toContain(claim);
  });

  it('inventory buildCase 數字跟著 facts 變', () => {
    const textA = collectStrings(buildCase(factsA)).join('\n');
    const textB = collectStrings(buildCase(factsB)).join('\n');
    const textOfficial = collectStrings(buildCase(facts)).join('\n');
    const official = formattedValues(facts);

    for (const value of formattedValues(factsA)) {
      expect(textA, `A 應含「${value}」`).toContain(value);
      expect(textB, `B 不應含「${value}」`).not.toContain(value);
    }
    for (const value of formattedValues(factsB)) expect(textA, `A 不應含「${value}」`).not.toContain(value);
    for (const value of official) {
      expect(textOfficial, `正式應含「${value}」`).toContain(value);
      expect(textA, `A 不應含正式值「${value}」`).not.toContain(value);
      expect(textB, `B 不應含正式值「${value}」`).not.toContain(value);
    }

    // 每種寫法在三組事實下出現次數相同：寫死的值換一組 facts 時次數會不同。
    for (const [index, value] of formattedValues(factsA).entries()) {
      const count = countOccurrences(textA, value);
      expect(count, value).toBeGreaterThan(0);
      expect(countOccurrences(textB, formattedValues(factsB)[index] ?? ''), value).toBe(count);
      expect(countOccurrences(textOfficial, official[index] ?? ''), value).toBe(count);
    }
  });

  it('inventory buildCase 不寫機密樣式', () => {
    const strings = proseStrings(buildCase(facts));

    for (const text of strings) {
      for (const pattern of [
        FULL_DATE_PATTERN,
        FOUR_PART_VERSION_PATTERN,
        LAUNCH_DATE_PATTERN,
        MONEY_PATTERN,
        DAYS_PATTERN,
        CAMEL_CASE_PATTERN,
        URL_PATTERN,
      ]) {
        expect(text, `${pattern}`).not.toMatch(pattern);
      }
      for (const acronym of text.match(/[A-Z]{2,}/g) ?? []) {
        expect(ALLOWED_ACRONYMS, `不在白名單的大寫縮寫「${acronym}」：${text}`).toContain(acronym);
      }
    }
  });

  it('inventory buildCase 文案規則', () => {
    expect(writingRuleViolations(visibleStrings(buildCase(facts)))).toEqual([]);
  });
});
