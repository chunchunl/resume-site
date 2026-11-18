import * as cheerio from 'cheerio';
import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { site } from '../../src/data/site';
import { distDir, existsInDist, listHtmlFiles, readDist } from './helpers';

/** 預覽圖的期望值；刻意在測試裡自己寫一份，實作的常數寫錯時才擋得到。 */
const EXPECTED_PATH = '/og/erica-lin-og.png';
const EXPECTED_WIDTH = 1200;
const EXPECTED_HEIGHT = 630;
const MAX_BYTES = 300 * 1024;

/** PNG 檔案開頭固定的 8 個位元組。 */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** 會帶文字或拍攝資訊的 PNG 區塊；預覽圖不該有。 */
const METADATA_CHUNKS = ['tEXt', 'iTXt', 'zTXt', 'eXIf'];

/**
 * 依序列出 PNG 的區塊名稱（簽章之後：長度 4 + 名稱 4 + 資料 + CRC 4）。
 * 區塊長度超出檔尾、或最後沒有剛好停在檔尾時丟例外，避免壞掉的長度欄位跳過後面的區塊。
 */
function pngChunkTypes(bytes: Buffer): string[] {
  const types: string[] = [];
  let offset = PNG_SIGNATURE.length;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error(`區塊標頭在 ${offset} 超出檔尾`);
    const length = bytes.readUInt32BE(offset);
    if (offset + 12 + length > bytes.length) throw new Error(`區塊在 ${offset} 的長度 ${length} 超出檔尾`);
    types.push(bytes.toString('latin1', offset + 4, offset + 8));
    offset += 12 + length;
  }
  return types;
}

/** 取出某個 meta 的 content；`by` 是屬性名稱（`property` 或 `name`）。 */
function metaValues($: cheerio.CheerioAPI, by: 'property' | 'name', key: string): string[] {
  return $(`head meta[${by}="${key}"]`)
    .map((_, element) => $(element).attr('content') ?? '')
    .get();
}

describe('dist 分享預覽圖', () => {
  it('dist 每頁有預覽圖 meta', () => {
    const files = listHtmlFiles();
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const $ = cheerio.load(readDist(file));
      const images = metaValues($, 'property', 'og:image');

      expect(images, `${file} 的 og:image`).toEqual([`${site.url}${EXPECTED_PATH}`]);
      // site.url 和實作同源，另外單獨確認是 https 的絕對網址、路徑沒有多餘斜線。
      expect(images[0], file).toMatch(/^https:\/\/[^/]+\/og\/erica-lin-og\.png$/);
      expect(metaValues($, 'property', 'og:image:width'), file).toEqual([String(EXPECTED_WIDTH)]);
      expect(metaValues($, 'property', 'og:image:height'), file).toEqual([String(EXPECTED_HEIGHT)]);
      const alts = metaValues($, 'property', 'og:image:alt');
      expect(alts, file).toHaveLength(1);
      expect(alts[0]?.trim(), file).not.toBe('');
      expect(metaValues($, 'name', 'twitter:card'), file).toEqual(['summary_large_image']);
      expect(existsInDist(new URL(images[0] ?? '').pathname), `${file} 的預覽圖不在 dist`).toBe(true);
    }
  });

  it('dist 預覽圖檔格式', () => {
    const path = `${distDir}${EXPECTED_PATH}`;
    const bytes = readFileSync(path);

    expect([...bytes.subarray(0, PNG_SIGNATURE.length)]).toEqual(PNG_SIGNATURE);
    // 第一個區塊必須是 IHDR，寬高在區塊資料的前 8 個位元組。
    expect(bytes.toString('latin1', 12, 16)).toBe('IHDR');
    expect(bytes.readUInt32BE(16)).toBe(EXPECTED_WIDTH);
    expect(bytes.readUInt32BE(20)).toBe(EXPECTED_HEIGHT);
    expect(statSync(path).size).toBeLessThan(MAX_BYTES);

    const types = pngChunkTypes(bytes);
    expect(types.at(-1)).toBe('IEND');
    for (const type of METADATA_CHUNKS) expect(types, `不該有 ${type}`).not.toContain(type);
  });
});
