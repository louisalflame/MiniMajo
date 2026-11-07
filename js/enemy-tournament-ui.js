(() => {
 'use strict';
 const $=id=>document.getElementById(id),T=EnemyTournament;
 const make=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 let teams=[],selected=new Set(),worker=null,result=null,run=null,available=new Map();
 const say=text=>$('tournament-message').textContent=text;
 function estimate(){
  try{$('tournament-estimate').textContent='已選 '+selected.size+' 隊 × '+$('tournament-rounds').value+' 輪，共 '+T.totalGames(selected.size,Number($('tournament-rounds').value)).toLocaleString()+' 場。';}
  catch(e){$('tournament-estimate').textContent='已選 '+selected.size+' 隊。'+e.message;}
 }
 function visible(){const query=$('tournament-search').value.trim();return teams.filter(t=>(t.name+' '+EnemyTeams.categories[t.category]+' '+t.matchLevel).includes(query));}
 function renderChoices(){
  $('tournament-teams').replaceChildren(...visible().map(t=>{
   const label=make('label'),check=make('input');check.type='checkbox';check.value=t.id;check.checked=selected.has(t.id);check.disabled=!!worker||!!available.get(t.id);
   check.addEventListener('change',()=>{if(check.checked)selected.add(t.id);else selected.delete(t.id);estimate();});
   label.append(check,make('span',t.name+' · '+EnemyTeams.categories[t.category]+' · 適配 Lv.'+t.matchLevel+(available.get(t.id)?' · '+available.get(t.id):'')));return label;
  }));
  if(!$('tournament-teams').children.length)$('tournament-teams').append(make('p','沒有符合的已儲存敵隊。'));
  estimate();
 }
 function refresh(){
  if(worker)return;
  try{
   const items=CharacterLibrary.getItems(),config=GameConfig.read(localStorage);
   teams=EnemyTeams.read(localStorage,undefined,items).teams;available=new Map();
   for(const t of teams){try{if(!EnemyTeams.formation(t,items,config).some(Boolean))throw Error('空隊，無法參賽');}catch(e){available.set(t.id,e.message);}}
   selected=new Set([...selected].filter(id=>teams.some(t=>t.id===id)&&!available.get(id)));renderChoices();
  }catch(e){say('讀取敵隊失敗：'+e.message);}
 }
 function busy(value){
  for(const id of ['tournament-start','tournament-rounds','tournament-all','tournament-none','tournament-refresh'])$(id).disabled=value;
  $('tournament-stop').disabled=!value;renderChoices();
 }
 const percent=value=>value===null?'—':(value*100).toFixed(1)+'%';
 function addRow(body,values){const tr=make('tr');for(const value of values)tr.append(make('td',String(value)));body.append(tr);}
 function renderOpponents(){
  const body=$('tournament-pairs');body.replaceChildren();if(!result)return;
  const index=Number($('tournament-focus').value);
  result.rows.forEach((row,j)=>{
   if(j===index)return;
   const a=Math.min(index,j),b=Math.max(index,j),pair=result.pairs[a+':'+b];
   if(!pair){addRow(body,[row.name,0,0,0,0,0,'—']);return;}
   const own=T.metrics({...pair,wins:index===a?pair.wins:pair.losses,losses:index===a?pair.losses:pair.wins});
   addRow(body,[row.name,own.games,own.wins,own.losses,own.draws,own.unfinished,percent(own.scoreRate)]);
  });
 }
 function renderResults(){
  if(!result)return;
  $('tournament-results').hidden=false;$('tournament-progress').max=result.total;$('tournament-progress').value=result.completed;
  $('tournament-progress-text').textContent='已結算 '+result.completed.toLocaleString()+'／'+result.total.toLocaleString()+' 場';
  const body=$('tournament-ranking');body.replaceChildren();let rank=0,previous;
  T.ranking(result).forEach((row,i)=>{
   if(i===0||row.scoreRate!==previous)rank=i+1;previous=row.scoreRate;
   addRow(body,[row.resolved?rank:'—',row.name,row.games,row.wins,row.losses,row.draws,row.unfinished,percent(row.winRate),percent(row.scoreRate)]);
  });
  renderOpponents();
 }
 function finish(message){if(worker)worker.terminate();worker=null;busy(false);renderResults();say(message);}
 $('tournament-search').addEventListener('input',renderChoices);
 $('tournament-rounds').addEventListener('input',estimate);
 $('tournament-all').addEventListener('click',()=>{for(const t of visible())if(!available.get(t.id))selected.add(t.id);renderChoices();});
 $('tournament-none').addEventListener('click',()=>{selected.clear();renderChoices();});
 $('tournament-refresh').addEventListener('click',refresh);
 $('tournament-focus').addEventListener('change',renderOpponents);
 $('tournament-start').addEventListener('click',()=>{
  if(worker)return;
  let next;
  try{
   if(typeof Worker==='undefined')throw Error('此瀏覽器不支援背景運算。');
   const items=CharacterLibrary.getItems();
   next=T.prepare({teams:EnemyTeams.read(localStorage,undefined,items).teams,selected:[...selected],items,config:GameConfig.read(localStorage),rounds:$('tournament-rounds').value.trim()===''?NaN:Number($('tournament-rounds').value),seed:crypto.getRandomValues(new Uint32Array(1))[0],statusLibrary:Statuses.read(localStorage)});
   const active=new Worker('js/enemy-tournament-worker.js');
   active.onmessage=event=>{
    if(worker!==active)return;
    const message=event.data;
    for(const outcome of message.batch??[])T.record(result,outcome);
    if(message.type==='error')finish('測試中斷：'+message.message+'。僅保留已結算場次。');
    else if(message.type==='done')finish('測試完成，共 '+result.completed.toLocaleString()+' 場。'+(result.rows.some(r=>r.unfinished)?'有場次達模擬上限未分勝負，未納入勝率與得分率。':''));
    else renderResults();
   };
   active.onerror=event=>{event.preventDefault();if(worker===active)finish('背景運算失敗：'+(event.message||'請重新整理後重試')+'。僅保留已結算場次。');};
   worker=active;run=next;result=T.summary(run);
   $('tournament-focus').replaceChildren(...run.teams.map((t,i)=>{const option=make('option',t.name);option.value=String(i);return option;}));
   $('tournament-focus').value='0';
   $('tournament-snapshot').textContent='本次快照：'+run.teams.length+' 隊／'+run.rounds+' 輪，基礎戰鬥時間 '+run.config.battleSeconds+' 秒，隨機種子 '+run.seed+'。資料後續修改不影響本次結果。';
   busy(true);renderResults();say('背景測試中，可切換工坊分頁。請保持此頁開啟；目前排名為部分結果。');worker.postMessage(run);
  }catch(e){if(worker)finish('無法開始：'+e.message);else say('無法開始：'+e.message);}
 });
 $('tournament-stop').addEventListener('click',()=>{if(worker)finish('已停止。僅保留已結算 '+result.completed+' 場，未完成場次不計分；目前排名為部分結果。');});
 window.addEventListener('workspace-tab-change',event=>{if(event.detail==='enemy-tournament')refresh();});
 window.addEventListener('beforeunload',event=>{if(worker){event.preventDefault();event.returnValue='';}});
 refresh();
})();
