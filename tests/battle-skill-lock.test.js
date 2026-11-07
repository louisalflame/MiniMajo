const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../js/battle.js');
const unit=race=>({name:race,race,affinity:'物理',space:1,maxHp:100,cooldown:120,effects:[]});
const skill={id:'locked',name:'編隊極式',cooldown:1,mode:'all',conditions:[{kind:'slot',slot:1,field:'race',value:'人類'},{kind:'count',field:'race',value:'人類',op:'gte',count:1}],effects:[{type:'shield',amount:7}]};

for(const team of [0,1])test(`team ${team} retains its skill and charge after the qualifying caster dies`,()=>{
 const s=B.create([[unit('人類'),unit('機人')],[unit('人類'),unit('機人')]],[skill],[10,10],{enemySkill:skill});
 const t=s.teams[team],equipped=t.skill,ready=t.skillReady;
 B.step(s);t.units[0].hp=0;B.step(s);
 assert.equal(B.skillFor(t.items.map(u=>u?.hp>0?u:null),[skill]).enabled,false);
 assert.equal(t.skill,equipped);assert.equal(t.skillReady,ready);
 while(s.tick<ready)B.step(s);
 assert.equal(B.cast(s,team),true);assert.equal(t.units[1].shield,7);
 assert.equal(t.skill,equipped);assert.equal(t.skillReady,s.tick+10);
 t.units[1].hp=0;B.step(s);assert.equal(B.canCast(s,team),false);
});

test('battle swaps retain the opening skill; a new battle checks the new formation',()=>{
 const formation=[unit('人類'),unit('機人')],s=B.create([formation,[unit('人類')]],[skill],[10,10],{footprints:true});
 const t=s.teams[0],equipped=t.skill;B.step(s);
 assert.equal(B.swap(s,0,t.units[0],t.units[1]),true);B.step(s);
 assert.equal(B.skillFor(t.items,[skill]).enabled,false);assert.equal(t.skill,equipped);
 assert.equal(B.create([t.items,[unit('人類')]],[skill],[10,10],{footprints:true}).teams[0].skill.enabled,false);
 while(s.tick<10)B.step(s);assert.equal(B.cast(s,0),true);
});
