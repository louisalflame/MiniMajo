(async()=>{
 'use strict';
 const $=id=>document.getElementById(id),main=document.querySelector('main');
 const say=text=>$('editor-file-status').textContent=text,retry=$('editor-file-retry');
 retry.onclick=()=>location.reload();
 async function request(method,file,revision){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
   const response=await fetch('/api/editor-data',{method,signal:controller.signal,cache:'no-store',...(file?{headers:{'Content-Type':'application/json','X-MiniMajo-Editor':'1','If-Match':revision},body:JSON.stringify(file)}:{})});
   let data;try{data=await response.json();}catch{throw Error('無法連線固定檔案服務，請以「啟動MiniMajo.cmd」開啟本機服務。');}
   if(!response.ok)throw Error(data.error??'固定檔案操作失敗。');return data;
  }catch(e){throw Error(e.name==='AbortError'?'固定檔案操作逾時，請確認本機服務仍在執行，再重試。':e instanceof TypeError?'無法連線固定檔案服務，請確認「啟動MiniMajo.cmd」仍在執行。':e.message);}finally{clearTimeout(timer);}
 }
 const session=EditorFile.create({storage:localStorage,backup:EditorBackup,transport:{load:()=>request('GET'),save:(file,revision)=>request('PUT',file,revision)},onState:s=>{
  $('editor-file-status').dataset.state=s.error?'error':s.pending?'pending':'ready';
  say(s.error?'寫入失敗：'+s.error:s.pending?'正在覆蓋 minimajo-editor.json…':s.dirty?'固定檔案尚未寫入。':s.ready?'已同步：minimajo-editor.json':'讀取固定檔案中…');
  retry.hidden=!s.error;retry.textContent='重試寫入';retry.onclick=()=>session.save().catch(()=>{});
 }});
 window.EditorFileSession=session;
 window.addEventListener('beforeunload',event=>{const s=session.state();if(s.pending||s.dirty){event.preventDefault();event.returnValue='';}});
 try{
  if(!['http:','https:'].includes(location.protocol))throw Error('請執行「啟動MiniMajo.cmd」，再開啟 http://127.0.0.1:4173/editor.html；直接開啟 HTML 無法覆蓋固定檔案。');
  const warnings=await session.load();for(const warning of warnings)if(!SavedData.warnings.includes(warning))SavedData.warnings.push(warning);
  const original=Storage.prototype.setItem,keys=new Set(Object.values(EditorBackup.keys));
  Storage.prototype.setItem=function(key,value){original.call(this,key,value);if(this===localStorage&&keys.has(String(key)))session.save().catch(()=>{});};
  for(const name of ['status-loader','skill-editor','app','action-overview','law-editor','status-editor','enemy-editor','enemy-tournament-ui','expedition-ui','map-editor','config-editor','echo-editor','tabs','backup-ui']){
   await new Promise((resolve,reject)=>{const script=document.createElement('script'),crash=e=>reject(Error(e.message||'編輯器初始化失敗'));window.addEventListener('error',crash);script.src='js/'+name+'.js';script.onload=()=>{window.removeEventListener('error',crash);resolve();};script.onerror=()=>{window.removeEventListener('error',crash);reject(Error('無法載入 '+name+'.js'));};document.head.append(script);});
  }
  main.inert=false;$('database-export').disabled=false;$('database-import').disabled=false;document.documentElement.dataset.editorReady='true';
 }catch(e){$('editor-file-status').dataset.state='error';say('讀取失敗：'+e.message);retry.hidden=false;retry.textContent='重新讀取';retry.onclick=()=>location.reload();main.inert=true;
  if(location.protocol==='file:'){const link=document.createElement('a');link.id='editor-file-open-http';link.href='http://127.0.0.1:4173/editor.html';link.textContent='開啟正確的編輯器網址';$('editor-file-status').parentElement.append(link);}
 }
})();
