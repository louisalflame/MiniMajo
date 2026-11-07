const {test}=require('node:test');const assert=require('node:assert/strict');const D=require('../js/database.js');const S=require('../js/skills.js');const B=require('../js/battle.js');const E=require('../js/effects.js');
test('obsolete character formats and tag effects are rejected',()=>{
 const old={...D.defaults[0],tags:['old'],effects:[{type:'tag',tag:'old'},{type:'damage',amount:{formula:'self.tagCount * 5'}}]};delete old.stars;delete old.rarity;delete old.job;
 assert.throws(()=>D.validate({version:2,items:[old]}));
 assert.throws(()=>E.validate({type:'tag',tag:'old'}));assert.throws(()=>E.calculate('self.tagCount'));
});
test('invalid enum and stars values are rejected',()=>{
 for(const patch of [{stars:0},{stars:7},{stars:1.5},{rarity:'R'},{job:'法師'}])assert.throws(()=>D.validate({version:2,items:[{...D.defaults[0],...patch}]}));
});
test('star, rarity, job conditions reflect a runtime copy and leave fixed data intact',()=>{
 const original={...D.defaults[0],stars:1,rarity:'UR',job:'飛襲'};
 const rules=[{id:'six',name:'六星',cooldown:3,mode:'all',conditions:[{kind:'slot',slot:1,field:'stars',value:'6'},{kind:'count',field:'rarity',value:'UR',op:'gte',count:1},{kind:'majority',field:'job',value:'飛襲'}],effects:[]}];S.validate({version:1,skills:rules});
 assert.equal(B.create([[original],[null]],rules).teams[0].skill.enabled,false);
 const upgraded=B.create([[{...original,stars:6}],[null]],rules);assert.equal(upgraded.teams[0].skill.id,'six');assert.equal(original.stars,1);assert.equal(upgraded.teams[0].items[0].rarity,'UR');assert.equal(S.condition(upgraded.teams[0].items,{kind:'majority',field:'stars',value:'6'}),true);
});
test('obsolete skill conditions are rejected',()=>{
 const base={id:'legacy',name:'舊技能',cooldown:3,mode:'all',effects:[{type:'damage',amount:5}],conditions:[{kind:'count',field:'tag',value:'old',op:'gte',count:1}]};
 assert.throws(()=>S.validate({version:1,skills:[base]}));
});
