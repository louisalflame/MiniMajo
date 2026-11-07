const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'../..'),folder=fs.mkdtempSync(path.join(os.tmpdir(),'minimajo-browser-')),dataFile=path.join(folder,'minimajo-editor.json');
const data=require('../../js/editor-backup.js').collect({getItem:()=>null});
data.data.skills.skills=[{id:'compound',name:'複合出現條件',description:'',imagePath:'',cooldown:8,mode:'all',conditions:[{kind:'count',field:'race',value:'人類',op:'gte',count:1}],effects:[{type:'damage',amount:10}]}];
fs.writeFileSync(dataFile,JSON.stringify(data));const server=require('../../editor-server.cjs').createEditorServer({root,dataFile});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
   const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);const ready=()=>page.waitForFunction(()=>document.documentElement.dataset.editorReady==='true');await ready();await page.locator('#tab-skills').click();await page.locator('#tab-skill-conditions').click();
   const row=page.locator('#skill-conditions .condition-row'),filters=row.locator('.effect-condition');
   await row.getByRole('button',{name:'＋ 加入角色篩選',exact:true}).click();await filters.nth(1).getByLabel('角色篩選欄位',{exact:true}).selectOption('rarity');await filters.nth(1).getByLabel('比較方式',{exact:true}).selectOption('in');await filters.nth(1).getByLabel('SR',{exact:true}).uncheck();await filters.nth(1).getByLabel('SSR',{exact:true}).check();await filters.nth(1).getByLabel('UR',{exact:true}).check();
   await row.getByRole('button',{name:'＋ 加入角色篩選',exact:true}).click();await filters.nth(2).getByLabel('角色篩選欄位',{exact:true}).selectOption('stars');await filters.nth(2).getByLabel('比較方式',{exact:true}).selectOption('gte');await filters.nth(2).getByLabel('篩選值',{exact:true}).fill('3');await row.getByLabel('數量比較',{exact:true}).selectOption('gt');await row.getByLabel('人數',{exact:true}).fill('3');
   const preview=async(n)=>page.evaluate(n=>{const u={...ItemDB.defaults[0],race:'人類',rarity:'SSR',stars:3,space:2},team=Array(10).fill(null);for(let i=0;i<n;i++)team[i*2]={...u,rarity:i%2?'UR':'SSR'};SkillEditor.setTeams([team,[]],ItemDB.defaults);},n);
   await preview(4);assert.match(await page.locator('#skill-matches').innerText(),/編輯中技能：符合/);await preview(3);assert.match(await page.locator('#skill-matches').innerText(),/編輯中技能：不符合/);
   await page.locator('#skill-form button[type=submit]').click();await page.waitForFunction(()=>!EditorFileSession.state().pending&&!EditorFileSession.state().dirty);await page.reload();await ready();await page.locator('#tab-skills').click();await page.locator('#tab-skill-conditions').click();
   assert.equal(await filters.count(),3);assert.equal(await filters.nth(1).getByLabel('SSR',{exact:true}).isChecked(),true);assert.equal(await filters.nth(1).getByLabel('UR',{exact:true}).isChecked(),true);assert.equal(await row.getByLabel('數量比較',{exact:true}).inputValue(),'gt');assert.equal(await filters.nth(2).getByLabel('篩選值',{exact:true}).inputValue(),'3');await preview(4);assert.match(await page.locator('#skill-matches').innerText(),/編輯中技能：符合/);
   const saved=JSON.parse(fs.readFileSync(dataFile,'utf8')).data.skills.skills[0].conditions[0];assert.deepEqual(saved.filters,[{field:'race',op:'eq',value:'人類'},{field:'rarity',op:'in',value:['SSR','UR']},{field:'stars',op:'gte',value:3}]);assert.equal(saved.count,3);assert.equal(saved.op,'gt');
   await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.skill-count-filters').evaluate(el=>el.scrollWidth<=el.clientWidth),true);assert.deepEqual(errors,[]);
   console.log('Edge: SSR/UR + stars >= 3 + human count > 3 editing, draft preview boundary, save/reload and 390px passed.');
  }finally{await browser.close();}
 }finally{await new Promise(resolve=>server.close(resolve));if(!path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(folder).startsWith('minimajo-browser-'))throw Error('Unsafe test cleanup');fs.rmSync(folder,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
