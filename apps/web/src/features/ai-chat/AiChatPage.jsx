import { EFFORT_LABELS } from './chatModelOptions.js';
import ChatAttachments from './ChatAttachments.jsx';
import ChatModelControls from './ChatModelControls.jsx';
import { CHAT_ATTACHMENT_ACCEPT, readChatAttachment, validateAttachments } from './chatAttachments.js';
import CodexConnection from '../ai-runtime/CodexConnection.jsx';
import { useEffect, useRef, useState } from 'react';
import { useAiConversations } from './useAiConversations.js';
import { CHAT_PURPOSES, exportConversation } from './chatFiles.js';

function ChatDialog({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className="orbitChatDialog" aria-labelledby="orbit-chat-dialog-title" onCancel={onClose}>
    <header><h3 id="orbit-chat-dialog-title">{title}</h3><button type="button" aria-label="닫기" onClick={onClose}>×</button></header>{children}
  </dialog>;
}

export default function AiChatPage({ owner }) {
  const chat = useAiConversations(owner);
  const [folder, setFolder] = useState(chat.thread?.purpose || '일상');
  const [text, setText] = useState(() => chat.draft(chat.selected || `new:${folder}`));
  const [dialog, setDialog] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [files, setFiles] = useState([]);
  const [readingFile, setReadingFile] = useState(false);
  const [model, setModel] = useState(() => chat.draft('model'));
  const [effort, setEffort] = useState(() => chat.draft('effort'));
  const picker = useRef(null);
  const fileTicket = useRef(0);
  useEffect(() => () => { fileTicket.current++; }, []);
  const blankRequested = useRef(false);
  const submitLock = useRef(false);
  const end = useRef(null);
  const sourceTarget = useRef('');
  const selectedRef = useRef(chat.selected);
  selectedRef.current = chat.selected;
  const draftId = chat.selected || `new:${folder}`;
  const folders = [...new Set([...CHAT_PURPOSES, folder, ...chat.threads.map(row => row.purpose)])];
  const rows = chat.threads.filter(row => row.purpose === folder);
  const running = chat.thread?.state === 'running';
  const busy = chat.busy || sending || readingFile;
  useEffect(() => { fileTicket.current++; setReadingFile(false); setText(chat.draft(draftId)); setFiles(chat.attachmentDraft(draftId)); setModel(chat.draft('model')); setEffort(chat.draft('effort')); setNotice(''); }, [draftId, chat.runtimeMode]);
  useEffect(() => {
    if (!sourceTarget.current) end.current?.scrollIntoView({ block: 'nearest' });
  }, [chat.thread?.messages.length, chat.selected]);
  useEffect(() => {
    const source = sourceTarget.current && document.getElementById(`orbit-message-${sourceTarget.current}`);
    if (source) { source.scrollIntoView({ block: 'center' }); source.focus({ preventScroll: true }); sourceTarget.current = ''; }
  }, [chat.thread, chat.selected]);
  useEffect(() => {
    if (chat.selected) {
      const selected = chat.threads.find(row => row.id === chat.selected);
      if (selected) setFolder(selected.purpose);
    } else if (!blankRequested.current && !text && rows.length) chat.choose(rows[0].id);
  }, [chat.threads, chat.selected]);
  function switchFolder(value) {
    blankRequested.current = true;
    setFolder(value); chat.choose(chat.threads.find(row => row.purpose === value)?.id || '');
  }
  function updateFiles(next) {
    const validated = validateAttachments(next);
    setFiles(validated);
    if (!chat.saveAttachmentDraft(draftId, validated)) setNotice('첨부 초안을 저장하지 못했어요. 이 화면에서 전송해주세요.');
  }
  async function attach(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || busy) return;
    const ticket = ++fileTicket.current;
    setReadingFile(true); setNotice('');
    try {
      const value = await readChatAttachment(file, async bytes => (await import('./chatPdf.js')).readPdfText(bytes));
      if (ticket === fileTicket.current) updateFiles([...files, value]);
    } catch (error) { if (ticket === fileTicket.current) setNotice(error.message); }
    finally { if (ticket === fileTicket.current) setReadingFile(false); }
  }
  async function submit(event) {
    event.preventDefault();
    if (submitLock.current || busy || running || (!text.trim() && !files.length)) return;
    submitLock.current = true; setSending(true);
    const message = text.trim() || '첨부한 파일 내용을 확인하고 요약해줘.';
    try {
      let id = chat.selected;
      if (!id) {
        const created = await chat.create(message.replace(/\s+/g, ' ').slice(0, 40), folder);
        if (!created) return;
        id = created.id;
        chat.saveDraft(id, text); chat.saveDraft(draftId, '');
        chat.saveAttachmentDraft(id, files); chat.saveAttachmentDraft(draftId, []);
      }
      const sent = await chat.send(message, false, id, files, model, effort);
      if (sent) { chat.saveDraft(id, ''); chat.saveAttachmentDraft(id, []); if (selectedRef.current === id) { setText(''); setFiles([]); } }
    } finally { submitLock.current = false; setSending(false); }
  }
  return <section className="orbitChatPage" aria-label="AI 대화">
    <nav className="orbitChatFolders" aria-label="대화 폴더">
      {folders.map(value => <button type="button" key={value} aria-pressed={folder === value} disabled={busy} onClick={() => switchFolder(value)}>{value}</button>)}
      <button type="button" aria-label="폴더 추가" disabled={busy} onClick={() => setDialog('folder')}>＋</button>
    </nav>
    <header className="orbitChatToolbar">
      <select aria-label="폴더 안의 대화" value={chat.selected} disabled={busy} onChange={e => { blankRequested.current = true; chat.choose(e.target.value); }}>
        <option value="">새 대화</option>{rows.map(row => <option key={row.id} value={row.id}>{row.title}</option>)}
      </select>
      <button type="button" aria-label="새 대화" title="새 대화" disabled={busy} onClick={() => { blankRequested.current = true; chat.choose(''); }}>＋</button>
      <button type="button" className="orbitChatAiButton" onClick={() => setDialog('connection')}><span aria-hidden="true">✦</span> AI 사용하기</button>
      <button type="button" aria-label="대화 메뉴" title="대화 메뉴" onClick={() => setDialog('menu')}>⋯</button>
    </header>
    <ChatModelControls model={model} onModel={value => { setModel(value); chat.saveDraft('model', value); setEffort(''); chat.saveDraft('effort', ''); }} effort={effort} onEffort={value => { setEffort(value); chat.saveDraft('effort', value); }} disabled={busy || running} revision={`${chat.runtimeMode}:${chat.thread?.messages.filter(message => message.role === 'assistant').at(-1)?.id || ''}`} />
    {chat.error ? <div className="orbitChatNotice" role="alert"><span>{chat.error}</span><button type="button" onClick={() => setDialog('connection')}>연결 설정</button></div> : null}
    {notice ? <p className="orbitChatHint" role="status">{notice}</p> : null}
    <div className="orbitChatMessages" aria-label="대화 내용">
      {chat.thread?.messages.map(message => <article className={`orbitChatMessage ${message.role}`} key={message.id} id={`orbit-message-${message.id}`} tabIndex={-1}><span>{message.role === 'user' ? '나' : 'AI'}</span><p>{message.text}</p><ChatAttachments files={message.attachments} />{message.model ? <small className="orbitChatHint">{message.model}{message.effort ? ` · ${EFFORT_LABELS[message.effort] || message.effort}` : ''}</small> : null}{message.memorySources?.length ? <details className="orbitChatSources"><summary>참고한 이전 대화 {message.memorySources.length}개</summary>{message.memorySources.map(source => <button type="button" key={`${source.threadId}:${source.messageId}`} disabled={busy} onClick={() => { sourceTarget.current = source.messageId; blankRequested.current = true; chat.choose(source.threadId); }}>{source.label} · {source.title}</button>)}</details> : null}{message.memoryNotice ? <small className="orbitChatHint">{message.memoryNotice}</small> : null}</article>)}
      {!chat.thread?.messages.length ? <p className="orbitChatEmpty">무엇을 도와드릴까요?</p> : null}<div ref={end} />
    </div>
    {running ? <div className="orbitChatProgress"><span role="status">답변 작성 중…</span><button type="button" disabled={busy} onClick={chat.cancel}>중단</button></div> : null}
    {chat.thread?.state === 'failed' ? <div className="orbitChatNotice" role="alert"><span>{chat.thread.error}</span><button type="button" disabled={busy} onClick={() => chat.send(chat.thread.messages.at(-1)?.text || '', true)}>다시 시도</button></div> : null}
    <ChatAttachments files={files} onRemove={busy ? undefined : index => updateFiles(files.filter((_, current) => current !== index))} />
    {readingFile ? <p className="orbitChatHint" role="status">파일에서 글자를 읽는 중…</p> : null}
    {files.length ? <p className="orbitChatAttachmentHint">전송하면 위 내용이 AI에 전달되고 대화와 함께 저장돼요.</p> : null}
    <input className="orbitChatFileInput" ref={picker} type="file" accept={CHAT_ATTACHMENT_ACCEPT} onChange={attach} tabIndex={-1} aria-label="첨부할 문서 선택" />
    <form className="orbitChatComposer" onSubmit={submit}>
      <button type="button" className="orbitChatAttachButton" aria-label="파일 첨부" title="PDF·텍스트 파일 첨부" disabled={busy || running || files.length >= 3} onClick={() => picker.current?.click()}>＋</button>
      <textarea aria-label="메시지" value={text} onChange={e => { setText(e.target.value); chat.saveDraft(draftId, e.target.value); }} maxLength={4000} rows={2} placeholder={files.length ? "파일에 대해 물어보세요" : "메시지 보내기"} required={!files.length} disabled={sending} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form.requestSubmit(); } }} />
      <button className="primary" aria-label="보내기" disabled={running || busy || (!text.trim() && !files.length)}>↑</button>
    </form>
    {dialog ? <ChatDialog title={{ menu: '대화 메뉴', folder: '폴더 추가', edit: '대화 관리', connection: '연결 설정' }[dialog]} onClose={() => setDialog('')}>
      {dialog === 'menu' ? <div className="orbitChatActions">
        <button disabled={!chat.thread || busy} onClick={() => setDialog('edit')}>제목 변경 · 폴더 이동</button>
        <button disabled={!chat.thread || exporting} onClick={async () => { setExporting(true); try { setNotice(await exportConversation(chat.thread) ? '대화를 파일로 저장했어요.' : '저장을 취소했어요.'); setDialog(''); } catch (error) { setNotice(error.message); setDialog(''); } finally { setExporting(false); } }}>파일 내보내기</button>
        <button onClick={() => setDialog('connection')}>연결 설정</button>
        <p className="orbitChatHint">대화는 선택한 실행 환경의 휴대폰 저장 공간에 JSON·Markdown 파일로 자동 저장돼요. 최근 메시지와 같은 폴더에서 찾은 관련 대화를 AI에 보내요. 이전 대화 검색은 질문할 때만 실행돼요.</p>
      </div> : null}
      {dialog === 'folder' ? <form onSubmit={async e => { e.preventDefault(); const name = new FormData(e.currentTarget).get('folder').trim(); if (!name) return; if (folders.includes(name)) { switchFolder(name); setDialog(''); } else if (await chat.create('새 대화', name)) { setFolder(name); setDialog(''); } }}>
        <label>폴더 이름<input name="folder" maxLength={40} placeholder="예: 영어 공부" required autoFocus /></label><button className="primary" disabled={busy}>추가</button>
      </form> : null}
      {dialog === 'edit' && chat.thread ? <form onSubmit={async e => { e.preventDefault(); const data = new FormData(e.currentTarget); const title = data.get('title').trim(), purpose = data.get('purpose').trim(); if (title && purpose && await chat.update(title, purpose)) { setFolder(purpose); setDialog(''); } }}>
        <label>대화 제목<input name="title" defaultValue={chat.thread.title} maxLength={80} required autoFocus /></label>
        <label>폴더<input name="purpose" list="orbit-chat-folders" defaultValue={chat.thread.purpose} maxLength={40} required /></label><datalist id="orbit-chat-folders">{folders.map(value => <option key={value} value={value} />)}</datalist><button className="primary" disabled={busy}>저장</button>
      </form> : null}
      {dialog === 'connection' ? <CodexConnection onConnected={chat.refresh} /> : null}
    </ChatDialog> : null}
  </section>;
}
