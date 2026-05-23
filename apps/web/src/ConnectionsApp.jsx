import { useEffect, useMemo, useState } from 'react';
import './styles/connections.css';

const CONNECTION_SETTINGS_KEY = 'ai-assitant-connection-settings';
const LEGACY_CONNECTION_SETTINGS_KEY = 'jupiter-ai-connection-settings';

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
  const [providers, setProviders] = useState([]);
  const [openAiKey, setOpenAiKey] = useState('');
  const [providerLoading, setProviderLoading] = useState(false);
  const [savingOpenAi, setSavingOpenAi] = useState(false);
  const [message, setMessage] = useState('');
  const [activeSource, setActiveSource] = useState('email');

  const openAiProvider = useMemo(
    () => providers.find((provider) => provider.id === 'openai'),
    [providers]
  );

  const persistSettings = (updater) => {
    setSettings((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      const merged = mergeSettings(next);
      writeSettings(merged);
      return merged;
    });
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

  const handleApiBaseUrlBlur = () => {
    persistSettings((current) => ({
      ...current,
      apiBaseUrl: normalizeApiBaseUrl(current.apiBaseUrl)
    }));
  };

  const emailReady = Boolean(settings.gmail.connected || settings.naver.email || settings.naver.appPasswordSaved);
  const messageReady = Boolean(settings.localMessages.connected);

  return (
    <main className="connectionsShell simple">
      <header className="connectionsHero">
        <div>
          <span className="connectionsEyebrow">Personal data</span>
          <h1>연결</h1>
          <p>이메일과 문자만 먼저 연결합니다. 세부 설정은 필요할 때만 열어봅니다.</p>
        </div>
        <div className="connectionsHeroActions">
          <button type="button" className="connectionsGhostButton" onClick={() => navigate?.('/scheduler')}>
            내 일정
          </button>
        </div>
      </header>

      {message ? <p className="connectionsNotice">{message}</p> : null}

      <section className="connectionsChoiceGrid" aria-label="연결할 데이터 선택">
        <button
          type="button"
          className={activeSource === 'email' ? 'active' : ''}
          onClick={() => setActiveSource('email')}
        >
          <ConnectionIcon type="mail" />
          <span>
            <strong>이메일</strong>
            <small>Gmail 또는 네이버 메일</small>
          </span>
          <StatusPill tone={emailReady ? 'ok' : 'warn'}>{emailReady ? '설정됨' : '대기'}</StatusPill>
        </button>
        <button
          type="button"
          className={activeSource === 'messages' ? 'active' : ''}
          onClick={() => setActiveSource('messages')}
        >
          <ConnectionIcon type="phone" />
          <span>
            <strong>문자</strong>
            <small>휴대폰 SMS 권한</small>
          </span>
          <StatusPill tone={messageReady ? 'ok' : 'neutral'}>{messageReady ? '연결됨' : '준비 중'}</StatusPill>
        </button>
      </section>

      <section className="connectionsPanel connectionsSimplePanel">
        {activeSource === 'email' ? (
          <>
            <SectionHeader icon="mail" eyebrow="Email" title="이메일" action={<StatusPill tone={emailReady ? 'ok' : 'warn'}>{emailReady ? '설정됨' : '대기'}</StatusPill>}>
              메일에서 예약, 결제, 일정 후보를 찾는 연결입니다.
            </SectionHeader>
            <div className="connectionsProviderList">
              <article>
                <div>
                  <strong>Gmail</strong>
                  <p>Google OAuth 연결 준비 상태를 저장합니다.</p>
                </div>
                <button
                  type="button"
                  className="connectionsGhostButton"
                  onClick={() => persistSettings((current) => ({
                    ...current,
                    gmail: { ...current.gmail, status: 'ready', connected: false, lastCheckedAt: new Date().toISOString() }
                  }))}
                >
                  Gmail 준비
                </button>
              </article>
              <article className="connectionsProviderWithField">
                <div>
                  <strong>네이버 메일</strong>
                  <p>메일 주소만 먼저 저장하고, 앱 비밀번호는 서버 저장 기능 연결 후 입력합니다.</p>
                </div>
                <label className="connectionsField">
                  <span>이메일</span>
                  <input
                    value={settings.naver.email}
                    onChange={(event) => persistSettings((current) => ({ ...current, naver: { ...current.naver, email: event.target.value, status: 'manual' } }))}
                    placeholder="name@naver.com"
                    inputMode="email"
                  />
                </label>
              </article>
            </div>
          </>
        ) : (
          <>
            <SectionHeader icon="phone" eyebrow="SMS" title="문자" action={<StatusPill tone="neutral">{sourceStatusLabel(settings.localMessages.status)}</StatusPill>}>
              택배, 인증, 예약 문자를 일정 후보로 쓰기 위한 연결입니다.
            </SectionHeader>
            <div className="connectionsReadiness">
              <span>현재 상태</span>
              <strong>휴대폰 앱 권한 필요</strong>
              <small>웹/PWA만으로는 SMS를 직접 읽을 수 없어 Android/iOS 네이티브 권한 연결 단계에서 활성화됩니다.</small>
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
                문자 연결 대기
              </button>
            </div>
          </>
        )}
      </section>

      <details className="connectionsAdvanced">
        <summary>
          <span>고급 설정</span>
          <StatusPill tone={openAiProvider?.connected ? 'ok' : 'warn'}>{openAiProvider?.connected ? 'OpenAI 연결됨' : '키 필요'}</StatusPill>
        </summary>
        <div className="connectionsAdvancedGrid">
          <article className="connectionsPanel">
            <SectionHeader icon="server" eyebrow="Server" title="API 서버">
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
            <div className="connectionsDataShape">
              <code>{settings.apiBaseUrl || '/api'}</code>
              <span>같은 서버를 쓰면 빈 값으로 저장합니다.</span>
            </div>
          </article>

          <article className="connectionsPanel">
            <SectionHeader
              icon="key"
              eyebrow="LLM"
              title="OpenAI 키"
              action={(
                <button type="button" className="connectionsGhostButton" onClick={loadProviders} disabled={providerLoading}>
                  {providerLoading ? '확인 중' : '상태 확인'}
                </button>
              )}
            >
              여행계획 생성에 쓸 사용자 키를 저장합니다.
            </SectionHeader>
            <dl className="connectionsMetaList">
              <div>
                <dt>Provider</dt>
                <dd>{openAiProvider?.label || 'OpenAI / Codex'}</dd>
              </div>
              <div>
                <dt>상태</dt>
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
        </div>
      </details>
    </main>
  );
}
