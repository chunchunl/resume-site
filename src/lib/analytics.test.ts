import { describe, expect, it } from 'vitest';
import { site } from '../data/site';
import { buildAnalyticsBeacon } from './analytics';

describe('buildAnalyticsBeacon', () => {
  it('buildAnalyticsBeacon 沒有 token 不輸出', () => {
    expect(buildAnalyticsBeacon({ ...site, analyticsToken: null })).toBeNull();
  });

  it('buildAnalyticsBeacon 輸出腳本設定', () => {
    const beacon = buildAnalyticsBeacon({ ...site, analyticsToken: 'abc123' });

    expect(beacon?.src).toBe('https://static.cloudflareinsights.com/beacon.min.js');
    expect(JSON.parse(beacon?.dataCfBeacon ?? '')).toEqual({ token: 'abc123' });
  });

  it('buildAnalyticsBeacon 空字串視同沒有 token', () => {
    expect(buildAnalyticsBeacon({ ...site, analyticsToken: '' })).toBeNull();
  });

  it('buildAnalyticsBeacon 只有空白視同沒有 token', () => {
    // 與 check:content 的判斷一致：只有空白的值算沒填。
    expect(buildAnalyticsBeacon({ ...site, analyticsToken: '  ' })).toBeNull();
  });
});
