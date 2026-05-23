import { useEffect, useMemo, useRef, useState } from 'react';

async function api(path, { token, json = true, headers, ...init } = {}) {
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
    return response;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function RagMessage({ turn }) {
  if (turn.role === 'user') {
    return (
      <article className="assistantTurn user">
        <div className="assistantAvatar user">나</div>
        <div className="assistantBubble user">
          <p>{turn.question}</p>
        </div>
      </article>
    );
  }

  return (
    <article className="assistantTurn assistant">
      <div className="assistantAvatar assistant">R</div>
      <div className="assistantBubble assistant">
        <div className="assistantRichText">
          {turn.answer.split('\n').map((line, index) => <p key={index}>{line}</p>)}
        </div>
        {turn.citations?.length ? (
          <div className="assistantCitationGrid">
            {turn.citations.map((citation) => (
              <section className="assistantCitationCard" key={`${citation.documentId}-${citation.chunkIndex}`}>
                <div className="assistantCitationTop">
                  <strong>{citation.documentTitle}</strong>
                  <span>{citation.score.toFixed(2)}</span>
                </div>
                <p>{citation.excerpt}</p>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function workspacePathFor(path) {
  return path ? `/workspace/${path}` : '/workspace';
}

function RagComposer({ loading, question, setQuestion, onSubmit }) {
  return (
    <form
      className="assistantComposer"
      onSubmit={(event) => {
        event.preventDefault();
        const value = question.trim();
        if (!value || loading) {
          return;
        }
        onSubmit(value);
      }}
    >
      <textarea
        value={question}
        rows="3"
        placeholder="문서/다분야 수집 데이터/실시간 날씨를 바탕으로 질문하세요"
        onChange={(event) => setQuestion(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            const value = question.trim();
            if (!value || loading) {
              return;
            }
            onSubmit(value);
          }
        }}
      />
      <div className="assistantComposerBar">
        <span>검색 결과와 다분야 수집 데이터를 Codex로 넘겨 답변을 생성합니다.</span>
        <button type="submit" className="ragSendButton" disabled={loading}>
          {loading ? 'Searching' : 'Ask RAG'}
        </button>
      </div>
    </form>
  );
}

export default function RagApp({
  authToken = '',
  directoryPath = '',
  filePath = '',
  persistToWorkspace = Boolean(authToken),
  topK = 4,
  pageTitle = 'RAG',
  defaultQuestion = 'Indexed docs에서 API 지연 시 먼저 확인할 항목은 무엇인가?',
  embedded = false
}) {
  const [turns, setTurns] = useState([]);
  const [question, setQuestion] = useState(defaultQuestion);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState('');
  const [ragStatus, setRagStatus] = useState(null);
  const [documents, setDocuments] = useState([]);
  const scrollRef = useRef(null);
  const uploadRef = useRef(null);
  const saveEnabled = Boolean(authToken && persistToWorkspace);
  const contextPath = workspacePathFor(directoryPath || (filePath ? filePath.split('/').slice(0, -1).join('/') : ''));

  const suggestions = useMemo(() => ([
    '서울과 부산 중 지금 비 가능성이 더 높은 곳은 어디야?',
    '제주와 강릉의 현재 체감온도 차이를 설명해줘',
    '현재 업로드 문서 기준으로 운영 체크포인트를 요약해줘'
  ]), []);

  const loadDocuments = async () => {
    try {
      const [status, documentList] = await Promise.all([
        api('/api/rag/weather', { token: authToken }),
        api('/api/rag/documents', { token: authToken })
      ]);
      setRagStatus(status);
      setDocuments(documentList || []);
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    }
  };


  const refreshDomains = async () => {
    setUploading(true);
    setMessage('');
    try {
      const status = await api('/api/rag/domains/refresh', {
        method: 'POST',
        token: authToken
      });
      await loadDocuments();
      setMessage(`${status.documentCount}개 다분야 문서를 수집하고 인덱스를 갱신했습니다.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setUploading(false);
    }
  };

  const refreshWeather = async () => {
    setUploading(true);
    setMessage('');
    try {
      await api('/api/rag/weather/refresh', {
        method: 'POST',
        token: authToken
      });
      await loadDocuments();
      setMessage('실시간 날씨 데이터를 다시 수집하고 벡터 인덱스를 갱신했습니다.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    document.title = pageTitle;
    loadDocuments();
  }, [pageTitle, authToken]);

  useEffect(() => {
    setQuestion(defaultQuestion);
  }, [defaultQuestion]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [turns, loading, uploading, message]);

  const handleAsk = async (value) => {
    setLoading(true);
    setMessage('');
    setTurns((current) => [...current, { role: 'user', question: value }]);
    setQuestion('');

    try {
      const path = saveEnabled ? '/api/rag/query-and-save' : '/api/rag/query';
      const payload = saveEnabled
        ? { question: value, topK, directoryPath: directoryPath || null, filePath: filePath || null }
        : { question: value, topK };
      const response = await api(path, {
        method: 'POST',
        token: authToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setTurns((current) => [...current, { role: 'assistant', ...response }]);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadFiles = async (files) => {
    if (!files.length) {
      return;
    }
    setUploading(true);
    setMessage('');
    try {
      for (const file of files) {
        const form = new FormData();
        form.append('file', file);
        await api('/api/rag/documents', {
          method: 'POST',
          token: authToken,
          body: form
        });
      }
      await loadDocuments();
      setMessage(`${files.length}개 문서를 색인 목록에 추가했습니다.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setUploading(false);
    }
  };

  const importWorkspaceSelection = async (selection = {}) => {
    const payload = {
      directoryPath: selection.type === 'dir' ? selection.path : selection.directoryPath || directoryPath || null,
      filePath: selection.type === 'file' ? selection.path : selection.filePath || filePath || null
    };
    if (!payload.directoryPath && !payload.filePath) {
      setMessage('먼저 폴더나 파일을 선택하세요.');
      return;
    }
    setUploading(true);
    setMessage('');
    try {
      const imported = await api('/api/rag/documents/workspace', {
        method: 'POST',
        token: authToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      await loadDocuments();
      setMessage(`${(imported || []).length}개 워크스페이스 파일을 RAG 문서로 가져왔습니다.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setDragging(false);
    const workspacePayload = event.dataTransfer.getData('application/x-ai-assitant-workspace')
      || event.dataTransfer.getData('application/x-jupiter-workspace');
    if (workspacePayload) {
      try {
        await importWorkspaceSelection(JSON.parse(workspacePayload));
        return;
      } catch (error) {
        setMessage(error.message);
        return;
      }
    }
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length) {
      await uploadFiles(files);
    }
  };

  return (
    <main className={`assistantShell ${embedded ? 'embedded' : ''}`}>
      <input
        ref={uploadRef}
        type="file"
        hidden
        multiple
        accept=".txt,.md,.csv,.json,.log,.yaml,.yml"
        onChange={(event) => {
          const files = Array.from(event.target.files || []);
          uploadFiles(files).finally(() => {
            event.target.value = '';
          });
        }}
      />
      <section
        className={`assistantPanel ragPanel ${dragging ? 'dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget)) {
            return;
          }
          setDragging(false);
        }}
        onDrop={handleDrop}
      >
        <header className="assistantHeader assistantHeaderMinimal">
          <code className="assistantPathPill">{contextPath}</code>
          <div className="ragStatusStrip">
            <span className={`statusPill ${ragStatus?.vectorStoreConfigured ? 'ok' : ''}`}>
              {ragStatus?.vectorStoreConfigured ? 'Qdrant 연결됨' : 'Vector DB 미연결'}
            </span>
            <span className="statusPill">{ragStatus?.collectionName || 'collection 없음'}</span>
            <span className="statusPill">{documents.length} docs</span>
          </div>
          <div className="assistantHeaderActions">
            <button type="button" className="ghostButton compact" onClick={refreshWeather} disabled={loading || uploading}>
              Weather
            </button>
            <button type="button" className="ghostButton compact" onClick={refreshDomains} disabled={loading || uploading}>
              Domains
            </button>
            <button type="button" className="ghostButton compact" onClick={() => importWorkspaceSelection()} disabled={loading || uploading}>
              Import
            </button>
            <button type="button" className="ragTopButton primary" onClick={() => uploadRef.current?.click()} disabled={loading || uploading}>
              Upload
            </button>
            <button type="button" className="ghostButton compact" onClick={() => setTurns([])} disabled={!turns.length || loading}>
              Clear
            </button>
          </div>
        </header>

        <div className="assistantStream" ref={scrollRef}>
          {!turns.length ? (
            <section className="assistantEmpty">
              <h2>멀티도메인 + Codex RAG</h2>
              <p>{suggestions[0]}</p>
              <div className="ragDocumentPreview">
                {documents.slice(0, 4).map((document) => (
                  <article key={document.id}>
                    <strong>{document.title}</strong>
                    <span>{document.chunkCount} chunks · {document.filename}</span>
                    <p>{document.preview}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          {turns.map((turn, index) => <RagMessage key={`${turn.role}-${index}`} turn={turn} />)}
          {loading ? (
            <article className="assistantTurn assistant">
              <div className="assistantAvatar assistant">R</div>
              <div className="assistantBubble assistant loading">
                <p>RAG 검색 결과를 Codex로 정리하고 있습니다.</p>
              </div>
            </article>
          ) : null}
          {uploading ? (
            <article className="assistantTurn assistant">
              <div className="assistantAvatar assistant">R</div>
              <div className="assistantBubble assistant loading">
                <p>문서를 가져오고 색인하는 중입니다.</p>
              </div>
            </article>
          ) : null}
          {message ? <p className="ragInlineError">{message}</p> : null}
        </div>

        <RagComposer
          loading={loading}
          question={question}
          setQuestion={setQuestion}
          onSubmit={handleAsk}
        />
      </section>
    </main>
  );
}
