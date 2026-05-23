import { useEffect, useMemo, useState } from 'react';
import './styles/connections.css';

const CONNECTION_SETTINGS_KEY = 'ai-assitant-connection-settings';
const LEGACY_CONNECTION_SETTINGS_KEY = 'jupiter-ai-connection-settings';
const DATA_INBOX_KEY = 'ai-assitant-data-inbox';
const LEGACY_DATA_INBOX_KEY = 'jupiter-ai-data-inbox';

const DEFAULT_SETTINGS = {
  apiBaseUrl: '',
  storageMode: 'local-first',
  gmail: {
    provider: 'gmail',
    status: 'ready',
    authType: 'oauth2',
    scopes: ['gmail.readonly', 'calendar.events'],
    connected: false,
    lastCheckedAt: null
  },
  naver: {
    provider: 'naver-mail',
    status: 'ready',
    email: '',
    imapHost: 'imap.naver.com',
    imapPort: '993',
    security: 'SSL/TLS',
    credentialStorage: 'server-only',
    appPasswordSaved: false,
    lastCheckedAt: null
  },
  localMessages: {
    provider: 'local-messages',
    status: 'native-required',
    platform: 'android-ios',
    permissions: ['android.READ_SMS', 'ios.native-extension'],
    connected: false,
    lastCheckedAt: null
  }
};

const DEFAULT_INBOX_ITEMS = [
  {
    id: 'sample-gmail-flight',
    source: 'gmail',
    sourceLabel: 'Gmail',
    kind: 'email',
    status: 'sample',
    title: '항공권 예약 메일',
    preview: 'OAuth 연결 후 메일 제목, 보낸 사람, 날짜를 일정 후보로 분류할 수 있습니다.',
    receivedAt: '2026-05-23T09:20:00.000Z',
    permissions: ['gmail.readonly']
  },
  {
    id: 'sample-naver-bill',
    source: 'naver-mail',
    sourceLabel: 'Naver 메일',
    kind: 'email',
    status: 'sample',
    title: '정기 결제 알림',
    preview: 'IMAP 연결 후 필요한 헤더와 본문 일부만 서버 수집기로 넘기는 구조입니다.',
    receivedAt: '2026-05-23T10:05:00.000Z',
    permissions: ['imap.read']
  },
  {
    id: 'sample-local-message',
    source: 'local-messages',
    sourceLabel: '로컬 메시지',
    kind: 'message',
    status: 'permission-required',
    title: '택배 도착 문자',
    preview: 'Android/iOS 네이티브 권한이 승인된 뒤 기기 안에서 일정 후보를 만들 수 있습니다.',
    receivedAt: '2026-05-23T11:30:00.000Z',
    permissions: ['native.sms.read']
  }
];

function mergeSettings(value) {
  return {
    ...DEFAULT_SETTINGS,
    ...(value || {}),
    storageMode: 'local-first',
    gmail: { ...DEFAULT_SETTINGS.gmail, ...(value?.gmail || {}) },
    naver: { ...DEFAULT_SETTINGS.naver, ...(value?.naver || {}) },
    localMessages: { ...DEFAULT_SETTINGS.localMessages, ...(value?.localMessages || {}) }
  };
}

function readSettings() {
  try {
    const raw = localStorage.getItem(CONNECTION_SETTINGS_KEY) || localStorage.getItem(LEGACY_CONNECTION_SETTINGS_KEY);
    const merged = mergeSettings(JSON.parse(raw || 'null'));
    if (raw && !localStorage.getItem(CONNECTION_SETTINGS_KEY)) {
      localStorage.setItem(CONNECTION_SETTINGS_KEY, JSON.stringify(merged));
    }
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeSettings(settings) {
  localStorage.setItem(CONNECTION_SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('ai-assitant:connection-settings-updated', { detail: settings }));
}

function readInboxItems() {
  try {
    const raw = localStorage.getItem(DATA_INBOX_KEY) || localStorage.getItem(LEGACY_DATA_INBOX_KEY);
    if (!raw) {
      localStorage.setItem(DATA_INBOX_KEY, JSON.stringify(DEFAULT_INBOX_ITEMS));
      return DEFAULT_INBOX_ITEMS;
    }
    const parsed = JSON.parse(raw);
    if (!localStorage.getItem(DATA_INBOX_KEY)) {
      localStorage.setItem(DATA_INBOX_KEY, JSON.stringify(Array.isArray(parsed) ? parsed : DEFAULT_INBOX_ITEMS));
    }
    return Array.isArray(parsed) ? parsed : DEFAULT_INBOX_ITEMS;
  } catch {
    return DEFAULT_INBOX_ITEMS;
  }
}

function writeInboxItems(items) {
  localStorage.setItem(DATA_INBOX_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('ai-assitant:data-inbox-updated', { detail: items }));
}

function apiUrlFor(path, settings) {
  if (!path || /^https?:\/\//i.test(path)) return path;
  const baseUrl = String(settings.apiBaseUrl || '').trim().replace(/\/+$/, '');
  return baseUrl ? `${baseUrl}${path.startsWith('/') ? path : `/${path}`}` : path;
}

function normalizeApiBaseUrl(value) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    if (parsed.origin === window.location.origin) return '';
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
  } catch {
    return trimmed;
  }
}

async function api(path, { token, settings, headers, json = true, ...init } = {}) {
  const response = await fetch(apiUrlFor(path, settings || DEFAULT_SETTINGS), {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {})
    }
  });
  if (!response.ok) {
    throw new Error((await response.text()) || `HTTP ${response.status}`);
  }
  if (!json) {
    return null;
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function formatDateTime(value) {
  if (!value) return '대기 중';
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function sourceStatusLabel(status) {
  const labels = {
    ready: '연결 준비',
    manual: '수동 설정',
    'native-required': '네이티브 권한 필요',
    sample: '샘플',
    'permission-required': '권한 필요'
  };
  return labels[status] || status || '대기';
}

function ConnectionIcon({ type }) {
  const paths = {
    server: (
      <>
        <path d="M5 6.5h14v4H5z" />
        <path d="M5 13.5h14v4H5z" />
        <path d="M8 8.5h.01M8 15.5h.01" />
      </>
    ),
    key: (
      <>
        <path d="M14.5 7.5a4 4 0 1 0 2 3.5H21v3h-3v3h-3v-3h-2.5" />
        <path d="M7 10.5h.01" />
      </>
    ),
    mail: (
      <>
        <path d="M4 6h16v12H4z" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    phone: (
      <>
        <path d="M8 3h8v18H8z" />
        <path d="M11 18h2" />
      </>
    ),
    inbox: (
      <>
        <path d="M4 5h16v10l-3 4H7l-3-4z" />
        <path d="M4 15h5l1.5 2h3l1.5-2h5" />
      </>
    )
  };

  return (
    <span className="connectionsIcon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {paths[type] || paths.server}
      </svg>
    </span>
  );
}

function StatusPill({ tone = 'neutral', children }) {
  return <span className={`connectionsStatus ${tone}`}>{children}</span>;
}

function SectionHeader({ icon, eyebrow, title, children, action }) {
  return (
    <div className="connectionsSectionHeader">
      <div className="connectionsSectionTitle">
        <ConnectionIcon type={icon} />
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
          {children ? <p>{children}</p> : null}
        </div>
      </div>
      {action ? <div className="connectionsSectionAction">{action}</div> : null}
    </div>
  );
}

export default function ConnectionsApp({ navigate, authToken }) {
  const [settings, setSettings] = useState(() => readSettings());
  const [inboxItems, setInboxItems] = useState(() => readInboxItems());
  const [providers, setProviders] = useState([]);
  const [openAiKey, setOpenAiKey] = useState('');
  const [providerLoading, setProviderLoading] = useState(false);
  const [savingOpenAi, setSavingOpenAi] = useState(false);
  const [message, setMessage] = useState('');

  const openAiProvider = useMemo(
    () => providers.find((provider) => provider.id === 'openai'),
    [providers]
  );

  const connectedSourceCount = useMemo(() => {
    const openAiConnected = openAiProvider?.connected ? 1 : 0;
    return openAiConnected
      + (settings.gmail.connected ? 1 : 0)
      + (settings.naver.appPasswordSaved ? 1 : 0)
      + (settings.localMessages.connected ? 1 : 0);
  }, [openAiProvider?.connected, settings.gmail.connected, settings.naver.appPasswordSaved, settings.localMessages.connected]);

  const persistSettings = (updater) => {
    setSettings((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      const merged = mergeSettings(next);
      writeSettings(merged);
      return merged;
    });
  };

  const persistInboxItems = (nextItems) => {
    setInboxItems(nextItems);
    writeInboxItems(nextItems);
  };

  const loadProviders = async () => {
    if (!authToken) {
      setProviders([]);
      setMessage('로그인 세션이 있어야 OpenAI provider 상태를 확인할 수 있습니다.');
      return;
    }
    setProviderLoading(true);
    setMessage('');
    try {
      const data = await api('/api/chat/providers', { token: authToken, settings });
      setProviders(data || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setProviderLoading(false);
    }
  };

  useEffect(() => {
    loadProviders();
  }, [authToken]);

  const handleSaveOpenAiKey = async (event) => {
    event.preventDefault();
    if (!authToken || !openAiKey.trim()) {
      return;
    }
    setSavingOpenAi(true);
    setMessage('');
    try {
      await api('/api/chat/providers/openai', {
        method: 'POST',
        token: authToken,
        settings,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: openAiKey.trim() }),
        json: false
      });
      setOpenAiKey('');
      await loadProviders();
      setMessage('OpenAI 키가 사용자 계정에 저장되었습니다.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSavingOpenAi(false);
    }
  };

  const handleDeleteOpenAiKey = async () => {
    if (!authToken) {
      return;
    }
    setSavingOpenAi(true);
    setMessage('');
    try {
      await api('/api/chat/providers/openai', {
        method: 'DELETE',
        token: authToken,
        settings,
        json: false
      });
      await loadProviders();
      setMessage('OpenAI 키 연결을 해제했습니다.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSavingOpenAi(false);
    }
  };

  const resetSampleInbox = () => {
    persistInboxItems(DEFAULT_INBOX_ITEMS);
  };

  const handleApiBaseUrlBlur = () => {
    persistSettings((current) => ({
      ...current,
      apiBaseUrl: normalizeApiBaseUrl(current.apiBaseUrl)
    }));
  };

  return (
    <main className="connectionsShell">
      <header className="connectionsHero">
        <div>
          <span className="connectionsEyebrow">Personal data hub</span>
          <h1>연결</h1>
          <p>개인 서버 API, 사용자별 LLM 키, 메일, 로컬 메시지 권한을 한 화면에서 관리합니다.</p>
        </div>
        <div className="connectionsHeroActions">
          <button type="button" className="connectionsGhostButton" onClick={() => navigate?.('/scheduler')}>
            내 일정
          </button>
          <button type="button" className="connectionsPrimaryButton" onClick={loadProviders} disabled={providerLoading}>
            {providerLoading ? '확인 중' : 'Provider 새로고침'}
          </button>
        </div>
      </header>

      <section className="connectionsStats" aria-label="connection summary">
        <article>
          <span>저장 방식</span>
          <strong>Local-first</strong>
          <small>브라우저 설정 우선</small>
        </article>
        <article>
          <span>연결된 소스</span>
          <strong>{connectedSourceCount}</strong>
          <small>OpenAI 포함</small>
        </article>
        <article>
          <span>수집함</span>
          <strong>{inboxItems.length}</strong>
          <small>샘플/대기 항목</small>
        </article>
      </section>

      {message ? <p className="connectionsNotice">{message}</p> : null}

      <section className="connectionsGrid">
        <article className="connectionsPanel settingsPanel">
          <SectionHeader icon="server" eyebrow="Server" title="개인 서버 API">
            비워두면 현재 웹 앱과 같은 origin의 API를 사용합니다.
          </SectionHeader>
          <label className="connectionsField">
            <span>API 서버 주소</span>
            <input
              value={settings.apiBaseUrl}
              onChange={(event) => persistSettings((current) => ({ ...current, apiBaseUrl: event.target.value }))}
              onBlur={handleApiBaseUrlBlur}
              placeholder="비워두면 현재 서버 /api"
              inputMode="url"
            />
          </label>
          <div className="connectionsField">
            <span>저장 방식</span>
            <div className="connectionsSegmented" role="group" aria-label="storage mode">
              <button type="button" className={settings.storageMode === 'local-first' ? 'active' : ''} onClick={() => persistSettings((current) => ({ ...current, storageMode: 'local-first' }))}>
                Local-first
              </button>
              <button type="button" disabled>
                Server-first
              </button>
            </div>
          </div>
          <div className="connectionsDataShape">
            <code>{settings.apiBaseUrl || '/api'}</code>
            <span>같은 서버를 쓰면 빈 값으로 저장해서 URL을 짧게 유지합니다.</span>
          </div>
        </article>

        <article className="connectionsPanel">
          <SectionHeader
            icon="key"
            eyebrow="LLM"
            title="OpenAI 키"
            action={openAiProvider?.connected ? <StatusPill tone="ok">연결됨</StatusPill> : <StatusPill tone="warn">키 필요</StatusPill>}
          >
            Provider 상태를 읽고 OpenAI 키 저장 API로 사용자 키를 저장합니다.
          </SectionHeader>
          <dl className="connectionsMetaList">
            <div>
              <dt>Provider</dt>
              <dd>{openAiProvider?.label || 'OpenAI / Codex'}</dd>
            </div>
            <div>
              <dt>기본 모델</dt>
              <dd>{openAiProvider?.defaultModel || '서버 설정 대기'}</dd>
            </div>
            <div>
              <dt>서버 메시지</dt>
              <dd>{openAiProvider?.message || (authToken ? '상태를 불러오는 중입니다.' : '로그인이 필요합니다.')}</dd>
            </div>
          </dl>
          <form className="connectionsKeyForm" onSubmit={handleSaveOpenAiKey}>
            <label className="connectionsField">
              <span>API 키</span>
              <input
                type="password"
                value={openAiKey}
                onChange={(event) => setOpenAiKey(event.target.value)}
                placeholder="sk-..."
                autoComplete="off"
              />
            </label>
            <div className="connectionsButtonRow">
              <button type="submit" className="connectionsPrimaryButton" disabled={!authToken || savingOpenAi || !openAiKey.trim()}>
                {savingOpenAi ? '저장 중' : '키 저장'}
              </button>
              <button type="button" className="connectionsGhostButton danger" onClick={handleDeleteOpenAiKey} disabled={!authToken || savingOpenAi || !openAiProvider?.connected}>
                연결 해제
              </button>
            </div>
          </form>
        </article>

        <article className="connectionsPanel">
          <SectionHeader icon="mail" eyebrow="OAuth" title="Gmail" action={<StatusPill tone="warn">{sourceStatusLabel(settings.gmail.status)}</StatusPill>}>
            실제 수집은 아직 연결하지 않고, 공식 Google OAuth와 Gmail API scope를 붙일 수 있는 상태만 저장합니다.
          </SectionHeader>
          <div className="connectionsReadiness">
            <span>권한 방식</span>
            <strong>Google OAuth 2.0</strong>
            <small>서버 callback, refresh token 저장소, Gmail 읽기 scope 필요</small>
          </div>
          <div className="connectionsButtonRow">
            <button
              type="button"
              className="connectionsGhostButton"
              onClick={() => persistSettings((current) => ({
                ...current,
                gmail: { ...current.gmail, status: 'ready', connected: false, lastCheckedAt: new Date().toISOString() }
              }))}
            >
              준비 상태 저장
            </button>
          </div>
        </article>

        <article className="connectionsPanel">
          <SectionHeader icon="mail" eyebrow="IMAP" title="Naver 메일" action={<StatusPill tone="warn">{sourceStatusLabel(settings.naver.status)}</StatusPill>}>
            IMAP 접속 정보만 로컬에 두고, 앱 비밀번호는 서버 저장 API가 생기기 전까지 입력하지 않습니다.
          </SectionHeader>
          <div className="connectionsFieldGrid">
            <label className="connectionsField">
              <span>이메일</span>
              <input
                value={settings.naver.email}
                onChange={(event) => persistSettings((current) => ({ ...current, naver: { ...current.naver, email: event.target.value } }))}
                placeholder="name@naver.com"
                inputMode="email"
              />
            </label>
            <label className="connectionsField">
              <span>IMAP 서버</span>
              <input
                value={settings.naver.imapHost}
                onChange={(event) => persistSettings((current) => ({ ...current, naver: { ...current.naver, imapHost: event.target.value } }))}
                placeholder="imap.naver.com"
              />
            </label>
            <label className="connectionsField">
              <span>포트</span>
              <input
                value={settings.naver.imapPort}
                onChange={(event) => persistSettings((current) => ({ ...current, naver: { ...current.naver, imapPort: event.target.value } }))}
                placeholder="993"
                inputMode="numeric"
              />
            </label>
            <label className="connectionsField">
              <span>보안</span>
              <select
                value={settings.naver.security}
                onChange={(event) => persistSettings((current) => ({ ...current, naver: { ...current.naver, security: event.target.value } }))}
              >
                <option>SSL/TLS</option>
                <option>STARTTLS</option>
              </select>
            </label>
          </div>
          <label className="connectionsField">
            <span>앱 비밀번호</span>
            <input type="password" placeholder="서버 저장 API 연결 후 입력" disabled />
          </label>
          <div className="connectionsDataShape">
            <code>{settings.naver.credentialStorage}</code>
            <span>민감 정보는 localStorage에 저장하지 않는 구조입니다.</span>
          </div>
        </article>

        <article className="connectionsPanel">
          <SectionHeader icon="phone" eyebrow="Native" title="로컬 메시지" action={<StatusPill tone="neutral">{sourceStatusLabel(settings.localMessages.status)}</StatusPill>}>
            웹 단독 구현은 하지 않고 Android/iOS 네이티브 권한 브리지를 기다리는 연결 슬롯입니다.
          </SectionHeader>
          <div className="connectionsReadiness">
            <span>필요 권한</span>
            <strong>Android SMS / iOS 네이티브 확장</strong>
            <small>기기 권한, 로컬 파서, 서버 동기화 opt-in을 분리해서 붙일 수 있습니다.</small>
          </div>
          <div className="connectionsButtonRow">
            <button
              type="button"
              className="connectionsGhostButton"
              onClick={() => persistSettings((current) => ({
                ...current,
                localMessages: { ...current.localMessages, status: 'native-required', connected: false, lastCheckedAt: new Date().toISOString() }
              }))}
            >
              권한 필요 상태 저장
            </button>
          </div>
        </article>
      </section>

      <section className="connectionsPanel inboxPanel">
        <SectionHeader
          icon="inbox"
          eyebrow="Inbox"
          title="수집함 샘플"
          action={(
            <button type="button" className="connectionsGhostButton" onClick={resetSampleInbox}>
              샘플 복원
            </button>
          )}
        >
          실제 수집 전에 각 소스가 일정 후보로 들어오는 데이터 형태를 확인합니다.
        </SectionHeader>
        <div className="connectionsInboxList">
          {inboxItems.map((item) => (
            <article className="connectionsInboxItem" key={item.id}>
              <div>
                <span>{item.sourceLabel || item.source}</span>
                <strong>{item.title}</strong>
                <p>{item.preview}</p>
              </div>
              <div className="connectionsInboxMeta">
                <StatusPill tone={item.status === 'sample' ? 'neutral' : 'warn'}>{sourceStatusLabel(item.status)}</StatusPill>
                <time>{formatDateTime(item.receivedAt)}</time>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
