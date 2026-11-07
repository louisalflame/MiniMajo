const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {DatabaseSync}=require('node:sqlite'),{handle}=require('../server/player-record-api.cjs'),R=require('../js/player-records.js'),J=require('../js/journey.js'),T=require('../js/statuses.js');
const pool='a'.repeat(32);
function setup(){
 const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync('migrations/0001_player_teams.sql','utf8'));
 const env={DB:{prepare(sql){const statement=db.prepare(sql);return {bind(...args){return {first:async()=>statement.get(...args)??null,run:async()=>statement.run(...args)};},first:async()=>statement.get()??null};}},ASSETS:{fetch:async()=>Response.json({poolVersion:pool,statuses:T.snapshot()})}};
 const call=(method,path='/api/player-teams',body)=>handle({env,request:new Request('https://game.test'+path,{method,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})})});
 return {db,env,call};
}
function sample(runId='source',matchLevel=5){const s=J.create();return R.validate({format:'minimajo-team-record',version:1,poolVersion:pool,runId,matchLevel,category:'normal',board:s.roster.active,skill:s.roster.skills.find(x=>x.id===s.roster.skillId)??null});}
const query=(level,runId='viewer',category='elite',poolVersion=pool)=>'/api/player-teams?'+new URLSearchParams({level,runId,category,poolVersion});
test('D1 writes are idempotent, shared victory pools match exact then nearest within two, lower ties, self-exclusion and disabled entries',async()=>{
 const {db,call}=setup();try{
  assert.equal((await call('GET','/api/health')).status,200);
  const a=sample('lower',4),b=sample('upper',6);await call('POST',undefined,a);await call('POST',undefined,a);await call('POST',undefined,b);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM player_teams').get().n,2);
  let value=await (await call('GET',query(5))).json();assert.equal(value.record.matchLevel,4);
  await call('POST',undefined,sample('exact',5));value=await(await call('GET',query(5))).json();assert.equal(value.record.matchLevel,5);
  value=await(await call('GET',query(5,'exact','boss'))).json();assert.equal(value.record.matchLevel,4);assert.equal(value.record.category,'normal');
  db.prepare('UPDATE player_teams SET enabled=0 WHERE run_id=?').run('lower');value=await(await call('GET',query(5,'exact'))).json();assert.equal(value.record.matchLevel,6);
  assert.equal((await(await call('GET',query(20))).json()).record,null);assert.equal((await call('GET',query(5,'viewer','normal'))).status,400);
  assert.equal((await(await call('GET',query(5,'viewer','elite','b'.repeat(32)))).json()).record,null);
  assert.equal((await call('POST',undefined,{...a,poolVersion:'b'.repeat(32)})).status,409);
  db.prepare('UPDATE player_teams SET snapshot_json=?').run('{broken');assert.equal((await(await call('GET',query(5))).json()).record,null);
 }finally{db.close();}
});
test('malformed, overlapping, duplicate-instance, oversized or foreign writes preserve stored records; missing D1 is a service error',async()=>{
 const {db,env,call}=setup();try{
  const a=sample();for(const board of [[...a.board,...[null]],a.board.map((u,i)=>i===1?{...a.board[0]}:u)])assert.equal((await call('POST',undefined,{...a,board})).status,422);
  assert.equal((await call('POST',undefined,null)).status,422);
  const large=new Request('https://game.test/api/player-teams',{method:'POST',headers:{'Content-Type':'application/json'},body:' '.repeat(R.maxBytes+1)});
  assert.equal((await handle({env,request:large})).status,413);
  const foreign=new Request('https://game.test/api/player-teams',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://other.test'},body:JSON.stringify(a)});assert.equal((await handle({env,request:foreign})).status,403);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM player_teams').get().n,0);
  assert.equal((await handle({env:{},request:new Request('https://game.test/api/health')})).status,503);
 }finally{db.close();}
});
