const {test}=require('node:test');const assert=require('node:assert/strict');const B=require('../js/battle.js');const D=require('../js/database.js');const E=require('../js/effects.js');
const unit=(name,effects=[],extra={})=>({...D.defaults[0],name,cooldown:.1,maxHp:100,moveDistance:1,effects,...extra});
test('opposite target, independent HP and shield, all-dead victory',()=>{
 const s=B.create([[unit('A',[{type:'damage',amount:100}]),unit('B')],[unit('X'),unit('Y')]]);B.step(s);assert.equal(s.teams[1].units[0].hp,0);assert.equal(s.teams[1].units[1].hp,100);assert.equal(s.done,false);assert.equal(s.teams[0].units[0].hp,100);
});
test('nearest surviving target and left/right tie randomness; range limits',()=>{
 const s=B.create([[null,unit('A'),null],[unit('L'),unit('dead'),unit('R')]]);s.teams[1].items[1].hp=0;const a=s.teams[0].items[1];assert.equal(B.target(s,0,a,1),null);s.random=()=>0;assert.equal(B.target(s,0,a,2).name,'L');s.random=()=>.99;assert.equal(B.target(s,0,a,2).name,'R');
});
test('movement consumes action, cannot cross allies, next action attacks from new position',()=>{
 const a=unit('A',[{type:'damage',amount:10}],{moveDistance:2});const s=B.create([[a,null,null],[null,null,unit('X')]]);B.step(s);assert.equal(s.teams[0].units[0].slot,2);assert.equal(s.teams[1].units[0].hp,100);B.step(s);assert.equal(s.teams[1].units[0].hp,90);
 const blocked=B.create([[a,unit('wall'),null],[null,null,unit('X')]]);B.step(blocked);assert.equal(blocked.teams[0].units[0].slot,0);assert.equal(blocked.teams[1].units[0].hp,100);
});
test('dead units stop acting; first lethal cancels the later action; empty teams lose',()=>{
 let s=B.create([[unit('A',[{type:'damage',amount:100}])],[unit('B',[{type:'damage',amount:100}])]]);B.step(s);assert.equal(s.winner,1);assert.equal(s.teams[0].units[0].hp,0);assert.equal(s.teams[1].units[0].hp,100);const tick=s.tick;B.step(s);assert.equal(s.tick,tick);
 s=B.create([[unit('A')],[null]]);B.step(s);assert.equal(s.winner,0);
});
test('self support stays on actor and target-relative formulas use individual max HP',()=>{
 const s=B.create([[unit('A',[{type:'shield',amount:20},{type:'damage',amount:{formula:'enemy.maxHp * 0.1 + self.shield'}}]),unit('ally')],[unit('X',[],{maxHp:200}),unit('Y')]]);B.step(s);assert.equal(s.teams[0].units[0].shield,20);assert.equal(s.teams[0].units[1].shield,0);assert.equal(s.teams[1].units[0].hp,160);
});
test('current fields validate and persist; action effects share target',()=>{
 const x=D.validate({version:2,items:[{...D.defaults[0],effects:[{type:'damage',amount:5,range:2}]}]}).items[0];assert.equal(x.maxHp,180);assert.equal(x.moveDistance,1);assert.equal(x.effects[0].range,2);assert.throws(()=>E.validate({type:'damage',amount:1,range:0}));assert.throws(()=>D.validate({version:2,items:[{...x,moveDistance:3}]}));
 const s=B.create([[null,unit('A',[{type:'damage',amount:5,range:2},{type:'damage',amount:5,range:2}],{attackRange:2}),null],[unit('L'),null,unit('R')]]);let n=0;s.random=()=>n++%2?0:.99;B.step(s);assert.equal(s.teams[1].units[0].hp,100);assert.equal(s.teams[1].units[1].hp,90);
});
