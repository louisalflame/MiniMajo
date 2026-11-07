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
   const ready=()=>page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');
   const synced=()=>page.waitForFunction(()=>!window.EditorFileSession.state().dirty&&!window.EditorFileSession.state().pending);
   await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);await ready();await page.locator('#tab-character-effects').click();
   await page.locator('#character-add-passive').click();const passive=page.locator('#character-passives .law-passive');
   await passive.locator('[aria-label="觸發時機"]').selectOption('playerSkill');assert.equal(await passive.locator('[aria-label="事件中的角色"]').isDisabled(),true);
   assert.equal(await passive.locator('option[value="purchase"]').count(),0);await passive.getByRole('button',{name:'＋ 發動效果',exact:true}).click();
   await passive.locator('[aria-label="效果類型"]').selectOption('shield');await passive.locator('[aria-label="常數整數"]').fill('7');
   await page.locator('#editor-form button[type="submit"]').click();await synced();await page.reload();await ready();await page.locator('#tab-character-effects').click();
   assert.equal(await passive.locator('[aria-label="觸發時機"]').inputValue(),'playerSkill');assert.equal(await passive.locator('[aria-label="常數整數"]').inputValue(),'7');
   const action=page.locator('#effects .effect-action').first();await action.locator('[aria-label="效果類型"]').selectOption('status');
   const status=action.locator('select').filter({has:page.locator('option[value="dodge"]')});
   await status.selectOption('dodge');const duration=action.locator('select').filter({has:page.locator('option[value="attacks"]')});
   assert.equal(await duration.inputValue(),'attacks');assert.equal(await duration.isDisabled(),true);
   await status.selectOption('enhancedPoison');assert.equal(await duration.inputValue(),'permanent');assert.equal(await duration.isDisabled(),true);
   await page.locator('#editor-form button[type="submit"]').click();await synced();
   const saved=JSON.parse(fs.readFileSync(dataFile,'utf8')).data.characters.items[0];assert.equal(saved.passives[0].effects[0].actions[0].amount.constant,7);assert.deepEqual(saved.effects[0].actions[0].duration,{kind:'permanent'});
   await page.locator('#tab-statuses').click();await page.locator('#status-list button').getByText('閃避',{exact:true}).click();assert.match(await page.locator('#status-policy').textContent(),/1 次敵方普通攻擊.*不疊層/);
   await page.locator('#status-list button').getByText('強化中毒',{exact:true}).click();assert.equal(await page.locator('#status-enhanced').isChecked(),true);assert.equal(await page.locator('#status-enhanced').isDisabled(),true);assert.match(await page.locator('#status-policy').textContent(),/強化狀態.*累加.*永久/);
   await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('#status-policy').isVisible());assert.ok((await page.locator('#status-enhanced').boundingBox()).width<32);
   await page.locator('#tab-characters').click();await page.locator('#tab-character-effects').click();assert.ok(await passive.locator('[aria-label="觸發時機"]').isVisible());
   const runtime=await page.evaluate(()=>{
    const p={when:'playerSkill',effects:[{type:'shield',amount:7,target:'self'}]},u={...ItemDB.defaults[0],cooldown:120,effects:[],passives:[p]},s=Battle.create([[u],[u]],[]);
    Battle.step(s);s.teams[0].skill={enabled:true,name:'測試',cooldown:1,effects:[]};Battle.cast(s,0);
    return s.teams.map(t=>t.units[0].shield);
   });assert.deepEqual(runtime,[7,7]);assert.deepEqual(errors,[]);
   console.log('Edge: character passive edit/save/reload, removed timings, dodge/enhanced duration restrictions, status policy labels, 390px controls and browser runtime passed.');
  }finally{await browser.close();}
 }finally{await new Promise(resolve=>server.close(resolve));if(!path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(folder).startsWith('minimajo-browser-'))throw Error('Unsafe test cleanup');fs.rmSync(folder,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
