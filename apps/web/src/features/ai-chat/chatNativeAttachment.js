import { attachmentName, MAX_PDF_BYTES, MAX_TEXT_BYTES } from './chatAttachments.js';
export async function pickNativeChatAttachment(target = window) {
  const file = await new Promise((resolve, reject) => {
    const id = target.crypto.randomUUID();
    const cleanup = () => { clearTimeout(timer); target.removeEventListener('orbit:chat-attachment', receive); };
    const receive = event => {
      if (event.detail?.requestId !== id) return; cleanup();
      if (event.detail.error) reject(new Error(event.detail.error));
      else resolve(event.detail.cancelled ? null : event.detail.file);
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error('파일 선택을 다시 시도해주세요.')); }, 300000);
    target.addEventListener('orbit:chat-attachment', receive);
    try { target.AiAssistantNative.pickChatAttachment(id); } catch { cleanup(); reject(new Error('파일 선택 창을 열지 못했어요.')); }
  });
  if (!file) return null;
  const name = attachmentName(file.name), max = name.toLowerCase().endsWith('.pdf') ? MAX_PDF_BYTES : MAX_TEXT_BYTES;
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > max || !/^https:\/\/appassets\.androidplatform\.net\/orbit-chat-attachment\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(file.url || '')) throw new Error('첨부 파일 정보가 올바르지 않아요.');
  const response = await target.fetch(file.url, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('선택한 파일을 읽지 못했어요. 다시 첨부해주세요.');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== file.size) throw new Error('파일을 끝까지 읽지 못했어요. 다시 첨부해주세요.');
  return { name, size: bytes.byteLength, arrayBuffer: async () => bytes };
}
