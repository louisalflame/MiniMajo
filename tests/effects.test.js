const passive={name:'標靶',race:'人類',affinity:'物理',maxHp:180,cooldown:120,effects:[]};
const {test}=require('node:test');const assert=require('node:assert/strict');const E=require('../js/effects.js');const B=require('../js/battle.js');const DB=require('../js/database.js');const S=require('../js/skills.js');
const character=effects=>({...DB.defaults[0],cooldown:.1,effects,tags:[]});
test('formula arithmetic obeys precedence, parentheses and supports references',()=>{
 assert.equal(E.calculate('2 + 3 * 4'),14);assert.equal(E.calculate('(2 + 3) * 4 / 2 - 1'),9);assert.equal(E.calculate('enemy.hp * 0.2 + 5',{'enemy.hp':180}),41);assert.equal(E.calculate('-5 + 10'),5);assert.equal(E.calculate('10 / 0'),0);
 for(const formula of ['','alert(1)','self.secret','2 ** 3','(2 + 3','2;3','NaN'])assert.throws(()=>E.validate({type:'damage',amount:{formula}}));
 assert.throws(()=>E.validate({type:'status',status:'burn'}));
});
test('battle formulas use live state, round/clamp and compose with previous effects',()=>{
 const c=character([{type:'shield',amount:10},{type:'damage',amount:{formula:'self.shield * 2 + enemy.hp / 10'}}]);const state=B.create([[c],[passive]]);B.step(state);assert.equal(state.teams[1].units[0].hp,142);
 assert.equal(E.amount({amount:{formula:'-20'}},state,0),0);assert.equal(E.amount({amount:{formula:'99999'}},state,0),10000);assert.equal(E.amount({amount:{formula:'3 / 2'}},state,0),2);
});
