import { describe, expect, it } from 'vitest';
import { formatNumber, formatRatio } from './format';

describe('formatNumber', () => {
  it('formatNumber 千分位', () => {
    expect(formatNumber(1144)).toBe('1,144');
    expect(formatNumber(547)).toBe('547');
  });
});

describe('formatRatio', () => {
  it('formatRatio 中文全形斜線', () => {
    expect(formatRatio({ passed: 14, total: 17 }, 'zh-TW')).toBe('14／17');
  });

  it('formatRatio 英文半形斜線', () => {
    expect(formatRatio({ passed: 18, total: 18 }, 'en')).toBe('18/18');
  });
});
