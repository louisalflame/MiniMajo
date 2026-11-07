const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../js/database.js'),E=require('../js/effects.js'),B=require('../js/battle.js'),L=require('../js/laws.js'),S=require('../js/statuses.js'),Saved=require('../js/saved-data.js');
const scaled=(type,multiplier=2,mode=type==='damage'?'primary':'self')=>E.validate({type,amount:{multiplier,formula:'0',constant:0},targets:[{side:type==='damage'?'enemy':'ally',mode}]});
const unit=(effects=[],extra={})=>({...D.defaults[0],attack:20,attackRange:2,cooldown:.1,maxHp:1000,effects,...extra});
const board=(...pairs)=>{const a=Array(10).fill(null);for(const [slot,u] of pairs)a[slot]=u;return a;};
const battle=(a,b)=>B.create([a,b],[],[10,10],{footprints:true});
const law=stats=>({id:'boost',name:'加成',shopPrice:0,shopWeight:0,stats,passives:[]});
function status(actor,kind,amount){S.apply(actor,{status:kind,duration:{kind:'permanent'}},amount,0);}

test('team active effects never borrow attack power, even with a raw multiplier payload',()=>{
 const effects=['damage','heal','shield'].map(type=>E.validate({type,amount:{multiplier:{min:50,max:100},formula:'target.maxHp / 100',constant:7},targets:[{side:type==='damage'?'enemy':'ally',mode:type==='damage'?'opposite':'self'}]}));
 const s=battle(board([0,unit([],{attack:999,outputBonuses:{damage:500,heal:500,shield:500}})]),board([0,unit([],{cooldown:120})]));
 const a=s.teams[0].units[0];a.hp=500;status(a,'power',100);status(a,'hard',100);s.started=true;s.random=()=>{throw Error('不應抽取攻擊倍率');};s.teams[0].skill={enabled:true,name:'常數技能',cooldown:3,effects};
 assert.equal(B.cast(s,0),true);assert.equal(s.teams[1].units[0].hp,983);assert.equal(a.hp,517);assert.equal(a.shield,17);
});

test('law passive effects ignore attack while permanent law bonuses still boost character effects',()=>{
 const e=E.validate({type:'damage',amount:{multiplier:100,formula:'target.maxHp / 100',constant:7},targets:[{side:'enemy',mode:'opposite'}]});
 const l={...law({damage:3}),passives:[{when:'action',subject:{relation:'self',conditions:[]},effects:[e]}]};
 const actor=L.attach(unit([scaled('damage')]),[l]);assert.equal(actor.laws[0].passives[0].effects[0].amount.multiplier,undefined);
 actor.laws[0].passives[0].effects[0]=e; // Engine must also protect unvalidated battle payloads.
 const s=battle(board([0,actor]),board([0,unit([],{cooldown:120})]));status(s.teams[0].units[0],'power',4);B.step(s);
 assert.equal(s.teams[1].units[0].hp,929); // Passive 17, then character (20+3+4)*2 = 54.
});

test('attack scaling, battle-value expression and integer constant add independently for each output type',()=>{
 for(const [type,up,down] of [['damage','power','weakness'],['heal','healing','healingWeakness'],['shield','hard','fragile']]){
  const e=E.validate({type,amount:{multiplier:2,formula:'target.maxHp * 0.1',constant:3}});
  const actor=unit([],{outputBonuses:{[type]:5}}),target={maxHp:1000,hp:800};
  actor.statuses=[{kind:'up',amount:1,rules:[{behavior:up,value:4}]},{kind:'down',amount:1,rules:[{behavior:down,value:1}]}];
  const context={self:actor,target,enemy:target},s={tick:0,random:()=>0};
  assert.equal(E.amount(e,s,0,context),159); // (20+5+4-1)*2 + 100 + 3
  assert.equal(E.amount({...e,amount:{...e.amount,multiplier:0}},s,0,context),103);
  assert.equal(E.amount({...e,amount:37},s,0,context),37);
 }
});

test('additive expressions see live battle values and the combined result rounds and clamps once',()=>{
 const e=E.validate({type:'damage',amount:{multiplier:2,formula:'target.hp / 10',constant:3}});
 const s=battle(board([0,unit([{type:'shield',amount:10},e,e])]),board([0,unit([],{cooldown:120})]));
 B.step(s);assert.equal(s.teams[1].units[0].hp,728); // 143, then round(40+85.7+3)=129
 const context={self:unit([],{attack:1}),target:{hp:1}},state={tick:0};
 assert.equal(E.amount({type:'damage',amount:{multiplier:.25,formula:'target.hp / 4',constant:0}},state,0,context),1);
 assert.equal(E.amount({type:'damage',amount:{multiplier:1,formula:'-15000',constant:0}},state,0,{self:unit([],{attack:10000,outputBonuses:{damage:10000}})}),5000);
 assert.equal(E.amount({type:'damage',amount:{multiplier:1,formula:'0',constant:-30}},state,0,context),0);
});

test('combined amount validates and repairs each component without losing the other terms',()=>{
 for(const amount of [{multiplier:null},{constant:.5},{constant:10001},{constant:null},{formula:'bad()'}])assert.throws(()=>E.validate({type:'damage',amount}));
 const raw={version:2,items:[unit([{type:'damage',amount:{multiplier:{min:.3,max:.8},formula:'bad()',constant:9}}])]};
 const fixed=Saved.characters(raw,[]).items[0].effects[0].amount;
 assert.deepEqual(fixed,{multiplier:{min:.3,max:.8},formula:'0',constant:9});assert.equal(raw.items[0].effects[0].amount.formula,'bad()');
});

test('posture growth and laws keep their additive effect without mutating formula data',()=>{
 const base=unit([{type:'posture',amount:{formula:'target.posture / 2 + 5'}}]),original=structuredClone(base);
 const actor=D.runtime(L.attach(D.bonuses(base,{posture:4}),[law({posture:6})]));
 const s=battle(board([0,actor]),board([0,unit([],{cooldown:120})]));s.teams[1].units[0].posture=20;B.step(s);
 assert.equal(s.teams[1].units[0].posture,45);assert.equal(actor.outputBonuses.posture,10);assert.equal(actor.effects[0].amount.bonus,undefined);assert.deepEqual(base,original);
});

test('growth, repeated laws and statuses add before multiplication with independent output categories',()=>{
 const db=D.validate({version:2,jobGrowth:{破陣:Array.from({length:5},()=>({damage:5,heal:7,shield:9,range:1}))},items:[unit([scaled('damage'),scaled('heal'),scaled('shield')])]});
 const original=structuredClone(db),u=D.runtime(L.attach(D.atStars(db.items[0],2),[law({damage:3,heal:4,shield:6,range:1}),law({damage:3,heal:4,shield:6,range:1})]));
 assert.equal(u.attack,20);assert.equal(u.attackRange,5);assert.deepEqual(u.outputBonuses,{damage:11,heal:15,shield:21,posture:0});
 const s=battle(board([0,u]),board([0,unit([],{cooldown:120})])),a=s.teams[0].units[0];a.hp=500;
 status(a,'power',4);status(a,'weakness',1);status(a,'hard',8);status(a,'fragile',2);
 // Custom treatment status rules use the same status engine without borrowing damage buffs.
 a.statuses.push({kind:'custom-treatment',amount:1,rules:[{behavior:'healing',value:6},{behavior:'healingWeakness',value:2}],until:null,remaining:null});
 B.step(s);assert.equal(s.teams[1].units[0].hp,932);assert.equal(a.hp,578);assert.equal(a.shield,94);
 assert.deepEqual(db,original);assert.equal(D.runtime(u).outputBonuses.damage,11);
});

test('random multiplier uses per-target random draws and clamps only after adding and multiplying',()=>{
 const e=E.validate({type:'damage',amount:{multiplier:{min:.5,max:1.5},formula:'0',constant:0},targets:[{side:'enemy',mode:'all'}]});
 const s=battle(board([0,unit([e])]),board([0,unit([],{cooldown:120})],[1,unit([],{cooldown:120})]));
 let at=0;s.random=()=>[0,1][at++];B.step(s);assert.equal(s.teams[1].units[0].hp,990);assert.equal(s.teams[1].units[1].hp,970);assert.equal(at,2);
 const actor=unit([],{attack:0,outputBonuses:{damage:-100}}),state={tick:0,random:()=>0};
 assert.equal(E.amount(scaled('damage'),state,0,{self:actor}),0);
 assert.equal(E.amount(scaled('damage',100),state,0,{self:unit([],{attack:10000})}),10000);
 assert.equal(E.amount(scaled('heal',0),state,0,{self:actor}),0);
 assert.equal(E.amount(scaled('damage',1.25),state,0,{self:unit([],{attack:3})}),4);
});

test('every nearest effect uses actor range, including team skills and legacy unlimited flags',()=>{
 const e=scaled('damage',0);e.amount.constant=20;e.range=3;e.targets[0].range='unlimited';
 const s=battle(board([0,unit([e],{attackRange:1,moveDistance:0})]),board([2,unit([],{cooldown:120})]));
 B.step(s);assert.equal(s.teams[1].units[0].hp,1000);
 s.started=true;s.teams[0].skill={enabled:true,name:'技能',cooldown:3,effects:[e]};assert.equal(B.cast(s,0),true);assert.equal(s.teams[1].units[0].hp,1000);assert.equal(s.teams[0].skillReady,s.tick+30);
 s.teams[0].units[0].attackRange=3;s.teams[0].skillReady=0;s.teams[0].skill={enabled:true,name:'技能',cooldown:3,effects:[e]};B.cast(s,0);assert.equal(s.teams[1].units[0].hp,980);
});

test('opposite targets overlapping enemy footprints, respects conditions and never falls back to another column',()=>{
 const e=scaled('damage',1,'opposite'),s=battle(board([3,unit([e],{space:2,attackRange:1,moveDistance:0})]),board([1,unit([],{space:3,cooldown:120})],[7,unit([],{cooldown:120})]));
 const a=s.teams[0].units[0];assert.deepEqual(B.recipients(s,0,a,e,null),[s.teams[1].units[0]]);B.step(s);assert.equal(s.teams[1].units[0].hp,980);
 s.teams[1].units[0].hp=0;assert.deepEqual(B.recipients(s,0,a,e,null),[]);
 assert.throws(()=>E.validate({type:'heal',amount:10,targets:[{side:'ally',mode:'opposite'}]}));
});

test('new fields repair independently without altering source, preserve zero and survive saved libraries',()=>{
 const raw={version:2,items:[unit([scaled('damage',0)])]},original=structuredClone(raw);delete raw.items[0].attack;delete raw.items[0].attackRange;raw.items[0].effects[0].range=3;
 const warnings=[],fixed=Saved.characters(raw,warnings).items[0];assert.equal(fixed.attack,10);assert.equal(fixed.attackRange,3);assert.equal(fixed.effects[0].amount.multiplier,0);assert.ok(warnings.some(x=>x.includes('.attack')));assert.equal(raw.items[0].attack,undefined);
 const corrupt=structuredClone(original);corrupt.items[0].attack='20';corrupt.items[0].attackRange=0;corrupt.items[0].effects[0].amount={multiplier:{min:.7,max:'bad'},formula:'0',constant:0};
 const repaired=Saved.characters(corrupt,[]).items[0];assert.equal(repaired.attack,10);assert.equal(repaired.attackRange,1);assert.deepEqual(repaired.effects[0].amount,{multiplier:{min:.7,max:1.2},formula:'0',constant:0});
 assert.equal(Saved.characters({version:2,items:[unit([],{attack:0})]},[]).items[0].attack,0);
 for(const amount of [{multiplier:-1},{multiplier:101},{multiplier:{min:2,max:1}},{multiplier:{min:0,max:Infinity}}])assert.throws(()=>E.validate({type:'damage',amount}));
 for(const attack of [null,-1,'5',10001])assert.throws(()=>D.validate({version:2,items:[unit([],{attack})]}));
 const skills={version:1,skills:[{id:'skill',name:'技能',description:'',cooldown:1,mode:'all',conditions:[],effects:[scaled('heal')]}]};
 assert.deepEqual(Saved.skills(skills,[]),require('../js/skills.js').validate(skills));
 const laws=L.validate([law({damage:5})]);laws[0].passives=[{when:'action',subject:{relation:'self',conditions:[]},effects:[scaled('shield')]}];assert.deepEqual(Saved.laws(laws,[]).laws,L.validate(laws));
 assert.throws(()=>E.validate({type:'status',status:'power',amount:{multiplier:1},duration:{kind:'permanent'}}));
});

test('posture and restore scale with base attack while posture bonuses stay additive',()=>{
 const actor=unit([],{attack:20,outputBonuses:{damage:40,posture:5}});
 const s=battle(board([0,actor]),board([0,unit([])]));
 s.random=()=>.5;
 const context={self:actor,target:s.teams[1].units[0],allowAttack:true};
 const amount={multiplier:{min:1,max:2},formula:'4',constant:1};
 assert.equal(E.amount(E.validate({type:'posture',amount}),s,0,context),40);
 assert.equal(E.amount(E.validate({type:'restore',amount}),s,0,context),35);
 assert.equal(E.amount({type:'restore',amount},s,0,{...context,allowAttack:false}),5);
});
