function comparableTitle(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ko-KR');
}

export function prepareAssistantScheduleChange(currentItems, draft, requestId, {
  normalize,
  createId = () => `schedule-ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
} = {}) {
  const current = Array.isArray(currentItems) ? currentItems : [];
  const existingRequest = current.find((item) => item?.origin?.kind === 'ai-chat' && item.origin.requestId === requestId);
  if (existingRequest) return { status: 'duplicate', item: existingRequest };

  const title = comparableTitle(draft?.title);
  const duplicate = current.find((item) => (
    comparableTitle(item?.title) === title
    && item?.date === draft?.date
    && (item?.time || '') === (draft?.time || '')
  ));
  if (duplicate) return { status: 'duplicate', item: duplicate };
  if (!title || typeof normalize !== 'function') return { status: 'failed' };

  const item = normalize({
    id: createId(),
    title: draft.title,
    category: draft.category || 'etc',
    date: draft.date,
    time: draft.time || '',
    priority: '보통',
    note: '',
    repeat: 'none',
    repeatDays: [],
    reminder: 'none',
    recurrence: 'none',
    recurrenceEnd: '',
    status: 'scheduled',
    done: false,
    source: 'ai-chat',
    origin: { kind: 'ai-chat', requestId }
  });
  return item ? { status: 'created', item, items: [...current, item] } : { status: 'failed' };
}
