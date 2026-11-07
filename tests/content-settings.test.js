const {test}=require('node:test'),assert=require('node:assert/strict'),D=require('../js/database.js'),X=require('../js/expedition.js'),E=require('../js/enemy-teams.js'),J=require('../js/journey.js'),H=require('../js/hex-map.js');
const config=(active=[])=>({...require('../js/config.js').defaults,startingActive:[...active,...Array(10-active.length).fill(null)],startingReserve:Array(10).fill(null)});
const actor=(id,extra={})=>({...D.defaults[0],id,...extra});
test('economy fields are required, accept zero, reject invalid values',()=>{
 const legacy=actor('legacy',{space:3});delete legacy.shopPrice;delete legacy.shopWeight;assert.throws(()=>D.validate({version:2,items:[legacy]}));
 assert.equal(D.validate({version:2,items:[actor('free',{shopPrice:0,shopWeight:0})]}).items[0].shopPrice,0);
 for(const field of ['shopPrice','shopWeight'])for(const value of [-1,.5,Infinity,'10'])assert.throws(()=>D.validate({version:2,items:[actor('bad',{[field]:value})]}));
});
test('shops draw weighted characters with replacement, exclude zero and use configured prices',()=>{
 const s=X.create([actor('never',{shopWeight:0}),actor('a',{shopWeight:1,shopPrice:83}),actor('b',{shopWeight:3,shopPrice:20})],undefined,config());
 const low=X.shop(s,'low',()=>.24),high=X.shop(s,'high',()=>.26);assert.ok(low.filter(Boolean).every(u=>u.id==='a'&&u.price===83));assert.ok(high.filter(Boolean).every(u=>u.id==='b'));assert.equal(low.filter(Boolean).length,8);
 const slot=X.buy(s,'low',0,'reserve',0);assert.equal(s.gold,217);assert.equal(X.sell(s,'reserve',slot),83);assert.equal(s.gold,300);
 const empty=X.create([actor('disabled',{shopWeight:0})],undefined,config());assert.equal(X.shop(empty,'empty').filter(Boolean).length,0);
});
test('enemy categories have separate weighted pools and enforce valid references and footprints',()=>{
 const items=[actor('a',{space:2}),actor('b')],slots=[items[0].id,null,...Array(8).fill(null)];
 const data={version:1,teams:[{id:'a',name:'A',category:'normal',weight:1,slots},{id:'b',name:'B',category:'normal',weight:3,slots},{id:'off',name:'Off',category:'boss',weight:0,slots}]};
 assert.equal(E.pick(data,'normal',items,()=>.24).team.id,'a');assert.equal(E.pick(data,'normal',items,()=>.26).team.id,'b');assert.throws(()=>E.pick(data,'boss',items));
 assert.throws(()=>E.formation({...data.teams[0],slots:['a','b',...Array(8).fill(null)]},items));assert.throws(()=>E.formation(data.teams[0],[]));assert.throws(()=>E.validate({...data,teams:[{...data.teams[0],weight:-1}]}));
});
test('journey uses saved map settings, enemy teams, reward policy and stable retries; boss gates victory',()=>{
 const items=[actor('hero')],settings={version:1,radius:2,seed:'EDITED',rules:H.defaults(2),rewardDecay:H.decayDefaults},teams=E.defaults(items);
 const s=J.create(items,undefined,'ignored',settings,teams,config(['hero']));assert.equal(Object.keys(s.map.map.cells).length,19);assert.equal(s.map.map.seed,'EDITED');assert.deepEqual(s.map.map.rules,settings.rules);
 const id=H.neighbors(s.map.map,s.map.current)[0];s.map.map.cells[id].type='goal';J.move(s,id);assert.equal(s.map.complete,false);assert.equal(s.map.pending,id);
 const p=J.start(s);assert.equal(p.enemyName,'BOSS守衛');assert.equal(p.loadouts[1][0].maxHp,180);J.settle(s,{token:p.token,winner:1,hp:[0]});assert.ok(J.move(s,id));const again=J.start(s);assert.deepEqual(again.loadouts[1],p.loadouts[1]);J.settle(s,{token:again.token,winner:0,hp:[80]});assert.equal(s.map.complete,true);assert.equal(s.roster.gold,450);
});
