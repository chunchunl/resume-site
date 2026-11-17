import type { RewardSystemStatus } from '../data/facts';
import type { Locale } from './format';

/** 獎勵系統各狀態在各語系的顯示文字。 */
const REWARD_STATUS_LABELS: Record<Locale, Record<RewardSystemStatus, string>> = {
  'zh-TW': {
    testing: '核心功能完成，測試中',
    launched: '已上線',
  },
  en: {
    testing: 'Core features complete, in testing',
    launched: 'Launched',
  },
};

/**
 * 把獎勵系統的上線狀態轉成頁面上顯示的文字。
 * 全站只從這裡取狀態文字，事實檔改成已上線時各頁會一起改。
 * @example rewardStatusLabel('testing', 'zh-TW') // '核心功能完成，測試中'
 */
export function rewardStatusLabel(status: RewardSystemStatus, locale: Locale): string {
  return REWARD_STATUS_LABELS[locale][status];
}
