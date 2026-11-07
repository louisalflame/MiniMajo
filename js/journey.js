(function(root){
 'use strict';
 const X=typeof module!=='undefined'?require('./expedition.js'):root.Expedition,H=typeof module!=='undefined'?require('./hex-map.js'):root.HexMap,D=typeof module!=='undefined'?require('./database.js'):root.ItemDB,E=typeof module!=='undefined'?require('./enemy-teams.js'):root.EnemyTeams;
 function create(characters,skills,seed='MOON-'+Date.now(),settings=null,enemies=null,config,laws=[],echo) {
  if(settings&&settings.version!==1)throw Error('地圖設定版本無效。');
  const roster=X.create(characters,skills,config,laws,echo),map=H.explore(H.generate(settings?.radius??4,settings?.seed??seed,settings?.rules),settings?.rewardDecay);
  roster.skillId=X.eligible(roster)[0]?.id??null;
  return {config:(typeof module!=='undefined'?require('./config.js'):root.GameConfig).validate(config??(typeof module!=='undefined'?require('./config.js'):root.GameConfig).defaults),statusLibrary:(typeof module!=='undefined'?require('./statuses.js'):root.Statuses).snapshot(),roster,map,playerLevel:1,enemies:E.validate(enemies??E.defaults(roster.library)),enemyRolls:{},encounter:null,rewardChoice:null,serial:0};
 }
 function move(s,id){
  if(s.rewardChoice)return false;
  const entry={id,from:s.map.current,steps:s.map.steps,path:s.map.path.slice(),fromCollapsed:s.map.collapsed.has(s.map.current),complete:s.map.complete};
  if(!H.move(s.map,id))return false;
  if(s.map.map.cells[id].type==='goal'){s.map.complete=false;s.map.cleared.delete(id);s.map.pending=id;}
  s.battleEntry=['battle','elite','goal'].includes(s.map.map.cells[id].type)&&s.map.pending===id?entry:null;
  return true;
 }
 function start(s){
  if(s.rewardChoice)throw Error('請先領取戰鬥角色獎勵。');
  const id=s.map.pending,type=s.map.map.cells[id]?.type;
  if(!['battle','elite','goal'].includes(type))throw Error('此處沒有待完成的戰鬥。');
  if(s.encounter)throw Error('戰鬥已在進行。');
  const allies=s.roster.active.map(u=>u?structuredClone(u):null);
  if(!allies.some(Boolean))throw Error('請先整備至少一名可戰鬥的角色。');
  const category=type==='goal'?'boss':type==='elite'?'elite':'normal';
  if(!s.enemyRolls[id])s.enemyRolls[id]=E.pick(s.enemies,category,s.roster.library,s.random||Math.random,s.config,s.playerLevel);
  const rolled=s.enemyRolls[id],enemy=structuredClone(rolled.board);
  const prior=s.map.path.length>1,from=prior?s.map.path.at(-2):s.map.current;
  const entry=s.battleEntry?.id===id?structuredClone(s.battleEntry):{id,from,steps:Math.max(0,s.map.steps-(prior?1:0)),path:prior?s.map.path.slice(0,-1):s.map.path.slice(),fromCollapsed:false,complete:false};
  const token='encounter-'+(++s.serial);s.encounter={token,id,type,allies,entry,reward:H.rewardAt(s.map,id),enemyName:rolled.team.name,matchLevel:s.playerLevel};
  const skill=s.roster.skills.find(x=>x.id===s.roster.skillId);
  const enemySkill=category==='normal'?null:structuredClone(rolled.historicalSkill??s.roster.skills.find(x=>x.id===rolled.team.skillId)??null);
  s.encounter.skill=skill?structuredClone(skill):null;
  return {type:'minimajo-preview',config:structuredClone(s.config),statusLibrary:structuredClone(s.statusLibrary),token,enemyName:rolled.team.name,loadouts:[allies,enemy],skills:skill?[skill]:[],enemySkill,limits:[10,10],activeSkillsEnabled:true,campaign:true};
 }
 function markStarted(s){
  const e=s.encounter;if(!e||e.started)return false;
  e.victorySnapshot={matchLevel:e.matchLevel,category:e.type==='goal'?'boss':e.type==='elite'?'elite':'normal',board:structuredClone(e.allies),skill:structuredClone(e.skill)};
  e.started=true;return true;
 }
 function lockHistoricalEnemy(s,record){
  const id=s.map.pending,type=s.map.map.cells[id]?.type;
  if(!['elite','goal'].includes(type)||s.encounter||s.enemyRolls[id])return false;
  const records=typeof module!=='undefined'?require('./player-records.js'):root.PlayerRecords;
  const clean=records.validate(record,{statuses:s.statusLibrary});
  if(Math.abs(clean.matchLevel-s.playerLevel)>2)throw Error('歷史隊伍適配等級不符。');
  // Artwork can change without changing combat compatibility. Refresh only paths,
  // keeping all saved stats, effects, stars and each attached law instance intact.
  for(const unit of clean.board.filter(Boolean)){
   const art=s.roster.library.find(item=>item.id===unit.id);
   if(art){unit.imageFile=art.imageFile;unit.detailImageFile=art.detailImageFile;}
   for(const law of unit.laws){const current=s.roster.lawLibrary.find(item=>item.id===law.id);if(current)law.imagePath=current.imagePath;}
  }
  if(clean.skill){const art=s.roster.skills.find(item=>item.id===clean.skill.id);if(art)clean.skill.imagePath=art.imagePath;}
  s.enemyRolls[id]={team:{id:'history-'+clean.runId,name:'旅人殘影',skillId:null,category:type==='goal'?'boss':'elite',matchLevel:clean.matchLevel},board:clean.board,historicalSkill:clean.skill,historical:true};
  return true;
 }
 function prepare(s){
  if(!s.encounter||s.encounter.started)throw Error('只能在開戰前整備。');
  const previous=s.encounter;s.encounter=null;
  try{return start(s);}catch(error){s.encounter=previous;throw error;}
 }
 function reposition(s,start,end){
  if(!s.encounter||s.encounter.started||s.rewardChoice)throw Error('只能在開戰前調整我方站位。');
  const before={board:s.roster.active,skillId:s.roster.skillId,encounter:s.encounter,serial:s.serial};
  const next=X.reposition(s.roster.active,start,end);
  try{s.roster.active=next;X.syncSkill(s.roster);return prepare(s);}
  catch(error){s.roster.active=before.board;s.roster.skillId=before.skillId;s.encounter=before.encounter;s.serial=before.serial;throw error;}
 }
 function settle(s,result){
  const e=s.encounter;if(!e||result.token!==e.token||![0,1,'draw'].includes(result.winner))return null;
  const originals=e.allies.filter(Boolean);
  if(!Array.isArray(result.hp)||result.hp.length!==originals.length||result.hp.some((n,i)=>!Number.isInteger(n)||n<0||n>originals[i].maxHp))throw Error('戰鬥結果血量無效。');
  let reward=0;
  if(result.winner===0){
   const grade=e.reward??{tier:'full',moneyPercent:100,choices:3},choices=rollRewards(s.roster,s.rewardRandom||s.random||Math.random,grade.choices);
   reward=Math.floor((e.type==='goal'?s.config.bossReward:e.type==='elite'?s.config.eliteReward:s.config.normalReward)*grade.moneyPercent/100);s.roster.gold+=reward;H.resolve(s.map,s.config);if(e.type==='goal')s.map.complete=true;
   s.rewardChoice={token:e.token,choices,gold:reward,rewardTier:grade.tier};s.playerLevel++;
  }
  if(result.winner==='draw'){H.resolve(s.map,s.config);if(e.type==='goal')s.map.complete=true;}
  if(result.winner===1){
   const entry=e.entry;s.map.current=entry.from;s.map.steps=entry.steps;s.map.path=entry.path.slice();s.map.pending=null;s.map.complete=entry.complete;
   if(entry.fromCollapsed)s.map.collapsed.add(entry.from);else s.map.collapsed.delete(entry.from);
  }
  const victorySnapshot=result.winner===0&&e.victorySnapshot?structuredClone(e.victorySnapshot):null;
  s.battleEntry=null;s.encounter=null;return {winner:result.winner,reward,...(victorySnapshot?{victorySnapshot}:{})};
 }
 function rollRewards(roster,random=Math.random,count=3){
  const Echo=typeof module!=='undefined'?require('./echo-levels.js'):root.EchoLevels;
  const pool=roster.library.filter(u=>u.shopWeight>0&&u.space<=10),choices=[];let candidates=[];
  for(let i=0;pool.length&&i<count;i++){
   if(!candidates.length)candidates=pool.slice();let chosen=Echo.pick(candidates,roster.echoSettings,roster.echoLevel,random);
   if(!chosen){candidates=pool.slice();chosen=Echo.pick(candidates,roster.echoSettings,roster.echoLevel,random);}if(!chosen)break;
   choices.push(D.atStars(chosen,chosen.stars,roster.config));candidates=candidates.filter(u=>u.id!==chosen.id);
  }
  return choices;
 }
 function claim(s,token,index){
  const reward=s.rewardChoice;if(!reward||reward.token!==token)throw Error('此戰鬥獎勵已領取或已失效。');
  if(!reward.choices.length&&index===null){s.rewardChoice=null;return null;}
  if(!Number.isInteger(index)||!reward.choices[index])throw Error('請選擇一名獎勵角色。');
  const result=X.recruit(s.roster,reward.choices[index]);s.rewardChoice=null;return result;
 }
 function skipReward(s,token){
  const reward=s.rewardChoice;
  if(!reward||reward.token!==token)throw Error('此戰鬥獎勵已領取或已失效。');
  if(!reward.choices.length)throw Error('本場沒有可放棄的角色獎勵。');
  s.roster.gold+=10;s.rewardChoice=null;return {skipped:true,gold:10};
 }
 function resolve(s){
  if(s.encounter||s.rewardChoice)return false;const type=s.map.map.cells[s.map.pending]?.type;
  if(type==='rest'){if(!H.resolve(s.map,s.config))return false;X.upgradeEcho(s.roster);return true;}
  if(type==='shop')return H.resolve(s.map,s.config);return false;
 }
 const api={create,move,start,markStarted,lockHistoricalEnemy,prepare,reposition,settle,resolve,rollRewards,claim,skipReward};if(typeof module!=='undefined')module.exports=api;else root.Journey=api;
})(globalThis);
