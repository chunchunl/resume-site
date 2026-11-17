import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { getCases } from '../../src/data/cases';
import { facts } from '../../src/data/facts';
import { site } from '../../src/data/site';
import { normalizeText, readDist } from './helpers';

const loadPage = (): cheerio.CheerioAPI => cheerio.load(readDist('work/index.html'));

describe('dist 案例列表頁', () => {
  it('dist 案例列表頁', () => {
    const $ = loadPage();
    const cases = getCases('zh-TW', facts);
    const hrefs = $('main a[href^="/work/"]')
      .toArray()
      .map((element) => $(element).attr('href'));

    expect(normalizeText($('main h1').text())).toBe('案例');
    expect(hrefs).toHaveLength(cases.length);
    expect(hrefs).toEqual(cases.map((item) => `/work/${item.slug}/`));
  });

  it('dist 案例列表頁顯示標題與一句話', () => {
    const $ = loadPage();
    const text = normalizeText($('main').text());

    for (const item of getCases('zh-TW', facts)) {
      expect(text).toContain(item.title);
      expect(text).toContain(item.summary);
    }
  });

  it('dist 案例列表頁的 canonical 與導覽', () => {
    const $ = loadPage();

    expect($('link[rel="canonical"]').attr('href')).toBe(`${site.url}/work/`);
    expect($('body > header nav a[aria-current="page"]').attr('href')).toBe('/work/');
  });
});
