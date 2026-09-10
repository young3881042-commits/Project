import test from 'node:test';
import assert from 'node:assert/strict';
import { validWorkspaceDescriptor, callWorkspace, workspaceTools } from './workspace-mcp.mjs';
import { travelCodexArgs } from './codex.mjs';
test('workspace proxy accepts only a native loopback capability and known tools',async()=>{
 const descriptor={port:43210,token:'a'.repeat(64)};
 assert.equal(validWorkspaceDescriptor({port:80,token:'a'.repeat(64)}),false);
 assert.equal(validWorkspaceDescriptor({...descriptor,token:'short'}),false);
 const value=await callWorkspace(descriptor,'read_file',{path:'notes/a.txt'},async(url,options)=>{assert.equal(url,'http://127.0.0.1:43210/tool');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer '+descriptor.token);assert.equal(JSON.parse(options.body).arguments.path,'notes/a.txt');return Response.json({result:{content:'hello'}});});
 assert.equal(value.content,'hello');
 await assert.rejects(callWorkspace(descriptor,'exec',{},()=>assert.fail()),/허용되지/);
 await assert.rejects(callWorkspace(descriptor,'write_file',{},async()=>Response.json({error:'파일이 변경됐어요.'})),/파일이 변경/);
 assert.deepEqual(workspaceTools.map(x=>x.name),['list_files','read_file','write_file','create_directory','delete_entry']);
});
test('local MCP is scoped to embedded chat; travel defaults still expose no filesystem tools',()=>{
 const previous={embedded:process.env.ORBIT_EMBEDDED,node:process.env.ORBIT_NODE_BINARY};
 try {process.env.ORBIT_EMBEDDED='1';process.env.ORBIT_NODE_BINARY='/native/liborbit_node.so';
 const args=travelCodexArgs('/tmp/schema','/tmp/task','','','',true);
 assert.ok(args.includes('mcp_servers.orbit_local.command="/system/bin/linker64"'));
 assert.ok(args.includes('features.shell_tool=false'));
 assert.ok(args.some(x=>x.includes('liborbit_node.so')&&x.includes('--workspace-mcp')));
 assert.ok(!travelCodexArgs('/tmp/schema','/tmp/task').some(x=>x.startsWith('mcp_servers.orbit_local.')));
 }finally{for(const [key,value]of [['ORBIT_EMBEDDED',previous.embedded],['ORBIT_NODE_BINARY',previous.node]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
