const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../js/editor-backup.js'),T=require('../js/statuses.js');
function storage(){const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
test('complete backup includes defaults and roundtrips every editor database',()=>{
 const a=storage(),file=B.collect(a);assert.equal(Object.keys(file.data).length,9);assert.equal(file.data.characters.jobGrowth.守護.length,5);
 file.data.config.battleSeconds=45;file.data.characters.items[0].name='備份角色';file.data.capacity=[8,9];B.restore(a,file);assert.deepEqual(B.collect(a),B.validate(file));assert.equal(a.data.size,9);
});
test('invalid references are repaired per slot and custom status definitions remain intact',()=>{
 const a=storage(),file=B.collect(a),before=T.snapshot();file.data.statuses.statuses.push({id:'custom',name:'測試',effects:[{behavior:'regen',value:5}]});file.data.characters.items[0].effects=[{type:'status',status:'custom',target:'self',duration:{kind:'seconds',value:3},amount:1}];B.restore(a,file);assert.deepEqual(T.snapshot(),before);
 const saved=new Map(a.data);file.data.enemies.teams[0].slots[0]='missing';const prepared=B.prepare(file);assert.equal(prepared.file.data.enemies.teams[0].slots[0],null);assert.ok(prepared.warnings.some(x=>x.includes('slots[0]')));assert.deepEqual(a.data,saved);B.restore(a,file);assert.deepEqual(T.snapshot(),before);
});
test('failed writes roll back all keys and missing backup sections receive defaults',()=>{
 const a=storage(),file=B.collect(a);B.restore(a,file);const saved=new Map(a.data),set=a.setItem;let count=0;a.setItem=(k,v)=>{if(++count===4)throw Error('quota');set(k,v);};file.data.characters.items[0].name='changed';assert.throws(()=>B.restore(a,file),/已還原/);assert.deepEqual(a.data,saved);
 delete file.data.laws;assert.deepEqual(B.validate(file).data.laws,{version:1,laws:[]});
});

test('schema mismatch is informational and does not discard readable records',()=>{
 const a=storage(),file=B.collect(a),expected=structuredClone(file.data);file.schema='older-schema';const prepared=B.prepare(file);assert.deepEqual(prepared.file.data,expected);assert.ok(prepared.warnings.length);assert.equal(a.data.size,0);B.restore(a,file);assert.deepEqual(B.collect(a).data,expected);
});
