const {test}=require('node:test'),assert=require('node:assert/strict');
const Backup=require('../js/editor-backup.js'),{create}=require('../js/editor-file.js');
const memory=()=>{const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};

test('fixed file loads completely before ready and load failures leave browser data unchanged',async()=>{
 const storage=memory(),file=Backup.collect(storage);file.data.characters.items[0].name='固定檔角色';
 storage.setItem(Backup.keys.characters,'original');const before=new Map(storage.data);
 const broken=create({storage,backup:Backup,transport:{load:async()=>{throw Error('missing');}}});
 await assert.rejects(broken.load(),/missing/);assert.deepEqual(storage.data,before);assert.equal(broken.state().ready,false);
 const session=create({storage,backup:Backup,transport:{load:async()=>({file,revision:'initial',warnings:['補值紀錄']})}});
 assert.deepEqual(await session.load(),['補值紀錄']);assert.equal(session.state().ready,true);assert.equal(Backup.collect(storage).data.characters.items[0].name,'固定檔角色');
});

test('saved sections are exported in order, retain other saved sections and advance file revisions',async()=>{
 const storage=memory(),file=Backup.collect(storage),calls=[],release=[];
 const session=create({storage,backup:Backup,transport:{load:async()=>({file,revision:'r0'}),save:(snapshot,revision)=>{calls.push({snapshot,revision});return new Promise(resolve=>release.push(resolve));}}});
 await session.load();const characters=structuredClone(file.data.characters);characters.items[0].name='第一筆';storage.setItem(Backup.keys.characters,JSON.stringify(characters));const one=session.save();
 const config={...file.data.config,startingGold:777};storage.setItem(Backup.keys.config,JSON.stringify(config));const two=session.save();await Promise.resolve();
 assert.equal(calls.length,1);assert.equal(calls[0].snapshot.data.config.startingGold,300);assert.equal(calls[0].revision,'r0');assert.equal(session.state().pending,2);
 release[0]({revision:'r1'});await one;await Promise.resolve();assert.equal(calls.length,2);assert.equal(calls[1].snapshot.data.characters.items[0].name,'第一筆');assert.equal(calls[1].snapshot.data.config.startingGold,777);assert.equal(calls[1].revision,'r1');
 release[1]({revision:'r2'});await two;assert.equal(session.state().dirty,false);assert.equal(session.state().pending,0);
});

test('failed disk writes retain saved browser data, expose retry state and never claim synchronization',async()=>{
 const storage=memory(),file=Backup.collect(storage);let fail=true;
 const session=create({storage,backup:Backup,transport:{load:async()=>({file,revision:'r0'}),save:async()=>{if(fail)throw Error('磁碟寫入失敗');return {revision:'r1'};}}});
 await session.load();storage.setItem(Backup.keys.capacity,'[8,9]');await assert.rejects(session.save(),/磁碟/);
 assert.equal(storage.getItem(Backup.keys.capacity),'[8,9]');assert.equal(session.state().dirty,true);assert.match(session.state().error,/磁碟/);assert.equal(session.state().revision,'r0');
 fail=false;await session.save();assert.equal(session.state().dirty,false);assert.equal(session.state().error,'');
});
