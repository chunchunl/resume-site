import { formatNumber } from '../lib/format';
import { siteFullName } from '../lib/seo';
import type { Facts } from './facts';
import type { Site } from './site';

/** 公開 PDF 的網址；`npm run build:pdf` 產生的檔案放在 `public/` 下的同一個路徑。 */
export const RESUME_PDF_HREF = '/resume/erica-lin-resume-zh.pdf';

/** 一段經歷或一筆學歷。 */
export interface ResumeEntry {
  /** 公司或學校名稱。 */
  org: string;
  /** 職稱、科系或課程名稱。 */
  role: string;
  /** 期間，只寫到「年-月」，例如「2025-07 至今」。 */
  period: string;
  /** 成果或內容，一條一行。 */
  points: string[];
}

/** 一組技能。 */
export interface SkillGroup {
  /** 分組名稱。 */
  name: string;
  /** 技能名稱，不寫年數與熟練度。 */
  items: string[];
}

/** 求職頁的全部內容。 */
export interface ResumeContent {
  /** 頁面標題（`<title>`），PDF 的 Title 也用這一個。 */
  title: string;
  /** 頁首顯示的姓名（中文姓名加英文名）。 */
  name: string;
  /** 頁首顯示的職稱。 */
  jobTitle: string;
  /** 各區塊標題。 */
  headings: {
    /** 專業摘要。 */
    summary: string;
    /** 工作經歷。 */
    experience: string;
    /** 技能。 */
    skills: string;
    /** 學歷與培訓。 */
    education: string;
  };
  /** 專業摘要。 */
  summary: string;
  /** 工作經歷，新的在前。 */
  experience: ResumeEntry[];
  /** 技能，四組。 */
  skills: SkillGroup[];
  /** 學歷與培訓，新的在前。 */
  education: ResumeEntry[];
  /** 下載 PDF 的連結。 */
  download: {
    /** 連結文字。 */
    label: string;
    /** PDF 的網址。 */
    href: string;
  };
  /** 聯絡方式。 */
  contact: {
    /** 求職信箱；還沒定案時為 `null`，頁面不輸出信箱。 */
    email: string | null;
    /** 網站網址。 */
    url: string;
  };
}

/** 技能四組；只寫技能名稱，年數與熟練度還沒核對，不寫。 */
const SKILLS: SkillGroup[] = [
  {
    name: 'Frontend',
    items: [
      'React',
      'JavaScript ES6+',
      'TypeScript',
      'HTML5、CSS3／SCSS、RWD',
      'REST API 串接與非同步資料處理',
      '元件化開發',
      'Figma 與設計稿落地',
    ],
  },
  {
    name: 'Content Frontend & AEO',
    items: [
      'Astro 靜態內容站',
      'JSON-LD：Article、FAQPage、BreadcrumbList',
      'canonical、Open Graph、sitemap、robots.txt',
      '可爬取性、頁面類型與結構化資料檢測',
      'Lighthouse 與正式頁面抽測',
    ],
  },
  {
    name: 'Backend & Delivery',
    items: [
      'C#／.NET',
      'SQL、Stored Procedure、Migration',
      'Hangfire',
      'Git、branch／PR 流程',
      'TDD、單元測試、整合測試',
      'DEV／UAT／正式環境驗證',
    ],
  },
  {
    name: 'AI Application',
    items: [
      'RAG、Embedding、Vector Search',
      'Reranking、Citation、Evaluation Set',
      'Cloudflare Workers AI、Vectorize、D1、R2',
      'Claude Code、Codex、MCP',
    ],
  },
];

/** 學歷與培訓，新的在前（與工作經歷同一個順序）。課程內容只列已確認的項目。 */
const EDUCATION: ResumeEntry[] = [
  {
    org: '資策會',
    role: '前端工程師就業養成班',
    period: '2024-12 至 2025-06',
    points: [
      'HTML5、CSS3、JavaScript 與 RWD 網頁開發基礎。',
      'React、Next.js 元件化開發與互動功能實作。',
      'Node.js、MySQL、RESTful API 與前後端資料串接概念。',
      'Git／GitHub 版本控制、小組協作、除錯、部署及期末專題製作。',
      'Figma、UI／UX 原型與 AI 輔助學習及開發。',
    ],
  },
  {
    org: '健行科技大學',
    role: '網路行銷暨美編設計人才培訓班',
    period: '2024-03 至 2024-06',
    points: [
      '設計思考、創意發想、文案撰寫、行銷企劃、網路行銷與提案技巧。',
      'Photoshop 數位影像編修、Illustrator 平面繪圖、平面廣告與網頁視覺設計。',
      '社群網站經營、基礎攝影、影片剪輯、產品包裝與專案作品集製作。',
    ],
  },
  {
    org: '東海大學',
    role: '畜產與生物科技學系 學士',
    period: '2017-09 至 2021-06',
    points: [],
  },
];

/**
 * 產生求職頁內容。
 * @param facts 全站事實；經歷裡的測試數與壓測請求數從這裡取。
 * @param site 網站身分；求職信箱為 `null` 時，輸出裡沒有信箱。
 */
export function buildResume(facts: Facts, site: Site): ResumeContent {
  const { eventPlatform } = facts;

  const name = siteFullName(site);

  return {
    title: `求職履歷｜${name}`,
    name,
    jobTitle: site.jobTitle,
    headings: {
      summary: '專業摘要',
      experience: '工作經歷',
      skills: '技能',
      education: '學歷與培訓',
    },
    summary:
      '我是有視覺設計背景的前端工程師，主要用 React 開發會員平台與企業內部系統。我參與庫存、會員獎勵、活動報名與權限等跨系統功能，能從需求釐清、介面設計、API 串接一路做到 DEV／UAT 驗證。近期我也擴展到資料庫、後端 API、排程與 AI 應用。',
    experience: [
      {
        org: '韻智股份有限公司（Curves 台灣總部）',
        role: '前端工程師',
        period: '2025-07 至今',
        points: [
          `從零獨立開發活動報名與驗票平台（React／TypeScript、Node.js、SQL Server、Azure），涵蓋店舖報名、QR 票券、手機驗票與即時看板；後端 ${formatNumber(eventPlatform.backendTests)} 項、前端 ${formatNumber(eventPlatform.frontendTests)} 項自動測試通過，UAT 壓測 ${formatNumber(eventPlatform.loadTestRequests)} 個請求無非預期錯誤。`,
          '獨立開發會員運動里程碑獎勵系統（C#／.NET、SQL Server、Hangfire），設計狀態機與可重跑不重複的每日／每週批次，完成會員端與店舖端。',
          '主導庫存系統需求、操作流程與 Figma 規劃，整合總部與店舖多站流程並執行 API 驗收；程式由其他工程師實作。',
          '建立 Astro 衛教內容站原型，完成正式文章頁 AEO 技術檢測。',
        ],
      },
      {
        org: '繪新國際有限公司',
        role: '視覺設計師',
        period: '2024-07 至 2024-10',
        points: ['負責公司官網視覺設計與網站內容呈現，協助架設電商網站，並建立商品資料與管理庫存。'],
      },
      {
        org: '金寶發食品有限公司',
        role: '品牌平面設計師',
        period: '2022-06 至 2024-03',
        points: ['負責自有品牌「鶯格格」的企業識別與 LOGO、社群圖文與經營、商品攝影與影片剪輯，以及印刷物與品牌行銷企劃書。'],
      },
    ],
    skills: SKILLS,
    education: EDUCATION,
    download: { label: '下載 PDF 履歷', href: RESUME_PDF_HREF },
    contact: { email: site.contactEmails.jobs, url: site.url },
  };
}
