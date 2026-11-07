const {test}=require('node:test'),assert=require('node:assert/strict');
const J=require('../js/journey.js'),H=require('../js/hex-map.js'),R=require('../js/player-records.js'),D=require('../js/database.js'),L=require('../js/laws.js'),C=require('../js/config.js');
function enter(run,type='battle'){const id=H.neighbors(run.map.map,run.map.current).find(id=>!run.map.cleared.has(id));run.map.map.cells[id].type=type;J.move(run,id);return J.start(run);}
function result(run,payload,winner){return J.settle(run,{token:payload.token,winner,hp:payload.loadouts[0].filter(Boolean).map(u=>winner===1?0:u.maxHp)});}
const record=snapshot=>R.validate({...snapshot,format:'minimajo-team-record',version:1,runId:'test-run',poolVersion:'a'.repeat(32)});
test('only a valid victory yields the final prebattle team and the pre-increment matching level',()=>{
 const run=J.create(),p=enter(run);run.roster.active[0].name='changed after snapshot';
 assert.equal(J.markStarted(run),true);assert.equal(J.markStarted(run),false);run.encounter.allies[0].name='mutated battle copy';
 const settled=result(run,p,0);assert.equal(settled.victorySnapshot.matchLevel,1);assert.equal(run.playerLevel,2);
 assert.notEqual(settled.victorySnapshot.board[0].name,'changed after snapshot');assert.notEqual(settled.victorySnapshot.board[0].name,'mutated battle copy');
 assert.equal(J.settle(run,{token:p.token,winner:0,hp:[]}),null);
 const saved=record(settled.victorySnapshot);assert.equal(saved.category,'normal');assert.ok(saved.board[0].instanceId);
 for(const winner of [1,'draw']){const s=J.create(),p=enter(s);J.markStarted(s);assert.equal(result(s,p,winner).victorySnapshot,undefined);}
});
test('prebattle reposition and preparation replace the saved lineup; snapshots keep duplicate units, laws, and multislots without applying stats twice',()=>{
 const run=J.create();enter(run);const before=run.roster.active[0].instanceId;J.reposition(run,0,4);J.markStarted(run);
 assert.equal(run.encounter.victorySnapshot.board[4].instanceId,before);
 const base=D.atStars(D.validate({version:2,items:[{...D.defaults[0],space:2}]}).items[0],4,C.defaults);
 const law={id:'same-law',name:'法則',shopPrice:1,shopWeight:1,stats:{maxHp:10},passives:[]};
 const unit={...L.attach(base,[law,law],C.defaults),instanceId:'first'};
 const board=Array(10).fill(null);board[0]=unit;board[3]={...structuredClone(unit),instanceId:'second'};
 const value=record({matchLevel:3,category:'elite',board,skill:null});
 assert.equal(value.board[0].maxHp,unit.maxHp);assert.equal(value.board[0].laws.length,2);assert.equal(value.board[0].id,value.board[3].id);assert.equal(value.board[1],null);
 assert.throws(()=>record({...value,board:board.map((u,i)=>i===1?{...unit,instanceId:'third'}:u)}),/重疊/);
});
test('historical opponents only replace elite/boss once and remain locked through loss, preparation and retry',()=>{
 const source=J.create(),sp=enter(source);J.markStarted(source);const saved=record(result(source,sp,0).victorySnapshot);
 for(const type of ['elite','goal']){
  const run=J.create(),id=H.neighbors(run.map.map,run.map.current)[0];run.map.map.cells[id].type=type;J.move(run,id);
  assert.equal(J.lockHistoricalEnemy(run,saved),true);const p=J.start(run);assert.equal(p.enemyName,'旅人殘影');assert.deepEqual(p.loadouts[1],saved.board);
  assert.equal(J.lockHistoricalEnemy(run,saved),false);const prepared=J.prepare(run);assert.deepEqual(prepared.loadouts[1],saved.board);
  J.markStarted(run);result(run,prepared,1);J.move(run,id);const retry=J.start(run);assert.deepEqual(retry.loadouts[1],saved.board);
 }
 const normal=J.create();enter(normal);assert.equal(J.lockHistoricalEnemy(normal,saved),false);
});
