const passive={name:'標靶',race:'人類',affinity:'物理',maxHp:180,cooldown:120,effects:[]};
const assert=require('node:assert/strict');const {test}=require('node:test');const DB=require('../js/database.js');const B=require('../js/battle.js');
const unit=(effects,race='人類',affinity='物理',cooldown=.1)=>({name:'測試角色',race,affinity,cooldown,effects});
const hit=n=>unit([{type:'damage',amount:n}]);
test('v2 validates roundtrip, rejects bad tags/effects and rejects v1 without mutation',()=>{
 const data=DB.validate({version:2,items:DB.defaults});assert.deepEqual(DB.validate(JSON.parse(JSON.stringify(data))),data);
 for(const mutate of [d=>d.version=3,d=>d.items.push(d.items[0]),d=>d.items[0].race='未知',d=>d.items[0].affinity='火',d=>d.items[0].effects[0].amount=-1,d=>d.items[0].cooldown=.15]){const d=structuredClone(data);mutate(d);assert.throws(()=>DB.validate(d));}
 const old={version:1,items:[{...DB.defaults[0]}]};delete old.items[0].race;delete old.items[0].affinity;assert.throws(()=>DB.validate(old));assert.equal(old.items[0].race,undefined);
});
test('shield hits build stagger; knockdown lasts exactly 4 seconds then clears',()=>{
 const s=B.create([[hit(100)],[unit([{type:'shield',amount:1000}])]]);B.step(s);assert.equal(s.teams[1].units[0].hp,180);assert.equal(s.teams[1].units[0].posture,50);B.step(s);assert.equal(s.teams[1].units[0].posture,100);assert.equal(s.teams[1].units[0].weakUntil,42);
 s.teams[0].units.forEach(u=>u.effects=[]);while(s.tick<41)B.step(s);assert.equal(s.teams[1].units[0].posture,100);B.step(s);assert.equal(s.teams[1].units[0].posture,0);assert.equal(s.teams[1].units[0].weakUntil,0);
});
test('knockdown amplifies subsequent damage and cannot be cleared early',()=>{
 const s=B.create([[hit(10)],[unit([{type:'restore',amount:50}])]]);s.teams[1].units[0].weakUntil=40;s.teams[1].units[0].posture=100;B.step(s);assert.equal(s.teams[1].units[0].hp,165);assert.equal(s.teams[1].units[0].posture,100);
});
test('active is manual, unavailable before start, cooldown and reset work',()=>{
 const s=B.create([[unit([], '人類', '物理', 120)],[passive]]);assert.equal(B.cast(s,0),false);s.started=true;assert.equal(B.cast(s,0),false);s.tick=79;assert.equal(B.canCast(s,0),false);B.step(s);assert.equal(B.cast(s,0),true);assert.equal(s.teams[1].units[0].hp,148);assert.equal(B.cast(s,0),false);s.tick=159;assert.equal(B.canCast(s,0),false);B.step(s);assert.equal(B.canCast(s,0),true);assert.equal(B.canCast(B.create([[hit(1)],[null]]),1),false);s.done=true;assert.equal(B.cast(s,0),false);assert.equal(B.create([[hit(1)],[passive]]).teams[0].skillReady,80);
});
test('composition changes skill and race bonus; tie breaks by earliest member',()=>{
 const a=unit([],'機人','魔法'),b=unit([],'獸人','精神');assert.equal(B.skillFor([a,b]).conditions[0].value,'魔法');const skill=B.skillFor([a,b,b]);assert.equal(skill.conditions[0].value,'精神');assert.equal(skill.conditions[1].value,'獸人');assert.equal(skill.effects.at(-1).type,'posture');assert.equal(B.skillFor([]).enabled,false);
});
test('automatic combat never casts player skill, resolves lethal actions in initiative order, escalating overtime',()=>{
 let s=B.create([[hit(180)],[hit(180)]]);const initialSkillReady=s.teams[0].skillReady;B.step(s);assert.equal(s.winner,1);assert.equal(s.teams[0].units[0].stats.actions,0);assert.equal(s.teams[0].skillReady,initialSkillReady);const snap=JSON.stringify(s);B.step(s);assert.equal(JSON.stringify(s),snap);
 s=B.create([[passive],[passive]]);while(!s.done)B.step(s);assert.equal(s.tick,1340);assert.equal(s.winner,'draw');
});
test('damage and recovery effects compose; battle uses copied character data',()=>{
 const char=unit([{type:'heal',amount:50},{type:'restore',amount:35},{type:'damage',amount:7}]);const s=B.create([[char],[passive]]);char.effects[2].amount=99;s.teams[0].units[0].hp=170;s.teams[0].units[0].posture=50;B.step(s);assert.equal(s.teams[0].units[0].hp,180);assert.equal(s.teams[0].units[0].posture,15);assert.equal(s.teams[1].units[0].hp,173);
});
