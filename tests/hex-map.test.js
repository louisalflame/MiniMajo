const {test}=require('node:test');const assert=require('node:assert/strict');const H=require('../js/hex-map.js');
function route(map,from,to){const queue=[from],prior=new Map([[from,null]]);for(const id of queue){if(id===to)break;for(const next of H.neighbors(map,id))if(!prior.has(next)){prior.set(next,id);queue.push(next);}}const result=[];for(let at=to;at!==from;at=prior.get(at))result.unshift(at);return result;}
test('hex maps have correct size, reciprocal neighbors, connected loops and reproducible seeds',()=>{
 for(let radius=2;radius<=6;radius++){
  const map=H.generate(radius,'test'),cells=Object.keys(map.cells);assert.equal(cells.length,1+3*radius*(radius+1));
  assert.equal(H.neighbors(map,'0,0').length,6);
  for(const id of cells){assert.ok(H.distance(map.cells[id],{q:0,r:0})<=radius);for(const n of H.neighbors(map,id)){assert.ok(H.neighbors(map,n).includes(id));assert.equal(H.distance(map.cells[id],map.cells[n]),1);}assert.ok(id===map.entrance||route(map,map.entrance,id).length>0);}
  assert.deepEqual(map,H.generate(radius,'test'));assert.ok(cells.reduce((n,id)=>n+H.neighbors(map,id).length,0)/2>cells.length-1);
  for(const type of ['battle','elite','rest','shop','entrance','goal'])assert.ok(cells.some(id=>map.cells[id].type===type));
 }
 assert.notDeepEqual(H.generate(4,'A').cells,H.generate(4,'B').cells);
 for(const radius of [1,7,2.5,NaN])assert.throws(()=>H.generate(radius,'x'));assert.throws(()=>H.generate(3,''));
});
test('fog reveals only the entrance neighborhood and goal location without leaking other types',()=>{
 const state=H.explore(H.generate());assert.deepEqual([...state.revealed].sort(),[state.current,...H.neighbors(state.map,state.current)].sort());
 assert.equal(H.view(state,state.map.goal).type,'goal');assert.equal(H.view(state,state.map.goal).visible,false);
 for(const id of Object.keys(state.map.cells))if(!state.revealed.has(id)&&id!==state.map.goal)assert.equal(H.view(state,id).type,null);
 const count=state.revealed.size;for(const id of Object.keys(state.map.cells))assert.ok(H.view(state,id,true).type);assert.equal(state.revealed.size,count);assert.equal(H.canMove(state,state.map.goal),false);
});
test('moving reveals one ring, pauses for events, and permits cleared-cell backtracking',()=>{
 const state=H.explore(H.generate()),entrance=state.current;const next=H.neighbors(state.map,entrance)[0];
 assert.equal(H.move(state,state.map.goal),false);assert.equal(H.move(state,next),true);assert.equal(state.pending,next);assert.equal(state.steps,1);
 for(const id of [next,...H.neighbors(state.map,next)])assert.ok(state.revealed.has(id));assert.ok(state.revealed.has(entrance));
 assert.equal(H.move(state,entrance),false);assert.equal(H.resolve(state),true);assert.equal(H.resolve(state),false);
 assert.equal(H.move(state,entrance),true);assert.equal(state.pending,null);assert.equal(H.move(state,next),true);assert.equal(state.pending,null);assert.equal(state.steps,3);
});
test('every planned event blocks movement until acknowledged; reaching goal completes exploration',()=>{
 for(const type of ['battle','elite','rest','shop']){
  const map=H.generate(2,'events'),state=H.explore(map),next=H.neighbors(map,map.entrance)[0];map.cells[next].type=type;
  H.move(state,next);assert.equal(state.pending,next);assert.equal(H.canMove(state,map.entrance),false);H.resolve(state);assert.equal(H.canMove(state,map.entrance),true);
 }
 const map=H.generate(),state=H.explore(map);for(const id of route(map,map.entrance,map.goal)){assert.equal(H.move(state,id),true);if(state.pending)H.resolve(state);}
 assert.equal(state.complete,true);assert.equal(state.current,map.goal);assert.equal(state.pending,null);assert.equal(H.move(state,H.neighbors(map,map.goal)[0]),false);
 const fresh=H.explore(map);assert.equal(fresh.steps,0);assert.equal(fresh.current,map.entrance);assert.equal(fresh.complete,false);assert.equal(fresh.visited.size,1);
});
test('quotas and all spatial constraints hold across sizes and seeds',()=>{
 for(let radius=2;radius<=6;radius++)for(let n=0;n<20;n++){
  const map=H.generate(radius,'distribution-'+n),rules=map.rules,cells=Object.values(map.cells);
  for(const type of H.quotaTypes)assert.equal(cells.filter(c=>c.type===type).length,rules.quotas[type]);
  assert.equal(cells.filter(c=>c.type==='empty').length,cells.length-2-Object.values(rules.quotas).reduce((a,b)=>a+b,0));
  for(const type of ['elite','rest','shop']){const peers=cells.filter(c=>c.type===type);for(let i=0;i<peers.length;i++)for(let j=i+1;j<peers.length;j++)assert.ok(H.distance(peers[i],peers[j])>=rules[type+'Spacing']);}
  for(const elite of cells.filter(c=>c.type==='elite'))assert.ok(H.distance(elite,map.cells[map.entrance])>=rules.safeRadius);
  for(const rest of cells.filter(c=>c.type==='rest'))for(const shop of cells.filter(c=>c.type==='shop'))assert.ok(H.distance(rest,shop)>=rules.supplySpacing);
 }
 const map=H.generate();assert.deepEqual(map.rules.quotas,{battle:24,elite:5,rest:5,shop:4,fragile:6});assert.equal(Object.values(map.cells).filter(c=>c.type==='empty').length,15);
});
test('custom quotas can be zero; impossible configurations fail without reducing constraints',()=>{
 const empty=H.generate(2,'empty',{quotas:{battle:0,elite:0,rest:0,shop:0}});assert.equal(Object.values(empty.cells).filter(c=>c.type==='empty').length,17);
 assert.throws(()=>H.generate(2,'x',{quotas:{battle:99}}),/超過/);
 assert.throws(()=>H.generate(2,'x',{safeRadius:12}),/安全範圍/);
 assert.throws(()=>H.generate(2,'x',{quotas:{battle:0,elite:0,rest:2,shop:0},restSpacing:12}),/未找到/);
 assert.throws(()=>H.generate(4,'x',{restSpacing:1.5}));assert.throws(()=>H.generate(4,'x',{quotas:{elite:-1}}));
});
test('empty tiles auto-complete and supply events never add alarm',()=>{
 for(const type of ['empty','rest','shop']){
  const state=H.explore(H.generate()),next=H.neighbors(state.map,state.current)[0];state.map.cells[next].type=type;H.move(state,next);
  if(type==='empty'){assert.equal(state.pending,null);assert.ok(state.cleared.has(next));}else assert.equal(H.resolve(state),true);
  assert.equal(state.alertPoints,undefined);
 }
});

test('fragile floors collapse only after a valid departure and can never be entered again',()=>{
 const map=H.generate(2,'fragile'),state=H.explore(map),origin=state.current,floor=H.neighbors(map,origin)[0];map.cells[floor].type='fragile';
 assert.equal(H.move(state,floor),true);assert.equal(state.pending,null);assert.equal(state.collapsed.has(floor),false);assert.equal(state.alertPoints,undefined);
 const standing=structuredClone(state);assert.equal(H.move(state,map.goal),false);assert.deepEqual(state,standing);
 assert.equal(H.move(state,origin),true);assert.equal(state.collapsed.has(floor),true);assert.equal(H.view(state,floor).collapsed,true);assert.equal(H.canMove(state,floor),false);
 const broken=structuredClone(state);assert.equal(H.move(state,floor),false);assert.deepEqual(state,broken);
 const reset=H.explore(map);assert.equal(reset.collapsed.size,0);assert.equal(H.canMove(reset,floor),true);assert.equal(map.cells[floor].type,'fragile');
});
test('fragile quotas are reproducible, accept zero and do not add tiles to older custom maps',()=>{
 const settings={...H.defaults(3),quotas:{...H.defaults(3).quotas,fragile:4}},a=H.generate(3,'fragile-count',settings);assert.equal(Object.values(a.cells).filter(c=>c.type==='fragile').length,4);assert.deepEqual(a,H.generate(3,'fragile-count',settings));
 for(const n of [-1,.5,'4',null])assert.throws(()=>H.generate(3,'bad',{quotas:{fragile:n}}));
 const old={battle:17,elite:0,rest:0,shop:0},full=H.generate(2,'legacy-full',{quotas:old});assert.equal(full.rules.quotas.fragile,0);assert.equal(Object.values(full.cells).filter(c=>c.type==='battle').length,17);assert.equal(Object.hasOwn(old,'fragile'),false);
});
