(() => {
 'use strict';
 const $=id=>document.getElementById(id),key='minimajo.enemies.v1';
 let items=CharacterLibrary.getItems(),data=EnemyTeams.defaults(items),selected,dirty=false;
 const say=text=>$('enemy-message').textContent=text;
 try{data=EnemyTeams.read(localStorage,undefined,items);}catch(e){say('讀取失敗，顯示預設隊伍；儲存前請確認：'+e.message);}
 let savedData=structuredClone(data);
 const pending=new Set();
 function discard(){const saved=savedData.teams.find(t=>t.id===selected);data.teams=saved?data.teams.map(t=>t.id===selected?structuredClone(saved):t):data.teams.filter(t=>t.id!==selected);pending.delete(selected);dirty=false;}
 function newId(){let n=Date.now(),id;do{id='enemy-'+n++;}while(data.teams.some(t=>t.id===id));return id;}
 const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 function current(){return data.teams.find(t=>t.id===selected);}
 function renderList(){
  const query=$('enemy-search').value.trim(),level=$('enemy-level-filter').value;$('enemy-list').replaceChildren();
  data.teams.filter(team=>team.name.includes(query)&&(level===''||team.category!=='boss'&&team.matchLevel===Number(level))).forEach(team=>{const b=node('button',team.name+' · '+EnemyTeams.categories[team.category]+' · '+(team.category==='boss'?'不適配等級':'適配 Lv.'+(team.matchLevel??1))+' · 權重 '+team.weight+(pending.has(team.id)?' · 未儲存':''));b.type='button';b.className='item-choice';b.setAttribute('aria-pressed',String(team.id===selected));b.onclick=()=>{if(team.id===selected)return;if(dirty){if(!confirm('捨棄此隊未儲存的修改？'))return;discard();}selected=data.teams.some(t=>t.id===team.id)?team.id:data.teams[0]?.id;dirty=pending.has(selected);render();};$('enemy-list').append(b);});
  if(!$('enemy-list').children.length)$('enemy-list').append(node('p','沒有符合的敵方隊伍。'));
 }
 function syncLevel(){$('enemy-match-level').disabled=$('enemy-category').value==='boss';}
 $('enemy-search').addEventListener('input',renderList);$('enemy-level-filter').addEventListener('input',renderList);$('enemy-category').addEventListener('change',syncLevel);
 function render(){
  const t=current();renderList();
  $('enemy-form').hidden=!t;if(!t)return;$('enemy-name').value=t.name;$('enemy-category').value=t.category;$('enemy-weight').value=t.weight;$('enemy-match-level').value=t.matchLevel??1;syncLevel();
  const cells=t.slots.map((id,i)=>{const label=node('label','第 '+(i+1)+' 格'),select=node('select');select.setAttribute('aria-label','敵隊第 '+(i+1)+' 格');
   const empty=node('option','空位');empty.value='';select.append(empty);items.forEach(u=>{const option=node('option',u.name+'（'+u.space+' 格）');option.value=u.id;select.append(option);});
   if(id&&!items.some(u=>u.id===id)){const missing=node('option','缺少角色：'+id);missing.value=id;select.append(missing);}select.value=id||'';
   label.append(select);
   const stars=node('select'),info=node('small');stars.setAttribute('aria-label','敵隊第 '+(i+1)+' 格星數');
   function options(value){const u=items.find(x=>x.id===select.value);stars.replaceChildren();const initial=node('option','起始星數'+(u?'（'+u.stars+' 星）':''));initial.value='';stars.append(initial);if(u)for(let n=u.stars;n<=6;n++){const o=node('option',n+' 星');o.value=String(n);stars.append(o);}if(value!==null&&value!==undefined&&u&&value<u.stars){const o=node('option',value+' 星（低於起始星數，請修正）');o.value=String(value);stars.append(o);}stars.value=value==null?'':String(value);stars.disabled=!u;}
   function describe(){updateLayout(read());}
   options(t.stars?.[i]);select.onchange=()=>{options(null);dirty=true;describe();};stars.onchange=()=>{dirty=true;describe();};label.append(stars,info);
   const lawBox=node('div'),chosen=structuredClone(t.laws?.[i]??[]);lawBox.read=()=>chosen;
   const picker=node('select');picker.setAttribute('aria-label','第 '+(i+1)+' 格法則');const none=node('option','加入法則…');none.value='';picker.append(none);
   (typeof LawLibrary!=='undefined'?LawLibrary.get():[]).forEach(l=>{const o=node('option',l.name);o.value=l.id;picker.append(o);});
   const list=node('div');function refresh(){list.replaceChildren();chosen.forEach((l,k)=>{const b=node('button',l.name+' ×');b.type='button';b.onclick=()=>{chosen.splice(k,1);dirty=true;refresh();updateLayout(read());};list.append(b);});}
   picker.onchange=()=>{const l=LawLibrary.get().find(x=>x.id===picker.value);if(l){chosen.push(structuredClone(l));dirty=true;refresh();updateLayout(read());}picker.value='';};lawBox.append(picker,list);refresh();label.append(lawBox);return label;});$('enemy-slots').replaceChildren(...cells);
  updateLayout(t);
 }
 function updateLayout(t){
  try{
   const board=EnemyTeams.formation(t,items,GameConfig.read(localStorage));
   board.forEach((u,i)=>{const info=$('enemy-slots').children[i].children[2],owner=board.findIndex((x,k)=>x&&k<i&&k+x.space>i);info.textContent=u?u.stars+' 星 · HP '+u.maxHp+' · 倒地 '+u.weakDuration+' 秒 · '+u.space+' 格':owner>=0?'由第 '+(owner+1)+' 格角色佔用':'';});
   $('enemy-layout').textContent=board.map((u,i)=>u?'第 '+(i+1)+'–'+(i+u.space)+' 格：'+u.name+' '+u.stars+' 星':'').filter(Boolean).join(' ／ ');
  }catch(e){[...$('enemy-slots').children].forEach(cell=>cell.children[2].textContent='');$('enemy-layout').textContent=e.message;}
 }

 window.addEventListener('config-changed',()=>{if(current())updateLayout(read());});
 function read(){return {...current(),laws:[...$('enemy-slots').children].map(c=>c.children[0].value?c.children[3].read():[]),name:$('enemy-name').value,category:$('enemy-category').value,matchLevel:$('enemy-category').value==='boss'?(current()?.matchLevel??1):$('enemy-match-level').value===''?NaN:Number($('enemy-match-level').value),weight:Number($('enemy-weight').value),slots:[...$('enemy-slots').children].map(label=>label.children[0].value||null),stars:[...$('enemy-slots').children].map(label=>label.children[0].value&&label.children[1].value!==''?Number(label.children[1].value):null)};}
 const generatorFields={count:'enemy-roll-count',lawCount:'enemy-roll-laws',SR:'enemy-roll-sr',SSR:'enemy-roll-ssr',UR:'enemy-roll-ur'};
 function generatorInput(){return Object.fromEntries(Object.entries(generatorFields).map(([field,id])=>[field,$(id).value.trim()===''?NaN:Number($(id).value)]));}
 function describeGenerator(){
  try{const settings=EnemyGenerator.validate(generatorInput());$('enemy-roll-probabilities').textContent='基礎機率：'+EchoLevels.describe({levels:[settings]},1)+'。無可用角色的階級會排除後重新換算。';}
  catch(e){$('enemy-roll-probabilities').textContent=e.message;}
 }
 Object.entries(generatorFields).forEach(([field,id])=>{$(id).value=String(EnemyGenerator.defaults[field]);$(id).addEventListener('input',describeGenerator);});
 describeGenerator();
 $('enemy-generate').addEventListener('click',()=>{
  try{
   if(data.teams.length>=300)throw Error('敵隊最多 300 隊，請先刪除不需要的隊伍。');
   const settings=EnemyGenerator.validate(generatorInput());
   const generated=EnemyGenerator.generate(items,typeof LawLibrary!=='undefined'?LawLibrary.get():[],settings);
   const {slots,stars,laws}=generated,id=newId(),draft={id,name:'隨機敵隊 '+(data.teams.length+1),category:'normal',matchLevel:1,weight:100,slots,stars,laws};
   EnemyTeams.formation(draft,items,GameConfig.read(localStorage));
   if(current()&&dirty){const previous=read();data.teams=data.teams.map(t=>t.id===selected?previous:t);pending.add(selected);}
   data.teams.push(draft);selected=id;pending.add(id);dirty=true;$('enemy-search').value='';$('enemy-level-filter').value='';render();
   say('已新增「'+draft.name+'」：角色抽選 '+generated.completed+'／'+settings.count+' 次、法則 '+generated.lawCount+' 份。'+(generated.completed<settings.count?'已無可加入或升星的角色，提前停止。':'')+'可繼續調整，按「儲存敵隊」才會保存此隊。');
  }catch(e){say('生成失敗：'+e.message);}
 });
 $('enemy-form').addEventListener('input',()=>{dirty=true;say('尚未儲存。多格角色請將其佔用的後續格保留空位。');});
 $('enemy-form').addEventListener('submit',e=>{e.preventDefault();try{const draft=read();EnemyTeams.formation(draft,items,GameConfig.read(localStorage));const teams=savedData.teams.some(t=>t.id===selected)?savedData.teams.map(t=>t.id===selected?draft:t):[...savedData.teams,draft];const next=EnemyTeams.validate({version:1,teams});localStorage.setItem(key,JSON.stringify(next));savedData=structuredClone(next);data.teams=data.teams.map(t=>t.id===selected?next.teams.find(x=>x.id===selected):t);pending.delete(selected);dirty=false;render();say('已儲存敵隊；下次開始遊戲會套用。');}catch(error){say(error.message);}});
 $('enemy-new').addEventListener('click',()=>{if(data.teams.length>=300){say('敵隊最多 300 隊，請先刪除不需要的隊伍。');return;}if(dirty){if(!confirm('捨棄未儲存修改？'))return;discard();}selected=newId();data.teams.push({id:selected,name:'新敵方隊伍',category:'normal',matchLevel:1,weight:100,slots:[items.find(u=>u.space<=10)?.id||null,...Array(9).fill(null)]});pending.add(selected);dirty=true;render();say('新隊伍尚未儲存。');});
 $('enemy-delete').addEventListener('click',()=>{if(!current()||!confirm('刪除「'+current().name+'」？'))return;try{const next={version:1,teams:savedData.teams.filter(t=>t.id!==selected)};localStorage.setItem(key,JSON.stringify(next));savedData=structuredClone(next);data.teams=data.teams.filter(t=>t.id!==selected);pending.delete(selected);selected=data.teams[0]?.id;dirty=pending.has(selected);render();say('已刪除；某分類若無正權重隊伍，遊戲會提示設定錯誤。');}catch(e){say('儲存失敗：'+e.message);}});
 window.addEventListener('characters-changed',e=>{if(current()&&dirty){const draft=read();data.teams=data.teams.map(t=>t.id===selected?draft:t);}items=e.detail;render();});
 window.addEventListener('laws-changed',()=>{if(current()){const draft=read();data.teams=data.teams.map(t=>t.id===selected?draft:t);}render();});
 window.addEventListener('beforeunload',e=>{if(dirty||pending.size){e.preventDefault();e.returnValue='';}});
 selected=data.teams[0]?.id;render();
})();
