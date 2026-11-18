import { describe, expect, it } from 'vitest';
import { collectStrings, writingRuleViolations } from './cases/test-utils';
import { buildPrivacy } from './privacy';
import { site, type Site } from './site';

/** 來信保存原則（Erica 同意的寫法，刻意寫在測試裡，不讀實作常數）。 */
const RETENTION_SENTENCE =
  '洽詢結束、不再需要聯絡時，我會刪除信件；成立合作的往來信件，依合約與報稅需要保存。';

/** 境外處理說明（Erica 同意的寫法，刻意寫在測試裡，不讀實作常數）。 */
const CROSS_BORDER_SENTENCE = '流量統計與信件轉寄由 Cloudflare 提供，相關資料可能在台灣以外的地區處理。';

/** 接案信箱還沒定案的假身分資料。 */
const siteWithoutWorkEmail: Site = { ...site, contactEmails: { ...site.contactEmails, work: null } };

describe('buildPrivacy', () => {
  it('buildPrivacy 必要說明', () => {
    const content = buildPrivacy(site);
    const text = collectStrings(content).join('\n');

    for (const word of ['cookie', 'Cloudflare Web Analytics', '刪除']) expect(text, word).toContain(word);
    expect(content.emails.map((email) => email.address)).toEqual([site.contactEmails.work, site.contactEmails.jobs]);
    expect(buildPrivacy(siteWithoutWorkEmail).emails.map((email) => email.address)).toEqual([site.contactEmails.jobs]);
  });

  it('buildPrivacy 涵蓋 spec 的四項說明', () => {
    const text = collectStrings(buildPrivacy(site)).join('\n');

    // 不用 cookie、沒有其他追蹤碼、來信只用於回覆該次洽詢、信件經 Cloudflare 轉寄。
    expect(text).toMatch(/不使用 cookie/);
    expect(text).toContain('追蹤碼');
    expect(text).toContain('只用於回覆');
    expect(text).toMatch(/Cloudflare.*轉寄/);
  });

  it('buildPrivacy 不做超出事實的承諾', () => {
    const content = buildPrivacy(site);
    const text = collectStrings(content).join('\n');

    // 開頭只說明範圍，不宣稱列出網站收到的全部資料（請求本來就會經過 Cloudflare）。
    expect(content.intro).not.toContain('哪些資料');
    // 「其他追蹤碼」要先講明是流量統計以外的；Cloudflare 的做法以它自己的說明為準。
    expect(text).toContain('除了下面的流量統計');
    expect(text).toContain('依 Cloudflare 的說明');
    expect(text).not.toContain('也不追蹤個別訪客');
  });

  it('buildPrivacy 寫明來信保存原則', () => {
    const text = collectStrings(buildPrivacy(site)).join('\n');

    // 上線前個資初審補件，Erica 同意的原文；改寫法要先問 Erica（這是對來信者的承諾）。
    expect(text).toContain(RETENTION_SENTENCE);
    // 來信者要求刪除的方法不能悄悄消失（標題與保存原則都含「刪除」，只查這兩個字擋不住）。
    expect(text).toContain('如果想刪除寄給我的信件，請寫信到同一個信箱告訴我。');
    // 只寫保存原則，不承諾固定天數；阿拉伯數字與國字數字都算。
    expect(text).not.toMatch(/[\d一二三四五六七八九十百兩半]+\s*(?:天|日|週|個月|月|年)/);
  });

  it('buildPrivacy 說明資料可能在境外處理', () => {
    const text = collectStrings(buildPrivacy(site)).join('\n');

    // 上線前個資初審補件，Erica 同意的原文：流量統計與信件轉寄都由 Cloudflare 處理。
    expect(text).toContain(CROSS_BORDER_SENTENCE);
  });

  it('buildPrivacy 標題與文案規則', () => {
    const content = buildPrivacy(site);

    expect(content.title).toBe('隱私說明｜林昱均 Erica Lin');
    expect(writingRuleViolations(collectStrings(content))).toEqual([]);
  });
});
