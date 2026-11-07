(function(root){
 'use strict';
 function create({storage,backup,transport,onState=()=>{}}){
  let revision=null,queue=Promise.resolve(),requested=0,saved=0,pending=0,error='',ready=false;
  const state=()=>({ready,pending,dirty:saved<requested,error,revision});
  const report=()=>onState(state());
  async function load(){const data=await transport.load();const prepared=backup.prepare(data.file);backup.restore(storage,prepared.file);revision=data.revision;ready=true;report();return [...new Set([...(data.warnings??[]),...prepared.warnings])];}
  function enqueue(snapshot){
   const sequence=++requested;pending++;error='';report();
   const task=queue.then(async()=>{try{const result=await transport.save(snapshot,revision);revision=result.revision;saved=sequence;if(sequence===requested)error='';}catch(e){if(sequence===requested)error=e.message;throw e;}finally{pending--;report();}});
   queue=task.catch(()=>{});return task;
  }
  function save(){
   if(!ready)return Promise.reject(Error('固定資料檔尚未載入。'));
   try{return enqueue(backup.collect(storage));}catch(e){requested++;error=e.message;report();return Promise.reject(e);}
  }
  function replace(file){if(!ready)return Promise.reject(Error('固定資料檔尚未載入。'));return enqueue(backup.validate(file));}
  return {load,save,replace,state,settled:()=>queue};
 }
 const api={create};if(typeof module!=='undefined')module.exports=api;else root.EditorFile=api;
})(globalThis);
