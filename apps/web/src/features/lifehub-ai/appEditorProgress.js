const COMPLETED_TODO_STATUSES = new Set(['complete', 'completed', 'done', 'success', 'succeeded']);
const ACTIVE_TODO_STATUSES = new Set(['active', 'in-progress', 'in_progress', 'running', 'started', 'working']);
const FAILED_TODO_STATUSES = new Set(['error', 'errored', 'failed', 'failure']);
const SKIPPED_TODO_STATUSES = new Set(['cancelled', 'canceled', 'skipped']);

const SUCCESS_COMMAND_STATUSES = new Set(['complete', 'completed', 'done', 'success', 'succeeded']);
const RUNNING_COMMAND_STATUSES = new Set(['active', 'in-progress', 'in_progress', 'pending', 'running', 'started', 'streaming']);
const FAILED_COMMAND_STATUSES = new Set(['cancelled', 'canceled', 'error', 'errored', 'failed', 'failure', 'timed-out', 'timed_out', 'timeout']);

function arrayFromPayload(value, key) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.[key])) return value[key];
  if (Array.isArray(value?.data?.[key])) return value.data[key];
  if (Array.isArray(value?.data?.data?.[key])) return value.data.data[key];
  return [];
}

function compactText(value, maximum = 240) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maximum);
}

function normalizedStatus(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '-');
}

function normalizeTodoStatus(item) {
  const source = normalizedStatus(item?.status);
  if (item?.completed === true) return 'completed';
  if (item?.completed !== false && COMPLETED_TODO_STATUSES.has(source)) return 'completed';
  if (FAILED_TODO_STATUSES.has(source)) return 'failed';
  if (SKIPPED_TODO_STATUSES.has(source)) return 'skipped';
  if (ACTIVE_TODO_STATUSES.has(source)) return 'in-progress';
  return 'pending';
}

/**
 * Normalizes a todo.updated event, its payload, or an items array.
 */
export function normalizeAppEditorTodos(value) {
  return arrayFromPayload(value, 'items').flatMap((item, index) => {
    const source = typeof item === 'string' ? { text: item } : item;
    if (!source || typeof source !== 'object') return [];
    const text = compactText(source.text || source.title || source.description, 500);
    if (!text) return [];
    const status = normalizeTodoStatus(source);
    return [{
      id: compactText(source.id, 160) || `todo-${index}`,
      text,
      status,
      completed: status === 'completed'
    }];
  });
}

function latestUniqueRows(value, keyFor) {
  const rows = Array.isArray(value) ? value : [];
  const order = [];
  const latest = new Map();
  rows.forEach((row, index) => {
    const key = keyFor(row, index);
    if (!latest.has(key)) order.push(key);
    latest.set(key, row);
  });
  return order.map((key) => latest.get(key));
}

function commandKey(command, index) {
  const id = compactText(command?.id || command?.commandId, 160);
  return id ? `id:${id}` : `row:${index}`;
}

function commandState(command) {
  const status = normalizedStatus(command?.status);
  const rawExitCode = command?.exitCode ?? command?.exit_code;
  const exitCode = rawExitCode === null || rawExitCode === undefined || rawExitCode === ''
    ? null
    : Number(rawExitCode);
  if ((Number.isFinite(exitCode) && exitCode !== 0) || FAILED_COMMAND_STATUSES.has(status)) return 'failed';
  if (exitCode === 0 || SUCCESS_COMMAND_STATUSES.has(status)) return 'succeeded';
  if (RUNNING_COMMAND_STATUSES.has(status)) return 'running';
  return 'pending';
}

function uniqueFileCount(changes) {
  const keys = new Set();
  (Array.isArray(changes) ? changes : []).forEach((change, index) => {
    const raw = typeof change === 'string'
      ? change
      : change?.path || change?.file || change?.name || change?.id;
    const key = compactText(raw, 1_024);
    keys.add(key || `row:${index}`);
  });
  return keys.size;
}

function errorMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return compactText(error, 500);
  return compactText(error?.message || error?.error?.message || error?.error, 500);
}

function finalText(value) {
  if (typeof value === 'string') return value.trim();
  return String(value?.content || value?.text || value?.message || '').trim();
}

function approvalStatus(approval) {
  return normalizedStatus(approval?.status || 'pending');
}

function pendingApprovalActivity(approval) {
  const description = compactText(approval?.description || approval?.title, 180);
  return description ? `승인 대기: ${description}` : '작업 승인을 기다리고 있어요';
}

function runningCommandActivity(command) {
  const label = compactText(command?.command || command?.value, 180);
  return label ? `명령 실행 중: ${label}` : '명령을 실행하고 있어요';
}

/**
 * Derives the app editor status panel from the existing AI workspace state.
 * `percent` is null without a real Codex todo list; it is never estimated from
 * commands, elapsed time, or streamed text.
 */
export function deriveAppEditorProgress({
  todos: todoSource = [],
  streaming = false,
  approvals = [],
  commands = [],
  changes = [],
  finalResult = '',
  error = ''
} = {}) {
  const todos = normalizeAppEditorTodos(todoSource);
  const totalTodoCount = todos.length;
  const completedTodoCount = todos.filter((todo) => todo.completed).length;
  const failedTodoCount = todos.filter((todo) => todo.status === 'failed').length;
  const activeTodo = todos.find((todo) => todo.status === 'in-progress')
    || todos.find((todo) => !todo.completed && !['failed', 'skipped'].includes(todo.status))
    || null;
  const percent = totalTodoCount
    ? Math.round((completedTodoCount / totalTodoCount) * 100)
    : null;

  const commandRows = latestUniqueRows(commands, commandKey);
  const commandStates = commandRows.map((command) => ({ command, state: commandState(command) }));
  const successfulCommandCount = commandStates.filter((entry) => entry.state === 'succeeded').length;
  const failedCommandCount = commandStates.filter((entry) => entry.state === 'failed').length;
  const runningCommands = commandStates.filter((entry) => entry.state === 'running');
  const runningCommandCount = runningCommands.length;
  const fileCount = uniqueFileCount(changes);

  const approvalRows = Array.isArray(approvals) ? approvals : [];
  const pendingApprovals = approvalRows.filter((approval) => ['pending', 'awaiting', 'awaiting-approval'].includes(approvalStatus(approval)));
  const rejectedApprovalCount = approvalRows.filter((approval) => ['rejected', 'denied'].includes(approvalStatus(approval))).length;
  const pendingApprovalCount = pendingApprovals.length;
  const result = finalText(finalResult);
  const message = errorMessage(error);

  let phase = 'idle';
  let currentActivity = '수정 요청을 입력해주세요';
  let outcome = 'idle';

  if (message) {
    phase = 'failed';
    currentActivity = message;
    outcome = 'failure';
  } else if (pendingApprovalCount) {
    phase = 'awaiting-approval';
    currentActivity = pendingApprovalActivity(pendingApprovals[0]);
    outcome = 'attention';
  } else if (streaming) {
    outcome = 'in-progress';
    if (runningCommandCount) {
      phase = 'executing';
      currentActivity = runningCommandActivity(runningCommands[0].command);
    } else if (activeTodo) {
      phase = 'working';
      currentActivity = activeTodo.text;
    } else if (totalTodoCount && completedTodoCount === totalTodoCount) {
      phase = 'finalizing';
      currentActivity = '변경 결과를 정리하고 있어요';
    } else if (fileCount) {
      phase = 'editing';
      currentActivity = `${fileCount}개 파일의 변경 내용을 확인하고 있어요`;
    } else {
      phase = 'planning';
      currentActivity = '수정 요청을 분석하고 있어요';
    }
  } else if (result) {
    phase = 'completed';
    if (failedCommandCount || failedTodoCount) {
      currentActivity = '작업은 끝났지만 확인이 필요한 항목이 있어요';
      outcome = 'partial';
    } else {
      currentActivity = '앱 수정 작업을 완료했어요';
      outcome = 'success';
    }
  } else if (rejectedApprovalCount) {
    phase = 'failed';
    currentActivity = '작업 승인이 거부되었어요';
    outcome = 'failure';
  } else if (failedCommandCount || failedTodoCount) {
    phase = 'failed';
    currentActivity = failedCommandCount ? '명령 실행에 실패했어요' : '작업 항목을 완료하지 못했어요';
    outcome = 'failure';
  } else if (
    (totalTodoCount > 0 && completedTodoCount === totalTodoCount)
    || successfulCommandCount > 0
    || fileCount > 0
  ) {
    phase = 'completed';
    currentActivity = '앱 수정 작업을 완료했어요';
    outcome = 'success';
  }

  return {
    phase,
    currentActivity,
    outcome,
    todos,
    percent,
    totalTodoCount,
    completedTodoCount,
    failedTodoCount,
    pendingApprovalCount,
    rejectedApprovalCount,
    commandCount: commandRows.length,
    runningCommandCount,
    successfulCommandCount,
    failedCommandCount,
    fileCount,
    hasFinalResult: Boolean(result),
    error: message
  };
}
