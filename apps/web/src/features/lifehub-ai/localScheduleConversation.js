let localSequence = 0;

function nextId(prefix, createdAt) {
  localSequence += 1;
  return `${prefix}-${Date.parse(createdAt) || Date.now()}-${localSequence}`;
}

function localMessage(role, content, createdAt, id) {
  return {
    id,
    role,
    content: String(content || ''),
    status: 'complete',
    createdAt
  };
}

export function createLocalScheduleThread({ text, reply, mode = 'assistant', createdAt = new Date().toISOString() }) {
  const id = nextId('local-schedule-thread', createdAt);
  return {
    id,
    appThreadId: id,
    codexThreadId: '',
    localOnly: true,
    title: String(text || '일정 추가').trim().replace(/\s+/g, ' ').slice(0, 34) || '일정 추가',
    mode: mode === 'codex' ? 'codex' : 'assistant',
    projectId: '',
    cwd: '이 기기',
    createdAt,
    updatedAt: createdAt,
    eventCursor: 0,
    pendingScheduleRequest: null,
    messages: [
      localMessage('user', text, createdAt, `${id}-user-1`),
      localMessage('assistant', reply, createdAt, `${id}-assistant-1`)
    ]
  };
}

export function appendLocalScheduleExchange(thread, { text, reply, createdAt = new Date().toISOString() }) {
  const sequence = nextId('exchange', createdAt);
  return {
    ...thread,
    localOnly: true,
    updatedAt: createdAt,
    messages: [
      ...(Array.isArray(thread?.messages) ? thread.messages : []),
      localMessage('user', text, createdAt, `${thread.id}-${sequence}-user`),
      localMessage('assistant', reply, createdAt, `${thread.id}-${sequence}-assistant`)
    ]
  };
}

export function mergeLocalScheduleThreads(remoteThreads, currentThreads) {
  const remote = Array.isArray(remoteThreads) ? remoteThreads : [];
  const local = (Array.isArray(currentThreads) ? currentThreads : []).filter((thread) => thread?.localOnly === true);
  const remoteIds = new Set(remote.map((thread) => thread.id));
  return [...local.filter((thread) => !remoteIds.has(thread.id)), ...remote]
    .sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')));
}
