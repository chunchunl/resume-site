import { describe, expect, it } from 'vitest';
import { site } from '../data/site';
import { buildRobotsTxt } from './robots';

/** spec 列出的八個 user-agent；測試自己列一份，不讀實作的常數。 */
const SPEC_AGENTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'PerplexityBot',
  'Google-Extended',
  'Bingbot',
  'Googlebot',
];

/** 去掉結尾換行後逐行切開。 */
const toLines = (text: string): string[] => text.trimEnd().split('\n');

describe('buildRobotsTxt', () => {
  it('buildRobotsTxt 允許全部 AI 爬蟲', () => {
    const text = buildRobotsTxt(site);
    const lines = toLines(text);

    expect(lines.slice(0, 2)).toEqual(['User-agent: *', 'Allow: /']);
    for (const agent of SPEC_AGENTS) {
      const index = lines.indexOf(`User-agent: ${agent}`);
      expect(index, `${agent} 沒有自己的一段`).toBeGreaterThan(-1);
      expect(lines[index + 1], `${agent} 的下一行`).toBe('Allow: /');
    }
    expect(text).not.toMatch(/disallow/i);
    expect(lines.at(-1)).toBe('Sitemap: https://lin-yu-chun.com/sitemap-index.xml');
  });

  it('buildRobotsTxt 網址跟著 site 變', () => {
    const text = buildRobotsTxt({ ...site, url: 'https://example.test' });

    expect(toLines(text).at(-1)).toBe('Sitemap: https://example.test/sitemap-index.xml');
    expect(text).not.toContain('lin-yu-chun.com');
  });
});
