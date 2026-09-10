import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
const TOOL_NAMES = ['list_files', 'read_file', 'write_file', 'create_directory', 'delete_entry'];
export { TOOL_NAMES as WORKSPACE_TOOLS };
export function validWorkspaceDescriptor(value) { return value && Number.isInteger(value.port) && value.port > 1024 && value.port < 65536 && /^[a-f0-9]{64}$/.test(value.token); }
export async function workspaceConnection() {
  if (process.env.ORBIT_EMBEDDED !== '1') return null;
  try { const value = JSON.parse(await readFile(join(homedir(), 'workspace-bridge.json'), 'utf8')); return validWorkspaceDescriptor(value) ? value : null; } catch { return null; }
}
export const workspaceTools = TOOL_NAMES.map(name => ({ name, description: ({list_files:'List entries in the user-selected folder or any descendant. Use nextOffset to paginate.',read_file:'Read bytes of a selected-folder file as UTF-8 or base64. Repeat with nextOffset for large files. sha256 is available for files up to 1MB.',write_file:'Create or replace a file up to 1MB within the selected folder. Existing files require expectedSha256 from a recent read. Never claim success if this tool returns an error.',create_directory:'Create one directory inside the selected folder.',delete_entry:'Delete a file or empty directory only after the user confirms the exact path in the Android app. Never recursively delete a folder.'})[name],
  inputSchema: { type:'object', properties:{path:{type:'string',description:'Relative path; empty string denotes the selected folder.'},...(name==='list_files'?{offset:{type:'integer',minimum:0}}:{}),...(name==='read_file'?{offset:{type:'integer',minimum:0},length:{type:'integer',minimum:1,maximum:65536}}:{}),...(['read_file','write_file'].includes(name)?{encoding:{type:'string',enum:['utf8','base64']}}:{}),...(name==='write_file'?{content:{type:'string'},expectedSha256:{type:'string'}}:{})}, required:name==='write_file'?['path','content']:['path'],additionalProperties:false } }));
export async function callWorkspace(descriptor, name, args, fetcher = fetch) {
  if (!validWorkspaceDescriptor(descriptor) || !TOOL_NAMES.includes(name)) throw new Error('허용되지 않은 폴더 작업이에요.');
  const response = await fetcher(`http://127.0.0.1:${descriptor.port}/tool`, { method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${descriptor.token}`},body:JSON.stringify({name,arguments:args}),redirect:'error',signal:AbortSignal.timeout(['delete_entry','write_file'].includes(name)?100000:20000) });
  if (!response.ok) throw new Error('로컬 폴더 연결을 확인해주세요.');
  const raw = await response.text(); if (raw.length > 500000) throw new Error('폴더 응답이 너무 커요.');
  const result = JSON.parse(raw); if (result.error) throw new Error(result.error); return result.result;
}
export async function runWorkspaceMcp() {
  // Credentials are captured once: reconnecting a folder revokes all existing MCP sessions.
  const descriptor = await workspaceConnection();
  const input = createInterface({input:process.stdin,crlfDelay:Infinity});
  const send = value => process.stdout.write(JSON.stringify(value)+'\n');
  for await (const line of input) {
    if (line.length > 1500000) break;
    let message; try { message=JSON.parse(line); } catch { continue; }
    if (message.id == null) continue;
    try {
      let result;
      if(message.method==='initialize') result={protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'orbit_local',version:'0.9.3'}};
      else if(message.method==='ping') result={};
      else if(message.method==='tools/list') result={tools:descriptor?workspaceTools:[]};
      else if(message.method==='tools/call') { try { const value=await callWorkspace(descriptor,message.params?.name,message.params?.arguments||{});result={content:[{type:'text',text:JSON.stringify(value)}]}; } catch(error) {result={isError:true,content:[{type:'text',text:error.message}]};} }
      else { send({jsonrpc:'2.0',id:message.id,error:{code:-32601,message:'Unsupported method'}});continue; }
      send({jsonrpc:'2.0',id:message.id,result});
    } catch {send({jsonrpc:'2.0',id:message.id,error:{code:-32603,message:'Local folder request failed'}});}
  }
}
