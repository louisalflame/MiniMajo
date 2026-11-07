const {test}=require('node:test'),assert=require('node:assert/strict'),V=require('../js/journey-view.js'),H=require('../js/hex-map.js');
test('perspective keeps player below horizon and compresses distant cells toward the goal',()=>{
 const map=H.generate(),camera=V.camera(map,map.entrance),player=V.tile(map.cells[map.entrance],camera),goal=V.tile(map.cells[map.goal],camera);
 assert.equal(player.x,400);assert.equal(player.y,370);assert.ok(goal.y<player.y&&goal.y>90);assert.ok(goal.scale<player.scale);
 const near=V.project({x:camera.origin.x+1,y:1},camera),far=V.project({x:camera.origin.x+5,y:1},camera);assert.ok(Math.abs(far.x-400)<Math.abs(near.x-400));
});
test('every local tile stays finite and inside the viewport across all map positions',()=>{
 for(let radius=2;radius<=6;radius++){const cells={};for(let q=-radius;q<=radius;q++)for(let r=Math.max(-radius,-q-radius);r<=Math.min(radius,-q+radius);r++)cells[H.key(q,r)]={q,r};const map={cells,goal:H.key(radius,0)};
 for(const current of Object.keys(cells)){const camera=V.camera(map,current);for(const id of [current,...H.neighbors(map,current)]){const tile=V.tile(cells[id],camera);for(const pair of tile.points.split(' ')){const [x,y]=pair.split(',').map(Number);assert.ok(Number.isFinite(x)&&x>=0&&x<=800,`${current}: x ${x}`);assert.ok(Number.isFinite(y)&&y>=0&&y<=680,`${current}: y ${y}`);}}}}
});

const {test:check}=require('node:test');
check('frontier hints include only unknown adjacent cells and never event information',()=>{
 const map={cells:{'0,0':{q:0,r:0,type:'entrance'},'1,0':{q:1,r:0,type:'goal'},'2,0':{q:2,r:0,type:'battle'}}};
 const revealed=new Set(['0,0']),camera=V.camera(map,'0,0');
 const hints=V.frontier(map,revealed,camera);assert.equal(hints.length,1);assert.equal(hints[0].paths.length,1);assert.equal(hints[0].type,undefined);assert.equal(hints[0].id,undefined);assert.match(hints[0].paths[0],/^M/);assert.doesNotMatch(hints[0].paths[0],/NaN|Infinity|Z/);
 revealed.add('1,0');assert.equal(V.frontier(map,revealed,camera).length,1);revealed.add('2,0');assert.equal(V.frontier(map,revealed,camera).length,0);
 assert.equal(V.frontier(map,new Set(['0,0']),V.camera(map,'2,0')).length,1);
 assert.equal(V.frontier(map,new Set(['1,0']),V.camera(map,'2,0')).some(h=>h.scale<0),false);
});
check('camera heading stays fixed during travel and changes only with explicit angle',()=>{
 const map=H.generate();for(const angle of [0,.7,Math.PI,-2])for(const id of Object.keys(map.cells)){assert.deepEqual(V.camera(map,id,angle).forward,{x:Math.cos(angle),y:Math.sin(angle)});}
 assert.deepEqual(V.blend({x:0,y:2},{x:4,y:6},0),{x:0,y:2});assert.deepEqual(V.blend({x:0,y:2},{x:4,y:6},.5),{x:2,y:4});assert.deepEqual(V.blend({x:0,y:2},{x:4,y:6},1),{x:4,y:6});
});
check('revealed cells behind any camera heading are clipped without inverted or nonfinite polygons',()=>{
 const map=H.generate();for(const angle of [0,.3,1,2,3,4,5]){const camera=V.camera(map,'0,0',angle);for(const cell of Object.values(map.cells)){const tile=V.tile(cell,camera);for(const pair of tile.points.split(' ').filter(Boolean)){const [x,y]=pair.split(',').map(Number);assert.ok(Number.isFinite(x)&&Number.isFinite(y));assert.ok(y>90&&y<=690+1e-8);}}}
});

check('floor symbol follows camera rotation and distance compression',()=>{const map=H.generate(),c=V.camera(map,'0,0');const a=V.symbol({q:0,r:0},c),b=V.symbol({q:0,r:0},V.camera(map,'0,0',.7));assert.notEqual(a,b);assert.match(a,/^matrix\(/);assert.ok(!a.includes('NaN'));const numbers=t=>t.slice(7,-1).split(' ').map(Number);assert.ok(Math.abs(numbers(V.symbol({q:2,r:0},c))[0])<Math.abs(numbers(a)[0]));});
