const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('../js/enemy-tournament.js'),B=require('../js/battle.js'),D=require('../js/database.js'),C=require('../js/config.js'),S=require('../js/statuses.js');
const actor=(id,damage,cooldown=.1)=>({...D.defaults[0],id,name:id,maxHp:100,cooldown,effects:[{type:'damage',amount:damage}]});
const items=[actor('strong',1000),actor('medium',30,.2),actor('weak',1,1)];
const teams=items.map((u,i)=>({id:'team-'+i,name:u.name,category:['normal','elite','boss'][i],matchLevel:100,weight:0,slots:[u.id,...Array(9).fill(null)]}));
const input=(extra={})=>structuredClone({teams,selected:teams.map(t=>t.id),items,config:{...C.defaults,battleSeconds:1},rounds:4,seed:123,statusLibrary:S.snapshot(),...extra});
function simulate(run){const result=T.summary(run);for(const match of T.schedule(run))T.record(result,T.simulate(run,match));return result;}
test('schedule includes each unordered pair once per round, no self battles, alternating sides and bounded counts',()=>{
 const run=T.prepare(input()),schedule=[...T.schedule(run)];assert.equal(schedule.length,12);
 const pairs=new Map();for(const match of schedule){assert.notEqual(match.a,match.b);const key=match.a+':'+match.b;if(!pairs.has(key))pairs.set(key,[]);pairs.get(key).push(match);}
 assert.equal(pairs.size,3);for(const matches of pairs.values()){assert.equal(matches.length,4);assert.equal(matches.filter(m=>m.left===m.a).length,2);assert.notEqual(matches[0].left,matches[1].left);}
 for(const [n,m] of [[1,1],[301,1],[2,0],[2,1001],[2,1.5],[300,3]])assert.throws(()=>T.totalGames(n,m));
 assert.equal(T.totalGames(300,2),89700);
});
test('real engine results rank stronger teams and reconcile wins, losses, draws and pair records',()=>{
 const run=T.prepare(input()),result=simulate(run),rank=T.ranking(result);
 assert.equal(result.completed,12);assert.equal(rank[0].name,'strong');assert.equal(rank[0].wins,8);assert.equal(rank[0].scoreRate,1);assert.equal(rank[1].wins,4);assert.equal(rank[2].losses,8);
 assert.equal(result.rows.reduce((sum,r)=>sum+r.wins,0),result.rows.reduce((sum,r)=>sum+r.losses,0));
 assert.equal(Object.values(result.pairs).reduce((sum,r)=>sum+r.games,0),12);assert.equal(result.pairs['0:1'].wins,4);
 assert.equal(T.metrics(result.pairs['0:1']).scoreRate,1);
});
test('matches start fresh with full health, keep snapshots unchanged and disable skills on both sides',()=>{
 const source=input(),original=structuredClone(source),run=T.prepare(source),snapshot=structuredClone(run),match=[...T.schedule(run)][0];
 const outcome=T.simulate(run,match);assert.deepEqual(T.simulate(run,match),outcome);assert.deepEqual(run,snapshot);assert.deepEqual(source,original);
 const state=B.create([run.teams[match.left].board,run.teams[match.right].board],[],[10,10],{config:run.config,footprints:true,activeSkillsEnabled:false});state.random=T.random(match.seed);while(!state.done)B.step(state);
 assert.equal(outcome.winner,state.winner===0?match.left:match.right);assert.equal(outcome.ticks,state.tick);assert.equal(state.activeSkillsEnabled,false);assert.equal(B.cast(state,0),false);assert.equal(B.cast(state,1),false);
 source.teams[0].name='changed';source.items[0].maxHp=1;assert.equal(run.teams[0].name,'strong');assert.equal(run.teams[0].board[0].maxHp,100);
});
test('draws count half points and unfinished matches stay separate without inflating score or win rate',()=>{
 const result=T.summary(T.prepare(input()));
 T.record(result,{a:0,b:1,winner:'draw',ticks:1});T.record(result,{a:0,b:1,winner:0,ticks:2});T.record(result,{a:0,b:1,winner:'unfinished',ticks:3});
 const row=T.metrics(result.rows[0]);assert.equal(row.games,3);assert.equal(row.resolved,2);assert.equal(row.winRate,.5);assert.equal(row.scoreRate,.75);assert.equal(row.unfinished,1);assert.equal(result.pairs['0:1'].unfinished,1);
 assert.equal(T.metrics(result.rows[2]).scoreRate,null);
 const run=T.prepare(input());run.maxTicks=0;assert.equal(T.simulate(run,[...T.schedule(run)][0]).winner,'unfinished');
});
test('overtime uses actual Config to finish passive mirror fights as a draw',()=>{
 const passive=[actor('a',0,120),actor('b',0,120)],data=teams.slice(0,2).map((t,i)=>({...t,slots:[passive[i].id,...Array(9).fill(null)]}));
 const run=T.prepare(input({items:passive,teams:data,selected:data.map(t=>t.id),rounds:1,config:{...C.defaults,battleSeconds:1,overtimeDamage:100}}));
 const outcome=T.simulate(run,[...T.schedule(run)][0]);assert.equal(outcome.winner,'draw');assert.equal(outcome.ticks,20);
});
test('formation preparation respects stars, law snapshots and footprints while ignoring spawn matching weights',()=>{
 const wide={...items[0],space:3},data=structuredClone(teams);data[0].stars=[6,...Array(9).fill(null)];data[0].laws=Array.from({length:10},()=>[]);data[0].laws[0]=[{id:'buff',name:'加血',shopPrice:0,shopWeight:0,stats:{maxHp:25},passives:[]}];
 const run=T.prepare(input({teams:data,items:[wide,...items.slice(1)]}));assert.equal(run.teams[0].board[0].stars,6);assert.equal(run.teams[0].board[0].maxHp,125);assert.equal(run.teams[0].board[1],null);assert.equal(run.teams.length,3);
 data[0].slots[1]=items[1].id;assert.throws(()=>T.prepare(input({teams:data,items:[wide,...items.slice(1)]})),/重疊/);
});
test('invalid selections, empty teams, stale references, rounds and seed fail before starting',()=>{
 for(const extra of [{selected:['missing','team-0']},{selected:['team-0','team-0']},{rounds:'2'},{seed:-1},{seed:Infinity}])assert.throws(()=>T.prepare(input(extra)));
 const empty=structuredClone(teams);empty[0].slots.fill(null);assert.throws(()=>T.prepare(input({teams:empty})),/空隊/);
 const stale=structuredClone(teams);stale[0].slots[0]='deleted';assert.throws(()=>T.prepare(input({teams:stale})),/已刪除/);
 assert.deepEqual(Array.from({length:8},T.random(12)),Array.from({length:8},T.random(12)));assert.notDeepEqual(Array.from({length:8},T.random(12)),Array.from({length:8},T.random(13)));
});
