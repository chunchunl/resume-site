/**
 * 案例：會員運動里程碑獎勵系統。
 * 里程碑次數從事實檔取值，上線狀態文字由 rewardStatusLabel 產生。
 * 測試中不寫預計上線日、版本號與測試時程；不寫內部狀態代碼、門檻天數、截止日規則與資料表名稱；
 * 使用店舖數與紀錄數上線後才有，也不寫。
 */
import { formatNumber } from '../../../lib/format';
import { rewardStatusLabel } from '../../../lib/status';
import type { Facts } from '../../facts';
import type { CaseContent } from '../types';

/** 產生會員運動里程碑獎勵系統的案例內容。 */
export function buildCase(facts: Facts): CaseContent {
  const { rewardSystem } = facts;
  const milestone = `${formatNumber(rewardSystem.milestoneVisits)} 次`;
  const statusLabel = rewardStatusLabel(rewardSystem.status, 'zh-TW');
  const launchNote =
    rewardSystem.status === 'launched'
      ? `目前狀態是「${statusLabel}」，使用數據整理好之後會補上。`
      : `目前狀態是「${statusLabel}」。使用店舖數與獎勵紀錄數要等正式上線後才有，到時再補上。`;

  return {
    slug: 'member-milestone-rewards',
    lang: 'zh-TW',
    order: 2,
    title: '會員運動里程碑獎勵系統',
    summary: `會員每累積 ${milestone}運動可獲得紀念 T 恤；系統自動追蹤進度、通知填尺寸、產生店舖訂購名單，並處理領取與轉店。`,
    period: '2026-09 至今',
    role: '唯一開發者（後端團隊提供架構與 code review 諮詢）',
    tech: ['C#', '.NET', 'SQL Server', 'Stored Procedure', 'Hangfire', 'React'],
    maturity: statusLabel,
    sections: [
      {
        heading: '這個系統解決什麼問題？',
        paragraphs: [
          `連鎖健身品牌 Curves 的會員每累積 ${milestone}運動，就可以獲得一件紀念 T 恤。同一位會員之後每再累積 ${milestone}，會再得到一件。`,
          '要把這件事做好，得持續追蹤每位會員的次數、尺寸、訂購、到貨與領取，會員還可能轉到其他店舖。這些資訊需要一套系統串起來，會員和店舖看到的才會是同一份資料。',
        ],
      },
      {
        heading: '會員和店舖怎麼使用？',
        paragraphs: [
          '會員在會員網站上看得到自己的進度。快達到里程碑時，系統會提醒會員登記尺寸，達成後也可以查看自己的獎勵紀錄。',
          '店舖人員在後台看到待處理的會員名單、各尺寸件數與狀態，可以篩選、修改尺寸與備註，並在會員領取時標記完成。',
        ],
        diagram: 'reward-states',
      },
      {
        heading: '我負責哪些部分？',
        paragraphs: [
          '我是這個系統唯一的開發者，從需求與規則整理開始，做到資料表、Stored Procedure 與狀態轉換規則。',
          '後端 API、每日與每週的 Hangfire 排程、會員端畫面、店舖端名單與轉店資料處理，也都由我實作。',
          '後端團隊提供架構、資料庫設計與 code review 的諮詢；測試、程式審查、開發環境實測與上線清單由我負責。',
        ],
      },
      {
        heading: '排程重跑為什麼不會重複？',
        paragraphs: [
          '排程每天與每週自動執行，總會遇到中途失敗要重跑的情況。我把「同一位會員的同一個里程碑只會有一筆紀錄」當成規則，建立前先確認，所以重跑幾次結果都一樣。',
          '通知也會先確認是否已經發過，重跑不會重複發送。每間店舖分開處理，一間店出錯不影響其他店舖。',
        ],
      },
      {
        heading: '會員轉店時怎麼處理？',
        paragraphs: ['會員轉到其他店舖時，新店舖會接手還沒領取的獎勵，會員在新店舖也能完成登記與領取。'],
      },
      {
        heading: '怎麼驗證它是對的？',
        paragraphs: [
          '開發過程用測試驅動，先寫一個會失敗的測試再實作，每個階段完成後做程式審查。',
          '在開發環境，我實際觸發每日與每週排程，逐項確認尺寸登記、狀態轉換、店舖名單、領取與轉店的結果，測完後把測試資料還原。',
          '因為系統會處理會員資料，上線前也做了內部的個資與資安初審。',
        ],
      },
    ],
    results: [
      '獨立完成資料模型、狀態轉換規則、API、每日與每週排程，以及會員端與店舖端畫面',
      '建立從資料庫、商業邏輯、API 到會員端與店舖端的完整流程',
      '排程可以重跑不重複，各店舖的錯誤分開處理，一間出錯不影響其他店舖',
      '尺寸登記、狀態轉換、排程、店舖名單、領取與轉店都在開發環境實測過',
      `目前狀態：${statusLabel}`,
    ],
    faq: [
      {
        question: '這個系統是誰開發的？',
        answer:
          '我是唯一的開發者，負責需求與規則整理、資料庫、後端 API、排程、會員端與店舖端。後端團隊提供架構、資料庫設計與 code review 的諮詢。',
      },
      {
        question: '排程重跑會不會重複發獎勵？',
        answer:
          '不會。同一位會員的同一個里程碑只會有一筆紀錄，通知也會先確認是否已經發過，所以重跑的結果和只跑一次相同。',
      },
      {
        question: '會員轉店後，獎勵紀錄會不見嗎？',
        answer: '不會。新店舖會接手還沒領取的獎勵，會員可以在新店舖完成登記與領取。',
      },
      {
        question: '這個系統上線了嗎？',
        answer: launchNote,
      },
    ],
    aiNote:
      'AI 工具協助部分程式探索、測試操作與問題排查。需求與規則整理、資料與狀態設計、方案取捨、驗證方式與交付品質由我負責。',
  };
}
