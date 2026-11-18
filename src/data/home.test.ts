import { describe, expect, it } from 'vitest';
import { formatNumber, formatRatio } from '../lib/format';
import { rewardStatusLabel } from '../lib/status';
import type { Facts } from './facts';
import { buildHome } from './home';
import { site, type Site } from './site';

/** 兩組假事實：每個欄位的值都不同，也都不同於正式的事實。 */
const factsA: Facts = {
  eventPlatform: { backendTests: 611, frontendTests: 322, loadTestRequests: 2455, e2eIssuesFixed: 13 },
  rewardSystem: { status: 'testing', milestoneVisits: 120 },
  rag: { indexedChunks: 4100, evalBefore: { passed: 11, total: 19 }, evalAfter: { passed: 21, total: 21 } },
  inventory: { alignmentMeetings: 7, gapItems: 38 },
};

const factsB: Facts = {
  eventPlatform: { backendTests: 733, frontendTests: 288, loadTestRequests: 3566, e2eIssuesFixed: 27 },
  rewardSystem: { status: 'launched', milestoneVisits: 150 },
  rag: { indexedChunks: 5200, evalBefore: { passed: 9, total: 23 }, evalAfter: { passed: 25, total: 25 } },
  inventory: { alignmentMeetings: 9, gapItems: 43 },
};

/** 兩個公開連結都有值的假身分資料；LinkedIn 用虛構網址。 */
const fullSite: Site = {
  ...site,
  links: { github: 'https://github.com/example-user', linkedin: 'https://www.linkedin.com/in/example-user/' },
};

/** 一組事實在頁面上會出現的寫法。 */
function formattedValues(facts: Facts): string[] {
  return [
    `${formatNumber(facts.eventPlatform.backendTests)} 項`,
    `${formatNumber(facts.eventPlatform.frontendTests)} 項`,
    `${formatNumber(facts.eventPlatform.loadTestRequests)} 個請求`,
    `修正 ${formatNumber(facts.eventPlatform.e2eIssuesFixed)} 個`,
    `${formatNumber(facts.rag.indexedChunks)} 個`,
    formatRatio(facts.rag.evalBefore, 'zh-TW'),
    formatRatio(facts.rag.evalAfter, 'zh-TW'),
    rewardStatusLabel(facts.rewardSystem.status, 'zh-TW'),
    `每累積 ${formatNumber(facts.rewardSystem.milestoneVisits)} 次`,
  ];
}

/** 一組事實的數值本身（不帶單位），用來確認另一份輸出完全沒有它。 */
function rawValues(facts: Facts): string[] {
  return [
    formatNumber(facts.eventPlatform.backendTests),
    formatNumber(facts.eventPlatform.frontendTests),
    formatNumber(facts.eventPlatform.loadTestRequests),
    String(facts.eventPlatform.loadTestRequests),
    formatNumber(facts.eventPlatform.e2eIssuesFixed),
    formatNumber(facts.rag.indexedChunks),
    String(facts.rag.indexedChunks),
    formatRatio(facts.rag.evalBefore, 'zh-TW'),
    formatRatio(facts.rag.evalAfter, 'zh-TW'),
    rewardStatusLabel(facts.rewardSystem.status, 'zh-TW'),
    formatNumber(facts.rewardSystem.milestoneVisits),
  ];
}

/** 取出內容物件裡全部的字串。 */
function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(collectStrings);
  return [];
}

const fullText = (value: unknown): string => collectStrings(value).join('\n');

describe('buildHome', () => {
  it('buildHome 數字跟著 facts 變', () => {
    const textA = fullText(buildHome(factsA, fullSite));
    const textB = fullText(buildHome(factsB, fullSite));

    for (const value of formattedValues(factsA)) expect(textA, `A 應含「${value}」`).toContain(value);
    for (const value of rawValues(factsB)) expect(textA, `A 不應含「${value}」`).not.toContain(value);

    for (const value of formattedValues(factsB)) expect(textB, `B 應含「${value}」`).toContain(value);
    for (const value of rawValues(factsA)) expect(textB, `B 不應含「${value}」`).not.toContain(value);
  });

  it('buildHome 庫存系統寫明責任', () => {
    const home = buildHome(factsA, fullSite);

    expect(home.otherWork).toHaveLength(1);
    expect(home.otherWork[0]?.title).toContain('庫存');
    expect(fullText(home.otherWork)).toContain('程式由其他工程師實作');
    expect(home.otherWork[0]?.href).toBe('/work/inventory-system-planning/');
  });

  it('buildHome 卡片順序與連結', () => {
    const { cases } = buildHome(factsA, fullSite);

    expect(cases.map((card) => card.href)).toEqual([
      '/work/event-ticketing-platform/',
      '/work/member-milestone-rewards/',
      '/work/personal-rag-knowledge-platform/',
    ]);
    expect(cases.map((card) => card.title)).toEqual([
      '活動報名與驗票平台',
      '會員運動里程碑獎勵系統',
      '個人 AI 知識平台（RAG）',
    ]);
  });

  it('buildHome 每張卡有一句話、角色、技術與 2～3 個結果', () => {
    for (const card of buildHome(factsA, fullSite).cases) {
      expect(card.summary.trim(), card.title).not.toBe('');
      expect(card.role.trim(), card.title).not.toBe('');
      expect(card.tech.length, card.title).toBeGreaterThan(0);
      expect(card.results.length, card.title).toBeGreaterThanOrEqual(2);
      expect(card.results.length, card.title).toBeLessThanOrEqual(3);
    }
  });

  it('buildHome 只有獎勵系統卡帶狀態與 reward-system 標記', () => {
    const [eventCard, rewardCard, ragCard] = buildHome(factsA, fullSite).cases;

    expect(rewardCard?.section).toBe('reward-system');
    expect(rewardCard?.status).toBe(rewardStatusLabel('testing', 'zh-TW'));
    expect(buildHome(factsB, fullSite).cases[1]?.status).toBe(rewardStatusLabel('launched', 'zh-TW'));
    expect(eventCard?.section).toBeUndefined();
    expect(eventCard?.status).toBeUndefined();
    expect(ragCard?.section).toBeUndefined();
    expect(ragCard?.status).toBeUndefined();
  });

  it('buildHome 測試中的獎勵系統卡不含「已上線」、日期與版本號', () => {
    const text = fullText(buildHome(factsA, fullSite).cases[1]);

    expect(text).not.toContain('已上線');
    expect(text).not.toMatch(/\d{4}\s*[-/.年]\s*\d{1,2}/);
    expect(text).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });

  it('buildHome 第一屏：姓名、職稱、副標與兩個主按鈕', () => {
    const { hero } = buildHome(factsA, fullSite);

    expect(hero.name).toBe('林昱均');
    expect(hero.alternateName).toBe('Erica Lin');
    expect(hero.jobTitle).toBe('產品導向前端工程師');
    expect(hero.tagline).toBe('React・TypeScript｜從需求做到上線');
    expect(hero.intro.trim()).not.toBe('');
    expect(hero.actions).toEqual([
      { label: '合作洽詢', href: '/services/' },
      { label: '求職履歷', href: '/resume/' },
    ]);
    expect(hero.links).toEqual([
      { label: 'GitHub', href: fullSite.links.github },
      { label: 'LinkedIn', href: fullSite.links.linkedin },
    ]);
  });

  it('buildHome 我怎麼工作有三點', () => {
    const { howIWork } = buildHome(factsA, fullSite);

    expect(howIWork).toHaveLength(3);
    for (const item of howIWork) {
      expect(item.title.trim()).not.toBe('');
      expect(item.description.trim()).not.toBe('');
    }
  });

  it('buildHome 聯絡區塊：兩個信箱各有標籤，另放 LinkedIn', () => {
    const { contact } = buildHome(factsA, fullSite);

    expect(contact.emails).toEqual([
      { label: '接案洽詢', address: fullSite.contactEmails.work },
      { label: '求職聯絡', address: fullSite.contactEmails.jobs },
    ]);
    expect(contact.links).toEqual([{ label: 'LinkedIn', href: fullSite.links.linkedin }]);
    expect(contact.description).toContain('分別');
  });

  it('buildHome 聯絡說明提醒可以複製信箱', () => {
    // 電腦沒有設定郵件程式時，點 mailto: 連結不會有反應；提醒訪客可以複製信箱自己寄。
    const hint = '點選信箱會開啟預設的郵件程式；若無反應，請複製信箱位址後自行寄送。';

    // 整句比對：提醒接在原本的說明後面、只出現一次。
    expect(buildHome(factsA, fullSite).contact.description).toBe(`接案洽詢與求職聯繫，請分別來信至下列信箱。${hint}`);
    const oneEmail = buildHome(factsA, { ...fullSite, contactEmails: { work: null, jobs: fullSite.contactEmails.jobs } });
    expect(oneEmail.contact.description).toBe(`請來信至下列信箱。${hint}`);
    // 沒有任何信箱時，不提信箱。
    const noEmail = buildHome(factsA, { ...fullSite, contactEmails: { work: null, jobs: null } });
    expect(noEmail.contact.description).not.toContain(hint);
  });

  it('buildHome 連結或信箱為 null 時不輸出那一個', () => {
    const home = buildHome(factsA, {
      ...fullSite,
      links: { github: fullSite.links.github, linkedin: null },
      contactEmails: { work: null, jobs: fullSite.contactEmails.jobs },
    });

    expect(home.hero.links).toEqual([{ label: 'GitHub', href: fullSite.links.github }]);
    expect(home.contact.emails).toEqual([{ label: '求職聯絡', address: fullSite.contactEmails.jobs }]);
    expect(home.contact.links).toEqual([]);
    // 只剩一個信箱時，說明文字不能再寫「分別來信」。
    expect(home.contact.description).not.toContain('分別');
    expect(JSON.stringify(home)).not.toContain('null');
  });

  it('buildHome RAG 卡片不描述修正前的弱點', () => {
    const rag = buildHome(factsA, fullSite).cases.find((item) => item.href === '/work/personal-rag-knowledge-platform/');
    const text = fullText(rag);

    expect(rag).toBeDefined();
    // Erica 2026-11-18：只寫現在怎麼保護，不寫修正前哪裡沒擋。
    expect(text).not.toMatch(/沒有限制|沒有檢查|預設拒絕|白名單|靜默|存取控制問題/);
  });

  it('buildHome 文案不用破折號，也不寫延後公開的內容', () => {
    const text = fullText(buildHome(factsA, fullSite));

    expect(text).not.toMatch(/[—─]|--/);
    expect(text).not.toContain('我們');
    expect(text).not.toMatch(/打造|賦能|不只是/);
    // 回應時間百分比與平行連線數還沒進事實檔，首頁不寫。
    expect(text).not.toMatch(/\d\s*%|％|平行連線|回應時間/);
  });

  it('buildHome 每段文字不超過 3 句', () => {
    for (const paragraph of collectStrings(buildHome(factsA, fullSite))) {
      const sentences = paragraph.split(/[。！？]/).filter((part) => part.trim() !== '');
      expect(sentences.length, paragraph).toBeLessThanOrEqual(3);
    }
  });
});
