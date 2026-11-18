import { describe, expect, it } from 'vitest';
import { site } from '../src/data/site';
import { OG_IMAGE, siteFullName } from '../src/lib/seo';
import { buildOgHtml } from './build-og-image';

describe('buildOgHtml', () => {
  it('buildOgHtml 只含公開身分', () => {
    const html = buildOgHtml(site);

    expect(html).toContain(siteFullName(site));
    expect(html).toContain(site.jobTitle);
    expect(html).toContain(site.tagline);
    // 不放信箱、外部網址與腳本；網址只出現本站網域。
    expect(html).not.toContain('@');
    expect(html).not.toContain('mailto:');
    expect(html).not.toContain('http://');
    expect(html).not.toMatch(/https:\/\//);
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain(new URL(site.url).host);
  });

  it('buildOgHtml 版面尺寸與預覽圖設定一致', () => {
    const html = buildOgHtml(site);

    expect(html).toContain(`width: ${OG_IMAGE.width}px`);
    expect(html).toContain(`height: ${OG_IMAGE.height}px`);
  });
});
