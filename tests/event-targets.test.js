const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../js/battle.js'),D=require('../js/database.js'),E=require('../js/effects.js'),L=require('../js/laws.js'),Backup=require('../js/editor-backup.js');
const unit=(extra={})=>({...D.defaults[0],maxHp:1000,cooldown:120,attackRange:1,effects:[],passives:[],...extra});
const effect=(base='event',mode='target',side='enemy',amount=30)=>E.validate({targets:[{base,mode,side}],actions:[{type:'damage',amount}]});
const passive=(when='healed',effects=[effect()])=>({when,subject:{relation:'enemy',conditions:[]},effects});
function setup(p=passive(),law=false){
 const a=Array(10).fill(null),b=Array(10).fill(null);a[0]=unit(law?{laws:L.validate([{id:'react',name:'反應',shopPrice:0,shopWeight:0,stats:{},passives:[p]}])}:{passives:[p]});
 b[0]=unit({cooldown:.1,effects:[E.validate({targets:[{side:'ally',mode:'lowestHp'}],actions:[{type:'heal',amount:20}]})]});b[5]=unit();
 const s=B.create([a,b],[],[10,10],{footprints:true});s.teams[1].items[5].hp=500;return s;
}
test('healed enemy is the exact event target even when a nearer duplicate exists',()=>{
 for(const law of [false,true]){const s=setup(passive(),law);B.step(s);assert.equal(s.teams[1].items[5].hp,490);assert.equal(s.teams[1].items[0].hp,1000);}
});
test('heal and healed distinguish the healer from the healing recipient',()=>{
 const s=setup(passive('heal'));B.step(s);assert.equal(s.teams[1].items[0].hp,970);assert.equal(s.teams[1].items[5].hp,520);
});
test('event footprint splash supports wide units, gaps and retained dead target location',()=>{
 const s=setup(passive('healed',[effect('event','neighbors')]));s.teams[1].items[5].space=3;
 for(const slot of [4,8]){const u={...structuredClone(s.teams[1].items[5]),slot,battleId:'1:'+slot,space:1,hp:1000,maxHp:1000};s.teams[1].items[slot]=u;s.teams[1].units.push(u);}
 B.step(s);assert.equal(s.teams[1].items[4].hp,970);assert.equal(s.teams[1].items[8].hp,970);assert.equal(s.teams[1].items[5].hp,520);
 const death=setup(passive('death',[effect('event','neighbors')]));death.teams[1].items[5].hp=1;death.teams[1].items[0].effects=[];
 death.teams[0].items[0].cooldown=.1;death.teams[0].items[0].nextAction=1;death.teams[0].items[0].effects=[E.validate({targets:[{side:'enemy',mode:'lowestHp'}],actions:[{type:'damage',amount:10}]})];
 const n={...structuredClone(death.teams[1].items[0]),slot:6,battleId:'1:6'};death.teams[1].items[6]=n;death.teams[1].units.push(n);B.step(death);assert.equal(n.hp,970);
});
test('event identity remains fixed through secondary effects and nested events',()=>{
 const s=setup(passive('healed',[effect('event','target','enemy',600),effect('event','target','enemy',30)]));
 // Another death passive generates a nested event while the healed passive is resolving.
 s.teams[0].items[0].passives.push(passive('death',[E.validate({targets:[{base:'event',side:'enemy',mode:'neighbors'}],actions:[{type:'shield',amount:7}]})]));
 B.step(s);assert.equal(s.teams[1].items[5].hp,0);assert.equal(s.teams[1].items[0].hp,1000);
});
test('event searches honor side and conditions, and do not fall back outside passives',()=>{
 for(const t of [{base:'event',mode:'target',side:'ally'},{base:'event',mode:'target',side:'enemy',targetCond:[{field:'hp',op:'gt',value:900}]}]){const e=E.validate({targets:[t],actions:[{type:'damage',amount:30}]}),s=setup(passive('healed',[e]));B.step(s);assert.equal(s.teams[1].items[5].hp,520);assert.equal(s.teams[1].items[0].hp,1000);}
 const s=setup();s.teams[0].items[0].passives=[];s.teams[1].items[0].effects=[effect()];B.step(s);assert.equal(s.teams[0].items[0].hp,1000);
});
test('saved event searches roundtrip and repair only invalid nested fields',()=>{
 const file=Backup.collect({getItem:()=>null});file.data.characters.items[0].passives=[passive()];
 const saved=Backup.prepare(file).file.data.characters.items[0].passives[0];assert.equal(saved.effects[0].targets[0].base,'event');assert.match(E.describe(saved.effects[0]),/本次事件角色/);
 file.data.characters.items[0].passives[0].effects[0].targets[0].targetCondMode='invalid';const original=structuredClone(file),prepared=Backup.prepare(file),t=prepared.file.data.characters.items[0].passives[0].effects[0].targets[0];assert.equal(t.base,'event');assert.equal(t.mode,'target');assert.equal(t.targetCondMode,'all');assert.deepEqual(file,original);assert.ok(prepared.warnings.length);
 for(const type of ['jump','swap'])assert.throws(()=>E.selector({base:'event',mode:'target',side:'enemy'},type));assert.throws(()=>E.movement({base:'event',mode:'target',side:'enemy'}));
});
