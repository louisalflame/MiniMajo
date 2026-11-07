const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tmp/browser/prebattle-layout');fs.mkdirSync(out,{recursive:true});
const file=require('../../js/editor-backup.js').prepare(JSON.parse(fs.readFileSync(path.join(root,'minimajo-editor.json')))).file;
const skill={id:'preview-test',name:'試打敵方極式',description:'自動護盾',imagePath:'assets/ui/ultimate-icons/v1/normal.png',cooldown:.3,mode:'all',conditions:[],effects:[{type:'shield',amount:7,targets:[{side:'ally',mode:'self'}]}]};file.data.skills.skills.unshift(skill);file.data.skills.skills.push({...skill,id:'unmatched-preview',conditions:[{kind:'count',field:'id',value:'missing',op:'gte',count:1}]});
const law=require('../../js/laws.js').validate([{id:'layout-law',name:'站位保留法則',shopPrice:0,shopWeight:0,stats:{},passives:[]}])[0];file.data.laws.laws.push(law);
const dataFile=path.join(out,'editor.json');fs.writeFileSync(dataFile,JSON.stringify(file));const before=fs.readFileSync(dataFile);
const single=file.data.characters.items.find(u=>u.space===1),wide=file.data.characters.items.find(u=>u.space===2);
const server=require('../../editor-server.cjs').createEditorServer({root,dataFile});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1366,height:900},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{for(const [name,key]of [['Battle','battleState'],['Journey','journeyRun']]){let api;Object.defineProperty(globalThis,name,{configurable:true,get:()=>api,set(value){api=value;const create=value.create;value.create=(...args)=>globalThis[key]=create(...args);}});}});
  const url=`http://127.0.0.1:${server.address().port}`;
  await page.goto(url+'/editor.html');await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');await page.locator('#tab-battle').click();
  for(const team of ['我方','敵方'])for(let i=1;i<=10;i++){const control=page.getByLabel(`${team}第 ${i} 個角色`,{exact:true});if(await control.inputValue())await control.selectOption('');}
  await page.locator('#preview-enemy-skill').selectOption(skill.id);
  const emptyFrame=page.frameLocator('#battle-preview');await emptyFrame.locator('#enemy-cast').waitFor({state:'visible'});assert.match(await emptyFrame.locator('#enemy-skill-state').textContent(),/沒有存活的出戰角色/);await emptyFrame.locator('#enemy-skill-art').waitFor({state:'visible'});
  for(const [team,i,id] of [['我方',1,single.id],['我方',3,wide.id],['敵方',1,single.id],['敵方',3,single.id]])await page.getByLabel(`${team}第 ${i} 個角色`,{exact:true}).selectOption(id);
  await page.locator('#teams .team').nth(0).locator('.slot').nth(2).getByLabel('本局星等').selectOption('6');await page.getByLabel('我方第 3 格法則',{exact:true}).selectOption(law.id);
  await page.locator('#preview-enemy-skill').selectOption('unmatched-preview');await emptyFrame.locator('#enemy-cast').waitFor({state:'visible'});assert.match(await emptyFrame.locator('#enemy-skill-state').textContent(),/不符合目前敵方編隊條件/);await emptyFrame.locator('#enemy-cast').hover();await emptyFrame.locator('#enemy-skill-tooltip').waitFor({state:'visible'});await emptyFrame.locator('#enemy-skill-art').waitFor({state:'visible'});await page.screenshot({path:path.join(out,'unmatched-enemy-skill.png')});
  await page.locator('#preview-enemy-skill').selectOption(skill.id);await page.locator('#active-skills-enabled').uncheck();
  const frame=page.frameLocator('#battle-preview'),iframe=page.frames().find(f=>f.url().includes('battle.html'));
  await frame.locator('#enemy-cast').waitFor({state:'visible'});assert.equal(await iframe.evaluate(()=>battleState.teams[1].skill.id),skill.id);
  await page.locator('#battle-preview').scrollIntoViewIfNeeded();
  async function mouseMove(team,from,to){
   const board=frame.locator(team?'#enemy-units':'#ally-units'),box=await board.boundingBox(),card=frame.locator(`[data-battle-id="${team}:${from}"]`),source=await card.boundingBox(),allowed=await card.evaluate(el=>el.classList.contains('prebattle-draggable'));
   const offset=box.width/10*.35,x=source.x+offset,y=source.y+source.height*.45,target=box.x+box.width/10*(to+.35),middle=(x+target)/2;
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(middle,y,{steps:6});
   const ghost=frame.locator('.battle-drag-ghost');
   if(allowed){await ghost.waitFor({state:'visible'});const rect=await ghost.boundingBox();assert.ok(Math.abs(rect.width-source.width)<1&&Math.abs(rect.height-source.height)<1);assert.ok(Math.abs(rect.x-(middle-offset))<1);assert.equal(await ghost.getAttribute('aria-hidden'),'true');assert.equal(await ghost.getAttribute('data-battle-id'),null);assert.equal(await ghost.evaluate(el=>getComputedStyle(el).pointerEvents),'none');}
   else assert.equal(await ghost.count(),0);
   await page.mouse.move(target,y,{steps:6});if(allowed){const rect=await ghost.boundingBox();assert.ok(Math.abs(rect.x-(target-offset))<1);if(team===0&&from===2)await page.screenshot({path:path.join(out,'drag-following-pointer.png')});}
   await page.mouse.up();assert.equal(await ghost.count(),0);
  }
  await mouseMove(0,2,4);await iframe.waitForFunction(()=>battleState.teams[0].items[4]?.stars===6);assert.equal(await page.getByLabel('我方第 5 個角色',{exact:true}).inputValue(),wide.id);assert.equal(await iframe.evaluate(()=>battleState.teams[0].items[4].laws[0].id),law.id);assert.ok(await frame.locator('#character-detail').isHidden());
  await mouseMove(1,0,6);await iframe.waitForFunction(()=>!!battleState.teams[1].items[6]);assert.equal(await page.getByLabel('敵方第 7 個角色',{exact:true}).inputValue(),single.id);
  for(const mode of ['escape','outside']){
   const board=await frame.locator('#ally-units').boundingBox(),card=await frame.locator('[data-battle-id="0:4"]').boundingBox(),x=card.x+board.width/10*.35,y=card.y+card.height*.45;
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+25,y+20,{steps:4});await frame.locator('.battle-drag-ghost').waitFor({state:'visible'});
   if(mode==='escape'){await page.keyboard.press('Escape');assert.equal(await frame.locator('.battle-drag-ghost').count(),0);await page.mouse.up();}
   else{await page.mouse.move(x,board.y+board.height+40,{steps:4});await page.mouse.up();}
   assert.equal(await frame.locator('.battle-drag-ghost').count(),0);assert.equal(await page.getByLabel('我方第 5 個角色',{exact:true}).inputValue(),wide.id);assert.ok(await frame.locator('#character-detail').isHidden());
  }
  await page.screenshot({path:path.join(out,'editor-drag.png')});
  await frame.locator('#play').click();await iframe.waitForFunction(()=>battleState.teams[1].units.some(u=>u.shield>=7));assert.equal(await iframe.evaluate(()=>Battle.canCast(battleState,0)),false);await page.waitForFunction(()=>document.getElementById('preview-enemy-skill').disabled);
  const locked=await iframe.evaluate(()=>battleState.teams[0].items.map(u=>u?.id??null));await mouseMove(0,4,6);assert.deepEqual(await iframe.evaluate(()=>battleState.teams[0].items.map(u=>u?.id??null)),locked);
  assert.deepEqual(fs.readFileSync(dataFile),before);
  // Actual journey parent and touch drag; no editor or reward overlay is opened.
  await page.goto(url+'/play.html');await page.waitForFunction(()=>!!globalThis.journeyRun);
  const target=await page.locator('.hex-cell.reachable').first().getAttribute('aria-label');await page.evaluate(label=>{const [,q,r]=label.match(/座標 (-?\d+), (-?\d+)/);Object.values(journeyRun.map.map.cells).find(c=>c.q===+q&&c.r===+r).type='battle';},target);
  await page.getByRole('button',{name:target,exact:true}).focus();await page.keyboard.press('Enter');await page.locator('#journey-battle').waitFor({state:'visible'});
  await page.setViewportSize({width:390,height:844});const battle=page.frameLocator('#journey-frame'),inner=page.frames().find(f=>f.url().includes('battle.html'));await battle.locator('[data-battle-id="0:0"]').waitFor();
  const identity=await page.evaluate(()=>journeyRun.roster.active[0].instanceId),token=await page.evaluate(()=>journeyRun.encounter.token),box=await battle.locator('#ally-units').boundingBox(),card=await battle.locator('[data-battle-id="0:0"]').boundingBox();
  const cdp=await context.newCDPSession(page),x=card.x+box.width/10*.35,y=card.y+card.height*.45,to=box.x+box.width/10*1.35;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(to-x)*i/8,y}]});await battle.locator('.battle-drag-ghost').waitFor({state:'visible'});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await battle.locator('.battle-drag-ghost').count(),0);
  await page.waitForFunction(id=>journeyRun.roster.active[1]?.instanceId===id,identity);assert.notEqual(await page.evaluate(()=>journeyRun.encounter.token),token);assert.equal(await inner.evaluate(()=>battleState.teams[0].items[1].id),await page.evaluate(()=>journeyRun.roster.active[1].id));assert.ok(await page.locator('#expedition-dialog').isHidden());
  await page.screenshot({path:path.join(out,'journey-touch.png')});await battle.locator('#play').click();await page.waitForFunction(()=>journeyRun.encounter.started);const boardBefore=await page.evaluate(()=>journeyRun.roster.active.map(u=>u?.instanceId??null));
  await inner.evaluate(token=>parent.postMessage({type:'minimajo-reposition',team:0,from:1,to:0,token,requestId:999},'*'),await page.evaluate(()=>journeyRun.encounter.token));await page.waitForTimeout(100);assert.deepEqual(await page.evaluate(()=>journeyRun.roster.active.map(u=>u?.instanceId??null)),boardBefore);
  assert.deepEqual(errors,[]);console.log('PASS: preview enemy skill independent of player toggle, native desktop drag for both teams, wide stars/laws preserved, no source writes, post-start locked, mobile journey touch drag and roster/iframe identity sync.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
