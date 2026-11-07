const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'../..'),folder=fs.mkdtempSync(path.join(os.tmpdir(),'minimajo-browser-')),dataFile=path.join(folder,'minimajo-editor.json');
const file=require('../../js/editor-backup.js').collect({getItem:()=>null});
file.data.characters.items=file.data.characters.items.slice(0,1);file.data.characters.items[0].space=3;
file.data.laws=[{id:'test-law',name:'測試法則',shopWeight:1,shopPrice:1,stats:{maxHp:1},passives:[]}];
fs.writeFileSync(dataFile,JSON.stringify(file));const original=fs.readFileSync(dataFile,'utf8');
const server=require('../../editor-server.cjs').createEditorServer({root,dataFile});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
   const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   const ready=()=>page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');
   await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);await ready();await page.locator('#tab-enemies').click();
   await page.locator('#enemy-name').fill('生成測試');await page.locator('#enemy-match-level').fill('9');await page.locator('#enemy-weight').fill('17');
   await page.locator('#enemy-form button[type="submit"]').click();await page.waitForFunction(()=>!EditorFileSession.state().dirty&&!EditorFileSession.state().pending);
   const baseline=JSON.parse(fs.readFileSync(dataFile,'utf8')).data.enemies.teams;const beforeGeneration=fs.readFileSync(dataFile,'utf8');
   assert.equal(await page.locator('.enemy-generator').evaluate(el=>el.closest('form')),null);
   await page.locator('#enemy-generate').click();assert.equal(await page.locator('#enemy-list button').count(),4);assert.match(await page.locator('#enemy-name').inputValue(),/隨機敵隊/);assert.match(await page.locator('#enemy-message').textContent(),/6／20.*10 份.*提前停止/);
   assert.equal(await page.locator('#enemy-slots > label').first().locator('select').nth(1).inputValue(),'6');
   assert.equal(await page.locator('#enemy-slots > label').first().locator('button').count(),10);
   assert.equal(fs.readFileSync(dataFile,'utf8'),beforeGeneration);
   const draft=await page.locator('#enemy-slots').innerHTML();await page.locator('#enemy-roll-sr').fill('0');await page.locator('#enemy-roll-ssr').fill('0');await page.locator('#enemy-roll-ur').fill('0');await page.locator('#enemy-generate').click();
   assert.match(await page.locator('#enemy-message').textContent(),/生成失敗/);assert.equal(await page.locator('#enemy-slots').innerHTML(),draft);
   await page.locator('#enemy-roll-sr').fill('1');await page.locator('#enemy-roll-count').fill('1');await page.locator('#enemy-roll-laws').fill('0');await page.locator('#enemy-generate').click();
   assert.equal(await page.locator('#enemy-slots > label').first().locator('select').nth(1).inputValue(),'1');assert.equal(await page.locator('#enemy-slots button').count(),0);
   assert.equal(await page.locator('#enemy-list button').count(),5);await page.locator('#enemy-name').fill('新生成隊伍');
   await page.locator('#enemy-form button[type="submit"]').click();await page.waitForFunction(()=>!EditorFileSession.state().dirty&&!EditorFileSession.state().pending);
   const all=JSON.parse(fs.readFileSync(dataFile,'utf8')).data.enemies.teams;assert.equal(all.length,4);assert.deepEqual(all.slice(0,3),baseline);
   const saved=JSON.parse(fs.readFileSync(dataFile,'utf8')).data.enemies.teams.find(t=>t.name==='新生成隊伍');assert.equal(saved.matchLevel,1);assert.equal(saved.weight,100);assert.equal(saved.stars[0],1);
   fs.mkdirSync(path.join(root,'tmp'),{recursive:true});await page.screenshot({path:path.join(root,'tmp/enemy-generator-desktop.png'),fullPage:true});
   await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(root,'tmp/enemy-generator-mobile.png'),fullPage:true});
   await page.reload();await ready();await page.locator('#tab-enemies').click();assert.equal(await page.locator('#enemy-name').inputValue(),'生成測試');assert.equal(await page.locator('#enemy-roll-count').inputValue(),'20');await page.locator('#enemy-list button').filter({hasText:'新生成隊伍'}).click();assert.equal(await page.locator('#enemy-slots > label').first().locator('select').nth(1).inputValue(),'1');assert.deepEqual(errors,[]);
   console.log('Edge: generation, law stacking, failed generation preservation, unsaved isolation, separate new teams, original team preservation, save/reload, defaults and 1440/390px layout passed.');
  }finally{await browser.close();}
 }finally{await new Promise(resolve=>server.close(resolve));if(!path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(folder).startsWith('minimajo-browser-'))throw Error('Unsafe test cleanup');fs.rmSync(folder,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
