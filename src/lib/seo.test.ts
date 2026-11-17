import { describe, expect, it } from 'vitest';
import { site, type Site } from '../data/site';
import { buildPageMeta, buildPersonJsonLd, buildWebSiteJsonLd, serializeJsonLd } from './seo';

/** 兩個公開連結都有值的假身分資料；LinkedIn 用虛構網址。 */
const fullSite: Site = {
  ...site,
  links: { github: 'https://github.com/example-user', linkedin: 'https://www.linkedin.com/in/example-user/' },
};

const SENSITIVE_KEYS = ['telephone', 'birthDate', 'streetAddress', 'email'];

/** 取出物件（含巢狀與陣列）裡全部的鍵。 */
function collectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectKeys);
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => [key, ...collectKeys(child)]);
  }
  return [];
}

describe('buildPersonJsonLd', () => {
  it('buildPersonJsonLd 輸出必要欄位', () => {
    const person = buildPersonJsonLd(fullSite);

    expect(person['@context']).toBe('https://schema.org');
    expect(person['@type']).toBe('Person');
    expect(person.name).toBe('林昱均');
    expect(person.alternateName).toBe('Erica Lin');
    expect(person.jobTitle).toBe('產品導向前端工程師');
    expect(person.url).toBe('https://lin-yu-chun.com/');
    expect(person.sameAs).toHaveLength(2);
    expect(person.sameAs).toEqual([fullSite.links.linkedin, fullSite.links.github]);
  });

  it('buildPersonJsonLd 不輸出敏感欄位', () => {
    const keys = collectKeys(buildPersonJsonLd(fullSite));

    for (const key of SENSITIVE_KEYS) {
      expect(keys, `不該輸出 ${key}`).not.toContain(key);
    }
  });

  it('buildPersonJsonLd 所在地只到縣市與國家', () => {
    const person = buildPersonJsonLd(fullSite);

    expect(person.address).toEqual({
      '@type': 'PostalAddress',
      addressLocality: '新北市',
      addressCountry: 'TW',
    });
  });

  it('buildPersonJsonLd 連結為 null 時不輸出該網址', () => {
    const person = buildPersonJsonLd({ ...fullSite, links: { github: fullSite.links.github, linkedin: null } });

    expect(person.sameAs).toEqual([fullSite.links.github]);
    expect(JSON.stringify(person)).not.toContain('null');
  });

  it('buildPersonJsonLd 兩個連結都沒有時不輸出 sameAs', () => {
    const person = buildPersonJsonLd({ ...fullSite, links: { github: null, linkedin: null } });

    expect('sameAs' in person).toBe(false);
  });
});

describe('buildWebSiteJsonLd', () => {
  it('buildWebSiteJsonLd 輸出網站名稱、網址並指向同一個人', () => {
    const website = buildWebSiteJsonLd(fullSite);
    const person = buildPersonJsonLd(fullSite);

    expect(website['@context']).toBe('https://schema.org');
    expect(website['@type']).toBe('WebSite');
    expect(website.name).toBe('林昱均 Erica Lin');
    expect(website.url).toBe('https://lin-yu-chun.com/');
    expect(website.inLanguage).toBe('zh-Hant-TW');
    expect(website.author).toEqual({ '@id': person['@id'] });
    expect(website['@id']).not.toBe(person['@id']);
  });

  it('buildWebSiteJsonLd 不輸出敏感欄位', () => {
    const keys = collectKeys(buildWebSiteJsonLd(fullSite));

    for (const key of SENSITIVE_KEYS) {
      expect(keys, `不該輸出 ${key}`).not.toContain(key);
    }
  });
});

describe('buildPageMeta', () => {
  it('buildPageMeta 產生 canonical 與 Open Graph 欄位', () => {
    const meta = buildPageMeta(fullSite, { title: '頁面標題', description: '頁面描述', path: '/work/' });

    expect(meta).toEqual({
      title: '頁面標題',
      description: '頁面描述',
      canonical: 'https://lin-yu-chun.com/work/',
      robots: null,
      ogSiteName: '林昱均 Erica Lin',
      ogLocale: 'zh_TW',
    });
  });

  it('buildPageMeta 首頁的 canonical 以斜線結尾', () => {
    const meta = buildPageMeta(fullSite, { title: 't', description: 'd', path: '/' });

    expect(meta.canonical).toBe('https://lin-yu-chun.com/');
  });

  it('buildPageMeta 不收錄的頁面沒有 canonical', () => {
    const meta = buildPageMeta(fullSite, { title: 't', description: 'd', path: '/404/', noindex: true });

    expect(meta.canonical).toBeNull();
    expect(meta.robots).toBe('noindex');
  });

  it('buildPageMeta 英文頁的 Open Graph 語系', () => {
    const meta = buildPageMeta(fullSite, { title: 't', description: 'd', path: '/en/', lang: 'en' });

    expect(meta.ogLocale).toBe('en_US');
  });
});

describe('serializeJsonLd', () => {
  it('serializeJsonLd 輸出可還原的 JSON', () => {
    const data = { '@type': 'Person', name: '林昱均' };

    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });

  it('serializeJsonLd 跳脫小於符號，內容不會提早結束 script 區塊', () => {
    const data = { name: '</script><script>alert(1)</script>' };
    const output = serializeJsonLd(data);

    expect(output).not.toContain('<');
    expect(JSON.parse(output)).toEqual(data);
  });
});
