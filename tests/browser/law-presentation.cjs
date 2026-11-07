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
 await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');await page.locator('#tab-laws').click();await page.locator('#law-new').click();
 await page.locator('#law-name').fill('測試介紹法則');await page.locator('#law-description').fill('第一行介紹\n第二行效果');assert.equal(await page.locator('#law-image-path').inputValue(),'');await page.locator('#law-image-path').fill('assets/ui/battle/v1/preparation-book.png');
 await page.locator('#law-form button[type="submit"]').click();await page.waitForFunction(()=>!window.EditorFileSession.state().dirty&&!window.EditorFileSession.state().pending);await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');await page.locator('#tab-laws').click();assert.equal(await page.locator('#law-description').inputValue(),'第一行介紹\n第二行效果');assert.equal(await page.locator('#law-image-path').inputValue(),'assets/ui/battle/v1/preparation-book.png');
 const data=JSON.parse(fs.readFileSync(dataFile,'utf8')).data.laws.laws;assert.equal(data[0].description,'第一行介紹\n第二行效果');
 await page.goto(`http://127.0.0.1:${server.address().port}/play.html`);await page.waitForFunction(()=>!!window.ExpeditionUI);await page.evaluate(laws=>{const state=Expedition.create(ItemDB.defaults,[],undefined,laws);ExpeditionUI.bind(state);ExpeditionUI.open('shop','art-test');},data);await page.locator('#shop-tab-laws').click();
 const card=page.locator('#law-shop-products .law-product').first();assert.equal(await card.locator('.law-card-name').innerText(),'測試介紹法則');assert.equal(await card.locator('.law-description').innerText(),'第一行介紹\n第二行效果');assert.equal(await card.locator('.law-price').innerText(),'50 金幣');await page.waitForFunction(()=>document.querySelector('.law-product-image')?.naturalWidth>0&&!document.querySelector('.law-product-image').hidden);assert.equal(await card.locator('.law-product-image').isVisible(),true);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});assert.ok(await card.locator('.law-description').isVisible());
  assert.equal(await page.locator('#law-shop-products .law-product').count(),4);assert.equal(await page.locator('#law-shop-products .law-passive-note').count(),0);
  const boxes=await page.locator('#law-shop-products .law-product').evaluateAll(cards=>cards.map(c=>{const r=c.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};})),target=await page.locator('#law-target-zone').boundingBox();
  assert.equal(boxes[0].x,boxes[1].x);assert.equal(boxes[2].x,boxes[3].x);
  assert.ok(boxes[0].bottom<=boxes[1].y);assert.ok(boxes[2].bottom<=boxes[3].y);
  assert.equal(boxes[0].y,boxes[2].y);assert.equal(boxes[1].y,boxes[3].y);
  assert.ok(boxes[0].right<=target.x);assert.ok(target.x+target.width<=boxes[2].x);
  assert.equal(await page.locator('.ui-panel-body').first().evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  if(process.env.MINIMAJO_SHOP_SCREENSHOT)await page.screenshot({path:process.env.MINIMAJO_SHOP_SCREENSHOT+'-'+width+'.png'});
 }
 await page.evaluate(laws=>{document.getElementById('expedition-dialog').close();const state=Expedition.create(ItemDB.defaults,[],undefined,[{...laws[0],imagePath:'images/laws/missing.png'}]);ExpeditionUI.bind(state);ExpeditionUI.open('shop','missing');},data);await page.locator('#shop-tab-laws').click();await page.waitForFunction(()=>{const image=document.querySelector('.law-product-image');return image?.complete&&image.naturalWidth===0;});assert.equal(await card.locator('.law-art-placeholder').isVisible(),true);assert.equal(await card.locator('.law-product-image').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('Edge: law description/path edit-save-reload, journey shop name/price/art/description, 390px and missing-art fallback passed.');
 }finally{await browser.close();}
 }finally{await new Promise(resolve=>server.close(resolve));if(!path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(folder).startsWith('minimajo-browser-'))throw Error('Unsafe test cleanup');fs.rmSync(folder,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
