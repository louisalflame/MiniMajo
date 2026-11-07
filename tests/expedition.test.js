const {test}=require('node:test');const assert=require('node:assert/strict');const X=require('../js/expedition.js');const D=require('../js/database.js');const S=require('../js/skills.js');
const C=require('../js/config.js');
const row=(...ids)=>[...ids,...Array(10-ids.length).fill(null)];
const create=(items,skills,active,reserve=[])=>{const state=X.create(items,skills,{...C.defaults,startingActive:row(...active)});state.reserve=row(...reserve).map(id=>id?{...structuredClone(items.find(u=>u.id===id)),instanceId:'fixture-'+(++state.serial)}:null);return state;};
const unit=(id,space=1)=>({...D.defaults[0],id,name:id,space,shopPrice:20*space+10});
test('ten-cell active and reserve formations own independent character instances',()=>{
 const s=create([unit('a',3),unit('b',3),unit('c',3),unit('d',2),unit('e',3),unit('f',3)],undefined,['a',null,null,'b',null,null,'c'],['d',null,'e',null,null,'f']);
 assert.equal(s.active.length,10);assert.equal(s.reserve.length,10);assert.equal(X.valid(s.active),true);assert.equal(X.valid(s.reserve),true);assert.equal(s.active.filter(Boolean).length,3);assert.equal(s.reserve.filter(Boolean).length,3);
 const instances=[...s.active,...s.reserve].filter(Boolean).map(u=>u.instanceId);assert.equal(new Set(instances).size,6);
});
test('moves and swaps are atomic, respect wide footprints and can cross teams',()=>{
 const s=create([unit('a',3),unit('b',2),unit('c',1),unit('d',2)],undefined,['a',null,null,'b',null,'c'],['d']),a=s.active[0];
 X.transfer(s,'active',0,'reserve',4);assert.equal(s.reserve[4],a);assert.equal(s.active[0],null);
 X.transfer(s,'active',5,'active',7);X.transfer(s,'reserve',4,'active',3);assert.equal(s.active[3],a);assert.equal(s.reserve[4].id,'b');
 const before=structuredClone(s);assert.throws(()=>X.transfer(s,'active',3,'reserve',10));assert.deepEqual(s,before);
 X.transfer(s,'active',3,'reserve',1);assert.equal(s.reserve[1],a);assert.equal(X.valid(s.active),true);assert.equal(X.valid(s.reserve),true);assert.equal(s.gold,before.gold);
});

test('wide units slide one cell through their own null footprint in either direction',()=>{
 for(const width of [2,3]){
  const s=create([unit('wide',width)],[],['wide']),member=s.active[0];
  X.transfer(s,'active',0,'active',1);assert.equal(s.active[1],member);assert.equal(s.active[0],null);assert.equal(s.active.filter(Boolean).length,1);
  assert.equal(X.valid(s.active),true);X.transfer(s,'active',1,'active',0);assert.equal(s.active[0],member);
 }
});

test('different-size swaps move only necessary neighbors into available space',()=>{
 const s=create([unit('a',3),unit('b'),unit('c')],[],['a',null,null,'c',null,null,'b']),a=s.active[0],b=s.active[6],c=s.active[3];
 X.transfer(s,'active',0,'active',6);
 assert.equal(s.active[4],a);assert.equal(s.active[0],b);assert.equal(s.active[3],c);assert.equal(X.valid(s.active),true);
 const cross=create([unit('small'),unit('neighbor'),unit('large',3)],[],['small','neighbor'],['large']);
 const neighbor=cross.active[1],large=cross.reserve[0];X.transfer(cross,'active',0,'reserve',0);
 assert.equal(cross.active[0],large);assert.equal(cross.active[3],neighbor);assert.equal(cross.reserve[0].id,'small');
 assert.equal(X.valid(cross.active),true);assert.equal(X.valid(cross.reserve),true);
});

test('interior target cells resolve their owner and impossible rearrangements stay atomic',()=>{
 const s=create([unit('a'),unit('b',3)],[],['a',null,null,'b']);
 X.transfer(s,'active',0,'active',4);assert.equal(s.active[5].id,'a');assert.equal(s.active.filter(Boolean).length,2);assert.equal(X.valid(s.active),true);
 const blocked=create([unit('a'),unit('b',3),unit('wall',9),unit('wall7',7)],[],['a','wall'],['b',null,null,'wall7']);X.shop(blocked,'keep-stock');
 const before=structuredClone(blocked);assert.throws(()=>X.transfer(blocked,'active',0,'reserve',0),/連續空間不足/);assert.deepEqual(blocked,before);
});

test('adjacent two- and three-cell roles exchange order without creating a gap',()=>{
 for(const [aWidth,bWidth] of [[2,3],[3,2]]){
  const ids=Array(10).fill(null);ids[0]='a';ids[aWidth]='b';ids[aWidth+bWidth]='wall';
  const s=create([unit('a',aWidth),unit('b',bWidth),unit('wall',5)],[],ids),a=s.active[0],b=s.active[aWidth],wall=s.active[5];
  X.transfer(s,'active',0,'active',aWidth);assert.equal(s.active[0],b);assert.equal(s.active[bWidth],a);assert.equal(s.active[5],wall);assert.equal(X.valid(s.active),true);
  X.transfer(s,'active',bWidth,'active',0);assert.equal(s.active[0],a);assert.equal(s.active[aWidth],b);assert.equal(s.active[5],wall);assert.equal(X.valid(s.active),true);
 }
});

test('cross-team drops slide toward a usable edge when the requested start cannot fit',()=>{
 const s=create([unit('a',4),unit('b',3),unit('wide',3)],[],['a',null,null,null,'b'],['wide']),wide=s.reserve[0];
 assert.equal(X.transferSlot(s,'reserve',0,'active',9),7);
 X.transfer(s,'reserve',0,'active',9);assert.equal(s.active[7],wide);assert.equal(s.reserve[0],null);assert.equal(X.valid(s.active),true);
 const split=create([unit('a',4),unit('b',3),unit('wide',3)],[],['a',null,null,null,'b'],['wide']);
 // Slot 2 is inside a, so the swap still resolves the whole four-cell target.
 X.transfer(split,'reserve',0,'active',2);assert.equal(X.valid(split.active),true);assert.equal(X.valid(split.reserve),true);
});

test('cross-team drop can push destination neighbors when a reverse swap cannot fit',()=>{
 const s=create([unit('a'),unit('b',3),unit('wall',9)],[],['a','wall'],['b']),a=s.active[0],b=s.reserve[0];
 X.transfer(s,'active',0,'reserve',0);assert.equal(s.reserve[0],a);assert.equal(s.reserve[1],b);assert.equal(s.active[0],null);assert.equal(X.valid(s.reserve),true);
});
test('equipment selection uses only active team and invalidates without silently replacing',()=>{
 const skills=[{...S.defaults[0],id:'a',conditions:[{kind:'slot',slot:1,field:'id',value:'hero'}]}, {...S.defaults[0],id:'b',conditions:[]}];
 const s=create([unit('hero')],skills,['hero']);assert.equal(s.skillId,null);assert.deepEqual(X.eligible(s).map(x=>x.id),['a','b']);X.equip(s,'b');assert.equal(s.skillId,'b');X.equip(s,'a');X.transfer(s,'active',0,'reserve',0);assert.equal(s.skillId,null);assert.equal(X.eligible(s).length,0);assert.throws(()=>X.equip(s,'a'));
 X.transfer(s,'reserve',0,'active',2);assert.deepEqual(X.eligible(s).map(x=>x.id),['b']);X.equip(s,'b');X.equip(s,null);assert.equal(s.skillId,null);
});
test('shop purchases clone stock, charge once and preserve sold stock on revisits',()=>{
 const s=X.create(),stock=X.shop(s,'2,1'),slot=stock.findIndex(Boolean),price=stock[slot].price,id=stock[slot].id,gold=s.gold;
 const at=X.buy(s,'2,1',slot,'reserve');assert.equal(s.gold,gold-price);assert.equal(s.reserve[at].id,id);assert.equal(stock[slot],null);assert.equal(X.shop(s,'2,1')[slot],null);assert.throws(()=>X.buy(s,'2,1',slot,'active'));assert.equal(s.gold,gold-price);
 assert.ok(X.shop(s,'3,1').some(Boolean));assert.equal(X.valid(s.reserve),true);
});
test('insufficient coins or contiguous capacity never loses gold or stock',()=>{
 const s=create([unit('wide',3)],undefined,['wide']),stock=X.shop(s,'a');s.gold=0;assert.throws(()=>X.buy(s,'a',0,'active'));assert.ok(stock[0]);assert.equal(s.gold,0);
 s.gold=300;s.reserve=Array(10).fill(null);for(const i of [0,2,4,6,8])s.reserve[i]={...unit('block'),instanceId:'block-'+i};
 const before=structuredClone(s);assert.throws(()=>X.buy(s,'a',0,'reserve'));assert.deepEqual(s,before);
});

test('exact purchase destinations reject overlaps and boundaries atomically',()=>{
 const s=create([unit('wide',3)],undefined,['wide']);X.shop(s,'exact');let before=structuredClone(s);
 assert.throws(()=>X.buy(s,'exact',0,'active',1));assert.deepEqual(s,before);
 assert.throws(()=>X.buy(s,'exact',0,'reserve',8));assert.deepEqual(s,before);
 X.buy(s,'exact',0,'reserve',5);assert.equal(s.reserve[5].id,'wide');assert.equal(s.gold,230);
});
test('selling a one-star SR refunds full price once and clears invalid equipped skill',()=>{
 const s=create([unit('hero',3)],undefined,['hero']);assert.equal(s.skillId,null);X.equip(s,X.eligible(s)[0].id);assert.ok(s.skillId);const gold=s.gold;
 assert.equal(X.sell(s,'active',0),70);assert.equal(s.gold,gold+70);assert.equal(s.active[0],null);assert.equal(s.skillId,null);
 const before=structuredClone(s);assert.throws(()=>X.sell(s,'active',0));assert.deepEqual(s,before);assert.throws(()=>X.sell(s,'stock',0));assert.deepEqual(s,before);
});

test('sale value adds rarity bonus per star above one after flooring the base refund',()=>{
 const config={...C.defaults,sellPercent:33,srExtraStarSellPrice:7,ssrExtraStarSellPrice:13,urExtraStarSellPrice:29};
 for(const [rarity,bonus] of [['SR',7],['SSR',13],['UR',29]])for(let stars=1;stars<=6;stars++){
  const actor={...unit('sale'),shopPrice:31,rarity,stars};
  assert.equal(X.sellValue(actor,config),rarity==='SR'&&stars===1?31:10+(stars-1)*bonus);
 }
 assert.equal(X.sellValue({...unit('zero'),shopPrice:0,rarity:'SR',stars:1},config),0);
 assert.equal(X.sellValue({...unit('zero'),rarity:'UR',stars:6},{...config,sellPercent:0,urExtraStarSellPrice:0}),0);
 assert.equal(X.sellValue({...unit('maximum'),shopPrice:1000000,rarity:'UR',stars:6},{...config,sellPercent:100,urExtraStarSellPrice:1000000}),6000000);
});

test('active and reserve sales use the run snapshot, ignore laws and pay only once',()=>{
 for(const area of ['active','reserve']){
  const config={...C.defaults,srExtraStarSellPrice:12,startingActive:['sale',...Array(9).fill(null)]};
  const state=X.create([unit('sale')],[],config);config.srExtraStarSellPrice=999;
  const actor={...state.active[0],stars:4,laws:[{name:'不增加賣價'}]};state.active[0]=null;state[area][0]=actor;
  const gold=state.gold;assert.equal(X.sellValue(actor,state.config),51);assert.equal(X.sell(state,area,0),51);assert.equal(state.gold,gold+51);
  const before=structuredClone(state);assert.throws(()=>X.sell(state,area,0));assert.deepEqual(state,before);
 }
});

const L=require('../js/laws.js');
const shopLaw=(extra={})=>({id:'power',name:'強化',shopPrice:50,shopWeight:100,stats:{damage:5,maxHp:20},passives:[],...extra});
test('law stock excludes zero weight, follows weighted rolls and retains each shop inventory',()=>{
 const laws=[shopLaw({id:'off',shopWeight:0}),shopLaw({id:'a',shopWeight:100}),shopLaw({id:'b',shopWeight:300})],s=X.create(D.defaults,[],{...C.defaults,shopCount:3},laws);
 laws[1].shopPrice=999;let rolls=[0,.25,.999,0];const stock=X.lawShop(s,'law',()=>rolls.shift());
 assert.deepEqual(stock.map(l=>l.id),['a','b','b','a']);assert.equal(stock[0].price,50);assert.equal(X.lawShop(s,'law'),stock);
 for(const shopCount of [0,1,10]){s.config.shopCount=shopCount;assert.equal(X.lawShop(s,'count-'+shopCount,()=>0).length,4);X.reroll(s,'count-'+shopCount,()=>0);assert.equal(X.lawShop(s,'count-'+shopCount).length,4);}
 assert.equal(X.lawShop(s,'other',()=>0)[0].id,'a');
 const empty=X.create(D.defaults,[],C.defaults,[shopLaw({shopWeight:0})]);assert.deepEqual(X.lawShop(empty,'none'),[]);
});
test('law purchase targets instances across rosters, stacks once per purchase and reaches battle snapshots',()=>{
 const s=X.create(D.defaults,[],{...C.defaults,startingActive:row(D.defaults[0].id,D.defaults[0].id)},[shopLaw()]),key='law';
 const id=s.active[0].instanceId,other=s.active[1].instanceId,baseDamage=s.active[0].effects[0].amount;X.lawShop(s,key,()=>0);
 X.buyLaw(s,key,0,id);X.transfer(s,'active',0,'reserve',4);X.buyLaw(s,key,1,id);
 const u=s.reserve[4];assert.equal(u.instanceId,id);assert.equal(u.maxHp,D.defaults[0].maxHp+40);assert.equal(u.effects[0].amount,baseDamage);assert.equal(u.outputBonuses.damage,10);assert.equal(u.laws.length,2);assert.equal(u.laws[0].id,u.laws[1].id);assert.equal(s.gold,200);
 assert.equal(s.active[1].instanceId,other);assert.equal(s.active[1].laws,undefined);
 assert.equal(X.lawShop(s,key)[0],null);assert.equal(D.runtime(u).maxHp,u.maxHp);
 u.laws[0].stats.damage=99;assert.equal(u.laws[1].stats.damage,5);assert.equal(s.lawLibrary[0].stats.damage,5);
});
test('failed law transactions retain gold, stock and both teams; full teams can buy laws',()=>{
 const s=X.create(D.defaults,[],C.defaults,[shopLaw()]),key='law',id=s.active[0].instanceId;X.lawShop(s,key,()=>0);
 for(const action of [()=>X.buyLaw(s,key,0,'missing'),()=>X.buyLaw(s,key,999,id)]){const before=structuredClone(s);assert.throws(action);assert.deepEqual(s,before);}
 s.gold=0;let before=structuredClone(s);assert.throws(()=>X.buyLaw(s,key,0,id));assert.deepEqual(s,before);
 s.gold=300;s.active[0].laws=[{...shopLaw(),stats:{maxHp:'invalid'}}];before=structuredClone(s);assert.throws(()=>X.buyLaw(s,key,0,id));assert.deepEqual(s,before);
 s.active[0].laws=[];for(let i=1;i<10;i++)s.active[i]={...D.defaults[0],instanceId:'full-'+i};s.reserve=s.active.map(u=>({...u,instanceId:'reserve-'+u.instanceId}));
 X.buyLaw(s,key,0,id);before=structuredClone(s);assert.throws(()=>X.buyLaw(s,key,0,id));assert.deepEqual(s,before);assert.equal(s.active.filter(Boolean).length,10);assert.equal(s.reserve.filter(Boolean).length,10);
 const free=X.create(D.defaults,[],C.defaults,[shopLaw({shopPrice:0})]);free.gold=0;X.lawShop(free,'free',()=>0);X.buyLaw(free,'free',0,free.active[0].instanceId);assert.equal(free.gold,0);
});

test('manual merge consumes the dragged instance, keeps the target position and all law copies',()=>{
 const char={...unit('merge',2),growth:Array.from({length:5},()=>({maxHp:10,damage:2}))},items=D.validate({version:2,items:[char],jobGrowth:{破陣:char.growth}}).items;
 const s=create(items,[],['merge',null,null,null,'merge']),source=s.active[0],target=s.active[4],law=shopLaw({stats:{maxHp:3,damage:1}});
 s.active[0]=L.attach(source,Array(60).fill(law));s.active[4]=L.attach(target,Array(60).fill(law));const gold=s.gold;
 const upgraded=X.transfer(s,'active',0,'active',4);
 assert.equal(s.active[0],null);assert.equal(s.active[4].instanceId,target.instanceId);assert.equal(upgraded.stars,2);assert.equal(upgraded.space,2);assert.equal(upgraded.laws.length,120);assert.equal(upgraded.maxHp,char.maxHp+10+360);assert.equal(upgraded.effects[0].amount,char.effects[0].amount);assert.equal(upgraded.outputBonuses.damage,122);assert.equal(s.gold,gold);assert.equal(X.valid(s.active),true);
 upgraded.laws[0].stats.maxHp=999;assert.equal(upgraded.laws[1].stats.maxHp,3);assert.equal(s.library[0].maxHp,char.maxHp);
});
test('cross-roster merge adds exactly one growth step, caps at six and leaves mismatches as swaps',()=>{
 const s=create([unit('a'),unit('b')],[],['a'],['a']),targetId=s.reserve[0].instanceId;
 const base=s.library.find(u=>u.id==='a');s.active[0]=L.attach(D.atStars(base,5,s.config),[]);s.active[0].instanceId='source-five';s.reserve[0]=L.attach(D.atStars(base,5,s.config),[]);s.reserve[0].instanceId=targetId;
 X.transfer(s,'active',0,'reserve',0);assert.equal(s.active[0],null);assert.equal(s.reserve[0].stars,6);assert.equal(s.reserve[0].instanceId,targetId);
 s.active[0]={...structuredClone(s.reserve[0]),instanceId:'other-six'};assert.equal(X.canMerge(s.active[0],s.reserve[0]),false);let before=structuredClone(s);assert.throws(()=>X.merge(s,'active',0,'reserve',0));assert.deepEqual(s,before);
 X.transfer(s,'active',0,'reserve',0);assert.equal(s.active[0].instanceId,targetId);assert.equal(s.reserve[0].instanceId,'other-six');
 s.active[0]={...D.atStars(base,1,s.config),instanceId:'one'};const old=s.reserve[0];X.transfer(s,'active',0,'reserve',0);assert.equal(s.active[0],old);assert.equal(s.reserve[0].stars,1);
 s.active[0]={...s.library.find(u=>u.id==='b'),instanceId:'b'};X.transfer(s,'active',0,'reserve',0);assert.equal(s.reserve[0].id,'b');
});
test('invalid merge is atomic and merging can invalidate equipped team skill',()=>{
 const s=create([unit('a')],[],['a','a']);
 s.skills=S.validate({version:1,skills:[{...S.defaults[0],conditions:[{kind:'slot',slot:1,field:'id',value:'a'}]}]}).skills;X.equip(s,s.skills[0].id);
 const law=shopLaw({stats:{maxHp:'bad'}});s.active[0].laws=[law];const before=structuredClone(s);assert.throws(()=>X.transfer(s,'active',0,'active',1));assert.deepEqual(s,before);
 s.active[0].laws=[];X.transfer(s,'active',0,'active',1);assert.equal(s.skillId,null);
});
test('ordinary buy never auto-merges and recruitment still needs contiguous space',()=>{
 const s=create([unit('a',2)],[],['a']);X.shop(s,'no-auto',()=>0);const before=structuredClone(s);assert.throws(()=>X.buy(s,'no-auto',0,'active',0));assert.deepEqual(s,before);
 X.buy(s,'no-auto',0,'reserve',0);assert.equal(s.active[0].stars,1);assert.equal(s.reserve[0].stars,1);
 const item=s.library[0];for(const area of ['active','reserve'])s[area]=Array.from({length:10},(_,i)=>i%2===0?{...unit('block'),instanceId:area+i}:null);
 const full=structuredClone(s);assert.throws(()=>X.recruit(s,item),/整備隊伍/);assert.deepEqual(s,full);
});

test('explicit shop merge works with both teams full, preserves the target identity and inherits all laws',()=>{
 for(const area of ['active','reserve']){
  const char={...unit('merge-buy',2),growth:Array.from({length:5},()=>({maxHp:10,damage:2}))};
  const items=D.validate({version:2,items:[char],jobGrowth:{破陣:char.growth}}).items;
  const full=['merge-buy',null,'merge-buy',null,'merge-buy',null,'merge-buy',null,'merge-buy',null];
  const state=create(items,[],full,full),stock=X.shop(state,'merge-buy',()=>0),law=shopLaw({stats:{maxHp:3,damage:1}});
  state[area][0]=L.attach(state[area][0],Array(60).fill(law));stock[0]=L.attach(stock[0],Array(60).fill(law));
  const identity=state[area][0].instanceId,gold=state.gold,serial=state.serial,price=stock[0].price,others=state[area].slice(2);
  const upgraded=X.buyAndMerge(state,'merge-buy',0,area,1); // Covered null cell resolves to its owner.
  assert.equal(upgraded,state[area][0]);assert.equal(upgraded.instanceId,identity);assert.equal(upgraded.stars,2);
  assert.equal(upgraded.laws.length,120);assert.equal(upgraded.maxHp,char.maxHp+10+360);assert.equal(upgraded.outputBonuses.damage,122);
  assert.equal(state.gold,gold-price);assert.equal(state.serial,serial);assert.equal(stock[0],null);assert.equal(upgraded.price,undefined);
  assert.deepEqual(state[area].slice(2),others);assert.equal(state[area][1],null);assert(X.valid(state.active)&&X.valid(state.reserve));
  const before=structuredClone(state);assert.throws(()=>X.buyAndMerge(state,'merge-buy',0,area,0));assert.deepEqual(state,before);
 }
});

test('shop merge failures preserve gold, serial, inventory, both teams and skill selection',()=>{
 const cases=[
  s=>s.gold=0,
  s=>s.active[0].id='b',
  s=>s.active[0].stars=2,
  s=>{s.active[0].stars=6;s.shops.atomic[0].stars=6;},
  s=>s.active[0]=null,
  s=>s.shops.atomic[0]=null,
  s=>s.active[0].laws=[shopLaw({stats:{maxHp:'invalid'}})],
  s=>s.shops.atomic[0].laws=[shopLaw({stats:{maxHp:'invalid'}})],
  s=>s.library=[]
 ];
 for(const alter of cases){
  const state=create([unit('a'),unit('b')],[],['a']);X.shop(state,'atomic',()=>0);alter(state);
  const before=structuredClone(state);assert.throws(()=>X.buyAndMerge(state,'atomic',0,'active',0));assert.deepEqual(state,before);
 }
 const wide=create([unit('a',2)],[],['a']);X.shop(wide,'wide',()=>0);wide.active[9]={...wide.active[0],space:1};wide.active[0]=null;
 const before=structuredClone(wide);assert.throws(()=>X.buyAndMerge(wide,'wide',0,'active',9),/無法放入/);assert.deepEqual(wide,before);
 assert.throws(()=>X.buyAndMerge(wide,'unopened',0,'active',9));assert.deepEqual(wide,before);
 for(const [area,slot] of [['stock',0],['active',10],['reserve',-1]]){assert.throws(()=>X.buyAndMerge(wide,'wide',0,area,slot));assert.deepEqual(wide,before);}
});

test('free explicit shop merge upgrades five to six stars and rechecks equipped skills',()=>{
 const state=create([{...unit('a'),shopPrice:0}],[],['a']);X.shop(state,'free-merge',()=>0);state.gold=0;
 state.skills=S.validate({version:1,skills:[{...S.defaults[0],conditions:[{kind:'count',field:'stars',value:'5',op:'gte',count:1}]}]}).skills;
 state.active[0].stars=5;state.shops['free-merge'][0].stars=5;X.equip(state,state.skills[0].id);
 X.buyAndMerge(state,'free-merge',0,'active',0);assert.equal(state.active[0].stars,6);assert.equal(state.gold,0);assert.equal(state.skillId,null);
});
