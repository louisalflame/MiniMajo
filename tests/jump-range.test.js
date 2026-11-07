const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../js/battle.js'),E=require('../js/effects.js'),D=require('../js/database.js'),Saved=require('../js/saved-data.js');
const unit=(effects=[],extra={})=>({...D.defaults[0],maxHp:100,cooldown:120,effects,...extra});
const row=(...entries)=>{const a=Array(10).fill(null);for(const [i,u] of entries)a[i]=u;return a;};
const create=(a,b)=>B.create([a,b],[],[10,10],{footprints:true});
const rule=(mode='primary',extra={})=>({side:'enemy',mode,range:'limited',targetCond:[],...extra});
const jump=E.validate({type:'jump'});

test('character range restricts nearest targets regardless of legacy unlimited policy',()=>{
 const s=create(row([0,unit()]),row([5,unit()])),a=s.teams[0].units[0];
 for(const mode of ['primary','all','random','lowestHp','lowestHpRatio','highestPosture']){
  const e=E.validate({type:'damage',amount:1,targets:[rule(mode)],range:1});
  assert.equal(B.recipients(s,0,a,e,null).length,mode==='primary'?0:1);
  assert.match(E.describe(e),mode==='primary'?/角色攻擊距離/:/不限距離/);
 }
 const e=E.validate({type:'damage',amount:1,targets:[rule('primary',{range:'unlimited'})]});assert.equal(B.recipients(s,0,a,e,null).length,0);a.attackRange=6;assert.equal(B.recipients(s,0,a,e,null).length,1);
});
test('jump crosses allies and immediately enables follow-up from its new position',()=>{
 const s=create(row([0,unit([jump,{type:'damage',amount:10}],{cooldown:.1})],[2,unit()]),row([6,unit()]));
 const a=s.teams[0].units[0];B.step(s);assert.equal(a.slot,6);assert.equal(a.startSlot,0);assert.equal(a.stats.actions,1);assert.equal(s.teams[1].units[0].hp,90);assert.equal(s.teams[0].items[0],null);
});
test('jump filters occupied landing areas before choosing an enemy',()=>{
 const s=create(row([0,unit([jump],{cooldown:.1})],[2,unit([],{space:2})]),row([3,unit()],[7,unit()]));
 B.step(s);assert.equal(s.teams[0].units[0].slot,7);
});
test('wide jump rejects overflow, overlap and current position atomically',()=>{
 for(const [enemySlot,block] of [[9,null],[4,5],[0,null]]){
  const s=create(row([0,unit([],{space:2})],...(block===null?[]:[[block,unit()]])),row([enemySlot,unit()]));
  const a=s.teams[0].units[0],b=s.teams[1].units[0],before=s.teams[0].items.slice();assert.equal(B.jump(s,0,a,b),false);assert.deepEqual(s.teams[0].items,before);assert.equal(a.slot,0);
 }
});
test('dead allies free landing cells but retain statistics and identity',()=>{
 const s=create(row([0,unit([jump],{cooldown:.1,space:2})],[5,unit([],{space:2})]),row([5,unit()]));
 const dead=s.teams[0].units[1];dead.hp=0;B.step(s);assert.equal(s.teams[0].items[5],s.teams[0].units[0]);assert.ok(s.teams[0].units.includes(dead));assert.equal(dead.startSlot,5);assert.equal(B.layoutValid(s.teams[0].items),true);
});
test('failed main jump uses movement and suppresses other effects',()=>{
 const s=create(row([0,unit([jump,{type:'shield',amount:5}],{cooldown:.1})],[4,unit()]),row([4,unit()]));B.step(s);assert.equal(s.teams[0].units[0].slot,1);assert.equal(s.teams[0].units[0].shield,0);
});
test('jump validates single enemy targeting, retains conditions, and repairs malformed data',()=>{
 for(const targets of [[rule('all')],[rule('primary',{side:'ally'})],[rule(),rule()]])assert.throws(()=>E.validate({type:'jump',targets}));
 const e=E.validate({type:'jump',targets:[rule('random',{targetCond:[{field:'job',op:'eq',value:'支援'}]})]});assert.equal(e.amount,undefined);
 assert.deepEqual(D.validate({version:2,items:[unit([e])]}).items[0].effects,[e]);
 const raw={version:2,items:[unit([{...e,targets:[{...e.targets[0],side:'bad',mode:'all'}]}])]},warnings=[];
 const fixed=Saved.characters(raw,warnings).items[0].effects[0];assert.equal(fixed.type,'jump');assert.equal(fixed.targets[0].side,'enemy');assert.equal(fixed.targets[0].mode,'primary');assert.equal(fixed.targets[0].targetCond[0].value,'支援');assert.ok(warnings.length>0);
 const repaired=Saved.characters({version:2,items:[unit([{type:'jump',targeting:{side:'ally',mode:'all'}}])]},warnings).items[0].effects[0];assert.equal(repaired.targeting.side,'enemy');assert.equal(repaired.targeting.mode,'primary');
});
test('manual skill retargets a distant survivor after opposite enemy dies, for legacy and new effects',()=>{
 for(const main of [{type:'damage',amount:10},E.validate({type:'damage',amount:10,targets:[rule()]})]){
  const s=create(row([0,unit([],{attackRange:10})]),row([0,unit()],[8,unit()]));s.teams[1].units[0].hp=0;s.started=true;
  s.teams[0].skill={enabled:true,name:'技能',cooldown:3,effects:[main,{type:'shield',amount:5}]};
  assert.equal(B.cast(s,0),true);assert.equal(s.teams[1].units[1].hp,90);assert.equal(s.teams[0].units[0].shield,5);assert.equal(s.teams[0].units[0].slot,0);assert.equal(s.teams[0].skillReady,30);
 }
});
test('manual skill still respects target and activation conditions',()=>{
 for(const gated of [true,false]){
  const s=create(row([0,unit()]),row([8,unit()]));s.started=true;
  const main=E.validate({type:'damage',amount:10,targets:[rule('primary',{targetCond:gated?[]:[{field:'down',value:true}]})],cond:gated?[{subject:'self',field:'injured',value:true}]:[]});
  s.teams[0].skill={enabled:true,name:'技能',cooldown:3,effects:[main,{type:'shield',amount:5}]};assert.equal(B.cast(s,0),true);assert.equal(s.teams[1].units[0].hp,100);assert.equal(s.teams[0].units[0].shield,0);assert.equal(s.teams[0].skillReady,30);
 }
});
test('later legacy effect finds another live enemy after the main kills its initial target',()=>{
 const s=create(row([0,unit([],{attackRange:10})]),row([0,unit()],[8,unit()]));s.started=true;s.teams[0].skill={enabled:true,name:'技能',cooldown:3,effects:[{type:'damage',amount:100},{type:'damage',amount:7}]};B.cast(s,0);assert.equal(s.teams[1].units[0].hp,0);assert.equal(s.teams[1].units[1].hp,93);
});

test('jump effects already facing their target continue without a movement event',()=>{
 const hit=E.validate({type:'damage',amount:10,targets:[{side:'enemy',base:'main',mode:'target'}]});
 const s=create(row([1,unit([jump,hit],{cooldown:.1,space:2})]),row([2,unit()]));
 B.step(s);
 assert.equal(s.teams[0].units[0].slot,1);
 assert.equal(s.teams[1].units[0].hp,90);
 assert.equal(s.events.some(e=>/跳到|互換|移動/.test(e.detail)),false);
});

test('optional landing swap preserves selected target and rejects illegal wide placements',()=>{
 const effect=E.validate({targets:[rule('lowestHp')],actions:[{type:'jump',swapFallback:true},{type:'damage',amount:10}]});
 const s=create(row([0,unit([effect],{cooldown:.1})],[4,unit()]),row([4,unit()],[7,unit()]));
 s.teams[1].units[0].hp=50;
 B.step(s);
 assert.deepEqual(s.teams[0].units.map(u=>u.slot),[4,0]);
 assert.deepEqual(s.teams[1].units.map(u=>u.hp),[40,100]);
 assert.ok(s.events.some(e=>e.detail.includes('互換位置')));
 const blocked=create(row([0,unit([effect],{space:2})],[4,unit()],[5,unit()]),row([4,unit()]));
 assert.deepEqual(B.recipients(blocked,0,blocked.teams[0].units[0],effect,null),[]);
 const warnings=[];
 const saved=Saved.characters({version:2,items:[unit([{...effect,actions:[{type:'jump',swapFallback:'bad'},{type:'damage',amount:10}]}])]},warnings);
 assert.equal(saved.items[0].effects[0].actions[0].swapFallback,false);
 assert.ok(warnings.some(w=>w.includes('swapFallback')));
});
