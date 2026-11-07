// Isolated Chrome/CDP; fixtures and status changes stay in browser memory.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tmp/browser/merge-feedback-v1');
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
  await call('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/play.html`});
  await until(()=>evaluate(`typeof ExpeditionUI!=='undefined'&&typeof Expedition!=='undefined'`));

  fs.mkdirSync(out,{recursive:true});
  async function fixture(mode){await evaluate(`(()=>{const base={...structuredClone(ItemDB.defaults[0]),space:2,imageFile:'xinzi-2slot.png'};window.mergeState=Expedition.create([base],[],{...GameConfig.defaults,startingActive:[base.id,null,base.id,...Array(7).fill(null)]});ExpeditionUI.bind(mergeState);ExpeditionUI.open('${mode}','merge-check');})()`);await sleep(200);}
  const rect=slot=>evaluate(`(()=>{const r=document.querySelector('#roster-bottom [data-drop-slot="${slot}"]').getBoundingClientRect();return {x:r.left+r.width*.3,y:r.top+r.height*.35}})()`);
  async function hover(){const a=await rect(0),b=await rect(2);await call('Input.dispatchMouseEvent',{type:'mouseMoved',...a});await call('Input.dispatchMouseEvent',{type:'mousePressed',...a,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseMoved',...b,button:'left',buttons:1});await sleep(200);return b;}
  for(const [width,height,mode] of [[1366,900,'gear'],[1366,900,'shop'],[390,844,'gear']]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await fixture(mode);const b=await hover();
   const feedback=await evaluate(`(()=>{const cue=document.querySelector('.roster-merge-cue');return {cue:cue?.getAttribute('aria-label'),open:cue?.matches(':popover-open'),targets:document.querySelectorAll('.merge-candidate').length,hover:document.querySelectorAll('.merge-hover').length,opacity:getComputedStyle(document.querySelector('.roster-drag-ghost')).opacity,stars:mergeState.active[2].stars}})()`);
   assert.equal(feedback.cue,'放開以合成，1 星升至 2 星');assert.equal(feedback.open,true);assert.equal(feedback.targets,1);assert.equal(feedback.hover,1);assert.equal(feedback.stars,1);assert.ok(Number(feedback.opacity)<.4);
   await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:b.x+2,y:b.y,buttons:1});assert.equal(await evaluate(`document.querySelectorAll('.roster-merge-cue').length`),1);
   const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,`merge-${mode}-${width}.png`),Buffer.from(shot.data,'base64'));
   await call('Input.dispatchMouseEvent',{type:'mouseReleased',...b,button:'left',clickCount:1});
   assert.deepEqual(await evaluate(`[mergeState.active[0],mergeState.active[2].stars,document.querySelectorAll('.roster-merge-cue,.merge-candidate,.merge-hover,.roster-drag-ghost').length]`),[null,2,0]);
  }
  await fixture('gear');await hover();await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  assert.deepEqual(await evaluate(`[mergeState.active[0].stars,mergeState.active[2].stars,document.querySelectorAll('.roster-merge-cue,.merge-candidate').length]`),[1,1,0]);
  assert.deepEqual(errors,[]);console.log('Chrome merge feedback: desktop gear/shop, narrow gear, real pointer merge, cue reuse and Escape cleanup passed.');await call('Browser.close');
 }finally{
  ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(r=>server.close(r));
  const resolved=path.resolve(profile);if(!resolved.startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(resolved).startsWith('minimajo-motion-'))throw Error('Unsafe profile cleanup');
  await sleep(300);try{fs.rmSync(resolved,{recursive:true,force:true});}catch{}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
