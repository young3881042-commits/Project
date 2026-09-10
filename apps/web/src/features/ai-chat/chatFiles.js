import { attachmentMarkdown } from './chatAttachments.js';
export const CHAT_PURPOSES = ['일상', '공부', '업무', '아이디어'];
export function conversationMarkdown(thread) {
  return `# ${thread.title}\n\n목적: ${thread.purpose}\n\n` + thread.messages.map(message => `## ${message.role === 'user' ? '나' : 'AI'}\n\n${message.text}${attachmentMarkdown(message.attachments)}\n`).join('\n');
}
export async function exportConversation(thread, target = window) {
  const content = conversationMarkdown(thread);
  if (target.AiAssistantNative?.exportAiConversation) {
    return new Promise((resolve, reject) => {
      const id = target.crypto.randomUUID();
      const cleanup = () => { clearTimeout(timer); target.removeEventListener('orbit:chat-export', receive); };
      const receive = event => {
        if (event.detail?.requestId !== id) return;
        cleanup();
        if (event.detail.error) reject(new Error(event.detail.error)); else resolve(!event.detail.cancelled);
      };
      const timer = setTimeout(() => { cleanup(); reject(new Error('파일 저장을 다시 시도해주세요.')); }, 300000);
      target.addEventListener('orbit:chat-export', receive);
      try { target.AiAssistantNative.exportAiConversation(id, content); }
      catch { cleanup(); reject(new Error('앱 업데이트 후 다시 시도해주세요.')); }
    });
  }
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
  const link = target.document.createElement('a'); link.href = url; link.download = `Orbit-AI-${thread.id}.md`;
  target.document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
