// Read-only editor inspection in an isolated context. Never edits the user's live tab.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'../..'),out=path.join(root,'tmp/browser/status-imagepath-config-v1');
(async()=>{
 const before=fs.readFileSync(path.join(root,'minimajo-editor.json')),statuses=JSON.parse(before).data.statuses.statuses,browser=await chromium.launch({channel:'chrome',headless:true});
 try{const context=await browser.newContext(),page=await context.newPage({viewport:{width:1366,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173/editor.html');await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');await page.locator('#tab-statuses').click();
  const checks=[];for(const s of statuses){await page.locator('#status-list').getByRole('button',{name:s.name,exact:true}).click();const value=await page.locator('#status-image-path').inputValue();assert.equal(value,s.imagePath);checks.push({id:s.id,name:s.name,path:value});}
  assert.equal(checks.filter(s=>s.path).length,22);
  await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');await page.locator('#tab-statuses').click();await page.locator('#status-list').getByRole('button',{name:'永續反擊',exact:true}).click();assert.equal(await page.locator('#status-image-path').inputValue(),statuses.find(s=>s.name==='永續反擊').imagePath);
  await page.screenshot({path:path.join(out,'editor-path.png')});
  // The rendering helper now obeys the edited value, with no ID-specific default.
  await page.goto('http://127.0.0.1:4173/battle.html?preview=1');await page.waitForFunction(()=>window.UIIcons&&window.Statuses);
  const runtime=await page.evaluate(async()=>{
   const lib=Statuses.snapshot(),power=lib.statuses.find(s=>s.id==='power');power.imagePath='assets/ui/status-icons/v1/regen.png';Statuses.configure(lib);
   const changed=UIIcons.createStatus(document,'power');document.body.append(changed);await changed.querySelector('img').decode();const changedPath=changed.querySelector('img').getAttribute('src');changed.remove();
   power.imagePath='';Statuses.configure(lib);const blank=UIIcons.createStatus(document,'power');
   power.imagePath='assets/ui/status-icons/v1/missing-path-config-check.png';Statuses.configure(lib);const broken=UIIcons.createStatus(document,'power');document.body.append(broken);const image=broken.querySelector('img');await new Promise(resolve=>{const callback=image.onerror;image.onerror=()=>{callback();resolve();};});const brokenSvg=!!broken.querySelector('svg');broken.remove();
   return {changedPath,blankSvg:!!blank.querySelector('svg'),blankImg:!!blank.querySelector('img'),brokenSvg};
  });assert.equal(runtime.changedPath,'assets/ui/status-icons/v1/regen.png');assert.ok(runtime.blankSvg&&!runtime.blankImg&&runtime.brokenSvg);assert.deepEqual(errors,[]);assert.ok(before.equals(fs.readFileSync(path.join(root,'minimajo-editor.json'))));
  fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({checks,reloaded:true,runtime,errors,fixedDataUnchangedByInspection:true},null,2)+'\n');console.log('Chrome: 22 editor paths visible, reload retains permanent counter; changed/blank/broken imagePath obeyed without ID-to-file defaults.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
