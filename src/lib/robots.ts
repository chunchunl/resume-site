/**
 * robots.txt 的內容：允許全部爬蟲，並為 spec 列出的搜尋與 AI 爬蟲各寫一段明確的允許規則。
 */
import type { Site } from '../data/site';

/** 要明列允許的爬蟲 user-agent，順序即輸出順序。 */
export const ALLOWED_CRAWLERS: readonly string[] = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'PerplexityBot',
  'Google-Extended',
  'Bingbot',
  'Googlebot',
];

/** sitemap 索引檔在網站上的路徑（由 `@astrojs/sitemap` 產生）。 */
export const SITEMAP_INDEX_PATH = '/sitemap-index.xml';

/**
 * 產生 robots.txt 的內容。
 * 先寫 `User-agent: *` 的允許規則，再為每個明列的爬蟲各寫一段，最後一行是 sitemap 位置。
 * 不寫任何 `Disallow`。
 * @param site 網站身分；sitemap 網址由 `site.url` 組成，不寫死網域。
 */
export function buildRobotsTxt(site: Site): string {
  const groups = ['*', ...ALLOWED_CRAWLERS].map((agent) => `User-agent: ${agent}\nAllow: /\n`);
  const sitemapUrl = new URL(SITEMAP_INDEX_PATH, site.url).href;
  return `${groups.join('\n')}\nSitemap: ${sitemapUrl}\n`;
}
