const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../js/battle.js'),E=require('../js/effects.js'),D=require('../js/database.js'),Backup=require('../js/editor-backup.js');
const unit=(space=1,job='守護')=>({...D.defaults[0],space,job,cooldown:120,effects:[]});
const rule=(mode)=>E.validate({targets:[{side:'ally',mode,targetCond:[{field:'job',value:'守護'}]}],actions:[{type:'shield',amount:7}]});
function state(){const a=Array(10).fill(null),b=Array(10).fill(null);a[0]=unit(2);a[3]=unit(1,'支援');a[4]=unit(2);a[6]=unit();a[8]=unit(2);b[0]=unit();return B.create([a,b],[],[10,10],{footprints:true});}
test('side-wide and extreme ally selection applies conditions and excludes caster with footprint-aware gaps',()=>{
 const s=state(),actor=s.teams[0].items[4];
 const expected={allLeft:[0],allRight:[6,8],leftmost:[0],rightmost:[8]};
 for(const [mode,slots] of Object.entries(expected))assert.deepEqual(B.recipients(s,0,actor,rule(mode),null).map(u=>u.slot),slots);
 s.teams[0].items[8].hp=0;assert.deepEqual(B.recipients(s,0,actor,rule('rightmost'),null).map(u=>u.slot),[6]);
 s.teams[0].items[0].hp=0;assert.deepEqual(B.recipients(s,0,actor,rule('allLeft'),null),[]);
});
test('directional targets execute once per wide companion and save independently',()=>{
 const s=state(),actor=s.teams[0].items[4];actor.cooldown=.1;actor.nextAction=1;actor.effects=[rule('allRight')];B.step(s);
 assert.deepEqual(s.teams[0].units.map(u=>u.shield),[0,0,0,7,7]);
 const file=Backup.collect({getItem:()=>null});file.data.characters.items[0].effects=[rule('allLeft')];
 assert.equal(Backup.prepare(file).file.data.characters.items[0].effects[0].targets[0].mode,'allLeft');
 file.data.characters.items[0].effects[0].targets[0].targetCondMode='bad';
 assert.equal(Backup.prepare(file).file.data.characters.items[0].effects[0].targets[0].mode,'allLeft');
 for(const mode of ['allLeft','allRight'])assert.throws(()=>E.selector({side:'enemy',mode}));
 assert.throws(()=>E.validate({type:'swap',targets:[{side:'ally',mode:'allLeft'}]}));
 assert.doesNotThrow(()=>E.validate({type:'swap',targets:[{side:'ally',mode:'rightmost'}]}));
});

test('leftmost and rightmost enemy searches filter before choosing across the whole formation',()=>{
 const s=state(),actor=s.teams[0].items[4],items=s.teams[1].items;
 const enemy=(slot,job)=>({...s.teams[1].units[0],slot,job,space:1,battleId:'1:'+slot});
 items[0].job='支援';items[3]=enemy(3,'守護');items[8]=enemy(8,'守護');
 s.teams[1].units.push(items[3],items[8]);
 for(const [mode,slot] of [['leftmost',3],['rightmost',8]]){
  const effect=rule(mode);effect.targets[0].side='enemy';
  assert.doesNotThrow(()=>E.validate(effect));
  assert.deepEqual(B.recipients(s,0,actor,effect,null).map(u=>u.slot),[slot]);
  const file=Backup.collect({getItem:()=>null});file.data.characters.items[0].effects=[effect];
  assert.equal(Backup.prepare(file).file.data.characters.items[0].effects[0].targets[0].mode,mode);
 }
});
