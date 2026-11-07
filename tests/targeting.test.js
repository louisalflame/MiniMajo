const {test}=require('node:test');const assert=require('node:assert/strict');const B=require('../js/battle.js');const E=require('../js/effects.js');const D=require('../js/database.js');const S=require('../js/skills.js');const Status=require('../js/statuses.js');
const u=(name,extra={})=>({...D.defaults[0],name,cooldown:120,effects:[],...extra});
const row=(...entries)=>{const a=Array(10).fill(null);for(const [slot,x] of entries)a[slot]=x;return a;};
const targeting=(side,mode,filter='any',extra={})=>({side,mode,filter,range:'limited',...extra});
const create=(own,enemy,options={})=>B.create([own,enemy],[],[10,10],{footprints:true,...options});
const effect=(type,amount,t)=>E.validate({type,amount,targeting:t});
test('target configuration roundtrips through both libraries and rejects incompatible modes',()=>{
 const heal=effect('heal',{formula:'target.missingHp * 0.5'},targeting('ally','lowestHpRatio','injured'));
 assert.deepEqual(D.validate({version:2,items:[u('medic',{effects:[heal]})]}).items[0].effects,[heal]);
 assert.deepEqual(S.validate({version:1,skills:[{...S.defaults[0],effects:[heal]}]}).skills[0].effects,[E.validate(heal,{allowAttack:false})]);
 for(const t of [targeting('enemy','self'),targeting('enemy','adjacent'),targeting('ally','bad'),targeting('enemy','all','hasStatus',{status:'bad'}),{side:'other',mode:'all'}])assert.throws(()=>effect('shield',5,t));
 const old={type:'heal',amount:5};assert.deepEqual(E.validate(old),old);
});
test('all-ally healing uses each target formula, clamps HP, and excludes dead units',()=>{
 const heal=effect('heal',{formula:'target.missingHp * 0.5'},targeting('ally','all'));
 const s=create(row([0,u('caster',{cooldown:.1,effects:[heal]})],[2,u('wide',{space:3})],[6,u('dead')]),row([9,u('enemy')]));
 const [caster,wide,dead]=s.teams[0].units;caster.hp=100;wide.hp=80;dead.hp=0;
 B.step(s);assert.equal(caster.hp,140);assert.equal(wide.hp,130);assert.equal(dead.hp,0);
 caster.effects=[effect('heal',999,targeting('ally','all'))];B.step(s);assert.equal(caster.hp,180);assert.equal(wide.hp,180);
});
test('self plus neighbors uses footprint edges and grants shields once per unit',()=>{
 const shield=effect('shield',7,targeting('ally','adjacent'));
 const s=create(row([0,u('left',{space:2})],[2,u('caster',{space:3,cooldown:.1,effects:[shield]})],[5,u('right')],[7,u('gap')]),row([9,u('enemy')]));
 B.step(s);assert.deepEqual(s.teams[0].units.map(x=>x.shield),[7,7,7,0]);
});
test('lowest numeric HP, lowest ratio, and highest stagger choose independently with leftmost ties',()=>{
 const s=create(row([0,u('caster')],[2,u('large',{maxHp:400})],[4,u('small',{maxHp:100})]),row([9,u('enemy')]));
 const [a,b,c]=s.teams[0].units;a.hp=180;b.hp=100;c.hp=80;b.posture=40;c.posture=40;
 const pick=mode=>B.recipients(s,0,a,effect('heal',1,targeting('ally',mode)),null)[0];
 assert.equal(pick('lowestHp'),c);assert.equal(pick('lowestHpRatio'),b);assert.equal(pick('highestPosture'),b);
});
test('enemy all ignores range regardless of stored distance policy',()=>{
 for(const unlimited of [false,true]){
  const e=effect('damage',10,targeting('enemy','all','any',{range:unlimited?'unlimited':'limited'}));
  const s=create(row([0,u('caster',{cooldown:.1,effects:[e]})]),row([0,u('near')],[5,u('far')]));
  B.step(s);assert.deepEqual(s.teams[1].units.map(x=>x.hp),[170,170]);assert.equal(s.teams[0].units[0].slot,0);
 }
});
test('state filters work on both teams and skip unmet conditions without moving',()=>{
 const grant=E.validate({type:'status',status:'regen',amount:4,duration:{kind:'seconds',value:5},targeting:targeting('ally','all','injured')});
 const poison=E.validate({type:'status',status:'poison',amount:2,duration:{kind:'actions',value:3},targeting:targeting('enemy','all','missingStatus',{status:'poison',range:'unlimited'})});
 const s=create(row([0,u('caster',{cooldown:.1,effects:[grant,poison]})],[3,u('hurt')]),row([0,u('clean')],[4,u('poisoned')]));
 s.teams[0].units[1].hp=100;Status.apply(s.teams[1].units[1],{status:'poison',duration:{kind:'permanent'}},9,0);
 B.step(s);assert.equal(Status.has(s.teams[0].units[0],'regen'),false);assert.equal(Status.has(s.teams[0].units[1],'regen'),true);
 assert.equal(Status.sum(s.teams[1].units[0],'poison'),2);assert.equal(Status.sum(s.teams[1].units[1],'poison'),9);
 const actor=s.teams[0].units[0];assert.equal(B.recipients(s,0,actor,effect('damage',1,targeting('enemy','all','hasStatus',{status:'poison',range:'unlimited'})),null).length,2);
 s.teams[1].units[0].weakUntil=20;assert.equal(B.recipients(s,0,actor,effect('damage',1,targeting('enemy','all','down',{range:'unlimited'})),null).length,1);
 actor.effects=[effect('damage',10,targeting('enemy','all','injured'))];B.step(s);assert.equal(actor.slot,0);assert.equal(s.teams[1].units[0].hp,180);
});
test('random selection only chooses valid living candidates and executes once',()=>{
 const e=effect('shield',5,targeting('ally','random','injured'));
 const s=create(row([0,u('caster',{cooldown:.1,effects:[e]})],[1,u('hurt')],[2,u('dead')]),row([9,u('enemy')]));s.teams[0].units[1].hp=10;s.teams[0].units[2].hp=0;s.random=()=>0;
 B.step(s);assert.deepEqual(s.teams[0].units.map(x=>x.shield),[0,5,0]);
});
test('disabling active skills blocks both teams without stopping automatic character effects',()=>{
 const member=u('fighter',{cooldown:.1,effects:[{type:'damage',amount:5}]});
 const s=B.create([[member],[member]],S.defaults,[10,10],{activeSkillsEnabled:false});s.started=true;
 for(const team of [0,1]){assert.equal(B.canCast(s,team),false);assert.equal(B.cast(s,team),false);}
 B.step(s);assert.equal(s.teams[0].units[0].hp,175);assert.equal(s.teams[1].units[0].hp,175);assert.equal(s.teams[0].skillReady,0);
});
test('shared attributes combine with battle-state filters before ranking or applying all-target effects',()=>{
 const t=targeting('ally','all','injured',{conditions:[{field:'job',value:'支援'},{field:'race',value:'人類'}]}),heal=effect('heal',10,t);
 const s=create(row([0,u('caster',{cooldown:.1,effects:[heal]})],[1,u('match',{job:'支援',race:'人類'})],[2,u('wrong race',{job:'支援',race:'獸人'})],[3,u('healthy',{job:'支援',race:'人類'})]),row([0,u('enemy')]));s.teams[0].units[1].hp=80;s.teams[0].units[2].hp=60;B.step(s);assert.deepEqual(s.teams[0].units.map(x=>x.hp),[180,90,60,180]);
 s.teams[0].units[0].effects=[effect('shield',5,{...t,mode:'lowestHp'})];B.step(s);assert.deepEqual(s.teams[0].units.map(x=>x.shield),[0,5,0,0]);
 assert.deepEqual(D.validate({version:2,items:[u('caster',{effects:[heal]})]}).items[0].effects[0].targeting.conditions,t.conditions);
});
test('shared target attributes reject invalid data and old effect-level conditions',()=>{
 for(const conditions of [null,{},[{field:'job',value:'bad'}],[{field:'stars',value:'3'}],Array(11).fill({field:'stars',value:3})])assert.throws(()=>effect('damage',5,targeting('enemy','all','any',{conditions})));
 assert.throws(()=>E.validate({type:'swap',conditions:[{field:'job',value:'支援'}]}));
});
