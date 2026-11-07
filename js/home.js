(() => {
 'use strict';
 if(globalThis.MiniMajoViewport?.host)return;
 const start=document.querySelector('a.start'),sigil=document.querySelector('.sigil');
 const curtain=document.getElementById('home-transition');
 if(!start||!sigil||!curtain)return;
 const main=document.querySelector('main'),header=document.querySelector('.masthead');
 let departing=false,marker=null,originalStyle='',animations=[];
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 function animate(element,frames,options){
  const animation=element.animate(frames,{fill:'forwards',...options});
  animations.push(animation);return animation.finished.catch(()=>{});
 }
 function reset(){
  departing=false;for(const animation of animations)animation.cancel();animations=[];
  if(marker){marker.replaceWith(sigil);marker=null;sigil.style.cssText=originalStyle;}
  document.body.classList.remove('home-departing','home-loading');
  main.inert=false;header.inert=false;curtain.hidden=true;
  start.removeAttribute('aria-disabled');
 }
 // A restored title screen must remain usable after navigating back from play.
 addEventListener('pageshow',event=>{if(event.persisted)reset();});
 start.addEventListener('click',async event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();if(departing)return;departing=true;
  const destination=start.href,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  start.setAttribute('aria-disabled','true');main.inert=true;header.inert=true;
  try{
   if(!reduced){
    // Move the existing layers to the viewport, retaining their live ring rotations.
    const rect=sigil.getBoundingClientRect();originalStyle=sigil.style.cssText;
    marker=document.createComment('sigil-home');sigil.before(marker);document.body.append(sigil);
    Object.assign(sigil.style,{position:'fixed',left:rect.left+'px',top:rect.top+'px',right:'auto',width:rect.width+'px',height:rect.height+'px',maxWidth:'none',margin:'0',animation:'none',transform:'none',zIndex:'5'});
    const targetSize=Math.min(760,Math.max(rect.width*1.35,Math.min(innerWidth,innerHeight)*.82));
    const dx=(innerWidth-rect.width)/2-rect.left,dy=(innerHeight-rect.height)/2-rect.top;
    animate(sigil,[{transform:'translate(0,0) scale(1)'},{transform:`translate(${dx}px,${dy}px) scale(${targetSize/rect.width})`}],{duration:1100,easing:'cubic-bezier(.22,.7,.2,1)'});
    animate(document.querySelector('.hero-copy'),[{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX(-100px)'}],{duration:600,easing:'ease-in'});
    animate(header,[{opacity:1},{opacity:0}],{duration:400});
    animate(sigil.querySelector('.moon-dark'),[{transform:'translate(0,0)'},{transform:'translate(9px,-5px) scale(1.02)'}],{delay:850,duration:1000,easing:'ease-in-out'});
    animate(sigil.querySelector('.moon-light'),[{opacity:1},{opacity:0}],{delay:1500,duration:400});
   }
   document.body.classList.add('home-departing');curtain.hidden=false;
   await animate(curtain,[{opacity:0},{opacity:1}],{delay:reduced?0:1850,duration:reduced?0:600,easing:'ease-in'});
   document.body.classList.add('home-loading');
   await wait(reduced?100:250);
   location.assign(destination);
  }catch{
   // A browser without animation support can still enter the game normally.
   location.assign(destination);
  }
 });
})();
