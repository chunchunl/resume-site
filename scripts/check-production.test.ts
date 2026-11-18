import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { RESUME_PDF_HREF } from '../src/data/resume';
import { site } from '../src/data/site';
import { buildRobotsTxt } from '../src/lib/robots';
import {
  checkHeaders,
  checkRedirect,
  extractInternalLinks,
  findObfuscatedEmails,
  findStylesheetUrl,
  parseSitemapIndex,
  parseSitemapUrls,
  runChecks,
  type NamedResult,
} from './check-production';
import { parseHeadersFile } from './lib/headers-file';

/** 測試用的 _headers：一段全站規則與一段單一路徑規則，跟正式檔案的寫法相同。 */
const HEADERS_FILE = [
  '/*',
  '  Strict-Transport-Security: max-age=31536000',
  "  Content-Security-Policy: default-src 'self'",
  '  X-Content-Type-Options: nosniff',
  '',
  '/llms.txt',
  '  Content-Type: text/plain; charset=utf-8',
  '',
].join('\n');

/** `_headers` 全站規則的期望標頭。 */
const expected = parseHeadersFile(HEADERS_FILE).get('/*') ?? new Map<string, string>();

/** 標頭齊全的假回應標頭。 */
function completeHeaders(): Headers {
  return new Headers({
    'strict-transport-security': 'max-age=31536000',
    'content-security-policy': "default-src 'self'",
    'x-content-type-options': 'nosniff',
    'content-type': 'text/html',
  });
}

// 這些函式只接收字串或假回應；任何網路請求都代表測試寫錯了。
beforeEach(() => {
  vi.stubGlobal('fetch', () => {
    throw new Error('check-production 的單元測試不准連網');
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('check-production', () => {
  it('checkHeaders 標頭齊全會通過', () => {
    expect(checkHeaders(expected, completeHeaders())).toEqual({ ok: true, problems: [] });
  });

  it('checkHeaders 缺標頭會失敗', () => {
    const headers = completeHeaders();
    headers.delete('content-security-policy');

    const result = checkHeaders(expected, headers);
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toContain('content-security-policy');
  });

  it('checkHeaders 值不同也會失敗', () => {
    const headers = completeHeaders();
    headers.set('x-content-type-options', 'sniff');

    const result = checkHeaders(expected, headers);
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toContain('x-content-type-options');
  });

  it('checkHeaders 正式網域帶 noindex 會失敗', () => {
    const headers = completeHeaders();
    headers.set('x-robots-tag', 'noindex');

    const result = checkHeaders(expected, headers);
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toContain('x-robots-tag');
  });

  it('checkRedirect 判斷轉址', () => {
    const target = 'https://lin-yu-chun.com/';

    expect(checkRedirect({ status: 301, headers: new Headers({ location: target }) }, target).ok).toBe(true);
    expect(checkRedirect({ status: 308, headers: new Headers({ location: target }) }, target).ok).toBe(true);
    expect(checkRedirect({ status: 200, headers: new Headers() }, target).ok).toBe(false);
    // 302 是暫時轉址，搜尋引擎不會把權重轉過去。
    expect(checkRedirect({ status: 302, headers: new Headers({ location: target }) }, target).ok).toBe(false);
    // 轉到別的地方也不行。
    expect(checkRedirect({ status: 301, headers: new Headers({ location: 'https://example.test/' }) }, target).ok).toBe(false);
    // 沒有結尾斜線的主網域是同一個網址，不算轉錯。
    expect(checkRedirect({ status: 301, headers: new Headers({ location: 'https://lin-yu-chun.com' }) }, target).ok).toBe(true);
  });

  it('parseSitemapIndex 取出子 sitemap', () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      '<sitemap><loc>https://lin-yu-chun.com/sitemap-0.xml</loc></sitemap></sitemapindex>';

    expect(parseSitemapIndex(xml)).toEqual(['https://lin-yu-chun.com/sitemap-0.xml']);
  });

  it('parseSitemapUrls 取出網址', () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      '<url><loc>https://lin-yu-chun.com/</loc></url><url><loc>https://lin-yu-chun.com/work/</loc></url></urlset>';

    expect(parseSitemapUrls(xml)).toEqual(['https://lin-yu-chun.com/', 'https://lin-yu-chun.com/work/']);
  });

  it('extractInternalLinks 只取站內連結', () => {
    const text = [
      '# 林昱均',
      '',
      '- [首頁](https://lin-yu-chun.com/): 我是誰。',
      '- [案例列表](https://lin-yu-chun.com/work/): 三個案例。',
      '- LinkedIn：https://www.linkedin.com/in/example/',
      '- [GitHub](https://github.com/example): 外部網站。',
    ].join('\n');

    expect(extractInternalLinks(text, 'https://lin-yu-chun.com')).toEqual(['https://lin-yu-chun.com/', 'https://lin-yu-chun.com/work/']);
  });

  it('findObfuscatedEmails 抓到改寫的信箱', () => {
    const obfuscated =
      '<a href="/cdn-cgi/l/email-protection#0a7d6578614a"><span class="__cf_email__" data-cfemail="0a7d65">[email&#160;protected]</span></a>';
    const plain = '<a href="mailto:work@lin-yu-chun.com">work@lin-yu-chun.com</a>';

    expect(findObfuscatedEmails(obfuscated)).toHaveLength(1);
    expect(findObfuscatedEmails(plain)).toHaveLength(0);
  });

  it('findStylesheetUrl 取出首頁的樣式檔', () => {
    const html = '<html><head><link rel="canonical" href="https://lin-yu-chun.com/"><link rel="stylesheet" href="/_astro/index.abc123.css"></head></html>';

    expect(findStylesheetUrl(html, 'https://lin-yu-chun.com/')).toBe('https://lin-yu-chun.com/_astro/index.abc123.css');
    expect(findStylesheetUrl('<html></html>', 'https://lin-yu-chun.com/')).toBeNull();
  });
});

/** 正式網址。 */
const BASE = 'https://lin-yu-chun.com';

/** 專案實際的 _headers；假站台照它送標頭，runChecks 也照它比對。 */
const REAL_HEADERS_FILE = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');

/** 假站台的一個回應。 */
interface FakePage {
  /** HTTP 狀態碼，預設 200。 */
  status?: number;
  /** 除了全站標頭以外的標頭。 */
  headers?: Record<string, string>;
  /** 內文。 */
  body?: string;
}

/**
 * 建立一個「全部設定正確」的假站台：網址 → 回應。測試再針對單一項目改壞。
 * 內容是最小的合法版本，不讀 dist（單元測試在 build 之前跑）。
 */
function healthySite(): Map<string, FakePage> {
  const llmsHeaders = Object.fromEntries(parseHeadersFile(REAL_HEADERS_FILE).get('/llms.txt') ?? []);
  return new Map<string, FakePage>([
    [`${BASE}/sitemap-index.xml`, { body: `<sitemapindex><sitemap><loc>${BASE}/sitemap-0.xml</loc></sitemap></sitemapindex>` }],
    [`${BASE}/sitemap-0.xml`, { body: `<urlset><url><loc>${BASE}/</loc></url><url><loc>${BASE}/work/</loc></url></urlset>` }],
    [`${BASE}/work/`, { body: '<html></html>' }],
    [`${BASE}/llms.txt`, { headers: llmsHeaders, body: `- [首頁](${BASE}/): 首頁。\n- [案例列表](${BASE}/work/): 案例。\n` }],
    [`${BASE}/robots.txt`, { body: buildRobotsTxt(site) }],
    [`${BASE}${RESUME_PDF_HREF}`, { headers: { 'content-type': 'application/pdf' }, body: '%PDF-1.7' }],
    [
      `${BASE}/`,
      {
        body:
          '<html><head><link rel="stylesheet" href="/_astro/index.css"></head><body>' +
          Object.values(site.contactEmails)
            .map((email) => `<a href="mailto:${email}">${email}</a>`)
            .join('') +
          '</body></html>',
      },
    ],
    [`${BASE}/_astro/index.css`, { body: 'body{}' }],
    ['http://lin-yu-chun.com/', { status: 301, headers: { location: `${BASE}/` } }],
    ['https://www.lin-yu-chun.com/', { status: 301, headers: { location: `${BASE}/` } }],
  ]);
}

/**
 * 把假站台換成 fetch：表上沒有的網址回 404；值為 `'unreachable'` 的網址模擬連不上。
 * 每個回應都帶 `_headers` 全站規則的標頭，跟正式環境相同。
 */
function stubSite(pages: Map<string, FakePage | 'unreachable'>): Mock<(input: string) => Promise<Response>> {
  const globalHeaders = Object.fromEntries(parseHeadersFile(REAL_HEADERS_FILE).get('/*') ?? []);
  const fakeFetch = vi.fn((input: string) => {
    const page = pages.get(input);
    if (page === 'unreachable') return Promise.reject(new TypeError('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND') }));
    const { status = 200, headers = {}, body = '' } = page ?? { status: 404, body: '找不到這個頁面' };
    return Promise.resolve(new Response(body, { status, headers: { ...globalHeaders, ...headers } }));
  });
  vi.stubGlobal('fetch', fakeFetch);
  return fakeFetch;
}

/** 取出失敗的項目名稱。 */
function failedNames(results: NamedResult[]): string[] {
  return results.filter(({ result }) => !result.ok).map(({ name }) => name);
}

describe('runChecks（假站台，不連網）', () => {
  it('runChecks 設定正確的站台全部通過', async () => {
    stubSite(healthySite());

    const results = await runChecks(BASE, REAL_HEADERS_FILE);
    expect(failedNames(results)).toEqual([]);
    expect(results.length).toBeGreaterThanOrEqual(14);
  });

  it('runChecks 樣式檔 404 會失敗', async () => {
    const pages = healthySite();
    pages.delete(`${BASE}/_astro/index.css`);
    stubSite(pages);

    expect(failedNames(await runChecks(BASE, REAL_HEADERS_FILE))).toEqual(['樣式檔回 200 且帶齊安全標頭']);
  });

  it('runChecks 一個請求連不上不會中斷其他項目', async () => {
    const pages: Map<string, FakePage | 'unreachable'> = healthySite();
    pages.set('https://www.lin-yu-chun.com/', 'unreachable');
    stubSite(pages);

    const results = await runChecks(BASE, REAL_HEADERS_FILE);
    expect(failedNames(results)).toEqual(['www 首頁轉到主網域']);
    expect(results.find(({ name }) => name === 'www 首頁轉到主網域')?.result.problems.join('')).toContain('ENOTFOUND');
  });

  it('runChecks robots.txt 被插入規則會失敗', async () => {
    const pages = healthySite();
    pages.set(`${BASE}/robots.txt`, { body: `User-agent: GPTBot\nDisallow: /\n\n${buildRobotsTxt(site)}` });
    stubSite(pages);

    expect(failedNames(await runChecks(BASE, REAL_HEADERS_FILE))).toEqual(['robots.txt 回 200 且內容等於 repo 產生的版本']);
  });

  it('runChecks 不存在的網址沒有回 404 會失敗', async () => {
    const pages = healthySite();
    pages.set(`${BASE}/check-production-not-found/`, { body: '<html>首頁</html>' });
    stubSite(pages);

    expect(failedNames(await runChecks(BASE, REAL_HEADERS_FILE))).toEqual(['不存在的網址回 404']);
  });

  it('runChecks 信箱被改寫會失敗', async () => {
    const pages = healthySite();
    pages.set(`${BASE}/`, {
      body: '<html><head><link rel="stylesheet" href="/_astro/index.css"></head><body><a href="/cdn-cgi/l/email-protection#0a7d">[email protected]</a></body></html>',
    });
    stubSite(pages);

    expect(failedNames(await runChecks(BASE, REAL_HEADERS_FILE))).toEqual(['首頁的公開信箱是一般 mailto:']);
  });

  it('runChecks sitemap 列了外站網址不會去請求', async () => {
    const pages = healthySite();
    pages.set(`${BASE}/sitemap-0.xml`, { body: `<urlset><url><loc>${BASE}/</loc></url><url><loc>https://example.test/</loc></url></urlset>` });
    const fakeFetch = stubSite(pages);

    const results = await runChecks(BASE, REAL_HEADERS_FILE);
    expect(failedNames(results)).toEqual(['sitemap 的 2 個網址都回 200']);
    expect(fakeFetch.mock.calls.map(([url]) => url)).not.toContain('https://example.test/');
  });
});
