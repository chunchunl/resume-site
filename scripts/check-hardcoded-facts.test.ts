import { describe, expect, it } from 'vitest';
import { findHardcodedFacts, shouldCheckSource } from './check-hardcoded-facts';

const fakeFacts = { backendTests: 547 };

/** 包成檢查函式要的原始檔形狀。 */
function source(content: string) {
  return [{ file: 'src/data/home.ts', content }];
}

describe('check-hardcoded-facts', () => {
  it('check-hardcoded-facts 抓到寫死的數字', () => {
    const hits = findHardcodedFacts(fakeFacts, source('const a = 1;\nconst text = "後端 547 項測試通過";\n'));

    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ file: 'src/data/home.ts', line: 2, factPath: 'backendTests' });

    expect(findHardcodedFacts(fakeFacts, source('const text = `後端 ${n} 項測試通過`;'))).toEqual([]);
  });

  it('check-hardcoded-facts 邊界', () => {
    expect(findHardcodedFacts(fakeFacts, source('color: #547abc; total = 1547; other = 5470;'))).toEqual([]);
    expect(findHardcodedFacts(fakeFacts, source('ratio = 0.547; price = 1,547; count = 547,000;'))).toEqual([]);
    expect(findHardcodedFacts(fakeFacts, source('547 項'))).toHaveLength(1);
  });

  it('check-hardcoded-facts 比對千分位寫法', () => {
    const facts = { eventPlatform: { loadTestRequests: 1144 } };

    expect(findHardcodedFacts(facts, source('壓測 1,144 個請求'))).toHaveLength(1);
    expect(findHardcodedFacts(facts, source('壓測 1144 個請求'))[0]).toMatchObject({
      factPath: 'eventPlatform.loadTestRequests',
    });
  });

  it('check-hardcoded-facts 比例比對半形與全形斜線', () => {
    const facts = { rag: { evalBefore: { passed: 14, total: 17 } } };

    expect(findHardcodedFacts(facts, source('題組 14／17'))).toHaveLength(1);
    expect(findHardcodedFacts(facts, source('題組 14/17'))).toHaveLength(1);
    expect(findHardcodedFacts(facts, source('日期 114/170、3 之 14 與 17'))).toEqual([]);
  });

  it('check-hardcoded-facts 不檢查 2 位數以下的數值', () => {
    expect(findHardcodedFacts({ e2eIssuesFixed: 10 }, source('修正 10 個問題'))).toEqual([]);
  });
});

describe('check-hardcoded-facts（審查後補強）', () => {
  it('緊湊的逗號清單不會整組漏掉', () => {
    const facts = { a: 203, b: 547, c: 1144 };

    expect(findHardcodedFacts(facts, source('const list = [203,547,1144];')).length).toBeGreaterThan(0);
    expect(findHardcodedFacts(facts, source('const list = [203, 547, 1144];'))).toHaveLength(3);
  });

  it('比對底線分隔的數字寫法', () => {
    expect(findHardcodedFacts({ loadTestRequests: 1144 }, source('const n = 1_144;'))).toHaveLength(1);
  });

  it('色碼與緊鄰英文字母的數字不算', () => {
    const facts = { backendTests: 547, indexedChunks: 3700 };

    expect(findHardcodedFacts(facts, source('fill="#abc547" stroke="#a3700b" width: 547px; id547x; 547e3'))).toEqual([]);
  });

  it.each([
    ['src/data/home.ts', true],
    ['src/pages/index.astro', true],
    ['src\\pages\\work\\index.astro', true],
    ['src/data/facts.ts', false],
    ['src/data/facts.test.ts', false],
    ['src/lib/format.test.ts', false],
    ['src/components/diagrams/Flow.astro', false],
    ['src/styles/global.css', false],
    ['src/content/note.md', false],
  ])('shouldCheckSource(%s) 為 %s', (path, expected) => {
    expect(shouldCheckSource(path)).toBe(expected);
  });
});
