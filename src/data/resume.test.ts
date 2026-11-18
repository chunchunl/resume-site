import { describe, expect, it } from 'vitest';
import { formatNumber } from '../lib/format';
import { collectStrings, FULL_DATE_PATTERN, writingRuleViolations } from './cases/test-utils';
import { facts, type Facts } from './facts';
import { buildResume } from './resume';
import { site, type Site } from './site';

/** 兩組假事實：每個欄位的值都不同，也都不同於正式的事實。 */
const factsA: Facts = {
  eventPlatform: { backendTests: 611, frontendTests: 322, loadTestRequests: 2455, e2eIssuesFixed: 13 },
  rewardSystem: { status: 'testing', milestoneVisits: 120 },
  rag: { indexedChunks: 4100, evalBefore: { passed: 11, total: 19 }, evalAfter: { passed: 21, total: 21 } },
  inventory: { alignmentMeetings: 7, gapItems: 38 },
};

const factsB: Facts = {
  eventPlatform: { backendTests: 733, frontendTests: 288, loadTestRequests: 3566, e2eIssuesFixed: 27 },
  rewardSystem: { status: 'launched', milestoneVisits: 150 },
  rag: { indexedChunks: 5200, evalBefore: { passed: 9, total: 23 }, evalAfter: { passed: 25, total: 25 } },
  inventory: { alignmentMeetings: 9, gapItems: 43 },
};

/** 求職頁會用到的三個事實，在頁面上的寫法。 */
function formattedValues(source: Facts): string[] {
  return [
    `後端 ${formatNumber(source.eventPlatform.backendTests)} 項`,
    `前端 ${formatNumber(source.eventPlatform.frontendTests)} 項`,
    `${formatNumber(source.eventPlatform.loadTestRequests)} 個請求`,
  ];
}

/** 三個事實的數值本身（不帶單位），用來確認另一份輸出完全沒有它。 */
function rawValues(source: Facts): string[] {
  return [
    formatNumber(source.eventPlatform.backendTests),
    formatNumber(source.eventPlatform.frontendTests),
    formatNumber(source.eventPlatform.loadTestRequests),
    String(source.eventPlatform.loadTestRequests),
  ];
}

describe('buildResume', () => {
  it('buildResume 區塊齊全', () => {
    const content = buildResume(facts, site);

    expect(content.summary.trim()).not.toBe('');
    expect(content.experience).toHaveLength(3);
    expect(content.experience[0]?.points).toHaveLength(4);
    expect(content.experience[1]?.points).toHaveLength(1);
    expect(content.experience[2]?.points).toHaveLength(1);
    expect(content.skills).toHaveLength(4);
    expect(content.education).toHaveLength(3);
    // Erica 2026-11-18：求職頁不公開可到職時間。
    expect(content).not.toHaveProperty('availability');
    expect(content.headings).not.toHaveProperty('availability');
    expect(collectStrings(content).join('\n')).not.toMatch(/到職/);
  });

  it('buildResume 數字跟著 facts 變', () => {
    const textA = collectStrings(buildResume(factsA, site)).join('\n');
    const textB = collectStrings(buildResume(factsB, site)).join('\n');

    for (const value of formattedValues(factsA)) {
      expect(textA, value).toContain(value);
      expect(textB, value).not.toContain(value);
    }
    for (const value of formattedValues(factsB)) expect(textB, value).toContain(value);
    for (const value of rawValues(facts)) {
      expect(textA, value).not.toContain(value);
      expect(textB, value).not.toContain(value);
    }
  });

  it('buildResume 技能不列未成熟項目', () => {
    const skillText = collectStrings(buildResume(facts, site).skills).join('\n');

    for (const banned of ['Python', 'Docker', 'LangChain', 'LangGraph', '平台工程', 'Agent runtime', 'orchestration']) {
      expect(skillText, banned).not.toContain(banned);
    }
    expect(buildResume(facts, site).skills.map((group) => group.name)).toEqual([
      'Frontend',
      'Content Frontend & AEO',
      'Backend & Delivery',
      'AI Application',
    ]);
  });

  it('buildResume 資策會只列已確認技術', () => {
    const entry = buildResume(facts, site).education.find((item) => item.org.includes('資策會'));

    expect(entry).toBeDefined();
    const text = collectStrings(entry).join('\n');
    for (const banned of ['TypeScript', 'Tailwind', 'Vue']) expect(text, banned).not.toContain(banned);
  });

  it('buildResume 期間只到月', () => {
    const content = buildResume(facts, site);
    const periods = [...content.experience, ...content.education].map((item) => item.period);

    expect(periods).toHaveLength(6);
    for (const period of periods) {
      expect(period, period).toMatch(/^\d{4}-\d{2} 至(?: \d{4}-\d{2}|今)$/);
      expect(period, period).not.toMatch(FULL_DATE_PATTERN);
    }
  });

  it('buildResume 不提前宣稱', () => {
    const text = collectStrings(buildResume(facts, site)).join('\n');

    for (const banned of ['正式官網', '部署營運', '精通']) expect(text, banned).not.toContain(banned);
    expect(buildResume(facts, site).experience[0]?.points[3]).toContain('原型');
    expect(buildResume(facts, site).experience[0]?.points[3]).toContain('技術檢測');
  });

  it('buildResume 聯絡資料', () => {
    const siteWithoutJobsEmail: Site = { ...site, contactEmails: { ...site.contactEmails, jobs: null } };
    const withoutEmail = buildResume(facts, siteWithoutJobsEmail);
    const normal = buildResume(facts, site);
    const normalText = collectStrings(normal).join('\n');

    expect(withoutEmail.contact.email).toBeNull();
    expect(collectStrings(withoutEmail).join('\n')).not.toMatch(/@/);
    expect(normal.contact.email).toBe(site.contactEmails.jobs);
    expect(normal.contact.url).toBe(site.url);
    expect(normalText).not.toContain(String(site.contactEmails.work));
  });

  it('buildResume 頁面身分', () => {
    const content = buildResume(facts, site);

    expect(content.title).toBe(`求職履歷｜${site.name} ${site.alternateName}`);
    expect(content.name).toBe(`${site.name} ${site.alternateName}`);
    expect(content.jobTitle).toBe(site.jobTitle);
  });

  it('buildResume Curves 經歷寫法', () => {
    const [curves] = buildResume(facts, site).experience;

    expect(curves?.org).toBe('韻智股份有限公司（Curves 台灣總部）');
    expect(curves?.role).toBe('前端工程師');
    expect(curves?.period).toBe('2025-07 至今');
  });

  it('buildResume 文案規則', () => {
    const content = buildResume(facts, site);

    expect(writingRuleViolations(collectStrings(content))).toEqual([]);
    expect(content.summary).toMatch(/^我/);
  });
});
