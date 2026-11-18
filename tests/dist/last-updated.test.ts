import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { listHtmlFiles, normalizeText, readDist } from './helpers';

/** 頁尾的最後更新寫法：日期與時間都是兩位數補零，固定標示台灣時間。 */
const UPDATED_TEXT = /^最後更新：\d{4}-\d{2}-\d{2} \d{2}:\d{2}（台灣時間）$/;

/** `datetime` 屬性：ISO 8601，固定 +08:00。 */
const UPDATED_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+08:00$/;

describe('dist 最後更新時間', () => {
  it('dist 每頁頁尾有最後更新', () => {
    const files = listHtmlFiles();
    const values = new Set<string>();

    expect(files).toContain('index.html');
    for (const file of files) {
      const $ = cheerio.load(readDist(file));
      const times = $('body > footer time[datetime]');

      expect(times, `${file} 頁尾的 <time>`).toHaveLength(1);
      expect(normalizeText($('main').text()), `${file} 的 <main> 不該有最後更新`).not.toContain('最後更新');
      const iso = times.attr('datetime') ?? '';
      expect(iso, file).toMatch(UPDATED_ISO);
      expect(normalizeText(times.parent().text()), file).toMatch(UPDATED_TEXT);
      // 顯示的日期時間要和 datetime 屬性一致。
      expect(normalizeText(times.text()), file).toBe(iso.slice(0, 16).replace('T', ' '));
      values.add(iso);
    }

    // 一次 build 只取一次時間，全站相同。
    // 限制：時間只到分鐘，整站 build 不到一秒，就算每頁各取一次也幾乎都會相同；
    // 「只取一次」實際是靠 updated.ts 的模組層級常數保證，這條只擋得住明顯不同的值。
    expect(values.size).toBe(1);
  });
});
