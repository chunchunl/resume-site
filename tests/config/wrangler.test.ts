import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** 讀取專案根目錄的 wrangler.jsonc；檔案刻意不寫註解，可以直接 JSON.parse。 */
function readWranglerConfig(): Record<string, unknown> {
  return JSON.parse(readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8')) as Record<string, unknown>;
}

describe('wrangler 設定', () => {
  it('wrangler 設定', () => {
    const config = readWranglerConfig();

    expect(config.name).toBe('resume-site');
    expect(config.compatibility_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(config.assets).toEqual({ directory: './dist', not_found_handling: '404-page' });
    expect(config.workers_dev).toBe(true);
    expect(config.preview_urls).toBe(true);
    // 只有靜態資源：沒有 Worker 程式、不綁帳號、不放變數、沒有任何 binding。
    // 用白名單：多了任何設定鍵（例如 main、account_id、vars、route、env）都會失敗。
    expect(Object.keys(config).sort()).toEqual(['$schema', 'assets', 'compatibility_date', 'name', 'preview_urls', 'routes', 'workers_dev']);
  });

  it('wrangler 設定正式網域', () => {
    const config = readWranglerConfig();

    // 正式網域只綁主網域一筆；www 由 Cloudflare 的轉址規則轉到主網域，不綁到 Worker。
    expect(config.routes).toEqual([{ pattern: 'lin-yu-chun.com', custom_domain: true }]);
    // 有 routes 時沒寫 workers_dev，wrangler 會推斷成 false，預覽網址就會消失；要明確保留。
    expect(config.workers_dev).toBe(true);
    for (const key of ['main', 'account_id', 'vars']) {
      expect(config, `不應該有 ${key}`).not.toHaveProperty(key);
    }
  });
});
