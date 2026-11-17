/**
 * 案例頁 build 產物測試共用的讀取與檢查。
 */
import * as cheerio from 'cheerio';
import { expect } from 'vitest';
import { getCase } from '../../src/data/cases';
import { facts } from '../../src/data/facts';
import { site } from '../../src/data/site';
import { normalizeText, readDist } from './helpers';

/** FAQPage JSON-LD 裡的一組問答。 */
export type FaqEntity = { name: string; acceptedAnswer: { text: string } };

/** 讀取並解析一個案例頁。 */
export function loadCasePage(slug: string): cheerio.CheerioAPI {
  return cheerio.load(readDist(`work/${slug}/index.html`));
}

/** 取出頁面上全部 JSON-LD 區塊並解析。 */
export function parseJsonLd($: cheerio.CheerioAPI): Record<string, unknown>[] {
  return $('script[type="application/ld+json"]')
    .toArray()
    .map((element) => JSON.parse($(element).text()) as Record<string, unknown>);
}

/** 取出指定類型的 JSON-LD（恰好一個，不是就讓測試失敗）。 */
export function onlyJsonLd($: cheerio.CheerioAPI, type: string): Record<string, unknown> {
  const matches = parseJsonLd($).filter((block) => block['@type'] === type);
  expect(matches, `${type} 的數量`).toHaveLength(1);
  return matches[0] ?? {};
}

/** `<main>` 的可見文字加上 FAQPage JSON-LD，用來找事實值與禁用字。 */
export function mainTextWithFaq($: cheerio.CheerioAPI): string {
  return `${normalizeText($('main').text())}\n${JSON.stringify(onlyJsonLd($, 'FAQPage'))}`;
}

/**
 * 檢查案例頁的共通結構：問句 h2、FAQ 三方逐項相同、inline SVG 的標題與說明、
 * 沒有點陣圖、id 不重複、麵包屑。
 */
export function expectCaseStructure($: cheerio.CheerioAPI, slug: string, minQuestionHeadings: number): void {
  const content = getCase('zh-TW', slug, facts);
  expect(content, `找不到案例 ${slug}`).toBeDefined();

  // 問句式 h2。
  const headings = $('main h2')
    .toArray()
    .map((element) => normalizeText($(element).text()));
  expect(headings.filter((heading) => heading.endsWith('？')).length).toBeGreaterThanOrEqual(minQuestionHeadings);
  // 內容函式的每個段落標題都要出現在頁面上，模板固定的兩個問句標題不能替代它們。
  expect(headings).toEqual(expect.arrayContaining(content?.sections.map((section) => section.heading) ?? []));
  expect(normalizeText($('main h1').text())).toBe(content?.title);

  // FAQ：頁面上的問答、JSON-LD 與內容函式三邊逐項相同，不收空白。
  const entities = onlyJsonLd($, 'FAQPage').mainEntity as FaqEntity[];
  const visibleQuestions = $('main .faq__question').toArray().map((element) => $(element).text().trim());
  const visibleAnswers = $('main .faq__answer').toArray().map((element) => $(element).text().trim());
  expect(entities.length).toBeGreaterThanOrEqual(3);
  expect(visibleQuestions).toEqual(entities.map((entity) => entity.name));
  expect(visibleAnswers).toEqual(entities.map((entity) => entity.acceptedAnswer.text));
  expect(entities.map((entity) => entity.name)).toEqual(content?.faq.map((item) => item.question));
  expect(entities.map((entity) => entity.acceptedAnswer.text)).toEqual(content?.faq.map((item) => item.answer));

  // 圖：至少一張 inline SVG，有標題、圖說；名稱只指向 <title>，長說明指向 <desc>。
  const svgs = $('main svg').toArray();
  expect($('main img')).toHaveLength(0);
  expect($('main picture, main [srcset]')).toHaveLength(0);
  expect(svgs.length).toBeGreaterThanOrEqual(1);
  for (const svg of svgs) {
    expect($(svg).attr('role')).toBe('img');
    expect(normalizeText($(svg).children('title').text())).not.toBe('');
    expect(normalizeText($(svg).closest('figure').find('figcaption').text())).not.toBe('');
    const labelledBy = ($(svg).attr('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
    const describedBy = ($(svg).attr('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    expect(labelledBy).toHaveLength(1);
    expect($(`#${labelledBy[0]}`).is('title')).toBe(true);
    expect(describedBy).toHaveLength(1);
    expect($(`#${describedBy[0]}`).is('desc')).toBe(true);
  }

  // 全頁 id 不重複。
  const ids = $('[id]').toArray().map((element) => $(element).attr('id'));
  expect(new Set(ids).size, '頁面上有重複的 id').toBe(ids.length);

  // 麵包屑：首頁 → 案例 → 本頁，看得到的與 JSON-LD 一致。
  const items = onlyJsonLd($, 'BreadcrumbList').itemListElement as { item: string; name: string }[];
  expect(items.map((item) => item.item)).toEqual([`${site.url}/`, `${site.url}/work/`, `${site.url}/work/${slug}/`]);
  const visibleCrumbs = $('main nav[aria-label="麵包屑"] li')
    .toArray()
    .map((element) => normalizeText($(element).text()));
  expect(visibleCrumbs).toEqual(items.map((item) => item.name));

  // canonical。
  expect($('link[rel="canonical"]').attr('href')).toBe(`${site.url}/work/${slug}/`);
}
