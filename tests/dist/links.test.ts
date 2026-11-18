import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { distFileForPath, existsInDist, isSitePath, listHtmlFiles, readDist } from './helpers';

describe('dist 全站內部連結', () => {
  it('distFileForPath 對應規則', () => {
    expect(distFileForPath('/')).toBe('index.html');
    expect(distFileForPath('/work/')).toBe('work/index.html');
    expect(distFileForPath('/work/#faq')).toBe('work/index.html');
    expect(distFileForPath('/services/?ref=x')).toBe('services/index.html');
    expect(distFileForPath('/resume/erica-lin-resume-zh.pdf')).toBe('resume/erica-lin-resume-zh.pdf');
    expect(distFileForPath('/_astro/a.css')).toBe('_astro/a.css');
    expect(isSitePath('//example.test/x')).toBe(false);
    expect(isSitePath('#main')).toBe(false);
    // 只有資料夾、沒有 index.html 的路徑在正式站會 404，不能算對得到。
    expect(existsInDist('/_astro')).toBe(false);
    expect(existsInDist('/work')).toBe(false);
    expect(existsInDist('/work/')).toBe(true);
  });

  it('dist 全站內部連結不斷', () => {
    const broken: string[] = [];
    let checked = 0;

    for (const file of listHtmlFiles()) {
      const $ = cheerio.load(readDist(file));
      const urls = [
        ...$('[href]')
          .toArray()
          .map((element) => $(element).attr('href') ?? ''),
        ...$('[src]')
          .toArray()
          .map((element) => $(element).attr('src') ?? ''),
      ].filter(isSitePath);

      for (const url of urls) {
        checked += 1;
        if (!existsInDist(url)) broken.push(`${file}：${url}`);
      }
    }

    expect(checked).toBeGreaterThan(0);
    expect(broken).toEqual([]);
  });
});
