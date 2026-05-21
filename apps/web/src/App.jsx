import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import LocalTripApp from './LocalTripApp.jsx';

const AUTH_KEY = 'codex-workspace-auth';
const LazyCodeEditor = lazy(() => import('./CodeEditor.jsx'));
const LazyGeminiApp = lazy(() => import('./GeminiApp.jsx'));
const LazyRagApp = lazy(() => import('./RagApp.jsx'));
const SCHEDULER_KEY = 'codex-personal-scheduler-items';
const AI_NOTE_KEY = 'codex-ai-note-blocks';
const AI_NOTE_BOARDS_KEY = 'codex-ai-note-boards';
const APP_SHORTCUTS = {
  mainHub: { label: '홈', path: '/' },
  aiTrip: { label: '여행 추천', path: '/destinations' },
  aiSchedule: { label: 'AI 일정 만들기', path: '/planner' },
  personalScheduler: { label: '일정', path: '/scheduler' },
  aiMemoBoard: { label: '노트', path: '/notes' },
  adminWorkspace: { label: '관리자 배치', path: '/analysisadmin' }
};
const RECURRENCE_LABELS = {
  none: '반복 없음',
  daily: '매일',
  weekly: '매주',
  monthly: '매월'
};
const DEFAULT_SCHEDULER_ITEMS = [
  {
    id: 'schedule-demo-1',
    title: '홈페이지 MVP 문구 정리',
    date: toDateKey(new Date()),
    time: '10:00',
    type: '작업',
    memo: '메인 화면과 서비스 이동 동선을 점검합니다.',
    recurrence: 'none',
    recurrenceEnd: '',
    done: false
  },
  {
    id: 'schedule-demo-2',
    title: 'AI Workspace에서 초안 확인',
    date: toDateKey(new Date()),
    time: '14:00',
    type: '검토',
    memo: '생성된 파일과 프롬프트 결과를 workspace에서 확인합니다.',
    recurrence: 'none',
    recurrenceEnd: '',
    done: false
  }
];

function normalizeAuthSession(session) {
  if (!session) return null;
  return session.username === 'guestuser' && !session.isGuest ? { ...session, isGuest: true } : session;
}

export function addSchedulerItem(item) {
  const title = String(item?.title || item?.name || '').trim();
  if (!title) return null;
  const now = new Date();
  const nextItem = {
    id: item?.id || `schedule-${now.getTime()}`,
    title,
    date: item?.date || toDateKey(now),
    time: item?.time || '09:00',
    type: item?.type || '작업',
    memo: item?.memo || item?.note || '',
    recurrence: Object.keys(RECURRENCE_LABELS).includes(item?.recurrence) ? item.recurrence : 'none',
    recurrenceEnd: item?.recurrenceEnd || '',
    doneOverrides: item?.doneOverrides || {},
    source: item?.source || '',
    done: Boolean(item?.done)
  };
  const storageKey = schedulerStorageKey();
  const current = readSchedulerItems(storageKey);
  const next = [...current, nextItem];
  localStorage.setItem(storageKey, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('codex:scheduler-items-updated', { detail: { item: nextItem, items: next, storageKey } }));
  return nextItem;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, options);
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/api/auth/')) {
      localStorage.removeItem(AUTH_KEY);
      window.location.reload();
      throw new Error('Session expired');
    }
    throw new Error((await response.text()) || `HTTP ${response.status}`);
  }
  const text = await response.text();
  if (!text) {
    return null;
  }
  return JSON.parse(text);
}

async function requestText(path, token) {
  const response = await fetch(path, { headers: authHeaders(token) });
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/api/auth/')) {
      localStorage.removeItem(AUTH_KEY);
      window.location.reload();
      throw new Error('Session expired');
    }
    throw new Error((await response.text()) || `HTTP ${response.status}`);
  }
  return response.text();
}

function joinPath(base, name) {
  return base ? `${base}/${name}` : name;
}

function labelForPath(path) {
  if (!path) return 'Workspace';
  const tokens = path.split('/').filter(Boolean);
  return tokens[tokens.length - 1] || 'Workspace';
}

function workspacePathFor(path) {
  return path ? `/workspace/${path}` : '/workspace';
}

function extensionForPath(path) {
  const fileName = labelForPath(path);
  const index = fileName.lastIndexOf('.');
  if (index === -1 || index === fileName.length - 1) {
    return 'text';
  }
  return fileName.slice(index + 1).toLowerCase();
}

function formatSize(size) {
  if (!size) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function readStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? normalizeAuthSession(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function schedulerStorageKey(input = readStoredAuth()) {
  const username = typeof input === 'string' ? input : input?.username;
  const normalized = String(username || 'guestuser').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_') || 'guestuser';
  return `${SCHEDULER_KEY}:${normalized}`;
}

function readSchedulerItems(input) {
  try {
    const raw = localStorage.getItem(input?.startsWith?.(SCHEDULER_KEY) ? input : schedulerStorageKey(input));
    if (raw === null) {
      return DEFAULT_SCHEDULER_ITEMS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeSchedulerItem) : DEFAULT_SCHEDULER_ITEMS;
  } catch {
    return DEFAULT_SCHEDULER_ITEMS;
  }
}

function normalizeSchedulerItem(item) {
  return {
    ...item,
    type: item?.type === 'AI Note' ? '메모' : item?.type,
    recurrence: Object.keys(RECURRENCE_LABELS).includes(item?.recurrence) ? item.recurrence : 'none',
    recurrenceEnd: item?.recurrenceEnd || '',
    doneOverrides: item?.doneOverrides && typeof item.doneOverrides === 'object' ? item.doneOverrides : {},
    source: item?.source === 'AI Note' ? '메모' : item?.source || ''
  };
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildMonthDays(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return {
      key: toDateKey(day),
      dayNumber: day.getDate(),
      currentMonth: day.getMonth() === month - 1
    };
  });
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(date.getDate() + amount);
  return next;
}

function diffDays(fromDateKey, toDateKey) {
  const from = parseDateKey(fromDateKey);
  const to = parseDateKey(toDateKey);
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function isScheduledOnDate(item, dateKey) {
  if (!item?.date || dateKey < item.date) return false;
  if (item.recurrenceEnd && dateKey > item.recurrenceEnd) return false;
  if (item.recurrence === 'daily') return true;
  if (item.recurrence === 'weekly') return diffDays(item.date, dateKey) % 7 === 0;
  if (item.recurrence === 'monthly') {
    return parseDateKey(item.date).getDate() === parseDateKey(dateKey).getDate();
  }
  return item.date === dateKey;
}

function expandSchedulerItemsForDates(items, dateKeys) {
  const uniqueDateKeys = [...new Set(dateKeys)].sort();
  return uniqueDateKeys.flatMap((dateKey) => items
    .filter((item) => isScheduledOnDate(item, dateKey))
    .map((item) => {
      const recurring = item.recurrence && item.recurrence !== 'none';
      return {
        ...item,
        id: recurring ? `${item.id}:${dateKey}` : item.id,
        sourceId: item.id,
        date: dateKey,
        originalDate: item.date,
        recurring,
        recurrenceLabel: RECURRENCE_LABELS[item.recurrence] || RECURRENCE_LABELS.none,
        done: recurring ? Boolean(item.doneOverrides?.[dateKey]) : Boolean(item.done)
      };
    }));
}

function startOfMondayWeek(dateKey) {
  const date = parseDateKey(dateKey);
  const mondayOffset = (date.getDay() + 6) % 7;
  return addDays(date, -mondayOffset);
}

function buildWeekDays(dateKey) {
  const monday = startOfMondayWeek(dateKey);
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(monday, index);
    return {
      key: toDateKey(day),
      dayNumber: day.getDate(),
      weekday: ['월', '화', '수', '목', '금', '토', '일'][index]
    };
  });
}

function formatDateLabel(dateKey) {
  const date = parseDateKey(dateKey);
  return `${date.getMonth() + 1}.${date.getDate()}`;
}

function defaultNoteBlocks() {
  return PROJECT_BOARD_COLUMNS.flatMap((column) => column.tasks.map((task, index) => ({
    id: `memo-${column.id}-${index}`,
    type: 'text',
    content: `## ${task}\n\n`,
    sector: 'project',
    boardId: 'project',
    status: column.id,
    parentId: '',
    filePath: `memo-files/${column.id}-${index}.md`
  })));
}

function defaultMemoBoards() {
  return [
    { id: 'project', title: '프로젝트 보드' },
    { id: 'memo', title: '메모 보드' }
  ];
}

function readMemoBoards() {
  try {
    const raw = localStorage.getItem(AI_NOTE_BOARDS_KEY);
    if (raw === null) {
      return defaultMemoBoards();
    }
    const parsed = JSON.parse(raw);
    const boards = Array.isArray(parsed) ? parsed.map(normalizeMemoBoard).filter(Boolean) : defaultMemoBoards();
    return boards.length ? boards : defaultMemoBoards();
  } catch {
    return defaultMemoBoards();
  }
}

function normalizeMemoBoard(board) {
  const title = typeof board?.title === 'string' ? board.title.trim() : '';
  if (!title) return null;
  return {
    id: board?.id || `board-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title
  };
}

function readNoteBlocks() {
  try {
    const raw = localStorage.getItem(AI_NOTE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length ? parsed.map(normalizeNoteBlock) : defaultNoteBlocks();
  } catch {
    return defaultNoteBlocks();
  }
}

function normalizeNoteBlock(block) {
  const sector = ['project', 'memo'].includes(block?.sector) ? block.sector : 'project';
  const boardId = typeof block?.boardId === 'string' && block.boardId ? block.boardId : sector;
  const projectBlock = boardId === 'project';
  const blockType = ['text', 'file', 'checklist'].includes(block?.type) ? block.type : 'text';
  const fallbackX = 24 + (Math.abs(String(block?.id || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 180);
  const fallbackY = 24 + (Math.abs(String(block?.id || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 220);
  return {
    id: block?.id || `note-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: blockType,
    content: typeof block?.content === 'string' ? block.content : '',
    sector,
    boardId,
    status: ['todo', 'progress', 'review', 'done'].includes(block?.status) ? block.status : 'todo',
    parentId: typeof block?.parentId === 'string' ? block.parentId : '',
    filePath: typeof block?.filePath === 'string' ? block.filePath : '',
    width: projectBlock ? Math.max(160, Math.min(520, Number(block?.width) || 220)) : Math.max(260, Math.min(920, Number(block?.width) || 760)),
    height: projectBlock ? Math.max(96, Math.min(360, Number(block?.height) || 120)) : Math.max(48, Math.min(180, Number(block?.height) || 58)),
    x: projectBlock ? 0 : Math.max(0, Math.min(1600, Number(block?.x) || fallbackX)),
    y: projectBlock ? 0 : Math.max(0, Math.min(1600, Number(block?.y) || fallbackY))
  };
}

function plainMarkdownText(markdown) {
  return markdown
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+\[[ xX]\]\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function noteBlockTitle(block) {
  const plain = plainMarkdownText(block?.content || '');
  const firstLine = plain.split('\n').map((line) => line.trim()).find(Boolean);
  return firstLine || '새 메모';
}

function noteBlockBody(block) {
  const lines = `${block?.content || ''}`.split('\n');
  const firstContentIndex = lines.findIndex((line) => line.trim());
  if (firstContentIndex === -1) return '';
  return lines.slice(firstContentIndex + 1).join('\n').replace(/^\s+/, '');
}

function noteBlockContentWithTitle(block, title) {
  const safeTitle = title.trim() || '새 메모';
  const body = noteBlockBody(block);
  return [`# ${safeTitle}`, body].filter(Boolean).join('\n\n');
}

function checklistItemsFromBlock(block) {
  const body = noteBlockBody(block);
  const lines = body.split('\n').map((line) => line.trim()).filter(Boolean);
  const items = lines.map((line) => {
    const match = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    return match ? { checked: match[1].toLowerCase() === 'x', text: match[2] } : { checked: false, text: line.replace(/^[-*]\s+/, '') };
  });
  return items.length ? items : [{ checked: false, text: '' }];
}

function checklistContentWithItems(block, items) {
  const title = noteBlockTitle(block);
  const lines = items.length ? items : [{ checked: false, text: '' }];
  return [
    `# ${title}`,
    '',
    ...lines.map((item) => `- [${item.checked ? 'x' : ' '}] ${item.text}`)
  ].join('\n');
}

function parseNoteScheduleBlock(block) {
  const content = plainMarkdownText(block.content);
  if (!content) return null;
  const dateMatch = content.match(/#(\d{4}-\d{2}-\d{2})/);
  const timeMatch = content.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/);
  const date = dateMatch?.[1] || toDateKey(new Date());
  const time = timeMatch ? timeMatch[0] : '09:00';
  const title = content
    .replace(/#\d{4}-\d{2}-\d{2}/g, '')
    .replace(/\b([01]\d|2[0-3]):([0-5]\d)\b/, '')
    .replace(/^일정\s*[:：-]?/i, '')
    .trim();
  if (!title) return null;
  return {
    id: `ai-note-${block.id}`,
    title,
    date,
    time,
    type: '메모',
    memo: block.content.trim(),
    recurrence: 'none',
    recurrenceEnd: '',
    source: '메모',
    done: false
  };
}

function syncNoteSchedules(blocks) {
  const schedules = blocks
    .filter((block) => block.type === 'schedule')
    .map(parseNoteScheduleBlock)
    .filter(Boolean);
  const scheduleIds = new Set(schedules.map((item) => item.id));
  const storageKey = schedulerStorageKey();
  const current = readSchedulerItems(storageKey);
  const withoutStaleNoteItems = current.filter((item) => !['AI Note', '메모'].includes(item.source) || scheduleIds.has(item.id));
  const merged = [
    ...withoutStaleNoteItems.filter((item) => !['AI Note', '메모'].includes(item.source)),
    ...schedules.map((schedule) => {
      const existing = current.find((item) => item.id === schedule.id);
      return { ...schedule, done: Boolean(existing?.done), doneOverrides: existing?.doneOverrides || {} };
    })
  ];
  localStorage.setItem(storageKey, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent('codex:scheduler-items-updated', { detail: { items: merged, storageKey } }));
  return schedules.length;
}

function markdownPreviewLines(markdown) {
  return markdown.split('\n').map((line, index) => {
    const key = `${index}-${line}`;
    if (line.startsWith('# ')) return <h3 key={key}>{line.slice(2)}</h3>;
    if (line.startsWith('## ')) return <h4 key={key}>{line.slice(3)}</h4>;
    if (/^\s*[-*]\s+\[[ xX]\]\s+/.test(line)) {
      const checked = /^\s*[-*]\s+\[[xX]\]\s+/.test(line);
      return <p key={key} className={checked ? 'checked' : ''}>{checked ? '✓ ' : '□ '}{line.replace(/^\s*[-*]\s+\[[ xX]\]\s+/, '')}</p>;
    }
    if (/^\s*[-*]\s+/.test(line)) return <p key={key}>• {line.replace(/^\s*[-*]\s+/, '')}</p>;
    return line.trim() ? <p key={key}>{line}</p> : <br key={key} />;
  });
}

function markdownPreviewBlocks(markdown) {
  return markdown.split('\n').map((line, index) => {
    const key = `${index}-${line}`;
    const inline = (text) => text
      .split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
      .filter(Boolean)
      .map((part, partIndex) => {
        if (part.startsWith('`') && part.endsWith('`')) return <code key={partIndex}>{part.slice(1, -1)}</code>;
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={partIndex}>{part.slice(2, -2)}</strong>;
        return part;
      });
    if (line.startsWith('# ')) return <h1 key={key}>{inline(line.slice(2))}</h1>;
    if (line.startsWith('## ')) return <h2 key={key}>{inline(line.slice(3))}</h2>;
    if (line.startsWith('### ')) return <h3 key={key}>{inline(line.slice(4))}</h3>;
    if (/^\s*[-*]\s+\[[ xX]\]\s+/.test(line)) {
      const checked = /^\s*[-*]\s+\[[xX]\]\s+/.test(line);
      return <label key={key} className="analysisMarkdownCheck"><input type="checkbox" checked={checked} readOnly />{inline(line.replace(/^\s*[-*]\s+\[[ xX]\]\s+/, ''))}</label>;
    }
    if (/^\s*[-*]\s+/.test(line)) return <li key={key}>{inline(line.replace(/^\s*[-*]\s+/, ''))}</li>;
    if (/^\s*>\s+/.test(line)) return <blockquote key={key}>{inline(line.replace(/^\s*>\s+/, ''))}</blockquote>;
    return line.trim() ? <p key={key}>{inline(line)}</p> : <br key={key} />;
  });
}

function updateMarkdownLine(markdown, lineIndex, value) {
  const lines = `${markdown || ''}`.split('\n');
  const safeIndex = Math.max(0, Math.min(lineIndex, Math.max(0, lines.length - 1)));
  lines[safeIndex] = value;
  return lines.join('\n');
}

function insertMarkdownLine(markdown, lineIndex) {
  const lines = `${markdown || ''}`.split('\n');
  const safeIndex = Math.max(0, Math.min(lineIndex + 1, lines.length));
  lines.splice(safeIndex, 0, '');
  return { content: lines.join('\n'), lineIndex: safeIndex };
}

if (typeof window !== 'undefined') {
  window.codexScheduler = {
    ...(window.codexScheduler || {}),
    addItem: addSchedulerItem
  };
}

function parentPathOf(path) {
  if (!path) return '';
  const tokens = path.split('/').filter(Boolean);
  tokens.pop();
  return tokens.join('/');
}

function monitorUrls() {
  const host = window.location.hostname || '192.168.45.101';
  return {
    grafana: `http://${host}:30300`,
    prometheus: `http://${host}:30090`
  };
}

function formatCpu(milli) {
  if (!milli) return '0m';
  if (milli >= 1000) return `${(milli / 1000).toFixed(1)} cores`;
  return `${milli}m`;
}

function formatMemory(mib) {
  if (!mib) return '0 MiB';
  if (mib >= 1024) return `${(mib / 1024).toFixed(1)} GiB`;
  return `${mib} MiB`;
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function validateAuthForm(mode, username, password) {
  const trimmedUsername = username.trim();
  if (!trimmedUsername) {
    return '아이디를 입력하세요.';
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmedUsername)) {
    return '아이디는 영문, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다.';
  }
  if (trimmedUsername.length > 40) {
    return '아이디는 40자 이하여야 합니다.';
  }
  if (!password.trim()) {
    return '비밀번호를 입력하세요.';
  }
  if (password.length < 4) {
    return '비밀번호는 4자 이상이어야 합니다.';
  }
  if (password.length > 100) {
    return '비밀번호는 100자 이하여야 합니다.';
  }
  return '';
}

function ToolbarIcon({ children }) {
  return (
    <span className="toolbarIcon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

function AuthScreen({ mode, setMode, username, setUsername, password, setPassword, onSubmit, loading, error }) {
  const validationError = validateAuthForm(mode, username, password);
  const disabled = loading || Boolean(validationError);

  return (
    <main className="loginShell">
      <section className="loginCard">
        <span className="sidebarEyebrow">Workspace Access</span>
        <h1>등록된 계정으로 작업공간을 엽니다</h1>
        <p>관리자가 발급한 계정으로 로그인하세요.</p>
        <label className="loginField">
          <span>ID</span>
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="my-id" />
        </label>
        <label className="loginField">
          <span>Password</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="password" />
        </label>
        <button type="button" className="loginButton" onClick={onSubmit} disabled={disabled}>
          {loading ? '처리 중...' : 'Login'}
        </button>
        {error || validationError ? <div className="loginHint">{error || validationError}</div> : null}
      </section>
    </main>
  );
}

function DirectoryTree({ path, depth = 0, selectedPath, expandedPaths, treeMap, loadingPaths, onToggle, onSelect }) {
  const node = treeMap.get(path);
  const entries = node?.entries?.filter((entry) => entry.type === 'dir') || [];

  return (
    <div className="treeLevel">
      {entries.map((entry) => {
        const nextPath = entry.path;
        const expanded = expandedPaths.includes(nextPath);
        const selected = selectedPath === nextPath;
        const loading = loadingPaths.includes(nextPath);

        return (
          <div key={nextPath} className="treeNode" style={{ '--depth': depth }}>
            <div className={`treeRow ${selected ? 'selected' : ''}`}>
              <button type="button" className="treeToggle" onClick={() => onToggle(nextPath)}>
                {expanded ? '−' : '+'}
              </button>
              <button type="button" className="treeLabel" onClick={() => onSelect(nextPath)}>
                {entry.name}
              </button>
              {loading ? <span className="treeState">…</span> : null}
            </div>
            {expanded ? (
              <DirectoryTree
                path={nextPath}
                depth={depth + 1}
                selectedPath={selectedPath}
                expandedPaths={expandedPaths}
                treeMap={treeMap}
                loadingPaths={loadingPaths}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Sidebar({ auth, onOpenLauncher, onLogout, selectedPath, expandedPaths, treeMap, loadingPaths, onToggle, onSelect }) {
  const root = treeMap.get('');
  const rootFolders = root?.entries?.filter((entry) => entry.type === 'dir') || [];

  return (
    <aside className="browserSidebar">
      <div className="sidebarHead">
        <span className="sidebarEyebrow">{auth.role}</span>
        <h1>{auth.username}</h1>
        <div className="sidebarActions">
          {auth.launcherUrl ? (
            <button type="button" className="ghostButton" onClick={onOpenLauncher}>
              Launcher
            </button>
          ) : null}
          <button type="button" className="ghostButton" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="sidebarTree">
        <div className="treeRoot">
          <button type="button" className={`treeRootLabel ${selectedPath === '' ? 'selected' : ''}`} onClick={() => onSelect('')}>
            Workspace Root
          </button>
        </div>
        {rootFolders.map((entry) => {
          const expanded = expandedPaths.includes(entry.path);
          const selected = selectedPath === entry.path;
          const loading = loadingPaths.includes(entry.path);
          return (
            <div key={entry.path} className="treeNode" style={{ '--depth': 0 }}>
              <div className={`treeRow ${selected ? 'selected' : ''}`}>
                <button type="button" className="treeToggle" onClick={() => onToggle(entry.path)}>
                  {expanded ? '−' : '+'}
                </button>
                <button type="button" className="treeLabel" onClick={() => onSelect(entry.path)}>
                  {entry.name}
                </button>
                {loading ? <span className="treeState">…</span> : null}
              </div>
              {expanded ? (
                <DirectoryTree
                  path={entry.path}
                  depth={1}
                  selectedPath={selectedPath}
                  expandedPaths={expandedPaths}
                  treeMap={treeMap}
                  loadingPaths={loadingPaths}
                  onToggle={onToggle}
                  onSelect={onSelect}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function AccountEditDialog({
  auth,
  open,
  loading,
  error,
  currentPassword,
  newPassword,
  confirmPassword,
  onCurrentPassword,
  onNewPassword,
  onConfirmPassword,
  onClose,
  onSubmit
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="modalOverlay" onClick={onClose}>
      <section className="accountDialog" onClick={(event) => event.stopPropagation()}>
        <div className="accountDialogHeader">
          <div>
            <span className="panelEyebrow">Account Edit</span>
            <h2>{auth.username}</h2>
            <p className="panelSubcopy">비밀번호를 변경할 수 있습니다.</p>
          </div>
          <button type="button" className="ghostButton compact" onClick={onClose}>닫기</button>
        </div>
        <div className="accountDialogBody">
          <label className="loginField">
            <span>Current Password</span>
            <input type="password" value={currentPassword} onChange={(event) => onCurrentPassword(event.target.value)} placeholder="현재 비밀번호" />
          </label>
          <label className="loginField">
            <span>New Password</span>
            <input type="password" value={newPassword} onChange={(event) => onNewPassword(event.target.value)} placeholder="새 비밀번호" />
          </label>
          <label className="loginField">
            <span>Confirm Password</span>
            <input type="password" value={confirmPassword} onChange={(event) => onConfirmPassword(event.target.value)} placeholder="새 비밀번호 확인" />
          </label>
          {error ? <div className="loginHint">{error}</div> : null}
        </div>
        <div className="accountDialogFooter">
          <button type="button" className="ghostButton" onClick={onClose}>취소</button>
          <button type="button" className="sendButton" onClick={onSubmit} disabled={loading}>
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </section>
    </div>
  );
}

function WorkspaceHeader({
  auth,
  navigate,
  selectedPath,
  rightPanel,
  setRightPanel,
  userMenuOpen,
  setUserMenuOpen,
  onOpenLauncher,
  onOpenAccountEdit,
  onLogout
}) {
  const isGuest = Boolean(auth.isGuest);

  return (
    <header className="workspaceTopbar">
      <section className="workspacePathCard">
        <span className="panelEyebrow">Workspace</span>
        <code className="workspacePathCode">{workspacePathFor(selectedPath)}</code>
      </section>
      <div className="workspaceUserTray">
        <div className="workspaceTopTabs">
          <button type="button" className="ghostButton compact" onClick={() => navigate(APP_SHORTCUTS.aiTrip.path)}>{APP_SHORTCUTS.aiTrip.label}</button>
          <button type="button" className="ghostButton compact" onClick={() => navigate(APP_SHORTCUTS.personalScheduler.path)}>{APP_SHORTCUTS.personalScheduler.label}</button>
          <button type="button" className="ghostButton compact" onClick={() => navigate(APP_SHORTCUTS.aiMemoBoard.path)}>{APP_SHORTCUTS.aiMemoBoard.label}</button>
        </div>
        <div className="workspaceTopTabs">
          <button type="button" className={`ghostButton compact ${rightPanel === 'rag' ? 'active' : ''}`} onClick={() => setRightPanel('rag')}>RAG</button>
          <button type="button" className={`ghostButton compact ${rightPanel === 'gemini' ? 'active' : ''}`} onClick={() => setRightPanel('gemini')}>LLM</button>
          <button type="button" className={`ghostButton compact ${rightPanel === 'editor' ? 'active' : ''}`} onClick={() => setRightPanel('editor')}>파일 편집기</button>
          {auth.role === 'ADMIN' ? (
            <button type="button" className={`ghostButton compact ${rightPanel === 'monitor' ? 'active' : ''}`} onClick={() => setRightPanel('monitor')}>리소스</button>
          ) : null}
        </div>
        {auth.launcherUrl ? (
          <button type="button" className="ghostButton" onClick={onOpenLauncher}>
            분석 환경
          </button>
        ) : null}
        {isGuest ? (
          <div className="workspaceGuestActions">
            <div className="workspaceUserButton guestLabel" aria-label="Guest session">
              <span>Guest</span>
              <strong>{auth.username}</strong>
            </div>
            <button type="button" className="ghostButton compact" onClick={() => { localStorage.removeItem(AUTH_KEY); navigate('/'); }}>Login</button>
          </div>
        ) : (
          <div className="userMenuWrap">
            <button
              type="button"
              className={`workspaceUserButton ${userMenuOpen ? 'open' : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                setUserMenuOpen((current) => !current);
              }}
            >
              <span>{auth.role}</span>
              <strong>{auth.username}</strong>
            </button>
            {userMenuOpen ? (
              <div className="userMenuDropdown" onClick={(event) => event.stopPropagation()}>
                <button type="button" onClick={onOpenAccountEdit}>계정 설정</button>
                <button type="button" onClick={onLogout}>로그아웃</button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </header>
  );
}

function FileList({
  currentTree,
  selectedPath,
  selectedFile,
  createDraft,
  setCreateDraft,
  filter,
  onFilter,
  onOpen,
  onOpenDir,
  onRunPython,
  onRename,
  onRefresh,
  onGoParent,
  onNewFile,
  onNewFolder,
  onUploadClick,
  onContextMenu,
  contextMenu
}) {
  const [renameDraft, setRenameDraft] = useState(null);

  const files = useMemo(() => {
    const keyword = filter.trim().toLowerCase();
    const sorted = currentTree.entries
      .slice()
      .sort((left, right) => {
        if (left.type !== right.type) {
          return left.type === 'dir' ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      });
    if (!keyword) return sorted;
    return sorted.filter((entry) => entry.name.toLowerCase().includes(keyword));
  }, [currentTree.entries, filter]);

  const submitCreateDraft = async () => {
    if (!createDraft?.name?.trim()) {
      return;
    }
    const name = createDraft.name.trim();
    const basePath = createDraft.basePath || '';
    if (createDraft.kind === 'file') {
      await onNewFile(basePath, name);
    } else {
      await onNewFolder(basePath, name);
    }
    setCreateDraft(null);
  };

  const submitRenameDraft = async () => {
    if (!renameDraft?.name?.trim() || renameDraft.name.trim() === labelForPath(renameDraft.path)) {
      setRenameDraft(null);
      return;
    }
    await onRename(renameDraft.path, renameDraft.name.trim());
    setRenameDraft(null);
  };

  return (
    <section className="browserListPanel" onContextMenu={(event) => onContextMenu(event, currentTree.currentPath || '', false, false, false)}>
      <div className="panelTop simple">
        <div className="listActionBar">
          <button type="button" className="iconButton actionIconButton" title="상위 폴더로 이동" aria-label="상위 폴더로 이동" onClick={onGoParent}>
            <ToolbarIcon>
              <path d="M9 7 4 12l5 5" />
              <path d="M20 12H4" />
            </ToolbarIcon>
          </button>
          <button type="button" className="iconButton actionIconButton" title="새로고침" aria-label="새로고침" onClick={onRefresh}>
            <ToolbarIcon>
              <path d="M20 11a8 8 0 1 0 2 5.5" />
              <path d="M20 4v7h-7" />
            </ToolbarIcon>
          </button>
          <button type="button" className="iconButton actionIconButton primary" title="파일 업로드" aria-label="파일 업로드" onClick={onUploadClick}>
            <ToolbarIcon>
              <path d="M12 16V5" />
              <path d="m7 10 5-5 5 5" />
              <path d="M5 19h14" />
            </ToolbarIcon>
          </button>
        </div>
        <div className="listFilterGroup">
          <input value={filter} onChange={(event) => onFilter(event.target.value)} placeholder="파일 또는 폴더 검색" />
        </div>
      </div>
      <div className="entryList">
        {files.map((entry) => (
          <div
            key={entry.path}
            className={`entryRow ${selectedFile === entry.path || selectedPath === entry.path ? 'active' : ''}`}
            onContextMenu={(event) => onContextMenu(event, entry.path, entry.type === 'file', true, true)}
          >
            <div
              role="button"
              tabIndex={0}
              className="entryMain"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'copy';
                event.dataTransfer.setData('application/x-jupiter-workspace', JSON.stringify({
                  path: entry.path,
                  type: entry.type
                }));
                event.dataTransfer.setData('text/plain', entry.path);
              }}
              onClick={() => {
                if (renameDraft?.path === entry.path) {
                  return;
                }
                if (entry.type === 'dir') {
                  onOpenDir(entry.path);
                } else {
                  onOpen(entry.path);
                }
              }}
              onKeyDown={(event) => {
                if (renameDraft?.path === entry.path) {
                  return;
                }
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  if (entry.type === 'dir') {
                    onOpenDir(entry.path);
                  } else {
                    onOpen(entry.path);
                  }
                }
              }}
            >
              <div className="entryMeta">
                <span className={`entryType ${entry.type}`}>{entry.type === 'dir' ? 'DIR' : extensionForPath(entry.path).toUpperCase()}</span>
                <div className="entryText">
                  {renameDraft?.path === entry.path ? (
                    <input
                      className="inlineNameInput"
                      value={renameDraft.name}
                      autoFocus
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => setRenameDraft((current) => ({ ...current, name: event.target.value }))}
                      onBlur={() => { submitRenameDraft().catch(() => {}); }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          submitRenameDraft().catch(() => {});
                        }
                        if (event.key === 'Escape') {
                          setRenameDraft(null);
                        }
                      }}
                    />
                  ) : (
                    <strong>{entry.name}</strong>
                  )}
                </div>
              </div>
              <span className="entrySize">{formatSize(entry.size)}</span>
            </div>
            {extensionForPath(entry.path) === 'py' ? (
              <button type="button" className="runButton" onClick={() => onRunPython(entry.path)} title="Python 실행">
                &gt;
              </button>
            ) : null}
          </div>
        ))}
        {!files.length && !createDraft ? <p className="emptyNotice">표시할 파일이 없습니다.</p> : null}
        {createDraft ? (
          <div className="entryRow createDraftRow">
            <div className="createDraftKinds">
              <button
                type="button"
                className={`ghostButton compact ${createDraft.kind === 'file' ? 'active' : ''}`}
                onClick={() => setCreateDraft((current) => ({ ...current, kind: 'file' }))}
              >
                파일
              </button>
              <button
                type="button"
                className={`ghostButton compact ${createDraft.kind === 'folder' ? 'active' : ''}`}
                onClick={() => setCreateDraft((current) => ({ ...current, kind: 'folder' }))}
              >
                폴더
              </button>
            </div>
            <input
              className="inlineNameInput createDraftInput"
              value={createDraft.name}
              autoFocus
              placeholder={createDraft.kind === 'file' ? '파일 이름' : '폴더 이름'}
              onChange={(event) => setCreateDraft((current) => ({ ...current, name: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submitCreateDraft().catch(() => {});
                }
                if (event.key === 'Escape') {
                  setCreateDraft(null);
                }
              }}
            />
            <button type="button" className="ghostButton compact" onClick={() => setCreateDraft(null)}>취소</button>
            <button type="button" className="sendButton compactStrong" onClick={() => submitCreateDraft().catch(() => {})}>만들기</button>
          </div>
        ) : null}
      </div>
      <div className="listFooter">
        <button
          type="button"
          className="iconButton actionIconButton"
          title="새 항목 만들기"
          aria-label="새 항목 만들기"
          onClick={() => setCreateDraft({ kind: 'file', name: '', basePath: currentTree.currentPath || '' })}
        >
          <ToolbarIcon>
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </ToolbarIcon>
        </button>
      </div>
      {contextMenu ? (
        <div className="contextMenu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          {contextMenu.renameTargetPath ? (
            <button
              type="button"
              onClick={() => {
                setRenameDraft({ path: contextMenu.renameTargetPath, name: labelForPath(contextMenu.renameTargetPath) });
                contextMenu.onClose();
              }}
            >
              이름 변경
            </button>
          ) : null}
          {contextMenu.deleteTargetPath ? (
            <button type="button" className="dangerMenuAction" onClick={contextMenu.onDelete}>삭제</button>
          ) : null}
          <button type="button" onClick={contextMenu.onNewFile}>새 파일</button>
          <button type="button" onClick={contextMenu.onNewFolder}>새 폴더</button>
          <button type="button" onClick={contextMenu.onUpload}>업로드</button>
          <button type="button" onClick={contextMenu.onRefresh}>새로고침</button>
        </div>
      ) : null}
    </section>
  );
}

function EditorPanel({ selectedFile, content, setContent, loading, error, outputState, onSave, onDelete, onDownload, autoSave, saveStatus }) {
  const hasOutput = outputState.command || outputState.stdout || outputState.stderr;
  return (
    <section className="browserPreviewPanel">
      <div className="editorHeader">
        <div>
          <span className="panelEyebrow">Editor</span>
          <h2>{selectedFile ? labelForPath(selectedFile) : '편집할 파일을 선택하세요'}</h2>
          {selectedFile ? <p className="panelSubcopy">{selectedFile}</p> : null}
          {autoSave && selectedFile ? <p className="panelSubcopy">{saveStatus || '자동 저장 준비됨'}</p> : null}
        </div>
        {selectedFile ? (
          <div className="chatHeaderActions">
            <button type="button" className="ghostButton compact" onClick={onDownload}>다운로드</button>
            <button type="button" className="ghostButton compact" onClick={onDelete}>삭제</button>
            <button type="button" className="sendButton" onClick={onSave}>{autoSave ? '지금 저장' : '저장'}</button>
          </div>
        ) : null}
      </div>
      {loading ? <p className="previewState">파일을 불러오는 중입니다.</p> : null}
      {error ? <p className="previewError">{error}</p> : null}
      {!loading && !error && !selectedFile ? <div className="previewEmpty"><p>왼쪽에서 폴더를 고르고 가운데에서 파일을 선택하세요.</p></div> : null}
      {!loading && selectedFile ? (
        <>
          <div className="editorCodeWrap">
            <Suspense fallback={<div className="editorLoading">편집기를 불러오는 중입니다.</div>}>
              <LazyCodeEditor
                path={selectedFile}
                value={content}
                onChange={(value) => setContent(value)}
                onSave={onSave}
              />
            </Suspense>
          </div>
          <div className="editorOutputSection">
            <div className="editorOutputHeader">
              <strong>실행 로그</strong>
              {outputState.command ? <span className="statusMeta">{outputState.command}</span> : null}
            </div>
            {outputState.running ? <p className="previewState">실행 중입니다.</p> : null}
            {!outputState.running && !hasOutput ? (
              <div className="previewEmpty"><p>`.py` 파일 오른쪽 실행 버튼을 누르면 이 파일 아래에 실행 로그가 표시됩니다.</p></div>
            ) : null}
            {hasOutput ? (
              <div className="outputShell">
                {outputState.stdout ? (
                  <>
                    <strong className="outputLabel">stdout</strong>
                    <pre className="outputBlock">{outputState.stdout}</pre>
                  </>
                ) : null}
                {outputState.stderr ? (
                  <>
                    <strong className="outputLabel">stderr</strong>
                    <pre className="outputBlock error">{outputState.stderr}</pre>
                  </>
                ) : null}
                {!outputState.timedOut ? (
                  <p className="statusMeta">종료 코드: {outputState.exitCode}</p>
                ) : (
                  <p className="statusMeta">실행 시간이 초과되어 종료했습니다.</p>
                )}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}

function StatTile({ label, value, detail, tone = 'default' }) {
  return (
    <article className={`monitorStatTile ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

function UsageBar({ value }) {
  const width = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className="usageBar" aria-label={`${width.toFixed(1)}%`}>
      <span style={{ width: `${width}%` }} />
    </div>
  );
}

function AdminMonitorPanel({ authToken, activeMonitor, setActiveMonitor }) {
  const monitors = monitorUrls();
  const currentUrl = activeMonitor === 'prometheus' ? monitors.prometheus : monitors.grafana;
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [monitorError, setMonitorError] = useState('');
  const [containerSort, setContainerSort] = useState('cpu');

  const loadDashboard = async (silent = false) => {
    if (!authToken) return;
    if (!silent) setLoading(true);
    setMonitorError('');
    try {
      const data = await requestJson('/api/monitoring/cluster', { headers: authHeaders(authToken) });
      setDashboard(data);
    } catch (loadError) {
      setMonitorError(loadError.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard().catch(() => {});
    const timer = window.setInterval(() => {
      loadDashboard(true).catch(() => {});
    }, 10000);
    return () => window.clearInterval(timer);
  }, [authToken]);

  const summary = dashboard?.summary;
  const nodes = dashboard?.nodes || [];
  const namespaces = dashboard?.namespaces || [];
  const containers = [...(dashboard?.containers || [])].sort((left, right) => {
    if (containerSort === 'memory') {
      return right.memoryUsageMi - left.memoryUsageMi || right.cpuUsageMilli - left.cpuUsageMilli;
    }
    if (containerSort === 'restart') {
      return right.restartCount - left.restartCount || right.cpuUsageMilli - left.cpuUsageMilli;
    }
    return right.cpuUsageMilli - left.cpuUsageMilli || right.memoryUsageMi - left.memoryUsageMi;
  });

  return (
    <section className="browserPreviewPanel monitorDashboardPanel">
      <div className="editorHeader">
        <div>
          <span className="panelEyebrow">Cluster Resources</span>
          <h2>인프라 리소스 모니터링</h2>
          <p className="panelSubcopy">
            {dashboard ? `최근 수집: ${formatDateTime(dashboard.generatedAt)}` : '클러스터 CPU, 메모리, 컨테이너 상태를 한 화면에서 확인합니다.'}
          </p>
        </div>
        <div className="chatHeaderActions">
          <button type="button" className="ghostButton compact" onClick={() => loadDashboard()} disabled={loading}>
            {loading ? '갱신 중' : '새로고침'}
          </button>
          <button type="button" className={`ghostButton compact ${activeMonitor === 'grafana' ? 'active' : ''}`} onClick={() => setActiveMonitor('grafana')}>Grafana</button>
          <button type="button" className={`ghostButton compact ${activeMonitor === 'prometheus' ? 'active' : ''}`} onClick={() => setActiveMonitor('prometheus')}>Prometheus</button>
          <button type="button" className="sendButton" onClick={() => window.open(currentUrl, '_blank', 'noopener,noreferrer')}>새 창으로 열기</button>
        </div>
      </div>
      {monitorError ? <p className="previewError">{monitorError}</p> : null}
      {!dashboard && !monitorError ? <p className="previewState">클러스터 메트릭을 불러오는 중입니다.</p> : null}
      {dashboard ? (
        <div className="monitorDashboard">
          <div className="monitorHero">
            <StatTile
              label="CPU"
              value={formatCpu(summary?.cpuUsageMilli)}
              detail={`${formatPercent(summary?.cpuUsagePercent)} of ${formatCpu(summary?.cpuCapacityMilli)}`}
              tone="cpu"
            />
            <StatTile
              label="메모리"
              value={formatMemory(summary?.memoryUsageMi)}
              detail={`${formatPercent(summary?.memoryUsagePercent)} / ${formatMemory(summary?.memoryCapacityMi)}`}
              tone="memory"
            />
            <StatTile
              label="파드"
              value={`${summary?.runningPodCount || 0}/${summary?.podCount || 0}`}
              detail={`${summary?.containerCount || 0}개 컨테이너`}
            />
            <StatTile
              label="GPU"
              value={`${summary?.gpuAllocatable || 0}/${summary?.gpuCapacity || 0}`}
              detail={summary?.gpuCapacity ? 'GPU 리소스 노출됨' : 'GPU 리소스 없음'}
              tone={summary?.gpuCapacity ? 'gpu' : 'muted'}
            />
          </div>

          {dashboard.warnings?.length ? (
            <div className="monitorWarning">
              {dashboard.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          ) : null}

          <div className="monitorSectionGrid">
            <section className="monitorCard">
              <div className="monitorCardHeader">
                <span className="panelEyebrow">Nodes</span>
                <strong>{summary?.nodeCount || 0}개 노드</strong>
              </div>
              <div className="nodeUsageList">
                {nodes.map((node) => (
                  <article className="nodeUsageCard" key={node.name}>
                    <div className="nodeUsageTitle">
                      <div>
                        <strong>{node.name}</strong>
                        <span>{node.role} · {node.status} · {node.podCount}개 파드</span>
                      </div>
                      <span className="statusPill ok">{formatPercent(node.cpuUsagePercent)}</span>
                    </div>
                    <div className="nodeUsageMetric">
                      <span>CPU {formatCpu(node.cpuUsageMilli)} / {formatCpu(node.cpuCapacityMilli)}</span>
                      <UsageBar value={node.cpuUsagePercent} />
                    </div>
                    <div className="nodeUsageMetric">
                      <span>RAM {formatMemory(node.memoryUsageMi)} / {formatMemory(node.memoryCapacityMi)}</span>
                      <UsageBar value={node.memoryUsagePercent} />
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="monitorCard">
              <div className="monitorCardHeader">
                <span className="panelEyebrow">Namespaces</span>
                <strong>{summary?.namespaceCount || 0}개 네임스페이스</strong>
              </div>
              <div className="monitorTable compactTable">
                <div className="monitorTableHead namespaceColumns">
                  <span>네임스페이스</span>
                  <span>파드</span>
                  <span>CPU</span>
                  <span>메모리</span>
                </div>
                {namespaces.slice(0, 12).map((namespace) => (
                  <div className="monitorTableRow namespaceColumns" key={namespace.name}>
                    <strong>{namespace.name}</strong>
                    <span>{namespace.runningPodCount}/{namespace.podCount}</span>
                    <span>{formatCpu(namespace.cpuUsageMilli)}</span>
                    <span>{formatMemory(namespace.memoryUsageMi)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="monitorCard containerMonitorCard">
            <div className="monitorCardHeader">
              <div>
                <span className="panelEyebrow">Container Usage</span>
                <strong>전체 {containers.length}개 컨테이너</strong>
              </div>
              <div className="chatHeaderActions">
                <button type="button" className={`ghostButton compact ${containerSort === 'cpu' ? 'active' : ''}`} onClick={() => setContainerSort('cpu')}>CPU</button>
                <button type="button" className={`ghostButton compact ${containerSort === 'memory' ? 'active' : ''}`} onClick={() => setContainerSort('memory')}>메모리</button>
                <button type="button" className={`ghostButton compact ${containerSort === 'restart' ? 'active' : ''}`} onClick={() => setContainerSort('restart')}>재시작</button>
              </div>
            </div>
            <div className="monitorTable containerTable">
              <div className="monitorTableHead containerColumns">
                <span>네임스페이스 / 파드</span>
                <span>컨테이너</span>
                <span>노드</span>
                <span>CPU</span>
                <span>메모리</span>
                <span>재시작</span>
              </div>
              {containers.map((container) => (
                <div className="monitorTableRow containerColumns" key={`${container.namespace}/${container.pod}/${container.container}`}>
                  <div className="containerPodCell">
                    <strong>{container.namespace}</strong>
                    <span>{container.pod}</span>
                  </div>
                  <span>{container.container}</span>
                  <span>{container.node || '-'}</span>
                  <span>{formatCpu(container.cpuUsageMilli)}</span>
                  <span>{formatMemory(container.memoryUsageMi)}</span>
                  <span>{container.restartCount}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function WorkspaceApp({ navigate }) {
  const [authMode, setAuthMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [auth, setAuth] = useState(readStoredAuth());
  const [treeMap, setTreeMap] = useState(new Map());
  const [selectedPath, setSelectedPath] = useState('');
  const [selectedFile, setSelectedFile] = useState('');
  const [content, setContent] = useState('');
  const [filter, setFilter] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [autoSave, setAutoSave] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [lastLoadedFile, setLastLoadedFile] = useState('');
  const [loadingPaths, setLoadingPaths] = useState([]);
  const [expandedPaths, setExpandedPaths] = useState([]);
  const [error, setError] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [createDraft, setCreateDraft] = useState(null);
  const [activeMonitor, setActiveMonitor] = useState('grafana');
  const [rightPanel, setRightPanel] = useState('gemini');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [accountEditOpen, setAccountEditOpen] = useState(false);
  const [accountEditLoading, setAccountEditLoading] = useState(false);
  const [accountEditError, setAccountEditError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pythonOutput, setPythonOutput] = useState({
    file: '',
    command: '',
    stdout: '',
    stderr: '',
    exitCode: 0,
    timedOut: false,
    running: false
  });
  const uploadRef = useRef(null);

  const loadTree = async (path, force = false, token = auth?.token) => {
    if (!token) return null;
    if (!force && treeMap.has(path)) return treeMap.get(path);
    setLoadingPaths((current) => [...new Set([...current, path])]);
    try {
      const data = await requestJson(`/api/workspace/tree?path=${encodeURIComponent(path)}`, { headers: authHeaders(token) });
      setTreeMap((current) => {
        const next = new Map(current);
        next.set(path, data);
        return next;
      });
      return data;
    } finally {
      setLoadingPaths((current) => current.filter((item) => item !== path));
    }
  };

  useEffect(() => {
    document.title = 'Codex Workspace Browser';
  }, []);

  useEffect(() => {
    if (!auth?.token) {
      setRightPanel('editor');
    }
  }, [auth?.token]);

  useEffect(() => {
    const closeMenu = () => {
      setContextMenu(null);
      setUserMenuOpen(false);
    };
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    if (!auth?.token) {
      localStorage.removeItem(AUTH_KEY);
      return;
    }
    localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    loadTree('', true, auth.token).catch((loadError) => setError(loadError.message));
  }, [auth]);

  useEffect(() => {
    if (!auth?.token) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      requestJson(`/api/workspace/tree?path=${encodeURIComponent(selectedPath)}`, {
        headers: authHeaders(auth.token)
      })
        .then((data) => {
          setTreeMap((current) => {
            const next = new Map(current);
            next.set(selectedPath, data);
            return next;
          });
        })
        .catch(() => {});
    }, 5000);
    return () => window.clearInterval(timer);
  }, [auth?.token, selectedPath]);

  const currentTree = treeMap.get(selectedPath) || { currentPath: selectedPath, entries: [] };

  const handleAuth = async () => {
    const validationError = validateAuthForm(authMode, username, password);
    if (validationError || authLoading) {
      setAuthError(validationError);
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      const session = await requestJson('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (session.role !== 'ADMIN') {
        localStorage.removeItem(AUTH_KEY);
        setAuth(null);
        setAuthError('접근 권한이 없습니다.');
        return;
      }
      setAuth(session);
      setUsername('');
      setPassword('');
    } catch (submitError) {
      setAuthError(submitError.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSelectDir = async (path) => {
    setContextMenu(null);
    setSelectedPath(path);
    setSelectedFile('');
    setContent('');
    setError('');
    await loadTree(path, false).catch((loadError) => setError(loadError.message));
  };

  const handleToggle = async (path) => {
    if (expandedPaths.includes(path)) {
      setExpandedPaths((current) => current.filter((item) => item !== path));
      return;
    }
    setExpandedPaths((current) => [...current, path]);
    await loadTree(path, false).catch((loadError) => setError(loadError.message));
  };

  const handleOpenFile = async (path) => {
    setContextMenu(null);
    setSelectedFile(path);
    setRightPanel('editor');
    setLoadingFile(true);
    setError('');
    try {
      const text = await requestText(`/api/workspace/file?path=${encodeURIComponent(path)}`, auth.token);
      setContent(text);
      setLastLoadedFile(path);
    } catch (loadError) {
      setError(loadError.message);
      setContent('');
    } finally {
      setLoadingFile(false);
    }
  };

  useEffect(() => {
    if (!auth?.token) return;
    const params = new URLSearchParams(window.location.search);
    const filePath = params.get('file');
    setAutoSave(params.get('autosave') === '1');
    if (!filePath) return;
    const parentPath = parentPathOf(filePath);
    setSelectedPath(parentPath);
    loadTree(parentPath, true)
      .then(() => handleOpenFile(filePath))
      .catch((loadError) => setError(loadError.message));
    window.history.replaceState({}, '', '/analysisadmin');
  }, [auth?.token]);

  useEffect(() => {
    if (!autoSave || !auth?.token || !selectedFile || loadingFile || selectedFile !== lastLoadedFile) {
      return undefined;
    }
    setSaveStatus('변경 내용을 자동 저장하는 중...');
    const timer = window.setTimeout(() => {
      requestJson('/api/workspace/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(auth.token) },
        body: JSON.stringify({ path: selectedFile, content })
      })
        .then(() => {
          setSaveStatus('자동 저장됨');
          return loadTree(selectedPath, true);
        })
        .catch((saveError) => {
          setSaveStatus(saveError.message);
        });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [autoSave, auth?.token, selectedFile, content, loadingFile, lastLoadedFile, selectedPath]);

  const handleRename = async (path, nextName) => {
    setContextMenu(null);
    const currentName = labelForPath(path);
    const newName = nextName?.trim();
    if (!newName || newName === currentName) {
      return;
    }
    try {
      const result = await requestJson('/api/workspace/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(auth.token) },
        body: JSON.stringify({ path, newName })
      });
      const renamedPath = result.path;
      const parent = parentPathOf(path);
      await loadTree(parent, true);
      if (selectedPath === path) {
        setSelectedPath(renamedPath);
      }
      if (selectedFile === path) {
        setSelectedFile(renamedPath);
      }
    } catch (renameError) {
      setError(renameError.message);
    }
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    try {
      await requestJson('/api/workspace/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(auth.token) },
        body: JSON.stringify({ path: selectedFile, content })
      });
      setSaveStatus('저장됨');
      await loadTree(selectedPath, true);
    } catch (saveError) {
      setError(saveError.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedFile) return;
    try {
      await requestJson(`/api/workspace/item?path=${encodeURIComponent(selectedFile)}`, {
        method: 'DELETE',
        headers: authHeaders(auth.token)
      });
      setSelectedFile('');
      setContent('');
      await loadTree(selectedPath, true);
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const handleDeletePath = async (path) => {
    if (!path) return;
    const targetLabel = labelForPath(path);
    const confirmed = window.confirm(`'${targetLabel}' 항목을 삭제할까요?`);
    if (!confirmed) {
      return;
    }

    const parent = parentPathOf(path);
    try {
      await requestJson(`/api/workspace/item?path=${encodeURIComponent(path)}`, {
        method: 'DELETE',
        headers: authHeaders(auth.token)
      });

      if (selectedFile === path || selectedFile.startsWith(`${path}/`)) {
        setSelectedFile('');
        setContent('');
      }

      if (selectedPath === path || selectedPath.startsWith(`${path}/`)) {
        setSelectedPath(parent);
        await loadTree(parent, true);
        return;
      }

      await loadTree(parent || selectedPath, true);
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const handleDownload = async () => {
    if (!selectedFile) return;
    const response = await fetch(`/api/workspace/download?path=${encodeURIComponent(selectedFile)}`, {
      headers: authHeaders(auth.token)
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = labelForPath(selectedFile);
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('path', selectedPath);
    form.append('file', file);
    try {
      const response = await fetch('/api/workspace/upload', {
        method: 'POST',
        headers: authHeaders(auth.token),
        body: form
      });
      if (!response.ok) {
        throw new Error((await response.text()) || `HTTP ${response.status}`);
      }
      await loadTree(selectedPath, true);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      event.target.value = '';
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    setAuth(null);
    setTreeMap(new Map());
    setSelectedPath('');
    setSelectedFile('');
    setContent('');
    setFilter('');
    setError('');
    setAuthError('');
    setExpandedPaths([]);
    setContextMenu(null);
    setUserMenuOpen(false);
    setAccountEditOpen(false);
    setAccountEditError('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setCreateDraft(null);
    setRightPanel('editor');
    setPythonOutput({
      file: '',
      command: '',
      stdout: '',
      stderr: '',
      exitCode: 0,
      timedOut: false,
      running: false
    });
  };

  const openAccountEdit = () => {
    setUserMenuOpen(false);
    setAccountEditError('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setAccountEditOpen(true);
  };

  const closeAccountEdit = () => {
    setAccountEditOpen(false);
    setAccountEditError('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const submitAccountEdit = async () => {
    if (accountEditLoading) {
      return;
    }
    if (!currentPassword.trim()) {
      setAccountEditError('현재 비밀번호를 입력하세요.');
      return;
    }
    if (newPassword.length < 4) {
      setAccountEditError('새 비밀번호는 4자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setAccountEditError('새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    setAccountEditLoading(true);
    setAccountEditError('');
    try {
      await requestJson('/api/auth/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(auth.token) },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      closeAccountEdit();
    } catch (submitError) {
      setAccountEditError(submitError.message);
    } finally {
      setAccountEditLoading(false);
    }
  };

  const handleRefresh = async () => {
    setContextMenu(null);
    await loadTree(selectedPath, true).catch((loadError) => setError(loadError.message));
  };

  const handleGoParent = async () => {
    const nextPath = parentPathOf(selectedPath);
    await handleSelectDir(nextPath);
  };

  const handleRunPython = async (path) => {
    setSelectedFile(path);
    setRightPanel('editor');
    setPythonOutput({
      file: path,
      command: '',
      stdout: '',
      stderr: '',
      exitCode: 0,
      timedOut: false,
      running: true
    });
    try {
      const result = await requestJson(`/api/workspace/run-python?path=${encodeURIComponent(path)}`, {
        method: 'POST',
        headers: authHeaders(auth.token)
      });
      setPythonOutput({
        file: path,
        command: result.command || '',
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: typeof result.exitCode === 'number' ? result.exitCode : 0,
        timedOut: Boolean(result.timedOut),
        running: false
      });
    } catch (runError) {
      setPythonOutput({
        file: path,
        command: `python ${path}`,
        stdout: '',
        stderr: runError.message,
        exitCode: 1,
        timedOut: false,
        running: false
      });
    }
  };

  const handleCreateFile = async (basePath = selectedPath, nextName = '') => {
    setContextMenu(null);
    const previous = selectedPath;
    if (basePath !== previous) {
      setSelectedPath(basePath);
    }
    const name = nextName.trim();
    if (!name) return;
    try {
      await requestJson('/api/workspace/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(auth.token) },
        body: JSON.stringify({ path: joinPath(basePath, name), content: '' })
      });
      await loadTree(basePath, true);
      if (basePath !== previous) {
        setSelectedPath(basePath);
      }
    } catch (createError) {
      setError(createError.message);
    }
  };

  const handleCreateFolder = async (basePath = selectedPath, nextName = '') => {
    setContextMenu(null);
    const previous = selectedPath;
    if (basePath !== previous) {
      setSelectedPath(basePath);
    }
    const name = nextName.trim();
    if (!name) return;
    try {
      await requestJson(`/api/workspace/folder?path=${encodeURIComponent(joinPath(basePath, name))}`, {
        method: 'POST',
        headers: authHeaders(auth.token)
      });
      await loadTree(basePath, true);
      if (basePath !== previous) {
        setSelectedPath(basePath);
      }
    } catch (createError) {
      setError(createError.message);
    }
  };

  const openContextMenu = (event, targetPath, isFileTarget, allowRename = false, allowDelete = false) => {
    event.preventDefault();
    event.stopPropagation();
    const basePath = isFileTarget ? parentPathOf(targetPath) : targetPath;
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      renameTargetPath: allowRename ? targetPath : '',
      deleteTargetPath: allowDelete ? targetPath : '',
      onClose: () => setContextMenu(null),
      onNewFile: () => {
        setContextMenu(null);
        if (basePath !== selectedPath) {
          setSelectedPath(basePath);
        }
        setCreateDraft({ basePath, kind: 'file', name: '' });
      },
      onNewFolder: () => {
        setContextMenu(null);
        if (basePath !== selectedPath) {
          setSelectedPath(basePath);
        }
        setCreateDraft({ basePath, kind: 'folder', name: '' });
      },
      onUpload: () => {
        setContextMenu(null);
        if (basePath !== selectedPath) {
          setSelectedPath(basePath);
        }
        uploadRef.current?.click();
      },
      onDelete: async () => {
        setContextMenu(null);
        await handleDeletePath(targetPath);
      },
      onRefresh: handleRefresh
    });
  };

  if (!auth?.token) {
    return (
      <AuthScreen
        mode={authMode}
        setMode={setAuthMode}
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        onSubmit={handleAuth}
        loading={authLoading}
        error={authError}
      />
    );
  }

  if (auth.role !== 'ADMIN') {
    localStorage.removeItem(AUTH_KEY);
    return (
      <AuthScreen
        mode={authMode}
        setMode={setAuthMode}
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        onSubmit={handleAuth}
        loading={authLoading}
        error="접근 권한이 없습니다."
      />
    );
  }

  return (
    <main className="workspaceBrowserShell">
      <input ref={uploadRef} type="file" hidden onChange={handleUpload} />
      <WorkspaceHeader
        auth={auth}
        navigate={navigate}
        selectedPath={selectedPath}
        rightPanel={rightPanel}
        setRightPanel={setRightPanel}
        userMenuOpen={userMenuOpen}
        setUserMenuOpen={setUserMenuOpen}
        onOpenLauncher={() => auth.launcherUrl && window.open(auth.launcherUrl, '_blank', 'noopener,noreferrer')}
        onOpenAccountEdit={openAccountEdit}
        onLogout={handleLogout}
      />
      <FileList
        currentTree={currentTree}
        selectedPath={selectedPath}
        selectedFile={selectedFile}
        createDraft={createDraft}
        setCreateDraft={setCreateDraft}
        filter={filter}
        onFilter={setFilter}
        onOpen={handleOpenFile}
        onOpenDir={handleSelectDir}
        onRunPython={handleRunPython}
        onRename={handleRename}
        onRefresh={handleRefresh}
        onGoParent={handleGoParent}
        onNewFile={handleCreateFile}
        onNewFolder={handleCreateFolder}
        onUploadClick={() => uploadRef.current?.click()}
        onContextMenu={openContextMenu}
        contextMenu={contextMenu}
      />
      <div className="rightPanelStack">
        <div className={rightPanel === 'gemini' ? 'panelVisible' : 'panelHidden'}>
          <Suspense fallback={<div className="previewState">AI 작업 패널을 불러오는 중입니다.</div>}>
            <LazyGeminiApp
              authToken={auth.token}
              directoryPath={selectedPath}
              filePath={selectedFile}
              embedded
            />
          </Suspense>
        </div>
        <div className={rightPanel === 'rag' ? 'panelVisible' : 'panelHidden'}>
          <Suspense fallback={<div className="previewState">RAG를 불러오는 중입니다.</div>}>
            <LazyRagApp
              authToken={auth.token}
              directoryPath={selectedPath}
              filePath={selectedFile}
              title={selectedFile || selectedPath || 'workspace-rag'}
              pageTitle={selectedFile ? `문서 검색 · ${labelForPath(selectedFile)}` : selectedPath ? `문서 검색 · ${labelForPath(selectedPath)}` : '워크스페이스 문서 검색'}
              persistToWorkspace
              defaultQuestion={selectedFile
                ? `${labelForPath(selectedFile)} 기준으로 먼저 확인해야 할 리스크를 정리해줘.`
                : '워크스페이스 문서 기준으로 먼저 확인해야 할 리스크를 정리해줘.'}
              embedded
            />
          </Suspense>
        </div>
        <div className={rightPanel === 'editor' ? 'panelVisible' : 'panelHidden'}>
          <EditorPanel
            selectedFile={selectedFile}
            content={content}
            setContent={setContent}
            loading={loadingFile}
            error={error}
            outputState={pythonOutput}
            onSave={handleSave}
            onDelete={handleDelete}
            onDownload={handleDownload}
            autoSave={autoSave}
            saveStatus={saveStatus}
          />
        </div>
        {auth.role === 'ADMIN' ? (
          <div className={rightPanel === 'monitor' ? 'panelVisible' : 'panelHidden'}>
            <AdminMonitorPanel authToken={auth.token} activeMonitor={activeMonitor} setActiveMonitor={setActiveMonitor} />
          </div>
        ) : null}
      </div>
      {auth.isGuest ? null : (
        <AccountEditDialog
          auth={auth}
          open={accountEditOpen}
          loading={accountEditLoading}
          error={accountEditError}
          currentPassword={currentPassword}
          newPassword={newPassword}
          confirmPassword={confirmPassword}
          onCurrentPassword={setCurrentPassword}
          onNewPassword={setNewPassword}
          onConfirmPassword={setConfirmPassword}
          onClose={closeAccountEdit}
          onSubmit={submitAccountEdit}
        />
      )}
    </main>
  );
}

function AnalysisFileEditorPage({ navigate }) {
  const params = new URLSearchParams(window.location.search);
  const initialFile = params.get('file') || 'memo-files/새메모.md';
  const autoSave = params.get('autosave') === '1';
  const [authMode, setAuthMode] = useState('login');
  const [auth, setAuth] = useState(readStoredAuth());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [selectedFile, setSelectedFile] = useState(initialFile);
  const [content, setContent] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [loadedFile, setLoadedFile] = useState('');
  const [editorView, setEditorView] = useState('edit');
  const isMarkdownFile = ['md', 'markdown'].includes(extensionForPath(selectedFile));

  useEffect(() => {
    document.title = '파일 편집';
  }, []);

  useEffect(() => {
    if (auth?.token || authLoading) return;
    setAuthLoading(true);
    fetch('/api/auth/guest', {
      method: 'POST',
      headers: { Accept: 'application/json' }
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error((await response.text()) || '게스트 세션을 만들 수 없습니다.');
        }
        return response.json();
      })
      .then((guestSession) => {
        const normalized = normalizeAuthSession({ ...guestSession, isGuest: true });
        localStorage.setItem(AUTH_KEY, JSON.stringify(normalized));
        setAuth(normalized);
        setAuthError('');
      })
      .catch((guestError) => {
        setAuthError(guestError.message);
      })
      .finally(() => setAuthLoading(false));
  }, [auth?.token, authLoading]);

  const submitAuth = async () => {
    const validationError = validateAuthForm(authMode, username, password);
    if (validationError || authLoading) {
      setAuthError(validationError);
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      const session = await requestJson(authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const normalized = normalizeAuthSession(session);
      localStorage.setItem(AUTH_KEY, JSON.stringify(normalized));
      setAuth(normalized);
      setUsername('');
      setPassword('');
    } catch (loginError) {
      setAuthError(loginError.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const loadFile = async (path = selectedFile) => {
    if (!auth?.token || !path.trim()) return;
    const filePath = path.trim();
    setLoadingFile(true);
    setError('');
    setSaveStatus('');
    try {
      const text = await requestText(`/api/workspace/file?path=${encodeURIComponent(filePath)}`, auth.token);
      setContent(text);
      setSelectedFile(filePath);
      setLoadedFile(filePath);
    } catch {
      const starter = `# ${labelForPath(filePath)}\n\n`;
      await requestJson('/api/workspace/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(auth.token) },
        body: JSON.stringify({ path: filePath, content: starter })
      });
      setContent(starter);
      setSelectedFile(filePath);
      setLoadedFile(filePath);
      setSaveStatus('새 파일을 만들었습니다.');
    } finally {
      setLoadingFile(false);
    }
  };

  useEffect(() => {
    if (!auth?.token) return;
    loadFile(initialFile).catch((loadError) => setError(loadError.message));
  }, [auth?.token]);

  const saveFile = async () => {
    if (!auth?.token || !selectedFile.trim()) return;
    try {
      await requestJson('/api/workspace/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(auth.token) },
        body: JSON.stringify({ path: selectedFile.trim(), content })
      });
      setSaveStatus(autoSave ? '자동 저장됨' : '저장됨');
      setLoadedFile(selectedFile.trim());
    } catch (saveError) {
      setError(saveError.message);
    }
  };

  useEffect(() => {
    if (!autoSave || !auth?.token || !selectedFile || selectedFile !== loadedFile || loadingFile) {
      return undefined;
    }
    setSaveStatus('자동 저장 중...');
    const timer = window.setTimeout(() => {
      saveFile().catch((saveError) => setError(saveError.message));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [autoSave, auth?.token, selectedFile, loadedFile, content, loadingFile]);

  useEffect(() => {
    if (!isMarkdownFile || loadingFile) {
      setEditorView('edit');
      return undefined;
    }
    const timer = window.setTimeout(() => setEditorView('preview'), 900);
    return () => window.clearTimeout(timer);
  }, [content, isMarkdownFile, loadingFile]);

  if (!auth?.token) {
    if (authLoading && !authError) {
      return (
        <main className="analysisEditorShell">
          <section className="analysisEditorPanel compact">
            <span>GUEST EDITOR</span>
            <h1>게스트 편집기를 여는 중입니다</h1>
            <p>잠시 후 파일 편집 화면으로 이동합니다.</p>
          </section>
        </main>
      );
    }
    return (
      <AuthScreen
        mode={authMode}
        setMode={setAuthMode}
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        onSubmit={submitAuth}
        loading={authLoading}
        error={authError}
      />
    );
  }

  return (
    <main className="analysisEditorShell">
      <section className="analysisEditorPanel memoEditorPanel">
        <header className="analysisEditorHeader">
          <div>
            <span>AI MEMO FILE</span>
            <h1>{labelForPath(selectedFile)}</h1>
            <p>{autoSave ? '자동 저장으로 편집됩니다.' : '파일 내용을 편집합니다.'}</p>
          </div>
          <div>
            <button type="button" onClick={() => navigate(APP_SHORTCUTS.aiMemoBoard.path)}><MemoNavIcon type="board" />{APP_SHORTCUTS.aiMemoBoard.label}</button>
            {auth.role === 'ADMIN' ? <button type="button" onClick={() => navigate(APP_SHORTCUTS.adminWorkspace.path)}>{APP_SHORTCUTS.adminWorkspace.label}</button> : null}
            {!autoSave ? <button type="button" className="analysisPrimaryAction" onClick={saveFile}><MemoNavIcon type="file" />저장</button> : null}
          </div>
        </header>
        <div className="memoEditorStatusBar">
          <strong>{labelForPath(selectedFile)}</strong>
          <span>{autoSave ? saveStatus || '자동 저장 대기 중' : saveStatus || '편집 중'}</span>
        </div>
        {loadingFile ? <p className="previewState">파일을 불러오는 중입니다.</p> : null}
        {error ? <p className="previewError">{error}</p> : null}
        <div className={`analysisEditorGrid ${isMarkdownFile ? 'markdown autoPreview' : ''} ${editorView === 'preview' ? 'showPreview' : 'showEditor'}`}>
          <section className="analysisEditSurface">
            <div className="analysisPaneHeader">
              <strong>작성</strong>
              <span>{isMarkdownFile ? '작성 후 미리보기로 자동 전환' : 'Text'}</span>
            </div>
            <div className="analysisCodeWrap">
              <Suspense fallback={<div className="editorLoading">편집기를 불러오는 중입니다.</div>}>
                <LazyCodeEditor
                  path={selectedFile}
                  value={content}
                  onChange={(value) => {
                    setEditorView('edit');
                    setContent(value);
                  }}
                  onSave={saveFile}
                />
              </Suspense>
            </div>
          </section>
          {isMarkdownFile ? (
            <section className="analysisMarkdownPreview">
              <div className="analysisPaneHeader">
                <strong>미리보기</strong>
                <button type="button" onClick={() => setEditorView('edit')}>수정</button>
              </div>
              <article className="analysisMarkdownBody">
                {content.trim() ? markdownPreviewBlocks(content) : <p>Markdown 내용을 작성하면 여기에 적용된 결과가 표시됩니다.</p>}
              </article>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function currentPath() {
  const pathname = window.location.pathname || '/';
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return `${path}${window.location.search || ''}`;
}

const PROJECT_BOARD_TABS = ['회사 작업', '내 작업', '현재 스프린트', '타임라인'];
const MEMO_BOARD_SECTORS = [
  { id: 'project', label: '프로젝트 보드' },
  { id: 'memo', label: '메모 보드' }
];

const PROJECT_BOARD_SIDEBAR = [
  {
    title: '워크스페이스',
    items: ['프로젝트', '팀 문서', '로드맵', '회의록']
  },
  {
    title: '즐겨찾기',
    items: ['제품 출시', '디자인 리뷰', '주간 목표']
  }
];

const PROJECT_BOARD_COLUMNS = [
  {
    id: 'todo',
    title: '작업 예정',
    icon: '○',
    color: '#f59e0b',
    tasks: ['메인 화면 guest/member 제거 확인', 'AI 보드에 스케줄러 메뉴 통합', '예약 실행 문서/스크립트 제거']
  },
  {
    id: 'progress',
    title: '진행 중',
    icon: '◐',
    color: '#3b82f6',
    tasks: ['운영 Docker 웹 재배포', 'AI Trip 장소 보기 데이터 500개 표시 점검']
  },
  {
    id: 'review',
    title: '검토 중',
    icon: '◇',
    color: '#a855f7',
    tasks: ['모바일 보드/스케줄러 화면 맞춤', 'Nginx 운영 포트 확인']
  },
  {
    id: 'done',
    title: '완료',
    icon: '✓',
    color: '#22c55e',
    tasks: ['메인 화면 바로가기 2개로 단순화', '장소 보기 기본 조회 500개로 확장', '메모 제목 표시와 빠른 미리보기 적용']
  }
];

const ADMIN1_BOARD_TASKS = PROJECT_BOARD_COLUMNS.flatMap((column) => (
  column.tasks.map((task, index) => ({
    id: `admin1-goal-${column.id}-${index}`,
    title: task,
    status: column.id
  }))
));

function BoardIcon({ type }) {
  const paths = {
    share: (
      <>
        <path d="M7 12l10-7" />
        <path d="M7 12l10 7" />
        <circle cx="5" cy="12" r="2.4" />
        <circle cx="18" cy="5" r="2.4" />
        <circle cx="18" cy="19" r="2.4" />
      </>
    ),
    comments: (
      <>
        <path d="M5 6.5h14v9H9l-4 3v-12z" />
        <path d="M8.5 10h7" />
        <path d="M8.5 13h4.5" />
      </>
    ),
    star: (
      <path d="M12 4.5l2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7L12 4.5z" />
    ),
    bell: (
      <>
        <path d="M7 10.8a5 5 0 0110 0c0 3 1.2 4.2 2 5.2H5c.8-1 2-2.2 2-5.2z" />
        <path d="M10 18.3a2.2 2.2 0 004 0" />
      </>
    )
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[type]}
    </svg>
  );
}

function MemoNavIcon({ type }) {
  const paths = {
    home: <path d="M4 11.5 12 5l8 6.5V20H5v-8.5z" />,
    calendar: (
      <>
        <path d="M5 5h14v15H5z" />
        <path d="M8 3v4M16 3v4M5 10h14" />
      </>
    ),
    trip: (
      <>
        <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
        <path d="M9 3v15M15 6v15" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    board: (
      <>
        <path d="M4 5h7v6H4z" />
        <path d="M13 5h7v14h-7z" />
        <path d="M4 13h7v6H4z" />
      </>
    ),
    file: (
      <>
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M14 3v5h5" />
      </>
    )
  };
  return (
    <span className="memoNavIcon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {paths[type] || paths.file}
      </svg>
    </span>
  );
}

function WorkspaceNavigator({ active, navigate }) {
  const items = [
    { key: 'schedule', label: APP_SHORTCUTS.personalScheduler.label, path: APP_SHORTCUTS.personalScheduler.path, icon: 'calendar' },
    { key: 'notes', label: APP_SHORTCUTS.aiMemoBoard.label, path: APP_SHORTCUTS.aiMemoBoard.path, icon: 'board' },
    { key: 'trip', label: APP_SHORTCUTS.aiTrip.label, path: APP_SHORTCUTS.aiTrip.path, icon: 'trip' }
  ];
  return (
    <nav className="workspaceNavigator" aria-label="workspace navigator">
      <button type="button" className="workspaceNavigatorBrand" onClick={() => navigate(APP_SHORTCUTS.mainHub.path)}>
        <MemoNavIcon type="home" />
        <span>Home</span>
      </button>
      <div>
        {items.map((item) => (
          <a
            key={item.key}
            className={active === item.key ? 'active' : ''}
            href={item.path}
            onClick={(event) => {
              event.preventDefault();
              navigate(item.path);
            }}
          >
            <MemoNavIcon type={item.icon} />
            <span>{item.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}

function noteBlockFilePath(block) {
  if (block.filePath) return block.filePath;
  return `memo-files/${block.id}.md`;
}

function noteBlockFileContent(block) {
  const title = noteBlockTitle(block);
  if (block.type === 'file') {
    return `# ${title}\n\n`;
  }
  return [`# ${title}`, '', block.content.trim()].filter(Boolean).join('\n');
}

function readStoredArrayByKey(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeSchedulerItem) : [];
  } catch {
    return [];
  }
}

function checklistStatsForBlocks(blocks) {
  return blocks.reduce((stats, block) => {
    const checks = `${block.content || ''}`.match(/^\s*[-*]\s+\[[ xX]\]\s+/gm) || [];
    const done = checks.filter((line) => /^\s*[-*]\s+\[[xX]\]\s+/.test(line)).length;
    return {
      total: stats.total + checks.length,
      done: stats.done + done
    };
  }, { total: 0, done: 0 });
}

function summarizeAdmin1Activity() {
  const session = readStoredAuth();
  if (session?.username !== 'admin1') return null;

  const schedulerItems = [
    ...readSchedulerItems(schedulerStorageKey(session)),
    ...readStoredArrayByKey(SCHEDULER_KEY)
  ].filter((item, index, items) => index === items.findIndex((candidate) => candidate.id === item.id));
  const today = toDateKey(new Date());
  const nextSevenDays = Array.from({ length: 7 }, (_, index) => toDateKey(addDays(new Date(), index)));
  const expandedWeekItems = expandSchedulerItemsForDates(schedulerItems, nextSevenDays);
  const todayItems = expandedWeekItems.filter((item) => item.date === today);
  const pendingWeekItems = expandedWeekItems.filter((item) => !item.done);
  const nextSchedule = pendingWeekItems
    .slice()
    .sort((left, right) => `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`))[0];
  const travelScheduleItems = schedulerItems.filter((item) => item.source === 'travel-plan' || `${item.id || ''}`.startsWith('travel-plan-'));

  const boards = readMemoBoards();
  const blocks = readNoteBlocks();
  const adminSeedBlocks = blocks.filter((block) => `${block.id || ''}`.startsWith('admin1-goal-'));
  const projectBlocks = blocks.filter((block) => (block.boardId || block.sector) === 'project');
  const memoBlocks = blocks.filter((block) => (block.boardId || block.sector) !== 'project');
  const seededChecklist = checklistStatsForBlocks(adminSeedBlocks);
  const expectedChecklistTotal = ADMIN1_BOARD_TASKS.length * 2;
  const checklistTotal = Math.max(seededChecklist.total, expectedChecklistTotal);
  const checklistDone = seededChecklist.done;
  const statusCounts = PROJECT_BOARD_COLUMNS.reduce((counts, column) => ({
    ...counts,
    [column.id]: projectBlocks.filter((block) => block.status === column.id).length
  }), {});

  return {
    todayCount: todayItems.length,
    weekPendingCount: pendingWeekItems.length,
    nextSchedule,
    totalScheduleCount: schedulerItems.length,
    travelScheduleCount: travelScheduleItems.length,
    boardCount: boards.length,
    noteCount: blocks.length,
    memoCount: memoBlocks.length,
    adminGoalCount: Math.max(adminSeedBlocks.length, ADMIN1_BOARD_TASKS.length),
    checklistDone,
    checklistTotal,
    statusCounts
  };
}

function SpaceHomePage({ navigate }) {
  const [adminOverview, setAdminOverview] = useState(() => summarizeAdmin1Activity());

  useEffect(() => {
    document.title = 'AI 개인일정 관리';
  }, []);

  useEffect(() => {
    const refresh = () => setAdminOverview(summarizeAdmin1Activity());
    const handleStorage = (event) => {
      if (!event.key || [AUTH_KEY, AI_NOTE_KEY, AI_NOTE_BOARDS_KEY, SCHEDULER_KEY, schedulerStorageKey('admin1')].includes(event.key)) {
        refresh();
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('codex:scheduler-items-updated', refresh);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('codex:scheduler-items-updated', refresh);
    };
  }, []);

  return (
    <main className="spaceHome">
      <section className={`spaceHero ${adminOverview ? 'hasAdminOverview' : ''}`}>
        <div className="spaceHeroCopy">
          <span className="spaceEyebrow">내 작업 공간</span>
          <h1>여행 준비와 하루 일정을 한곳에서 정리하세요</h1>
          <strong className="spaceHeroLead">추천 장소를 보고, 일정을 만들고, 필요한 메모를 이어서 관리합니다.</strong>
          <p>자주 쓰는 기능만 바로 열 수 있게 정리했습니다.</p>
          <div className="spaceHeroActions">
            <button type="button" onClick={() => navigate(APP_SHORTCUTS.personalScheduler.path)}><MemoNavIcon type="calendar" />{APP_SHORTCUTS.personalScheduler.label}</button>
            <button type="button" onClick={() => navigate(APP_SHORTCUTS.aiMemoBoard.path)}><MemoNavIcon type="board" />{APP_SHORTCUTS.aiMemoBoard.label}</button>
            <button type="button" onClick={() => navigate(APP_SHORTCUTS.aiTrip.path)}><MemoNavIcon type="trip" />{APP_SHORTCUTS.aiTrip.label}</button>
          </div>
        </div>
        {adminOverview ? (
          <aside className="adminOverviewPanel" aria-label="admin1 activity overview">
            <div className="adminOverviewHeader">
              <span>admin1 운영 현황</span>
              <strong>전체 작업 상태</strong>
            </div>
            <div className="adminOverviewStats">
              <article>
                <span>오늘 일정</span>
                <strong>{adminOverview.todayCount}</strong>
                <small>7일 미완료 {adminOverview.weekPendingCount}</small>
              </article>
              <article>
                <span>체크리스트</span>
                <strong>{adminOverview.checklistDone}/{adminOverview.checklistTotal}</strong>
                <small>관리 목표 {adminOverview.adminGoalCount}</small>
              </article>
              <article>
                <span>여행 생성</span>
                <strong>{adminOverview.travelScheduleCount}</strong>
                <small>스케줄 연결 항목</small>
              </article>
            </div>
            <div className="adminOverviewStrip">
              {PROJECT_BOARD_COLUMNS.map((column) => (
                <span key={column.id}>
                  {column.title} <strong>{adminOverview.statusCounts[column.id] || 0}</strong>
                </span>
              ))}
            </div>
            <div className="adminOverviewNext">
              <span>다음 확인</span>
              <strong>{adminOverview.nextSchedule ? `${adminOverview.nextSchedule.date} ${adminOverview.nextSchedule.time}` : '대기 중인 일정 없음'}</strong>
              <p>{adminOverview.nextSchedule?.title || '노트 보드와 여행 일정 생성 상태를 바로 열어 확인할 수 있습니다.'}</p>
            </div>
            <div className="adminOverviewActions">
              <button type="button" onClick={() => navigate(APP_SHORTCUTS.personalScheduler.path)}><MemoNavIcon type="calendar" />일정 보기</button>
              <button type="button" onClick={() => navigate(APP_SHORTCUTS.aiMemoBoard.path)}><MemoNavIcon type="board" />노트/체크</button>
              <button type="button" onClick={() => navigate('/plans')}><MemoNavIcon type="trip" />여행 계획</button>
            </div>
            <p className="adminOverviewMeta">{adminOverview.boardCount}개 보드 · {adminOverview.noteCount}개 노트 · 일반 메모 {adminOverview.memoCount}개</p>
          </aside>
        ) : null}
      </section>
    </main>
  );
}

function AiNotePage({ navigate }) {
  const [boards, setBoards] = useState(readMemoBoards);
  const [blocks, setBlocks] = useState(readNoteBlocks);
  const [activeId, setActiveId] = useState('');
  const [workspaceMode, setWorkspaceMode] = useState('board');
  const [noteContentOpen, setNoteContentOpen] = useState(false);
  const [syncCount, setSyncCount] = useState(0);
  const [fileStatus, setFileStatus] = useState('');
  const [draggingBlockId, setDraggingBlockId] = useState('');
  const [movingBlock, setMovingBlock] = useState(null);
  const freeformBoardRef = useRef(null);
  const movedBlockRef = useRef(false);
  const movedBlockResetTimerRef = useRef(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [activeBoardId, setActiveBoardId] = useState('project');
  const [memoViewMode, setMemoViewMode] = useState('preview');
  const [memoActiveLine, setMemoActiveLine] = useState(0);
  const previewTimerRef = useRef(null);
  const session = readStoredAuth();
  const displayName = session?.username && session.username !== 'guestuser' ? session.username : 'Guest';

  useEffect(() => {
    document.title = 'AI 메모 보드';
  }, []);

  useEffect(() => {
    localStorage.setItem(AI_NOTE_KEY, JSON.stringify(blocks));
    setSyncCount(syncNoteSchedules(blocks));
  }, [blocks]);

  useEffect(() => {
    localStorage.setItem(AI_NOTE_BOARDS_KEY, JSON.stringify(boards));
  }, [boards]);

  useEffect(() => {
    if (session?.username !== 'admin1') return;
    setBlocks((current) => {
      const existingIds = new Set(current.map((block) => block.id));
      const missingTasks = ADMIN1_BOARD_TASKS.filter((task) => !existingIds.has(task.id));
      if (!missingTasks.length) return current;
      return [
        ...missingTasks.map((task, index) => ({
          id: task.id,
          type: 'text',
          content: `## ${task.title}\n\n- [ ] 진행 상태 확인\n- [ ] 운영 화면 확인`,
          sector: 'project',
          boardId: 'project',
          status: task.status,
          parentId: '',
          filePath: `memo-files/admin1/${task.id}.md`,
          width: 220,
          height: 120,
          x: 18 + (index % 3) * 24,
          y: 18 + Math.floor(index / 3) * 32
        })),
        ...current
      ];
    });
  }, [session?.username]);

  useEffect(() => {
    if (!boards.some((board) => board.id === activeBoardId)) {
      setActiveBoardId(boards[0]?.id || 'project');
    }
  }, [activeBoardId, boards]);

  useEffect(() => {
    if (!blocks.length) return;
    if (!activeId || !blocks.some((block) => block.id === activeId)) {
      setActiveId(blocks[0].id);
    }
  }, [activeId, blocks]);

  const addBoard = () => {
    const nextIndex = boards.length + 1;
    const nextBoard = {
      id: `board-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: `새 보드 ${nextIndex}`
    };
    setBoards((current) => [...current, nextBoard]);
    setActiveBoardId(nextBoard.id);
    setNoteContentOpen(false);
  };

  const renameBoard = (id, title) => {
    setBoards((current) => current.map((board) => (board.id === id ? { ...board, title } : board)));
  };

  const addBlock = (type, parentId = '', status = 'todo', boardId = activeBoardId) => {
    const nextId = `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const extension = type === 'file' ? 'txt' : 'md';
    const blockType = ['file', 'checklist'].includes(type) ? type : 'text';
    const nextBlock = {
      id: nextId,
      type: blockType,
      content: blockType === 'file' ? '새 텍스트 파일' : blockType === 'checklist' ? '# 새 체크리스트\n\n- [ ] 첫 번째 항목' : '새 Markdown 글',
      sector: boardId,
      boardId,
      status,
      parentId,
      filePath: `memo-files/${boardId}/${nextId}.${extension}`,
      width: boardId === 'project' ? 220 : 760,
      height: boardId === 'project' ? 120 : blockType === 'checklist' ? 104 : 58,
      x: boardId === 'project' ? 0 : 28 + (blocks.filter((block) => (block.boardId || block.sector) === boardId).length % 3) * 38,
      y: boardId === 'project' ? 0 : 28 + (blocks.filter((block) => (block.boardId || block.sector) === boardId).length % 6) * 72
    };
    setBlocks((current) => [...current, nextBlock]);
    setActiveId(nextBlock.id);
    setFileStatus(`${noteBlockTitle(nextBlock)} 항목을 추가했습니다.`);
  };

  const addTaskBlock = (title) => {
    const nextId = `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const nextBlock = {
      id: nextId,
      type: 'text',
      content: title,
      sector: activeBoardId,
      boardId: activeBoardId,
      status: 'todo',
      parentId: '',
      filePath: `memo-files/${activeBoardId}/${nextId}.md`,
      width: activeBoardId === 'project' ? 220 : 760,
      height: activeBoardId === 'project' ? 120 : 58,
      x: activeBoardId === 'project' ? 0 : 28 + (blocks.filter((block) => (block.boardId || block.sector) === activeBoardId).length % 3) * 38,
      y: activeBoardId === 'project' ? 0 : 28 + (blocks.filter((block) => (block.boardId || block.sector) === activeBoardId).length % 6) * 72
    };
    setBlocks((current) => [...current, nextBlock]);
    setActiveId(nextBlock.id);
    setFileStatus(`'${title}' 블록을 추가했습니다.`);
  };

  const updateBlock = (id, patch) => {
    setBlocks((current) => current.map((block) => (block.id === id ? { ...block, ...patch } : block)));
  };

  const updateBlockTitle = (block, title) => {
    updateBlock(block.id, { content: noteBlockContentWithTitle(block, title) });
  };

  const updateActiveBlockContent = (id, content) => {
    setMemoViewMode('edit');
    updateBlock(id, { content });
    window.clearTimeout(previewTimerRef.current);
    previewTimerRef.current = window.setTimeout(() => setMemoViewMode('preview'), 320);
  };

  const updateActiveBlockLine = (block, lineIndex, value) => {
    setMemoViewMode('edit');
    updateBlock(block.id, { content: updateMarkdownLine(block.content || '', lineIndex, value) });
  };

  const insertActiveBlockLine = (block, lineIndex) => {
    const next = insertMarkdownLine(block.content || '', lineIndex);
    updateBlock(block.id, { content: next.content });
    setMemoActiveLine(next.lineIndex);
  };

  const deleteBlock = (id) => {
    setBlocks((current) => current.length > 1 ? current.filter((block) => block.id !== id) : current);
  };

  const moveBlockToStatus = (id, status) => {
    setBlocks((current) => current.map((block) => (block.id === id ? { ...block, status, sector: activeBoardId, boardId: activeBoardId, parentId: '' } : block)));
    setActiveId(id);
  };

  useEffect(() => {
    if (!movingBlock) return undefined;
    const handlePointerMove = (event) => {
      const deltaX = event.clientX - movingBlock.startX;
      const deltaY = event.clientY - movingBlock.startY;
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        movedBlockRef.current = true;
      }
      const maxX = Math.max(0, (movingBlock.boardWidth || 0) - (movingBlock.width || 0));
      const nextX = Math.max(0, Math.min(maxX || 1600, Math.round(movingBlock.baseX + deltaX)));
      const nextY = Math.max(0, Math.round(movingBlock.baseY + deltaY));
      setBlocks((current) => current.map((block) => (block.id === movingBlock.id ? { ...block, x: nextX, y: nextY } : block)));
    };
    const handlePointerUp = () => {
      setMovingBlock(null);
      setDraggingBlockId('');
      window.clearTimeout(movedBlockResetTimerRef.current);
      movedBlockResetTimerRef.current = window.setTimeout(() => {
        movedBlockRef.current = false;
      }, 250);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [movingBlock]);

  const openBlockFile = async (block) => {
    const filePath = noteBlockFilePath(block);
    setActiveId(block.id);
    setMemoActiveLine(0);
    setNoteContentOpen(true);
    setMemoViewMode('preview');
    setFileStatus('파일을 준비하는 중...');
    setBlocks((current) => current.map((item) => (item.id === block.id ? { ...item, filePath } : item)));
    const session = readStoredAuth();
    if (!session?.token) {
      setFileStatus('보드 안에서 메모를 편집합니다. 로그인하면 파일 저장도 사용할 수 있습니다.');
      return;
    }
    try {
      const folderPath = filePath.includes('/') ? filePath.split('/').slice(0, -1).join('/') : '';
      await requestJson(`/api/workspace/folder?path=${encodeURIComponent(folderPath || 'memo-files')}`, {
        method: 'POST',
        headers: authHeaders(session.token)
      }).catch(() => null);
      try {
        await requestText(`/api/workspace/file?path=${encodeURIComponent(filePath)}`, session.token);
      } catch {
        await requestJson('/api/workspace/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders(session.token) },
          body: JSON.stringify({ path: filePath, content: noteBlockFileContent(block) })
        });
      }
      setFileStatus(`${noteBlockTitle(block)} 메모를 선택했습니다.`);
    } catch (error) {
      setFileStatus(error.message);
    }
  };

  const openBlockEditor = async (block) => {
    const filePath = noteBlockFilePath(block);
    setActiveId(block.id);
    setFileStatus('연결된 파일을 여는 중...');
    setBlocks((current) => current.map((item) => (item.id === block.id ? { ...item, filePath } : item)));
    const editorUrl = `/analysis?file=${encodeURIComponent(filePath)}&autosave=1`;
    const session = readStoredAuth();
    if (!session?.token) {
      setFileStatus('게스트 편집기를 엽니다.');
      navigate(editorUrl);
      return;
    }
    try {
      const folderPath = filePath.includes('/') ? filePath.split('/').slice(0, -1).join('/') : '';
      await requestJson(`/api/workspace/folder?path=${encodeURIComponent(folderPath || 'memo-files')}`, {
        method: 'POST',
        headers: authHeaders(session.token)
      }).catch(() => null);
      await requestJson('/api/workspace/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(session.token) },
        body: JSON.stringify({ path: filePath, content: noteBlockFileContent(block) })
      });
      navigate(editorUrl);
    } catch (error) {
      setFileStatus(error.message);
    }
  };

  const rootBlocks = blocks.filter((block) => !block.parentId);
  const activeBoard = boards.find((board) => board.id === activeBoardId) || boards[0];
  const boardBlocks = rootBlocks.filter((block) => (block.boardId || block.sector) === activeBoardId);
  const activeBlock = boardBlocks.find((block) => block.id === activeId) || boardBlocks[0] || null;
  const projectBlocksByStatus = PROJECT_BOARD_COLUMNS.reduce((grouped, column) => ({
    ...grouped,
    [column.id]: rootBlocks.filter((block) => (block.boardId || block.sector) === 'project' && block.status === column.id)
  }), {});
  const openContextMenu = (event, status = 'todo') => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, status, boardId: activeBoardId });
  };
  const openBlockContextMenu = (event, block) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveId(block.id);
    setContextMenu({ x: event.clientX, y: event.clientY, blockId: block.id, boardId: block.boardId || block.sector });
  };
  const createTextFileBlock = (status = 'todo', boardId = activeBoardId) => {
    setNoteContentOpen(true);
    addBlock('file', '', status, boardId);
    setContextMenu(null);
  };
  const createChecklistBlock = (status = 'todo', boardId = activeBoardId) => {
    setNoteContentOpen(true);
    addBlock('checklist', '', status, boardId);
    setContextMenu(null);
  };
  const renderBoardCard = (block) => (
    <article
      className={`projectTaskCard memoBoardCard ${activeId === block.id ? 'active' : ''} ${draggingBlockId === block.id ? 'dragging' : ''}`}
      key={block.id}
      style={{ left: `${block.x || 0}px`, top: `${block.y || 0}px`, width: `${block.width || 220}px`, height: `${block.height || 120}px` }}
      onMouseUp={(event) => {
        const width = Math.round(event.currentTarget.offsetWidth);
        const height = Math.round(event.currentTarget.offsetHeight);
        if (width !== block.width || height !== block.height) {
          updateBlock(block.id, { width, height });
        }
      }}
      onContextMenu={(event) => openBlockContextMenu(event, block)}
      onClick={(event) => {
        if (movedBlockRef.current) {
          event.preventDefault();
          event.stopPropagation();
          movedBlockRef.current = false;
          window.clearTimeout(movedBlockResetTimerRef.current);
          return;
        }
        openBlockFile(block);
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openBlockEditor(block);
      }}
    >
      <button
        type="button"
        className="memoMoveHandle"
        aria-label="블록 이동"
        title="블록 이동"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.setPointerCapture?.(event.pointerId);
          const boardRect = freeformBoardRef.current?.getBoundingClientRect();
          const cardRect = event.currentTarget.closest('.memoBoardCard')?.getBoundingClientRect();
          window.clearTimeout(movedBlockResetTimerRef.current);
          movedBlockRef.current = false;
          setActiveId(block.id);
          setDraggingBlockId(block.id);
          setMovingBlock({
            id: block.id,
            startX: event.clientX,
            startY: event.clientY,
            baseX: block.x || 0,
            baseY: block.y || 0,
            boardWidth: boardRect?.width || 0,
            width: cardRect?.width || block.width || 0
          });
        }}
      >
        ::
      </button>
      <input
        className="memoCardName"
        value={noteBlockTitle(block)}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => updateBlockTitle(block, event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      {block.type === 'checklist' ? (
        <small className="memoChecklistCardMeta">
          {checklistItemsFromBlock(block).filter((item) => item.checked).length}/{checklistItemsFromBlock(block).length} 완료
        </small>
      ) : null}
    </article>
  );
  const renderProjectCard = (block) => (
    <article
      className={`projectTaskCard memoProjectCard ${activeId === block.id ? 'active' : ''}`}
      key={block.id}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', block.id);
        event.dataTransfer.effectAllowed = 'move';
        setDraggingBlockId(block.id);
      }}
      onDragEnd={() => setDraggingBlockId('')}
      onContextMenu={(event) => openBlockContextMenu(event, block)}
      onClick={() => openBlockFile(block)}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openBlockEditor(block);
      }}
    >
      <input
        className="memoCardName"
        value={noteBlockTitle(block)}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => updateBlockTitle(block, event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      {block.type === 'checklist' ? (
        <small className="memoChecklistCardMeta">
          {checklistItemsFromBlock(block).filter((item) => item.checked).length}/{checklistItemsFromBlock(block).length} 완료
        </small>
      ) : null}
    </article>
  );
  const renderChecklistEditor = (block) => {
    const items = checklistItemsFromBlock(block);
    const updateChecklistItems = (nextItems) => {
      updateBlock(block.id, { content: checklistContentWithItems(block, nextItems) });
    };
    return (
      <div className="memoChecklistEditor">
        {items.map((item, index) => (
          <div className="memoChecklistItem" key={`checklist-${index}`}>
            <input
              type="checkbox"
              checked={item.checked}
              onChange={(event) => {
                const nextItems = items.map((current, itemIndex) => (itemIndex === index ? { ...current, checked: event.target.checked } : current));
                updateChecklistItems(nextItems);
              }}
            />
            <input
              value={item.text}
              onChange={(event) => {
                const nextItems = items.map((current, itemIndex) => (itemIndex === index ? { ...current, text: event.target.value } : current));
                updateChecklistItems(nextItems);
              }}
              placeholder="체크리스트 항목"
            />
            <button
              type="button"
              aria-label="항목 삭제"
              onClick={() => updateChecklistItems(items.length > 1 ? items.filter((_, itemIndex) => itemIndex !== index) : [{ checked: false, text: '' }])}
            >
              삭제
            </button>
          </div>
        ))}
        <button type="button" className="memoChecklistAdd" onClick={() => updateChecklistItems([...items, { checked: false, text: '' }])}>
          항목 추가
        </button>
      </div>
    );
  };

  return (
    <main className="aiNoteShell">
      <WorkspaceNavigator active="notes" navigate={navigate} />
      <section
        className={`aiNotePage ${workspaceMode === 'scheduler' ? 'schedulerMode' : ''}`}
        onClick={() => workspaceMode === 'board' && setContextMenu(null)}
        onContextMenu={(event) => {
          if (workspaceMode === 'board' && noteContentOpen) {
            openContextMenu(event, 'todo');
          }
        }}
      >
        {workspaceMode === 'scheduler' ? (
          <SchedulerPage navigate={navigate} embedded />
        ) : (
        <section className="aiNoteBoardPanel" onContextMenu={(event) => noteContentOpen && openContextMenu(event, 'todo')}>
          <header className="projectTopbar">
            <div>
              <span className="projectBreadcrumb">Home / 노트</span>
              <h1>노트</h1>
            </div>
            <div className="projectTopActions" aria-label="workspace actions">
              <button type="button" onClick={() => setWorkspaceMode('scheduler')} title="스케줄러"><MemoNavIcon type="calendar" /></button>
              <button type="button" onClick={addBoard} title="새 보드"><MemoNavIcon type="plus" /></button>
            </div>
          </header>
          <section className="projectBoardHero">
            <div>
              <nav className="memoBoardNavigator" aria-label="AI memo board navigation">
                {boards.map((board) => (
                  <button
                    type="button"
                    className={activeBoardId === board.id ? 'active' : ''}
                    key={board.id}
                    onClick={() => {
                      setActiveBoardId(board.id);
                      setNoteContentOpen(true);
                    }}
                  >
                    <MemoNavIcon type="board" />
                    <span>{board.title}</span>
                    <small>{rootBlocks.filter((block) => (block.boardId || block.sector) === board.id).length}</small>
                  </button>
                ))}
                <button type="button" className="memoBoardAddButton" onClick={addBoard}>
                  <MemoNavIcon type="plus" />
                  <span>새 보드</span>
                </button>
              </nav>
              {noteContentOpen ? (
                <div className="memoBoardTitleRow">
                  <h2>{activeBoard?.title || '메모 보드'}</h2>
                  {activeBoard ? (
                    <input
                      value={activeBoard.title}
                      onChange={(event) => renameBoard(activeBoard.id, event.target.value)}
                      aria-label="현재 보드 이름"
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
            {noteContentOpen ? (
              <div className="memoBoardCreateActions">
                <button type="button" className="projectNewItemButton" onClick={() => { setNoteContentOpen(true); addBlock('text', '', 'todo', activeBoardId); }}>+ 새 항목</button>
                <button type="button" className="projectNewItemButton" onClick={() => { setNoteContentOpen(true); addBlock('checklist', '', 'todo', activeBoardId); }}>+ 체크리스트</button>
              </div>
            ) : null}
          </section>
          {!noteContentOpen ? (
            <section className="notePadStart">
              <div>
                <span>Boards</span>
                <strong>보드를 선택하면 아래 내용이 열립니다.</strong>
                <p>작업 카드, 메모 작성, 파일 연결은 선택한 보드 안에서만 표시합니다.</p>
              </div>
              <div>
                {boards.map((board) => (
                  <button
                    type="button"
                    key={board.id}
                    onClick={() => {
                      setActiveBoardId(board.id);
                      setNoteContentOpen(true);
                    }}
                  >
                    <MemoNavIcon type="board" />
                    <span>{board.title}</span>
                    <small>{rootBlocks.filter((block) => (block.boardId || block.sector) === board.id).length}</small>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <>
          <aside className="projectFloatingNote" aria-label="recent comment">
            <span><BoardIcon type="bell" /></span>
            <div>
              <strong>{displayName}</strong>
              <p>{fileStatus || '메모 보드 작업 중'}</p>
            </div>
          </aside>
          {activeBlock ? (
            <section className={`memoInlineEditor ${memoViewMode === 'preview' ? 'previewing' : 'editing'}`} onContextMenu={(event) => event.stopPropagation()}>
              <header>
                <div>
                  <span>선택한 메모</span>
                  <input
                    value={noteBlockTitle(activeBlock)}
                    onChange={(event) => updateBlockTitle(activeBlock, event.target.value)}
                    aria-label="메모 제목"
                  />
                </div>
                <div>
                  <button type="button" className={memoViewMode === 'edit' ? 'active' : ''} onClick={() => setMemoViewMode('edit')}>작성</button>
                  <button type="button" className={memoViewMode === 'preview' ? 'active' : ''} onClick={() => setMemoViewMode('preview')}>미리보기</button>
                </div>
              </header>
              {memoViewMode === 'edit' ? (
                activeBlock.type === 'checklist' ? renderChecklistEditor(activeBlock) : (
                  <div className="memoHybridEditor">
                    {`${activeBlock.content || ''}`.split('\n').map((line, index) => (
                      index === memoActiveLine ? (
                        <textarea
                          key={`active-${activeBlock.id}-${index}`}
                          value={line}
                          rows={Math.max(1, line.split('\n').length)}
                          onChange={(event) => updateActiveBlockLine(activeBlock, index, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              insertActiveBlockLine(activeBlock, index);
                            }
                          }}
                          placeholder="# 제목 또는 내용"
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          key={`preview-${activeBlock.id}-${index}`}
                          className="memoPreviewLine"
                          onClick={() => setMemoActiveLine(index)}
                        >
                          {line.trim() ? markdownPreviewBlocks(line) : <span className="memoBlankLine">빈 줄</span>}
                        </button>
                      )
                    ))}
                  </div>
                )
              ) : (
                <article className="memoInlinePreview">
                  {(activeBlock.content || '').trim() ? markdownPreviewBlocks(activeBlock.content) : <p>내용을 작성하면 바로 미리보기로 전환됩니다.</p>}
                </article>
              )}
            </section>
          ) : null}
          {activeBoardId === 'project' ? (
            <section className="projectKanban" aria-label="project kanban board">
              {PROJECT_BOARD_COLUMNS.map((column) => (
                <article
                  className="projectKanbanColumn"
                  key={column.id}
                  onContextMenu={(event) => openContextMenu(event, column.id)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    moveBlockToStatus(event.dataTransfer.getData('text/plain') || draggingBlockId, column.id);
                    setDraggingBlockId('');
                  }}
                >
                  <header>
                    <div>
                      <span className="projectStatusIcon" style={{ '--status-color': column.color }}>{column.icon}</span>
                      <strong>{column.title}</strong>
                    </div>
                    <small>{projectBlocksByStatus[column.id]?.length || 0}</small>
                  </header>
                  <div className="projectTaskList">
                    {(projectBlocksByStatus[column.id] || []).map(renderProjectCard)}
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <section
              ref={freeformBoardRef}
              className="memoFreeformBoard"
              aria-label="freeform memo board"
              style={{
                minHeight: `${Math.max(520, ...boardBlocks.map((block) => (block.y || 0) + (block.height || 58) + 48))}px`
              }}
              onContextMenu={(event) => openContextMenu(event, 'todo')}
            >
              {boardBlocks.map(renderBoardCard)}
            </section>
          )}
          {contextMenu ? (
            <div className="memoContextMenu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
              {contextMenu.blockId ? (
                <button type="button" className="dangerMenuAction" onClick={() => { deleteBlock(contextMenu.blockId); setContextMenu(null); }}>삭제</button>
              ) : (
                <>
                  <button type="button" onClick={() => { setNoteContentOpen(true); addBlock('text', '', contextMenu.status, contextMenu.boardId); setContextMenu(null); }}>메모 생성</button>
                  <button type="button" onClick={() => createChecklistBlock(contextMenu.status, contextMenu.boardId)}>체크리스트 생성</button>
                  <button type="button" onClick={() => createTextFileBlock(contextMenu.status, contextMenu.boardId)}>텍스트 파일 생성</button>
                </>
              )}
            </div>
          ) : null}
            </>
          )}
        </section>
        )}
      </section>
    </main>
  );
}

function SchedulerPage({ navigate, embedded = false }) {
  const session = readStoredAuth();
  const schedulerTitle = session?.username && session.username !== 'guestuser' ? `${session.username}님의 일정` : '내 일정';
  const schedulerKey = schedulerStorageKey(session);
  const [items, setItems] = useState(() => readSchedulerItems(schedulerKey));
  const [filter, setFilter] = useState('전체');
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(toDateKey(new Date()).slice(0, 7));
  const [draft, setDraft] = useState({
    title: '',
    date: toDateKey(new Date()),
    time: '09:00',
    type: '작업',
    recurrence: 'none',
    recurrenceEnd: '',
    memo: ''
  });

  useEffect(() => {
    if (!embedded) {
      document.title = 'AI 개인 스케줄러';
    }
  }, [embedded]);

  useEffect(() => {
    localStorage.setItem(schedulerKey, JSON.stringify(items));
  }, [items, schedulerKey]);

  useEffect(() => {
    const syncItems = () => setItems(readSchedulerItems(schedulerKey));
    const handleStorage = (event) => {
      if (event.key === schedulerKey) {
        syncItems();
      }
    };
    const handleSchedulerUpdate = (event) => {
      if (!event.detail?.storageKey || event.detail.storageKey === schedulerKey) {
        syncItems();
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('codex:scheduler-items-updated', handleSchedulerUpdate);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('codex:scheduler-items-updated', handleSchedulerUpdate);
    };
  }, [schedulerKey]);

  const today = toDateKey(new Date());
  const monthDays = useMemo(() => buildMonthDays(calendarMonth), [calendarMonth]);
  const currentMonth = today.slice(0, 7);
  const weekDays = useMemo(() => buildWeekDays(today), [today]);
  const weekRangeLabel = `${formatDateLabel(weekDays[0].key)} - ${formatDateLabel(weekDays[6].key)}`;
  const monthScheduleDays = useMemo(() => {
    const [year, month] = currentMonth.split('-').map(Number);
    const lastDate = new Date(year, month, 0).getDate();
    return Array.from({ length: lastDate }, (_, index) => {
      const date = new Date(year, month - 1, index + 1);
      return {
        key: toDateKey(date),
        dayNumber: index + 1,
        weekday: ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
      };
    });
  }, [currentMonth]);
  const scheduleDateKeys = useMemo(() => [
    selectedDate,
    today,
    ...monthDays.map((day) => day.key),
    ...weekDays.map((day) => day.key),
    ...monthScheduleDays.map((day) => day.key)
  ], [selectedDate, today, monthDays, weekDays, monthScheduleDays]);
  const expandedItems = useMemo(() => expandSchedulerItemsForDates(items, scheduleDateKeys), [items, scheduleDateKeys]);
  const todayItems = expandedItems
    .filter((item) => item.date === today)
    .slice()
    .sort((left, right) => left.time.localeCompare(right.time));
  const pendingItems = expandedItems.filter((item) => !item.done);
  const doneItems = expandedItems.filter((item) => item.done);
  const completionRate = expandedItems.length ? Math.round((doneItems.length / expandedItems.length) * 100) : 0;
  const todayDoneCount = todayItems.filter((item) => item.done).length;
  const todayCompletionRate = todayItems.length ? Math.round((todayDoneCount / todayItems.length) * 100) : 0;
  const itemCountByDate = useMemo(() => expandedItems.reduce((counts, item) => {
    counts[item.date] = (counts[item.date] || 0) + 1;
    return counts;
  }, {}), [expandedItems]);
  const itemsByDate = useMemo(() => expandedItems.reduce((groups, item) => {
    groups[item.date] = [...(groups[item.date] || []), item];
    return groups;
  }, {}), [expandedItems]);
  const todayTimeline = useMemo(() => [
    { key: 'morning', label: '오전', range: '06:00 - 11:59', items: todayItems.filter((item) => Number(item.time.slice(0, 2)) >= 6 && Number(item.time.slice(0, 2)) < 12) },
    { key: 'afternoon', label: '오후', range: '12:00 - 17:59', items: todayItems.filter((item) => Number(item.time.slice(0, 2)) >= 12 && Number(item.time.slice(0, 2)) < 18) },
    { key: 'evening', label: '저녁', range: '18:00 - 23:59', items: todayItems.filter((item) => Number(item.time.slice(0, 2)) >= 18) },
    { key: 'early', label: '새벽', range: '00:00 - 05:59', items: todayItems.filter((item) => Number(item.time.slice(0, 2)) < 6) }
  ], [todayItems]);
  const visibleItems = expandedItems
    .filter((item) => item.date === selectedDate)
    .filter((item) => filter === '전체' || item.type === filter || (filter === '완료' && item.done))
    .slice()
    .sort((left, right) => `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`));
  const weekItems = weekDays.flatMap((day) => itemsByDate[day.key] || []);
  const weekDoneCount = weekItems.filter((item) => item.done).length;
  const weekCompletionRate = weekItems.length ? Math.round((weekDoneCount / weekItems.length) * 100) : 0;
  const selectedDateItems = expandedItems.filter((item) => item.date === selectedDate);
  const selectedDateDoneCount = selectedDateItems.filter((item) => item.done).length;
  const selectedDateCompletionRate = selectedDateItems.length ? Math.round((selectedDateDoneCount / selectedDateItems.length) * 100) : 0;

  const moveCalendarMonth = (offset) => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const next = new Date(year, month - 1 + offset, 1);
    setCalendarMonth(toDateKey(next).slice(0, 7));
  };

  const submitDraft = (event) => {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) return;
    setItems((current) => [
      ...current,
      {
        id: `schedule-${Date.now()}`,
        title,
        date: draft.date,
        time: draft.time,
        type: draft.type,
        recurrence: draft.recurrence,
        recurrenceEnd: draft.recurrence === 'none' ? '' : draft.recurrenceEnd,
        doneOverrides: {},
        memo: draft.memo.trim(),
        done: false
      }
    ]);
    setDraft((current) => ({ ...current, title: '', memo: '' }));
    setSelectedDate(draft.date);
    setCalendarMonth(draft.date.slice(0, 7));
  };

  const updateItem = (id, patch) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const deleteItem = (id) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const updateVisibleItem = (item, patch) => {
    if (item.recurring && Object.prototype.hasOwnProperty.call(patch, 'done')) {
      setItems((current) => current.map((source) => {
        if (source.id !== item.sourceId) return source;
        return {
          ...source,
          doneOverrides: {
            ...(source.doneOverrides || {}),
            [item.date]: patch.done
          }
        };
      }));
      return;
    }
    updateItem(item.sourceId || item.id, patch);
  };

  const deleteVisibleItem = (item) => {
    deleteItem(item.sourceId || item.id);
  };

  const schedulerContent = (
      <section className="schedulerPage">
        <header className="schedulerHero">
          <div>
            <span className="schedulerPageIcon"><MemoNavIcon type="calendar" /></span>
            <h1>{schedulerTitle}</h1>
            <p>오늘 해야 할 일과 여행 준비를 한곳에서 정리합니다.</p>
          </div>
          <div className="schedulerStats">
            <article><span>오늘 달성률</span><strong>{todayCompletionRate}%</strong><small>{todayDoneCount}/{todayItems.length}</small></article>
            <article><span>금주 달성률</span><strong>{weekCompletionRate}%</strong><small>{weekDoneCount}/{weekItems.length}</small></article>
            <article><span>전체 달성률</span><strong>{completionRate}%</strong><small>{doneItems.length}/{expandedItems.length}</small></article>
            <article><span>미완료</span><strong>{pendingItems.length}</strong><small>남은 일정</small></article>
          </div>
        </header>
        <form className="schedulerQuickAdd" onSubmit={submitDraft}>
          <label>
            <span>할 일</span>
            <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="예: 경주 일정 확인" />
          </label>
          <div className="schedulerFormGrid">
            <label>
              <span>날짜</span>
              <input type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} />
            </label>
            <label>
              <span>시간</span>
              <input type="time" value={draft.time} onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))} />
            </label>
          </div>
          <div className="schedulerFormGrid">
            <label>
              <span>반복</span>
              <select value={draft.recurrence} onChange={(event) => setDraft((current) => ({ ...current, recurrence: event.target.value }))}>
                {Object.entries(RECURRENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <span>반복 종료</span>
              <input
                type="date"
                value={draft.recurrenceEnd}
                disabled={draft.recurrence === 'none'}
                min={draft.date}
                onChange={(event) => setDraft((current) => ({ ...current, recurrenceEnd: event.target.value }))}
              />
            </label>
          </div>
          <label>
            <span>분류</span>
            <select value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))}>
              <option>작업</option>
              <option>회의</option>
              <option>검토</option>
              <option>개인</option>
            </select>
          </label>
          <label>
            <span>노트</span>
            <textarea value={draft.memo} onChange={(event) => setDraft((current) => ({ ...current, memo: event.target.value }))} placeholder="필요한 내용을 짧게 적어주세요." />
          </label>
          <button type="submit">추가</button>
        </form>
        <section className="schedulerDatabase">
          <div className="schedulerCalendarPanel">
            <div className="schedulerCalendarHeader">
              <div>
                <h2>달력</h2>
                <p>{selectedDate} · {selectedDateItems.length}개 일정 · 달성률 {selectedDateCompletionRate}%</p>
              </div>
              <div className="schedulerCalendarControls">
                <button type="button" onClick={() => moveCalendarMonth(-1)}>{'<'}</button>
                <strong>{calendarMonth}</strong>
                <button type="button" onClick={() => moveCalendarMonth(1)}>{'>'}</button>
                <button type="button" onClick={() => {
                  setSelectedDate(today);
                  setCalendarMonth(today.slice(0, 7));
                }}>Today</button>
              </div>
            </div>
            <div className="schedulerCalendarWeekdays">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="schedulerCalendarGrid">
              {monthDays.map((day) => (
                <button
                  key={day.key}
                  type="button"
                  className={[
                    day.currentMonth ? '' : 'muted',
                    day.key === selectedDate ? 'selected' : '',
                    day.key === today ? 'today' : ''
                  ].filter(Boolean).join(' ')}
                  onClick={() => {
                    setSelectedDate(day.key);
                    setCalendarMonth(day.key.slice(0, 7));
                    setDraft((current) => ({ ...current, date: day.key }));
                  }}
                >
                  <span>{day.dayNumber}</span>
                  {itemCountByDate[day.key] ? <small>{itemCountByDate[day.key]}</small> : null}
                </button>
              ))}
            </div>
            <div className="schedulerLinkedSchedule">
              <div className="schedulerLinkedHeader">
                <div>
                  <h3>금주 일정</h3>
                  <p>{today} 기준 · {weekRangeLabel} 일정</p>
                </div>
              </div>
              <div className="schedulerWeekSlots">
                {weekDays.map((day) => {
                  const dayItems = (itemsByDate[day.key] || []).slice().sort((left, right) => left.time.localeCompare(right.time));
                  return (
                    <button
                      key={day.key}
                      type="button"
                      className={[
                        day.key === selectedDate ? 'selected' : '',
                        day.key === today ? 'today' : ''
                      ].filter(Boolean).join(' ')}
                      onClick={() => {
                        setSelectedDate(day.key);
                        setCalendarMonth(day.key.slice(0, 7));
                        setDraft((current) => ({ ...current, date: day.key }));
                      }}
                    >
                      <strong>{day.weekday}</strong>
                      <span>{formatDateLabel(day.key)}</span>
                      <small>{dayItems.length}개</small>
                      <div>
                        {dayItems.slice(0, 3).map((item) => <em key={item.id}>{item.time} {item.title}{item.recurring ? ' · 반복' : ''}</em>)}
                        {dayItems.length > 3 ? <em>+{dayItems.length - 3}개 더</em> : null}
                        {dayItems.length ? null : <em>일정 없음</em>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <aside className="schedulerTodayPanel">
            <div className="schedulerTodayHeader">
              <div>
                <span>Today</span>
                <h2>오늘 일정</h2>
                <p>{today} · {todayItems.length}개</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(today);
                  setCalendarMonth(today.slice(0, 7));
                  setDraft((current) => ({ ...current, date: today }));
                }}
              >
                보기
              </button>
            </div>
            <div className="schedulerTodayTimeline">
              {todayTimeline.map((slot) => (
                <section key={slot.key} className="schedulerTodaySlot">
                  <div className="schedulerTodayTime">
                    <strong>{slot.label}</strong>
                    <span>{slot.range}</span>
                  </div>
                  <div className="schedulerTodayEvents">
                    {slot.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={item.done ? 'done' : ''}
                        onClick={() => updateVisibleItem(item, { done: !item.done })}
                      >
                        <time>{item.time}</time>
                        <strong>{item.title}</strong>
                        <span>{item.type}{item.recurring ? ` · ${item.recurrenceLabel}` : ''}</span>
                      </button>
                    ))}
                    {slot.items.length ? null : <em>일정 없음</em>}
                  </div>
                </section>
              ))}
            </div>
          </aside>
          <div className="schedulerBoardHeader">
            <div>
              <h2>일정</h2>
              <p>{selectedDate} · {filter} 보기 · {visibleItems.length}개</p>
            </div>
            <div className="schedulerFilters">
              {['전체', '작업', '회의', '검토', '개인', '메모', '완료'].map((item) => (
                <button key={item} type="button" className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="schedulerList">
            <div className="schedulerTableHead">
              <span>이름</span>
              <span>분류</span>
              <span>날짜</span>
              <span>노트</span>
              <span />
            </div>
            {visibleItems.map((item) => (
              <article className={`schedulerItem ${item.done ? 'done' : ''}`} key={item.id}>
                <div className="schedulerNameCell">
                  <button type="button" className="schedulerCheck" onClick={() => updateVisibleItem(item, { done: !item.done })}>{item.done ? '✓' : ''}</button>
                  <strong>{item.title}</strong>
                </div>
                <span className="schedulerTypePill">{item.type}</span>
                <time>{item.date} · {item.time}</time>
                <small>{[item.memo || '메모 없음', item.recurring ? item.recurrenceLabel : ''].filter(Boolean).join(' · ')}</small>
                <button type="button" className="schedulerDelete" onClick={() => deleteVisibleItem(item)}>{item.recurring ? '반복삭제' : '삭제'}</button>
              </article>
            ))}
            {visibleItems.length ? null : <p className="schedulerEmpty">표시할 일정이 없습니다.</p>}
          </div>
        </section>
      </section>
  );

  if (embedded) {
    return <section className="schedulerEmbedded">{schedulerContent}</section>;
  }

  return (
    <main className="schedulerShell">
      <WorkspaceNavigator active="schedule" navigate={navigate} />
      {schedulerContent}
    </main>
  );
}

export default function App() {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const handlePop = () => setPath(currentPath());
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const navigate = (nextPath) => {
    if (!nextPath || nextPath === path) {
      return;
    }
    window.history.pushState({}, '', nextPath);
    setPath(currentPath());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const routePath = path.split('?')[0];

  if (routePath === '/analysis' || routePath.startsWith('/analysis/')) {
    return <AnalysisFileEditorPage navigate={navigate} />;
  }

  if (routePath === '/analysisadmin' || routePath.startsWith('/analysisadmin/')) {
    return <WorkspaceApp navigate={navigate} />;
  }

  if (routePath === '/scheduler') {
    return <SchedulerPage navigate={navigate} />;
  }

  if (routePath === '/notes') {
    return <AiNotePage navigate={navigate} />;
  }

  if (routePath === '/') {
    return <SpaceHomePage navigate={navigate} />;
  }

  return <LocalTripApp path={path} navigate={navigate} />;
}
