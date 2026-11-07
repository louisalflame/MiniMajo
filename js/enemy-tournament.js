(function(root){
 'use strict';
 const B=typeof module!=='undefined'?require('./battle.js'):root.Battle;
 const E=typeof module!=='undefined'?require('./enemy-teams.js'):root.EnemyTeams;
 const C=typeof module!=='undefined'?require('./config.js'):root.GameConfig;
 const S=typeof module!=='undefined'?require('./statuses.js'):root.Statuses;
 const maxGames=100000;
 function totalGames(count,rounds){
  if(!Number.isInteger(count)||count<2||count>300)throw Error('請選擇 2～300 支敵方隊伍。');
  if(!Number.isInteger(rounds)||rounds<1||rounds>1000)throw Error('輪數需為 1～1000 整數。');
  const total=count*(count-1)/2*rounds;
  if(total>maxGames)throw Error('本次共 '+total+' 場，超過 100000 場上限，請減少隊伍或輪數。');
  return total;
 }
 function prepare({teams,selected,items,config,rounds,seed,statusLibrary}){
  if(!Array.isArray(selected)||new Set(selected).size!==selected.length)throw Error('選取隊伍重複或無效。');
  const total=totalGames(selected.length,rounds),clean=C.validate(config);
  if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw Error('隨機種子無效。');
  const definitions=E.validate({version:1,teams}).teams;
  const entries=selected.map(id=>{
   const team=definitions.find(t=>t.id===id);if(!team)throw Error('找不到選取的敵隊：'+id);
   const board=E.formation(team,items,clean);
   if(!board.some(Boolean))throw Error('隊伍「'+team.name+'」為空隊，無法參賽。');
   return {id:team.id,name:team.name,category:team.category,matchLevel:team.matchLevel,board};
  });
  return structuredClone({teams:entries,config:clean,rounds,seed,total,statusLibrary:S.validateLibrary(statusLibrary),maxTicks:Math.round((clean.battleSeconds+3600)*10)});
 }
 function random(seed){let value=seed>>>0;return ()=>{value=(value+0x6D2B79F5)>>>0;let x=value;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);return ((x^(x>>>14))>>>0)/4294967296;};}
 function* schedule(run){
  let game=0;
  for(let round=0;round<run.rounds;round++)for(let a=0;a<run.teams.length;a++)for(let b=a+1;b<run.teams.length;b++){
   // Alternate each pair's sides across rounds; odd runs get a seeded initial side.
   const flip=((run.seed+a+b+round)%2)===1;
   yield {a,b,left:flip?b:a,right:flip?a:b,round,seed:(run.seed+Math.imul(++game,2654435761))>>>0};
  }
 }
 function simulate(run,match){
  const state=B.create([run.teams[match.left].board,run.teams[match.right].board],[],[10,10],{config:run.config,footprints:true,activeSkillsEnabled:false});
  if(state.blocked)throw Error('隊伍佔位無效，無法模擬。');
  state.random=random(match.seed);
  while(!state.done&&state.tick<run.maxTicks){B.step(state);state.visuals=[];state.feedback=[];}
  return {a:match.a,b:match.b,winner:state.done?(state.winner==='draw'?'draw':state.winner===0?match.left:match.right):'unfinished',ticks:state.tick};
 }
 const blank=()=>({wins:0,losses:0,draws:0,unfinished:0,games:0,ticks:0});
 function summary(run){return {completed:0,total:run.total,rows:run.teams.map(t=>({id:t.id,name:t.name,...blank()})),pairs:{}};}
 function record(result,outcome){
  const {a,b,winner,ticks}=outcome;
  if(a===b||!result.rows[a]||!result.rows[b]||!['draw','unfinished',a,b].includes(winner))throw Error('對戰結果無效。');
  const pair=result.pairs[a+':'+b]??(result.pairs[a+':'+b]={a,b,...blank()});
  const left=result.rows[a],right=result.rows[b];
  for(const row of [left,right,pair]){row.games++;row.ticks+=ticks;}
  if(winner==='unfinished')for(const row of [left,right,pair])row.unfinished++;
  else if(winner==='draw')for(const row of [left,right,pair])row.draws++;
  else {result.rows[winner].wins++;result.rows[winner===a?b:a].losses++;pair[winner===a?'wins':'losses']++;}
  result.completed++;
 }
 function metrics(row){const resolved=row.wins+row.losses+row.draws;return {...row,resolved,winRate:resolved?row.wins/resolved:null,scoreRate:resolved?(row.wins+row.draws*.5)/resolved:null};}
 function ranking(result){return result.rows.map(metrics).sort((a,b)=>(b.scoreRate??-1)-(a.scoreRate??-1));}
 const api={maxGames,totalGames,prepare,random,schedule,simulate,summary,record,metrics,ranking};
 if(typeof module!=='undefined')module.exports=api;else root.EnemyTournament=api;
})(globalThis);
