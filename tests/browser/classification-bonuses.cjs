const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'../..'),folder=fs.mkdtempSync(path.join(os.tmpdir(),'minimajo-browser-')),dataFile=path.join(folder,'minimajo-editor.json');
fs.writeFileSync(dataFile,JSON.stringify(require('../../js/editor-backup.js').collect({getItem:()=>null})));
const server=require('../../editor-server.cjs').createEditorServer({root,dataFile});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
   const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const ready=async()=>{try{await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');}catch(e){throw Error(e.message+'; '+await page.locator('#editor-file-status').textContent()+'; '+errors.join('; '));}};
   const synced=()=>page.waitForFunction(()=>!window.EditorFileSession.state().dirty&&!window.EditorFileSession.state().pending);
   await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);await ready();await page.locator('#tab-growth').click();
   const tabs=page.locator('[data-tab-group="growth-settings"]');assert.equal(await tabs.count(),6);
   for(let i=0;i<4;i++){
    await page.locator('#tab-growth-job-'+i).click();assert.equal(await page.locator('#growth-job-'+i+' .growth-row').count(),5);
    assert.equal(await page.locator('#page-growth [role="tabpanel"]:visible').count(),1);
   }
   await page.locator('#tab-growth-job-1').click();const job=page.locator('#growth-job-1 [data-field="maxHp"]').first();await job.fill('10');
   await page.locator('#tab-growth-race').click();const race=page.locator('#growth-race [data-field="maxHp"]').first();await race.fill('30');
   await page.locator('#tab-growth-rarity').click();const rarity=page.locator('#growth-rarity [data-field="maxHp"]').first();await rarity.fill('20');
   await page.locator('#tab-growth-job-1').click();assert.equal(await job.inputValue(),'10');
   await page.locator('#growth-form button[type="submit"]').click();await synced();
   const data=JSON.parse(fs.readFileSync(dataFile,'utf8')).data.characters;assert.equal(data.jobGrowth.破陣[0].maxHp,10);assert.equal(data.raceBonuses.人類.maxHp,30);assert.equal(data.rarityBonuses.SR.maxHp,20);
   await page.reload();await ready();await page.locator('#tab-growth').click();await page.locator('#tab-growth-race').click();assert.equal(await race.inputValue(),'30');
   await page.locator('#tab-growth-race').press('ArrowRight');assert.equal(await page.locator('#tab-growth-rarity').getAttribute('aria-selected'),'true');
   // A hidden invalid field must be revealed by the shared tabs controller.
   await page.locator('#tab-growth-race').click();await race.fill('');await page.locator('#tab-growth-rarity').click();
   await page.locator('#growth-form button[type="submit"]').click();assert.equal(await page.locator('#tab-growth-race').getAttribute('aria-selected'),'true');await race.fill('30');
   await page.locator('#growth-form button[type="submit"]').click();await synced();
   await page.locator('#tab-characters').click();assert.match(await page.locator('#growth-preview tr').nth(1).textContent(),/230/);
   const runtime=await page.evaluate(()=>{
    const item=CharacterLibrary.getItems()[0],s=Expedition.create(CharacterLibrary.getItems(),[],GameConfig.read(localStorage));
    return {initial:ItemDB.atStars(item,1).maxHp,upgraded:ItemDB.atStars(item,6).maxHp,journey:s.active[0].maxHp};
   });assert.deepEqual(runtime,{initial:230,upgraded:240,journey:230});
   await page.locator('#tab-growth').click();await page.locator('#tab-growth-race').click();
   await page.screenshot({path:path.join(root,'tmp/classification-bonuses-desktop.png'),fullPage:true});
   await page.setViewportSize({width:390,height:844});
   for(let i=0;i<6;i++){await tabs.nth(i).click();assert.equal(await page.locator('#page-growth [role="tabpanel"]:visible').count(),1);}
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:path.join(root,'tmp/classification-bonuses-mobile.png'),fullPage:true});assert.deepEqual(errors,[]);
   console.log('Edge: six nested tabs, drafts, keyboard, hidden validation, save/reload, preview and journey bonuses, 1440px/390px layouts passed.');
  }finally{await browser.close();}
 }finally{await new Promise(resolve=>server.close(resolve));if(!path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(folder).startsWith('minimajo-browser-'))throw Error('Unsafe test cleanup');fs.rmSync(folder,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
