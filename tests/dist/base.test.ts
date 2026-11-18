import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { site } from '../../src/data/site';
import { isSitePath as isSameSitePath, listDistFiles, listHtmlFiles, readDist } from './helpers';

const ONE_YEAR_IN_SECONDS = 31_536_000;

/**
 * Cloudflare Web Analytics 的腳本網址（官方手動嵌入的寫法）。
 * 刻意在測試裡自己寫一份、不讀實作的常數：實作的網址寫錯時測試才擋得到。
 */
const ANALYTICS_SCRIPT_URL = 'https://static.cloudflareinsights.com/beacon.min.js';

/** 預覽網址的 _headers 規則（Cloudflare 官方文件的寫法，對應每個 workers.dev 網址）。 */
const PREVIEW_HOST_RULE = 'https://:version.:subdomain.workers.dev/*';

/** 會讓瀏覽器載入檔案的元素（canonical 只是宣告網址，不會被載入，所以不算）。 */
const RESOURCE_SELECTOR = [
  'script[src]',
  'link[href]:not([rel="canonical"])',
  'img[src]',
  '[srcset]',
  'iframe[src]',
  'source[src]',
  'video[src]',
  'audio[src]',
  'embed[src]',
  'object[data]',
  'image[href]',
  'use[href]',
].join(', ');

/**
 * 取出一個元素會載入的全部網址；`srcset` 拆成每個候選圖的網址。
 * @param attr 讀取該元素屬性的函式，例如 `(name) => $(element).attr(name)`。
 */
function resourceUrls(attr: (name: string) => string | undefined): string[] {
  const urls = ['src', 'href', 'data'].map(attr).filter((url): url is string => url !== undefined);
  const srcset = attr('srcset');
  if (srcset) urls.push(...srcset.split(',').map((candidate) => candidate.trim().split(/\s+/)[0] ?? ''));
  // SVG 的 <use href="#id"> 指向同一份文件，不是外部資源。
  return urls.filter((url) => !url.startsWith('#'));
}

/** 把 CSP 字串拆成「指令名稱 → 來源清單」。 */
function parseCsp(value: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const part of value.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) directives.set(name, sources);
  }
  return directives;
}

/**
 * 解析 _headers：沒有縮排的一行是路徑規則，底下縮排的行是那條規則的標頭。
 * 回傳「路徑規則 → （小寫標頭名稱 → 值）」。
 * 同一個路徑規則出現兩次會直接丟錯：不然後面那段會蓋掉前面那段，測試就看不到前面加的標頭。
 */
function parseHeadersFile(content: string): Map<string, Map<string, string>> {
  const blocks = new Map<string, Map<string, string>>();
  let current: Map<string, string> | undefined;

  for (const line of content.split('\n')) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      const rule = line.trim();
      if (blocks.has(rule)) throw new Error(`_headers 的路徑規則重複：${rule}`);
      current = new Map();
      blocks.set(rule, current);
      continue;
    }
    const separator = line.indexOf(':');
    current?.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim());
  }
  return blocks;
}

describe('dist 基本檢查', () => {
  it('dist 首頁基本結構', () => {
    const $ = cheerio.load(readDist('index.html'));
    const home = `${site.url}/`;

    expect(home).toBe('https://lin-yu-chun.com/');
    expect($('html').attr('lang')).toBe('zh-Hant-TW');
    expect($('link[rel="canonical"]').attr('href')).toBe(home);
    expect($('main h1')).toHaveLength(1);
    expect($('h1')).toHaveLength(1);
    expect($('title').text().trim()).not.toBe('');
    expect($('meta[name="description"]').attr('content')?.trim()).toBeTruthy();
    expect($('meta[property="og:title"]').attr('content')).toBe($('title').text());
    expect($('meta[property="og:description"]').attr('content')).toBe($('meta[name="description"]').attr('content'));
    expect($('meta[property="og:type"]').attr('content')).toBe('website');
    expect($('meta[property="og:locale"]').attr('content')).toBe('zh_TW');
    expect($('meta[property="og:url"]').attr('content')).toBe(home);
    expect($('meta[name="robots"]')).toHaveLength(0);
  });

  it('dist 404 頁不被收錄', () => {
    const $ = cheerio.load(readDist('404.html'));

    expect($('meta[name="robots"]').attr('content')).toBe('noindex');
    expect($('link[rel="canonical"]')).toHaveLength(0);
    expect($('main h1')).toHaveLength(1);
    expect(readDist('sitemap-0.xml')).not.toContain('404');
  });

  it('dist 沒有行內 script 與行內樣式', () => {
    expect(listHtmlFiles().length).toBeGreaterThan(0);

    for (const file of listHtmlFiles()) {
      const $ = cheerio.load(readDist(file));
      const inlineScripts = $('script')
        .toArray()
        .filter((element) => !$(element).attr('src') && $(element).attr('type') !== 'application/ld+json');

      expect(inlineScripts, `${file} 有行內 script`).toHaveLength(0);
      expect($('style').length, `${file} 有 <style> 元素`).toBe(0);
      expect($('[style]').length, `${file} 有 style 屬性`).toBe(0);

      // 行內事件屬性與 javascript: 連結同樣會被 CSP 擋下。
      const eventAttributes = $('*')
        .toArray()
        .flatMap((element) => Object.keys('attribs' in element ? element.attribs : {}))
        .filter((name) => name.toLowerCase().startsWith('on'));
      expect(eventAttributes, `${file} 有行內事件屬性`).toEqual([]);
      expect($('[href^="javascript:" i]').length, `${file} 有 javascript: 連結`).toBe(0);
    }
  });

  it('dist 的 script、樣式與圖片都從本站載入', () => {
    for (const file of listHtmlFiles()) {
      const $ = cheerio.load(readDist(file));
      const resources = [
        ...$('script[src]').toArray().map((element) => $(element).attr('src')),
        ...$('link[rel="stylesheet"]').toArray().map((element) => $(element).attr('href')),
        ...$('img[src]').toArray().map((element) => $(element).attr('src')),
      ];

      // 唯一的例外是流量統計，由下一條測試逐項檢查。
      for (const url of resources.filter((resource) => resource !== ANALYTICS_SCRIPT_URL)) {
        expect(isSameSitePath(url), `${file} 載入了本站以外的資源：${url}`).toBe(true);
      }
    }

    const stylesheet = cheerio.load(readDist('index.html'))('link[rel="stylesheet"]').attr('href');
    expect(isSameSitePath(stylesheet)).toBe(true);
    expect(stylesheet).toMatch(/\.css$/);
  });

  it('dist 外部資源只有流量統計', () => {
    expect(listHtmlFiles().length).toBeGreaterThan(0);

    for (const file of listHtmlFiles()) {
      const $ = cheerio.load(readDist(file));
      const external = $(RESOURCE_SELECTOR)
        .toArray()
        .flatMap((element) => resourceUrls((name) => $(element).attr(name)).map((url) => ({ tag: 'tagName' in element ? element.tagName : '', url })))
        .filter(({ url }) => !isSameSitePath(url));

      expect(external.filter(({ url }) => url !== ANALYTICS_SCRIPT_URL), `${file} 有流量統計以外的外部資源`).toEqual([]);
      expect(external.every(({ tag }) => tag === 'script'), `${file} 用 script 以外的元素載入流量統計`).toBe(true);

      const beacons = $(`script[src="${ANALYTICS_SCRIPT_URL}"]`);
      // 與 check:content 的判斷一致：null、空字串、只有空白都算沒填。
      const token = site.analyticsToken?.trim();
      if (!token) {
        expect(beacons, `${file} token 未填時不應輸出流量統計`).toHaveLength(0);
        continue;
      }
      expect(beacons, `${file} 流量統計數量`).toHaveLength(1);
      expect(beacons.attr('defer'), `${file} 流量統計沒有 defer`).toBeDefined();
      expect(JSON.parse(beacons.attr('data-cf-beacon') ?? ''), `${file} 流量統計 token`).toEqual({ token });
    }
  });

  it('dist 沒有 data: 內嵌資源', () => {
    // CSP 的 img-src、font-src 只允許同源，內嵌成 data: 的小圖與字型會被擋下。
    const files = listDistFiles().filter((file) => /\.(html|css)$/.test(file));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      expect(readDist(file), `${file} 含 data: 內嵌資源`).not.toMatch(/\bdata:[a-z]+\//i);
    }
  });

  it('_headers 含必要標頭', () => {
    const blocks = parseHeadersFile(readDist('_headers'));
    const headers = blocks.get('/*');

    // 標頭必須掛在全站規則底下，不能只掛在某個路徑。
    expect(headers, '缺少 /* 規則').toBeDefined();

    const maxAge = Number(/max-age=(\d+)/.exec(headers?.get('strict-transport-security') ?? '')?.[1]);
    expect(maxAge).toBeGreaterThanOrEqual(ONE_YEAR_IN_SECONDS);
    expect(headers?.get('x-content-type-options')).toBe('nosniff');
    expect(headers?.get('referrer-policy')).toBe('strict-origin-when-cross-origin');

    const permissions = headers?.get('permissions-policy') ?? '';
    for (const feature of ['camera=()', 'microphone=()', 'geolocation=()']) {
      expect(permissions).toContain(feature);
    }

  });

  it('_headers CSP 只多允許流量統計', () => {
    const headers = parseHeadersFile(readDist('_headers')).get('/*');
    const csp = parseCsp(headers?.get('content-security-policy') ?? '');

    // 整張比對：多一個、少一個或改了任何指令都會失敗。
    // 唯一的外部來源是 Cloudflare Web Analytics 的腳本（script-src）與回報網址（connect-src）。
    expect(Object.fromEntries(csp)).toEqual({
      'default-src': ["'self'"],
      'script-src': ["'self'", 'https://static.cloudflareinsights.com'],
      'style-src': ["'self'"],
      'img-src': ["'self'"],
      'font-src': ["'self'"],
      'connect-src': ["'self'", 'https://cloudflareinsights.com'],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'none'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': [],
    });
  });

  it('_headers 預覽網址不收錄', () => {
    const blocks = parseHeadersFile(readDist('_headers'));
    const preview = blocks.get(PREVIEW_HOST_RULE);

    expect(preview, `缺少 ${PREVIEW_HOST_RULE} 規則`).toBeDefined();
    expect(preview?.get('x-robots-tag')).toBe('noindex');

    // 其他規則（包括 /* 與任何路徑規則）都不能帶不收錄，正式網域才不會被擋在搜尋引擎外。
    const others = [...blocks].filter(([rule, headers]) => rule !== PREVIEW_HOST_RULE && headers.has('x-robots-tag')).map(([rule]) => rule);
    expect(others, '預覽網址以外的規則帶了 X-Robots-Tag').toEqual([]);
  });

  it('dist 沒有 source map', () => {
    const files = listDistFiles();
    expect(files.filter((file) => file.endsWith('.map'))).toHaveLength(0);

    for (const file of files.filter((name) => /\.(js|css)$/.test(name))) {
      expect(readDist(file), `${file} 有 sourceMappingURL`).not.toContain('sourceMappingURL');
    }
  });
});
