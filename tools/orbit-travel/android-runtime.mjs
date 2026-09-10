import { runWorkspaceMcp } from './workspace-mcp.mjs';
// Standalone Termux helper, also bundled in the APK. Never exports the bearer token.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadTravelToken, startTravelServer } from './server.mjs';

async function main() {
  if (process.argv.includes('--workspace-mcp')) { await runWorkspaceMcp(); return; }
  if (process.argv.includes('--embedded')) {
    await startTravelServer({ quiet: true, idleMs: 60000, port: 4320, embedded: true });
    return;
  }
  if (process.argv.includes('--service')) {
    await startTravelServer({ quiet: true });
    return;
  }
  const token = await loadTravelToken();
  const ready = async () => {
    try {
      const response = await fetch('http://127.0.0.1:4319/api/travel/status', {
        headers: { Origin: 'https://appassets.androidplatform.net', Authorization: `Bearer ${token}` },
        redirect: 'error', signal: AbortSignal.timeout(1000)
      });
      if (response.status === 401 || response.status === 403) throw new Error('AUTH');
      if (!response.ok) return false;
      const data = await response.json();
      if (data.service !== 'orbit-travel' || data.runtimeMode !== 'standby') throw new Error('AUTH');
      return true;
    } catch (error) { if (error.message === 'AUTH') throw error; return false; }
  };
  if (!await ready()) {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--service'], {
      detached: true, stdio: 'ignore', env: process.env
    });
    const spawned = new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    await spawned;
    child.unref();
    let connected = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      if (await ready()) { connected = true; break; }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (!connected) throw new Error('START');
  }
  if (process.argv.includes('--ensure')) return;
  const response = await fetch('http://127.0.0.1:4319/api/travel/pair-code', {
    method: 'POST', headers: { Origin: 'https://appassets.androidplatform.net', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}', redirect: 'error', signal: AbortSignal.timeout(3000)
  });
  if (!response.ok) throw new Error('PAIR');
  const data = await response.json();
  if (!/^\d{8}$/.test(data.code)) throw new Error('PAIR');
  process.stdout.write(`Orbit 대기 연결 준비됨 · 최초 연결 코드: ${data.code} (10분, 1회용)\n이미 연결했다면 코드를 다시 입력하지 않아도 됩니다.\n`);
}
main().catch(() => { process.stderr.write('Orbit 여행 자동 연결을 시작하지 못했어요.'); process.exitCode = 1; });
