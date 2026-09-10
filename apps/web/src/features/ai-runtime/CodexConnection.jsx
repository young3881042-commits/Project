import WorkspaceConnection from './WorkspaceConnection.jsx';
import { useEffect, useRef, useState } from 'react';
import { travelApi } from '../travel/travelApi.js';

/** Shared by chat and travel; only device codes, never OAuth tokens, enter React. */
export default function CodexConnection({ onConnected }) {
  const [runtime, setRuntime] = useState(null);
  const [auth, setAuth] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const mounted = useRef(true);
  const connected = useRef(onConnected); connected.current = onConnected;
  useEffect(() => {
    mounted.current = true;
    let timer, loading = false;
    async function check() {
      if (loading || document.visibilityState === 'hidden') return;
      loading = true;
      try {
        const info = await travelApi('availability');
        if (!mounted.current) return;
        setRuntime(info);
        if (info.mode === 'embedded' && info.embeddedSupported) {
          const value = await travelApi('auth-status');
          if (!mounted.current) return;
          setAuth(value);
          if (['pending', 'preparing'].includes(value.state)) timer = setTimeout(check, 2000);
          if (value.connected) connected.current?.();
        }
      } catch (failure) { if (mounted.current) setError(failure.message); }
      finally { loading = false; }
    }
    const resume = () => { clearTimeout(timer); check(); };
    check(); document.addEventListener('visibilitychange', resume);
    window.addEventListener('orbit:auth-check', resume);
    return () => { mounted.current = false; clearTimeout(timer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('orbit:auth-check', resume); };
  }, []);
  async function run(action, payload = {}) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const value = await travelApi(action, payload);
      if (!mounted.current) return;
      if (action.startsWith('runtime-')) { window.location.reload(); return; }
      if (action === 'pair') { await connected.current?.(); setAuth({ connected: true }); }
      else { setAuth(value); window.dispatchEvent(new Event('orbit:auth-check')); }
    } catch (failure) { if (mounted.current) setError(failure.message); }
    finally { if (mounted.current) setBusy(false); }
  }
  const pending = ['pending', 'preparing'].includes(auth?.state);
  return <div className="orbitCodexConnection">
    {error || auth?.error ? <p role="alert">{error || auth.error}</p> : null}
    {!runtime ? <p role="status">AI 실행 환경 확인 중…</p> : runtime.mode === 'embedded' ? <>
      <p>이 앱에서 Codex를 실행해요. ChatGPT로 한 번 로그인하면 인증이 저장돼요.</p>
      {!runtime.embeddedSupported ? <p role="alert">내장 AI는 Android 11 이상 arm64용 APK가 필요해요.</p> : auth?.connected ? <><p className="orbitCodexConnected" role="status"><span aria-hidden="true">✓</span> 연결됨 · ChatGPT 로그인</p><button type="button" disabled={busy} onClick={() => run('auth-login')}>다시 로그인</button></> : <>
        <button type="button" className="primary" disabled={busy || pending} onClick={() => run('auth-login')}>{pending ? '로그인 기다리는 중…' : 'ChatGPT로 로그인'}</button>
        {auth?.userCode ? <div className="orbitCodexCode"><p>아래 코드를 로그인 화면에 입력해주세요.</p><strong>{auth.userCode}</strong><a className="orbitCodexLoginLink" href="https://auth.openai.com/codex/device">ChatGPT 로그인 열기 ↗</a><small>로그인 후 이 앱으로 돌아오면 연결을 확인해요.</small></div> : null}
        {pending ? <button type="button" disabled={busy} onClick={() => run('auth-cancel')}>로그인 취소</button> : null}
      </>}
      <p className="orbitChatHint">요청할 때 실행하고, 작업이 끝나면 Codex를 종료해요. 내부 서버는 요청 없이 1분이 지나면 종료되며, 아직 확인하지 않은 여행 결과가 있으면 잠시 유지돼요. 로그인 중에는 연결을 유지해요.</p>
      {runtime.embeddedSupported ? <WorkspaceConnection /> : null}
      <details><summary>기존 Termux 대화 사용</summary><p>기존 대화 파일은 Termux에 그대로 있어요. 내장 AI의 대화 파일과 별도로 보관돼요.</p><button type="button" disabled={busy || pending} onClick={() => run('runtime-legacy')}>Termux 연결로 전환</button></details>
    </> : <>
      <p>현재 기존 Termux 연결을 사용하고 있어요.</p>
      {runtime.embeddedSupported ? <><button type="button" className="primary" disabled={busy} onClick={() => run('runtime-enable')}>앱 안에서 AI 사용하기</button><p className="orbitChatHint">내장 AI에서는 한 번 새로 로그인해주세요. 기존 Termux 대화는 그대로 남고, 내장 대화는 앱 안에 따로 저장돼요.</p></> : null}
      <details><summary>기존 연결 복구</summary><p>Termux에서 <code>orbit-travel</code>을 실행하고 연결 코드를 입력해주세요.</p><form onSubmit={event => { event.preventDefault(); run('pair', { code }); }}><label>8자리 연결 코드<input inputMode="numeric" pattern="[0-9]{8}" maxLength={8} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} /></label><button disabled={busy}>연결</button></form></details>
    </>}
    <button type="button" className="orbitCodexRefresh" disabled={busy} onClick={() => { setError(''); window.dispatchEvent(new Event('orbit:auth-check')); }}>연결 다시 확인</button>
  </div>;
}
