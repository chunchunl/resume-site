/**
 * Cloudflare Web Analytics 的手動嵌入設定。
 * 用外部腳本（不是行內程式碼），所以 CSP 只要在 script-src 與 connect-src 各多允許一個網域。
 */
import type { Site } from '../data/site';

/** Cloudflare Web Analytics 的腳本網址（官方手動嵌入的寫法）。 */
export const ANALYTICS_SCRIPT_URL = 'https://static.cloudflareinsights.com/beacon.min.js';

/** 頁面上流量統計 `<script>` 需要的兩個屬性值。 */
export interface AnalyticsBeacon {
  /** 腳本網址。 */
  src: string;
  /** `data-cf-beacon` 屬性的值，是含 token 的 JSON 字串。 */
  dataCfBeacon: string;
}

/**
 * 產生流量統計腳本的設定。
 * 沒有 token（`null`、空字串或只有空白）時回傳 `null`，頁面就不輸出流量統計。
 * @param site 網站身分；只讀 `analyticsToken`。
 * @returns 腳本設定；沒有 token 時為 `null`。
 */
export function buildAnalyticsBeacon(site: Pick<Site, 'analyticsToken'>): AnalyticsBeacon | null {
  const token = site.analyticsToken?.trim();
  if (!token) return null;
  return { src: ANALYTICS_SCRIPT_URL, dataCfBeacon: JSON.stringify({ token }) };
}
