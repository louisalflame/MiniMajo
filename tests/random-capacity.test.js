const passive={name:'標靶',race:'人類',affinity:'物理',maxHp:180,cooldown:120,effects:[]};
const {test}=require('node:test');const assert=require('node:assert/strict');const E=require('../js/effects.js');const F=require('../js/formula.js');const B=require('../js/battle.js');const D=require('../js/database.js');
test('inclusive integer random bounds, fixed ranges, nested formula and malformed bounds',()=>{
 assert.equal(E.calculate('rand(5,15)',{},()=>0),5);assert.equal(E.calculate('rand(5,15)',{},()=>.999999),15);assert.equal(E.calculate('rand(7,7)',{},()=>.8),7);
 const f='rand(5,15)*2+rand(0,4)';assert.equal(E.calculate(F.serialize(F.parse(f)),{},()=>.5),22);
 for(const f of ['rand(15,5)','rand(-1,5)','rand(1.5,5)','rand(1,10001)','rand(1)','rand(,2)'])assert.throws(()=>E.validate({type:'damage',amount:{formula:f}}));
});
test('each triggered effect rolls at runtime; previews do not consume randomness',()=>{
 const unit={...D.defaults[0],cooldown:.1,effects:[{type:'damage',amount:{formula:'rand(5,15)'}}]};const s=B.create([[unit],[passive]]);let calls=0;s.random=()=>calls++===0?0:.99999;
 B.step(s);assert.equal(s.teams[1].units[0].hp,175);B.step(s);assert.equal(s.teams[1].units[0].hp,160);assert.equal(calls,2);assert.deepEqual(unit.effects[0].amount,{formula:'rand(5,15)'});
});
test('required space validation, exact limit and duplicate-character costs',()=>{
 const old={...D.defaults[0]};delete old.space;assert.throws(()=>D.validate({version:2,items:[old]}));
 for(const space of [0,-1,1.5,100,'2',null])assert.throws(()=>D.validate({version:2,items:[{...old,space}]}));
 const unit={...old,space:2};assert.deepEqual(B.capacity([unit,null,unit],4),{used:4,limit:4,valid:true});assert.equal(B.capacity([unit,unit],3).valid,false);
});
test('over-capacity teams cannot advance or cast, valid rebuild clears block',()=>{
 const unit={...D.defaults[0],space:4};let s=B.create([[unit],[passive]],undefined,[3,3]);assert.equal(s.blocked,true);s.started=true;assert.equal(B.cast(s,0),false);B.step(s);assert.equal(s.tick,0);
 s=B.create([[unit],[passive]],undefined,[4,3]);assert.equal(s.blocked,false);B.step(s);assert.equal(s.tick,1);
 s=B.create([[passive],[unit]],undefined,[3,3]);assert.equal(s.blocked,true);
});
