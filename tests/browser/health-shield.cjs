// Runtime-only fixtures exercise the actual battle renderer and private battle state.
const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tmp/browser/health-shield-v1');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'content-type':({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream'});res.end(err?'Not found':data);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});await page.goto(`http://127.0.0.1:${server.address().port}/battle.html?preview=1`);
   await page.evaluate(()=>{
    const create=Battle.create;Battle.create=(...args)=>{const state=create(...args);state.teams.forEach(t=>t.units.forEach((u,i)=>{u.hp=[60,80,60][i];u.shield=[30,40,0][i];}));return state;};
    const units=['未滿護盾','超量護盾','沒有護盾'].map((name,i)=>({...ItemDB.defaults[i],name,maxHp:100,space:2,stars:i+1,rarity:'SSR',job:['破陣','支援','守護'][i],cooldown:120,effects:[],imageFile:['qingqing-1slot.png','youmeng-1slot.png','budi-1slot.png'][i]}));const row=[units[0],null,units[1],null,units[2],null,...Array(4).fill(null)];dispatchEvent(new MessageEvent('message',{source:parent,data:{type:'minimajo-preview',loadouts:[row,row],skills:[],limits:[10,10]}}));
   });
   await page.waitForFunction(()=>document.querySelectorAll('#ally-units>[data-star-layout=ready]').length===3&&[...document.querySelectorAll('#ally-units img')].every(i=>i.complete&&i.naturalWidth));
   const meters=await page.locator('#ally-units .hp-meter').evaluateAll(nodes=>nodes.map(n=>{const red=n.querySelector('.meter-fill'),blue=n.querySelector('.shield-fill'),rr=red.getBoundingClientRect(),br=blue.getBoundingClientRect();return {text:n.querySelector('.meter-value').textContent,red:parseFloat(red.style.width),blue:parseFloat(blue.style.width),left:parseFloat(blue.style.left),touching:Math.abs(rr.right-br.left),blueColor:getComputedStyle(blue).backgroundColor,textColor:n.querySelector('.shield-value')?getComputedStyle(n.querySelector('.shield-value')).color:null,hidden:blue.hidden,aria:n.getAttribute('aria-valuetext'),max:n.getAttribute('aria-valuemax')};}));
   for(const [i,m]of meters.entries()){
    assert.equal(m.text,['60+30/100','80+40/100','60/100'][i]);assert.ok(Math.abs(m.red-[60,200/3,60][i])<1e-3);assert.ok(Math.abs(m.blue-[30,100/3,0][i])<1e-3);assert.equal(m.left,m.red);assert.equal(m.max,'100');if(i<2){assert.ok(m.touching<.5);assert.equal(m.blueColor,'rgb(108, 146, 159)');assert.equal(m.textColor,'rgb(192, 228, 239)');}else assert.equal(m.hidden,true);
   }
   assert.equal(await page.locator('#ally-units .unit-status-badge[aria-label^="護盾 "]').count(),0);
   const gaps=await page.locator('#ally-units>[data-card-skin]').evaluateAll(cards=>cards.map(c=>c.querySelector('.stagger').getBoundingClientRect().top-c.querySelector('.hp-meter').getBoundingClientRect().bottom));for(const gap of gaps)assert.ok(Math.abs(gap)<.5,'HP and stagger meters should touch');
   await page.screenshot({path:path.join(out,`${width}-battle.png`)});
   await page.locator('#ally-units>[data-card-skin]').first().click();const labels=await page.locator('#detail-stats dt').allTextContents();assert.equal(labels[labels.indexOf('血量')+1],'護盾');assert.ok(!labels.some(n=>['佔用','傷害／治療／護盾攻擊力','下次行動'].includes(n)));await page.screenshot({path:path.join(out,`${width}-detail.png`)});
   results.push({width,meters});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2)+'\n');console.log('Chrome 1440/390: merged HP/shield examples, adjoining segments, colors, zero-shield state, no duplicate badge and concise detail passed.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
