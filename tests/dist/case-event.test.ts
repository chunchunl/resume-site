import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { getCase } from '../../src/data/cases';
import { facts } from '../../src/data/facts';
import { site } from '../../src/data/site';
import { formatNumber } from '../../src/lib/format';
import { normalizeText, readDist } from './helpers';

const SLUG = 'event-ticketing-platform';

const loadPage = (): cheerio.CheerioAPI => cheerio.load(readDist(`work/${SLUG}/index.html`));

/** 取出頁面上全部 JSON-LD 區塊並解析。 */
function parseJsonLd($: cheerio.CheerioAPI): Record<string, unknown>[] {
  return $('script[type="application/ld+json"]')
    .toArray()
    .map((element) => JSON.parse($(element).text()) as Record<string, unknown>);
}

/** 取出指定類型的 JSON-LD（恰好一個，不是就讓測試失敗）。 */
function onlyJsonLd($: cheerio.CheerioAPI, type: string): Record<string, unknown> {
  const matches = parseJsonLd($).filter((block) => block['@type'] === type);
  expect(matches, `${type} 的數量`).toHaveLength(1);
  return matches[0] ?? {};
}

type FaqEntity = { name: string; acceptedAnswer: { text: string } };

describe('dist 活動案例頁', () => {
  it('dist 活動案例 FAQ 與可見文字一致', () => {
    const $ = loadPage();
    const entities = onlyJsonLd($, 'FAQPage').mainEntity as FaqEntity[];
    const faq = getCase('zh-TW', SLUG, facts)?.faq ?? [];
    const visibleQuestions = $('main .faq__question').toArray().map((element) => $(element).text().trim());
    const visibleAnswers = $('main .faq__answer').toArray().map((element) => $(element).text().trim());

    expect(entities.length).toBeGreaterThanOrEqual(3);
    // 逐項比對，不收空白：頁面上的問答、JSON-LD 與內容函式三邊完全相同。
    expect(visibleQuestions).toEqual(entities.map((entity) => entity.name));
    expect(visibleAnswers).toEqual(entities.map((entity) => entity.acceptedAnswer.text));
    expect(entities.map((entity) => entity.name)).toEqual(faq.map((item) => item.question));
    expect(entities.map((entity) => entity.acceptedAnswer.text)).toEqual(faq.map((item) => item.answer));
  });

  it('dist 活動案例含 facts 值', () => {
    const $ = loadPage();
    const text = normalizeText($('main').text()) + JSON.stringify(onlyJsonLd($, 'FAQPage'));
    const { eventPlatform } = facts;

    expect(text).toContain(`${formatNumber(eventPlatform.backendTests)} 項`);
    expect(text).toContain(`${formatNumber(eventPlatform.frontendTests)} 項`);
    expect(text).toContain(`${formatNumber(eventPlatform.loadTestRequests)} 個請求`);
    expect(text).toContain(`修正 ${formatNumber(eventPlatform.e2eIssuesFixed)} 個`);
  });

  it('dist 活動案例問句標題', () => {
    const $ = loadPage();
    const headings = $('main h2')
      .toArray()
      .map((element) => normalizeText($(element).text()));

    expect(headings.filter((heading) => heading.endsWith('？')).length).toBeGreaterThanOrEqual(4);
    expect(headings).toContain('結果是什麼？');
    expect(normalizeText($('main h1').text())).toBe('活動報名與驗票平台');
  });

  it('dist 活動案例沒有點陣圖', () => {
    const $ = loadPage();
    const svgs = $('main svg').toArray();

    expect($('main img')).toHaveLength(0);
    expect($('main picture, main [srcset]')).toHaveLength(0);
    expect(svgs.length).toBeGreaterThanOrEqual(2);
    for (const svg of svgs) {
      expect($(svg).attr('role')).toBe('img');
      expect(normalizeText($(svg).children('title').text())).not.toBe('');
      // 圖下方要有文字說明。
      expect(normalizeText($(svg).closest('figure').find('figcaption').text())).not.toBe('');
    }
  });

  it('dist 活動案例的 id 不重複，圖的名稱與說明都指得到', () => {
    const $ = loadPage();
    const ids = $('[id]').toArray().map((element) => $(element).attr('id'));

    expect(new Set(ids).size, '頁面上有重複的 id').toBe(ids.length);
    for (const svg of $('main svg').toArray()) {
      const labelledBy = ($(svg).attr('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
      const describedBy = ($(svg).attr('aria-describedby') ?? '').split(/\s+/).filter(Boolean);

      // 名稱只指向 <title>，長說明放在 aria-describedby。
      expect(labelledBy).toHaveLength(1);
      expect($(`#${labelledBy[0]}`).is('title')).toBe(true);
      expect(describedBy).toHaveLength(1);
      expect($(`#${describedBy[0]}`).is('desc')).toBe(true);
    }
  });

  it('dist 活動案例的圖不含事實數字', () => {
    // 圖的資料夾不在 check:facts 的範圍內，改在這裡確認圖裡的文字沒有寫死事實數字。
    const svgText = loadPage()('main svg').text();

    for (const value of Object.values(facts.eventPlatform)) {
      expect(svgText).not.toContain(formatNumber(value));
    }
  });

  it('dist 活動案例麵包屑', () => {
    const $ = loadPage();
    const items = onlyJsonLd($, 'BreadcrumbList').itemListElement as { item: string; name: string }[];

    expect(items.map((item) => item.item)).toEqual([
      `${site.url}/`,
      `${site.url}/work/`,
      `${site.url}/work/${SLUG}/`,
    ]);
    expect(items[1]?.item).toBe('https://lin-yu-chun.com/work/');

    // 頁面上看得到的麵包屑和 JSON-LD 一致。
    const visible = $('main nav[aria-label="麵包屑"] li')
      .toArray()
      .map((element) => normalizeText($(element).text()));
    expect(visible).toEqual(items.map((item) => item.name));
    expect($('main nav[aria-label="麵包屑"] [aria-current="page"]')).toHaveLength(1);
  });

  it('dist 活動案例不含機制細節用語', () => {
    const text = normalizeText(loadPage()('main').text());

    expect(text).not.toMatch(/azurewebsites|token|oauth/i);
    // 壓測延伸數字等 spec 待補件 W3 有結論後才寫。
    expect(text).not.toMatch(/%|％|平行連線/);
  });

  it('dist 活動案例摘要表與 AI 協作說明', () => {
    const $ = loadPage();
    const content = getCase('zh-TW', SLUG, facts);
    const summaryText = normalizeText($('main [data-section="case-summary"]').text());

    expect(content).toBeDefined();
    for (const value of [content?.period, content?.role, content?.maturity, ...(content?.tech ?? [])]) {
      expect(summaryText).toContain(value);
    }
    expect(normalizeText($('main [data-section="ai-note"]').text())).toContain(content?.aiNote);
  });

  it('dist 活動案例的 title 與 canonical', () => {
    const $ = loadPage();

    expect($('title').text()).toContain('活動報名與驗票平台');
    expect($('link[rel="canonical"]').attr('href')).toBe(`${site.url}/work/${SLUG}/`);
    expect($('body > header nav a[aria-current="page"]').attr('href')).toBe('/work/');
  });
});
