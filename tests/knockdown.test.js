const passive={name:'標靶',race:'人類',affinity:'物理',maxHp:180,cooldown:120,effects:[]};
const {test}=require('node:test');const assert=require('node:assert/strict');const B=require('../js/battle.js');const D=require('../js/database.js');const S=require('../js/skills.js');const E=require('../js/effects.js');
const unit=effects=>({...D.defaults[0],cooldown:.1,effects});
test('starts at zero; main knockdown enables immediate secondary followup',()=>{
 const s=B.create([[unit([{type:'posture',amount:100},{type:'damage',amount:10,cond:[{subject:'count',side:'enemy',op:'gte',value:1,targetCond:[{field:'down',op:'eq',value:true}],targetCondMode:'all'}]}])],[passive]]);assert.equal(s.teams[1].units[0].posture,0);B.step(s);assert.equal(s.teams[1].units[0].hp,165);assert.equal(s.teams[1].units[0].posture,100);const until=s.teams[1].units[0].weakUntil;B.step(s);assert.equal(s.teams[1].units[0].hp,150);assert.equal(s.teams[1].units[0].weakUntil,until);
});
test('conditional skill supports healing/formula and keeps condition in exports',()=>{
 const cond=[{subject:'count',side:'enemy',op:'gte',value:1,targetCond:[{field:'down',op:'eq',value:true}],targetCondMode:'all'}],effects=[{type:'heal',amount:10,cond},{type:'damage',amount:{multiplier:0,formula:'enemy.posture / 10',constant:0},cond}];
 const skill={id:'followup',name:'追擊',cooldown:.1,mode:'all',conditions:[],effects};assert.deepEqual(S.validate({version:1,skills:[skill]}).skills[0].effects,effects.map(e=>E.validate(e,{allowAttack:false})));assert.deepEqual(D.validate({version:2,items:[unit(effects)]}).items[0].effects,effects);
 const s=B.create([[unit([])],[passive]],[skill]);s.started=true;s.teams[0].units[0].hp=100;B.cast(s,0);assert.equal(s.teams[0].units[0].hp,100);s.teams[1].units[0].posture=100;s.teams[1].units[0].weakUntil=41;B.step(s);B.cast(s,0);assert.equal(s.teams[0].units[0].hp,110);assert.equal(s.teams[1].units[0].hp,165);
 assert.throws(()=>E.validate({type:'damage',amount:1,when:'enemyDown'}));
});
test('zero damage does not build stagger; reduction floors at zero and recovery permits a new knockdown',()=>{
 const s=B.create([[unit([{type:'damage',amount:{formula:'0'}}])],[unit([{type:'restore',amount:50}])]]);s.teams[1].units[0].posture=20;B.step(s);assert.equal(s.teams[1].units[0].posture,0);assert.equal(s.teams[1].units[0].weakUntil,0);
 s.teams[0].units[0].effects=[{type:'posture',amount:100}];B.step(s);const until=s.teams[1].units[0].weakUntil;s.teams[0].units.forEach(u=>u.effects=[]);while(s.tick<until)B.step(s);assert.equal(s.teams[1].units[0].posture,0);assert.equal(s.teams[1].units[0].weakUntil,0);s.teams[0].units[0].effects=[{type:'posture',amount:100}];B.step(s);assert.equal(s.teams[1].units[0].weakUntil,s.tick+40);
});
