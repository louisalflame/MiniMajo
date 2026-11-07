// Run against dist with a fresh browser; no editor service or saved browser data.
const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../dist'),out=path.resolve(__dirname,'../../tmp/browser/release');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
const server=http.createServer((req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep))throw Error('outside');const bytes=fs.readFileSync(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end('Not found');}});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  fs.mkdirSync(out,{recursive:true});browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
  await page.addInitScript(()=>{
   localStorage.setItem('minimajo.characters.v2','old local data must remain');
   let api;Object.defineProperty(globalThis,'Journey',{configurable:true,get:()=>api,set(value){api=value;const create=value.create;value.create=(...args)=>globalThis.releaseRun=create(...args);}});
  });
  const url=`http://127.0.0.1:${server.address().port}`;
  await page.goto(url);assert.equal(await page.locator('a[href="editor.html"]').count(),0);
  await page.locator('a.start').click();await page.waitForFunction(()=>!!globalThis.releaseRun);
  assert.ok(await page.evaluate(()=>releaseRun.roster.active.some(Boolean)));
  assert.equal(await page.evaluate(()=>localStorage.getItem('minimajo.characters.v2')),'old local data must remain');
  assert.equal(await page.evaluate(()=>localStorage.getItem('minimajo.schema')),null);
  await page.screenshot({path:path.join(out,'map-desktop.png')});
  await page.locator('#journey-gear').click();await page.locator('#expedition-dialog[open]').waitFor();
  assert.ok(await page.locator('#roster-bottom .occupied').count()>0||await page.locator('#roster-top .occupied').count()>0);
  await page.screenshot({path:path.join(out,'preparation-desktop.png')});await page.keyboard.press('Escape');await page.locator('#expedition-dialog').waitFor({state:'hidden'});
  const target=await page.locator('.hex-cell.reachable').first().getAttribute('aria-label');
  await page.evaluate(label=>{const [,q,r]=label.match(/座標 (-?\d+), (-?\d+)/);const cell=Object.values(releaseRun.map.map.cells).find(c=>c.q===+q&&c.r===+r);cell.type='battle';},target);
  await page.getByRole('button',{name:target,exact:true}).focus();await page.keyboard.press('Enter');await page.locator('#journey-battle').waitFor({state:'visible'});
  const frame=page.frameLocator('#journey-frame');await frame.locator('#play').waitFor({state:'visible'});await frame.locator('#play').click();await page.waitForFunction(()=>releaseRun.encounter?.started===true);
  await page.screenshot({path:path.join(out,'battle-desktop.png')});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'battle-mobile.png')});
  const missing=await context.newPage();await missing.route('**/data/game-*.js',route=>route.abort());await missing.goto(url+'/play.html');await missing.waitForFunction(()=>document.getElementById('journey-message').textContent.includes('無法開始旅程'));
  assert.match(await missing.locator('#journey-message').textContent(),/公開遊戲設定/);assert.equal(await missing.locator('#journey-gear').isDisabled(),true);
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  console.log('PASS: static release, fresh/old cache isolation, preparation, real battle iframe, desktop/mobile screenshots, missing settings fail closed.');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
