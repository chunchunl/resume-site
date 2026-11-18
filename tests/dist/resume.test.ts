import { existsSync, readFileSync } from 'node:fs';
import * as cheerio from 'cheerio';
import { extractLinks, extractText, getDocumentProxy, getMeta } from 'unpdf';
import { describe, expect, it } from 'vitest';
import { facts } from '../../src/data/facts';
import { buildResume } from '../../src/data/resume';
import { site } from '../../src/data/site';
import { formatNumber } from '../../src/lib/format';
import { siteFullName } from '../../src/lib/seo';
import { scanText } from '../../scripts/scan-sensitive';
import { distDir, normalizeText, readDist } from './helpers';

const PDF_PATH = 'resume/erica-lin-resume-zh.pdf';
const PDF_HREF = `/${PDF_PATH}`;
const content = buildResume(facts, site);
const PAGE_TITLE = content.title;

/** 讀取並解析求職頁。 */
function loadResumePage(): cheerio.CheerioAPI {
  return cheerio.load(readDist('resume/index.html'));
}

/** 去掉全部空白：中文 PDF 抽出來的字與字之間常有空白或換行。 */
function squash(text: string): string {
  return text.replace(/\s+/g, '');
}

/** 把文字拆成單字後排序，用來比兩邊用到的字是否完全相同。 */
function sortedChars(text: string): string {
  return [...text].sort().join('');
}

/** PDF 的文字層、中繼資料與連結註記。 */
interface PdfContent {
  /** 全部頁面的文字層。 */
  text: string;
  /** 文件資訊（Title、Creator 等）。 */
  info: Record<string, unknown>;
  /** 原始 XMP；沒有時為空字串。 */
  xmp: string;
  /** 連結註記的網址。 */
  links: string[];
}

/** 讀取 dist 裡的 PDF。 */
async function readPdf(): Promise<PdfContent> {
  const pdf = await getDocumentProxy(new Uint8Array(readFileSync(`${distDir}/${PDF_PATH}`)));
  try {
    const { text } = await extractText(pdf, { mergePages: true });
    const { info, metadata } = await getMeta(pdf);
    const { links } = await extractLinks(pdf);
    // 沒有 XMP 時 unpdf 回傳空物件，不是 null。
    const xmp = typeof metadata?.getRaw === 'function' ? String(metadata.getRaw()) : '';
    return { text, info, xmp, links };
  } finally {
    await pdf.loadingTask.destroy();
  }
}

describe('dist 求職頁', () => {
  it('dist 求職頁結構', () => {
    const $ = loadResumePage();
    const sections = $('main [data-section]')
      .toArray()
      .map((element) => $(element).attr('data-section'));
    const download = $('main a[href$=".pdf"]');

    // Erica 2026-11-18：不公開可到職時間，頁面與 PDF 都沒有這個區塊。
    expect(sections).toEqual(['summary', 'experience', 'skills', 'education']);
    expect($('main').text()).not.toMatch(/到職/);
    expect($('h1')).toHaveLength(1);
    expect(download).toHaveLength(1);
    expect(download.attr('href')).toBe(PDF_HREF);
    expect(normalizeText(download.text())).toBe('下載 PDF 履歷');
    expect(existsSync(`${distDir}/${PDF_PATH}`)).toBe(true);
    expect($('head > title').text()).toBe(PAGE_TITLE);
    expect($('a[aria-current="page"]').text().trim()).toBe('求職履歷');

    // 下載連結在專業摘要之前。
    const html = $('main').html() ?? '';
    expect(html.indexOf(PDF_HREF)).toBeLessThan(html.indexOf('data-section="summary"'));
  });

  it('dist 求職頁含 facts 值', () => {
    const text = normalizeText(loadResumePage()('main [data-section="experience"]').text());

    expect(text).toContain(`後端 ${formatNumber(facts.eventPlatform.backendTests)} 項`);
    expect(text).toContain(`前端 ${formatNumber(facts.eventPlatform.frontendTests)} 項`);
    expect(text).toContain(`${formatNumber(facts.eventPlatform.loadTestRequests)} 個請求`);
  });

  it('dist 求職頁聯絡資料', () => {
    const $ = loadResumePage();

    expect($(`main a[href="mailto:${site.contactEmails.jobs}"]`)).toHaveLength(1);
    expect($(`main a[href="mailto:${site.contactEmails.work}"]`)).toHaveLength(0);
    expect($(`main a[href="${site.url}"]`)).toHaveLength(1);
  });

  it('dist PDF 與頁面同步', async () => {
    const $ = loadResumePage();
    const pdfText = squash((await readPdf()).text);
    const expected = [
      $('h1').text(),
      content.jobTitle,
      ...$('main h2')
        .toArray()
        .map((element) => $(element).text()),
      ...content.experience.flatMap((item) => [item.org, item.role, item.period, ...item.points]),
      ...content.education.flatMap((item) => [item.org, item.role, item.period, ...item.points]),
      ...content.skills.flatMap((group) => [group.name, ...group.items]),
      content.summary,
    ];

    // Erica 2026-11-18：PDF 也不公開可到職時間。
    expect(pdfText).not.toMatch(/到職/);
    expect(expected.length).toBeGreaterThan(20);
    for (const part of expected) {
      // 同一段文字在頁面上也要找得到，這條才是在比「頁面」而不只是比內容函式。
      expect(squash($('main').text()), part).toContain(squash(part));
      expect(pdfText, part).toContain(squash(part));
    }

    // 頁面刪掉一段、PDF 沒重產時，PDF 會多出舊內容；所以再比兩邊用到的字是否完全相同。
    // PDF 抽出來的順序可能和頁面不同（例如右側的期間），所以比排序後的字，不比整串。
    const main = $('main').clone();
    main.find('.resume-download').remove();
    expect(sortedChars(pdfText)).toBe(sortedChars(squash(main.text())));
  });

  it('dist PDF 不含禁止內容', async () => {
    const pdf = await readPdf();
    const everything = [pdf.text, JSON.stringify(pdf.info), pdf.xmp, ...pdf.links].join('\n');

    // 手機號碼、個人信箱、磁碟路徑、四段式版本號等，套和 scan:sensitive 同一份規則。
    expect(scanText(everything, PDF_PATH)).toEqual([]);
    expect(everything.toLowerCase()).not.toContain('gmail.com');
    expect(everything).not.toContain(String(site.contactEmails.work));
    expect(pdf.text).toContain(String(site.contactEmails.jobs));
    expect(pdf.text).toContain(new URL(site.url).host);
    expect(pdf.links).toContain(`mailto:${site.contactEmails.jobs}`);
    expect(pdf.info.Title).toBe(PAGE_TITLE);
    expect(pdf.info.Creator).toBe(siteFullName(site));
    expect(pdf.info.Producer).toBe(siteFullName(site));
    for (const key of ['Author', 'Subject', 'Keywords']) expect(pdf.info[key] ?? '', key).toBe('');
  });

  it('dist PDF 文字層沒有部首字', async () => {
    // 字型把「工」與部首「⼯」畫成同一個字形時，PDF 的文字層可能寫成部首，
    // 招募人員搜尋或系統解析「工程師」就找不到。
    const radicals = [...(await readPdf()).text].filter((char) => /[⺀-⿟]/u.test(char));

    expect(radicals.join('')).toBe('');
  });
});
