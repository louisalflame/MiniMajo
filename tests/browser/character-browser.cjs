const {gamePage}=require('./game-page.cjs');
const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tmp/browser/character-browser');fs.mkdirSync(out,{recursive:true});
const before=fs.readFileSync(path.join(root,'minimajo-editor.json')),file=require('../../js/editor-backup.js').prepare(JSON.parse(before)).file;
file.data.characters.items[0].stars=3;file.data.characters.items[0].shopWeight=0;
const dataFile=path.join(out,'editor.json');fs.writeFileSync(dataFile,JSON.stringify(file));
const server=require('../../editor-server.cjs').createEditorServer({root,dataFile}),characters=file.data.characters.items;
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true,ignoreDefaultArgs:['--hide-scrollbars']});
 for(const [width,height] of [[1600,900],[844,390],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:'reduce'}),raw=await context.newPage(),page=gamePage(raw),errors=[];raw.on('pageerror',e=>errors.push(e.message));
  await raw.addInitScript(()=>{let api;Object.defineProperty(window,'Journey',{configurable:true,get:()=>api,set(value){api=value;const create=value.create;value.create=(...args)=>window.catalogRun=create(...args);}});});
  await raw.goto(`http://127.0.0.1:${server.address().port}/editor.html`);await raw.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');
  await raw.goto(`http://127.0.0.1:${server.address().port}/play.html`);await page.waitForFunction(()=>!!window.catalogRun);
  const roster=await page.evaluate(()=>JSON.stringify(catalogRun.roster));
  assert.equal(await page.locator('#character-catalog,#character-catalog-search,#character-catalog-open').count(),0);
  await page.locator('#map-characters-open').click();
  async function expectCharacter(index){
   assert.equal(await page.locator('#detail-name').textContent(),characters[index].name);
  }
  await expectCharacter(0);
  assert.equal(await page.locator('#detail-stars').getAttribute('aria-label'),'3 星');
  assert.equal(await page.locator('#detail-law-section').isVisible(),false);assert.equal(await page.locator('#detail-state-section').isVisible(),false);
  const expected=require('../../js/database.js').atStars(require('../../js/database.js').load(file.data.characters,[]).items[0],3,file.data.config);
  assert.equal(await page.locator('#detail-stats').evaluate(el=>[...el.querySelectorAll('dt')].find(n=>n.textContent==='血量').nextElementSibling.textContent),String(expected.maxHp));
  await page.locator('#character-browser-prev').click();await expectCharacter(characters.length-1);
  await page.locator('#character-browser-next').click();await expectCharacter(0);
  for(let index=1;index<=characters.length;index++){await page.locator('#character-browser-next').click();await expectCharacter(index%characters.length);}
  assert.equal(await page.locator('#character-browser button').count(),2);
  assert.equal(await page.locator('#character-browser-names,.character-browser-skin').count(),0);
  assert.equal(await page.locator('#character-browser').evaluate(el=>{const panel=el.parentElement.getBoundingClientRect();return [...el.querySelectorAll('button')].every(button=>{const r=button.getBoundingClientRect();return Math.abs(r.top+r.height/2-(panel.top+panel.height/2))<1;});}),true);
  await page.locator('#character-browser-next').click();await page.locator('#character-browser-next').click();await expectCharacter(2);
  await raw.keyboard.press('ArrowLeft');await expectCharacter(1);await raw.keyboard.press('ArrowRight');await expectCharacter(2);
  assert.equal(await page.locator('#character-browser').evaluate(el=>{const box=el.getBoundingClientRect();return box.top>=0&&box.bottom<=innerHeight;}),true);
  await page.locator('#detail-art img').waitFor({state:'visible'});await raw.screenshot({path:path.join(out,`browser-${width}.png`)});
  await raw.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('character-detail').open);
  assert.equal(await page.locator('#map-characters-open').evaluate(el=>el===document.activeElement),true);
  await page.locator('#map-characters-open').click();await expectCharacter(0);await raw.keyboard.press('Escape');
  await page.locator('#journey-gear').click();await page.locator('#roster-top .roster-tile').first().click();
  assert.equal(await page.locator('#character-browser').isVisible(),false);await raw.keyboard.press('Escape');await raw.keyboard.press('Escape');
  await page.locator('#map-help-open').click();assert.equal(await page.locator('#map-help-dialog').evaluate(el=>el.open),true);await raw.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>JSON.stringify(catalogRun.roster)),roster);assert.deepEqual(errors,[]);await context.close();
 }
 assert.deepEqual(fs.readFileSync(path.join(root,'minimajo-editor.json')),before);console.log('PASS: direct portrait entry, first character, crystal side arrows and cyclic navigation, all characters, zero weight, initial stats, keyboard, focus, gear isolation, fixed viewport and unchanged source/roster.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
