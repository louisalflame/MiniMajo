// Uses a temporary fixed JSON and an isolated browser; production art assignments stay unchanged.
const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'../..'),folder=fs.mkdtempSync(path.join(os.tmpdir(),'minimajo-detail-')),dataFile=path.join(folder,'minimajo-editor.json');
fs.writeFileSync(dataFile,JSON.stringify(require('../../js/editor-backup.js').collect({getItem:()=>null})));
const server=require('../../editor-server.cjs').createEditorServer({root,dataFile});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));const url=`http://127.0.0.1:${server.address().port}`;
  await page.goto(url+'/editor.html');await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');
  assert.equal(await page.locator('#detail-image-file').inputValue(),'');
  await page.locator('#image-file').fill('grenna-1slot.png');await page.locator('#detail-image-file').fill('dorothea-1slot.png');
  await page.locator('#editor-form button[type=submit]').click();
  await page.waitForFunction(()=>!EditorFileSession.state().dirty&&!EditorFileSession.state().pending);
  assert.equal(JSON.parse(fs.readFileSync(dataFile,'utf8')).data.characters.items[0].detailImageFile,'dorothea-1slot.png');
  await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');
  assert.equal(await page.locator('#detail-image-file').inputValue(),'dorothea-1slot.png');
  await page.locator('#duplicate').click();assert.equal(await page.locator('#detail-image-file').inputValue(),'dorothea-1slot.png');
  await page.waitForFunction(()=>!EditorFileSession.state().dirty&&!EditorFileSession.state().pending);
  await page.setViewportSize({width:390,height:844});
  const field=await page.locator('#detail-image-file').boundingBox();assert.ok(field.x>=0&&field.x+field.width<=390);
  await page.goto(url+'/play.html');
  await page.evaluate(()=>{const state=Expedition.create(ItemDB.read(localStorage).items,[]);ExpeditionUI.bind(state);ExpeditionUI.open('gear');});
  await page.locator('#roster-bottom .occupied').first().click();
  await page.waitForFunction(()=>{const i=document.querySelector('#detail-art img');return i?.src.endsWith('dorothea-1slot.png')&&i.naturalWidth>0&&!i.hidden;});
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  await page.goto(url+'/battle.html?preview=1');
  const setUnit=async detailImageFile=>{
   await page.evaluate(detailImageFile=>{
    const unit={...ItemDB.defaults[0],imageFile:'grenna-1slot.png',detailImageFile,cooldown:120};
    postMessage({type:'minimajo-preview',loadouts:[[unit,...Array(9).fill(null)],[unit,...Array(9).fill(null)]],skills:[],limits:[10,10]},location.origin);
   },detailImageFile);
   await page.locator('#play:enabled').waitFor();await page.locator('#ally-units .unit').first().click();
  };
  for(const detailImageFile of ['dorothea-1slot.png','','missing-detail.png']){
   await setUnit(detailImageFile);const expected=detailImageFile==='dorothea-1slot.png'?detailImageFile:'grenna-1slot.png';
   await page.waitForFunction(expected=>{const i=document.querySelector('#detail-art img');return i?.src.endsWith(expected)&&i.naturalWidth>0&&!i.hidden;},expected);
   await page.keyboard.press('Escape');
  }
  assert.deepEqual(errors,[]);console.log('Edge: detail art field save/reload/copy, 390px editor, gear and battle portraits, blank and missing detail fallback passed.');
 }finally{
  if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
  if(!path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(folder).startsWith('minimajo-detail-'))throw Error('Unsafe cleanup');
  fs.rmSync(folder,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
