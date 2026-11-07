const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),D=require('../js/database.js'),E=require('../js/enemy-teams.js');
class Element{constructor(){this.children=[];this.handlers={};this.value='';}append(...n){this.children.push(...n);}replaceChildren(...n){this.children=n;}setAttribute(){}addEventListener(k,f){this.handlers[k]=f;}}
test('independent generator works without selected teams and preserves a full 300-team library',()=>{
 const html=fs.readFileSync('editor.html','utf8');
 for(const count of [0,300]){
  const team=E.defaults(D.defaults).teams[0],initial={version:1,teams:Array.from({length:count},(_,i)=>({...team,id:'team-'+i,name:'隊伍 '+i}))},store=new Map([['minimajo.enemies.v1',JSON.stringify(initial)]]),nodes=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
  vm.runInNewContext(fs.readFileSync('js/enemy-editor.js','utf8'),{document:{getElementById:id=>nodes.get(id),createElement:()=>new Element()},window:{addEventListener(){}},GameConfig:require('../js/config.js'),CharacterLibrary:{getItems:()=>D.defaults},EnemyTeams:E,EnemyGenerator:require('../js/enemy-generator.js'),EchoLevels:require('../js/echo-levels.js'),structuredClone,confirm:()=>true,localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)}});
  nodes.get('enemy-roll-laws').value='0';nodes.get('enemy-generate').handlers.click();
  if(count===0){assert.equal(nodes.get('enemy-form').hidden,false);assert.match(nodes.get('enemy-name').value,/隨機敵隊/);nodes.get('enemy-form').handlers.submit({preventDefault(){}});assert.equal(JSON.parse(store.get('minimajo.enemies.v1')).teams.length,1);}
  else {assert.match(nodes.get('enemy-message').textContent,/最多 300 隊/);assert.equal(nodes.get('enemy-list').children.length,300);assert.deepEqual(JSON.parse(store.get('minimajo.enemies.v1')),initial);}
 }
});
test('generation creates separate teams, preserves previous drafts and saves only selected team',()=>{
 const html=fs.readFileSync('editor.html','utf8'),initial=E.defaults([{...D.defaults[0],space:3}]),store=new Map([['minimajo.enemies.v1',JSON.stringify(initial)]]),items=[{...D.defaults[0],space:3}],nodes=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 vm.runInNewContext(fs.readFileSync('js/enemy-editor.js','utf8'),{document:{getElementById:id=>nodes.get(id),createElement:()=>new Element()},window:{addEventListener(){}},GameConfig:require('../js/config.js'),CharacterLibrary:{getItems:()=>items},EnemyTeams:E,EnemyGenerator:require('../js/enemy-generator.js'),EchoLevels:require('../js/echo-levels.js'),structuredClone,confirm:()=>true,localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)}});
 const original=store.get('minimajo.enemies.v1');nodes.get('enemy-name').value='原隊草稿';nodes.get('enemy-form').handlers.input();
 nodes.get('enemy-search').value='filter';nodes.get('enemy-roll-laws').value='0';nodes.get('enemy-generate').handlers.click();
 assert.equal(store.get('minimajo.enemies.v1'),original);assert.match(nodes.get('enemy-name').value,/隨機敵隊/);assert.equal(nodes.get('enemy-list').children.length,4);assert.equal(nodes.get('enemy-search').value,'');
 assert.equal(nodes.get('enemy-slots').children[0].children[1].value,'6');assert.match(nodes.get('enemy-message').textContent,/6／20.*提前停止/);
 nodes.get('enemy-roll-count').value='';nodes.get('enemy-generate').handlers.click();assert.match(nodes.get('enemy-message').textContent,/生成失敗/);assert.equal(nodes.get('enemy-list').children.length,4);
 nodes.get('enemy-roll-count').value='1';nodes.get('enemy-generate').handlers.click();assert.equal(nodes.get('enemy-list').children.length,5);assert.equal(nodes.get('enemy-slots').children[0].children[1].value,'1');
 nodes.get('enemy-form').handlers.submit({preventDefault(){}});const saved=JSON.parse(store.get('minimajo.enemies.v1'));assert.equal(saved.teams.length,4);assert.deepEqual(saved.teams.slice(0,3),E.validate(initial).teams);assert.equal(saved.teams[3].stars[0],1);assert.equal(saved.teams[3].matchLevel,1);assert.equal(saved.teams[3].weight,100);assert.equal(saved.teams[3].category,'normal');assert.ok(!Object.hasOwn(saved.teams[3],'count'));
 nodes.get('enemy-list').children[0].onclick();assert.equal(nodes.get('enemy-name').value,'原隊草稿');
 nodes.get('enemy-form').handlers.submit({preventDefault(){}});assert.equal(JSON.parse(store.get('minimajo.enemies.v1')).teams[0].name,'原隊草稿');
 nodes.get('enemy-list').children[3].onclick();assert.equal(nodes.get('enemy-slots').children[0].children[1].value,'6');nodes.get('enemy-form').handlers.submit({preventDefault(){}});
 const all=JSON.parse(store.get('minimajo.enemies.v1'));assert.equal(all.teams.length,5);assert.equal(new Set(all.teams.map(t=>t.id)).size,5);
});

test('enemy editor saves category, weight and formation, validates overlaps, and reloads',()=>{
 const html=fs.readFileSync('editor.html','utf8'),store=new Map(),items=[{...D.defaults[0],space:2},D.defaults[3]];
 function setup(){const nodes=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));vm.runInNewContext(fs.readFileSync('js/enemy-editor.js','utf8'),{document:{getElementById:id=>nodes.get(id),createElement:()=>new Element()},window:{addEventListener(){}},GameConfig:require('../js/config.js'),CharacterLibrary:{getItems:()=>items},EnemyTeams:E,EnemyGenerator:require('../js/enemy-generator.js'),EchoLevels:require('../js/echo-levels.js'),structuredClone,confirm:()=>true,localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)}});return nodes;}
 let e=setup();e.get('enemy-name').value='我的 BOSS';e.get('enemy-category').value='boss';e.get('enemy-weight').value='25';e.get('enemy-slots').children[0].children[1].value='6';e.get('enemy-form').handlers.submit({preventDefault(){}});
 const saved=JSON.parse(store.get('minimajo.enemies.v1'));assert.equal(saved.teams[0].name,'我的 BOSS');assert.equal(saved.teams[0].category,'boss');assert.equal(saved.teams[0].weight,25);assert.equal(saved.teams[0].stars[0],6);
 e.get('enemy-slots').children[1].children[0].value=items[1].id;e.get('enemy-form').handlers.submit({preventDefault(){}});assert.match(e.get('enemy-message').textContent,/重疊/);assert.deepEqual(JSON.parse(store.get('minimajo.enemies.v1')),saved);
 e=setup();assert.equal(e.get('enemy-name').value,'我的 BOSS');assert.equal(e.get('enemy-weight').value,25);assert.equal(e.get('enemy-slots').children[0].children[1].value,'6');
 const cell=e.get('enemy-slots').children[0];cell.children[0].value=items[1].id;cell.children[0].onchange();assert.equal(cell.children[1].value,'');
});

test('enemy editor adds repeated laws, saves, reloads and removes only one copy',()=>{
 const html=fs.readFileSync('editor.html','utf8'),store=new Map(),law={shopPrice:50,shopWeight:100,id:'stack',name:'強化',stats:{maxHp:20},passives:[]};
 function setup(){const nodes=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));vm.runInNewContext(fs.readFileSync('js/enemy-editor.js','utf8'),{document:{getElementById:id=>nodes.get(id),createElement:()=>new Element()},window:{addEventListener(){}},GameConfig:require('../js/config.js'),CharacterLibrary:{getItems:()=>D.defaults},LawLibrary:{get:()=>[law]},EnemyTeams:E,EnemyGenerator:require('../js/enemy-generator.js'),EchoLevels:require('../js/echo-levels.js'),structuredClone,confirm:()=>true,localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)}});return nodes;}
 let e=setup(),box=e.get('enemy-slots').children[0].children[3],picker=box.children[0];
 for(let i=0;i<2;i++){picker.value=law.id;picker.onchange();}
 e.get('enemy-form').handlers.submit({preventDefault(){}});
 assert.equal(JSON.parse(store.get('minimajo.enemies.v1')).teams[0].laws[0].length,2);
 e=setup();box=e.get('enemy-slots').children[0].children[3];assert.equal(box.children[1].children.length,2);
 box.children[1].children[0].onclick();e.get('enemy-form').handlers.submit({preventDefault(){}});
 assert.equal(JSON.parse(store.get('minimajo.enemies.v1')).teams[0].laws[0].length,1);
});

test('enemy level filters match exactly and searching preserves unsaved form edits',()=>{
 const html=fs.readFileSync('editor.html','utf8'),teams=E.defaults(D.defaults);teams.teams[0].matchLevel=7;teams.teams[1].matchLevel=2;const store=new Map([['minimajo.enemies.v1',JSON.stringify(teams)]]),nodes=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 vm.runInNewContext(fs.readFileSync('js/enemy-editor.js','utf8'),{document:{getElementById:id=>nodes.get(id),createElement:()=>new Element()},window:{addEventListener(){}},GameConfig:require('../js/config.js'),CharacterLibrary:{getItems:()=>D.defaults},EnemyTeams:E,EnemyGenerator:require('../js/enemy-generator.js'),EchoLevels:require('../js/echo-levels.js'),structuredClone,confirm:()=>true,localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)}});
 assert.equal(nodes.get('enemy-match-level').value,7);nodes.get('enemy-name').value='未儲存名稱';nodes.get('enemy-level-filter').value='7';nodes.get('enemy-level-filter').handlers.input();assert.equal(nodes.get('enemy-list').children.length,1);assert.match(nodes.get('enemy-list').children[0].textContent,/Lv.7/);assert.equal(nodes.get('enemy-name').value,'未儲存名稱');nodes.get('enemy-search').value='不符合';nodes.get('enemy-search').handlers.input();assert.match(nodes.get('enemy-list').children[0].textContent,/沒有符合/);nodes.get('enemy-search').value='';nodes.get('enemy-level-filter').value='';nodes.get('enemy-search').handlers.input();assert.equal(nodes.get('enemy-list').children.length,3);
 nodes.get('enemy-match-level').value='9';nodes.get('enemy-form').handlers.submit({preventDefault(){}});assert.equal(JSON.parse(store.get('minimajo.enemies.v1')).teams[0].matchLevel,9);nodes.get('enemy-category').value='boss';nodes.get('enemy-category').handlers.change();assert.equal(nodes.get('enemy-match-level').disabled,true);
});
