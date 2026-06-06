import { useEffect, useMemo, useRef, useState } from 'react';

async function api(path, { token, headers, json = true, ...init } = {}) {
  const response = await fetch(path, {
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

function workspacePathFor(path) {
  return path ? `/workspace/${path}` : '/workspace';
}

function titleForPath(path) {
  if (!path) return 'workspace';
  const tokens = path.split('/').filter(Boolean);
  return tokens[tokens.length - 1] || 'workspace';
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function LlmTurn({ turn }) {
  return (
    <article className={`assistantTurn ${turn.role}`}>
      <div className={`assistantAvatar ${turn.role}`}>{turn.role === 'user' ? '나' : 'L'}</div>
      <div className={`assistantBubble ${turn.role}`}>
        {turn.role === 'user' ? (
          <p>{turn.content}</p>
        ) : (
          <>
            <div className="assistantRichText">
              {turn.content.split('\n').map((line, index) => <p key={index}>{line}</p>)}
            </div>
            {turn.usage ? (
              <div className="assistantMetaLine">
                <span>토큰 {formatNumber(turn.usage.totalTokens)}</span>
                <span>입력 {formatNumber(turn.usage.inputTokens)}</span>
                <span>출력 {formatNumber(turn.usage.outputTokens)}</span>
              </div>
            ) : null}
            {turn.transcriptPath ? (
              <div className="assistantMetaLine">
                <span>저장 위치: /workspace/{turn.transcriptPath}</span>
              </div>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}

function UsageCards({ sessionUsage, lastUsage, callCount }) {
  return (
    <section className="llmUsageGrid">
      <article className="llmUsageCard primary">
        <span>현재 세션</span>
        <strong>{formatNumber(sessionUsage.totalTokens)}</strong>
        <small>{formatNumber(callCount)}회 호출 · 입력 {formatNumber(sessionUsage.inputTokens)} · 출력 {formatNumber(sessionUsage.outputTokens)}</small>
      </article>
      <article className="llmUsageCard">
        <span>마지막 요청</span>
        <strong>{formatNumber(lastUsage?.totalTokens || 0)}</strong>
        <small>입력 {formatNumber(lastUsage?.inputTokens || 0)} · 출력 {formatNumber(lastUsage?.outputTokens || 0)}</small>
      </article>
    </section>
  );
}

function ProviderControls({
  providers,
  selectedProviderId,
  setSelectedProviderId,
  selectedProvider,
  model,
  setModel,
  apiKey,
  setApiKey,
  keyOpen,
  setKeyOpen,
  savingKey,
  onSaveOpenAiKey,
  onDeleteOpenAiKey,
  onLinkGemini,
  onDeleteGemini
}) {
  return (
    <section className="llmControlPanel">
      <div className="llmProviderGrid">
        {providers.map((provider) => (
          <button
            type="button"
            key={provider.id}
            className={`llmProviderButton ${selectedProviderId === provider.id ? 'active' : ''}`}
            disabled={!provider.enabled}
            onClick={() => {
              setSelectedProviderId(provider.id);
              setModel(provider.defaultModel || model);
            }}
          >
            <strong>{provider.label}</strong>
            <span>{provider.connected ? '연결됨' : provider.enabled ? '키 필요' : '비활성'}</span>
          </button>
        ))}
      </div>

      <div className="llmSettingsRow">
        <label>
          <span>모델</span>
          <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="gpt-5.5" />
        </label>
        {selectedProvider?.id === 'openai' ? (
          <div className="llmKeyActions">
            {keyOpen || !selectedProvider.connected ? (
              <form className="llmKeyForm" onSubmit={onSaveOpenAiKey}>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="OpenAI / Codex API key"
                  autoComplete="off"
                />
                <button type="submit" className="sendButton" disabled={savingKey || !apiKey.trim()}>
                  {savingKey ? '저장 중' : '키 저장'}
                </button>
              </form>
            ) : (
              <button type="button" className="ghostButton compact" onClick={() => setKeyOpen(true)}>
                키 교체
              </button>
            )}
            {selectedProvider.connected ? (
              <button type="button" className="ghostButton compact" onClick={onDeleteOpenAiKey} disabled={savingKey}>
                연결 해제
              </button>
            ) : null}
          </div>
        ) : null}
        {selectedProvider?.id === 'gemini' ? (
          <div className="llmKeyActions">
            {!selectedProvider.connected ? (
              <button type="button" className="sendButton" onClick={onLinkGemini} disabled={!selectedProvider.enabled}>
                Google 연결
              </button>
            ) : (
              <span className="statusPill ok">서버 연결 완료</span>
            )}
            {selectedProvider.connected && !selectedProvider.message?.includes('서버 API 키') ? (
              <button type="button" className="ghostButton compact" onClick={onDeleteGemini}>
                연결 해제
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {selectedProvider?.message ? <p className="llmProviderMessage">{selectedProvider.message}</p> : null}
    </section>
  );
}

function LlmComposer({ loading, prompt, setPrompt, onSubmit, disabled }) {
  return (
    <form
      className="assistantComposer"
      onSubmit={(event) => {
        event.preventDefault();
        const value = prompt.trim();
        if (!value || loading || disabled) {
          return;
        }
        onSubmit(value);
      }}
    >
      <textarea
        value={prompt}
        rows="3"
        placeholder="LLM에 작업을 요청하세요. 예: 현재 파일 기준으로 개선 포인트를 정리해줘"
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            const value = prompt.trim();
            if (!value || loading || disabled) {
              return;
            }
            onSubmit(value);
          }
        }}
      />
      <div className="assistantComposerBar">
        <span>선택한 공급자와 내 키로 응답을 생성하고 사용량을 기록합니다.</span>
        <button type="submit" className="ragSendButton" disabled={loading || disabled}>
          {loading ? '생성 중' : '실행'}
        </button>
      </div>
    </form>
  );
}

export default function LlmApp({
  authToken = '',
  directoryPath = '',
  filePath = '',
  embedded = false
}) {
  const [prompt, setPrompt] = useState('');
  const [turns, setTurns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState([]);
  const [selectedProviderId, setSelectedProviderId] = useState('openai');
  const [model, setModel] = useState('gpt-5.5');
  const [apiKey, setApiKey] = useState('');
  const [keyOpen, setKeyOpen] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [message, setMessage] = useState('');
  const scrollRef = useRef(null);

  const contextPath = workspacePathFor(directoryPath || (filePath ? filePath.split('/').slice(0, -1).join('/') : ''));
  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedProviderId) || providers[0],
    [providers, selectedProviderId]
  );
  const providerReady = Boolean(selectedProvider?.enabled && selectedProvider?.connected);
  const assistantTurns = useMemo(
    () => turns.filter((turn) => turn.role === 'assistant'),
    [turns]
  );
  const sessionUsage = useMemo(
    () => assistantTurns.reduce((accumulator, turn) => ({
      inputTokens: accumulator.inputTokens + Number(turn.usage?.inputTokens || 0),
      outputTokens: accumulator.outputTokens + Number(turn.usage?.outputTokens || 0),
      totalTokens: accumulator.totalTokens + Number(turn.usage?.totalTokens || 0)
    }), { inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
    [assistantTurns]
  );
  const lastUsage = assistantTurns.length ? assistantTurns[assistantTurns.length - 1].usage : null;

  const loadProviders = async () => {
    const data = await api('/api/chat/providers', { token: authToken });
    setProviders(data || []);
    const openAi = (data || []).find((provider) => provider.id === 'openai') || data?.[0];
    if (openAi) {
      setSelectedProviderId((current) => current || openAi.id);
      setModel((current) => current || openAi.defaultModel || 'gpt-5.5');
    }
  };

  const refresh = async () => {
    setMessage('');
    await loadProviders();
  };

  useEffect(() => {
    if (!authToken) return;
    refresh().catch((error) => setMessage(error.message));
  }, [authToken]);

  useEffect(() => {
    const handler = (event) => {
      if (event.origin !== window.location.origin || !['ai-assistant-gemini-oauth', 'jupiter-gemini-oauth'].includes(event.data?.type)) {
        return;
      }
      refresh().catch((error) => setMessage(error.message));
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [authToken]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [turns, loading, message]);

  const handleSaveOpenAiKey = async (event) => {
    event.preventDefault();
    if (!apiKey.trim()) {
      return;
    }
    setSavingKey(true);
    setMessage('');
    try {
      await api('/api/chat/providers/openai', {
        method: 'POST',
        token: authToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
        json: false
      });
      setApiKey('');
      setKeyOpen(false);
      await loadProviders();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteOpenAiKey = async () => {
    setSavingKey(true);
    setMessage('');
    try {
      await api('/api/chat/providers/openai', {
        method: 'DELETE',
        token: authToken,
        json: false
      });
      setKeyOpen(true);
      await loadProviders();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSavingKey(false);
    }
  };

  const handleLinkGemini = async () => {
    setMessage('');
    try {
      const response = await api('/api/chat/providers/gemini/link', {
        method: 'POST',
        token: authToken
      });
      if (response?.authorizationUrl) {
        window.open(response.authorizationUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleDeleteGemini = async () => {
    setMessage('');
    try {
      await api('/api/chat/providers/gemini', {
        method: 'DELETE',
        token: authToken,
        json: false
      });
      await loadProviders();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleSubmit = async (value) => {
    if (!selectedProvider) {
      setMessage('사용할 LLM 공급자를 선택하세요.');
      return;
    }
    setLoading(true);
    setMessage('');
    const nextUserTurn = { role: 'user', content: value };
    const nextMessages = [...turns, nextUserTurn]
      .filter((turn) => turn.role === 'user' || turn.role === 'assistant')
      .map((turn) => ({ role: turn.role, content: turn.content }));
    setTurns((current) => [...current, nextUserTurn]);
    setPrompt('');
    try {
      const response = await api('/api/chat/query', {
        method: 'POST',
        token: authToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: selectedProvider.id,
          baseUrl: selectedProvider.baseUrl,
          model: model.trim() || selectedProvider.defaultModel,
          directoryPath,
          filePath,
          title: `llm-${titleForPath(filePath || directoryPath)}`,
          systemPrompt: '너는 ai-assistant 분석 워크스페이스의 실무형 LLM 어시스턴트다. 답변은 한국어로 간결하게 작성하고, 필요한 경우 실행 가능한 단계로 정리한다.',
          messages: nextMessages
        })
      });
      setTurns((current) => [...current, {
        role: 'assistant',
        content: response.assistantMessage,
        usage: response.usage,
        transcriptPath: response.transcriptPath
      }]);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={`assistantShell ${embedded ? 'embedded' : ''}`}>
      <section className="assistantPanel llmPanel">
        <header className="assistantHeader assistantHeaderMinimal">
          <code className="assistantPathPill">{contextPath}</code>
          <div className="assistantHeaderActions">
            <button type="button" className="ghostButton compact" onClick={() => refresh().catch((error) => setMessage(error.message))} disabled={loading}>
              새로고침
            </button>
            <button type="button" className="ghostButton compact" onClick={() => setTurns([])} disabled={!turns.length || loading}>
              초기화
            </button>
          </div>
        </header>

        <ProviderControls
          providers={providers}
          selectedProviderId={selectedProviderId}
          setSelectedProviderId={setSelectedProviderId}
          selectedProvider={selectedProvider}
          model={model}
          setModel={setModel}
          apiKey={apiKey}
          setApiKey={setApiKey}
          keyOpen={keyOpen}
          setKeyOpen={setKeyOpen}
          savingKey={savingKey}
          onSaveOpenAiKey={handleSaveOpenAiKey}
          onDeleteOpenAiKey={handleDeleteOpenAiKey}
          onLinkGemini={handleLinkGemini}
          onDeleteGemini={handleDeleteGemini}
        />

        <UsageCards
          sessionUsage={sessionUsage}
          lastUsage={lastUsage}
          callCount={assistantTurns.length}
        />

        <div className="assistantStream" ref={scrollRef}>
          {!turns.length ? (
            <section className="assistantEmpty llmEmpty">
              <h2>LLM 작업 콘솔</h2>
              <p>내 API 키로 선택한 모델을 호출하고, 현재 대화에서 사용한 토큰을 바로 확인합니다.</p>
            </section>
          ) : null}
          {turns.map((turn, index) => (
            <LlmTurn key={`${turn.role}-${index}`} turn={turn} />
          ))}
          {loading ? (
            <article className="assistantTurn assistant">
              <div className="assistantAvatar assistant">L</div>
              <div className="assistantBubble assistant loading">
                <p>선택한 모델에서 응답을 생성하고 있습니다.</p>
              </div>
            </article>
          ) : null}
          {message ? <p className="ragInlineError">{message}</p> : null}
        </div>

        <LlmComposer
          loading={loading}
          prompt={prompt}
          setPrompt={setPrompt}
          onSubmit={handleSubmit}
          disabled={!providerReady}
        />
      </section>
    </main>
  );
}
