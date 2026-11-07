'use strict';
const Records=require('../js/player-records.js');
const json=(status,data)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function readBody(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw Object.assign(Error('需要JSON資料。'),{status:415});
 const reader=request.body?.getReader();if(!reader)throw Object.assign(Error('缺少資料。'),{status:400});
 const chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>Records.maxBytes){await reader.cancel();throw Object.assign(Error('紀錄超過512 KiB。'),{status:413});}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw Object.assign(Error('JSON無法解析。'),{status:400});}
}
async function handle({request,env}){
 const url=new URL(request.url),route=url.pathname;
 if(!['/api/health','/api/player-teams'].includes(route))return json(404,{error:'找不到功能。'});
 if(!env.DB)return json(503,{error:'隊伍資料庫尚未連接。'});
 try{
  if(route==='/api/health'){
   if(request.method!=='GET')return json(405,{error:'不支援的操作。'});
   await env.DB.prepare('SELECT record_id FROM player_teams LIMIT 1').first();return json(200,{ok:true,database:true});
  }
  if(!['GET','POST'].includes(request.method))return json(405,{error:'不支援的操作。'});
  const origin=request.headers.get('origin');if(request.method==='POST'&&origin&&origin!==url.origin)return json(403,{error:'不允許此來源。'});
  const policyResponse=await env.ASSETS.fetch(new Request(new URL('/data/record-policy.json',url)));
  if(!policyResponse.ok)return json(503,{error:'隊伍版本設定尚未備妥。'});
  const policy=await policyResponse.json();Records.pool(policy.poolVersion);
  if(request.method==='POST'){
   const body=await readBody(request);
   if(!body||typeof body!=='object'||Array.isArray(body))return json(422,{error:'勝利隊伍紀錄格式無效。'});
   if(body.poolVersion!==policy.poolVersion)return json(409,{error:'隊伍版本已更新。'});
   let record;try{record=Records.validate(body,{statuses:policy.statuses});}catch(error){return json(422,{error:error.message});}
   const id=Records.key(record),snapshot=JSON.stringify(record);
   if(new TextEncoder().encode(snapshot).length>Records.maxBytes)return json(413,{error:'紀錄超過512 KiB。'});
   await env.DB.prepare('INSERT INTO player_teams(record_id,pool_version,run_id,match_level,category,snapshot_json) VALUES(?,?,?,?,?,?) ON CONFLICT(pool_version,run_id,match_level) DO NOTHING').bind(id,record.poolVersion,record.runId,record.matchLevel,record.category,snapshot).run();
   return json(200,{ok:true,recordId:id});
  }
  const category=url.searchParams.get('category'),runId=url.searchParams.get('runId'),requestedPool=url.searchParams.get('poolVersion');
  if(!['elite','boss'].includes(category)||!Records.validRunId(runId))return json(400,{error:'隊伍查詢條件無效。'});
  let target;try{target=Records.level(Number(url.searchParams.get('level')));Records.pool(requestedPool);}catch(error){return json(400,{error:error.message});}
  if(requestedPool!==policy.poolVersion)return json(200,{record:null});
  const args=[requestedPool,runId,Math.max(1,target-2),Math.min(1000000,target+2),target];
  const chosen=await env.DB.prepare('SELECT match_level FROM player_teams WHERE pool_version=? AND enabled=1 AND run_id<>? AND match_level BETWEEN ? AND ? GROUP BY match_level ORDER BY ABS(match_level-?),match_level LIMIT 1').bind(...args).first();
  if(!chosen)return json(200,{record:null});
  const filter=[requestedPool,runId,chosen.match_level];
  const count=await env.DB.prepare('SELECT COUNT(*) AS count FROM player_teams WHERE pool_version=? AND enabled=1 AND run_id<>? AND match_level=?').bind(...filter).first();
  const offset=Math.floor(Math.random()*count.count);
  const row=await env.DB.prepare('SELECT snapshot_json FROM player_teams WHERE pool_version=? AND enabled=1 AND run_id<>? AND match_level=? ORDER BY record_id LIMIT 1 OFFSET ?').bind(...filter,offset).first();
  if(!row)return json(200,{record:null});
  try{return json(200,{record:Records.validate(JSON.parse(row.snapshot_json),{statuses:policy.statuses})});}catch{return json(200,{record:null});}
 }catch(error){if(error.status)return json(error.status,{error:error.message});console.error('Player team service:',error.message);return json(503,{error:'隊伍服務暫時無法使用。'});}
}
module.exports={handle};
