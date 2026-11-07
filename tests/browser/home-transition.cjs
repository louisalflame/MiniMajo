// Build dist first. Verify the real START navigation without editing saved data.
const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tmp/browser/home-transition');
const server=require('../../editor-server.cjs').createEditorServer({root});
const before=fs.readFileSync(path.join(root,'minimajo-editor.json'));
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  fs.mkdirSync(out,{recursive:true});browser=await chromium.launch({channel:'msedge',headless:true});
  const url=`http://127.0.0.1:${server.address().port}`;
  for(const prefix of ['', '/dist'])for(const width of [1366,390]){
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   let navigations=0;page.on('framenavigated',frame=>{if(frame===page.mainFrame()&&frame.url().endsWith('/play.html'))navigations++;});
   let releaseImage;const gate=new Promise(resolve=>releaseImage=resolve);
   if(prefix){
    const data=JSON.parse(fs.readFileSync(path.join(root,'dist/release.json'))).data;
    const sandbox={};require('node:vm').runInNewContext(fs.readFileSync(path.join(root,'dist',data),'utf8'),sandbox);
    await page.route('**/'+sandbox.MiniMajoRelease.criticalImages[0],async route=>{await gate;await route.continue();});
   }
   await page.goto(url+prefix+'/index.html');
   const original=await page.locator('.sigil').boundingBox();
   await page.getByRole('link',{name:'START'}).click();
   // An extra dispatched click must not bypass or duplicate the transition.
   await page.locator('a.start').dispatchEvent('click');
   await page.waitForTimeout(700);
   assert(page.url().endsWith('/index.html'));
   const copy=await page.locator('.hero-copy').evaluate(el=>({opacity:+getComputedStyle(el).opacity,x:new DOMMatrix(getComputedStyle(el).transform).m41}));
   assert(copy.opacity<.05&&copy.x<0);
   await page.waitForTimeout(500);
   const centered=await page.locator('.sigil').boundingBox();
   assert(Math.abs(centered.x+centered.width/2-width/2)<2);
   assert(Math.abs(centered.y+centered.height/2-450)<2);assert(centered.width>original.width);
   await page.screenshot({path:path.join(out,`${prefix?'release':'local'}-${width}-center.png`)});
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('.moon-light')).opacity==='0');
   await page.screenshot({path:path.join(out,`${prefix?'release':'local'}-${width}-eclipse.png`)});
   await page.waitForFunction(()=>document.body.classList.contains('home-loading'));
   assert.equal(await page.locator('#home-transition').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(0, 0, 0)');
   await page.waitForURL('**/play.html',{waitUntil:'domcontentloaded'});assert.equal(navigations,1);
   if(prefix){
    assert(await page.locator('#asset-loading').isVisible());
    assert.equal(await page.locator('#asset-loading').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(0, 0, 0)');
    assert.equal(await page.locator('#journey-frame').getAttribute('src'),null);
    await page.screenshot({path:path.join(out,`release-${width}-loading.png`)});
   }
   releaseImage();if(prefix)await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-assets-loading'));
   await page.goBack();await page.getByRole('link',{name:'START'}).waitFor();
   assert.equal(await page.locator('main').evaluate(el=>el.inert),false);
   assert(await page.locator('#home-transition').isHidden());assert.equal(await page.locator('.sigil').count(),1);
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.getByRole('link',{name:'START'}).click();await page.waitForURL('**/play.html',{timeout:3000,waitUntil:'domcontentloaded'});assert.equal(navigations,2);
   assert.deepEqual(errors,[]);await context.close();
  }
  assert.deepEqual(fs.readFileSync(path.join(root,'minimajo-editor.json')),before);
  console.log('PASS: local/public START phases, centered enlargement, eclipse, black Loading handoff, repeated clicks, back navigation, reduced motion, desktop/390px, no source writes.');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
