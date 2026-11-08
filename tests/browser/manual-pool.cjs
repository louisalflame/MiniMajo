// Only the isolated editor JSON is writable; the user's settings stay intact.
const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {poolVersionFor}=require('../../tools/build-release.cjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tmp/browser/manual-pool');fs.mkdirSync(out,{recursive:true});
const before=fs.readFileSync(path.join(root,'minimajo-editor.json')),dataFile=path.join(out,'editor.json');fs.writeFileSync(dataFile,before);
const server=require('../../editor-server.cjs').createEditorServer({root,dataFile});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);
  await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');await page.locator('#tab-config').click();
  const field=page.locator('#config-team-pool-version');assert.equal(await field.inputValue(),'1');
  await field.fill('0');await page.locator('#config-form button[type="submit"]').click();
  assert.equal(await field.evaluate(el=>el.validity.valid),false);assert.deepEqual(fs.readFileSync(dataFile),before);
  await field.fill('2');await page.locator('#config-form button[type="submit"]').click();
  await page.waitForFunction(()=>!EditorFileSession.state().dirty&&!EditorFileSession.state().pending);
  let saved=JSON.parse(fs.readFileSync(dataFile,'utf8'));assert.equal(saved.data.config.teamPoolVersion,2);
  const expected=JSON.parse(before);expected.data.config.teamPoolVersion=2;assert.deepEqual(saved,expected);
  const nextPool=poolVersionFor(saved.data);assert.notEqual(nextPool,poolVersionFor(JSON.parse(before).data));
  await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');await page.locator('#tab-config').click();assert.equal(await field.inputValue(),'2');
  await page.locator('#config-sell-percent').fill('71');await page.locator('#config-form button[type="submit"]').click();
  await page.waitForFunction(()=>!EditorFileSession.state().dirty&&!EditorFileSession.state().pending);
  saved=JSON.parse(fs.readFileSync(dataFile,'utf8'));assert.equal(saved.data.config.sellPercent,71);assert.equal(poolVersionFor(saved.data),nextPool);
  await field.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'config.png')});
  assert.deepEqual(errors,[]);assert.deepEqual(fs.readFileSync(path.join(root,'minimajo-editor.json')),before);
  console.log('PASS manual pool Config: invalid input rejected, save/reload version 2, version changes pool, later sale change retains pool, no source writes.');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
