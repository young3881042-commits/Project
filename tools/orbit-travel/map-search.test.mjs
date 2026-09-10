import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMapSearch, mapQuery, mapCandidates } from './map-search.mjs';
test('map lookup uses a fixed public provider and caches results across runtime restarts',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'orbit-map-test-'));t.after(()=>rm(directory,{recursive:true,force:true}));let calls=0;
 const fetcher=async(url,options)=>{calls++;assert.equal(url.origin,'https://photon.komoot.io');assert.equal(url.searchParams.get('q'),'서울 경복궁');assert.equal(options.redirect,'error');assert.match(options.headers['User-Agent'],/^Orbit\//);return Response.json({features:[{geometry:{coordinates:[126.97,37.57]},properties:{name:'경복궁',city:'서울'}}]});};
 const search=createMapSearch({directory,fetcher,interval:0});
 assert.equal((await search.search('서울  경복궁')).candidates[0].name,'경복궁');
 assert.equal((await search.search('서울 경복궁')).cached,true);
 assert.equal((await createMapSearch({directory,fetcher,interval:0}).search('서울 경복궁')).cached,true);assert.equal(calls,1);
});
test('map query and returned coordinates are bounded; no arbitrary URL proxy',()=>{
 for(const value of ['http://127.0.0.1/private','x'.repeat(241),'\n',{}])assert.throws(()=>mapQuery(value));
 assert.deepEqual(mapCandidates({features:[null,{geometry:{coordinates:{}},properties:{name:'a'}},{geometry:{coordinates:[0,100]},properties:{name:'b'}}]}),[]);
});
