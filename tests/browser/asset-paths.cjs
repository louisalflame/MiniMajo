const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tmp/asset-paths');
const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const Backup=require(path.join(root,'js/editor-backup.js')),fixed=fs.readFileSync(path.join(root,'minimajo-editor.json')),prepared=Backup.prepare(JSON.parse(fixed));
fs.mkdirSync(out,{recursive:true});
const server=require(path.join(root,'editor-server.cjs')).createEditorServer({root});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({headless:true,channel:'msedge'});const context=await browser.newContext();
 await context.addInitScript(({keys,data})=>{for(const [k,key]of Object.entries(keys))localStorage.setItem(key,JSON.stringify(data[k]));},{keys:Backup.keys,data:prepared.file.data});
 const page=await context.newPage(),errors=[],failed=[],results=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push({status:r.status(),url:r.url()});});
 const origin='http://127.0.0.1:'+server.address().port;
 for(const route of ['index.html','play.html','editor.html','battle.html']){
  await page.goto(origin+'/'+route,{waitUntil:'networkidle'});results.push({route,errors:[...errors],failed:[...failed]});
  assert.deepEqual(errors,[],route+' page errors');assert.deepEqual(failed,[],route+' missing resources');
  if(route==='editor.html'){
   assert.ok((await page.locator('#map-gear img').getAttribute('src')).endsWith('assets/ui/battle/v1/preparation-book.png'));
   await page.evaluate(()=>{ExpeditionUI.bind(Expedition.create(ItemDB.defaults,[]));ExpeditionUI.open('shop','asset-path-check');});
   const shell=await page.locator('#expedition-dialog').evaluate(el=>getComputedStyle(el,'::before').borderImageSource);
   assert.ok(shell.includes('assets/ui/common/parchment-panel-v2.png'),shell);
   await page.screenshot({path:path.join(out,'editor-shop-shell.png'),fullPage:true});
   results.push({editorBook:'preparation-book.png',editorShopShell:'parchment-panel-v2.png'});
  }
 }
 for(const route of ['previews/dialog-preview.html','previews/roster-preview.html']){
  assert.equal((await page.request.get(origin+'/'+route)).status(),404,route+' must be retired');
 }
 await page.goto(origin+'/play.html',{waitUntil:'networkidle'});
 assert.equal(await page.evaluate(()=>!!document.querySelector('#journey-gear')&&!document.querySelector('#journey-gear').disabled),true);
 const images=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'))).assets.map(x=>x.file);
 const failures=await page.evaluate(async files=>(await Promise.all(files.map(async file=>{try{const i=new Image();i.src=new URL(file,location.href);await i.decode();return null;}catch{return file;}}))).filter(Boolean),images);
 assert.deepEqual(failures,[]);results.push({decodedFormalImages:images.length});
 for(const [width,height]of [[1366,900],[390,844]]){
  await page.setViewportSize({width,height});await page.goto(origin+'/play.html',{waitUntil:'networkidle'});
  await page.evaluate(()=>{const u=ItemDB.read(localStorage).items.find(u=>u.imageFile);CharacterDetails.render(document,u);const dialog=document.getElementById('character-detail');dialog.hidden=false;dialog.showModal();});
  await page.waitForFunction(()=>{const i=document.querySelector('#detail-art img');return i&&i.complete&&i.naturalWidth>0;});
  assert.equal(await page.locator('#detail-art img').evaluate(i=>new URL(i.src).pathname.startsWith('/assets/characters/')),true);
  await page.screenshot({path:path.join(out,'character-details-'+width+'.png'),fullPage:true});
 }
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'minimajo-editor.json'))).digest('hex'),crypto.createHash('sha256').update(fixed).digest('hex'));
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({browser:'isolated headless Edge',results,errors,failed,fixedDataUnchanged:true,fixedDataSha256:crypto.createHash('sha256').update(fixed).digest('hex')},null,2)+'\n');
 console.log('PASS: 4 pages, '+images.length+' decoded assets, desktop/mobile character details, fixed JSON unchanged.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});

