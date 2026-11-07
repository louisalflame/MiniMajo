const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),folder=fs.mkdtempSync(path.join(os.tmpdir(),'minimajo-browser-')),dataFile=path.join(folder,'minimajo-editor.json');
const Backup=require('../../js/editor-backup.js'),initial=Backup.collect({getItem:()=>null});initial.data.characters.items[0].name='固定檔案角色';initial.data.skills.skills.push(...['A','B'].map(letter=>({...initial.data.skills.skills[0],id:'manual-'+letter,name:'手動'+letter,conditions:[]})));
fs.writeFileSync(dataFile,JSON.stringify(initial));const server=require('../../editor-server.cjs').createEditorServer({root,dataFile});
const disk=()=>JSON.parse(fs.readFileSync(dataFile,'utf8'));
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
   const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   page.on('dialog',dialog=>dialog.accept());
   const url=`http://127.0.0.1:${server.address().port}/editor.html`,ready=p=>p.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');
   const synced=()=>page.waitForFunction(()=>window.EditorFileSession.state().ready&&!window.EditorFileSession.state().dirty&&!window.EditorFileSession.state().pending);
   const submit=async id=>{await page.locator('#'+id+' button[type="submit"]').click();await synced();};
   await page.goto(url);await ready(page);assert.equal(await page.locator('#name').inputValue(),'固定檔案角色');
   const original=fs.readFileSync(dataFile,'utf8');await page.locator('#name').fill('尚未儲存草稿');await new Promise(resolve=>setTimeout(resolve,100));assert.equal(fs.readFileSync(dataFile,'utf8'),original);
   await submit('editor-form');assert.equal(disk().data.characters.items[0].name,'尚未儲存草稿');
   await page.locator('#tab-growth').click();await page.locator('#job-growth input').first().fill('12');await submit('growth-form');assert.equal(disk().data.characters.jobGrowth.守護[0].maxHp,12);
   await page.locator('#tab-skills').click();assert.equal(await page.locator('#skill-priority').count(),0);assert.equal(await page.locator('#skill-effects [aria-label="倍率模式"]').count(),0);await page.locator('#skill-edit-name').fill('磁碟技能');await submit('skill-form');assert.equal(disk().data.skills.skills[0].name,'磁碟技能');
   await page.locator('#tab-statuses').click();await page.locator('#status-name').fill('磁碟狀態');await submit('status-form');assert.equal(disk().data.statuses.statuses[0].name,'磁碟狀態');
   await page.locator('#tab-laws').click();await page.locator('#law-new').click();await page.locator('#law-name').fill('磁碟法則');await page.locator('#law-add-passive').click();assert.equal(await page.locator('#law-passives [aria-label="倍率模式"]').count(),0);await page.locator('#law-passives [aria-label="常數整數"]').fill('19');await submit('law-form');assert.equal(disk().data.laws.laws[0].name,'磁碟法則');
   await page.locator('#tab-enemies').click();await page.locator('#enemy-name').fill('磁碟敵隊');await submit('enemy-form');assert.equal(disk().data.enemies.teams[0].name,'磁碟敵隊');
   await page.locator('#tab-config').click();await page.locator('#config-starting-gold').fill('456');await submit('config-form');assert.equal(disk().data.config.startingGold,456);
   await page.locator('#tab-echo').click();await page.locator('#echo-rows input').first().fill('125');await submit('echo-form');assert.equal(disk().data.echo.levels[0].SR,125);
   await page.locator('#tab-map').click();await page.locator('#map-generate').click();await synced();assert.equal(disk().data.map.radius,4);
   await page.locator('#tab-battle').click();await page.locator('#capacity-self').fill('9');await synced();assert.equal(disk().data.capacity[0],9);
   // A failed network write leaves the disk unchanged and offers an explicit retry.
   await page.locator('#tab-characters').click();await page.route('**/api/editor-data',route=>route.request().method()==='PUT'?route.abort():route.continue());const beforeFailure=fs.readFileSync(dataFile,'utf8');
   await page.locator('#name').fill('重試後角色');await page.locator('#editor-form button[type="submit"]').click();await page.waitForFunction(()=>!!window.EditorFileSession.state().error);assert.equal(fs.readFileSync(dataFile,'utf8'),beforeFailure);assert.match(await page.locator('#editor-file-status').innerText(),/寫入失敗/);
   await page.unroute('**/api/editor-data');await page.locator('#editor-file-retry').click();await synced();assert.equal(disk().data.characters.items[0].name,'重試後角色');
   // A stale tab must report a revision conflict instead of overwriting the file.
   const stale=await context.newPage();stale.on('dialog',dialog=>dialog.accept());await stale.goto(url);await ready(stale);
   await page.locator('#name').fill('最新角色');await submit('editor-form');const latest=fs.readFileSync(dataFile,'utf8');await stale.locator('#name').fill('過期角色');await stale.locator('#editor-form button[type="submit"]').click();await stale.waitForFunction(()=>!!window.EditorFileSession.state().error);assert.equal(fs.readFileSync(dataFile,'utf8'),latest);await stale.close();
   await page.reload();await ready(page);assert.equal(await page.locator('#name').inputValue(),'最新角色');
   // Missing/corrupt files block editing without replacing either disk or cache.
   const cached=await page.evaluate(()=>localStorage.getItem('minimajo.characters.v2'));fs.unlinkSync(dataFile);await page.reload();await page.waitForFunction(()=>document.getElementById('editor-file-status').textContent.includes('找不到固定資料檔'));assert.equal(await page.locator('main').evaluate(n=>n.inert),true);assert.equal(fs.existsSync(dataFile),false);assert.equal(await page.evaluate(()=>localStorage.getItem('minimajo.characters.v2')),cached);
   fs.writeFileSync(dataFile,'{broken');await page.locator('#editor-file-retry').click();await page.waitForFunction(()=>document.getElementById('editor-file-status').textContent.includes('JSON 無法解析'));assert.equal(fs.readFileSync(dataFile,'utf8'),'{broken');
   fs.writeFileSync(dataFile,latest);await page.locator('#editor-file-retry').click();await ready(page);
   // Import remains available for intentionally replacing the fixed file.
   const imported=structuredClone(initial);imported.data.characters.items[0].name='匯入固定檔';await page.locator('#database-import').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true'&&document.getElementById('name').value==='匯入固定檔');assert.equal(disk().data.characters.items[0].name,'匯入固定檔');
   await page.locator('#tab-map').click();await page.locator('#map-gear').click();assert.match(await page.locator('#roster-skill').innerText(),/尚未裝備/);await page.locator('#roster-skill').click();const choices=await page.locator('#roster-skill-options').innerText();assert.match(choices,/手動A/);assert.match(choices,/手動B/);await page.locator('#roster-skill-options').getByRole('button',{name:/手動B/}).click();await page.locator('#roster-skill-confirm').click();assert.match(await page.locator('#roster-skill').innerText(),/手動B/);await page.keyboard.press('Escape');
   const direct=await context.newPage();await direct.goto(require('node:url').pathToFileURL(path.join(root,'editor.html')).href);await direct.waitForSelector('#editor-file-open-http');assert.equal(await direct.locator('#editor-file-open-http').getAttribute('href'),'http://127.0.0.1:4173/editor.html');assert.equal(await direct.locator('main').evaluate(n=>n.inert),true);await direct.close();
   assert.deepEqual(errors,[]);console.log('Edge: auto-save, retry, conflicts, strict loading, replacement import and direct-file HTTP link passed.');await context.close();
  }finally{await browser.close();}
 }finally{await new Promise(resolve=>server.close(resolve));if(!path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(folder).startsWith('minimajo-browser-'))throw Error('Unsafe test cleanup');fs.rmSync(folder,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
