const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'../..'),folder=fs.mkdtempSync(path.join(os.tmpdir(),'minimajo-browser-')),dataFile=path.join(folder,'minimajo-editor.json');
const file=require('../../js/editor-backup.js').collect({getItem:()=>null});
file.data.characters.items[0].description='手寫說明不應代替自動效果';file.data.characters.items[1].effects=[];
file.data.characters.items[0].effects=[{type:'damage',amount:321},{type:'heal',amount:7}];
fs.writeFileSync(dataFile,JSON.stringify(file));const original=fs.readFileSync(dataFile,'utf8');
const server=require('../../editor-server.cjs').createEditorServer({root,dataFile});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
   const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const ready=()=>page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');
   await page.goto(`http://127.0.0.1:${server.address().port}/editor.html#action-overview`);await ready();
   const cards=page.locator('.action-overview-card');assert.equal(await cards.count(),6);
   assert.equal(await page.locator('#overview-race').inputValue(),'');assert.match(await page.locator('#overview-count').textContent(),/6／6/);
   assert.match(await cards.first().textContent(),/321 傷害/);assert.match(await cards.first().textContent(),/副效果 1/);assert.ok(!(await cards.first().textContent()).includes('手寫說明'));
   assert.equal(await page.locator('.action-overview-effects').first().locator('li p').allTextContents().then(v=>JSON.stringify(v)),await page.evaluate(()=>JSON.stringify(CharacterLibrary.getItems()[0].effects.map(EffectEditor.describe))));
   assert.match(await cards.nth(1).textContent(),/無行動效果/);
   await page.locator('#overview-race').selectOption('人類');assert.equal(await cards.count(),2);
   await page.locator('#overview-affinity').selectOption('物理');assert.equal(await cards.count(),1);
   await page.locator('#overview-job').selectOption('守護');assert.equal(await cards.count(),0);assert.match(await page.locator('#overview-list').textContent(),/沒有符合/);
   await page.locator('#overview-reset').click();assert.equal(await cards.count(),6);
   await page.locator('#overview-rarity').selectOption('UR');assert.equal(await cards.count(),0);
   await page.locator('#overview-reset').click();await page.locator('#overview-search').fill(' 靈療 ');assert.equal(await cards.count(),1);
   await page.locator('#overview-reset').click();assert.equal(fs.readFileSync(dataFile,'utf8'),original);
   await page.locator('#tab-characters').click();await page.locator('#name').fill('草稿名稱');await page.locator('#tab-action-overview').click();assert.ok(!(await page.locator('#overview-list').textContent()).includes('草稿名稱'));
   await page.locator('#tab-characters').click();await page.locator('#name').fill('更新後角色');await page.locator('#editor-form button[type="submit"]').click();
   await page.waitForFunction(()=>!window.EditorFileSession.state().dirty&&!window.EditorFileSession.state().pending);
   await page.locator('#tab-action-overview').click();assert.equal(await cards.first().locator('h3').textContent(),'更新後角色');
   await page.screenshot({path:path.join(root,'tmp/action-overview-desktop.png'),fullPage:true});
   await page.setViewportSize({width:390,height:844});await page.locator('#overview-job').selectOption('支援');assert.equal(await cards.count(),1);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:path.join(root,'tmp/action-overview-mobile.png'),fullPage:true});
   await page.reload();await ready();assert.equal(await cards.count(),6);assert.equal(await cards.first().locator('h3').textContent(),'更新後角色');assert.deepEqual(errors,[]);
   console.log('Edge: automatic effect strings, all/combined/name/rarity filters, reset/empty results, draft isolation, save refresh, read-only browsing, 1440px/390px and reload passed.');
  }finally{await browser.close();}
 }finally{await new Promise(resolve=>server.close(resolve));if(!path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(folder).startsWith('minimajo-browser-'))throw Error('Unsafe test cleanup');fs.rmSync(folder,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
