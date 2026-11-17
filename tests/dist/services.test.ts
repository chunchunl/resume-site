import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { buildServices, formatServicePrice } from '../../src/data/services';
import { site } from '../../src/data/site';
import { siteFullName } from '../../src/lib/seo';
import { parseJsonLd, type FaqEntity } from './case-page';
import { normalizeText, readDist } from './helpers';

const content = buildServices(site);
const serviceIds = content.services.map((service) => service.id);

/** 讀取並解析接案頁。 */
function loadServicesPage(): cheerio.CheerioAPI {
  return cheerio.load(readDist('services/index.html'));
}

describe('dist 接案頁', () => {
  it('dist 接案頁四項服務與價格', () => {
    const $ = loadServicesPage();
    const cards = $('main [data-section]')
      .toArray()
      .filter((element) => serviceIds.includes($(element).attr('data-section') ?? ''));

    expect(cards.map((element) => $(element).attr('data-section'))).toEqual(serviceIds);
    for (const [index, element] of cards.entries()) {
      const service = content.services[index];
      const text = normalizeText($(element).text());
      expect(text).toContain(service?.name);
      expect(text).toContain(formatServicePrice(service!));
    }
  });

  it('dist 接案頁 JSON-LD 與可見價格一致', () => {
    const $ = loadServicesPage();
    const blocks = parseJsonLd($);
    const services = blocks.filter((block) => block['@type'] === 'Service');
    const faqPages = blocks.filter((block) => block['@type'] === 'FAQPage');

    expect(services).toHaveLength(4);
    for (const [index, block] of services.entries()) {
      const service = content.services[index]!;
      const offers = block.offers as { priceSpecification: { minPrice: number; priceCurrency: string } };
      expect(block.name).toBe(service.name);
      expect(offers.priceSpecification.minPrice).toBe(service.priceFrom);
      expect(offers.priceSpecification.priceCurrency).toBe('TWD');
      const card = normalizeText($(`main [data-section="${service.id}"]`).text());
      expect(card).toContain(service.name);
      expect(card).toContain(formatServicePrice(service));
      if (service.priceUnit !== null) {
        expect((offers.priceSpecification as unknown as { unitText: string }).unitText).toBe(service.priceUnit);
      }
    }

    expect(faqPages).toHaveLength(1);
    const mainText = normalizeText($('main').text());
    for (const entity of (faqPages[0]?.mainEntity ?? []) as FaqEntity[]) {
      expect(mainText).toContain(entity.name);
      expect(mainText).toContain(entity.acceptedAnswer.text);
    }
  });

  it('dist 接案頁行動呼籲', () => {
    const $ = loadServicesPage();

    expect($(`main a[href="mailto:${site.contactEmails.work}"]`)).toHaveLength(1);
    const contact = normalizeText($('main [data-section="contact"]').text());
    expect(contact).toContain(content.contact.title);
    expect(contact).toContain(content.contact.description);
  });

  it('dist 接案頁 title 與導覽', () => {
    const $ = loadServicesPage();

    expect($('head > title').text()).toBe(`接案服務｜${siteFullName(site)}`);
    expect($('a[aria-current="page"]').text().trim()).toBe('接案服務');
    expect($('link[rel="canonical"]').attr('href')).toBe('https://lin-yu-chun.com/services/');
  });

  it('dist 接案頁相關案例與合作規則', () => {
    const $ = loadServicesPage();
    const related = $('main [data-section="related-cases"]');
    const rules = normalizeText($('main [data-section="rules"]').text());

    expect(related.find('a').toArray().map((element) => $(element).attr('href'))).toEqual(
      content.relatedCases.map((item) => item.href),
    );
    for (const item of content.relatedCases) expect(normalizeText(related.text())).toContain(item.context);
    for (const rule of content.rules) expect(rules).toContain(rule);
  });
});
