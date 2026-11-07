// Isolated runtime fixtures; never edits fixed JSON or production art assignments.
const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),out=path.resolve(root,process.env.MINIMAJO_DETAIL_OUT||'tmp/browser/character-details-raster-v1/applied');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'content-type':({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream'});res.end(err?'Not found':data);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:'chrome'});const results=[];
 try{
  const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [width,height]of [[1440,1000],[1366,768],[390,844]])for(const mode of ['battle','gear']){
   await page.setViewportSize({width,height});await page.goto(`http://127.0.0.1:${server.address().port}/${mode==='battle'?'battle.html?preview=1':'play.html'}`);
   await page.waitForFunction(()=>window.CharacterDetails&&window.ItemDB&&window.ExpeditionUI!==null);
   await page.evaluate(mode=>{
    const unit={...ItemDB.defaults[0],name:'青青',stars:3,imageFile:'qingqing-1slot.png',cooldown:120,description:'回復生命最低的同伴。\n並賦予短暫護盾。'};
    if(mode==='battle')window.dispatchEvent(new MessageEvent('message',{source:parent,data:{type:'minimajo-preview',loadouts:[[unit,...Array(9).fill(null)],[unit,...Array(9).fill(null)]],skills:[],limits:[10,10]}}));
    else{const state=Expedition.create(ItemDB.defaults.map((u,i)=>i?u:unit),[]);ExpeditionUI.bind(state);ExpeditionUI.open('gear');}
   },mode);
   await page.locator(mode==='battle'?'#ally-units .unit':'#roster-bottom .occupied').first().click();
   await page.locator('#character-detail[open]').waitFor();
   await page.waitForFunction(()=>{const i=document.querySelector('#detail-art img');return i?.naturalWidth>0&&!i.hidden;});
   await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#character-detail img')].map(i=>i.decode()));});
   const measure=()=>page.evaluate(()=>{const d=document.querySelector('#character-detail'),c=d.querySelector('.detail-content'),p=d.querySelector('.detail-card'),r=d.getBoundingClientRect(),pr=p.getBoundingClientRect(),s=getComputedStyle(c);return {dialog:{x:r.x,y:r.y,w:r.width,h:r.height},portrait:{x:pr.x,y:pr.y},scroll:c.scrollHeight-c.clientHeight,overflow:c.scrollWidth-c.clientWidth,columns:s.gridTemplateColumns,lawColumn:getComputedStyle(document.querySelector('#detail-law-section')).gridColumn,stateHidden:document.querySelector('#detail-state-section').hidden,category:[...document.querySelectorAll('.detail-category-value')].map(n=>n.textContent),frame:getComputedStyle(d.querySelector('.detail-portrait'),'::after').borderImageSource,paper:getComputedStyle(d,'::before').borderImageSource};});
   const initial=await measure();assert.ok(initial.dialog.x>=0&&initial.dialog.x+initial.dialog.w<=width+1);assert.ok(initial.dialog.y>=24&&initial.dialog.y+initial.dialog.h<=height+1);assert.ok(initial.overflow<=1);assert.equal(initial.category.length,4);assert.match(initial.frame,/character-details\/v1\/portrait-frame-v1.png/);assert.match(initial.paper,/parchment-panel-v2.png/);
   const icons=await page.locator('#detail-stats .detail-stat-icon').evaluateAll(nodes=>nodes.map(n=>({kind:n.dataset.detailIcon,loaded:n.naturalWidth>0,decorative:n.alt===''&&n.getAttribute('aria-hidden')==='true',x:n.getBoundingClientRect().x})));
   assert.equal(icons.length,await page.locator('#detail-stats dd').count(),'one icon per displayed ability/category row');assert.ok(icons.every(n=>n.loaded&&n.decorative));assert.ok(icons.every(n=>Math.abs(n.x-icons[0].x)<1),'all icons align to one left column');assert.ok(icons.some(n=>n.kind==='posture-bonus'));assert.ok(icons.some(n=>n.kind==='interval'));assert.ok(icons.some(n=>n.kind==='move'));
   if(mode==='battle'){
    const labels=await page.locator('#detail-stats dt').allTextContents();for(const name of ['佔用','傷害／治療／護盾攻擊力','下次行動'])assert.ok(!labels.includes(name));assert.equal(labels[labels.indexOf('血量')+1],'護盾');
   }
   else assert.equal(initial.stateHidden,true);
   if(width>900){const divider=await page.evaluate(()=>{const basic=document.querySelector('.detail-basic-section').getBoundingClientRect(),effects=document.querySelector('.detail-effects-section').getBoundingClientRect();return {basic:basic.height,effects:effects.height,pseudo:parseFloat(getComputedStyle(document.querySelector('.detail-effects-section'),'::before').height)};});assert.ok(Math.abs(divider.basic-divider.effects)<1);assert.ok(divider.pseudo>divider.basic-25);}
   await page.screenshot({path:path.join(out,`${width}-${mode}.png`)});
   await page.evaluate(mode=>{const unit={...ItemDB.defaults[0],name:'青青',stars:3,imageFile:'qingqing-1slot.png',description:Array(12).fill('這是較長的行動效果說明，維持完整換行並由右側資訊區捲動。').join('\n'),laws:Array.from({length:30},(_,i)=>({name:`法則 ${i+1}：保留完整的名稱與內容，不截斷項目。`}))};CharacterDetails.render(document,unit,{statuses:mode==='battle'?Array.from({length:25},(_,i)=>`狀態 ${i+1}：持續效果與剩餘時間`):[]});},mode);
   const before=await measure();assert.ok(before.scroll>100,`${width} ${mode}: information should scroll`);assert.ok(before.overflow<=1);
   if(mode==='gear'){assert.equal(before.stateHidden,true);assert.equal(before.lawColumn,'1 / -1');}
   const box=await page.locator('.detail-content').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,900);await page.waitForFunction(()=>document.querySelector('.detail-content').scrollTop>0);
   const after=await measure();assert.ok(Math.abs(after.portrait.y-before.portrait.y)<1,'portrait remains fixed');assert.ok(Math.abs(after.dialog.h-before.dialog.h)<1,'scroll does not resize dialog');
   await page.screenshot({path:path.join(out,`${width}-${mode}-long.png`)});
   await page.evaluate(()=>CharacterDetails.render(document,{...ItemDB.defaults[0],stars:1,laws:[]}));assert.equal(await page.locator('.detail-content').evaluate(n=>n.scrollTop),0);assert.equal(await page.locator('#detail-law-section').isVisible(),false);
   await page.keyboard.press('Escape');assert.equal(await page.locator('#character-detail').evaluate(n=>n.open),false);results.push({width,height,mode,passed:true});
  }
  // file:// must render PNG borders without fetching CSS masks.
  await page.setViewportSize({width:1440,height:1000});await page.goto('file:///'+path.join(root,'battle.html').replaceAll('\\','/')+'?preview=1');
  await page.waitForFunction(()=>window.CharacterDetails&&window.ItemDB);
  await page.evaluate(()=>{CharacterDetails.render(document,{...ItemDB.defaults[0],stars:1,laws:[]});const d=document.querySelector('#character-detail');d.hidden=false;d.showModal();});
  // All professions, races and affinities reuse the intended PNGs; file:// needs no masks.
  for(const [i,job]of ['破陣','飛襲','守護','支援'].entries()){
   await page.evaluate(({job,i})=>CharacterDetails.render(document,{...ItemDB.defaults[0],job,race:['人類','機人','獸人'][i%3],affinity:['物理','魔法','精神'][i%3],rarity:['SR','SSR','UR'][i%3],stars:1,laws:[]}),{job,i});
   await page.evaluate(async()=>Promise.all([...document.querySelectorAll('#detail-stats img')].map(n=>n.decode())));
   const paths=await page.locator('.detail-category-value img').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('src')));
   assert.ok(paths[0].endsWith(['job-melee.png','job-ranged.png','job-tank.png','job-healer.png'][i]));assert.ok(paths[1].includes('card-icons/approved-v1/'));assert.ok(paths[2].includes('card-icons/approved-v1/'));assert.ok(paths[3].endsWith('/rank.png'));
  }
  assert.match(await page.locator('.detail-portrait').evaluate(n=>getComputedStyle(n,'::after').borderImageSource),/portrait-frame-v1.png/);await page.screenshot({path:path.join(out,'file-battle.png')});
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2)+'\n');console.log('Chrome: 6 battle/gear × desktop/low-height/mobile cases; long lists, fixed portrait, hidden state/laws, keyboard close, scroll reset and file PNG skin passed.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
