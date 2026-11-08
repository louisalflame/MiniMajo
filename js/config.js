(function(root){
 const fields=[["teamPoolVersion","config-team-pool-version","歷史隊伍池版本（手動）",1,1,1000000,1],["battleVolume","config-battle-volume","戰鬥音量（%）",60,0,100,1],["downSlowPercent","config-down-slow-percent","倒地行動速度降低（%）",20,0,100,1],["shopRerollBase","config-reroll-base","商店重骰初始費用",20,0,1000000,1],["shopRerollIncrement","config-reroll-increment","商店重骰累加費用",10,0,1000000,1],["battleSeconds","config-time","基礎戰鬥時間（秒）",120,1,3600,1],["overtimeDamage","config-damage","超時初始每次扣血量",10,1,10000,1],["overtimeInterval","config-interval","超時扣血成長間隔（秒）",10,1,3600,1],["startingGold","config-starting-gold","起始金幣",300,0,1000000,1],["normalReward","config-normal-reward","一般戰鬥金幣",40,0,1000000,1],["eliteReward","config-elite-reward","菁英戰鬥金幣",90,0,1000000,1],["bossReward","config-boss-reward","BOSS 戰鬥金幣",150,0,1000000,1],["shopCount","config-shop-count","每店角色商品數上限",8,0,10,1],["sellPercent","config-sell-percent","賣回售價比例（%）",50,0,100,1],["srExtraStarSellPrice","config-sr-extra-star-sell-price","SR 每額外一星賣回加價",0,0,1000000,1],["ssrExtraStarSellPrice","config-ssr-extra-star-sell-price","SSR 每額外一星賣回加價",0,0,1000000,1],["urExtraStarSellPrice","config-ur-extra-star-sell-price","UR 每額外一星賣回加價",0,0,1000000,1],["postureLimit","config-posture-limit","倒地失衡門檻",100,1,10000,1],["posturePercent","config-posture-percent","傷害轉失衡比例（%，無條件進位）",50,0,1000,1],["downMultiplier","config-down-multiplier","倒地承傷倍率（含反擊）",1.5,0,10,0.1],["overtimePulse","config-pulse","超時扣血週期（秒）",1,0.1,120,0.1],["overtimeGrowth","config-growth","每次成長增加扣血量",10,0,10000,1],["weakDuration","config-weak-duration","基礎倒地時間（秒）",4,0.1,120,0.1]],key='minimajo.config.v1';
 const defaults=Object.freeze({version:1,...Object.fromEntries(fields.map(([k,id,label,value])=>[k,value])),startingActive:Object.freeze(['short-sword','wood-shield','herb',...Array(7).fill(null)])});
 function validate(data,items){
  if(data?.version!==1)throw Error('Config 版本無效。');
  const result={version:1};
  for(const [k,id,label,value,min,max,step] of fields){const n=data[k];if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max||Math.abs(n/step-Math.round(n/step))>1e-8)throw Error(label+' 需為 '+min+'～'+max+'，單位 '+step+'。');result[k]=n;}
  for(const [key,label] of [['startingActive','初始出戰隊伍']]){
   const slots=data[key];if(!Array.isArray(slots)||slots.length!==10||Array.from(slots).some(id=>id!==null&&(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(id))))throw Error(label+'需為十格角色 ID 或空格。');
   result[key]=slots.slice();
   if(items){const occupied=new Set();slots.forEach((id,i)=>{if(id===null)return;const u=items.find(u=>u.id===id);if(!u)throw Error(label+'第 '+(i+1)+' 格引用不存在的角色：'+id);if(!Number.isInteger(u.space)||u.space<1||i+u.space>10)throw Error(label+'第 '+(i+1)+' 格超出十格。');for(let n=i;n<i+u.space;n++){if(occupied.has(n))throw Error(label+'第 '+(i+1)+' 格角色重疊。');occupied.add(n);}});}
  }
  return result;
 }
 function read(storage){return (typeof module!=='undefined'?require('./saved-data.js'):root.SavedData).read('config',storage);}
 function damage(config,tick){
  const elapsed=tick-Math.round(config.battleSeconds*10),pulse=Math.round(config.overtimePulse*10);
  if(elapsed<pulse||elapsed%pulse!==0)return 0;
  return config.overtimeDamage+Math.floor((elapsed-pulse)/Math.round(config.overtimeInterval*10))*config.overtimeGrowth;
 }
 const api={readCapacity:storage=>(typeof module!=='undefined'?require('./saved-data.js'):root.SavedData).read('capacity',storage),load:(data,warnings,items)=>(typeof module!=='undefined'?require('./saved-data.js'):root.SavedData).config(data,warnings,items),defaults,key,fields,validate,read,damage};if(typeof module!=='undefined')module.exports=api;else root.GameConfig=api;
})(globalThis);
