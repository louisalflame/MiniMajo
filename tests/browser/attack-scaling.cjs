// Optional browser regression, using the same Playwright configuration as ui-preview.cjs.
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
   const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');
   await page.locator('#attack').fill('40');await page.locator('#attack-range').fill('3');
   await page.locator('#tab-character-effects').click();
   const effect=page.locator('#effects .effect-card').first();
   assert.equal(await effect.locator('[aria-label="倍率模式"] option').count(),2);assert.equal(await effect.locator('[aria-label="數值模式"]').count(),0);
   await effect.locator('[aria-label="倍率模式"]').selectOption('fixed');await effect.locator('[aria-label="技能倍率"]').fill('2.5');
   await effect.locator('[aria-label="公式來源"]').selectOption('binary');await effect.locator('[aria-label="公式左側來源"]').selectOption('ref');await effect.locator('[aria-label="公式左側戰鬥數值"]').selectOption('target.maxHp');await effect.locator('[aria-label="公式右側固定數值"]').fill('0.1');await effect.locator('[aria-label="常數整數"]').fill('3');
   await effect.locator('[aria-label="選取方式"]').selectOption('opposite');
   await page.locator('#editor-form button[type="submit"]').click();await page.waitForFunction(()=>document.getElementById('form-message').textContent.includes('已儲存'));
   await page.waitForFunction(()=>!window.EditorFileSession.state().dirty&&!window.EditorFileSession.state().pending);await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');await page.locator('#tab-character-effects').click();
   assert.equal(await effect.locator('[aria-label="技能倍率"]').inputValue(),'2.5');assert.equal(await effect.locator('[aria-label="選取方式"]').inputValue(),'opposite');
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('minimajo.characters.v2')).items[0]);assert.equal(saved.attack,40);assert.equal(saved.attackRange,3);assert.equal(saved.effects[0].range,undefined);assert.deepEqual(saved.effects[0].actions[0].amount,{multiplier:2.5,formula:'target.maxHp*0.1',constant:3});
   await effect.locator('[aria-label="倍率模式"]').selectOption('range');await effect.locator('[aria-label="最小倍率（含）"]').fill('0');await effect.locator('[aria-label="最大倍率（含）"]').fill('1.75');
   await page.locator('#editor-form button[type="submit"]').click();await page.waitForFunction(()=>!window.EditorFileSession.state().dirty&&!window.EditorFileSession.state().pending);await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');await page.locator('#tab-character-effects').click();assert.equal(await effect.locator('[aria-label="最小倍率（含）"]').inputValue(),'0');
   await effect.getByRole('button',{name:'＋ 加入作用內容',exact:true}).click();
   const second=effect.locator('.effect-action').nth(1);await second.locator('[aria-label="效果類型"]').selectOption('posture');await second.locator('[aria-label="常數數值"]').fill('20');await second.getByRole('button',{name:'作用上移',exact:true}).click();
   await page.locator('#editor-form button[type="submit"]').click();await page.waitForFunction(()=>!window.EditorFileSession.state().dirty&&!window.EditorFileSession.state().pending);await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');await page.locator('#tab-character-effects').click();
   assert.equal(await effect.locator('.effect-action').count(),2);assert.equal(await effect.locator('.effect-action').first().locator('[aria-label="效果類型"]').inputValue(),'posture');
   const grouped=JSON.parse(fs.readFileSync(dataFile,'utf8')).data.characters.items[0].effects[0];assert.deepEqual(grouped.actions.map(a=>a.type),['posture','damage']);assert.equal(grouped.targets.length,1);assert.equal(grouped.actions[0].amount,20);assert.equal(await effect.locator('[aria-label="判斷對象"] option[value="legacyEnemy"]').count(),0);
   await page.locator('#tab-battle').click();
   await page.waitForFunction(()=>document.getElementById('battle-preview').contentDocument.getElementById('play').disabled===false);
   const iframe=page.frameLocator('#battle-preview');await iframe.locator('#ally-units [role="button"]').first().click();
   await iframe.locator('#character-detail[open]').waitFor();
   assert.match(await iframe.locator('#detail-stats').innerText(),/攻擊力/);assert.match(await iframe.locator('#detail-stats').innerText(),/40/);
   await iframe.locator('#character-detail').press('Escape');
   await page.evaluate(()=>{
    const w=document.getElementById('battle-preview').contentWindow;
    const base={...w.ItemDB.defaults[0],attack:40,attackRange:3,maxHp:1000,cooldown:1,effects:[{actions:[{type:'damage',amount:{multiplier:2.5,formula:'target.maxHp * 0.1',constant:5}},{type:'posture',amount:20}],targets:[{side:'enemy',mode:'opposite'}]}]};
    const hero=w.Laws.attach(w.ItemDB.atStars(base,1),[{id:'check',name:'測試加成',shopPrice:0,shopWeight:0,stats:{damage:10},passives:[]}]);hero.name='倍率驗證';
    const enemy={...base,name:'倍率標靶',cooldown:120,effects:[]};
    w.postMessage({type:'minimajo-preview',loadouts:[[hero,...Array(9).fill(null)],[enemy,...Array(9).fill(null)]],skills:[],limits:[10,10]},location.origin);
   });
   await iframe.locator('#ally-units [aria-label="倍率驗證"]').waitFor();await iframe.locator('#play').click();
   await page.waitForFunction(()=>document.getElementById('battle-preview').contentDocument.querySelector('#enemy-units .hp-meter')?.getAttribute('aria-valuenow')==='770');
   await iframe.locator('#play').click();
   assert.match(await iframe.locator('#log').innerText(),/失衡 20/);
   await page.setViewportSize({width:390,height:844});await page.locator('#tab-characters').click();await page.locator('#tab-character-basic').click();assert.equal(await page.locator('#attack').inputValue(),'40');assert.equal(await page.locator('#attack-range').inputValue(),'3');
   assert.deepEqual(errors,[]);console.log('Edge: multiple contents add/reorder/save/reload, grouped damage + posture, attack/range, multiplier modes, opposite targeting, save/reload, iframe combined formula (40+10)*2.5+100+5=230, details and 390px form passed.');
   await context.close();
  }finally{await browser.close();}
 }finally{await new Promise(resolve=>server.close(resolve));if(!path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(folder).startsWith('minimajo-browser-'))throw Error('Unsafe test cleanup');fs.rmSync(folder,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
