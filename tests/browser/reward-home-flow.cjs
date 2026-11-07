// Homepage -> actual journey UI -> iframe battle -> actual reward controller.
// Only encounter/map fixture data is replaced in isolated memory, never saved data.
const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const fileMode=process.argv.includes('--file');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
  await page.addInitScript(()=>{
   let api;
   Object.defineProperty(globalThis,'Journey',{configurable:true,get:()=>api,set(value){api=value;const create=value.create;value.create=(...args)=>{const run=create(...args);globalThis.journeyRunForTest=run;return run;};}});
  });
  await page.goto(fileMode?pathToFileURL(path.resolve(__dirname,'../../index.html')).href:'http://127.0.0.1:4173/index.html');await page.locator('a.start').click();
  await page.waitForFunction(()=>!!globalThis.journeyRunForTest);
  const target=await page.locator('.hex-cell.reachable').first().getAttribute('aria-label');assert.ok(target);
  await page.evaluate(label=>{
   const run=globalThis.journeyRunForTest,[,q,r]=label.match(/座標 (-?\d+), (-?\d+)/);
   const [id,cell]=Object.entries(run.map.map.cells).find(([,c])=>c.q===Number(q)&&c.r===Number(r));
   cell.type='battle';
   const enemy=structuredClone(run.roster.active.find(Boolean));
   Object.assign(enemy,{name:'介面驗證敵人',maxHp:1,attack:0,cooldown:100,effects:[],space:1});
   const board=Array(10).fill(null);board[0]=enemy;
   run.enemyRolls[id]={team:{name:'隔離驗證遭遇'},board};
  },target);
  await page.getByRole('button',{name:target,exact:true}).click();
  const frame=page.frameLocator('#journey-frame');await frame.locator('#play:enabled').waitFor();
  await frame.locator('#speed').click();await frame.locator('#play').click();
  try{await frame.locator('#battle-result-confirm').waitFor({state:'visible'});await frame.locator('#battle-result-confirm').click();await page.locator('#reward-hub[open]').waitFor({timeout:20000});}
  catch(error){console.log(await page.evaluate(()=>({message:document.getElementById('journey-battle-status').textContent,battle:document.getElementById('journey-frame').contentDocument.body.innerText,encounter:journeyRunForTest.encounter,rolls:journeyRunForTest.enemyRolls})));throw error;}
  await page.locator('#reward-characters').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#reward-options img')].every(i=>i.complete&&i.naturalWidth));
  const formal=await page.locator('.reward-card').evaluateAll(cards=>cards.map(c=>{
   const heading=c.querySelector('.roster-card-heading'),name=c.querySelector('.roster-name'),values=c.querySelector('.roster-card-values');
   return {nameCentered:getComputedStyle(name).textAlign==='center',line:getComputedStyle(heading,'::after').content,diamond:getComputedStyle(heading,'::before').content,statDivider:getComputedStyle(values,'::after').content,colors:[...c.querySelectorAll('[data-card-icon]')].map(e=>getComputedStyle(e,'::before').backgroundColor),sources:[...c.querySelectorAll('.reward-symbol img')].map(i=>i.getAttribute('src'))};
  }));
  assert.equal(formal.length,3);
  for(const card of formal){assert.ok(card.nameCentered);assert.equal(card.line,'""');assert.equal(card.diamond,'""');assert.equal(card.statDivider,'""');assert.deepEqual(card.colors,['rgb(216, 196, 161)','rgb(216, 196, 161)','rgb(199, 143, 130)','rgb(131, 169, 185)']);for(const src of card.sources)assert.ok(src.startsWith('assets/ui/card-icons/approved-v1/'));}
  assert.equal(await page.locator('.icon-palette-preview').count(),0);
  await page.locator('.reward-card').first().click();
  const screenshot=await page.screenshot({path:path.resolve(__dirname,'../../tmp/browser/icons-color-study-v5/home-journey-reward'+(fileMode?'-file':'')+'.png'),fullPage:true});
  const regions=await page.locator('.reward-card').first().evaluate(c=>{
   const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
   return {card:rect(c),health:rect(c.querySelector('[data-card-icon=health]')),attack:rect(c.querySelector('[data-card-icon=attack]'))};
  });
  const painted=await page.evaluate(async({uri,regions})=>{
   const image=new Image();image.src=uri;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
   const counts={};for(const [key,color] of [['health',[199,143,130]],['attack',[131,169,185]]]){const r=regions[key],pixels=ctx.getImageData(Math.floor(r.x),Math.floor(r.y),Math.ceil(r.width),Math.ceil(r.height)).data;let n=0;for(let i=0;i<pixels.length;i+=4)if(color.every((v,j)=>Math.abs(pixels[i+j]-v)<25))n++;counts[key]=n;}
   const r=regions.card,center=ctx.getImageData(Math.floor(r.x+r.width/2),Math.floor(r.y+70),1,1).data;return {...counts,windowVisible:center[0]<80&&center[2]<130};
  },{uri:'data:image/png;base64,'+screenshot.toString('base64'),regions});
  assert.ok(painted.windowVisible);assert.ok(painted.health>2,JSON.stringify(painted));assert.ok(painted.attack>2,JSON.stringify(painted));
  await page.locator('#reward-confirm').click();await page.locator('#reward-money').click();await page.locator('#reward-money-close').click();
  assert.equal(await page.locator('#journey-reward[open]').count(),0);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  console.log(JSON.stringify({entry:fileMode?'file://index.html':'http://index.html',realBattle:true,realSettlement:true,rewardCards:formal.length,approvedPalette:true,painted,claim:true,errors,failed},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
