import { describe, expect, it } from 'vitest';
import type { ServiceItem } from '../src/data/services';
import { checkRequiredFields, checkServicePrices, findPlaceholders } from './check-content';

const completeSite = {
  name: '測試姓名',
  links: { github: 'https://example.com/a', linkedin: 'https://example.com/b' },
  contactEmails: { work: 'work@example.com', jobs: 'jobs@example.com' },
  avatar: null,
  analyticsToken: 'fake-token',
};

describe('check-content', () => {
  it('check-content 流量統計 token 未填會失敗', () => {
    const site = { ...completeSite, analyticsToken: null };

    expect(checkRequiredFields(site, { ignore: ['avatar'] }).missing).toEqual(['analyticsToken']);
  });

  it('check-content 欄位未填會失敗', () => {
    const site = { ...completeSite, contactEmails: { work: null, jobs: 'jobs@example.com' } };

    const result = checkRequiredFields(site, { ignore: ['avatar'] });

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(['contactEmails.work']);
  });

  it('check-content 欄位填齊時通過，avatar 不算', () => {
    const result = checkRequiredFields(completeSite, { ignore: ['avatar'] });

    expect(result).toEqual({ ok: true, missing: [] });
  });

  it('check-content 連結未填會失敗', () => {
    const site = { ...completeSite, links: { github: 'https://example.com/a', linkedin: null } };

    expect(checkRequiredFields(site, { ignore: ['avatar'] }).missing).toEqual(['links.linkedin']);
  });

  it('check-content 抓到佔位符', () => {
    const html = ['<p>服務起價 [PRICE]</p>', '<p>回信方式待定</p>', '<p>TODO 補上說明</p>', '<p>正常內容</p>'].join('\n');

    const problems = findPlaceholders(html, 'dist/index.html');

    expect(problems.map((problem) => problem.line)).toEqual([1, 2, 3]);
    expect(problems[0]).toMatchObject({ file: 'dist/index.html', text: '[PRICE]' });
  });

  it('check-content 一般方括號與小寫文字不算佔位符', () => {
    expect(findPlaceholders('<a href="/work/[slug]">items[0]</a>', 'dist/a.html')).toEqual([]);
  });
});

describe('check-content（審查後補強）', () => {
  it('中文與英文常見的未完成標記都算佔位符', () => {
    const html = ['<p>價格待補</p>', '<p>時程待確認</p>', '<p>TBD</p>', '<p>FIXME: 重寫</p>', '<p>[YOUR_NAME]</p>'].join('\n');

    expect(findPlaceholders(html, 'dist/a.html').map((problem) => problem.line)).toEqual([1, 2, 3, 4, 5]);
  });

  it('一般縮寫與含 TODO 字樣的單字不算佔位符', () => {
    const html = '<p>[AI] 知識平台 [X] [A-Z] items[N] [HTTP 200] TODOS MASTODON</p>';

    expect(findPlaceholders(html, 'dist/a.html')).toEqual([]);
  });
});

/** 產生一項假服務。 */
function fakeService(id: string, priceFrom: number | null, priceUnit: string | null = null): ServiceItem {
  return { id, name: '假服務', audience: '測試用', includes: ['一項'], excludes: ['一項'], priceFrom, priceUnit, quoteRequired: false };
}

describe('checkServicePrices', () => {
  it('checkServicePrices 起價未填會失敗', () => {
    const result = checkServicePrices([fakeService('aeo-audit', 8000), fakeService('figma-to-react', null, '每頁')]);

    expect(result).toEqual({ ok: false, missing: ['figma-to-react.priceFrom'] });
  });

  it('checkServicePrices 起價都填了就通過，priceUnit 可以是 null', () => {
    const result = checkServicePrices([fakeService('aeo-audit', 8000), fakeService('custom-system', 100000)]);

    expect(result).toEqual({ ok: true, missing: [] });
  });
});
