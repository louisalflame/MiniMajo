/* Approved reward art reused by rosters and combat; no game data is changed. */
(function(root){
 'use strict';
 const jobs={'破陣':'melee','飛襲':'ranged','守護':'tank','支援':'healer'};
 const icons={'人類':'human','機人':'machine','獸人':'beast','物理':'physical','魔法':'magic','精神':'mental',health:'health',attack:'attack',range:'range',posture:'posture',star:'star'};
 const node=(d,tag,cls,text)=>{const e=d.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const source=path=>{const value=root.RewardMaskAssets?.resolve(path)??path;return root.document?.baseURI?new URL(value,root.document.baseURI).href:value;};
 const windows=new Map(),layouts=new WeakMap();let resizeObserver;
 function windowPixels(d,path){
  if(!windows.has(path))windows.set(path,(async()=>{const img=new root.Image();img.src=source(path);await img.decode();const canvas=d.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);return {width:canvas.width,height:canvas.height,data:ctx.getImageData(0,0,canvas.width,canvas.height).data};})());
  return windows.get(path);
 }
 function positionStars(d,card,path){
  if(!root.ResizeObserver||!root.Image||!card.querySelector)return;
  card.setAttribute('data-star-layout','pending');
  const update=async()=>{
   try{
    const mask=await windowPixels(d,path);if(!card.isConnected)return;
    const col=card.querySelector('.card-star-column'),r=card.getBoundingClientRect();if(!col||!r.width||!r.height)return;
    const count=col.querySelectorAll('img').length;if(!count)return;
    const footprint=Math.max(1,parseFloat(card.style.getPropertyValue('--star-footprint'))||parseFloat(card.style.getPropertyValue('--reward-space'))||1);
    let edge=mask.width-1;const middle=Math.floor(mask.height/2);for(;edge>0;edge--){const p=(middle*mask.width+edge)*4;if(mask.data[p]*mask.data[p+3]/255>245)break;}
    const right=Math.max(8,Math.min(r.width*.07,18),r.width-edge/mask.width*r.width+Math.max(1,r.width*.004));
    const nominal=Math.min(14,Math.max(4,r.width/footprint*.08));
    // Scan the full star width against the actual luminance window, not its rectangle.
    function topAt(size){const x0=Math.max(0,Math.floor((r.width-right-size)/r.width*mask.width)),x1=Math.min(mask.width-1,Math.ceil((r.width-right)/r.width*mask.width));let top=0;for(let x=x0;x<=x1;x++){let y=0;for(;y<mask.height;y++){const p=(y*mask.width+x)*4;if(mask.data[p]*mask.data[p+3]/255>245)break;}top=Math.max(top,y);}return top/mask.height*r.height+Math.max(1,r.height*.006);}
    const row=card.querySelector('.hp-meter')||card.querySelector('.roster-card-values'),bottom=row?row.getBoundingClientRect().top-r.top-1:r.height*.8;
    let size=nominal,gap=1,top=topAt(size);
    // Small cards keep the same vertical count, with a tighter gap/size if required.
    for(let pass=0;pass<3;pass++){const room=Math.max(1,bottom-top);gap=Math.min(1,room/count*.08);size=Math.max(1,Math.min(nominal,(room-gap*(count-1))/count));top=topAt(size);}
    col.style.setProperty('--card-star-top',top+'px');col.style.setProperty('--card-star-right',right+'px');col.style.setProperty('--card-star-size',size+'px');col.style.setProperty('--card-star-gap',gap+'px');
    const hud=card.querySelector('.roster-card-hud');if(hud)card.style.setProperty('--card-star-clearance',Math.max(0,right+size+3-parseFloat(root.getComputedStyle(hud).paddingRight))+'px');
    card.setAttribute('data-star-layout','ready');
   }catch{card.setAttribute('data-star-layout','fallback');}
  };
  layouts.set(card,update);
  resizeObserver??=new root.ResizeObserver(entries=>{for(const {target}of entries){if(!target.isConnected){resizeObserver.unobserve(target);continue;}layouts.get(target)?.();}});
  resizeObserver.observe(card);update();
 }
 function icon(d,kind,label){
  const e=node(d,'span','reward-symbol'),file=icons[kind]||'human',path='assets/ui/card-icons/approved-v1/'+file+'.png';
  e.setAttribute('role','img');e.setAttribute('aria-label',label);e.title=label;
  const img=node(d,'img','');img.src=path;img.alt='';img.setAttribute('aria-hidden','true');e.append(img);
  if(kind!=='star'){e.setAttribute('data-card-icon',file);e.setAttribute('style','--card-icon-mask:url("'+source(path)+'")');}
  return e;
 }
 function heading(d,u){
  const e=node(d,'span','roster-card-heading'),name=node(d,'strong','roster-name',u.name);
  name.title=u.name;e.append(icon(d,u.race,u.race),icon(d,u.affinity,u.affinity),name);return e;
 }
 function stars(d,u){
  const e=node(d,'span','roster-stars card-star-column');e.setAttribute('role','img');e.setAttribute('aria-label',u.stars+' 星');
  for(let i=0;i<u.stars;i++){const img=node(d,'img','card-star');img.src='assets/ui/card-icons/approved-v1/star.png';img.alt='';img.setAttribute('aria-hidden','true');e.append(img);}
  return e;
 }
 function stat(d,kind,value,label){
  const e=node(d,'span','roster-extra roster-'+kind);e.setAttribute('aria-label',label+' '+value);e.title=label+' '+value;
  e.append(icon(d,kind,label),node(d,'span','roster-value',String(value)));return e;
 }
 function mount(d,card,u,...contents){
  const job=jobs[u.job]||'melee',rarity=['SR','SSR','UR'].includes(u.rarity)?u.rarity:'SR',asset='assets/ui/card-frames/v3/'+job+'-'+rarity.toLowerCase();
  card.setAttribute('data-card-skin','approved');card.setAttribute('data-frame-job',job);card.setAttribute('data-rarity',rarity);
  card.style?.setProperty?.('--star-footprint',String(Math.max(1,Math.trunc(u.space)||1)));
  const surface=node(d,'span','reward-card-surface');surface.setAttribute('style','mask-image:url("'+source(asset+'-window.png')+'")');surface.append(...contents);
  const frame=node(d,'img','reward-card-frame');frame.src=asset+'.png';frame.alt='';frame.setAttribute('aria-hidden','true');card.append(surface,frame,stars(d,u));positionStars(d,card,asset+'-window.png');
 }
 const api={icon,heading,stars,stat,mount,positionStars};root.CharacterCardSkin=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
