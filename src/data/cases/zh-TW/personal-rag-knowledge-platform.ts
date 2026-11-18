/**
 * 案例：個人 AI 知識平台（RAG）。
 * 數字一律從事實檔取值。不放問答畫面與知識庫內容，不寫子網域、secret 名稱與白名單內容；
 * 這是用現成模型做的應用，不寫成模型訓練、研究或 MLOps。
 */
import { formatNumber, formatRatio } from '../../../lib/format';
import type { Facts } from '../../facts';
import type { CaseContent } from '../types';

/** 產生個人 AI 知識平台的案例內容。 */
export function buildCase(facts: Facts): CaseContent {
  const { rag } = facts;
  const chunks = `約 ${formatNumber(rag.indexedChunks)} 個`;
  const evalBefore = `${formatRatio(rag.evalBefore, 'zh-TW')} 題`;
  const evalAfter = `${formatRatio(rag.evalAfter, 'zh-TW')} 題`;

  return {
    slug: 'personal-rag-knowledge-platform',
    lang: 'zh-TW',
    order: 3,
    title: '個人 AI 知識平台（RAG）',
    summary: '自行維護的知識問答助理。從「AI 回答過時」追查到資料同步問題並完成修正，也將使用權限限定為本人。',
    period: '2026-07 至今',
    role: '個人專案；問題定義、方案取捨、驗收',
    tech: ['Cloudflare Workers AI', 'Vectorize', 'D1', 'R2', 'LINE Messaging API', 'Cloudflare Access'],
    maturity: '個人日常使用中，持續改進',
    sections: [
      {
        heading: '此平台的用途為何？',
        paragraphs: [
          '此平台是供本人使用的知識問答助理。個人筆記更新後會自動同步，切分為段落並建立向量索引；提問時先找出相關段落，再交由語言模型整理成回答。',
          '可透過 LINE 或網站提問，兩個入口均僅限本人使用。負責同步的自動化程式也持有專屬的通行憑證。',
        ],
        diagram: 'rag-data-flow',
      },
      {
        heading: 'AI 為何會回答過時的內容？',
        paragraphs: [
          '有一段時間，平台的回答明顯是舊資料。我從「回答過時」往回追查，發現自動同步因兩端設定不一致，已停止一段時間。',
          '另一個原因是模型不知道當天的日期，也不知道每段資料的撰寫時間，因此無法分辨新舊。',
          `我重新對齊兩端設定，全量重建${chunks}索引段落，並補上當天與資料的日期資訊。`,
        ],
      },
      {
        heading: '如何確認問題已修正？',
        paragraphs: [
          '以一組固定的評估題組比較修正前後的回答。',
          `修正前通過 ${evalBefore}，調整查無資料時的回答方式後，通過 ${evalAfter}。`,
        ],
      },
      {
        heading: '如何限制僅本人可使用？',
        paragraphs: [
          'LINE 入口僅回應本人帳號，網站須先通過 Cloudflare Access 登入。',
          '設定完成後，從外部未登入的狀態逐一測試每個入口，確認皆被擋下。',
        ],
      },
    ],
    results: [
      `找出同步中斷的原因，重建${chunks}索引段落並補上日期資訊`,
      `固定評估題組由 ${evalBefore}提升至 ${evalAfter}`,
      'LINE 與網站兩個入口均僅限本人使用，網站採用 Cloudflare Access',
      '從外部逐一驗證每個入口的存取控制',
    ],
    faq: [
      {
        question: '此專案是否涉及 AI 模型開發？',
        answer:
          '不是。此專案使用現成的語言模型與 Cloudflare 服務，處理的是資料如何同步、如何被檢索、查無資料時如何回答，以及誰可以使用。',
      },
      {
        question: 'AI 回答過時的原因為何？',
        answer: `原因有二：自動同步因兩端設定不一致而中斷；模型也不知道當天與資料的日期。我重新對齊設定、重建${chunks}索引段落，並補上日期資訊。`,
      },
      {
        question: '如何判斷問題已修正？',
        answer: `以一組固定的評估題組比較。修正前通過 ${evalBefore}，調整查無資料時的回答方式後，通過 ${evalAfter}。`,
      },
      {
        question: '其他人是否可以使用此平台？',
        answer: '不可以。LINE 入口僅回應本人帳號，網站須通過 Cloudflare Access 登入。',
      },
    ],
    aiNote:
      'AI 協助排查、實作與部署。問題定義、方案取捨與驗收由我負責，包括判斷資料流的錯誤位置、設計評估題組，以及驗證存取控制的方式。',
  };
}
