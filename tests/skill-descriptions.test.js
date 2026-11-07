const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../js/database.js'),S=require('../js/skills.js'),Saved=require('../js/saved-data.js'),E=require('../js/effects.js');
test('description repair is per field, preserves empty/custom text and does not mutate legacy input',()=>{
 for(const [kind,db,rows] of [['characters',D,'items'],['skills',S,'skills']]){
  const valid={version:kind==='characters'?2:1,[rows]:structuredClone(db.defaults)};
  const first=valid[rows][0];delete first.description;const before=JSON.stringify(valid),warnings=[];
  const loaded=Saved[kind](valid,warnings);assert.equal(loaded[rows][0].description,E.description(first.effects));assert.ok(warnings.some(x=>x.includes('.description')));assert.equal(JSON.stringify(valid),before);
  for(const bad of [null,5,false,'x'.repeat(2001)]){first.description=bad;const w=[];assert.throws(()=>db.validate(valid),kind==='skills'?/極式說明/:/技能說明/);assert.equal(Saved[kind](valid,w)[rows][0].description,E.description(first.effects));assert.ok(w.some(x=>x.includes('.description')));}
  for(const good of ['', '第一行\n第二行','<img src=x>']){first.description=good;assert.equal(Saved[kind](valid,[])[rows][0].description,good);assert.equal(db.validate(valid)[rows][0].description,good);}
 }
});
test('character descriptions survive growth and runtime snapshots',()=>{
 const unit={...D.defaults[0],description:'自訂說明\n第二行'};assert.equal(D.runtime(D.atStars(unit,6)).description,unit.description);
});
