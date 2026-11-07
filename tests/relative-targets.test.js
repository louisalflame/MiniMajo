const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../js/battle.js'),D=require('../js/database.js'),E=require('../js/effects.js'),Backup=require('../js/editor-backup.js'),Status=require('../js/statuses.js');
const unit=(extra={})=>({...D.defaults[0],maxHp:1000,attack:20,attackRange:1,cooldown:120,effects:[],passives:[],...extra});
const group=(mode,amount,base)=>E.validate({targets:[{side:'enemy',mode,...(base?{base}:{})}],actions:[{type:'damage',amount}]});
function setup(space=2,hp=1000,mode='neighbors'){
 const a=Array(10).fill(null),b=Array(10).fill(null);
 a[3]=unit({cooldown:.1,effects:[E.validate({targets:[{side:'enemy',mode:'lowestHp'}],actions:[{type:'damage',amount:{multiplier:1.5}}]}),group(mode,{multiplier:.5},'main')]});
 b[1]=unit({space:2});b[3]=unit({space,maxHp:hp});b[3+space]=unit();
 return B.create([a,b],[],[10,10],{footprints:true});
}
test('A hits selected target, B hits edges of two/three-cell targets beyond actor range',()=>{
 for(const width of [2,3]){const s=setup(width,900);B.step(s);assert.deepEqual(s.teams[1].units.map(u=>u.hp),[990,870,990]);}
});
test('lethal main hit keeps original footprint and does not retarget the splash',()=>{
 const s=setup(3,20);B.step(s);assert.deepEqual(s.teams[1].units.map(u=>u.hp),[990,0,990]);
});
test('gaps are not crossed and one missing neighbor does not suppress the other',()=>{
 const s=setup(2,900);const left=s.teams[1].items[1];s.teams[1].items[1]=null;s.teams[1].items[0]=left;left.slot=0;B.step(s);assert.deepEqual(s.teams[1].units.map(u=>u.hp),[1000,870,990]);
});
test('relative variants include only their designated recipients',()=>{
 for(const [mode,hp] of Object.entries({target:[1000,860,1000],left:[990,870,1000],right:[1000,870,990],targetNeighbors:[990,860,990]})){const s=setup(2,900,mode);B.step(s);assert.deepEqual(s.teams[1].units.map(u=>u.hp),hp);}
});
test('multiple main targets union neighbor results and apply only once',()=>{
 const s=setup(2,900);s.teams[0].units[0].effects=[group('all',0),group('targetNeighbors',10,'main')];B.step(s);assert.deepEqual(s.teams[1].units.map(u=>u.hp),[990,890,990]);
});
test('counter kill aborts splash and subsequent actions do not reuse anchors',()=>{
 const s=setup(2,900);s.teams[0].units[0].hp=10;Status.apply(s.teams[1].units[1],{status:'counter',duration:{kind:'permanent'}},20,0);B.step(s);assert.equal(s.teams[0].units[0].hp,0);assert.equal(s.teams[1].units[0].hp,1000);assert.equal(s.teams[1].units[2].hp,1000);
 const fresh=setup(2,900);fresh.teams[0].units[0].effects=[group('neighbors',10,'main')];B.step(fresh);assert.deepEqual(fresh.teams[1].units.map(u=>u.hp),[1000,900,1000]);
});
test('relative targets preserve conditions, validate basis and repair fields independently',()=>{
 const e=group('neighbors',{multiplier:.5},'main');e.targets[0].targetCond=[{field:'injured',op:'eq',value:false}];
 const file=Backup.collect({getItem:()=>null});file.data.characters.items[0].effects=[e];assert.deepEqual(Backup.prepare(file).file.data.characters.items[0].effects,[e]);
 file.data.characters.items[0].effects[0].targets[0].targetCondMode='bad';const before=structuredClone(file),result=Backup.prepare(file),saved=result.file.data.characters.items[0].effects[0];assert.equal(saved.targets[0].base,'main');assert.equal(saved.targets[0].mode,'neighbors');assert.equal(saved.targets[0].targetCondMode,'all');assert.equal(saved.targets[0].targetCond[0].value,false);assert.deepEqual(file,before);assert.ok(result.warnings.length);
 assert.throws(()=>E.selector({side:'enemy',mode:'neighbors',base:'bad'}));assert.throws(()=>E.movement({side:'enemy',mode:'neighbors',base:'main'}));assert.throws(()=>E.selector({side:'enemy',mode:'neighbors',base:'main'},'jump'));
});

test('manual skills and passives each keep their own main-target context',()=>{
 const effects=[group('lowestHp',30),group('neighbors',10,'main')];
 const s=setup(2,900);s.teams[0].units[0].effects=[];s.skillDefinitions=[{id:'relative',name:'波及',mode:'all',conditions:[],cooldown:1,effects}];s.teams[0].skill={...s.skillDefinitions[0],enabled:true};s.started=true;assert.equal(B.cast(s,0),true);assert.deepEqual(s.teams[1].units.map(u=>u.hp),[990,870,990]);
 const passive=setup(2,900);passive.teams[0].units[0].effects=[];passive.teams[0].units[0].passives=[{when:'action',subject:{relation:'self',conditions:[]},effects}];B.step(passive);assert.deepEqual(passive.teams[1].units.map(u=>u.hp),[990,870,990]);
});

