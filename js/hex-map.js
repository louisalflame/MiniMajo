(function(root){
 'use strict';
 const directions=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
 const types={entrance:{name:'入口',icon:'◎'},battle:{name:'戰鬥',icon:'⚔'},elite:{name:'菁英戰鬥',icon:'♜'},rest:{name:'營地',icon:'☾'},shop:{name:'商店',icon:'◇'},goal:{name:'終點',icon:'✦'},fragile:{name:'脆弱地板',icon:'⌁'},empty:{name:'空地',icon:'·'}};
 const quotaTypes=['battle','elite','rest','shop','fragile'];
 const key=(q,r)=>q+','+r;
 function neighbors(map,id){const cell=map.cells[id];if(!cell)return [];return directions.map(([q,r])=>key(cell.q+q,cell.r+r)).filter(id=>Object.hasOwn(map.cells,id));}
 function distance(a,b){return Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));}
 function random(seed){let value=2166136261;for(const c of seed)value=Math.imul(value^c.charCodeAt(0),16777619);return ()=>{value+=0x6d2b79f5;let n=value;n=Math.imul(n^n>>>15,n|1);n^=n+Math.imul(n^n>>>7,n|61);return ((n^n>>>14)>>>0)/4294967296;};}
 function defaults(radius){const n=1+3*radius*(radius+1)-2;return {quotas:{battle:Math.round(n*24/59),elite:Math.max(1,Math.round(n*5/59)),rest:Math.max(1,Math.round(n*5/59)),shop:Math.max(1,Math.round(n*4/59)),fragile:Math.round(n*6/59)},eliteSpacing:2,restSpacing:3,shopSpacing:2,supplySpacing:2,safeRadius:3};}
 function generate(radius=4,seed='MINIMAJO',settings){
  if(!Number.isInteger(radius)||radius<2||radius>6)throw Error('地圖半徑需為 2～6。');
  if(typeof seed!=='string'||!seed.trim()||seed.length>60)throw Error('種子需為 1～60 字。');
  const base=defaults(radius),rules={...base,...settings,quotas:{...base.quotas,...settings?.quotas}},cells={};
  // Old custom maps did not reserve room for fragile tiles. Do not invalidate
  // their other quotas by silently adding a new allocation.
  if(settings?.quotas&&!Object.hasOwn(settings.quotas,'fragile'))rules.quotas.fragile=0;
  for(const type of quotaTypes)if(!Number.isInteger(rules.quotas[type])||rules.quotas[type]<0)throw Error('事件配額需為非負整數。');
  for(const field of ['eliteSpacing','restSpacing','shopSpacing','supplySpacing','safeRadius'])if(!Number.isInteger(rules[field])||rules[field]<0||rules[field]>12)throw Error('間距與安全範圍需為 0～12 整數。');
  for(let q=-radius;q<=radius;q++)for(let r=Math.max(-radius,-q-radius);r<=Math.min(radius,-q+radius);r++)cells[key(q,r)]={q,r,type:'empty'};
  const entrance=key(-radius,0),goal=key(radius,0);cells[entrance].type='entrance';cells[goal].type='goal';
  const interior=Object.keys(cells).filter(id=>id!==entrance&&id!==goal),count=Object.values(rules.quotas).reduce((a,b)=>a+b,0);
  if(count>interior.length)throw Error('事件總數超過可用格數，請降低配額或放大地圖。');
  if(rules.quotas.elite>interior.filter(id=>distance(cells[id],cells[entrance])>=rules.safeRadius).length)throw Error('入口安全範圍內無法容納菁英配額，請降低配額或安全範圍。');
  const rng=random(seed.trim()),shuffle=list=>list.map(id=>({id,rank:rng()})).sort((a,b)=>a.rank-b.rank).map(x=>x.id);
  const sector=c=>{const angle=Math.atan2(c.r*1.5,Math.sqrt(3)*(c.q+c.r/2));return Math.floor((angle+Math.PI)/(Math.PI/3))%6;};
  for(let attempt=0;attempt<160;attempt++){
   interior.forEach(id=>cells[id].type='empty');let success=true;
   const placed={elite:[],rest:[],shop:[]},supply=[];
   for(const type of ['rest','shop','elite']){
    for(let n=0;n<rules.quotas[type];n++){
     let candidates=shuffle(interior.filter(id=>cells[id].type==='empty'&&(type!=='elite'||distance(cells[id],cells[entrance])>=rules.safeRadius)&&placed[type].every(other=>distance(cells[id],cells[other])>=rules[type+'Spacing'])&&(type==='elite'||supply.every(other=>cells[other].type===type||distance(cells[id],cells[other])>=rules.supplySpacing))));
     if(!candidates.length){success=false;break;}
     // Prefer less-used sectors; randomized ties allow different seeded layouts.
     const peers=type==='elite'?placed[type]:supply;
     candidates.sort((a,b)=>peers.filter(id=>sector(cells[id])===sector(cells[a])).length-peers.filter(id=>sector(cells[id])===sector(cells[b])).length);
     const id=candidates[0];cells[id].type=type;placed[type].push(id);if(type!=='elite')supply.push(id);
    }
    if(!success)break;
   }
   if(!success)continue;
   shuffle(interior.filter(id=>cells[id].type==='empty')).slice(0,rules.quotas.battle).forEach(id=>cells[id].type='battle');
   shuffle(interior.filter(id=>cells[id].type==='empty')).slice(0,rules.quotas.fragile).forEach(id=>cells[id].type='fragile');
   return {radius,seed:seed.trim(),cells,entrance,goal,rules};
  }
  throw Error('未找到符合配額與間距的配置。請降低配額／間距、放大地圖，或換個種子；目前地圖保留。');
 }
 const rewardTiers={full:{label:'全',moneyPercent:100,choices:3},high:{label:'高',moneyPercent:80,choices:2},medium:{label:'中',moneyPercent:50,choices:1},low:{label:'低',moneyPercent:20,choices:0},none:{label:'無',moneyPercent:0,choices:0}};
 const decayDefaults={enabled:true,stages:[{after:3,tier:'high'},{after:2,tier:'medium'},{after:1,tier:'low'},{after:2,tier:'none'}]};
 function validateDecay(value=decayDefaults){
  if(!value||typeof value.enabled!=='boolean'||!Array.isArray(value.stages)||value.stages.length>10)throw Error('獎勵衰減需設定開關及最多 10 個階段。');
  let previous=100;const stages=value.stages.map(row=>{if(!row||!Number.isInteger(row.after)||row.after<1||row.after>999||!Object.hasOwn(rewardTiers,row.tier)||rewardTiers[row.tier].moneyPercent>previous)throw Error('階段間隔需為 1～999 回合，獎勵階級只能維持或降低。');previous=rewardTiers[row.tier].moneyPercent;return {after:row.after,tier:row.tier};});return {enabled:value.enabled,stages};
 }
 function rewardAt(state,id,settings=state.rewardDecay){
  if(!['battle','elite','goal'].includes(state.map.cells[id]?.type)||!state.revealed.has(id))return null;
  if(state.rewardLocks[id])return {...state.rewardLocks[id],locked:true};
  const policy=validateDecay(settings),age=Math.max(0,state.steps-state.revealedAt[id]);let tier='full',at=0,nextIn=null,nextTier=null;
  if(policy.enabled&&state.map.cells[id].type!=='goal')for(const row of policy.stages){at+=row.after;if(age<at){nextIn=at-age;nextTier=row.tier;break;}tier=row.tier;}
  return {tier,...rewardTiers[tier],age,nextIn,nextTier,locked:false};
 }
 function rewardText(reward){if(!reward)return '';const characters=reward.choices?reward.choices+'選1':'無角色';const next=reward.nextIn!==null&&!reward.locked?' · 再 '+reward.nextIn+' 回合→'+rewardTiers[reward.nextTier].label+'（金錢 '+rewardTiers[reward.nextTier].moneyPercent+'%／'+(rewardTiers[reward.nextTier].choices?rewardTiers[reward.nextTier].choices+'選1':'無角色')+'）':'';return '獎勵 '+reward.label+' · 金錢 '+reward.moneyPercent+'% · '+characters+(reward.locked?' · 已鎖定':next);}
 function explore(map,settings){const state={map,rewardDecay:validateDecay(settings),revealedAt:{},rewardLocks:{},current:map.entrance,revealed:new Set(),visited:new Set([map.entrance]),cleared:new Set([map.entrance]),collapsed:new Set(),steps:0,pending:null,complete:false,path:[map.entrance]};reveal(state);return state;}
 function reveal(state){[state.current,...neighbors(state.map,state.current)].forEach(id=>{if(!state.revealed.has(id))state.revealedAt[id]=state.steps;state.revealed.add(id);});}
 function canMove(state,id){return !state.complete&&!state.pending&&!state.collapsed.has(id)&&neighbors(state.map,state.current).includes(id);}
 function move(state,id){if(!canMove(state,id))return false;if(state.map.cells[state.current].type==='fragile')state.collapsed.add(state.current);state.current=id;state.steps++;state.path.push(id);state.visited.add(id);reveal(state);const type=state.map.cells[id].type;if(['battle','elite','goal'].includes(type)&&!state.cleared.has(id)&&!state.rewardLocks[id])state.rewardLocks[id]=rewardAt(state,id);if(type==='goal'){state.complete=true;state.cleared.add(id);}else if(type==='empty'||type==='fragile')state.cleared.add(id);else if(!state.cleared.has(id)&&type!=='entrance')state.pending=id;return true;}
 function resolve(state){if(!state.pending)return false;state.cleared.add(state.pending);state.pending=null;return true;}
 function view(state,id,omniscient=false){const cell=state.map.cells[id];if(!cell)return null;const visible=omniscient||state.revealed.has(id);return {id,q:cell.q,r:cell.r,visible,type:visible?cell.type:id===state.map.goal?'goal':null,current:id===state.current,visited:state.visited.has(id),cleared:state.cleared.has(id),collapsed:state.collapsed.has(id),reachable:canMove(state,id)};}
 const api={read:(storage,warnings)=>(typeof module!=='undefined'?require('./saved-data.js'):root.SavedData).read('map',storage,warnings),load:(data,warnings,...args)=>(typeof module!=='undefined'?require('./saved-data.js'):root.SavedData).map(data,warnings,...args),types,quotaTypes,key,neighbors,distance,generate,defaults,rewardTiers,decayDefaults,validateDecay,rewardAt,rewardText,explore,canMove,move,resolve,view};if(typeof module!=='undefined')module.exports=api;else root.HexMap=api;
})(globalThis);
