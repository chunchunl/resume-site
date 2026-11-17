import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument, PDFName } from 'pdf-lib';
import { afterAll, describe, expect, it } from 'vitest';
import { contentTypeOf, fixCmapRadicals, rewritePdfMetadata, startStaticServer } from './build-pdf';

const tempRoot = mkdtempSync(join(tmpdir(), 'build-pdf-'));

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

/** 組一段 ToUnicode CMap（只放測試需要的部分）。 */
function cmap(bfchar: string[], bfrange: string[] = []): string {
  return [
    'begincmap',
    `${bfchar.length} beginbfchar`,
    ...bfchar,
    'endbfchar',
    `${bfrange.length} beginbfrange`,
    ...bfrange,
    'endbfrange',
    'endcmap',
  ].join('\n');
}

/** 組一份帶有瀏覽器式中繼資料的 PDF（內容全是虛構值）。 */
async function browserLikePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.addPage([200, 200]);
  doc.setTitle('原本的標題');
  doc.setAuthor('someone');
  doc.setSubject('原本的主旨');
  doc.setKeywords(['a', 'b']);
  doc.setCreator('Mozilla/5.0 Example/157');
  doc.setProducer('Skia/PDF m1');
  doc.setCreationDate(new Date(Date.UTC(2020, 0, 2)));
  doc.setModificationDate(new Date(Date.UTC(2020, 0, 3)));
  doc.catalog.set(PDFName.of('Metadata'), doc.context.register(doc.context.stream('<x:xmpmeta/>')));
  return doc.save();
}

describe('build-pdf', () => {
  it('rewritePdfMetadata 改寫中繼資料', async () => {
    const rewritten = await PDFDocument.load(await rewritePdfMetadata(await browserLikePdf(), '新標題', '固定名稱'), {
      updateMetadata: false,
    });

    expect(rewritten.getTitle()).toBe('新標題');
    expect(rewritten.getCreator()).toBe('固定名稱');
    expect(rewritten.getProducer()).toBe('固定名稱');
    expect(rewritten.getAuthor()).toBeUndefined();
    expect(rewritten.getSubject()).toBeUndefined();
    expect(rewritten.getKeywords()).toBeUndefined();
    expect(rewritten.getCreationDate()).toBeUndefined();
    expect(rewritten.getModificationDate()).toBeUndefined();
    expect(rewritten.getPageCount()).toBe(1);
    expect(rewritten.catalog.get(PDFName.of('Metadata'))).toBeUndefined();
  });

  it('fixCmapRadicals 把部首字換成一般漢字', () => {
    // ⼯（U+2F2F）→ 工（U+5DE5）、⽤（U+2F64）→ 用（U+7528）；全形逗號與一般漢字不動。
    const input = cmap(['<0001> <2F2F>', '<0002> <5DE5>', '<0003> <FF0C>', '<0004> <2f64>'], ['<0010> <0012> <0041>']);

    const result = fixCmapRadicals(input);

    expect(result.replaced).toBe(2);
    expect(result.cmap).toBe(
      cmap(['<0001> <5DE5>', '<0002> <5DE5>', '<0003> <FF0C>', '<0004> <7528>'], ['<0010> <0012> <0041>']),
    );
  });

  it('fixCmapRadicals 遇到落在部首範圍的 bfrange 會失敗', () => {
    expect(() => fixCmapRadicals(cmap([], ['<0010> <0012> <2F2E>']))).toThrow(/bfrange/);
  });

  it('contentTypeOf 依副檔名回傳類型', () => {
    expect(contentTypeOf('/a/index.html')).toBe('text/html; charset=utf-8');
    expect(contentTypeOf('/a/b.css')).toBe('text/css; charset=utf-8');
    expect(contentTypeOf('/a/b.PDF')).toBe('application/pdf');
    expect(contentTypeOf('/a/b.unknown')).toBe('application/octet-stream');
  });

  it('startStaticServer 只服務指定資料夾', async () => {
    const root = join(tempRoot, 'site');
    rmSync(root, { recursive: true, force: true });
    writeFileSync(join(tempRoot, 'secret.txt'), 'outside');
    mkdirSync(join(root, 'page'), { recursive: true });
    writeFileSync(join(root, 'page', 'index.html'), '<p>ok</p>');

    const { server, origin } = await startStaticServer(root);
    try {
      const status = async (path: string): Promise<number> => (await fetch(`${origin}${path}`)).status;
      expect(await status('/page/')).toBe(200);
      expect((await fetch(`${origin}/page/`)).headers.get('content-type')).toBe('text/html; charset=utf-8');
      expect(await status('/..%2Fsecret.txt')).toBe(404);
      expect(await status('/..%5Csecret.txt')).toBe(404);
      expect(await status('/%E0%A4%A')).toBe(404);
      expect(await status('/missing/')).toBe(404);
    } finally {
      server.close();
    }
  });
});
