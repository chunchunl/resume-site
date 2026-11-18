/** `/llms.txt`：build 時輸出成靜態檔，內容和頁面讀同一份案例、服務與身分資料。 */
import type { APIRoute } from 'astro';
import { getCases } from '../data/cases';
import { facts } from '../data/facts';
import { buildServices } from '../data/services';
import { site } from '../data/site';
import { buildLlmsTxt } from '../lib/llms';

/** 回傳 llms.txt 的純文字內容。 */
export const GET: APIRoute = () =>
  new Response(
    buildLlmsTxt({ site, cases: getCases('zh-TW', facts), services: buildServices(site).services }),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
