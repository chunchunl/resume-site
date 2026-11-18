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
      ? `目前狀態為「${statusLabel}」，使用數據整理完成後將補充。`
      : `目前狀態為「${statusLabel}」。使用店舖數與獎勵紀錄數須待正式上線後才有，屆時將補充。`;

  return {
    slug: 'member-milestone-rewards',
    lang: 'zh-TW',
    order: 2,
    title: '會員運動里程碑獎勵系統',
    summary: `會員每累積 ${milestone}運動可獲得紀念 T 恤；系統自動追蹤進度、通知會員登記尺寸、產生店舖訂購名單，並處理領取與轉店。`,
    period: '2026-09 至今',
    role: '獨立開發（後端團隊提供架構與 code review 諮詢）',
    tech: ['C#', '.NET', 'SQL Server', 'Stored Procedure', 'Hangfire', 'React'],
    maturity: statusLabel,
    sections: [
      {
        heading: '此系統解決的問題是什麼？',
        paragraphs: [
          `連鎖健身品牌 Curves 的會員每累積 ${milestone}運動，即可獲得一件紀念 T 恤。同一位會員此後每再累積 ${milestone}，可再獲得一件。`,
          '執行上須持續追蹤每位會員的次數、尺寸、訂購、到貨與領取，會員也可能轉至其他店舖。這些資訊需要由一套系統串連，會員與店舖看到的才會是同一份資料。',
        ],
      },
      {
        heading: '會員與店舖如何使用？',
        paragraphs: [
          '會員可於會員網站查看自己的進度。接近里程碑時，系統會提醒會員登記尺寸，達成後也可查看自己的獎勵紀錄。',
          '店舖人員可於後台查看待處理的會員名單、各尺寸件數與狀態，並可篩選、修改尺寸與備註，於會員領取時標記完成。',
        ],
        diagram: 'reward-states',
      },
      {
        heading: '負責範圍包含哪些？',
        paragraphs: [
          '此系統由我獨立開發，工作範圍從需求與規則整理開始，涵蓋資料表、Stored Procedure 與狀態轉換規則。',
          '後端 API、每日與每週的 Hangfire 排程、會員端畫面、店舖端名單與轉店資料處理，亦由我實作。',
          '後端團隊提供架構、資料庫設計與 code review 的諮詢；測試、程式審查、開發環境實測與上線清單由我負責。',
        ],
      },
      {
        heading: '排程重新執行時，如何避免重複？',
        paragraphs: [
          '排程每日與每週自動執行，難免遇到中途失敗而需重新執行的情況。我將「同一位會員的同一個里程碑只會有一筆紀錄」訂為規則，建立前先行確認，因此無論重新執行幾次，結果皆相同。',
          '通知同樣會先確認是否已發送，重新執行不會重複發送。各店舖分開處理，單一店舖出錯不影響其他店舖。',
        ],
      },
      {
        heading: '會員轉店時如何處理？',
        paragraphs: ['會員轉至其他店舖時，新店舖會接手尚未領取的獎勵，會員在新店舖也能完成登記與領取。'],
      },
      {
        heading: '如何驗證系統正確？',
        paragraphs: [
          '開發過程採測試驅動，先撰寫會失敗的測試再實作，每個階段完成後進行程式審查。',
          '於開發環境中，我實際觸發每日與每週排程，逐項確認尺寸登記、狀態轉換、店舖名單、領取與轉店的結果，測試完成後還原測試資料。',
          '由於系統會處理會員資料，上線前也進行了內部的個資與資安初審。',
        ],
      },
    ],
    results: [
      '獨立完成資料模型、狀態轉換規則、API、每日與每週排程，以及會員端與店舖端畫面',
      '建立從資料庫、商業邏輯、API 到會員端與店舖端的完整流程',
      '排程可重新執行而不重複，各店舖的錯誤分開處理，單一店舖出錯不影響其他店舖',
      '尺寸登記、狀態轉換、排程、店舖名單、領取與轉店皆已於開發環境實測',
      `目前狀態：${statusLabel}`,
    ],
    faq: [
      {
        question: '此系統由誰開發？',
        answer:
          '此系統由我獨立開發，負責需求與規則整理、資料庫、後端 API、排程、會員端與店舖端。後端團隊提供架構、資料庫設計與 code review 的諮詢。',
      },
      {
        question: '排程重新執行是否會重複發放獎勵？',
        answer:
          '不會。同一位會員的同一個里程碑只會有一筆紀錄，通知也會先確認是否已發送，因此重新執行的結果與只執行一次相同。',
      },
      {
        question: '會員轉店後，獎勵紀錄是否會遺失？',
        answer: '不會。新店舖會接手尚未領取的獎勵，會員可於新店舖完成登記與領取。',
      },
      {
        question: '此系統的上線狀態為何？',
        answer: launchNote,
      },
    ],
    aiNote:
      'AI 工具協助部分程式探索、測試操作與問題排查。需求與規則整理、資料與狀態設計、方案取捨、驗證方式與交付品質由我負責。',
  };
}
