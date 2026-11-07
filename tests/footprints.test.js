const {test}=require('node:test');const assert=require('node:assert/strict');const B=require('../js/battle.js');const D=require('../js/database.js');const S=require('../js/skills.js');
const u=(name,space=1,extra={})=>({...D.defaults[0],name,space,maxHp:100,cooldown:.1,moveDistance:2,effects:[{type:'damage',amount:10,range:1}],...extra});
const row=(...entries)=>{const a=Array(10).fill(null);for(const [slot,unit] of entries)a[slot]=unit;return a;};
const create=(a,b)=>B.create([a,b],[],[10,10],{footprints:true});
test('wide body targeting uses nearest occupied cell for attacks and skills',()=>{
 const s=create(row([2,u('wide',3)]),row([4,u('target',1,{effects:[],cooldown:120})]));
 assert.equal(s.blocked,false);assert.equal(B.distance(s,s.teams[0].units[0],s.teams[1].units[0]),1);
 B.step(s);assert.equal(s.teams[1].units[0].hp,90);
});
test('ten-grid movement advances past the old third-column boundary and attacks next action',()=>{
 const s=create(row([3,u('mover',2)]),row([8,u('target',1,{effects:[],cooldown:120})]));
 B.step(s);assert.equal(s.teams[0].units[0].slot,5);assert.equal(s.teams[1].units[0].hp,100);
 B.step(s);assert.equal(s.teams[0].units[0].slot,7);B.step(s);assert.equal(s.teams[1].units[0].hp,90);
});
test('movement cannot pass through the trailing cells of a living wide ally',()=>{
 const s=create(row([0,u('wall',3,{effects:[],cooldown:120})],[4,u('mover',2)]),row([0,u('target',1,{effects:[],cooldown:120})]));
 B.step(s);assert.equal(s.teams[0].units[1].slot,3);B.step(s);assert.equal(s.teams[0].units[1].slot,3);
});
test('dead footprints free space and are removed when a wide mover overlaps their trailing cells',()=>{
 const s=create(row([0,u('mover',3)],[3,u('dead',2,{effects:[]})]),row([8,u('target',1,{effects:[],cooldown:120})]));
 s.teams[0].units[1].hp=0;B.step(s);assert.equal(s.teams[0].units[0].slot,2);assert.equal(s.teams[0].items[3],null);assert.equal(s.teams[0].units[1].hp,0);
});
test('overlapping or out-of-bounds opening footprints block the battle',()=>{
 for(const a of [row([0,u('wide',3)],[2,u('overlap')]),row([8,u('outside',3)])]){
  const s=create(a,row([0,u('target')]));assert.equal(s.blocked,true);B.step(s);assert.equal(s.tick,0);
 }
});
test('contested movements never overlap and wide characters stay within ten cells',()=>{
 const s=create(row([0,u('left',2)],[5,u('right',2)]),row([3,u('target',1,{effects:[],cooldown:120})]));
 for(let i=0;i<10;i++){B.step(s);assert.equal(B.layoutValid(s.teams[0].items),true);}
 assert.equal(B.move(s,0,s.teams[0].units[0]),false);
});
test('skill conditions accept slot ten and ten characters but reject eleven',()=>{
 const skill={...S.defaults[0],conditions:[{kind:'slot',slot:10,field:'race',value:'人類'},{kind:'count',count:10,op:'eq',field:'race',value:'人類'}]};
 const valid=S.validate({version:1,skills:[skill]}).skills;assert.equal(S.choose(Array(10).fill(u('human')),valid).enabled,true);
 assert.throws(()=>S.validate({version:1,skills:[{...skill,conditions:[{...skill.conditions[0],slot:11}]}]}));
});
