/**
 * 敏感內容掃描的規則、白名單與排除清單。
 *
 * 這個檔是公開的，所以只寫通用樣式，不寫任何真實的內部名稱、網址或代號。
 * 真實的名稱放在不進版控的本機拒絕清單（見 `LOCAL_DENYLIST_FILE`）。
 * 這個檔本身列在排除清單，因為規則的寫法與範例會命中自己。
 */

/** 本站網域；這個網域的信箱與 `www` 子網域可以公開。 */
export const OWN_DOMAIN = 'lin-yu-chun.com';

/** 本站網域允許公開的子網域。 */
export const ALLOWED_SUBDOMAINS: readonly string[] = ['www'];

/**
 * 本機拒絕清單的檔名（放在專案根目錄，不進版控）。
 * 內容是一個字串陣列，例如公司名稱、內部系統名稱、專案代號；掃描時不分大小寫比對。
 */
export const LOCAL_DENYLIST_FILE = 'scan-sensitive.local.json';

/** 一條掃描規則。 */
export interface Rule {
  /** 規則代號，回報時顯示。 */
  id: string;
  /** 這條規則在找什麼。 */
  description: string;
  /** 比對樣式，必須帶 `g` 旗標。 */
  pattern: RegExp;
  /** 回傳 `false` 表示這筆命中可以公開，不回報；沒寫就是全部回報。 */
  shouldReport?: (match: RegExpMatchArray) => boolean;
  /** 比對前先遮掉的片段（必須帶 `g` 旗標），用來避開已知會誤判的資料。 */
  mask?: RegExp;
}

/** 逐筆放行的掃描結果：檔案、規則與命中文字都相同才放行。 */
export interface AllowedFinding {
  /** 相對於專案根目錄的檔案路徑。 */
  file: string;
  /** 規則代號。 */
  rule: string;
  /** 命中的文字，必須完全相同。 */
  match: string;
  /** 為什麼這一筆可以公開。 */
  reason: string;
}

/**
 * 逐筆允許清單。規則誤判時，把那一筆加在這裡並寫明理由，
 * 不要把整個檔案加進排除清單。
 */
export const ALLOWED_FINDINGS: readonly AllowedFinding[] = [
  {
    file: 'scripts/build-pdf.ts',
    rule: 'four-part-version',
    match: '127.0.0.1',
    reason: '產生 PDF 時在本機起的靜態服務只綁回送位址；不是版本號，也不是對外主機。',
  },
  ...['public/_headers', 'dist/_headers', 'tests/dist/base.test.ts'].map((file) => ({
    file,
    rule: 'cloud-default-host',
    match: 'subdomain.workers.dev',
    reason: '預覽網址不收錄的 _headers 規則用 Cloudflare 官方文件的萬用寫法（:subdomain 是佔位符），不是實際的預覽網址。',
  })),
];

/** 不掃描的檔案（完整相對路徑）。 */
export const EXCLUDED_FILES: readonly string[] = [
  'scripts/scan-sensitive.rules.ts',
  'scripts/scan-sensitive.test.ts',
  'package-lock.json',
];

/** 不掃描的資料夾（相對路徑開頭）。 */
export const EXCLUDED_DIRECTORIES: readonly string[] = ['tests/fixtures/', 'node_modules/', '.git/', '.astro/'];

/**
 * 內容無法當文字掃描的副檔名。這些檔案只掃檔名，並在執行結果列出來提醒人工確認。
 * 不在這份清單、內容又讀不懂的檔案會直接回報，不會無聲通過。
 */
export const BINARY_EXTENSIONS: readonly string[] = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.zip',
];

/**
 * PDF 的副檔名。PDF 不算在上面的二進位清單：同步的檔案掃描對它只掃檔名，
 * 內容（文字層、中繼資料、連結註記）由非同步的 `scanPdf` 另外掃。
 */
export const PDF_EXTENSION = '.pdf';

const EMAIL_PATTERN = /([A-Za-z0-9._%+-]+)@((?:[A-Za-z0-9-]+\.)+([A-Za-z]{2,}))/g;

/** 常見的個人信箱服務。 */
const PERSONAL_EMAIL_DOMAIN =
  /^(?:gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|mac|proton|protonmail|pchome|qq|163|126)\.[a-z.]+$|(?:^|\.)hinet\.net$/;

/** 文件範例專用的保留網域，不是真實信箱。 */
const DOCUMENTATION_DOMAIN = /^example\.(?:com|org|net)$/;

/** 看起來像信箱、其實是圖檔名稱的結尾（例如兩倍解析度的圖）。 */
const IMAGE_EXTENSION = /^(?:png|jpe?g|gif|webp|avif|svg)$/i;

/** 取出信箱命中的網域（小寫）。 */
function emailDomain(match: RegExpMatchArray): string {
  return (match[2] ?? '').toLowerCase();
}

/** 判斷信箱樣式的命中其實不是信箱（圖檔名稱、git 的 SSH 位址）。 */
function isNotAnEmail(match: RegExpMatchArray): boolean {
  if (IMAGE_EXTENSION.test(match[3] ?? '')) return true;
  const next = match.input?.[(match.index ?? 0) + match[0].length];
  return match[1] === 'git' && next === ':';
}

/** 雲端平台預設給的主機名稱結尾。 */
const CLOUD_DEFAULT_HOST_SUFFIXES = [
  'azurewebsites.net',
  'azurestaticapps.net',
  'azurefd.net',
  'azureedge.net',
  'azurecontainerapps.io',
  'cloudapp.azure.com',
  'azure-api.net',
  'database.windows.net',
  'core.windows.net',
  'sharepoint.com',
  'onmicrosoft.com',
  'cloudflareaccess.com',
  'workers.dev',
  'pages.dev',
  'r2.dev',
  'trycloudflare.com',
  'vercel.app',
  'netlify.app',
  'herokuapp.com',
  'onrender.com',
  'fly.dev',
  'railway.app',
  'supabase.co',
  'web.app',
  'firebaseapp.com',
  'run.app',
  'appspot.com',
  'amazonaws.com',
  'cloudfront.net',
  'ngrok.io',
  'ngrok.app',
  'ngrok-free.app',
  'ngrok-free.dev',
];

/** 把網域裡的點跳脫成正規表示式的字面點。 */
const escapeDots = (text: string): string => text.replaceAll('.', String.raw`\.`);

// 手機號碼數字之間可能出現的分隔：空白、括號、點、斜線、各種連字號，最多兩個。
const PHONE_GAP = String.raw`[\s().\/\-‐-―]{0,2}`;

// 金鑰類的值：不含空白、引號、逗號、分號，至少 12 個字，而且同時有英文字母與數字。
// 開頭不是 $、<、{，才不會把「引用環境變數」或範例佔位符當成真的值。
const SECRET_VALUE = String.raw`(?![$<{])(?=[^\s"',;]*\d)(?=[^\s"',;]*[A-Za-z])[^\s"',;]{12,}`;

/** 全部掃描規則。掃描前每一行會先做 NFKC 正規化，所以全形數字與符號也比對得到。 */
export const rules: readonly Rule[] = [
  {
    id: 'tw-mobile',
    description: '台灣手機號碼（含國碼與各種分隔寫法）',
    pattern: new RegExp(
      String.raw`(?<![\d.])(?<!\d[-\/])(?:(?:\+|00)?886${PHONE_GAP}(?:\(?0\)?)?${PHONE_GAP}9|\(?09)(?:${PHONE_GAP}\d){8}(?!\d)`,
      'g',
    ),
  },
  {
    id: 'personal-email',
    description: '常見個人信箱服務的位址',
    pattern: EMAIL_PATTERN,
    shouldReport: (match) => PERSONAL_EMAIL_DOMAIN.test(emailDomain(match)),
  },
  {
    id: 'other-email',
    description: '本站網域以外的信箱位址（例如公司信箱）',
    pattern: EMAIL_PATTERN,
    shouldReport: (match) => {
      const domain = emailDomain(match);
      if (domain === OWN_DOMAIN || PERSONAL_EMAIL_DOMAIN.test(domain) || DOCUMENTATION_DOMAIN.test(domain)) return false;
      return !isNotAnEmail(match);
    },
  },
  {
    id: 'vault-path',
    description: '路徑中含 vault 的資料夾名稱',
    pattern: /[\w.-]*vault[\w.-]*[\\/]|[\\/][\w.-]*vault[\w.-]*/gi,
  },
  {
    id: 'wiki-link',
    description: '雙方括號的筆記連結',
    // 開頭是空白、數字或引號的多半是程式碼（shell 條件式、巢狀陣列），不算。
    pattern: /\[\[(?![\s\d'"`])[^[\]\n'"`]+\]\]/g,
  },
  {
    id: 'windows-path',
    description: 'Windows 磁碟路徑',
    pattern: /(?<![A-Za-z0-9])[A-Za-z]:\\|(?<![A-Za-z0-9])[A-Z]:\/(?!\/)/g,
  },
  {
    id: 'home-path',
    description: '本機使用者資料夾路徑',
    // 前面緊鄰網域字元的是網址路徑，不算。
    pattern: /(?<![A-Za-z0-9.-])\/(?:Users|home)\/[A-Za-z0-9._-]+\//g,
  },
  {
    id: 'cloud-default-host',
    description: '雲端平台預設主機名稱',
    pattern: new RegExp(String.raw`[A-Za-z0-9-]+\.(?:${CLOUD_DEFAULT_HOST_SUFFIXES.map(escapeDots).join('|')})(?![A-Za-z0-9-])`, 'gi'),
  },
  {
    id: 'other-subdomain',
    description: '本站網域 www 以外的子網域',
    pattern: new RegExp(String.raw`((?:[A-Za-z0-9_-]+\.)+)${escapeDots(OWN_DOMAIN)}(?![A-Za-z0-9-])`, 'gi'),
    shouldReport: (match) => !ALLOWED_SUBDOMAINS.some((name) => (match[1] ?? '').toLowerCase() === `${name}.`),
  },
  {
    id: 'private-key',
    description: '私鑰檔頭',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY(?: BLOCK)?-----/g,
  },
  {
    id: 'service-key',
    description: '常見服務的金鑰格式',
    pattern: new RegExp(
      [
        String.raw`A[KS]IA[0-9A-Z]{16}`,
        String.raw`gh[pousr]_[A-Za-z0-9]{30,}`,
        String.raw`github_pat_[A-Za-z0-9_]{20,}`,
        String.raw`npm_[A-Za-z0-9]{30,}`,
        String.raw`(?<![A-Za-z0-9-])sk-(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{20,}`,
        String.raw`[sr]k_(?:live|test)_[A-Za-z0-9]{10,}`,
        String.raw`AIza[0-9A-Za-z_-]{35}`,
        String.raw`GOCSPX-[A-Za-z0-9_-]{20,}`,
        String.raw`SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}`,
        String.raw`xox[abprs]-[A-Za-z0-9-]{10,}`,
        String.raw`hooks\.slack\.com\/services\/[A-Za-z0-9\/]+`,
      ].join('|'),
      'g',
    ),
  },
  {
    id: 'jwt',
    description: 'JWT 形狀的權杖',
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g,
  },
  {
    id: 'secret-assignment',
    description: '把一串值指定給 key、secret、token、password 這類名稱的寫法（有沒有引號都算）',
    pattern: new RegExp(
      String.raw`(?:api[_-]?key|api[_-]?token|access[_-]?key|account[_-]?key|secret|token|passwd|password|pwd|credential)[A-Za-z0-9_]*["']?\s*[:=]\s*["']?${SECRET_VALUE}`,
      'gi',
    ),
  },
  {
    id: 'bearer-token',
    description: 'Authorization 標頭的 Bearer 權杖',
    pattern: new RegExp(String.raw`Bearer\s+${SECRET_VALUE}`, 'g'),
  },
  {
    id: 'four-part-version',
    description: '四段式版本號（也會命中 IP 位址）',
    pattern: /(?<![\d.])\d+\.\d+\.\d+\.\d+(?![\d.])/g,
    // SVG 的座標資料壓縮後會出現連續的小數點，不是版本號。
    mask: /\b(?:d|points|viewBox|transform)="[^"]*"/g,
  },
];
