const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../js/battle.js'),S=require('../js/statuses.js');
const member=(effects=[])=>({id:'same',name:'同名',space:1,maxHp:100,cooldown:.1,effects});
test('battle stats distinguish duplicate characters and keep every effect beyond the short log',()=>{
 const s=B.create([[member(Array.from({length:20},()=>({type:'damage',amount:1}))),member([{type:'shield',amount:5}])],[member()]],[],[3,3]);B.step(s);
 assert.equal(s.teams[0].units[0].stats.damage,20);assert.equal(s.teams[0].units[1].stats.shield,5);assert.equal(s.feedback.length,21);assert.equal(s.events.length,12);assert.notEqual(s.teams[0].units[0].battleId,s.teams[0].units[1].battleId);assert.equal(s.teams[0].units[0].stats.actions,1);
});
test('periodic poison and regen retain separate feedback and credit their original caster',()=>{
 const effect=status=>({type:'status',status,target:'enemy',duration:{kind:'permanent'},amount:10});const s=B.create([[member([effect('poison'),effect('regen')])],[member()]],[]);B.step(s);s.teams[0].units[0].effects=[];s.feedback=[];for(let i=0;i<10;i++)B.step(s);
 const source=s.teams[0].units[0],target=s.teams[1].units[0];assert.equal(target.hp,100);assert.equal(source.stats.damage,10);assert.equal(source.stats.heal,10);assert.deepEqual(s.feedback.map(x=>[x.type,x.amount]),[['damage',10],['heal',10]]);
});
test('counter damage credits reflector with knockdown multiplier; overtime credits no character',()=>{
 const s=B.create([[member([{type:'damage',amount:1}])],[member()]],[],[3,3],{config:{...require('../js/config.js').defaults,battleSeconds:1,overtimeDamage:1,overtimeInterval:1}});const a=s.teams[0].units[0],b=s.teams[1].units[0];a.weakUntil=100;S.apply(b,{status:'counter',duration:{kind:'permanent'}},10,0);B.step(s);B.step(s);assert.equal(b.stats.damage,15);a.effects=[];for(let i=0;i<19;i++)B.step(s);assert.equal(b.stats.damage,15);assert.equal(a.stats.damage,1);assert.ok(s.feedback.some(x=>x.type==='damage'&&x.amount===15&&x.target===a.battleId));
});
