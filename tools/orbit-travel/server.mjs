import { createCodexInfo } from './codex-info.mjs';
import { createEmbeddedAuth } from './embedded-auth.mjs';
import { createMerchantClassifier } from './merchant-classifier.mjs';
import http from 'node:http';
import { createChatService } from './chat.mjs';
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const generateTravelPlan = async (...args) => (await import('./codex.mjs')).generateTravelPlan(...args);
import { TRAVEL_PORT, TRAVEL_BODY_LIMIT, TRAVEL_RESULT_LIMIT, validateTravelInput, validateTravelPlan } from '../../apps/web/src/features/travel/travelModel.js';

const ORIGINS = new Set(['https://appassets.androidplatform.net', 'http://127.0.0.1:5173', 'http://localhost:5173']);
const equal = (left, right) => typeof left === 'string' && Buffer.byteLength(left) === Buffer.byteLength(right) && timingSafeEqual(Buffer.from(left), Buffer.from(right));
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);

export function createTravelServer({ token, pairingCode, generate = generateTravelPlan, now = Date.now, model = '', idleMs = 0, chatDirectory, chatReply, merchantClassify, embeddedAuth }) {
  if (!/^[a-f0-9]{64}$/.test(token) || !/^\d{8}$/.test(pairingCode)) throw new Error('Invalid local credentials');
  const jobs = new Map();
  const codexInfo = createCodexInfo();
  let active = null, paired = false, attempts = 0;
  const chat = createChatService({ directory: chatDirectory, reply: chatReply, otherBusy: () => Boolean(active) || merchant.busy });
  const merchant = createMerchantClassifier({ classify: merchantClassify, otherBusy: () => Boolean(active) || chat.busy, now });
  let started = now();
  let lastRequest = now(), idleTimer;
  function armIdle() {
    if (!idleMs) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      prune();
      const unread = [...jobs.values()].some(job => !job.delivered);
      if (!active && !chat.busy && !merchant.busy && !embeddedAuth?.busy && !codexInfo.busy && !unread && now() - lastRequest >= idleMs) {
        server.close(); server.closeIdleConnections();
      } else armIdle();
    }, idleMs);
    idleTimer.unref();
  }
  function prune() {
    for (const [id, job] of jobs) if (job !== active && now() - job.updated > 30 * 60 * 1000) jobs.delete(id);
    while (jobs.size > 20) {
      const removable = [...jobs].find(([, job]) => job !== active);
      if (!removable) break;
      jobs.delete(removable[0]);
    }
  }
  const publicJob = job => ({ id: job.id, state: job.state, message: job.message, input: job.input, ...(job.result ? { result: job.result } : {}) });
  const server = http.createServer(async (req, res) => {
    const send = (status, body) => {
      if (res.destroyed) return;
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify(body));
    };
    const expectedHost = `127.0.0.1:${server.address()?.port}`;
    if (req.socket.remoteAddress !== '127.0.0.1' || req.headers.host !== expectedHost || !ORIGINS.has(req.headers.origin)
      || req.headers.forwarded || req.headers['x-forwarded-for'] || req.headers['x-forwarded-host']) {
      send(403, { error: '이 휴대폰의 Orbit 앱에서만 연결할 수 있어요.' }); return;
    }
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      send(204, {}); return;
    }
    if (!req.url?.startsWith('/api/travel/')) { send(404, { error: '지원하지 않는 여행 요청이에요.' }); return; }
    const pairing = req.url === '/api/travel/pair' && req.method === 'POST';
    if (!pairing && !equal(req.headers.authorization, `Bearer ${token}`)) { send(401, { error: 'Termux의 연결 코드를 입력해주세요.' }); return; }
    lastRequest = now();
    armIdle();
    let body = {};
    if (req.method === 'POST') {
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) { send(415, { error: 'JSON 요청만 지원해요.' }); return; }
      const bodyLimit = /^\/api\/travel\/chat\/threads\/[a-f0-9-]{36}\/messages$/.test(req.url) ? 128 * 1024 : TRAVEL_BODY_LIMIT;
      if (Number(req.headers['content-length']) > bodyLimit) { send(413, { error: '요청사항이 너무 길어요.' }); return; }
      try {
        const chunks = []; let length = 0;
        for await (const chunk of req) { length += chunk.length; if (length > bodyLimit) { send(413, { error: '요청사항이 너무 길어요.' }); return; } chunks.push(chunk); }
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
      } catch { send(400, { error: '여행 요청을 읽지 못했어요.' }); return; }
    }
    if (pairing) {
      if (paired || now() - started > 10 * 60 * 1000 || attempts >= 10) { send(429, { error: '연결 코드가 만료됐어요. Termux 여행 서버를 다시 실행해주세요.' }); return; }
      attempts += 1;
      if (!equal(body.code, pairingCode)) { send(401, { error: '8자리 연결 코드를 확인해주세요.' }); return; }
      paired = true;
      send(200, { token }); return;
    }
    if (req.url === '/api/travel/auth/info' && req.method === 'GET') {
      if (embeddedAuth?.busy) { send(409, { error: '로그인을 마친 뒤 모델·사용 한도를 확인해주세요.' }); return; }
      try { send(200, await codexInfo.read()); } catch { send(503, { error: '모델·사용 한도를 불러오지 못했어요. 연결과 로그인을 확인해주세요.' }); }
      return;
    }
    if (embeddedAuth && await embeddedAuth.handle(req, body, send)) return;
    if (embeddedAuth && req.method === 'POST' && (req.url === '/api/travel/jobs' || req.url === '/api/travel/merchant/jobs' || req.url.endsWith('/messages'))) {
      if (!(await embeddedAuth.status()).connected) { send(401, { error: 'AI 사용하기에서 ChatGPT로 로그인해주세요.' }); return; }
    }
    if (await merchant.handle(req, body, send)) return;
    if (await chat.handle(req, body, send)) return;
    prune();
    if (req.url === '/api/travel/status' && req.method === 'GET') { send(200, { connected: true, busy: Boolean(active) || chat.busy || merchant.busy, merchantClassification: true, service: 'orbit-travel', chatMemory: 'sqlite-fts-v1', chatAttachments: 'text-pdf-v1', chatModels: true, chatReasoning: true, runtimeMode: idleMs ? 'on-demand' : 'standby' }); return; }
    // Terminal-only administration: Android's action allowlist never exposes this route.
    if (req.url === '/api/travel/pair-code' && req.method === 'POST') {
      pairingCode = String(randomInt(10000000, 100000000)); started = now(); paired = false; attempts = 0;
      send(200, { code: pairingCode }); return;
    }
    if (req.url === '/api/travel/jobs' && req.method === 'POST') {
      let input;
      try { input = validateTravelInput(body.input); if (!uuid(body.requestId)) throw new Error('요청 ID를 확인해주세요.'); }
      catch (error) { send(400, { error: error.message }); return; }
      const duplicate = jobs.get(body.requestId);
      if (duplicate) {
        if (JSON.stringify(duplicate.input) !== JSON.stringify(input)) { send(409, { error: '같은 요청 ID의 여행 정보가 달라요.' }); return; }
        send(200, publicJob(duplicate)); return;
      }
      if (active || chat.busy || merchant.busy) { send(409, { error: '이미 여행을 생성하고 있어요. 진행 중인 계획을 먼저 확인해주세요.' }); return; }
      const job = { id: body.requestId, input, state: 'running', message: 'Codex가 여행 일정을 구성하고 있어요.', updated: now(), controller: new AbortController() };
      jobs.set(job.id, job); active = job;
      send(202, publicJob(job));
      Promise.resolve().then(() => generate(input, { signal: job.controller.signal, model, onProgress: message => { if (job.state === 'running') job.message = String(message).slice(0, 200); } }))
        .then(result => {
          if (job.state !== 'running') return;
          const validated = validateTravelPlan(result, input);
          if (Buffer.byteLength(JSON.stringify(validated)) > TRAVEL_RESULT_LIMIT) throw new Error('생성된 일정이 너무 길어요.');
          job.result = validated; job.state = 'completed'; job.message = '여행 계획이 완성됐어요.';
        }).catch(error => {
          if (job.state !== 'running') return;
          job.state = 'failed'; job.message = error?.message?.startsWith('Codex') || /^[가-힣]/.test(error?.message || '') ? error.message.slice(0, 200) : '여행 생성에 실패했어요. 다시 시도해주세요.';
        }).finally(() => { job.updated = now(); if (active === job) active = null; });
      return;
    }
    const id = req.url.slice('/api/travel/jobs/'.length);
    if (req.url.startsWith('/api/travel/jobs/') && uuid(id) && ['GET', 'DELETE'].includes(req.method)) {
      const job = jobs.get(id);
      if (!job) { send(404, { error: '진행 중인 요청이 만료됐어요. 다시 생성해주세요.' }); return; }
      if (req.method === 'DELETE' && job.state === 'running') {
        job.state = 'cancelled'; job.message = '생성을 취소했어요.'; job.updated = now(); job.controller.abort();
      }
      if (job.state !== 'running') job.delivered = true;
      send(200, publicJob(job)); return;
    }
    send(404, { error: '지원하지 않는 여행 요청이에요.' });
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.maxConnections = 16;
  server.on('listening', armIdle);
  server.on('close', () => { clearTimeout(idleTimer); active?.controller.abort(); chat.close(); merchant.close(); embeddedAuth?.close(); codexInfo.close(); });
  return server;
}

export async function loadTravelToken() {
  const directory = join(homedir(), '.local', 'state', 'orbit-travel');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const file = join(directory, 'auth');
  let token;
  try { token = (await readFile(file, 'utf8')).trim(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!token) {
    try { await writeFile(file, randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    token = (await readFile(file, 'utf8')).trim();
  }
  await chmod(file, 0o600);
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid local credentials');
  return token;
}

export async function startTravelServer({ quiet = false, idleMs = 0, port = TRAVEL_PORT, embedded = false } = {}) {
  const token = await loadTravelToken();
  const pairingCode = String(randomInt(10000000, 100000000));
  const server = createTravelServer({ token, pairingCode, model: process.env.ORBIT_TRAVEL_MODEL || '', idleMs, embeddedAuth: embedded ? createEmbeddedAuth({ binary: process.env.ORBIT_CODEX_BINARY, launcher: '/system/bin/linker64' }) : undefined });
  try {
    await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolveListen); });
  } catch (error) {
    if (embedded || error.code !== 'EADDRINUSE') throw error;
    if (quiet) return null;
    const response = await fetch(`http://127.0.0.1:${TRAVEL_PORT}/api/travel/pair-code`, { method: 'POST', headers: { Origin: 'https://appassets.androidplatform.net', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}', redirect: 'error', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Existing service cannot be authenticated');
    const data = await response.json();
    if (!/^\d{8}$/.test(data.code)) throw new Error('Invalid code');
    process.stdout.write(`여행 연결이 이미 실행 중이에요. 새 연결 코드: ${data.code} (10분, 1회용)\n`);
    return null;
  }
  if (!quiet) process.stdout.write(`Orbit 여행 연결 실행 중 · 127.0.0.1:${TRAVEL_PORT}\n앱의 여행 → Termux 연결에서 코드 ${pairingCode} 입력 (10분, 1회용)\n종료: Ctrl+C · Codex 사용 한도가 적용됩니다.\n`);
  const stop = () => { server.close(); server.closeAllConnections(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  return server;
}

if (process.argv[1]?.endsWith('/server.mjs') && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  startTravelServer().catch(error => { process.stderr.write(error.code === 'EADDRINUSE' ? '여행 연결이 이미 실행 중이에요.\n' : '여행 연결을 시작하지 못했어요. 설치와 파일 권한을 확인해주세요.\n'); process.exitCode = 1; });
}
