/**
 * 正式網域上線檢查：對已部署的網站逐項請求，確認 sitemap、robots.txt、llms.txt、PDF、
 * 安全標頭、404、HTTP 與 www 轉址、公開信箱都符合預期。
 * 執行：`npm run check:production -- https://lin-yu-chun.com`；任一項失敗以 exit code 1 結束。
 * 上線與日後每次部署後重跑。期望的標頭讀 `public/_headers`，不另寫一份。
 * 外部網站（例如 LinkedIn）不檢查：它們對程式請求常回非 200，與本站無關。
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { RESUME_PDF_HREF } from '../src/data/resume';
import { site } from '../src/data/site';
import { buildRobotsTxt, SITEMAP_INDEX_PATH } from '../src/lib/robots';
import { parseHeadersFile } from './lib/headers-file';

/** 一項檢查的結果。 */
export interface CheckResult {
  /** 沒有任何問題時為 `true`。 */
  ok: boolean;
  /** 每個問題一句說明；通過時為空陣列。 */
  problems: string[];
}

/** 檢查需要的回應內容：狀態碼與標頭。`fetch` 的 `Response` 也符合這個形狀。 */
export interface FetchedResponse {
  /** HTTP 狀態碼。 */
  status: number;
  /** 回應標頭。 */
  headers: Headers;
}

/** 一項檢查的名稱與結果，用來輸出報表。 */
export interface NamedResult {
  /** 檢查項目的說明，例如「首頁的安全標頭」。 */
  name: string;
  /** 這一項的結果。 */
  result: CheckResult;
}

/** 用來確認 404 的路徑：網站上不會有這一頁。 */
const NOT_FOUND_PATH = '/check-production-not-found/';

/** 每個請求最多等多久（毫秒），對方不回應時不要一直卡住。 */
const REQUEST_TIMEOUT_MS = 15_000;

/** 把問題清單包成檢查結果。 */
function toResult(problems: string[]): CheckResult {
  return { ok: problems.length === 0, problems };
}

/** 取出錯誤的說明；fetch 失敗時真正的原因（例如 DNS 查不到）在 `cause`。 */
function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return error.cause instanceof Error ? `${error.message}（${error.cause.message}）` : error.message;
}

/**
 * 比對回應標頭：期望的每一個標頭都要出現且值相同，而且不能有 `X-Robots-Tag`
 * （正式網域帶了不收錄，搜尋引擎就不會收）。
 * @param expected `parseHeadersFile` 讀出的某一段規則（小寫標頭名稱 → 值）。
 * @param headers 實際回應的標頭。
 */
export function checkHeaders(expected: Map<string, string>, headers: Headers): CheckResult {
  const problems: string[] = [];
  for (const [name, value] of expected) {
    const actual = headers.get(name);
    if (actual === null) problems.push(`缺少標頭 ${name}`);
    else if (actual !== value) problems.push(`標頭 ${name} 的值不同：期望「${value}」，實際「${actual}」`);
  }
  if (headers.has('x-robots-tag')) problems.push(`正式網域不應該有 x-robots-tag（實際「${headers.get('x-robots-tag')}」）`);
  return toResult(problems);
}

/**
 * 檢查是不是永久轉址到指定網址：狀態碼要是 301 或 308，`Location` 正規化後要等於目標
 * （`https://lin-yu-chun.com` 與 `https://lin-yu-chun.com/` 視為相同）。
 * 302、307 是暫時轉址，搜尋引擎不會把舊網址的權重轉過去，所以不算通過。
 * @param response 不跟隨轉址取得的回應。
 * @param target 應該轉到的完整網址，例如 `https://lin-yu-chun.com/`。
 */
export function checkRedirect(response: FetchedResponse, target: string): CheckResult {
  const problems: string[] = [];
  if (response.status !== 301 && response.status !== 308) problems.push(`狀態碼是 ${response.status}，不是 301 或 308`);
  const location = response.headers.get('location');
  const normalized = location !== null && URL.canParse(location) ? new URL(location).href : location;
  if (normalized !== new URL(target).href) problems.push(`轉到「${location ?? '（沒有 Location）'}」，不是「${target}」`);
  return toResult(problems);
}

/** 取出 XML 裡某個元素底下每個 `<loc>` 的網址。 */
function extractLocs(xml: string, parent: 'sitemap' | 'url'): string[] {
  const pattern = new RegExp(`<${parent}>\\s*<loc>([^<]+)</loc>`, 'g');
  return [...xml.matchAll(pattern)].map((match) => (match[1] ?? '').trim());
}

/**
 * 從 sitemap 索引檔取出每個子 sitemap 的網址。
 * @param xml `sitemap-index.xml` 的內容。
 */
export function parseSitemapIndex(xml: string): string[] {
  return extractLocs(xml, 'sitemap');
}

/**
 * 從子 sitemap 取出每個頁面的網址。
 * @param xml 子 sitemap（例如 `sitemap-0.xml`）的內容。
 */
export function parseSitemapUrls(xml: string): string[] {
  return extractLocs(xml, 'url');
}

/**
 * 從 `llms.txt` 取出 `[名稱](網址)` 形式、而且是本站的連結；純文字網址與外部網站不算。
 * @param text `llms.txt` 的內容。
 * @param siteUrl 本站網址，例如 `https://lin-yu-chun.com`；只比對 origin。
 */
export function extractInternalLinks(text: string, siteUrl: string): string[] {
  const origin = new URL(siteUrl).origin;
  return [...text.matchAll(/\[(?:.*?)\]\(([^)\s]+)\)/g)]
    .map((match) => match[1] ?? '')
    .filter((url) => URL.canParse(url) && new URL(url).origin === origin);
}

/**
 * 找出被 Cloudflare「Email Address Obfuscation」改寫過的信箱連結。
 * 改寫後連結會指向 `/cdn-cgi/l/email-protection`，訪客要執行 JavaScript 才看得到位址，違反 spec 的一般 `mailto:`。
 * @param html 頁面 HTML。
 * @returns 每個命中的連結網址；沒有被改寫時為空陣列。
 */
export function findObfuscatedEmails(html: string): string[] {
  return [...html.matchAll(/["'](\/cdn-cgi\/l\/email-protection[^"']*)["']/g)].map((match) => match[1] ?? '');
}

/**
 * 從頁面 HTML 取出第一個樣式檔的完整網址；找不到時回傳 `null`。
 * @param html 頁面 HTML。
 * @param pageUrl 這個頁面的網址，用來把相對路徑換成完整網址。
 */
export function findStylesheetUrl(html: string, pageUrl: string): string | null {
  for (const match of html.matchAll(/<link\b[^>]*>/g)) {
    const tag = match[0];
    if (!/\brel=["']?stylesheet["'\s>]/.test(tag)) continue;
    const href = /\bhref=["']([^"']+)["']/.exec(tag)?.[1];
    if (href) return new URL(href, pageUrl).href;
  }
  return null;
}

/** 一次請求的結果：成功時有狀態碼、標頭與內文，連不上時只有錯誤說明。 */
type Fetched = (FetchedResponse & { body: string }) | { error: string };

/** 不跟隨轉址送出請求並讀完內文；連不上或逾時回傳錯誤說明，不往外丟。 */
async function fetchPage(url: string): Promise<Fetched> {
  try {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    return { status: response.status, headers: response.headers, body: await response.text() };
  } catch (error) {
    return { error: `${url} 連不上：${errorMessage(error)}` };
  }
}

/** 檢查請求成功而且狀態碼是期望值；回傳問題清單。 */
function statusProblems(fetched: Fetched, url: string, expected = 200): string[] {
  if ('error' in fetched) return [fetched.error];
  return fetched.status === expected ? [] : [`${url} 回 ${fetched.status}`];
}

/** 依序請求每個網址，收集不是 200 的；不是本站 origin 的網址不請求，直接記成問題。 */
async function checkAllOk(urls: string[], origin: string): Promise<string[]> {
  const problems: string[] = [];
  for (const url of urls) {
    if (!URL.canParse(url) || new URL(url).origin !== origin) {
      problems.push(`${url} 不是本站網址`);
      continue;
    }
    problems.push(...statusProblems(await fetchPage(url), url));
  }
  return problems;
}

/**
 * 對正式網址跑全部檢查；每一項各自記錄結果，某個請求連不上不會中斷其他項目。
 * @param baseUrl 正式網址，例如 `https://lin-yu-chun.com`。
 * @param headersFile `public/_headers` 的內容；期望的標頭從這裡讀。
 */
export async function runChecks(baseUrl: string, headersFile: string): Promise<NamedResult[]> {
  const base = new URL(baseUrl);
  const home = new URL('/', base).href;
  const blocks = parseHeadersFile(headersFile);
  const expected = blocks.get('/*');
  if (!expected) throw new Error('public/_headers 沒有 /* 規則');
  const results: NamedResult[] = [];
  const add = (name: string, problems: string[]): void => {
    results.push({ name, result: toResult(problems) });
  };

  // sitemap：索引檔 → 每個子 sitemap → 每個網址。
  const indexUrl = new URL(SITEMAP_INDEX_PATH, base).href;
  const index = await fetchPage(indexUrl);
  add('sitemap-index.xml 回 200', statusProblems(index, indexUrl));
  const sitemapProblems: string[] = [];
  const pageUrls: string[] = [];
  for (const sitemapUrl of 'body' in index ? parseSitemapIndex(index.body) : []) {
    if (new URL(sitemapUrl).origin !== base.origin) {
      sitemapProblems.push(`${sitemapUrl} 不是本站網址`);
      continue;
    }
    const sitemap = await fetchPage(sitemapUrl);
    sitemapProblems.push(...statusProblems(sitemap, sitemapUrl));
    if ('body' in sitemap) pageUrls.push(...parseSitemapUrls(sitemap.body));
  }
  if (pageUrls.length === 0) sitemapProblems.push('sitemap 裡沒有任何網址');
  sitemapProblems.push(...(await checkAllOk(pageUrls, base.origin)));
  add(`sitemap 的 ${pageUrls.length} 個網址都回 200`, sitemapProblems);

  // llms.txt：狀態、編碼與其中的站內連結。
  const llmsUrl = new URL('/llms.txt', base).href;
  const llms = await fetchPage(llmsUrl);
  add('llms.txt 回 200', statusProblems(llms, llmsUrl));
  const llmsExpected = blocks.get('/llms.txt');
  if (llmsExpected && 'headers' in llms) add('llms.txt 的標頭（指定 UTF-8）', checkHeaders(llmsExpected, llms.headers).problems);
  const llmsLinks = 'body' in llms ? extractInternalLinks(llms.body, base.href) : [];
  add(`llms.txt 的 ${llmsLinks.length} 個站內連結都回 200`, llmsLinks.length === 0 ? ['llms.txt 沒有站內連結'] : await checkAllOk(llmsLinks, base.origin));

  // robots.txt 要和 repo 產生的內容逐字相同（擋 Cloudflare 在前面插入規則）。
  const robotsUrl = new URL('/robots.txt', base).href;
  const robots = await fetchPage(robotsUrl);
  const robotsProblems = statusProblems(robots, robotsUrl);
  if ('body' in robots && robots.body !== buildRobotsTxt(site)) robotsProblems.push('內容和 buildRobotsTxt(site) 不同（可能被插入了規則）');
  add('robots.txt 回 200 且內容等於 repo 產生的版本', robotsProblems);

  // 公開 PDF。
  const pdfUrl = new URL(RESUME_PDF_HREF, base).href;
  const pdf = await fetchPage(pdfUrl);
  const pdfProblems = statusProblems(pdf, pdfUrl);
  if ('headers' in pdf && !(pdf.headers.get('content-type') ?? '').startsWith('application/pdf')) {
    pdfProblems.push(`Content-Type 是「${pdf.headers.get('content-type') ?? ''}」`);
  }
  add('履歷 PDF 回 200 且是 application/pdf', pdfProblems);

  // 安全標頭：首頁、樣式檔、不存在的網址都要帶齊。
  const homePage = await fetchPage(home);
  add('首頁回 200', statusProblems(homePage, home));
  add('首頁的安全標頭', 'headers' in homePage ? checkHeaders(expected, homePage.headers).problems : [homePage.error]);
  const stylesheet = 'body' in homePage ? findStylesheetUrl(homePage.body, home) : null;
  if (stylesheet) {
    const css = await fetchPage(stylesheet);
    // 樣式檔要真的回 200：404 回應也帶齊標頭，只比標頭會把找不到的樣式檔當成通過。
    add('樣式檔回 200 且帶齊安全標頭', [...statusProblems(css, stylesheet), ...('headers' in css ? checkHeaders(expected, css.headers).problems : [])]);
  } else {
    add('樣式檔回 200 且帶齊安全標頭', ['首頁找不到樣式檔']);
  }
  const notFoundUrl = new URL(NOT_FOUND_PATH, base).href;
  const notFound = await fetchPage(notFoundUrl);
  add('不存在的網址回 404', statusProblems(notFound, notFoundUrl, 404));
  add('404 回應的安全標頭', 'headers' in notFound ? checkHeaders(expected, notFound.headers).problems : [notFound.error]);

  // HTTP 轉 HTTPS、www 轉主網域。
  const httpUrl = new URL(home);
  httpUrl.protocol = 'http:';
  const http = await fetchPage(httpUrl.href);
  add('http 首頁轉到 https', 'status' in http ? checkRedirect(http, home).problems : [http.error]);
  const wwwUrl = new URL(home);
  wwwUrl.hostname = `www.${base.hostname}`;
  const www = await fetchPage(wwwUrl.href);
  add('www 首頁轉到主網域', 'status' in www ? checkRedirect(www, home).problems : [www.error]);

  // 兩個公開信箱都要是一般 mailto:，不能被改寫成要 JavaScript 解碼的連結。
  const emailProblems: string[] = [];
  if ('body' in homePage) {
    emailProblems.push(...findObfuscatedEmails(homePage.body).map((url) => `信箱被改寫成 ${url}`));
    for (const email of Object.values(site.contactEmails)) {
      if (email && !homePage.body.includes(`href="mailto:${email}"`)) emailProblems.push(`首頁沒有 mailto:${email}`);
    }
  } else {
    emailProblems.push(homePage.error);
  }
  add('首頁的公開信箱是一般 mailto:', emailProblems);

  return results;
}

/** 指令進入點。 */
async function main(): Promise<void> {
  const baseUrl = process.argv[2] ?? '';
  // robots.txt、sitemap 的期望值都從 site.url 產生，所以只接受正式網址本身。
  if (!URL.canParse(baseUrl) || new URL(baseUrl).origin !== new URL(site.url).origin) {
    console.error(`用法：npm run check:production -- ${site.url}`);
    process.exitCode = 1;
    return;
  }

  const headersFile = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  const results = await runChecks(baseUrl, headersFile);
  for (const { name, result } of results) {
    console.log(`${result.ok ? '✅' : '❌'} ${name}`);
    for (const problem of result.problems) console.log(`   - ${problem}`);
  }
  const failed = results.filter(({ result }) => !result.ok).length;
  console.log(`check:production ${results.length} 項，${failed} 項失敗`);
  process.exitCode = failed > 0 ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
