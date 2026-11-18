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

/** 一項其他作品（不是代表作卡片；有案例頁的才附連結）。 */
export interface HomeOtherWork {
  /** 作品名稱。 */
  title: string;
  /** 說明，含我負責的範圍。 */
  description: string;
  /** 站內案例頁網址；沒有案例頁時不填，只顯示文字。 */
  href?: string;
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

/**
 * 信箱旁的提醒：電腦沒有設定郵件程式時，點 `mailto:` 連結不會有反應，訪客可以複製信箱自己寄。
 * 首頁與接案頁的聯絡說明共用這一句。
 */
export const EMAIL_COPY_HINT = '點選信箱會開啟預設的郵件程式；若無反應，請複製信箱位址後自行寄送。';

/** 依實際有幾個信箱產生聯絡說明，避免文字和資料對不上；有信箱時附上複製信箱的提醒。 */
function contactDescription(emailCount: number): string {
  if (emailCount >= 2) return `接案洽詢與求職聯繫，請分別來信至下列信箱。${EMAIL_COPY_HINT}`;
  if (emailCount === 1) return `請來信至下列信箱。${EMAIL_COPY_HINT}`;
  return '請透過下列連結聯繫。';
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
        '具視覺設計背景的前端工程師。我在連鎖健身品牌 Curves 從零獨立開發活動報名驗票平台，並在既有企業架構中端到端交付會員獎勵系統。除 React 前端外，亦負責資料庫、後端 API、排程、測試與部署。',
      actions: [
        { label: '合作洽詢', href: '/services/' },
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
          '將原本分散於試算表、Email 與紙本名單的活動流程，整合為涵蓋店舖報名、電子票券、手機驗票與即時看板的單一平台。',
        role: '獨立開發（需求、設計、前後端、資料庫、測試、部署）',
        tech: ['React', 'TypeScript', 'MUI', 'Node.js／Express', 'SQL Server', 'Socket.IO', 'Azure Web App', 'Jenkins'],
        results: [
          `後端 ${formatNumber(eventPlatform.backendTests)} 項、前端 ${formatNumber(eventPlatform.frontendTests)} 項自動測試通過，lint 0`,
          `上線前以瀏覽器端到端驗證，找出並修正 ${formatNumber(eventPlatform.e2eIssuesFixed)} 個單元測試未發現的跨角色問題`,
          `UAT 壓測 ${formatNumber(eventPlatform.loadTestRequests)} 個請求無非預期錯誤`,
        ],
      },
      {
        title: '會員運動里程碑獎勵系統',
        href: '/work/member-milestone-rewards/',
        org: CURVES,
        summary:
          `會員每累積 ${formatNumber(rewardSystem.milestoneVisits)} 次運動可獲得紀念 T 恤。系統自動追蹤進度、通知會員登記尺寸、產生店舖訂購名單，並處理領取與轉店。`,
        role: '獨立開發（後端團隊提供架構與 code review 諮詢）',
        tech: ['C#／.NET', 'SQL Server', 'Stored Procedure', 'Hangfire', 'React'],
        results: [
          '獨立完成資料模型、狀態機、API、每日與每週排程，以及會員端與店舖端',
          '排程可重新執行而不重複，各店舖錯誤獨立處理，單一店舖出錯不影響其他店舖',
        ],
        status: rewardStatusLabel(rewardSystem.status, 'zh-TW'),
        section: 'reward-system',
      },
      {
        title: '個人 AI 知識平台（RAG）',
        href: '/work/personal-rag-knowledge-platform/',
        summary: '自行維護的知識問答助理。從「AI 回答過時」追查到資料同步問題並完成修正，也將使用權限限定為本人。',
        role: '獨立負責問題定義、方案取捨與驗收',
        tech: ['Cloudflare Workers AI', 'Vectorize', 'D1', 'R2', 'LINE Messaging API', 'Cloudflare Access'],
        results: [
          `找出同步中斷的原因，重建約 ${formatNumber(rag.indexedChunks)} 個索引段落並補上日期資訊`,
          `固定評估題組由 ${formatRatio(rag.evalBefore, 'zh-TW')} 題提升至 ${formatRatio(rag.evalAfter, 'zh-TW')} 題`,
          'LINE 與網站兩個入口均僅限本人使用，並從外部逐一驗證',
        ],
      },
    ],
    otherWork: [
      {
        title: '庫存管理系統規劃',
        description:
          '主導店舖進貨、出貨、調撥、退單與贈品領用的需求、操作流程與 Figma 介面，並執行 API 驗收。程式由其他工程師實作。',
        href: '/work/inventory-system-planning/',
      },
    ],
    howIWork: [
      {
        title: '先釐清規則，再實作畫面',
        description: '先釐清使用者、資料來源與業務規則，再決定介面與技術。',
      },
      {
        title: '以驗證結果為依據',
        description: '單元測試、整合測試與瀏覽器端到端測試全數通過，並取得實際環境的結果後，才視為完成。',
      },
      {
        title: 'AI 是工具，品質由我負責',
        description: 'AI 協助探索與實作。生成的內容以既有程式、失敗的測試與實測結果核對，不直接採信。',
      },
    ],
    contact: {
      title: '聯絡方式',
      description: contactDescription(siteEmails(site).length),
      emails: siteEmails(site),
      links: presentLinks([{ label: 'LinkedIn', href: site.links.linkedin }]),
    },
  };
}
