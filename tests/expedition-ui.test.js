function byClass(node,name){return node.children.find(n=>n.className===name)||node.children.map(n=>byClass(n,name)).find(Boolean);}
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');const X=require('../js/expedition.js'),D=require('../js/database.js'),S=require('../js/skills.js');
function setup(page="editor.html"){let document;class Element{
 constructor(){this.children=[];this.attrs={};this.style={};this.handlers={};this.disabled=false;this.hidden=false;this.open=false;this.textContent='';this.classList={add(){},remove(){}};}
 cloneNode(){const e=new Element();e.textContent=this.textContent;e.className=this.className;return e;}showPopover(){this.popoverOpen=true;}remove(){this.removed=true;}contains(){return true;}closest(selector){return selector==='.roster-scroll'?this:(this.getAttribute('data-drop-area')?this:null);}getBoundingClientRect(){return {top:0,bottom:900,left:0,right:1400,width:100,height:170};}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k]??null;}addEventListener(type,fn){this.handlers[type]=fn;}focus(){document.activeElement=this;}click(){if(!this.disabled){this.focus();this.handlers.click?.();}}showModal(){this.open=true;}close(){this.open=false;}}
 const html=fs.readFileSync(path.join(__dirname,'../'+page),'utf8'),nodes=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 document={hit:null,elementFromPoint(){return this.hit;},handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},activeElement:null,getElementById:id=>nodes.get(id),createElement:()=>new Element()};const window={};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/expedition-ui.js'),'utf8'),{document,window,structuredClone,EchoLevels:require('../js/echo-levels.js'),Laws:require('../js/laws.js'),GameConfig:require('../js/config.js'),Expedition:X,CharacterDetails:require('../js/character-details.js'),DialogDismiss:require('../js/dialog-dismiss.js'),CharacterCardSkin:require('../js/character-card-skin.js'),CharacterArt:require('../js/character-art.js'),ItemDB:D,SkillDB:S,SkillEditor:{getSkills:()=>S.defaults},EffectEditor:{describe:e=>e.type},localStorage:{getItem:()=>null}});
 const drop=(source,target)=>{const event={button:0,pointerId:1,clientX:40,clientY:50,preventDefault(){}};source.handlers.pointerdown(event);document.hit=target;document.handlers.pointermove({...event,clientX:100});document.handlers.pointerup(event);};
 return {nodes,ui:window.ExpeditionUI,document,drop};
}
test('gear renders equal ten-slot rows, moves actors across teams, and equips matching skills',()=>{
 const {nodes:e,ui,drop}=setup();ui.open('gear');assert.equal(e.get('expedition-dialog').open,true);assert.equal(e.get('roster-top').children.length,10);assert.equal(e.get('roster-bottom').children.length,10);assert.equal(e.get('roster-reserve-section').hidden,true);
 drop(e.get('roster-bottom').children[0],e.get('roster-top').children[3]);assert.equal(e.get('roster-top-count').textContent,'1 / 10 格');assert.equal(e.get('roster-bottom-count').textContent,'2 / 10 格');
 e.get('roster-skill').click();assert.equal(e.get('roster-skill-menu').hidden,false);assert.ok(e.get('roster-skill-options').children.length);e.get('roster-skill-options').children[0].click();assert.equal(e.get('roster-skill-menu').hidden,false);e.get('roster-skill-confirm').click();assert.equal(e.get('roster-skill-menu').hidden,true);assert.match(e.get('expedition-message').textContent,/已裝備/);
 e.get('expedition-close').click();assert.equal(e.get('expedition-dialog').open,false);ui.open('gear');assert.equal(e.get('roster-top-count').textContent,'1 / 10 格');
});
test('shop shows both rosters, purchases into reserve, retains stock and resets',()=>{
 const {nodes:e,ui,drop}=setup();ui.open('shop','shop-node');assert.equal(e.get('roster-top-title').textContent,'店家販售角色');
 e.get('roster-top').children[0].click();assert.equal(e.get('roster-reserve-section').hidden,false);assert.equal(e.get('roster-buy').hidden,false);drop(e.get('roster-top').children[0],e.get('roster-reserve').children[3]);assert.equal(e.get('expedition-gold').textContent,'270 金幣');assert.equal(e.get('roster-reserve-count').textContent,'1 / 10 格');
 drop(e.get('roster-reserve').children[3],e.get('roster-bottom').children[3]);assert.equal(e.get('roster-bottom-count').textContent,'4 / 10 格');
 e.get('expedition-close').click();ui.open('shop','shop-node');assert.equal(e.get('expedition-gold').textContent,'270 金幣');assert.equal(e.get('roster-top').children[0].className,'roster-tile vacant');
 ui.reset();assert.equal(e.get('expedition-dialog').open,false);ui.open('shop','shop-node');assert.equal(e.get('expedition-gold').textContent,'300 金幣');assert.equal(e.get('roster-top').children[0].className,'roster-tile occupied');
});
test('selling is a passive region with no click action on every preparation entry',()=>{
 for(const page of ['play.html','editor.html']){
  const html=fs.readFileSync(path.join(__dirname,'../'+page),'utf8');assert.match(html,/<div id="roster-sell-zone"[^>]*role="region"/);assert.doesNotMatch(html,/<button id="roster-sell-zone"/);
  const {nodes:e,ui}=setup(page),state=X.create();ui.bind(state);ui.open('gear');
  const gold=state.gold,team=JSON.stringify(state.active),message=e.get('expedition-message').textContent;
  assert.equal(e.get('roster-sell-zone').handlers.click,undefined);e.get('roster-sell-zone').click();
  assert.equal(state.gold,gold);assert.equal(JSON.stringify(state.active),team);assert.equal(e.get('expedition-message').textContent,message);
 }
});
test('skill picker stacks above preparation and cancellation preserves equipment and focus',()=>{
 for(const page of ['editor.html','play.html']){
  const {nodes:e,ui,document:d}=setup(page),state=X.create(D.defaults,S.defaults);
  ui.bind(state);ui.open('gear');const parent=e.get('expedition-dialog'),picker=e.get('roster-skill-menu'),trigger=e.get('roster-skill');
  trigger.click();assert.equal(parent.open,true);assert.equal(picker.open,true);assert.equal(trigger.getAttribute('aria-expanded'),'true');
  assert.equal(e.get('roster-skill-confirm').disabled,true);e.get('roster-skill-options').children[0].click();assert.equal(state.skillId,null);assert.equal(picker.open,true);assert.equal(e.get('roster-skill-confirm').disabled,false);assert.match(e.get('skill-selected-cooldown').textContent,/秒/);assert.ok(e.get('skill-selected-description').textContent);e.get('roster-skill-confirm').click();const equipped=state.skillId;
  assert.ok(equipped);assert.equal(picker.open,false);assert.equal(d.activeElement,trigger);
  trigger.click();let prevented=false;picker.handlers.cancel({preventDefault(){prevented=true;}});
  assert.equal(prevented,true);assert.equal(parent.open,true);assert.equal(picker.open,false);assert.equal(state.skillId,equipped);assert.equal(d.activeElement,trigger);
  trigger.click();const outside={button:0,target:picker,clientX:-1,clientY:-1};picker.handlers.pointerdown(outside);picker.handlers.click(outside);
  assert.equal(picker.open,false);assert.equal(parent.open,true);assert.equal(state.skillId,equipped);
  trigger.click();picker.handlers.pointerdown({...outside,clientX:20,clientY:20});picker.handlers.click(outside);assert.equal(picker.open,true);
  ui.open('shop','stack-test');assert.equal(picker.open,false);assert.equal(picker.hidden,true);assert.equal(trigger.getAttribute('aria-expanded'),'false');
  ui.open('gear');trigger.click();ui.reset();assert.equal(picker.open,false);assert.equal(parent.open,false);
 }
});
test('pointer dragging buys, swaps, sells and cancels without extra transactions',()=>{
 const {nodes:e,ui,document:d}=setup(),state=X.create();X.shop(state,'drag',()=>.999);ui.bind(state);ui.open('shop','drag');
 const event={button:0,pointerId:1,clientX:100,clientY:200,preventDefault(){}};
 function drop(source,target,cancel=false){source.handlers.pointerdown(event);d.hit=target;d.handlers.pointermove({...event,clientX:150});d.handlers[cancel?'pointercancel':'pointerup'](event);}
 drop(e.get('roster-top').children[0],e.get('roster-reserve').children[4]);assert.equal(e.get('expedition-gold').textContent,'270 金幣');assert.equal(e.get('roster-reserve-count').textContent,'1 / 10 格');
 const old=e.get('roster-bottom').children[0].getAttribute('aria-label'),incoming=e.get('roster-reserve').children[4].getAttribute('aria-label');drop(e.get('roster-bottom').children[0],e.get('roster-reserve').children[4]);assert.equal(e.get('roster-bottom').children[0].getAttribute('aria-label'),incoming.replace('第 5 格','第 1 格'));assert.equal(e.get('roster-reserve').children[4].getAttribute('aria-label'),old.replace('第 1 格','第 5 格'));
 const sell=e.get('roster-sell-zone');sell.setAttribute('data-drop-area','sell');drop(e.get('roster-reserve').children[4],sell);assert.equal(e.get('expedition-gold').textContent,'285 金幣');assert.equal(e.get('roster-reserve-count').textContent,'0 / 10 格');
 drop(e.get('roster-top').children[1],e.get('roster-bottom').children[0]);assert.equal(e.get('expedition-gold').textContent,'285 金幣');assert.match(e.get('expedition-message').textContent,/返回原位/);
 drop(e.get('roster-top').children[1],e.get('roster-bottom').children[5],true);assert.equal(e.get('expedition-gold').textContent,'285 金幣');
 drop(e.get('roster-top').children[1],null);assert.equal(e.get('expedition-gold').textContent,'285 金幣');
});
test('skill drafts preserve equipment until confirmation, reject stale choices and handle empty lists and missing icons',()=>{
 const {nodes:e,ui}=setup(),state=X.create(D.defaults,S.defaults);ui.bind(state);ui.open('gear');
 state.skills=[{...S.defaults[0],id:'draft',conditions:[],imagePath:'images/skills/missing.png',description:'完整技能說明\n第二行',cooldown:0}];
 e.get('roster-skill').click();const option=e.get('roster-skill-options').children[0],icon=option.children[0],image=icon.children[1];
 assert.equal(option.children.length,2);assert.equal(image.hidden,true);image.handlers.load();assert.equal(image.hidden,false);assert.equal(icon.children[0].hidden,true);image.handlers.error();assert.equal(image.hidden,true);assert.equal(icon.children[0].hidden,false);
 option.click();assert.equal(e.get('skill-selected-description').textContent,'完整技能說明\n第二行');assert.equal(e.get('skill-selected-cooldown').textContent,'冷卻時間：0 秒');assert.equal(state.skillId,null);
 e.get('roster-skill-menu').handlers.cancel({preventDefault(){}});assert.equal(state.skillId,null);
 e.get('roster-skill').click();e.get('roster-skill-options').children[0].click();state.skills=[];e.get('roster-skill-confirm').click();
 assert.equal(state.skillId,null);assert.equal(e.get('roster-skill-menu').open,true);assert.equal(e.get('roster-skill-confirm').disabled,true);assert.match(e.get('skill-picker-error').textContent,/不符合/);assert.equal(e.get('roster-skill-options').children.length,0);
});

test('clicks inspect without moving or purchasing, and shop hides skills',()=>{
 const {nodes:e,ui}=setup();ui.open('gear');assert.equal(e.get('roster-skill').hidden,false);
 e.get('roster-bottom').children[0].click();e.get('roster-top').children[3].click();assert.equal(e.get('roster-bottom-count').textContent,'3 / 10 格');assert.equal(e.get('roster-top-count').textContent,'0 / 10 格');
 e.get('roster-skill').click();ui.open('shop','click');assert.equal(e.get('roster-skill').hidden,true);assert.equal(e.get('roster-skill-menu').hidden,true);
 e.get('roster-top').children[0].click();e.get('roster-reserve').children[3].click();assert.equal(e.get('expedition-gold').textContent,'300 金幣');
 e.get('roster-bottom').children[0].click();assert.ok(e.get('roster-selected').textContent.includes('星'));e.get('roster-sell-zone').click();assert.equal(e.get('expedition-gold').textContent,'300 金幣');
});
test('drag preview copies the card, follows grab offset and is removed on cancel',()=>{
 const {nodes:e,ui,document:d}=setup();ui.open('gear');const source=e.get('roster-bottom').children[0];
 const event={button:0,pointerId:1,clientX:20,clientY:30,preventDefault(){}};source.handlers.pointerdown(event);
 d.handlers.pointermove({...event,clientX:70,clientY:90});const ghost=e.get('expedition-dialog').children.at(-1);
 assert.equal(ghost.children.length,source.children.length);assert.notEqual(ghost.children[0],source.children[0]);assert.equal(ghost.popoverOpen,true);assert.equal(ghost.style.width,'100px');assert.equal(ghost.style.left,'50px');assert.equal(ghost.style.top,'60px');
 d.handlers.pointermove({...event,clientX:120,clientY:150});assert.equal(ghost.style.left,'100px');assert.equal(ghost.style.top,'120px');d.handlers.pointercancel(event);assert.equal(ghost.removed,true);
});

test('law tab previews stock, chooses a target without moving it, buys and clears a sold target',()=>{
 const {nodes:e,ui,drop}=setup(),law={id:'power',name:'力量',shopPrice:50,shopWeight:100,stats:{damage:5},passives:[]},state=X.create(D.defaults,[],undefined,[law]);
 ui.bind(state);ui.open('shop','law-ui');e.get('shop-tab-laws').click();
 assert.equal(e.get('roster-top-section').hidden,true);assert.equal(e.get('law-shop-panel').hidden,false);assert.equal(e.get('roster-reserve-section').hidden,false);
 const buy=()=>e.get('law-shop-products').children.find(c=>c.children.some(n=>n.getAttribute('data-law-buy')))?.children.at(-1);
 assert.equal(buy().disabled,true);const id=state.active[0].instanceId;
 e.get('roster-bottom').children[0].click();assert.equal(e.get('law-target-select').hidden,false);e.get('law-target-select').click();assert.equal(state.active[0].instanceId,id);assert.equal(buy().disabled,false);
 buy().click();assert.equal(state.gold,250);assert.equal(state.active[0].laws.length,1);assert.match(e.get('law-target-laws').textContent,/力量/);
 drop(e.get('roster-bottom').children[0],e.get('roster-reserve').children[5]);buy().click();assert.equal(state.reserve[5].instanceId,id);assert.equal(state.reserve[5].laws.length,2);assert.equal(state.gold,200);
 const sell=e.get('roster-sell-zone');sell.setAttribute('data-drop-area','sell');drop(e.get('roster-reserve').children[5],sell);assert.equal(buy().disabled,true);assert.equal(e.get('law-target-clear').disabled,true);
 e.get('shop-tab-characters').click();assert.equal(e.get('roster-top-section').hidden,false);assert.equal(e.get('law-shop-panel').hidden,true);
});
test('dragging an owned character to the law target does not move or buy it; reopening keeps sold laws',()=>{
 const {nodes:e,ui,drop}=setup(),law={id:'power',name:'力量',shopPrice:50,shopWeight:100,stats:{maxHp:10},passives:[]},state=X.create(D.defaults,[],undefined,[law]);
 ui.bind(state);ui.open('shop','law-drop');e.get('shop-tab-laws').click();const zone=e.get('law-target-zone');zone.setAttribute('data-drop-area','law-target');const before=structuredClone(state.active);
 drop(e.get('roster-bottom').children[0],zone);assert.deepEqual(state.active,before);assert.equal(state.gold,300);assert.equal(e.get('law-target-clear').disabled,false);
 e.get('law-shop-products').children[0].children.at(-1).click();e.get('expedition-close').click();ui.open('shop','law-drop');e.get('shop-tab-laws').click();assert.equal(e.get('law-shop-products').children[0].children[0].textContent,'已售出');assert.equal(e.get('law-target-clear').disabled,true);
});

test('preparation exposes selling and owned drag targets merge manually in preparation and shop',()=>{
 for(const mode of ['gear','shop']){
  const {nodes:e,ui,drop,document:d}=setup(),state=X.create(D.defaults,[],{...require('../js/config.js').defaults,startingActive:[D.defaults[0].id,D.defaults[0].id,...Array(8).fill(null)]});
  ui.bind(state);ui.open(mode,'merge-ui');assert.equal(e.get('roster-sell-zone').hidden,false);const sourceId=state.active[0].instanceId,targetId=state.active[1].instanceId;
  const source=e.get('roster-bottom').children[0],target=e.get('roster-bottom').children[1],event={button:0,pointerId:1,clientX:40,clientY:50,preventDefault(){}};
  source.handlers.pointerdown(event);d.hit=target;d.handlers.pointermove({...event,clientX:100});assert.match(e.get('expedition-message').textContent,/放開以合成/);
  const cue=byClass(e.get('expedition-dialog'),'roster-merge-cue');assert.equal(cue.popoverOpen,true);assert.equal(cue.getAttribute('aria-label'),'放開以合成，1 星升至 2 星');assert.equal(state.active[1].stars,1);
  d.handlers.pointermove({...event,clientX:110});assert.equal(e.get('expedition-dialog').children.filter(n=>n.className==='roster-merge-cue').length,1);
  d.handlers.pointerup(event);assert.equal(cue.removed,true);
  assert.equal(state.active[0],null);assert.equal(state.active[1].instanceId,targetId);assert.notEqual(state.active[1].instanceId,sourceId);assert.equal(state.active[1].stars,2);assert.match(e.get('expedition-message').textContent,/升至 2 星/);
  const sell=e.get('roster-sell-zone');sell.setAttribute('data-drop-area','sell');drop(e.get('roster-bottom').children[1],sell);assert.equal(state.active[1],null);assert.equal(state.gold,315);
 }
});

test('shop reroll displays cumulative price, refreshes both tabs and keeps target and owned characters',()=>{
 const {nodes:e,ui}=setup(),law={id:'reroll-law',name:'強化',shopPrice:50,shopWeight:100,stats:{maxHp:10},passives:[]},state=X.create(D.defaults,[],undefined,[law]);
 ui.bind(state);ui.open('shop','reroll-ui');assert.match(e.get('shop-reroll').textContent,/20 金幣/);assert.equal(e.get('shop-controls').hidden,false);
 e.get('shop-tab-laws').click();e.get('roster-bottom').children[0].click();e.get('law-target-select').click();e.get('law-shop-products').children[0].children.at(-1).click();const owned=structuredClone({active:state.active,reserve:state.reserve});
 e.get('shop-reroll').click();assert.equal(state.gold,230);assert.deepEqual({active:state.active,reserve:state.reserve},owned);assert.match(e.get('shop-reroll').textContent,/30 金幣/);assert.equal(e.get('law-shop-products').children[0].children.at(-1).disabled,false);
 e.get('expedition-close').click();ui.open('shop','reroll-ui');assert.match(e.get('shop-reroll').textContent,/30 金幣/);ui.open('shop','other-ui');assert.match(e.get('shop-reroll').textContent,/20 金幣/);
 state.gold=0;ui.open('shop','other-ui');assert.equal(e.get('shop-reroll').disabled,true);const before=structuredClone(state);e.get('shop-reroll').click();assert.deepEqual(state,before);
 ui.open('gear');assert.equal(e.get('shop-controls').hidden,true);assert.match(e.get('expedition-progress').textContent,/回響等級 1/);
});

test('journey preparation uses concise resources, stars, job icons and custom multiline descriptions',()=>{
 const {nodes:e,ui}=setup('play.html'),state=X.create();state.active[0].description='揮劍造成傷害\n為自己施加護盾';state.active[0].stars=6;ui.bind(state);ui.open('gear');
 assert.equal(e.get('expedition-progress').textContent,'1');assert.equal(e.get('expedition-gold').textContent,'300');
 const card=e.get('roster-bottom').children[0],hud=card.children.find(n=>n.className==='reward-card-surface').children.find(n=>n.className==='roster-card-hud'),heading=hud.children[0];assert.equal(heading.children.length,3);assert.equal(card.children.find(n=>n.className==='roster-stars card-star-column').children.length,6);assert.equal(card.getAttribute('data-frame-job'),'melee');
 assert.equal(hud.children[1].children[0].children[1].textContent,String(state.active[0].maxHp));card.click();
 assert.equal(e.get('character-detail').open,true);assert.equal(e.get('detail-name').textContent,state.active[0].name);assert.equal(e.get('detail-effects').children.map(n=>n.textContent).join('\n'),state.active[0].description);e.get('character-detail').handlers.cancel({preventDefault(){}});assert.equal(e.get('character-detail').open,false);assert.equal(e.get('expedition-dialog').open,true);assert.equal(e.get('roster-effects').textContent,state.active[0].description);assert.match(e.get('roster-selected').textContent,/★★★★★★$/);assert.doesNotMatch(e.get('roster-selected').textContent,/格/);assert.equal(e.get('expedition-message').textContent,'');assert.equal(e.has('roster-cancel'),false);
});

test('journey shop keeps quiet feedback and law purchase requirements with shared wallet updates',()=>{
 const {nodes:e,ui,drop}=setup('play.html'),law={id:'power',name:'力量',shopPrice:50,shopWeight:100,stats:{maxHp:10},passives:[]},state=X.create(D.defaults,[],undefined,[law]);ui.bind(state);ui.open('shop','quiet');
 assert.equal(e.get('shop-wallet').textContent,'300');assert.equal(e.get('expedition-title').textContent,'商店');assert.equal(e.get('roster-sell-zone').hidden,false);e.get('roster-top').children[0].click();assert.equal(e.get('roster-buy').hidden,true);assert.equal(e.get('character-detail').open,false);assert.equal(state.gold,300);assert.equal(e.get('shop-reroll-note').textContent,'');assert.equal(e.get('shop-reroll').getAttribute('aria-label'),'重骰角色與法則商品，20 金幣');assert.equal(e.get('shop-reroll').children[0].children[1].className,'currency-crystal');assert.equal(e.get('roster-reserve-section').hidden,false);
 e.get('shop-tab-laws').click();const zone=e.get('law-target-zone');zone.setAttribute('data-drop-area','law-target');
 const buy=()=>e.get('law-shop-products').children.find(c=>c.getAttribute('data-law-buy')==='0');
 assert.equal(buy().disabled,true);assert.equal(byClass(buy(),'law-price').getAttribute('aria-label'),'50 金幣');assert.equal(e.get('law-target-name').textContent,'');assert.equal(e.get('law-target-art').children[0].className,'law-target-placeholder');assert.equal(e.get('roster-sell-zone').hidden,true);
 drop(e.get('roster-bottom').children[0],zone);assert.equal(buy().disabled,false);assert.equal(e.get('law-target-summary').textContent,'');assert.match(e.get('law-target-name').textContent,/★/);
 buy().click();assert.equal(state.gold,250);assert.equal(state.active[0].laws.length,1);assert.equal(e.get('expedition-gold').textContent,'250');assert.equal(e.get('shop-wallet').textContent,'250');assert.equal(buy().disabled,true);assert.equal(e.get('law-target-art').children.length,1);e.get('shop-tab-characters').click();assert.equal(e.get('roster-sell-zone').hidden,false);assert.equal(e.get('expedition-message').textContent,'');
});

test('law shop shows name price description and art in workshop and journey',()=>{
 for(const page of ['editor.html','play.html']){
 const {nodes:e,ui}=setup(page),law={id:'art',name:'圖案法則',description:'敘述\n第二行',imagePath:'images/laws/test.png',shopPrice:25,shopWeight:1,stats:{},passives:[]},state=X.create(D.defaults,[],undefined,[law]);ui.bind(state);ui.open('shop','art');e.get('shop-tab-laws').click();const card=e.get('law-shop-products').children[0],art=card.children.find(n=>n.className==='law-product-art'),image=art.children[1],description=byClass(card,'law-description');assert.equal((page==='play.html'?byClass(card,'law-card-name'):card.children[0]).textContent,law.name);assert.equal(description.textContent,law.description);assert.equal(image.src,law.imagePath);assert.equal(image.hidden,true);image.handlers.load();assert.equal(image.hidden,false);assert.equal(art.children[0].hidden,true);image.handlers.error();assert.equal(image.hidden,true);assert.equal(art.children[0].hidden,false);assert.equal(page==='play.html'?byClass(card,'law-price').getAttribute('aria-label'):byClass(card,'law-price').textContent,'25 金幣');
 }
});

test('journey inspection lists every equipped law, including duplicates, full descriptions and attribute changes',()=>{
 const {nodes:e,ui}=setup('play.html'),state=X.create(D.defaults,[]),description='完整效果第一行\n'+('法則長敘述。'.repeat(80));
 state.active[0].laws=Array.from({length:5},(_,i)=>({id:'same-law',name:'重複法則 '+i,description,stats:{maxHp:i},passives:[]}));
 ui.bind(state);ui.open('shop','full-law-list');e.get('roster-bottom').children[0].click();
 const entries=e.get('roster-laws').children.filter(n=>n.className==='shop-equipped-law');assert.equal(entries.length,5);
 entries.forEach((entry,i)=>{const text=entry.children[1];assert.equal(text.children[0].textContent,'重複法則 '+i);assert.equal(text.children.find(n=>n.className==='shop-equipped-description').textContent,description);if(i)assert.match(text.children.find(n=>n.className==='shop-equipped-attributes').textContent,new RegExp('\\+'+i));});
});
