const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createEditorServer,startEditor}=require('../editor-server.cjs'),Backup=require('../js/editor-backup.js');
const defaults=()=>Backup.collect({getItem:()=>null});
async function fixture(t,{missing=false}={}){
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'minimajo-editor-')),dataFile=path.join(folder,'minimajo-editor.json'),file=defaults();
 if(!missing)await fs.writeFile(dataFile,JSON.stringify(file));const server=createEditorServer({dataFile});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));if(!path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(folder).startsWith('minimajo-editor-'))throw Error('Unsafe test cleanup');await fs.rm(folder,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port;
 const put=(body,revision,headers={})=>fetch(url+'/api/editor-data',{method:'PUT',headers:{'Content-Type':'application/json','X-MiniMajo-Editor':'1','If-Match':revision,...headers},body:typeof body==='string'?body:JSON.stringify(body)});
 return {url,put,dataFile,folder,file};
}
test('opening fixed data validates without writing; saves atomically replace that one file',async t=>{
 const f=await fixture(t),before=await fs.readFile(f.dataFile,'utf8'),loaded=await (await fetch(f.url+'/api/editor-data')).json();
 assert.deepEqual(loaded.file,f.file);assert.equal(await fs.readFile(f.dataFile,'utf8'),before);
 const page=await fetch(f.url+'/editor.html');assert.equal(page.status,200);assert.match(await page.text(),/editor-start.js/);
 const next=structuredClone(f.file);next.data.characters.items[0].name='磁碟角色';const response=await f.put(next,loaded.revision);assert.equal(response.status,200);
 const saved=await response.json();assert.notEqual(saved.revision,loaded.revision);assert.equal(JSON.parse(await fs.readFile(f.dataFile,'utf8')).data.characters.items[0].name,'磁碟角色');assert.deepEqual(await fs.readdir(f.folder),['minimajo-editor.json']);
});
test('missing and malformed files report errors, never create or replace a default file',async t=>{
 const f=await fixture(t,{missing:true});assert.equal((await fetch(f.url+'/api/editor-data')).status,404);assert.equal((await f.put(f.file,'none')).status,404);await assert.rejects(fs.readFile(f.dataFile),{code:'ENOENT'});
 await fs.writeFile(f.dataFile,'{broken');assert.equal((await fetch(f.url+'/api/editor-data')).status,422);assert.equal((await f.put(f.file,'none')).status,422);assert.equal(await fs.readFile(f.dataFile,'utf8'),'{broken');
});
test('stale tabs and external edits cannot overwrite the latest file',async t=>{
 const f=await fixture(t),loaded=await (await fetch(f.url+'/api/editor-data')).json();const next=structuredClone(f.file);next.data.config.startingGold=123;
 const replies=await Promise.all([f.put(next,loaded.revision),f.put(f.file,loaded.revision)]);assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);
 const current=await (await fetch(f.url+'/api/editor-data')).json();await fs.writeFile(f.dataFile,JSON.stringify(f.file,null,1));const external=await fs.readFile(f.dataFile,'utf8');assert.equal((await f.put(next,current.revision)).status,409);assert.equal(await fs.readFile(f.dataFile,'utf8'),external);
});
test('failed replacement preserves the original and cleans temporary data',async t=>{
 const f=await fixture(t),loaded=await (await fetch(f.url+'/api/editor-data')).json(),before=await fs.readFile(f.dataFile,'utf8');
 t.mock.method(fs,'rename',async()=>{throw Error('模擬寫入失敗');});assert.equal((await f.put(f.file,loaded.revision)).status,500);assert.equal(await fs.readFile(f.dataFile,'utf8'),before);assert.deepEqual(await fs.readdir(f.folder),['minimajo-editor.json']);
});
test('invalid input and foreign requests do not touch fixed data',async t=>{
 const f=await fixture(t),loaded=await (await fetch(f.url+'/api/editor-data')).json(),before=await fs.readFile(f.dataFile,'utf8');
 assert.equal((await f.put('{bad',loaded.revision)).status,400);assert.equal((await f.put({},loaded.revision)).status,422);assert.equal((await f.put(f.file,loaded.revision,{Origin:'https://example.com'})).status,403);assert.equal((await f.put(f.file,loaded.revision,{'X-MiniMajo-Editor':'0'})).status,403);assert.equal(await fs.readFile(f.dataFile,'utf8'),before);
});
test('starting twice reuses the same project service and reports other occupied ports clearly',async t=>{
 const f=await fixture(t),port=Number(new URL(f.url).port),before=await fs.readFile(f.dataFile,'utf8');
 const existing=await startEditor({port,root:path.resolve(__dirname,'..')});assert.equal(existing.reused,true);assert.equal(existing.server,null);assert.equal(existing.url,f.url+'/editor.html');
 await assert.rejects(startEditor({port,root:f.folder}),/其他程式或其他專案/);assert.equal(await fs.readFile(f.dataFile,'utf8'),before);
});
