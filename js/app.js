(() => {
  'use strict';
  const $=id=>document.getElementById(id), clone=x=>JSON.parse(JSON.stringify(x));
  const key='minimajo.characters.v2', label={advance:'加快時間（秒）',damage:'傷害',shield:'護盾',heal:'治療',posture:'增加失衡',restore:'降低失衡',status:''};
  let movementEditor;
  let db=ItemDB.validate({version:2,items:clone(ItemDB.defaults)}), selected, dirty=false, state, running=false, bank=0,last=0;
  const runStars=[Array(10).fill(null),Array(10).fill(null)];
  const runLaws=Array.from({length:2},()=>Array.from({length:10},()=>[]));
  function availableLaws(){try{return typeof LawLibrary!=='undefined'?LawLibrary.get():Laws.read(localStorage).laws;}catch(e){notice('法則讀取失敗：'+e.message);return [];}}
  let loadouts=[['short-sword','wood-shield','herb',...Array(7).fill('')],['axe','knife','iron-shield',...Array(7).fill('')]];
  function notice(text){$('notice').textContent=text;}
  try{db=ItemDB.read(localStorage);notice('角色資料已載入。');}catch(e){notice('角色資料格式錯誤：'+e.message);}
  function persist(){db=ItemDB.validate(db);window.dispatchEvent(new CustomEvent('characters-changed',{detail:clone(db.items)}));try{localStorage.setItem(key,JSON.stringify(db));notice('設定已儲存；固定檔案寫入狀態請看頂部。');}catch(e){notice('瀏覽器無法儲存，目前修改僅保留在此分頁。請使用「匯出資料庫」備份。');}}


  const getItem=id=>db.items.find(x=>x.id===id);
  function make(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
  function canLeave(){return !dirty||confirm('有尚未儲存的角色修改，要捨棄嗎？');}
  function renderList(){
    $('count').textContent=`${db.items.length} 件`;
    const q=$('search').value.trim().toLocaleLowerCase();$('item-list').replaceChildren();
    db.items.filter(x=>`${x.name} ${x.race} ${x.affinity} ${x.stars}星 ${x.rarity} ${x.job}`.toLocaleLowerCase().includes(q)).forEach(item=>{
      const btn=make('button',undefined,'item-choice');btn.type='button';btn.setAttribute('aria-pressed',item.id===selected);
      btn.append(CharacterArt.create(document,item,'item-icon'));const text=make('span',item.name);text.append(make('small',`${item.cooldown}s · 空間 ${item.space??1} · ${item.stars}星 ${item.rarity} ${item.job} · ${item.race} / ${item.affinity}`));btn.append(text);
      btn.onclick=()=>{if(canLeave())edit(item.id);};$('item-list').append(btn);
    });
    if(!$('item-list').children.length)$('item-list').append(make('p','沒有符合的角色。','empty'));
  }
  function effectRow(effect){$('effects').append(EffectEditor.row(effect,row=>{if($('effects').children.length===1){$('form-message').textContent='至少保留一個效果。';return;}row.remove();EffectEditor.refreshRoles($('effects'),markDirty);markDirty();},markDirty));EffectEditor.refreshRoles($('effects'),markDirty);}
  function edit(id){selected=id;const item=getItem(id);$('shop-price').value=item.shopPrice??(20*item.space+10);$('shop-weight').value=item.shopWeight??100;$('name').value=item.name;$('character-description').value=item.description??item.effects.map(EffectEditor.describe).join('\n');$('race').value=item.race;$('affinity').value=item.affinity;$('image-file').value=item.imageFile;$('detail-image-file').value=item.detailImageFile??'';$('cooldown').value=item.cooldown;$('space').value=item.space??1;$('max-hp').value=item.maxHp??180;$('attack').value=item.attack??10;$('attack-range').value=item.attackRange??1;$('move-distance').value=item.moveDistance??1;$('stars').value=item.stars;$('rarity').value=item.rarity;$('job').value=item.job;$('effects').replaceChildren();item.effects.forEach(effectRow);$('character-passives').replaceChildren(...(item.passives??[]).map(p=>EffectEditor.passiveRow(p,markDirty,t=>$('form-message').textContent=t,{allowAttack:true})));movementEditor=EffectEditor.searchEditor(item.movement??ItemDB.defaults[0].movement??{side:'enemy',mode:'primary',range:'unlimited',targetCond:[]},markDirty,'move',true);$('movement-editor').replaceChildren(movementEditor.node);dirty=false;$('form-message').textContent='';renderList();previewGrowth();}
  const growthJobs=['守護','破陣','飛襲','支援'];
  const readBonusRow=row=>Object.fromEntries(ItemDB.growthFields.map((f,i)=>{const value=row.children[i+1].children[0].value;return [f,String(value).trim()===''?NaN:Number(value)];}));
  function readGrowth(){return Object.fromEntries(growthJobs.map((job,i)=>[job,[...$('growth-job-'+i).children].map(readBonusRow)]));}
  function readBonuses(kind){return Object.fromEntries([...$('growth-'+kind).children].map(row=>[row.dataset.key,readBonusRow(row)]));}
  function bonusRow(title,g){
    const row=make('div',undefined,'growth-row');row.append(make('strong',title));
    ItemDB.growthFields.forEach((field,i)=>{const label=make('label',ItemDB.growthLabels[i]),input=make('input');input.type='number';input.min=-10000;input.max=10000;input.step=['cooldown','weakDuration','statusDurationBonus'].includes(field)?0.1:1;input.required=true;input.value=g[field];input.dataset.field=field;label.append(input);row.append(label);});return row;
  }
  function renderGrowth(){
    growthJobs.forEach((job,i)=>$('growth-job-'+i).replaceChildren(...db.jobGrowth[job].map((g,star)=>bonusRow(job+' '+(star+2)+' 星',g))));
    for(const [kind,table] of [['race',db.raceBonuses],['rarity',db.rarityBonuses]])$('growth-'+kind).replaceChildren(...Object.entries(table).map(([key,g])=>{const row=bonusRow(key,g);row.dataset.key=key;return row;}));
    previewGrowth();
  }
  $('growth-form').addEventListener('input',()=>{$('growth-message').textContent='尚未儲存';previewGrowth();});
  $('growth-form').onsubmit=e=>{e.preventDefault();try{db=ItemDB.validate({...db,jobGrowth:readGrowth(),raceBonuses:readBonuses('race'),rarityBonuses:readBonuses('rarity')});persist();resetBattle();previewGrowth();$('growth-message').textContent='已儲存全部成長與加成。';}catch(error){$('growth-message').textContent=error.message;}};
  function previewGrowth(){
    try{
      const g=ItemDB.validateGrowth(readGrowth()),base={...getItem(selected),stars:Number($('stars').value),job:$('job').value,race:$('race').value,rarity:$('rarity').value,attack:Number($('attack').value),attackRange:Number($('attack-range').value),maxHp:Number($('max-hp').value),cooldown:Number($('cooldown').value),moveDistance:Number($('move-distance').value),effects:[...$('effects').children].map(row=>row.read())};base.growth=g[base.job];base.raceBonus=ItemDB.validateBonuses(readBonuses('race'),'race')[base.race];base.rarityBonus=ItemDB.validateBonuses(readBonuses('rarity'),'rarity')[base.rarity];
      const table=make('table'),head=make('tr');['星數','最大 HP','攻擊力（傷害／治療／護盾）','攻擊距離','失衡效果加成','倒地時間','狀態秒數加成','狀態層數加成','行動效果'].forEach(t=>head.append(make('th',t)));table.append(head);
      for(let star=base.stars;star<=6;star++){const u=ItemDB.atStars(base,star,GameConfig.read(localStorage)),row=make('tr');[star+' 星',u.maxHp+'（+'+(u.maxHp-base.maxHp)+'）',['damage','heal','shield'].map(t=>u.attack+(u.outputBonuses?.[t]??0)).join('／'),u.attackRange,u.outputBonuses?.posture??0,u.weakDuration+' 秒',u.statusDurationBonus??0,u.statusAmountBonus??0,u.effects.map(EffectEditor.describe).join(' ／ ')||'無'].forEach(t=>row.append(make('td',t)));table.append(row);}$('growth-preview').replaceChildren(table);
    }catch(e){$('growth-preview').textContent=e.message;}
  }
  function markDirty(){dirty=true;$('form-message').textContent='尚未儲存';previewGrowth();}
  $('editor-form').addEventListener('input',markDirty);$('editor-form').addEventListener('change',markDirty);
  $('search').oninput=renderList;
  $('character-add-passive').onclick=()=>{if($('character-passives').children.length>=20)return;$('character-passives').append(EffectEditor.passiveRow({when:'action',subject:{relation:'self',conditions:[]},effects:[]},markDirty,t=>$('form-message').textContent=t,{allowAttack:true}));markDirty();};
  $('add-effect').onclick=()=>{if($('effects').children.length>=8){$('form-message').textContent='最多 8 個效果。';return;}effectRow({type:'damage',amount:10});markDirty();};
  $('editor-form').onsubmit=e=>{
    e.preventDefault();const item={id:selected,description:$('character-description').value,shopPrice:Number($('shop-price').value),shopWeight:Number($('shop-weight').value),attack:Number($('attack').value),attackRange:Number($('attack-range').value),maxHp:Number($('max-hp').value),moveDistance:Number($('move-distance').value),passives:[...$('character-passives').children].map(n=>n.read()),movement:movementEditor.read(),space:Number($('space').value),race:$('race').value,affinity:$('affinity').value,name:$('name').value,imageFile:$('image-file').value,detailImageFile:$('detail-image-file').value,cooldown:Number($('cooldown').value),stars:Number($('stars').value),rarity:$('rarity').value,job:$('job').value,effects:[...$('effects').children].map(row=>row.read())};
    try{db=ItemDB.validate({...db,items:db.items.map(x=>x.id===selected?item:x)});persist();edit(selected);resetBattle();$('form-message').textContent='已儲存，試煉場已套用新數值。';}catch(error){$('form-message').textContent=error.message;}
  };
  function add(copy){if(!canLeave())return;if(db.items.length>=500){notice('最多支援 500 位角色。');return;}const item=copy?clone(getItem(selected)):{shopPrice:30,shopWeight:100,space:1,maxHp:180,attack:10,attackRange:1,moveDistance:1,race:'人類',affinity:'物理',name:'新角色',imageFile:'',detailImageFile:'',stars:1,rarity:'SR',job:'守護',cooldown:3,effects:[{type:'damage',amount:10}]};item.description??=item.effects.map(EffectEditor.describe).join('\n');item.id=`item-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;if(copy)item.name=`${item.name.slice(0,35)} 副本`;db.items.push(item);persist();$('search').value='';edit(item.id);resetBattle();}
  $('new').onclick=()=>add(false);$('duplicate').onclick=()=>add(true);
  $('delete').onclick=()=>{
    if(db.items.length===1){$('form-message').textContent='資料庫至少需要一位角色。';return;}
    if(!confirm(`刪除「${getItem(selected).name}」？陣容中的對應槽位會清空。尚未儲存的修改也會捨棄。`))return;
    db.items=db.items.filter(x=>x.id!==selected);loadouts=loadouts.map(a=>a.map(id=>id===selected?'':id));persist();edit(db.items[0].id);resetBattle();
  };
  function battleMembers(){return loadouts.map((a,i)=>a.map((id,j)=>{const c=getItem(id);return c?Laws.attach(ItemDB.atStars(c,Math.max(c.stars,runStars[i][j]??c.stars),GameConfig.read(localStorage)),runLaws[i][j],GameConfig.read(localStorage)):null;}));}
  function resetBattle(){
    running=false;bank=0;loadouts=loadouts.map(a=>a.map(id=>getItem(id)?id:''));const members=battleMembers();state=Battle.create(members,SkillEditor.getSkills(),[Number($('capacity-self').value),Number($('capacity-enemy').value)],{config:GameConfig.read(localStorage),footprints:true,activeSkillsEnabled:$('active-skills-enabled').checked});SkillEditor.setTeams(members,db.items);
    $('teams').replaceChildren();
    state.teams.forEach((team,i)=>{
      const section=make('div',undefined,`team ${i?'enemy':''}`),heading=make('div',undefined,'team-heading');heading.append(make('strong',i?'🔥 敵方':'🌿 我方'),make('span','','vitals'));section.append(heading);
      section.append(make('div','','live-board'),make('p','','team-skill'));
      const slots=make('div',undefined,'slots');loadouts[i].forEach((id,j)=>{
        const slot=make('div',undefined,'slot');const owner=members[i].findIndex((u,k)=>u&&k<j&&k+(u.space??1)>j);slot.dataset.occupied=String(owner>=0&&!id);slot.append(make('small',`第 ${j+1} 格`+(owner>=0?'（由第 '+(owner+1)+' 格角色佔用）':'')));const select=make('select');select.setAttribute('aria-label',`${i?'敵方':'我方'}第 ${j+1} 個角色`);
        const empty=make('option','空槽');empty.value='';select.append(empty);db.items.forEach(item=>{const option=make('option',`${item.name}（${item.space??1}格）`);option.value=item.id;option.disabled=j+item.space>10||members[i].some((u,k)=>u&&k!==j&&j<k+u.space&&j+item.space>k);select.append(option);});select.value=id;
        select.onchange=()=>{loadouts[i][j]=select.value;runStars[i][j]=null;runLaws[i][j]=[];resetBattle();};slot.append(select);const starLabel=make('label','本局星等'),starSelect=make('select');for(let star=getItem(id)?.stars??1;star<=6;star++){const o=make('option',star+' 星');o.value=star;starSelect.append(o);}starSelect.value=team.items[j]?.stars||1;starSelect.disabled=!id;starSelect.onchange=()=>{runStars[i][j]=Number(starSelect.value);resetBattle();};starLabel.append(starSelect);slot.append(starLabel);
        const lawLabel=make('label','本局法則'),lawSelect=make('select');lawSelect.setAttribute('aria-label',`${i?'敵方':'我方'}第 ${j+1} 格法則`);
        const noLaw=make('option','加入法則…');noLaw.value='';lawSelect.append(noLaw);
        availableLaws().forEach(l=>{const o=make('option',l.name);o.value=l.id;lawSelect.append(o);});lawSelect.value='';
        lawSelect.onchange=()=>{const law=availableLaws().find(l=>l.id===lawSelect.value);if(law&&id&&!state.started){runLaws[i][j].push(clone(law));resetBattle();}};
        lawLabel.append(lawSelect);slot.append(lawLabel);
        const lawList=make('div',undefined,'trial-laws');runLaws[i][j].forEach((law,k)=>{const remove=make('button',law.name+' ×');remove.type='button';remove.setAttribute('aria-label',`移除${law.name}（第 ${k+1} 份）`);remove.onclick=()=>{if(!state.started){runLaws[i][j].splice(k,1);resetBattle();}};lawList.append(remove);});slot.append(lawList);
        const item=members[i][j];slot.append(make('small',item?`HP ${item.maxHp} · ${item.cooldown}s · ${item.effects.map(EffectEditor.describe).join(' / ')}`:'未裝備'));slots.append(slot);
      });section.append(slots);$('teams').append(section);
    });$('play').disabled=state.blocked;$('capacity-message').textContent=state.teams.map((t,i)=>`${i?'敵方':'我方'}空間 ${t.capacity.used} / ${t.capacity.limit}${t.capacity.valid&&t.layoutValid?'':'（重疊、超出格位或空間上限）'}`).join(' · ');$('play').textContent='開始戰鬥';$('battle-result').textContent=state.blocked?'請調整重疊、超界角色或空間上限後再開戰':'準備就緒';draw();sendPreview();
  }
  function draw(){
    [...$('teams').children].forEach(node=>node.querySelectorAll('.trial-laws button').forEach(button=>button.disabled=state.started));
    [...$('teams').children].forEach((node,i)=>{const team=state.teams[i];node.querySelector('.vitals').textContent='存活 '+team.units.filter(u=>u.hp>0).length+' / '+team.units.length;
      const board=node.querySelector('.live-board');board.replaceChildren();team.items.forEach((u,j)=>{const tile=make('div',undefined,'combatant');tile.append(make('strong',(j+1)+'位 · '+(u?u.name:'空位')));if(u){tile.classList.toggle('dead',u.hp===0);tile.classList.toggle('weak',u.weakUntil>state.tick);tile.append(make('small',u.hp===0?'死亡':u.hp+' / '+u.maxHp+' HP · 盾 '+u.shield));for(const [label,value,max,cls] of [['血量',u.hp,u.maxHp,'health'],['失衡',u.posture,state.config.postureLimit,'posture']]){const meter=make('div',undefined,cls);meter.setAttribute('role','progressbar');meter.setAttribute('aria-label',u.name+label);meter.setAttribute('aria-valuemin',0);meter.setAttribute('aria-valuemax',max);meter.setAttribute('aria-valuenow',value);const fill=make('div');fill.style.width=value/max*100+'%';meter.append(fill);tile.append(meter);}tile.append(make('small',u.hp===0?'':u.weakUntil>state.tick?'倒地 '+((u.weakUntil-state.tick)/10).toFixed(1)+' 秒':'失衡 '+u.posture+' / '+state.config.postureLimit));const progress=make('div',undefined,'charge'),fill=make('div');const percent=u.hp>0?Math.max(0,Math.min(100,(1-(u.nextAction-state.tick)/(u.cooldown*10))*100)):0;fill.style.width=percent+'%';progress.setAttribute('role','progressbar');progress.setAttribute('aria-label',u.name+'行動進度');progress.setAttribute('aria-valuemin',0);progress.setAttribute('aria-valuemax',100);progress.setAttribute('aria-valuenow',Math.round(percent));progress.append(fill);tile.append(progress);tile.append(make('small',(u.statuses||[]).map(x=>Statuses.label(x,state.tick)).join('／')));tile.append(make('small',u.hp>0?'下次行動 '+Math.max(0,(u.nextAction-state.tick)/10).toFixed(1)+' 秒':''));}board.append(tile);});
      node.querySelector('.team-skill').textContent=i?'敵方無極式':'極式：'+team.skill.name+' · CD '+team.skill.cooldown+'s';node.querySelectorAll('.slots select').forEach(control=>control.disabled=state.started||control.closest('.slot').dataset.occupied==='true'||!control.closest('.slot').querySelector('select').value&&control.closest('label')!==null);
    });
    const skill=state.teams[0].skill;$('skill-name').textContent=skill.name;$('skill-description').textContent=skill.effects.map(EffectEditor.describe).join(' ＋ ')+` · CD ${skill.cooldown} 秒`;$('cast').disabled=!running||!Battle.canCast(state,0);$('cast').textContent=state.teams[0].skillReady>state.tick?`冷卻 ${((state.teams[0].skillReady-state.tick)/10).toFixed(1)} 秒`:'施放極式';
    $('timer').textContent=`${(state.tick/10).toFixed(1)} 秒`;
    $('log').replaceChildren(...state.events.slice().reverse().map(e=>make('li',`${(e.tick/10).toFixed(1)}s ${e.team?'敵方':'我方'} ${e.name} ${e.detail||''}${e.type==='status'?'':` → ${e.amount} ${label[e.type]||''}`}`)));
  }
  $('play').onclick=()=>{if(state.done||state.blocked)return;running=!running;state.started=true;last=performance.now();$('play').textContent=running?'暫停':'繼續';$('battle-result').textContent=running?'戰鬥中':'已暫停';draw();};
  $('reset').onclick=resetBattle;
  {const saved=GameConfig.readCapacity(localStorage);$('capacity-self').value=saved[0];$('capacity-enemy').value=saved[1];}
  ['capacity-self','capacity-enemy'].forEach(id=>$(id).oninput=()=>{resetBattle();const limits=[Number($('capacity-self').value),Number($('capacity-enemy').value)];if(limits.every(n=>Number.isInteger(n)&&n>=1&&n<=10))try{localStorage.setItem('minimajo.capacity.v2',JSON.stringify(limits));}catch{notice('空間上限目前僅保留在此分頁。');}});
  function finish(){if(!state.done)return;running=false;$('play').disabled=true;$('play').textContent='戰鬥結束';$('battle-result').textContent=state.winner==='draw'?'平手':state.winner===0?'我方獲勝！':'敵方獲勝';}
  $('cast').onclick=()=>{if(running){Battle.cast(state,0);finish();draw();}};
  document.addEventListener('visibilitychange',()=>{last=performance.now();});
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  function frame(now){if(running&&!document.hidden){bank+=Math.min(now-last,100)*Number($('speed').value);while(bank>=100&&running){bank-=100;Battle.step(state);if(state.done){running=false;$('play').disabled=true;$('play').textContent='戰鬥結束';$('battle-result').textContent=state.winner==='draw'?'平手':state.winner===0?'我方獲勝！':'敵方獲勝';}}draw();}last=now;requestAnimationFrame(frame);}
  window.addEventListener('config-changed',()=>{resetBattle();previewGrowth();});
  window.addEventListener('workspace-tab-change',e=>{if(e.detail!=='battle')$('battle-preview').contentWindow?.postMessage({type:'minimajo-pause'},'*');if(e.detail!=='battle'&&running){running=false;$('play').textContent='繼續';$('battle-result').textContent='已暫停（切換編輯頁）';draw();}});
  window.addEventListener('laws-changed',resetBattle);window.addEventListener('skills-changed',resetBattle);window.addEventListener('statuses-changed',resetBattle);
  function sendPreview(){
    $('battle-preview').contentWindow?.postMessage({type:'minimajo-preview',config:GameConfig.read(localStorage),statusLibrary:Statuses.snapshot(),loadouts:battleMembers(),skills:SkillEditor.getSkills(),activeSkillsEnabled:$('active-skills-enabled').checked,limits:[Number($('capacity-self').value),Number($('capacity-enemy').value)]},'*');
  }
  $('active-skills-enabled').addEventListener('change',resetBattle);
  $('battle-preview').addEventListener('load',sendPreview);
  window.addEventListener('message',event=>{
    if(event.source!==$('battle-preview').contentWindow)return;
    if(event.data?.type==='minimajo-preview-ready')sendPreview();
    if(event.data?.type==='minimajo-battle-state'){
      state.started=!!event.data.started;draw();
      ['capacity-self','capacity-enemy','active-skills-enabled'].forEach(id=>$(id).disabled=state.started);
    }
  });
  window.CharacterLibrary={getItems:()=>clone(db.items)};
  renderGrowth();edit(db.items[0].id);resetBattle();requestAnimationFrame(frame);
})();
