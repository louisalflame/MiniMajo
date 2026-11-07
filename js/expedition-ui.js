(() => {
 'use strict';
 const $=id=>document.getElementById(id),names={active:'出戰隊伍',reserve:'儲存隊伍'};
 let expedition,mode='gear',shopKey='',bottom='active',selection=null,opener=null,drag=null,suppressClickUntil=0,shopTab='characters',lawTarget=null;
 const immersive=!!document.getElementById('journey-map');
 let pendingSkillId=null;
 const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 function alignPreparationDividers(){
  if(!$('expedition-dialog').open||typeof document.querySelectorAll!=='function')return;
  for(const heading of document.querySelectorAll('#expedition-dialog .roster-row>.roster-heading')){
   const right=heading.querySelector('.raster-divider:not(.raster-divider-left)'),board=heading.closest('.roster-row').querySelector('.roster-grid');
   if(!right||!board||right.children.length<5)continue;
   const row=board.getBoundingClientRect(),start=right.getBoundingClientRect(),cap=right.children[0].getBoundingClientRect(),center=right.children[2].getBoundingClientRect();
   if(!row.width||!start.width)continue;
   const leading=Math.max(0,row.left+row.width/2-start.left-cap.width-center.width/2);
   right.style.setProperty('--divider-leading-width',leading+'px');
  }
 }
 if(typeof ResizeObserver==='function'){
  const dividerObserver=new ResizeObserver(alignPreparationDividers);
  for(const heading of document.querySelectorAll('#expedition-dialog .roster-row>.roster-heading')){dividerObserver.observe(heading);dividerObserver.observe(heading.querySelector('h3'));}
 }
 function cardValue(kind,value,label){
  const row=node('span','roster-extra roster-'+kind),icon=node('span','roster-stat-icon');icon.setAttribute('aria-hidden','true');
  const path=kind==='price'?'M4 7c0-5 16-5 16 0s-16 5-16 0Zm0 0v10c0 5 16 5 16 0V7M4 12c0 5 16 5 16 0':'M12 21 3.5 12.5C-2 6 6 0 12 7c6-7 14-1 8.5 5.5Z';
  icon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+path+'"/></svg>';
  row.setAttribute('aria-label',label+' '+value);row.title=label+' '+value;row.append(icon,node('span','roster-value',String(value)));return row;
 }
 function reset(){
  closeSkillMenu(false);
  clearDrag();
  let characters=ItemDB.defaults;try{characters=ItemDB.read(localStorage).items;}catch{}
  expedition=Expedition.create(characters,SkillEditor.getSkills(),GameConfig.read(localStorage),Laws.read(localStorage).laws,EchoLevels.read(localStorage));selection=null;lawTarget=null;
  if($('expedition-dialog').open)$('expedition-dialog').close();
 }
 function status(text,important=false){$('expedition-message').textContent=immersive&&!important?'':text;}
 function commitDrop(source,target){
  try{
   const previous=expedition.skillId;let message;
   if(target.area==='law-target'){
    if(mode!=='shop'||shopTab!=='laws'||!['active','reserve'].includes(source.area))throw Error('請拖入自己隊伍中的角色。');
    const unit=expedition[source.area][source.slot];if(!unit)throw Error('找不到這名角色。');lawTarget=unit.instanceId;message='法則將裝備給 '+unit.name+'；角色保留在原隊伍。';
   }else if(target.area==='sell'){
    if(source.area==='stock')throw Error('只能賣出自己隊伍中的角色。');
    message='已賣出角色，獲得 '+Expedition.sell(expedition,source.area,source.slot)+' 金幣。';
   }else if(!['active','reserve'].includes(target.area))throw Error('請拖到出戰隊伍或儲存隊伍。');
   else if(source.area==='stock'){
    Expedition.buy(expedition,shopKey,source.slot,target.area,target.slot);message='購買成功，已放入'+names[target.area]+'。';
   }else{
    const upgraded=Expedition.transfer(expedition,source.area,source.slot,target.area,target.slot);
    if(upgraded){if(lawTarget===source.unit.instanceId)lawTarget=upgraded.instanceId;message=upgraded.name+' 已升至 '+upgraded.stars+' 星，雙方全部法則已合併。';}else message='角色已移動／交換。';
   }
   selection=null;const lostSkill=previous&&!expedition.skillId;status(immersive&&lostSkill?'原極式已不符合出戰條件，請重新裝備。':message+(lostSkill?'原極式已不符合出戰條件，請重新裝備。':''),!!lostSkill);render();return true;
  }catch(error){status(error.message+(immersive?'':' 角色已返回原位。'),true);return false;}
 }
 function clearMergePreview(){
  if(!drag)return;
  drag.mergeTarget?.classList.remove('merge-hover');drag.ghost?.classList.remove('merge-preview');drag.mergeCue?.remove();drag.mergeCue=null;drag.mergeTarget=null;
 }
 function placeMergeCue(){
  if(!drag?.mergeCue||!drag.mergeTarget)return;
  const rect=drag.mergeTarget.getBoundingClientRect(),viewport=globalThis.innerWidth??1024,width=Math.min(178,viewport-16);
  drag.mergeCue.style.width=width+'px';drag.mergeCue.style.left=Math.max(8,Math.min(viewport-width-8,rect.left+rect.width/2-width/2))+'px';
  drag.mergeCue.style.top=Math.max(8,rect.top-72)+'px';
 }
 function showMergePreview(target,unit){
  if(drag.mergeTarget!==target){
   clearMergePreview();drag.mergeTarget=target;target.classList.add('merge-hover');drag.ghost.classList.add('merge-preview');
   const cue=node('div','roster-merge-cue'),stars=node('span','roster-merge-stars'),star=node('img','');
   star.src='assets/ui/card-icons/approved-v1/star.png';star.alt='';star.setAttribute('aria-hidden','true');
   stars.append(star,node('span','',unit.stars+' → '+(unit.stars+1)));
   cue.append(node('strong','','放開升星'),stars);cue.setAttribute('popover','manual');cue.setAttribute('role','status');cue.setAttribute('aria-live','polite');cue.setAttribute('aria-label','放開以合成，'+unit.stars+' 星升至 '+(unit.stars+1)+' 星');
   drag.mergeCue=cue;$('expedition-dialog').append(cue);cue.showPopover?.();
  }
  placeMergeCue();
 }
 document.addEventListener('scroll',placeMergeCue,true);
 globalThis.addEventListener?.('resize',placeMergeCue);
 function clearDrag(){
  if(!drag)return;
  clearMergePreview();for(const el of drag.mergeCandidates??[])el.classList.remove('merge-candidate');
  drag.source.classList.remove('drag-source');drag.target?.classList.remove('drop-hover');drag.target?.classList.remove('merge-hover');drag.ghost?.remove();drag.marker?.remove();
  if(drag.source.hasPointerCapture?.(drag.pointerId))drag.source.releasePointerCapture(drag.pointerId);
  drag=null;
  $('roster-sell-zone').textContent=immersive?'出售':'拖曳自己的角色至此賣出 · 返還商店售價 '+expedition.config.sellPercent+'%';
 }
 function beginDrag(event,source,area,slot,unit){
  if(event.button!==0||drag)return;
  const rect=source.getBoundingClientRect();
  drag={source,area,slot,unit,pointerId:event.pointerId,x:event.clientX,y:event.clientY,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top,width:rect.width,height:rect.height,started:false};
  source.setPointerCapture?.(event.pointerId);
 }
 function dropTarget(event){
  const el=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-drop-area]');
  if(!el||!$('expedition-dialog').contains(el))return null;
  const area=el.getAttribute('data-drop-area');let slot=Number(el.getAttribute('data-drop-slot'));
  const host=area==='active'?$('roster-bottom'):area==='reserve'?(mode==='shop'?$('roster-reserve'):$('roster-top')):null;
  if(host&&typeof getComputedStyle==='function'){
   const rect=host.getBoundingClientRect(),gapValue=getComputedStyle(host).columnGap;
   const gap=(parseFloat(gapValue)||0)*(gapValue.endsWith('%')?rect.width/100:1),pitch=(rect.width+gap)/10;
   if(pitch>0)slot=Math.round((event.clientX-drag.offsetX-rect.left)/pitch);
   const hitStart=Number(el.getAttribute('data-drop-slot')),hitUnit=expedition[area][hitStart];
   if(drag.area!=='stock'&&hitUnit&&hitUnit.instanceId!==drag.unit.instanceId)slot=hitStart;
   if(drag.area!==area)slot=Math.max(0,Math.min(9,slot));
  }
  return {el,area,slot,host};
 }
 document.addEventListener('pointermove',event=>{
  if(!drag||drag.pointerId!==event.pointerId)return;
  if(!drag.started&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<6)return;
  event.preventDefault();
  if(!drag.started){
   drag.started=true;drag.source.classList.add('drag-source');
   drag.ghost=node('div','roster-tile roster-drag-ghost');
   drag.ghost.setAttribute('data-card-skin','approved');
   drag.ghost.setAttribute('aria-hidden','true');drag.ghost.setAttribute('popover','manual');
   drag.ghost.append(...Array.from(drag.source.children,child=>child.cloneNode(true)));
   drag.ghost.style.width=drag.width+'px';drag.ghost.style.height=drag.height+'px';
   $('expedition-dialog').append(drag.ghost);
   // Put the preview above the modal and outside its scrolling clip.
   drag.ghost.showPopover?.();
   drag.mergeCandidates=[];
   if(drag.area!=='stock')for(const id of ['roster-top','roster-bottom','roster-reserve'])for(const el of $(id).children){
    const area=el.getAttribute('data-drop-area'),slot=Number(el.getAttribute('data-drop-slot'));
    if(['active','reserve'].includes(area)&&Expedition.canMerge(drag.unit,expedition[area][slot])){el.classList.add('merge-candidate');drag.mergeCandidates.push(el);}
   }
  }
  drag.ghost.style.left=(event.clientX-drag.offsetX)+'px';drag.ghost.style.top=(event.clientY-drag.offsetY)+'px';
  drag.target?.classList.remove('drop-hover');
  const drop=dropTarget(event);drag.target=drop?.el;if(!(drop?.area==='sell'&&drag.area==='stock'))drag.target?.classList.add('drop-hover');
  const area=drop?.area,slot=drop?.slot;
  drag.marker?.remove();drag.marker=null;
  const visualSlot=drop?.host&&drag.area!=='stock'?Expedition.transferSlot(expedition,drag.area,drag.slot,area,slot):slot;
  if(drop?.host&&visualSlot>=0&&visualSlot+drag.unit.space<=10){
   drag.marker=node('span','roster-drop-marker');drag.marker.setAttribute('aria-hidden','true');drag.marker.style.gridColumn=(visualSlot+1)+' / span '+drag.unit.space;drop.host.append(drag.marker);
  }
  const owner=['active','reserve'].includes(area)?Expedition.ownerSlot(expedition[area],slot):-1;
  const targetUnit=owner>=0?expedition[area][owner]:null;
  if(drag.area!=='stock'&&Expedition.canMerge(drag.unit,targetUnit)){showMergePreview(drag.target,targetUnit);status('放開以合成 '+targetUnit.name+'：'+targetUnit.stars+' → '+(targetUnit.stars+1)+' 星，保留目標位置並合併全部法則。');}
  else{clearMergePreview();if(['active','reserve'].includes(area))status(targetUnit?'放開以交換角色；合成需要相同角色與星等，最高六星。':'放開以放置角色。');}
  const sellZone=$('roster-sell-zone');
  if(drag.area==='stock'){
   sellZone.textContent=immersive?'出售':'商品不能直接賣出';
  }else{
   const amount=Expedition.sellValue(drag.unit,expedition.config);
   const label=node('span','',immersive?'出售 ':'放開以賣出 '+drag.unit.name+' · ');
   const crystal=node('span','currency-crystal');
   crystal.setAttribute('role','img');
   crystal.setAttribute('aria-label','水晶');
   label.append(crystal,node('span','',' +'+amount));
   sellZone.replaceChildren(label);
  }
  const dialog=$('expedition-dialog'),rect=dialog.getBoundingClientRect();
  if(event.clientY<rect.top+65)dialog.scrollTop-=18;else if(event.clientY>rect.bottom-65)dialog.scrollTop+=18;
  const scroll=$('roster-top').closest('.roster-scroll'),r=scroll.getBoundingClientRect();
  if(event.clientX<r.left+35)scroll.scrollLeft-=18;else if(event.clientX>r.right-35)scroll.scrollLeft+=18;
 },{passive:false});
 document.addEventListener('pointerup',event=>{
  if(!drag||drag.pointerId!==event.pointerId)return;
  const target=dropTarget(event),current=drag,started=drag.started;clearDrag();
  if(!started)return;suppressClickUntil=Date.now()+400;
  const success=target&&commitDrop(current,target);
  if(!success){current.source.classList.remove('drop-rejected');void current.source.offsetWidth;current.source.classList.add('drop-rejected');if(!target)status('已取消拖曳，角色返回原位。');}
 });
 document.addEventListener('pointercancel',()=>clearDrag());
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&drag){event.preventDefault();clearDrag();status('已取消拖曳，角色返回原位。');}});
 function board(id,area){
  const host=$(id),items=area==='stock'?Expedition.shop(expedition,shopKey):expedition[area],tiles=[];let used=0;
  for(let slot=0;slot<10;){const unit=items[slot],at=slot,button=node('button','roster-tile'+(unit?' occupied':' vacant'));button.type='button';button.setAttribute('data-drop-area',area);button.setAttribute('data-drop-slot',String(slot));if(unit)button.addEventListener('pointerdown',event=>beginDrag(event,button,area,at,unit));button.setAttribute('data-roster-key',area+'-'+slot);button.style.gridColumn=(slot+1)+' / span '+(unit?.space||1);button.setAttribute('aria-pressed',String(selection?.area===area&&selection.slot===slot));
   button.append(node('small','roster-slot',String(slot+1).padStart(2,'0')+(unit&&unit.space>1?'–'+String(slot+unit.space).padStart(2,'0'):'')));
   if(unit){
    used+=unit.space;
    const hud=node('span','roster-card-hud'),values=node('span','roster-card-values');
    values.append(CharacterCardSkin.stat(document,'health',unit.maxHp,'血量'),CharacterCardSkin.stat(document,'attack',Number.isFinite(unit.attack)?unit.attack:10,'攻擊力'));
    hud.append(CharacterCardSkin.heading(document,unit),values);
    if(area==='stock')hud.append(cardValue('price',unit.price,'金幣'));
    CharacterCardSkin.mount(document,button,unit,CharacterArt.create(document,unit,'roster-art'),hud);
    button.setAttribute('aria-label',unit.name+'，'+unit.job+'，'+unit.stars+' 星，血量 '+unit.maxHp+'，第 '+(slot+1)+' 格起，佔 '+unit.space+' 格'+(area==='stock'?'，售價 '+unit.price+' 金幣':''));
   }
   else{button.append(node('span','',area==='stock'?'無商品':'空位'));button.setAttribute('aria-label','第 '+(slot+1)+' 格，'+(area==='stock'?'無商品':'可放置角色'));}
   button.addEventListener('click',()=>{
    if(Date.now()<suppressClickUntil)return;
    selection=unit?{area,slot:at}:null;status(immersive?'':unit?'點擊僅檢視角色；拖到同角色同星等可合成升星，其他位置可搬移、交換或購買。':'將角色拖曳到空位以放置。');render();if(immersive&&mode==='gear'&&unit){CharacterDetails.render(document,unit);$('character-detail').hidden=false;$('character-detail').showModal();}
   });tiles.push(button);slot+=unit?.space||1;
  }
  host.replaceChildren(...tiles);return used;
 }
 function lawSummary(law){return ItemDB.growthFields.map((f,i)=>law.stats[f]?ItemDB.growthLabels[i]+' '+(law.stats[f]>0?'+':'')+law.stats[f]:'').filter(Boolean).join('、')||'無永久屬性增減';}
 function lawPanelSkin(){const skin=node('span','law-panel-skin');skin.setAttribute('aria-hidden','true');for(let i=0;i<9;i++)skin.append(node('i'));return skin;}
 function renderLaws(){
  const target=Expedition.findOwned(expedition,lawTarget);if(!target)lawTarget=null;
  $('law-target-name').textContent=target?target.unit.name+' · '+(immersive?'★'.repeat(target.unit.stars):target.unit.stars+' 星'):(immersive?'':'先將自己的角色拖曳至此');
  $('law-target-summary').textContent=immersive?'':target?names[target.area]+'第 '+(target.slot+1)+' 格 · HP '+target.unit.maxHp+' · 冷卻 '+target.unit.cooldown+' 秒':'從下方出戰或儲存隊伍選擇角色。';
  $('law-target-laws').textContent=immersive?'':target?'已裝備 '+(target.unit.laws?.length??0)+' 份法則'+(target.unit.laws?.length?'：'+target.unit.laws.map(l=>l.name).join('、'):''):'';
  if($('law-target-clear'))$('law-target-clear').disabled=!target;
  if(immersive){renderLawCards(target);return;}
  const stock=Expedition.lawShop(expedition,shopKey),cards=stock.map((law,slot)=>{
   const card=node('article','law-product');if(!law){card.append(node('strong','','已售出'));return card;}
   card.append(node('h3','',law.name),lawArt(law),node('p','law-description',law.description),node('p','',lawSummary(law)));
   const reason=!target?'先選擇裝備角色':expedition.gold<law.price?'金幣不足':'';
   const buy=node('button','primary',immersive?'購買 · '+law.price+' 金幣':reason||'購買並裝備給 '+target.unit.name);buy.type='button';buy.disabled=!!reason;buy.setAttribute('data-law-buy',String(slot));buy.setAttribute('aria-label',law.name+' · '+law.price+' 金幣 · '+(reason||'裝備給 '+target.unit.name));buy.setAttribute('title',reason||'裝備給 '+target.unit.name);
   buy.addEventListener('click',()=>{try{const unit=Expedition.buyLaw(expedition,shopKey,slot,lawTarget);status('已花費 '+law.price+' 金幣，將「'+law.name+'」裝備給 '+unit.name+'。');render();}catch(error){status(error.message,true);}});
   if(!immersive)card.append(node('strong','law-price',law.price+' 金幣'));card.append(buy);return card;
  });
  $('law-shop-products').replaceChildren(...cards);if(!stock.length)$('law-shop-products').append(node('p','expedition-note',immersive?'暫無法則':'這間商店沒有可販售的法則。'));
 }
 function lawArt(law){
  const box=node('span','law-product-art'),placeholder=node('span','law-art-placeholder','圖案待提供');box.append(placeholder);
  if(law.imagePath&&Laws.validImagePath(law.imagePath)){
   const image=node('img','law-product-image');image.alt=law.name;image.hidden=true;
   image.addEventListener('load',()=>{image.hidden=false;placeholder.hidden=true;});image.addEventListener('error',()=>{image.hidden=true;placeholder.hidden=false;});
   image.src=law.imagePath.split('/').map(encodeURIComponent).join('/');box.append(image);
  }
  return box;
 }
 function renderLawCards(target){
  const art=$('law-target-art');art.replaceChildren();
  if(target){
   const card=CharacterArt.create(document,target.unit,'law-recipient-card','span',{detail:true});card.setAttribute('data-space',String(target.unit.space));
   art.append(card);
  }else{const placeholder=node('span','law-target-placeholder'),icon=node('img');icon.src='assets/ui/card-icons/approved-v1/human.png';icon.alt='';placeholder.append(icon,node('span','','拖曳角色至此'));art.append(placeholder);}
  $('law-target-zone').setAttribute('aria-label',target?'裝備給 '+target.unit.name:'拖入要裝備法則的角色');
  if(target)$('law-target-name').append(lawPanelSkin());
  const stock=Expedition.lawShop(expedition,shopKey);
  const cards=stock.map((law,slot)=>{
   const card=node('button','law-product law-card');card.type='button';card.setAttribute('data-law-buy',String(slot));
   if(!law){card.disabled=true;card.setAttribute('data-sold','true');card.append(node('span','law-sold-label','已售出'),lawPanelSkin());return card;}
   const reason=!target?'先選擇裝備角色':expedition.gold<law.price?'金幣不足':'';card.disabled=!!reason;
   card.setAttribute('aria-label',law.name+' · '+law.price+' 金幣 · '+(reason||'購買並裝備給 '+target.unit.name));card.setAttribute('title',reason||'購買並裝備給 '+target.unit.name);
   const heading=node('span','law-card-header'),copy=node('span','law-card-copy');
   const price=node('span','law-price');const currency=node('span','currency-crystal');currency.setAttribute('aria-hidden','true');price.setAttribute('aria-label',law.price+' 金幣');price.append(currency,node('span','',String(law.price)));
   heading.append(node('strong','law-card-name',law.name),price);copy.append(node('span','law-description',law.description));
   const attributes=lawSummary(law);if(attributes!=='無永久屬性增減')copy.append(node('span','law-card-stats',attributes));
   card.append(heading,lawArt(law),copy,lawPanelSkin());
   card.addEventListener('click',()=>{if(card.disabled)return;try{Expedition.buyLaw(expedition,shopKey,slot,lawTarget);status('');render();}catch(error){status(error.message,true);}});return card;
  });
  $('law-shop-products').replaceChildren(...cards);if(!stock.length)$('law-shop-products').append(node('p','expedition-note','暫無法則'));
 }
 function renderShopControls(){
  $('shop-controls').hidden=mode!=='shop';
  $('expedition-progress').textContent=immersive?String(expedition.echoLevel):'回響等級 '+expedition.echoLevel+' / '+expedition.echoSettings.levels.length+' · 本局金幣';
  if(mode==='shop'){
   const cost=Expedition.rerollCost(expedition,shopKey);$('shop-reroll').textContent='重骰全部商品 · '+cost+' 金幣';
   if(immersive){const label=node('span','shop-reroll-label');const icon=node('span','currency-crystal');icon.setAttribute('aria-hidden','true');label.append(node('span','','重骰'),icon,node('span','',String(cost)));$('shop-reroll').replaceChildren(label);}
   $('shop-reroll').setAttribute('aria-label','重骰角色與法則商品，'+cost+' 金幣');$('shop-reroll').disabled=expedition.gold<cost;
   const odds=EchoLevels.describe(expedition.echoSettings,expedition.echoLevel);
   $('shop-echo-level').textContent='回響等級 '+expedition.echoLevel+' · 設定機率：'+odds;
   if($('shop-echo-display')){
    $('shop-echo-value').textContent=String(expedition.echoLevel);
    $('shop-echo-tooltip-level').textContent='回響等級 '+expedition.echoLevel;
    $('shop-echo-tooltip-odds').textContent=odds;
   }
   $('shop-reroll-note').textContent=immersive?'':'角色與法則商品一起重骰；下一次 '+(cost+expedition.config.shopRerollIncrement)+' 金幣，同店累計。';
  }
 }
 function renderInspection(lawMode){
  const chosen=selection?(selection.area==='stock'?Expedition.shop(expedition,shopKey):expedition[selection.area])[selection.slot]:(lawMode?Expedition.findOwned(expedition,lawTarget)?.unit:null);
  $('roster-selected').textContent=chosen?chosen.name+' · '+chosen.race+' / '+chosen.affinity+' / '+chosen.job+' · '+(immersive?'★'.repeat(chosen.stars):chosen.stars+' 星 · '+chosen.space+' 格'):(immersive?'':'點擊角色以檢視詳細資料');
  const basics=$('roster-basic-stats');basics.hidden=!(immersive&&mode==='shop'&&chosen);basics.replaceChildren();
  if(!basics.hidden){
   const stars=node('span','shop-inspect-stars');stars.setAttribute('role','img');stars.setAttribute('aria-label',chosen.stars+' 星');
   for(let i=0;i<chosen.stars;i++){const star=node('img');star.src='assets/ui/card-icons/approved-v1/star.png';star.alt='';stars.append(star);}
   $('roster-selected').replaceChildren(node('span','',chosen.name),stars);
   CharacterDetails.renderBasics(document,basics,chosen);
  }
  $('roster-effects-title').hidden=!chosen;
  $('roster-effects').textContent=chosen?(chosen.description??chosen.effects.map(EffectEditor.describe).join('\n')):'';
  const lawList=$('roster-laws');lawList.replaceChildren();lawList.textContent='';
  if(chosen?.laws?.length){
   lawList.append(node('h3','shop-equipped-title','已裝備法則'));
   for(const law of chosen.laws){
    const entry=node('article','shop-equipped-law'),text=node('div','shop-equipped-text');text.append(node('strong','',law.name));
    const fallback=(law.passives??[]).map(p=>(Laws.labels[Laws.timings.indexOf(p.timing)]||p.timing)+'：'+p.effects.map(EffectEditor.describe).join('；')).join('\n');
    const description=typeof law.description==='string'&&law.description.trim()?law.description:fallback;
    const attributes=lawSummary(law);if(description)text.append(node('p','shop-equipped-description',description));
    if(attributes!=='無永久屬性增減')text.append(node('p','shop-equipped-attributes',attributes));
    if(!description&&attributes==='無永久屬性增減')text.append(node('p','shop-equipped-description','此法則尚未填寫效果說明。'));
    entry.append(lawArt(law),text);lawList.append(entry);
   }
  }
  $('law-target-select').hidden=immersive||!lawMode||!chosen||!['active','reserve'].includes(selection?.area);
  $('roster-buy').hidden=immersive||selection?.area!=='stock';$('roster-buy').textContent=immersive?'購買':'購買並放入'+names[bottom]+(chosen&&selection.area==='stock'?'（'+chosen.price+' 金幣）':'');$('roster-buy').setAttribute('aria-label','購買並放入'+names[bottom]);
  $('roster-buy').disabled=!chosen||selection?.area!=='stock'||Expedition.firstFit(expedition[bottom],chosen)<0||expedition.gold<(chosen.price??0);
  if(!immersive&&chosen&&selection.area==='stock')$('roster-buy-note').textContent=Expedition.firstFit(expedition[bottom],chosen)<0?'出戰隊伍空間不足，可拖到儲存隊伍空位。':expedition.gold<chosen.price?'金幣不足。':(immersive?'':'可拖曳到下方兩隊的空位購買；此按鈕自動放入出戰隊伍。');else $('roster-buy-note').textContent='';
 }
 function renderSkillOptions(){
  const options=Expedition.eligible(expedition);$('skill-options-note').textContent=options.length?'':'目前沒有符合出戰隊伍條件的極式。';$('skill-options-note').hidden=!!options.length;
  const choices=options.map(skill=>{
   const button=node('button','skill-choice'),icon=node('span','skill-choice-icon'),fallback=node('span','skill-icon-fallback','✧');button.type='button';button.setAttribute('aria-pressed',String(skill.id===pendingSkillId));icon.setAttribute('aria-hidden','true');icon.append(fallback);
   if(skill.imagePath&&SkillDB.validImagePath(skill.imagePath)){const image=node('img','skill-choice-image');image.alt='';image.hidden=true;image.addEventListener('load',()=>{image.hidden=false;fallback.hidden=true;});image.addEventListener('error',()=>{image.hidden=true;fallback.hidden=false;});image.src=skill.imagePath.split('/').map(encodeURIComponent).join('/');icon.append(image);}
   button.append(icon,node('strong','',skill.name));button.addEventListener('click',()=>{pendingSkillId=skill.id;for(const choice of choices)choice.setAttribute('aria-pressed',String(choice===button));$('skill-picker-error').textContent='';renderSkillDetails();});return button;
  });$('roster-skill-options').replaceChildren(...choices);renderSkillDetails();$('roster-skill').setAttribute('aria-expanded',String($('roster-skill-menu').open));
 }
 function renderSkillDetails(){
  const selected=Expedition.eligible(expedition).find(skill=>skill.id===pendingSkillId);
  $('skill-selected-name').textContent=selected?.name||'尚未選擇極式';
  $('skill-selected-cooldown').textContent=selected?'冷卻時間：'+selected.cooldown+' 秒':'';
  $('skill-selected-description').textContent=selected?(selected.description??selected.effects.map(EffectEditor.describe).join('\n'))||'此極式尚未填寫說明。':'請點選上方極式，查看完整說明。';
  $('skill-selected-details').scrollTop=0;$('roster-skill-confirm').disabled=!selected;
 }
 function closeSkillMenu(restoreFocus=true){
  const dialog=$('roster-skill-menu'),wasOpen=dialog.open;
  if(wasOpen)dialog.close();dialog.hidden=true;pendingSkillId=null;$('roster-skill').setAttribute('aria-expanded','false');
  if(wasOpen&&restoreFocus&&$('expedition-dialog').open)$('roster-skill').focus({preventScroll:true});
 }
 function render(){
  const focusKey=document.activeElement?.getAttribute('data-roster-key');
  const focusLaw=document.activeElement?.getAttribute('data-law-buy');
  const lawMode=mode==='shop'&&shopTab==='laws';
  renderShopControls();
  if($('shop-wallet')){$('shop-wallet').hidden=mode!=='shop';$('shop-wallet').textContent=immersive?String(expedition.gold):'金錢：'+expedition.gold;$('shop-wallet').setAttribute('aria-label','金錢：'+expedition.gold);}
  $('shop-tabs').hidden=mode!=='shop';$('law-shop-panel').hidden=!lawMode;$('roster-top-section').hidden=lawMode;$('roster-divider').hidden=lawMode;
  for(const tab of ['characters','laws']){const button=$('shop-tab-'+tab);button.setAttribute('aria-selected',String(shopTab===tab));button.setAttribute('tabindex',shopTab===tab?'0':'-1');}
  if(lawMode)renderLaws();
  $('expedition-title').textContent=mode==='shop'?(immersive?'商店':'夜行商會'):'旅途整備';$('expedition-eyebrow').textContent=mode==='shop'?'MERCHANT / 角色交易':'PREPARATION / 隊伍配置';
  $('roster-top-title').textContent=mode==='shop'?(immersive?'角色':'店家販售角色'):'儲存隊伍';$('roster-bottom-title').textContent=names[bottom];
  $('expedition-dialog').setAttribute('data-mode',mode);$('roster-sell-zone').hidden=immersive&&lawMode;$('roster-reserve-section').hidden=mode!=='shop';
  $('expedition-dialog').setAttribute('aria-labelledby',mode==='gear'?'preparation-title':'expedition-title');
  $('roster-sell-zone').textContent=immersive?'出售':'拖曳自己的角色至此賣出 · 返還商店售價 '+expedition.config.sellPercent+'%';
  if(mode==='shop')$('roster-reserve-count').textContent=board('roster-reserve','reserve')+' / 10 格';else $('roster-reserve').replaceChildren();
  $('expedition-gold').textContent=immersive?String(expedition.gold):expedition.gold+' 金幣';$('expedition-gold').setAttribute('aria-label','金幣：'+expedition.gold);$('expedition-shop-note').hidden=mode!=='shop';
  $('expedition-shop-note').textContent=lawMode?'先指定裝備角色，再購買法則。相同法則可以重複裝備，屬性加成累加。':'拖商品到隊伍空位購買；拖自己的角色到上方賣出區出售。';
  const topUsed=lawMode?0:board('roster-top',mode==='shop'?'stock':'reserve'),bottomUsed=board('roster-bottom',bottom);
  if(lawMode)$('roster-top').replaceChildren();
  $('roster-top-count').textContent=topUsed+' / 10 格';$('roster-bottom-count').textContent=bottomUsed+' / 10 格';
  $('roster-skill').hidden=mode==='shop';if(mode==='shop')closeSkillMenu(false);
  const equipped=expedition.skills.find(x=>x.id===expedition.skillId);$('roster-skill').textContent=immersive?(equipped?.name||'選擇極式'):'✧ 選擇極式 · '+(equipped?.name||'尚未裝備');
  renderInspection(lawMode);
  renderSkillOptions();
  alignPreparationDividers();
  $('roster-empty-warning').hidden=expedition.active.some(Boolean);
  if(focusKey){const candidate=[...$('roster-top').children,...$('roster-bottom').children,...$('roster-reserve').children].find(el=>el.getAttribute('data-roster-key')===focusKey);(candidate||$('expedition-dialog')).focus({preventScroll:true});}
  if(focusLaw!==null&&focusLaw!==undefined&&lawMode){const buttons=[...$('law-shop-products').children].flatMap(card=>immersive?[card]:[...card.children]).filter(n=>n.getAttribute('data-law-buy')!==null&&!n.disabled);(buttons.find(n=>n.getAttribute('data-law-buy')===focusLaw)||buttons[0]||$('law-target-zone')).focus({preventScroll:true});}
 }
 function open(kind,key){
  closeSkillMenu(false);
  if(!expedition)reset();mode=kind;shopKey=key||'sample';bottom='active';selection=null;shopTab='characters';lawTarget=null;opener=document.activeElement;
  if(typeof SkillEditor!=='undefined')expedition.skills=SkillDB.validate({version:1,skills:SkillEditor.getSkills()}).skills;Expedition.syncSkill(expedition);
  $('roster-skill-menu').hidden=true;status(immersive?'':'拖到空位搬移，拖到同角色同星等合成升星（最高六星），其他角色交換；拖到賣出區出售。');render();$('expedition-dialog').showModal();alignPreparationDividers();
 }
 function close(){closeSkillMenu(false);if(immersive&&$('character-detail').open)closeInspection();clearDrag();$('expedition-dialog').close();opener?.focus();}
 function closeInspection(){
  $('character-detail').close();$('character-detail').hidden=true;
  const key=selection?selection.area+'-'+selection.slot:null;
  const card=[...$('roster-top').children,...$('roster-bottom').children].find(n=>n.getAttribute('data-roster-key')===key);
  (card||$('expedition-dialog')).focus({preventScroll:true});
 }
 if(immersive){DialogDismiss.bind($('character-detail'),closeInspection);$('character-detail').addEventListener('cancel',e=>{e.preventDefault();closeInspection();});}
 $('expedition-close')?.addEventListener('click',close);DialogDismiss.bind($('expedition-dialog'),close);
 $('shop-reroll').addEventListener('click',()=>{if(mode!=='shop')return;clearDrag();try{const cost=Expedition.reroll(expedition,shopKey);selection=null;status('已花費 '+cost+' 金幣重骰角色與法則商品。');render();}catch(error){status(error.message,true);}});
 for(const tab of ['characters','laws']){
  const activate=()=>{clearDrag();shopTab=tab;selection=null;status(tab==='laws'?'將自己的角色拖到法則裝備對象欄位，或查看角色後按「設為法則購買對象」。':'拖商品到隊伍空位即可購買角色。');render();};
  $('shop-tab-'+tab).addEventListener('click',activate);
  $('shop-tab-'+tab).addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||($('shop-tabs').getAttribute('aria-orientation')==='vertical'&&['ArrowUp','ArrowDown'].includes(event.key))){event.preventDefault();const next=event.key==='Home'?'characters':event.key==='End'?'laws':tab==='laws'?'characters':'laws';$('shop-tab-'+next).click();$('shop-tab-'+next).focus();}});
 }
 $('law-target-select').addEventListener('click',()=>{if(!selection||!['active','reserve'].includes(selection.area))return;const unit=expedition[selection.area][selection.slot];if(unit){lawTarget=unit.instanceId;status('法則將裝備給 '+unit.name+'。');render();}});
 $('law-target-clear')?.addEventListener('click',()=>{lawTarget=null;status('已清除法則裝備對象，角色仍留在原隊伍。');render();});
 $('expedition-dialog').addEventListener('cancel',event=>{event.preventDefault();close();});
 $('roster-cancel')?.addEventListener('click',()=>{selection=null;status('已取消選取。');render();});
 $('roster-buy').addEventListener('click',()=>{if(selection?.area!=='stock')return;try{const at=Expedition.buy(expedition,shopKey,selection.slot,bottom);selection=null;status('購買成功，已放入'+names[bottom]+'第 '+(at+1)+' 格。');render();}catch(error){status(error.message,true);}});
 DialogDismiss.bind($('roster-skill-menu'),()=>closeSkillMenu());
 $('roster-skill-menu').addEventListener('cancel',event=>{event.preventDefault();closeSkillMenu();});
 $('roster-skill').addEventListener('click',()=>{if(mode==='shop')return;clearDrag();pendingSkillId=expedition.skillId;$('skill-picker-error').textContent='';renderSkillOptions();const dialog=$('roster-skill-menu');dialog.hidden=false;dialog.showModal();$('roster-skill').setAttribute('aria-expanded','true');$('roster-skill-options').scrollTop=0;const choices=[...$('roster-skill-options').children];(choices.find(button=>button.getAttribute('aria-pressed')==='true')||choices[0]||dialog).focus({preventScroll:true});});
 $('roster-skill-confirm').addEventListener('click',()=>{if(!pendingSkillId)return;try{const skill=Expedition.eligible(expedition).find(skill=>skill.id===pendingSkillId);if(!skill)throw Error('此極式已不符合目前出戰隊伍，請重新選擇。');Expedition.equip(expedition,skill.id);closeSkillMenu();status('已裝備 '+skill.name);render();}catch(error){$('skill-picker-error').textContent=error.message;renderSkillOptions();}});
 $('roster-skill-none')?.addEventListener('click',()=>{Expedition.equip(expedition,null);closeSkillMenu();status('已卸下極式。');render();});
 window.ExpeditionUI={open,reset,upgradeEcho(){if(!expedition)reset();return Expedition.upgradeEcho(expedition);},bind(state){closeSkillMenu(false);clearDrag();expedition=state;selection=null;lawTarget=null;}};
})();
