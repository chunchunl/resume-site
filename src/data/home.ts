/**
 * 首頁內容：接收事實與身分資料，回傳首頁要顯示的文字。
 * 數字一律從事實檔取值，這裡不寫死；狀態文字由 rewardStatusLabel 產生。
 */
import { formatNumber, formatRatio } from '../lib/format';
import { rewardStatusLabel } from '../lib/status';
import type { Facts } from './facts';
import type { Site } from './site';

/** 一個帶文字的連結。 */
export interface HomeLink {
  /** 連結文字。 */
  label: string;
  /** 連結網址。 */
  href: string;
}

/** 第一屏內容。 */
export interface HomeHero {
  /** 中文姓名。 */
  name: string;
  /** 英文名。 */
  alternateName: string;
  /** 職稱。 */
  jobTitle: string;
  /** 副標。 */
  tagline: string;
  /** 一段自我介紹。 */
  intro: string;
  /** 兩個主按鈕：接案與求職。 */
  actions: HomeLink[];
  /** 次要連結（GitHub、LinkedIn）；沒有網址的不列。 */
  links: HomeLink[];
}

/** 一張代表作卡片。 */
export interface HomeCase {
  /** 作品名稱。 */
  title: string;
  /** 案例頁網址。 */
  href: string;
  /** 在哪裡做的；個人專案不填。 */
  org?: string;
  /** 一句話說明。 */
  summary: string;
  /** 我的角色。 */
  role: string;
  /** 使用的技術。 */
  tech: string[];
  /** 2～3 個結果。 */
  results: string[];
  /** 上線狀態文字；只有獎勵系統有。 */
  status?: string;
  /** 測試定位用的 data-section 值；只有獎勵系統有。 */
  section?: 'reward-system';
}

/** 一項其他作品（純文字，不放連結）。 */
export interface HomeOtherWork {
  /** 作品名稱。 */
  title: string;
  /** 說明，含我負責的範圍。 */
  description: string;
}

/** 「我怎麼工作」的一點。 */
export interface HomePrinciple {
  /** 標題。 */
  title: string;
  /** 說明。 */
  description: string;
}

/** 一個公開信箱。 */
export interface HomeEmail {
  /** 用途標籤。 */
  label: string;
  /** 信箱位址。 */
  address: string;
}

/** 聯絡區塊內容。 */
export interface HomeContact {
  /** 區塊標題。 */
  title: string;
  /** 一句說明。 */
  description: string;
  /** 公開信箱；沒有位址的不列。 */
  emails: HomeEmail[];
  /** 其他聯絡連結；沒有網址的不列。 */
  links: HomeLink[];
}

/** 首頁全部內容。 */
export interface HomeContent {
  /** 第一屏。 */
  hero: HomeHero;
  /** 三張代表作卡片，順序固定。 */
  cases: HomeCase[];
  /** 其他作品。 */
  otherWork: HomeOtherWork[];
  /** 我怎麼工作，三點。 */
  howIWork: HomePrinciple[];
  /** 聯絡區塊。 */
  contact: HomeContact;
}

const CURVES = 'Curves（連鎖健身品牌）';

/** 只留下有網址的連結；頁首、頁尾與首頁共用，順序由呼叫端決定。 */
export function presentLinks(links: { label: string; href: string | null }[]): HomeLink[] {
  return links.filter((link): link is HomeLink => link.href !== null);
}

/** 只留下有位址的信箱；頁尾與首頁共用。 */
export function presentEmails(emails: { label: string; address: string | null }[]): HomeEmail[] {
  return emails.filter((email): email is HomeEmail => email.address !== null);
}

/** 公開信箱與用途標籤，順序固定。 */
export function siteEmails(site: Site): HomeEmail[] {
  return presentEmails([
    { label: '接案洽詢', address: site.contactEmails.work },
    { label: '求職聯絡', address: site.contactEmails.jobs },
  ]);
}

/** 外部個人頁連結，順序固定為 GitHub、LinkedIn。 */
export function siteProfiles(site: Site): HomeLink[] {
  return presentLinks([
    { label: 'GitHub', href: site.links.github },
    { label: 'LinkedIn', href: site.links.linkedin },
  ]);
}

/** 依實際有幾個信箱產生聯絡說明，避免文字和資料對不上。 */
function contactDescription(emailCount: number): string {
  if (emailCount >= 2) return '接案與求職分成兩個信箱，請寫信到對應的位址。';
  if (emailCount === 1) return '請寫信到下面的信箱。';
  return '可以從下面的連結找到我。';
}

/**
 * 產生首頁內容。
 * @param facts 全站事實；換一組事實，輸出的數字與狀態會跟著改。
 * @param site 網站身分；值為 `null` 的連結與信箱不會出現在輸出裡。
 */
export function buildHome(facts: Facts, site: Site): HomeContent {
  const { eventPlatform, rewardSystem, rag } = facts;

  return {
    hero: {
      name: site.name,
      alternateName: site.alternateName,
      jobTitle: site.jobTitle,
      tagline: site.tagline,
      intro:
        '有視覺設計背景的前端工程師。我在連鎖健身品牌 Curves 擔任唯一開發者，從零完成活動報名驗票平台，也在既有企業架構裡端到端交付會員獎勵系統。除了 React 前端，我也負責資料庫、後端 API、排程、測試與部署。',
      actions: [
        { label: '找我合作', href: '/services/' },
        { label: '求職履歷', href: '/resume/' },
      ],
      links: siteProfiles(site),
    },
    cases: [
      {
        title: '活動報名與驗票平台',
        href: '/work/event-ticketing-platform/',
        org: CURVES,
        summary:
          '把原本散在試算表、Email 與紙本名單的活動流程，整合成店舖報名、電子票券、手機驗票與即時看板的一套平台。',
        role: '唯一開發者（需求、設計、前後端、資料庫、測試、部署）',
        tech: ['React', 'TypeScript', 'MUI', 'Node.js／Express', 'SQL Server', 'Socket.IO', 'Azure Web App', 'Jenkins'],
        results: [
          `後端 ${formatNumber(eventPlatform.backendTests)} 項、前端 ${formatNumber(eventPlatform.frontendTests)} 項自動測試通過，lint 0`,
          `上線前以瀏覽器端到端驗證，找出並修正 ${formatNumber(eventPlatform.e2eIssuesFixed)} 個單元測試沒抓到的跨角色問題`,
          `UAT 壓測 ${formatNumber(eventPlatform.loadTestRequests)} 個請求無非預期錯誤`,
        ],
      },
      {
        title: '會員運動里程碑獎勵系統',
        href: '/work/member-milestone-rewards/',
        org: CURVES,
        summary:
          `會員每累積 ${formatNumber(rewardSystem.milestoneVisits)} 次運動可獲得紀念 T 恤。系統自動追蹤進度、通知填尺寸、產生店舖訂購名單，並處理領取與轉店。`,
        role: '唯一開發者（後端團隊提供架構與 code review 諮詢）',
        tech: ['C#／.NET', 'SQL Server', 'Stored Procedure', 'Hangfire', 'React'],
        results: [
          '獨立完成資料模型、狀態機、API、每日與每週排程，以及會員端與店舖端',
          '排程可重跑不重複，各店錯誤獨立處理，一家出錯不影響其他店',
        ],
        status: rewardStatusLabel(rewardSystem.status, 'zh-TW'),
        section: 'reward-system',
      },
      {
        title: '個人 AI 知識平台（RAG）',
        href: '/work/personal-rag-knowledge-platform/',
        summary: '自己維護的知識問答助理。我從「AI 回答過時」一路追到資料同步與存取控制問題，並把它們修好。',
        role: '個人專案（問題定義、方案取捨、驗收）',
        tech: ['Cloudflare Workers AI', 'Vectorize', 'D1', 'R2', 'LINE Messaging API', 'Cloudflare Access'],
        results: [
          `追出同步管線靜默失敗的原因，重建約 ${formatNumber(rag.indexedChunks)} 個索引段落並補上日期資訊`,
          `固定評估題組由 ${formatRatio(rag.evalBefore, 'zh-TW')} 題提升到 ${formatRatio(rag.evalAfter, 'zh-TW')} 題`,
          '發現 LINE 入口沒有限制使用者身分，改成白名單、預設拒絕，網站也加上存取控制',
        ],
      },
    ],
    otherWork: [
      {
        title: '庫存管理系統規劃',
        description:
          '我主導店舖進貨、出貨、調撥、退單與贈品領用的需求、操作流程與 Figma 介面，並執行 API 驗收。程式由其他工程師實作。',
      },
    ],
    howIWork: [
      {
        title: '先把規則弄清楚再寫畫面',
        description: '我先釐清使用者、資料來源與業務規則，再決定介面與技術。',
      },
      {
        title: '用驗證說話',
        description: '單元測試、整合測試、瀏覽器端到端測試都過，再加上實際環境的結果，我才算完成。',
      },
      {
        title: 'AI 是工具，品質我負責',
        description: 'AI 協助我探索與實作。我用既有程式、失敗的測試與實測結果核對，不直接相信生成的內容。',
      },
    ],
    contact: {
      title: '聯絡我',
      description: contactDescription(siteEmails(site).length),
      emails: siteEmails(site),
      links: presentLinks([{ label: 'LinkedIn', href: site.links.linkedin }]),
    },
  };
}
