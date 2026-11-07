const {gamePage}=require('./game-page.cjs');
// Edit only an isolated saved-data copy, then inspect actual sell previews and payouts.
const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tmp/browser/star-sale');fs.mkdirSync(out,{recursive:true});
const before=fs.readFileSync(path.join(root,'minimajo-editor.json')),dataFile=path.join(out,'editor.json');fs.writeFileSync(dataFile,before);
const server=require('../../editor-server.cjs').createEditorServer({root,dataFile});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});const page=gamePage(await browser.newPage()),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=`http://127.0.0.1:${server.address().port}`;
  await page.goto(url+'/editor.html');await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');await page.locator('#tab-config').click();
  for(const [rarity,value] of [['sr',0],['ssr',25],['ur',50]])await page.locator('#config-'+rarity+'-extra-star-sell-price').fill(String(value));
  await page.locator('#config-sell-percent').fill('33');await page.locator('#config-form button[type="submit"]').click();
  await page.waitForFunction(()=>!EditorFileSession.state().dirty&&!EditorFileSession.state().pending);
  await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');await page.locator('#tab-config').click();
  for(const [rarity,value] of [['sr',0],['ssr',25],['ur',50]])assert.equal(await page.locator('#config-'+rarity+'-extra-star-sell-price').inputValue(),String(value));
  const config=JSON.parse(fs.readFileSync(dataFile,'utf8')).data.config;
  assert.equal(config.srExtraStarSellPrice,0);assert.equal(config.ssrExtraStarSellPrice,25);assert.equal(config.urExtraStarSellPrice,50);
  for(const width of [1366,390]){
   await page.setViewportSize({width,height:900});await page.goto(url+'/play.html');await page.waitForFunction(()=>!!window.ExpeditionUI);
   await page.evaluate(()=>{
    const config={...GameConfig.read(localStorage),startingGold:100,startingActive:Array(10).fill(null)};
    const items=['SR','SSR','UR'].map((rarity,i)=>({...ItemDB.defaults[0],id:'sale-'+i,name:rarity+'賣回',rarity,stars:1,shopPrice:31,imageFile:'youmeng-1slot.png'}));
    const state=Expedition.create(items,[],config);[1,3,4].forEach((stars,i)=>state.active[i]={...ItemDB.atStars(state.library[i],stars,config),instanceId:'sale-'+i});
    window.saleFixture=state;ExpeditionUI.bind(state);ExpeditionUI.open('gear');
   });
   let total=100;
   for(const [slot,payout] of [[0,31],[1,60],[2,160]]){
    const source=page.locator(`#roster-bottom [data-drop-slot="${slot}"]`),target=page.locator('#roster-sell-zone');await source.scrollIntoViewIfNeeded();
    const a=await source.boundingBox(),b=await target.boundingBox();await page.mouse.move(a.x+a.width*.4,a.y+a.height*.4);await page.mouse.down();await page.mouse.move(b.x+b.width*.5,b.y+b.height*.5,{steps:12});
    assert.match(await target.innerText(),new RegExp('\\+'+payout+'$'));
    await page.screenshot({path:path.join(out,`preview-${width}-${slot}.png`)});await page.mouse.up();total+=payout;
    assert.equal(await page.evaluate(()=>saleFixture.gold),total);assert.equal(await page.evaluate(slot=>saleFixture.active[slot],slot),null);
   }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(fs.readFileSync(path.join(root,'minimajo-editor.json')),before);
  console.log('PASS: isolated Config save/reload with zero and positive bonuses; desktop/390px actual sell previews equal payouts for SR1/SSR3/UR4; root settings unchanged.');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
