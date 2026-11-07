// Read-only isolated file:// browser fixture. Does not touch fixed data or user tabs.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tmp/browser/status-icons-cutouts-v1/applied');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const fixed=JSON.parse(fs.readFileSync(path.join(root,'minimajo-editor.json'))),before=fs.readFileSync(path.join(root,'minimajo-editor.json'));
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/ui/status-icons/v1/manifest.json'))),browser=await chromium.launch({headless:true,channel:'chrome'}),results=[];
 try{for(const [width,height]of [[1920,1080],[1366,768],[1280,600],[390,844]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   let current;Object.defineProperty(window,'Battle',{configurable:true,get:()=>current,set(value){current=value;const original=value.create;value.create=(...args)=>{const state=original(...args);window.statusIconFixture=state;return state;};}});
  });
  await page.goto(pathToFileURL(path.join(root,'battle.html')).href+'?preview=1');await page.waitForFunction(()=>window.Battle&&window.ItemDB&&window.Statuses&&window.CharacterDetails);
  await page.evaluate(({statuses,ids})=>{
   Statuses.configure(statuses);
   const one={...ItemDB.defaults[0],name:'青青',imageFile:'qingqing-1slot.png',detailImageFile:'qingqing-detail.png',maxHp:1000,space:1,cooldown:100,effects:[]};
   const two={...one,name:'兩格試看',space:2},three={...one,name:'三格試看',space:3};
   window.dispatchEvent(new MessageEvent('message',{source:parent,data:{type:'minimajo-preview',loadouts:[[one,two,null,three,...Array(6).fill(null)],[{...one,name:'敵方試看'},...Array(9).fill(null)]],skills:[],limits:[10,10]}}));
   const units=statusIconFixture.teams[0].units;
   for(let i=0;i<units.length;i++)if(units[i])for(const kind of ids.slice(0,[6,12,22][i]??22)){
    Statuses.apply(units[i],{status:kind,duration:Statuses.normalizeDuration(kind,{kind:'seconds',value:20})},3,0);
   }
  },{statuses:fixed.data.statuses,ids:manifest.files.map(f=>f.id)});
  await page.locator('#play').click();await page.locator('#play').click();
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.unit-status .status-art-icon img')].map(i=>i.decode())));
  const badges=await page.locator('#ally-units .status-art-icon img').evaluateAll(list=>list.map(i=>({loaded:i.complete&&i.naturalWidth===256,filter:getComputedStyle(i).filter,width:i.getBoundingClientRect().width})));
  assert.equal(badges.length,40);assert.ok(badges.every(i=>i.loaded&&i.filter==='none'&&i.width>=10));
  const cards=page.locator('#ally-units .unit');await page.screenshot({path:path.join(out,'battle-'+width+'.png')});
  const horizontal=await cards.evaluateAll(cards=>cards.map(card=>{
   const frame=card.getBoundingClientRect(),heading=card.querySelector('.unit-heading-area').getBoundingClientRect(),badges=[...card.querySelectorAll('.unit-status-badge')].map(n=>n.getBoundingClientRect());
   return {left:frame.left,right:frame.right,innerLeft:heading.left,innerRight:heading.right,badgeLeft:Math.min(...badges.map(b=>b.left)),badgeRight:Math.max(...badges.map(b=>b.right))};
  }));
  assert.ok(horizontal.every(r=>r.badgeLeft>=r.innerLeft-.5&&r.badgeRight<=r.innerRight+.5),JSON.stringify(horizontal));
  // A paused battle still recomputes inset bounds when the viewport changes.
  await page.setViewportSize({width:width===390?560:width-100,height});
  await page.waitForFunction(()=>[...document.querySelectorAll('#ally-units .unit')].every(card=>{const h=card.querySelector('.unit-heading-area').getBoundingClientRect();return [...card.querySelectorAll('.unit-status-badge')].every(b=>{const r=b.getBoundingClientRect();return r.left>=h.left-.5&&r.right<=h.right+.5;});}));
  await page.setViewportSize({width,height});
  await page.waitForFunction(()=>[...document.querySelectorAll('#ally-units .unit')].every(card=>{const h=card.querySelector('.unit-heading-area').getBoundingClientRect();return [...card.querySelectorAll('.unit-status-badge')].every(b=>{const r=b.getBoundingClientRect();return r.left>=h.left-.5&&r.right<=h.right+.5;});}));
  // Multirow statuses remain above the existing name, never displacing meters.
  const layout=await cards.last().evaluate(card=>{const name=card.querySelector('.roster-card-heading').getBoundingClientRect(),badges=[...card.querySelectorAll('.unit-status-badge')].map(n=>n.getBoundingClientRect());return {cardTop:card.getBoundingClientRect().top,nameTop:name.top,minTop:Math.min(...badges.map(b=>b.top)),maxBottom:Math.max(...badges.map(b=>b.bottom)),rows:new Set(badges.map(b=>Math.round(b.top))).size};});
  assert.ok(layout.maxBottom<=layout.nameTop+1);assert.ok(layout.minTop>=0,JSON.stringify(layout));assert.ok(layout.rows>1);
  assert.equal(await page.locator('#ally-units .reward-card-surface .unit-status').count(),0,'status overlays are not clipped by the portrait mask');
  await cards.last().scrollIntoViewIfNeeded();await cards.last().click();await page.locator('#character-detail[open]').waitFor();
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('#detail-statuses img')].map(i=>i.decode())));
  assert.equal(await page.locator('#detail-statuses .status-art-icon img').count(),22);assert.ok((await page.locator('#detail-statuses').innerText()).includes('永久'));
  assert.ok((await page.locator('#detail-statuses').innerText()).includes('次敵方普通攻擊'));assert.equal(await page.locator('#detail-stats dd').count(),17);
  await page.evaluate(()=>{const content=document.querySelector('.detail-content'),section=document.querySelector('#detail-state-section');content.scrollTop+=section.getBoundingClientRect().top-content.getBoundingClientRect().top-4;});
  await page.screenshot({path:path.join(out,'detail-'+width+'.png')});
  // An unknown ID remains visible; failures of approved files fall back to SVG.
  await page.evaluate(()=>{const icon=UIIcons.createStatus(document,'power');document.body.append(icon);icon.querySelector('img').dispatchEvent(new Event('error'));if(!icon.querySelector('svg'))throw Error('Missing failed-image fallback');icon.remove();});
  assert.deepEqual(errors,[]);results.push({width,height,badges:badges.length,detailIcons:22,layout,horizontal,errors});await page.close();
 }
 assert.ok(fs.readFileSync(path.join(root,'minimajo-editor.json')).equals(before));fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(results,null,2)+'\n');console.log('Chrome file://: 1920/1366/1280/390px battle and details; inner-frame horizontal bounds for all footprints, paused resize, upward wrap, permanent labels and failed-image fallback passed; fixed JSON unchanged.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
