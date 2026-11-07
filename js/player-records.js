(function(root){
 'use strict';
 const node=typeof module!=='undefined',D=node?require('./database.js'):root.ItemDB,L=node?require('./laws.js'):root.Laws,S=node?require('./skills.js'):root.SkillDB,T=node?require('./statuses.js'):root.Statuses,X=node?require('./expedition.js'):root.Expedition;
 const maxBytes=512*1024;
 function validRunId(value){return typeof value==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value);}
 function level(value){if(!Number.isSafeInteger(value)||value<1||value>1000000)throw Error('適配等級無效。');return value;}
 function pool(value){if(typeof value!=='string'||!/^[a-f0-9]{20,64}$/.test(value))throw Error('隊伍相容版本無效。');return value;}
 function board(value){
  if(!Array.isArray(value)||value.length!==10||!value.some(Boolean))throw Error('勝利隊伍需為非空十格編成。');
  const instances=new Set(),clean=value.map(unit=>{
   if(unit===null)return null;
   if(!unit||!validRunId(unit.instanceId)||instances.has(unit.instanceId))throw Error('角色實例無效或重複。');instances.add(unit.instanceId);
   return {...D.runtime(unit),instanceId:unit.instanceId,laws:L.validate(unit.laws??[],{allowDuplicates:true})};
  });
  if(!X.valid(clean))throw Error('勝利隊伍重疊或超出十格。');return clean;
 }
 function validate(value,{statuses}={}){
  if(!value||value.format!=='minimajo-team-record'||value.version!==1||!validRunId(value.runId)||!['normal','elite','boss'].includes(value.category))throw Error('勝利隊伍紀錄格式無效。');
  pool(value.poolVersion);level(value.matchLevel);
  const previous=statuses?T.snapshot():null;
  try{
   if(statuses)T.configure(statuses);
   const cleanBoard=board(value.board),skill=value.skill===null?null:S.validate({version:1,skills:[value.skill]}).skills[0];
   return {format:'minimajo-team-record',version:1,poolVersion:value.poolVersion,runId:value.runId,matchLevel:value.matchLevel,category:value.category,board:cleanBoard,skill};
  }finally{if(previous)T.configure(previous);}
 }
 function key(record){return record.poolVersion+':'+record.runId+':'+record.matchLevel;}
 const api={maxBytes,validRunId,level,pool,board,validate,key};if(node)module.exports=api;else root.PlayerRecords=api;
})(globalThis);
