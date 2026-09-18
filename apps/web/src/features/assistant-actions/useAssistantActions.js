import { scheduleActionReply } from './actionSchema.js';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { orbitStorage } from '../../utils/orbitIndexedDbStorage.js';
import { travelApi } from '../travel/travelApi.js';
import { todayKey } from '../../utils/lifeHubFormatters.js';
import { createActionJournal, ACTION_EVENT } from './actionJournal.js';
export const AssistantActionsContext = createContext(null);
export const useAssistantContext = () => useContext(AssistantActionsContext);
export function currentRuntime() {
  try { return window.AiAssistantNative?.getAiRuntimeMode?.() === 'embedded' ? 'embedded' : 'standby'; } catch { return 'standby'; }
}
export function useAssistantActions(owner, repository) {
  const [revision, setRevision] = useState(0), [error, setError] = useState('');
  const journal = useMemo(() => createActionJournal({ owner, storage: orbitStorage, repository, changed: () => queueMicrotask(() => window.dispatchEvent(new Event(ACTION_EVENT))) }), [owner, repository]);
  const lifetime = useMemo(() => ({ active: true }), [journal]);
  useEffect(() => {
    lifetime.active = true;
    const sync = () => setRevision(n => n + 1);
    window.addEventListener(ACTION_EVENT, sync); window.addEventListener('storage', sync);
    return () => { lifetime.active = false; window.removeEventListener(ACTION_EVENT, sync); window.removeEventListener('storage', sync); };
  }, [journal, lifetime]);
  useEffect(() => {
    let active = true, timer, busy = false;
    async function poll() {
      if (!active || busy || document.visibilityState === 'hidden') return;
      busy = true;
      try {
        const runtime = currentRuntime();
        journal.recover(runtime);
        const waiting = journal.list().filter(r => r.runtime === runtime && r.status === 'waiting');
        for (const id of [...new Set(waiting.map(r => r.threadId))]) {
          const thread = await travelApi('chat-thread', { id });
          if (!active || currentRuntime() !== runtime) break;
          journal.accept(thread, runtime);
        }
        if (active) setError('');
      } catch (failure) { if (active) setError(failure.message); }
      finally { busy = false; if (active) timer = setTimeout(poll, 4000); }
    }
    const resume = () => { clearTimeout(timer); poll(); };
    poll(); window.addEventListener(ACTION_EVENT, resume); window.addEventListener('online', resume); document.addEventListener('visibilitychange', resume);
    return () => { active = false; clearTimeout(timer); window.removeEventListener(ACTION_EVENT, resume); window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume); };
  }, [journal]);
  let rows = [];
  try { rows = journal.list().sort((a,b) => b.updatedAt-a.updatedAt); } catch { /* Preserve damaged storage; polling reports it. */ }
  function attempt(fn) { try { const result = fn(); setError(''); return result; } catch (failure) { setError(failure.message); return null; } }
  return { rows, error, revision,
    async register(request, runtime) {
      const bytes = new TextEncoder().encode(JSON.stringify({ text: request.text, model: request.model || '', effort: request.effort || '', attachments: request.attachments || [] }));
      const signature = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
      if (!lifetime.active || currentRuntime() !== runtime) throw Error('실행 환경이 바뀌었어요. 다시 보내주세요.');
      const pending = journal.list().find(row => row.status === 'waiting' && row.runtime === runtime && row.threadId === request.id && row.signature === signature);
      if (pending) request.requestId = pending.requestId;
      const existing = journal.get(`${runtime}:${request.requestId}`);
      const context = existing?.context || { version: 1, today: todayKey(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', pending: journal.pending(request.id, runtime) };
      if (!scheduleActionReply(request.text, context)) { journal.clearClarification(request.id, runtime); return null; }
      journal.register({ requestId: request.requestId, threadId: request.id, runtime, text: request.text, context, signature });
      return context;
    },
    accept(thread, runtime) { if (runtime === currentRuntime()) attempt(() => journal.accept(thread, runtime)); },
    invalidate: () => journal.invalidate(),
    cancel(threadId, runtime) { journal.cancel(threadId, runtime); },
    undo: id => attempt(() => journal.undo(id)),
    retry: id => attempt(() => journal.execute(id))
  };
}
