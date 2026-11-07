const {test}=require('node:test'),assert=require('node:assert/strict');
const {createTransport,create,outboxKey}=require('../js/record-client.js'),J=require('../js/journey.js');
const pool='a'.repeat(32),s=J.create(),snapshot={matchLevel:3,category:'elite',board:s.roster.active,skill:null};
function storage(){const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};}
test('failed victory uploads survive page navigation, deduplicate and flush without blocking; quota errors retain an in-memory queue',async()=>{
 const store=storage();let online=false,calls=0;
 const fetch=async()=>{calls++;return new Response('',{status:online?200:503});};
 const t=createTransport({fetch,storage:store}),client=create({poolVersion:pool,runId:'first',transport:t});await client.submit(snapshot);await client.submit(snapshot);
 assert.equal(JSON.parse(store.getItem(outboxKey)).length,1);online=true;await createTransport({fetch,storage:store}).flush();assert.equal(JSON.parse(store.getItem(outboxKey)).length,0);assert.equal(calls,3);
 const bad={getItem:()=>null,setItem(){throw Error('quota');}},m=createTransport({fetch,storage:bad});online=false;await create({poolVersion:pool,runId:'second',transport:m}).submit(snapshot);online=true;const before=calls;await m.flush();assert.equal(calls,before+1);
 store.setItem(outboxKey,JSON.stringify([null,false,{},'broken']));const count=calls;await createTransport({fetch,storage:store}).flush();assert.equal(calls,count);
});
test('only elite/boss query records, and invalid/self/incompatible responses fall back; timeout aborts',async()=>{
 let calls=0,value={...snapshot,format:'minimajo-team-record',version:1,poolVersion:pool,runId:'other'};
 const transport=createTransport({fetch:async()=>{calls++;return Response.json({record:value});}}),client=create({poolVersion:pool,runId:'self',transport});
 assert.equal(await client.pick('normal',3),null);assert.equal(calls,0);assert.equal((await client.pick('elite',3)).matchLevel,3);
 value.runId='self';assert.equal(await client.pick('boss',3),null);value.runId='other';value.matchLevel=10;assert.equal(await client.pick('elite',3),null);
 const slow=createTransport({timeout:10,fetch:(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('timeout'))))});await assert.rejects(slow.request('/api/player-teams'),/timeout/);
});
