(function(root){
 'use strict';
 const D=typeof module!=='undefined'?require('./database.js'):root.ItemDB,S=typeof module!=='undefined'?require('./skills.js'):root.SkillDB;
 const Config=typeof module!=='undefined'?require('./config.js'):root.GameConfig;
 const L=typeof module!=='undefined'?require('./laws.js'):root.Laws;
 const Echo=typeof module!=='undefined'?require('./echo-levels.js'):root.EchoLevels;
 const size=10,clone=x=>structuredClone(x);
 const ownedAreas=['active','reserve'];
 function ownedSlot(area,slot){return ownedAreas.includes(area)&&Number.isInteger(slot)&&slot>=0&&slot<size;}
 function draftTeams(state){return {active:state.active.slice(),reserve:state.reserve.slice()};}
 function rebuildOwned(state,unit,stars,laws){
  const base=state.library.find(u=>u.id===unit.id);
  if(!base)throw Error('找不到角色的能力資料。');
  // Always start with the library snapshot: adding laws or a star must not apply
  // the previous bonuses for a second time. The owned identity stays unchanged.
  return {...unit,...L.attach(D.atStars(base,stars,state.config),laws,state.config)};
 }
 function fits(board,unit,slot){return Number.isInteger(slot)&&slot>=0&&slot+unit.space<=size&&!board.some((other,i)=>other&&slot<i+other.space&&slot+unit.space>i);}
 function firstFit(board,unit){for(let i=0;i<size;i++)if(fits(board,unit,i))return i;return -1;}
 function ownerSlot(board,slot){return board.findIndex((unit,start)=>unit&&start<=slot&&slot<start+unit.space);}
 function preferredTransferSlot(state,from,start,to,end){
  const unit=state[from]?.[start],owner=state[to]?ownerSlot(state[to],end):-1,other=state[to]?.[owner];
  if(!unit||!other||from!==to||owner===start)return end;
  if(canMerge(unit,other))return owner;
  return owner>start?owner+other.space-unit.space:owner;
 }
 // Empty-cell moves keep the exact slot; swaps align whole unequal-width blocks.
 // Other units keep their relative order, minimizing moved units then distance.
 function arrange(entries,fixed){
  entries.sort((a,b)=>a.preferred-b.preferred);
  const memo=new Map();
  function solve(index,minimum){
   if(index===entries.length)return {moved:0,distance:0,slots:[]};
   const key=index+':'+minimum;if(memo.has(key))return memo.get(key);
   const entry=entries[index];let best=null;
   for(let at=minimum;at+entry.unit.space<=size;at++){
    if(fixed&&at<fixed.slot+fixed.unit.space&&at+entry.unit.space>fixed.slot)continue;
    const rest=solve(index+1,at+entry.unit.space);if(!rest)continue;
    const next={moved:rest.moved+(at!==entry.preferred?1:0),distance:rest.distance+Math.abs(at-entry.preferred),slots:[at,...rest.slots]};
    if(!best||next.moved<best.moved||next.moved===best.moved&&next.distance<best.distance)best=next;
   }
   memo.set(key,best);return best;
  }
  const plan=solve(0,0);if(!plan)return null;
  const board=Array(size).fill(null);if(fixed)board[fixed.slot]=fixed.unit;
  entries.forEach((entry,i)=>board[plan.slots[i]]=entry.unit);return board;
 }
 function planTransfer(state,from,start,to,end){
  const unit=state[from][start],draft=draftTeams(state),owner=ownerSlot(draft[to],end);
  const targetSlot=from===to&&owner===start?-1:owner,other=targetSlot>=0?draft[to][targetSlot]:null;
  draft[from][start]=null;if(other)draft[to][targetSlot]=null;
  const entries=area=>draft[area].flatMap((member,preferred)=>member?[{unit:member,preferred}]:[]);
  const destination=entries(to),source=from===to?destination:entries(from);
  if(other)source.push({unit:other,preferred:from===to&&targetSlot<start?start+unit.space-other.space:start});
  const preferred=preferredTransferSlot(state,from,start,to,end);
  const candidates=Array.from({length:size-unit.space+1},(_,i)=>i).sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred));
  const attempts=[{destination,sourceBoard:from===to?null:arrange(source,null)}];
  // If the exchanged role cannot fit back, keep it in the destination team and
  // try inserting the dragged role while pushing neighbors toward free space.
  if(from!==to&&other){
   const keep=draftTeams(state);keep[from][start]=null;
   attempts.push({destination:state[to].flatMap((member,at)=>member?[{unit:member,preferred:at}]:[]),sourceBoard:keep[from]});
  }
  for(const attempt of attempts){
   if(from!==to&&!attempt.sourceBoard)continue;
   for(const slot of candidates){
    const destinationBoard=arrange(attempt.destination,{unit,slot});if(!destinationBoard)continue;
    const plan={active:draft.active,reserve:draft.reserve,slot};plan[to]=destinationBoard;if(from!==to)plan[from]=attempt.sourceBoard;return plan;
   }
  }
  return null;
 }
 function transferSlot(state,from,start,to,end){
  if(!ownedSlot(from,start)||!ownedSlot(to,end)||!state[from][start])return end;
  const owner=ownerSlot(state[to],end),other=state[to][owner];
  if(canMerge(state[from][start],other))return owner;
  return planTransfer(state,from,start,to,end)?.slot??end;
 }
 function eligible(state){return S.evaluate(state.active,state.skills).filter(x=>x.matched).map(x=>x.skill);}
 function syncSkill(state){if(!eligible(state).some(x=>x.id===state.skillId))state.skillId=null;}
 function create(characters=D.defaults,skills=S.defaults,config=Config.defaults,laws=[],echo=Echo.defaults){
  config=Config.validate(config,characters);
  const jobGrowth=Object.fromEntries(characters.filter(u=>u.growth).map(u=>[u.job,u.growth]));
  const raceBonuses=Object.fromEntries(characters.filter(u=>u.raceBonus).map(u=>[u.race,u.raceBonus]));
  const rarityBonuses=Object.fromEntries(characters.filter(u=>u.rarityBonus).map(u=>[u.rarity,u.rarityBonus]));
  const library=D.validate({version:2,items:characters,jobGrowth,raceBonuses,rarityBonuses}).items;
  const state={active:Array(size).fill(null),reserve:Array(size).fill(null),library,echoSettings:Echo.validate(echo),echoLevel:1,shopRerolls:{},lawLibrary:L.validate(laws),lawShops:{},skills:S.validate({version:1,skills}).skills,skillId:null,config,gold:config.startingGold,shops:{},serial:0};
  for(const [area,key] of [['active','startingActive']])state[area]=config[key].map(id=>{if(id===null)return null;const base=library.find(u=>u.id===id);return {...D.atStars(base,base.stars,config),instanceId:'owned-'+(++state.serial)};});
  return state;
 }
 function valid(board){const seen=new Set();for(let i=0;i<size;i++)if(board[i]){if(!Number.isInteger(board[i].space)||board[i].space<1||i+board[i].space>size)return false;for(let j=i;j<i+board[i].space;j++){if(seen.has(j))return false;seen.add(j);}}return true;}
 function transfer(state,from,start,to,end){
  if(!ownedSlot(from,start)||!ownedSlot(to,end))throw Error('請選擇有效的隊伍格位。');
  const unit=state[from][start];if(!unit)throw Error('請先選擇要移動的角色。');
  if(from===to&&start===end)return;
  const draft=draftTeams(state),owner=ownerSlot(draft[to],end);
  const targetSlot=from===to&&owner===start?-1:owner,other=targetSlot>=0?draft[to][targetSlot]:null;
  if(canMerge(unit,other))return merge(state,from,start,to,targetSlot);
  const plan=planTransfer(state,from,start,to,end);
  if(!plan||!valid(plan.active)||!valid(plan.reserve))throw Error('連續空間不足，無法放置或交換；角色未移動。');
  state.active=plan.active;state.reserve=plan.reserve;syncSkill(state);
 }
 function canMerge(source,target){return !!source&&!!target&&source.instanceId!==target.instanceId&&source.id===target.id&&source.stars===target.stars&&source.stars<6;}
 function merge(state,from,start,to,end){
  if(!ownedSlot(from,start)||!ownedSlot(to,end))throw Error('請選擇有效的合成格位。');
  const source=state[from][start],target=state[to][end];if(!canMerge(source,target))throw Error('合成需要兩隻相同角色、相同星等，且未達六星。');
  const upgraded=rebuildOwned(state,target,target.stars+1,[...(target.laws??[]),...(source.laws??[])]);
  const draft=draftTeams(state);draft[from][start]=null;draft[to][end]=upgraded;
  if(!valid(draft.active)||!valid(draft.reserve))throw Error('合成後的角色無法放入此格位。');
  state.active=draft.active;state.reserve=draft.reserve;syncSkill(state);return upgraded;
 }
 function recruit(state,item){
  for(const area of ['reserve','active']){
   const slot=firstFit(state[area],item);if(slot<0)continue;
   const unit={...clone(item),instanceId:'owned-'+(state.serial+1)};delete unit.price;
   state[area][slot]=unit;state.serial++;syncSkill(state);return {unit,area,slot};
  }
  throw Error('連續空間不足，請先按「整備隊伍」，販賣或手動合成角色清理空間，再領取獎勵。');
 }
 function equip(state,id){if(id!==null&&!eligible(state).some(x=>x.id===id))throw Error('此技能不符合目前出戰隊伍。');state.skillId=id;}
 function rollShop(state,key,random){
   const board=Array(size).fill(null);
   for(let i=0;i<state.config.shopCount;i++){
    const base=Echo.pick(state.library.filter(u=>firstFit(board,u)>=0),state.echoSettings,state.echoLevel,random);if(!base)break;
    const slot=firstFit(board,base);board[slot]={...D.atStars(base,base.stars,state.config),instanceId:'stock-'+key+'-'+i,price:base.shopPrice};
   }
   return board;
 }
 function put(store,key,value){Object.defineProperty(store,key,{value,enumerable:true,writable:true,configurable:true});}
 function shop(state,key,random=Math.random){
  if(!Object.hasOwn(state.shops,key))put(state.shops,key,rollShop(state,key,random));
  return state.shops[key];
 }
 function buy(state,key,slot,area,destination){
  if(!ownedAreas.includes(area))throw Error('請選擇出戰或儲存隊伍。');
  const stock=shop(state,key),item=stock[slot];if(!item)throw Error('商品已售出。');
  const target=destination===undefined?firstFit(state[area],item):destination;if(!fits(state[area],item,target))throw Error('這支隊伍沒有足夠的連續空間，可切換到另一隊或先調整角色。');
  if(state.gold<item.price)throw Error('測試金幣不足。');
  const unit={...clone(item),instanceId:'owned-'+(++state.serial)};delete unit.price;
  state[area][target]=unit;state.gold-=item.price;stock[slot]=null;syncSkill(state);return target;
 }
 function sellValue(unit,config=Config.defaults){return Math.floor(unit.shopPrice*config.sellPercent/100);}
 function rollLawShop(state,random){
   const pool=state.lawLibrary.filter(l=>l.shopWeight>0),stock=[];
   for(let i=0;pool.length&&i<4;i++){
    let roll=random()*pool.reduce((sum,l)=>sum+l.shopWeight,0),chosen=pool.at(-1);
    for(const law of pool){roll-=law.shopWeight;if(roll<0){chosen=law;break;}}
    stock.push({...clone(chosen),price:chosen.shopPrice});
   }
   return stock;
 }
 function lawShop(state,key,random=Math.random){
  if(!Object.hasOwn(state.lawShops,key))put(state.lawShops,key,rollLawShop(state,random));
  return state.lawShops[key];
 }
 function rerollCost(state,key){return state.config.shopRerollBase+(Object.hasOwn(state.shopRerolls,key)?state.shopRerolls[key]:0)*state.config.shopRerollIncrement;}
 function reroll(state,key,random=Math.random){
  const cost=rerollCost(state,key);if(!Number.isSafeInteger(cost)||state.gold<cost)throw Error('金幣不足，無法重骰商品。');
  const characters=rollShop(state,key,random),laws=rollLawShop(state,random);
  if(!characters.some(Boolean)&&!laws.length)throw Error('目前沒有可抽選的商品，未扣除金幣。');
  put(state.shops,key,characters);put(state.lawShops,key,laws);put(state.shopRerolls,key,(Object.hasOwn(state.shopRerolls,key)?state.shopRerolls[key]:0)+1);state.gold-=cost;return cost;
 }
 function upgradeEcho(state){if(state.echoLevel>=state.echoSettings.levels.length)return false;state.echoLevel++;return true;}
 function findOwned(state,instanceId){
  for(const area of ownedAreas){const slot=state[area].findIndex(u=>u&&u.instanceId===instanceId);if(slot>=0)return {area,slot,unit:state[area][slot]};}
  return null;
 }
 function buyLaw(state,key,slot,instanceId){
  const target=findOwned(state,instanceId);if(!target)throw Error('請先選擇自己隊伍中的角色。');
  const stock=lawShop(state,key),law=stock[slot];if(!law)throw Error('法則商品已售出。');
  if(state.gold<law.price)throw Error('金幣不足。');
  const next=rebuildOwned(state,target.unit,target.unit.stars,[...(target.unit.laws??[]),law]);
  state[target.area][target.slot]=next;state.gold-=law.price;stock[slot]=null;syncSkill(state);
  return next;
 }
 function sell(state,area,slot){
  if(!ownedSlot(area,slot)||!state[area][slot])throw Error('只能賣出自己隊伍中的角色。');
  const unit=state[area][slot],value=sellValue(unit,state.config);state[area][slot]=null;state.gold+=value;syncSkill(state);return value;
 }
 const api={size,create,fits,firstFit,ownerSlot,transferSlot,valid,eligible,syncSkill,transfer,canMerge,merge,recruit,equip,shop,buy,sell,sellValue,lawShop,findOwned,buyLaw,rerollCost,reroll,upgradeEcho};if(typeof module!=='undefined')module.exports=api;else root.Expedition=api;
})(globalThis);
