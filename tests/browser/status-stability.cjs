const {gamePage}=require('./game-page.cjs');
// Real ticking battle: slow image loading, refresh, expiry and failed-image fallback.
const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),server=require('../../editor-server.cjs').createEditorServer({root});
const before=fs.readFileSync(path.join(root,'minimajo-editor.json')),statuses=JSON.parse(before).data.statuses;
statuses.statuses.find(s=>s.id==='power').description='增加傷害攻擊力。\n狀態效果第二行。';
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true,channel:'msedge'});
  fs.mkdirSync(path.join(root,'tmp/browser/status-explanations'),{recursive:true});
  for(const width of [1366,390]){
   const page=gamePage(await browser.newPage({viewport:{width,height:900}})),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{let api;Object.defineProperty(window,'Battle',{configurable:true,get:()=>api,set(value){api=value;const create=value.create;value.create=(...args)=>window.statusBattle=create(...args);}});});
   let release;const gate=new Promise(resolve=>release=resolve);
   await page.route('**/'+statuses.statuses.find(s=>s.id==='power').imagePath,async route=>{await gate;await route.continue();});
   await page.goto(`http://127.0.0.1:${server.address().port}/battle.html?preview=1`);
   await page.waitForFunction(()=>!!window.Battle&&!!window.ItemDB);
   await page.evaluate(statuses=>{
    const unit={...ItemDB.defaults[0],maxHp:10000,cooldown:120,effects:[]},row=u=>[u,...Array(9).fill(null)];
    window.dispatchEvent(new MessageEvent('message',{source:parent,data:{type:'minimajo-preview',loadouts:[row(unit),row(unit)],skills:[],limits:[10,10],statusLibrary:statuses}}));
    Statuses.apply(statusBattle.teams[0].units[0],{status:'power',duration:{kind:'seconds',value:10}},3,0);
   },statuses);
   await page.locator('#play').click();
   const image=page.locator('#ally-units [data-status-kind="power"] img');
   await page.waitForFunction(()=>statusBattle.tick>=3);
   assert(await image.isHidden());assert(await page.locator('#ally-units [data-status-kind="power"]>.ui-icon').isVisible());
   release();await image.waitFor({state:'visible'});
   await page.evaluate(()=>{
    const host=document.querySelector('#ally-units .unit-status'),image=host.querySelector('img');
    window.statusWatch={image,host,start:statusBattle.tick,title:host.firstElementChild.title,mutations:0,frames:0,hidden:0};
    const watch=statusWatch;watch.observer=new MutationObserver(records=>watch.mutations+=records.filter(r=>r.type==='childList').length);
    watch.observer.observe(host,{childList:true,subtree:true});
    const sample=()=>{watch.frames++;if(!image.isConnected||image.hidden)watch.hidden++;if(!watch.done)requestAnimationFrame(sample);};sample();
   });
   await page.waitForFunction(()=>statusBattle.tick>=statusWatch.start+12);
   const result=await page.evaluate(()=>{const w=statusWatch;w.done=true;w.observer.disconnect();return {same:w.host.querySelector('img')===w.image,mutations:w.mutations,hidden:w.hidden,frames:w.frames,labelChanged:w.host.firstElementChild.title!==w.title};});
   assert(result.same&&result.frames>10&&result.labelChanged);assert.equal(result.mutations,0);assert.equal(result.hidden,0);
   const badge=page.locator('#ally-units .unit-status-badge').first();await badge.hover();
   assert.match(await badge.getAttribute('title'),/^.+ · .+秒\n增加傷害攻擊力。\n狀態效果第二行。$/);
   await page.locator('#ally-units [data-battle-id="0:0"]').click();
   assert.deepEqual(await page.locator('#detail-statuses .detail-status-effects>li').allTextContents(),['增加傷害攻擊力。','狀態效果第二行。']);
   assert(await page.locator('#detail-statuses .detail-status-heading .status-art-icon').isVisible());
   await page.locator('#detail-statuses .detail-status-entry').scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(root,`tmp/browser/status-explanations/detail-${width}.png`)});
   await page.keyboard.press('Escape');
   await page.evaluate(()=>{
    const unit=statusBattle.teams[0].units[0];
    Statuses.apply(unit,{status:'power',duration:{kind:'seconds',value:1}},7,statusBattle.tick);
    const definitions=Statuses.snapshot();definitions.statuses.find(s=>s.id==='regen').imagePath='assets/ui/status-icons/v1/missing-stability.png';Statuses.configure(definitions);
    Statuses.apply(unit,{status:'regen',duration:{kind:'seconds',value:5}},3,statusBattle.tick);
   });
   await page.waitForFunction(()=>document.querySelector('#ally-units [data-status-kind="regen"] svg'));
   assert(await page.locator('#ally-units [data-status-kind="power"] img').evaluate(el=>el===statusWatch.image&&!el.hidden));
   await page.waitForFunction(()=>!document.querySelector('#ally-units [data-status-kind="power"]'));
   await page.evaluate(()=>window.failedStatus=document.querySelector('#ally-units [data-status-kind="regen"]'));
   await page.waitForFunction(()=>statusBattle.tick>=statusWatch.start+30);
   assert(await page.locator('#ally-units [data-status-kind="regen"]').evaluate(el=>el===failedStatus&&!!el.querySelector('svg')));
   assert.deepEqual(errors,[]);await page.close();
  }
  assert.deepEqual(fs.readFileSync(path.join(root,'minimajo-editor.json')),before);
  console.log('PASS: desktop/390px real battle, slow image placeholder, stable loaded nodes over 1.2s, no hidden frames or DOM replacement, refreshed amount/countdown, expiry, failed-art fallback, no source writes.');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
