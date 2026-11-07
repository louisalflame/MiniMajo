// Isolated Chrome/CDP; fixtures and status changes stay in browser memory.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tmp/browser/battle-result-v1');
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
  await call('Page.addScriptToEvaluateOnNewDocument',{source:'(()=>{let api;Object.defineProperty(window,"Journey",{configurable:true,get:()=>api,set(value){api=value;const original=value.create;value.create=function(...args){const s=original(...args),loss=location.search.includes("loss"),draw=location.search.includes("draw");window.resultRun=s;const origin=s.map.current,id=HexMap.neighbors(s.map.map,origin)[0];window.resultTarget=id;window.resultOrigin=origin;if(loss)s.map.map.cells[origin].type="fragile";s.map.map.cells[id].type="battle";s.config.normalReward=40;if(draw){s.config.battleSeconds=1;s.config.overtimeDamage=100;s.config.overtimePulse=.1;}const base={...structuredClone(s.roster.library[0]),space:2,maxHp:draw?10:loss?20:200,cooldown:draw?120:loss?120:.1,moveDistance:0,attackRange:10,imageFile:"xinzi-2slot.png",effects:[{type:"damage",amount:1000,range:10}],passives:[],laws:[],instanceId:"result-hero"};const enemy={...base,maxHp:draw?10:loss?200:20,cooldown:draw?120:loss?.1:120,instanceId:"result-foe"};s.roster.active=[base,...Array(9).fill(null)];s.roster.reserve=Array(10).fill(null);s.enemyRolls[id]={team:{name:"勝敗演出測試"},board:[enemy,...Array(9).fill(null)]};return s;};}})})()'});
  const results=[];
  for(const scenario of ['victory','loss','draw']){
   await call('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
   await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/play.html?result-case='+scenario});
   await until(()=>evaluate('!!window.resultRun&&document.querySelectorAll("#hex-map-svg [role=button]").length>0'));
   const gold=await evaluate('resultRun.roster.gold');
   await evaluate('(()=>{const cell=resultRun.map.map.cells[resultTarget],label="座標 "+cell.q+", "+cell.r+"，",tile=Array.from(document.querySelectorAll("#hex-map-svg [role=button]")).find(el=>el.getAttribute("aria-label").startsWith(label));tile.dispatchEvent(new MouseEvent("click",{bubbles:true}))})()');
   await until(()=>evaluate('document.getElementById("journey-map").hidden&&!document.getElementById("journey-frame").contentDocument?.getElementById("play")?.disabled'));
   await evaluate('document.getElementById("journey-frame").contentDocument.getElementById("play").click()');
   await until(()=>evaluate('!!document.getElementById("journey-frame").contentDocument?.getElementById("battle-result")?.open'));
   await sleep(750);
   const before=await evaluate('(()=>{const doc=document.getElementById("journey-frame").contentDocument;return {title:doc.getElementById("battle-result-title").textContent,gold:resultRun.roster.gold,encounter:!!resultRun.encounter,reward:!!resultRun.rewardChoice,hub:!!document.getElementById("reward-hub").open,collapsed:resultRun.map.collapsed.has(resultOrigin),aria:doc.getElementById("battle-result").getAttribute("aria-labelledby")}})()');
   assert.equal(before.title,scenario==='victory'?'VICTORY':'GAME SET');assert.equal(before.gold,gold);assert.ok(before.encounter);assert.equal(before.reward,false);assert.equal(before.hub,false);assert.equal(before.aria,'battle-result-title');
   for(const [width,height]of [[1366,768],[390,844]]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(150);
    const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,scenario+'-'+width+'.png'),Buffer.from(shot.data,'base64'));
   }
   await evaluate('document.getElementById("journey-frame").contentDocument.getElementById("battle-result-confirm").click()');
   if(scenario==='victory'){
    await until(()=>evaluate('!!document.getElementById("reward-hub").open'));
    assert.equal(await evaluate('resultRun.roster.gold'),gold+40);
    await evaluate('document.getElementById("journey-frame").contentDocument.getElementById("battle-result-confirm").click()');
    assert.equal(await evaluate('resultRun.roster.gold'),gold+40);
   }else if(scenario==='loss'){
    await until(()=>evaluate('!document.getElementById("journey-map").hidden&&document.getElementById("journey-battle").hidden'));
    const retreat=await evaluate('({origin:resultOrigin,current:resultRun.map.current,steps:resultRun.map.steps,collapsed:resultRun.map.collapsed.has(resultOrigin),pending:resultRun.map.pending,cleared:resultRun.map.cleared.has(resultTarget),reward:!!resultRun.rewardChoice,gold:resultRun.roster.gold})');
    assert.equal(retreat.current,retreat.origin);assert.equal(retreat.steps,0);assert.equal(retreat.collapsed,false);assert.equal(retreat.pending,null);assert.equal(retreat.cleared,false);assert.equal(retreat.reward,false);assert.equal(retreat.gold,gold);
    const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,'defeat-return-map.png'),Buffer.from(shot.data,'base64'));
   }

   if(scenario==='draw'){
    await until(()=>evaluate('!resultRun.encounter'));
    assert.equal(await evaluate('resultRun.map.current===resultTarget&&resultRun.map.cleared.has(resultTarget)&&!resultRun.rewardChoice'),true);
    await evaluate('document.getElementById("journey-frame").contentDocument.getElementById("battle-stats").click()');
    assert.equal(await evaluate('document.getElementById("journey-frame").contentDocument.getElementById("battle-stats").getAttribute("aria-pressed")'),'true');
   }
   results.push({scenario,before,acknowledged:true});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-check.json'),JSON.stringify({browser:'isolated headless Chrome',results,actualIframeBattle:true,fragileRetreat:true,noDuplicateReward:true,sizes:[1366,390],errors},null,2)+'\n');
  console.log('Actual journey iframe: victory waits for click before loot/payment, defeat waits then returns directly to previous fragile tile, 1366/390, no duplicate rewards or page exceptions.');
  await call('Browser.close');
 }finally{
  ws?.close();chrome?.kill();server.closeAllConnections();await new Promise(r=>server.close(r));
  const resolved=path.resolve(profile);if(!resolved.startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(resolved).startsWith('minimajo-motion-'))throw Error('Unsafe profile cleanup');
  await sleep(300);try{fs.rmSync(resolved,{recursive:true,force:true});}catch{}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
