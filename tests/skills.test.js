const passive={name:'標靶',race:'人類',affinity:'物理',maxHp:180,cooldown:120,effects:[]};
const {test}=require('node:test');const assert=require('node:assert/strict');const S=require('../js/skills.js');const B=require('../js/battle.js');
const human={id:'human',race:'人類',affinity:'物理',job:'飛襲',cooldown:120,effects:[]};
const orc={id:'orc',race:'獸人',affinity:'魔法',tags:[],cooldown:120,effects:[]};
const psychic={id:'psy',race:'機人',affinity:'精神',tags:[],cooldown:120,effects:[]};
const skill=(id,conditions=[],extra={})=>({id,name:id,description:'',imagePath:'',cooldown:2.5,mode:'all',effects:[{type:'damage',amount:10}],conditions,...extra});

const compound={kind:'count',filterMode:'all',filters:[{field:'race',op:'eq',value:'人類'},{field:'rarity',op:'in',value:['SSR','UR']},{field:'stars',op:'gte',value:3}],op:'gt',count:3};
test('compound appearance counts the same matching characters once across rarity alternatives and star bounds',()=>{
 const s=S.validate({version:1,skills:[skill('compound',[compound])]}).skills[0],u={...human,stars:3,rarity:'SSR',space:2};
 const row=[u,null,{...u,rarity:'UR'},null,{...u,stars:6},null,{...u,rarity:'UR'},null,null,null];
 assert.equal(S.evaluate(row,[s])[0].matched,true);assert.equal(S.evaluate(row.slice(0,6),[s])[0].matched,false);
 for(const wrong of [{race:'獸人'},{stars:2},{rarity:'SR'}])assert.equal(S.evaluate([...row.slice(0,6),{...u,...wrong}],[s])[0].matched,false);
 const state=B.create([row,[passive]],[s],[10,10],{footprints:true});assert.equal(state.teams[0].skill.enabled,true);state.started=true;state.teams[0].skillReady=0;assert.equal(B.cast(state,0),true);assert.equal(state.teams[1].units[0].hp,170);
});
test('compound appearance supports every count comparison, OR filters, empty filters and strict invalid drafts',()=>{
 for(const [op,count,want] of [['gt',3,true],['gte',4,true],['lt',4,false],['lte',4,true],['eq',4,true],['ne',4,false]])assert.equal(S.condition([human,human,orc,orc],{...compound,filters:[],op,count}),want);
 assert.equal(S.condition([human,orc],{...compound,filterMode:'any',filters:[{field:'race',op:'eq',value:'人類'},{field:'race',op:'eq',value:'獸人'}],op:'eq',count:2}),true);
 for(const bad of [{field:'stars',op:'gte',value:0},{field:'rarity',op:'in',value:[]},{field:'race',op:'gt',value:'人類'}])assert.throws(()=>S.validate({version:1,skills:[skill('bad',[{...compound,filters:[bad]}])]}));
});
test('compound appearance backup repairs individual fields and retains legacy conditions, zero and empty filters',()=>{
 const Saved=require('../js/saved-data.js'),Backup=require('../js/editor-backup.js'),raw={version:1,skills:[skill('repair',[{...compound,filters:[compound.filters[0],{field:'rarity',op:'in',value:['SSR','bad','UR']},{field:'stars',op:'gte',value:99}],count:0,filterMode:'bad'},{kind:'count',filters:[],op:'eq',count:0},{kind:'count',field:'race',value:'人類',op:'gte',count:2}])]},before=structuredClone(raw),warnings=[];
 const fixed=Saved.skills(raw,warnings);assert.deepEqual(raw,before);assert.equal(fixed.skills[0].conditions[0].count,0);assert.equal(fixed.skills[0].conditions[0].filterMode,'all');assert.deepEqual(fixed.skills[0].conditions[0].filters[1].value,['SSR','SR','UR']);assert.equal(fixed.skills[0].conditions[0].filters[2].value,1);assert.deepEqual(fixed.skills[0].conditions[1].filters,[]);assert.equal(fixed.skills[0].conditions[2].field,'race');assert.ok(warnings.length>=3);
 const file=Backup.collect({getItem:()=>null});file.data.skills=fixed;assert.deepEqual(Backup.prepare(file).file.data.skills,fixed);
});
test('count rules support min/exact/max and missing characters',()=>{
 const team=[human,orc,orc];
 assert.equal(S.condition(team,{kind:'count',field:'race',value:'獸人',op:'gte',count:2}),true);
 assert.equal(S.condition(team,{kind:'count',field:'id',value:'orc',op:'eq',count:2}),true);
 assert.equal(S.condition(team,{kind:'count',field:'job',value:'飛襲',op:'lte',count:0}),false);
 assert.equal(S.condition(team,{kind:'count',field:'id',value:'missing',op:'eq',count:0}),true);
});
test('slot uses actual position including holes; before respects order and strict distinct positions',()=>{
 const slot={kind:'slot',field:'id',value:'orc',slot:2};assert.equal(S.condition([human,orc],slot),true);assert.equal(S.condition([orc,null,human],slot),false);
 const before={kind:'before',field:'affinity',value:'精神',other:{field:'affinity',value:'魔法'}};
 assert.equal(S.condition([psychic,null,orc],before),true);assert.equal(S.condition([orc,null,psychic],before),false);
 assert.equal(S.condition([human],{kind:'before',field:'race',value:'人類',other:{field:'race',value:'人類'}}),false);
});
test('AND/OR, library ordering, no match and empty-team behavior',()=>{
 const yes={kind:'slot',field:'race',value:'人類',slot:1},no={kind:'count',field:'race',value:'獸人',op:'gte',count:2};
 const rules=[skill('all',[yes,no]),skill('any',[yes,no],{mode:'any'}),skill('fallback')];
 assert.equal(S.choose([human],rules).id,'any');assert.deepEqual(S.evaluate([human],rules).filter(x=>x.matched).map(x=>x.skill.id),['any','fallback']);
 assert.equal(S.choose([],rules).enabled,false);assert.equal(S.choose([human],[rules[0]]).enabled,false);assert.equal(S.choose([human],[]).enabled,false);
});
test('skills no longer require, retain or sort by priority',()=>{
 const data=S.validate({version:1,skills:[{...skill('first'),priority:-999},{...skill('second'),priority:999},skill('third')]});
 assert.ok(data.skills.every(s=>!Object.hasOwn(s,'priority')));assert.deepEqual(S.evaluate([human],data.skills).filter(x=>x.matched).map(x=>x.skill.id),['first','second','third']);
 const saved=require('../js/saved-data.js').skills({version:1,skills:[{...skill('first'),priority:'unused'}]},[]);assert.equal(Object.hasOwn(saved.skills[0],'priority'),false);
});
test('custom CD/effects reach combat, no hidden race bonus, snapshot does not mutate',()=>{
 const custom=skill('custom',[],{effects:[{type:'damage',amount:13},{type:'shield',amount:7}]});const s=B.create([[human],[orc]],[custom]);custom.effects[0].amount=999;s.started=true;s.teams[0].skillReady=0;assert.equal(B.cast(s,0),true);assert.equal(s.teams[1].units[0].hp,167);assert.equal(s.teams[0].units[0].shield,7);assert.equal(s.teams[0].skillReady,25);s.tick=24;assert.equal(B.canCast(s,0),false);B.step(s);assert.equal(B.canCast(s,0),true);
 const disabled=B.create([[human],[orc]],[]);disabled.started=true;assert.equal(B.cast(disabled,0),false);
});
test('validation rejects malformed imports and accepts empty library, all supported selectors',()=>{
 assert.deepEqual(S.validate({version:1,skills:S.defaults}).skills,S.defaults);
 assert.deepEqual(S.validate({version:1,skills:[]}),{version:1,skills:[]});
 const original={version:1,skills:[skill('valid',[{kind:'before',field:'job',value:'飛襲',other:{field:'id',value:'orc'}}])]};assert.deepEqual(S.validate(original),original);
 for(const mutate of [d=>d.skills.push(d.skills[0]),d=>d.skills[0].cooldown=.15,d=>d.skills[0].mode='invalid',d=>d.skills[0].effects=null,d=>d.skills[0].conditions=[{kind:'slot',field:'race',value:'人類',slot:11}],d=>d.skills[0].conditions=[{kind:'majority',field:'id',value:'human'}],d=>d.skills[0].conditions[0].other.value='',d=>d.skills[0].conditions=[passive]]){const data=structuredClone(original);mutate(data);assert.throws(()=>S.validate(data));}
});

test('skill art paths default and repair individually while surviving selection and backup',()=>{
 const Saved=require('../js/saved-data.js'),Backup=require('../js/editor-backup.js'),base=skill('art',[],{imagePath:'images/skills/技能 圖案.png'}),lib={version:1,skills:[base]};assert.equal(S.choose([human],S.validate(lib).skills).imagePath,base.imagePath);const file=Backup.collect({getItem:()=>null});file.data.skills=lib;assert.equal(Backup.prepare(file).file.data.skills.skills[0].imagePath,base.imagePath);
 for(const bad of [null,123,'../a.png','https://example.com/a.png','/a.png','a.txt']){const source={version:1,skills:[{...base,imagePath:bad}]},warnings=[];assert.throws(()=>S.validate(source));const read=Saved.skills(source,warnings).skills[0];assert.equal(read.imagePath,'');assert.equal(read.name,base.name);assert.deepEqual(read.effects,S.validate(lib).skills[0].effects);assert.ok(warnings.some(w=>w.includes('.imagePath')));assert.equal(source.skills[0].imagePath,bad);}
 const legacy={...base};delete legacy.imagePath;assert.equal(S.validate({version:1,skills:[legacy]}).skills[0].imagePath,'');
});
