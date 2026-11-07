// Memory-only units use the actual card and detail renderers in all four contexts.
const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tmp/browser/card-stars-v2');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'content-type':({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream'});res.end(err?'Not found':data);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage(),errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [1440,390])for(const mode of ['battle','gear','shop','reward'])for(const job of ['破陣','飛襲','守護','支援']){
   await page.setViewportSize({width,height:1000});await page.goto(`http://127.0.0.1:${server.address().port}/${mode==='battle'?'battle.html?preview=1':mode==='reward'?'play.html':'play.html'}`);
   await page.evaluate(({mode,job})=>{
    const levels={'破陣':[1,3,6],'飛襲':[2,4,5],'守護':[3,6,1],'支援':[6,1,3]}[job];
    const units=['SR','SSR','UR'].map((rarity,i)=>({...ItemDB.defaults[i],name:['長名字晨霧劍士','月影旅人','沉默守望者'][i],job,rarity,space:i+1,imageFile:['qingqing-1slot.png','youmeng-1slot.png','budi-1slot.png'][i],stars:levels[i],cooldown:120,effects:[],instanceId:'stars-'+i,laws:[]}));
    const row=[units[0],units[1],null,units[2],null,null,...Array(4).fill(null)];
    if(mode==='battle')dispatchEvent(new MessageEvent('message',{source:parent,data:{type:'minimajo-preview',loadouts:[row,row],skills:[],limits:[10,10]}}));
    else if(mode==='reward'){const reward={token:'star-preview',gold:40,choices:units};const c=JourneyRewardUI.create({document,describeEffect:()=>'',getReward:()=>reward,claim:()=>{},openPreparation:()=>{},onClaim:()=>{}});c.show();document.getElementById('reward-characters').click();}
    else{const s=Expedition.create(ItemDB.defaults,[],GameConfig.defaults);s.active=row;ExpeditionUI.bind(s);ExpeditionUI.open(mode,'stars');}
   },{mode,job});
   const selector=mode==='battle'?'#ally-units>[data-card-skin]':mode==='reward'?'#reward-options>.reward-card':'#roster-bottom>[data-card-skin]';
   await page.locator(selector).first().waitFor();await page.waitForFunction(selector=>[...document.querySelectorAll(selector+' img')].every(i=>i.complete&&i.naturalWidth>0)&&[...document.querySelectorAll(selector)].every(c=>c.dataset.starLayout==='ready'),selector);
   const windowChecks=await page.locator(selector).evaluateAll(async cards=>Promise.all(cards.map(async c=>{
    const img=new Image(),file=c.querySelector('.reward-card-frame').getAttribute('src').replace('.png','-window.png');img.src=RewardMaskAssets.resolve(file);await img.decode();
    const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,img.width,img.height).data,r=c.getBoundingClientRect(),failures=[];
    for(const star of c.querySelectorAll('.card-star-column img')){const b=star.getBoundingClientRect();for(const x of [b.left+.1,(b.left+b.right)/2,b.right-.1])for(const y of [b.top+.1,(b.top+b.bottom)/2,b.bottom-.1]){const ix=Math.max(0,Math.min(img.width-1,Math.floor((x-r.x)/r.width*img.width))),iy=Math.max(0,Math.min(img.height-1,Math.floor((y-r.y)/r.height*img.height))),p=(iy*img.width+ix)*4;if(data[p]*data[p+3]/255<=245)failures.push({ix,iy});}}
    return {job:c.dataset.frameJob,rarity:c.dataset.rarity,failures};
   })));
   for(const check of windowChecks)assert.deepEqual(check.failures,[],JSON.stringify({width,mode,check}));
   const cards=await page.locator(selector).evaluateAll(cards=>cards.map(c=>{const r=c.getBoundingClientRect(),col=c.querySelector('.card-star-column'),stars=[...col.querySelectorAll('img')],boxes=stars.map(n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height};}),name=c.querySelector('.roster-name');return {count:stars.length,label:col.getAttribute('aria-label'),images:stars.map(i=>i.getAttribute('src')),boxes,card:{x:r.x,y:r.y,w:r.width,h:r.height},headingHasStars:!!c.querySelector('.roster-card-heading .roster-stars'),hudTextRight:name.getBoundingClientRect().right,hpTop:c.querySelector('.hp-meter')?.getBoundingClientRect().top,nameWidth:name.clientWidth,starBorder:getComputedStyle(col).borderLeftWidth};}));
   for(const [i,c]of cards.entries()){
    assert.equal(c.count,{'破陣':[1,3,6],'飛襲':[2,4,5],'守護':[3,6,1],'支援':[6,1,3]}[job][i]);assert.equal(c.label,c.count+' 星');assert.equal(c.headingHasStars,false);assert.ok(c.nameWidth>0);assert.equal(c.starBorder,'0px');
    for(const [n,b]of c.boxes.entries()){assert.equal(c.images[n],'assets/ui/card-icons/approved-v1/star.png');assert.ok(b.x>c.card.x+c.card.w/2&&b.x+b.w<c.card.x+c.card.w);assert.ok(c.hudTextRight<=b.x+.1,JSON.stringify({width,mode,job,c,b}));assert.ok(b.y>c.card.y&&b.y+b.h<c.card.y+c.card.h);if(c.hpTop)assert.ok(b.y+b.h<c.hpTop,JSON.stringify({width,job,c,b}));if(n){assert.ok(b.y>=c.boxes[n-1].y+c.boxes[n-1].h);assert.ok(Math.abs(b.x-c.boxes[0].x)<1);}}
   }
   if(mode==='battle'&&job==='支援'){
    await page.evaluate(()=>{const c=document.querySelector('#ally-units>[data-card-skin]'),s=c.querySelector('.unit-status');for(let i=0;i<8;i++){const b=document.createElement('span');b.className='unit-status-badge';b.textContent='8';b.append(UIIcons.create(document,'status'));s.append(b);}});
    assert.equal(await page.locator(selector).first().evaluate(c=>{const star=c.querySelector('.card-star-column').getBoundingClientRect();return [...c.querySelectorAll('.unit-status-badge')].some(n=>{const r=n.getBoundingClientRect();return r.left<star.right&&r.right>star.left&&r.top<star.bottom&&r.bottom>star.top;});}),false,'statuses must avoid the six-star rail');
    await page.screenshot({path:path.join(out,`${width}-battle-six-star-status.png`),fullPage:true});
   }
   if(job==='破陣'||job==='支援')await page.screenshot({path:path.join(out,`${width}-${mode}${job==='支援'?'-six-star-narrow':''}.png`),fullPage:true});
   if(mode==='reward'){
    const skin=await page.evaluate(()=>({title:getComputedStyle(document.querySelector('#journey-reward>.ui-panel-title')).backgroundImage,button:getComputedStyle(document.getElementById('reward-confirm')).backgroundImage}));assert.match(skin.title,/title-plaque-v3.png/);assert.match(skin.button,/capsule-button-v3.png/);assert.ok(!skin.title.includes('gradient')&&!skin.button.includes('gradient'));
    if(width===1440&&job==='破陣'){await page.locator(selector).nth(1).click();await page.screenshot({path:path.join(out,'approved-reward.png')});}
   }
   if(mode==='battle'||mode==='gear'){
    await page.locator(selector).nth(2).click();await page.locator('#character-detail[open]').waitFor();
    const detail=await page.locator('#detail-stars').evaluate(n=>({label:n.getAttribute('aria-label'),src:[...n.children].map(i=>i.getAttribute('src')),width:n.getBoundingClientRect().width,plate:n.parentElement.getBoundingClientRect().width}));const expected={'破陣':6,'飛襲':5,'守護':1,'支援':3}[job];assert.equal(detail.label,expected+' 星');assert.equal(detail.src.length,expected);assert.ok(detail.src.every(s=>s==='assets/ui/card-icons/approved-v1/star.png'));assert.ok(detail.width<detail.plate);
    if(job==='破陣')await page.screenshot({path:path.join(out,`${width}-${mode}-detail.png`)});await page.keyboard.press('Escape');
   }
   results.push({width,mode,job,cards:cards.length,passed:true});
  }
  await page.setViewportSize({width:1440,height:1000});await page.goto(`http://127.0.0.1:${server.address().port}/play.html`);
  await page.evaluate(()=>{const s=Expedition.create(ItemDB.defaults,[],GameConfig.defaults);s.active=Array(10).fill(null);['破陣','飛襲','守護','支援'].forEach((job,i)=>s.active[i*2]={...ItemDB.defaults[0],name:job,job,stars:6,space:1,rarity:'SSR',imageFile:['qingqing-1slot.png','youmeng-1slot.png','grenna-1slot.png','budi-1slot.png'][i],instanceId:'frame-star-'+i,laws:[]});ExpeditionUI.bind(s);ExpeditionUI.open('gear','frame-top-comparison');});
  await page.waitForFunction(()=>[...document.querySelectorAll('#roster-bottom>[data-card-skin]')].every(c=>c.dataset.starLayout==='ready')&&[...document.querySelectorAll('#roster-bottom img')].every(i=>i.complete&&i.naturalWidth));await page.locator('#roster-bottom').screenshot({path:path.join(out,'four-job-frame-tops.png')});
  await page.goto('file:///'+path.join(root,'battle.html').replaceAll('\\','/')+'?preview=1');
  await page.evaluate(()=>{const row=Array(10).fill(null);['破陣','飛襲','守護','支援'].forEach((job,i)=>row[i*2]={...ItemDB.defaults[0],job,stars:6,space:1,rarity:'SSR',effects:[]});dispatchEvent(new MessageEvent('message',{source:parent,data:{type:'minimajo-preview',loadouts:[row,row],skills:[],limits:[10,10]}}));});
  await page.waitForFunction(()=>document.querySelectorAll('#ally-units>[data-star-layout=ready]').length===4);await page.screenshot({path:path.join(out,'file-frame-stars.png')});
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2)+'\n');console.log(`Chrome: ${results.length} context/job/viewport cases, ${results.length*3} cards, 1-6 stars including six-star narrow cards/status clearance, details share PNG.`);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
