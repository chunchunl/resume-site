import { describe, expect, it } from 'vitest';
import { facts } from '../facts';
import { buildHome } from '../home';
import { site } from '../site';
import { buildCaseList, getCase, getCases } from './index';
import type { CaseContent } from './types';

/** 產生一份可以通過驗證的假案例。 */
function sampleCase(slug: string, order: number): CaseContent {
  return {
    slug,
    lang: 'zh-TW',
    order,
    title: `案例 ${slug}`,
    summary: '摘要。',
    period: '期間',
    role: '角色',
    tech: ['React'],
    maturity: '成熟度',
    sections: [{ heading: '問題？', paragraphs: ['段落。'] }],
    results: ['結果'],
    faq: [
      { question: '一？', answer: '一。' },
      { question: '二？', answer: '二。' },
      { question: '三？', answer: '三。' },
    ],
    aiNote: '說明。',
  };
}

describe('案例清單', () => {
  it('getCases 依 order 回傳全部案例', () => {
    const cases = getCases('zh-TW', facts);

    expect(cases.length).toBeGreaterThan(0);
    expect(cases.map((item) => item.slug)).toContain('event-ticketing-platform');
    expect(cases.map((item) => item.order)).toEqual([...cases.map((item) => item.order)].sort((a, b) => a - b));
    for (const item of cases) expect(item.lang).toBe('zh-TW');
  });

  it('getCases 順序', () => {
    const slugs = getCases('zh-TW', facts).map((item) => item.slug);
    const homeHrefs = buildHome(facts, site).cases.map((item) => item.href);

    expect(slugs).toEqual(['event-ticketing-platform', 'member-milestone-rewards', 'personal-rag-knowledge-platform']);
    // 和首頁三張代表作卡片的連結一一對應。
    expect(slugs.map((slug) => `/work/${slug}/`)).toEqual(homeHrefs);
  });

  it('getCase 用 slug 取得單一案例', () => {
    expect(getCase('zh-TW', 'event-ticketing-platform', facts)?.title).toBe('活動報名與驗票平台');
    expect(getCase('zh-TW', 'no-such-case', facts)).toBeUndefined();
  });

  it('buildCaseList 依 order 排序', () => {
    const cases = buildCaseList([() => sampleCase('b', 2), () => sampleCase('a', 1)], facts);

    expect(cases.map((item) => item.slug)).toEqual(['a', 'b']);
  });

  it('buildCaseList 遇到驗證錯誤直接丟例外', () => {
    const broken = (): CaseContent => ({ ...sampleCase('broken', 1), faq: [] });

    expect(() => buildCaseList([broken], facts)).toThrow(/broken[\s\S]*faq/);
  });

  it('buildCaseList 語系不符時丟例外', () => {
    const english = (): CaseContent => ({ ...sampleCase('english', 1), lang: 'en' });

    expect(() => buildCaseList([english], facts, 'zh-TW')).toThrow(/english[\s\S]*lang/);
  });

  it('buildCaseList 不允許重複的 slug', () => {
    expect(() => buildCaseList([() => sampleCase('same', 1), () => sampleCase('same', 2)], facts)).toThrow(/same/);
  });
});
