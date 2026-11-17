# 林昱均 Erica Lin 個人網站

這是我的個人履歷與接案網站的原始碼，網址是 <https://lin-yu-chun.com>。

網站用 [Astro](https://astro.build/) 產生純靜態頁面，內容與結構化資料都在初始 HTML，不依賴 JavaScript。

## 環境需求

- Node.js 22.12 以上
- npm

## 指令

| 指令 | 用途 |
|---|---|
| `npm install` | 安裝相依套件 |
| `npm run dev` | 啟動本機開發伺服器 |
| `npm run build` | 產生靜態網站到 `dist/` |
| `npm run preview` | 在本機預覽 `dist/` |
| `npm run verify` | 一次跑完全部檢查，任何一步失敗就停 |
| `npm run check:content` | 正式部署前檢查必填欄位與佔位符（會先重新 build） |

`npm run verify` 依序執行：

1. `typecheck`：型別檢查（`astro check`）
2. `lint`：ESLint，必須 0 problems
3. `test`：單元測試
4. `check:facts`：事實數字沒有被寫死在 `src/data/facts.ts` 以外的原始碼
5. `build`：產生 `dist/`
6. `test:dist`：解析 build 產物的測試（頁面結構、沒有行內 script 與樣式、安全標頭、沒有 source map）
7. `scan:sensitive`：敏感內容掃描

## 專案結構

```text
src/data/site.ts      姓名、職稱、公開連結與公開信箱
src/data/facts.ts     全站會出現的數字與上線狀態（單一來源）
src/lib/format.ts     數字與比例的格式化
src/layouts/          共用版面
src/pages/            頁面
src/styles/           樣式
public/_headers       回應安全標頭
scripts/              檢查腳本與它們的測試
tests/dist/           build 產物測試
tests/fixtures/       測試用的虛構資料
```

## 內容怎麼更新

- **數字或上線狀態改了**：只改 `src/data/facts.ts`。各頁文字與結構化資料都讀這個檔，不會出現兩處數字不一致。這個檔不放日期與版本號。
- **姓名、職稱、連結、公開信箱改了**：只改 `src/data/site.ts`。還沒提供的欄位填 `null`，頁面不會輸出那個連結，`npm run check:content` 會提醒還沒填。
- **改完之後**：執行 `npm run verify`，全部通過再 commit。

## 這個 repo 不放的東西

這是公開的 repo。電話、住址、私人信箱、內部網址、金鑰都不放進來。

`npm run scan:sensitive` 會檢查版控範圍內的檔案（含還沒 commit 的）、檔名與 `dist/`，用通用樣式找手機號碼、信箱、本機路徑、雲端平台預設主機名稱、金鑰格式與四段式版本號。規則在 `scripts/scan-sensitive.rules.ts`。

通用樣式抓不到的東西，要靠下面兩件事補：

- **本機拒絕清單**：規則檔是公開的，不能寫真實的公司名稱、內部系統名稱或專案代號。把這些字串放在專案根目錄的 `scan-sensitive.local.json`（JSON 字串陣列，已列入 `.gitignore`），掃描時會不分大小寫比對。
- **人工確認**：圖片、字型、PDF 的內容不會被掃（只掃檔名，執行時會列出這些檔案）；日期能不能公開、文字有沒有刻意變形，也無法用樣式判斷。

規則誤判時，把那一筆加進規則檔的 `ALLOWED_FINDINGS` 並寫明理由，不要把整個檔案加進排除清單。

## 安全標頭與行內內容

`public/_headers` 的內容安全政策只允許同源資源，所以：

- 元件不寫 `<script>`。
- 不用 `style` 屬性，樣式只放在 `src/styles/`。
- `astro.config.mjs` 把樣式設為一律輸出成外部檔案，小圖與字型也不內嵌成 `data:`。

`npm run test:dist` 會檢查全部 HTML 是否符合。
