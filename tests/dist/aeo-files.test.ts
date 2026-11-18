import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { getCases } from '../../src/data/cases';
import { facts } from '../../src/data/facts';
import { buildServices } from '../../src/data/services';
import { site } from '../../src/data/site';
import { buildLlmsTxt } from '../../src/lib/llms';
import { buildRobotsTxt } from '../../src/lib/robots';
import { existsInDist, listHtmlFiles, readDist } from './helpers';

/** 取出 sitemap XML 裡全部的 `<loc>`。 */
function locsOf(xml: string): string[] {
  const $ = cheerio.load(xml, { xml: true });
  return $('loc')
    .toArray()
    .map((element) => $(element).text().trim());
}

/** 正式網址去掉網域後的站內路徑；不是本站網址時回傳 `null`。 */
function sitePathOf(url: string): string | null {
  return url.startsWith(`${site.url}/`) ? url.slice(site.url.length) : null;
}

/** dist 內「有 canonical、沒有 noindex」的 HTML 頁的 canonical 網址。 */
function indexableCanonicals(): string[] {
  return listHtmlFiles().flatMap((file) => {
    const $ = cheerio.load(readDist(file));
    const canonical = $('link[rel="canonical"]').attr('href');
    const robots = $('meta[name="robots"]').attr('content') ?? '';
    return canonical !== undefined && !robots.includes('noindex') ? [canonical] : [];
  });
}

describe('dist robots、sitemap 與 llms.txt', () => {
  it('dist robots 與 sitemap', () => {
    const locs = locsOf(readDist('sitemap-0.xml'));

    expect(readDist('robots.txt')).toBe(buildRobotsTxt(site));
    expect(locsOf(readDist('sitemap-index.xml'))).toEqual([`${site.url}/sitemap-0.xml`]);
    expect([...locs].sort()).toEqual([...indexableCanonicals()].sort());
    expect(locs.length).toBeGreaterThanOrEqual(8);
    expect(locs.filter((loc) => /\/404\/?$/.test(loc))).toEqual([]);
    expect(locs).toContain(`${site.url}/privacy/`);
  });

  it('dist sitemap 每個網址都有頁面', () => {
    const locs = [...locsOf(readDist('sitemap-index.xml')), ...locsOf(readDist('sitemap-0.xml'))];

    for (const loc of locs) {
      const path = sitePathOf(loc);
      expect(path, `${loc} 不是本站網址`).not.toBeNull();
      expect(existsInDist(path ?? ''), `${loc} 在 dist 裡沒有檔案`).toBe(true);
    }
  });

  it('dist llms.txt 同源', () => {
    const text = readDist('llms.txt');
    const locs = new Set(locsOf(readDist('sitemap-0.xml')));
    const links = [...text.matchAll(/\]\(([^)\s]*)\)/g)].map((match) => match[1] ?? '');

    expect(text).toBe(
      buildLlmsTxt({ site, cases: getCases('zh-TW', facts), services: buildServices(site).services }),
    );
    expect(links.length).toBeGreaterThanOrEqual(8);
    for (const link of links) {
      const path = sitePathOf(link);
      expect(path, `${link} 不是本站網址`).not.toBeNull();
      expect(existsInDist(path ?? ''), `${link} 在 dist 裡沒有檔案`).toBe(true);
      expect(locs.has(link), `${link} 不在 sitemap 裡`).toBe(true);
    }
  });
});
