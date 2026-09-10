import { useEffect, useRef, useState } from 'react';
import { orbitStorage } from '../../utils/orbitIndexedDbStorage.js';
import { safeParse, safeSetItem } from '../../utils/lifeHubStorage.js';
import { importLegacyTravelDraft, validateTravelInput, validateTravelPlan } from './travelModel.js';
import { travelApi } from './travelApi.js';
import { restoreTravelWorkspace } from './travelWorkspace.js';

function readWorkspace(key, today) {
  return restoreTravelWorkspace(safeParse(orbitStorage.getItem(key), null), today);
}

export function useTravelPlanner({ owner, today }) {
  const key = `orbit-travel-workspace:v1:${owner}`;
  const [workspace, setWorkspace] = useState(() => readWorkspace(key, today));
  const [connection, setConnection] = useState('checking');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [retry, setRetry] = useState(0);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const pending = Boolean(workspace.jobId && !workspace.result);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    setStorageError(safeSetItem(key, JSON.stringify(workspace)) ? '' : '초안을 기기에 보관하지 못했어요. 이 화면을 닫기 전에 저장 공간을 확인해주세요.');
  }, [key, workspace]);
  useEffect(() => { let live = true; travelApi('availability').then(async info => { if (!live) return; if (info.authenticated) { const state = await travelApi(info.mode === 'embedded' ? 'auth-status' : 'status'); if (live) setConnection(state.connected ? 'connected' : 'pair'); } else setConnection('pair'); }).catch(error => { if (live) setConnection(error.status === 401 ? 'pair' : 'offline'); }); return () => { live = false; }; }, []);
  useEffect(() => {
    if (!pending || submitting) return undefined;
    let live = true, timer;
    async function poll() {
      if (!live || document.visibilityState === 'hidden') return;
      try {
        const job = await travelApi('poll', { id: workspace.jobId });
        if (!live) return;
        setConnection('connected'); setMessage(job.message || '일정을 구성하고 있어요.'); setError('');
        if (job.state === 'completed') {
          const result = validateTravelPlan(job.result, workspace.input);
          setWorkspace(current => ({ ...current, result }));
        } else if (job.state === 'failed' || job.state === 'cancelled') {
          setWorkspace(current => ({ ...current, jobId: '' }));
          if (job.state === 'failed') setError(job.message);
        } else timer = setTimeout(poll, 1800);
      } catch (error) {
        if (!live) return;
        setError(error.message);
        if (error.status === 404) setWorkspace(current => ({ ...current, jobId: '' }));
        if (error.status === 401) setConnection('pair');
        else if (!error.status) setConnection('offline');
      }
    }
    const resume = () => { clearTimeout(timer); if (document.visibilityState !== 'hidden') poll(); };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    poll();
    return () => { live = false; clearTimeout(timer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume); };
  }, [workspace.jobId, workspace.result, pending, retry, submitting]);

  async function connect(code) {
    setError('');
    try { await travelApi(code ? 'pair' : 'status', code ? { code } : {}); if (mounted.current) { setConnection('connected'); setMessage('Termux Codex에 연결됐어요.'); setRetry(n => n + 1); } }
    catch (error) { if (mounted.current) { setError(error.message); setConnection(error.status === 401 ? 'pair' : 'offline'); } }
  }
  async function generate(event) {
    event.preventDefault();
    if (busyRef.current || pending) return;
    let input;
    try { input = validateTravelInput(workspace.draft); } catch (error) { setError(error.message); return; }
    if (workspace.result && !window.confirm('현재 미리보기를 새 계획으로 바꿀까요? 저장한 여행은 그대로 남아요.')) return;
    busyRef.current = true; setSubmitting(true); setError(''); setMessage('여행 생성을 요청하고 있어요.');
    const requestId = window.crypto.randomUUID();
    // Persist the ID before sending: a lost response can be recovered without generating twice.
    setWorkspace(current => ({ ...current, jobId: requestId, input, result: null }));
    try {
      await travelApi('create', { requestId, input });
      if (mounted.current) { setConnection('connected'); setRetry(n => n + 1); }
    } catch (error) {
      if (mounted.current) {
        setError(error.message);
        if (error.status) setWorkspace(current => ({ ...current, jobId: '' }));
        if (error.status === 401) setConnection('pair');
      }
    } finally { busyRef.current = false; if (mounted.current) setSubmitting(false); }
  }
  async function cancel() {
    try { await travelApi('cancel', { id: workspace.jobId }); setWorkspace(current => ({ ...current, jobId: '' })); setMessage('생성을 취소했어요.'); setError(''); }
    catch (error) { setError(error.message); }
  }
  function importDraft() {
    const legacy = importLegacyTravelDraft(safeParse(orbitStorage.getItem('localtrip-planner-draft'), null), today);
    if (!legacy?.destination) { setError('이 기기에서 불러올 이전 초안을 찾지 못했어요.'); return; }
    if (workspace.draft.destination && !window.confirm('입력 중인 내용을 이전 초안으로 바꿀까요?')) return;
    setWorkspace(current => ({ ...current, draft: legacy })); setMessage('이전 초안을 불러왔어요. 원본은 그대로 보관돼요.'); setError('');
  }
  return { ...workspace, connection, message, error, storageError, submitting, pending,
    change: (field, value) => setWorkspace(current => ({ ...current, draft: { ...current.draft, [field]: value } })),
    generate, connect, cancel, importDraft, retry: () => setRetry(n => n + 1) };
}
