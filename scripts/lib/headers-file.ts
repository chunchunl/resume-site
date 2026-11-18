/**
 * 解析 Cloudflare 靜態資源的 `_headers` 檔。
 * build 產物測試與 `check:production` 共用這一份，標頭清單只寫在 `public/_headers`。
 */

/**
 * 解析 _headers：沒有縮排的一行是路徑規則，底下縮排的行是那條規則的標頭。
 * 回傳「路徑規則 → （小寫標頭名稱 → 值）」。
 * 同一個路徑規則出現兩次會直接丟錯：不然後面那段會蓋掉前面那段，測試就看不到前面加的標頭。
 * @param content `_headers` 檔的完整內容。
 */
export function parseHeadersFile(content: string): Map<string, Map<string, string>> {
  const blocks = new Map<string, Map<string, string>>();
  let current: Map<string, string> | undefined;

  for (const line of content.split('\n')) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      const rule = line.trim();
      if (blocks.has(rule)) throw new Error(`_headers 的路徑規則重複：${rule}`);
      current = new Map();
      blocks.set(rule, current);
      continue;
    }
    const separator = line.indexOf(':');
    current?.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim());
  }
  return blocks;
}
