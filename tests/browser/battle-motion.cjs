// Isolated Chrome/CDP; fixtures and status changes stay in browser memory.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tmp/browser/battle-motion-v1');
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
  await evaluate(`(()=>{
   const create=Battle.create;Battle.create=(...args)=>(window.motionState=create(...args));
   const passive={when:'action',subject:{relation:'self',conditions:[]},effects:[{type:'shield',amount:1}]};
   const base={...structuredClone(ItemDB.defaults[0]),id:'same-id',space:2,maxHp:10000,cooldown:100,moveDistance:0,imageFile:'xinzi-2slot.png',effects:[{type:'damage',amount:8,range:1}],passives:[passive]};
   const slots=()=>[structuredClone(base),...Array(9).fill(null)];
   window.postMessage({type:'minimajo-preview',campaign:true,token:'motion-check',loadouts:[slots(),slots()],limits:[10,10],config:GameConfig.defaults,skills:[]},location.origin);
  })()`);
  await until(()=>evaluate(`!!window.motionState&&!document.getElementById('play').disabled`));
  await until(()=>evaluate(`Array.from(document.querySelectorAll('.character-image')).every(i=>i.complete&&i.naturalWidth>0)`));
  const report=await evaluate(`(()=>{
   const s=motionState,a=s.teams[0].units[0],b=s.teams[1].units[0];s.started=true;a.nextAction=1;b.nextAction=1;Battle.step(s);
   document.getElementById('play').click();document.getElementById('play').click();
   const own=document.querySelector('#ally-units .unit'),foe=document.querySelector('#enemy-units .unit');
   const animations=el=>el.getAnimations().map(a=>({rate:a.playbackRate,frames:a.effect.getKeyframes()}));
   const result={own:animations(own),foe:animations(foe),halo:animations(own.querySelector('.unit-passive-halo')),overflow:getComputedStyle(own).overflow};
   for(const animation of document.getAnimations()){if(animation.effect.target.closest('.unit'))animation.currentTime=100;}
   a.weakUntil=s.tick+30;Statuses.apply(b,{status:'stun',duration:{kind:'seconds',value:3}},1,s.tick);
   document.getElementById('play').click();document.getElementById('play').click();
   result.down=getComputedStyle(own.querySelector('.unit-condition-veil')).backdropFilter;
   result.stun=getComputedStyle(foe.querySelector('.unit-condition-veil')).backdropFilter;
   result.hud=getComputedStyle(own.querySelector('.unit-hud')).zIndex;
   return result;
  })()`);
  assert.equal(report.own.length,2);assert.equal(report.foe.length,2);assert.equal(report.halo.length,1);
  assert.equal(report.own.find(a=>a.frames[1].translate).frames[1].translate,'0px -14px');assert.equal(report.foe.find(a=>a.frames[1].translate).frames[1].translate,'0px 14px');
  assert.ok(report.own.every(a=>a.rate===0));assert.equal(report.overflow,'visible');
  assert.match(report.down,/saturate/);assert.match(report.stun,/grayscale/);assert.equal(report.hud,'2');
  fs.mkdirSync(out,{recursive:true});
  for(const [width,height]of [[1366,768],[390,844]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(180);
   await evaluate(`(()=>{for(const a of document.getAnimations())if(a.effect.target.closest('.unit'))a.currentTime=100})()`);await sleep(50);
   const sample=await evaluate(`(()=>{const own=document.querySelector('#ally-units .unit'),halo=own.querySelector('.unit-passive-halo'),r=halo.getBoundingClientRect();return {halo:getComputedStyle(halo).opacity,translate:getComputedStyle(own).translate,width:r.width,height:r.height,display:getComputedStyle(halo).display}})()`);
   assert.ok(Number(sample.halo)>0,'paused halo must remain visible at its sampled time');assert.notEqual(sample.translate,'0px');
   assert.ok(sample.width>20&&sample.height>20,JSON.stringify(sample));assert.notEqual(sample.display,'none');
   const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,`motion-${width}.png`),Buffer.from(shot.data,'base64'));
  }
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal(await evaluate(`(()=>{motionState.visuals=[{target:'0:0',type:'attack'},{target:'0:0',type:'passive'}];document.getElementById('play').click();document.getElementById('play').click();return document.querySelector('#ally-units .unit').getAnimations({subtree:true}).length})()`),0);
  // Also verify the shared battle controls and automatic skill casting in a fresh in-memory fixture.
  await call('Emulation.setEmulatedMedia',{features:[]});
  await evaluate(`(()=>{
   const base={...structuredClone(ItemDB.defaults[0]),space:2,maxHp:10000,cooldown:100,moveDistance:0,imageFile:'xinzi-2slot.png',effects:[],passives:[]};
   const slots=()=>[structuredClone(base),...Array(9).fill(null)];
   window.postMessage({type:'minimajo-preview',campaign:true,token:'auto-check',loadouts:[slots(),slots()],limits:[10,10],config:GameConfig.defaults,skills:[{id:'auto',name:'自動試驗',cooldown:1,mode:'all',conditions:[],effects:[{type:'damage',amount:5,range:1}]}]},location.origin);
  })()`);
  await until(()=>evaluate(`document.getElementById('skill-name').textContent==='自動試驗'`));
  const autoOut=path.join(root,'tmp/browser/battle-auto-cast-v1');fs.mkdirSync(autoOut,{recursive:true});
  for(const [width,height]of [[1920,1080],[1366,768],[390,844]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(150);
   const layout=await evaluate(`(()=>{const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,height:r.height}};return {speed:rect('speed'),auto:rect('auto-cast'),skill:rect('skill-control'),orb:rect('cast'),gear:rect('battle-gear'),boardRight:(()=>{const el=document.getElementById('ally-units');return el.getBoundingClientRect().right-parseFloat(getComputedStyle(el,'::before').right)})()}})()`);
   assert.equal(layout.auto.height,48);assert.equal(layout.auto.y,layout.speed.y);assert.ok(layout.auto.x>=layout.speed.right);
   assert.ok(layout.gear.right<=width);assert.ok(layout.auto.bottom<=height);
   if(width>900)assert.ok(Math.abs(layout.gear.right-layout.boardRight)<2,'controls must align to the board right edge: '+JSON.stringify(layout));
   if(width>1000)assert.ok(layout.speed.x>=layout.skill.right||layout.speed.y>=layout.orb.bottom,'controls must clear centered skill: '+JSON.stringify(layout));
   await evaluate(`document.getElementById('battle-gear').hidden=true`);
   const rightWithoutGear=await evaluate(`document.getElementById('battle-help-open').getBoundingClientRect().right`);
   assert.ok(Math.abs(rightWithoutGear-layout.gear.right)<2,'hiding gear must preserve board alignment');
   await evaluate(`document.getElementById('battle-gear').hidden=false`);
   const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(autoOut,`controls-${width}.png`),Buffer.from(shot.data,'base64'));
  }
  await evaluate(`document.getElementById('auto-cast').click();document.getElementById('play').click()`);
  await until(()=>evaluate(`motionState.teams[0].skillReady>=20`));
  assert.ok(await evaluate(`motionState.teams[1].units[0].hp<10000`));
  await evaluate(`document.getElementById('play').click()`);
  const ready=await evaluate(`motionState.teams[0].skillReady`);await sleep(250);
  assert.equal(await evaluate(`motionState.teams[0].skillReady`),ready);
  assert.equal(await evaluate(`document.getElementById('auto-cast-label').textContent`),'自動');
  fs.writeFileSync(path.join(autoOut,'browser-check.json'),JSON.stringify({browser:'isolated headless Chrome',sizes:[1920,1366,390],autoCast:true,pause:true,errors},null,2)+'\n');
  await evaluate(`(async()=>{
   const data=(await(await fetch('/minimajo-editor.json')).json()).data;
   const art=data.characters.items.filter(u=>u.imageFile);
   const slots=offset=>{const row=Array(10).fill(null);let slot=0;for(const source of [...art.slice(offset),...art.slice(0,offset)]){if(slot+source.space>10)continue;row[slot]={...structuredClone(source),maxHp:10000,cooldown:100,moveDistance:0,passives:[],laws:[],effects:[]};slot+=source.space;if(slot===10)break;}return row;};
   window.postMessage({type:'minimajo-preview',campaign:true,token:'overtime-check',loadouts:[slots(0),slots(8)],limits:[10,10],config:{...GameConfig.defaults,battleSeconds:3},skills:[]},location.origin);
  })()`);
  await until(()=>evaluate(`motionState.config.battleSeconds===3&&!motionState.started`));
  await call('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
  await evaluate(`if(document.getElementById('auto-cast').getAttribute('aria-pressed')==='true')document.getElementById('auto-cast').click();document.getElementById('play').click()`);
  await until(()=>evaluate(`!document.getElementById('battle-overtime').hidden`));
  await evaluate(`document.getElementById('play').click()`);
  assert.equal(await evaluate(`document.getElementById('timer').textContent`),'+00:00');
  assert.equal(await evaluate(`document.getElementById('overtime-title').getAnimations().length`),1);
  assert.equal(await evaluate(`document.getElementById('overtime-title').getAnimations()[0].playbackRate`),0);
  const overtimeOut=path.join(root,'tmp/browser/battle-overtime-v1');fs.mkdirSync(overtimeOut,{recursive:true});
  for(const [width,height]of [[1366,768],[390,844]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(100);
   await evaluate(`for(const a of document.getElementById('battle-overtime').getAnimations({subtree:true})){a.currentTime=a.effect.target.id==='overtime-title'?450:200}`);
   await sleep(50);
   assert.ok(await evaluate(`Number(getComputedStyle(document.getElementById('overtime-title')).opacity)>.8`));
   assert.equal(await evaluate(`getComputedStyle(document.getElementById('battle-overtime')).pointerEvents`),'none');
   const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(overtimeOut,`entry-${width}.png`),Buffer.from(shot.data,'base64'));
  }
  await evaluate(`motionState.tick=39;Battle.step(motionState);document.getElementById('play').click();document.getElementById('play').click()`);
  assert.ok(await evaluate(`document.getElementById('overtime-pulse').getAnimations().length>0`));
  await call('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
  await evaluate(`for(const a of document.getElementById('battle-overtime').getAnimations({subtree:true})){a.currentTime=a.effect.target.id==='overtime-title'?1500:0}`);
  await sleep(100);
  const steady=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(overtimeOut,'overtime-1366.png'),Buffer.from(steady.data,'base64'));
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate(`document.getElementById('play').click();document.getElementById('play').click()`);
  assert.equal(await evaluate(`document.getElementById('battle-overtime').getAnimations({subtree:true}).length`),0);
  await evaluate(`motionState.done=true;motionState.winner='draw';document.getElementById('auto-cast').click()`);
  assert.equal(await evaluate(`document.getElementById('battle-overtime').hidden`),true);
  fs.writeFileSync(path.join(overtimeOut,'browser-check.json'),JSON.stringify({browser:'isolated headless Chrome',entryAtZero:true,pulseOnDamage:true,pause:true,reducedMotion:true,clearedOnResult:true,sizes:[1366,390],errors},null,2)+'\n');
  await call('Emulation.setEmulatedMedia',{features:[]});
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-check.json'),JSON.stringify({browser:'isolated headless Chrome',report,reducedMotion:true,errors},null,2)+'\n');
  console.log('Chrome: card motion, auto casting, right-aligned controls, overtime entry/pulse/pause/reduced motion/result cleanup passed.');
  await call('Browser.close');
 }finally{
  ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(r=>server.close(r));
  const resolved=path.resolve(profile);if(!resolved.startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(resolved).startsWith('minimajo-motion-'))throw Error('Unsafe profile cleanup');
  await sleep(300);try{fs.rmSync(resolved,{recursive:true,force:true});}catch{}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
