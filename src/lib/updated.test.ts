import { describe, expect, it } from 'vitest';
import { formatUpdatedAt } from './updated';

describe('formatUpdatedAt', () => {
  it('formatUpdatedAt 用台灣時間', () => {
    expect(formatUpdatedAt(new Date('2026-11-18T09:05:00Z'))).toEqual({
      text: '2026-11-18 17:05',
      iso: '2026-11-18T17:05:00+08:00',
    });
  });

  it('formatUpdatedAt 跨日', () => {
    expect(formatUpdatedAt(new Date('2026-12-31T16:30:00Z'))).toEqual({
      text: '2027-01-01 00:30',
      iso: '2027-01-01T00:30:00+08:00',
    });
  });

  it('formatUpdatedAt 午夜顯示 00 不是 24', () => {
    expect(formatUpdatedAt(new Date('2026-11-18T16:00:00Z')).text).toBe('2026-11-19 00:00');
  });

  it('formatUpdatedAt 不受執行機器的時區影響', () => {
    // 這台開發機本身在台灣時區；換成別的時區再算一次，改成用本機時間的寫法會在這裡失敗。
    const original = process.env.TZ;
    try {
      for (const zone of ['UTC', 'America/Los_Angeles']) {
        process.env.TZ = zone;
        expect(formatUpdatedAt(new Date('2026-11-18T09:05:00Z')).text, zone).toBe('2026-11-18 17:05');
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});
