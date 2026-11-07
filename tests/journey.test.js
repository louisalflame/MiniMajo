const {test}=require('node:test'),assert=require('node:assert/strict'),J=require('../js/journey.js'),X=require('../js/expedition.js'),H=require('../js/hex-map.js');
function encounter(s,type='battle'){const id=H.neighbors(s.map.map,s.map.current).find(id=>!s.map.cleared.has(id));s.map.map.cells[id].type=type;assert.ok(H.move(s.map,id));return id;}
test('journey begins unequipped and sends only the skill explicitly chosen by the player',()=>{
 const S=require('../js/skills.js'),B=require('../js/battle.js'),skills=['first','second'].map(id=>({...S.defaults[0],id,name:id,conditions:[]}));
 const s=J.create(undefined,skills,'manual-skill');assert.equal(s.roster.skillId,null);assert.deepEqual(X.eligible(s.roster).map(skill=>skill.id),['first','second']);
 encounter(s);assert.deepEqual(J.start(s).skills,[]);X.equip(s.roster,'second');const payload=J.prepare(s);assert.deepEqual(payload.skills.map(skill=>skill.id),['second']);
 const battle=B.create(payload.loadouts,payload.skills,payload.limits,{footprints:true});assert.equal(battle.teams[0].skill.id,'second');
});
test('shop ownership and formation flow into combat; victory preserves roster and grants reward once',()=>{
 const s=J.create(undefined,undefined,'test');const stock=X.shop(s.roster,'shop'),slot=stock.findIndex(Boolean);X.buy(s.roster,'shop',slot,'reserve',5);X.transfer(s.roster,'reserve',5,'active',7);
 const id=encounter(s),p=J.start(s);assert.equal(p.loadouts[0][7].instanceId,s.roster.active[7].instanceId);assert.equal(p.skills[0]?.id,s.roster.skillId||undefined);
 const result={token:p.token,winner:0,hp:p.loadouts[0].filter(Boolean).map(u=>u.maxHp).map((n,i)=>i===0?0:42)},gold=s.roster.gold;assert.equal(J.settle(s,result).reward,40);assert.equal(s.roster.gold,gold+40);assert.ok(s.map.cleared.has(id));assert.equal(s.roster.active[0].currentHp,undefined);assert.equal(J.settle(s,result),null);
 J.claim(s,s.rewardChoice.token,0);encounter(s);const next=J.start(s);assert.ok(next.loadouts[0][0]);assert.equal(next.loadouts[0].filter(Boolean).length,p.loadouts[0].filter(Boolean).length);assert.ok(s.roster.active.filter(Boolean).every(u=>!Object.hasOwn(u,'currentHp')));
});
test('loss and draw preserve resources; stale or malformed result cannot finish a new encounter',()=>{
 const s=J.create(undefined,undefined,'test'),origin=s.map.current;const failed=encounter(s);let p=J.start(s),before=structuredClone(s.roster);
 assert.equal(J.resolve(s),false);assert.equal(J.settle(s,{token:'wrong',winner:0,hp:p.loadouts[0].filter(Boolean).map(u=>u.maxHp)}),null);assert.throws(()=>J.settle(s,{token:p.token,winner:0,hp:[99999]}));
 J.settle(s,{token:p.token,winner:1,hp:p.loadouts[0].filter(Boolean).map(u=>u.maxHp).map(()=>0)});assert.deepEqual(s.roster,before);assert.equal(s.map.pending,null);assert.equal(s.map.current,origin);assert.equal(J.move(s,failed),true);
 const retry=J.start(s);assert.notEqual(retry.token,p.token);assert.equal(J.settle(s,{token:p.token,winner:0,hp:p.loadouts[0].filter(Boolean).map(u=>u.maxHp)}),null);J.settle(s,{token:retry.token,winner:'draw',hp:retry.loadouts[0].filter(Boolean).map(u=>u.maxHp)});assert.deepEqual(s.roster,before);
});

test('defeat rolls back the entry step and fragile collapse while keeping explored tiles, foes and reward locks',()=>{
 const s=J.create(undefined,undefined,'fragile-retreat'),floor=H.neighbors(s.map.map,s.map.current)[0];s.map.map.cells[floor].type='fragile';assert.ok(J.move(s,floor));
 const before={steps:s.map.steps,path:s.map.path.slice(),gold:s.roster.gold};
 const id=H.neighbors(s.map.map,floor).find(id=>!s.map.cleared.has(id));s.map.map.cells[id].type='elite';assert.ok(J.move(s,id));assert.ok(s.map.collapsed.has(floor));
 let payload=J.start(s);payload=J.prepare(s);const foes=structuredClone(payload.loadouts[1]),lock=structuredClone(s.map.rewardLocks[id]);
 const loss={token:payload.token,winner:1,hp:payload.loadouts[0].filter(Boolean).map(()=>0)};J.settle(s,loss);
 assert.equal(s.map.current,floor);assert.equal(s.map.pending,null);assert.equal(s.map.steps,before.steps);assert.deepEqual(s.map.path,before.path);assert.equal(s.map.collapsed.has(floor),false);
 assert.equal(s.map.cleared.has(id),false);assert.equal(s.roster.gold,before.gold);assert.equal(s.rewardChoice,null);assert.ok(s.map.visited.has(id));assert.deepEqual(s.map.rewardLocks[id],lock);
 assert.equal(J.settle(s,loss),null);assert.ok(J.move(s,id));const retry=J.start(s);assert.deepEqual(retry.loadouts[1],foes);assert.deepEqual(s.map.rewardLocks[id],lock);
 assert.equal(J.settle(s,loss),null);assert.equal(s.map.current,id,'stale result must not retreat the retry');
});

test('boss defeat returns to its previous tile without completing or consuming the boss',()=>{
 const s=J.create(undefined,undefined,'boss-retreat'),origin=s.map.current,id=H.neighbors(s.map.map,origin)[0];s.map.map.cells[id].type='goal';
 assert.ok(J.move(s,id));const p=J.start(s);J.settle(s,{token:p.token,winner:1,hp:p.loadouts[0].filter(Boolean).map(()=>0)});
 assert.equal(s.map.current,origin);assert.equal(s.map.complete,false);assert.equal(s.map.cleared.has(id),false);assert.equal(s.map.pending,null);
});
test('rest raises echo once and shop resolves without free combat completion',()=>{
 const s=J.create(undefined,undefined,'test');const before=structuredClone(s.roster);encounter(s,'rest');assert.equal(J.resolve(s),true);before.echoLevel=2;assert.deepEqual(s.roster,before);assert.equal(J.resolve(s),false);
 encounter(s,'shop');assert.equal(J.resolve(s),true);encounter(s,'elite');assert.equal(J.resolve(s),false);const p=J.start(s);assert.equal(p.loadouts[1].filter(Boolean).length,4);assert.equal(J.settle(s,{token:p.token,winner:0,hp:p.loadouts[0].filter(Boolean).map(u=>u.maxHp)}).reward,90);
});

test('purchased laws use the journey library snapshot and retain effects across battles',()=>{
 const law={id:'vigor',name:'活力',shopPrice:50,shopWeight:100,stats:{maxHp:30},passives:[]},s=J.create(undefined,undefined,'law-run',null,null,undefined,[law]),id=s.roster.active[0].instanceId,base=s.roster.active[0].maxHp;
 law.stats.maxHp=999;X.lawShop(s.roster,'law-node',()=>0);X.buyLaw(s.roster,'law-node',0,id);
 encounter(s);let payload=J.start(s);assert.equal(payload.loadouts[0][0].maxHp,base+30);assert.equal(payload.loadouts[0][0].laws[0].stats.maxHp,30);
 payload.loadouts[0][0].laws[0].stats.maxHp=777;assert.equal(s.roster.active[0].laws[0].stats.maxHp,30);
 J.settle(s,{token:payload.token,winner:0,hp:s.encounter.allies.filter(Boolean).map(u=>u.maxHp)});J.claim(s,s.rewardChoice.token,0);encounter(s);payload=J.start(s);assert.equal(payload.loadouts[0][0].maxHp,base+30);
});

test('victory offers three stable choices even when full, rejects claims until space is cleared and pays once',()=>{
 const s=J.create(undefined,undefined,'full-reward');s.rewardRandom=()=>0;encounter(s);const payload=J.start(s),gold=s.roster.gold;
 for(const area of ['active','reserve'])s.roster[area]=Array.from({length:10},(_,i)=>({...structuredClone(s.roster.library[0]),instanceId:area+'-'+i}));
 const result={token:payload.token,winner:0,hp:payload.loadouts[0].filter(Boolean).map(u=>u.maxHp)};J.settle(s,result);
 assert.equal(s.rewardChoice.choices.length,3);assert.equal(new Set(s.rewardChoice.choices.map(u=>u.id)).size,3);assert.equal(s.roster.gold,gold+40);
 const before=structuredClone({roster:s.roster,reward:s.rewardChoice});assert.throws(()=>J.claim(s,payload.token,0),/整備隊伍/);assert.deepEqual({roster:s.roster,reward:s.rewardChoice},before);
 assert.equal(J.move(s,H.neighbors(s.map.map,s.map.current)[0]),false);assert.throws(()=>J.start(s),/獎勵/);assert.equal(J.resolve(s),false);assert.equal(J.settle(s,result),null);
 X.sell(s.roster,'reserve',0);const claimed=J.claim(s,payload.token,0);assert.equal(claimed.area,'reserve');assert.equal(claimed.slot,0);assert.equal(claimed.unit.stars,1);assert.equal(s.rewardChoice,null);assert.equal(s.roster.active[0].stars,1);
 const after=structuredClone(s.roster);assert.throws(()=>J.claim(s,payload.token,1));assert.deepEqual(s.roster,after);assert.equal(J.settle(s,result),null);
});
test('reward rolls honor weights and skip impossible widths without filtering current capacity',()=>{
 const s=J.create(undefined,undefined,'weighted');s.roster.library=[{...s.roster.library[0],id:'off',shopWeight:0},{...s.roster.library[0],id:'wide',space:11},{...s.roster.library[0],id:'a',shopWeight:1},{...s.roster.library[0],id:'b',shopWeight:3}];
 let random=[0,.25,0,0,0,.999];const choices=J.rollRewards(s.roster,()=>random.shift());assert.deepEqual(choices.map(u=>u.id),['b','a','b']);
 s.roster.library.forEach(u=>u.shopWeight=0);assert.deepEqual(J.rollRewards(s.roster),[]);
});
test('loss and draw give no choices, while an empty reward pool can be acknowledged without inventing a role',()=>{
 const s=J.create(undefined,undefined,'empty-reward');encounter(s);let p=J.start(s);J.settle(s,{token:p.token,winner:'draw',hp:p.loadouts[0].filter(Boolean).map(u=>u.maxHp)});assert.equal(s.rewardChoice,null);
 encounter(s);p=J.start(s);s.roster.library.forEach(u=>u.shopWeight=0);J.settle(s,{token:p.token,winner:0,hp:p.loadouts[0].filter(Boolean).map(u=>u.maxHp)});assert.deepEqual(s.rewardChoice.choices,[]);const before=structuredClone(s.roster);J.claim(s,p.token,null);assert.equal(s.rewardChoice,null);assert.deepEqual(s.roster,before);
});

test('consumed shops and camps remain traversable without reopening events or granting another upgrade',()=>{
 for(const type of ['shop','rest']){
  const s=J.create(undefined,undefined,'single-use-'+type),origin=s.map.current,id=H.neighbors(s.map.map,origin)[0];s.map.map.cells[id].type=type;
  assert.equal(J.move(s,id),true);assert.equal(J.resolve(s),true);const after=structuredClone(s.roster);
  assert.equal(J.move(s,origin),true);assert.equal(J.move(s,id),true);assert.equal(s.map.pending,null);assert.equal(J.resolve(s),false);assert.deepEqual(s.roster,after);
 }
});

test('prebattle preparation refreshes allies and skills without rerolling foes or paying rewards',()=>{
 const s=J.create(undefined,undefined,'prepare');encounter(s);const first=J.start(s),gold=s.roster.gold;
 X.transfer(s.roster,'active',0,'reserve',0);const next=J.prepare(s);assert.notEqual(next.token,first.token);assert.equal(next.loadouts[0][0],null);assert.deepEqual(next.loadouts[1],first.loadouts[1]);assert.equal(s.roster.gold,gold);
 assert.equal(J.settle(s,{token:first.token,winner:0,hp:first.loadouts[0].filter(Boolean).map(u=>u.maxHp)}),null);
 const old=s.encounter,active=s.roster.active;s.roster.active=Array(10).fill(null);assert.throws(()=>J.prepare(s),/至少一名/);assert.equal(s.encounter,old);s.roster.active=active;
 s.encounter.started=true;assert.throws(()=>J.prepare(s),/開戰前/);
});

test('draw consumes normal elite and goal encounters without loot or repeat settlement',()=>{
 for(const type of ['battle','elite','goal']){
  const s=J.create(undefined,undefined,'draw-'+type),id=encounter(s,type);if(type==='goal'){s.map.pending=id;s.map.complete=false;}const p=J.start(s),before=structuredClone(s.roster);
  const result={token:p.token,winner:'draw',hp:p.loadouts[0].filter(Boolean).map(()=>0)};
  assert.equal(J.settle(s,result).reward,0);assert.deepEqual(s.roster,before);assert.equal(s.rewardChoice,null);assert.equal(s.map.pending,null);assert.equal(s.map.cleared.has(id),true);assert.equal(s.map.complete,type==='goal');assert.equal(J.settle(s,result),null);assert.throws(()=>J.start(s),/沒有待完成/);
 }
});
