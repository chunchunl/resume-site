import { describe, expect, it } from 'vitest';
import { getCase } from '../../src/data/cases';
import { facts } from '../../src/data/facts';
import { site } from '../../src/data/site';
import { formatNumber, formatRatio } from '../../src/lib/format';
import { expectCaseStructure, loadCasePage, mainTextWithFaq } from './case-page';
import { normalizeText } from './helpers';

const SLUG = 'personal-rag-knowledge-platform';

/** 本站網域，用來找 `www` 以外的子網域。 */
const siteHost = new URL(site.url).hostname.replace(/^www\./, '');
const escapedHost = siteHost.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const OTHER_SUBDOMAIN_PATTERN = new RegExp(String.raw`(?<![\w-])(?!www\.)[a-z0-9-]+(?:\.[a-z0-9-]+)*\.${escapedHost}`, 'i');

describe('dist RAG 案例頁', () => {
  it('dist RAG 案例結構', () => {
    expectCaseStructure(loadCasePage(SLUG), SLUG, 3);
  });

  it('dist RAG 案例含 facts 值', () => {
    const text = mainTextWithFaq(loadCasePage(SLUG));

    expect(text).toContain(`約 ${formatNumber(facts.rag.indexedChunks)} 個`);
    expect(text).toContain(formatRatio(facts.rag.evalBefore, 'zh-TW'));
    expect(text).toContain(formatRatio(facts.rag.evalAfter, 'zh-TW'));
  });

  it('dist RAG 案例頁不寫存取控制的機制細節', () => {
    // 含資料流圖的 SVG 文字；Erica 2026-11-18：只寫只給本人用，不寫名單、預設拒絕這類機制。
    const html = loadCasePage(SLUG).html();

    expect(html).not.toMatch(/白名單|預設拒絕|名單以外/);
  });

  it('dist RAG 案例不誇大也不露出子網域', () => {
    const text = mainTextWithFaq(loadCasePage(SLUG));

    expect(text).not.toContain('訓練模型');
    expect(text).not.toContain('MLOps');
    expect(text).not.toMatch(OTHER_SUBDOMAIN_PATTERN);
  });

  it('dist RAG 案例摘要表與資料流圖', () => {
    const $ = loadCasePage(SLUG);
    const content = getCase('zh-TW', SLUG, facts);
    const summaryText = normalizeText($('main [data-section="case-summary"]').text());
    const svgText = normalizeText($('main svg').text());

    for (const value of [content?.period, content?.role, content?.maturity, ...(content?.tech ?? [])]) {
      expect(summaryText).toContain(value);
    }
    expect(normalizeText($('main [data-section="ai-note"]').text())).toContain(content?.aiNote);

    // 資料流：來源 → 同步 → 向量索引 → 問答 → 兩個入口，並標出存取控制。
    for (const label of ['筆記', '同步', '向量索引', '問答', 'LINE', '網站', '存取控制']) {
      expect(svgText).toContain(label);
    }
    for (const value of Object.values(facts.rag)) {
      const formatted = typeof value === 'number' ? formatNumber(value) : formatRatio(value, 'zh-TW');
      expect(svgText).not.toContain(formatted);
    }
  });
});
