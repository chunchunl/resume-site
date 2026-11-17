/**
 * 案例：活動報名與驗票平台。
 * 數字一律從事實檔取值；不寫內部網址、帳號、權限名單、資料庫結構、驗證機制細節與弱點位置。
 */
import { formatNumber } from '../../../lib/format';
import type { Facts } from '../../facts';
import type { CaseContent } from '../types';

/** 產生活動報名與驗票平台的案例內容。 */
export function buildCase(facts: Facts): CaseContent {
  const { eventPlatform } = facts;
  const backendTests = formatNumber(eventPlatform.backendTests);
  const frontendTests = formatNumber(eventPlatform.frontendTests);
  const loadTestRequests = formatNumber(eventPlatform.loadTestRequests);
  const e2eIssuesFixed = formatNumber(eventPlatform.e2eIssuesFixed);

  return {
    slug: 'event-ticketing-platform',
    lang: 'zh-TW',
    order: 1,
    title: '活動報名與驗票平台',
    summary:
      '把原本散在試算表、Email 與紙本名單的活動流程，整合成店舖報名、電子票券、手機驗票與即時看板的一套平台。',
    period: '2026-04 至今',
    role: '唯一開發者',
    tech: ['React', 'TypeScript', 'MUI', 'Node.js', 'Express', 'SQL Server', 'Socket.IO', 'Azure Web App', 'Jenkins'],
    maturity: '已部署 UAT 與正式環境；正式活動數據待活動結束後補充',
    sections: [
      {
        heading: '這個平台解決什麼問題？',
        paragraphs: [
          '連鎖健身品牌 Curves 過去辦活動，是由總部用 Email 與共用試算表收集報名，再用紙本或人工名單處理報到。',
          '報名、修改、取消、座位、餐食、帳款與報到散在不同工具，店舖之間的資料也沒有區隔。總部很難即時確認哪些店舖已經報名、信件有沒有寄出，活動當天也只能靠人工核對入場。',
        ],
      },
      {
        heading: '使用者怎麼用這個平台？',
        paragraphs: [
          '店舖從自己的專屬入口報名，截止前可以修改或取消，完成後收到確認信與電子票券。',
          '活動當天，工作人員用手機掃描票券上的 QR Code，入場狀態即時出現在看板上。總部則在後台管理活動、座位、兌換券、帳款與通知，也可以代店舖報名或匯出名單。',
        ],
        diagram: 'event-flow',
      },
      {
        heading: '系統怎麼分層？',
        paragraphs: [
          '店舖前台、總部後台與手機驗票三種入口共用同一套 React 前端與 Node.js API。資料存在 SQL Server，通知交給 Email 服務，入場狀態透過 Socket.IO 推到看板。',
          '前端、API 與即時看板由同一個服務提供，部署在 Azure Web App。對一個只有我負責維護的系統來說，這樣部署與排查都比較單純。',
        ],
        diagram: 'event-architecture',
      },
      {
        heading: '我負責哪些部分？',
        paragraphs: [
          '我是這個平台唯一的開發者。我把活動人員的作業需求整理成角色、流程與功能，再設計介面、資料模型、API、權限、驗票與通知流程。',
          'React 前端、Node.js 後端、資料庫與即時看板都由我實作。測試、資料庫異動管理、部署與環境驗證流程也是我建立的。',
          '上線前，我規劃 UAT 情境、判斷修正的優先順序，並和活動、財務與 IT 人員釐清規則與責任邊界。',
        ],
      },
      {
        heading: '最難的地方在哪裡？',
        paragraphs: [
          '單元測試只能確認個別功能能動，跨角色、跨信件、跨裝置的完整流程要實際走過才知道。我用瀏覽器從邀請信一路走到掃碼與看板，找到多個單元測試沒抓到的問題。',
          '例如信件裡的日期與餐食名稱前後不一致、新活動顯示上一場的寄信狀態、後台換頁後預設到錯誤的活動。我逐項先補一個會失敗的測試，修好後再用全新的瀏覽器環境重新驗證。',
          '驗票是另一個重點。掃碼時由後端同時核對活動、訂單與票券狀態，前端不另外寫一份規則，重複、取消或屬於其他活動的票券都會被擋下。',
        ],
      },
      {
        heading: '怎麼確認它可以上線？',
        paragraphs: [
          `自動測試方面，後端 ${backendTests} 項、前端 ${frontendTests} 項測試通過，lint 0。部署流程會先跑測試，任何一項失敗就停止部署。`,
          `上線前，我用瀏覽器完整走過邀請、報名、修改、取消、重新報名、代辦、報表、驗票與看板，找出並修正 ${e2eIssuesFixed} 個單元測試沒抓到的跨角色與跨裝置問題。`,
          `我也在 UAT 環境做壓力測試，${loadTestRequests} 個請求沒有非預期錯誤。活動現場另外保留紙本報到名單與行動網路備援，避免網路問題讓報到完全中斷。`,
        ],
      },
    ],
    results: [
      '把報名、通知、票券、座位、帳務、驗票與現場統計整合成同一個平台',
      '每間店舖從自己的專屬入口報名，後台依職責分配功能',
      `後端 ${backendTests} 項、前端 ${frontendTests} 項自動測試通過，lint 0`,
      `上線前修正 ${e2eIssuesFixed} 個單元測試沒抓到的跨角色問題`,
      `UAT 壓測 ${loadTestRequests} 個請求無非預期錯誤`,
      '已部署 UAT 與正式環境，正式活動的數據會在活動結束後補上',
    ],
    faq: [
      {
        question: '這個平台是誰開發的？',
        answer:
          '我是唯一的開發者，從需求整理、介面與資料模型設計，到前後端、資料庫、測試與部署都由我負責。',
      },
      {
        question: '已經有自動測試了，為什麼還要用瀏覽器走完整流程？',
        answer: `單元測試只能確認個別功能。我用瀏覽器從邀請信一路走到驗票與看板，上線前修正 ${e2eIssuesFixed} 個單元測試沒抓到的跨角色問題。`,
      },
      {
        question: '驗票怎麼避免同一張票重複入場？',
        answer:
          '掃碼後由後端同時核對活動、訂單與票券狀態。重複、取消、無效或屬於其他活動的票券都會被拒絕，只有合法的票券會寫入報到紀錄並更新看板。',
      },
      {
        question: '壓力測試的結果是什麼？',
        answer: `在 UAT 環境送出 ${loadTestRequests} 個請求，沒有非預期錯誤。這是測試環境的結果，正式活動的數據會在活動結束後補上。`,
      },
    ],
    aiNote:
      'AI 工具協助部分程式探索、測試操作與問題排查。需求定義、方案取捨、業務規則核對、修正決策與交付品質由我負責。',
  };
}
