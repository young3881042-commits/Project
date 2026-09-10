import { MAX_ATTACHMENT_CHARS } from './chatAttachments.js';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
const cmaps = import.meta.glob('/node_modules/pdfjs-dist/cmaps/*.bcmap', { eager: true, query: '?url', import: 'default' });
const fonts = import.meta.glob('/node_modules/pdfjs-dist/standard_fonts/*.{pfb,ttf}', { eager: true, query: '?url', import: 'default' });
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
class LocalPdfBinaryData {
  async fetch({ kind, filename }) {
    const url = kind === 'cMapUrl' ? cmaps[`/node_modules/pdfjs-dist/cmaps/${filename}`]
      : kind === 'standardFontDataUrl' ? fonts[`/node_modules/pdfjs-dist/standard_fonts/${filename}`] : null;
    if (!url) throw new Error('PDF 글꼴 정보를 읽지 못했어요.');
    const response = await fetch(url);
    if (!response.ok) throw new Error('PDF 글꼴 정보를 읽지 못했어요.');
    return new Uint8Array(await response.arrayBuffer());
  }
}
export async function readPdfText(data) {
  const task = pdfjs.getDocument({ data, isEvalSupported: false, useWorkerFetch: false, BinaryDataFactory: LocalPdfBinaryData, useWasm: false, useSystemFonts: false, disableFontFace: true, stopAtErrors: true });
  const timer = setTimeout(() => task.destroy(), 20000);
  try {
    const pdf = await task.promise;
    let text = '', truncated = pdf.numPages > 30;
    for (let number = 1; number <= Math.min(pdf.numPages, 30); number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      text += `\n[${number}쪽]\n` + content.items.map(item => typeof item.str === 'string' ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('');
      page.cleanup();
      if (text.length > MAX_ATTACHMENT_CHARS) { truncated = true; break; }
    }
    if (!text.replace(/\[\d+쪽\]/g, '').trim()) throw new Error('NO_TEXT');
    return { text, truncated };
  } catch (error) {
    throw new Error(error.name === 'PasswordException' ? '암호가 걸린 PDF는 암호를 해제한 뒤 첨부해주세요.' : error.message === 'NO_TEXT' ? 'PDF에서 글자를 찾지 못했어요. 스캔·사진 PDF는 아직 지원하지 않아요.' : 'PDF를 읽지 못했어요. 파일 상태를 확인하거나 텍스트 파일로 보내주세요.');
  } finally { clearTimeout(timer); await task.destroy(); }
}
