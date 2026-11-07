const {test}=require('node:test'),assert=require('node:assert/strict');const S=require('../js/statuses.js'),B=require('../js/battle.js');
test('custom compound status runs periodic damage, power and speed with formulas and snapshot rules',()=>{
 const original=S.snapshot();try{
 const lib=structuredClone(original);lib.statuses.push({id:'custom',name:'烈焰',effects:[{behavior:'poison',scale:2},{behavior:'power',value:7},{behavior:'haste',formula:'0.5'}]});S.configure(lib);
 const u={name:'A',cooldown:10,maxHp:100,effects:[]},s=B.create([[u],[u]],[]);const a=s.teams[0].units[0];S.apply(a,{status:'custom',duration:{kind:'seconds',value:5}},3,0);
 assert.equal(S.sum(a,'power'),7);assert.equal(S.speed(a),1.5);lib.statuses.at(-1).effects[0].scale=9;S.configure(lib);for(let i=0;i<10;i++)B.step(s);assert.equal(a.hp,94);
 assert.equal(S.has(a,'custom'),true);assert.equal(S.fixed('custom'),false);assert.equal(S.timed('custom'),true);
 }finally{S.configure(original);}
});
test('status library rejects unknown behaviors, missing built-ins and invalid formulas atomically',()=>{
 const original=S.snapshot();assert.throws(()=>S.configure({version:1,statuses:[]}));assert.deepEqual(S.snapshot(),original);
 for(const e of [{behavior:'other',value:1},{behavior:'power',value:-1},{behavior:'regen',formula:'bad()'}])assert.throws(()=>S.validateLibrary({version:1,statuses:[...original.statuses,{id:'invalid',name:'錯誤',effects:[e]}]}));
});

test('status descriptions and art paths roundtrip and repair independently without changing effects',()=>{
 const R=require('../js/saved-data.js'),Backup=require('../js/editor-backup.js'),before=S.snapshot();try{
 const lib=S.snapshot();lib.statuses[0].description='狀態介紹\n第二行';lib.statuses[0].imagePath='images/statuses/中毒.png';S.configure(lib);assert.equal(S.snapshot().statuses[0].description,lib.statuses[0].description);assert.equal(S.snapshot().statuses[0].imagePath,lib.statuses[0].imagePath);
 const file=Backup.collect({getItem:()=>null});file.data.statuses=lib;assert.deepEqual(Backup.prepare(file).file.data.statuses,lib);
 const bad=structuredClone(lib),warnings=[];bad.statuses[0].description=123;bad.statuses[1].imagePath='../bad.png';const repaired=R.statuses(bad,warnings);assert.equal(repaired.statuses[0].description,'');assert.equal(repaired.statuses[0].imagePath,lib.statuses[0].imagePath);assert.equal(repaired.statuses[1].imagePath,'');assert.deepEqual(repaired.statuses[0].effects,lib.statuses[0].effects);assert.equal(bad.statuses[0].description,123);assert.ok(warnings.some(x=>x.includes('description')));assert.ok(warnings.some(x=>x.includes('imagePath')));
 for(const imagePath of ['https://example.com/a.png','/a.png','../a.png','a.txt']){const invalid=structuredClone(lib);invalid.statuses[0].imagePath=imagePath;assert.throws(()=>S.validateLibrary(invalid));}
 const invalid=structuredClone(lib);invalid.statuses[0].description='x'.repeat(2001);assert.throws(()=>S.validateLibrary(invalid));delete invalid.statuses[0].description;delete invalid.statuses[0].imagePath;assert.equal(S.validateLibrary(invalid).statuses[0].description,'');assert.equal(S.validateLibrary(invalid).statuses[0].imagePath,'');
 }finally{S.configure(before);}
});
