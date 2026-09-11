import test from 'node:test';
import assert from 'node:assert/strict';
import { travelImageFile } from './travelImageFile.js';
const key='a'.repeat(64), url=`https://appassets.androidplatform.net/orbit-workspace/travel/${key}.png?v=${'b'.repeat(64)}`;
function native(reply) {
  const listeners=new Set();
  return {crypto:{randomUUID:()=> 'request-1'},addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn),
    AiAssistantNative:{requestTravelImageFile:(id,action,idKey,content,metadata)=>queueMicrotask(()=>{for(const fn of [...listeners])fn({detail:{requestId:id,...reply({action,key:idKey,content,metadata:JSON.parse(metadata)})}});})}};
}
test('native PNG save returns a file URL only after confirmed save', async()=>{
  const target=native(args=>{assert.equal(args.action,'save');assert.equal(args.metadata.day,1);assert.equal(args.content,'data:image/png;base64,TEST');return{exists:true,url,path:`travel/${key}.png`};});
  const image=await travelImageFile('save',key,'data:image/png;base64,TEST',target,{day:1});assert.equal(image.dataUrl,url);
  assert.equal(await travelImageFile('read',key,'',native(()=>({exists:false}))),null);
});
test('native image errors and unrelated file URLs cannot become a successful preview', async()=>{
  await assert.rejects(travelImageFile('save',key,'',native(()=>({error:'저장 실패'}))),/저장 실패/);
  await assert.rejects(travelImageFile('read',key,'',native(()=>({exists:true,url:'file:///data/auth.json'}))),/이미지 경로/);
  await assert.rejects(travelImageFile('read','../auth','',native(()=>({}))),/이미지 경로/);
});
