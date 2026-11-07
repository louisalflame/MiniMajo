const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../js/echo-levels.js'),X=require('../js/expedition.js'),D=require('../js/database.js'),C=require('../js/config.js'),J=require('../js/journey.js'),R=require('../js/saved-data.js'),Backup=require('../js/editor-backup.js');
const echo={version:1,levels:[{SR:1,SSR:0,UR:0},{SR:0,SSR:0,UR:1}]};
const actor=(id,rarity='SR',weight=100,space=1)=>({...D.defaults[0],id,name:id,rarity,shopWeight:weight,space});
const config={...C.defaults,startingActive:['s',...Array(9).fill(null)],shopCount:2};
const items=[actor('s'),actor('ss','SSR'),actor('u','UR')];
const law={id:'law',name:'法則',shopPrice:5,shopWeight:1,stats:{maxHp:1},passives:[]};
test('rarity is rolled before character weight, independently of tier population and total character weight',()=>{
 const table={version:1,levels:[{SR:1,SSR:0,UR:1}]},pool=[...Array.from({length:100},(_,i)=>actor('s'+i,'SR',1000000)),actor('u','UR',1),actor('off','SSR',1000000)];
 let rolls=[.49999,.99];assert.equal(E.pick(pool,table,1,()=>rolls.shift()).rarity,'SR');
 rolls=[.5,0];assert.equal(E.pick(pool,table,1,()=>rolls.shift()).id,'u');
 const same=[actor('a','UR',1),actor('b','UR',3)];rolls=[0,.25];assert.equal(E.pick(same,table,1,()=>rolls.shift()).id,'b');
 assert.equal(E.pick([actor('off','UR',0)],table,1,()=>0),null);
 assert.equal(E.pick([actor('only','UR')],table,1,()=>0).id,'only');
 assert.equal(E.pick([actor('disabled','SSR')],table,1,()=>0),null);
});
test('echo validates every weight and keeps legal zeros; incompatible metadata remains readable',()=>{
 assert.deepEqual(E.validate({...echo,version:99}),echo);
 for(const invalid of [[],null,Array(101).fill({SR:1,SSR:0,UR:0}),[{SR:0,SSR:0,UR:0}]])assert.throws(()=>E.validate({levels:invalid}));
 for(const v of [-1,.5,1000001,Infinity,'1',undefined])assert.throws(()=>E.validate({levels:[{SR:v,SSR:0,UR:1}]}));
 assert.equal(E.describe(echo,1),'SR 100% ／ SSR 0% ／ UR 0%');
});
test('shops and loot share echo levels; old stock remains and new rolls use upgraded rarity',()=>{
 const s=X.create(items,[],config,[],echo),original=structuredClone(echo),old=X.shop(s,'a',()=>0);assert.ok(old.filter(Boolean).every(u=>u.rarity==='SR'));
 echo.levels[0].UR=999;assert.deepEqual(s.echoSettings,original);echo.levels[0].UR=0;
 assert.ok(J.rollRewards(s,()=>0).every(u=>u.rarity==='SR'));assert.equal(X.upgradeEcho(s),true);
 assert.equal(X.shop(s,'a'),old);assert.ok(X.shop(s,'b',()=>0).filter(Boolean).every(u=>u.rarity==='UR'));assert.ok(J.rollRewards(s,()=>0).every(u=>u.rarity==='UR'));
 assert.equal(X.upgradeEcho(s),false);assert.equal(s.echoLevel,2);
 const wide=X.create([actor('s'),actor('u','UR',100,11)],[],config,[],{version:1,levels:[{SR:1,SSR:0,UR:100}]});assert.ok(X.shop(wide,'wide',()=>.99).filter(Boolean).every(u=>u.rarity==='SR'));
});
test('reroll replaces both stock types atomically and grows cost per shop without touching owned roles',()=>{
 const s=X.create(items,[],{...config,shopRerollBase:30,shopRerollIncrement:7},[law],echo);X.shop(s,'a',()=>0);X.lawShop(s,'a',()=>0);X.buy(s,'a',0,'reserve');X.buyLaw(s,'a',0,s.active[0].instanceId);
 const owned=structuredClone({active:s.active,reserve:s.reserve}),gold=s.gold;X.upgradeEcho(s);
 assert.equal(X.reroll(s,'a',()=>0),30);assert.equal(s.gold,gold-30);assert.ok(s.shops.a.filter(Boolean).every(u=>u.rarity==='UR'));assert.ok(s.lawShops.a.every(Boolean));assert.deepEqual({active:s.active,reserve:s.reserve},owned);
 assert.equal(X.rerollCost(s,'a'),37);assert.equal(X.rerollCost(s,'b'),30);X.reroll(s,'a',()=>0);assert.equal(X.rerollCost(s,'a'),44);assert.equal(X.rerollCost(s,'b'),30);
 const before=structuredClone(s);let count=0;assert.throws(()=>X.reroll(s,'a',()=>{if(++count===5)throw Error('random failed');return 0;}));assert.deepEqual(s,before);
 s.gold=0;const poor=structuredClone(s);assert.throws(()=>X.reroll(s,'a'),/金幣不足/);assert.deepEqual(s,poor);
 const free=X.create(items,[],{...config,shopRerollBase:0,shopRerollIncrement:0},[],echo);free.gold=0;X.reroll(free,'__proto__',()=>0);assert.equal(X.rerollCost(free,'__proto__'),0);assert.equal(free.gold,0);assert.equal(free.shops.__proto__.length,10);
});
test('reroll with no eligible stock does not charge or increase price',()=>{
 const s=X.create(items,[],{...config,shopCount:0},[],echo),before=structuredClone(s);assert.throws(()=>X.reroll(s,'empty'),/沒有可抽選/);assert.deepEqual(s,before);
});
test('camp upgrades exactly once, caps at the configured last level and does not reroll old shops',()=>{
 const run=J.create(items,[],'camp',null,null,config,[],echo),stock=X.shop(run.roster,'old',()=>0),rests=Object.keys(run.map.map.cells).filter(id=>run.map.map.cells[id].type==='rest');
 run.map.pending=rests[0];assert.equal(J.resolve(run),true);assert.equal(run.roster.echoLevel,2);assert.equal(J.resolve(run),false);assert.equal(X.shop(run.roster,'old'),stock);
 run.map.pending=rests[1];assert.equal(J.resolve(run),true);assert.equal(run.roster.echoLevel,2);
});
test('echo and reroll settings repair fields individually, preserve source and survive complete backup',()=>{
 const source={version:99,levels:[{SR:0,SSR:'bad',UR:3},{SR:0,SSR:0,UR:0},null]},before=structuredClone(source),warnings=[],clean=R.echo(source,warnings);
 assert.deepEqual(clean.levels[0],{SR:0,SSR:0,UR:3});assert.deepEqual(clean.levels[1],{SR:100,SSR:0,UR:0});assert.equal(clean.levels.length,3);assert.deepEqual(source,before);assert.ok(warnings.some(w=>w.includes('SSR')));
 const legacy={...C.defaults};delete legacy.shopRerollBase;legacy.shopRerollIncrement=0;const loaded=R.config(legacy,warnings);assert.equal(loaded.shopRerollBase,20);assert.equal(loaded.shopRerollIncrement,0);
 const store=new Map(),storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},file=Backup.collect(storage);file.data.echo=clean;Backup.restore(storage,file);assert.deepEqual(Backup.collect(storage).data.echo,clean);
 delete file.data.echo;const prepared=Backup.prepare(file);assert.deepEqual(prepared.file.data.echo,E.defaults);assert.ok(prepared.warnings.some(w=>w.includes('echo')));
 const raw=JSON.stringify(source);R.read('echo',{getItem:()=>raw,setItem:()=>assert.fail('read must not write')},[]);
});
