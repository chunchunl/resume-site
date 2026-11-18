import { describe, expect, it } from 'vitest';
import { findPlaceholders } from '../../scripts/check-content';
import { getCases } from '../data/cases';
import { countOccurrences, writingRuleViolations } from '../data/cases/test-utils';
import { facts, type Facts } from '../data/facts';
import { buildServices, formatServicePrice, type ServiceItem } from '../data/services';
import { site, type Site } from '../data/site';
import { formatNumber, formatRatio } from './format';
import { buildLlmsTxt } from './llms';
import { rewardStatusLabel } from './status';

/**
 * 兩組假事實：每個欄位的值都不同，也不同於正式的事實；
 * 格式化後的寫法也不會包含正式值或另一組的值（例如 4,100 會含正式的 100，所以不用）。
 */
const factsA: Facts = {
  eventPlatform: { backendTests: 611, frontendTests: 322, loadTestRequests: 2466, e2eIssuesFixed: 13 },
  rewardSystem: { status: 'testing', milestoneVisits: 137 },
  rag: { indexedChunks: 4200, evalBefore: { passed: 11, total: 19 }, evalAfter: { passed: 21, total: 21 } },
};

const factsB: Facts = {
  eventPlatform: { backendTests: 733, frontendTests: 288, loadTestRequests: 3566, e2eIssuesFixed: 27 },
  rewardSystem: { status: 'launched', milestoneVisits: 245 },
  rag: { indexedChunks: 5200, evalBefore: { passed: 9, total: 23 }, evalAfter: { passed: 25, total: 25 } },
};

/** 外部連結用虛構網址的假身分資料；正式 LinkedIn 網址裡有和事實相同的數字，比對數字時不用它。 */
const fakeSite: Site = {
  ...site,
  links: { github: 'https://github.com/example-user', linkedin: 'https://www.linkedin.com/in/example-user/' },
};

/** 產生一項假服務。 */
function fakeService(id: string, priceFrom: number): ServiceItem {
  return {
    id,
    name: `假服務 ${id}`,
    audience: '測試用',
    includes: ['一項'],
    excludes: ['一項'],
    priceFrom,
    priceUnit: null,
    quoteRequired: false,
  };
}

/** 起價都不含正式事實數字（例如正式起價 NT$100,000 含 100）的假服務清單。 */
const fakeServices: ServiceItem[] = [fakeService('alpha', 6000), fakeService('beta', 42000)];

/** 一組事實在 llms.txt 裡會出現的寫法（來自案例的摘要與結果）。 */
function formattedValues(input: Facts): string[] {
  const { eventPlatform, rewardSystem, rag } = input;
  return [
    `後端 ${formatNumber(eventPlatform.backendTests)} 項`,
    `前端 ${formatNumber(eventPlatform.frontendTests)} 項`,
    `修正 ${formatNumber(eventPlatform.e2eIssuesFixed)} 個`,
    `壓測 ${formatNumber(eventPlatform.loadTestRequests)} 個請求`,
    `每累積 ${formatNumber(rewardSystem.milestoneVisits)} 次`,
    `目前狀態：${rewardStatusLabel(rewardSystem.status, 'zh-TW')}`,
    `約 ${formatNumber(rag.indexedChunks)} 個`,
    `${formatRatio(rag.evalBefore, 'zh-TW')} 題`,
    `${formatRatio(rag.evalAfter, 'zh-TW')} 題`,
  ];
}

/** 一組事實的數值本身（不帶單位），用來確認另一份輸出完全沒有它。 */
function rawValues(input: Facts, options: { includeStatus: boolean }): string[] {
  const { eventPlatform, rewardSystem, rag } = input;
  const values = [
    formatNumber(eventPlatform.backendTests),
    formatNumber(eventPlatform.frontendTests),
    formatNumber(eventPlatform.loadTestRequests),
    String(eventPlatform.loadTestRequests),
    formatNumber(eventPlatform.e2eIssuesFixed),
    formatNumber(rewardSystem.milestoneVisits),
    formatNumber(rag.indexedChunks),
    String(rag.indexedChunks),
    formatRatio(rag.evalBefore, 'zh-TW'),
    formatRatio(rag.evalAfter, 'zh-TW'),
  ];
  return options.includeStatus ? [...values, rewardStatusLabel(rewardSystem.status, 'zh-TW')] : values;
}

/** 用一組事實與服務清單產生 llms.txt。 */
function llmsWith(input: Facts, services: ServiceItem[], siteData: Site = fakeSite): string {
  return buildLlmsTxt({ site: siteData, cases: getCases('zh-TW', input), services });
}

/** 取出某個 `## 標題` 段落的內容（不含標題行），找不到時回傳空字串。 */
function sectionOf(text: string, heading: string): string {
  const parts = text.split(/^## /m);
  const part = parts.find((chunk) => chunk.startsWith(`${heading}\n`));
  return part === undefined ? '' : part.slice(heading.length + 1);
}

/** 取出全部 `[名稱](網址)` 連結的網址。 */
function linkUrls(text: string): string[] {
  return [...text.matchAll(/\]\(([^)\s]*)\)/g)].map((match) => match[1] ?? '');
}

/** 正式資料產生的 llms.txt。 */
const officialText = (): string =>
  buildLlmsTxt({ site, cases: getCases('zh-TW', facts), services: buildServices(site).services });

describe('buildLlmsTxt', () => {
  it('buildLlmsTxt 不提可到職時間與修正前的弱點', () => {
    const text = officialText();

    // Erica 2026-11-18：求職頁不公開可到職時間；案例只寫現在怎麼保護。
    expect(text).not.toMatch(/到職/);
    expect(text).not.toMatch(/沒有限制|沒有檢查|預設拒絕|靜默/);
  });

  it('buildLlmsTxt 結構', () => {
    const text = officialText();
    const lines = text.split('\n').filter((line) => line.trim() !== '');

    expect(text.split('\n')[0]).toBe('# 林昱均 Erica Lin');
    expect(lines[1]).toMatch(/^> /);
    expect(lines[1]).toContain(site.jobTitle);
    expect(lines[1]).toContain(site.tagline);
    expect(lines[1]).toContain(site.location);
    for (const heading of ['頁面', '案例', '服務', '聯絡']) {
      expect(text, heading).toMatch(new RegExp(`^## ${heading}$`, 'm'));
      expect(sectionOf(text, heading).trim(), `${heading} 段是空的`).not.toBe('');
    }
  });

  it('buildLlmsTxt 列出五個頁面與三個案例', () => {
    const text = officialText();
    const pageUrls = linkUrls(sectionOf(text, '頁面'));
    const caseUrls = linkUrls(sectionOf(text, '案例'));
    const cases = getCases('zh-TW', facts);

    expect(pageUrls).toEqual(['/', '/work/', '/services/', '/resume/', '/privacy/'].map((path) => `${site.url}${path}`));
    expect(caseUrls).toEqual(cases.map((content) => `${site.url}/work/${content.slug}/`));
    for (const content of cases) {
      expect(text).toContain(`[${content.title}](${site.url}/work/${content.slug}/): ${content.summary}`);
      for (const result of content.results) expect(sectionOf(text, '案例')).toContain(result);
    }
  });

  it('buildLlmsTxt 數字跟著 facts 變', () => {
    const textA = llmsWith(factsA, fakeServices);
    const textB = llmsWith(factsB, fakeServices);
    const textOfficial = llmsWith(facts, fakeServices);

    for (const value of formattedValues(factsA)) expect(textA, `A 應含「${value}」`).toContain(value);
    for (const value of rawValues(factsB, { includeStatus: true })) expect(textA, `A 不應含「${value}」`).not.toContain(value);

    for (const value of formattedValues(factsB)) expect(textB, `B 應含「${value}」`).toContain(value);
    for (const value of rawValues(factsA, { includeStatus: true })) expect(textB, `B 不應含「${value}」`).not.toContain(value);

    // 正式值不得出現在假 facts 的輸出；狀態只有兩種，A 與正式值相同，不比狀態。
    for (const value of rawValues(facts, { includeStatus: false })) {
      expect(textA, `A 不應含正式值「${value}」`).not.toContain(value);
      expect(textB, `B 不應含正式值「${value}」`).not.toContain(value);
    }

    // 2 位數以下的值靠「每種寫法出現次數相同」擋寫死：寫死的值換一組 facts 時次數會不同。
    const official = formattedValues(facts);
    for (const [index, value] of formattedValues(factsA).entries()) {
      const count = countOccurrences(textA, value);
      expect(count, value).toBeGreaterThan(0);
      expect(countOccurrences(textB, formattedValues(factsB)[index] ?? ''), value).toBe(count);
      expect(countOccurrences(textOfficial, official[index] ?? ''), value).toBe(count);
    }
  });

  it('buildLlmsTxt 價格跟著 services 變', () => {
    const [first, ...rest] = buildServices(site).services;
    const changed: ServiceItem = { ...first!, priceFrom: 12345 };
    const text = llmsWith(facts, [changed, ...rest], site);

    expect(text).toContain('NT$12,345');
    expect(text).not.toContain(formatServicePrice(first!));
    for (const service of [changed, ...rest]) {
      expect(sectionOf(text, '服務')).toContain(service.name);
      expect(sectionOf(text, '服務')).toContain(formatServicePrice(service));
    }
  });

  it('buildLlmsTxt 連結都是站內正式網址', () => {
    const text = officialText();
    const urls = linkUrls(text);
    const contact = sectionOf(text, '聯絡');

    expect(urls.length).toBeGreaterThanOrEqual(8);
    for (const url of urls) expect(url).toMatch(/^https:\/\/lin-yu-chun\.com\//);
    for (const url of [site.links.linkedin, site.links.github]) {
      if (url === null) continue;
      expect(contact, url).toContain(url);
      expect(countOccurrences(text, url), url).toBe(1);
      expect(text).not.toContain(`](${url})`);
    }
    for (const address of [site.contactEmails.work, site.contactEmails.jobs]) {
      if (address === null) continue;
      expect(contact).toContain(address);
      expect(text).not.toContain(`mailto:${address}`);
    }
  });

  it('buildLlmsTxt 沒有值的聯絡方式不列', () => {
    const partial: Site = {
      ...fakeSite,
      links: { github: 'https://github.com/example-user', linkedin: null },
      contactEmails: { work: null, jobs: site.contactEmails.jobs },
    };
    const contact = sectionOf(llmsWith(facts, fakeServices, partial), '聯絡');

    expect(site.contactEmails.jobs).not.toBeNull();
    expect(contact).toContain(site.contactEmails.jobs);
    expect(contact).toContain('https://github.com/example-user');
    expect(contact).not.toContain('LinkedIn');
    expect(contact).not.toContain('接案洽詢');
    expect(contact).not.toContain('null');
  });

  it('buildLlmsTxt 沒有佔位符', () => {
    expect(findPlaceholders(officialText(), 'llms.txt')).toEqual([]);
  });

  it('buildLlmsTxt 不含個資', () => {
    const text = officialText();
    const subdomains = [...text.matchAll(/([a-z0-9-]+)\.lin-yu-chun\.com/gi)].map((match) => match[1]);

    expect(text).not.toMatch(/(?:\+886[-\s]?|0)9\d{2}[-\s]?\d{3}[-\s]?\d{3}/);
    expect(text).not.toContain('gmail.com');
    expect(subdomains.filter((name) => name !== 'www')).toEqual([]);
  });

  it('buildLlmsTxt 文案規則', () => {
    // 網址不是文案，先拿掉再檢查。
    const lines = officialText()
      .split('\n')
      .map((line) => line.replace(/https?:\/\/\S+/g, ''));

    expect(writingRuleViolations(lines)).toEqual([]);
  });
});
