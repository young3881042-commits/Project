import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionJournal } from './actionJournal.js';
import { scheduleActionReply, scheduleIntent } from './actionSchema.js';
const context = { version: 1, today: '2026-09-17', timeZone: 'Asia/Seoul', pending: null };
function fixture() {
  const values = new Map(); let items = [], fail = false;
  const storage = { getItem: k => values.get(k) || null, setItem: (k,v) => values.set(k,v) };
  const repository = { read: () => structuredClone(items), normalize: x => x, save: next => { if (fail) return {saved:false}; items = structuredClone(next); return {saved:true}; } };
  const make = owner => createActionJournal({ owner, storage, repository, now: () => 1000 });
  const journal = make('a');
  const register = (id = 'one', text = '내일 오전 9시 회의 등록해줘') => journal.register({ requestId:id, threadId:'thread', runtime:'embedded', text, context });
  const accept = row => journal.accept({ id:'thread', messages:[{ role:'assistant', requestId:row.requestId, ...scheduleActionReply(row.text,row.context) }] }, 'embedded');
  return {storage, repository, journal, make, register, accept, fail: v => {fail=v;} };
}
test('clear meeting request resolves deterministically; vague/meta/negative text cannot write', () => {
  assert.deepEqual(scheduleIntent('내일 오전 9시 회의 등록해줘', context.today).draft, {title:'회의',date:'2026-09-18',time:'09:00',category:'work'});
  for (const text of ['일정 등록 버튼 만들어줘','일정 등록 예시 알려줘','내일 일정 등록하지 마','회의를 등록하면 어떻게 돼?']) assert.equal(scheduleIntent(text,context.today).status,'not-action');
  assert.equal(scheduleIntent('회의 등록해줘',context.today).status,'invalid');
  assert.equal(scheduleIntent('내일 9시 회의 등록해줘',context.today).status,'need-more');
});
test('request, duplicate response and restart create once; undo survives restart', () => {
  const f=fixture(), row=f.register(); f.accept(row); f.accept(row);
  assert.equal(f.repository.read().length,1); assert.equal(f.journal.get(row.id).status,'done');
  f.make('a').recover('embedded'); assert.equal(f.repository.read().length,1);
  f.journal.undo(row.id); f.accept(row); f.make('a').recover('embedded');
  assert.equal(f.repository.read().length,0); assert.equal(f.journal.get(row.id).status,'undone');
});
test('unknown, cancelled, wrong-runtime and changed action results never execute', () => {
  const f=fixture(), row=f.register();
  f.journal.accept({id:'thread',messages:[{role:'assistant',requestId:'unknown',actions:row.expected.actions}]},'embedded');
  f.journal.accept({id:'thread',messages:[{role:'assistant',requestId:row.requestId,actions:row.expected.actions}]},'standby');
  assert.equal(f.repository.read().length,0);
  f.journal.cancel('thread','embedded');f.accept(row);assert.equal(f.repository.read().length,0);
  const next=f.register('two');f.journal.accept({id:'thread',messages:[{role:'assistant',requestId:'two',actions:[{type:'schedule.create',draft:{...next.expected.actions[0].draft,title:'다른 요청'}}]}]},'embedded');
  assert.equal(f.journal.get(next.id).status,'conflict');assert.equal(f.repository.read().length,0);
});
test('journal preparation failure prevents writes; post-write journal failure recovers without duplicate', () => {
  const f=fixture(), row=f.register(); const original=f.storage.setItem;
  f.storage.setItem=()=>{throw Error('full');};assert.throws(()=>f.accept(row));assert.equal(f.repository.read().length,0);
  f.storage.setItem=(key,value)=>{if(JSON.parse(value).records.some(r=>r.status==='done'))throw Error('crash');original(key,value);};
  assert.throws(()=>f.accept(row));assert.equal(f.repository.read().length,1);
  f.storage.setItem=original;f.make('a').recover('embedded');assert.equal(f.repository.read().length,1);assert.equal(f.journal.get(row.id).status,'done');
});
test('undo does not overwrite manual edits; other owner cannot replay results', () => {
  const f=fixture(), row=f.register();f.accept(row);
  f.repository.save(f.repository.read().map(item=>({...item,title:'사용자 수정'})));
  f.journal.undo(row.id);assert.equal(f.repository.read()[0].title,'사용자 수정');assert.equal(f.journal.get(row.id).status,'conflict');
  f.make('b').accept({id:'thread',messages:[{role:'assistant',requestId:row.requestId,actions:row.expected.actions}]},'embedded');assert.equal(f.make('b').list().length,0);
});
test('failed save never reports done; explicit retry can save once', () => {
  const f=fixture(), row=f.register();f.fail(true);f.accept(row);assert.equal(f.journal.get(row.id).status,'failed');
  f.fail(false);f.journal.execute(row.id);assert.equal(f.journal.get(row.id).status,'done');assert.equal(f.repository.read().length,1);
});
test('restoring a backup invalidates in-flight requests before historical results arrive', () => {
  const f=fixture(), row=f.register();f.journal.invalidate();f.accept(row);assert.equal(f.repository.read().length,0);assert.equal(f.journal.get(row.id).status,'cancelled');
});
test('crash before domain write is held for review instead of blindly replayed',()=>{
  const f=fixture(),row=f.register();f.repository.save=()=>{throw Error('process killed');};
  assert.throws(()=>f.accept(row));assert.equal(f.journal.get(row.id).status,'saving');
  f.make('a').recover('embedded');assert.equal(f.journal.get(row.id).status,'conflict');assert.equal(f.repository.read().length,0);
});
test('interrupted undo finishes from the durable deletion without recreating the record',()=>{
  const f=fixture(),row=f.register();f.accept(row);const write=f.storage.setItem;
  f.storage.setItem=(k,v)=>{if(JSON.parse(v).records.some(r=>r.status==='undone'))throw Error('crash');write(k,v);};
  assert.throws(()=>f.journal.undo(row.id));assert.equal(f.repository.read().length,0);
  f.storage.setItem=write;f.make('a').recover('embedded');assert.equal(f.journal.get(row.id).status,'undone');
});
