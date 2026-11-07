const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

class Element{
 constructor(){this.children=[];this.handlers={};this.attributes={};this.hidden=false;this.open=false;}
 setAttribute(key,value){this.attributes[key]=value;}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children;}
 addEventListener(type,fn){this.handlers[type]=fn;}
 focus(){this.focused=true;}
 showModal(){this.open=true;}
 close(){this.open=false;}
 click(){this.handlers.click?.();}
}

function setup(reward,options={}){
 const ids=['journey-reward','reward-options','reward-warning','reward-empty','reward-continue','reward-gear','reward-hub','reward-money','reward-characters','reward-money-dialog','reward-money-amount','reward-money-close','reward-back','reward-hub-close','reward-confirm','reward-skip','reward-inspect','reward-description-scroll','reward-selected','reward-effects','reward-laws'];
 const nodes=new Map(ids.map(id=>[id,new Element()]));
 const context=vm.createContext({DialogDismiss:require('../js/dialog-dismiss.js'),CharacterArt:require('../js/character-art.js')});
 vm.runInContext(fs.readFileSync('js/journey-reward-ui.js','utf8'),context);
 const calls={preparation:0,claims:[],skips:[],finished:[]};
 let full=true;
 const ui=context.JourneyRewardUI.create({
  document:{getElementById:id=>nodes.get(id),createElement:()=>new Element()},
  ...options,
  describeEffect:effect=>effect.type,
  getReward:()=>reward,
  claim(token,index){
   calls.claims.push([token,index]);
   if(index!==null&&full)throw Error('請先按整備隊伍清理空間。');
   const result=index===null?null:{unit:reward.choices[index]};
   reward=null;
   return result;
  },
  skip(token){calls.skips.push(token);if(options.skipError)throw Error('放棄失敗');reward=null;return {skipped:true,gold:10};},
  openPreparation(){calls.preparation++;full=false;},
  onClaim:result=>calls.finished.push(result)
 });
 return {ui,nodes,calls};
}

test('reward preparation preserves visible options and allows retry after a capacity warning',()=>{
 const unit={name:'角色',stars:1,rarity:'SR',job:'守護',space:1,race:'人類',affinity:'物理',maxHp:100,cooldown:2,effects:[]};
 const {ui,nodes:n,calls}=setup({token:'battle',choices:[unit],gold:40});ui.show();n.get('reward-characters').click();
 const card=n.get('reward-options').children[0],button=card;
 button.click();assert.equal(calls.claims.length,0);assert.equal(n.get('reward-confirm').disabled,false);n.get('reward-confirm').click();assert.equal(n.get('journey-reward').open,true);assert.equal(n.get('reward-warning').hidden,false);assert.match(n.get('reward-warning').textContent,/整備/);assert.equal(calls.finished.length,0);
 let prevented=false;n.get('journey-reward').handlers.cancel({preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(n.get('reward-hub').open,true);n.get('reward-characters').click();
 n.get('reward-gear').click();assert.equal(calls.preparation,1);assert.equal(n.get('reward-options').children.length,1);
 n.get('reward-confirm').click();assert.equal(n.get('journey-reward').open,false);assert.equal(calls.finished.length,1);assert.equal(calls.finished[0].unit,unit);
});

test('empty reward acknowledgement closes once and does not invent a character',()=>{
 const {ui,nodes:n,calls}=setup({token:'empty',choices:[]});ui.show();n.get('reward-characters').click();
 assert.equal(n.get('reward-options').children.length,0);assert.equal(n.get('reward-empty').hidden,false);assert.equal(n.get('reward-continue').hidden,false);
 n.get('reward-continue').click();n.get('reward-continue').click();
 assert.deepEqual(calls.claims,[['empty',null]]);assert.deepEqual(calls.finished,[null]);assert.equal(n.get('journey-reward').open,false);ui.show();assert.equal(n.get('journey-reward').open,false);
});

test('skip works without choosing a card and still requires base money acknowledgement',()=>{
 const unit={name:'角色',stars:1,rarity:'SR',job:'守護',space:1,race:'人類',affinity:'物理',maxHp:10,effects:[]};
 const {ui,nodes:n,calls}=setup({token:'skip',choices:[unit],gold:40});ui.show();n.get('reward-characters').click();assert.equal(n.get('reward-skip').hidden,false);
 n.get('reward-skip').click();n.get('reward-skip').click();assert.deepEqual(calls.skips,['skip']);assert.equal(calls.claims.length,0);assert.equal(n.get('journey-reward').open,false);assert.equal(ui.pending(),true);assert.equal(n.get('reward-characters').disabled,true);
 n.get('reward-money').click();assert.equal(n.get('reward-money-amount').textContent,'40');n.get('reward-money-close').click();assert.equal(ui.pending(),false);
});

test('skip failure preserves options for retry; empty rewards cannot produce skip bonus',()=>{
 const unit={name:'角色',stars:1,rarity:'SR',job:'守護',space:1,race:'人類',affinity:'物理',maxHp:10,effects:[]},options={skipError:true};
 const {ui,nodes:n,calls}=setup({token:'retry-skip',choices:[unit],gold:40},options);ui.show();n.get('reward-characters').click();n.get('reward-skip').click();assert.equal(n.get('journey-reward').open,true);assert.match(n.get('reward-warning').textContent,/放棄失敗/);assert.equal(n.get('reward-options').children.length,1);options.skipError=false;n.get('reward-skip').click();assert.equal(n.get('journey-reward').open,false);assert.equal(calls.finished.length,1);
 const empty=setup({token:'empty-skip',choices:[]});empty.ui.show();empty.nodes.get('reward-characters').click();assert.equal(empty.nodes.get('reward-skip').hidden,true);empty.nodes.get('reward-skip').click();assert.equal(empty.calls.skips.length,0);
});

test('approved icons are production defaults; candidate overrides and SVG fallback stay explicit',()=>{
 const unit={name:'圖示',stars:2,job:'守護',race:'機人',affinity:'精神',maxHp:100,attack:0,effects:[]};
 const descendants=el=>[el,...el.children.flatMap(descendants)];
 for(const iconAssetBase of [undefined,'./assets/ui/card-icons/approved-v1/','']){
  const expectedBase=iconAssetBase===undefined?'assets/ui/card-icons/approved-v1/':iconAssetBase;
  const {ui,nodes}=setup({token:'icons',choices:[unit]},iconAssetBase===undefined?{}:{iconAssetBase});
  ui.show();nodes.get('reward-characters').click();
  const all=descendants(nodes.get('reward-options').children[0]),icons=all.filter(n=>n.src?.startsWith(expectedBase)&&n.className!=='reward-card-frame');
  assert.equal(icons.length,expectedBase?6:0);
  assert.equal(all.filter(n=>n.attributes['data-card-icon']).length,expectedBase?4:0);
  for(const icon of icons)assert.ok(fs.existsSync(icon.src));
 }
});

test('companion cards inspect without claiming and confirmation uses the latest selection',()=>{
 const base={stars:2,job:'守護',race:'人類',affinity:'暗',maxHp:100,effects:[]};
 const first={...base,name:'甲',space:2,description:'甲的行動'},second={...base,name:'乙',space:3,description:'乙的行動'};
 const {ui,nodes:n,calls}=setup({token:'inspect',choices:[first,second]});ui.show();n.get('reward-characters').click();
 assert.equal(n.get('reward-options').children[0].attributes.style,'--reward-space:2');assert.equal(n.get('reward-options').children[1].attributes.style,'--reward-space:3');
 assert.equal(n.get('reward-confirm').disabled,true);n.get('reward-confirm').click();assert.equal(calls.claims.length,0);
 n.get('reward-options').children[0].click();assert.equal(n.get('reward-effects').textContent,'甲的行動');
 n.get('reward-options').children[1].click();assert.equal(n.get('reward-effects').textContent,'乙的行動');assert.equal(calls.claims.length,0);
 assert.equal(n.get('reward-options').children[0].attributes['aria-pressed'],'false');assert.equal(n.get('reward-options').children[1].attributes['aria-pressed'],'true');
 n.get('reward-gear').click();n.get('reward-confirm').click();assert.deepEqual(calls.claims,[['inspect',1]]);assert.equal(calls.finished[0].unit,second);
 n.get('reward-confirm').click();assert.equal(calls.claims.length,1);
});

test('reward hub shows money once and keeps character choice independent',()=>{
 const unit={name:'角色',stars:1,rarity:'SR',job:'守護',race:'人類',affinity:'物理',maxHp:10,cooldown:1,effects:[]};
 const {ui,nodes:n,calls}=setup({token:'hub',choices:[unit],gold:90});ui.show();assert.equal(n.get('reward-hub').open,true);assert.equal(n.get('journey-reward').open,false);
 assert.equal(n.get('reward-money').textContent,'水晶');assert.equal(n.get('reward-characters').textContent,'魔女');
 n.get('reward-money').click();assert.equal(n.get('reward-money-amount').textContent,'90');assert.equal(n.get('reward-money-amount').attributes['aria-label'],'獲得 90 水晶');assert.equal(calls.claims.length,0);n.get('reward-money-close').click();assert.equal(n.get('reward-money').disabled,true);assert.equal(n.get('reward-money').textContent,'水晶');
 n.get('reward-characters').click();n.get('reward-gear').click();n.get('reward-options').children[0].click();n.get('reward-confirm').click();assert.equal(calls.finished.length,1);assert.equal(n.get('reward-hub').open,false);assert.equal(ui.pending(),false);ui.show();assert.equal(n.get('reward-money').disabled,true);assert.equal(n.get('reward-characters').textContent,'魔女');
});

test('claiming character first cannot finish until money is acknowledged; hub Escape is blocked',()=>{
 const unit={name:'角色',stars:1,rarity:'SR',job:'守護',race:'人類',affinity:'物理',maxHp:10,cooldown:1,effects:[]};
 const {ui,nodes:n}=setup({token:'character-first',choices:[unit],gold:40});ui.show();let prevented=false;n.get('reward-hub').handlers.cancel({preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(ui.pending(),true);
 n.get('reward-characters').click();n.get('reward-gear').click();n.get('reward-options').children[0].click();n.get('reward-confirm').click();assert.equal(ui.pending(),true);assert.equal(n.get('reward-hub').open,true);
 n.get('reward-money').click();assert.equal(ui.pending(),true);n.get('reward-money-close').click();assert.equal(ui.pending(),false);assert.equal(n.get('reward-hub').open,false);
});

test('reward raster frames cover all professions and rarities without changing footprints or zero attack',()=>{
 const jobs={'破陣':'melee','飛襲':'ranged','守護':'tank','支援':'healer'};
 const descendants=el=>[el,...el.children.flatMap(descendants)];
 for(const [job,key] of Object.entries(jobs))for(const rarity of ['SR','SSR','UR']){
  const unit={name:'框測試',stars:3,rarity,job,space:2,race:'機人',affinity:'精神',maxHp:100,attack:0,effects:[]};
  const before=JSON.stringify(unit),{ui,nodes}=setup({token:job+rarity,choices:[unit]});ui.show();nodes.get('reward-characters').click();
  const card=nodes.get('reward-options').children[0],all=descendants(card);
  const frame=all.find(n=>n.className==='reward-card-frame');
  assert.equal(frame.src,'assets/ui/card-frames/v3/'+key+'-'+rarity.toLowerCase()+'.png');assert.ok(fs.existsSync(frame.src));
  assert.equal(card.attributes.style,'--reward-space:2');assert.equal(card.attributes['data-rarity'],rarity);
  for(const label of ['機人','精神','攻擊力 0','血量 100'])assert.ok(all.some(n=>n.attributes['aria-label']===label),label);
  assert.equal(JSON.stringify(unit),before);
 }
});

test('low and none tiers skip character acknowledgement and none needs no reward dialogs',()=>{
 for(const tier of ['low','none']){let completed=0;const {ui,nodes:n,calls}=setup({token:tier,rewardTier:tier,gold:tier==='low'?8:0,choices:[]},{onComplete:()=>completed++});ui.show();assert.deepEqual(calls.claims,[[tier,null]]);assert.equal(n.get('journey-reward').open,false);if(tier==='none'){assert.equal(ui.pending(),false);assert.equal(n.get('reward-hub').open,false);assert.equal(completed,1);}else{assert.equal(n.get('reward-hub').open,true);assert.equal(n.get('reward-characters').disabled,true);n.get('reward-money').click();assert.equal(n.get('reward-money-amount').textContent,'8');n.get('reward-money-close').click();assert.equal(ui.pending(),false);assert.equal(completed,1);}}
});
