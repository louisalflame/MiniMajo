(function(root){
 'use strict';
 const rarities=['SR','SSR','UR'],key='minimajo.echo.v1';
 const defaults={version:1,levels:[{SR:100,SSR:0,UR:0},{SR:80,SSR:20,UR:0},{SR:60,SSR:35,UR:5},{SR:40,SSR:45,UR:15},{SR:25,SSR:50,UR:25},{SR:10,SSR:50,UR:40}]};
 function validate(data){
  if(!data||!Array.isArray(data.levels)||!data.levels.length||data.levels.length>100)throw Error('回響等級需設定 1～100 個等級。');
  return {version:1,levels:data.levels.map((row,i)=>{
   const clean={};for(const rarity of rarities){const n=row?.[rarity];if(!Number.isInteger(n)||n<0||n>1000000)throw Error('回響等級 '+(i+1)+' 的 '+rarity+' 權重需為 0～1000000 整數。');clean[rarity]=n;}
   if(!rarities.some(r=>clean[r]>0))throw Error('回響等級 '+(i+1)+' 至少一個階級的權重必須大於 0。');return clean;
  })};
 }
 function pick(items,settings,level,random=Math.random){
  const row=settings.levels[level-1];if(!row)throw Error('回響等級無效。');
  const pools=rarities.map(r=>({rarity:r,weight:row[r],items:items.filter(u=>u.rarity===r&&u.shopWeight>0)})).filter(p=>p.weight>0&&p.items.length);
  if(!pools.length)return null;
  function weighted(pool,weight){let roll=random()*pool.reduce((sum,x)=>sum+weight(x),0);for(const x of pool){roll-=weight(x);if(roll<0)return x;}return pool.at(-1);}
  const pool=weighted(pools,p=>p.weight);return weighted(pool.items,u=>u.shopWeight);
 }
 function describe(settings,level){const row=settings.levels[level-1],total=rarities.reduce((sum,r)=>sum+row[r],0);return rarities.map(r=>r+' '+Number((row[r]/total*100).toFixed(1))+'%').join(' ／ ');}
 const api={key,defaults,rarities,validate,pick,describe,read:(storage,warnings)=>(typeof module!=='undefined'?require('./saved-data.js'):root.SavedData).read('echo',storage,warnings)};
 if(typeof module!=='undefined')module.exports=api;else root.EchoLevels=api;
})(globalThis);
