const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../js/battle.js'),E=require('../js/effects.js'),D=require('../js/database.js'),L=require('../js/laws.js'),Status=require('../js/statuses.js');
const target=(side='enemy',mode='primary')=>({side,mode,range:'unlimited',targetCond:[]});
const effect=(type,amount,side='enemy',mode='primary')=>E.validate({type,amount,targets:[target(side,mode)]});
const law=(when,effects,relation='self',conditions=[])=>L.validate([{id:'law',name:'法則',shopPrice:0,shopWeight:0,stats:{},passives:[{when,subject:{relation,conditions},effects}]}])[0];
const unit=(effects=[],laws=[],extra={})=>({...D.defaults[0],cooldown:120,maxHp:100,effects,laws,...extra});
const board=(...pairs)=>{const a=Array(10).fill(null);pairs.forEach(([slot,u])=>a[slot]=u);return a;};
const create=(a,b)=>B.create([a,b],[],[10,10],{footprints:true});
const shield=(n=7)=>effect('shield',n,'ally','self');

test('action passives apply before ordinary effects; duplicates are independent and reset next action',()=>{
 const l=law('action',[shield()]),s=create(board([0,unit([effect('damage',10)],[l,l],{cooldown:.1})]),board([0,unit()]));
 B.step(s);assert.equal(s.teams[0].units[0].shield,14);assert.equal(s.teams[1].units[0].hp,90);
 B.step(s);assert.equal(s.teams[0].units[0].shield,28);assert.equal(s.teams[0].units[0].stats.actions,2);assert.equal(s.teams[0].units[0].stats.shield,28);
});
test('attacked passive reacts to shield hits; zero damage does not trigger and event conditions filter',()=>{
 for(const n of [0,10]){
  const l=law('attacked',[effect('damage',4)]),watch=law('attacked',[shield(3)],'enemy',[{field:'job',value:'守護'}]);
  const s=create(board([0,unit([effect('damage',{formula:String(n)})],[watch],{cooldown:.1})]),board([0,unit([],[l],{job:'守護'})]));s.teams[1].units[0].shield=20;
  B.step(s);assert.equal(s.teams[1].units[0].hp,100);assert.equal(s.teams[0].units[0].hp,n?99:100);assert.equal(s.teams[0].units[0].shield,0);
 }
});
test('mutual attacked chains terminate once per passive, then ordinary actions remain possible',()=>{
 const l=law('attacked',[effect('damage',1)]),s=create(board([0,unit([effect('damage',1)],[l],{cooldown:.1})]),board([0,unit([],[l])]));
 B.step(s);assert.deepEqual(s.teams.map(t=>t.units[0].hp),[99,98]);
 B.step(s);assert.deepEqual(s.teams.map(t=>t.units[0].hp),[98,96]);
});
test('death passive can kill last enemy and draw, cannot revive self, fires once',()=>{
 const l=law('death',[effect('damage',100),effect('heal',100,'ally','self')]);
 const s=create(board([0,unit([effect('damage',100)],[],{cooldown:.1})]),board([0,unit([],[l])]));
 B.step(s);assert.equal(s.winner,'draw');assert.equal(s.teams[1].units[0].hp,0);assert.equal(s.teams[1].units[0].stats.damage,100);
 const count=s.feedback.length;B.step(s);assert.equal(s.feedback.length,count);
});
test('heal and shield events identify source and recipient and ignore zero or overheal',()=>{
 const a=unit([effect('heal',10,'ally','all')],[law('heal',[shield(2)])],{cooldown:.1});
 const b=unit([],[law('healed',[shield(3)]),law('shielded',[effect('damage',1)])],{attackRange:2});
 const s=create(board([0,a],[1,b]),board([0,unit()]));s.teams[0].units[1].hp=80;
 B.step(s);assert.equal(s.teams[0].units[1].hp,90);assert.equal(s.teams[0].units[0].shield,2);assert.equal(s.teams[0].units[1].shield,3);assert.equal(s.teams[1].units[0].hp,99);
 const full=create(board([0,a],[1,b]),board([0,unit()]));B.step(full);assert.equal(full.teams[0].units[0].shield,0);assert.equal(full.teams[0].units[1].shield,0);
});
test('down passive and allied death observer fire with no duplicate death announcements',()=>{
 const s=create(board([0,unit([effect('posture',100)],[],{cooldown:.1})]),board([0,unit([],[law('down',[shield(9)])])],[2,unit([],[law('death',[shield(5)],'ally')])]));
 B.step(s);assert.equal(s.teams[1].units[0].shield,9);assert.ok(s.teams[1].units[0].weakUntil>0);
 s.teams[0].units[0].effects=[effect('damage',100)];B.step(s);assert.equal(s.teams[1].units[1].shield,5);
});
test('move events cover ordinary movement, jump and both swapped characters',()=>{
 const l=law('move',[shield(2)]),s=create(board([0,unit([effect('damage',1)],[l],{cooldown:.1})]),board([3,unit()]));
 s.teams[0].units[0].effects[0].targets[0].range='limited';B.step(s);assert.equal(s.teams[0].units[0].shield,2);
 const j=create(board([0,unit([],[l])]),board([3,unit()]));assert.equal(B.jump(j,0,j.teams[0].units[0],j.teams[1].units[0]),true);assert.equal(j.teams[0].units[0].shield,2);
 const sw=create(board([0,unit([],[l,law('swapInitiated',[shield(3)])])],[3,unit([],[l,law('swapReceived',[shield(5)])])]),board([0,unit()]));
 assert.equal(B.swap(sw,0,...sw.teams[0].units),true);assert.deepEqual(sw.teams[0].units.map(u=>u.shield),[5,7]);
 assert.equal(B.swap(sw,0,sw.teams[0].units[0],sw.teams[0].units[0]),false);
});
test('passives obey range and main failure, do not move or consume normal action cooldown',()=>{
 const hit=effect('damage',10);hit.targets[0].range='limited';
 const s=create(board([0,unit([],[law('action',[hit,shield()])],{cooldown:.1})]),board([5,unit()]));
 B.step(s);const a=s.teams[0].units[0];assert.equal(a.slot,0);assert.equal(a.shield,0);assert.equal(a.nextAction,2);assert.equal(a.stats.actions,1);
});
test('death from poison and overtime triggers death, environmental damage does not trigger attacked',()=>{
 for(const overtime of [false,true]){
  const s=create(board([0,unit([],[law('death',[effect('damage',100)]),law('attacked',[shield(20)])])]),board([0,unit()]));
  if(overtime){Object.assign(s.config,{battleSeconds:1,overtimeDamage:100});s.teams[1].units[0].hp=200;s.teams[1].units[0].maxHp=200;}
  else Status.apply(s.teams[0].units[0],{status:'poison',duration:{kind:'permanent'}},100,0);
  for(let i=0;i<(overtime?20:10);i++)B.step(s);assert.equal(s.winner,'draw');assert.equal(s.teams[0].units[0].shield,0);
 }
});
test('removed journey timings reject editing and are dropped with warnings on load',()=>{
 const R=require('../js/saved-data.js'),warnings=[];
 const old=['starUp','victory','travel','rest','purchase','sale'];
 old.forEach(when=>assert.throws(()=>law(when,[shield()])));
 const source={...law('action',[shield()]),passives:old.map(when=>({when,effects:[shield()]}))};
 const loaded=R.laws([source],warnings).laws[0];assert.deepEqual(loaded.passives,[]);assert.equal(warnings.length,6);assert.equal(source.passives.length,6);
});

test('shield source event fires, any and ally filters work, and wrong attributes exclude a passive',()=>{
 const s=create(board([0,unit([shield(1)],[law('shield',[effect('damage',2)],'self')],{cooldown:.1})],[2,unit([],[law('shield',[shield(4)],'ally'),law('shield',[shield(100)],'any',[{field:'race',value:'獸人'}])])]),board([0,unit([],[law('shield',[shield(6)],'any')])]));
 B.step(s);assert.equal(s.teams[0].units[1].shield,4);assert.equal(s.teams[1].units[0].shield,6);assert.equal(s.teams[1].units[0].hp,98);assert.equal(s.teams[0].units[0].stats.damage,2);
});
test('stunned observers skip passives; action passive counterdeath cancels ordinary effects',()=>{
 const s=create(board([0,unit([],[law('attacked',[shield(4)])])]),board([0,unit([effect('damage',1)],[],{cooldown:.1})]));
 Status.apply(s.teams[0].units[0],{status:'stun',duration:{kind:'seconds',value:5}},1,0);B.step(s);assert.equal(s.teams[0].units[0].shield,0);
 const killed=create(board([0,unit([shield(99)],[law('action',[effect('damage',100)])],{cooldown:.1})]),board([0,unit([],[law('death',[effect('damage',100)])])]));
 B.step(killed);assert.equal(killed.winner,'draw');assert.equal(killed.teams[0].units[0].shield,0);
});
test('periodic healing triggers source and recipient passives and credits the law owner',()=>{
 const s=create(board([0,unit([],[law('heal',[effect('damage',3)])])],[1,unit([],[law('healed',[shield(8)])])]),board([0,unit()]));
 const [a,b]=s.teams[0].units;b.hp=50;Status.apply(b,{status:'regen',duration:{kind:'permanent'}},10,0).sourceId=a.battleId;
 for(let i=0;i<10;i++)B.step(s);assert.equal(b.hp,60);assert.equal(b.shield,8);assert.equal(a.stats.damage,3);assert.equal(a.stats.heal,10);
});
