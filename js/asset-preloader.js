(function(root){
 'use strict';
 async function loadImages(urls,{load,onProgress=()=>{},concurrency=4}={}){
  const queue=[...new Set(urls)],failed=[];let next=0,completed=0;
  async function worker(){while(next<queue.length){const url=queue[next++];try{await load(url);}catch{failed.push(url);}completed++;onProgress({completed,total:queue.length,failed:failed.length});}}
  await Promise.all(Array.from({length:Math.min(concurrency,queue.length)},worker));return failed;
 }
 function loadImage(url){
  return new Promise((resolve,reject)=>{
   const image=new root.Image();let settled=false;
   const timer=setTimeout(()=>finish(Error('圖片載入逾時')),45000);
   function finish(error){if(settled)return;settled=true;clearTimeout(timer);image.onload=image.onerror=null;error?reject(error):resolve();}
   image.onload=()=>{if(image.decode)image.decode().then(()=>finish(),finish);else finish();};
   image.onerror=()=>finish(Error('圖片載入失敗'));image.src=url;
  });
 }
 const api={loadImages};if(typeof module!=='undefined')module.exports=api;
 else if(root.document?.documentElement.hasAttribute('data-assets-loading')){
  const d=root.document,$=id=>d.getElementById(id),panel=$('asset-loading');
  root.MiniMajoAssetsReady=new Promise(resolve=>{
   let pending=root.MiniMajoRelease?.images,busy=false;
   function finish(){for(const frame of d.querySelectorAll('iframe[data-src]')){frame.src=frame.dataset.src;frame.removeAttribute('data-src');}d.documentElement.removeAttribute('data-assets-loading');panel.hidden=true;resolve();}
   async function run(){
    if(busy)return;
    if(root.publicDataError){finish();return;}
    if(!Array.isArray(pending)||!pending.length){$('asset-loading-status').textContent='載入失敗，請重新整理。';$('asset-loading-status').hidden=false;panel.setAttribute('aria-busy','false');return;}
    busy=true;$('asset-loading-retry').hidden=true;$('asset-loading-status').hidden=true;panel.setAttribute('aria-busy','true');
    const failed=await loadImages(pending,{load:loadImage});
    pending=failed;busy=false;panel.setAttribute('aria-busy','false');
    if(!failed.length){finish();return;}
    $('asset-loading-status').textContent='載入失敗';$('asset-loading-status').hidden=false;$('asset-loading-retry').hidden=false;
   }
   $('asset-loading-retry').addEventListener('click',run);run();
  });
 }
})(globalThis);
