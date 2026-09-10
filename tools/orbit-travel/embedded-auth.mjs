import { spawn } from 'node:child_process';

const FAILURE = 'Codex 로그인을 확인하지 못했어요. 다시 시도해주세요.';
/** Auth-only app-server session. Tokens and account identifiers never reach the WebView. */
export function createEmbeddedAuth({ binary, launcher, spawnProcess = spawn, timeoutMs = 8000, loginMs = 15 * 60 * 1000 }) {
  let session, starting, sequence = 0, state = { connected: false, state: 'signed-out' }, loginTimer;
  const pending = new Map();
  function stop() {
    const current = session; session = null;
    if (current) { current.stdin.end(); current.kill('SIGTERM'); }
    for (const value of pending.values()) { clearTimeout(value.timer); value.reject(new Error(FAILURE)); }
    pending.clear(); clearTimeout(loginTimer);
  }
  function fail() { state = { connected: false, state: 'failed', error: FAILURE }; stop(); }
  function call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(FAILURE)); }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      session.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    });
  }
  async function open() {
    if (starting) return starting;
    if (session) return;
    starting = (async () => {
      const child = spawnProcess(launcher || binary, [...(launcher ? [binary] : []), 'app-server', '--stdio', '-c', 'cli_auth_credentials_store="file"', '-c', 'mcp_servers={}'], { env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
      session = child;
      let buffer = '';
      child.stderr.resume();
      child.stdin.on('error', () => {});
      child.on('error', () => { if (session === child) fail(); });
      child.on('close', () => { if (session === child) fail(); });
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', chunk => {
        if (session !== child) return;
        buffer += chunk;
        if (Buffer.byteLength(buffer) > 1024 * 1024) { fail(); return; }
        let position;
        while ((position = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, position); buffer = buffer.slice(position + 1);
          let message; try { message = JSON.parse(line); } catch { fail(); return; }
          const waiting = pending.get(message.id);
          if (waiting) {
            pending.delete(message.id); clearTimeout(waiting.timer);
            if (message.error) waiting.reject(new Error(FAILURE)); else waiting.resolve(message.result);
          } else if (message.method === 'account/login/completed' && ['pending', 'preparing'].includes(state.state)) {
            state = message.params?.success ? { connected: true, state: 'connected' } : { connected: false, state: 'failed', error: '로그인이 완료되지 않았어요. 인증 코드를 다시 받아주세요.' };
            stop();
          } else if (message.id != null) {
            // This process is never permitted to execute server-initiated tools.
            child.stdin.write(JSON.stringify({ id: message.id, error: { code: -32601, message: 'Unsupported' } }) + '\n');
          }
        }
      });
      await call('initialize', { clientInfo: { name: 'orbit_android', version: '0.8.7' }, capabilities: { experimentalApi: true } });
      child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
    })();
    try { await starting; } catch (error) { fail(); throw error; } finally { starting = null; }
  }
  let checking;
  async function status() {
    if (['preparing', 'pending', 'connected', 'failed'].includes(state.state)) return { ...state };
    if (!checking) checking = (async () => {
      try {
        await open();
        const account = await call('account/read', { refreshToken: false });
        state = { connected: account?.account?.type === 'chatgpt', state: account?.account?.type === 'chatgpt' ? 'connected' : 'signed-out' };
      } catch { fail(); } finally { stop(); }
      return { ...state };
    })().finally(() => { checking = null; });
    return checking;
  }
  async function login() {
    if (checking) await checking;
    if (['preparing', 'pending'].includes(state.state)) return { ...state };
    state = { connected: false, state: 'preparing' };
    // Return immediately: device authorization can take longer than a WebView request.
    (async () => {
      try {
        await open();
        const result = await call('account/login/start', { type: 'chatgptDeviceCode' });
        if (state.state !== 'preparing') return;
        if (result.verificationUrl !== 'https://auth.openai.com/codex/device' || !/^[A-Z0-9-]{6,20}$/.test(result.userCode)) throw new Error(FAILURE);
        state = { connected: false, state: 'pending', userCode: result.userCode };
        loginTimer = setTimeout(() => { state = { connected: false, state: 'failed', error: '로그인 시간이 만료됐어요. 다시 시작해주세요.' }; stop(); }, loginMs);
      } catch { if (state.state !== 'signed-out') fail(); }
    })();
    return { ...state };
  }
  return {
    get busy() { return Boolean(session || starting || checking); },
    status, login,
    cancel() { state = { connected: false, state: 'signed-out' }; stop(); return { ...state }; },
    close() { state = { connected: false, state: 'signed-out' }; stop(); },
    async handle(req, _body, send) {
      if (req.url === '/api/travel/auth/status' && req.method === 'GET') { send(200, await status()); return true; }
      if (req.url === '/api/travel/auth/login' && req.method === 'POST') { send(202, await login()); return true; }
      if (req.url === '/api/travel/auth/cancel' && req.method === 'POST') { send(200, this.cancel()); return true; }
      return false;
    }
  };
}
