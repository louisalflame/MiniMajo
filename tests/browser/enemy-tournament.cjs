const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'../..'),folder=fs.mkdtempSync(path.join(os.tmpdir(),'minimajo-browser-')),dataFile=path.join(folder,'minimajo-editor.json');
const file=require('../../js/editor-backup.js').collect({getItem:()=>null});
file.data.characters.items=file.data.characters.items.slice(0,3).map((u,i)=>({...u,name:['強隊角色','中隊角色','弱隊角色'][i],maxHp:100,cooldown:[.1,.2,1][i],effects:[{type:'damage',amount:[1000,30,1][i]}]}));
const units=file.data.characters.items;
file.data.enemies={version:1,teams:units.map((u,i)=>({id:'test-'+i,name:['強隊','中隊','弱隊'][i],category:['normal','elite','boss'][i],matchLevel:99,weight:0,slots:[u.id,...Array(9).fill(null)]}))};
file.data.enemies.teams.push({id:'empty',name:'空隊',category:'normal',matchLevel:1,weight:0,slots:Array(10).fill(null)});
file.data.config.battleSeconds=1;
fs.writeFileSync(dataFile,JSON.stringify(file));const original=fs.readFileSync(dataFile,'utf8');
const server=require('../../editor-server.cjs').createEditorServer({root,dataFile});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
   const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:${server.address().port}/editor.html#enemy-tournament`);await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');
   assert.equal(await page.locator('#page-enemy-tournament').isVisible(),true);assert.equal(await page.locator('#tournament-teams input').count(),4);assert.equal(await page.locator('#tournament-teams input:disabled').count(),1);
   await page.locator('#tournament-start').click();assert.match(await page.locator('#tournament-message').textContent(),/請選擇/);
   await page.locator('#tournament-search').fill('強隊');await page.locator('#tournament-all').click();assert.match(await page.locator('#tournament-estimate').textContent(),/已選 1 隊/);
   await page.locator('#tournament-search').fill('');await page.locator('#tournament-all').click();await page.locator('#tournament-rounds').fill('2');assert.match(await page.locator('#tournament-estimate').textContent(),/共 6 場/);
   await page.locator('#tournament-start').click();await page.waitForFunction(()=>document.getElementById('tournament-message').textContent.startsWith('測試完成'));
   assert.match(await page.locator('#tournament-progress-text').textContent(),/6／6/);const rows=await page.locator('#tournament-ranking tr').allTextContents();assert.match(rows[0],/強隊/);assert.match(rows[0],/100.0%/);assert.match(rows[2],/弱隊/);
   const records=await page.locator('#tournament-ranking tr').evaluateAll(rows=>rows.map(r=>[...r.children].map(c=>c.textContent)));assert.deepEqual(records.map(r=>r.slice(2,7)),[['4','4','0','0','0'],['4','2','2','0','0'],['4','0','4','0','0']]);
   await page.locator('#tournament-focus').selectOption('2');const opponents=await page.locator('#tournament-pairs tr').evaluateAll(rows=>rows.map(r=>[...r.children].map(c=>c.textContent)));assert.equal(opponents.length,2);assert.ok(opponents.every(r=>r[3]==='2'&&r[6]==='0.0%'));
   assert.equal(fs.readFileSync(dataFile,'utf8'),original);
   fs.mkdirSync(path.join(root,'tmp'),{recursive:true});await page.screenshot({path:path.join(root,'tmp/enemy-tournament-desktop.png'),fullPage:true});
   await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(root,'tmp/enemy-tournament-mobile.png'),fullPage:true});
   // Stop immediately after dispatch to verify the real worker is terminated and no partial game is counted.
   await page.evaluate(()=>{document.getElementById('tournament-start').click();document.getElementById('tournament-stop').click();});assert.match(await page.locator('#tournament-message').textContent(),/已停止.*部分結果/);assert.equal(await page.locator('#tournament-start').isEnabled(),true);
   await page.route('**/js/enemy-tournament-worker.js',route=>route.abort());await page.locator('#tournament-start').click();await page.waitForFunction(()=>document.getElementById('tournament-message').textContent.startsWith('背景運算失敗'));assert.equal(await page.locator('#tournament-start').isEnabled(),true);await page.unroute('**/js/enemy-tournament-worker.js');
   await page.locator('#tournament-start').click();await page.waitForFunction(()=>document.getElementById('tournament-message').textContent.startsWith('測試完成'));
   await page.locator('#tournament-none').click();assert.match(await page.locator('#tournament-estimate').textContent(),/已選 0 隊/);assert.equal(fs.readFileSync(dataFile,'utf8'),original);assert.deepEqual(errors,[]);
   console.log('Edge: tab deep link, selection/filtering, empty and zero-weight teams, real background round robin, exact records, pair perspective, stop/retry, worker error recovery, read-only data and 1440/390px passed.');
  }finally{await browser.close();}
 }finally{await new Promise(resolve=>server.close(resolve));if(!path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(folder).startsWith('minimajo-browser-'))throw Error('Unsafe test cleanup');fs.rmSync(folder,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
