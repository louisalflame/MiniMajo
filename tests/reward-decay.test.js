const {test}=require('node:test'),assert=require('node:assert/strict'),H=require('../js/hex-map.js'),J=require('../js/journey.js'),Saved=require('../js/saved-data.js'),Backup=require('../js/editor-backup.js');
function run(){const s=J.create(undefined,undefined,'decay-tests'),map=s.map,origin=map.current,ids=H.neighbors(map.map,origin),target=ids[0],walk=ids[1];map.map.cells[target].type='battle';map.map.cells[walk].type='empty';return {s,map,origin,target,walk};}
function advance(ctx,n){for(let i=0;i<n;i++)assert.ok(J.move(ctx.s,ctx.map.current===ctx.origin?ctx.walk:ctx.origin));}
test('default stages use cumulative thresholds and fixed reward mappings',()=>{
 const {map,target}=run();for(const [age,tier,money,choices] of [[0,'full',100,3],[2,'full',100,3],[3,'high',80,2],[4,'high',80,2],[5,'medium',50,1],[6,'low',20,0],[7,'low',20,0],[8,'none',0,0],[99,'none',0,0]]){map.steps=age;const r=H.rewardAt(map,target);assert.equal(r.tier,tier);assert.equal(r.moneyPercent,money);assert.equal(r.choices,choices);}map.steps=4;assert.equal(H.rewardAt(map,target).nextIn,1);assert.match(H.rewardText(H.rewardAt(map,target)),/再 1 回合→中/);
});
test('successful movement ages revealed enemies and entry locks rewards including entry step',()=>{
 const ctx=run();advance(ctx,4);assert.equal(ctx.map.steps,4);assert.equal(H.rewardAt(ctx.map,ctx.target).tier,'high');assert.ok(J.move(ctx.s,ctx.target));assert.equal(ctx.map.steps,5);assert.equal(H.rewardAt(ctx.map,ctx.target).tier,'medium');assert.equal(H.rewardAt(ctx.map,ctx.target).locked,true);const snapshot=structuredClone(ctx.map);assert.equal(J.move(ctx.s,ctx.origin),false);assert.deepEqual(ctx.map,snapshot);
 const first=J.start(ctx.s),grade=structuredClone(ctx.s.encounter.reward);J.prepare(ctx.s);assert.deepEqual(ctx.s.encounter.reward,grade);const p=ctx.s.encounter;J.settle(ctx.s,{token:p.token,winner:1,hp:p.allies.filter(Boolean).map(()=>0)});assert.ok(J.move(ctx.s,ctx.target));const retry=J.start(ctx.s);assert.deepEqual(ctx.s.encounter.reward,grade);assert.deepEqual(retry.loadouts[1],first.loadouts[1]);
});
test('reveal starts a separate clock, omniscient views do not reveal or reset clocks',()=>{
 const {map}=run(),id=Object.keys(map.map.cells).find(id=>!map.revealed.has(id));map.map.cells[id].type='elite';assert.equal(H.rewardAt(map,id),null);H.view(map,id,true);assert.equal(map.revealed.has(id),false);map.steps=7;assert.equal(H.rewardAt(map,id),null);const first=[...map.revealed][0];const seen=map.revealedAt[first];H.view(map,first);assert.equal(map.revealedAt[first],seen);
});
test('all tiers pay the right gold and draw only their character count; boss and disabled policy stay full',()=>{
 for(const [tier,pct,count] of [['full',100,3],['high',80,2],['medium',50,1],['low',20,0],['none',0,0]]){
  const {s,map,target}=run();map.rewardDecay={enabled:true,stages:[{after:1,tier}]};assert.ok(J.move(s,target));const p=J.start(s),gold=s.roster.gold;const result={token:p.token,winner:0,hp:p.loadouts[0].filter(Boolean).map(u=>u.maxHp)};assert.equal(J.settle(s,result).reward,Math.floor(40*pct/100));assert.equal(s.rewardChoice.choices.length,count);assert.equal(s.rewardChoice.rewardTier,tier);assert.equal(s.roster.gold,gold+Math.floor(40*pct/100));assert.equal(J.settle(s,result),null);if(count===0)assert.equal(J.claim(s,p.token,null),null);
 }
 for(const disabled of [true,false]){const {s,map,target}=run();map.rewardDecay.enabled=!disabled;if(!disabled)map.map.cells[target].type='goal';map.steps=100;J.move(s,target);const p=J.start(s);assert.equal(s.encounter.reward.tier,'full');assert.ok(p.loadouts[1].filter(Boolean).every(u=>u.maxHp<=10000));}
});
test('tier reductions floor gold, and low/none avoid calling character RNG',()=>{
 const {s,map,target}=run();map.rewardDecay={enabled:true,stages:[{after:1,tier:'low'}]};s.config.normalReward=7;s.rewardRandom=()=>assert.fail('no character draw at low tier');J.move(s,target);const p=J.start(s);assert.equal(J.settle(s,{token:p.token,winner:0,hp:p.loadouts[0].filter(Boolean).map(u=>u.maxHp)}).reward,1);
});
test('decay settings roundtrip and repair fields without changing map or source',()=>{
 const file=Backup.collect({getItem:()=>null});file.data.map.rewardDecay={enabled:false,stages:[]};assert.deepEqual(Backup.prepare(file).file.data.map.rewardDecay,{enabled:false,stages:[]});
 const bad=structuredClone(file.data.map);bad.rewardDecay={enabled:true,stages:[{after:0,tier:'high'},{after:2,tier:'full'},{after:1,tier:'bad'}]};const before=structuredClone(bad),warnings=[],repaired=Saved.map(bad,warnings);assert.equal(repaired.rewardDecay.stages[0].after,3);assert.equal(repaired.rewardDecay.stages[1].tier,'high');assert.equal(repaired.rewardDecay.stages[2].tier,'low');assert.deepEqual(bad,before);assert.ok(warnings.some(w=>w.includes('stages[0].after')));assert.ok(warnings.some(w=>w.includes('stages[1].tier')));assert.doesNotThrow(()=>H.validateDecay(repaired.rewardDecay));
 for(const value of [{enabled:1,stages:[]},{enabled:true,stages:[{after:0,tier:'high'}]},{enabled:true,stages:[{after:1,tier:'low'},{after:1,tier:'high'}]}])assert.throws(()=>H.validateDecay(value));
});
