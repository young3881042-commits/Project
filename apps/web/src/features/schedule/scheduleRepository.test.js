import test from 'node:test';
import assert from 'node:assert/strict';
import { persistSchedules } from './scheduleRepository.js';
test('schedule repository reports completion only after readback and preserves failed storage',()=>{
  let rows=[],events=0;
  const options={normalize:x=>x,compare:(a,b)=>a.id.localeCompare(b.id),write:items=>{rows=items;return true;},read:()=>rows,onSaved:()=>events++};
  assert.equal(persistSchedules([{id:'b'},{id:'a'}],options).saved,true);assert.equal(events,1);
  assert.equal(persistSchedules([{id:'c'}],{...options,write:()=>false}).saved,false);assert.equal(rows.length,2);assert.equal(events,1);
  assert.equal(persistSchedules([{id:'c'}],{...options,read:()=>[]}).saved,false);assert.equal(events,1);
});
