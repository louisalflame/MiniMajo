// Real DOM sizing and journey lifecycle; all fixtures stay in memory.
const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const server=require('../../editor-server.cjs').createEditorServer({root});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   let api;Object.defineProperty(globalThis,'Journey',{configurable:true,get:()=>api,set(value){api=value;const create=value.create;value.create=(...args)=>globalThis.sceneRun=create(...args);}});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/play.html`);
  await page.waitForFunction(()=>!!globalThis.sceneRun);
  assert.match(await page.locator('#expedition-gold').evaluate(el=>getComputedStyle(el,'::before').backgroundImage),/shop\/v1\/currency-crystal\.png/);
  // Enter an actual shop event so explicit exit must consume it.
  const target=await page.locator('.hex-cell.reachable').first().getAttribute('aria-label');
  await page.evaluate(label=>{
   const run=sceneRun,[,q,r]=label.match(/座標 (-?\d+), (-?\d+)/);
   const [id,cell]=Object.entries(run.map.map.cells).find(([,c])=>c.q===+q&&c.r===+r);
   cell.type='shop';globalThis.sceneShop=id;
   run.roster.lawLibrary=Laws.validate([{id:'scene-law',name:'測試法則',shopPrice:1,shopWeight:1,stats:{},passives:[],description:'法則長篇說明。'.repeat(120),imagePath:''}]);
   run.roster.library.forEach(u=>{u.description='角色長篇介紹。'.repeat(150);u.imageFile='grenna-1slot.png';u.detailImageFile='youmeng-detail.png';});
   run.roster.active.filter(Boolean).forEach(u=>u.imageFile='grenna-1slot.png');
  },target);
  await page.getByRole('button',{name:target,exact:true}).click();
  await page.locator('#expedition-dialog[open]').waitFor();
  await page.locator('#shop-tab-characters').focus();await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator('#shop-tab-laws').getAttribute('aria-selected'),'true');
  await page.keyboard.press('ArrowUp');assert.equal(await page.locator('#shop-tab-characters').getAttribute('aria-selected'),'true');
  for(const [width,height] of [[1366,768],[1920,1080],[2560,1080],[390,844]]){
   await page.setViewportSize({width,height});
   let characterLayout;
   for(const tab of ['characters','laws']){
    await page.locator('#shop-tab-'+tab).click();
    if(tab==='characters')await page.locator('#roster-top .occupied').first().click();
    else{
     assert.equal(await page.locator('#law-shop-products .law-card').count(),4);
     for(const art of await page.locator('#law-shop-products .law-product-art').all()){const box=await art.boundingBox();assert.ok(Math.abs(box.width-box.height)<1);assert.match(await art.evaluate(el=>getComputedStyle(el,'::after').backgroundImage),/laws-v1\/law-icon-frame\.png/);}
     assert.match(await page.locator('#law-shop-products .law-panel-skin>i').first().evaluate(el=>getComputedStyle(el).backgroundImage),/laws-v1\/law-option-panel\.png/);
     assert.match(await page.locator('#law-target-art').evaluate(el=>getComputedStyle(el,'::after').backgroundImage),/portrait-frame-v1\.png/);
     assert.equal(await page.locator('#law-target-art .law-target-placeholder').count(),1);
     const header=await page.locator('.law-card-header').first().evaluate(el=>{const title=el.querySelector('.law-card-name'),price=el.querySelector('.law-price'),s=getComputedStyle(title);return {font:parseFloat(s.fontSize),overflow:s.overflow,titleScroll:title.scrollHeight-title.clientHeight,priceScroll:price.scrollHeight-price.clientHeight};});
     assert.ok(header.font>=16&&header.overflow==='visible'&&header.titleScroll<=1&&header.priceScroll<=1,JSON.stringify(header));
     const copy=await page.locator('.law-card-copy').first().evaluate(el=>({bottom:el.getBoundingClientRect().bottom,cardBottom:el.closest('.law-card').getBoundingClientRect().bottom,scroll:el.scrollHeight-el.clientHeight}));
     assert.ok(copy.cardBottom-copy.bottom>=13&&copy.scroll>0,JSON.stringify(copy));
    }
    assert.match(await page.locator('#expedition-dialog').evaluate(el=>getComputedStyle(el).backgroundImage),/shop\/v1\/background-alchemy\.png/);
    assert.match(await page.locator('#expedition-close').evaluate(el=>getComputedStyle(el).backgroundImage),/shop\/v1\/exit-button\.png/);
    assert.ok((await page.locator('#expedition-close').boundingBox()).width<=48);
    for(const selected of ['true','false'])assert.match(await page.locator('#shop-tabs button[aria-selected='+selected+']').evaluate(el=>getComputedStyle(el).backgroundImage),new RegExp('button-'+(selected==='true'?'navy':'paper')+'\\.png'));
    if(tab==='characters'){
     assert.equal(await page.locator('#roster-basic-stats .detail-category-value').count(),4);
     assert.ok(await page.locator('#roster-selected .shop-inspect-stars img').count()>0);
     assert.doesNotMatch(await page.locator('#roster-selected').innerText(),/[·/]/);
     const clearances=await page.evaluate(()=>({
      cards:[...document.querySelectorAll('#expedition-dialog .roster-tile.occupied')].map(el=>{const c=el.getBoundingClientRect(),last=el.querySelector('.roster-price')||el.querySelector('.roster-card-values'),r=last.getBoundingClientRect();return {gap:c.bottom-r.bottom,height:c.height};}),
      wallet:document.querySelector('.shop-sidebar').getBoundingClientRect().bottom-document.getElementById('shop-wallet').getBoundingClientRect().bottom,
      titleInset:(()=>{const s=getComputedStyle(document.querySelector('.roster-inspect'));return parseFloat(s.paddingTop)+parseFloat(s.borderTopWidth);})()
     }));
     assert.ok(clearances.cards.every(c=>c.gap>=10&&c.gap<=20),JSON.stringify(clearances));
     assert.ok(clearances.wallet>=60,JSON.stringify(clearances));
     assert.ok(clearances.titleInset>=38,JSON.stringify(clearances));
     const currencySize=await page.locator('.roster-price .roster-stat-icon').first().boundingBox();assert.ok(currencySize.width/currencySize.height<.7,'currency crystal must retain its tall proportions');
     const inspect=page.locator('.shop-inspect-content');
     assert.equal(await inspect.evaluate(el=>el.scrollHeight>el.clientHeight),true);
     await inspect.evaluate(el=>{el.scrollTop=80;});assert.ok(await inspect.evaluate(el=>el.scrollTop)>0);await inspect.evaluate(el=>{el.scrollTop=0;});
     assert.match(await page.locator('#roster-sell-zone').evaluate(el=>getComputedStyle(el).backgroundImage),/preparation\/v1\/sell-zone\.png/);
     for(const selector of ['#roster-reserve-section','.roster-row:last-child']){
      const error=await page.locator(selector+' .roster-heading').evaluate(el=>{const row=el.closest('.roster-row').querySelector('.roster-grid').getBoundingClientRect(),spark=el.querySelector('.raster-divider:not(.raster-divider-left)>i:nth-child(3)').getBoundingClientRect();return Math.abs(spark.left+spark.width/2-row.left-row.width/2);});
      assert.ok(error<1,'shop divider center drift: '+error);
     }
    }
    const sizes=await page.evaluate(()=>{
     const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
     const dialog=document.getElementById('expedition-dialog'),body=dialog.querySelector('.ui-panel-body');
     return {dialog:rect(dialog),bodyScroll:body.scrollHeight-body.clientHeight,dialogScroll:dialog.scrollHeight-dialog.clientHeight,
      title:rect(document.getElementById('expedition-title')),tabs:rect(document.getElementById('shop-tabs')),
      exit:rect(document.getElementById('expedition-close')),reroll:rect(document.getElementById('shop-reroll')),wallet:rect(document.getElementById('shop-wallet')),
      content:rect(body),sell:rect(document.getElementById('roster-sell-zone')),lawPanel:rect(document.getElementById('law-shop-panel')),
      rows:[...dialog.querySelectorAll('.roster-row')].filter(e=>!e.hidden).map(rect),
      scroll:dialog.querySelector('.roster-scroll').scrollHeight-dialog.querySelector('.roster-scroll').clientHeight,
      laws:[...dialog.querySelectorAll('.law-card')].map(rect)};
    });
    assert.equal(sizes.dialog.x,0);assert.equal(sizes.dialog.y,0);assert.equal(sizes.dialog.width,width);assert.equal(sizes.dialog.height,height);
    assert.ok(sizes.bodyScroll<=1,JSON.stringify({width,tab,...sizes}));assert.ok(sizes.dialogScroll<=1);
    assert.equal(sizes.rows.length,tab==='characters'?3:2);
    if(tab==='characters')characterLayout=sizes;
    else{
     assert.ok(Math.abs(sizes.content.y-characterLayout.content.y)<1,JSON.stringify({width,characterLayout,sizes}));
     assert.ok(Math.abs(sizes.content.height-characterLayout.content.height)<1,JSON.stringify({width,characterLayout,sizes}));
     for(let i=0;i<2;i++)assert.ok(Math.abs(sizes.rows[i].y-characterLayout.rows[i+1].y)<1,JSON.stringify({width,characterLayout,sizes}));
     assert.equal(sizes.laws[0].x,sizes.laws[1].x);assert.equal(sizes.laws[2].x,sizes.laws[3].x);
     assert.ok(sizes.laws[0].bottom<=sizes.laws[1].y&&sizes.laws[2].bottom<=sizes.laws[3].y);
    }
    if(width>=900){
     assert.ok(sizes.scroll<=1,JSON.stringify({width,tab,...sizes}));assert.ok(sizes.rows.every(r=>r.y>=0&&r.bottom<=height));
     const team=sizes.rows[0];
     assert.ok(Math.abs(team.x+team.width/2-width/2)<2,JSON.stringify(sizes));
     assert.ok(sizes.tabs.right<team.x&&sizes.exit.right<team.x&&sizes.reroll.right<team.x);
     assert.ok(sizes.title.bottom<=sizes.exit.y&&sizes.exit.bottom<=sizes.tabs.y&&sizes.tabs.bottom<=sizes.reroll.y&&sizes.reroll.bottom<=sizes.wallet.y,JSON.stringify(sizes));
     const last=sizes.rows.at(-1),top=tab==='characters'?sizes.sell:sizes.lawPanel;
     assert.ok(team.y-top.bottom<45&&team.y>=top.bottom,JSON.stringify(sizes));
     assert.ok(Math.abs(sizes.content.y-top.y)<2&&Math.abs(sizes.content.bottom-last.bottom)<40,JSON.stringify(sizes));
    }
    if(process.env.MINIMAJO_SCENE_SCREENSHOT)await page.screenshot({path:process.env.MINIMAJO_SCENE_SCREENSHOT+`-shop-${tab}-${width}.png`});
   }
  }
  await page.setViewportSize({width:1366,height:768});
  await page.locator('#shop-tab-characters').click();
  const drag=async(source,target)=>{
   const a=await source.boundingBox(),b=await target.boundingBox();
   await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
   await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:15});await page.mouse.up();
  };
  const gold=await page.evaluate(()=>sceneRun.roster.gold);
  await drag(page.locator('#roster-top .occupied').first(),page.locator('#roster-reserve .vacant').first());
  await page.waitForFunction(before=>sceneRun.roster.gold<before,gold);
  assert.equal(await page.evaluate(()=>sceneRun.roster.reserve.some(Boolean)),true);
  await page.locator('#shop-reroll').click();
  await page.locator('#shop-tab-laws').click();
  await drag(page.locator('#roster-reserve .occupied').first(),page.locator('#law-target-zone'));
  await page.locator('#law-shop-products .law-card:enabled').first().click();
  const sold=page.locator('#law-shop-products .law-card[data-sold=true]').first(),soldBox=await sold.boundingBox(),labelBox=await sold.locator('.law-sold-label').boundingBox();
  assert.ok(Math.abs(soldBox.x+soldBox.width/2-labelBox.x-labelBox.width/2)<1);
  assert.ok(Math.abs(soldBox.y+soldBox.height/2-labelBox.y-labelBox.height/2)<1);
  assert.equal(await page.evaluate(()=>sceneRun.roster.reserve.find(Boolean).laws.length),1);
  assert.equal(await page.locator('#roster-laws .shop-equipped-law').count(),1);
  assert.match(await page.locator('#roster-laws .shop-equipped-description').innerText(),/法則長篇說明/);
  // The detail portrait keeps one 4:5 size for all character footprints.
  let portraitWidth;
  for(const space of [1,2,3]){
   await page.evaluate(space=>{sceneRun.roster.reserve.find(Boolean).space=space;},space);
   await page.locator('#shop-reroll').click();
   const card=await page.locator('.law-recipient-card').boundingBox();
   const host=await page.locator('#law-target-art').boundingBox();
   assert.ok(Math.abs(card.width/card.height-.8)<.005);
   if(portraitWidth===undefined)portraitWidth=card.width;else assert.ok(Math.abs(card.width-portraitWidth)<1);
   assert.ok(Math.abs(card.x+card.width/2-host.x-host.width/2)<1);
   assert.equal(await page.locator('.law-recipient-card').getAttribute('data-space'),String(space));
   assert.equal(await page.locator('#law-target-clear').count(),0);
   assert.match(await page.locator('.law-recipient-card .character-image').getAttribute('src'),/youmeng-detail\.png/);
   if(process.env.MINIMAJO_SCENE_SCREENSHOT)await page.screenshot({path:process.env.MINIMAJO_SCENE_SCREENSHOT+`-recipient-${space}.png`});
  }
  await page.evaluate(()=>{sceneRun.roster.reserve.find(Boolean).space=1;});
  await page.locator('#expedition-close').click();
  await page.waitForFunction(()=>sceneRun.map.cleared.has(sceneShop));
  assert.equal(await page.locator('#journey-map').isVisible(),true);
  // An actual journey battle uses the iframe and returns through its result protocol.
  await page.setViewportSize({width:1366,height:768});
  const battleTarget=await page.locator('.hex-cell.reachable').first().getAttribute('aria-label');
  await page.evaluate(label=>{
   const run=sceneRun,[,q,r]=label.match(/座標 (-?\d+), (-?\d+)/);
   const [id,cell]=Object.entries(run.map.map.cells).find(([,c])=>c.q===+q&&c.r===+r);cell.type='battle';
   const enemy={...structuredClone(run.roster.active.find(Boolean)),name:'版面測試敵人',maxHp:1,attack:0,cooldown:100,effects:[],space:1};
   const board=Array(10).fill(null);board[0]=enemy;run.enemyRolls[id]={team:{name:'測試遭遇'},board};
  },battleTarget);
  await page.getByRole('button',{name:battleTarget,exact:true}).click();
  const frame=page.frameLocator('#journey-frame');await frame.locator('#play:enabled').waitFor();
  await frame.locator('#battle-gear').click();
  await page.locator('#expedition-dialog[open][data-mode=gear]').waitFor();
  const gearHeights={};
  for(const [width,height] of [[1366,768],[1920,1080]]){
   await page.setViewportSize({width,height});
   gearHeights[width]=await page.locator('#roster-bottom .occupied').first().evaluate(e=>e.getBoundingClientRect().height);
   const preparation=await page.locator('#expedition-dialog').evaluate(dialog=>{
    const body=dialog.querySelector('.ui-panel-body'),card=dialog.querySelector('#roster-bottom .occupied'),r=card.getBoundingClientRect();
    return {scroll:body.scrollHeight-body.clientHeight,ratio:r.width/Number(card.style.gridColumn.match(/span (\d+)/)[1])/r.height};
   });
   assert.ok(preparation.scroll<=1,JSON.stringify(preparation));
   assert.ok(Math.abs(preparation.ratio-134/288)<.002,JSON.stringify(preparation));
  }
  await page.keyboard.press('Escape');await frame.locator('#play:enabled').waitFor();
  for(const [width,height] of [[1366,768],[1920,1080]]){
   await page.setViewportSize({width,height});
   const sizes=await frame.locator('body').evaluate(body=>({height:innerHeight,scroll:document.documentElement.scrollHeight-innerHeight,
    arena:body.querySelector('.arena-scroll').scrollHeight-body.querySelector('.arena-scroll').clientHeight,
    cards:[...body.querySelectorAll('.units')].map(e=>{const r=e.getBoundingClientRect();return {y:r.y,bottom:r.bottom};}),
    units:[...body.querySelectorAll('.unit')].map(e=>{const r=e.getBoundingClientRect(),space=Number(e.style.gridColumn.match(/span (\d+)/)[1]);return {height:r.height,slotWidth:r.width/space};}),
    background:getComputedStyle(body).backgroundSize,
    images:[...body.querySelectorAll('.character-image')].map(e=>getComputedStyle(e).objectFit)}));
   assert.ok(sizes.scroll<=1,JSON.stringify(sizes));assert.ok(sizes.arena<=1,JSON.stringify(sizes));assert.ok(sizes.cards.every(r=>r.y>=0&&r.bottom<=sizes.height));
   assert.ok(sizes.background.split(',').every(size=>size.trim()==='cover'));assert.ok(sizes.images.length>0);assert.ok(sizes.images.every(fit=>fit==='cover'));
   for(const unit of sizes.units){
    assert.ok(Math.abs(unit.slotWidth/unit.height-134/288)<.002,JSON.stringify(unit));
    // Paper preparation has its own header/sell/footer allowance. Both scenes
    // preserve card proportions and fit their viewport, rather than equal sizes.
    assert.ok(gearHeights[width]>100&&unit.height<=288,JSON.stringify({unit,gear:gearHeights[width]}));
   }
   const controls=await frame.locator('body').evaluate(body=>{
    const rect=id=>{const r=body.querySelector('#'+id).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,cx:r.x+r.width/2,cy:r.y+r.height/2};};
    return {width:innerWidth,timer:rect('timer'),play:rect('play'),enemy:rect('enemy-units'),ally:rect('ally-units'),cast:rect('cast'),speed:rect('speed'),gear:rect('battle-gear')};
   });
   for(const key of ['timer','play','cast'])assert.ok(Math.abs(controls[key].cx-controls.width/2)<2,JSON.stringify(controls));
   assert.ok(controls.timer.bottom<=controls.play.y&&controls.play.bottom<controls.enemy.y,JSON.stringify(controls));
   assert.ok(controls.cast.y>controls.ally.bottom&&controls.cast.y-controls.ally.bottom<80,JSON.stringify(controls));
   assert.ok(Math.abs(controls.speed.cy-controls.cast.cy)<2&&Math.abs(controls.gear.cy-controls.cast.cy)<2,JSON.stringify(controls));
   assert.ok(controls.cast.right<controls.speed.x&&controls.speed.right<controls.gear.x,JSON.stringify(controls));
   if(process.env.MINIMAJO_SCENE_SCREENSHOT)await page.screenshot({path:process.env.MINIMAJO_SCENE_SCREENSHOT+`-battle-${width}.png`});
  }
  await frame.locator('#play').click();await frame.locator('#battle-result-confirm').waitFor({state:'visible'});await frame.locator('#battle-result-confirm').click();await page.locator('#reward-hub[open]').waitFor({timeout:20000});
  await page.locator('#reward-money').click();await page.locator('#reward-money-close').click();
  await page.locator('#reward-characters').click();await page.locator('#reward-options .reward-card').first().click();
  await page.locator('#reward-confirm').click();
  assert.equal(await frame.locator('#play').innerText(),'返回地圖');
  assert.equal(await frame.locator('#play').isEnabled(),true);
  await frame.locator('#play').click();
  await page.locator('#journey-map').waitFor({state:'visible'});
  assert.deepEqual(errors,[]);
  console.log('Edge: centered shop teams and ordered left sidebar, battle timer/start above enemy and centered skill with speed/gear below allies; desktop sizes, 390px shop, keyboard tabs, purchase/reroll/laws, preparation, victory and reward return passed.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
