(function(root){
 'use strict';
 const X=typeof module!=='undefined'?require('./expedition.js'):root.Expedition;
 const D=typeof module!=='undefined'?require('./database.js'):root.ItemDB;
 const L=typeof module!=='undefined'?require('./laws.js'):root.Laws;
 const categories={normal:'一般',elite:'菁英',boss:'BOSS'};
 function defaults(items){const fit=items.filter(x=>x.space<=10);return {version:1,teams:Object.keys(categories).map((category,i)=>{const board=Array(10).fill(null);for(let n=0;n<[2,4,6][i];n++){const unit=fit[n%fit.length];if(!unit)break;const slot=X.firstFit(board,unit);if(slot<0)break;board[slot]=unit;}return {id:'default-'+category,name:categories[category]+'守衛',category,skillId:null,matchLevel:1,weight:100,slots:board.map(x=>x?.id||null)};}).filter(t=>t.slots.some(Boolean))};}
 function validate(data){
  if(data?.version!==1||!Array.isArray(data.teams)||data.teams.length>300)throw Error('敵隊資料需為 version 1，最多 300 隊。');
  const ids=new Set();return {version:1,teams:data.teams.map(t=>{
   if(!t||typeof t.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(t.id)||ids.has(t.id))throw Error('敵隊 ID 無效或重複。');ids.add(t.id);
   if(typeof t.name!=='string'||!t.name.trim()||t.name.length>40||!Object.hasOwn(categories,t.category))throw Error('敵隊名稱或分類無效。');
   const skillId=t.skillId??null;if(skillId!==null&&(typeof skillId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(skillId)))throw Error('敵隊極式 ID 無效。');
   const matchLevel=t.matchLevel===undefined?1:t.matchLevel;if(!Number.isInteger(matchLevel)||matchLevel<1||matchLevel>1000000)throw Error('敵隊適配等級需為 1～1000000 整數。');
   if(!Number.isInteger(t.weight)||t.weight<0||t.weight>1000000)throw Error('敵隊權重需為 0～1000000 整數。');
   if(!Array.isArray(t.slots)||t.slots.length!==10||t.slots.some(id=>id!==null&&(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(id))))throw Error('敵隊需有十格角色 ID 或空格。');
   const stars=t.stars??Array(10).fill(null);if(!Array.isArray(stars)||stars.length!==10||stars.some((n,i)=>n!==null&&(!t.slots[i]||!Number.isInteger(n)||n<1||n>6)))throw Error('敵隊位置星數無效。');
   const laws=t.laws??Array.from({length:10},()=>[]);if(!Array.isArray(laws)||laws.length!==10)throw Error('法則設定需為十格。');const clean=laws.map((a,i)=>{const entries=L.validate(a,{allowDuplicates:true});if(entries.length&&!t.slots[i])throw Error('空格不能設定法則。');return entries;});
   return {laws:clean,stars:stars.slice(),id:t.id,name:t.name.trim(),category:t.category,skillId,matchLevel,weight:t.weight,slots:t.slots.slice()};
  })};
 }
 function formation(team,items,config){const board=team.slots.map((id,i)=>{if(!id)return null;const u=items.find(x=>x.id===id);if(!u)throw Error('隊伍「'+team.name+'」引用了已刪除的角色：'+id);return L.attach(D.atStars(u,team.stars?.[i]??u.stars,config),team.laws?.[i]??[],config);});if(!X.valid(board))throw Error('隊伍「'+team.name+'」角色重疊或超出十格。');return board;}
 function pick(data,category,items,random=Math.random,config,playerLevel=1){
  if(!Number.isSafeInteger(playerLevel)||playerLevel<1)throw Error('玩家等級需為正整數。');
  let pool=validate(data).teams.filter(t=>t.category===category&&t.weight>0&&t.slots.some(Boolean));
  if(!pool.length)throw Error('沒有可出現的'+categories[category]+'敵隊，請在編輯器設定正權重隊伍。');
  if(category!=='boss'){
   const distance=Math.min(...pool.map(t=>Math.abs(t.matchLevel-playerLevel)));
   const level=Math.min(...pool.filter(t=>Math.abs(t.matchLevel-playerLevel)===distance).map(t=>t.matchLevel));
   pool=pool.filter(t=>t.matchLevel===level);
  }
  const entries=pool.map(team=>({team,board:formation(team,items,config)}));let roll=random()*pool.reduce((n,t)=>n+t.weight,0);for(const entry of entries){roll-=entry.team.weight;if(roll<0)return entry;}return entries.at(-1);
 }
 const api={read:(storage,warnings,items)=>(typeof module!=='undefined'?require('./saved-data.js'):root.SavedData).read('enemies',storage,warnings,items),load:(data,warnings,...args)=>(typeof module!=='undefined'?require('./saved-data.js'):root.SavedData).enemies(data,warnings,...args),categories,defaults,validate,formation,pick};if(typeof module!=='undefined')module.exports=api;else root.EnemyTeams=api;
})(globalThis);
