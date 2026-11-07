const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');const Effects=require('../js/effects.js');const Statuses=require('../js/statuses.js');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.value='';this.disabled=false;}
 append(...items){items.forEach(x=>{x.parent=this;this.children.push(x);});}
 remove(){this.parent.children=this.parent.children.filter(x=>x!==this);}
 insertBefore(item,before){item.remove();this.children.splice(this.children.indexOf(before),0,item);item.parent=this;}
 replaceChildren(...items){this.children=items;}
 setAttribute(key,value){this.attrs[key]=value;}
 get options(){return this.children;}
 querySelectorAll(query){const tags=query.split(',');return this.children.flatMap(x=>[...(tags.includes(x.tag)?[x]:[]),...x.querySelectorAll(query)]);}
}
function editor(){const window={};const context={window,Laws:require('../js/laws.js'),document:{createElement:tag=>new Element(tag)},Effects,Statuses,Formula:require('../js/formula.js'),FormulaEditor:{create:source=>({node:new Element('div'),read:()=>source})}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/effect-editor.js'),'utf8'),context);context.EffectEditor=window.EffectEditor;return window.EffectEditor;}
const find=(root,title)=>root.querySelectorAll('select,input,button').find(x=>x.attrs['aria-label']===title||x.textContent===title);
test('effect editor nests attributes and status conditions in each target search',()=>{
 const ui=editor(),root=ui.row({type:'heal',amount:10,targeting:{side:'ally',mode:'all',filter:'injured',conditions:[{field:'job',value:'支援'}]}},()=>{},()=>{});
 const saved=Effects.validate(root.read());assert.equal(saved.targets[0].side,'ally');assert.deepEqual(JSON.parse(JSON.stringify(saved.targets[0].targetCond)),[{field:'job',op:'eq',value:'支援'},{field:'injured',op:'eq',value:true}]);
 assert.equal(root.querySelectorAll('table').length,0);assert.match(ui.describe(saved),/職業.*支援.*已受傷/);
 find(root,'搜尋陣營').value='enemy';find(root,'搜尋陣營').onchange();assert.equal(root.read().targets[0].side,'enemy');
});
test('condition subjects exclude the original enemy and status content keeps its duration',()=>{
 const root=editor().row({type:'status',status:'regen',amount:8,target:'self',cond:[{subject:'self',field:'injured',op:'eq',value:true}],duration:{kind:'seconds',value:5}},()=>{},()=>{});
 const saved=Effects.validate(root.read());assert.equal(saved.cond[0].subject,'self');assert.equal(saved.cond[0].field,'injured');assert.deepEqual(find(root,'判斷對象').options.map(x=>x.value),['self','count']);assert.equal(saved.targets[0].side,'ally');assert.equal(saved.actions[0].duration.value,5);assert.equal(saved.when,undefined);
});
test('changing payload preserves target rules and swap enforces allied single target',()=>{
 const root=editor().row({type:'heal',amount:10,targeting:{side:'ally',mode:'all',conditions:[{field:'job',value:'支援'}]}},()=>{},()=>{});
 const type=find(root,'效果類型');type.value='swap';type.onchange();let saved=Effects.validate(root.read());assert.equal(saved.actions[0].amount,undefined);assert.equal(saved.targets[0].mode,'primary');assert.equal(saved.targets[0].targetCond[0].value,'支援');assert.equal(find(root,'搜尋陣營').disabled,true);
 type.value='damage';type.onchange();saved=Effects.validate(root.read());assert.equal(saved.actions[0].amount.constant,10);assert.equal(saved.targets[0].side,'ally');assert.equal(saved.targets[0].targetCond[0].value,'支援');
});
test('adding/removing target groups and conditions roundtrips including empty and false',()=>{
 const ui=editor(),root=ui.row({type:'damage',amount:1,targets:[],cond:[]},()=>{},()=>{});
 assert.equal(root.read().targets.length,0);find(root,'＋ 加入目標搜尋組').onclick();find(root,'＋ 加入目標搜尋組').onclick();assert.equal(root.read().targets.length,2);
 find(root,'＋ 加入條件').onclick();find(root,'條件值').value='false';assert.equal(Effects.validate(root.read()).cond[0].value,false);
 find(root,'移除此搜尋組').onclick();assert.equal(root.read().targets.length,1);
 find(root,'判斷對象').value='count';find(root,'判斷對象').onchange();find(root,'人數').value='0';assert.equal(Effects.validate(root.read()).cond[0].value,0);
});
test('promoting a secondary changes main order without dropping data',()=>{
 const ui=editor(),box=new Element('div'),a=ui.row({type:'heal',amount:3},()=>{},()=>{}),b=ui.row({type:'damage',amount:7},()=>{},()=>{});box.append(a,b);let changes=0;ui.refreshRoles(box,()=>changes++);
 assert.equal(a.roleTitle.textContent,'主效果 · 治療');assert.equal(b.roleTitle.textContent,'副效果 1 · 傷害');b.promote.onclick();assert.equal(box.children[0],b);assert.equal(b.roleTitle.textContent,'主效果 · 傷害');assert.equal(a.read().actions[0].amount.constant,3);assert.equal(changes,1);
});
test('effects use character range without effect distance controls and expose opposite selection',()=>{
 const root=editor().row({type:'damage',amount:1,range:3},()=>{},()=>{}),mode=find(root,'選取方式');
 assert.equal(find(root,'效果射程（敵方最近單體適用）'),undefined);assert.equal(find(root,'敵方距離限制'),undefined);assert.equal(root.read().range,undefined);
 mode.value='opposite';mode.onchange();assert.equal(Effects.validate(root.read()).targets[0].mode,'opposite');
 find(root,'搜尋陣營').value='ally';find(root,'搜尋陣營').onchange();assert.equal(root.read().targets[0].mode,'primary');
});
test('jump retains unlimited position search and has no numeric amount',()=>{
 const ui=editor(),root=ui.row({type:'damage',amount:1},()=>{},()=>{}),type=find(root,'效果類型');type.value='jump';type.onchange();const e=Effects.validate(root.read());
 assert.equal(e.actions[0].type,'jump');assert.equal(e.actions[0].amount,undefined);assert.equal(e.targets[0].side,'enemy');assert.equal(e.targets[0].range,'unlimited');assert.equal(find(root,'搜尋陣營').disabled,true);
 assert.deepEqual(JSON.parse(JSON.stringify(Effects.validate(ui.row(e,()=>{},()=>{}).read()))),JSON.parse(JSON.stringify(e)));
});
test('attack multiplier and additive battle formula coexist without a legacy mode',()=>{
 for(const type of ['damage','heal','shield']){
  const root=editor().row({type,amount:{multiplier:0,formula:'target.maxHp * 0.1',constant:7}},()=>{},()=>{}),mode=find(root,'倍率模式');
  assert.equal(find(root,'數值模式'),undefined);assert.equal(Effects.validate(root.read()).actions[0].amount.multiplier,0);mode.value='range';mode.onchange();find(root,'最小倍率（含）').value='.25';find(root,'最大倍率（含）').value='1.75';
  assert.deepEqual(JSON.parse(JSON.stringify(Effects.validate(root.read()).actions[0].amount)),{multiplier:{min:.25,max:1.75},formula:'target.maxHp * 0.1',constant:7});
  mode.value='fixed';mode.onchange();find(root,'技能倍率').value='2';find(root,'常數整數').value='-3';assert.equal(root.read().actions[0].amount.multiplier,2);assert.equal(root.read().actions[0].amount.constant,-3);
 }
 const root=editor().row({type:'damage',amount:40},()=>{},()=>{});assert.deepEqual(JSON.parse(JSON.stringify(root.read().actions[0].amount)),{multiplier:0,formula:'0',constant:40});
});
test('active-skill and law contexts omit all attack controls and serialize only additive terms',()=>{
 for(const type of ['damage','heal','shield']){
  const root=editor().row({type,amount:{multiplier:{min:2,max:3},formula:'target.maxHp * 0.1',constant:7}},()=>{},()=>{},{allowAttack:false});
  for(const title of ['倍率模式','技能倍率','最小倍率（含）','最大倍率（含）'])assert.equal(find(root,title),undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(root.read().actions[0].amount)),{formula:'target.maxHp * 0.1',constant:7});
  const select=find(root,'效果類型');select.value='heal';select.onchange();assert.equal(find(root,'倍率模式'),undefined);assert.equal(root.read().actions[0].amount.multiplier,undefined);
 }
});

test('multiple contents can be added reordered and removed while sharing rules',()=>{
 const root=editor().row({type:'damage',amount:7,cond:[{subject:'self',field:'injured',value:true}],targets:[{side:'enemy',mode:'opposite'}]},()=>{},()=>{});
 find(root,'＋ 加入作用內容').onclick();const types=root.querySelectorAll('select').filter(x=>x.attrs['aria-label']==='效果類型');types[1].value='shield';types[1].onchange();
 assert.deepEqual(Array.from(root.read().actions,a=>a.type),['damage','shield']);
 const up=root.querySelectorAll('button').filter(x=>x.textContent==='作用上移');up[1].onclick();assert.deepEqual(Array.from(root.read().actions,a=>a.type),['shield','damage']);assert.equal(root.read().cond.length,1);assert.equal(root.read().targets.length,1);assert.equal(root.read().targets[0].mode,'opposite');
 find(root,'移除作用內容').onclick();assert.equal(root.read().actions.length,1);assert.equal(find(root,'移除作用內容').disabled,true);find(root,'移除作用內容').onclick();assert.equal(root.read().actions.length,1);
 for(let i=0;i<10;i++)find(root,'＋ 加入作用內容').onclick();assert.equal(root.read().actions.length,8);assert.doesNotThrow(()=>Effects.validate(root.read()));
});

test('advance editor uses seconds without attack or formula controls and preserves zero',()=>{
 for(const effectType of ['advance','advanceSkill'])for(const allowAttack of [true,false]){
 const root=editor().row({type:'damage',amount:10},()=>{},()=>{},{allowAttack}),type=find(root,'效果類型');type.value=effectType;type.onchange();const seconds=find(root,'加快秒數');assert.equal(seconds.value,1);assert.equal(seconds.step,.1);assert.equal(find(root,'技能倍率'),undefined);assert.equal(find(root,'數值模式'),undefined);seconds.value='2.5';assert.equal(Effects.validate(root.read()).actions[0].amount,2.5);
 const reloaded=editor().row({actions:[{type:effectType,amount:0}],targets:[{side:'ally',mode:'self'}]},()=>{},()=>{},{allowAttack});assert.equal(find(reloaded,'加快秒數').value,0);assert.equal(Effects.validate(reloaded.read()).actions[0].amount,0);
 }
});

test('relative target controls roundtrip and switching basis restores ordinary searches',()=>{
 const root=editor().row({type:'damage',amount:10},()=>{},()=>{}),base=find(root,'搜尋基準');base.value='main';base.onchange();
 const mode=find(root,'選取方式');assert.deepEqual(mode.options.map(o=>o.value),Object.keys(Effects.relativeModes));mode.value='neighbors';mode.onchange();
 const saved=Effects.validate(root.read());assert.equal(saved.targets[0].base,'main');assert.equal(saved.targets[0].mode,'neighbors');assert.match(Effects.describe(saved),/主效果目標.*左右鄰居/);
 const restored=editor().row(saved,()=>{},()=>{});assert.equal(find(restored,'搜尋基準').value,'main');assert.equal(find(restored,'選取方式').value,'neighbors');
 base.value='actor';base.onchange();assert.equal(root.read().targets[0].base,undefined);assert.equal(root.read().targets[0].mode,'primary');
});

test('main role disallows self-reference and promotion retains data with a clear save error',()=>{
 const ui=editor(),box=new Element('div'),a=ui.row({type:'damage',amount:1},()=>{},()=>{}),b=ui.row({type:'damage',amount:2,targets:[{base:'main',side:'enemy',mode:'neighbors'}]},()=>{},()=>{});box.append(a,b);ui.refreshRoles(box,()=>{});
 assert.equal(find(a,'搜尋基準').options[1].disabled,true);assert.equal(find(b,'搜尋基準').options[1].disabled,false);b.promote.onclick();assert.throws(()=>b.read(),/主效果不能/);assert.equal(find(b,'選取方式').value,'neighbors');
});

test('passive editor exposes event basis on main and secondary effects and restores it',()=>{
 const ui=editor(),p={when:'healed',subject:{relation:'enemy',conditions:[]},effects:[{type:'damage',amount:30}]},root=ui.passiveRow(p);
 const base=find(root,'搜尋基準');assert.equal(base.options.find(o=>o.value==='event').textContent,'本次事件角色');base.value='event';base.onchange();find(root,'選取方式').value='neighbors';
 const saved=root.read();assert.equal(saved.effects[0].targets[0].base,'event');assert.equal(saved.effects[0].targets[0].mode,'neighbors');assert.doesNotThrow(()=>Effects.validate(saved.effects[0],{allowAttack:false}));
 const restored=ui.passiveRow(saved);assert.equal(find(restored,'搜尋基準').value,'event');assert.equal(find(restored,'選取方式').value,'neighbors');
 const ordinary=ui.row({type:'damage',amount:1},()=>{},()=>{});assert.equal(find(ordinary,'搜尋基準').options.some(o=>o.value==='event'),false);
 const box=new Element('div'),row=ui.row(saved.effects[0],()=>{},()=>{},{allowEvent:true});box.append(row);ui.refreshRoles(box,()=>{});assert.equal(find(row,'搜尋基準').options.find(o=>o.value==='event').disabled,false);assert.doesNotThrow(()=>row.read());
});

test('ordinary action result timings lock event relation to enemy and retain event search',()=>{
 const ui=editor(),root=ui.passiveRow({when:'healed',subject:{relation:'self',conditions:[]},effects:[{type:'damage',amount:10}]});
 const when=find(root,'觸發時機'),relation=find(root,'事件中的角色');
 for(const timing of ['normalDown','normalKill']){when.value=timing;when.onchange();assert.equal(relation.value,'enemy');assert.equal(relation.disabled,true);assert.equal(root.read().subject.relation,'enemy');assert.equal(root.read().when,timing);}
 const base=find(root,'搜尋基準');base.value='event';base.onchange();assert.equal(root.read().effects[0].targets[0].base,'event');
 const restored=ui.passiveRow(root.read());assert.equal(find(restored,'觸發時機').value,'normalKill');assert.equal(find(restored,'事件中的角色').disabled,true);
 when.value='healed';when.onchange();assert.equal(relation.disabled,false);
});

test('taunt application omits strength and retains seconds or actions duration',()=>{
 for(const duration of [{kind:'seconds',value:3},{kind:'actions',value:2}]){
 const root=editor().row({type:'status',status:'taunt',target:'self',amount:1,duration},()=>{},()=>{}),saved=Effects.validate(root.read());assert.equal(saved.actions[0].status,'taunt');assert.equal(saved.actions[0].amount,1);assert.deepEqual(JSON.parse(JSON.stringify(saved.actions[0].duration)),duration);
 }
});

test('status condition is stored only for the status gain event',()=>{
 const root=editor().passiveRow({when:'statusGained',subject:{relation:'ally',conditions:[]},statusCondition:{mode:'specified',status:'power'},effects:[]});
 const timing=find(root,'觸發時機'),mode=find(root,'狀態條件'),status=find(root,'指定狀態');
 assert.equal(status.disabled,false);
 assert.equal(root.read().statusCondition.status,'power');
 mode.value='negative';mode.onchange();
 assert.equal(status.disabled,true);
 assert.equal(root.read().statusCondition.mode,'negative');
 timing.value='action';timing.onchange();
 assert.equal(mode.disabled,true);
 assert.equal(root.read().statusCondition,undefined);
});

test('exclude-self checkbox and allied skill result timing roundtrip through editor controls',()=>{
 const ui=editor(),root=ui.passiveRow({when:'allySkillResolved',subject:{relation:'ally',conditions:[]},effects:[{type:'shield',amount:7,targets:[{side:'ally',mode:'random',excludeSelf:true}]}]});
 assert.equal(find(root,'事件中的角色').disabled,true);
 const exclude=find(root,'排除自身');
 assert.equal(exclude.checked,true);
 assert.equal(root.read().effects[0].targets[0].excludeSelf,true);
 exclude.checked=false;exclude.onchange();
 assert.equal(root.read().effects[0].targets[0].excludeSelf,false);
});

test('innate passive controls expose attack multiplier while law controls use additive amounts',()=>{
 const p={when:'action',subject:{relation:'self',conditions:[]},effects:[{type:'damage',amount:{multiplier:1.5,constant:2,formula:'0'}}]};
 const ui=editor();
 const innate=ui.passiveRow(p,()=>{},()=>{},{allowAttack:true});
 assert.equal(find(innate,'技能倍率').value,1.5);
 assert.equal(innate.read().effects[0].actions[0].amount.multiplier,1.5);
 const law=ui.passiveRow(p);
 assert.equal(find(law,'技能倍率'),undefined);
 assert.equal(law.read().effects[0].actions[0].amount.multiplier,undefined);
});

test('directional companion choices roundtrip and are disabled for enemy searches',()=>{
 for(const mode of ['allLeft','allRight','leftmost','rightmost']){
  const root=editor().row({type:'shield',amount:7,targets:[{side:'ally',mode}]},()=>{},()=>{});
  assert.equal(Effects.validate(root.read()).targets[0].mode,mode);
  const side=find(root,'搜尋陣營');side.value='enemy';side.onchange();
  const select=find(root,'選取方式');const allyOnly=['allLeft','allRight'].includes(mode);
  assert.equal(select.options.find(o=>o.value===mode).disabled,allyOnly);
  assert.equal(root.read().targets[0].mode,allyOnly?'primary':mode);
 }
});
