import test from 'node:test';
import assert from 'node:assert/strict';
import {pickNativeChatAttachment} from './chatNativeAttachment.js';
import {readChatAttachment} from './chatAttachments.js';
const bytes=new TextEncoder().encode('첨부한 문서 내용');
const file={name:'한글.md',size:bytes.length,url:'https://appassets.androidplatform.net/orbit-chat-attachment/11111111-1111-4111-8111-111111111111'};
function target(result,{ok=true,body=bytes.buffer}={}){
 const listeners=new Set();let fetched=0;
 return {crypto:{randomUUID:()=> 'test'},addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn),
 AiAssistantNative:{pickChatAttachment:id=>queueMicrotask(()=>{for(const fn of [...listeners])fn({detail:{requestId:id,...result}});})},
 fetch:async url=>{fetched++;assert.equal(url,file.url);return{ok,arrayBuffer:async()=>body};},get fetched(){return fetched;}};
}
test('native selected document reaches the existing attachment parser without content URI access',async()=>{
 const native=target({file});const selected=await pickNativeChatAttachment(native);const attachment=await readChatAttachment(selected);
 assert.equal(attachment.name,'한글.md');assert.equal(attachment.text,'첨부한 문서 내용');assert.equal(native.fetched,1);
});
test('picker cancellation preserves drafts and native errors are visible',async()=>{
 const native=target({cancelled:true});assert.equal(await pickNativeChatAttachment(native),null);assert.equal(native.fetched,0);
 await assert.rejects(pickNativeChatAttachment(target({error:'파일을 읽지 못했어요.'})),/파일을 읽지/);
});
test('unexpected URLs, failed downloads and partial bytes are rejected before attaching',async()=>{
 const native=target({file:{...file,url:'content://private/document'}});await assert.rejects(pickNativeChatAttachment(native),/정보/);assert.equal(native.fetched,0);
 await assert.rejects(pickNativeChatAttachment(target({file},{ok:false})),/읽지/);
 await assert.rejects(pickNativeChatAttachment(target({file},{body:new ArrayBuffer(1)})),/끝까지/);
});
