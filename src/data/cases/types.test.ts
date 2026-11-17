import { describe, expect, it } from 'vitest';
import { validateCase, type CaseContent } from './types';

/** 一份欄位齊全、可以通過驗證的假案例。 */
function validCase(): CaseContent {
  return {
    slug: 'sample-case',
    lang: 'zh-TW',
    order: 1,
    title: '範例案例',
    summary: '一句話摘要。',
    period: '某段期間',
    role: '某個角色',
    tech: ['React'],
    maturity: '某種成熟度',
    sections: [
      { heading: '第一個問題？', paragraphs: ['第一段。'] },
      { heading: '第二個問題？', paragraphs: ['第二段。'], diagram: 'event-flow' },
    ],
    results: ['一個結果'],
    faq: [
      { question: '問題一？', answer: '答案一。' },
      { question: '問題二？', answer: '答案二。' },
      { question: '問題三？', answer: '答案三。' },
    ],
    aiNote: 'AI 協作說明。',
  };
}

describe('validateCase', () => {
  it('validateCase 欄位齊全時沒有錯誤', () => {
    expect(validateCase(validCase())).toEqual([]);
  });

  it('validateCase 缺欄位', () => {
    const withoutRole: Partial<CaseContent> = validCase();
    delete withoutRole.role;
    expect(validateCase(withoutRole).join('\n')).toContain('role');

    const twoFaq = { ...validCase(), faq: validCase().faq.slice(0, 2) };
    expect(validateCase(twoFaq).join('\n')).toContain('faq');
  });

  it('validateCase 空字串與空陣列也算缺', () => {
    const errors = validateCase({ ...validCase(), title: '  ', tech: [], results: [], sections: [] }).join('\n');

    for (const field of ['title', 'tech', 'results', 'sections']) expect(errors).toContain(field);
  });

  it('validateCase 段落標題或內容空白時回報', () => {
    const errors = validateCase({ ...validCase(), sections: [{ heading: '', paragraphs: [] }] }).join('\n');

    expect(errors).toContain('sections[0].heading');
    expect(errors).toContain('sections[0].paragraphs');
  });

  it('validateCase FAQ 答案必須是單段純文字', () => {
    const faq = [...validCase().faq];
    faq[0] = { question: '問題一？', answer: '第一行\n第二行' };
    faq[1] = { question: '問題二？', answer: '含 <b>標記</b>' };

    const errors = validateCase({ ...validCase(), faq }).join('\n');
    expect(errors).toContain('faq[0].answer');
    expect(errors).toContain('faq[1].answer');
  });

  it('validateCase 不認得的圖代號會回報', () => {
    const sections = [{ heading: '問題？', paragraphs: ['段落。'], diagram: 'unknown-diagram' }];

    expect(validateCase({ ...validCase(), sections }).join('\n')).toContain('sections[0].diagram');
  });

  it('validateCase slug 只能有小寫英文、數字與連字號', () => {
    for (const slug of ['Has Space', 'a/b', 'UPPER', '中文']) {
      expect(validateCase({ ...validCase(), slug }).join('\n'), slug).toContain('slug');
    }
    expect(validateCase({ ...validCase(), slug: 'ok-slug-2' })).toEqual([]);
  });

  it('validateCase order 必須是數字', () => {
    expect(validateCase({ ...validCase(), order: '1' }).join('\n')).toContain('order');
  });
});
