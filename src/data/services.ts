import { formatNumber, type Locale } from '../lib/format';
import type { FaqItem } from '../lib/seo';
import type { Site } from './site';

/** 一項接案服務。 */
export interface ServiceItem {
  /** 服務代號（小寫英文、數字與連字號），也是頁面上服務卡的 data-section 值。 */
  id: string;
  /** 服務名稱。 */
  name: string;
  /** 適合誰。 */
  audience: string;
  /** 包含什麼。 */
  includes: string[];
  /** 不包含什麼。 */
  excludes: string[];
  /** 起價（新台幣、整數）；還沒定案時為 `null`。 */
  priceFrom: number | null;
  /** 計價單位，例如「每頁」；以整案計價時為 `null`。 */
  priceUnit: string | null;
  /** 是否需要洽談後才能報價。 */
  quoteRequired: boolean;
}

/** 一個相關案例連結。 */
export interface RelatedCase {
  /** 案例名稱，與案例頁的標題相同。 */
  title: string;
  /** 案例頁網址。 */
  href: string;
  /** 案例的來歷，例如「在 Curves 的工作成果」或「個人專案」。 */
  context: string;
}

/** 接案頁信箱區塊的文字。 */
export interface ServicesContact {
  /** 區塊標題。 */
  title: string;
  /** 一句說明。 */
  description: string;
}

/** 接案頁的全部內容。 */
export interface ServicesContent {
  /** 頁面開頭的一段說明。 */
  intro: string;
  /** 四項服務，順序固定。 */
  services: ServiceItem[];
  /** 合作規則。 */
  rules: string[];
  /** 常見問題；FAQPage JSON-LD 讀同一份。 */
  faq: FaqItem[];
  /** 相關案例區塊的標題。 */
  relatedTitle: string;
  /** 相關案例。 */
  relatedCases: RelatedCase[];
  /** 信箱區塊的文字。 */
  contact: ServicesContact;
  /** 接案信箱；還沒定案時為 `null`，頁面不輸出信箱區塊。 */
  contactEmail: string | null;
}

/** 四項服務。價格是業務設定，不是履歷事實，所以放這裡、不放 facts.ts；調價只改這裡。 */
const SERVICES: ServiceItem[] = [
  {
    id: 'aeo-audit',
    name: 'AEO 網站健檢報告',
    audience: '已經有官網，想知道 Google 與 AI 搜尋讀不讀得懂網站內容的品牌或店家。',
    includes: [
      '檢查結構化資料、標題與描述、canonical、sitemap 與 robots.txt',
      '確認 AI 爬蟲讀得到主要內容',
      '一份列出必修與建議項目的報告',
    ],
    excludes: ['直接修改網站程式', '文案撰寫', '廣告投放'],
    priceFrom: 8000,
    priceUnit: null,
    quoteRequired: false,
  },
  {
    id: 'brand-site-aeo',
    name: '形象網站＋AEO 基礎設定（5 頁內）',
    audience: '想要一個頁數不多的新官網，並希望一開始就做好讓搜尋引擎與 AI 讀懂的設定的個人或小品牌。',
    includes: ['5 頁內的 Astro 靜態網站', '手機與桌機版面', '結構化資料、sitemap 與 robots.txt', '部署上線'],
    excludes: ['文案撰寫與攝影', '網域與主機費用', '會員、金流等需要後端的功能'],
    priceFrom: 30000,
    priceUnit: null,
    quoteRequired: false,
  },
  {
    id: 'figma-to-react',
    name: 'Figma 轉 React 前端',
    audience: '已經有 Figma 設計稿，需要前端工程師把畫面做成 React 元件的團隊。',
    includes: ['依設計稿做成 React 與 TypeScript 元件', '手機與桌機版面'],
    excludes: ['設計稿本身', '後端 API 與資料庫'],
    priceFrom: 5000,
    priceUnit: '每頁',
    quoteRequired: false,
  },
  {
    id: 'custom-system',
    name: '報名／預約／內部管理系統',
    audience: '活動報名、預約或內部作業還靠試算表與紙本，想整合成一套系統的團隊。',
    includes: ['需求訪談與流程整理', '前端、後端與資料庫開發', '自動測試與部署上線'],
    excludes: ['硬體設備', '第三方服務的月費', '需求範圍以外的功能'],
    priceFrom: 100000,
    priceUnit: null,
    quoteRequired: true,
  },
];

/** 合作規則，只寫這三條。 */
const RULES = ['先確認需求範圍，再提供報價。', '報價含 2 輪修改。', '分期付款：一般案 50／50，系統案 30／40／30。'];

/** 常見問題；三條規則各一組，另一組說明案例的來歷。 */
const FAQ: FaqItem[] = [
  { question: '怎麼開始合作？', answer: '請先寫信說明需求，我會和你確認需求範圍，再提供報價。' },
  { question: '報價含幾次修改？', answer: '報價含 2 輪修改。' },
  { question: '付款方式是什麼？', answer: '分期付款。一般案分兩期 50／50，系統案分三期 30／40／30。' },
  {
    question: '頁面上的案例是客戶的專案嗎？',
    answer: '頁面上的案例是我在 Curves 的工作成果與個人專案，不是接案客戶的專案。',
  },
];

/** 相關案例；標題與案例頁相同，有單元測試核對。 */
const RELATED_CASES: RelatedCase[] = [
  { title: '活動報名與驗票平台', href: '/work/event-ticketing-platform/', context: '在 Curves 的工作成果' },
  { title: '會員運動里程碑獎勵系統', href: '/work/member-milestone-rewards/', context: '在 Curves 的工作成果' },
  { title: '個人 AI 知識平台（RAG）', href: '/work/personal-rag-knowledge-platform/', context: '個人專案' },
];

/**
 * 產生接案頁內容。
 * @param site 網站身分；接案信箱為 `null` 時，頁面不輸出信箱連結。
 */
export function buildServices(site: Site): ServicesContent {
  return {
    intro: '我接四種案子。每一項都寫明適合誰、包含什麼、不包含什麼，以及從多少錢起。',
    services: SERVICES,
    rules: RULES,
    faq: FAQ,
    relatedTitle: '相關作品',
    relatedCases: RELATED_CASES,
    contact: {
      title: '寫信給我',
      description: '請簡單說明需求、預計時程與預算範圍，我會先回信確認需求範圍。',
    },
    contactEmail: site.contactEmails.work,
  };
}

/**
 * 把一項服務的起價寫成頁面上的文字，例如「NT$8,000 起」「每頁 NT$5,000 起」。
 * 起價還沒定案時回傳「另行報價」，頁面仍能 build；正式部署由 `check:content` 擋下。
 * @param lang 目前只有中文；英文版（第二批）再依語系取字。
 */
export function formatServicePrice(service: ServiceItem, lang: Locale = 'zh-TW'): string {
  void lang;
  if (service.priceFrom === null) return '另行報價';
  const unit = service.priceUnit === null ? '' : `${service.priceUnit} `;
  const quote = service.quoteRequired ? '，需洽談' : '';
  return `${unit}NT$${formatNumber(service.priceFrom)} 起${quote}`;
}
