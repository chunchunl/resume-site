/**
 * 隱私頁內容：網站不用 cookie、流量統計怎麼做、來信怎麼處理、怎麼要求刪除。
 * 頁面上的承諾以 spec 為準；保存期間 spec 沒寫，這裡不寫。
 */
import { siteFullName } from '../lib/seo';
import { siteEmails, type HomeEmail } from './home';
import type { Site } from './site';

/** 隱私頁的一個段落，標題輸出成 h2。 */
export interface PrivacySection {
  /** 段落標題。 */
  heading: string;
  /** 純文字段落，每段不超過 3 句。 */
  paragraphs: string[];
}

/** 隱私頁的全部內容。 */
export interface PrivacyContent {
  /** 頁面標題（`<title>`）。 */
  title: string;
  /** 頁面上的大標題（h1）。 */
  heading: string;
  /** 開頭的一段說明。 */
  intro: string;
  /** 各項說明，順序固定。 */
  sections: PrivacySection[];
  /** 公開信箱區塊的標題。 */
  emailsHeading: string;
  /** 公開信箱；沒有位址的不列。 */
  emails: HomeEmail[];
}

/**
 * 產生隱私頁內容。
 * @param site 網站身分；值為 `null` 的信箱不列。
 */
export function buildPrivacy(site: Site): PrivacyContent {
  return {
    title: `隱私說明｜${siteFullName(site)}`,
    heading: '隱私說明',
    intro: '這頁說明這個網站有沒有使用 cookie，以及我怎麼處理流量統計與來信。',
    sections: [
      {
        heading: 'Cookie 與追蹤碼',
        paragraphs: ['這個網站不使用 cookie。除了下面的流量統計，沒有安裝廣告或其他追蹤碼。'],
      },
      {
        heading: '流量統計',
        paragraphs: [
          '我使用 Cloudflare Web Analytics 統計網站的彙總流量，例如每一頁被瀏覽的次數。依 Cloudflare 的說明，這項服務不使用 cookie，也不會跨網站追蹤個別訪客。',
        ],
      },
      {
        heading: '寫信給我',
        paragraphs: [
          '寫信到下面的公開信箱時，信件會經過 Cloudflare 的轉寄服務送到我的信箱。信件內容只用於回覆該次洽詢。',
        ],
      },
      {
        heading: '刪除信件',
        paragraphs: ['如果想刪除寄給我的信件，請寫信到同一個信箱告訴我。'],
      },
    ],
    emailsHeading: '公開信箱',
    emails: siteEmails(site),
  };
}
