const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('../js/saved-data.js'),D=require('../js/database.js'),C=require('../js/config.js'),H=require('../js/hex-map.js'),B=require('../js/editor-backup.js');
test('partial config preserves zero values and repairs only invalid fields',()=>{
 const warnings=[],result=R.config({battleSeconds:60,startingGold:0,overtimeGrowth:0,weakDuration:'bad',startingActive:Array(10).fill(null)},warnings);
 assert.equal(result.battleSeconds,60);assert.equal(result.startingGold,0);assert.equal(result.overtimeGrowth,0);assert.equal(result.weakDuration,C.defaults.weakDuration);assert.deepEqual(result.startingActive,Array(10).fill(null));assert.ok(warnings.some(x=>x.includes('weakDuration')));
});

test('battle volume defaults per field and preserves a legal zero through config serialization',()=>{
 const source={...C.defaults,battleVolume:'bad',startingGold:0},warnings=[];
 const repaired=R.config(source,warnings);assert.equal(repaired.battleVolume,60);assert.equal(repaired.startingGold,0);assert.equal(source.battleVolume,'bad');
 assert.ok(warnings.some(w=>w.includes('battleVolume')));
 const old={...C.defaults};delete old.battleVolume;assert.equal(R.config(old,[]).battleVolume,60);
 const silent=R.config({...C.defaults,battleVolume:0},[]);assert.equal(C.validate(JSON.parse(JSON.stringify(silent))).battleVolume,0);
});

test('rarity sale bonuses repair per field and preserve zero through reads and full backups',()=>{
 const keys=['srExtraStarSellPrice','ssrExtraStarSellPrice','urExtraStarSellPrice'];
 for(const key of keys)for(const invalid of [undefined,null,false,[], '20',NaN,Infinity,-1,.5,1000001]){
  const source={...C.defaults,startingGold:0,[key]:invalid},before=structuredClone(source),warnings=[];
  const repaired=R.config(source,warnings);assert.equal(repaired[key],0);assert.equal(repaired.startingGold,0);assert(warnings.some(w=>w.includes('config.'+key)));assert.deepEqual(source,before);
 }
 const source=B.collect({getItem:()=>null});const copy=structuredClone(source);
 for(const key of keys)delete copy.data.config[key];const before=structuredClone(copy),warnings=B.prepare(copy);
 assert(keys.every(key=>warnings.file.data.config[key]===0));assert.deepEqual(copy,before);assert.equal(warnings.warnings.filter(w=>keys.some(k=>w.includes(k))).length,3);
 const values={...C.defaults,srExtraStarSellPrice:0,ssrExtraStarSellPrice:40,urExtraStarSellPrice:90};source.data.config=values;
 assert.deepEqual(B.validate(JSON.parse(JSON.stringify(source))).data.config,values);
 const storage=new Map();B.restore({getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},source);
 assert.deepEqual(C.read({getItem:k=>storage.get(k)??null}),values);
});
test('corrupt character field keeps valid sibling fields and records',()=>{
 const source=D.validate({version:2,items:D.defaults}),before=structuredClone(source);source.items[0].maxHp='broken';source.items[0].shopWeight=0;source.items[0].effects=[];
 const warnings=[],result=R.characters(source,warnings);assert.equal(result.items[0].maxHp,1);assert.equal(result.items[0].shopWeight,0);assert.deepEqual(result.items[0].effects,[]);assert.equal(result.items[0].name,before.items[0].name);assert.deepEqual(result.items.slice(1),before.items.slice(1));assert.equal(source.items[0].maxHp,'broken');
});
test('invalid nested effects receive legal defaults without losing the character',()=>{
 const source=D.validate({version:2,items:D.defaults});source.items[0].effects=[{type:'status',amount:null,status:'missing',target:'wrong',duration:{kind:'wrong'},targeting:{side:'enemy',mode:'self'}},null];
 const result=R.characters(source,[]);assert.equal(result.items.length,source.items.length);assert.equal(result.items[0].effects.length,2);assert.doesNotThrow(()=>D.validate(result));
});
test('overlap and missing references become null; empty enemy stays disabled',()=>{
 const unit={...D.defaults[0],space:2},warnings=[],slots=[unit.id,unit.id,'missing',...Array(7).fill(null)];
 const config=R.config({...C.defaults,startingActive:slots},warnings,[unit]);assert.equal(config.startingActive[0],unit.id);assert.equal(config.startingActive[1],null);assert.equal(config.startingActive[2],null);
 const result=R.enemies({teams:[{id:'empty',name:'保留敵隊',category:'normal',weight:5,slots:Array(10).fill(null)}]},warnings,[unit]);assert.equal(result.teams[0].name,'保留敵隊');assert.equal(result.teams[0].weight,0);assert.ok(warnings.some(x=>x.includes('停用抽選')));
});
test('map preserves false and zero while repairing impossible generation rules',()=>{
 const warnings=[],result=R.map({radius:4,seed:'TEST',rules:{...H.defaults(4),quotas:{normal:59,elite:59}},rewardDecay:{enabled:false,stages:[]}},warnings);
 assert.equal(result.rewardDecay.enabled,false);assert.deepEqual(result.rewardDecay.stages,[]);assert.doesNotThrow(()=>H.generate(result.radius,result.seed,result.rules));assert.ok(warnings.some(x=>x.includes('map.rules')));
});
test('reading malformed stored section and partial capacity does not overwrite raw data',()=>{
 const data=new Map([[R.keys.characters,'{bad'],[R.keys.capacity,'[7,"bad"]']]),before=new Map(data),storage={getItem:k=>data.get(k)??null,setItem:()=>assert.fail('read must not write')},warnings=[];
 assert.ok(R.read('characters',storage,warnings).items.length);assert.deepEqual(C.readCapacity(storage),[7,10]);B.collect(storage);assert.deepEqual(data,before);assert.ok(warnings.some(x=>x.includes('JSON')));
});
test('unrecognizable backup cannot write over saved data',()=>{
 const storage={getItem:()=>null,setItem:()=>assert.fail('must not write')};for(const file of [null,{},[],{data:{}},{format:'other',data:{}}])assert.throws(()=>B.restore(storage,file),/無法辨識/);
});
test('both original project backups import without mutating their input',()=>{
 const fs=require('node:fs'),path=require('node:path');for(const name of ['minimajo-editor-current.json','minimajo-editor.json']){
 const filename=path.join(__dirname,'..',name);if(!fs.existsSync(filename))continue;const file=JSON.parse(fs.readFileSync(filename,'utf8')),before=structuredClone(file),prepared=B.prepare(file);
 assert.deepEqual(file,before);assert.equal(prepared.file.data.config.battleSeconds,file.data.config.battleSeconds??C.defaults.battleSeconds);assert.deepEqual(prepared.file.data.characters.items.map(x=>x.name),file.data.characters.items.map(x=>x.name));assert.ok(Array.isArray(prepared.warnings));
 }
});

test('enemy law duplicates survive repairs and backup roundtrip without renaming IDs',()=>{
 const law={shopPrice:50,shopWeight:100,id:'stack',name:'強化',stats:{maxHp:20},passives:[]},file=B.collect({getItem:()=>null});
 file.data.enemies.teams[0].laws[0]=[law,{...law,stats:{maxHp:'bad',damage:7}}];
 const original=structuredClone(file),warnings=[],loaded=R.enemies(file.data.enemies,warnings,file.data.characters.items);
 assert.deepEqual(loaded.teams[0].laws[0].map(l=>l.id),['stack','stack']);
 assert.equal(loaded.teams[0].laws[0][1].stats.damage,7);assert.ok(warnings.some(w=>w.includes('maxHp')));
 const prepared=B.prepare(file);assert.deepEqual(prepared.file.data.enemies.teams[0].laws[0],loaded.teams[0].laws[0]);
 const store=new Map(),storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 B.restore(storage,file);assert.deepEqual(B.collect(storage).data.enemies.teams[0].laws[0],loaded.teams[0].laws[0]);
 assert.deepEqual(file,original);
});

test('legacy law commerce fields repair individually in libraries and attached duplicates',()=>{
 const legacy={id:'legacy',name:'舊法則',stats:{damage:7},passives:[]},before=structuredClone(legacy),warnings=[];
 const loaded=R.laws([legacy,{...legacy,id:'zero',shopPrice:0,shopWeight:0},{...legacy,id:'invalid',shopPrice:-1,shopWeight:'bad'}],warnings).laws;
 assert.deepEqual(loaded.map(l=>[l.shopPrice,l.shopWeight]),[[50,100],[0,0],[50,100]]);assert.equal(loaded[0].stats.damage,7);assert.deepEqual(legacy,before);assert.ok(warnings.some(w=>w.includes('shopPrice')));assert.ok(warnings.some(w=>w.includes('shopWeight')));
 const E=require('../js/enemy-teams.js'),teams=E.defaults(D.defaults);teams.teams[0].laws=Array.from({length:10},()=>[]);teams.teams[0].laws[0]=[legacy,legacy];const repaired=R.enemies(teams,[],D.defaults);
 assert.deepEqual(repaired.teams[0].laws[0].map(l=>[l.id,l.shopPrice,l.shopWeight]),[['legacy',50,100],['legacy',50,100]]);
 const raw=JSON.stringify({version:1,laws:[legacy]}),storage={getItem:()=>raw,setItem:()=>assert.fail('read must not write')};R.read('laws',storage,[]);assert.equal(storage.getItem(),raw);
});

test('attached laws above one hundred survive per-field recovery without losing inherited copies',()=>{
 const E=require('../js/enemy-teams.js'),teams=E.defaults(D.defaults);teams.teams[0].laws=Array.from({length:10},()=>[]);teams.teams[0].laws[0]=Array.from({length:120},()=>({id:'same',name:'繼承法則',stats:{damage:1},passives:[]}));
 const repaired=R.enemies(teams,[],D.defaults);assert.equal(repaired.teams[0].laws[0].length,120);assert.ok(repaired.teams[0].laws[0].every(l=>l.id==='same'));assert.equal(E.formation(repaired.teams[0],D.defaults)[0].laws.length,120);
});

test('fragile quotas repair individually, preserve legacy full maps and survive complete backup',()=>{
 const raw={version:1,radius:2,seed:'legacy-full',rules:{...H.defaults(2),quotas:{battle:17,elite:0,rest:0,shop:0}},alarm:{enabled:false,threshold:3,percent:15}},original=structuredClone(raw),warnings=[];
 const loaded=R.map(raw,warnings);assert.equal(loaded.rules.quotas.fragile,0);assert.equal(loaded.rules.quotas.battle,17);assert.deepEqual(raw,original);assert.ok(warnings.some(w=>w.includes('quotas.fragile')));assert.ok(!warnings.some(w=>w.includes('配額與間距')));
 for(const value of [-1,1.5,'2',null]){const w=[],repaired=R.map({...raw,rules:{...raw.rules,quotas:{...raw.rules.quotas,fragile:value}}},w);assert.equal(repaired.rules.quotas.fragile,0);assert.equal(repaired.rules.quotas.battle,17);}
 const file=B.collect({getItem:()=>null});file.data.map={...file.data.map,rules:{...file.data.map.rules,quotas:{...file.data.map.rules.quotas,fragile:0}}};assert.equal(B.prepare(file).file.data.map.rules.quotas.fragile,0);
 file.data.map.rules.quotas.fragile=4;assert.equal(B.prepare(file).file.data.map.rules.quotas.fragile,4);
 const storage={getItem:()=>JSON.stringify(raw),setItem:()=>assert.fail('read must not write')};assert.equal(R.read('map',storage,[]).rules.quotas.fragile,0);
});
