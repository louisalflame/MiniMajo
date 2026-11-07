const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tmp/browser/reward-skip');fs.mkdirSync(out,{recursive:true});
const Backup=require('../../js/editor-backup.js'),file=Backup.prepare(JSON.parse(fs.readFileSync(path.join(root,'minimajo-editor.json')))).file;
const server=require('../../editor-server.cjs').createEditorServer({root});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const width of [1366,390]){
   const context=await browser.newContext({viewport:{width,height:width===390?844:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(({data,keys})=>{for(const [kind,key]of Object.entries(keys))localStorage.setItem(key,JSON.stringify(data[kind]));let api;Object.defineProperty(globalThis,'Journey',{configurable:true,get:()=>api,set(value){api=value;const create=value.create;value.create=(...args)=>globalThis.rewardRun=create(...args);}});},{data:file.data,keys:Backup.keys});
   await page.goto(`http://127.0.0.1:${server.address().port}/play.html`);await page.waitForFunction(()=>!!globalThis.rewardRun);
   const target=await page.locator('.hex-cell.reachable').first().getAttribute('aria-label');await page.evaluate(label=>{const [,q,r]=label.match(/座標 (-?\d+), (-?\d+)/);Object.values(rewardRun.map.map.cells).find(c=>c.q===+q&&c.r===+r).type='battle';},target);
   await page.getByRole('button',{name:target,exact:true}).focus();await page.keyboard.press('Enter');await page.locator('#journey-battle').waitFor({state:'visible'});
   const iframe=page.frames().find(f=>f.url().includes('battle.html')),result=await page.evaluate(()=>({type:'minimajo-journey-result',token:rewardRun.encounter.token,winner:0,hp:rewardRun.encounter.allies.filter(Boolean).map(u=>u.maxHp)}));await iframe.evaluate(result=>parent.postMessage(result,'*'),result);
   await page.locator('#reward-hub[open]').waitFor();const gold=await page.evaluate(()=>rewardRun.roster.gold),teams=await page.evaluate(()=>JSON.stringify([rewardRun.roster.active,rewardRun.roster.reserve]));
   if(width===1366){await page.locator('#reward-money').click();await page.locator('#reward-money-close').click();}
   await page.locator('#reward-characters').click();await page.locator('#journey-reward[open]').waitFor();assert.ok(await page.locator('#reward-confirm').isDisabled());
   await page.locator('#reward-skip').scrollIntoViewIfNeeded();assert.match(await page.locator('#reward-skip .currency-crystal').evaluate(el=>getComputedStyle(el).backgroundImage),/currency-crystal/);const box=await page.locator('#reward-skip').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);
   await page.screenshot({path:path.join(out,'reward-'+width+'.png')});await page.locator('#reward-skip').click();assert.equal(await page.evaluate(()=>rewardRun.roster.gold),gold+10);assert.equal(await page.evaluate(()=>rewardRun.rewardChoice),null);assert.equal(await page.evaluate(()=>JSON.stringify([rewardRun.roster.active,rewardRun.roster.reserve])),teams);
   await page.evaluate(()=>document.getElementById('reward-skip').click());assert.equal(await page.evaluate(()=>rewardRun.roster.gold),gold+10);
   if(width===390){await page.locator('#reward-hub[open]').waitFor();await page.locator('#reward-money').click();assert.equal(await page.locator('#reward-money-amount').textContent(),String(file.data.config.normalReward));await page.locator('#reward-money-close').click();}
   assert.ok(await page.locator('#reward-hub').isHidden());assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS: desktop/mobile skip button and crystal icon; no selection required; ten crystal bonus once; teams unchanged; base reward acknowledgement before/after skip. Victory result is injected through the actual iframe.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
