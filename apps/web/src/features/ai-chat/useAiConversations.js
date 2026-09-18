import { currentRuntime, useAssistantContext } from '../assistant-actions/useAssistantActions.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { orbitStorage } from '../../utils/orbitIndexedDbStorage.js';
import { safeParse, safeSetItem } from '../../utils/lifeHubStorage.js';
import { validateAttachments } from './chatAttachments.js';
import { travelApi, TravelApiError } from '../travel/travelApi.js';

export function useAiConversations(owner) {
  const assistant = useAssistantContext();
  const assistantRef = useRef(assistant); assistantRef.current = assistant;
  const [runtimeMode, setRuntimeMode] = useState(() => { try { return window.AiAssistantNative?.getAiRuntimeMode?.() === 'embedded' ? 'embedded' : 'standby'; } catch { return 'standby'; } });
  useEffect(() => { let live = true; travelApi('availability').then(info => { if (live) setRuntimeMode(info.mode === 'embedded' ? 'embedded' : 'standby'); }).catch(() => { if (live) setRuntimeMode('standby'); }); return () => { live = false; }; }, []);
  const prefix = `orbit-ai-chat:v1:${owner}:${runtimeMode === 'embedded' ? 'embedded:' : ''}`;
  const read = (name, fallback) => safeParse(orbitStorage.getItem(prefix + name), fallback);
  const [threads, setThreads] = useState(() => read('list', []));
  const [selected, setSelected] = useState(() => read('selected', ''));
  const [thread, setThread] = useState(() => read(read('selected', ''), null));
  const [error, setError] = useState('');
  const [scheduleAvailable, setScheduleAvailable] = useState(null);
  const [status, setStatus] = useState('checking');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const current = useRef(selected);
  const mounted = useRef(true);
  const pendingSend = useRef(null);
  const lock = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const apply = useCallback(value => {
    if (!mounted.current) return;
    assistantRef.current?.accept(value, runtimeMode);
    safeSetItem(prefix + value.id, JSON.stringify(value));
    setThreads(rows => {
      const { id, title, purpose, updatedAt, state } = value;
      const next = [{ id, title, purpose, updatedAt, state }, ...rows.filter(row => row.id !== id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      safeSetItem(prefix + 'list', JSON.stringify(next)); return next;
    });
    if (current.current === value.id) setThread(value);
  }, [prefix, runtimeMode]);
  const report = error => { if (mounted.current) { setError(error.message); if (error.status === 401) setStatus('pair'); else if (error instanceof TravelApiError && !error.status) setStatus('offline'); } };
  async function refresh() {
    try {
      const data = await travelApi('chat-list');
      const capability = await travelApi('status');
      if (mounted.current) setScheduleAvailable(capability.scheduleActions === 'schedule-create-v1');
      if (!mounted.current) return;
      setThreads(data.threads); safeSetItem(prefix + 'list', JSON.stringify(data.threads)); setStatus('connected'); setError(''); setRevision(n => n + 1);
    } catch (error) { report(error); }
  }
  useEffect(() => {
    if (!runtimeMode) return;
    const id = read('selected', ''); current.current = id; setSelected(id); setThread(read(id, null)); setThreads(read('list', [])); refresh();
  }, [prefix, runtimeMode]);
  useEffect(() => {
    if (!selected || !runtimeMode) return undefined;
    let live = true, timer, fetching = false;
    async function poll() {
      if (!live || fetching || document.visibilityState === 'hidden') return;
      fetching = true;
      try {
        const value = await travelApi('chat-thread', { id: selected });
        if (!live) return;
        apply(value); setStatus('connected'); setError('');
        if (value.state === 'running') timer = setTimeout(poll, 1800);
      } catch (error) { if (live) report(error); }
      finally { fetching = false; }
    }
    const resume = () => { clearTimeout(timer); poll(); };
    poll(); document.addEventListener('visibilitychange', resume); window.addEventListener('online', resume);
    return () => { live = false; clearTimeout(timer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume); };
  }, [selected, revision, apply, runtimeMode]);
  function choose(id) { safeSetItem(prefix + 'selected', JSON.stringify(id)); current.current = id; setSelected(id); setThread(read(id, null)); setError(''); }
  async function run(action) {
    if (lock.current) return null;
    lock.current = true; setBusy(true); setError('');
    try { return await action(); } catch (error) { report(error); return null; }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  return { threads, selected, thread, error, status, scheduleAvailable, busy: busy || !runtimeMode, runtimeMode, choose, refresh,
    draft: id => runtimeMode ? read(`draft:${id}`, '') : '',
    saveDraft: (id, value) => safeSetItem(prefix + `draft:${id}`, JSON.stringify(value)),
    attachmentDraft: id => { try { return validateAttachments(read(`files:${id}`, [])); } catch { return []; } },
    saveAttachmentDraft: (id, files) => safeSetItem(prefix + `files:${id}`, JSON.stringify(files)),
    create: (title, purpose) => run(async () => {
      const value = await travelApi('chat-create', { id: window.crypto.randomUUID(), title, purpose });
      if (!mounted.current) return null;
      choose(value.id); apply(value); setStatus('connected'); return value;
    }),
    update: (title, purpose) => run(async () => { const value = await travelApi('chat-update', { id: selected, title, purpose }); apply(value); return value; }),
    send: (text, retry = false, targetId = selected, files = [], selectedModel = '', selectedEffort = '') => run(async () => {
      const last = thread?.messages.at(-1);
      const model = retry ? last?.model || '' : selectedModel;
      const effort = retry ? last?.effort || '' : selectedEffort;
      const attachments = validateAttachments(retry ? last?.attachments || [] : files);
      const capability = await travelApi('status');
      if (!mounted.current || currentRuntime() !== runtimeMode) return null;
      if (effort && !capability?.chatReasoning) throw new Error('추론 강도 선택은 최신 AI 연결에서 사용할 수 있어요.');
      if (model && !capability?.chatModels) throw new Error('모델 선택은 최신 AI 연결에서 사용할 수 있어요.');
      if (attachments.some(file => file.kind === 'image') && capability.chatImages !== 'jpeg-v1') throw new Error('사진 전송은 최신 앱의 내장 AI에서 사용할 수 있어요. AI 연결을 업데이트해주세요.');
      if (attachments.length && capability.chatAttachments !== 'text-pdf-v1') throw new Error('현재 AI 연결은 파일 첨부를 지원하지 않아요. 최신 앱의 내장 AI로 전환하거나 연결 서버를 업데이트해주세요.');
      if (effort) {
        const info = await travelApi('auth-info');
        if (!info.models?.some(item => item.id === model && item.efforts?.includes(effort))) throw new Error('이 모델의 추론 강도를 확인하지 못했어요. 모델·한도를 새로고침하거나 기본 추론으로 선택해주세요.');
      }
      const requestId = retry && last?.role === 'user' ? last.id : pendingSend.current?.id === targetId && pendingSend.current.text === text && (pendingSend.current.model || '') === model && (pendingSend.current.effort || '') === effort && JSON.stringify(pendingSend.current.attachments || []) === JSON.stringify(attachments) ? pendingSend.current.requestId : window.crypto.randomUUID();
      const body = { id: targetId, requestId, text, ...(model ? { model } : {}), ...(effort ? { effort } : {}), ...(attachments.length ? { attachments } : {}) };
      if (capability.scheduleActions === 'schedule-create-v1' && assistantRef.current) body.assistantContext = await assistantRef.current.register(body, runtimeMode);
      if (!mounted.current || currentRuntime() !== runtimeMode) return null;
      pendingSend.current = body;
      const value = await travelApi('chat-send', body);
      apply(value); pendingSend.current = null;
      if (mounted.current) { setStatus('connected'); setRevision(n => n + 1); }
      return value;
    }),
    cancel: () => run(async () => { assistantRef.current?.cancel(selected, runtimeMode); const value = await travelApi('chat-cancel', { id: selected }); apply(value); return value; }),
    pair: code => run(async () => { await travelApi('pair', { code }); await refresh(); return true; })
  };
}
