/**
 * 網站最後更新時間：取 build 當下的時間，固定用台灣時間顯示。
 * 網站只在內容改了之後才部署，所以 build 時間就是上線時間。
 */

/** 最後更新時間的兩種寫法。 */
export interface UpdatedAt {
  /** 頁面顯示用，例 `2026-11-18 17:05`。 */
  text: string;
  /** `<time datetime>` 用的 ISO 8601，固定 `+08:00`。 */
  iso: string;
}

/** 台灣時間的日期與時間各欄位；`hourCycle: 'h23'` 讓午夜是 00 而不是 24。 */
const TAIPEI_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** 把時間轉成台灣時間的顯示寫法與 ISO 寫法（不受執行機器的時區影響）。 */
export function formatUpdatedAt(date: Date): UpdatedAt {
  const parts = Object.fromEntries(TAIPEI_PARTS.formatToParts(date).map((part) => [part.type, part.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}`;
  return { text: `${day} ${time}`, iso: `${day}T${time}:00+08:00` };
}

/** 這次 build 的最後更新時間；模組只載入一次，全站每頁相同。 */
export const buildUpdatedAt: UpdatedAt = formatUpdatedAt(new Date());
