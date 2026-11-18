/**
 * llms.txt 的內容（格式依 llmstxt.org）：身分一句話、各頁連結與描述、案例摘要與結果、服務起價、聯絡方式。
 * 數字從案例內容（由 facts 產生）與服務清單取得，這裡不寫死。
 */
import type { CaseContent } from '../data/cases/types';
import { siteEmails, siteProfiles } from '../data/home';
import { formatServicePrice, type ServiceItem } from '../data/services';
import type { Site } from '../data/site';
import { siteFullName } from './seo';

/** 產生 llms.txt 需要的資料。 */
export interface LlmsInput {
  /** 網站身分；值為 `null` 的信箱與連結不列。 */
  site: Site;
  /** 案例，呼叫端用 `getCases('zh-TW', facts)` 取得，依傳入順序列出。 */
  cases: CaseContent[];
  /** 服務，呼叫端傳 `buildServices(site).services`，依傳入順序列出。 */
  services: ServiceItem[];
}

/** 「頁面」段的一頁。 */
interface LlmsPage {
  /** 連結名稱。 */
  name: string;
  /** 站內路徑。 */
  path: string;
  /** 一句描述。 */
  description: string;
}

/** 「頁面」段列出的頁面，順序即輸出順序。 */
const PAGES: LlmsPage[] = [
  { name: '首頁', path: '/', description: '我是誰、三個代表案例、我怎麼工作與聯絡方式。' },
  { name: '案例列表', path: '/work/', description: '三個案例，每個都寫明問題、我負責的範圍、驗證方式與結果。' },
  { name: '接案服務', path: '/services/', description: '四項接案服務的內容、起價與合作方式。' },
  { name: '求職履歷', path: '/resume/', description: '專業摘要、工作經歷、技能與學歷，可下載 PDF。' },
  { name: '隱私說明', path: '/privacy/', description: '網站不使用 cookie，以及流量統計與來信怎麼處理。' },
];

/** 網站介紹，放在摘要之後。 */
const INTRO = '這是我的個人網站。案例來自我在 Curves 的工作成果與個人專案，不是接案客戶的專案。';

/** 把站內路徑轉成正式網址。 */
function absoluteUrl(site: Site, path: string): string {
  return new URL(path, site.url).href;
}

/** 組一個 `## 標題` 段落；沒有項目時回傳空陣列，整段不輸出。 */
function section(heading: string, items: string[]): string[] {
  return items.length === 0 ? [] : [`## ${heading}`, '', ...items, ''];
}

/**
 * 產生 llms.txt 的內容。
 * `[名稱](網址)` 連結只用在站內頁面，一律是正式網址；信箱與外部個人頁寫成純文字。
 * 不輸出電話、生日、住址、私人信箱與子網域。
 * @param input.site 網站身分；摘要用職稱、副標與所在地（最多到縣市）。
 * @param input.cases 案例；列出標題、網址、摘要與結果。
 * @param input.services 服務；列出名稱與起價（`formatServicePrice` 的寫法）。
 */
export function buildLlmsTxt({ site, cases, services }: LlmsInput): string {
  const contacts = [
    ...siteEmails(site).map((email) => `- ${email.label}：${email.address}`),
    ...siteProfiles(site).map((link) => `- ${link.label}：${link.href}`),
  ];

  const lines = [
    `# ${siteFullName(site)}`,
    '',
    `> ${site.jobTitle}。${site.tagline}。所在地：${site.location}。`,
    '',
    INTRO,
    '',
    ...section(
      '頁面',
      PAGES.map((page) => `- [${page.name}](${absoluteUrl(site, page.path)}): ${page.description}`),
    ),
    ...section(
      '案例',
      cases.flatMap((content) => [
        `- [${content.title}](${absoluteUrl(site, `/work/${content.slug}/`)}): ${content.summary}`,
        ...content.results.map((result) => `  - ${result}`),
      ]),
    ),
    ...section(
      '服務',
      services.map((service) => `- ${service.name}：${formatServicePrice(service)}`),
    ),
    ...section('聯絡', contacts),
  ];

  return `${lines.join('\n').trimEnd()}\n`;
}
