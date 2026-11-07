// Real map toolbar/help/fog checks in isolated Chrome. No editor data writes.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tmp/browser/map-interface-v1'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'minimajo-map-toolbar-')),server=require('../../editor-server.cjs').createEditorServer({root});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));async function until(fn){for(let i=0;i<120;i++){const value=await fn();if(value)return value;await sleep(100)}throw Error('Map readiness timed out')}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let chrome,ws;try{
 chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--disable-backgrounding-occluded-windows','--disable-features=CalculateNativeWinOcclusion','--window-size=1920,1080','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 const portFile=path.join(profile,'DevToolsActivePort');await until(()=>fs.existsSync(portFile));const port=fs.readFileSync(portFile,'utf8').split('\n')[0],targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true})});let id=0;const pending=new Map(),errors=[];
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text)});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 const pointClick=async(x,y)=>{await call('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});await sleep(80)};
 const click=async selector=>{const p=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await pointClick(p.x,p.y)};
 const escape=async()=>{await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await sleep(80)};
 const capture=async file=>{await sleep(120);const r=await call('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});fs.writeFileSync(path.join(out,file),Buffer.from(r.data,'base64'))};
 await call('Runtime.enable');await call('Page.enable');await call('Page.addScriptToEvaluateOnNewDocument',{source:`let journeyApi;Object.defineProperty(globalThis,'Journey',{configurable:true,get:()=>journeyApi,set(v){journeyApi=v;const create=v.create;v.create=(...args)=>globalThis.mapTestRun=create(args[0],args[1],'MAP-ART-CHECK',...args.slice(3))}})`});
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await call('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});await call('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/play.html`});
 await until(()=>evaluate(`!!globalThis.mapTestRun&&!!document.querySelector('.hex-cell')`));
 const snapshot=()=>evaluate(`JSON.stringify({current:mapTestRun.map.current,steps:mapTestRun.map.steps,gold:mapTestRun.roster.gold,echo:mapTestRun.roster.echoLevel,visited:[...mapTestRun.map.visited]})`),beforeHelp=await snapshot();
 const layouts=[];
 for(const [width,height]of [[1920,1080],[1366,768],[390,844]]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(160);
  const m=await evaluate(`(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};const c=document.querySelector('.map-canvas'),f=getComputedStyle(c,'::before'),v=document.getElementById('hex-map-svg').viewBox.baseVal;return {viewportWidth:innerWidth,stage:rect('.map-stage'),home:rect('#journey-home'),toolbar:rect('#journey-map .map-heading'),map:rect('#hex-map-svg'),gear:rect('#journey-gear'),viewBox:{x:v.x,width:v.width,height:v.height},fog:{left:parseFloat(f.left),right:parseFloat(f.right)},overviewHidden:getComputedStyle(document.querySelector('.map-stage-top')).display==='none',echo:document.getElementById('expedition-progress').textContent,echoLabel:document.getElementById('expedition-progress').getAttribute('aria-label'),echoExpected:String(mapTestRun.roster.echoLevel),homeImage:getComputedStyle(document.querySelector('.map-home-art')).backgroundImage,gearImage:getComputedStyle(document.querySelector('#journey-gear .map-button-skin>i')).backgroundImage}})()`);
  assert.equal(m.stage.right,m.viewportWidth);assert.equal(m.home.x,8);assert.equal(m.home.y,8);assert.ok(m.toolbar.x>=m.home.right+6,JSON.stringify(m));assert.equal(m.toolbar.y,width<=650?16:24);assert.ok(width-m.toolbar.right>=12);assert.equal(m.map.y,0);assert.equal(m.map.height,height);assert.equal(m.gear.height,48);assert.ok(m.overviewHidden);assert.equal(m.echo,m.echoExpected);assert.match(m.echoLabel,/回響等級/);assert.match(m.homeImage,/shop\/v1\/exit-button/);assert.match(m.gearImage,/battle\/v1\/button-paper/);assert.ok(m.fog.left<0&&m.fog.right<0);assert.ok(m.viewBox.width>=800);if(width/height>800/680)assert.ok(m.viewBox.x<0);layouts.push({width,height,...m});
  const rewardGear=await evaluate(`(()=>{const dialog=document.getElementById('journey-reward');dialog.showModal();const button=document.getElementById('reward-gear'),r=button.getBoundingClientRect();const result={height:r.height,width:r.width,paper:getComputedStyle(button.querySelector('.map-button-skin i')).backgroundImage,book:getComputedStyle(button.querySelector('.map-book-art')).backgroundImage};dialog.close();return result})()`);assert.equal(rewardGear.height,48);assert.equal(rewardGear.width,width<=650?116:150);assert.match(rewardGear.paper,/button-paper.png/);assert.match(rewardGear.book,/preparation-book.png/);
  await capture('applied-map-'+width+'.png');await click('#map-help-open');assert.equal(await evaluate(`document.getElementById('map-help-dialog').open`),true);assert.equal(await evaluate(`document.getElementById('map-help-open').getAttribute('aria-expanded')`),'true');assert.equal(await snapshot(),beforeHelp);
  const dialog=await evaluate(`(()=>{const d=document.getElementById('map-help-dialog'),b=d.querySelector('.ui-panel-body'),r=d.getBoundingClientRect();return {right:r.right,bottom:r.bottom,x:r.x,y:r.y,scrolls:b.scrollHeight>b.clientHeight,text:d.textContent}})()`);assert.ok(dialog.x>=0&&dialog.right<=width);assert.ok(dialog.y>=0&&dialog.bottom<=height);assert.match(dialog.text,/100%/);assert.match(dialog.text,/本局進度尚未保存/);assert.ok(dialog.scrolls);if(width!==1366)await capture('help-'+width+'.png');await escape();assert.equal(await evaluate(`document.getElementById('map-help-dialog').open`),false);assert.equal(await evaluate(`document.activeElement.id`),'map-help-open');
 }
 await call('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});await sleep(100);await click('#map-help-open');await pointClick(4,500);assert.equal(await evaluate(`document.getElementById('map-help-dialog').open`),false);assert.equal(await snapshot(),beforeHelp);
 await click('#journey-gear');assert.equal(await evaluate(`document.getElementById('expedition-dialog').open`),true);assert.equal(await evaluate(`document.getElementById('expedition-dialog').getAttribute('data-mode')`),'gear');
 const center=selector=>evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 const source=await center('#roster-bottom .occupied'),sell=await center('#roster-sell-zone');
 await call('Input.dispatchMouseEvent',{type:'mousePressed',...source,button:'left',buttons:1,clickCount:1});
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',...sell,button:'left',buttons:1});
 const sale=await evaluate(`(()=>{const zone=document.getElementById('roster-sell-zone');return {text:zone.textContent,image:getComputedStyle(zone.querySelector('.currency-crystal')).backgroundImage}})()`);
 assert.match(sale.text,/^出售\s+\+\d+$/);assert.match(sale.image,/currency-crystal.png/);
 await call('Input.dispatchMouseEvent',{type:'mouseReleased',...source,button:'left',buttons:0,clickCount:1});await escape();assert.equal(await snapshot(),beforeHelp);
 // Draw a revealed mid-run route without writing any game data.
 await evaluate(`(()=>{
  const state=mapTestRun.map,{q,r}=state.map.cells[state.current];
  const fields=['map','revealed','revealedAt','steps','cleared','collapsed','rewardLocks','rewardDecay'];
  window.restoreArtState=()=>{Object.assign(state,previous);window.dispatchEvent(new Event('resize'));};
  const previous=Object.fromEntries(fields.map(key=>[key,state[key]]));
  const layout=[[0,0,'entrance'],[1,0,'battle'],[0,1,'battle'],[1,-1,'shop'],[2,-1,'fragile'],[1,1,'fragile'],[2,1,'elite'],[3,-1,'rest'],[3,-2,'goal'],[0,-1,'shop']];
  const ids=layout.map(([x,y])=>[q+x,r+y].join(','));
  const cells=Object.fromEntries(layout.map(([x,y,type],i)=>[ids[i],{q:q+x,r:r+y,type}]));
  Object.assign(state,{map:{...state.map,cells,goal:ids[8]},revealed:new Set(ids),revealedAt:Object.fromEntries(ids.map((id,i)=>[id,i===2?0:5])),steps:5,cleared:new Set([ids[0],ids[9]]),collapsed:new Set([ids[5]]),rewardLocks:{},rewardDecay:{enabled:true,stages:[{after:5,tier:'medium'}]}});
  window.dispatchEvent(new Event('resize'));
 })()`);
 const art=await evaluate(`(()=>{const canvas=document.querySelector('#hex-map-svg');return {
  fogBehind:canvas.querySelector('.journey-frontier-fog').nextElementSibling.matches('.hex-cell') && +getComputedStyle(canvas).zIndex > +getComputedStyle(canvas.parentElement,'::before').zIndex,
  floorKinds:[...new Set([...canvas.querySelectorAll('[data-floor]')].map(el=>el.dataset.floor))].sort(),
  battle:[...canvas.querySelectorAll('.battle .map-standee image')].map(el=>el.style.filter).sort(),
  imageCount:canvas.querySelectorAll('.map-standee image[href^="assets/ui/map/v2/standees/"]').length,
  sizes:['battle','elite','goal'].map(type=>{const tile=canvas.querySelector('.'+type+' .map-standee');const key=tile.parentElement.getAttribute('aria-label').match(/座標 (-?[0-9]+), (-?[0-9]+)/);const state=mapTestRun.map,cell=state.map.cells[key[1]+','+key[2]];return Math.round(Number(tile.getAttribute('width'))/JourneyView.tile(cell,JourneyView.camera(state.map,state.current,0)).scale)}),
  cleared:canvas.querySelectorAll('.cleared .map-standee').length
 }})()`);
 assert.ok(art.fogBehind);
 assert.deepEqual(art.floorKinds,['fragile-collapsed','fragile-walkable','normal-blocked','normal-walkable']);
 assert.deepEqual(art.battle,['brightness(0.68)','brightness(1)']);
 assert.equal(art.imageCount,6);assert.deepEqual(art.sizes,[64,82,108]);assert.equal(art.cleared,0);
 await capture('../map-standees-v1/applied-exploration.png');await evaluate('restoreArtState()');
 const polygons=()=>evaluate(`[...document.querySelectorAll('.hex-cell polygon')].map(p=>p.getAttribute('points')).join('|')`);
 const rotate=async()=>{await call('Input.dispatchMouseEvent',{type:'mousePressed',x:960,y:540,button:'right',buttons:2,clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:1135,y:540,button:'right',buttons:2});await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:1135,y:540,button:'right',buttons:0,clickCount:1});await sleep(150)};
 const original=await polygons();await rotate();assert.notEqual(await polygons(),original);assert.equal(await snapshot(),beforeHelp);await capture('applied-map-rotated.png');
 const surfaceBefore=await evaluate(`getComputedStyle(document.querySelector('.map-stage')).backgroundImage`);
 assert.match(surfaceBefore,/assets\/ui\/map\/v1\/slate-background.png/);
 await rotate();assert.equal(await evaluate(`getComputedStyle(document.querySelector('.map-stage')).backgroundImage`),surfaceBefore);
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-check.json'),JSON.stringify({browser:'isolated Chrome via CDP',layouts,helpPreservesState:true,rotationPreservesState:true,texture:'approved fixed backdrop',errors},null,2)+'\n');console.log('Chrome: 1920/1366/390 full-height map toolbar, help open/close/Escape/backdrop/focus/scroll, preparation, fog extent and rotation passed.');await call('Browser.close').catch(()=>{});
}catch(e){console.error(e);throw e}finally{ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(r=>server.close(r));if(!path.resolve(profile).startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(profile).startsWith('minimajo-map-toolbar-'))throw Error('Unsafe cleanup');await sleep(200);try{fs.rmSync(profile,{recursive:true,force:true})}catch{}}})().catch(e=>{console.error(e);process.exitCode=1});
