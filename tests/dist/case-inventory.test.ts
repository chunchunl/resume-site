import type * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { getCase } from '../../src/data/cases';
import { FOUR_PART_VERSION_PATTERN, FULL_DATE_PATTERN, LAUNCH_DATE_PATTERN } from '../../src/data/cases/test-utils';
import { facts } from '../../src/data/facts';
import { formatNumber } from '../../src/lib/format';
import { expectCaseStructure, type FaqEntity, loadCasePage, mainTextWithFaq, onlyJsonLd } from './case-page';
import { normalizeText } from './helpers';

const SLUG = 'inventory-system-planning';

/** 公開測試只寫通用樣式；內部名稱本身由本機拒絕清單擋。 */
const MONEY_PATTERN = /\d[\d,]*\s*(元|萬)/;
const DAYS_PATTERN = /\d+\s*天/;
const CAMEL_CASE_PATTERN = /[a-z][A-Z]/;
const URL_PATTERN = /https?:\/\//;
const ALLOWED_ACRONYMS = ['ERP', 'API', 'AI'];

/** 規劃流程圖的六個步驟（畫的是工作方法，不是公司的業務流程）。 */
const FLOW_STEPS = ['盤點現況', '分場決策', '規則只寫一份', '流程圖與狀態圖', '介面原型', '交接與驗收'];

/** 業務單據名稱：流程圖不能出現，證明畫的不是公司的單據流程。 */
const DOCUMENT_NAMES = ['訂購單', '出貨單', '進貨單', '付款單'];

/**
 * 要檢查機密樣式的文字：`<main>` 拿掉摘要表後的可見文字，加上 FAQPage 每題的問與答。
 * 摘要表的技術標籤相鄰輸出、中間沒有空白，會誤中駝峰樣式；JSON-LD 本身的鍵與網址也不檢查。
 */
function proseText($: cheerio.CheerioAPI): string {
  const main = $('main').clone();
  main.find('[data-section="case-summary"]').remove();
  const entities = onlyJsonLd($, 'FAQPage').mainEntity as FaqEntity[];
  const faq = entities.flatMap((entity) => [entity.name, entity.acceptedAnswer.text]);
  return [normalizeText(main.text()), ...faq].join('\n');
}

describe('dist 庫存規劃案例頁', () => {
  it('dist 庫存案例結構', () => {
    expectCaseStructure(loadCasePage(SLUG), SLUG, 5);
  });

  it('dist 庫存案例含 facts 值與摘要表', () => {
    const $ = loadCasePage(SLUG);
    const content = getCase('zh-TW', SLUG, facts);
    const summaryText = normalizeText($('main [data-section="case-summary"]').text());
    const text = mainTextWithFaq($);

    expect(text).toContain(`前 ${formatNumber(facts.inventory.alignmentMeetings)} 場`);
    expect(text).toContain(`${formatNumber(facts.inventory.gapItems)} 項落差`);
    for (const value of [content?.period, content?.role, content?.maturity, ...(content?.tech ?? [])]) {
      expect(summaryText).toContain(value);
    }
    expect(normalizeText($('main').text())).toContain('程式由其他工程師實作');
    expect(normalizeText($('main [data-section="ai-note"]').text())).toContain(content?.aiNote);
  });

  it('dist 庫存案例不寫機密樣式', () => {
    const $ = loadCasePage(SLUG);
    const text = proseText($);

    for (const pattern of [
      FULL_DATE_PATTERN,
      FOUR_PART_VERSION_PATTERN,
      LAUNCH_DATE_PATTERN,
      MONEY_PATTERN,
      DAYS_PATTERN,
      CAMEL_CASE_PATTERN,
      URL_PATTERN,
    ]) {
      expect(text, `${pattern}`).not.toMatch(pattern);
    }
    for (const acronym of text.match(/[A-Z]{2,}/g) ?? []) {
      expect(ALLOWED_ACRONYMS, `不在白名單的大寫縮寫「${acronym}」`).toContain(acronym);
    }
    for (const claim of ['我開發', '我實作', '唯一開發者']) expect(text).not.toContain(claim);
    // 圖只畫方法：拿掉步驟編號之後，圖裡不能有任何數字。
    const svg = $('main svg').clone();
    svg.find('.diagram__step').remove();
    expect(normalizeText(svg.text())).not.toMatch(/\d/);
  });

  it('dist 庫存流程圖', () => {
    const svgText = normalizeText(loadCasePage(SLUG)('main svg').text());

    for (const step of FLOW_STEPS) expect(svgText).toContain(step);
    expect(svgText).toContain('規則變更');
    for (const name of DOCUMENT_NAMES) expect(svgText).not.toContain(name);
  });
});
