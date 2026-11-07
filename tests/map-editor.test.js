const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const HexMap=require('../js/hex-map.js');
class Element{constructor(){this.children=[];this.attributes={};this.handlers={};this.checked=false;this.disabled=false;this.hidden=false;this.value='';this.textContent='';}setAttribute(k,v){this.attributes[k]=v;}getAttribute(k){return this.attributes[k]??null;}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}addEventListener(type,fn){this.handlers[type]=fn;}focus(){}click(){if(!this.disabled)this.handlers.click?.();}}
function setup(storage){const html=fs.readFileSync(path.join(__dirname,'../editor.html'),'utf8'),nodes=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));nodes.get('map-radius').value='4';nodes.get('map-seed').value='MINIMAJO';for(const [id,value] of Object.entries({'map-count-battle':24,'map-count-elite':5,'map-count-rest':5,'map-count-shop':4,'map-count-fragile':6,'map-spacing-elite':2,'map-spacing-rest':3,'map-spacing-shop':2,'map-spacing-supply':2,'map-safe-radius':3,})){if(nodes.has(id))nodes.get(id).value=String(value);}const calls=[];nodes.expeditionCalls=calls;vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/map-editor.js'),'utf8'),{HexMap,localStorage:storage,ExpeditionUI:{open:(...args)=>{calls.push(args);nodes.get('expedition-dialog').setAttribute('data-mode',args[0]);},reset:()=>calls.push(['reset'])},document:{getElementById:id=>nodes.get(id),createElement:()=>new Element(),createElementNS:()=>new Element()}});return nodes;}
test('map editor masks fog, moves only adjacent selections, and reveals event controls',()=>{
 const e=setup(),cells=()=>e.get('hex-map-svg').children.filter(x=>x.attributes.role==='button');
 assert.equal(cells().length,61);assert.equal(e.has('map-travel'),false);
 const unknown=cells().find(x=>x.attributes['aria-label'].includes('內容未知'));assert.ok(unknown);unknown.click();assert.equal(e.get('map-node-title').textContent,'未知節點');assert.equal(e.has('map-travel'),false);
 const adjacent=cells().find(x=>x.attributes['aria-label'].includes('可前往'));adjacent.click();assert.equal(e.get('map-steps').textContent,'1');assert.equal(e.get('map-resolve').hidden,false);
 e.get('map-resolve').click();assert.equal(e.get('map-resolve').hidden,true);const count=e.get('map-explored').textContent;
 e.get('map-reveal-all').checked=true;e.get('map-reveal-all').handlers.change();assert.equal(cells().some(x=>x.attributes['aria-label'].includes('內容未知')),false);assert.equal(e.get('map-preview-flag').hidden,false);
 e.get('map-reveal-all').checked=false;e.get('map-reveal-all').handlers.change();assert.equal(e.get('map-explored').textContent,count);assert.ok(cells().some(x=>x.attributes['aria-label'].includes('內容未知')));
 e.get('map-reset').click();assert.equal(e.get('map-steps').textContent,'0');assert.equal(e.get('map-current').textContent,'-4,0');
 e.get('map-radius').value='2';e.get('map-radius').handlers.change();e.get('map-generate').click();assert.equal(cells().length,19);e.get('map-radius').value='7';e.get('map-generate').click();assert.ok(e.get('map-error').textContent);assert.equal(cells().length,19);
});
test('map editor integrates as an independent workspace tab with local resources',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../editor.html'),'utf8');assert.match(html,/data-tab="map"/);assert.match(html,/id="page-map" hidden data-panel-group="workspace"/);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 for(const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)){const file=match[1].split('?')[0];assert.ok(fs.existsSync(path.join(__dirname,'..',file)),file);}
});
test('editor applies quota drafts, preserves maps on failure, and compares decay modes',()=>{
 const e=setup();assert.match(e.get('map-applied-rules').textContent,/戰鬥 24 \/ 菁英 5/);
 const before=e.get('map-overview').textContent;e.get('map-count-battle').value='999';e.get('map-generate').click();assert.match(e.get('map-error').textContent,/超過/);assert.equal(e.get('map-overview').textContent,before);
 e.get('map-defaults').click();assert.equal(Number(e.get('map-count-battle').value),24);
 e.get('map-decay-enabled').checked=true;e.get('map-decay-enabled').handlers.change();assert.match(e.get('map-alarm-level').textContent,/衰減已啟用/);
 e.get('map-decay-stages').children[0].children[0].children[0].value='0';e.get('map-decay-stages').children[0].children[0].children[0].handlers.change();assert.ok(e.get('map-error').textContent);
 e.get('map-decay-stages').children[0].children[0].children[0].value='3';e.get('map-decay-enabled').checked=false;e.get('map-decay-enabled').handlers.change();assert.match(e.get('map-alarm-level').textContent,/衰減已關閉/);
});

test('map opens gear, sample shops, and the actual shop only after reaching it',()=>{
 const e=setup();e.get('map-gear').click();e.get('map-shop-sample').click();assert.deepEqual(e.expeditionCalls,[['gear'],['shop','sample']]);
 const map=HexMap.generate(),goal=Object.keys(map.cells).find(id=>map.cells[id].type==='shop'),queue=[map.entrance],prior=new Map([[map.entrance,null]]);
 for(const id of queue){if(id===goal)break;for(const next of HexMap.neighbors(map,id))if(!prior.has(next)){prior.set(next,id);queue.push(next);}}
 const route=[];for(let at=goal;at!==map.entrance;at=prior.get(at))route.unshift(at);
 for(const id of route){const c=map.cells[id],tile=e.get('hex-map-svg').children.find(x=>x.attributes['aria-label']?.startsWith('座標 '+c.q+', '+c.r+'，'));tile.click();if(!e.get('map-resolve').hidden&&id!==goal)e.get('map-resolve').click();}
 assert.deepEqual(e.expeditionCalls.at(-1),['shop',goal]);assert.equal(e.has('map-open-shop'),false);
 e.get('expedition-dialog').handlers.close();assert.equal(e.get('map-resolve').hidden,true);e.get('map-reset').click();assert.deepEqual(e.expeditionCalls.at(-1),['reset']);
});

test('applied map settings survive reopening and invalid drafts preserve the saved configuration',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 let e=setup(storage);e.get('map-radius').value='2';e.get('map-radius').handlers.change();e.get('map-seed').value='MY-MAP';e.get('map-generate').click();
 const saved=JSON.parse(values.get('minimajo.map.v1'));assert.equal(saved.radius,2);assert.equal(saved.seed,'MY-MAP');
 e.get('map-count-battle').value='999';e.get('map-generate').click();assert.deepEqual(JSON.parse(values.get('minimajo.map.v1')),saved);
 e=setup(storage);assert.equal(e.get('map-radius').value,2);assert.equal(e.get('map-seed').value,'MY-MAP');assert.match(e.get('map-overview').textContent,/19 格/);
 e.get('map-decay-enabled').checked=true;e.get('map-decay-enabled').handlers.change();assert.equal(JSON.parse(values.get('minimajo.map.v1')).rewardDecay.enabled,true);
});

test('editor saves the fragile quota and previews one-way collapse with a resettable map',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},e=setup(storage);
 for(const type of HexMap.quotaTypes)e.get('map-count-'+type).value=type==='fragile'?'59':'0';e.get('map-seed').value='fragile-preview';e.get('map-generate').click();
 assert.equal(JSON.parse(values.get('minimajo.map.v1')).rules.quotas.fragile,59);const saved=values.get('minimajo.map.v1');e.get('map-count-fragile').value='';e.get('map-generate').click();assert.equal(values.get('minimajo.map.v1'),saved);assert.match(e.get('map-error').textContent,/非負整數/);e.get('map-count-fragile').value='59';const origin=e.get('map-current').textContent;
 const cells=()=>e.get('hex-map-svg').children.filter(x=>x.attributes.role==='button'),floor=cells().find(x=>x.attributes['aria-label'].includes('可前往'));const label=floor.attributes['aria-label'].split('，')[0];floor.click();assert.equal(e.get('map-steps').textContent,'1');assert.equal(e.get('map-resolve').hidden,true);
 const originalCell=cells().find(x=>x.attributes['aria-label'].startsWith('座標 -4, 0，'));originalCell.click();assert.equal(e.get('map-current').textContent,origin);const collapsed=cells().find(x=>x.attributes['aria-label'].startsWith(label+'，'));assert.match(collapsed.attributes['aria-label'],/已崩塌/);collapsed.click();assert.equal(e.get('map-steps').textContent,'2');assert.equal(e.get('map-node-title').textContent,'崩塌的地板');
 e.get('map-reset').click();assert.ok(cells().every(x=>!x.attributes['aria-label'].includes('已崩塌')));
});
