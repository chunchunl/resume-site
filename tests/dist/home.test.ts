import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { facts } from '../../src/data/facts';
import { buildHome } from '../../src/data/home';
import { site } from '../../src/data/site';
import { formatNumber, formatRatio } from '../../src/lib/format';
import { buildPersonJsonLd, buildWebSiteJsonLd } from '../../src/lib/seo';
import { rewardStatusLabel } from '../../src/lib/status';
import { listHtmlFiles, normalizeText, readDist } from './helpers';

const SECTION_ORDER = ['hero', 'featured-work', 'other-work', 'how-i-work', 'contact'];
const NAV_LINKS = ['/', '/work/', '/services/', '/resume/'];
const SENSITIVE_KEYS = ['telephone', 'birthDate', 'streetAddress', 'email'];
const DATE_PATTERN = /\d{4}\s*[-/.年]\s*\d{1,2}/;
const FOUR_PART_VERSION_PATTERN = /\d+\.\d+\.\d+\.\d+/;

const loadHome = (): cheerio.CheerioAPI => cheerio.load(readDist('index.html'));

/** 取出頁面上全部 JSON-LD 區塊並解析。 */
function parseJsonLd($: cheerio.CheerioAPI): Record<string, unknown>[] {
  return $('script[type="application/ld+json"]')
    .toArray()
    .map((element) => JSON.parse($(element).text()) as Record<string, unknown>);
}

/** 取出物件（含巢狀與陣列）裡全部的鍵。 */
function collectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectKeys);
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => [key, ...collectKeys(child)]);
  }
  return [];
}

/** 判斷連結是否指向其他網域。 */
function isExternalLink(href: string): boolean {
  if (!/^(https?:)?\/\//i.test(href)) return false;
  return new URL(href, site.url).host !== new URL(site.url).host;
}

describe('dist 首頁', () => {
  it('dist 首頁第一屏', () => {
    const $ = loadHome();
    const hero = $('main [data-section="hero"]');

    expect(normalizeText($('main h1').text())).toBe('林昱均 Erica Lin');
    expect(hero).toHaveLength(1);
    expect(hero.find('h1')).toHaveLength(1);
    expect(normalizeText(hero.text())).toContain(site.jobTitle);
    expect(normalizeText(hero.text())).toContain(site.tagline);
    expect(hero.find('a[href="/services/"]')).toHaveLength(1);
    expect(hero.find('a[href="/resume/"]')).toHaveLength(1);
    expect(normalizeText(hero.find('a[href="/services/"]').text())).toBe('找我合作');
    expect(normalizeText(hero.find('a[href="/resume/"]').text())).toBe('求職履歷');
    // 頭像還沒提供，首頁先不放任何圖片。
    expect($('main img')).toHaveLength(0);
  });

  it('dist 首頁區塊順序', () => {
    const $ = loadHome();
    const sections = $('main [data-section]')
      .toArray()
      .map((element) => $(element).attr('data-section'))
      .filter((name) => name !== 'reward-system');

    expect(sections).toEqual(SECTION_ORDER);
  });

  it('dist 首頁三張案例卡', () => {
    const $ = loadHome();
    const links = $('[data-section="featured-work"] a')
      .toArray()
      .map((element) => $(element).attr('href'));

    expect(links).toHaveLength(3);
    expect(links).toEqual(buildHome(facts, site).cases.map((card) => card.href));
  });

  it('dist 首頁數字與 facts 一致', () => {
    const text = normalizeText(loadHome()('[data-section="featured-work"]').text());

    expect(text).toContain(`${formatNumber(facts.eventPlatform.backendTests)} 項`);
    expect(text).toContain(`${formatNumber(facts.eventPlatform.frontendTests)} 項`);
    expect(text).toContain(`${formatNumber(facts.eventPlatform.loadTestRequests)} 個請求`);
    expect(text).toContain(`修正 ${formatNumber(facts.eventPlatform.e2eIssuesFixed)} 個`);
    expect(text).toContain(`每累積 ${formatNumber(facts.rewardSystem.milestoneVisits)} 次`);
    expect(text).toContain(`${formatNumber(facts.rag.indexedChunks)} 個`);
    expect(text).toContain(formatRatio(facts.rag.evalBefore, 'zh-TW'));
    expect(text).toContain(formatRatio(facts.rag.evalAfter, 'zh-TW'));
  });

  it('dist 首頁獎勵系統狀態', () => {
    const section = loadHome()('[data-section="featured-work"] [data-section="reward-system"]');
    const text = normalizeText(section.text());

    expect(section).toHaveLength(1);
    expect(text).toContain(rewardStatusLabel(facts.rewardSystem.status, 'zh-TW'));

    if (facts.rewardSystem.status === 'testing') {
      expect(text).not.toContain('已上線');
      expect(text).not.toMatch(DATE_PATTERN);
      expect(text).not.toMatch(FOUR_PART_VERSION_PATTERN);
    }
  });

  it('dist 首頁 JSON-LD', () => {
    const blocks = parseJsonLd(loadHome());
    const people = blocks.filter((block) => block['@type'] === 'Person');
    const websites = blocks.filter((block) => block['@type'] === 'WebSite');
    const expectedSameAs = [site.links.linkedin, site.links.github].filter((url) => url !== null);

    expect(people).toHaveLength(1);
    expect(websites).toHaveLength(1);
    expect(people[0]).toEqual(buildPersonJsonLd(site));
    expect(websites[0]).toEqual(buildWebSiteJsonLd(site));
    expect(people[0]?.name).toBe('林昱均');
    expect(people[0]?.alternateName).toBe('Erica Lin');
    expect(people[0]?.sameAs).toEqual(expectedSameAs);

    for (const key of SENSITIVE_KEYS) {
      expect(collectKeys(blocks), `JSON-LD 不該輸出 ${key}`).not.toContain(key);
    }
  });

  it('dist 首頁外連結屬性', () => {
    const htmlFiles = listHtmlFiles();
    expect(htmlFiles.length).toBeGreaterThan(0);

    let externalLinkCount = 0;
    for (const file of htmlFiles) {
      const $ = cheerio.load(readDist(file));
      for (const element of $('a[href]').toArray()) {
        const href = $(element).attr('href') ?? '';
        if (!isExternalLink(href)) continue;

        externalLinkCount += 1;
        const rel = ($(element).attr('rel') ?? '').split(/\s+/);
        expect(rel, `${file} 的外連結 ${href} 缺 noopener`).toContain('noopener');
        expect(rel, `${file} 的外連結 ${href} 缺 noreferrer`).toContain('noreferrer');
      }
    }
    // 至少有 GitHub 一個外連結，避免這條測試因為找不到連結而空過。
    expect(externalLinkCount).toBeGreaterThan(0);
  });

  it('dist 首頁其他作品寫明責任，且不放外部連結', () => {
    const section = loadHome()('[data-section="other-work"]');

    expect(normalizeText(section.text())).toContain('程式由其他工程師實作');
    expect(section.find('a')).toHaveLength(0);
  });

  it('dist 首頁我怎麼工作有三點', () => {
    const $ = loadHome();
    const titles = $('[data-section="how-i-work"] h3')
      .toArray()
      .map((element) => normalizeText($(element).text()));

    expect(titles).toEqual(buildHome(facts, site).howIWork.map((item) => item.title));
    expect(titles).toHaveLength(3);
  });

  it('dist 首頁聯絡區塊', () => {
    const $ = loadHome();
    const section = $('[data-section="contact"]');
    const { contact } = buildHome(facts, site);
    const mailtoLinks = section
      .find('a[href^="mailto:"]')
      .toArray()
      .map((element) => $(element).attr('href'));

    expect(contact.emails.length).toBeGreaterThan(0);
    expect(mailtoLinks).toEqual(contact.emails.map((email) => `mailto:${email.address}`));
    for (const email of contact.emails) {
      expect(normalizeText(section.text())).toContain(email.label);
      expect(normalizeText(section.text())).toContain(email.address);
    }
    for (const link of contact.links) {
      expect(section.find(`a[href="${link.href}"]`)).toHaveLength(1);
    }
    if (site.links.linkedin === null) {
      expect(normalizeText(section.text())).not.toContain('LinkedIn');
    }
  });

  it('dist 首頁卡片標題在其他內容之前', () => {
    const $ = loadHome();
    const cards = $('[data-section="featured-work"] article').toArray();

    expect(cards).toHaveLength(3);
    for (const card of cards) {
      // 螢幕報讀器用標題跳到卡片時，狀態與所屬單位要在標題之後才讀得到。
      expect($(card).children().first().is('h3'), $(card).text()).toBe(true);
    }
  });

  it('dist 首頁連結齊全且沒有輸出空值', () => {
    const $ = loadHome();
    const home = buildHome(facts, site);
    const hrefs = $('main a[href]')
      .toArray()
      .map((element) => $(element).attr('href') ?? '');
    const expectedCount =
      home.hero.actions.length +
      home.hero.links.length +
      home.cases.length +
      home.contact.emails.length +
      home.contact.links.length;

    expect(hrefs).toHaveLength(expectedCount);
    expect(normalizeText($('body').text())).not.toMatch(/\b(null|undefined)\b/);
    for (const href of hrefs) {
      expect(href).not.toMatch(/null|undefined/);
      expect(href.trim()).not.toBe('');
    }
  });
});

describe('dist 全站身分', () => {
  it('dist 每頁都有導覽與頁尾，且在 main 之外', () => {
    for (const file of listHtmlFiles()) {
      const $ = cheerio.load(readDist(file));
      const navLinks = $('body > header nav a')
        .toArray()
        .map((element) => $(element).attr('href'));

      expect(navLinks, `${file} 的導覽連結`).toEqual(NAV_LINKS);
      expect($('body > footer'), `${file} 缺頁尾`).toHaveLength(1);
      expect($('main header, main footer'), `${file} 的頁首或頁尾在 main 裡`).toHaveLength(0);
      // 案例頁的麵包屑是頁面內的 nav，只豁免這一種。
      expect($('main nav').not('nav.breadcrumb[aria-label="麵包屑"]'), `${file} 的 main 裡有其他 nav`).toHaveLength(0);
      expect($('body > main'), `${file} 的 main`).toHaveLength(1);
    }
  });

  it('dist 首頁導覽標出目前頁面', () => {
    const $ = loadHome();
    const current = $('body > header nav a[aria-current="page"]');

    expect(current).toHaveLength(1);
    expect(current.attr('href')).toBe('/');
  });

  it('dist 頁尾有公開信箱、GitHub 與隱私說明', () => {
    const $ = loadHome();
    const footer = $('body > footer');

    for (const address of [site.contactEmails.work, site.contactEmails.jobs]) {
      if (address !== null) expect(footer.find(`a[href="mailto:${address}"]`)).toHaveLength(1);
    }
    for (const url of [site.links.github, site.links.linkedin]) {
      if (url !== null) expect(footer.find(`a[href="${url}"]`)).toHaveLength(1);
    }
    expect(footer.find('a[href="/privacy/"]')).toHaveLength(1);
  });

  it('dist 每頁有跳到主要內容的連結', () => {
    for (const file of listHtmlFiles()) {
      const $ = cheerio.load(readDist(file));
      const target = $('body a[href^="#"]').first().attr('href') ?? '';

      expect(target, `${file} 缺跳到主要內容的連結`).toBe('#main');
      expect($('main#main'), `${file} 的 main 缺 id`).toHaveLength(1);
    }
  });

  it('dist 全站文案不用破折號與套話', () => {
    for (const file of listHtmlFiles()) {
      const text = normalizeText(cheerio.load(readDist(file))('body').text());

      expect(text, file).not.toMatch(/[—─]/);
      expect(text, file).not.toMatch(/我們|打造|賦能|不只是/);
    }
  });

  it('dist 頁尾與第一屏的外部連結順序一致', () => {
    const $ = loadHome();
    const heroLinks = $('[data-section="hero"] .hero__links a').toArray().map((element) => $(element).attr('href'));
    const footerLinks = $('body > footer a[rel~="noopener"]').toArray().map((element) => $(element).attr('href'));

    expect(footerLinks).toEqual(heroLinks);
  });

  it('dist 全站每頁 title 互不相同', () => {
    const titles = listHtmlFiles().map((file) => cheerio.load(readDist(file))('title').text().trim());

    expect(titles.every((title) => title !== '')).toBe(true);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
