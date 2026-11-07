(function(root){
 'use strict';
 const outboxKey='minimajo.team-outbox.v1';
 function createTransport({fetch:fetcher,storage,timeout=3000}={}){
  let memory=[],flushing=null,storageFailed=!storage;
  const pending=item=>item&&typeof item==='object'&&typeof item.poolVersion==='string'&&typeof item.runId==='string'&&Number.isSafeInteger(item.matchLevel);
  const read=()=>{if(storageFailed)return memory;try{const value=JSON.parse(storage.getItem(outboxKey)??'[]');if(Array.isArray(value))return value.filter(pending).slice(-10);}catch{storageFailed=true;}return memory;};
  function write(items){memory=items;if(!storageFailed)try{storage.setItem(outboxKey,JSON.stringify(items));}catch{storageFailed=true;}}
  const key=record=>record.poolVersion+':'+record.runId+':'+record.matchLevel;
  async function request(url,options={},limit=timeout){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),limit);
   try{
    const response=await fetcher(url,{...options,signal:controller.signal}),body=await response.arrayBuffer();
    if(body.byteLength>1024*1024)throw Error('隊伍回應過大。');
    return new Response(response.status===204?null:body,{status:response.status,headers:response.headers});
   }finally{clearTimeout(timer);}
  }
  function flush(){
   if(flushing)return flushing;
   flushing=(async()=>{
    const tried=new Set();
    while(true){
     const record=read().find(item=>!tried.has(key(item)));if(!record)return;const id=key(record);tried.add(id);
     try{
      const body=JSON.stringify(record),response=await request('/api/player-teams',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:new TextEncoder().encode(body).length<60000});
      if(response.ok||[400,409,413,415,422].includes(response.status))write(read().filter(item=>key(item)!==id));
     }catch{/* Keep this victory for the next page/online event, never block gameplay. */}
    }
   })().finally(()=>flushing=null);return flushing;
  }
  function enqueue(record){const items=read().filter(item=>key(item)!==key(record));items.push(record);write(items.slice(-10));return flush();}
  return {enqueue,flush,request};
 }
 function create({poolVersion,statuses,transport,runId}={}){
  const id=runId??root.crypto.randomUUID(),records=typeof module!=='undefined'?require('./player-records.js'):root.PlayerRecords;
  return {
   runId:id,
   async pick(category,matchLevel){
    if(!['elite','boss'].includes(category))return null;
    try{
     const query=new URLSearchParams({category,level:String(matchLevel),runId:id,poolVersion});
     const response=await transport.request('/api/player-teams?'+query,{},1800);if(!response.ok)return null;
     const value=(await response.json()).record;if(!value)return null;
     const record=records.validate(value,{statuses});
     if(record.poolVersion!==poolVersion||record.runId===id||Math.abs(record.matchLevel-matchLevel)>2)return null;
     return record;
    }catch{return null;}
   },
   submit(snapshot){
    if(!snapshot)return Promise.resolve();
    try{return transport.enqueue(records.validate({...snapshot,format:'minimajo-team-record',version:1,poolVersion,runId:id},{statuses}));}catch{return Promise.resolve();}
   }
  };
 }
 const api={createTransport,create,outboxKey};if(typeof module!=='undefined')module.exports=api;
 else{
  let storage;try{storage=root.sessionStorage;}catch{}
  const transport=createTransport({fetch:(...args)=>root.fetch(...args),storage});
  root.PlayerRecordClient={create:options=>create({...options,transport})};
  transport.flush();root.addEventListener('online',()=>transport.flush());
 }
})(globalThis);
