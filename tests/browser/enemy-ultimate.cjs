// Isolated fixed JSON; never writes the user's minimajo-editor.json.
const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tmp/browser/enemy-ultimate');fs.mkdirSync(out,{recursive:true});
const dataFile=path.join(out,'editor.json'),file=JSON.parse(fs.readFileSync(path.join(root,'minimajo-editor.json')));
const E=require('../../js/effects.js'),S=require('../../js/skills.js'),D=require('../../js/database.js'),C=require('../../js/config.js');
const shield=E.validate({type:'shield',amount:7,targets:[{side:'ally',mode:'self'}]});
const skill=S.validate({version:1,skills:[{id:'enemy-browser',name:'敵方測試極式',description:'敵方的護盾測試說明。',imagePath:'assets/ui/ultimate-icons/v1/normal.png',cooldown:.3,mode:'all',conditions:[],effects:[shield]}]}).skills[0];
file.data.skills.skills.unshift(skill);file.data.enemies.teams.forEach(t=>t.skillId=null);fs.writeFileSync(dataFile,JSON.stringify(file));
const server=require('../../editor-server.cjs').createEditorServer({root,dataFile});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   for(const [name,key] of [['Battle','battleState'],['Journey','journeyRun']]){let api;Object.defineProperty(globalThis,name,{configurable:true,get:()=>api,set(value){api=value;const create=value.create;value.create=(...args)=>globalThis[key]=create(...args);}});}
  });
  const url=`http://127.0.0.1:${server.address().port}`;
  await page.goto(url+'/editor.html');await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');
  await page.locator('#tab-enemies').click();await page.locator('#enemy-category').selectOption('boss');await page.locator('#enemy-skill').selectOption(skill.id);await page.locator('#enemy-name').fill('測試極式敵隊');await page.locator('#enemy-form button[type=submit]').click();
  await page.waitForFunction(()=>globalThis.EditorFileSession.state().pending===0);assert.match(await page.locator('#enemy-message').textContent(),/已儲存/);
  const saved=JSON.parse(fs.readFileSync(dataFile));assert.equal(saved.data.enemies.teams.find(t=>t.name==='測試極式敵隊').skillId,skill.id);
  await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');await page.locator('#tab-enemies').click();assert.equal(await page.locator('#enemy-skill').inputValue(),skill.id);
  await page.locator('#enemy-category').selectOption('normal');assert.ok(await page.locator('#enemy-skill').isDisabled());
  await page.goto(url+'/play.html');await page.waitForFunction(()=>!!globalThis.journeyRun);assert.equal(await page.evaluate(()=>journeyRun.roster.skillId),skill.id);
  const target=await page.locator('.hex-cell.reachable').first().getAttribute('aria-label');await page.evaluate(label=>{const [,q,r]=label.match(/座標 (-?\d+), (-?\d+)/);Object.values(journeyRun.map.map.cells).find(c=>c.q===+q&&c.r===+r).type='goal';journeyRun.enemies.teams=journeyRun.enemies.teams.filter(t=>t.name==='測試極式敵隊');},target);
  await page.getByRole('button',{name:target,exact:true}).focus();await page.keyboard.press('Enter');await page.locator('#journey-battle').waitFor({state:'visible'});
  const iframe=page.frames().find(f=>f.url().includes('battle.html')),frame=page.frameLocator('#journey-frame');await frame.locator('#enemy-cast').waitFor({state:'visible'});
  async function assertOrbUnclipped(){const sizes=await iframe.evaluate(()=>{const b=document.getElementById('enemy-cast').getBoundingClientRect(),clip=document.querySelector('.arena-scroll').getBoundingClientRect(),play=document.getElementById('play').getBoundingClientRect();return {orb:{top:b.top,bottom:b.bottom,left:b.left,right:b.right},clip:{top:clip.top,bottom:clip.bottom},play:{top:play.top,bottom:play.bottom,left:play.left,right:play.right}};});assert.ok(sizes.orb.top>=sizes.clip.top,JSON.stringify(sizes));assert.ok(sizes.orb.bottom<=sizes.clip.bottom,JSON.stringify(sizes));if(sizes.orb.right>sizes.play.left&&sizes.orb.left<sizes.play.right)assert.ok(sizes.orb.top>=sizes.play.bottom,JSON.stringify(sizes));}
  await frame.locator('#enemy-skill-art').waitFor({state:'visible'});await assertOrbUnclipped();await frame.locator('#enemy-cast').hover();await frame.locator('#enemy-skill-tooltip').waitFor({state:'visible'});assert.match(await frame.locator('#enemy-skill-description').textContent(),/護盾測試說明/);
  await page.screenshot({path:path.join(out,'desktop-tooltip.png')});await frame.locator('#play').click();
  await iframe.waitForFunction(()=>battleState.teams[1].units.some(u=>u.shield>=7));assert.ok(await iframe.evaluate(()=>battleState.teams[1].skillReady>3));
  assert.equal(await iframe.evaluate(()=>battleState.teams[0].units.reduce((n,u)=>n+u.shield,0)),0);
  await frame.locator('#play').click();const tick=await iframe.evaluate(()=>battleState.tick);await page.waitForTimeout(250);assert.equal(await iframe.evaluate(()=>battleState.tick),tick);
  await frame.locator('#enemy-cast').focus();await frame.locator('#enemy-skill-tooltip').waitFor({state:'visible'});
  for(const width of [1920,390]){await page.setViewportSize({width,height:width===390?844:1080});await assertOrbUnclipped();await frame.locator('#enemy-cast').click();await frame.locator('#enemy-skill-tooltip').waitFor({state:'visible'});const box=await frame.locator('#enemy-skill-tooltip').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);await page.screenshot({path:path.join(out,'tooltip-'+width+'.png')});}
  const token=await page.evaluate(()=>journeyRun.encounter.token);await iframe.evaluate(token=>parent.postMessage({type:'minimajo-journey-result',token,winner:0,hp:battleState.teams[0].units.map(u=>u.hp)},'*'),token);
  await page.locator('#journey-complete-confirm').click();await page.waitForURL('**/index.html');assert.deepEqual(errors,[]);
  // Same fixture in a standalone preview: normal/no enemy ultimate stays hidden.
  await page.goto(url+'/battle.html?preview=1');await page.waitForFunction(()=>!!globalThis.battleState);
  const unit={...D.defaults[0],effects:[],cooldown:120,maxHp:500};const row=[unit,...Array(9).fill(null)];
  await page.evaluate(payload=>postMessage(payload,'*'),{type:'minimajo-preview',loadouts:[row,row],skills:[skill],limits:[10,10],config:C.defaults,activeSkillsEnabled:true});
  assert.ok(await page.locator('#enemy-skill-control').isHidden());assert.deepEqual(errors,[]);
  console.log('PASS: editor save/reload with isolated fixed JSON; initial equip; boss payload; enemy auto independent of player manual; pause; hover/focus/mobile tooltip and three sizes; boss result navigates home; no-skill hides orb.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
