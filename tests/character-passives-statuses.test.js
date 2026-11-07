const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../js/battle.js'),D=require('../js/database.js'),L=require('../js/laws.js'),S=require('../js/statuses.js'),E=require('../js/effects.js'),R=require('../js/saved-data.js');
const effect=(type,amount,side='enemy')=>E.validate({type,amount,targets:[{side,mode:side==='ally'?'self':'primary'}]});
const shield=n=>effect('shield',n,'ally');
const passive=(when,effects)=>({when,subject:{relation:'self',conditions:[]},effects});
const unit=(extra={})=>({...D.defaults[0],cooldown:120,maxHp:500,effects:[],...extra});
const state=(a=unit(),b=unit())=>B.create([[a],[b]],[],[10,10]);
const apply=(u,status,amount=1,duration)=>S.apply(u,{status,duration},amount,0);
const step=(s,n=1)=>{for(let i=0;i<n;i++)B.step(s);};

test('innate and attached passives retain separate chain identities and ordinary cooldown',()=>{
 const p=passive('action',[shield(3)]),law=L.validate([{id:'a',name:'法則',shopPrice:0,shopWeight:0,passives:[p]}])[0];
 const s=state(unit({cooldown:.1,passives:[p],laws:[law,law]}));step(s);
 assert.equal(s.teams[0].units[0].shield,9);assert.equal(s.teams[0].units[0].nextAction,2);
 step(s);assert.equal(s.teams[0].units[0].shield,18);
});

test('player skill dispatches once only to the casting side; invalid casts do not trigger',()=>{
 const p=passive('playerSkill',[shield(4)]),s=state(unit({passives:[p]}),unit({passives:[p]}));
 assert.equal(B.cast(s,0),false);step(s);s.teams[0].skill={enabled:true,name:'技能',cooldown:5,effects:[]};
 assert.equal(B.cast(s,0),true);assert.deepEqual(s.teams.map(t=>t.units[0].shield),[4,0]);
 assert.equal(B.cast(s,0),false);assert.deepEqual(s.teams.map(t=>t.units[0].shield),[4,0]);
});

test('innate attacked chains terminate, and death passives can still execute',()=>{
 const p=passive('attacked',[effect('damage',1)]),s=state(unit({cooldown:.1,effects:[effect('damage',1)],passives:[p]}),unit({passives:[p]}));step(s);
 assert.deepEqual(s.teams.map(t=>t.units[0].hp),[499,498]);
 const dead=state(unit({cooldown:.1,effects:[effect('damage',500)]}),unit({passives:[passive('death',[effect('damage',500)])]}));step(dead);assert.equal(dead.winner,'draw');
});

test('character passives roundtrip growth, runtime, backup and independently repair malformed fields',()=>{
 const p=passive('action',[shield(2)]),raw={version:2,items:[unit({passives:[p]})]},clean=D.validate(raw);
 assert.deepEqual(D.runtime(D.atStars(clean.items[0],3)).passives,clean.items[0].passives);
 const Backup=require('../js/editor-backup.js'),file=Backup.collect({getItem:()=>null});file.data.characters=clean;
 assert.deepEqual(Backup.prepare(file).file.data.characters.items[0].passives,clean.items[0].passives);
 const bad=structuredClone(raw);bad.items[0].passives=[{when:'action',subject:{relation:'bad',conditions:[]},effects:[]},{when:'travel',effects:[]}];
 const warnings=[],repaired=R.characters(bad,warnings);assert.equal(repaired.items[0].passives.length,1);assert.equal(repaired.items[0].passives[0].subject.relation,'self');assert.equal(repaired.items[0].name,raw.items[0].name);assert.ok(warnings.length>=2);assert.equal(bad.items[0].passives.length,2);
 const old=structuredClone(raw);delete old.items[0].passives;assert.deepEqual(R.characters(old,[]).items[0].passives,[]);
});

test('dodge normalizes to one attack, survives time and own actions, and cannot stack',()=>{
 const s=state(unit({cooldown:.1})),u=s.teams[0].units[0];apply(u,'dodge',1,{kind:'seconds',value:1});apply(u,'dodge',1,{kind:'actions',value:90});step(s,30);
 assert.equal(u.statuses.length,1);assert.equal(u.statuses[0].attacks,1);assert.equal(u.statuses[0].remaining,null);assert.equal(u.statuses[0].until,null);assert.match(S.label(u.statuses[0],s.tick),/1次敵方普通攻擊/);
 assert.deepEqual(E.validate({type:'status',status:'dodge',target:'self',amount:1}).duration,{kind:'attacks',value:1});
});

test('dodge avoids the whole ordinary attack including grouped hits, secondary debuffs and reactions',()=>{
 const effects=[E.validate({targets:[{side:'enemy',mode:'primary'}],actions:[{type:'damage',amount:20},{type:'posture',amount:100}]}),E.validate({type:'status',status:'poison',target:'enemy',amount:10,duration:{kind:'seconds',value:5}})];
 const s=state(unit({cooldown:.1,effects}),unit({passives:[passive('attacked',[shield(7)])]})),u=s.teams[1].units[0];u.shield=30;apply(u,'dodge');apply(u,'counter',50,{kind:'permanent'});apply(u,'rage',1,{kind:'permanent'});step(s);
 assert.equal(u.hp,500);assert.equal(u.shield,30);assert.equal(u.posture,0);assert.equal(u.nextAction,1200);assert.equal(S.has(u,'poison'),false);assert.equal(S.has(u,'dodge'),false);assert.equal(s.teams[0].units[0].hp,500);assert.equal(s.teams[0].units[0].stats.damage,0);
 step(s);assert.ok(u.posture>0);assert.equal(S.has(u,'poison'),true);
});

test('successful dodge dispatches once to innate and law passives, filters event roles and can cancel attacker',()=>{
 const dodgePassive=passive('dodged',[shield(7)]),law=L.validate([{id:'dodge-law',name:'閃避法則',shopPrice:0,shopWeight:0,passives:[dodgePassive]}])[0];
 const watch={...passive('dodged',[shield(3)]),subject:{relation:'enemy',conditions:[{field:'job',value:D.defaults[0].job}]}};
 const s=state(unit({cooldown:.1,effects:[E.validate({targets:[{side:'enemy',mode:'primary'}],actions:[{type:'damage',amount:20},{type:'posture',amount:50}]}),effect('damage',20)],passives:[watch]}),unit({passives:[dodgePassive,passive('attacked',[shield(99)])],laws:[law]}));
 const [a,b]=s.teams.map(t=>t.units[0]);apply(b,'dodge');step(s);assert.equal(b.shield,14);assert.equal(b.hp,500);assert.equal(b.posture,0);assert.equal(a.shield,3);
 step(s);assert.equal(b.hp,494);assert.equal(a.shield,3);
 const kill=state(unit({cooldown:.1,effects:[effect('damage',20),effect('damage',20)]}),unit({passives:[passive('dodged',[effect('damage',500)])]}));
 apply(kill.teams[1].units[0],'dodge');step(kill);assert.equal(kill.teams[0].units[0].hp,0);assert.equal(kill.teams[1].units[0].hp,500);
});

test('dodge success timing roundtrips character, law and backup readers',()=>{
 const p=passive('dodged',[shield(2)]),warnings=[];
 const characters=R.characters({version:2,items:[unit({passives:[p]})]},warnings);
 assert.equal(characters.items[0].passives[0].when,'dodged');
 const laws=R.laws({version:1,laws:[{id:'d',name:'閃避',shopPrice:0,shopWeight:0,passives:[p]}]},warnings);
 assert.equal(laws.laws[0].passives[0].when,'dodged');
 const Backup=require('../js/editor-backup.js'),file=Backup.collect({getItem:()=>null});file.data.characters=characters;file.data.laws=laws;
 const loaded=Backup.prepare(file).file;assert.equal(loaded.data.characters.items[0].passives[0].when,'dodged');assert.equal(loaded.data.laws.laws[0].passives[0].when,'dodged');
 assert.equal(L.labels[L.timings.indexOf('dodged')],'角色閃避成功時');
});

test('passive damage, counterattacks and player skills neither consume nor obey dodge',()=>{
 const s=state(unit({cooldown:.1,effects:[effect('damage',1)],passives:[passive('action',[effect('damage',9)])]}));const [a,b]=s.teams.map(t=>t.units[0]);apply(a,'dodge');apply(b,'counter',5,{kind:'permanent'});step(s);
 assert.equal(a.hp,495);assert.equal(S.has(a,'dodge'),true);
 apply(b,'dodge');s.teams[0].skill={enabled:true,name:'技能',cooldown:5,effects:[effect('damage',10)]};B.cast(s,0);assert.equal(b.hp,480);assert.equal(S.has(b,'dodge'),true);
 step(s);assert.equal(b.hp,471);assert.equal(S.has(b,'dodge'),false);
});

test('six enhanced statuses add their supplied values, stay permanent and coexist with ordinary versions',()=>{
 for(const [kind,base] of Object.entries(S.enhancedKinds)){
  const s=state(),u=s.teams[0].units[0];apply(u,kind,3,{kind:'seconds',value:1});apply(u,kind,7,{kind:'actions',value:1});apply(u,base,2,{kind:'permanent'});
  assert.equal(u.statuses.length,2);assert.equal(u.statuses[0].amount,10);assert.equal(u.statuses[0].until,null);assert.equal(u.statuses[0].remaining,null);assert.equal(S.sum(u,base),12);
  assert.deepEqual(E.validate({type:'status',status:kind,target:'self',amount:3}).duration,{kind:'permanent'});
  step(s,20);assert.equal(S.has(u,kind),true);if(base==='poison')assert.equal(u.hp,476);
 }
});

test('enhanced periodic refresh preserves pulses; old libraries gain new built-ins without mutating source',()=>{
 const s=state(),u=s.teams[0].units[0];apply(u,'enhancedPoison',2);step(s,5);S.apply(u,{status:'enhancedPoison'},3,s.tick);step(s,5);assert.equal(u.hp,495);
 const old=S.snapshot();old.statuses=old.statuses.filter(d=>!['dodge','taunt'].includes(d.id)&&!d.enhanced);const warnings=[],loaded=R.statuses(old,warnings);assert.equal(loaded.statuses.length,21);assert.equal(old.statuses.length,13);assert.equal(warnings.length,8);
 assert.match(S.policyLabel(loaded.statuses.find(d=>d.id==='enhancedHard')),/強化狀態.*永久/);
});

test('legacy permanent ordinary status loads as one second while strict editing rejects it',()=>{
 const e={type:'status',status:'poison',target:'self',amount:4,duration:{kind:'permanent'}};
 assert.throws(()=>E.validate(e),/一般狀態/);
 const warnings=[];
 const saved=R.characters({version:2,items:[unit({effects:[e]})]},warnings);
 assert.deepEqual(saved.items[0].effects[0].duration,{kind:'seconds',value:1});
 assert.ok(warnings.some(w=>w.includes('duration.kind')));
 assert.deepEqual(E.validate({...e,status:'enhancedPoison'}).duration,{kind:'permanent'});
});

test('innate passive attack multipliers survive saves and apply without ordinary-attack dodge',()=>{
 const scaled=E.validate({targets:[{side:'enemy',mode:'primary'}],actions:[{type:'damage',amount:{multiplier:2,formula:'0',constant:1}}]});
 const p=passive('action',[scaled]);
 const raw={version:2,items:[unit({attack:20,cooldown:.1,passives:[p]})]};
 const clean=D.validate(raw).items[0];
 assert.equal(clean.passives[0].effects[0].actions[0].amount.multiplier,2);
 const s=state({...clean,outputBonuses:{damage:5}},unit());
 apply(s.teams[1].units[0],'dodge');
 step(s);
 assert.equal(s.teams[1].units[0].hp,449);
 assert.equal(S.has(s.teams[1].units[0],'dodge'),true);
 const Backup=require('../js/editor-backup.js'),file=Backup.collect({getItem:()=>null});
 file.data.characters.items=[clean];
 assert.equal(Backup.prepare(file).file.data.characters.items[0].passives[0].effects[0].actions[0].amount.multiplier,2);
});
