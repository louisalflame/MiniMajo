// Isolated Chrome/CDP; fixtures and status changes stay in browser memory.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tmp/browser/battle-spatial-v1');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'minimajo-motion-'));
const server=require('../../editor-server.cjs').createEditorServer({root});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let n=0;n<100;n++){if(await fn())return;await sleep(100);}throw Error('Browser timeout');}
(async()=>{
 let chrome,ws;await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--hide-scrollbars','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  const portFile=path.join(profile,'DevToolsActivePort');await until(()=>fs.existsSync(portFile));
  const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
  const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  let id=0;const pending=new Map(),errors=[];
  ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
  const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
  const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  await call('Runtime.enable');await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/battle.html?preview=1`});
  await until(()=>evaluate(`typeof Battle!=='undefined'&&typeof CharacterCardSkin!=='undefined'`));

  fs.mkdirSync(out,{recursive:true});
  await evaluate('const original=Battle.create;Battle.create=(...args)=>(window.spatialState=original(...args));window.cardA=()=>Array.from(document.querySelectorAll("#ally-units .unit")).find(el=>el.dataset.battleId==="0:0");window.spatialFixture=()=>{const base={...structuredClone(ItemDB.defaults[0]),maxHp:1000,cooldown:100,space:2,moveDistance:0,imageFile:"xinzi-2slot.png",effects:[],passives:[],laws:[],attackRange:10};const own=Array(10).fill(null),enemy=Array(10).fill(null);own[0]={...base,id:"same"};own[5]={...base,id:"same"};enemy[8]={...base,effects:[{type:"damage",amount:10000,range:10}]};postMessage({type:"minimajo-preview",campaign:true,token:"spatial",loadouts:[own,enemy],skills:[],limits:[10,10],config:GameConfig.defaults},location.origin)};spatialFixture()');
  const results=[];
  for(const [width,height]of [[1366,768],[390,844]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await evaluate('spatialFixture()');
   await until(()=>evaluate('spatialState.tick===0&&!spatialState.started&&!!cardA()'));
   await until(()=>evaluate('Array.from(document.querySelectorAll(".character-image")).every(i=>i.complete&&i.naturalWidth>0)'));
   const swap=await evaluate('(()=>{const a=spatialState.teams[0].units[0],b=spatialState.teams[0].units[1],root=cardA(),old=root.getBoundingClientRect().left;Battle.swap(spatialState,0,a,b);document.getElementById("play").click();document.getElementById("play").click();for(const el of document.querySelectorAll("#ally-units .unit"))for(const animation of el.getAnimations())if(animation.effect.getKeyframes()[0].left!==undefined)animation.currentTime=0;return {old,now:root.getBoundingClientRect().left,logical:a.slot,animations:root.getAnimations().filter(a=>a.effect.getKeyframes()[0].left!==undefined).length}})()');
   assert.equal(swap.logical,5);assert.equal(swap.animations,1);assert.ok(Math.abs(swap.now-swap.old)<1,'logical swap must retain the original visual position initially');
   await evaluate('for(const el of document.querySelectorAll("#ally-units .unit"))for(const a of el.getAnimations())if(a.effect.getKeyframes()[0].left!==undefined)a.currentTime=70');await sleep(30);
   let shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,'swap-'+width+'.png'),Buffer.from(shot.data,'base64'));
   const jump=await evaluate('(()=>{const a=spatialState.teams[0].units[0],enemy=spatialState.teams[1].units[0];Battle.jump(spatialState,0,a,enemy);document.getElementById("play").click();document.getElementById("play").click();const root=cardA(),animation=root.getAnimations().find(a=>a.effect.getKeyframes()[0].left!==undefined);animation.currentTime=90;return {slot:a.slot,duration:animation.effect.getTiming().duration,paused:animation.playbackRate===0,frames:animation.effect.getKeyframes()}})()');
   assert.equal(jump.slot,8);assert.equal(jump.duration,180);assert.ok(jump.paused);assert.ok(jump.frames.some(f=>parseFloat(f.top)<0));
   assert.equal(await evaluate('(()=>{if(document.getElementById("speed-label").textContent.startsWith("1"))document.getElementById("speed").click();document.getElementById("play").click();const rate=cardA().getAnimations().find(a=>a.effect.getKeyframes()[0].left!==undefined).playbackRate;document.getElementById("play").click();return rate})()'),2);

   shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,'jump-'+width+'.png'),Buffer.from(shot.data,'base64'));
   const death=await evaluate('(()=>{spatialState.started=true;spatialState.teams[1].units[0].nextAction=spatialState.tick+1;Battle.step(spatialState);document.getElementById("play").click();document.getElementById("play").click();const ghost=document.querySelector(".unit-exit-ghost"),animation=ghost.getAnimations()[0];animation.currentTime=190;return {hp:spatialState.teams[0].units[0].hp,ghosts:document.querySelectorAll(".unit-exit-ghost").length,role:ghost.getAttribute("role"),tabindex:ghost.getAttribute("tabindex"),paused:animation.playbackRate===0,opacity:Number(getComputedStyle(ghost).opacity),emptySlots:document.querySelectorAll("#ally-units .empty-slot").length}})()');
   assert.equal(death.hp,0);assert.equal(death.ghosts,1);assert.equal(death.role,null);assert.equal(death.tabindex,null);assert.ok(death.paused&&death.opacity>0&&death.opacity<1);
   shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,'death-'+width+'.png'),Buffer.from(shot.data,'base64'));
   await evaluate('spatialState.done=true;spatialState.winner="draw";document.getElementById("auto-cast").click();document.getElementById("battle-result-confirm").click();document.getElementById("battle-stats").click()');assert.equal(await evaluate('document.querySelectorAll(".unit-exit-ghost").length'),0);
   results.push({width,swap,jump,death});
  }
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await evaluate('spatialFixture()');await until(()=>evaluate('spatialState.tick===0&&!spatialState.done'));
  await evaluate('Battle.swap(spatialState,0,...spatialState.teams[0].units);document.getElementById("play").click();document.getElementById("play").click()');
  assert.equal(await evaluate('document.querySelector("#ally-units .unit").getAnimations({subtree:true}).length'),0);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-check.json'),JSON.stringify({browser:'isolated headless Chrome',results,reducedMotion:true,statsCleanup:true,errors},null,2)+'\n');
  console.log('Fast swap/jump retain the original visual origin, death ghost frees the board immediately, pause/reduced motion/stat cleanup and 1366/390 screenshots passed.');
  await call('Browser.close');
 }finally{
  ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(r=>server.close(r));
  const resolved=path.resolve(profile);if(!resolved.startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(resolved).startsWith('minimajo-motion-'))throw Error('Unsafe profile cleanup');
  await sleep(300);try{fs.rmSync(resolved,{recursive:true,force:true});}catch{}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
