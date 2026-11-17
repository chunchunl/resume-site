import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, PDFName, PDFString, StandardFonts, type PDFPage } from 'pdf-lib';
import { afterAll, describe, expect, it } from 'vitest';
import {
  applyAllowlist,
  isExcluded,
  listTargets,
  listUnscannedBinaries,
  loadLocalDenylist,
  scanFiles,
  scanPdf,
  scanText,
} from './scan-sensitive';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const fixtureDir = 'tests/fixtures/sensitive';
const tempRoot = mkdtempSync(join(tmpdir(), 'scan-sensitive-'));

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

/** 讀取掃描器測試用的虛構內容。 */
function readFixture(name: string): string {
  return readFileSync(new URL(`../${fixtureDir}/${name}`, import.meta.url), 'utf8');
}

/** 掃描一行文字，回傳命中的規則代號。 */
function rulesHit(text: string): string[] {
  return scanText(text, 'sample.txt').map((finding) => finding.rule);
}

describe('scan-sensitive（fixture）', () => {
  it('scan-sensitive 抓到手機號碼', () => {
    const findings = scanText(readFixture('phone.txt'), 'phone.txt');

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'phone.txt', line: 2, rule: 'tw-mobile' });
  });

  it('scan-sensitive 抓到個人信箱與知識庫路徑', () => {
    const findings = scanText(readFixture('email-and-path.txt'), 'email-and-path.txt');

    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.rule).sort()).toEqual(['personal-email', 'vault-path']);
    expect(findings.map((finding) => finding.line).sort()).toEqual([1, 3]);
  });

  it('scan-sensitive 抓到其他子網域', () => {
    const findings = scanText(readFixture('subdomain.txt'), 'subdomain.txt');

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ line: 1, rule: 'other-subdomain' });
  });

  it('scan-sensitive 白名單不誤報', () => {
    expect(scanText(readFixture('allowed.txt'), 'allowed.txt')).toEqual([]);
  });

  it('scan-sensitive 抓到四段式版本號', () => {
    const findings = scanText(readFixture('version.txt'), 'version.txt');

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ line: 1, rule: 'four-part-version' });
  });

  it('scan-sensitive 排除清單生效', () => {
    const excluded = [
      'scripts/scan-sensitive.rules.ts',
      'scripts/scan-sensitive.test.ts',
      `${fixtureDir}/phone.txt`,
      `${fixtureDir}/version.txt`,
    ];

    // 這些檔案確實在整個 repo 的掃描範圍內。
    const targets = listTargets(repoRoot);
    for (const path of excluded) {
      expect(targets).toContain(path);
    }
    // 內容本身會命中規則（對照組），但走檔案掃描時被排除。
    expect(scanText(readFixture('phone.txt'), 'phone.txt')).not.toEqual([]);
    expect(scanFiles(repoRoot, excluded)).toEqual([]);
  });

  it('scan-sensitive 排除清單不會放過其他檔案', () => {
    expect(isExcluded('src/pages/index.astro')).toBe(false);
    expect(isExcluded('dist/index.html')).toBe(false);
    expect(isExcluded('tests/dist/base.test.ts')).toBe(false);
    expect(isExcluded('node_modules/astro/package.json')).toBe(true);
    expect(isExcluded('package-lock.json')).toBe(true);
  });
});

describe('scan-sensitive（各規則）', () => {
  const shouldDetect: [rule: string, text: string][] = [
    ['tw-mobile', '電話 09-1234-5678'],
    ['tw-mobile', '電話 (0912)345-678'],
    ['tw-mobile', '電話 0912.345.678'],
    ['tw-mobile', '電話 +886-9-1234-5678'],
    ['tw-mobile', '電話 +886 (0)912-345-678'],
    ['tw-mobile', '電話 ０９１２３４５６７８'],
    ['personal-email', '來信 someone＠gmail.com'],
    ['other-email', '來信 hr@some-company.com.tw'],
    ['wiki-link', '詳見 [[某一篇筆記]]'],
    ['windows-path', String.raw`放在 C:\Users\someone\notes`],
    ['windows-path', '放在 D:/資料/筆記'],
    ['home-path', '放在 /Users/someone/project/readme'],
    ['home-path', 'file:///home/someone/project/readme'],
    ['cloud-default-host', 'https://my-app.azurewebsites.net/api'],
    ['cloud-default-host', 'https://team.cloudflareaccess.com'],
    ['cloud-default-host', 'https://demo.pages.dev'],
    ['cloud-default-host', 'https://site.azurestaticapps.net'],
    ['cloud-default-host', 'https://acme.sharepoint.com/sites/x'],
    ['private-key', '-----BEGIN RSA PRIVATE KEY-----'],
    ['private-key', '-----BEGIN PGP PRIVATE KEY BLOCK-----'],
    ['service-key', 'AKIAABCDEFGHIJKLMNOP'],
    ['service-key', `ghp_${'a1'.repeat(18)}`],
    ['service-key', 'sk_live_abcdefghij1234567890'],
    ['service-key', `sk-${'a1b2'.repeat(6)}`],
    ['jwt', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghij'],
    ['secret-assignment', 'CLOUDFLARE_API_TOKEN=abcd1234efgh5678ijkl9012mnop3456qrst7890'],
    ['secret-assignment', 'api_token: abcd1234efgh5678ijkl'],
    ['secret-assignment', 'Server=db;Password=Abcd1234Efgh5678;'],
    ['secret-assignment', 'const apiKey = "abcd1234efgh5678ijkl";'],
    ['bearer-token', 'Authorization: Bearer abcd1234efgh5678ijkl9012'],
    ['four-part-version', '主機 10.0.0.1'],
  ];

  it.each(shouldDetect)('%s 抓到：%s', (rule, text) => {
    expect(rulesHit(text)).toContain(rule);
  });

  const shouldNotDetect: [rule: string, text: string][] = [
    ['tw-mobile', '比例 0.0912345678'],
    ['tw-mobile', '期間 2026-09-12 2026-10-01'],
    ['tw-mobile', '編號 1509123456789'],
    ['other-email', '圖片 avatar@2x.png'],
    ['other-email', 'git clone git@github.com:user/repo.git'],
    ['other-email', '範例 someone@example.com'],
    ['wiki-link', 'if [[ -f "$file" ]]; then'],
    ['wiki-link', 'const matrix = [[1, 0, 0]];'],
    ['wiki-link', "new Map([['a', 1]])"],
    ['windows-path', '網址 https://example.org/a'],
    ['home-path', '網址 https://example.org/home/about/'],
    ['service-key', 'class="sk-skeleton-loader-wrapper-large"'],
    ['secret-assignment', 'token: ${{ secrets.CLOUDFLARE_API_TOKEN }}'],
    ['secret-assignment', 'const token = process.env.CLOUDFLARE_API_TOKEN;'],
    ['secret-assignment', 'password: string;'],
    ['four-part-version', '<path d="M12 2a1.25.75.5 0 1 0 2.5.5.5z" />'],
    ['four-part-version', '套件版本 1.2.3'],
  ];

  it.each(shouldNotDetect)('%s 不誤報：%s', (rule, text) => {
    expect(rulesHit(text)).not.toContain(rule);
  });
});

describe('scan-sensitive（檔案層級）', () => {
  it('檔名本身也會被掃', () => {
    writeFileSync(join(tempRoot, '聯絡-0912345678.txt'), '內容沒有問題\n');

    const findings = scanFiles(tempRoot, ['聯絡-0912345678.txt']);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ rule: 'tw-mobile', line: 0 });
  });

  it('UTF-16 文字檔會解碼後再掃', () => {
    const text = '電話 0912-345-678\n';
    writeFileSync(join(tempRoot, 'utf16le.txt'), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]));
    writeFileSync(
      join(tempRoot, 'utf16be.txt'),
      Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(text, 'utf16le').swap16()]),
    );

    expect(scanFiles(tempRoot, ['utf16le.txt']).map((finding) => finding.rule)).toEqual(['tw-mobile']);
    expect(scanFiles(tempRoot, ['utf16be.txt']).map((finding) => finding.rule)).toEqual(['tw-mobile']);
  });

  it('讀不懂的檔案不會無聲通過', () => {
    writeFileSync(join(tempRoot, 'unknown.dat'), Buffer.from([0x41, 0x00, 0x42, 0x00, 0x00, 0x01]));

    const findings = scanFiles(tempRoot, ['unknown.dat']);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'unknown.dat', rule: 'unscannable-file' });
  });

  it('已知的二進位檔只掃檔名，並列在未掃描清單', () => {
    writeFileSync(join(tempRoot, 'photo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00]));

    expect(scanFiles(tempRoot, ['photo.png'])).toEqual([]);
    expect(listUnscannedBinaries(['photo.png', 'src/a.ts', 'tests/fixtures/x.pdf'])).toEqual(['photo.png']);
  });

  it('逐筆允許清單只放行完全相同的那一筆', () => {
    const findings = [
      { file: 'a.md', line: 1, rule: 'vault-path', match: 'key-vault/' },
      { file: 'a.md', line: 2, rule: 'vault-path', match: 'Other_Vault/' },
      { file: 'b.md', line: 1, rule: 'vault-path', match: 'key-vault/' },
    ];

    const remaining = applyAllowlist(findings, [
      { file: 'a.md', rule: 'vault-path', match: 'key-vault/', reason: '公開產品名稱' },
    ]);

    expect(remaining).toEqual([findings[1], findings[2]]);
  });

  it('本機拒絕清單的字串會被抓到（不分大小寫）', () => {
    const findings = scanText('這是 Acme 內部系統的說明', 'a.md', ['acme 內部']);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ rule: 'local-denylist', line: 1 });
    expect(scanText('這是一般說明', 'a.md', ['acme 內部'])).toEqual([]);
  });

  it('本機拒絕清單檔不存在時回傳空清單，存在時讀出字串', () => {
    expect(loadLocalDenylist(join(tempRoot, 'nowhere'))).toEqual([]);

    writeFileSync(join(tempRoot, 'scan-sensitive.local.json'), JSON.stringify(['Acme 內部', '  ', 'Project Falcon']));
    expect(loadLocalDenylist(tempRoot)).toEqual(['Acme 內部', 'Project Falcon']);
  });
});

/**
 * 在暫存資料夾組一份測試用 PDF：一頁、一行文字，另可改中繼資料或加連結註記。
 * 內容全是虛構值；不手寫 PDF、不放進 fixture 資料夾。
 */
async function writePdf(name: string, text: string, customize?: (doc: PDFDocument, page: PDFPage) => void): Promise<void> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 200]);
  page.drawText(text, { x: 20, y: 150, size: 12, font: await doc.embedFont(StandardFonts.Helvetica) });
  customize?.(doc, page);
  writeFileSync(join(tempRoot, name), await doc.save());
}

/** 在頁面上加一個指向 `uri` 的連結註記。 */
function addLink(doc: PDFDocument, page: PDFPage, uri: string): void {
  const annotation = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [20, 140, 200, 165],
    Border: [0, 0, 0],
    A: { Type: 'Action', S: 'URI', URI: PDFString.of(uri) },
  });
  page.node.set(PDFName.of('Annots'), doc.context.obj([doc.context.register(annotation)]));
}

describe('scan-sensitive（PDF）', () => {
  it('scanPdf 讀文字層', async () => {
    await writePdf('text-phone.pdf', 'Call me at 0912-345-678');

    const findings = await scanPdf(tempRoot, 'text-phone.pdf');

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'text-phone.pdf', rule: 'tw-mobile' });
  });

  it('scanPdf 讀中繼資料', async () => {
    await writePdf('meta-author.pdf', 'Hello', (doc) => doc.setAuthor('someone@gmail.com'));

    const findings = await scanPdf(tempRoot, 'meta-author.pdf');

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'meta-author.pdf', rule: 'personal-email' });
  });

  it('scanPdf 讀連結註記', async () => {
    await writePdf('link-mailto.pdf', 'Write to me', (doc, page) => addLink(doc, page, 'mailto:someone@gmail.com'));

    const findings = await scanPdf(tempRoot, 'link-mailto.pdf');

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'link-mailto.pdf', rule: 'personal-email' });
  });

  it('scanPdf 讀不懂的 PDF 會回報', async () => {
    writeFileSync(join(tempRoot, 'not-really.pdf'), '這不是 PDF\n');

    const findings = await scanPdf(tempRoot, 'not-really.pdf');

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'not-really.pdf', rule: 'unscannable-file' });
  });

  it('listUnscannedBinaries 不再列 PDF', () => {
    expect(listUnscannedBinaries(['a.pdf', 'b.png'])).toEqual(['b.png']);
  });

  it('scanFiles 對 PDF 只掃檔名', () => {
    writeFileSync(join(tempRoot, 'binary.pdf'), Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0x01, 0x00]));

    expect(scanFiles(tempRoot, ['binary.pdf'])).toEqual([]);
  });

  it('scanPdf 套用拒絕清單與允許清單', async () => {
    await writePdf('denylist.pdf', 'Notes about Project Falcon');

    const findings = await scanPdf(tempRoot, 'denylist.pdf', ['project falcon']);
    const allowed = await scanPdf(tempRoot, 'denylist.pdf', ['project falcon'], [
      { file: 'denylist.pdf', rule: 'local-denylist', match: 'project falcon', reason: '測試用' },
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'denylist.pdf', rule: 'local-denylist' });
    expect(allowed).toEqual([]);
  });

  it('scanPdf 抓到被換行切開的字串', async () => {
    // PDF 可以在任兩個字之間換行；拒絕清單的字串被切成兩行時也要抓到，而且只算一筆。
    await writePdf('split-line.pdf', 'Notes about Project', (doc, page) => {
      page.drawText('Falcon and more', { x: 20, y: 130, size: 12 });
      void doc;
    });

    const findings = await scanPdf(tempRoot, 'split-line.pdf', ['project falcon']);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ file: 'split-line.pdf', rule: 'local-denylist', line: 1 });
  });

  it('scanPdf 整頁掃描不把相鄰兩行黏在一起', async () => {
    // 本站信箱的下一行是本站網址；兩行黏起來，網域會變成另一個，被誤判成外部信箱。
    await writePdf('two-lines.pdf', 'jobs@lin-yu-chun.com', (doc, page) => {
      page.drawText('lin-yu-chun.com', { x: 20, y: 130, size: 12 });
      void doc;
    });

    expect(await scanPdf(tempRoot, 'two-lines.pdf')).toEqual([]);
  });

  it('scanPdf 讀非網頁協定的連結', async () => {
    await writePdf('link-file.pdf', 'Open the file', (doc, page) =>
      addLink(doc, page, 'file:///C:/Users/someone/secret.txt'),
    );

    const rulesFound = (await scanPdf(tempRoot, 'link-file.pdf')).map((finding) => finding.rule);

    expect(rulesFound).toContain('windows-path');
  });

  it('scanPdf 回報抽不出文字的頁面', async () => {
    await writePdf('blank-page.pdf', 'First page has text', (doc) => {
      doc.addPage([400, 200]);
    });
    const blank = await PDFDocument.create();
    blank.addPage([400, 200]);
    writeFileSync(join(tempRoot, 'all-blank.pdf'), await blank.save());

    const partly = await scanPdf(tempRoot, 'blank-page.pdf');
    const whole = await scanPdf(tempRoot, 'all-blank.pdf');

    expect(partly).toHaveLength(1);
    expect(partly[0]).toMatchObject({ file: 'blank-page.pdf', rule: 'unscannable-file', line: 2 });
    expect(whole).toHaveLength(1);
    expect(whole[0]).toMatchObject({ file: 'all-blank.pdf', rule: 'unscannable-file' });
  });
});
