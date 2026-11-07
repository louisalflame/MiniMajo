// Isolated Chrome/CDP; fixtures and status changes stay in browser memory.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tmp/browser/battle-support-feedback-v1');
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
  await evaluate('const original=Battle.create;Battle.create=(...args)=>(window.supportState=original(...args));window.readyCount=0;const orb=document.getElementById("cast"),originalAnimate=orb.animate;orb.animate=function(...args){readyCount++;return originalAnimate.apply(this,args)};window.supportFixture=()=>{const base={...structuredClone(ItemDB.defaults[0]),space:2,maxHp:1000,cooldown:100,moveDistance:0,imageFile:"xinzi-2slot.png",effects:[],passives:[],laws:[]},own=Array(10).fill(null),enemy=Array(10).fill(null);own[0]={...base,name:"治療掃光",effects:[{type:"heal",amount:100}]};own[3]={...base,name:"獲得護盾",effects:[{type:"shield",amount:50}]};own[6]={...base,name:"閃避"};enemy[6]={...base,effects:[{type:"damage",amount:120,range:1}]};postMessage({type:"minimajo-preview",campaign:true,token:"support",loadouts:[own,enemy],skills:[{id:"ready",name:"極式試驗",cooldown:1,mode:"all",conditions:[],effects:[{type:"damage",amount:1,range:3}]}],limits:[10,10],config:GameConfig.defaults},location.origin)};supportFixture()');
  const results=[];
  for(const [width,height]of [[1366,768],[390,844]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await evaluate('supportFixture()');
   try{await until(()=>evaluate('window.supportState?.tick===0&&!supportState.started'));}catch(error){throw Error(await evaluate('document.getElementById("battle-message").textContent'));}
   await until(()=>evaluate('Array.from(document.querySelectorAll(".character-image")).every(i=>i.complete&&i.naturalWidth>0)'));
   await evaluate('readyCount=0;supportState.started=true;supportState.teams[0].units[0].hp=900;supportState.teams[0].units[0].nextAction=1;supportState.teams[0].units[1].nextAction=1;supportState.teams[1].units[0].nextAction=1;supportState.teams[0].skillReady=1;Statuses.apply(supportState.teams[0].units[2],{status:"dodge",duration:{kind:"permanent"}},1,0);Battle.step(supportState);document.getElementById("play").click();document.getElementById("play").click()');
   await sleep(100);
   const sample=await evaluate('(()=>{const heal=document.querySelector("#ally-units .unit-heal-sweep"),ward=Array.from(document.querySelectorAll("#ally-units .unit"))[1].querySelector(".unit-shield-gain"),miss=document.querySelector(".combat-number.miss"),target=Array.from(document.querySelectorAll("#ally-units .unit"))[2];heal.getAnimations()[0].currentTime=140;ward.getAnimations()[0].currentTime=80;miss.getAnimations()[0].currentTime=200;document.getElementById("cast").getAnimations()[0].currentTime=100;return {hp:supportState.teams[0].units[0].hp,shield:supportState.teams[0].units[1].shield,healOpacity:Number(getComputedStyle(heal).opacity),shieldOpacity:Number(getComputedStyle(ward).opacity),miss:miss.textContent,targetMotions:target.getAnimations().length,readyCount,paused:miss.getAnimations()[0].playbackRate===0}})()');
   assert.equal(sample.hp,1000);assert.equal(sample.shield,50);assert.ok(sample.healOpacity>0&&sample.shieldOpacity>0);assert.equal(sample.miss,'MISS');assert.equal(sample.targetMotions,0);assert.equal(sample.readyCount,1);assert.ok(sample.paused);
   for(let i=0;i<3;i++)await evaluate('document.getElementById("play").click();document.getElementById("play").click()');assert.equal(await evaluate('readyCount'),1);
   const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,'support-'+width+'.png'),Buffer.from(shot.data,'base64'));

   if(width===390){await evaluate('document.querySelector(".arena-scroll").scrollLeft=260');const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,'miss-390.png'),Buffer.from(shot.data,'base64'));}
   await evaluate('if(document.getElementById("speed-label").textContent.startsWith("1"))document.getElementById("speed").click();document.getElementById("play").click()');
   assert.equal(await evaluate('document.querySelector(".combat-number.miss").getAnimations()[0].playbackRate'),2);await evaluate('document.getElementById("play").click()');
   await evaluate('document.getElementById("play").click();document.getElementById("cast").click();document.getElementById("play").click();supportState.tick=supportState.teams[0].skillReady;document.getElementById("play").click();document.getElementById("play").click()');
   assert.equal(await evaluate('readyCount'),2,'a new charge may cue again');results.push({width,sample});
  }
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await evaluate('supportFixture()');await until(()=>evaluate('window.supportState?.tick===0'));
  await evaluate('readyCount=0;supportState.started=true;supportState.teams[0].units[0].hp=900;supportState.teams[0].units[0].nextAction=1;supportState.teams[0].units[1].nextAction=1;supportState.teams[1].units[0].nextAction=1;supportState.teams[0].skillReady=1;Statuses.apply(supportState.teams[0].units[2],{status:"dodge",duration:{kind:"permanent"}},1,0);Battle.step(supportState);document.getElementById("play").click();document.getElementById("play").click()');
  assert.equal(await evaluate('readyCount'),0);assert.equal(await evaluate('document.querySelector(".unit-heal-sweep").getAnimations().length'),0);assert.equal(await evaluate('document.querySelector(".unit-shield-gain").getAnimations().length'),0);assert.equal(await evaluate('document.querySelector(".combat-number.miss").textContent'),'MISS');
  await evaluate('supportState.done=true;supportState.winner="draw";document.getElementById("auto-cast").click();document.getElementById("battle-result-confirm").click();document.getElementById("battle-stats").click()');assert.equal(await evaluate('document.querySelectorAll(".combat-number.miss").length'),0);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-check.json'),JSON.stringify({browser:'isolated headless Chrome',results,readyOncePerCharge:true,doubleSpeed:true,reducedMotion:true,statsCleanup:true,errors},null,2)+'\n');
  console.log('Real heal/shield/dodge events, MISS without target movement, one ready pulse per charge, pause/2x/reduced motion/stat cleanup and 1366/390 screenshots passed.');
  await call('Browser.close');
 }finally{
  ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(r=>server.close(r));
  const resolved=path.resolve(profile);if(!resolved.startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(resolved).startsWith('minimajo-motion-'))throw Error('Unsafe profile cleanup');
  await sleep(300);try{fs.rmSync(resolved,{recursive:true,force:true});}catch{}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
