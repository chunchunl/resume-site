import { describe, expect, it } from 'vitest';
import { formatNumber } from '../../../lib/format';
import { rewardStatusLabel } from '../../../lib/status';
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
import { validateCase } from '../types';
import { buildCase } from './member-milestone-rewards';

/** 只改獎勵系統欄位的事實。 */
function withReward(reward: Partial<Facts['rewardSystem']>): Facts {
  return { ...facts, rewardSystem: { ...facts.rewardSystem, ...reward } };
}

const testingFacts = withReward({ status: 'testing' });
const launchedFacts = withReward({ status: 'launched' });

/** 兩組假的里程碑次數；彼此不同，也不同於正式的事實。 */
const factsA = withReward({ milestoneVisits: 137 });
const factsB = withReward({ milestoneVisits: 245 });

/** 里程碑次數在頁面上的寫法。 */
const milestoneText = (input: Facts): string => `${formatNumber(input.rewardSystem.milestoneVisits)} 次`;

describe('會員運動里程碑獎勵系統案例', () => {
  it('reward buildCase 通過驗證', () => {
    const content = buildCase(facts);
    const headings = content.sections.map((section) => section.heading);

    expect(validateCase(content)).toEqual([]);
    expect(content.slug).toBe('member-milestone-rewards');
    expect(content.lang).toBe('zh-TW');
    expect(content.order).toBe(2);
    expect(content.title).toBe('會員運動里程碑獎勵系統');
    expect(headings.filter((heading) => heading.endsWith('？')).length).toBeGreaterThanOrEqual(4);
    for (const required of ['此系統解決的問題是什麼？', '負責範圍包含哪些？', '排程重新執行時，如何避免重複？', '如何驗證系統正確？']) {
      expect(headings).toContain(required);
    }
  });

  it('reward buildCase 狀態跟著 facts 變', () => {
    const testing = buildCase(testingFacts);
    const launched = buildCase(launchedFacts);

    expect(testing.maturity).toBe(rewardStatusLabel('testing', 'zh-TW'));
    expect(collectStrings(testing).join('\n')).not.toContain('已上線');
    expect(launched.maturity).toBe(rewardStatusLabel('launched', 'zh-TW'));
    // 上線後不能留著測試中的文字。
    expect(collectStrings(launched).join('\n')).not.toContain(rewardStatusLabel('testing', 'zh-TW'));
  });

  it('reward buildCase 不含日期與版本號', () => {
    const text = collectStrings(buildCase(testingFacts)).join('\n');

    expect(text).not.toMatch(FULL_DATE_PATTERN);
    expect(text).not.toMatch(FOUR_PART_VERSION_PATTERN);
    expect(text).not.toMatch(LAUNCH_DATE_PATTERN);
  });

  it('reward buildCase 里程碑次數跟著 facts 變', () => {
    const textA = collectStrings(buildCase(factsA)).join('\n');
    const textB = collectStrings(buildCase(factsB)).join('\n');
    const textOfficial = collectStrings(buildCase(facts)).join('\n');
    const officialValue = formatNumber(facts.rewardSystem.milestoneVisits);

    expect(textA).toContain(milestoneText(factsA));
    expect(textA).not.toContain(formatNumber(factsB.rewardSystem.milestoneVisits));
    expect(textB).toContain(milestoneText(factsB));
    expect(textB).not.toContain(formatNumber(factsA.rewardSystem.milestoneVisits));

    // 正式值不能出現在假事實的輸出裡，才擋得住寫死的數字。
    expect(textA, `A 不應含正式值「${officialValue}」`).not.toContain(officialValue);
    expect(textB, `B 不應含正式值「${officialValue}」`).not.toContain(officialValue);

    // 出現次數相同，代表沒有哪一處是寫死的。
    expect(countOccurrences(textA, milestoneText(factsA))).toBeGreaterThan(0);
    expect(countOccurrences(textA, milestoneText(factsA))).toBe(countOccurrences(textOfficial, milestoneText(facts)));
  });

  it('reward buildCase 摘要表照事實寫', () => {
    const content = buildCase(facts);

    expect(content.period).toBe('2026-09 至今');
    expect(content.role).toBe('獨立開發（後端團隊提供架構與 code review 諮詢）');
    expect(content.tech).toEqual(['C#', '.NET', 'SQL Server', 'Stored Procedure', 'Hangfire', 'React']);
  });

  it('reward buildCase 有一張概念層級的狀態圖', () => {
    const diagrams = buildCase(facts)
      .sections.map((section) => section.diagram)
      .filter((diagram) => diagram !== undefined);

    expect(diagrams).toEqual(['reward-states']);
  });

  it('reward buildCase 不寫內部細節與上線後才有的數字', () => {
    const text = visibleStrings(buildCase(facts)).join('\n');

    // 門檻天數、截止日規則、內部代號與分支、資料表與程序名稱都不公開。
    expect(text).not.toMatch(/\d+\s*天|截止|期限|Phase|develop|dbo\.|usp_|[A-Z][a-z]+[A-Z]\w*/);
    // 使用店舖數與紀錄數要上線後才有。
    expect(text).not.toMatch(/\d+\s*(?:間|家)店|\d+\s*筆/);
    // 內部初審不寫成正式核准或認證。
    expect(text).not.toMatch(/核准|認證|通過審查/);
  });

  it('reward buildCase 文案符合公開寫作規則', () => {
    expect(writingRuleViolations(visibleStrings(buildCase(facts)))).toEqual([]);
  });
});
