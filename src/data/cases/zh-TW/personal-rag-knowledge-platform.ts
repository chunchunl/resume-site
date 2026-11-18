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
    summary: '自己維護的知識問答助理。我從「AI 回答過時」追到資料同步的問題並修好，也讓它只開放給我自己使用。',
    period: '2026-07 至今',
    role: '個人專案；問題定義、方案取捨、驗收',
    tech: ['Cloudflare Workers AI', 'Vectorize', 'D1', 'R2', 'LINE Messaging API', 'Cloudflare Access'],
    maturity: '個人日常使用中，持續改進',
    sections: [
      {
        heading: '這是什麼樣的平台？',
        paragraphs: [
          '這是我自己用的知識問答助理。個人筆記更新後會自動同步，切成段落建立向量索引；提問時先找出相關段落，再交給語言模型整理成回答。',
          '我可以從 LINE 或網站提問。兩個入口都只開放給我自己，負責同步的自動化程式也有自己的通行憑證。',
        ],
        diagram: 'rag-data-flow',
      },
      {
        heading: 'AI 為什麼會回答過時的內容？',
        paragraphs: [
          '有一段時間，它的回答明顯是舊的。我從「回答過時」往回追，發現自動同步因為兩端設定不一致，已經停了一段時間。',
          '另一個原因是模型不知道今天的日期，也不知道每段資料是什麼時候寫的，所以分不出新舊。',
          `我重新對齊兩端的設定，全量重建${chunks}索引段落，並補上今天與資料的日期資訊。`,
        ],
      },
      {
        heading: '怎麼知道修好了？',
        paragraphs: [
          '我用一組固定的評估題組，比較修正前後的回答。',
          `修正前通過 ${evalBefore}。我調整查無資料時的回答方式之後，通過 ${evalAfter}。`,
        ],
      },
      {
        heading: '怎麼限制只有本人能用？',
        paragraphs: [
          'LINE 入口只回應我自己的帳號，網站要先通過 Cloudflare Access 登入。',
          '設定完成後，我從外部未登入的狀態逐一測試每個入口，確認都被擋下。',
        ],
      },
    ],
    results: [
      `找出同步中斷的原因，重建${chunks}索引段落並補上日期資訊`,
      `固定評估題組由 ${evalBefore}提升到 ${evalAfter}`,
      'LINE 與網站兩個入口都只開放給我自己，網站使用 Cloudflare Access',
      '從外部逐一驗證每個入口的存取控制',
    ],
    faq: [
      {
        question: '這個專案是在做 AI 模型嗎？',
        answer:
          '不是。我用現成的語言模型與 Cloudflare 的服務，處理的是資料怎麼同步、怎麼被找到、查不到時怎麼回答，以及誰可以使用。',
      },
      {
        question: 'AI 回答過時的原因是什麼？',
        answer: `有兩個原因：自動同步因為兩端設定不一致而中斷；模型也不知道今天與資料的日期。我對齊設定、重建${chunks}索引段落，並補上日期資訊。`,
      },
      {
        question: '怎麼判斷修好了？',
        answer: `用一組固定的評估題組比較。修正前通過 ${evalBefore}，調整查無資料時的回答方式之後，通過 ${evalAfter}。`,
      },
      {
        question: '別人可以使用這個平台嗎？',
        answer: '不行。LINE 入口只回應我自己的帳號，網站要通過 Cloudflare Access 登入。',
      },
    ],
    aiNote:
      'AI 協助排查、實作與部署。問題定義、方案取捨與驗收由我負責，包括判斷資料流哪裡出錯、評估題組怎麼設計，以及存取控制怎麼驗證。',
  };
}
