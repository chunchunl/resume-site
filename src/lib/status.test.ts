import { describe, expect, it } from 'vitest';
import { rewardStatusLabel } from './status';

describe('rewardStatusLabel', () => {
  it('rewardStatusLabel 兩種狀態', () => {
    expect(rewardStatusLabel('testing', 'zh-TW')).toBe('核心功能完成，測試中');
    expect(rewardStatusLabel('launched', 'zh-TW')).toBe('已上線');
  });

  it('rewardStatusLabel 測試中的文字不含「已上線」', () => {
    expect(rewardStatusLabel('testing', 'zh-TW')).not.toContain('已上線');
    expect(rewardStatusLabel('testing', 'en').toLowerCase()).not.toContain('launched');
  });

  it('rewardStatusLabel 英文也有兩種狀態', () => {
    expect(rewardStatusLabel('testing', 'en')).toBe('Core features complete, in testing');
    expect(rewardStatusLabel('launched', 'en')).toBe('Launched');
  });
});
