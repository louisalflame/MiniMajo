// Isolated fixtures use the actual renderers; no editor or journey data is saved.
const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),output=path.join(root,'tmp/browser/card-rollout');
const boardOnly=process.env.MINIMAJO_SKIN_BOARD_ONLY==='1';
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'content-type':types[path.extname(file)]||'application/octet-stream'});res.end(err?'Not found':data);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage(),errors=[],failed=[],results=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
  for(const width of [1440,390])for(const mode of ['gear','shop','battle']){
   await page.setViewportSize({width,height:1000});
   for(const job of ['破陣','飛襲','守護','支援']){
    await page.goto('http://127.0.0.1:'+server.address().port+'/'+(mode==='battle'?'battle.html?preview=1':'play.html'));
    await page.evaluate(({mode,job})=>{
     const units=['SR','SSR','UR'].map((rarity,i)=>({...ItemDB.defaults[i],name:['晨霧劍士','月影旅人','沉默守望者'][i],job,rarity,space:i+1,imageFile:'',stars:i+1,cooldown:.2,effects:[{type:'damage',amount:11,range:10}]}));
     const row=[units[0],units[1],null,null,null,null,null,units[2],null,null];
     if(mode==='battle')window.dispatchEvent(new MessageEvent('message',{source:parent,data:{type:'minimajo-preview',loadouts:[row,row],skills:[],limits:[10,10]}}));
     else{const s=Expedition.create(ItemDB.defaults,[],GameConfig.defaults);s.active=row.map(u=>u?{...u,instanceId:'test-'+u.rarity,laws:[]}:null);ExpeditionUI.bind(s);ExpeditionUI.open(mode,'skin-test');}
    },{mode,job});
    await page.locator('[data-card-skin]').first().waitFor();
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-card-skin] img')].every(i=>i.complete&&i.naturalWidth>0));
    const board=await page.locator(mode==='battle'?'#ally-units':'#roster-bottom').evaluate(host=>{
     const style=getComputedStyle(host),tiles=[...host.children].filter(c=>c.matches('.unit,.empty-slot,.roster-tile')).sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left);
     return {gap:style.columnGap,background:getComputedStyle(host,'::before').backgroundImage,touching:tiles.every((c,i)=>!i||Math.abs(tiles[i-1].getBoundingClientRect().right-c.getBoundingClientRect().left)<.1),empties:tiles.filter(c=>c.matches('.empty-slot,.vacant')).map(c=>({border:getComputedStyle(c).borderTopWidth,color:getComputedStyle(c).backgroundColor}))};
    });
    assert.equal(board.gap,'0px');assert.match(board.background,/slate-ten-slots-thin-v2\.png/);assert.ok(board.touching);for(const empty of board.empties){assert.equal(empty.border,'0px');assert.equal(empty.color,'rgba(0, 0, 0, 0)');}
    // Check the actual PNG at the entire card area's outer boundary. A larger
    // CSS rectangle alone misses transparent corner/rail padding in the art.
    const coverage=await page.locator(mode==='battle'?'#ally-units':'#roster-bottom').evaluate(async host=>{
     const r=host.getBoundingClientRect(),s=getComputedStyle(host,'::before'),left=parseFloat(s.left),right=parseFloat(s.right),top=parseFloat(s.top),bottom=parseFloat(s.bottom);
     const image=new Image();image.src=s.backgroundImage.match(/url\(["']?(.*?)["']?\)/)[1];await image.decode();
     const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
     const width=r.width-left-right,height=r.height-top-bottom;
     const points=[[0,0],[r.width,0],[0,r.height],[r.width,r.height],[r.width/2,0],[r.width/2,r.height],[0,r.height/2],[r.width,r.height/2]];
     const sizes=s.backgroundSize.split(' '),renderWidth=width*parseFloat(sizes[0])/100,renderHeight=height*parseFloat(sizes[1])/100,offsetX=(width-renderWidth)*parseFloat(s.backgroundPositionX)/100,offsetY=(height-renderHeight)*parseFloat(s.backgroundPositionY)/100;
     return points.map(([x,y])=>{const ix=Math.floor((x-left-offsetX)/renderWidth*image.width),iy=Math.floor((y-top-offsetY)/renderHeight*image.height);return ix<0||iy<0||ix>=image.width||iy>=image.height?0:ctx.getImageData(ix,iy,1,1).data[3];});
    });assert.ok(coverage.every(alpha=>alpha>=250),JSON.stringify({mode,width,job,coverage}));
    if(mode==='battle')assert.ok(await page.evaluate(()=>document.body.getBoundingClientRect().height>=innerHeight));
    const cards=await page.locator(mode==='battle'?'#ally-units>[data-card-skin]':'#roster-bottom>[data-card-skin]').evaluateAll(cards=>cards.map(c=>{
     const r=c.getBoundingClientRect(),h=c.querySelector('.roster-card-hud'),hr=h.getBoundingClientRect();
     return {job:c.dataset.frameJob,rarity:c.dataset.rarity,width:r.width,height:r.height,stats:c.querySelectorAll('.roster-card-values>*').length,icons:c.querySelectorAll('.roster-card-heading>.reward-symbol').length,mask:getComputedStyle(c.querySelector('.reward-card-surface')).maskImage,hudFits:hr.top>=r.top&&hr.bottom<=r.bottom+1,nameFits:c.querySelector('.roster-name').clientWidth>0};
    }));
    assert.equal(cards.length,3);assert.deepEqual(cards.map(c=>c.rarity),['SR','SSR','UR']);
    for(const [i,c] of cards.entries()){assert.equal(c.job,{'破陣':'melee','飛襲':'ranged','守護':'tank','支援':'healer'}[job]);assert.equal(c.stats,2);assert.equal(c.icons,2);assert.match(c.mask,/-window\.png/);assert.ok(c.hudFits,JSON.stringify({mode,width,c}));assert.ok(c.nameFits);assert.ok(Math.abs(c.width/c.height-((i+1)*134)/288)<.001);}
    if(job==='破陣')await page.screenshot({path:path.join(output,mode+'-'+width+'.png'),fullPage:true});
    if(job==='破陣'&&width===390){const scroll=page.locator(mode==='battle'?'.arena-scroll':'.roster-scroll');await scroll.evaluate(e=>e.scrollLeft=e.scrollWidth);await page.screenshot({path:path.join(output,mode+'-right-edge-390.png'),fullPage:true});await scroll.evaluate(e=>e.scrollLeft=0);}
    results.push({mode,width,job,cards:cards.length});
    if(mode==='battle'&&!boardOnly){
     await page.locator('#play').click();await page.waitForTimeout(300);await page.locator('#play').click();
     assert.ok(await page.locator('.hp-meter').evaluateAll(meters=>meters.some(e=>Number(e.getAttribute('aria-valuenow'))<Number(e.getAttribute('aria-valuemax')))));
     const layout=await page.evaluate(()=>{
      const c=document.querySelector('#ally-units>[data-card-skin]'),name=c.querySelector('.roster-card-heading'),before=name.getBoundingClientRect().top,status=c.querySelector('.unit-status');
      status.replaceChildren(...Array.from({length:13},(_,i)=>{const b=document.createElement('span');b.className='unit-status-badge';b.dataset.testIndex=i;b.append(UIIcons.create(document,'status'));return b;}));
      const badges=[...status.children].map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,bottom:r.bottom};});
      const hp=c.querySelector('.hp-meter').getBoundingClientRect(),stagger=c.querySelector('.stagger').getBoundingClientRect(),values=c.querySelector('.roster-card-values').getBoundingClientRect();
      return {fixed:before===name.getBoundingClientRect().top,badges,nameTop:before,hp,stagger,values,fill:getComputedStyle(c.querySelector('.hp-meter>.meter-fill')).backgroundColor,posture:getComputedStyle(c.querySelector('.stagger>.meter-fill')).backgroundColor};
     });
     assert.ok(layout.fixed);assert.ok(layout.hp.bottom<=layout.stagger.top&&layout.stagger.bottom<=layout.values.top);assert.ok(layout.badges.every(b=>b.bottom<layout.nameTop));
     assert.ok(layout.badges[0].y>layout.badges.at(-1).y);assert.equal(layout.fill,'rgb(167, 71, 67)');assert.equal(layout.posture,'rgb(136, 124, 107)');
     if(job==='破陣')await page.screenshot({path:path.join(output,'battle-status-'+width+'.png'),fullPage:true});
     await page.locator('#ally-units>[data-card-skin]').first().click();await page.locator('#character-detail[open]').waitFor();await page.keyboard.press('Escape');
     await page.evaluate(()=>{
      const units=['SR','SSR','UR'].map((rarity,i)=>({...ItemDB.defaults[i],job:document.querySelector('#ally-units>[data-card-skin]').dataset.frameJob==='healer'?'支援':{'melee':'破陣','ranged':'飛襲','tank':'守護'}[document.querySelector('#ally-units>[data-card-skin]').dataset.frameJob],rarity,space:i+1,maxHp:1,cooldown:120,effects:[]}));
      const row=[units[0],units[1],null,units[2],null,null,...Array(4).fill(null)];
      window.dispatchEvent(new MessageEvent('message',{source:parent,data:{type:'minimajo-preview',loadouts:[row,row],skills:[],limits:[10,10],config:{...GameConfig.defaults,battleSeconds:1,overtimePulse:1,overtimeDamage:10000}}}));
     });
     await page.locator('#play').click();await page.locator('#battle-stats').waitFor({state:'visible'});
     assert.equal(await page.locator('#ally-units>.empty-slot').count(),10);assert.match(await page.locator('#ally-units').evaluate(e=>getComputedStyle(e,'::before').backgroundImage),/slate-ten-slots-thin-v2\.png/);
     await page.locator('#battle-stats').click();
     const totals=await page.locator('#ally-units>[data-card-skin]').evaluateAll(cards=>cards.map(c=>{
      const r=c.getBoundingClientRect(),n=c.querySelector('.roster-card-heading').getBoundingClientRect(),t=c.querySelector('.battle-totals').getBoundingClientRect();
      return {gap:n.top-t.bottom,center:Math.abs((t.left+t.right)/2-(n.left+n.right)/2),top:t.top-r.top,rows:c.querySelector('.battle-totals').children.length,statusHidden:c.querySelector('.unit-status').hidden};
     }));
     for(const c of totals){assert.equal(c.rows,4);assert.ok(c.gap>=5&&c.gap<=7,JSON.stringify(c));assert.ok(c.center<1);assert.ok(c.top>10,JSON.stringify({width,job,c}));assert.ok(c.statusHidden);}
     if(job==='破陣'||job==='支援')await page.screenshot({path:path.join(output,'battle-stats-'+({'破陣':'melee','支援':'healer'}[job])+'-'+width+'.png'),fullPage:true});

    }else if(mode!=='battle'){
     await page.locator('#roster-bottom>[data-card-skin]').first().click();
     if(mode==='shop')assert.ok(await page.locator('.roster-price').count());
    }
    assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k!=='minimajo.schema')),[]);
   }
  }
  // Verify that the shared skin also works when launched through the local homepage.
  await page.goto('file:///'+path.join(root,'battle.html').replaceAll('\\','/'));
  await page.waitForFunction(()=>document.querySelector('[data-card-skin]'));
  assert.match(await page.locator('.reward-card-surface').first().evaluate(e=>getComputedStyle(e).maskImage),/data:image\/png/);
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  console.log(JSON.stringify({scenarios:results.length,cards:results.length*3,boardOnly,pageErrors:errors,failedRequests:failed,fileMasks:true},null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
