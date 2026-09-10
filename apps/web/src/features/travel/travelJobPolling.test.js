import test from 'node:test';
import assert from 'node:assert/strict';
import { watchTravelJob } from './travelJobPolling.js';
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness(read) {
  const timers = new Map(), jobs = [], errors = []; let next = 0, visible = true;
  const watcher = watchTravelJob({ read, onJob: job => jobs.push(job), onError: (error, retrying) => errors.push({ error, retrying }), isVisible: () => visible,
    schedule: (fn, delay) => { timers.set(++next, { fn, delay }); return next; }, unschedule: id => timers.delete(id) });
  return { watcher, jobs, errors, timers, hide: () => { visible = false; watcher.resume(); }, show: () => { visible = true; watcher.resume(); },
    tick: async () => { const [id, timer] = timers.entries().next().value; timers.delete(id); timer.fn(); await flush(); } };
}
test('a lost poll response recovers the same job and delivers completion', async () => {
  let reads = 0;
  const h = harness(async () => { if (++reads === 1) throw new Error('timeout'); return { state: 'completed' }; });
  await flush(); assert.equal(h.errors[0].retrying, true); await h.tick();
  assert.equal(reads, 2); assert.equal(h.jobs[0].state, 'completed'); assert.equal(h.timers.size, 0);
  h.watcher.resume(); await flush(); assert.equal(reads, 2);
});
test('retries back off and stop; unauthorized requests never auto retry', async () => {
  const h = harness(async () => { throw new Error('timeout'); }); await flush();
  for (const delay of [1800, 3600, 7200]) { assert.equal([...h.timers.values()][0].delay, delay); await h.tick(); }
  assert.equal(h.timers.size, 0); assert.equal(h.errors.at(-1).retrying, false);
  const auth = harness(async () => { throw Object.assign(new Error('login'), { status: 401 }); }); await flush();
  assert.equal(auth.errors[0].retrying, false); assert.equal(auth.timers.size, 0);
});
test('hidden screens stop timers, resume avoids overlapping requests, unmount ignores late results', async () => {
  let resolve, reads = 0;
  const h = harness(() => { reads++; return new Promise(done => { resolve = done; }); });
  h.watcher.resume(); assert.equal(reads, 1);
  resolve({ state: 'running' }); await flush(); h.hide(); assert.equal(h.timers.size, 0);
  h.show(); assert.equal(reads, 2); h.watcher.stop(); resolve({ state: 'completed' }); await flush();
  assert.equal(h.jobs.length, 1); assert.equal(h.timers.size, 0);
});
