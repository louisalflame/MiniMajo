const {test}=require('node:test'),assert=require('node:assert/strict');
const X=require('../js/expedition.js'),D=require('../js/database.js'),J=require('../js/journey.js'),H=require('../js/hex-map.js'),B=require('../js/battle.js'),S=require('../js/skills.js');
const unit=(id,space=1)=>({...D.defaults[0],id,instanceId:id,space});
const board=(...pairs)=>{const a=Array(10).fill(null);for(const [i,u] of pairs)a[i]=u;return a;};
test('battle repositions wide units and swaps duplicates without merging or losing identities',()=>{
 const a=unit('same',2),b={...a,instanceId:'second'},c=unit('other',3),original=board([0,a],[3,b],[7,c]);
 const shifted=X.reposition(original,0,1);assert.equal(shifted[1],a);assert.equal(shifted[2],null);assert.equal(original[0],a);
 const next=X.reposition(original,0,3);assert.equal(next[3],a);assert.equal(next[0],b);assert.equal(next[7],c);assert.equal(next.filter(Boolean).length,3);assert.equal(a.stars,D.defaults[0].stars);assert.equal(X.valid(next),true);
 assert.throws(()=>X.reposition(original,1,4),/有效/);assert.throws(()=>X.reposition(original,0,10),/有效/);assert.equal(original[0],a);
});
test('journey repositions update owned snapshot, preserve enemy and resources, and reject after start',()=>{
 const s=J.create(undefined,undefined,'prebattle');const id=H.neighbors(s.map.map,s.map.current)[0];s.map.map.cells[id].type='elite';assert.ok(J.move(s,id));
 const before=J.start(s),a=s.roster.active[0],gold=s.roster.gold,enemy=structuredClone(before.loadouts[1]);
 const next=J.reposition(s,0,7);assert.equal(s.roster.active[7],a);assert.equal(s.encounter.allies[7].instanceId,a.instanceId);assert.deepEqual(next.loadouts[1],enemy);assert.equal(s.roster.gold,gold);assert.notEqual(next.token,before.token);
 const stable=structuredClone(s);assert.throws(()=>J.reposition(s,9,2));assert.deepEqual(s,stable);
 const roster=s.roster.active,encounter=s.encounter;s.map.pending=null;assert.throws(()=>J.reposition(s,7,0));assert.equal(s.roster.active,roster);assert.equal(s.encounter,encounter);
 s.encounter.started=true;assert.throws(()=>J.reposition(s,7,0),/開戰前/);
});
test('disabling only the player ultimate leaves the configured enemy ultimate available',()=>{
 const skill={...S.defaults[0],conditions:[],cooldown:1,effects:[]},s=B.create([[unit('ally')],[unit('enemy')]],[skill],[10,10],{allySkillsEnabled:false,enemySkill:skill});
 for(let n=0;n<10;n++)B.step(s);assert.equal(B.canCast(s,0),false);assert.equal(B.canCast(s,1),true);assert.equal(B.cast(s,1),true);
});
test('reposition invalidates a slot-dependent equipped skill without silently replacing it',()=>{
 const first={...S.defaults[0],id:'slot-first',conditions:[{kind:'slot',slot:1,field:'id',value:D.defaults[0].id}]},second={...S.defaults[0],id:'fallback',conditions:[]};
 const s=J.create(undefined,[first,second],'slot-layout');assert.equal(s.roster.skillId,'slot-first');const id=H.neighbors(s.map.map,s.map.current)[0];s.map.map.cells[id].type='battle';J.move(s,id);J.start(s);
 const payload=J.reposition(s,0,7);assert.equal(s.roster.skillId,null);assert.deepEqual(payload.skills,[]);assert.ok(X.eligible(s.roster).some(x=>x.id==='fallback'));
});
