const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../js/battle.js'),E=require('../js/effects.js'),D=require('../js/database.js'),Saved=require('../js/saved-data.js'),Status=require('../js/statuses.js');
const rule=(side='enemy',mode='primary',targetCond=[],extra={})=>({side,mode,range:'limited',targetCond,targetCondMode:'all',...extra});
const effect=(type='damage',amount=10,targets=[rule()],cond=[])=>E.validate({type,amount,targets,cond,condMode:'all'});
const unit=(effects=[],extra={})=>({...D.defaults[0],cooldown:.1,maxHp:100,moveDistance:2,effects,...extra});
const row=(...pairs)=>{const a=Array(10).fill(null);for(const [i,u] of pairs)a[i]=u;return a;};
const create=(own,enemy)=>B.create([own,enemy],[],[10,10],{footprints:true});
const injured={field:'injured',op:'eq',value:true},down={field:'down',op:'eq',value:true};

test('main without candidates moves and suppresses every secondary, then attacks next cooldown',()=>{
 const s=create(row([0,unit([effect(),effect('shield',9,[rule('ally','self')])])]),row([2,unit([],{cooldown:120})]));
 B.step(s);const a=s.teams[0].units[0];assert.equal(a.slot,2);assert.equal(a.shield,0);assert.equal(a.stats.actions,1);assert.equal(s.teams[1].units[0].hp,100);
 B.step(s);assert.equal(a.shield,9);assert.equal(s.teams[1].units[0].hp,90);
});
test('failed main condition moves toward filtered allies, excludes self and respects occupied cells',()=>{
 const main=effect('heal',10,[rule('ally','self')],[{subject:'self',field:'hpRatio',op:'lt',value:50}]);
 const a=unit([main,effect('shield',9,[rule('ally','self')])],{movement:rule('ally','lowestHp',[injured])});
 const s=create(row([0,a],[4,unit([],{cooldown:120})]),row([0,unit([],{cooldown:120})]));s.teams[0].units[1].hp=20;
 B.step(s);assert.equal(s.teams[0].units[0].slot,2);assert.equal(s.teams[0].units[0].shield,0);assert.equal(s.teams[0].units[1].hp,20);
 B.step(s);assert.equal(s.teams[0].units[0].slot,3);B.step(s);assert.equal(s.teams[0].units[0].slot,3);assert.equal(s.teams[0].units[0].stats.actions,3);
});
test('no movement candidate and blocked route both consume a failed main action',()=>{
 for(const blocked of [false,true]){
  const a=unit([effect('heal',5,[])],{movement:rule('ally','primary')});
  const s=create(row([0,a],...(blocked?[[1,unit([],{cooldown:120})],[4,unit([],{cooldown:120})]]:[])),row([0,unit([],{cooldown:120})]));
  B.step(s);assert.equal(s.teams[0].units[0].slot,0);assert.equal(s.teams[0].units[0].nextAction,2);
 }
});
test('secondary failure does not move or prevent later secondaries; zero main still succeeds',()=>{
 const s=create(row([0,unit([effect('damage',{formula:'0'}),effect('heal',10,[rule('ally','all',[injured])]),effect('shield',7,[rule('ally','self')])])]),row([0,unit([],{cooldown:120})]));
 B.step(s);assert.equal(s.teams[0].units[0].shield,7);assert.equal(s.teams[0].units[0].slot,0);
});
test('target groups merge by battle identity and complete main before secondary once',()=>{
 const all=rule('enemy','all',[],{range:'unlimited'}),main=effect('damage',10,[all,all]);
 const s=create(row([0,unit([main,effect('shield',5,[rule('ally','self')])])]),row([0,unit([],{cooldown:120})],[3,unit([],{cooldown:120,space:2})]));
 B.step(s);assert.deepEqual(s.teams[1].units.map(u=>u.hp),[90,90]);assert.equal(s.teams[0].units[0].shield,5);
});
test('immediate posture, damage, healing and status changes are visible to later effects',()=>{
 const poison=E.validate({type:'status',status:'poison',amount:1,duration:{kind:'seconds',value:5},targets:[rule('enemy','primary',[down])]});
 const s=create(row([0,unit([effect('posture',100),poison,effect('damage',10,[rule('enemy','primary',[{field:'hasStatus',op:'eq',value:'poison'}])]),effect('heal',{formula:'target.missingHp'},[rule('enemy','primary')])])]),row([0,unit([],{cooldown:120})]));
 B.step(s);const b=s.teams[1].units[0];assert.equal(b.hp,100);assert.equal(b.weakUntil,41);assert.ok(Status.has(b,'poison'));assert.equal(s.teams[0].units[0].stats.damage,15);assert.equal(s.teams[0].units[0].stats.heal,15);
});
test('conditions combine all/any, count living candidates and retain zero and false',()=>{
 const s=create(row([0,unit()],[2,unit()]),row([0,unit()]));const a=s.teams[0].units[0];
 const e=effect('heal',1,[rule('ally','self')],[{subject:'count',side:'ally',op:'eq',value:0,targetCond:[injured]}, {subject:'self',field:'down',op:'eq',value:false}]);
 assert.equal(E.eligible(e,s,0,a,null),true);s.teams[0].units[1].hp=90;assert.equal(E.eligible(e,s,0,a,null),false);e.condMode='any';assert.equal(E.eligible(e,s,0,a,null),true);
 const t=rule('enemy','all',[injured,down],{targetCondMode:'any'});s.teams[1].units[0].weakUntil=30;
 assert.equal(B.recipients(s,0,a,effect('damage',1,[t]),null).length,1);s.teams[1].units[0].hp=0;assert.equal(B.recipients(s,0,a,effect('damage',1,[t]),null).length,0);
});
test('a newly stunned or killed scheduled actor does not act or consume action-duration buffs',()=>{
 for(const kill of [false,true]){
  const hit=kill?effect('damage',100):E.validate({type:'status',status:'stun',amount:1,duration:{kind:'seconds',value:2},targets:[rule()]});
  const s=create(row([0,unit([effect()])]),row([0,unit([hit])]));const a=s.teams[0].units[0];
  Status.apply(a,{status:'power',duration:{kind:'actions',value:2}},5,0);B.step(s);
  assert.equal(a.stats.actions,0);assert.equal(s.teams[1].units[0].hp,100);if(!kill)assert.equal(a.statuses.find(x=>x.kind==='power').remaining,2);
 }
});
test('team manual skill obeys caster range and consumes cooldown without moving',()=>{
 const s=create(row([0,unit([],{cooldown:120})]),row([6,unit([],{cooldown:120})]));
 s.teams[0].skill={enabled:true,name:'技能',cooldown:3,effects:[effect(),effect('shield',5,[rule('ally','self')])]};s.started=true;
 assert.equal(B.cast(s,0),true);assert.equal(s.teams[0].skillReady,30);assert.equal(s.teams[0].units[0].slot,0);assert.equal(s.teams[0].units[0].shield,0);assert.equal(s.teams[1].units[0].hp,100);
});
test('periodic rules apply immediately in order and death prevents later healing',()=>{
 const s=create(row([0,unit([],{cooldown:120})]),row([0,unit([],{cooldown:120})]));const a=s.teams[0].units[0];a.hp=5;
 Status.apply(a,{status:'poison',duration:{kind:'permanent'}},10,0);Status.apply(a,{status:'regen',duration:{kind:'permanent'}},20,0);
 for(let i=0;i<10;i++)B.step(s);assert.equal(a.hp,0);assert.deepEqual(a.statuses,[]);assert.equal(s.winner,1);
});
test('saved fields roundtrip; invalid nested fields repair individually without mutating input',()=>{
 const e=effect('heal',13,[rule('ally','all',[{field:'down',op:'eq',value:false}])],[{subject:'self',field:'shield',op:'eq',value:0}]);
 const data=D.validate({version:2,items:[unit([e],{movement:rule('ally','lowestHp',[injured])})]});const warnings=[];
 assert.deepEqual(Saved.characters(data,warnings).items[0].effects,[e]);assert.deepEqual(warnings,[]);
 const raw=structuredClone(data);raw.items[0].effects[0].targets[0].targetCond[0].op='bad';raw.items[0].effects[0].targets[0].targetCond[0].value=false;raw.items[0].movement.mode='bad';const before=JSON.stringify(raw);
 const fixed=Saved.characters(raw,warnings).items[0];assert.equal(fixed.effects[0].amount,13);assert.equal(fixed.effects[0].targets[0].targetCond[0].value,false);assert.equal(fixed.effects[0].cond[0].value,0);assert.equal(fixed.movement.side,'ally');assert.ok(warnings.some(w=>w.includes('targetCond')));assert.ok(warnings.some(w=>w.includes('movement.mode')));assert.equal(JSON.stringify(raw),before);
 const empty=Saved.characters({version:2,items:[unit([effect('damage',1,[])])]}).items[0];assert.deepEqual(empty.effects[0].targets,[]);
});
test('invalid new fields fail strict validation and swap cannot fan out',()=>{
 for(const e of [{targets:null},{targets:[rule('enemy','self')]},{cond:null},{cond:[{subject:'self',field:'hpRatio',value:101}]},{condMode:'bad'}])assert.throws(()=>E.validate({type:'damage',amount:1,...e}));
 assert.throws(()=>E.validate({type:'swap',targets:[rule('ally'),rule('ally')]}));assert.throws(()=>E.validate({type:'swap',targets:[rule('ally','all')]}));
 assert.throws(()=>E.validate({type:'damage',amount:1,targets:[{...rule(),targetCond:null}]}));assert.throws(()=>E.movement(null));
 const warnings=[],fixed=Saved.characters({version:2,items:[unit([{type:'damage',amount:12,targets:[{...rule(),targetCond:null}]}],{movement:null})]},warnings).items[0];
 assert.equal(fixed.effects[0].amount,12);assert.deepEqual(fixed.effects[0].targets[0].targetCond,[]);assert.ok(warnings.some(w=>w.includes('targetCond')));assert.ok(warnings.some(w=>w.includes('movement')));
});
test('legacy ten attribute conditions plus a state filter all migrate without truncation',()=>{
 const legacy=E.validate({type:'heal',amount:4,targeting:{side:'ally',mode:'all',filter:'injured',conditions:Array.from({length:10},()=>({field:'race',value:'人類'}))}});
 const targets=E.selectors(legacy);assert.equal(targets[0].targetCond.length,11);
 const migrated=E.validate({type:'heal',amount:4,targets});
 const s=create(row([0,unit([migrated])]),row([0,unit([],{cooldown:120})]));s.teams[0].units[0].hp=80;B.step(s);assert.equal(s.teams[0].units[0].hp,84);
 const warnings=[];const saved=Saved.characters(D.validate({version:2,items:[unit([migrated])]}),warnings);assert.equal(saved.items[0].effects[0].targets[0].targetCond.length,11);assert.deepEqual(warnings,[]);
});
