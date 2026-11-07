const {gamePage}=require('./game-page.cjs');
// Real pointer/touch drags on play.html; full teams and fixtures stay in memory.
const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tmp/browser/shop-buy-merge');
const server=require('../../editor-server.cjs').createEditorServer({root}),before=fs.readFileSync(path.join(root,'minimajo-editor.json'));
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  fs.mkdirSync(out,{recursive:true});browser=await chromium.launch({channel:'msedge',headless:true});
  for(const [width,area] of [[1366,'reserve'],[390,'active']]){
   const context=await browser.newContext({viewport:{width,height:900},hasTouch:true}),page=gamePage(await context.newPage()),errors=[];
   page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/play.html`);
   await page.waitForFunction(()=>!!window.ExpeditionUI);
   const slot=width===1366?4:0;
   async function fixture(failure){
    await page.evaluate(({area,slot,failure})=>{
     document.getElementById('expedition-dialog').close();
     const base={...ItemDB.defaults[0],space:2,imageFile:'youmeng-1slot.png',detailImageFile:'youmeng-detail.png'};
     const state=Expedition.create([base],[],{...GameConfig.defaults,startingActive:Array(10).fill(null)});
     for(const name of ['active','reserve'])for(let i=0;i<10;i+=2)state[name][i]={...structuredClone(state.library[0]),instanceId:name+'-'+i};
     const law=Laws.validate([{id:'merge-law',name:'繼承法則',shopPrice:0,shopWeight:0,stats:{maxHp:3},passives:[]}])[0];
     state[area][slot].laws=[law];
     const item={...structuredClone(state.library[0]),instanceId:'stock-merge',price:50,laws:[law]};
     state.shops['merge-test']=[item,...Array(9).fill(null)];
     if(failure==='gold')state.gold=0;
     if(failure==='stars')state[area][slot].stars=2;
     if(failure==='cap'){state[area][slot].stars=6;item.stars=6;}
     window.mergeFixture=state;ExpeditionUI.bind(state);ExpeditionUI.open('shop','merge-test');
    },{area,slot,failure});
   }
   async function drag(expectMerge){
    const source=page.locator('#roster-top [data-drop-slot="0"]'),target=page.locator(`${area==='active'?'#roster-bottom':'#roster-reserve'} [data-drop-slot="${slot}"]`);
    await target.scrollIntoViewIfNeeded();const a=await source.boundingBox(),b=await target.boundingBox();
    const x=a.x+a.width*.85,y=a.y+a.height*.45,tx=b.x+b.width*.2,ty=b.y+b.height*.45;
    let cdp;
    if(width===390){
     cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
     for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(tx-x)*i/12,y:y+(ty-y)*i/12}]});
    }else{await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(tx,ty,{steps:12});}
    if(expectMerge){await page.getByRole('status',{name:'放開以購買並合成，1 星升至 2 星',exact:true}).waitFor();await page.screenshot({path:path.join(out,`preview-${width}.png`)});}
    else assert.equal(await page.locator('.roster-merge-cue:visible').count(),0);
    if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}else await page.mouse.up();
   }
   for(const failure of ['gold','stars','cap']){
    await fixture(failure);const snapshot=await page.evaluate(()=>JSON.stringify(mergeFixture));await drag(false);
    assert.equal(await page.evaluate(()=>JSON.stringify(mergeFixture)),snapshot,failure+' must preserve everything');
   }
   await fixture(null);await drag(true);
   await page.waitForFunction(({area,slot})=>mergeFixture[area][slot].stars===2,{area,slot});
   const result=await page.evaluate(({area,slot})=>({gold:mergeFixture.gold,stock:mergeFixture.shops['merge-test'][0],identity:mergeFixture[area][slot].instanceId,laws:mergeFixture[area][slot].laws.length,counts:['active','reserve'].map(a=>mergeFixture[a].filter(Boolean).length),valid:Expedition.valid(mergeFixture.active)&&Expedition.valid(mergeFixture.reserve)}),{area,slot});
   assert.deepEqual(result,{gold:250,stock:null,identity:area+'-'+slot,laws:2,counts:[5,5],valid:true});
   assert.equal(await page.locator('.roster-merge-cue:visible').count(),0);assert.deepEqual(errors,[]);await context.close();
  }
  assert.deepEqual(fs.readFileSync(path.join(root,'minimajo-editor.json')),before);
  console.log('PASS desktop mouse/reserve and mobile touch/active: full teams, wide cards with grab offset, purchase-and-merge preview, one charge, law inheritance, identity, and gold/star/cap failures atomic.');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
