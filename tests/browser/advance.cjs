const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'../..'),folder=fs.mkdtempSync(path.join(os.tmpdir(),'minimajo-browser-')),dataFile=path.join(folder,'minimajo-editor.json');
fs.writeFileSync(dataFile,JSON.stringify(require('../../js/editor-backup.js').collect({getItem:()=>null})));
const server=require('../../editor-server.cjs').createEditorServer({root,dataFile});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');await page.locator('#tab-character-effects').click();
 const action=page.locator('#effects .effect-action').first();await action.locator('[aria-label="效果類型"]').selectOption('advance');assert.equal(await action.locator('[aria-label="加快秒數"]').inputValue(),'1');await action.locator('[aria-label="加快秒數"]').fill('2.5');
 await page.locator('#editor-form button[type="submit"]').click();await page.waitForFunction(()=>!window.EditorFileSession.state().dirty&&!window.EditorFileSession.state().pending);await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');await page.locator('#tab-character-effects').click();assert.equal(await action.locator('[aria-label="加快秒數"]').inputValue(),'2.5');assert.deepEqual(JSON.parse(fs.readFileSync(dataFile,'utf8')).data.characters.items[0].effects[0].actions[0],{type:'advance',amount:2.5});
 await page.locator('#tab-battle').click();await page.waitForFunction(()=>document.getElementById('battle-preview').contentDocument.getElementById('play').disabled===false);
 await page.evaluate(()=>{
 const w=document.getElementById('battle-preview').contentWindow,base={...w.ItemDB.defaults[0],name:'加快測試',cooldown:1,effects:[{targets:[{side:'ally',mode:'self'}],actions:[{type:'advance',amount:2.5}]}]},enemy={...base,name:'標靶',cooldown:120,effects:[]};
 w.postMessage({type:'minimajo-preview',loadouts:[[base,...Array(9).fill(null)],[enemy,...Array(9).fill(null)]],skills:[],limits:[10,10]},location.origin);
 });
 const frame=page.frameLocator('#battle-preview');await frame.locator('#ally-units [aria-label="加快測試"]').waitFor();await frame.locator('#play').click();await page.waitForFunction(()=>document.getElementById('battle-preview').contentDocument.getElementById('log').textContent.includes('加快時間（秒） 2.5'));await frame.locator('#play').click();assert.deepEqual(errors,[]);console.log('Edge: advance seconds default/edit/save/reload and live battle log passed.');
 }finally{await browser.close();}
 }finally{await new Promise(resolve=>server.close(resolve));if(!path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(folder).startsWith('minimajo-browser-'))throw Error('Unsafe test cleanup');fs.rmSync(folder,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
