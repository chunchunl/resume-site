import type { Ratio } from '../data/facts';

/** 網站支援的語系。 */
export type Locale = 'zh-TW' | 'en';

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/**
 * 把數字加上千分位。
 * @example formatNumber(1234567) // '1,234,567'
 */
export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/**
 * 把比例寫成「通過數／總數」。中文用全形斜線，英文用半形斜線。
 * @example formatRatio({ passed: 3, total: 4 }, 'zh-TW') // '3／4'
 */
export function formatRatio(ratio: Ratio, locale: Locale): string {
  const slash = locale === 'zh-TW' ? '／' : '/';
  return `${formatNumber(ratio.passed)}${slash}${formatNumber(ratio.total)}`;
}
