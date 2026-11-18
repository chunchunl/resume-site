/** `/robots.txt`：build 時輸出成靜態檔，內容由 `buildRobotsTxt` 產生。 */
import type { APIRoute } from 'astro';
import { site } from '../data/site';
import { buildRobotsTxt } from '../lib/robots';

/** 回傳 robots.txt 的純文字內容。 */
export const GET: APIRoute = () =>
  new Response(buildRobotsTxt(site), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
