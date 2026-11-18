/**
 * 網站身分：姓名、職稱、公開連結與公開信箱。
 * 這裡只放願意公開的資料；電話、住址、生日與私人信箱不放。
 */

/** 網站身分資料的形狀。 */
export interface Site {
  /** 正式網址（不含結尾斜線）。 */
  url: string;
  /** 中文姓名。 */
  name: string;
  /** 英文名。 */
  alternateName: string;
  /** 職稱；各平台用同一個寫法。 */
  jobTitle: string;
  /** 首頁副標。 */
  tagline: string;
  /** 所在地，最多寫到縣市。 */
  location: string;
  /** 公開的個人頁連結；還沒提供時為 `null`，頁面不輸出該連結。 */
  links: {
    github: string | null;
    linkedin: string | null;
  };
  /** 公開信箱；還沒定案時為 `null`，頁面不輸出該連結。 */
  contactEmails: {
    /** 接案洽詢。 */
    work: string | null;
    /** 求職聯絡。 */
    jobs: string | null;
  };
  /** 頭像圖檔路徑；還沒有圖時為 `null`。 */
  avatar: string | null;
  /**
   * Cloudflare Web Analytics 的站台 token（公開值，每頁的 HTML 都會出現）。
   * 還沒建站台時為 `null`，頁面不輸出流量統計；正式部署前 `check:content` 會擋。
   */
  analyticsToken: string | null;
}

/** 網站身分目前的值。 */
export const site: Site = {
  url: 'https://lin-yu-chun.com',
  name: '林昱均',
  alternateName: 'Erica Lin',
  jobTitle: '產品導向前端工程師',
  tagline: 'React・TypeScript｜從需求做到上線',
  location: '新北市',
  links: {
    github: 'https://github.com/chunchunl',
    linkedin: 'https://www.linkedin.com/in/%E6%98%B1%E5%9D%87-%E6%9E%97-a2a820303/',
  },
  contactEmails: {
    work: 'work@lin-yu-chun.com',
    jobs: 'jobs@lin-yu-chun.com',
  },
  avatar: null,
  analyticsToken: null,
};
