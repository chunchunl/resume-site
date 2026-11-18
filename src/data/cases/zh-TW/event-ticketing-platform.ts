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
      '將原本分散於試算表、Email 與紙本名單的活動流程，整合為涵蓋店舖報名、電子票券、手機驗票與即時看板的單一平台。',
    period: '2026-04 至今',
    role: '獨立開發',
    tech: ['React', 'TypeScript', 'MUI', 'Node.js', 'Express', 'SQL Server', 'Socket.IO', 'Azure Web App', 'Jenkins'],
    maturity: '已部署 UAT 與正式環境；正式活動數據待活動結束後補充',
    sections: [
      {
        heading: '此平台解決的問題是什麼？',
        paragraphs: [
          '連鎖健身品牌 Curves 過去舉辦活動時，由總部以 Email 與共用試算表收集報名，再以紙本或人工名單處理報到。',
          '報名、修改、取消、座位、餐食、帳款與報到分散於不同工具，各店舖之間的資料也未區隔。總部難以即時確認哪些店舖已報名、信件是否已寄出，活動當天也只能以人工核對入場。',
        ],
      },
      {
        heading: '使用者如何操作此平台？',
        paragraphs: [
          '店舖從各自的專屬入口報名，截止前可修改或取消，完成後會收到確認信與電子票券。',
          '活動當天，工作人員以手機掃描票券上的 QR Code，入場狀態即時顯示於看板。總部則於後台管理活動、座位、兌換券、帳款與通知，也可代店舖報名或匯出名單。',
        ],
        diagram: 'event-flow',
      },
      {
        heading: '系統如何分層？',
        paragraphs: [
          '店舖前台、總部後台與手機驗票三種入口共用同一套 React 前端與 Node.js API。資料儲存於 SQL Server，通知由 Email 服務寄送，入場狀態透過 Socket.IO 推送至看板。',
          '前端、API 與即時看板由同一個服務提供，部署於 Azure Web App，架構單純、利於部署與問題排查。',
        ],
        diagram: 'event-architecture',
      },
      {
        heading: '負責範圍包含哪些？',
        paragraphs: [
          '此平台由我獨立開發，先將活動人員的作業需求整理為角色、流程與功能，再設計介面、資料模型、API、權限、驗票與通知流程。',
          'React 前端、Node.js 後端、資料庫與即時看板均由我實作，測試、資料庫異動管理、部署與環境驗證流程亦由我建立。',
          '上線前規劃 UAT 情境、判斷修正的優先順序，並與活動、財務及 IT 人員釐清規則與責任邊界。',
        ],
      },
      {
        heading: '最困難之處為何？',
        paragraphs: [
          '單元測試只能確認個別功能正常運作，跨角色、跨信件、跨裝置的完整流程必須實際操作才能確認。我以瀏覽器從邀請信一路操作至掃碼與看板，找出多個單元測試未發現的問題。',
          '例如通知內容與目前活動對不上、畫面切換後顯示了舊資料，這類問題只有完整走一次流程才會出現。每一項都先補上會失敗的測試，修正後再以全新的瀏覽器環境重新驗證。',
          '驗票是另一個重點。掃碼時由後端同時核對活動、訂單與票券狀態，前端不另行撰寫規則，重複、取消或屬於其他活動的票券皆會被擋下。',
        ],
      },
      {
        heading: '如何確認可以上線？',
        paragraphs: [
          `自動測試方面，後端 ${backendTests} 項、前端 ${frontendTests} 項測試通過，lint 0。部署流程會先執行測試，任何一項失敗即停止部署。`,
          `上線前，我以瀏覽器完整操作邀請、報名、修改、取消、重新報名、代辦、報表、驗票與看板，找出並修正 ${e2eIssuesFixed} 個單元測試未發現的跨角色與跨裝置問題。`,
          `我亦於 UAT 環境進行壓力測試，${loadTestRequests} 個請求均無非預期錯誤。活動現場另備紙本報到名單與行動網路備援，避免網路問題導致報到完全中斷。`,
        ],
      },
    ],
    results: [
      '將報名、通知、票券、座位、帳務、驗票與現場統計整合為單一平台',
      '各店舖從各自的專屬入口報名，後台依職責分配功能',
      `後端 ${backendTests} 項、前端 ${frontendTests} 項自動測試通過，lint 0`,
      `上線前修正 ${e2eIssuesFixed} 個單元測試未發現的跨角色問題`,
      `UAT 壓測 ${loadTestRequests} 個請求無非預期錯誤`,
      '已部署 UAT 與正式環境，正式活動的數據將於活動結束後補充',
    ],
    faq: [
      {
        question: '此平台由誰開發？',
        answer:
          '此平台由我獨立開發，從需求整理、介面與資料模型設計，到前後端、資料庫、測試與部署皆由我負責。',
      },
      {
        question: '已有自動測試，為何仍需以瀏覽器操作完整流程？',
        answer: `單元測試只能確認個別功能。我以瀏覽器從邀請信一路操作至驗票與看板，上線前修正 ${e2eIssuesFixed} 個單元測試未發現的跨角色問題。`,
      },
      {
        question: '驗票如何避免同一張票重複入場？',
        answer:
          '掃碼後由後端同時核對活動、訂單與票券狀態。重複、取消、無效或屬於其他活動的票券皆會被拒絕，僅合法的票券會寫入報到紀錄並更新看板。',
      },
      {
        question: '壓力測試的結果為何？',
        answer: `於 UAT 環境送出 ${loadTestRequests} 個請求，均無非預期錯誤。此為測試環境的結果，正式活動的數據將於活動結束後補充。`,
      },
    ],
    aiNote:
      'AI 工具協助部分程式探索、測試操作與問題排查。需求定義、方案取捨、業務規則核對、修正決策與交付品質由我負責。',
  };
}
