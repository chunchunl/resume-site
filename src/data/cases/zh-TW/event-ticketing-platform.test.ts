import { describe, expect, it } from 'vitest';
import { formatNumber } from '../../../lib/format';
import { facts, type Facts } from '../../facts';
import { validateCase, type CaseContent } from '../types';
import { buildCase } from './event-ticketing-platform';

/** 只改活動平台四個欄位的兩組假事實；四個值彼此都不同，也不同於正式的事實。 */
const factsA: Facts = {
  ...facts,
  eventPlatform: { backendTests: 611, frontendTests: 322, loadTestRequests: 2455, e2eIssuesFixed: 13 },
};
const factsB: Facts = {
  ...facts,
  eventPlatform: { backendTests: 733, frontendTests: 288, loadTestRequests: 3566, e2eIssuesFixed: 27 },
};

/** 一組事實在頁面上會出現的寫法。 */
function formattedValues(input: Facts): string[] {
  const { eventPlatform } = input;
  return [
    `${formatNumber(eventPlatform.backendTests)} 項`,
    `${formatNumber(eventPlatform.frontendTests)} 項`,
    `${formatNumber(eventPlatform.loadTestRequests)} 個請求`,
    `修正 ${formatNumber(eventPlatform.e2eIssuesFixed)} 個`,
  ];
}

/** 一組事實的數值本身，用來確認另一份輸出完全沒有它。 */
function rawValues(input: Facts): string[] {
  const { eventPlatform } = input;
  return [
    formatNumber(eventPlatform.backendTests),
    formatNumber(eventPlatform.frontendTests),
    formatNumber(eventPlatform.loadTestRequests),
    String(eventPlatform.loadTestRequests),
    formatNumber(eventPlatform.e2eIssuesFixed),
  ];
}

/** 取出案例內容裡全部的字串。 */
function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(collectStrings);
  return [];
}

/** 頁面會顯示的文字（不含網址代號與圖代號）。 */
function visibleStrings(content: CaseContent): string[] {
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

describe('活動報名與驗票平台案例', () => {
  it('event buildCase 通過驗證', () => {
    const content = buildCase(facts);

    expect(validateCase(content)).toEqual([]);
    expect(content.slug).toBe('event-ticketing-platform');
    expect(content.lang).toBe('zh-TW');
    expect(content.order).toBe(1);
    expect(content.title).toBe('活動報名與驗票平台');
  });

  it('event buildCase 數字跟著 facts 變', () => {
    const textA = collectStrings(buildCase(factsA)).join('\n');
    const textB = collectStrings(buildCase(factsB)).join('\n');

    for (const value of formattedValues(factsA)) expect(textA, `A 應含「${value}」`).toContain(value);
    for (const value of rawValues(factsB)) expect(textA, `A 不應含「${value}」`).not.toContain(value);

    for (const value of formattedValues(factsB)) expect(textB, `B 應含「${value}」`).toContain(value);
    for (const value of rawValues(factsA)) expect(textB, `B 不應含「${value}」`).not.toContain(value);

    // 正式事實的值也不能出現在假事實的輸出裡，才擋得住寫死的 2 位數值。
    for (const value of rawValues(facts)) {
      expect(textA, `A 不應含正式值「${value}」`).not.toContain(value);
      expect(textB, `B 不應含正式值「${value}」`).not.toContain(value);
    }
  });

  it('event buildCase 每處數字都從 facts 取值', () => {
    const count = (text: string, part: string): number => text.split(part).length - 1;
    const textA = collectStrings(buildCase(factsA)).join('\n');
    const textOfficial = collectStrings(buildCase(facts)).join('\n');

    // 同一個寫法在假事實與正式事實的輸出裡出現次數相同，代表沒有哪一處是寫死的。
    formattedValues(factsA).forEach((value, index) => {
      const official = formattedValues(facts)[index] ?? '';
      expect(count(textA, value), value).toBe(count(textOfficial, official));
      expect(count(textA, value), value).toBeGreaterThan(0);
    });
  });

  it('event buildCase 問句標題', () => {
    const headings = buildCase(facts).sections.map((section) => section.heading);

    expect(headings.filter((heading) => heading.endsWith('？')).length).toBeGreaterThanOrEqual(4);
    for (const required of ['這個平台解決什麼問題？', '我負責哪些部分？', '怎麼確認它可以上線？']) {
      expect(headings).toContain(required);
    }
  });

  it('event buildCase 摘要表照事實寫', () => {
    const content = buildCase(facts);

    expect(content.period).toBe('2026-04 至今');
    expect(content.role).toBe('唯一開發者');
    expect(content.tech).toEqual([
      'React',
      'TypeScript',
      'MUI',
      'Node.js',
      'Express',
      'SQL Server',
      'Socket.IO',
      'Azure Web App',
      'Jenkins',
    ]);
    expect(content.maturity).toBe('已部署 UAT 與正式環境；正式活動數據待活動結束後補充');
  });

  it('event buildCase 有兩張圖：使用流程與分層架構', () => {
    const diagrams = buildCase(facts)
      .sections.map((section) => section.diagram)
      .filter((diagram) => diagram !== undefined);

    expect(diagrams).toEqual(['event-flow', 'event-architecture']);
  });

  it('event buildCase 不寫機制細節與未公開的數字', () => {
    const text = visibleStrings(buildCase(facts)).join('\n');

    expect(text).not.toMatch(/azurewebsites|token|oauth|jwt|password|密碼|金鑰/i);
    // 壓測的回應時間百分比與平行連線數還沒進事實檔（spec 待補件 W3）。
    expect(text).not.toMatch(/%|％|平行連線|回應時間/);
    // 壓測是測試環境的結果，不寫成正式會場實測。
    expect(text).toContain('UAT');
  });

  it('event buildCase 文案符合公開寫作規則', () => {
    const strings = visibleStrings(buildCase(facts));
    const text = strings.join('\n');

    expect(text).not.toMatch(/[—─]|--/);
    expect(text).not.toMatch(/我們|打造|賦能|不只是/);
    for (const paragraph of strings) {
      const sentences = paragraph.split(/[。！？]/).filter((part) => part.trim() !== '');
      expect(sentences.length, paragraph).toBeLessThanOrEqual(3);
    }
  });
});
