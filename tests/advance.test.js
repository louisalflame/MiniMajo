const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../js/battle.js'),E=require('../js/effects.js'),D=require('../js/database.js'),L=require('../js/laws.js'),S=require('../js/statuses.js'),Backup=require('../js/editor-backup.js');
const unit=(extra={})=>({...D.defaults[0],maxHp:1000,cooldown:10,effects:[],...extra});
const advance=(amount,targets=[{side:'ally',mode:'self'}])=>E.validate({targets,actions:[{type:'advance',amount}]});
function cast(amount){const skill={id:'advance',name:'加快',mode:'all',conditions:[],cooldown:10,effects:[advance(amount)]},s=B.create([[unit()],[unit()]],[skill]);s.started=true;s.teams[0].skillReady=0;assert.equal(B.cast(s,0),true);return s;}
test('advance shifts target action by tenths of a second without changing other timers',()=>{
 const s=cast(2.5);assert.equal(s.teams[0].units[0].nextAction,75);assert.equal(s.teams[1].units[0].nextAction,100);assert.equal(s.teams[0].units[0].cooldown,10);assert.equal(s.tick,0);assert.equal(s.teams[0].skillReady,100);
 for(let n=0;n<74;n++)B.step(s);assert.equal(s.teams[0].units[0].stats.actions,0);B.step(s);assert.equal(s.teams[0].units[0].stats.actions,1);assert.equal(s.teams[0].units[0].nextAction,175);
});
test('advance caps at ready and does not recursively execute actions',()=>{
 const s=cast(10000);assert.equal(s.teams[0].units[0].nextAction,0);assert.equal(s.teams[0].units[0].stats.actions,0);B.step(s);assert.equal(s.teams[0].units[0].stats.actions,1);
 const self=B.create([[unit({cooldown:.1,effects:[advance(10000)]})],[unit()]]);B.step(self);assert.equal(self.teams[0].units[0].stats.actions,1);B.step(self);assert.equal(self.teams[0].units[0].stats.actions,2);
});
test('advance targets deduplicate, conditions apply and stun still prevents action',()=>{
 const target={side:'ally',mode:'all'},effect=advance(1,[target,target]),s=B.create([[unit({cooldown:.1,effects:[effect]}),unit()],[unit()]]);S.apply(s.teams[0].units[1],{status:'stun',duration:{kind:'seconds',value:5}},1,0);B.step(s);assert.equal(s.teams[0].units[1].nextAction,91);assert.equal(s.teams[0].units[1].stats.actions,0);
 s.teams[0].units[0].effects[0].cond=[{subject:'self',field:'injured',value:true}];B.step(s);assert.equal(s.teams[0].units[1].nextAction,92);
});
test('advance is valid in law passives and complete backups with per-field repairs',()=>{
 const effect=advance(.1),laws=L.validate([{id:'quick',name:'加快',shopPrice:0,shopWeight:0,stats:{},passives:[{when:'action',effects:[effect]}]}]),s=B.create([[unit({cooldown:.1,laws})],[unit()]]);B.step(s);assert.equal(s.teams[0].units[0].nextAction,1);
 const file=Backup.collect({getItem:()=>null});file.data.characters.items[0].effects=[effect];assert.deepEqual(Backup.prepare(file).file.data.characters.items[0].effects,[effect]);file.data.characters.items[0].effects[0].actions[0].amount='bad';const prepared=Backup.prepare(file);assert.equal(prepared.file.data.characters.items[0].effects[0].actions[0].type,'advance');assert.equal(prepared.file.data.characters.items[0].effects[0].actions[0].amount,1);assert.ok(prepared.warnings.some(w=>w.includes('actions[0].amount')));
});
test('advance accepts zero and tenths, rejects other amount types and limits',()=>{
 for(const n of [0,.1,2.5,10000])assert.equal(advance(n).actions[0].amount,n);for(const n of [-1,.01,10001,NaN,Infinity,'2',{formula:'2'}])assert.throws(()=>advance(n));assert.match(E.describe(advance(2.5)),/直接加快時間 2.5 秒/);
});
