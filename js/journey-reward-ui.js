(function(root){
 'use strict';

 // The journey owns reward generation and claiming. This controller only renders
 // the saved choices and reports player actions; opening preparation never rerolls.
 function create({document,describeEffect,getReward,claim,skip,openPreparation,onClaim,onComplete=()=>{},iconAssetBase='assets/ui/card-icons/approved-v1/'}){
  const $=id=>document.getElementById(id),dialog=$('journey-reward'),hub=$('reward-hub');
  let receipt=null,selection=null;
  const description=$('reward-description-scroll');
  let descriptionDrag=null;
  description.addEventListener('pointerdown',event=>{
   if(event.button!==0||event.pointerType==='touch'||description.scrollHeight<=description.clientHeight)return;
   descriptionDrag={id:event.pointerId,y:event.clientY,top:description.scrollTop};
   description.setPointerCapture(event.pointerId);event.preventDefault();
  });
  description.addEventListener('pointermove',event=>{
   if(descriptionDrag?.id!==event.pointerId)return;
   description.scrollTop=descriptionDrag.top+descriptionDrag.y-event.clientY;
  });
  const endDescriptionDrag=()=>{descriptionDrag=null;};
  for(const type of ['pointerup','pointercancel','lostpointercapture'])description.addEventListener(type,endDescriptionDrag);
  function showHub(){let reward=getReward();if(reward&&receipt?.token!==reward.token)receipt={token:reward.token,gold:reward.gold??0,viewed:reward.rewardTier==='none'};if(!receipt)return;if(reward&&['low','none'].includes(reward.rewardTier)&&reward.choices.length===0){claim(reward.token,null);reward=getReward();onClaim(null);}if(receipt.viewed&&!reward){if(hub.open)hub.close();receipt=null;onComplete();return;}
   $('reward-money').disabled=receipt.viewed;$('reward-money').textContent='水晶';$('reward-characters').disabled=!reward;$('reward-characters').textContent='魔女';if(!hub.open)hub.showModal();
  }

  function finish(token,index,skipped=false){
   try{
    const result=skipped?skip(token):claim(token,index);
    dialog.close();
    onClaim(result);showHub();
   }catch(error){
    $('reward-warning').hidden=false;
    $('reward-warning').textContent=error.message;
    $('reward-gear').focus();
   }
  }

  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  const maskSource=path=>{const value=root.RewardMaskAssets?.resolve(path)??path;return root.document?.baseURI?new URL(value,root.document.baseURI).href:value;};
  const footprint=unit=>Math.min(10,Math.max(1,Math.trunc(unit.space)||1));
  // Frame aliases are presentation only; journey professions and footprints stay intact.
  const frameJobs={'破陣':'melee','飛襲':'ranged','守護':'tank','支援':'healer'};
  const iconFiles={'人類':'human','機人':'machine','獸人':'beast','物理':'physical','魔法':'magic','精神':'mental',health:'health',attack:'attack',star:'star'};
  const iconPaths={
   '人類':'M9 21v-4l-3-1v-4H4l3-4a6 6 0 1 1 11 4v9Z',
   '機人':'M5 6h14v14H5ZM12 3v3M8 10h2v3H8Zm6 0h2v3h-2ZM9 17h6M2 10v6m20-6v6',
   '獸人':'m4 8 1-6 5 5h4l5-5 1 6 2 5-5 8H7l-5-8Zm4 3h1m6 0h1m-6 5 2 2 2-2',
   '物理':'m4 3 13 13-3 3L3 6Zm16 0L7 16l3 3L21 6ZM3 15l6 6m6-6 6 6',
   '魔法':'m4 21 12-12m-3-3 5 5m0-10v4m-5-2 2 2m6 3h3m-3 5-2-2',
   '精神':'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
   health:'M12 21 3.5 12.5C-2 6 6 0 12 7c6-7 14-1 8.5 5.5Z',
   attack:'m5 19 13-13 3-3-1 6L7 21M4 14l6 6',
   star:'m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z'
  };
  function icon(kind,label){
   const el=node('span','reward-symbol');el.setAttribute('role','img');el.setAttribute('aria-label',label);el.title=label;
   if(iconAssetBase&&iconFiles[kind]){
    const img=node('img');img.src=iconAssetBase+iconFiles[kind]+'.png';img.alt='';img.setAttribute('aria-hidden','true');el.append(img);
    if(kind!=='star'){el.setAttribute('data-card-icon',iconFiles[kind]);el.setAttribute('style','--card-icon-mask:url("'+maskSource(iconAssetBase+iconFiles[kind]+'.png')+'")');}
   }else el.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="'+(iconPaths[kind]||iconPaths['人類'])+'"/></svg>';
   return el;
  }
  function inspect(reward){
   const chosen=selection?.token===reward.token?reward.choices[selection.index]:null;
   $('reward-confirm').disabled=!chosen;$('reward-confirm').hidden=reward.choices.length===0;
   $('reward-inspect').hidden=false;
   $('reward-inspect').setAttribute('data-empty',String(!chosen));
   description.scrollTop=0;descriptionDrag=null;
   $('reward-selected').textContent=chosen?chosen.name+' · '+chosen.race+' / '+chosen.affinity+' / '+chosen.job+' · '+'★'.repeat(chosen.stars):'';
   $('reward-effects').textContent=chosen?(chosen.description??chosen.effects.map(describeEffect).join('\n')):'';
   $('reward-laws').textContent=chosen?.laws?.length?'已裝備法則：'+chosen.laws.map(l=>l.name).join('；'):'';
   for(const [index,card] of Array.from($('reward-options').children).entries())card.setAttribute('aria-pressed',String(!!chosen&&selection.index===index));
  }
  function card(unit,index,token){
   const article=node('button','reward-card roster-tile occupied');article.type='button';article.setAttribute('style','--reward-space:'+footprint(unit));
   const job=frameJobs[unit.job]||'melee',rarity=['SR','SSR','UR'].includes(unit.rarity)?unit.rarity:'SR';
   const asset='assets/ui/card-frames/v3/'+job+'-'+rarity.toLowerCase();
   article.setAttribute('data-frame-job',job);article.setAttribute('data-rarity',rarity);article.title=unit.job+' · '+rarity;
   const surface=node('span','reward-card-surface');surface.setAttribute('style','mask-image:url("'+maskSource(asset+'-window.png')+'")');
   const hud=node('span','roster-card-hud'),heading=node('span','roster-card-heading'),name=node('strong','roster-name',unit.name),stars=node('span','roster-stars card-star-column');
   stars.setAttribute('role','img');stars.setAttribute('aria-label',unit.stars+' 星');
   for(let i=0;i<unit.stars;i++){const symbol=icon('star','星等');symbol.setAttribute('role','presentation');symbol.setAttribute('aria-hidden','true');stars.append(symbol);}
   name.title=unit.name;heading.append(icon(unit.race,unit.race),icon(unit.affinity,unit.affinity),name);
   const values=node('span','roster-card-values'),attack=Number.isFinite(unit.attack)?unit.attack:10;
   for(const [kind,label,value] of [['health','血量',unit.maxHp],['attack','攻擊力',attack]]){
    const stat=node('span','roster-extra roster-'+kind);stat.setAttribute('aria-label',label+' '+value);
    stat.append(icon(kind,label),node('span','roster-value',String(value)));values.append(stat);
   }
   hud.append(heading,values);surface.append(root.CharacterArt.create(document,unit,'roster-art reward-art','span'),hud);
   const frame=node('img','reward-card-frame');frame.src=asset+'.png';frame.alt='';frame.setAttribute('aria-hidden','true');
   article.append(surface,frame,stars);root.CharacterCardSkin?.positionStars(document,article,asset+'-window.png');
   article.setAttribute('aria-label',unit.name+'，'+unit.race+'，'+unit.affinity+'，'+unit.job+'，'+rarity+'，'+unit.stars+' 星，血量 '+unit.maxHp+'，攻擊力 '+attack+'，點擊查看介紹');article.setAttribute('aria-controls','reward-inspect');
   article.addEventListener('click',()=>{const reward=getReward();if(!reward||reward.token!==token)return;selection={token,index};$('reward-warning').hidden=true;inspect(reward);});
   return article;
  }

  function showCharacters(){
   const reward=getReward();
   if(!reward)return;
   if(selection?.token!==reward.token)selection=null;
   const cards=reward.choices.map((unit,index)=>card(unit,index,reward.token));
   const total=reward.choices.reduce((sum,unit)=>sum+footprint(unit),0);
   // Reward choices are not a team board: fit the actual occupied width, with
   // enough room for the title/details/actions. Narrow screens wrap the cards.
   dialog.setAttribute('style','--reward-content-width:'+Math.max(560,Math.min(1400,total*141+89))+'px');
   $('reward-options').replaceChildren(...cards);
   $('reward-warning').hidden=true;
   $('reward-empty').hidden=reward.choices.length>0;
   $('reward-continue').hidden=reward.choices.length>0;
   $('reward-skip').hidden=!skip||reward.choices.length===0;
   inspect(reward);
   if(!dialog.open)dialog.showModal();
  }
  $('reward-confirm').addEventListener('click',()=>{const reward=getReward();if(!reward||selection?.token!==reward.token||!reward.choices[selection.index])return;finish(reward.token,selection.index);});
  $('reward-skip').addEventListener('click',()=>{const reward=getReward();if(!skip||!reward?.choices.length)return;finish(reward.token,null,true);});

  dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close();showHub();});
  DialogDismiss.bind(dialog,()=>{dialog.close();showHub();});
  hub.addEventListener('cancel',e=>e.preventDefault());
  $('reward-money').addEventListener('click',()=>{if(!receipt||receipt.viewed)return;hub.close();$('reward-money-amount').textContent=String(receipt.gold);$('reward-money-amount').setAttribute('aria-label','獲得 '+receipt.gold+' 水晶');$('reward-money-dialog').showModal();});
  const closeMoney=()=>{receipt.viewed=true;$('reward-money-dialog').close();showHub();};
  DialogDismiss.bind($('reward-money-dialog'),closeMoney);
  $('reward-money-close').addEventListener('click',closeMoney);$('reward-money-dialog').addEventListener('cancel',e=>{e.preventDefault();closeMoney();});
  $('reward-characters').addEventListener('click',()=>{if(!getReward())return;hub.close();showCharacters();});

  $('reward-gear').addEventListener('click',openPreparation);
  $('reward-continue').addEventListener('click',()=>{
   const reward=getReward();
   if(reward&&reward.choices.length===0)finish(reward.token,null);
  });
  return {show:showHub,pending:()=>!!getReward()||!!receipt&&!receipt.viewed};
 }

 root.JourneyRewardUI={create};
})(globalThis);
