import { isPhotoName, validateChatImage, MAX_PHOTO_BYTES } from './chatImageRules.js';
export const CHAT_ATTACHMENT_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp,.pdf,.txt,.md,.markdown,.csv,.json,.log,application/pdf,text/plain,text/markdown,text/csv,application/json';
export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_CHARS = 12000;
export const MAX_ATTACHMENT_TOTAL_CHARS = 24000;
export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_TEXT_BYTES = 200 * 1024;
const extensions = new Set(['pdf', 'txt', 'md', 'markdown', 'csv', 'json', 'log', 'jpg', 'jpeg', 'png', 'webp']);
export function attachmentName(name) {
  if (typeof name !== 'string' || !name.trim() || name.length > 160 || /[\u0000-\u001f\u007f/\\\u202a-\u202e\u2066-\u2069]/.test(name)) throw new Error('파일 이름을 확인해주세요.');
  const clean = name.trim();
  if (!extensions.has(clean.split('.').at(-1).toLowerCase())) throw new Error('JPG·PNG·WebP 사진과 PDF·텍스트 문서를 첨부할 수 있어요.');
  return clean;
}
export function validateAttachments(input = []) {
  if (!Array.isArray(input) || input.length > MAX_ATTACHMENTS) throw new Error('파일은 한 번에 3개까지 첨부할 수 있어요.');
  let total = 0;
  return input.map(value => {
    const name = attachmentName(value?.name);
    if (value.kind === 'image') return validateChatImage({ ...value, name });
    if (isPhotoName(name)) throw new Error('사진 데이터를 확인해주세요.');
    if (typeof value.text !== 'string' || !value.text.trim() || value.text.length > MAX_ATTACHMENT_CHARS || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.text)) throw new Error('첨부 파일의 텍스트를 읽지 못했거나 내용이 너무 길어요.');
    total += value.text.length;
    if (total > MAX_ATTACHMENT_TOTAL_CHARS) throw new Error('첨부 내용은 합계 24,000자까지 보낼 수 있어요. 파일을 나눠 보내주세요.');
    const max = name.toLowerCase().endsWith('.pdf') ? MAX_PDF_BYTES : MAX_TEXT_BYTES;
    if (!Number.isSafeInteger(value.size) || value.size < 1 || value.size > max || typeof value.truncated !== 'boolean') throw new Error('첨부 파일 크기를 확인해주세요.');
    return { name, size: value.size, text: value.text, truncated: value.truncated };
  });
}
export function attachmentMarkdown(attachments = []) {
  return attachments.map(file => file.kind === 'image' ? `\n\n사진 첨부: ${file.name} (사진은 앱 대화에서 확인)` : `\n\n### 첨부: ${file.name}${file.truncated ? ' (일부 내용)' : ''}\n\n${file.text}`).join('');
}
export function messageWithAttachments(message) {
  return message.text + attachmentMarkdown(message.attachments || []);
}
export async function readChatAttachment(file, readPdf) {
  const name = attachmentName(file?.name);
  if (isPhotoName(name)) return (await import('./chatImage.js')).readChatImage(file);
  const pdf = name.toLowerCase().endsWith('.pdf');
  const max = pdf ? MAX_PDF_BYTES : MAX_TEXT_BYTES;
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > max) throw new Error(pdf ? 'PDF는 5MB까지 첨부할 수 있어요.' : '텍스트 파일은 200KB까지 첨부할 수 있어요.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length !== file.size) throw new Error('파일을 끝까지 읽지 못했어요. 다시 선택해주세요.');
  let text, truncated = false;
  if (pdf) {
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('올바른 PDF 파일이 아니에요.');
    const result = await readPdf(bytes); text = result.text; truncated = result.truncated;
  } else {
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { try { text = new TextDecoder('euc-kr', { fatal: true }).decode(bytes); } catch { throw new Error('한글 인코딩을 읽지 못했어요. UTF-8로 저장한 파일을 선택해주세요.'); } }
  }
  text = text.replace(/\r\n?/g, '\n').replace(/\f/g, '\n').trim();
  if (!text) throw new Error(pdf ? 'PDF에서 글자를 찾지 못했어요. 스캔·사진 PDF는 아직 지원하지 않아요.' : '파일에 읽을 내용이 없어요.');
  truncated ||= text.length > MAX_ATTACHMENT_CHARS;
  return validateAttachments([{ name, size: file.size, text: text.slice(0, MAX_ATTACHMENT_CHARS), truncated }])[0];
}
