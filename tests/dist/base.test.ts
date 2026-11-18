import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { site } from '../../src/data/site';
import { isSitePath as isSameSitePath, listDistFiles, listHtmlFiles, readDist } from './helpers';

const ONE_YEAR_IN_SECONDS = 31_536_000;

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
 */
function parseHeadersFile(content: string): Map<string, Map<string, string>> {
  const blocks = new Map<string, Map<string, string>>();
  let current: Map<string, string> | undefined;

  for (const line of content.split('\n')) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = new Map();
      blocks.set(line.trim(), current);
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

      for (const url of resources) {
        expect(isSameSitePath(url), `${file} 載入了本站以外的資源：${url}`).toBe(true);
      }
    }

    const stylesheet = cheerio.load(readDist('index.html'))('link[rel="stylesheet"]').attr('href');
    expect(isSameSitePath(stylesheet)).toBe(true);
    expect(stylesheet).toMatch(/\.css$/);
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

    const csp = parseCsp(headers?.get('content-security-policy') ?? '');
    expect(csp.get('default-src')).toEqual(["'self'"]);
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
    // 目前沒有任何外部來源；之後要加流量統計時，在這裡明確放寬。
    expect(csp.get('script-src')).toEqual(["'self'"]);
    expect(csp.get('style-src')).toEqual(["'self'"]);
    for (const sources of csp.values()) {
      expect(sources).not.toContain("'unsafe-inline'");
      expect(sources).not.toContain("'unsafe-eval'");
      expect(sources).not.toContain('*');
    }
  });

  it('dist 沒有 source map', () => {
    const files = listDistFiles();
    expect(files.filter((file) => file.endsWith('.map'))).toHaveLength(0);

    for (const file of files.filter((name) => /\.(js|css)$/.test(name))) {
      expect(readDist(file), `${file} 有 sourceMappingURL`).not.toContain('sourceMappingURL');
    }
  });
});
