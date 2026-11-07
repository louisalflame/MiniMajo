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
 await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');await page.locator('#tab-character-effects').click();
 const sizing=async id=>page.locator(id).evaluate(e=>{const s=getComputedStyle(e);return {display:s.display,padding:s.padding,font:s.font,lineHeight:s.lineHeight,resize:s.resize,height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width,parentWidth:e.parentElement.getBoundingClientRect().width};});
 const expected=await sizing('#character-description');await page.locator('#tab-laws').click();await page.locator('#law-new').click();const lawSize=await sizing('#law-description');for(const key of ['display','padding','font','lineHeight','resize','height'])assert.equal(lawSize[key],expected[key]);assert.ok(Math.abs(lawSize.width-lawSize.parentWidth)<2);
 await page.locator('#tab-statuses').click();await page.locator('#status-new').click();const statusSize=await sizing('#status-description');for(const key of ['display','padding','font','lineHeight','resize','height'])assert.equal(statusSize[key],expected[key]);assert.ok(Math.abs(statusSize.width-statusSize.parentWidth)<2);
 await page.locator('#status-name').fill('介紹測試狀態');await page.locator('#status-description').fill('狀態介紹\n第二行');assert.equal(await page.locator('#status-image-path').inputValue(),'');await page.locator('#status-image-path').fill('images/statuses/test.png');await page.locator('#status-form button[type="submit"]').click();await page.waitForFunction(()=>document.getElementById('status-message').textContent.includes('已儲存'));await page.waitForFunction(()=>!window.EditorFileSession.state().dirty&&!window.EditorFileSession.state().pending);
 const saved=JSON.parse(fs.readFileSync(dataFile,'utf8')).data.statuses.statuses.at(-1);assert.equal(saved.description,'狀態介紹\n第二行');assert.equal(saved.imagePath,'images/statuses/test.png');await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');await page.locator('#tab-statuses').click();await page.locator('#status-list button').filter({hasText:'介紹測試狀態'}).click();assert.equal(await page.locator('#status-description').inputValue(),saved.description);assert.equal(await page.locator('#status-image-path').inputValue(),saved.imagePath);
 await page.setViewportSize({width:390,height:844});const mobile=await sizing('#status-description');assert.ok(Math.abs(mobile.width-mobile.parentWidth)<2);assert.deepEqual(errors,[]);console.log('Edge: law/status descriptions match skill textarea size/styles, status blank path/edit/save/reload and 390px width passed.');
 }finally{await browser.close();}
 }finally{await new Promise(resolve=>server.close(resolve));if(!path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(folder).startsWith('minimajo-browser-'))throw Error('Unsafe test cleanup');fs.rmSync(folder,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
