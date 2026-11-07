const test=require('node:test'),assert=require('node:assert/strict');
const Battle=require('../js/battle.js'),DB=require('../js/database.js');
const unit=extra=>({...structuredClone(DB.defaults[0]),maxHp:1000,cooldown:.1,moveDistance:0,effects:[{type:'damage',amount:8,range:1}],passives:[],laws:[],...extra});
test('real attacks, absorbed hits and innate/law passives emit cues for their runtime owners',()=>{
 const passive={when:'action',subject:{relation:'self',conditions:[]},effects:[{type:'shield',amount:1}]};
 const state=Battle.create([[unit({passives:[passive],laws:[{name:'測試',passives:[passive]}]})],[unit({cooldown:100})]],[],[10,10]);
 state.started=true;state.teams[1].units[0].shield=100;
 Battle.step(state);
 assert.ok(state.visuals.some(e=>e.type==='attack'&&e.target==='0:0'));
 assert.ok(state.visuals.some(e=>e.type==='hit'&&e.target==='1:0'));
 assert.equal(state.visuals.filter(e=>e.type==='passive'&&e.target==='0:0').length,2);
 assert.equal(state.teams[1].units[0].hp,1000);
 assert.equal(state.visuals.find(e=>e.type==='hit').shieldOnly,true);
});

test('knockdown cue is emitted only on the actual threshold crossing, HP damage uses a warm hit',()=>{
 const state=Battle.create([[unit({effects:[{type:'damage',amount:12,range:1}]})],[unit({cooldown:100})]],[],[10,10],{config:{...require('../js/config.js').defaults,postureLimit:5}});
 Battle.step(state);
 assert.equal(state.visuals.filter(e=>e.type==='knockdown'&&e.target==='1:0').length,1);
 assert.equal(state.visuals.find(e=>e.type==='hit').shieldOnly,false);
 state.visuals=[];Battle.step(state);assert.equal(state.visuals.filter(e=>e.type==='knockdown').length,0);
});

test('swap and jump cues retain both runtime identities and the complete ordered route',()=>{
 const own=Array(10).fill(null),enemy=Array(10).fill(null);own[0]=unit({space:2});own[5]=unit({space:2});enemy[8]=unit({space:2});
 const s=Battle.create([own,enemy],[],[10,10],{footprints:true}),a=s.teams[0].items[0],b=s.teams[0].items[5],target=s.teams[1].items[8];
 assert.ok(Battle.swap(s,0,a,b));assert.ok(Battle.swap(s,0,a,b));
 assert.deepEqual(s.visuals.filter(e=>e.target===a.battleId).map(e=>[e.kind,e.fromSlot,e.toSlot]),[['swap',0,5],['swap',5,0]]);
 assert.ok(s.visuals.some(e=>e.target===b.battleId&&e.fromSlot===5&&e.toSlot===0));
 assert.ok(Battle.jump(s,0,a,target));assert.deepEqual(s.visuals.at(-1),{target:a.battleId,type:'relocate',kind:'jump',fromSlot:0,toSlot:8});
 const count=s.visuals.length;assert.equal(Battle.jump(s,0,a,target),false);assert.equal(s.visuals.length,count);
});
test('dodged damage still lunges but produces no hit cue; stun prevents attack and passive cues',()=>{
 const state=Battle.create([[unit({passives:[{when:'action',effects:[{type:'shield',amount:1}]}]})],[unit({cooldown:100})]],[],[10,10]);
 state.started=true;
 const Status=require('../js/statuses.js'),foe=state.teams[1].units[0],own=state.teams[0].units[0];
 Status.apply(foe,{status:'dodge',duration:{kind:'permanent'}},1,0);
 Battle.step(state);
 assert.ok(state.visuals.some(e=>e.type==='attack'));
 assert.ok(!state.visuals.some(e=>e.type==='hit'));
 assert.equal(state.feedback.filter(e=>e.type==='miss').length,1);
 state.visuals=[];Status.apply(own,{status:'stun',duration:{kind:'seconds',value:3}},1,state.tick);
 Battle.step(state);assert.equal(state.visuals.length,0);
});

test('healing and shield gain cues follow actual positive amounts, with no overheal sweep',()=>{
 const s=Battle.create([[unit({effects:[{type:'heal',amount:50},{type:'shield',amount:12}]})],[unit({cooldown:100,effects:[]})]],[],[10,10]);
 s.teams[0].units[0].hp=990;Battle.step(s);
 assert.equal(s.feedback.find(e=>e.type==='heal').amount,10);assert.equal(s.visuals.filter(e=>e.type==='heal').length,1);assert.equal(s.visuals.filter(e=>e.type==='shield').length,1);
 s.visuals=[];s.feedback=[];Battle.step(s);assert.equal(s.visuals.filter(e=>e.type==='heal').length,0);assert.equal(s.visuals.filter(e=>e.type==='shield').length,1);
});

test('a multi-effect ordinary attack produces a single MISS and no damage on its dodged recipient',()=>{
 const s=Battle.create([[unit({effects:[{type:'damage',amount:10},{type:'damage',amount:20}]})],[unit({cooldown:100,effects:[]})]],[],[10,10]);
 require('../js/statuses.js').apply(s.teams[1].units[0],{status:'dodge',duration:{kind:'permanent'}},1,0);Battle.step(s);
 assert.equal(s.feedback.filter(e=>e.type==='miss').length,1);assert.equal(s.feedback.filter(e=>e.type==='damage').length,0);assert.equal(s.teams[1].units[0].hp,1000);
});
