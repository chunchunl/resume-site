/**
 * 產生全站共用的分享預覽圖：`public/og/erica-lin-og.png`（LinkedIn、LINE、Facebook 分享連結時顯示）。
 * 執行：`npm run build:og`（需要瀏覽器，所以不在 `verify` 內）。產生後再跑一次 build，圖才會進 `dist/`。
 *
 * 範本是這個檔案裡的 HTML 字串，只在產圖時由瀏覽器讀取，不進 `src/` 也不進 `dist/`，
 * 所以可以有自己的 `<style>`，不受網站 CSP 與「不寫行內內容」規則限制。
 * 用 `page.setContent` 直接載入範本，不起本機服務。
 *
 * 內容只放公開身分（姓名、職稱、副標、網域），讀 `site.ts`；改了這些值要重產圖。
 * 配色複製自 `src/styles/global.css` 的設計變數；改了網站配色也要重產圖。
 *
 * 瀏覽器：預設用 Playwright 的 Chromium；設環境變數 `OG_BROWSER_CHANNEL=msedge` 或 `chrome`，
 * 可改用本機已安裝的 Edge 或 Chrome。字型跟著執行機器的系統字型走，進版控的圖在 Windows 產生。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { site, type Site } from '../src/data/site';
import { OG_IMAGE, siteFullName } from '../src/lib/seo';

/** 預覽圖用到的顏色，複製自 `global.css` 的設計變數（名稱對照寫在右邊）。 */
const COLORS = {
  bg: '#f7f5f0', // --color-bg
  text: '#1d2127', // --color-text
  muted: '#545b66', // --color-text-muted
  accent: '#0b6152', // --color-accent
  accentSoft: '#e2efeb', // --color-accent-soft
} as const;

/** 與網站相同的系統字型清單（`--font-sans`）。 */
const FONT_STACK = "system-ui, -apple-system, 'Segoe UI', 'PingFang TC', 'Microsoft JhengHei', 'Noto Sans TC', sans-serif";

/** 圖檔大小上限；超過就停下來，不寫出檔案。 */
const MAX_BYTES = 300 * 1024;

/** 跳脫 HTML 特殊字元。 */
function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/**
 * 產生預覽圖範本的 HTML：左側色條、姓名、職稱、副標與網域。
 * 不放信箱、電話、照片與外部網址；網域只寫主機名稱。
 */
export function buildOgHtml(input: Site): string {
  const host = new URL(input.url).host;

  return `<!doctype html>
<html lang="zh-Hant-TW">
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; }
  body {
    width: ${OG_IMAGE.width}px;
    height: ${OG_IMAGE.height}px;
    background: ${COLORS.bg};
    color: ${COLORS.text};
    font-family: ${FONT_STACK};
    display: flex;
    box-sizing: border-box;
    overflow: hidden;
  }
  .bar { width: 28px; background: ${COLORS.accent}; flex: none; }
  .content { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 0 96px; }
  .label {
    align-self: flex-start;
    background: ${COLORS.accentSoft};
    color: ${COLORS.accent};
    font-size: 26px;
    font-weight: 700;
    padding: 8px 20px;
    border-radius: 999px;
    margin: 0 0 36px;
  }
  .name { font-size: 92px; font-weight: 700; line-height: 1.15; margin: 0; letter-spacing: 0.02em; }
  .title { font-size: 44px; font-weight: 700; color: ${COLORS.accent}; margin: 28px 0 0; }
  .tagline { font-size: 34px; color: ${COLORS.muted}; margin: 16px 0 0; }
  .host { font-size: 28px; color: ${COLORS.muted}; margin: 64px 0 0; letter-spacing: 0.04em; }
</style>
</head>
<body>
  <div class="bar"></div>
  <div class="content">
    <p class="label">作品集與履歷</p>
    <h1 class="name">${escapeHtml(siteFullName(input))}</h1>
    <p class="title">${escapeHtml(input.jobTitle)}</p>
    <p class="tagline">${escapeHtml(input.tagline)}</p>
    <p class="host">${escapeHtml(host)}</p>
  </div>
</body>
</html>
`;
}

/** 指令進入點：開瀏覽器載入範本、截圖成 PNG 存到 `public/`。 */
async function main(): Promise<void> {
  const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
  const outputPath = join(root, 'public', ...OG_IMAGE.path.split('/').filter(Boolean));
  const channel = process.env.OG_BROWSER_CHANNEL || undefined;
  const browser = await chromium.launch(channel ? { channel } : {});

  try {
    const page = await browser.newPage({
      viewport: { width: OG_IMAGE.width, height: OG_IMAGE.height },
      deviceScaleFactor: 1,
    });
    await page.setContent(buildOgHtml(site), { waitUntil: 'load' });
    // 等字型就緒再截圖，換機器重產時才不會截到替代字型。
    await page.evaluate(() => document.fonts.ready);
    const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: OG_IMAGE.width, height: OG_IMAGE.height } });
    if (png.byteLength >= MAX_BYTES) throw new Error(`預覽圖 ${png.byteLength} bytes，超過上限 ${MAX_BYTES}`);

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, png);
    console.log(`已產生 ${OG_IMAGE.path}：${OG_IMAGE.width}×${OG_IMAGE.height}，${png.byteLength} bytes`);
  } finally {
    await browser.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
