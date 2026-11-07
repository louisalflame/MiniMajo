(function(root){
 'use strict';
 const Art=typeof module!=='undefined'?require('./character-art.js'):root.CharacterArt;
 const Effects=typeof module!=='undefined'?require('./effects.js'):root.Effects;
 const Icons=typeof module!=='undefined'?require('./ui-icons.js'):root.UIIcons;
 const sharedIcons='assets/ui/card-icons/approved-v1/',detailIcons='assets/ui/character-details/icons-v1/';
 const categoriesIcons={'破陣':'job-melee','飛襲':'job-ranged','守護':'job-tank','支援':'job-healer'};
 const sharedKinds={'人類':'human','機人':'machine','獸人':'beast','物理':'physical','魔法':'magic','精神':'mental'};
 const statKinds={'血量':'health','護盾':'job-tank','攻擊力':'attack','治療力':'job-healer','護盾力':'job-tank','攻擊距離':'range','失衡':'posture','失衡效果加成':'posture-bonus','狀態秒數加成':'status-duration-bonus','狀態層數加成':'status-amount-bonus','倒地時間':'knockdown','行動間隔':'interval','移動距離':'move','傷害攻擊力加成':'attack','治療攻擊力加成':'attack','護盾攻擊力加成':'attack'};
 const reusedKinds=new Set(['human','machine','beast','physical','magic','mental','health','attack','range','posture']);
 function renderBasics(document,host,unit,{stats}={}){
  const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  const withIcon=(element,kind)=>{if(!kind)return element;const icon=node('img','');icon.className='detail-stat-icon';icon.src=(reusedKinds.has(kind)?sharedIcons:detailIcons)+kind+'.png';icon.alt='';icon.setAttribute('aria-hidden','true');icon.setAttribute('data-detail-icon',kind);element.append(icon);return element;};
  stats??=[['職業',unit.job],['種族 / 類型',unit.race+' / '+unit.affinity],['階級',unit.rarity],['血量',unit.maxHp],['攻擊力',unit.attack??10],['攻擊距離',(unit.attackRange??1)+' 格'],...['damage','heal','shield'].filter(t=>unit.outputBonuses?.[t]).map(t=>[({damage:'傷害',heal:'治療',shield:'護盾'})[t]+'攻擊力加成',unit.outputBonuses[t]]),['失衡效果加成',unit.outputBonuses?.posture??0],['狀態秒數加成',unit.statusDurationBonus??0],['狀態層數加成',unit.statusAmountBonus??0],['行動間隔',unit.cooldown+' 秒'],['移動距離',unit.moveDistance]];
  const categories=[['職業',unit.job],['種族',unit.race],['類型',unit.affinity],['階級',unit.rarity]];
  const categoryNodes=categories.flatMap(([k,v],i)=>{const label=node('dt',k),value=node('dd',String(v));label.className='detail-category-label';value.className='detail-category-value'+(i===3?' detail-category-end':'');withIcon(value,i===0?categoriesIcons[v]:i===3?'rank':sharedKinds[v]);return [label,value];});
  const categoryKeys=new Set(['職業','種族 / 類型','星等 / 階級','階級']);
  host.replaceChildren(...categoryNodes,...stats.filter(([k])=>!categoryKeys.has(k)).flatMap(([k,v])=>{
   const label=withIcon(node('dt',k),statKinds[k]);
   let text=String(v);
   if(k==='狀態秒數加成'||k==='狀態層數加成'){
    text=(Number(v)>0?'+':'')+v+(k==='狀態秒數加成'?' 秒':'');
    label.title=k==='狀態秒數加成'?'施放秒數型狀態時，持續時間額外加上此值。':'施放狀態時，技能算出的施加量額外加上此值；固定效果除外。';
   }
   const value=node('dd',text);
   if(label.title)value.title=label.title;
   return [label,value];
  }));
 }
 function render(document,unit,{stats,statuses=[]}={}){
  const Laws=typeof module!=='undefined'?require('./laws.js'):root.Laws;
  const $=id=>document.getElementById(id),node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  $('detail-name').textContent=unit.name;
  $('detail-name').title=unit.name;
  $('detail-stars').replaceChildren(...Array.from({length:unit.stars},()=>{const star=node('img','');star.src='assets/ui/card-icons/approved-v1/star.png';star.alt='';star.setAttribute('aria-hidden','true');return star;}));
  $('detail-stars').setAttribute('role','img');
  $('detail-stars').setAttribute('aria-label',unit.stars+' 星');
  $('detail-art').replaceChildren(Art.create(document,unit,'detail-portrait','span',{detail:true}));
  renderBasics(document,$('detail-stats'),unit,{stats});
  const description=unit.description??Effects.description(unit.effects);
  $('detail-effects').replaceChildren(...description.split('\n').filter(Boolean).map(text=>node('li',text)));
  $('detail-statuses').replaceChildren(...statuses.map(status=>{
   if(typeof status==='string')return node('li',status);
   const row=node('li','');row.className='detail-status-entry';
   const heading=node('div','');heading.className='detail-status-heading';
   if(status.kind&&Icons)heading.append(Icons.createStatus(document,status.kind));
   heading.append(node('strong',status.label??''));
   const effects=node('ul','');effects.className='detail-status-effects';
   const lines=(status.description??'').split(/\r?\n/).map(text=>text.trim()).filter(Boolean);
   effects.append(...(lines.length?lines:['尚未填寫效果說明。']).map(text=>node('li',text)));
   row.append(heading,effects);return row;
  }));
  $('detail-state-section').hidden=!statuses.length;
  $('detail-laws').replaceChildren(...(unit.laws??[]).map(law=>{
   const row=node('li','');row.className='detail-law-entry';
   const heading=node('div','');heading.className='detail-law-heading';
   const icon=node('span','');icon.className='detail-law-icon';icon.setAttribute('aria-hidden','true');
   const fallback=node('span','✧');icon.append(fallback);
   if(law.imagePath&&Laws.validImagePath(law.imagePath)){
    const image=node('img','');image.alt='';image.hidden=true;
    image.addEventListener('load',()=>{image.hidden=false;fallback.hidden=true;});
    image.addEventListener('error',()=>{image.hidden=true;fallback.hidden=false;});
    image.src=law.imagePath.split('/').map(encodeURIComponent).join('/');icon.append(image);
   }
   heading.append(icon,node('strong',law.name));
   const effects=node('ul','');effects.className='detail-law-effects';
   const lines=(law.description??'').split(/\r?\n/).map(text=>text.trim()).filter(Boolean);
   effects.append(...(lines.length?lines:['尚未填寫效果說明。']).map(text=>node('li',text)));
   row.append(heading,effects);return row;
  }));
  $('detail-law-section').hidden=!(unit.laws?.length);
  const content=document.querySelector?.('.character-detail .detail-content');
  if(content)content.scrollTop=0;
 }
 const api={render,renderBasics};if(typeof module!=='undefined')module.exports=api;else root.CharacterDetails=api;
})(globalThis);
