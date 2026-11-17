import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { listHtmlFiles, normalizeText, readDist } from './helpers';

describe('dist 全站 title', () => {
  it('dist 全站 title 不重複', () => {
    const files = listHtmlFiles().filter((file) => file !== '404.html');
    const titles = files.map((file) => normalizeText(cheerio.load(readDist(file))('head > title').text()));

    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const [index, title] of titles.entries()) expect(title, files[index]).not.toBe('');
    expect(new Set(titles).size, titles.join('\n')).toBe(titles.length);
  });
});
