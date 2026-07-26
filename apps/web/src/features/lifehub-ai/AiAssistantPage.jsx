import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MemoNavIcon from '../../components/MemoNavIcon.jsx';
import { parseLifeRecordAction } from '../life-records/lifeRecordAction.js';
import { createApprovalPlan } from './approvalPlan.js';
import {
  NATIVE_NOTIFICATION_PERMISSION_EVENT,
  hasNativeNotificationApi,
  nativeNotificationPermissionState,
  requestNativeNotificationPermission,
  shouldDeliverNativeNotification,
  showNativeNotification,
  stableNativeNotificationId
} from './nativeNotifications.js';
import useBridgeConnection from './useBridgeConnection.js';
import {
  cacheProjects,
  cacheThreads,
  readCachedThreads,
  selectProject,
  selectedProjectId
} from './bridgeStorage.js';
import {
  APP_EDITOR_EXPERIENCE,
  appEditorTurnDefaults
} from './appEditorExperience.js';
import AppEditorProgressPanel from './AppEditorProgressPanel.jsx';
import {
  deriveAppEditorProgress,
  normalizeAppEditorTodos
} from './appEditorProgress.js';
import {
  appendLocalScheduleExchange,
  createLocalScheduleThread,
  mergeLocalScheduleThreads
} from './localScheduleConversation.js';
import {
  parseScheduleCreateRequest,
  scheduleConfirmationText
} from './scheduleChatAction.js';

const TURN_PERMISSION_OPTIONS = [
  { value: 'file:write', label: '파일 수정', detail: '등록된 프로젝트 안의 파일 변경' },
  { value: 'command:execute', label: '명령 실행', detail: '허용 목록 또는 별도 승인 명령' },
  { value: 'build:execute', label: '빌드 실행', detail: '테스트와 프로젝트 빌드' },
  { value: 'git', label: 'Git 작업', detail: 'diff 외 Git 상태 변경 작업' }
];

const REMOTE_COMMAND_PERMISSIONS = ['command:execute', 'build:execute', 'git'];
const REMOTE_COMMAND_PRESETS = ['git status', 'git diff --stat', 'git push'];
const REMOTE_PERMISSION_LABELS = {
  'command:execute': '명령 실행',
  'build:execute': '빌드·테스트 실행',
  git: 'Git 작업'
};
const REMOTE_RISK_LABELS = {
  low: '낮음',
  medium: '보통',
  high: '높음',
  critical: '매우 높음'
};

const DESKTOP_FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

export function shouldSubmitComposerOnEnter(
  event,
  matchMedia = globalThis.matchMedia?.bind(globalThis)
) {
  if (
    event?.key !== 'Enter'
    || event.shiftKey
    || event.isComposing
    || event.nativeEvent?.isComposing
    || typeof matchMedia !== 'function'
  ) {
    return false;
  }
  return matchMedia(DESKTOP_FINE_POINTER_QUERY)?.matches === true;
}

function arrayPayload(payload, ...keys) {
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  }
  if (Array.isArray(payload?.data)) return payload.data;
  return Array.isArray(payload) ? payload : [];
}

function contentText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((part) => contentText(part?.text ?? part?.content ?? part)).filter(Boolean).join('\n');
  }
  if (value && typeof value === 'object') return contentText(value.text ?? value.content ?? value.output_text ?? '');
  return '';
}

function safePathLabel(value, fallback = '') {
  const raw = String(value || '').trim();
  if (!raw) return String(fallback || '');
  if (raw.startsWith('/') || /^[a-z]:[\\/]/i.test(raw) || raw.startsWith('~')) {
    const parts = raw.split(/[\\/]+/).filter(Boolean);
    return parts.length ? `…/${parts[parts.length - 1]}` : String(fallback || '');
  }
  return raw.replace(/(^|[\\/])\.\.([\\/]|$)/g, '$1…$2');
}

function safeCommandLabel(value) {
  return String(value || '')
    .replace(/(?:^|\s)(\/[\w.@~+,:=-]+(?:\/[\w.@~+,:=-]+)+)/g, (match, path) => match.replace(path, safePathLabel(path)))
    .replace(/[a-z]:\\[^\s"']+/gi, (path) => safePathLabel(path));
}

function normalizeMessage(message, index = 0) {
  const role = message?.role === 'user' || message?.type === 'user' ? 'user' : 'assistant';
  return {
    id: String(message?.id || `message-${Date.now()}-${index}`),
    role,
    content: contentText(message?.content ?? message?.text ?? message?.message),
    status: String(message?.status || 'complete'),
    createdAt: message?.createdAt || message?.created_at || new Date().toISOString(),
    error: message?.error ? String(message.error?.message || message.error) : ''
  };
}

function normalizeThread(thread = {}, index = 0, fallbackMode = 'assistant') {
  const source = thread.thread && typeof thread.thread === 'object' ? thread.thread : thread;
  const id = String(source.appThreadId || source.id || source.threadId || `thread-${Date.now()}-${index}`);
  const eventCursor = arrayPayload(source, 'events').reduce((maximum, event) => Math.max(maximum, Number(event?.id) || 0), Number(source.eventCursor) || 0);
  return {
    ...source,
    id,
    appThreadId: String(source.appThreadId || id),
    codexThreadId: String(source.codexThreadId || source.codex_thread_id || source.sdkThreadId || ''),
    title: String(source.title || '새 대화'),
    mode: source.mode === 'codex' ? 'codex' : fallbackMode,
    projectId: String(source.projectId || source.project?.id || ''),
    cwd: safePathLabel(
      source.cwdLabel || source.pathLabel || source.project?.cwdLabel || source.project?.pathLabel
        || source.cwd || source.workingDirectory || source.project?.workingDirectory,
      source.project?.name
    ),
    createdAt: source.createdAt || source.created_at || new Date().toISOString(),
    updatedAt: source.updatedAt || source.updated_at || source.createdAt || new Date().toISOString(),
    eventCursor,
    messages: arrayPayload(source, 'messages', 'items').map(normalizeMessage)
  };
}

function normalizeProject(project, index = 0) {
  const name = String(project?.name || project?.displayName || project?.slug || '등록된 프로젝트');
  return {
    id: String(project?.id || project?.slug || project?.name || `project-${index}`),
    name,
    cwd: safePathLabel(project?.cwdLabel || project?.pathLabel || project?.workingDirectory || project?.cwd, name),
    permissions: project?.permissions || {}
  };
}

function eventData(frame) {
  if (!frame?.data || typeof frame.data !== 'object') return { value: frame?.data };
  if (frame.data.data && typeof frame.data.data === 'object') {
    return { ...frame.data.data, type: frame.data.type || frame.event, eventId: frame.data.id };
  }
  return frame.data;
}

function eventType(frame) {
  const data = eventData(frame);
  return String(data.type || data.event || frame?.event || 'message').toLowerCase();
}

function streamDelta(frame) {
  const data = eventData(frame);
  const type = eventType(frame);
  if (typeof frame?.data === 'string') return frame.data;
  const candidate = data.delta ?? data.textDelta ?? data.text_delta ?? data.contentDelta ?? data.content_delta;
  if (candidate !== undefined) return contentText(candidate);
  if (type.includes('delta')) return contentText(data.text ?? data.content ?? data.item);
  return '';
}

function streamFinalText(frame) {
  const data = eventData(frame);
  const type = eventType(frame);
  if (!(type.includes('completed') || type.includes('final') || type === 'done')) return '';
  return contentText(data.output ?? data.result ?? data.message ?? data.content ?? data.item?.content ?? data.text);
}

function streamError(frame) {
  const data = eventData(frame);
  const type = eventType(frame);
  if (!type.includes('error') && !type.includes('failed')) return '';
  return String(data.error?.message || data.error || data.message || 'AI 응답 처리 중 오류가 발생했습니다.');
}

function isTerminalEvent(frame) {
  const type = eventType(frame);
  return type === 'done'
    || type === 'message.completed'
    || type === 'thread.completed'
    || type === 'response.completed'
    || type === 'turn.failed'
    || type === 'response.failed'
    || type === 'turn.cancelled'
    || type === 'cancelled';
}

function approvalFromEvent(frame) {
  const data = eventData(frame);
  const type = eventType(frame);
  const source = data.approval || data.request || (type.includes('approval') ? data : null);
  if (!source) return null;
  return {
    id: String(source.id || source.approvalId || data.id || `approval-${Date.now()}`),
    status: String(source.status || 'pending'),
    description: String(source.description || source.title || 'Codex가 작업 승인을 요청했습니다.'),
    project: String(source.projectName || source.project || source.projectId || ''),
    files: Array.isArray(source.files) ? source.files.map((file) => safePathLabel(file, '변경 파일')) : [],
    command: safeCommandLabel(Array.isArray(source.commands) ? source.commands.join(' · ') : Array.isArray(source.command) ? source.command.join(' ') : source.command),
    permission: Array.isArray(source.permissions) ? source.permissions.join(', ') : String(source.permission || source.capability || '작업 실행'),
    risk: String(source.risk || source.riskLevel || '보통').toLowerCase()
  };
}

function commandFromEvent(frame) {
  const data = eventData(frame);
  const type = eventType(frame);
  if (!type.includes('command') && !type.includes('exec')) return null;
  const source = data.command && typeof data.command === 'object' ? data.command : data;
  const exitCode = source.exitCode ?? source.exit_code ?? null;
  const rawStatus = String(source.status || '').toLowerCase();
  const status = type.includes('failed')
    || type.includes('error')
    || ['failed', 'error', 'cancelled', 'canceled'].includes(rawStatus)
    || (exitCode !== null && Number(exitCode) !== 0)
    ? 'failed'
    : type.includes('completed') || ['completed', 'complete', 'done', 'success'].includes(rawStatus)
      ? 'completed'
      : 'running';
  return {
    id: String(source.id || source.commandId || `command-${Date.now()}`),
    command: safeCommandLabel(Array.isArray(source.argv) ? source.argv.join(' ') : source.command || source.value),
    status,
    exitCode
  };
}

function artifactsFromEvents(events) {
  const approvals = [];
  const commands = [];
  const changes = [];
  let todos = [];
  let finalResult = '';
  for (const event of Array.isArray(events) ? events : []) {
    const frame = { event: event.type, id: event.id, data: event };
    const approval = approvalFromEvent(frame);
    const command = commandFromEvent(frame);
    const finalText = streamFinalText(frame);
    const data = eventData(frame);
    if (approval) {
      const index = approvals.findIndex((item) => item.id === approval.id);
      if (index >= 0 && (eventType(frame) === 'approval.approved' || eventType(frame) === 'approval.rejected')) {
        approvals[index] = { ...approvals[index], status: approval.status };
      } else if (index >= 0) approvals[index] = approval;
      else approvals.push(approval);
    }
    if (command) {
      const index = commands.findIndex((item) => item.id === command.id);
      if (index >= 0) commands[index] = command;
      else commands.push(command);
    }
    if (eventType(frame) === 'file.changed' && Array.isArray(data.changes)) {
      for (const change of data.changes) {
        const row = {
          id: String(change?.path || change?.id || `change-${changes.length}`),
          path: safePathLabel(change?.path, '변경 파일'),
          status: String(change?.kind || change?.status || 'modified'),
          diff: ''
        };
        const index = changes.findIndex((item) => item.id === row.id);
        if (index >= 0) changes[index] = row;
        else changes.push(row);
      }
    }
    if (eventType(frame) === 'todo.updated') todos = normalizeAppEditorTodos(frame);
    if (finalText) finalResult = finalText;
  }
  return {
    approvals: approvals.filter(Boolean),
    commands: commands.filter(Boolean),
    changes: changes.filter(Boolean),
    todos,
    finalResult
  };
}

function changeRows(payload) {
  const combinedDiff = String(payload?.diff || payload?.data?.diff || '');
  return arrayPayload(payload, 'changes', 'files', 'items').map((change, index) => ({
    id: typeof change === 'string' ? change : String(change?.id || change?.path || `change-${index}`),
    path: safePathLabel(typeof change === 'string' ? change : change?.path || change?.file || change?.name, '변경 파일'),
    status: typeof change === 'string' ? 'modified' : String(change?.status || change?.kind || 'modified'),
    diff: typeof change === 'string' ? (index === 0 ? combinedDiff : '') : String(change?.diff || change?.patch || (index === 0 ? combinedDiff : ''))
  }));
}

function threadTitleFromMessage(text) {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.slice(0, 42) || '새 대화';
}

const LIFE_RECORD_COPY = Object.freeze({
  memo: { noun: '메모', success: '메모를 저장했어요.', linkLabel: '메모', path: '/memo' },
  expense: { noun: '지출', success: '지출을 기록했어요.', linkLabel: '가계부', path: '/finance' },
  income: { noun: '수입', success: '수입을 기록했어요.', linkLabel: '가계부', path: '/finance' },
  workout: { noun: '운동', success: '운동을 기록했어요.', linkLabel: '운동', path: '/workout' },
  diet: { noun: '식단', success: '식단을 기록했어요.', linkLabel: '식단', path: '/diet' }
});

function lifeRecordDecision(text) {
  const input = String(text || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (/^저장(?:해\s*줘|해주세요|해줘)?[.!?]?$/.test(input)) return 'save';
  if (/^취소(?:해\s*줘|해주세요|해줘)?[.!?]?$/.test(input)) return 'cancel';
  return '';
}

function lifeRecordPreviewText(action) {
  const copy = LIFE_RECORD_COPY[action?.kind];
  if (!copy) return '';
  return `저장 전 ${copy.noun} 미리보기예요.\n\n${action.confirmationText}\n\n내용이 맞으면 **저장**, 그만두려면 **취소**라고 입력해주세요.`;
}

function lifeRecordResultText(action, outcome) {
  const copy = LIFE_RECORD_COPY[action?.kind] || LIFE_RECORD_COPY.memo;
  if (outcome === 'duplicate') {
    return `같은 ${copy.noun} 기록이 이미 있어요. 중복 저장하지 않았어요.\n\n[${copy.linkLabel}에서 확인하기](${copy.path})`;
  }
  if (outcome !== 'created' && outcome !== 'saved') {
    return `${copy.noun} 기록을 저장하지 못했어요. 입력한 내용은 저장되지 않았습니다. 다시 시도하려면 **저장**, 그만두려면 **취소**라고 입력해주세요.`;
  }
  return `${copy.success}\n\n[${copy.linkLabel}에서 확인하기](${copy.path})`;
}

function bridgePermissionNames(value) {
  if (Array.isArray(value)) return value.map(String);
  if (!value || typeof value !== 'object') return [];
  return [
    value.chat !== false ? 'chat' : '',
    value.projectRead ? 'project:read' : '',
    value.fileWrite ? 'file:write' : '',
    value.commandRun ? 'command:execute' : '',
    value.buildRun ? 'build:execute' : '',
    value.git ? 'git' : ''
  ].filter(Boolean);
}

function bridgeErrorMessage(error, fallback = 'Bridge 요청을 처리하지 못했습니다.') {
  if (error?.code === 'CODEX_LOGIN_REQUIRED') {
    return 'PC에서 Codex 로그인이 필요합니다. PC 터미널에서 codex login을 실행한 뒤 다시 시도해주세요.';
  }
  return String(error?.message || fallback);
}

function InlineCode({ node, className, children, ...props }) {
  return <code className={className} {...props}>{children}</code>;
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand?.('copy') === true;
  } finally {
    textarea.remove();
  }
}

function CodeBlock({ node, children }) {
  const [copied, setCopied] = useState(false);
  const child = Array.isArray(children) ? children[0] : children;
  const value = String(child?.props?.children || '').replace(/\n$/, '');
  const className = child?.props?.className;
  const copy = async () => {
    try {
      setCopied(await copyText(value));
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="lifeHubAiCodeBlock">
      <button type="button" onClick={copy}>{copied ? '복사됨' : '코드 복사'}</button>
      <pre><code className={className}>{value}</code></pre>
    </div>
  );
}

function MarkdownMessage({ content, streaming }) {
  const [expanded, setExpanded] = useState(false);
  const long = content.length > 1600 || content.split('\n').length > 28;
  return (
    <div className="lifeHubAiMarkdown">
      <div className={`lifeHubAiMarkdownBody ${long && !expanded ? 'collapsed' : ''}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: InlineCode, pre: CodeBlock }}>
          {content || (streaming ? '응답을 기다리는 중…' : '')}
        </ReactMarkdown>
        {streaming ? <span className="lifeHubAiTyping" aria-label="응답 생성 중"><i /><i /><i /></span> : null}
      </div>
      {long ? <button type="button" className="lifeHubAiExpand" onClick={() => setExpanded((value) => !value)}>{expanded ? '긴 응답 접기' : '긴 응답 펼치기'}</button> : null}
    </div>
  );
}

function ChatMessage({ message, onResend, onRetry }) {
  return (
    <article className={`lifeHubAiMessage ${message.role} ${message.status || ''}`}>
      <header>
        <strong>{message.role === 'user' ? '나' : 'AI Assistant'}</strong>
        <time>{new Date(message.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</time>
      </header>
      {message.role === 'assistant' ? (
        <MarkdownMessage content={message.content} streaming={message.status === 'streaming'} />
      ) : <p>{message.content}</p>}
      {message.error ? <p className="lifeHubAiMessageError">{message.error}</p> : null}
      <footer>
        {message.role === 'user' ? <button type="button" onClick={() => onResend(message.content)}><MemoNavIcon type="message" />재전송</button> : null}
        {message.status === 'error' || message.status === 'failed' ? <button type="button" onClick={() => onRetry(message.retryText || '')}><MemoNavIcon type="refresh" />다시 시도</button> : null}
      </footer>
    </article>
  );
}

function ApprovalCard({ approval, busy, onApprove, onReject }) {
  return (
    <article className={`lifeHubAiApproval ${approval.risk}`}>
      <header><div><span>작업 승인 요청</span><strong>{approval.description}</strong></div><em>{approval.risk || '보통'} 위험</em></header>
      <dl>
        <div><dt>대상 프로젝트</dt><dd>{approval.project || '현재 선택 프로젝트'}</dd></div>
        <div><dt>예상 권한</dt><dd>{approval.permission}</dd></div>
        <div><dt>변경 예정 파일</dt><dd>{approval.files.length ? approval.files.join(', ') : 'Codex 실행 전에는 확인되지 않음'}</dd></div>
        <div><dt>실행 예정 명령</dt><dd>{approval.command ? <code>{approval.command}</code> : 'Codex 실행 전에는 확인되지 않음'}</dd></div>
      </dl>
      {approval.status === 'pending' ? (
        <div className="lifeHubAiApprovalActions">
          <button type="button" disabled={busy} onClick={() => onApprove(approval, 'once')}>{approval.risk === 'critical' ? '위험 작업 1회 허용' : '이번만 허용'}</button>
          {approval.risk !== 'critical' ? <button type="button" disabled={busy} onClick={() => onApprove(approval, 'task')}>이 작업 동안 허용</button> : null}
          <button type="button" className="danger" disabled={busy} onClick={() => onReject(approval)}>거부</button>
        </div>
      ) : <p className="lifeHubAiApprovalResult">{approval.status === 'approved' ? '승인됨' : '거부됨'}</p>}
    </article>
  );
}

function remoteResponseValue(payload, key) {
  if (payload?.[key] && typeof payload[key] === 'object') return payload[key];
  if (payload?.data?.[key] && typeof payload.data[key] === 'object') return payload.data[key];
  if (payload?.data && typeof payload.data === 'object') return payload.data;
  return payload && typeof payload === 'object' ? payload : {};
}

function normalizeGitPush(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    remote: String(value.remote || ''),
    branch: String(value.branch || ''),
    head: String(value.head || ''),
    host: String(value.host || '')
  };
}

function normalizeRemoteApproval(payload, fallbackProject = '') {
  const source = remoteResponseValue(payload, 'approval');
  const id = String(source.id || source.approvalId || '');
  if (!id) return null;
  return {
    id,
    command: safeCommandLabel(source.command),
    permission: String(source.permission || ''),
    permissions: Array.isArray(source.permissions)
      ? source.permissions.map(String)
      : source.permission ? [String(source.permission)] : [],
    risk: String(source.risk || 'high').toLowerCase(),
    expiresAt: String(source.expiresAt || ''),
    project: String(source.project?.name || source.project || fallbackProject),
    gitPush: normalizeGitPush(source.gitPush)
  };
}

function normalizeRemoteResult(payload, fallbackProject = '') {
  const source = remoteResponseValue(payload, 'result');
  return {
    command: safeCommandLabel(source.command),
    stdout: String(source.stdout || ''),
    stderr: String(source.stderr || ''),
    exitCode: Number.isInteger(source.exitCode) ? source.exitCode : null,
    timedOut: source.timedOut === true,
    durationMs: Number.isFinite(Number(source.durationMs)) ? Number(source.durationMs) : 0,
    project: String(source.project?.name || source.project || fallbackProject),
    gitPush: normalizeGitPush(source.gitPush)
  };
}

function remoteExpiryLabel(value) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'medium' })
    : '잠시 후 만료';
}

function remoteDurationLabel(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return '측정 안 됨';
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
  return `${(durationMs / 1000).toFixed(durationMs < 10000 ? 1 : 0)}초`;
}

function GitPushFacts({ gitPush }) {
  if (!gitPush) return null;
  return (
    <dl className="lifeHubAiRemoteGitFacts">
      <div><dt>원격 저장소</dt><dd>{gitPush.remote || '기본 remote'}</dd></div>
      <div><dt>브랜치</dt><dd>{gitPush.branch || '현재 브랜치'}</dd></div>
      <div><dt>HEAD</dt><dd><code>{gitPush.head || '확인 중'}</code></dd></div>
      <div><dt>호스트</dt><dd>{gitPush.host || '등록된 Git 호스트'}</dd></div>
    </dl>
  );
}

function RemoteCommandPanel({
  client,
  connected,
  capability,
  permissions,
  project,
  aiBusy,
  onBusyChange
}) {
  const [command, setCommand] = useState('');
  const [approval, setApproval] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const requestRef = useRef(null);
  const permissionReady = REMOTE_COMMAND_PERMISSIONS.some((permission) => permissions.includes(permission));
  const enabled = connected && capability && permissionReady && Boolean(client && project?.id) && !aiBusy;

  const updateBusy = useCallback((value) => {
    setBusy(value);
    onBusyChange(Boolean(value));
  }, [onBusyChange]);

  useEffect(() => {
    requestRef.current?.abort('context-changed');
    requestRef.current = null;
    setCommand('');
    setApproval(null);
    setConfirmed(false);
    setResult(null);
    setError('');
    updateBusy('');
  }, [client, project?.id, updateBusy]);

  useEffect(() => () => {
    requestRef.current?.abort('unmount');
    onBusyChange(false);
  }, [onBusyChange]);

  const disabledReason = !capability
    ? '서버에서 원격 명령 기능이 비활성화되었거나 현재 Bridge가 지원하지 않습니다. 서버 설정과 Bridge 버전을 확인해주세요.'
    : !permissionReady
      ? '이 기기에 명령 실행, 빌드·테스트 또는 Git 권한이 없습니다. 연결 설정에서 권한을 요청하고 PC에서 다시 승인해주세요.'
      : !project?.id
        ? '원격 명령을 실행할 등록 프로젝트를 먼저 선택해주세요.'
        : !connected
          ? 'PC Bridge 연결이 복구되면 원격 명령을 사용할 수 있습니다.'
          : aiBusy
            ? 'Codex 응답이 끝나면 원격 명령을 준비할 수 있습니다.'
            : '';

  const chooseCommand = (value) => {
    if (busy) return;
    setCommand(value);
    setApproval(null);
    setConfirmed(false);
    setError('');
  };

  const prepare = async (event) => {
    event?.preventDefault();
    const nextCommand = command.trim();
    if (!enabled || busy) return;
    if (!nextCommand) {
      setError('실행할 명령을 입력해주세요.');
      return;
    }
    if (/\r|\n/.test(nextCommand)) {
      setError('원격 명령은 한 번에 한 줄만 준비할 수 있습니다.');
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    updateBusy('preparing');
    setError('');
    setApproval(null);
    setConfirmed(false);
    setResult(null);
    try {
      const payload = await client.prepareRemoteCommand(project.id, { command: nextCommand }, { signal: controller.signal });
      const nextApproval = normalizeRemoteApproval(payload, project.name);
      if (!nextApproval) throw new Error('Bridge가 명령 승인 정보를 반환하지 않았습니다.');
      setCommand(nextApproval.command || nextCommand);
      setApproval(nextApproval);
    } catch (prepareError) {
      if (prepareError?.code !== 'CANCELLED' && prepareError?.name !== 'AbortError') {
        setError(bridgeErrorMessage(prepareError, '원격 명령을 준비하지 못했습니다.'));
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        updateBusy('');
      }
    }
  };

  const cancelApproval = () => {
    if (busy) return;
    setApproval(null);
    setConfirmed(false);
    setError('');
  };

  const cancelExecution = () => {
    if (busy !== 'executing') return;
    setError('실행 중지를 요청했습니다. 서버 프로세스를 종료하는 중입니다.');
    requestRef.current?.abort('user-cancelled');
  };

  const execute = async () => {
    if (!enabled || busy || !approval || !confirmed) return;
    const expiresAt = Date.parse(approval.expiresAt);
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      setApproval(null);
      setConfirmed(false);
      setError('명령 승인이 만료되었습니다. 같은 명령을 다시 준비해주세요.');
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    updateBusy('executing');
    setError('');
    setResult(null);
    try {
      const payload = await client.executeRemoteCommand(project.id, { approvalId: approval.id }, { signal: controller.signal });
      setResult(normalizeRemoteResult(payload, project.name));
      setApproval(null);
      setConfirmed(false);
      setCommand('');
    } catch (executeError) {
      setApproval(null);
      setConfirmed(false);
      if (executeError?.code !== 'CANCELLED' && executeError?.name !== 'AbortError') {
        setError(bridgeErrorMessage(executeError, '원격 명령 실행에 실패했습니다.'));
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        updateBusy('');
      }
    }
  };

  const resultTone = result?.timedOut ? 'timeout' : result?.exitCode === 0 ? 'success' : 'failed';
  const resultLabel = result?.timedOut ? '시간 초과' : result?.exitCode === 0 ? '완료' : '실패';

  return (
    <section className="lifeHubAiRemoteTerminal" aria-labelledby="lifehub-remote-command-title" aria-busy={Boolean(busy)}>
      <header>
        <div><span>등록 프로젝트 전용</span><h4 id="lifehub-remote-command-title">원격 명령</h4></div>
        <span className={`lifeHubAiRemoteState ${busy || (enabled ? 'ready' : 'disabled')}`}>
          {busy === 'preparing' ? '승인 준비 중' : busy === 'executing' ? '실행 중' : enabled ? '준비됨' : '비활성'}
        </span>
      </header>
      <p className="lifeHubAiRemoteIntro">서버 프로젝트에서 정확히 한 명령만 준비하고, 대상과 위험도를 확인한 뒤 한 번 실행합니다.</p>

      {disabledReason ? <div className="lifeHubAiRemoteDisabled"><MemoNavIcon type="shield" /><span>{disabledReason}</span></div> : null}

      <div className="lifeHubAiRemotePresets" aria-label="원격 명령 빠른 선택">
        {REMOTE_COMMAND_PRESETS.map((preset) => (
          <button
            type="button"
            key={preset}
            onClick={() => chooseCommand(preset)}
            disabled={!enabled || Boolean(busy) || Boolean(approval) || (preset.startsWith('git ') && !permissions.includes('git'))}
            title={preset.startsWith('git ') && !permissions.includes('git') ? 'Git 권한이 필요합니다.' : ''}
          >
            {preset}
          </button>
        ))}
      </div>

      <form className="lifeHubAiRemoteForm" onSubmit={prepare}>
        <label htmlFor="lifehub-remote-command-input">서버 명령</label>
        <div>
          <span aria-hidden="true">$</span>
          <input
            id="lifehub-remote-command-input"
            type="text"
            value={command}
            onChange={(event) => chooseCommand(event.target.value)}
            placeholder="예: npm test 또는 git push origin main"
            disabled={!enabled || Boolean(busy) || Boolean(approval)}
            maxLength={2000}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck="false"
          />
          <button type="submit" disabled={!enabled || Boolean(busy) || Boolean(approval) || !command.trim()}>
            {busy === 'preparing' ? '준비 중…' : '명령 준비'}
          </button>
        </div>
        <small>복합 shell 표현과 프로젝트 밖 경로는 Bridge에서 거부됩니다. 프로젝트 스크립트는 서버 계정 권한으로 실행되므로 신뢰한 코드만 승인하고, Git 인증 정보는 웹에 입력하지 마세요.</small>
      </form>

      {approval ? (
        <article className={`lifeHubAiRemoteApproval ${approval.risk}`}>
          <header><div><span>실행 전 최종 확인</span><strong>{approval.project || project?.name}</strong></div><em>{REMOTE_RISK_LABELS[approval.risk] || approval.risk} 위험</em></header>
          <code className="lifeHubAiRemoteCommandPreview">$ {approval.command}</code>
          <dl className="lifeHubAiRemoteApprovalFacts">
            <div><dt>필요 권한</dt><dd>{(approval.permissions.length ? approval.permissions : [approval.permission]).filter(Boolean).map((permission) => REMOTE_PERMISSION_LABELS[permission] || permission).join(', ') || '명령 실행'}</dd></div>
            <div><dt>승인 만료</dt><dd>{remoteExpiryLabel(approval.expiresAt)}</dd></div>
          </dl>
          <GitPushFacts gitPush={approval.gitPush} />
          <label className="lifeHubAiRemoteConfirm">
            <input type="checkbox" checked={confirmed} disabled={Boolean(busy)} onChange={(event) => setConfirmed(event.target.checked)} />
            <span>위 프로젝트와 명령{approval.gitPush ? ' 및 Git push 대상' : ''}을 확인했으며, 이 명령을 한 번 실행합니다.</span>
          </label>
          <div className="lifeHubAiRemoteApprovalActions">
            <button type="button" className="execute" disabled={!confirmed || Boolean(busy)} onClick={execute}>{busy === 'executing' ? '실행 중…' : '확인 후 실행'}</button>
            {busy === 'executing'
              ? <button type="button" onClick={cancelExecution}>실행 중지</button>
              : <button type="button" disabled={Boolean(busy)} onClick={cancelApproval}>취소</button>}
          </div>
        </article>
      ) : null}

      {error ? <div className="lifeHubAiRemoteError" role="alert"><MemoNavIcon type="shield" /><span>{error}</span></div> : null}

      {result ? (
        <section className={`lifeHubAiRemoteResult ${resultTone}`} aria-label="원격 명령 실행 결과">
          <header><div><span>마지막 실행 결과</span><strong>{result.project || project?.name}</strong></div><em>{resultLabel}</em></header>
          <dl>
            <div><dt>명령</dt><dd><code>{result.command || '실행 명령'}</code></dd></div>
            <div><dt>종료 코드</dt><dd>{result.exitCode === null ? '없음' : result.exitCode}</dd></div>
            <div><dt>실행 시간</dt><dd>{remoteDurationLabel(result.durationMs)}</dd></div>
          </dl>
          <GitPushFacts gitPush={result.gitPush} />
          {result.stdout ? <div className="lifeHubAiRemoteOutput"><strong>stdout</strong><pre tabIndex="0">{result.stdout}</pre></div> : null}
          {result.stderr ? <div className="lifeHubAiRemoteOutput stderr"><strong>stderr</strong><pre tabIndex="0">{result.stderr}</pre></div> : null}
          {!result.stdout && !result.stderr ? <p className="lifeHubAiRemoteNoOutput">명령 출력이 없습니다.</p> : null}
        </section>
      ) : null}
    </section>
  );
}

export default function AiAssistantPage({ navigate, experience = '', onCreateSchedule, onCreateLifeRecord }) {
  const appEditor = experience === APP_EDITOR_EXPERIENCE;
  const initialTurnPlan = appEditorTurnDefaults(appEditor);
  const { pc, client, status, refresh } = useBridgeConnection();
  const [mode, setMode] = useState(appEditor ? 'codex' : 'assistant');
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [threads, setThreads] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState('');
  const [lastFailedText, setLastFailedText] = useState('');
  const [approvals, setApprovals] = useState([]);
  const [approvalBusy, setApprovalBusy] = useState('');
  const [commands, setCommands] = useState([]);
  const [changes, setChanges] = useState([]);
  const [todos, setTodos] = useState([]);
  const [finalResult, setFinalResult] = useState('');
  const [diffOpen, setDiffOpen] = useState(false);
  const [turnPermissions, setTurnPermissions] = useState(initialTurnPlan.permissions);
  const [plannedFilesText, setPlannedFilesText] = useState(initialTurnPlan.filesText);
  const [plannedCommandsText, setPlannedCommandsText] = useState(initialTurnPlan.commandsText);
  const [reconnectThreadId, setReconnectThreadId] = useState('');
  const [remoteCommandBusy, setRemoteCommandBusy] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(() => nativeNotificationPermissionState());
  const [pendingScheduleRequest, setPendingScheduleRequest] = useState(null);
  const [pendingLifeRecordRequest, setPendingLifeRecordRequest] = useState(null);
  const abortRef = useRef(null);
  const activeThreadIdRef = useRef('');
  const messagesEndRef = useRef(null);
  const notifiedNativeEventsRef = useRef(new Set());
  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) || null;
  const selectedProject = projects.find((project) => project.id === projectId) || null;
  const connected = status.kind === 'connected';
  const localWorkspaceAccess = appEditor && pc?.id === 'device_local_web';
  const grantedPermissions = bridgePermissionNames(status.permissions);
  const projectReadAllowed = grantedPermissions.includes('project:read');
  const codexEnabled = connected && projectReadAllowed && projects.length > 0 && Boolean(projectId);
  const remoteCommandsCapability = status.capabilities?.remoteCommands === true;
  const nativeNotificationsAvailable = hasNativeNotificationApi();
  const appEditorProgress = useMemo(() => deriveAppEditorProgress({
    todos,
    streaming: streaming || remoteCommandBusy,
    approvals,
    commands,
    changes,
    finalResult,
    error
  }), [approvals, changes, commands, error, finalResult, remoteCommandBusy, streaming, todos]);

  const resetTurnPlan = useCallback(() => {
    const defaults = appEditorTurnDefaults(appEditor);
    setTurnPermissions(defaults.permissions);
    setPlannedFilesText(defaults.filesText);
    setPlannedCommandsText(defaults.commandsText);
  }, [appEditor]);

  const updateThread = useCallback((threadId, updater) => {
    setThreads((current) => current.map((thread) => (thread.id === threadId ? updater(thread) : thread)));
  }, []);

  const notifyNativeEvent = useCallback((key, title, body) => {
    if (!nativeNotificationsAvailable
      || notificationPermission !== 'granted'
      || !shouldDeliverNativeNotification()
      || notifiedNativeEventsRef.current.has(key)) {
      return false;
    }
    const shown = showNativeNotification({
      id: stableNativeNotificationId('lifehub-ai', key),
      title,
      body,
      path: appEditor ? '/ai/edit' : '/ai'
    });
    if (shown) {
      notifiedNativeEventsRef.current.add(key);
      if (notifiedNativeEventsRef.current.size > 256) {
        notifiedNativeEventsRef.current = new Set([key]);
      }
    }
    return shown === true;
  }, [appEditor, nativeNotificationsAvailable, notificationPermission]);

  const enableNativeNotifications = async () => {
    const permission = await requestNativeNotificationPermission();
    setNotificationPermission(permission);
  };

  const cacheCurrentThreads = useCallback((rows) => {
    if (pc?.id) cacheThreads(pc.id, mode, rows);
  }, [pc?.id, mode]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    const updateViewport = () => {
      document.documentElement.style.setProperty('--lifehub-ai-viewport-height', `${viewport.height}px`);
    };
    updateViewport();
    viewport.addEventListener('resize', updateViewport);
    return () => {
      viewport.removeEventListener('resize', updateViewport);
      document.documentElement.style.removeProperty('--lifehub-ai-viewport-height');
    };
  }, []);

  useEffect(() => {
    if (streaming) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [threads, streaming]);

  useEffect(() => {
    if (!nativeNotificationsAvailable) return undefined;
    const refreshPermission = () => {
      setNotificationPermission(nativeNotificationPermissionState());
    };
    window.addEventListener(NATIVE_NOTIFICATION_PERMISSION_EVENT, refreshPermission);
    document.addEventListener('visibilitychange', refreshPermission);
    return () => {
      window.removeEventListener(NATIVE_NOTIFICATION_PERMISSION_EVENT, refreshPermission);
      document.removeEventListener('visibilitychange', refreshPermission);
    };
  }, [nativeNotificationsAvailable]);

  useEffect(() => {
    setSelectedThreadId('');
    setApprovals([]);
    setCommands([]);
    setChanges([]);
    setTodos([]);
    setFinalResult('');
    resetTurnPlan();
    setPendingScheduleRequest(null);
    setPendingLifeRecordRequest(null);
    setReconnectThreadId('');
    if (!pc?.id) {
      setThreads([]);
      setProjects([]);
      return;
    }
    setProjectId(selectedProjectId(pc.id));
    setThreads(readCachedThreads(pc.id, mode));
  }, [pc?.id, mode, resetTurnPlan]);

  useEffect(() => {
    if (!client || !connected) return undefined;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const projectRequest = projectReadAllowed
          ? client.projects()
          : Promise.resolve(null);
        const [projectPayload, threadPayload] = await Promise.all([projectRequest, client.threads()]);
        if (!active) return;
        const nextProjects = projectReadAllowed
          ? arrayPayload(projectPayload, 'projects', 'items').map(normalizeProject)
          : [];
        const nextThreads = arrayPayload(threadPayload, 'threads', 'items')
          .map((thread, index) => normalizeThread(thread, index, mode))
          .filter((thread) => thread.mode === mode)
          .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
        setProjects(nextProjects);
        cacheProjects(pc.id, nextProjects);
        if (projectReadAllowed) {
          setProjectId((current) => {
            if (nextProjects.some((project) => project.id === current)) return current;
            const stored = selectedProjectId(pc.id);
            return nextProjects.find((project) => project.id === stored)?.id || nextProjects[0]?.id || '';
          });
        }
        setThreads((current) => {
          const merged = mergeLocalScheduleThreads(nextThreads, current);
          cacheThreads(pc.id, mode, merged);
          return merged;
        });
      } catch (loadError) {
        if (active) setError(bridgeErrorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [client, connected, mode, pc?.id, projectReadAllowed]);

  useEffect(() => {
    if (pc?.id) selectProject(pc.id, projectId);
  }, [pc?.id, projectId]);

  const openThread = async (thread) => {
    if (streaming || remoteCommandBusy) return;
    setSelectedThreadId(thread.id);
    setHistoryOpen(false);
    setError('');
    setApprovals([]);
    setCommands([]);
    setTodos([]);
    setFinalResult('');
    setChanges([]);
    setReconnectThreadId('');
    resetTurnPlan();
    setPendingScheduleRequest(thread.localOnly && thread.pendingScheduleRequest
      ? { threadId: thread.id, ...thread.pendingScheduleRequest }
      : null);
    setPendingLifeRecordRequest(thread.localOnly && thread.pendingLifeRecordRequest
      ? { threadId: thread.id, ...thread.pendingLifeRecordRequest }
      : null);
    if (thread.localOnly) return;
    if (!client || !connected) return;
    try {
      const payload = await client.thread(thread.id);
      const rawDetail = payload?.thread || payload?.data || payload;
      const detail = normalizeThread(rawDetail, 0, mode);
      const artifacts = artifactsFromEvents(rawDetail?.events);
      setApprovals(artifacts.approvals);
      setCommands(artifacts.commands);
      setTodos(artifacts.todos);
      setFinalResult(artifacts.finalResult);
      setChanges(artifacts.changes);
      setThreads((current) => {
        const next = current.map((item) => (item.id === thread.id ? { ...item, ...detail, id: thread.id } : item));
        cacheCurrentThreads(next);
        return next;
      });
      if (mode === 'codex') {
        const changePayload = await client.changes(thread.id).catch(() => null);
        if (changePayload) setChanges(changeRows(changePayload));
      }
      if (rawDetail?.status === 'running' || rawDetail?.status === 'awaiting-approval') {
        void resumeThreadStream(detail);
      }
    } catch (threadError) {
      setError(bridgeErrorMessage(threadError));
    }
  };

  const newConversation = () => {
    if (streaming || remoteCommandBusy) return;
    setSelectedThreadId('');
    setDraft('');
    setError('');
    setApprovals([]);
    setCommands([]);
    setChanges([]);
    setTodos([]);
    setFinalResult('');
    setPendingScheduleRequest(null);
    setPendingLifeRecordRequest(null);
    setReconnectThreadId('');
    resetTurnPlan();
  };

  const recordLocalScheduleExchange = useCallback((
    text,
    reply,
    requestedThreadId = '',
    pendingSchedule = undefined,
    pendingLifeRecord = undefined
  ) => {
    const createdAt = new Date().toISOString();
    const fresh = createLocalScheduleThread({ text, reply, mode, createdAt });
    const threadId = requestedThreadId || fresh.id;
    setThreads((current) => {
      const existing = current.find((thread) => thread.id === threadId && thread.localOnly);
      const conversation = existing
        ? appendLocalScheduleExchange(existing, { text, reply, createdAt })
        : requestedThreadId ? { ...fresh, id: threadId, appThreadId: threadId } : fresh;
      let updated = conversation;
      if (pendingSchedule !== undefined) updated = { ...updated, pendingScheduleRequest: pendingSchedule };
      if (pendingLifeRecord !== undefined) updated = { ...updated, pendingLifeRecordRequest: pendingLifeRecord };
      const next = [updated, ...current.filter((thread) => thread.id !== threadId)];
      cacheCurrentThreads(next);
      return next;
    });
    setSelectedThreadId(threadId);
    setHistoryOpen(false);
    return threadId;
  }, [cacheCurrentThreads, mode]);

  const clearStoredSchedulePending = useCallback((threadId) => {
    setThreads((current) => {
      const next = current.map((thread) => thread.id === threadId ? { ...thread, pendingScheduleRequest: null } : thread);
      cacheCurrentThreads(next);
      return next;
    });
  }, [cacheCurrentThreads]);

  const handleScheduleRequest = useCallback(async (text) => {
    const activePending = pendingScheduleRequest?.threadId === selectedThreadId
      ? pendingScheduleRequest
      : null;
    const usePending = Boolean(activePending);
    const action = usePending
      ? parseScheduleCreateRequest(text, { pending: activePending.action })
      : parseScheduleCreateRequest(text);
    if (action.status === 'not-action') {
      if (activePending) {
        setPendingScheduleRequest(null);
        clearStoredSchedulePending(activePending.threadId);
      }
      return false;
    }

    setPendingLifeRecordRequest(null);
    setDraft('');
    setError('');
    setLastFailedText('');

    const requestId = usePending
      ? activePending.requestId
      : `schedule-chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const threadId = usePending ? activePending.threadId : '';

    if (action.status === 'cancelled') {
      recordLocalScheduleExchange(text, '일정 추가를 취소했어요.', threadId, null);
      setPendingScheduleRequest(null);
      return true;
    }
    if (action.status === 'invalid') {
      recordLocalScheduleExchange(text, action.message || '날짜와 시간을 다시 확인해주세요.', threadId, usePending ? null : undefined);
      if (usePending) setPendingScheduleRequest(null);
      return true;
    }
    if (action.status === 'need-more') {
      const pending = { requestId, action };
      const nextThreadId = recordLocalScheduleExchange(text, action.question, threadId, pending);
      setPendingScheduleRequest({ threadId: nextThreadId, ...pending });
      return true;
    }

    let result;
    try {
      result = onCreateSchedule
        ? await Promise.resolve(onCreateSchedule(action.draft, requestId))
        : { status: 'failed' };
    } catch {
      result = { status: 'failed' };
    }
    const reply = result?.status === 'created'
      ? scheduleConfirmationText(result.item)
      : result?.status === 'duplicate'
        ? scheduleConfirmationText(result.item, true)
        : '일정을 저장하지 못했어요. 저장공간을 확인한 뒤 다시 시도해주세요. 입력한 내용은 저장되지 않았습니다.';
    recordLocalScheduleExchange(text, reply, threadId, usePending ? null : undefined);
    setPendingScheduleRequest(null);
    return true;
  }, [clearStoredSchedulePending, onCreateSchedule, pendingScheduleRequest, recordLocalScheduleExchange, selectedThreadId]);

  const handleLifeRecordRequest = useCallback(async (text) => {
    if (appEditor || mode !== 'assistant') return false;
    const activePending = pendingLifeRecordRequest?.threadId === selectedThreadId
      ? pendingLifeRecordRequest
      : null;

    if (activePending) {
      const decision = lifeRecordDecision(text);
      setDraft('');
      setError('');
      setLastFailedText('');
      if (decision === 'cancel') {
        recordLocalScheduleExchange(
          text,
          `${LIFE_RECORD_COPY[activePending.action.kind]?.noun || '생활'} 기록을 취소했어요.`,
          activePending.threadId,
          undefined,
          null
        );
        setPendingLifeRecordRequest(null);
        return true;
      }
      if (decision !== 'save') {
        recordLocalScheduleExchange(
          text,
          '미리보기 내용을 저장하려면 **저장**, 그만두려면 **취소**라고 입력해주세요.',
          activePending.threadId
        );
        return true;
      }

      let creationResult;
      try {
        creationResult = onCreateLifeRecord
          ? await Promise.resolve(onCreateLifeRecord(activePending.action, activePending.requestId))
          : { status: 'failed' };
      } catch {
        creationResult = { status: 'failed' };
      }
      const outcome = ['created', 'saved', 'duplicate'].includes(creationResult?.status)
        ? creationResult.status
        : 'failed';
      const completed = outcome !== 'failed';
      recordLocalScheduleExchange(
        text,
        lifeRecordResultText(activePending.action, outcome),
        activePending.threadId,
        undefined,
        completed ? null : undefined
      );
      if (completed) setPendingLifeRecordRequest(null);
      return true;
    }

    const action = parseLifeRecordAction(text);
    if (!action) return false;
    setDraft('');
    setError('');
    setLastFailedText('');
    setPendingScheduleRequest(null);
    const requestId = `life-record-chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const pending = { requestId, action };
    const threadId = recordLocalScheduleExchange(
      text,
      lifeRecordPreviewText(action),
      '',
      undefined,
      pending
    );
    setPendingLifeRecordRequest({ threadId, ...pending });
    return true;
  }, [appEditor, mode, onCreateLifeRecord, pendingLifeRecordRequest, recordLocalScheduleExchange, selectedThreadId]);

  const applyEvent = useCallback((frame, threadId, assistantId, finished) => {
    const delta = streamDelta(frame);
    const finalText = streamFinalText(frame);
    const eventError = streamError(frame);
    const terminal = isTerminalEvent(frame);
    const type = eventType(frame);
    const data = eventData(frame);
    const approval = approvalFromEvent(frame);
    const command = commandFromEvent(frame);
    const eventIdentity = String(frame?.data?.id || frame?.id || `${type}:${assistantId}`);
    if (approval
      && approval.status === 'pending'
      && type !== 'approval.approved'
      && type !== 'approval.rejected') {
      notifyNativeEvent(
        `approval:${threadId}:${approval.id}`,
        'Codex 승인 요청',
        '앱을 열어 요청 내용을 확인하세요.'
      );
    }
    if (terminal && !type.includes('cancel')) {
      const failed = Boolean(eventError) || type.includes('failed') || type.includes('error');
      notifyNativeEvent(
        `terminal:${threadId}:${eventIdentity}`,
        failed ? 'AI 작업 실패' : 'AI 작업 완료',
        failed ? '앱을 열어 오류 내용을 확인하세요.' : '앱을 열어 결과를 확인하세요.'
      );
    }
    updateThread(threadId, (thread) => ({
      ...thread,
      updatedAt: new Date().toISOString(),
      eventCursor: Math.max(Number(thread.eventCursor) || 0, Number(frame?.data?.id || frame?.id) || 0),
      messages: delta || finalText || eventError || terminal
        ? thread.messages.map((message) => {
          if (message.id !== assistantId) return message;
          const nextText = finalText && finalText.length >= message.content.length ? finalText : `${message.content}${delta}`;
          return {
            ...message,
            content: nextText,
            status: eventError ? 'error' : terminal ? 'complete' : 'streaming',
            error: eventError || ''
          };
        })
        : thread.messages
    }));
    if (approval) setApprovals((current) => {
      const index = current.findIndex((item) => item.id === approval.id);
      if (index < 0) return [...current, approval];
      const next = [...current];
      next[index] = type === 'approval.approved' || type === 'approval.rejected'
        ? { ...next[index], status: approval.status }
        : approval;
      return next;
    });
    if (command) setCommands((current) => [...current.filter((item) => item.id !== command.id), command]);
    if (type === 'todo.updated') setTodos(normalizeAppEditorTodos(frame));
    if (type === 'thread.sdk-linked' && data.sdkThreadId) {
      updateThread(threadId, (thread) => ({ ...thread, codexThreadId: String(data.sdkThreadId) }));
    }
    if (type === 'file.changed' && Array.isArray(data.changes)) {
      setChanges((current) => {
        const next = [...current];
        data.changes.forEach((change) => {
          const row = {
            id: String(change?.path || change?.id || `change-${next.length}`),
            path: safePathLabel(change?.path, '변경 파일'),
            status: String(change?.kind || change?.status || 'modified'),
            diff: ''
          };
          const index = next.findIndex((item) => item.id === row.id);
          if (index >= 0) next[index] = { ...next[index], ...row };
          else next.push(row);
        });
        return next;
      });
    }
    if (finalText) setFinalResult(finalText);
    if (eventError) {
      setError(eventError);
      finished.current = true;
    }
    if (terminal) {
      finished.current = true;
      setReconnectThreadId((current) => current === threadId ? '' : current);
    }
  }, [notifyNativeEvent, updateThread]);

  const loadChanges = useCallback(async (threadId) => {
    if (mode !== 'codex' || !client) return;
    try {
      setChanges(changeRows(await client.changes(threadId)));
    } catch {
      // A thread can complete without file changes; this panel remains empty.
    }
  }, [client, mode]);

  const resumeThreadStream = async (thread) => {
    if (!client || streaming || remoteCommandBusy) return;
    const existing = [...(thread.messages || [])].reverse().find((message) => (
      message.role === 'assistant' && ['streaming', 'interrupted'].includes(message.status)
    ));
    const assistantId = existing?.id || `resumed-assistant-${thread.id}`;
    setSelectedThreadId(thread.id);
    setReconnectThreadId('');
    setError('');
    updateThread(thread.id, (current) => ({
      ...current,
      messages: existing
        ? current.messages.map((message) => message.id === assistantId ? { ...message, status: 'streaming', error: '' } : message)
        : [...current.messages, normalizeMessage({ id: assistantId, role: 'assistant', content: '', status: 'streaming' })]
    }));
    const controller = new AbortController();
    const finished = { current: false };
    abortRef.current = controller;
    activeThreadIdRef.current = thread.id;
    setStreaming(true);
    try {
      await client.streamEvents(thread.id, {
        signal: controller.signal,
        after: thread.eventCursor || 0,
        onEvent: (frame) => {
          applyEvent(frame, thread.id, assistantId, finished);
          if (finished.current) controller.abort('complete');
        }
      });
      if (!finished.current) {
        const disconnected = new Error('스트리밍 연결이 종료되었습니다. 이어받기를 다시 시도해주세요.');
        disconnected.code = 'STREAM_DISCONNECTED';
        throw disconnected;
      }
    } catch (streamErrorValue) {
      if (!(streamErrorValue?.name === 'AbortError' && finished.current)) {
        setError(bridgeErrorMessage(streamErrorValue, '대화 스트리밍을 다시 연결하지 못했습니다.'));
        setReconnectThreadId(thread.id);
        updateThread(thread.id, (current) => ({
          ...current,
          messages: current.messages.map((message) => message.id === assistantId
            ? { ...message, status: 'interrupted', error: '응답 연결이 끊겼습니다. 이어받을 수 있습니다.' }
            : message)
        }));
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        if (activeThreadIdRef.current === thread.id) activeThreadIdRef.current = '';
        setStreaming(false);
      }
      await loadChanges(thread.id);
      setThreads((current) => {
        cacheCurrentThreads(current);
        return current;
      });
    }
  };

  const send = useCallback(async (rawText) => {
    const text = String(rawText || '').trim();
    if (!text || streaming || remoteCommandBusy) return;
    if (await handleScheduleRequest(text)) return;
    if (await handleLifeRecordRequest(text)) return;
    if (!connected || !client) {
      setError('PC가 연결되지 않았습니다. 연결 설정에서 Bridge를 먼저 페어링해주세요.');
      setLastFailedText(text);
      return;
    }
    if (mode === 'codex' && !projectId) {
      setError('Codex 개발 모드는 등록된 프로젝트를 선택해야 사용할 수 있습니다.');
      return;
    }
    const permissionsForTurn = mode === 'codex'
      ? [
        ...(projectReadAllowed ? ['project:read'] : []),
        ...turnPermissions.filter((permission) => grantedPermissions.includes(permission))
      ]
      : [];
    const approvalPlan = createApprovalPlan({
      requestedPermissions: permissionsForTurn,
      filesText: plannedFilesText,
      commandsText: plannedCommandsText,
      description: `Codex 작업: ${text.slice(0, 240)}`
    });
    if (approvalPlan.error) {
      setError(approvalPlan.error);
      return;
    }
    setDraft('');
    setError('');
    setLastFailedText('');
    setTodos([]);
    setFinalResult('');
    const controller = new AbortController();
    const finished = { current: false };
    abortRef.current = controller;
    activeThreadIdRef.current = '';
    setStreaming(true);
    let thread = selectedThread?.localOnly ? null : selectedThread;
    let assistantId = '';
    let messageSubmitted = false;
    let activeThreadId = '';
    try {
      if (!thread) {
        const payload = await client.createThread({
          mode: mode === 'assistant' ? 'general' : 'codex',
          projectId: mode === 'codex' ? projectId : undefined
        }, { signal: controller.signal });
        thread = normalizeThread(payload?.thread || payload?.data || payload, 0, mode);
        thread.title = thread.title === '새 대화' ? threadTitleFromMessage(text) : thread.title;
        thread.messages = [];
        setThreads((current) => [thread, ...current.filter((item) => item.id !== thread.id)]);
        setSelectedThreadId(thread.id);
      }
      const now = new Date().toISOString();
      const userMessage = normalizeMessage({ id: `local-user-${Date.now()}`, role: 'user', content: text, createdAt: now });
      assistantId = `local-assistant-${Date.now()}`;
      const assistantMessage = normalizeMessage({ id: assistantId, role: 'assistant', content: '', status: 'streaming', createdAt: now });
      const threadId = thread.id;
      activeThreadId = threadId;
      activeThreadIdRef.current = threadId;
      setThreads((current) => current.map((item) => item.id === threadId ? {
        ...item,
        title: item.title === '새 대화' ? threadTitleFromMessage(text) : item.title,
        updatedAt: now,
        messages: [...(item.messages || []), userMessage, assistantMessage]
      } : item));

      const response = await client.sendMessage(threadId, {
        content: text,
        requestedPermissions: permissionsForTurn,
        approvalContext: mode === 'codex' ? approvalPlan.context : undefined,
        localWorkspaceAccess
      }, { signal: controller.signal });
      messageSubmitted = true;
      resetTurnPlan();
      if (response?.approval) {
        const immediateApproval = approvalFromEvent({ event: 'approval.required', data: { approval: response.approval } });
        if (immediateApproval) {
          setApprovals((current) => [...current.filter((item) => item.id !== immediateApproval.id), immediateApproval]);
          notifyNativeEvent(
            `approval:${threadId}:${immediateApproval.id}`,
            'Codex 승인 요청',
            '앱을 열어 요청 내용을 확인하세요.'
          );
        }
      }
      const directText = contentText(response?.assistantMessage || response?.message?.content || response?.output || response?.result);
      const complete = response?.completed === true || response?.status === 'completed';
      if (complete) {
        notifyNativeEvent(
          `terminal:${threadId}:${response?.eventId || response?.cursor || assistantId}`,
          'AI 작업 완료',
          '앱을 열어 결과를 확인하세요.'
        );
      }
      if (directText) {
        updateThread(threadId, (item) => ({
          ...item,
          messages: item.messages.map((message) => message.id === assistantId ? {
            ...message,
            content: directText,
            status: complete ? 'complete' : 'streaming'
          } : message)
        }));
      }
      if (!complete) {
        await client.streamEvents(threadId, {
          signal: controller.signal,
          after: response?.eventId || response?.cursor || thread.eventCursor || 0,
          onEvent: (frame) => {
            applyEvent(frame, threadId, assistantId, finished);
            if (finished.current) controller.abort('complete');
          }
        });
        if (!finished.current) {
          const disconnected = new Error('응답 연결이 종료되었습니다. 같은 대화를 이어받을 수 있습니다.');
          disconnected.code = 'STREAM_DISCONNECTED';
          disconnected.retryable = true;
          throw disconnected;
        }
      }
      updateThread(threadId, (item) => ({
        ...item,
        messages: item.messages.map((message) => message.id === assistantId
          ? { ...message, status: message.status === 'error' ? 'error' : 'complete' }
          : message)
      }));
      await loadChanges(threadId);
    } catch (sendError) {
      const userCancelled = sendError?.name === 'AbortError' && ['user', 'rejected'].includes(controller.signal.reason);
      const interrupted = messageSubmitted
        && !finished.current
        && !userCancelled
        && (sendError?.retryable || ['OFFLINE', 'NETWORK_ERROR', 'STREAM_NETWORK_ERROR', 'STREAM_DISCONNECTED', 'TIMEOUT'].includes(sendError?.code));
      if (interrupted && thread?.id) {
        setError(bridgeErrorMessage(sendError, '응답 연결이 끊겼습니다. 이어받기를 시도해주세요.'));
        setReconnectThreadId(thread.id);
        updateThread(thread.id, (item) => ({
          ...item,
          messages: item.messages.map((message) => message.id === assistantId
            ? { ...message, status: 'interrupted', error: '응답 연결이 끊겼습니다. 같은 대화를 이어받을 수 있습니다.' }
            : message)
        }));
      } else if (!userCancelled && !(sendError?.name === 'AbortError' && finished.current) && sendError?.code !== 'CANCELLED') {
        setError(bridgeErrorMessage(sendError, '응답을 받지 못했습니다.'));
        setLastFailedText(text);
        if (thread?.id) {
          updateThread(thread.id, (item) => ({
            ...item,
            messages: item.messages.map((message) => message.id === assistantId && message.status === 'streaming'
              ? { ...message, status: 'error', error: bridgeErrorMessage(sendError, '응답을 받지 못했습니다.'), retryText: text }
              : message)
          }));
        }
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        if (!activeThreadId || activeThreadIdRef.current === activeThreadId) activeThreadIdRef.current = '';
        setStreaming(false);
      }
      setThreads((current) => {
        cacheCurrentThreads(current);
        return current;
      });
    }
  }, [applyEvent, cacheCurrentThreads, client, connected, grantedPermissions, handleLifeRecordRequest, handleScheduleRequest, loadChanges, localWorkspaceAccess, mode, plannedCommandsText, plannedFilesText, projectId, projectReadAllowed, remoteCommandBusy, resetTurnPlan, selectedThread, streaming, turnPermissions, updateThread]);

  const stop = async () => {
    const controller = abortRef.current;
    const threadId = activeThreadIdRef.current;
    controller?.abort('user');
    if (threadId && client) await client.cancel(threadId).catch(() => {});
    if (abortRef.current === controller) {
      abortRef.current = null;
      if (activeThreadIdRef.current === threadId) activeThreadIdRef.current = '';
      setStreaming(false);
    }
    if (threadId) {
      updateThread(threadId, (thread) => ({
        ...thread,
        messages: thread.messages.map((message) => message.status === 'streaming'
          ? { ...message, status: 'cancelled', error: '응답 생성을 중지했습니다.' }
          : message)
      }));
    }
  };

  const decideApproval = async (approval, scope) => {
    const threadId = activeThreadIdRef.current || selectedThreadId;
    if (!client || !threadId) return;
    setApprovalBusy(approval.id);
    try {
      await client.approve(threadId, { approvalId: approval.id, scope });
      setApprovals((current) => current.map((item) => item.id === approval.id ? { ...item, status: 'approved' } : item));
    } catch (approvalError) {
      setError(bridgeErrorMessage(approvalError));
    } finally {
      setApprovalBusy('');
    }
  };

  const rejectApproval = async (approval) => {
    const threadId = activeThreadIdRef.current || selectedThreadId;
    if (!client || !threadId) return;
    setApprovalBusy(approval.id);
    try {
      await client.reject(threadId, { approvalId: approval.id });
      setApprovals((current) => current.map((item) => item.id === approval.id ? { ...item, status: 'rejected' } : item));
      abortRef.current?.abort('rejected');
      setStreaming(false);
      updateThread(threadId, (thread) => ({
        ...thread,
        messages: thread.messages.map((message) => message.status === 'streaming'
          ? { ...message, status: 'error', error: '이 작업을 거부했습니다.' }
          : message)
      }));
    } catch (approvalError) {
      setError(bridgeErrorMessage(approvalError));
    } finally {
      setApprovalBusy('');
    }
  };

  const submit = (event) => {
    event.preventDefault();
    send(draft);
  };

  const reconnectResponse = async () => {
    if (!reconnectThreadId || streaming || remoteCommandBusy) return;
    const connection = connected ? { status } : await refresh();
    if (connection?.status?.kind !== 'connected') return;
    const thread = threads.find((item) => item.id === reconnectThreadId);
    if (thread) await resumeThreadStream(thread);
  };

  return (
    <div className={`lifeHubPage lifeHubAiChatPage ${appEditor ? 'lifeHubAppEditorPage' : ''}`}>
      <section className="lifeHubAiChatHeader">
        <div className="lifeHubAiChatTitle">
          <span className="lifeHubAiLogo"><MemoNavIcon type={appEditor ? 'edit' : 'message'} /></span>
          <div><span>{appEditor ? 'Orbit · 로컬 Bridge' : '로컬 Bridge'}</span><h2>{appEditor ? '앱 수정하기' : 'AI Assistant'}</h2></div>
        </div>
        <div className="lifeHubAiHeaderActions">
          <span className={`lifeHubAiStatusPill ${status.kind}`}><i />{status.label}{status.pcName || pc?.name ? ` · ${status.pcName || pc.name}` : ''}</span>
          {nativeNotificationsAvailable ? (
            <button
              type="button"
              onClick={enableNativeNotifications}
              disabled={notificationPermission === 'granted' || notificationPermission === 'denied'}
              title={notificationPermission === 'denied' ? '휴대폰 설정에서 ai-assitant 알림을 허용해 주세요.' : 'AI 승인 및 완료 알림'}
            >
              <MemoNavIcon type="bell" />
              {notificationPermission === 'granted' ? '알림 켜짐' : notificationPermission === 'denied' ? '알림 차단됨' : '알림 켜기'}
            </button>
          ) : null}
          <button type="button" onClick={() => setHistoryOpen((value) => !value)}><MemoNavIcon type="list" />이전 대화</button>
          <button type="button" onClick={newConversation} disabled={streaming || remoteCommandBusy}><MemoNavIcon type="plus" />새 대화</button>
          <button type="button" onClick={() => navigate('/ai/settings')} aria-label="PC 연결 설정"><MemoNavIcon type="settings" /></button>
        </div>
      </section>

      <section className={`lifeHubAiControls ${appEditor ? 'app-editor' : ''}`} aria-label="AI 모드 및 프로젝트">
        {appEditor ? (
          <div className="lifeHubAppEditorMode"><MemoNavIcon type="briefcase" /><span><strong>Codex 앱 수정 모드</strong><small>{localWorkspaceAccess ? '요청 → 수정 → 검증을 한 화면에서 진행해요.' : '요청 → 승인 → 수정 → 검증을 한 화면에서 진행해요.'}</small></span></div>
        ) : (
          <div className="lifeHubAiModeSwitch" role="group" aria-label="AI 모드">
            <button type="button" className={mode === 'assistant' ? 'active' : ''} aria-pressed={mode === 'assistant'} disabled={streaming || remoteCommandBusy} onClick={() => setMode('assistant')}>일반 도우미</button>
            <button type="button" className={mode === 'codex' ? 'active' : ''} aria-pressed={mode === 'codex'} disabled={streaming || remoteCommandBusy || !connected || !projectReadAllowed || !projects.length} onClick={() => setMode('codex')}>Codex 개발 모드</button>
          </div>
        )}
        <label>
          <span>{appEditor ? '수정할 앱 프로젝트' : '프로젝트'}</span>
          <select value={projectId} disabled={!connected || streaming || remoteCommandBusy || !projects.length} onChange={(event) => setProjectId(event.target.value)}>
            {!projects.length ? <option value="">등록된 프로젝트 없음</option> : null}
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
      </section>

      {mode === 'codex' ? (
        <details className={`lifeHubAiPermissionDetails ${appEditor ? 'app-editor' : 'standard'}`} {...(!appEditor ? { open: true } : {})}>
          <summary>
            <span><strong>수정 범위와 권한</strong><small>{localWorkspaceAccess ? '파일·명령·빌드·Git 권한을 대화마다 자동 적용해요.' : '앱 소스와 기본 테스트 범위가 미리 선택되어 있어요.'}</small></span>
            <MemoNavIcon type="chevronDown" />
          </summary>
          <fieldset className="lifeHubAiTurnPermissions" disabled={streaming || remoteCommandBusy || !connected}>
          <legend>{localWorkspaceAccess ? '로컬 대화 전체 권한' : '이번 요청 권한'}</legend>
          <p>{localWorkspaceAccess ? '프로젝트 읽기와 네 작업 권한을 대화마다 자동 적용합니다.' : <><strong>프로젝트 읽기</strong>는 기본이며, 선택한 작업 권한만 Bridge 승인 요청에 포함됩니다.</>}</p>
          <div className="lifeHubAiTurnPermissionGrid">
            {TURN_PERMISSION_OPTIONS.map((permission) => {
              const granted = grantedPermissions.includes(permission.value);
              const selected = turnPermissions.includes(permission.value);
              return (
                <label key={permission.value} className={[!granted ? 'unavailable' : '', selected ? 'selected' : ''].filter(Boolean).join(' ')}>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={!granted || streaming || !connected || localWorkspaceAccess}
                    onChange={() => setTurnPermissions((current) => (
                      current.includes(permission.value)
                        ? current.filter((value) => value !== permission.value)
                        : [...current, permission.value]
                    ))}
                  />
                  <span><strong>{permission.label}</strong><small>{granted ? permission.detail : '기기 권한이 허용되지 않음'}</small></span>
                </label>
              );
            })}
          </div>
          {turnPermissions.includes('file:write') || turnPermissions.some((permission) => ['command:execute', 'build:execute', 'git'].includes(permission)) ? (
            <div className="lifeHubAiApprovalPlan">
              <strong>{localWorkspaceAccess ? '로컬 작업 범위' : '승인 범위 계획'}</strong>
              <p>{localWorkspaceAccess ? '일반 작업은 승인 대기 없이 실행하고, 프로젝트 밖 접근은 차단하며 삭제·위험 작업만 마지막 확인을 받습니다.' : '아래 범위가 승인 화면에 그대로 표시되며, Bridge가 프로젝트 allowlist와 위험도를 다시 검증합니다.'}</p>
              {turnPermissions.includes('file:write') ? (
                <label>
                  <span>{localWorkspaceAccess ? '변경 가능 파일' : '변경 예정 파일'} <em>필수 · 프로젝트 상대 경로</em></span>
                  <textarea
                    value={plannedFilesText}
                    onChange={(event) => setPlannedFilesText(event.target.value)}
                    readOnly={localWorkspaceAccess}
                    placeholder={'예: src/App.jsx\nsrc/styles/app.css'}
                    rows={3}
                    maxLength={12000}
                    aria-required="true"
                  />
                  <small>{localWorkspaceAccess ? <><code>.</code>은 선택한 프로젝트 전체만 뜻하며 프로젝트 밖 경로는 열지 않습니다.</> : '한 줄에 하나씩 입력하세요. 절대 경로, ~, ../ 경로는 전송 전에 차단됩니다.'}</small>
                </label>
              ) : null}
              {turnPermissions.some((permission) => ['command:execute', 'build:execute', 'git'].includes(permission)) ? (
                <label>
                  <span>{localWorkspaceAccess ? '기본 검증 명령' : '실행 예정 명령'} <em>필수 · 한 줄에 하나</em></span>
                  <textarea
                    value={plannedCommandsText}
                    onChange={(event) => setPlannedCommandsText(event.target.value)}
                    readOnly={localWorkspaceAccess}
                    placeholder={'예: npm test\nnpm run build'}
                    rows={3}
                    maxLength={20000}
                    aria-required="true"
                  />
                  <small>{localWorkspaceAccess ? 'Codex가 필요한 프로젝트 내부 명령을 실행할 수 있으며 삭제·위험 명령은 마지막 확인을 받습니다.' : '실제 실행 전 Bridge의 명령 allowlist와 위험 명령 별도 승인 정책이 적용됩니다.'}</small>
                </label>
              ) : null}
            </div>
          ) : null}
          </fieldset>
        </details>
      ) : null}

      {status.kind === 'offline' ? (
        <aside className="lifeHubAiConnectionBanner offline"><MemoNavIcon type="link" /><div><strong>네트워크 연결이 끊겼습니다</strong><p>일정과 생활 기록은 계속 사용할 수 있어요. 예: 메모: 여행 준비 · 커피 4500원 지출</p></div><button type="button" onClick={reconnectThreadId ? reconnectResponse : refresh}>다시 연결</button></aside>
      ) : !connected ? (
        <aside className="lifeHubAiConnectionBanner"><MemoNavIcon type="link" /><div><strong>PC가 연결되지 않았습니다</strong><p>{status.detail} 일정과 생활 기록은 연결 없이도 사용할 수 있어요. 예: 러닝 30분 · 점심 김밥 650kcal</p></div><button type="button" onClick={() => navigate('/ai/settings')}>연결 설정으로 이동</button></aside>
      ) : status.codexLoggedIn === false ? (
        <aside className="lifeHubAiConnectionBanner warning"><MemoNavIcon type="shield" /><div><strong>PC에서 Codex 로그인이 필요합니다</strong><p>PC 터미널에서 <code>codex login</code>을 실행하세요. 로그인 파일 내용은 앱으로 전송되지 않습니다.</p></div></aside>
      ) : null}

      {mode === 'codex' && connected && !codexEnabled ? (
        <aside className="lifeHubAiConnectionBanner warning"><MemoNavIcon type="briefcase" /><div><strong>{projectReadAllowed ? '등록된 프로젝트가 필요합니다' : '프로젝트 읽기 권한이 필요합니다'}</strong><p>{projectReadAllowed ? 'PC Bridge에서 공개할 프로젝트를 명시적으로 등록한 뒤 다시 연결하세요.' : '연결 설정에서 프로젝트 파일 읽기 권한을 요청해 PC에서 다시 승인하세요.'}</p></div></aside>
      ) : null}

      {localWorkspaceAccess && connected && codexEnabled ? (
        <aside className="lifeHubAiConnectionBanner success"><MemoNavIcon type="shield" /><div><strong>로컬 대화 전체 권한 사용 중</strong><p>일반 파일 수정·명령·빌드·Git은 바로 실행합니다. 프로젝트 밖 접근은 차단하고 삭제·위험 작업만 마지막 확인을 받습니다.</p></div></aside>
      ) : null}

      <div className={`lifeHubAiWorkArea ${appEditor ? 'app-editor' : 'standard'}`}>
        <div className={`lifeHubAiWorkspace ${historyOpen ? 'history-open' : ''}`}>
        <aside className="lifeHubAiHistory" aria-label="이전 대화 목록">
          <header><strong>이전 대화</strong><button type="button" onClick={() => setHistoryOpen(false)} aria-label="목록 닫기"><MemoNavIcon type="close" /></button></header>
          {threads.length ? threads.map((thread) => (
            <button type="button" key={thread.id} className={thread.id === selectedThreadId ? 'active' : ''} disabled={streaming || remoteCommandBusy} onClick={() => openThread(thread)}>
              <MemoNavIcon type={thread.mode === 'codex' ? 'briefcase' : 'message'} />
              <span><strong>{thread.title}</strong><small>{new Date(thread.updatedAt).toLocaleDateString('ko-KR')}</small></span>
            </button>
          )) : <div className="lifeHubAiHistoryEmpty">{loading ? '대화를 불러오는 중…' : '저장된 대화가 없습니다.'}</div>}
        </aside>

        <main className="lifeHubAiConversation" aria-label="AI 대화">
          <div className="lifeHubAiMessages" aria-live="polite">
            {selectedThread?.messages?.length ? selectedThread.messages.map((message, index) => (
              <ChatMessage
                key={message.id}
                message={message}
                onResend={send}
                onRetry={(text) => send(
                  text
                  || [...selectedThread.messages.slice(0, index)].reverse().find((item) => item.role === 'user')?.content
                  || lastFailedText
                )}
              />
            )) : (
              <section className="lifeHubAiWelcome">
                <span><MemoNavIcon type={mode === 'codex' ? 'briefcase' : 'spark'} /></span>
                <h3>{appEditor ? '앱에서 바꿀 내용을 말해주세요' : mode === 'codex' ? '프로젝트 작업을 함께 시작해요' : '무엇을 도와드릴까요?'}</h3>
                <p>{appEditor ? '큰 틀은 유지하고, 원하는 화면과 불편한 점을 평소 말하듯 적으면 돼요.' : mode === 'codex' ? '파일 수정과 명령 실행은 권한과 위험도에 따라 먼저 승인을 요청합니다.' : '일반 도우미는 파일 수정과 명령 실행 권한이 기본적으로 꺼져 있습니다.'}</p>
              </section>
            )}
            {error ? (
              <div className="lifeHubAiError" role="alert">
                <MemoNavIcon type="shield" />
                <span>{error}</span>
                {reconnectThreadId ? <button type="button" disabled={!connected || streaming || remoteCommandBusy} onClick={reconnectResponse}>응답 이어받기</button> : lastFailedText ? <button type="button" disabled={remoteCommandBusy} onClick={() => send(lastFailedText)}>다시 시도</button> : null}
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          <form className="lifeHubAiComposer" onSubmit={submit}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (shouldSubmitComposerOnEnter(event)) {
                  event.preventDefault();
                  submit(event);
                }
              }}
              placeholder={connected ? appEditor ? '예: 운동 기록 버튼을 더 누르기 쉽게 고쳐줘' : mode === 'codex' ? '프로젝트에 요청할 작업을 입력하세요' : '예: 메모: 여행 준비 · 커피 4500원 지출' : '연결 없이 기록 가능 · 예: 러닝 30분'}
              disabled={remoteCommandBusy}
              rows={1}
              aria-label="메시지 입력"
            />
            {streaming ? (
              <button type="button" className="stop" onClick={stop}><span aria-hidden="true">■</span>응답 중지</button>
            ) : (
              <button type="submit" className="send" disabled={!draft.trim() || remoteCommandBusy}><MemoNavIcon type="chevronRight" /><span>보내기</span></button>
            )}
            <small>{appEditor ? 'Enter 전송 · 답변과 진행은 실시간 · 작업 중에는 다음 요청을 미리 작성할 수 있어요' : 'Enter 전송 · Shift+Enter 줄바꿈'}</small>
          </form>
        </main>
        </div>

        {mode === 'codex' ? (
          <section className="lifeHubAiDevPanel" aria-labelledby="codex-work-status-title">
            <header><div><span>{appEditor ? '실시간 작업 보드' : 'Codex 개발 모드'}</span><h3 id="codex-work-status-title">{appEditor ? '진행도와 결과 요약' : '현재 작업 상태'}</h3></div><span className={`lifeHubAiStatusPill ${streaming || remoteCommandBusy ? 'checking' : 'connected'}`}><i />{remoteCommandBusy ? '명령 실행 중' : streaming ? '작업 중' : '대기'}</span></header>

          {appEditor ? <AppEditorProgressPanel progress={appEditorProgress} /> : null}

          <dl className="lifeHubAiDevFacts">
            <div><dt>선택한 프로젝트</dt><dd>{selectedProject?.name || '선택 안 됨'}</dd></div>
            <div><dt>현재 작업 디렉터리</dt><dd><code>{selectedThread?.cwd || selectedProject?.cwd || 'Bridge에서 확인'}</code></dd></div>
            <div><dt>수정된 파일</dt><dd>{changes.length}개</dd></div>
            <div><dt>실행 중인 명령</dt><dd>{commands.filter((command) => command.status === 'running').length}개</dd></div>
          </dl>

          {!appEditor ? <RemoteCommandPanel
            client={client}
            connected={connected}
            capability={remoteCommandsCapability}
            permissions={grantedPermissions}
            project={selectedProject}
            aiBusy={streaming}
            onBusyChange={setRemoteCommandBusy}
          /> : null}

          {approvals.length ? <div className="lifeHubAiApprovalList">{approvals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={{ ...approval, project: projects.find((project) => project.id === approval.project)?.name || approval.project }}
              busy={approvalBusy === approval.id}
              onApprove={decideApproval}
              onReject={rejectApproval}
            />
          ))}</div> : null}

          {commands.length ? (
            <div className="lifeHubAiCommandList"><h4>실행 명령</h4>{commands.map((command) => <p key={command.id}><span className={command.status} /> <code>{command.command || '명령 준비 중'}</code><em>{command.exitCode === null ? command.status : `exit ${command.exitCode}`}</em></p>)}</div>
          ) : null}

          {finalResult ? <div className="lifeHubAiFinalResult"><h4>{appEditor ? '결과 요약' : '최종 결과'}</h4><MarkdownMessage content={finalResult} /></div> : null}

          <div className="lifeHubAiChanges">
            <button type="button" onClick={() => setDiffOpen((value) => !value)} disabled={!changes.length}><MemoNavIcon type="file" />Git diff 보기 <span>{changes.length}</span><MemoNavIcon type={diffOpen ? 'chevronDown' : 'chevronRight'} /></button>
            {diffOpen ? <div className="lifeHubAiDiffList">{changes.map((change) => <details key={change.id}><summary><span>{change.status}</span>{change.path}</summary><pre><code>{change.diff || '변경 요약은 Bridge에서 제공되지 않았습니다.'}</code></pre></details>)}</div> : null}
          </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
