import { describe, expect, it } from 'vitest';
import { getCase } from '../../src/data/cases';
import { FOUR_PART_VERSION_PATTERN, FULL_DATE_PATTERN, LAUNCH_DATE_PATTERN } from '../../src/data/cases/test-utils';
import { facts } from '../../src/data/facts';
import { formatNumber } from '../../src/lib/format';
import { rewardStatusLabel } from '../../src/lib/status';
import { expectCaseStructure, loadCasePage, mainTextWithFaq } from './case-page';
import { normalizeText } from './helpers';

const SLUG = 'member-milestone-rewards';

describe('dist 獎勵系統案例頁', () => {
  it('dist 獎勵案例上線前不宣稱', () => {
    const $ = loadCasePage(SLUG);
    const mainText = normalizeText($('main').text());
    const text = mainTextWithFaq($);

    expect(mainText).toContain(rewardStatusLabel(facts.rewardSystem.status, 'zh-TW'));
    if (facts.rewardSystem.status === 'testing') {
      expect(text).not.toContain('已上線');
      expect(text).not.toMatch(FULL_DATE_PATTERN);
      expect(text).not.toMatch(FOUR_PART_VERSION_PATTERN);
      expect(text).not.toMatch(LAUNCH_DATE_PATTERN);
    }
  });

  it('dist 獎勵案例結構', () => {
    expectCaseStructure(loadCasePage(SLUG), SLUG, 4);
  });

  it('dist 獎勵案例含 facts 值與摘要表', () => {
    const $ = loadCasePage(SLUG);
    const content = getCase('zh-TW', SLUG, facts);
    const summaryText = normalizeText($('main [data-section="case-summary"]').text());

    expect(mainTextWithFaq($)).toContain(`${formatNumber(facts.rewardSystem.milestoneVisits)} 次`);
    for (const value of [content?.period, content?.role, content?.maturity, ...(content?.tech ?? [])]) {
      expect(summaryText).toContain(value);
    }
    expect(normalizeText($('main [data-section="ai-note"]').text())).toContain(content?.aiNote);
  });

  it('dist 獎勵案例狀態圖只畫概念層級', () => {
    const $ = loadCasePage(SLUG);
    const svgText = normalizeText($('main svg').text());

    for (const label of ['累積中', '可登記尺寸', '已滿百', '已訂購', '已到貨', '已領取', '轉店']) {
      expect(svgText).toContain(label);
    }
    // 不寫內部狀態代碼、門檻天數、截止日與事實數字。
    expect(svgText).not.toMatch(/[A-Z][a-z]+[A-Z]|\d+\s*天|截止|期限/);
    expect(svgText).not.toContain(formatNumber(facts.rewardSystem.milestoneVisits));
  });
});
