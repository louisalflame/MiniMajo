const {gamePage}=require('./game-page.cjs');
// Requires a local `wrangler pages dev` server with DB migration applied.
const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const base=process.env.MINIMAJO_RECORD_TEST_URL||'http://127.0.0.1:4175';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const contexts=[],level=500000+Math.floor(Math.random()*400000),errors=[];
 async function player(){
  const context=await browser.newContext({reducedMotion:'reduce'});contexts.push(context);const page=gamePage(await context.newPage());page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   let api;Object.defineProperty(globalThis,'Journey',{configurable:true,get:()=>api,set(value){api=value;const create=value.create,start=value.start;value.create=(...args)=>globalThis.testRun=create(...args);value.start=(...args)=>globalThis.testPayload=start(...args);}});
   let battle;Object.defineProperty(globalThis,'Battle',{configurable:true,get:()=>battle,set(value){battle=value;const create=value.create;value.create=(...args)=>globalThis.testBattle=create(...args);}});
   globalThis.testMessages=[];addEventListener('message',event=>{if(event.data?.type)testMessages.push({type:event.data.type,token:event.data.token});});
  });
  await page.goto(base+'/play.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!globalThis.testRun);return page;
 }
 async function enter(page,type,matchLevel,power=false){
  const target=await page.locator('.hex-cell.reachable').first().getAttribute('aria-label');
  await page.evaluate(({target,type,matchLevel,power})=>{
   const [,q,r]=target.match(/座標 (-?\d+), (-?\d+)/);const [id,cell]=Object.entries(testRun.map.map.cells).find(([,c])=>c.q===+q&&c.r===+r);cell.type=type;globalThis.testNode=id;testRun.playerLevel=matchLevel;
   if(power)for(const u of testRun.roster.active.filter(Boolean)){u.attack=10000;u.maxHp=10000;u.attackRange=10;u.cooldown=.1;}
  },{target,type,matchLevel,power});
  await page.getByRole('button',{name:target,exact:true}).dispatchEvent('click');await page.locator('#journey-battle').waitFor({state:'visible'});
 }
 async function playToResult(page,winner){await page.bringToFront();const frame=page.frameLocator('#journey-frame');await frame.locator('#play').click();await frame.locator('#battle-result[open]').waitFor();assert.equal(await frame.locator('#battle-result-title').textContent(),winner===0?'VICTORY':'GAME SET');return frame;}
 try{
  assert.equal((await fetch(base+'/api/health')).status,200);
  const a=await player();let normalLookups=0,posted;
  a.on('request',r=>{if(r.url().includes('/api/player-teams?'))normalLookups++;if(r.url().endsWith('/api/player-teams')&&r.method()==='POST')posted=r.postDataJSON();});
  await enter(a,'battle',level,true);const af=await playToResult(a,0);const upload=a.waitForResponse(r=>r.url().endsWith('/api/player-teams')&&r.request().method()==='POST');await af.locator('#battle-result-confirm').click();assert.equal((await upload).status(),200);assert.equal(normalLookups,0);assert.equal(posted.matchLevel,level);assert.equal(posted.category,'normal');assert.equal(await a.evaluate(()=>testRun.playerLevel),level+1);await a.context().close();
  const b=await player();let eliteLookups=0,loserPosts=0;b.on('request',r=>{if(r.url().includes('/api/player-teams?'))eliteLookups++;if(r.url().endsWith('/api/player-teams')&&r.method()==='POST')loserPosts++;});
  await b.evaluate(()=>{for(const u of testRun.roster.active.filter(Boolean)){u.maxHp=1;u.attack=0;u.cooldown=120;u.passives=[];u.laws=[];}});
  await enter(b,'elite',level);assert.equal(await b.evaluate(()=>testPayload.enemyName),'旅人殘影');assert.deepEqual(await b.evaluate(()=>testPayload.loadouts[1]),posted.board);
  const bf=await playToResult(b,1);await bf.locator('#battle-result-confirm').click();await b.locator('#journey-map').waitFor({state:'visible'});assert.equal(loserPosts,0);
  const cell=await b.evaluate(()=>testRun.map.map.cells[testNode]);const retry=b.getByRole('button',{name:new RegExp('座標 '+cell.q+', '+cell.r+'，')});await retry.dispatchEvent('click');await b.locator('#journey-battle').waitFor({state:'visible'});assert.equal(eliteLookups,1);assert.deepEqual(await b.evaluate(()=>testPayload.loadouts[1]),posted.board);await b.context().close();
  const c=await player();await enter(c,'goal',level);assert.equal(await c.evaluate(()=>testPayload.enemyName),'旅人殘影');assert.deepEqual(await c.evaluate(()=>testPayload.loadouts[1]),posted.board);await c.context().close();
  const d=await player();await enter(d,'goal',level+10,true);assert.notEqual(await d.evaluate(()=>testPayload.enemyName),'旅人殘影');const df=await playToResult(d,0);const bossUpload=d.waitForResponse(r=>r.url().endsWith('/api/player-teams')&&r.request().method()==='POST');await df.locator('#battle-result-confirm').click();assert.equal((await bossUpload).status(),200);await d.locator('#journey-complete-confirm').click();await d.waitForURL(url=>url.href===base+'/'||url.href===base+'/index.html');
  const manifest=await(await fetch(base+'/release.json')).json();const remote=await(await fetch(base+'/api/player-teams?'+new URLSearchParams({category:'boss',level:String(level+10),runId:'independent-check',poolVersion:manifest.poolVersion}))).json();assert.equal(remote.record.category,'boss');assert.equal(remote.record.matchLevel,level+10);
  assert.deepEqual(errors,[]);console.log('PASS: real Workers/D1, normal victory upload, elite/boss retrieval, loss never uploads, retry keeps opponent, BOSS victory submits before returning home.');
 }finally{await Promise.all(contexts.map(context=>context.close()));await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
