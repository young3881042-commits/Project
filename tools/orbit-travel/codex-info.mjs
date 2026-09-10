import { modelEfforts, validChatEffort } from '../../apps/web/src/features/ai-chat/chatModelOptions.js';
import { spawn } from 'node:child_process';
import { resolveRuntimeCodex } from './codex.mjs';
export const validChatModel = value => typeof value === 'string' && (value === '' || /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,99}$/.test(value));
export function publicModels(result) {
  return (Array.isArray(result?.data) ? result.data : []).filter(item => !item.hidden && validChatModel(item.model) && item.model).slice(0, 100)
    .map(item => ({ id: item.model, name: String(item.displayName || item.model).slice(0, 100), isDefault: item.isDefault === true, efforts: modelEfforts(item), defaultEffort: validChatEffort(item.defaultReasoningEffort) ? item.defaultReasoningEffort : '' }));
}
export function publicLimits(result) {
  const buckets = result?.rateLimitsByLimitId && typeof result.rateLimitsByLimitId === 'object' ? Object.values(result.rateLimitsByLimitId) : result?.rateLimits ? [result.rateLimits] : [];
  return buckets.slice(0, 10).flatMap(bucket => ['primary', 'secondary'].flatMap(kind => {
    const value = bucket?.[kind];
    if (typeof value?.usedPercent !== 'number' || !Number.isFinite(value.usedPercent)) return [];
    return [{ bucket: String(bucket.limitName || bucket.limitId || 'Codex').slice(0, 80), kind,
      remainingPercent: Math.max(0, Math.min(100, 100 - value.usedPercent)),
      windowMinutes: Number.isFinite(value.windowDurationMins) && value.windowDurationMins > 0 ? value.windowDurationMins : null,
      resetsAt: Number.isFinite(value.resetsAt) && value.resetsAt > 0 ? value.resetsAt : null }];
  }));
}
export function createCodexInfo({ resolveCommand = resolveRuntimeCodex, spawnProcess = spawn } = {}) {
  let ongoing, child;
  async function read() {
    if (ongoing) return ongoing;
    ongoing = (async () => {
      const target = resolveCommand();
      const processChild = spawnProcess(target.command, [...target.argsPrefix, 'app-server', '--stdio', '-c', 'mcp_servers={}'], { env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
      child = processChild;
      const pending = new Map(); let seq = 0, buffer = '';
      const rejectAll = () => { for (const task of pending.values()) { clearTimeout(task.timer); task.reject(new Error('모델·사용 한도를 불러오지 못했어요.')); } pending.clear(); };
      processChild.stderr.resume(); processChild.stdin.on('error', () => {});
      processChild.on('error', rejectAll); processChild.on('close', rejectAll);
      const call = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++seq; const timer = setTimeout(() => { pending.delete(id); reject(new Error('모델·사용 한도 응답이 늦어요.')); }, 7000);
        pending.set(id, { resolve, reject, timer }); processChild.stdin.write(JSON.stringify({ id, method, params }) + '\n');
      });
      processChild.stdout.setEncoding('utf8');
      processChild.stdout.on('data', chunk => {
        buffer += chunk;
        if (buffer.length > 512000) { rejectAll(); processChild.kill(); return; }
        let index;
        while ((index = buffer.indexOf('\n')) >= 0) {
          let msg; try { msg = JSON.parse(buffer.slice(0, index)); } catch { rejectAll(); processChild.kill(); return; }
          buffer = buffer.slice(index + 1);
          const task = pending.get(msg.id);
          if (task) { clearTimeout(task.timer); pending.delete(msg.id); if (msg.error) task.reject(new Error('사용 정보를 제공받지 못했어요.')); else task.resolve(msg.result); }
          else if (msg.id != null) processChild.stdin.write(JSON.stringify({ id: msg.id, error: { code: -32601, message: 'Unsupported' } }) + '\n');
        }
      });
      try {
        await call('initialize', { clientInfo: { name: 'orbit_account_info', version: '0.9.0' } });
        processChild.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
        const [models, limits] = await Promise.allSettled([call('model/list', { limit: 100, includeHidden: false }), call('account/rateLimits/read')]);
        return { models: models.status === 'fulfilled' ? publicModels(models.value) : [], limits: limits.status === 'fulfilled' ? publicLimits(limits.value) : [],
          modelsError: models.status === 'rejected' ? '모델 목록을 불러오지 못했어요.' : '',
          limitsError: limits.status === 'rejected' ? '로그인 상태를 확인한 뒤 사용 한도를 다시 불러와주세요.' : '', fetchedAt: Date.now(), exactRemainingTokens: null };
      } finally { rejectAll(); processChild.stdin.end(); processChild.kill('SIGTERM'); if (child === processChild) child = null; }
    })().finally(() => { ongoing = null; });
    return ongoing;
  }
  return { read, get busy() { return Boolean(ongoing); }, close() { child?.kill('SIGTERM'); } };
}
