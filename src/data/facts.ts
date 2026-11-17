/**
 * 事實單一來源：全站會出現的數字與上線狀態都放在這裡。
 *
 * 規則：
 * - 數字存數值，比例存 `{ passed, total }`；「約」這類字寫在文案，不寫在這裡。
 * - 這個檔是公開的，不存日期與版本號。
 * - 其他原始碼不得寫死這裡的數字，`npm run check:facts` 會檢查。
 */

/** 一組「通過數／總數」。 */
export interface Ratio {
  /** 通過的數量。 */
  passed: number;
  /** 總數。 */
  total: number;
}

/** 獎勵系統的上線狀態：`testing` 測試中、`launched` 已上線。 */
export type RewardSystemStatus = 'testing' | 'launched';

/** 全站事實的形狀。 */
export interface Facts {
  /** 活動報名與驗票平台。 */
  eventPlatform: {
    /** 後端自動測試通過項數。 */
    backendTests: number;
    /** 前端自動測試通過項數。 */
    frontendTests: number;
    /** 測試環境壓力測試的請求數（無非預期錯誤）。 */
    loadTestRequests: number;
    /** 上線前端到端驗證找到並修正的問題數。 */
    e2eIssuesFixed: number;
  };
  /** 會員運動里程碑獎勵系統。 */
  rewardSystem: {
    /** 上線狀態；正式上線後改成 `launched`，各頁文字會一起改。 */
    status: RewardSystemStatus;
  };
  /** 個人 AI 知識平台（RAG）。 */
  rag: {
    /** 索引重建後的段落數（文案寫「約」）。 */
    indexedChunks: number;
    /** 評估題組調整前的結果。 */
    evalBefore: Ratio;
    /** 評估題組調整後的結果。 */
    evalAfter: Ratio;
  };
}

/** 全站事實目前的值。 */
export const facts: Facts = {
  eventPlatform: {
    backendTests: 547,
    frontendTests: 203,
    loadTestRequests: 1144,
    e2eIssuesFixed: 10,
  },
  rewardSystem: {
    status: 'testing',
  },
  rag: {
    indexedChunks: 3700,
    evalBefore: { passed: 14, total: 17 },
    evalAfter: { passed: 18, total: 18 },
  },
};
