import { describe, expect, it } from 'vitest';
import { formatNumber, formatRatio } from '../../../lib/format';
import { facts, type Facts } from '../../facts';
import { collectStrings, countOccurrences, visibleStrings, writingRuleViolations } from '../test-utils';
import { validateCase } from '../types';
import { buildCase } from './personal-rag-knowledge-platform';

/** 只改 RAG 三個欄位的兩組假事實；每個值彼此都不同，也不同於正式的事實。 */
const factsA: Facts = {
  ...facts,
  rag: { indexedChunks: 4812, evalBefore: { passed: 11, total: 19 }, evalAfter: { passed: 19, total: 20 } },
};
const factsB: Facts = {
  ...facts,
  rag: { indexedChunks: 5926, evalBefore: { passed: 9, total: 21 }, evalAfter: { passed: 22, total: 23 } },
};

/** 一組事實在頁面上會出現的寫法。 */
function formattedValues(input: Facts): string[] {
  const { rag } = input;
  return [
    `約 ${formatNumber(rag.indexedChunks)} 個`,
    `${formatRatio(rag.evalBefore, 'zh-TW')} 題`,
    `${formatRatio(rag.evalAfter, 'zh-TW')} 題`,
  ];
}

/** 一組事實的數值本身，用來確認另一份輸出完全沒有它。 */
function rawValues(input: Facts): string[] {
  const { rag } = input;
  return [
    formatNumber(rag.indexedChunks),
    String(rag.indexedChunks),
    formatRatio(rag.evalBefore, 'zh-TW'),
    formatRatio(rag.evalAfter, 'zh-TW'),
    formatRatio(rag.evalBefore, 'en'),
    formatRatio(rag.evalAfter, 'en'),
  ];
}

describe('個人 AI 知識平台案例', () => {
  it('rag buildCase 通過驗證', () => {
    const content = buildCase(facts);
    const headings = content.sections.map((section) => section.heading);

    expect(validateCase(content)).toEqual([]);
    expect(content.slug).toBe('personal-rag-knowledge-platform');
    expect(content.lang).toBe('zh-TW');
    expect(content.order).toBe(3);
    expect(content.title).toBe('個人 AI 知識平台（RAG）');
    expect(headings.filter((heading) => heading.endsWith('？')).length).toBeGreaterThanOrEqual(3);
    for (const required of ['AI 為什麼會回答過時的內容？', '怎麼知道修好了？', '怎麼限制只有本人能用？']) {
      expect(headings).toContain(required);
    }
  });

  it('rag buildCase 數字跟著 facts 變', () => {
    const textA = collectStrings(buildCase(factsA)).join('\n');
    const textB = collectStrings(buildCase(factsB)).join('\n');
    const textOfficial = collectStrings(buildCase(facts)).join('\n');

    for (const value of formattedValues(factsA)) expect(textA, `A 應含「${value}」`).toContain(value);
    for (const value of rawValues(factsB)) expect(textA, `A 不應含「${value}」`).not.toContain(value);
    for (const value of formattedValues(factsB)) expect(textB, `B 應含「${value}」`).toContain(value);
    for (const value of rawValues(factsA)) expect(textB, `B 不應含「${value}」`).not.toContain(value);

    // 正式值不能出現在假事實的輸出裡，才擋得住寫死的 2 位數比例。
    for (const value of rawValues(facts)) {
      expect(textA, `A 不應含正式值「${value}」`).not.toContain(value);
      expect(textB, `B 不應含正式值「${value}」`).not.toContain(value);
    }

    // 正式事實的輸出含兩個比例的結果。
    expect(textOfficial).toContain(formatRatio(facts.rag.evalBefore, 'zh-TW'));
    expect(textOfficial).toContain(formatRatio(facts.rag.evalAfter, 'zh-TW'));
  });

  it('rag buildCase 每處數字都從 facts 取值', () => {
    const textA = collectStrings(buildCase(factsA)).join('\n');
    const textOfficial = collectStrings(buildCase(facts)).join('\n');

    formattedValues(factsA).forEach((value, index) => {
      const official = formattedValues(facts)[index] ?? '';
      expect(countOccurrences(textA, value), value).toBeGreaterThan(0);
      expect(countOccurrences(textA, value), value).toBe(countOccurrences(textOfficial, official));
    });
  });

  it('rag buildCase 摘要表照事實寫', () => {
    const content = buildCase(facts);

    expect(content.period).toBe('2026-07 至今');
    expect(content.role).toBe('個人專案；問題定義、方案取捨、驗收');
    expect(content.tech).toEqual([
      'Cloudflare Workers AI',
      'Vectorize',
      'D1',
      'R2',
      'LINE Messaging API',
      'Cloudflare Access',
    ]);
    expect(content.aiNote).toContain('AI 協助排查、實作與部署');
  });

  it('rag buildCase 有一張資料流圖', () => {
    const diagrams = buildCase(facts)
      .sections.map((section) => section.diagram)
      .filter((diagram) => diagram !== undefined);

    expect(diagrams).toEqual(['rag-data-flow']);
  });

  it('rag buildCase 不誇大也不露出內部設定', () => {
    const text = visibleStrings(buildCase(facts)).join('\n');

    // 不寫成模型訓練、研究或 MLOps。
    expect(text).not.toMatch(/訓練|微調|fine-?tun|MLOps|研究/i);
    // 不寫子網域、secret 與白名單的實際名稱或內容。
    expect(text).not.toMatch(/[a-z0-9-]+\.lin-yu-chun\.com|workers\.dev/i);
    expect(text).not.toMatch(/[A-Z][A-Z0-9]*_[A-Z0-9_]+/);
  });

  it('rag buildCase 不描述修正前的弱點', () => {
    const text = visibleStrings(buildCase(facts)).join('\n');

    // Erica 2026-11-18：案例只寫現在怎麼保護，不寫修正前哪裡沒擋、也不提路徑層級的例外。
    expect(text).not.toMatch(/沒有檢查|沒有限制|原本只|名單沒有設定|預設拒絕|只開放需要的路徑|擋住哪些路徑/);
    // 同步中斷是運作問題，可以寫，但不用「靜默失敗」「沒有任何警告」強調監控缺口。
    expect(text).not.toMatch(/靜默|沒有任何警告|沒有發出警告/);
    // 仍要說明入口只給本人用，並從外部驗證過。
    expect(text).toContain('Cloudflare Access');
    expect(text).toMatch(/從外部[^。]*(測試|驗證)/);
  });

  it('rag buildCase 文案符合公開寫作規則', () => {
    expect(writingRuleViolations(visibleStrings(buildCase(facts)))).toEqual([]);
  });
});
