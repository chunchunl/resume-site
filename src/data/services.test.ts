import { describe, expect, it } from 'vitest';
import { getCases } from './cases';
import { collectStrings, writingRuleViolations } from './cases/test-utils';
import { SLUG_PATTERN } from './cases/types';
import { facts } from './facts';
import { buildServiceInquiryMailto, buildServices, formatServicePrice, type ServiceItem } from './services';
import { site, type Site } from './site';

/** 接案信箱還沒定案的假身分資料。 */
const siteWithoutWorkEmail: Site = { ...site, contactEmails: { ...site.contactEmails, work: null } };

/** 產生一項價格欄位可自訂的假服務。 */
function fakeService(price: Pick<ServiceItem, 'priceFrom' | 'priceUnit' | 'quoteRequired'>): ServiceItem {
  return { id: 'fake-service', name: '假服務', audience: '測試用', includes: ['一項'], excludes: ['一項'], ...price };
}

describe('buildServices', () => {
  it('buildServices 四項服務順序', () => {
    const { services } = buildServices(site);

    expect(services.map((service) => service.id)).toEqual(['aeo-audit', 'brand-site-aeo', 'figma-to-react', 'custom-system']);
    for (const service of services) expect(service.id).toMatch(SLUG_PATTERN);
  });

  it('buildServices 每項欄位齊全', () => {
    for (const service of buildServices(site).services) {
      expect(service.name.trim(), service.id).not.toBe('');
      expect(service.audience.trim(), service.id).not.toBe('');
      expect(service.includes.length, service.id).toBeGreaterThanOrEqual(1);
      expect(service.excludes.length, service.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('buildServices 起價', () => {
    const { services } = buildServices(site);

    expect(services.map((service) => service.priceFrom)).toEqual([8000, 30000, 5000, 100000]);
    expect(services.filter((service) => service.priceUnit !== null).map((service) => [service.id, service.priceUnit])).toEqual([
      ['figma-to-react', '每頁'],
    ]);
    expect(services.filter((service) => service.quoteRequired).map((service) => service.id)).toEqual(['custom-system']);
  });

  it('buildServices 合作規則三條', () => {
    const content = buildServices(site);
    const allText = collectStrings(content).join('\n');

    expect(content.rules).toHaveLength(3);
    expect(content.rules.join('\n')).toContain('50／50');
    expect(content.rules.join('\n')).toContain('30／40／30');
    for (const banned of ['一次只接', '同業', '時薪', '二代健保', '稅', '維護另計']) {
      expect(allText, banned).not.toContain(banned);
    }
  });

  it('buildServices 不把 Curves 寫成客戶', () => {
    const content = buildServices(site);
    const allText = collectStrings(content).join('\n');

    expect(content.faq.map((item) => item.answer)).toContain('頁面上的案例是我在 Curves 的工作成果與個人專案，不是接案客戶的專案。');
    expect(content.relatedCases.map((item) => [item.href, item.context])).toEqual([
      ['/work/event-ticketing-platform/', '在 Curves 的工作成果'],
      ['/work/member-milestone-rewards/', '在 Curves 的工作成果'],
      ['/work/personal-rag-knowledge-platform/', '個人專案'],
    ]);
    for (const banned of ['客戶：Curves', 'Curves 委託', '為 Curves 接案']) {
      expect(allText, banned).not.toContain(banned);
    }
  });

  it('buildServices 相關案例的標題與案例頁相同', () => {
    const cases = getCases('zh-TW', facts);
    const titleBySlug = new Map(cases.map((item) => [`/work/${item.slug}/`, item.title]));

    for (const item of buildServices(site).relatedCases) {
      expect(item.title, item.href).toBe(titleBySlug.get(item.href));
    }
  });

  it('buildServices 常見問題', () => {
    const { faq } = buildServices(site);

    expect(faq.length).toBeGreaterThanOrEqual(3);
    for (const item of faq) {
      expect(item.question).toMatch(/？$/);
      expect(item.answer).not.toMatch(/[\r\n<>]/);
    }
  });

  it('buildServices 接案信箱', () => {
    expect(buildServices(site).contactEmail).toBe(site.contactEmails.work);
    expect(buildServices(siteWithoutWorkEmail).contactEmail).toBeNull();
  });

  it('buildServices 聯絡說明提醒可以複製信箱', () => {
    // 電腦沒有設定郵件程式時，點 mailto: 連結不會有反應；提醒訪客可以複製信箱自己寄。
    const hint = '點選信箱會開啟預設的郵件程式；若無反應，請複製信箱位址後自行寄送。';

    // 整句比對：提醒接在原本的說明後面、只出現一次。
    expect(buildServices(site).contact.description).toBe(`來信時請簡述需求、預計時程與預算範圍，我會先回信確認需求範圍。${hint}`);
    // 沒有信箱時頁面不顯示聯絡區塊，說明也不需要這句。
    expect(buildServices(siteWithoutWorkEmail).contact.description).not.toContain(hint);
  });

  it('buildServices 頁面文字都在內容函式裡', () => {
    const content = buildServices(site);

    expect(content.intro.trim()).not.toBe('');
    expect(content.relatedTitle).toBe('相關作品');
    expect(content.contact.title.trim()).not.toBe('');
    expect(content.contact.description.trim()).not.toBe('');
  });

  it('buildServices 不寫 P1 沒定的承諾', () => {
    const allText = collectStrings(buildServices(site)).join('\n');

    for (const banned of ['線上說明', '原始碼', '一上線就']) expect(allText, banned).not.toContain(banned);
  });

  it('buildServices 文案規則', () => {
    expect(writingRuleViolations(collectStrings(buildServices(site)))).toEqual([]);
  });

  it('buildServices 合作注意事項與合作規則不矛盾', () => {
    const content = buildServices(site);

    expect(content.disclaimerTitle.trim()).not.toBe('');
    expect(content.disclaimerIntro.trim()).not.toBe('');
    expect(content.disclaimer.length).toBeGreaterThanOrEqual(1);
    // 注意事項講「範圍外」才另外計價，不能跟合作規則「報價含 2 輪修改」矛盾，所以不寫死的輪數。
    expect(content.disclaimer.join('\n')).not.toMatch(/\d+\s*輪/);
  });
});

describe('buildServiceInquiryMailto', () => {
  it('buildServiceInquiryMailto 主旨與內文都帶入服務名稱，且正確編碼', () => {
    const service = fakeService({ priceFrom: 8000, priceUnit: null, quoteRequired: false });
    const href = buildServiceInquiryMailto(service, 'work@lin-yu-chun.com');

    expect(href.startsWith('mailto:work@lin-yu-chun.com?subject=')).toBe(true);
    const url = new URL(href);
    expect(url.pathname).toBe('work@lin-yu-chun.com');
    expect(decodeURIComponent(url.searchParams.get('subject') ?? '')).toBe(`洽詢服務：${service.name}`);
    const body = decodeURIComponent(url.searchParams.get('body') ?? '');
    expect(body).toContain(service.name);
    expect(body).toContain('\n');
    expect(body).not.toContain('\\n');
  });
});

describe('formatServicePrice', () => {
  it('formatServicePrice 四種寫法', () => {
    expect(formatServicePrice(fakeService({ priceFrom: 8000, priceUnit: null, quoteRequired: false }))).toBe('NT$8,000 起');
    expect(formatServicePrice(fakeService({ priceFrom: 5000, priceUnit: '每頁', quoteRequired: false }))).toBe('每頁 NT$5,000 起');
    expect(formatServicePrice(fakeService({ priceFrom: 100000, priceUnit: null, quoteRequired: true }))).toBe('NT$100,000 起，需洽談');
    expect(formatServicePrice(fakeService({ priceFrom: null, priceUnit: null, quoteRequired: false }))).toBe('另行報價');
  });
});
