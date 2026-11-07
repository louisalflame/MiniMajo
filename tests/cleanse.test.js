const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../js/battle.js'),D=require('../js/database.js'),E=require('../js/effects.js'),S=require('../js/statuses.js'),Backup=require('../js/editor-backup.js');

const cleanse={type:'cleanse'};
const unit=(extra={})=>({...D.defaults[0],maxHp:500,cooldown:120,effects:[],passives:[],...extra});
const group=(mode,actions)=>E.validate({targets:[{side:'ally',mode}],actions});
const apply=(unit,status,tick)=>S.apply(unit,{status,duration:{kind:'seconds',value:10}},1,tick);

test('heal and cleanse stay on the same target and remove the oldest currently applied negative status',()=>{
 const effect=group('lowestHp',[{type:'heal',amount:50},cleanse]);
 const s=B.create([[unit({cooldown:.3,effects:[effect]}),unit(),unit()],[unit()]],[],[10,10]);
 const [,target,other]=s.teams[0].units;
 target.hp=300;other.hp=325;
 apply(target,'poison',0);
 apply(target,'weakness',1);
 apply(target,'power',0);
 apply(other,'stun',0);
 B.step(s);
 B.step(s);
 apply(target,'poison',s.tick);
 B.step(s);
 assert.equal(target.hp,350);
 assert.deepEqual(target.statuses.map(x=>x.kind),['power','poison']);
 assert.deepEqual(other.statuses.map(x=>x.kind),['stun']);
 assert.ok(s.events.some(e=>e.detail.includes('解除 虛弱')));
});

test('cleanse without a negative status still allows later effects and survives backup repair',()=>{
 const effect=group('self',[cleanse]);
 const shield=group('self',[{type:'shield',amount:7}]);
 const s=B.create([[unit({cooldown:.1,effects:[effect,shield]})],[unit()]]);
 const actor=s.teams[0].units[0];
 apply(actor,'regen',0);
 B.step(s);
 assert.equal(actor.shield,7);
 assert.equal(S.has(actor,'regen'),true);
 const file=Backup.collect({getItem:()=>null});
 file.data.characters.items[0].effects=[effect];
 assert.deepEqual(Backup.prepare(file).file.data.characters.items[0].effects,[effect]);
 file.data.characters.items[0].effects[0].targets[0].range='invalid';
 const repaired=Backup.prepare(file).file.data.characters.items[0].effects[0];
 assert.deepEqual(repaired.actions,[cleanse]);
 assert.match(E.describe(effect),/解除 1 個負面狀態/);
});
