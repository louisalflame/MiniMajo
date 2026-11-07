// Isolated Chrome/CDP; fixtures and status changes stay in browser memory.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tmp/browser/battle-feedback-v2');
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
  await evaluate('const originalCreate=Battle.create;Battle.create=(...args)=>(window.feedbackState=originalCreate(...args));window.feedbackFixture=()=>{const base={...structuredClone(ItemDB.defaults[0]),space:2,maxHp:1000,cooldown:100,moveDistance:0,imageFile:"xinzi-2slot.png",effects:[],passives:[],laws:[]};window.postMessage({type:"minimajo-preview",campaign:true,token:"feedback-v2",loadouts:[[base,...Array(9).fill(null)],[{...base,effects:[{type:"damage",amount:300,range:1}]},...Array(9).fill(null)]],limits:[10,10],skills:[],config:GameConfig.defaults},location.origin)};feedbackFixture()');
  await until(()=>evaluate('window.feedbackState&&!document.getElementById("play").disabled'));
  await until(()=>evaluate('Array.from(document.querySelectorAll(".character-image")).every(i=>i.complete&&i.naturalWidth>0)'));
  await evaluate('feedbackState.started=true;feedbackState.teams[1].units[0].nextAction=1;Battle.step(feedbackState);document.getElementById("play").click();document.getElementById("play").click()');
  await sleep(100);
  const sample=await evaluate('(()=>{const c=document.querySelector("#ally-units .unit");for(const a of c.getAnimations({subtree:true}))a.currentTime=a.effect.target.classList.contains("unit-hit-flash")?27:60;const hp=c.querySelector(".hp-meter"),flash=c.querySelector(".unit-hit-flash");return {hp:feedbackState.teams[0].units[0].hp,red:hp.querySelector(".meter-fill").style.width,trail:parseFloat(getComputedStyle(hp.querySelector(".hp-loss-trail")).width),redPixels:parseFloat(getComputedStyle(hp.querySelector(".meter-fill")).width),transition:getComputedStyle(hp.querySelector(".meter-fill")).transitionDuration,flash:Number(getComputedStyle(flash).opacity),tint:flash.style.background,translation:getComputedStyle(c).translate,icon:c.querySelector(".stagger .reward-symbol").getAnimations().length,paused:c.getAnimations({subtree:true}).every(a=>a.playbackRate===0)}})()');
  assert.equal(sample.hp,700);assert.equal(sample.red,'70%');assert.ok(sample.trail>sample.redPixels);assert.equal(sample.transition,'0s');assert.ok(sample.flash>.5);assert.ok(sample.icon>0);assert.ok(sample.paused);assert.match(sample.tint,/255, 224, 188/);
  for(const [width,height]of [[1366,768],[390,844]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(120);
   const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,'impact-'+width+'.png'),Buffer.from(shot.data,'base64'));
  }
  await evaluate('document.getElementById("speed").click();document.getElementById("play").click()');
  assert.ok(await evaluate('document.querySelector("#ally-units .hp-loss-trail").getAnimations().every(a=>a.playbackRate===2)'));
  await evaluate('document.getElementById("play").click();feedbackFixture()');
  await until(()=>evaluate('feedbackState.tick===0'));
  await evaluate('feedbackState.teams[0].units[0].shield=500;document.getElementById("play").click();document.getElementById("play").click();feedbackState.teams[1].units[0].nextAction=1;Battle.step(feedbackState);document.getElementById("play").click();document.getElementById("play").click()');
  const shield=await evaluate('(()=>{const c=document.querySelector("#ally-units .unit");return {hp:feedbackState.teams[0].units[0].hp,shield:feedbackState.teams[0].units[0].shield,tint:c.querySelector(".unit-hit-flash").style.background,trailAnimations:c.querySelector(".hp-loss-trail").getAnimations().length}})()');
  assert.equal(shield.hp,1000);assert.equal(shield.shield,200);assert.match(shield.tint,/150, 217, 250/);assert.equal(shield.trailAnimations,0);
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate('document.getElementById("play").click();document.getElementById("play").click()');
  assert.equal(await evaluate('document.querySelector("#ally-units .unit").getAnimations({subtree:true}).length'),0);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-check.json'),JSON.stringify({browser:'isolated headless Chrome',sample,shield,sizes:[1366,390],doubleSpeed:true,reducedMotion:true,errors},null,2)+'\n');
  console.log('HP trail, immediate HP width, warm/cold hit flash, knockdown/icon pulse, pause/2x/reduced motion and 1366/390 screenshots passed.');
  await call('Browser.close');
 }finally{
  ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(r=>server.close(r));
  const resolved=path.resolve(profile);if(!resolved.startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(resolved).startsWith('minimajo-motion-'))throw Error('Unsafe profile cleanup');
  await sleep(300);try{fs.rmSync(resolved,{recursive:true,force:true});}catch{}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
