const {gamePage}=require('./game-page.cjs');
const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tmp/browser/fixed-viewport');
const before=fs.readFileSync(path.join(root,'minimajo-editor.json')),server=require('../../editor-server.cjs').createEditorServer({root});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  fs.mkdirSync(out,{recursive:true});browser=await chromium.launch({channel:'msedge',headless:true,ignoreDefaultArgs:['--hide-scrollbars']});
  const url=`http://127.0.0.1:${server.address().port}`;
  for(const [width,height] of [[1600,900],[844,390],[390,844]]){
   const context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:'reduce'}),raw=await context.newPage(),page=gamePage(raw),errors=[];
   raw.on('pageerror',e=>errors.push(e.message));
   await raw.addInitScript(()=>{for(const [name,capture] of [['Journey','fixedJourney'],['Battle','fixedBattle']]){let api;Object.defineProperty(window,name,{configurable:true,get:()=>api,set(value){api=value;const create=value.create;value.create=(...args)=>window[capture]=create(...args);}});}});
   await raw.goto(url+'/index.html');await page.getByRole('link',{name:'START'}).waitFor();
   assert.deepEqual(await page.evaluate(()=>[innerWidth,innerHeight]),[1600,900]);
   assert.equal(await raw.locator('html').getAttribute('data-game-rotation'),width<height?'90':'0');
   let bounds=await raw.locator('#game-frame').boundingBox();
   assert(Math.abs(bounds.x+bounds.width/2-width/2)<1&&Math.abs(bounds.y+bounds.height/2-height/2)<1);
   assert(bounds.x>=-1&&bounds.y>=-1&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1);
   await page.getByRole('link',{name:'START'}).click();await page.waitForFunction(()=>!!window.fixedJourney);await raw.waitForURL('**/play.html');
   assert.equal(await raw.evaluate(()=>typeof window.fixedJourney),'undefined','outer host never creates a second journey');
   async function touchDrag(source,target,{hold=false}={}){
    const a=await source.boundingBox(),b=await target.boundingBox(),x=a.x+a.width/2,y=a.y+a.height/2,tx=b.x+b.width/2,ty=b.y+b.height/2;
    const cdp=await context.newCDPSession(raw);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let n=1;n<=12;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(tx-x)*n/12,y:y+(ty-y)*n/12}]});
    // CDP acknowledges touch injection before Chrome delivers the coalesced move.
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    if(hold)return {cdp,x:tx,y:ty,source:a};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
   }
   async function inside(selector){
    const r=await page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};});
    assert(r.x>=0&&r.y>=0&&r.right<=1601&&r.bottom<=901,selector+' stays in the logical viewport: '+JSON.stringify(r));
   }
   async function scrollContent(selector){
    const el=page.locator(selector).first();
    const scroll=await el.evaluate(el=>{const r=el.getBoundingClientRect();el.scrollTop=0;return {x:r.x+r.width/2,y:r.y+r.height*.9,endY:r.y+r.height*.1,overflow:el.scrollHeight>el.clientHeight,rail:getComputedStyle(el,'::-webkit-scrollbar').width};});
    assert(scroll.overflow,selector+' overflows');assert.equal(scroll.rail,'12px',selector+' uses the shared skill-picker rail');
    const canvas=await raw.locator('#game-frame').boundingBox();
    const physical=(x,y)=>width<height?{x:canvas.x+(900-y)*canvas.width/900,y:canvas.y+x*canvas.height/1600}:{x:canvas.x+x*canvas.width/1600,y:canvas.y+y*canvas.height/900};
    const from=physical(scroll.x,scroll.y),to=physical(scroll.x,scroll.endY),cdp=await context.newCDPSession(raw);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});
    for(let n=1;n<=12;n++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*n/12,y:from.y+(to.y-from.y)*n/12}]});await raw.waitForTimeout(20);}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
    await el.evaluate(el=>new Promise((resolve,reject)=>{let tries=0;const check=()=>el.scrollTop>5?resolve():++tries>120?reject(Error('touch did not scroll '+el.className)):requestAnimationFrame(check);check();}));
   }
   await page.evaluate(()=>{
    const base={...ItemDB.defaults[0],id:'fixed-role',space:1,imageFile:'youmeng-1slot.png',description:Array(70).fill('固定畫布長文捲動測試。').join('\n')},config={...GameConfig.defaults,startingGold:100,startingActive:Array(10).fill(null)};
    const state=Expedition.create([base],[],config),unit=state.library[0];
    state.shops.fixed=[0,1,2].map(i=>({...structuredClone(unit),instanceId:'stock-'+i,price:20})).concat(Array(7).fill(null));
    state.lawShops.fixed=[0,1,2].map(i=>({id:'review-law-'+i,name:'法則底板',description:base.description,price:1,stats:{},passives:[]}));
    window.fixedShop=state;ExpeditionUI.bind(state);ExpeditionUI.open('shop','fixed');
   });
   await inside('#expedition-dialog');
   await touchDrag(page.locator('#roster-top [data-drop-slot="0"]'),page.locator('#roster-reserve [data-drop-slot="0"]'));
   await page.waitForFunction(()=>fixedShop.reserve[0]?.stars===1&&fixedShop.gold===80);
   const merge=await touchDrag(page.locator('#roster-top [data-drop-slot="1"]'),page.locator('#roster-reserve [data-drop-slot="0"]'),{hold:true});
   await page.locator('.roster-merge-cue').waitFor();await inside('.roster-merge-cue');
   const ghost=await page.locator('.roster-drag-ghost').boundingBox(),ghostStyle=await page.locator('.roster-drag-ghost').evaluate(el=>({style:el.getAttribute('style'),width:getComputedStyle(el).width,height:getComputedStyle(el).height,origin:getComputedStyle(el).transformOrigin}));assert(Math.abs(ghost.x+ghost.width/2-merge.x)<3&&Math.abs(ghost.y+ghost.height/2-merge.y)<3,'drag ghost follows the physical touch point: '+JSON.stringify({ghost,ghostStyle,touch:{x:merge.x,y:merge.y},source:merge.source,width,height}));
   await merge.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await merge.cdp.detach();
   await page.waitForFunction(()=>fixedShop.reserve[0]?.stars===2&&fixedShop.gold===60);
   const snapshot=await page.evaluate(()=>JSON.stringify(fixedShop));
   const cancel=await touchDrag(page.locator('#roster-top [data-drop-slot="2"]'),page.locator('#roster-reserve [data-drop-slot="3"]'),{hold:true});
   await page.locator('.roster-drag-ghost').waitFor();await raw.setViewportSize({width:height,height:width});
   await page.locator('.roster-drag-ghost').waitFor({state:'detached'});
   await cancel.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cancel.cdp.detach();
   assert.equal(await page.evaluate(()=>JSON.stringify(fixedShop)),snapshot);await raw.setViewportSize({width,height});
   await raw.screenshot({path:path.join(out,`shop-${width}.png`)});
   await page.locator('#roster-top [data-drop-slot="2"]').click();await scrollContent('.shop-inspect-content');
   await raw.screenshot({path:path.join(out,`shop-scroll-${width}.png`)});
   await page.locator('#shop-tab-laws').click();
   await touchDrag(page.locator('#roster-reserve [data-drop-slot="0"]'),page.locator('#law-target-zone'));
   await raw.screenshot({path:path.join(out,`laws-${width}.png`)});await scrollContent('.law-card-copy');
   await page.locator('#expedition-close').click();
   await page.evaluate(()=>{ExpeditionUI.bind(fixedJourney.roster);fixedJourney.roster.active.find(Boolean).description=Array(70).fill('固定畫布長文捲動測試。').join('\n');fixedJourney.roster.skills=SkillDB.validate({version:1,skills:Array.from({length:5},(_,i)=>({...SkillDB.defaults[0],id:'review-skill-'+i,conditions:[],description:Array(20).fill('固定尺寸端飾與長文捲動。').join('\n')}))}).skills;});
   await page.locator('#journey-gear').click();await page.locator('#roster-bottom .occupied').first().click();await inside('#character-detail');
   await scrollContent('.detail-content');await raw.screenshot({path:path.join(out,`detail-scroll-${width}.png`)});
   await raw.keyboard.press('Escape');await page.locator('#roster-skill').click();await inside('#roster-skill-menu');
   await page.locator('.skill-choice').first().click();await raw.screenshot({path:path.join(out,`skill-scroll-${width}.png`)});await page.locator('#roster-skill-confirm').click();await raw.keyboard.press('Escape');
   const target=await page.locator('.hex-cell.reachable').first().getAttribute('aria-label');
   const [,q,r]=target.match(/座標 (-?\d+), (-?\d+)/);
   await page.evaluate(({q,r})=>{Object.values(fixedJourney.map.map.cells).find(c=>c.q===+q&&c.r===+r).type='battle';dispatchEvent(new Event('resize'));},{q,r});
   await page.getByRole('button',{name:new RegExp('^座標 '+q+', '+r+'，')}).locator('.map-floor-base').tap();await page.locator('#journey-battle').waitFor({state:'visible'});
   const battle=page.frameLocator('#journey-frame');await battle.locator('#play').waitFor({state:'visible'});
   const identity=await page.evaluate(()=>fixedJourney.roster.active[0].instanceId);
   await touchDrag(battle.locator('[data-battle-id="0:0"]'),battle.locator('#ally-units .empty-slot[aria-label="第 9 格，空位"]'));
   await page.waitForFunction(id=>fixedJourney.roster.active[8]?.instanceId===id,identity);
   await battle.locator('#play').click();
   const battleFrame=raw.frames().find(f=>f.url().includes('battle.html'));
   await battleFrame.waitForFunction(()=>fixedBattle.started);
   await raw.screenshot({path:path.join(out,`battle-${width}.png`)});
   await battleFrame.evaluate(()=>{fixedBattle.teams[1].units.forEach(u=>u.hp=0);Battle.step(fixedBattle);});
   await battle.locator('#battle-result-confirm').click();await page.locator('#reward-hub[open]').waitFor();await inside('#reward-hub');
   await page.locator('#reward-money').click();await inside('#reward-money-dialog');await page.locator('#reward-money-close').click();
   await page.locator('#reward-characters').click();await inside('#journey-reward');
   await raw.screenshot({path:path.join(out,`reward-${width}.png`)});
   await page.locator('#reward-options .reward-card').first().click();await page.locator('#reward-confirm').click();
   await battle.locator('#play').click();await page.locator('#journey-battle').waitFor({state:'hidden'});
   // BOSS victory must remain visible until an explicit player confirmation.
   const bossLabel=await page.locator('.hex-cell.reachable').first().getAttribute('aria-label');
   const [,bq,br]=bossLabel.match(/座標 (-?\d+), (-?\d+)/);
   await page.evaluate(({q,r})=>{const [id,cell]=Object.entries(fixedJourney.map.map.cells).find(([,c])=>c.q===+q&&c.r===+r);cell.type='goal';fixedJourney.map.cleared.delete(id);fixedJourney.enemyRolls[id]=structuredClone(Object.values(fixedJourney.enemyRolls)[0]);if(!Journey.move(fixedJourney,id))throw Error('Cannot enter isolated BOSS fixture');dispatchEvent(new Event('resize'));},{q:bq,r:br});
   await page.locator('#map-resolve').click();
   await page.locator('#journey-battle').waitFor({state:'visible'});
   await battleFrame.waitForFunction(()=>fixedBattle&&!fixedBattle.started&&!fixedBattle.done);
   await battle.locator('#play').click();await battleFrame.waitForFunction(()=>fixedBattle.started);
   await battleFrame.evaluate(()=>{fixedBattle.teams[1].units.forEach(u=>u.hp=0);Battle.step(fixedBattle);});
   await battle.locator('#battle-result-confirm').waitFor({state:'visible'});
   await raw.waitForTimeout(1000);
   assert(raw.url().endsWith('/play.html'));assert.equal(await battle.locator('#battle-result-title').textContent(),'VICTORY');
   assert(await page.evaluate(()=>fixedJourney.encounter?.type==='goal'&&!fixedJourney.map.complete));
   assert(!(await page.locator('#reward-hub').isVisible()));
   await raw.screenshot({path:path.join(out,`boss-victory-${width}.png`)});
   await battle.locator('#battle-result-confirm').click();
   await page.locator('#journey-complete[open]').waitFor();
   assert.equal(await page.locator('#journey-complete-title').textContent(),'JOURNEY COMPLETE');
   await raw.waitForTimeout(600);assert(raw.url().endsWith('/play.html'));
   assert(!(await page.locator('#reward-hub').isVisible()));
   await raw.screenshot({path:path.join(out,`journey-complete-${width}.png`)});
   await page.locator('#journey-complete-confirm').click();await raw.waitForURL('**/index.html');
   await page.getByRole('link',{name:'START'}).waitFor();
   assert.deepEqual(await page.evaluate(()=>[innerWidth,innerHeight]),[1600,900]);assert.deepEqual(errors,[]);await context.close();
  }
  const editor=await browser.newPage();await editor.goto(url+'/index.html');const game=gamePage(editor);
  await game.locator('.workshop-link').click();await editor.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');assert.equal(await editor.locator('#game-frame').count(),0);await editor.close();
  assert.deepEqual(fs.readFileSync(path.join(root,'minimajo-editor.json')),before);
  console.log('PASS fixed desktop/landscape/portrait: logical viewport, safe bounds, touch buy/merge/ghosts, resize cancellation, long-text touch scrolling, stacked dialogs, nested battle touch reposition, victory/rewards/map, BOSS victory waits for click before home, editor escape, no duplicate journey or source writes.');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
