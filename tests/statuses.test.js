const {test}=require('node:test');const assert=require('node:assert/strict');const B=require('../js/battle.js');const S=require('../js/statuses.js');const E=require('../js/effects.js');const D=require('../js/database.js');
const unit=(effects=[],cooldown=2)=>({...D.defaults[0],maxHp:500,cooldown,effects});
const setup=(a=unit(),b=unit())=>B.create([[a],[b]],[]);
const status=(kind,duration={kind:'permanent'},amount=10,target='self')=>({type:'status',status:kind,target,duration,amount});
function apply(s,team,kind,duration,amount=10){return S.apply(s.teams[team].units[0],status(kind,duration,amount),amount,s.tick);}
function ticks(s,n){for(let i=0;i<n;i++)B.step(s);}
test('poison bypasses shield; regen and stagger effects tick per second',()=>{
 const s=setup();const u=s.teams[0].units[0];u.shield=100;apply(s,0,'poison',{kind:'seconds',value:2},15);ticks(s,9);assert.equal(u.hp,500);ticks(s,1);assert.equal(u.hp,485);assert.equal(u.shield,100);ticks(s,10);assert.equal(u.hp,470);assert.equal(u.statuses.length,0);
 apply(s,0,'regen',{kind:'seconds',value:1},20);u.posture=30;apply(s,0,'confusion',{kind:'permanent'},10);apply(s,0,'calm',{kind:'permanent'},3);ticks(s,10);assert.equal(u.hp,490);assert.equal(u.posture,37);
});
test('duration validation, roundtrip and refresh semantics',()=>{
 for(const kind of Object.keys(S.names)){const e=status(kind,{kind:'seconds',value:3});assert.equal(E.validate(e).status,kind);}
 assert.throws(()=>E.validate(status('poison',{kind:'actions',value:1.5})));assert.throws(()=>E.validate(status('haste',{kind:'permanent'})));assert.throws(()=>E.validate(status('unknown')));
 const s=setup(),u=s.teams[0].units[0];apply(s,0,'poison',{kind:'seconds',value:3},2);ticks(s,5);apply(s,0,'poison',{kind:'seconds',value:4},7);assert.equal(u.statuses.length,1);assert.equal(u.statuses[0].until,45);assert.equal(u.statuses[0].amount,7);
});
test('damage/shield modifiers clamp at zero; action-count buff lasts exactly N actions',()=>{
 const s=setup(unit([{type:'damage',amount:{multiplier:1,formula:'0',constant:0}},{type:'shield',amount:{multiplier:.5,formula:'0',constant:0}}],.1));apply(s,0,'power',{kind:'actions',value:2},7);apply(s,0,'weakness',{kind:'permanent'},3);apply(s,0,'hard',{kind:'permanent'},4);apply(s,0,'fragile',{kind:'permanent'},20);ticks(s,3);assert.equal(s.teams[1].units[0].hp,500-14-14-7);assert.equal(s.teams[0].units[0].shield,0);assert.equal(S.has(s.teams[0].units[0],'power'),false);
});
test('counter triggers only automatic direct damage, never chains or reflects poison/team skills',()=>{
 const s=setup(unit([{type:'damage',amount:10}],.1));apply(s,1,'counter',{kind:'permanent'},8);apply(s,0,'counter',{kind:'permanent'},9);ticks(s,1);assert.equal(s.teams[0].units[0].hp,492);assert.equal(s.teams[1].units[0].hp,490);
 s.teams[0].units[0].effects=[];s.teams[0].skill={enabled:true,name:'技能',cooldown:1,effects:[{type:'damage',amount:10}]};s.started=true;B.cast(s,0);assert.equal(s.teams[0].units[0].hp,492);
 apply(s,1,'poison',{kind:'seconds',value:1},10);ticks(s,10);assert.equal(s.teams[0].units[0].hp,492);
});
test('stun freezes progress; timed and skipped-action stun both expire',()=>{
 const s=setup(unit([{type:'damage',amount:10}],1));ticks(s,3);const u=s.teams[0].units[0],remaining=u.nextAction-s.tick;apply(s,0,'stun',{kind:'seconds',value:1},1);ticks(s,10);assert.equal(u.nextAction-s.tick,remaining);assert.equal(s.teams[1].units[0].hp,500);ticks(s,7);assert.equal(s.teams[1].units[0].hp,490);
 apply(s,0,'stun',{kind:'actions',value:2},1);ticks(s,19);assert.equal(S.has(u,'stun'),true);ticks(s,1);assert.equal(S.has(u,'stun'),false);
});
test('haste/fatigue change progress by 50 percent, cancel together, reset clears statuses',()=>{
 for(const [k,expected] of [['haste',15],['fatigue',25]]){const s=setup(unit([],3)),u=s.teams[0].units[0];apply(s,0,k,{kind:'seconds',value:3},1);ticks(s,10);assert.equal(u.nextAction-s.tick,expected);}
 const s=setup(unit([],3));apply(s,0,'haste',{kind:'seconds',value:3},1);apply(s,0,'fatigue',{kind:'seconds',value:3},1);ticks(s,10);assert.equal(s.teams[0].units[0].nextAction-s.tick,20);assert.deepEqual(setup().teams[0].units[0].statuses,[]);
});
test('newly applied self status does not lose an action immediately; poison death stops actions',()=>{
 const s=setup(unit([status('power',{kind:'actions',value:1},5)],.1));ticks(s,1);assert.equal(s.teams[0].units[0].statuses[0].remaining,1);
 const death=setup(unit([{type:'damage',amount:10}],1));apply(death,0,'poison',{kind:'permanent'},1000);ticks(death,10);assert.equal(death.winner,1);assert.equal(death.teams[1].units[0].hp,500);
});
test('frequent poison refresh keeps periodic ticks rather than delaying damage indefinitely',()=>{
 const s=setup(unit([status('poison',{kind:'seconds',value:2},10,'enemy')],.1));ticks(s,11);assert.equal(s.teams[1].units[0].hp,490);assert.equal(s.teams[1].units[0].statuses.length,1);
});
test('confusion reaches knockdown and calm cannot lower posture below zero',()=>{
 const s=setup(),u=s.teams[0].units[0],v=s.teams[1].units[0];u.posture=95;v.posture=3;
 apply(s,0,'confusion',{kind:'permanent'},10);apply(s,1,'calm',{kind:'permanent'},10);ticks(s,10);
 assert.equal(u.posture,100);assert.equal(u.weakUntil,50);assert.equal(v.posture,0);ticks(s,10);assert.equal(u.weakUntil,50);
});
test('rage advances one second on shielded hits and skills, capped at ready until next tick',()=>{
 const s=setup(unit([{type:'damage',amount:1}],.1),unit([{type:'heal',amount:1}],3)),u=s.teams[1].units[0];u.shield=100;
 apply(s,1,'rage',{kind:'permanent'},99);ticks(s,1);assert.equal(u.nextAction,20);assert.equal(u.hp,500);assert.equal(u.shield,99);
 s.teams[0].units[0].effects=[];s.teams[0].skill={enabled:true,name:'技能',cooldown:1,effects:[{type:'damage',amount:1},{type:'damage',amount:1}]};
 assert.equal(B.cast(s,0),true);assert.equal(u.nextAction,s.tick);ticks(s,1);assert.equal(u.nextAction,31);
});
test('rage ignores poison, reflected damage, zero damage and lethal hits',()=>{
 const s=setup(unit([{type:'damage',amount:1}],2)),u=s.teams[0].units[0];
 apply(s,0,'rage',{kind:'permanent'});apply(s,0,'poison',{kind:'permanent'},1);apply(s,1,'counter',{kind:'permanent'},1);
 ticks(s,20);assert.equal(u.nextAction,40);
 const v=s.teams[1].units[0];apply(s,1,'rage',{kind:'permanent'});s.teams[0].units[0].effects=[{type:'damage',amount:0}];ticks(s,20);assert.equal(v.nextAction,60);
 s.teams[0].units[0].effects=[{type:'damage',amount:10000}];ticks(s,20);assert.equal(v.hp,0);assert.equal(v.nextAction,60);assert.equal(v.stats.actions,2);assert.deepEqual(v.statuses,[]);
});
