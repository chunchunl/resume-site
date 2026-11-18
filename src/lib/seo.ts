import type { ServiceItem } from '../data/services';
import type { Site } from '../data/site';

/** 一份 JSON-LD 結構化資料。 */
export type JsonLd = Record<string, unknown>;

/** HTML 的語系代碼。 */
export type HtmlLang = 'zh-Hant-TW' | 'en';

/** 產生頁面 meta 需要的輸入。 */
export interface PageMetaInput {
  /** 頁面標題，全站每頁不可重複。 */
  title: string;
  /** 頁面描述。 */
  description: string;
  /** 頁面路徑，以斜線開頭（例：`/work/`）。 */
  path: string;
  /** 頁面語系，預設中文。 */
  lang?: HtmlLang;
  /** 設為 true 時不讓搜尋引擎收錄，也不輸出 canonical。 */
  noindex?: boolean;
}

/** 頁面 `<head>` 用到的 meta 值。 */
export interface PageMeta {
  /** 頁面標題。 */
  title: string;
  /** 頁面描述。 */
  description: string;
  /** canonical 網址；不收錄的頁面為 `null`。 */
  canonical: string | null;
  /** robots 指示；可收錄的頁面為 `null`。 */
  robots: 'noindex' | null;
  /** Open Graph 的網站名稱。 */
  ogSiteName: string;
  /** Open Graph 的語系代碼。 */
  ogLocale: 'zh_TW' | 'en_US';
  /** 分享預覽圖（LinkedIn、LINE、Facebook 等平台抓取）。 */
  ogImage: OgImageMeta;
}

/** 分享預覽圖的 meta 值。 */
export interface OgImageMeta {
  /** 圖片的正式網址（絕對網址）。 */
  url: string;
  /** 寬度（px）。 */
  width: number;
  /** 高度（px）。 */
  height: number;
  /** 替代文字。 */
  alt: string;
}

/**
 * 全站共用的分享預覽圖：站內路徑與尺寸。
 * 圖檔由 `npm run build:og` 產生到 `public/` 底下；改了尺寸要重產圖。
 */
export const OG_IMAGE = { path: '/og/erica-lin-og.png', width: 1200, height: 630 } as const;

/** 把站內路徑轉成正式網址。 */
function absoluteUrl(site: Site, path: string): string {
  return new URL(path, site.url).href;
}

/** 產生分享預覽圖的 meta 值；不收錄的頁面也帶，分享時一樣有圖。 */
function buildOgImageMeta(site: Site): OgImageMeta {
  return {
    url: absoluteUrl(site, OG_IMAGE.path),
    width: OG_IMAGE.width,
    height: OG_IMAGE.height,
    alt: `${siteFullName(site)}｜${site.jobTitle}`,
  };
}

/** 網站顯示用的全名：中文姓名加英文名。 */
export function siteFullName(site: Site): string {
  return `${site.name} ${site.alternateName}`;
}

/** `Person` 在全站 JSON-LD 裡的識別網址，其他結構化資料用它指向同一個人。 */
export function personId(site: Site): string {
  return absoluteUrl(site, '/#person');
}

/**
 * 產生首頁的 `Person` JSON-LD。
 * 只輸出公開的身分資料；所在地最多到縣市，不輸出電話、生日、街道地址與信箱。
 */
export function buildPersonJsonLd(site: Site): JsonLd {
  const sameAs = [site.links.linkedin, site.links.github].filter((url): url is string => url !== null);

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': personId(site),
    name: site.name,
    alternateName: site.alternateName,
    jobTitle: site.jobTitle,
    url: absoluteUrl(site, '/'),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    address: {
      '@type': 'PostalAddress',
      addressLocality: site.location,
      addressCountry: 'TW',
    },
  };
}

/** 產生首頁的 `WebSite` JSON-LD，作者指向同一個 `Person`。 */
export function buildWebSiteJsonLd(site: Site): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': absoluteUrl(site, '/#website'),
    name: siteFullName(site),
    url: absoluteUrl(site, '/'),
    inLanguage: 'zh-Hant-TW',
    author: { '@id': personId(site) },
  };
}

/** 產生頁面 `<head>` 用的標題、描述、canonical 與 Open Graph 值。 */
export function buildPageMeta(site: Site, page: PageMetaInput): PageMeta {
  const noindex = page.noindex ?? false;

  return {
    title: page.title,
    description: page.description,
    canonical: noindex ? null : absoluteUrl(site, page.path),
    robots: noindex ? 'noindex' : null,
    ogSiteName: siteFullName(site),
    ogLocale: page.lang === 'en' ? 'en_US' : 'zh_TW',
    ogImage: buildOgImageMeta(site),
  };
}

/**
 * 把 JSON-LD 物件轉成可以放進 `<script type="application/ld+json">` 的字串。
 * 小於符號改寫成跳脫序列，內容裡的文字不會提早結束 script 區塊。
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replaceAll('<', String.raw`\u003c`);
}

/** 一組問答。 */
export interface FaqItem {
  /** 問題。 */
  question: string;
  /** 答案，單段純文字。 */
  answer: string;
}

/** 麵包屑的一層。 */
export interface BreadcrumbItem {
  /** 顯示名稱。 */
  name: string;
  /** 站內路徑，以斜線開頭。 */
  path: string;
}

/**
 * 產生 `FAQPage` JSON-LD。問答字串原樣輸出，
 * 頁面上的可見文字要讀同一份資料，兩邊才會逐字相同。
 */
export function buildFaqPageJsonLd(faq: FaqItem[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

/** 產生 `BreadcrumbList` JSON-LD；每一層的網址都轉成正式網址。 */
export function buildBreadcrumbJsonLd(site: Site, items: BreadcrumbItem[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(site, item.path),
    })),
  };
}

/**
 * 產生一項服務的 `Service` JSON-LD：描述寫包含什麼，適合誰放在 `audience`，提供者指向首頁的 `Person`。
 * 沒有起價的服務不輸出 `offers`。
 */
export function buildServiceJsonLd(site: Site, service: ServiceItem): JsonLd {
  const priceSpecification =
    service.priceUnit === null
      ? { '@type': 'PriceSpecification', minPrice: service.priceFrom, priceCurrency: 'TWD' }
      : { '@type': 'UnitPriceSpecification', minPrice: service.priceFrom, priceCurrency: 'TWD', unitText: service.priceUnit };

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: service.includes.join('、'),
    url: absoluteUrl(site, `/services/#service-${service.id}`),
    audience: { '@type': 'Audience', audienceType: service.audience },
    // 帶上名稱，單獨看這一頁也知道提供者是誰；同一個 @id 會和首頁的 Person 合併。
    provider: { '@type': 'Person', '@id': personId(site), name: siteFullName(site) },
    ...(service.priceFrom === null ? {} : { offers: { '@type': 'Offer', priceSpecification } }),
  };
}
