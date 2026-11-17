// @ts-check
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://lin-yu-chun.com',
  output: 'static',
  devToolbar: { enabled: false },
  integrations: [sitemap()],
  // 中文是預設語系，網址不加前綴；英文頁之後放在 /en/。
  i18n: {
    defaultLocale: 'zh-TW',
    locales: ['zh-TW', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  // 樣式一律輸出成外部檔案，回應標頭的 CSP 才能維持 style-src 'self'。
  build: { inlineStylesheets: 'never' },
  // 不產生公開的 source map；小圖與字型不內嵌成 data:（CSP 的 img-src、font-src 只允許同源）。
  vite: { build: { sourcemap: false, assetsInlineLimit: 0 } },
});
