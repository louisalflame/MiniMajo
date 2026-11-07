// Render actual play.html styles/markup with an isolated in-memory reward fixture.
const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],failed=[],results=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
  await page.goto('http://127.0.0.1:4173/play.html');
  await page.waitForFunction(()=>!!globalThis.JourneyRewardUI);
  await page.evaluate(()=>{
   // Remove original journey listeners from cloned reward dialogs only.
   for(const id of ['journey-reward','reward-hub','reward-money-dialog']){const e=document.getElementById(id);e.replaceWith(e.cloneNode(true));}
   let reward={token:'approved-icons-fixture',gold:40,choices:['人類','機人','獸人'].map((race,i)=>({name:['伊莎貝拉','珍妮','蓓拉綺'][i],job:'破陣',race,affinity:['物理','魔法','精神'][i],rarity:['SR','SSR','UR'][i],space:i+1,stars:i+2,maxHp:120+i*30,attack:30+i*15,imageFile:'',effects:[],description:'僅供正式配色回歸的記憶體範例。'}))};
   JourneyRewardUI.create({document,describeEffect:()=>'',getReward:()=>reward,claim:()=>{reward=null;return {};},openPreparation:()=>{},onClaim:()=>{}}).show();
  });
  await page.locator('#reward-characters').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#reward-options img')].every(i=>i.complete&&i.naturalWidth));
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:width===390?844:1000});
   const cards=await page.locator('.reward-card').evaluateAll(cards=>cards.map(c=>({
    icons:[...c.querySelectorAll('[data-card-icon]')].map(e=>{const s=getComputedStyle(e,'::before');return {color:s.backgroundColor,width:s.width,height:s.height,mask:s.maskImage};}),
    sources:[...c.querySelectorAll('.reward-symbol img')].map(i=>i.getAttribute('src'))
   })));
   for(const card of cards){
    assert.deepEqual(card.icons.map(i=>i.color),['rgb(216, 196, 161)','rgb(216, 196, 161)','rgb(199, 143, 130)','rgb(131, 169, 185)']);
    assert.equal(new Set(card.icons.map(i=>i.width+'x'+i.height)).size,1);
    for(const icon of card.icons)assert.match(icon.mask,/assets\/ui\/card-icons\/approved-v1/);
    for(const src of card.sources)assert.ok(src.startsWith('assets/ui/card-icons/approved-v1/'));
   }
   assert.equal(await page.locator('.icon-palette-preview').count(),0);
   await page.locator('.reward-card').nth(1).click();
   await page.screenshot({path:path.resolve(__dirname,'../../tmp/browser/icons-color-study-v5/approved-'+width+'.png'),fullPage:true});
   results.push({width,approvedPalette:true,equalSizes:true,candidateAssets:false});
  }
  await page.locator('#reward-confirm').click();await page.locator('#reward-money').click();await page.locator('#reward-money-close').click();
  assert.equal(await page.locator('dialog[open]').count(),0);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  console.log(JSON.stringify({results,claim:true,errors,failed},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
