// One logical viewport for every game scene, including its dialogs and battle frame.
(() => {
 'use strict';
 const host=window===window.top;
 window.MiniMajoViewport={host,width:1600,height:900};
 if(!host){
  let rotated=false,scrollTouch=null;
  // Native iframe scrolling follows the screen axis in Chromium, even when its
  // contents are rotated. Translate touch motion in scene coordinates instead.
  document.addEventListener('touchstart',event=>{
   scrollTouch=null;
   if(!rotated||event.touches.length!==1)return;
   const selector='.detail-content,#roster-skill-options,.skill-selected-details,.reward-description-scroll,.shop-inspect-content,.law-card-copy,.ui-panel-body';
   let target=event.target.closest(selector);
   while(target&&target.scrollHeight<=target.clientHeight)target=target.parentElement?.closest(selector);
   if(target&&!event.target.closest('.roster-tile,.reward-card'))scrollTouch={target,y:event.touches[0].clientY};
  },{passive:true});
  document.addEventListener('touchmove',event=>{
   if(!scrollTouch||event.touches.length!==1)return;
   event.preventDefault();
   const y=event.touches[0].clientY;
   scrollTouch.target.scrollTop+=scrollTouch.y-y;scrollTouch.y=y;
  },{passive:false});
  for(const type of ['touchend','touchcancel'])document.addEventListener(type,()=>{scrollTouch=null;},{passive:true});
  addEventListener('message',event=>{
   if(event.origin===location.origin&&event.data?.type==='minimajo-scene'&&Array.from(document.querySelectorAll('iframe')).some(frame=>frame.contentWindow===event.source)){
    event.source.postMessage({type:'minimajo-viewport-change',rotated},location.origin==='null'?'*':location.origin);return;
   }
   if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='minimajo-viewport-change')return;
   rotated=!!event.data.rotated;scrollTouch=null;
   document.dispatchEvent(new Event('pointercancel'));dispatchEvent(new Event('resize'));
   for(const frame of document.querySelectorAll('iframe'))frame.contentWindow?.postMessage(event.data,location.origin==='null'?'*':location.origin);
  });
  const ready=()=>parent.postMessage({type:'minimajo-scene',href:location.href,title:document.title},location.origin==='null'?'*':location.origin);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
  return;
 }
 const root=document.documentElement;
 root.setAttribute('data-game-host','');
 root.removeAttribute('data-assets-loading');
 function mount(){
  const frame=document.createElement('iframe'),insets=document.createElement('div');
  frame.id='game-frame';frame.name='minimajo-game-scene';frame.title='MiniMajo 遊戲';frame.width='1600';frame.height='900';
  frame.setAttribute('allow','fullscreen');
  insets.id='game-safe-insets';insets.setAttribute('aria-hidden','true');
  document.body.replaceChildren(insets,frame);
  let lastFit='';
  function fit(){
   const vv=window.visualViewport,zoomed=(vv?.scale??1)>1.01;
   const width=!zoomed?(vv?.width??innerWidth):innerWidth,height=!zoomed?(vv?.height??innerHeight):innerHeight;
   const style=getComputedStyle(insets),left=parseFloat(style.paddingLeft)||0,right=parseFloat(style.paddingRight)||0,top=parseFloat(style.paddingTop)||0,bottom=parseFloat(style.paddingBottom)||0;
   const availableWidth=Math.max(1,width-left-right),availableHeight=Math.max(1,height-top-bottom),rotated=availableHeight>availableWidth;
   const scale=Math.min(availableWidth/(rotated?900:1600),availableHeight/(rotated?1600:900));
   frame.style.left=((!zoomed?(vv?.offsetLeft??0):0)+left+availableWidth/2)+'px';
   frame.style.top=((!zoomed?(vv?.offsetTop??0):0)+top+availableHeight/2)+'px';
   frame.style.transform=`translate(-50%,-50%) rotate(${rotated?90:0}deg) scale(${scale})`;
   root.setAttribute('data-game-rotation',rotated?'90':'0');
   const signature=frame.style.left+'|'+frame.style.top+'|'+frame.style.transform;
   if(signature!==lastFit){lastFit=signature;frame.contentWindow?.postMessage({type:'minimajo-viewport-change',rotated},location.origin==='null'?'*':location.origin);}
  }
  function syncScene(href,title){
   try{
    const next=new URL(href);
    if(next.origin===location.origin&&(/\/(?:index|play|battle)\.html$/.test(next.pathname)||next.pathname.endsWith('/'))){
     if(next.href!==location.href)history.replaceState(history.state,'',next.pathname+next.search+next.hash);
     document.title=title;
    }
   }catch{}
  }
  // Publish navigation before images finish, including while Loading awaits a retry.
  addEventListener('message',event=>{
   if(event.source===frame.contentWindow&&event.origin===location.origin&&event.data?.type==='minimajo-scene'&&typeof event.data.href==='string'&&typeof event.data.title==='string'){
    syncScene(event.data.href,event.data.title);
    frame.contentWindow.postMessage({type:'minimajo-viewport-change',rotated:root.getAttribute('data-game-rotation')==='90'},location.origin==='null'?'*':location.origin);
   }
  });
  frame.addEventListener('load',()=>{
   try{syncScene(frame.contentWindow.location.href,frame.contentDocument.title);}catch{}
   frame.contentWindow?.postMessage({type:'minimajo-viewport-change',rotated:root.getAttribute('data-game-rotation')==='90'},location.origin==='null'?'*':location.origin);
  });
  fit();frame.src=location.href;
  addEventListener('resize',fit);addEventListener('orientationchange',fit);addEventListener('pageshow',fit);
  window.visualViewport?.addEventListener('resize',fit);window.visualViewport?.addEventListener('scroll',fit);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
