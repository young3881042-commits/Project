import { scheduleActionReply, validateActionContext } from './actionSchema.js';
import { prepareAssistantScheduleChange } from '../lifehub-ai/assistantScheduleChange.js';
export const ACTION_EVENT = 'orbit:assistant-actions';
export const journalKey = owner => `orbit.assistant-actions:v1:${encodeURIComponent(owner)}`;
const terminal = new Set(['done', 'duplicate', 'undone', 'cancelled', 'answered', 'conflict']);
export const recordVersion = value => JSON.stringify(value, function(key, item) {
  return item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item;
});
export function createActionJournal({ owner, storage, repository, now = () => Date.now(), changed = () => {} }) {
  const key = journalKey(owner);
  function list() {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const state = JSON.parse(raw);
    if (state.version !== 1 || !Array.isArray(state.records) || state.records.some(r => r.owner !== owner)) throw Error('일정 실행 기록을 읽지 못했어요. 기존 기록을 보존했어요.');
    return state.records;
  }
  function put(row) {
    let rows = list().filter(r => r.id !== row.id);
    // Keep minimal tombstones so pruning display history never reauthorizes a request.
    rows = rows.map(r => terminal.has(r.status) && now() - r.updatedAt > 30 * 86400000 ? { id: r.id, owner, runtime: r.runtime, threadId: r.threadId, requestId: r.requestId, status: r.status, updatedAt: r.updatedAt } : r);
    if (rows.length >= 2000) throw Error('실행 기록이 가득 찼어요. 일정 화면에서 직접 등록해주세요.');
    const next = { ...row, updatedAt: now() };
    storage.setItem(key, JSON.stringify({ version: 1, records: [...rows, next] }));
    changed(); return next;
  }
  function get(id) { return list().find(r => r.id === id); }
  function register({ requestId, threadId, runtime, text, context, signature }) {
    const id = `${runtime}:${requestId}`;
    const old = get(id);
    if (old) {
      if (old.text !== text || old.threadId !== threadId || terminal.has(old.status)) throw Error('이 요청은 이미 처리되었거나 취소됐어요. 새 메시지로 요청해주세요.');
      return old;
    }
    const normalized = validateActionContext(context);
    const expected = scheduleActionReply(text, normalized);
    return put({ id, owner, runtime, requestId, threadId, text, signature, context: normalized, expected, status: 'waiting', createdAt: now(), updatedAt: now() });
  }
  function execute(id) {
    let row = get(id);
    if (!row || !['prepared', 'saving', 'failed'].includes(row.status) || !row.action) return row;
    const items = repository.read();
    const existing = items.find(item => item.id === row.targetId);
    if (existing) {
      if (existing.origin?.requestId !== row.id) return put({ ...row, status: 'conflict', error: '다른 일정과 식별자가 겹쳐 적용하지 않았어요.' });
      if (row.savedVersion && recordVersion(existing) !== row.savedVersion) return put({ ...row, status: 'conflict', error: '일정이 변경됐어요. 원본에서 확인해주세요.' });
      return put({ ...row, status: 'done', savedVersion: row.savedVersion || recordVersion(existing), item: existing, error: '', undoUntil: row.undoUntil || now() + 7 * 86400000 });
    }
    // A write may have completed and subsequently been deleted. Never recreate it.
    if (row.status === 'saving') return put({ ...row, status: 'conflict', error: '저장 결과를 확인할 수 없어요. 중복 방지를 위해 자동 등록을 멈췄어요.' });
    const prepared = prepareAssistantScheduleChange(items, row.action.draft, row.id, { normalize: repository.normalize, createId: () => row.targetId });
    if (prepared.status === 'duplicate') return put({ ...row, status: 'duplicate', item: prepared.item, error: '' });
    if (prepared.status !== 'created') throw Error('일정을 준비하지 못했어요.');
    row = put({ ...row, status: 'saving', savedVersion: recordVersion(prepared.item), item: prepared.item });
    const saved = repository.save(prepared.items);
    const stored = repository.read().find(item => item.id === row.targetId);
    if (!saved?.saved || !stored || recordVersion(stored) !== row.savedVersion) return put({ ...row, status: 'failed', error: '저장 결과를 확인하지 못했어요. 다시 확인해주세요.' });
    return put({ ...row, status: 'done', item: stored, error: '', undoUntil: now() + 7 * 86400000 });
  }
  function accept(thread, runtime) {
    for (const row of list().filter(r => r.runtime === runtime && r.threadId === thread.id && r.status === 'waiting')) {
      const message = thread.messages?.find(m => m.role === 'assistant' && m.requestId === row.requestId);
      if (!message) continue;
      if (!row.expected?.actions?.length) { put({ ...row, status: 'answered', clarification: row.expected?.clarification || null }); continue; }
      if (recordVersion(message.actions) !== recordVersion(row.expected.actions)) { put({ ...row, status: 'conflict', error: '요청과 다른 실행 결과라 저장하지 않았어요.' }); continue; }
      put({ ...row, status: 'prepared', action: row.expected.actions[0], targetId: `schedule-ai-${row.requestId}` });
      execute(row.id);
    }
  }
  function undo(id) {
    let row = get(id);
    if (!row || !['done', 'undoing'].includes(row.status) || (row.status === 'done' && now() > row.undoUntil)) return;
    const items = repository.read(), item = items.find(i => i.id === row.targetId);
    if (!item && row.status === 'undoing') return put({ ...row, status: 'undone', error: '' });
    if (!item || recordVersion(item) !== row.savedVersion) return put({ ...row, status: 'conflict', error: '등록 후 일정이 바뀌어 되돌리지 않았어요.' });
    row = put({ ...row, status: 'undoing' });
    if (!repository.save(items.filter(i => i.id !== row.targetId))?.saved) throw Error('되돌리기를 저장하지 못했어요. 다시 확인해주세요.');
    return put({ ...row, status: 'undone', error: '' });
  }
  function recover(runtime) {
    for (const row of list().filter(r => r.runtime === runtime)) {
      if (row.status === 'undoing') undo(row.id);
      else if (['prepared', 'saving'].includes(row.status)) execute(row.id);
    }
  }
  return { list, get, register, accept, execute, undo, recover,
    cancel(threadId, runtime) { for (const r of list().filter(r => r.threadId === threadId && r.runtime === runtime && ['waiting', 'prepared'].includes(r.status))) put({ ...r, status: 'cancelled' }); },
    invalidate() { for (const row of list().filter(r => !terminal.has(r.status))) put({ ...row, status: 'cancelled', error: '백업 복원으로 이전 요청을 취소했어요.' }); },
    clearClarification(threadId, runtime) { for (const row of list().filter(r => r.threadId === threadId && r.runtime === runtime && r.clarification)) put({ ...row, clarification: null }); },
    pending(threadId, runtime) { return list().filter(r => r.threadId === threadId && r.runtime === runtime && now() - r.createdAt < 10 * 60000).sort((a,b) => b.createdAt-a.createdAt)[0]?.clarification || null; }
  };
}
