import test from 'node:test';import assert from 'node:assert/strict';import{spawn}from'node:child_process';import{mkdtemp,rm}from'node:fs/promises';import{tmpdir}from'node:os';import{once}from'node:events';
test('night reset and restore: every status, auth, atomic archive, stale revisions, concurrent clients, retries, old tabs, demo and restart',async()=>{
const dir=await mkdtemp(tmpdir()+'/night-api-'),url='http://127.0.0.1:3386';let child,cookie,seq=0;const id=()=>`night-request-${++seq}`;
async function start(){child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,DATABASE_URL:'',NODE_ENV:'test',HOST_PASSWORD:'synthetic-password-only',PORT:'3386',SQLITE_PATH:dir+'/db'},stdio:['ignore','pipe','pipe']});await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('start failed')})])}
async function stop(){const p=once(child,'exit');child.kill();await p}
async function req(path,b,host=true){const r=await fetch(url+'/api/'+path,{method:b?'POST':'GET',headers:{...(b?{'Content-Type':'application/json','X-Roulette-Request':'1'}:{}),...(host&&cookie?{Cookie:cookie}:{})},body:b?JSON.stringify(b):undefined});return{status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
const state=async()=> (await req('state')).body;
async function post(path,payload){const s=await state();return req(path,{id:id(),context:s.context,revision:s.revision,...payload})}
try{await start();cookie=(await req('login',{password:'synthetic-password-only'})).cookie;
for(const phase of ['none','open','locked','settled']){
 await post('change',{action:'replace',state:{players:[{id:'test',name:'SYNTHETIC',points:1000}],log:['local fixture']}});
 if(phase!=='none'){let s=(await post('round',{action:'open'})).body;await post('bets',{roundId:s.round.id,playerId:'test',version:0,bets:[{key:'red',stake:25}]});if(phase!=='open')await post('round',{action:'lock',roundId:s.round.id});if(phase==='settled')await post('round',{action:'settle',roundId:s.round.id,winning:1})}
 const before=await state(),payload={action:'start',revision:before.revision,context:before.context,id:id()};
 assert.equal((await req('night',payload,false)).status,401);assert.equal((await req('night',{...payload,revision:before.revision-1})).status,409);
 const pair=await Promise.all([req('night',payload),req('night',payload)]);assert.deepEqual(pair.map(x=>x.status),[200,200]);const reset=pair[0].body;assert.equal(reset.revision,before.revision+1);assert.equal(pair[1].body.revision,reset.revision);assert.deepEqual(reset.state.players,[]);assert.equal(reset.round,null);assert.notEqual(reset.context,before.context);assert.equal(reset.nightArchives.length,(before.nightArchives||[]).length+1);
 assert.equal((await req('state',null,false)).body.nightArchives,undefined);
 if(before.round){assert.equal((await req('bets',{id:id(),context:before.context,roundId:before.round.id,playerId:'test',version:1,bets:[]},false)).status,409)}
 const archived=reset.nightArchives.at(-1),restore={action:'restore',backupId:archived.id,context:reset.context,revision:reset.revision,id:id()};
 await post('change',{action:'replace',state:{players:[{id:'new',name:'NEW TEST',points:500}],log:[]}});
 assert.equal((await req('night',restore)).status,409);const current=await state();
 const restored=(await req('night',{...restore,context:current.context,revision:current.revision,id:id()})).body;assert.deepEqual(restored.state,before.state);assert.deepEqual(restored.round,before.round);assert.equal(restored.nightArchives.at(-1).players,1);
 // Even restoring the original round ID must not revive old requests.
 if(before.round)assert.equal((await req('bets',{id:id(),context:before.context,roundId:before.round.id,playerId:'test',version:1,bets:[]},false)).status,409);
 const clean=await post('night',{action:'start'});assert.equal(clean.status,200);
}
const beforeDemo=await state();await post('demo',{action:'start'});const demo=await state();assert.equal((await post('night',{action:'start'})).status,409);assert.equal((await state()).revision,demo.revision);await post('demo',{action:'end'});assert.deepEqual((await state()).state,beforeDemo.state);
// A simultaneous player write and reset either preserves that write in the snapshot or forces fresh confirmation.
await post('change',{action:'replace',state:{players:[{id:'race',name:'RACE TEST',points:1000}],log:[]}});let s=(await post('round',{action:'open'})).body;
let pair=await Promise.all([req('night',{id:id(),context:s.context,revision:s.revision,action:'start'}),req('bets',{id:id(),context:s.context,roundId:s.round.id,playerId:'race',version:0,bets:[{key:'black',stake:10}]},false)]);assert.equal(pair.filter(x=>x.status===200).length,1);assert.equal(pair.filter(x=>x.status===409).length,1);
s=await state();if(s.round)await post('night',{action:'start'});s=await state();const backup=s.nightArchives.at(-1);await stop();await start();assert.equal((await req('night',{id:id(),context:s.context,revision:s.revision,action:'restore',backupId:backup.id})).status,401);cookie=(await req('login',{password:'synthetic-password-only'})).cookie;
const restored=await post('night',{action:'restore',backupId:backup.id});assert.equal(restored.status,200);assert.equal(restored.body.state.players[0].id,'race');assert.equal(restored.body.round.status,'open');
}finally{if(child?.exitCode===null)await stop();await rm(dir,{recursive:true,force:true})}
});
