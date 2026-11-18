import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { listHtmlFiles, normalizeText, readDist } from './helpers';

/** 讀者稱呼一律用「您」或省略主詞，不用「你」。 */
const INFORMAL_ADDRESS = '你';

/**
 * 口語詞；正式寫法例：專案、費用或起價、尚未、若無反應、可查看、完成。
 * 「超」「呢」容易誤判（例如「超過」），不列。
 */
const COLLOQUIAL_WORDS = ['案子', '多少錢', '還沒', '沒有反應', '啦', '喔', '吧', '看得到', '弄好', '其實'];

/** 確認一段文字沒有口語稱呼與口語詞；`where` 用在失敗訊息。 */
function expectFormal(text: string, where: string): void {
  expect(text, `${where} 沒有讀到文字`).not.toBe('');
  expect(text, `${where} 用了「${INFORMAL_ADDRESS}」`).not.toContain(INFORMAL_ADDRESS);
  for (const word of COLLOQUIAL_WORDS) expect(text, `${where} 用了口語詞「${word}」`).not.toContain(word);
}

describe('dist 全站文案語氣', () => {
  it('dist 全站文案不用口語稱呼', () => {
    const files = listHtmlFiles();

    // 至少要讀到首頁與 404，避免這條測試因為找不到檔案而空過。
    expect(files).toContain('index.html');
    expect(files).toContain('404.html');
    for (const file of files) {
      const $ = cheerio.load(readDist(file));
      const visible = normalizeText(
        ['main', 'body > header', 'body > footer'].map((selector) => $(selector).text()).join(' '),
      );
      // 搜尋結果與分享預覽看得到的標題與描述也要正式。
      const head = normalizeText(
        [
          $('head > title').text(),
          $('head meta[name="description"]').attr('content') ?? '',
          $('head meta[property="og:description"]').attr('content') ?? '',
        ].join(' '),
      );

      expectFormal(visible, `${file} 的頁面文字`);
      expectFormal(head, `${file} 的標題與描述`);
    }
  });

  it('dist llms.txt 不用口語稱呼', () => {
    expectFormal(normalizeText(readDist('llms.txt')), 'llms.txt');
  });
});
