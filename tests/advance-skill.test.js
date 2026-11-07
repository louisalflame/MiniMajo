const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../js/battle.js'),E=require('../js/effects.js'),D=require('../js/database.js'),Backup=require('../js/editor-backup.js');
const unit=extra=>({...D.defaults[0],maxHp:1000,cooldown:120,effects:[],passives:[],...extra});
const advanceSkill=(amount,targets=[{side:'ally',mode:'self'}])=>E.validate({targets,actions:[{type:'advanceSkill',amount}]});
const skill=effects=>({id:'skill',name:'測試技能',cooldown:10,mode:'all',conditions:[],effects});

test('skill advancement shifts opening charge once per team even with many recipients',()=>{
 const effect=advanceSkill(2.5,[{side:'ally',mode:'all'},{side:'ally',mode:'all'}]);
 const s=B.create([[unit({cooldown:.1,effects:[effect]}),unit()],[unit()]],[skill([])]);
 assert.equal(s.teams[0].skillReady,100);
 const before=s.teams[0].units[1].nextAction;
 B.step(s);
 assert.equal(s.teams[0].skillReady,75);
 assert.equal(s.teams[0].units[1].nextAction,before);
 assert.equal(B.canCast(s,0),false);
 assert.equal(s.events.filter(e=>e.type==='advanceSkill').length,1);
});

test('skill advancement caps at ready and still requires a manual cast',()=>{
 const s=B.create([[unit({cooldown:.1,effects:[advanceSkill(10000)]})],[unit()]],[skill([])]);
 B.step(s);
 assert.equal(s.teams[0].skillReady,s.tick);
 assert.equal(B.canCast(s,0),true);
 assert.equal(B.cast(s,0),true);
 assert.equal(s.teams[0].skillReady,s.tick+100);
});

test('skill effects and passive effects can advance the shared cooldown',()=>{
 const e=advanceSkill(2.5);
 const manual=B.create([[unit()],[unit()]],[skill([e])]);
 manual.started=true;manual.teams[0].skillReady=0;
 assert.equal(B.cast(manual,0),true);
 assert.equal(manual.teams[0].skillReady,75);
 const p={when:'action',subject:{relation:'self',conditions:[]},effects:[e]};
 const passive=B.create([[unit({cooldown:.1,passives:[p]})],[unit()]],[skill([])]);
 B.step(passive);
 assert.equal(passive.teams[0].skillReady,75);
});

test('disabled or absent skills cannot be advanced',()=>{
 for(const [skills,options] of [[[],{}],[[skill([])],{activeSkillsEnabled:false}]]){
  const s=B.create([[unit({cooldown:.1,effects:[advanceSkill(2.5)]})],[unit()]],skills,[10,10],options);
  B.step(s);
  assert.equal(s.teams[0].skillReady,0);
  assert.equal(s.events.some(e=>e.type==='advanceSkill'),false);
 }
});

test('skill seconds validate, survive backup and repair independently',()=>{
 for(const amount of [0,.1,2.5,10000])assert.equal(advanceSkill(amount).actions[0].amount,amount);
 for(const amount of [-1,.01,10001,'2',{formula:'2'}])assert.throws(()=>advanceSkill(amount));
 const e=advanceSkill(.1),file=Backup.collect({getItem:()=>null});
 file.data.characters.items[0].effects=[structuredClone(e)];
 assert.deepEqual(Backup.prepare(file).file.data.characters.items[0].effects,[e]);
 file.data.characters.items[0].effects[0].actions[0].amount='bad';
 const original=structuredClone(file),fixed=Backup.prepare(file);
 assert.deepEqual(fixed.file.data.characters.items[0].effects[0].actions[0],{type:'advanceSkill',amount:1});
 assert.ok(fixed.warnings.some(w=>w.includes('amount')));
 assert.deepEqual(file,original);
 assert.match(E.describe(e),/加快主動技能時間 0.1 秒/);
});

