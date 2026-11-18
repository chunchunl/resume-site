import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { buildPrivacy } from '../../src/data/privacy';
import { site } from '../../src/data/site';
import { normalizeText, readDist } from './helpers';

const content = buildPrivacy(site);

describe('dist 隱私頁', () => {
  it('dist 隱私頁', () => {
    const $ = cheerio.load(readDist('privacy/index.html'));
    const mainText = normalizeText($('main').text());

    expect(normalizeText($('head > title').text())).toBe('隱私說明｜林昱均 Erica Lin');
    expect($('link[rel="canonical"]').attr('href')).toBe(`${site.url}/privacy/`);
    expect($('meta[name="robots"]')).toHaveLength(0);
    expect($('main h1')).toHaveLength(1);
    expect(mainText).toContain(content.heading);
    expect(mainText).toContain(content.intro);
    for (const section of content.sections) {
      expect(mainText).toContain(section.heading);
      for (const paragraph of section.paragraphs) expect(mainText).toContain(paragraph);
    }
    for (const email of content.emails) {
      expect($(`main a[href="mailto:${email.address}"]`), email.address).toHaveLength(1);
      expect(mainText).toContain(email.label);
    }
  });
});
