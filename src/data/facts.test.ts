import { describe, expect, it } from 'vitest';
import { facts } from './facts';

/** 判斷是否為正整數。 */
function isPositiveInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/** 攤平物件，取出全部最末層的值。 */
function collectLeaves(value: unknown): unknown[] {
  if (value !== null && typeof value === 'object') {
    return Object.values(value).flatMap(collectLeaves);
  }
  return [value];
}

describe('facts', () => {
  it('facts 結構完整', () => {
    expect(isPositiveInteger(facts.eventPlatform.backendTests)).toBe(true);
    expect(isPositiveInteger(facts.eventPlatform.frontendTests)).toBe(true);
    expect(isPositiveInteger(facts.eventPlatform.loadTestRequests)).toBe(true);
    expect(isPositiveInteger(facts.eventPlatform.e2eIssuesFixed)).toBe(true);
    expect(isPositiveInteger(facts.rag.indexedChunks)).toBe(true);

    for (const ratio of [facts.rag.evalBefore, facts.rag.evalAfter]) {
      expect(isPositiveInteger(ratio.passed)).toBe(true);
      expect(isPositiveInteger(ratio.total)).toBe(true);
      expect(ratio.passed).toBeLessThanOrEqual(ratio.total);
    }

    expect(['testing', 'launched']).toContain(facts.rewardSystem.status);
  });

  it('facts 不存日期與版本號', () => {
    const leaves = collectLeaves(facts);

    // 每個值只能是整數或狀態代碼，所以放不進日期與版本號字串。
    expect(leaves.length).toBeGreaterThan(0);
    for (const leaf of leaves) {
      const isInteger = typeof leaf === 'number' && Number.isInteger(leaf);
      const isStatus = leaf === 'testing' || leaf === 'launched';
      expect(isInteger || isStatus, `不允許的值：${String(leaf)}`).toBe(true);
    }
  });
});
