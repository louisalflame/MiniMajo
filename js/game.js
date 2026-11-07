(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  // A self-contained visual trial: editor drafts and browser saves are not modified.
  const slotCount = 10;
  const roles = [
    ['moon-knight', '月誓劍士', 1, '破陣', 2.2, 17],
    ['veil-witch', '薄暮魔女', 2, '支援', 2.8, 21],
    ['star-scout', '逐星斥候', 1, '飛襲', 2.4, 16],
    ['star-warden', '星燼守衛', 3, '守護', 3.4, 16],
    ['moon-seer', '月影先知', 1, '支援', 3.1, 18],
    ['night-blade', '夜行之刃', 1, '破陣', 2.6, 17],
    ['hollow-knight', '失誓騎士', 1, '破陣', 2.6, 18],
    ['hollow-witch', '黯月祭司', 2, '支援', 3.1, 22],
    ['hollow-scout', '幽影斥候', 1, '飛襲', 2.5, 16],
    ['hollow-warden', '空殼守衛', 3, '守護', 3.6, 17],
    ['hollow-seer', '虛空先知', 1, '支援', 3.2, 17],
    ['hollow-blade', '殘月之刃', 1, '破陣', 2.8, 18]
  ];
  const characters = ItemDB.validate({version:2,items:roles.map(([id,name,space,job,cooldown,damage],i)=>({
    ...structuredClone(ItemDB.defaults[i % ItemDB.defaults.length]),id,name,space,job,cooldown,maxHp:240,moveDistance:1,
    effects:[{type:'damage',amount:damage,range:1},...(job==='守護'?[{type:'shield',amount:5}]:[])]
  }))}).items;
  // Wide characters occupy consecutive columns; movement uses the same footprint.
  function formation(members){
    const slots=Array(slotCount).fill(null);let column=0;
    for(const unit of members){
      if(column+unit.space>slotCount)throw new Error('示範隊伍超出 10 格');
      slots[column]=unit;column+=unit.space;
    }
    return slots;
  }
  let skills = SkillDB.validate({version:1,skills:[{id:'moon-pact',name:'月蝕之契',cooldown:8,mode:'all',conditions:[],effects:[{type:'damage',amount:32,range:3},{type:'posture',amount:20,range:3},{type:'heal',amount:12}]}]}).skills;
  let config=GameConfig.validate(GameConfig.defaults),configuredLoadouts=null, limits=[slotCount,slotCount], activeSkillsEnabled=true,allySkillsEnabled=true,enemySkill=null,repositionTeams=[0];
  const preview=typeof location!=='undefined'&&new URLSearchParams(location.search).has('preview');
  if(!preview)try{if(globalThis.publicDataError)throw Error(globalThis.publicDataError);config=GameConfig.read(globalThis.MiniMajoPublicData?.storage??globalThis.localStorage);}catch(error){$('battle-message').textContent='Config 設定無效：'+error.message;$('play').disabled=true;$('cast').disabled=true;return;}
  let previewReady=!preview,campaign=null,resultSent=false,preparing=false,resultAcknowledged=false;
  function notifyPreview(){if(preview)parent.postMessage({type:'minimajo-battle-state',started:state.started,token:campaign},'*');}
  let state, running=false, speed=1, autoCast=false, bank=0, last=0;
  const audio=globalThis.BattleAudio?.create();
  if(audio&&!audio.enabled){$('battle-sound-label').textContent='靜音';$('battle-sound').setAttribute('aria-pressed','false');$('battle-sound').setAttribute('aria-label','音效已關閉，點擊開啟');}
  let battleDrag=null,repositionPending=null,repositionSerial=0,suppressInspectUntil=0;
  let cards=new Map(), floatLayers=[],statsMode=false, emptySlots=[[],[]];
  const statusResizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(()=>{for(const c of cards.values())if(c.root.isConnected)fitStatusIcons(c);}):null;
  let overtimeShown=false;const overtimeMotions=new Map();
  const missMotions=new Map();let readyMotion=null,readyAnnounced=false,readySkillId='';
  let inspected=null, detailTrigger=null, skillPinned=false,resumeAfterDetail=false;
  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  const exitLayer=node('div','battle-exit-layer'),exitGhosts=new Set();exitLayer.setAttribute('aria-hidden','true');document.body.append(exitLayer);
  function clearExits(){for(const ghost of exitGhosts){ghost.animation.cancel();ghost.root.remove();}exitGhosts.clear();}
  function meter(name,cls,max,icon){
    const el=node('div','meter '+cls), fill=node('span');
    fill.className='meter-fill';
    const text=node('span','meter-value');
    el.setAttribute('role','progressbar');el.setAttribute('aria-label',name);el.setAttribute('aria-valuemin','0');el.setAttribute('aria-valuemax',String(max));el.append(fill);
    if(icon)el.append(UIIcons.create(document,icon),text);
    return {el,fill,text};
  }
  function card(unit){
    const root=node('article','unit');root.setAttribute('aria-label',unit.name);root.setAttribute('data-battle-id',unit.battleId);
    root.tabIndex=0;root.setAttribute('role','button');root.setAttribute('aria-controls','character-detail');root.setAttribute('aria-expanded','false');
    root.addEventListener('click',()=>{if(Date.now()>=suppressInspectUntil)inspect(unit);});
    root.addEventListener('pointerdown',event=>beginBattleDrag(event,root,unit));
    root.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inspect(unit);}});
    const portrait=node('div','portrait image-slot');
    portrait.append(node('span','image-mark','＋'),node('span','image-label','角色圖片'),node('small','image-size',unit.space+' 格'));
    const position=node('span','slot-range',String(unit.slot+1).padStart(2,'0')+(unit.space>1?' — '+String(unit.slot+unit.space).padStart(2,'0'):''));
    portrait.append(position);
    CharacterArt.mount(document,portrait,unit,[portrait.children[0],portrait.children[1]]);
    const hud=node('div','unit-hud');
    const hp=meter(unit.name+' 血量與護盾','hp-meter',unit.maxHp,'heart'),stagger=meter(unit.name+' 失衡','stagger',state.config.postureLimit,'posture'),action=meter(unit.name+' 行動進度','unit-action-meter',100);
    hp.shield=node('span','shield-fill');hp.shield.setAttribute('aria-hidden','true');
    hp.trail=node('span','hp-loss-trail');hp.trail.setAttribute('aria-hidden','true');
    const status=node('div','unit-status');status.setAttribute('aria-label','目前狀態');
    const heading=CharacterCardSkin.heading(document,unit),values=node('div','roster-card-values');
    hud.className+=' roster-card-hud';
    hp.el.replaceChildren(hp.trail,hp.fill,hp.shield,CharacterCardSkin.icon(document,'health','血量'),hp.text);
    stagger.el.replaceChildren(stagger.fill,CharacterCardSkin.icon(document,'posture','失衡'),stagger.text);
    const range=node('span','roster-extra roster-range');range.setAttribute('aria-label','攻擊距離 '+(unit.attackRange??1)+' 格');range.title='攻擊距離 '+(unit.attackRange??1)+' 格';
    range.append(CharacterCardSkin.icon(document,'range','攻擊距離'),node('span','roster-value',String(unit.attackRange??1)));
    const attack=CharacterCardSkin.stat(document,'attack',Effects.attackValue(unit,'damage'),'攻擊力');
    values.append(attack,range);
    const headingArea=node('div','unit-heading-area'),totals=node('div','battle-totals');totals.hidden=true;
    headingArea.append(status,totals,heading);hud.append(headingArea,hp.el,stagger.el,values);
    CharacterCardSkin.mount(document,root,unit,portrait,action.el,hud);
    const veil=node('span','unit-condition-veil'),halo=node('span','unit-passive-halo'),flash=node('span','unit-hit-flash'),healSweep=node('span','unit-heal-sweep'),shieldGlow=node('span','unit-shield-gain');
    for(const el of [veil,halo,flash,healSweep,shieldGlow])el.setAttribute('aria-hidden','true');
    root.querySelector('.reward-card-surface').append(veil,flash,healSweep);root.append(halo,shieldGlow,status);
    const motions=new Map();hp.motions=motions;
    return {root,portrait,position,hp,stagger,action,status,hud,headingArea,totals,attack,halo,flash,healSweep,shieldGlow,motions};
  }
  function reset(){
    clearBattleDrag();repositionPending=null;
    for(const [el,animation]of missMotions){animation.cancel();el.remove();}missMotions.clear();readyMotion?.cancel();readyMotion=null;readyAnnounced=false;readySkillId='';
    resultAcknowledged=false;if($('battle-result').open)$('battle-result').close();$('battle-result').hidden=true;
    clearExits();
    statusResizeObserver?.disconnect();
    audio?.stop();
    closeDetail(false);hideSkill();hideEnemySkill();
    for(const c of cards.values())for(const animation of c.motions.values())animation.cancel();
    for(const animation of overtimeMotions.values())animation.cancel();overtimeMotions.clear();overtimeShown=false;
    state=Battle.create(configuredLoadouts||[formation(characters.slice(0,6)),formation(characters.slice(6))],skills,limits,{config,footprints:true,activeSkillsEnabled,allySkillsEnabled,enemySkill});
    audio?.setVolume?.(state.config.battleVolume);
    resultSent=false;
    running=false;preparing=false;bank=0;last=performance.now();cards=new Map();floatLayers=[],statsMode=false;
    $('enemy-units').replaceChildren();$('ally-units').replaceChildren();
    state.teams.forEach(team=>team.units.forEach(unit=>{const c=card(unit);cards.set(unit,c);statusResizeObserver?.observe(c.root);statusResizeObserver?.observe(c.headingArea);}));
    $('battle-message').textContent='契約已締結。準備迎戰。';
    document.querySelector('.battlefield').classList.remove('casting');
    draw();notifyPreview();
  }
  function fill(m,value,max){
    m.fill.style.width=Math.max(0,Math.min(100,value/max*100))+'%';
    m.text.textContent=value+'/'+max;
    m.el.title=value+' / '+max;
    m.el.setAttribute('aria-valuenow',String(value));m.el.setAttribute('aria-valuemax',String(max));
    m.el.setAttribute('aria-valuetext',value+' / '+max);
  }
  function fillHealth(m,unit){
    const hp=Math.max(0,unit.hp),shield=Math.max(0,unit.shield),max=unit.maxHp,scale=Math.max(1,max,hp+shield);
    const red=hp/scale*100,blue=shield/scale*100;
    updateHealthTrail(m,hp,scale);
    m.fill.style.width=red+'%';m.shield.style.left=red+'%';m.shield.style.width=blue+'%';m.shield.hidden=shield===0;
    if(shield){m.text.textContent='';m.text.replaceChildren(node('span','hp-value',String(hp)),node('span','shield-value','+'+shield),node('span','maxhp-value','/'+max));}
    else{m.text.replaceChildren();m.text.textContent=hp+'/'+max;}
    const text=shield?hp+' + '+shield+' / '+max:hp+' / '+max;
    m.el.title=text;m.el.setAttribute('aria-valuenow',String(hp));m.el.setAttribute('aria-valuemax',String(max));m.el.setAttribute('aria-valuetext',shield?'血量 '+hp+'，護盾 '+shield+'，最大血量 '+max:text);
  }
  function updateHealthTrail(m,hp,scale){
    const animation=m.motions.get('hpTrail');
    const progress=animation?Math.max(0,Math.min(1,((animation.currentTime??0)/animation.trailDuration-.2)/.8)):1;
    const ghost=animation?animation.fromHp+(animation.toHp-animation.fromHp)*progress:(m.lastHp??hp);
    const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    m.trail.style.width=(hp/scale*100)+'%';
    if(reduced||statsMode||hp<=0||hp>=ghost){animation?.cancel();m.motions.delete('hpTrail');}
    else if(hp<m.lastHp||(animation&&scale!==m.lastScale)){
      const duration=hp<m.lastHp?300:Math.max(1,animation.trailDuration-(animation.currentTime??0));
      animation?.cancel();
      if(m.trail.animate){
        const from=(Math.min(scale,ghost)/scale*100)+'%',to=(hp/scale*100)+'%';
        const next=m.trail.animate([{width:from},{width:from,offset:.2},{width:to}],{duration,easing:'linear'});
        next.fromHp=ghost;next.toHp=hp;next.trailDuration=duration;m.motions.set('hpTrail',next);
        next.onfinish=()=>{if(m.motions.get('hpTrail')===next)m.motions.delete('hpTrail');};
      }
    }
    m.lastHp=hp;m.lastScale=scale;
  }
  function statusBadge(kind,label,text){
    const badge=node('span','unit-status-badge');badge.title=label;badge.setAttribute('role','img');badge.setAttribute('aria-label',label);
    badge.append(kind==='posture'?CharacterCardSkin.icon(document,'posture','失衡'):UIIcons.create(document,kind));if(text!==undefined)badge.append(node('span','',String(text)));return badge;
  }
  function fitStatusIcons(card){
    if(!card.status.getBoundingClientRect||typeof getComputedStyle!=='function')return;
    const bounds=card.root.getBoundingClientRect(),heading=card.headingArea.getBoundingClientRect();
    // The HUD includes its outer padding; the heading bounds are the actual inner frame.
    card.status.style.left=Math.max(0,heading.left-bounds.left)+'px';card.status.style.right=Math.max(0,bounds.right-heading.right)+'px';card.status.style.bottom=(bounds.bottom-heading.top+6)+'px';
    const style=getComputedStyle(card.status);
    const width=card.status.getBoundingClientRect().width-parseFloat(style.paddingRight||0),height=heading.top-bounds.top-Math.max(8,bounds.height*.05),count=card.status.children.length;
    let size=24;
    for(;size>12;size--){const columns=Math.max(1,Math.floor((width+2)/(size+2)));if(Math.ceil(count/columns)*(size+2)-2<=height)break;}
    card.status.style.setProperty('--status-badge-size',size+'px');
  }
  function draw(allowSound=false){
    const positions=new Map();
    for(const [unit,c]of cards)if(c.root.isConnected&&c.root.getBoundingClientRect)positions.set(unit,c.root.getBoundingClientRect());
    const visuals=(state.visuals??[]).splice(0);
    if((!running&&!state.done)||document.hidden||statsMode||inspected)audio?.stop();
    if((running||allowSound)&&!document.hidden&&!statsMode&&!inspected)audio?.events(visuals);
    for(const event of state.feedback.splice(0)){
      if(statsMode)continue;
      let layer=floatLayers.find(x=>x.team===event.team&&x.slot===event.slot);
      if(!layer){const el=node('div','combat-floats');el.style.gridColumn=(event.slot+1)+' / span 1';el.style.gridRow='1';layer={team:event.team,slot:event.slot,el,serial:0};floatLayers.push(layer);}
      const ordinal=layer.serial++,number=node('span','combat-number '+event.type,event.type==='miss'?'MISS':(event.type==='damage'?'−':'+')+event.amount);
      number.setAttribute('aria-hidden','true');number.style.left=(15+(ordinal%3)*30)+'%';number.style.top=(30+(Math.floor(ordinal/3)%4)*25)+'px';number.style.animationDelay=(ordinal%4)*.08+'s';layer.el.append(number);
      if(event.type==='miss'&&number.animate){
        number.style.animation='none';
        const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const animation=number.animate(reduced?[{opacity:1},{opacity:1}]:[{opacity:0,transform:'translate(-50%,8px) scale(.9)'},{opacity:1,transform:'translate(-50%,0) scale(1.05)',offset:.15},{opacity:1,offset:.65},{opacity:0,transform:'translate(-50%,-32px) scale(1)'}],{duration:850,easing:'ease-out'});
        missMotions.set(number,animation);animation.onfinish=()=>{number.remove();missMotions.delete(number);};
      }else setTimeout(()=>number.remove(),1500);
    }
    state.teams.forEach((team,i)=>{
      const container=$(i?'enemy-units':'ally-units'),occupied=new Set(),tiles=[];
      (statsMode?team.units:team.items).forEach(unit=>{if(unit&&(statsMode||unit.hp>0)){
        const slot=statsMode?unit.startSlot:unit.slot;
        const c=cards.get(unit);c.root.style.gridColumn=(slot+1)+' / span '+unit.space;c.root.style.gridRow='1';
        c.root.classList.toggle('prebattle-draggable',!state.started&&!state.done&&repositionTeams.includes(i)&&!repositionPending&&!preparing);
        c.root.style.touchAction=!state.started&&repositionTeams.includes(i)?'none':'';
        c.position.textContent=String(slot+1).padStart(2,'0')+(unit.space>1?' — '+String(slot+unit.space).padStart(2,'0'):'');
        tiles.push(c.root);for(let n=slot;n<slot+unit.space;n++)occupied.add(n);
      }});
      for(let slot=0;slot<slotCount;slot++)if(!occupied.has(slot)){
        let empty=emptySlots[i][slot];if(!empty){empty=node('div','empty-slot');empty.style.gridColumn=String(slot+1);empty.style.gridRow='1';empty.setAttribute('aria-label','第 '+(slot+1)+' 格，空位');empty.append(node('span','slot-range',String(slot+1).padStart(2,'0')),node('span','','空位'));emptySlots[i][slot]=empty;}tiles.push(empty);
      }
      if(!statsMode)tiles.push(...floatLayers.filter(x=>x.team===i&&x.el.children.length).map(x=>x.el));
      if(container.children.length!==tiles.length||tiles.some((tile,index)=>container.children[index]!==tile))container.replaceChildren(...tiles);
      team.units.forEach((unit,slot)=>{
        if(!unit)return;
        const c=cards.get(unit);
        c.root.classList.toggle('dead',unit.hp===0);c.root.classList.toggle('down',unit.hp>0&&unit.weakUntil>state.tick);
        c.root.classList.toggle('stunned',unit.hp>0&&Statuses.active(unit,'stun'));
        fillHealth(c.hp,unit);fill(c.stagger,unit.posture,state.config.postureLimit);
        const attack=String(Effects.attackValue(unit,'damage'));
        const attackText=c.attack.children[1];
        if(attackText.textContent!==attack){
          attackText.textContent=attack;
          c.attack.title='攻擊力 '+attack;
          c.attack.setAttribute('aria-label',c.attack.title);
        }
        const progress=unit.hp>0?Math.max(0,Math.min(100,(1-(unit.nextAction-state.tick)/(unit.cooldown*10))*100)):0;
        c.action.fill.style.height=progress+'%';
        c.action.el.setAttribute('aria-valuenow',String(Math.round(progress)));
        c.action.el.setAttribute('aria-valuetext',Math.round(progress)+'%');
        const badges=[];
        if(unit.hp===0)badges.push(statusBadge('down','已倒下'));
        else if(unit.weakUntil>state.tick)badges.push(statusBadge('posture','失衡倒地 · '+((unit.weakUntil-state.tick)/10).toFixed(1)+' 秒'));
        badges.push(...unit.statuses.map(x=>{const label=Statuses.label(x,state.tick),badge=node('span','unit-status-badge');badge.title=label;badge.setAttribute('role','img');badge.setAttribute('aria-label',label);badge.append(UIIcons.createStatus(document,x.kind));return badge;}));
        c.status.replaceChildren(...badges);
        fitStatusIcons(c);
        c.hud.hidden=false;c.status.hidden=statsMode;c.totals.hidden=!statsMode;c.root.classList.toggle('show-stats',statsMode);
        if(statsMode)c.totals.replaceChildren(...[['傷害',unit.stats.damage],['護盾',unit.stats.shield],['治療',unit.stats.heal],['行動',unit.stats.actions]].map(([name,value])=>node('div','',name+' '+value)));
      });
      $(i?'enemy-count':'ally-count').textContent=team.units.filter(u=>u.hp>0).length+' / '+team.units.length+' 人 · '+team.capacity.used+' / '+slotCount+' 格';
    });
    $('battle-stats-note').hidden=true;
    $('battle-stats').hidden=!state.done||![0,'draw'].includes(state.winner);$('battle-stats-label').textContent=statsMode?'返回戰鬥結果':'戰鬥統計';$('battle-stats').setAttribute('aria-pressed',String(statsMode));
    const elapsed=Math.floor(state.tick/10),overtime=state.tick>=state.config.battleSeconds*10,seconds=Math.abs(state.config.battleSeconds-elapsed);$('timer').textContent=(overtime?'+':'')+String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
    $('phase').textContent=state.done?'試煉結束':running?(overtime?'超時耗損':'交鋒之中'):state.started?'已暫停':'等待開戰';
    $('play').textContent=state.done?(campaign?'返回地圖':'試煉結束'):running?'暫停':state.started?'繼續戰鬥 ▷':'開始戰鬥 ▷';$('play').disabled=(state.done&&!campaign)||state.blocked||!previewReady||!!inspected||preparing||!!repositionPending||!!battleDrag;
    $('battle-gear').hidden=!campaign||state.started||state.done;
    renderEnemySkill();
    const skill=state.teams[0].skill;renderSkillArt(skill);const remaining=Math.max(0,(state.teams[0].skillReady-state.tick)/10);
    $('skill-name').textContent=campaign&&!skill.enabled?'':skill.name;$('skill-description').textContent=skill.description??(skill.effects.map(describeEffect).join('\n')||'目前隊伍沒有符合條件的極式。');$('skill-tooltip-title').textContent=skill.name+' · 冷卻 '+skill.cooldown+' 秒 · 不限射程';$('cast').setAttribute('aria-label','施放'+skill.name);
    $('cast').disabled=!running||!Battle.canCast(state,0);if(campaign&&!skill.enabled){$('skill-description').textContent='';$('skill-tooltip-title').textContent='';$('cast').setAttribute('aria-label','無極式');hideSkill();}
    $('cast-label').textContent=remaining>0?'契約恢復中':'施放契約';
    $('cast-state').textContent=!state.activeSkillsEnabled?'極式已關閉（雙方）':!state.allySkillsEnabled?'我方極式已關閉':state.done?'試煉已結束':!state.started?'開戰後開始充能':remaining>0?remaining.toFixed(1)+' 秒後就緒':!running?'繼續戰鬥後可施放':'極式就緒 · 點擊施放';
    if(campaign){$('cast-state').textContent=skill.enabled&&remaining>0?remaining.toFixed(1)+' 秒':'';$('phase').textContent='';if(!state.done&&!state.blocked&&previewReady)$('battle-message').textContent='';}
    $('skill-progress').style.strokeDashoffset=String(skill.cooldown?100*Math.min(1,remaining/skill.cooldown):100);
    if(state.blocked)$('battle-message').textContent='無法開戰：角色重疊、超出十格或超出空間上限，請調整編隊。';
    if(!previewReady)$('battle-message').textContent='等待工坊編隊資料…';
    if(state.done&&campaign&&resultAcknowledged&&!resultSent){resultSent=true;parent.postMessage({type:'minimajo-journey-result',token:campaign,winner:state.winner,hp:state.teams[0].units.map(u=>u.hp)},'*');}
    if(state.done){running=false;$('battle-message').textContent=campaign?'':state.winner==='draw'?'試煉終結 · 勢均力敵':state.winner===0?'試煉完成 · 月光仍與你同在':'試煉失敗 · 長夜尚未結束';}
    $('log').replaceChildren(...state.events.slice().reverse().map(e=>node('li','',(e.tick/10).toFixed(1)+'s · '+(e.team?'敵方 ':'我方 ')+e.name+' '+(e.detail||'')+(e.type!=='status'?' '+({damage:'傷害',posture:'失衡',heal:'治療',shield:'護盾',advance:'加快時間（秒）',advanceSkill:'加快主動技能（秒）'}[e.type]||e.type)+' '+e.amount:''))));
    drawSpatial(visuals,positions);
    drawMotion(visuals);
    drawOvertime(visuals);
    drawReadyCue();
    drawResult();
  }
  function drawReadyCue(){
    const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,skill=state.teams[0].skill;
    if(skill.id!==readySkillId){readySkillId=skill.id;readyAnnounced=false;readyMotion?.cancel();readyMotion=null;}
    const charging=state.tick<state.teams[0].skillReady;
    if(charging)readyAnnounced=false;
    if(reduced||statsMode||state.done||!state.started||!state.activeSkillsEnabled||!skill.enabled||charging){readyMotion?.cancel();readyMotion=null;}
    if(!statsMode&&!state.done&&Battle.canCast(state,0)&&!readyAnnounced){
      readyAnnounced=true;
      if(!reduced&&$('cast').animate){
        const animation=$('cast').animate([{filter:'brightness(1)',scale:'1'},{filter:'brightness(1.5)',scale:'1.06',offset:.3},{filter:'brightness(1)',scale:'1'}],{duration:380,easing:'ease-out'});
        readyMotion=animation;animation.onfinish=()=>{if(readyMotion===animation)readyMotion=null;};
      }
    }
    const rate=running||state.done?speed:0;
    if(readyMotion&&readyMotion.playbackRate!==rate)readyMotion.playbackRate=rate;
    for(const [el,animation]of missMotions){if(statsMode){animation.cancel();el.remove();missMotions.delete(el);}else if(animation.playbackRate!==rate)animation.playbackRate=rate;}
  }
  function drawResult(){
    const dialog=$('battle-result');
    if(!state.done||resultAcknowledged||statsMode){if(dialog.open)dialog.close();dialog.hidden=true;return;}
    if(inspected)closeDetail(false);
    const victory=state.winner===0;
    dialog.setAttribute('data-result',victory?'victory':'game-set');
    $('battle-result-title').textContent=victory?'VICTORY':'GAME SET';
    $('battle-result-confirm').setAttribute('aria-label',(victory?'VICTORY':'GAME SET')+'，'+(campaign?(victory?'領取戰利品':state.winner===1?'返回地圖':'查看戰鬥結果'):'繼續'));
    dialog.hidden=false;if(!dialog.open){dialog.showModal();$('battle-result-confirm').focus({preventScroll:true});}
  }
  $('battle-result').addEventListener('cancel',event=>event.preventDefault());
  $('battle-result-confirm').addEventListener('click',()=>{
    if(!state.done||resultAcknowledged)return;resultAcknowledged=true;audio?.stop();draw();
  });
  function drawSpatial(visuals,positions){
    const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if(reduced||statsMode)clearExits();
    const routes=new Map();for(const e of visuals)if(e.type==='relocate'){if(!routes.has(e.target))routes.set(e.target,[]);routes.get(e.target).push(e);}
    for(const [unit,c]of cards){
      const before=positions.get(unit),previousSlot=c.renderedSlot;c.renderedSlot=unit.slot;
      if(unit.hp<=0&&!c.deathShown){
        c.deathShown=true;
        if(!reduced&&!statsMode&&before?.width&&c.root.cloneNode){
          const root=c.root.cloneNode(true);root.classList.add('unit-exit-ghost');
          for(const name of ['id','role','tabindex','aria-controls','aria-expanded','data-battle-id'])root.removeAttribute(name);
          for(const el of root.querySelectorAll('[id]'))el.removeAttribute('id');
          root.setAttribute('aria-hidden','true');Object.assign(root.style,{left:before.left+'px',top:before.top+'px',width:before.width+'px',height:before.height+'px'});
          exitLayer.append(root);
          const animation=root.animate([{opacity:1,translate:'0 0'},{opacity:.55,translate:'0 12px',offset:.45},{opacity:0,translate:'0 30px'}],{duration:380,easing:'ease-in'});
          const ghost={root,animation};exitGhosts.add(ghost);animation.onfinish=()=>{root.remove();exitGhosts.delete(ghost);};
        }
      }
      if(reduced||statsMode||unit.hp<=0){c.motions.get('relocate')?.cancel();c.motions.delete('relocate');c.root.style.zIndex='';continue;}
      const path=routes.get(unit.battleId)??(previousSlot!==undefined&&previousSlot!==unit.slot?[{kind:'move',fromSlot:previousSlot,toSlot:unit.slot}]:[]);
      if(!before||!path.length||!c.root.animate)continue;
      c.motions.get('relocate')?.cancel();
      const after=c.root.getBoundingClientRect(),pitch=after.width/unit.space;
      let x=before.left-after.left,y=before.top-after.top;
      const frames=[{left:x+'px',top:y+'px',offset:0}];
      path.forEach((leg,i)=>{
        const end=(leg.toSlot-unit.slot)*pitch,arc=leg.kind==='jump'?-18:leg.kind==='swap'?(leg.toSlot>leg.fromSlot?-10:10):0;
        frames.push({left:((x+end)/2)+'px',top:(y/2+arc)+'px',offset:(i+.5)/path.length},{left:end+'px',top:'0px',offset:(i+1)/path.length});x=end;y=0;
      });
      c.root.style.zIndex='6';
      const animation=c.root.animate(frames,{duration:Math.min(320,path.length*(path.some(e=>e.kind==='jump')?180:140)),easing:'ease-out'});
      c.motions.set('relocate',animation);animation.onfinish=()=>{if(c.motions.get('relocate')===animation){c.motions.delete('relocate');c.root.style.zIndex='';}};
    }
    const rate=running||state.done?speed:0;
    for(const {animation}of exitGhosts)if(animation.playbackRate!==rate)animation.playbackRate=rate;
  }
  function drawOvertime(visuals){
    const entered=state.started&&state.tick>=state.config.battleSeconds*10;
    const active=entered&&!state.done&&!statsMode;
    const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const overlay=$('battle-overtime'),title=$('overtime-title');overlay.hidden=!active;
    document.body.classList.toggle('battle-overtime-active',active);
    $('timer').setAttribute('aria-label',(entered?'侵蝕加劇，超時 ':'剩餘時間 ')+$('timer').textContent);
    const animate=(name,el,frames,duration)=>{
      if(reduced||!el.animate)return;
      overtimeMotions.get(name)?.cancel();
      const animation=el.animate(frames,{duration,easing:'ease-out'});overtimeMotions.set(name,animation);
      animation.onfinish=()=>{if(overtimeMotions.get(name)===animation)overtimeMotions.delete(name);};
    };
    if(entered&&!overtimeShown){
      overtimeShown=true;
      if(active)animate('title',title,[{opacity:0,transform:'translateY(8px) scale(.94)'},{opacity:1,transform:'translateY(0) scale(1)',offset:.15},{opacity:1,offset:.65},{opacity:0,transform:'translateY(-4px) scale(1.04)'}],1500);
      if(active)animate('entry',$('overtime-entry'),[{opacity:0},{opacity:.7,offset:.18},{opacity:0}],700);
    }
    if(active&&visuals.some(e=>e.type==='overtimePulse'))animate('pulse',$('overtime-pulse'),[{opacity:.55},{opacity:0}],450);
    title.style.opacity=active&&reduced&&state.tick-state.config.battleSeconds*10<15?'1':'0';
    for(const [name,animation]of overtimeMotions){
      if(!active||reduced){animation.cancel();overtimeMotions.delete(name);continue;}
      const rate=running?speed:0;if(animation.playbackRate!==rate)animation.playbackRate=rate;
    }
  }
  function drawMotion(visuals){
    const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const pending=new Map();
    for(const event of visuals){
      if(!event.target)continue;
      if(!pending.has(event.target))pending.set(event.target,new Map());
      const events=pending.get(event.target),old=events.get(event.type);
      // A mixed HP/shield batch keeps the warmer HP impact.
      if(event.type!=='hit'||!old||old.shieldOnly)events.set(event.type,event);
    }
    state.teams.forEach((team,i)=>team.units.forEach(unit=>{
      const c=cards.get(unit);
      if(reduced||statsMode||unit.hp<=0){for(const animation of c.motions.values())animation.cancel();c.motions.clear();return;}
      const play=(key,el,frames,duration)=>{
        if(!el?.animate)return;c.motions.get(key)?.cancel();
        const animation=el.animate(frames,{duration,easing:'ease-out'});c.motions.set(key,animation);
        animation.onfinish=()=>{if(c.motions.get(key)===animation)c.motions.delete(key);};
      };
      const events=pending.get(unit.battleId)??new Map();
      for(const [type,event] of events){
        if(!['attack','hit','passive','knockdown','heal','shield'].includes(type))continue;
        if(type==='heal'){play('heal',c.healSweep,[{opacity:0,transform:'translateY(55%)'},{opacity:.65,offset:.3},{opacity:0,transform:'translateY(-55%)'}],320);continue;}
        if(type==='shield'){play('shield',c.shieldGlow,[{opacity:0,transform:'scale(.96)'},{opacity:.65,transform:'scale(1.01)',offset:.2},{opacity:0,transform:'scale(1.12)'}],360);continue;}
        if(type==='attack'&&(events.has('knockdown')||c.motions.has('knockdown')))continue;
        if(type==='knockdown'){c.motions.get('attack')?.cancel();c.motions.delete('attack');}
        const el=type==='passive'?c.halo:c.root;if(!el.animate)continue;
        const toward=i?14:-14;
        const frames=type==='attack'?[
          {translate:'0 0',offset:0},{translate:'0 '+toward+'px',offset:.23},
          {translate:'0 '+(-toward*.2)+'px',offset:.62},{translate:'0 0',offset:1}
        ]:type==='hit'?[
          {transform:'translateX(0)'},{transform:'translateX(-5px)'},{transform:'translateX(5px)'},
          {transform:'translateX(-3px)'},{transform:'translateX(2px)'},{transform:'translateX(0)'}
        ]:type==='knockdown'?[
          {translate:'0 0'},{translate:'0 9px',offset:.22},{translate:'0 -2px',offset:.65},{translate:'0 0'}
        ]:[{opacity:.85,transform:'scale(.94)'},{opacity:.45,transform:'scale(1.06)',offset:.35},{opacity:0,transform:'scale(1.2)'}];
        play(type,el,frames,type==='passive'?620:type==='attack'?300:type==='knockdown'?360:240);
        if(type==='hit'){
          c.flash.style.background=event.shieldOnly?'#96d9fa55':'#ffe0bc44';
          play('hitFlash',c.flash,[{opacity:0},{opacity:.75,offset:.15},{opacity:0}],180);
        }
        if(type==='knockdown')play('knockdownIcon',c.stagger.el.children[1],[{transform:'scale(1)'},{transform:'scale(1.65)',filter:'brightness(1.7)',offset:.25},{transform:'scale(1)',filter:'brightness(1)'}],360);
      }
      const rate=running||state.done?speed:0;
      for(const animation of c.motions.values())if(animation.playbackRate!==rate)animation.playbackRate=rate;
    }));
  }
  function inspect(unit){
    if(!inspected)resumeAfterDetail=running;
    if(inspected)cards.get(inspected).root.setAttribute('aria-expanded','false');
    inspected=unit;detailTrigger=cards.get(unit).root;detailTrigger.setAttribute('aria-expanded','true');
    running=false;bank=0;hideSkill();
    $('character-detail').hidden=false;

    const stats=[['職業',unit.job],['種族 / 類型',unit.race+' / '+unit.affinity],['星等 / 階級',unit.stars+' 星 / '+unit.rarity],['血量',unit.hp+' / '+unit.maxHp],['護盾',unit.shield],['攻擊力',Effects.attackValue(unit,'damage')],['治療力',Effects.attackValue(unit,'heal')],['護盾力',Effects.attackValue(unit,'shield')],['攻擊距離',(unit.attackRange??1)+' 格'],['失衡',unit.posture+' / '+state.config.postureLimit],['失衡效果加成',unit.outputBonuses?.posture??0],['狀態秒數加成',unit.statusDurationBonus??0],['狀態層數加成',unit.statusAmountBonus??0],['倒地時間',unit.weakDuration+' 秒'],['行動間隔',unit.cooldown+' 秒'],['移動距離',unit.moveDistance+' 格']];
    const statuses=unit.statuses.map(x=>({kind:x.kind,label:Statuses.label(x,state.tick)}));
    if(unit.hp===0)statuses.unshift('已倒下，無法行動');
    else if(unit.weakUntil>state.tick)statuses.unshift('失衡倒地 · 剩餘 '+((unit.weakUntil-state.tick)/10).toFixed(1)+' 秒');
    CharacterDetails.render(document,unit,{stats,statuses});
    if(!$('character-detail').open)$('character-detail').showModal();
    $('battle-message').textContent=state.done?$('battle-message').textContent:'正在查看 '+unit.name+' · 關閉後手動繼續';
    draw();$('character-detail').focus({preventScroll:true});
  }
  function closeDetail(restore=true){
    if(inspected)cards.get(inspected)?.root.setAttribute('aria-expanded','false');
    const resume=restore&&resumeAfterDetail&&!state.done&&!document.hidden;resumeAfterDetail=false;
    inspected=null;if($('character-detail').open)$('character-detail').close();$('character-detail').hidden=true;
    if(resume){running=true;bank=0;last=performance.now();}
    if(restore&&detailTrigger){detailTrigger.focus({preventScroll:true});if(!state.done)$('battle-message').textContent=state.started?'戰鬥已暫停 · 按右上角繼續':'準備就緒 · 按右上角開始戰鬥';draw();}
    detailTrigger=null;
  }
  function renderEnemySkill(){
    const current=state.teams[1].skill,skill=current?.enabled?current:state.enemySkillDefinition,control=$('enemy-skill-control');
    control.hidden=!state.activeSkillsEnabled||!skill;
    if(control.hidden){hideEnemySkill();return;}
    const available=current?.enabled===true;
    $('enemy-cast').classList.toggle('skill-unavailable',!available);
    const remaining=Math.max(0,(state.teams[1].skillReady-state.tick)/10);
    $('enemy-skill-title').textContent=skill.name+' · 冷卻 '+skill.cooldown+' 秒';
    $('enemy-skill-description').textContent=skill.description||skill.effects.map(describeEffect).join('\n');
    $('enemy-skill-state').textContent=!state.teams[1].units.some(u=>u.hp>0)?'敵方沒有存活的出戰角色，無法施放':!available?'不符合目前敵方編隊條件，無法施放':state.done?'戰鬥已結束':!state.started?'開戰後開始充能':remaining>0?remaining.toFixed(1)+' 秒後就緒':'就緒後自動施放';
    $('enemy-cast').setAttribute('aria-label','查看敵方極式：'+skill.name);
    $('enemy-skill-progress').style.strokeDashoffset=String(!available?100:skill.cooldown?100*Math.min(1,remaining/skill.cooldown):100);
    const art=$('enemy-skill-art'),url=skill.imagePath||'';
    if(art.getAttribute('data-path')!==url){art.setAttribute('data-path',url);art.hidden=true;$('enemy-skill-fallback').hidden=false;art.onload=()=>{art.hidden=false;$('enemy-skill-fallback').hidden=true;};art.onerror=()=>{art.hidden=true;$('enemy-skill-fallback').hidden=false;};if(url)art.src=url;else art.removeAttribute('src');}
  }
  function showEnemySkill(){if(!$('enemy-skill-control').hidden){$('enemy-skill-tooltip').hidden=false;$('enemy-cast').setAttribute('aria-expanded','true');}}
  function hideEnemySkill(){$('enemy-skill-tooltip').hidden=true;$('enemy-cast').setAttribute('aria-expanded','false');}
  $('enemy-cast').addEventListener('pointerenter',showEnemySkill);
  $('enemy-skill-control').addEventListener('pointerleave',hideEnemySkill);
  $('enemy-cast').addEventListener('focus',showEnemySkill);
  $('enemy-cast').addEventListener('blur',hideEnemySkill);
  $('enemy-cast').addEventListener('click',showEnemySkill);
  document.addEventListener('pointerdown',e=>{if(!$('enemy-skill-control').contains(e.target))hideEnemySkill();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hideEnemySkill();});
  function showSkill(){if(campaign&&!state.teams[0].skill.enabled)return; $('skill-tooltip').hidden=false;$('skill-help').setAttribute('aria-expanded','true'); }
  function hideSkill(){skillPinned=false;$('skill-tooltip').hidden=true;$('skill-help').setAttribute('aria-expanded','false');}
  $('character-detail').addEventListener('cancel',event=>{event.preventDefault();closeDetail();});
  DialogDismiss.bind($('character-detail'),()=>closeDetail());
  $('skill-control').addEventListener('pointerenter',()=>{if(!campaign)showSkill();});
  $('cast-hover').addEventListener('pointerenter',showSkill);$('cast-hover').addEventListener('pointerleave',hideSkill);$('cast-hover').addEventListener('focus',showSkill);$('cast-hover').addEventListener('blur',hideSkill);
  $('skill-control').addEventListener('pointerleave',()=>{if(!skillPinned)hideSkill();});
  $('cast').addEventListener('focus',showSkill);
  $('cast').addEventListener('blur',()=>{if(!skillPinned)hideSkill();});
  $('skill-help').addEventListener('click',()=>{if(skillPinned)hideSkill();else{skillPinned=true;showSkill();}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){hideSkill();if(inspected){e.preventDefault();closeDetail();}}});
  $('play').addEventListener('click',()=>{
    audio?.unlock();
    if(state.done&&!resultAcknowledged)return;
    if(state.done&&campaign){parent.postMessage({type:'minimajo-journey-return',token:campaign},'*');return;}
    if(state.done||state.blocked||!previewReady||inspected||preparing||repositionPending||battleDrag)return;running=!running;state.started=true;last=performance.now();notifyPreview();
    $('battle-message').textContent=running?'命運流轉。選擇施放契約的時機。':'戰鬥已暫停。';draw();
  });
  $('battle-stats').addEventListener('click',()=>{if(!state.done||!resultAcknowledged||![0,'draw'].includes(state.winner))return;closeDetail(false);statsMode=!statsMode;draw();});
  $('reset').addEventListener('click',()=>{if(!campaign)reset();});
  $('battle-help-open')?.addEventListener('click',()=>{
    if(!running)return;
    running=false;bank=0;draw();
  });
  $('speed').addEventListener('click',()=>{speed=speed===1?2:1;$('speed-label').textContent=speed+'× »';$('speed').setAttribute('aria-label','切換戰鬥速度，目前 '+speed+' 倍');});
  $('auto-cast').addEventListener('click',()=>{
    audio?.unlock();
    autoCast=!autoCast;
    $('auto-cast-label').textContent=autoCast?'自動':'手動';
    $('auto-cast').setAttribute('aria-pressed',String(autoCast));
    $('auto-cast').setAttribute('aria-label','極式模式：'+(autoCast?'自動，點擊切換為手動':'手動，點擊切換為自動'));
    if(autoCast)castSkill();draw();
  });
  function castSkill(){
    if(!running||document.hidden||!Battle.cast(state,0))return false;
    readyAnnounced=false;readyMotion?.cancel();readyMotion=null;
    audio?.play('ultimate');
    const field=document.querySelector('.battlefield');field.classList.remove('casting');void field.offsetWidth;field.classList.add('casting');
    $('battle-message').textContent=state.teams[0].skill.name+' · 契約已釋放';return true;
  }
  $('cast').addEventListener('click',()=>{audio?.unlock();if(castSkill())draw(true);});
  $('battle-sound').addEventListener('click',()=>{
    if(!audio)return;audio.setEnabled(!audio.enabled);
    $('battle-sound-label').textContent=audio.enabled?'音效':'靜音';
    $('battle-sound').setAttribute('aria-pressed',String(audio.enabled));
    $('battle-sound').setAttribute('aria-label',audio.enabled?'音效已開啟，點擊靜音':'音效已關閉，點擊開啟');
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)audio?.stop();
    if(document.hidden&&running){running=false;$('battle-message').textContent='離開畫面，戰鬥已自動暫停。';draw();}last=performance.now();bank=0;
  });
  globalThis.addEventListener('resize',()=>{
    clearExits();
    for(const c of cards.values()){c.motions.get('relocate')?.cancel();c.motions.delete('relocate');c.root.style.zIndex='';}
  });
  function frame(now){
    if(running&&!document.hidden){
      bank+=Math.min(now-last,100)*speed;
      let advanced=autoCast&&castSkill();
      if(Battle.cast(state,1))advanced=true;
      while(bank>=100&&running){
        bank-=100;Battle.step(state);advanced=true;
        if(autoCast&&!state.done)castSkill();
        if(!state.done)Battle.cast(state,1);
        if(state.done)running=false;
      }
      if(advanced)draw(true);
    }
    last=now;requestAnimationFrame(frame);
  }
  function renderSkillArt(skill){
    const image=$('skill-art'),fallback=$('skill-art-fallback'),path=skill.imagePath&&SkillDB.validImagePath(skill.imagePath)?skill.imagePath:'';
    if(image._skillPath===path)return;image._skillPath=path;image.hidden=true;fallback.hidden=false;
    image.onload=()=>{image.hidden=!image._skillPath;fallback.hidden=!!image._skillPath;};
    image.onerror=()=>{image.hidden=true;fallback.hidden=false;};
    if(path)image.src=path.split('/').map(encodeURIComponent).join('/');
  }
  function describeEffect(effect){return Effects.describe(effect);}
  function clearBattleDrag(){
    const drag=battleDrag;battleDrag=null;
    if(drag){if(drag.moved)suppressInspectUntil=Date.now()+400;drag.ghost?.remove();drag.root.classList.remove('battle-dragging');try{if(drag.root.hasPointerCapture?.(drag.pointer))drag.root.releasePointerCapture(drag.pointer);}catch{}}
    for(const el of document.querySelectorAll('.battle-drop-target'))el.classList.remove('battle-drop-target');
  }
  function dropSlot(drag,x,y){
    const board=$(drag.team?'enemy-units':'ally-units'),rect=board.getBoundingClientRect();
    if(x<rect.left||x>=rect.right||y<rect.top||y>rect.bottom)return null;
    const raw=Math.floor((x-rect.left)/rect.width*10),slot=raw-drag.offset;
    return slot>=0&&slot<10?slot:null;
  }
  function beginBattleDrag(event,root,unit){
    if(event.button!==0||state.started||state.done||preparing||repositionPending||inspected||!previewReady)return;
    const team=state.teams.findIndex(t=>t.units.includes(unit));if(!repositionTeams.includes(team))return;
    clearBattleDrag();const rect=root.getBoundingClientRect(),offset=Math.max(0,Math.min(unit.space-1,Math.floor((event.clientX-rect.left)/rect.width*unit.space)));
    battleDrag={root,team,from:unit.slot,offset,pointer:event.pointerId,x:event.clientX,y:event.clientY,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top,width:rect.width,height:rect.height,moved:false};
    root.setPointerCapture?.(event.pointerId);$('play').disabled=true;
  }
  document.addEventListener('pointermove',event=>{
    const drag=battleDrag;if(!drag||event.pointerId!==drag.pointer)return;
    if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<8&&!drag.moved)return;
    drag.moved=true;event.preventDefault();drag.root.classList.add('battle-dragging');
    if(!drag.ghost){
      const ghost=drag.root.cloneNode(true);ghost.classList.remove('battle-dragging','prebattle-draggable','battle-drop-target');ghost.classList.add('battle-drag-ghost');
      ghost.removeAttribute('data-battle-id');ghost.removeAttribute('id');ghost.removeAttribute('role');ghost.removeAttribute('tabindex');ghost.removeAttribute('aria-controls');ghost.removeAttribute('aria-expanded');
      ghost.setAttribute('aria-hidden','true');ghost.setAttribute('popover','manual');ghost.inert=true;
      for(const child of ghost.querySelectorAll('[id],[tabindex]')){child.removeAttribute('id');child.removeAttribute('tabindex');}
      // Match inherited board scale/skin while escaping the scrolling viewport.
      const style=getComputedStyle(drag.root);for(const key of style)if(key.startsWith('--'))ghost.style.setProperty(key,style.getPropertyValue(key));
      ghost.style.width=drag.width+'px';ghost.style.height=drag.height+'px';
      ghost.style.left=(event.clientX-drag.offsetX)+'px';ghost.style.top=(event.clientY-drag.offsetY)+'px';
      document.body.append(ghost);drag.ghost=ghost;ghost.showPopover?.();
    }
    drag.ghost.style.left=(event.clientX-drag.offsetX)+'px';drag.ghost.style.top=(event.clientY-drag.offsetY)+'px';
    for(const el of document.querySelectorAll('.battle-drop-target'))el.classList.remove('battle-drop-target');
    const slot=dropSlot(drag,event.clientX,event.clientY);if(slot===null)return;
    const board=$(drag.team?'enemy-units':'ally-units');for(const el of board.children){const start=Number(el.style.gridColumn.split(' ')[0])-1,span=Number(el.style.gridColumn.match(/span (\d+)/)?.[1]??1);if(slot>=start&&slot<start+span)el.classList.add('battle-drop-target');}
  },{passive:false});
  document.addEventListener('pointerup',event=>{
    const drag=battleDrag;if(!drag||event.pointerId!==drag.pointer)return;
    const slot=dropSlot(drag,event.clientX,event.clientY),moved=drag.moved;clearBattleDrag();
    if(!moved){draw();return;}suppressInspectUntil=Date.now()+400;
    if(slot===null||slot===drag.from||state.started||state.done){draw();return;}
    if(!preview||parent===globalThis){
      try{const boards=(configuredLoadouts??state.teams.map(t=>t.items)).map(a=>a.slice());boards[drag.team]=Expedition.reposition(boards[drag.team],drag.from,slot);configuredLoadouts=boards;reset();}catch(error){draw();$('battle-message').textContent=error.message;}return;
    }
    const id=++repositionSerial;repositionPending={id,token:campaign};draw();
    parent.postMessage({type:'minimajo-reposition',requestId:id,token:campaign,team:drag.team,from:drag.from,to:slot},'*');
    setTimeout(()=>{if(repositionPending?.id===id){repositionPending=null;draw();$('battle-message').textContent='站位更新逾時，請重新進入戰鬥。';}},5000);
  });
  document.addEventListener('pointercancel',()=>{if(battleDrag){clearBattleDrag();draw();}});
  document.addEventListener('lostpointercapture',()=>{if(battleDrag){clearBattleDrag();draw();}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&battleDrag){const moved=battleDrag.moved;clearBattleDrag();if(moved)suppressInspectUntil=Date.now()+400;draw();}});
  globalThis.addEventListener('resize',()=>{if(battleDrag){clearBattleDrag();draw();}});
  globalThis.addEventListener('blur',()=>{if(battleDrag){clearBattleDrag();draw();}});
  function requestPreparation(){
    if(!campaign)return;
    const allowed=!state.started&&!state.done;
    if(allowed){preparing=true;draw();}
    parent.postMessage({type:'minimajo-prepare-ready',token:campaign,allowed},'*');
  }
  $('battle-gear').addEventListener('click',requestPreparation);
  if(preview){
    document.body.classList.add('preview-mode');
    globalThis.addEventListener('message',event=>{
      if(event.source!==parent)return;
      if(event.data?.type==='minimajo-request-ready'){parent.postMessage({type:'minimajo-preview-ready'},'*');return;}
      if(event.data?.type==='minimajo-pause'){if(running){running=false;bank=0;draw();}return;}
      if(event.data?.type==='minimajo-focus-return'){if(campaign&&state.done)$('play').focus();return;}
      if(event.data?.type==='minimajo-prepare'){
       if(!campaign||event.data.token!==campaign)return;
       requestPreparation();return;
      }
      if(event.data?.type==='minimajo-reposition-error'){
        if(repositionPending?.id===event.data.requestId&&repositionPending.token===event.data.token){repositionPending=null;draw();$('battle-message').textContent=event.data.message||'站位調整失敗。';}return;
      }
      if(event.data?.type!=='minimajo-preview')return;
      // A late iframe ready/load handshake may repeat the same campaign payload.
      // An accepted encounter is unchanged unless preparation explicitly refreshes it.
      if(previewReady&&!preparing&&event.data.campaign&&event.data.token===campaign)return;
      try{
        const data=event.data;if(data.statusLibrary)Statuses.configure(data.statusLibrary);
        if(!Array.isArray(data.loadouts)||data.loadouts.length!==2||data.loadouts.some(a=>!Array.isArray(a)||a.length!==10))throw Error('需要雙方十格編隊');
        const clean=data.loadouts.map(a=>a.map(u=>u?{...ItemDB.runtime(u),laws:Laws.validate(u.laws??[],{allowDuplicates:true})}:null));
        const cleanConfig=GameConfig.load(data.config??GameConfig.defaults,[]);
        const cleanSkills=SkillDB.validate({version:1,skills:data.skills}).skills;
        const cleanEnemySkill=data.enemySkill==null?null:SkillDB.validate({version:1,skills:[data.enemySkill]}).skills[0];
        if(!Array.isArray(data.limits)||data.limits.length!==2||data.limits.some(n=>!Number.isInteger(n)||n<1||n>10))throw Error('空間上限需為 1～10');
        if(data.activeSkillsEnabled!==undefined&&typeof data.activeSkillsEnabled!=='boolean')throw Error('極式開關無效');
        if(data.allySkillsEnabled!==undefined&&typeof data.allySkillsEnabled!=='boolean')throw Error('我方極式開關無效');
        const editable=data.repositionTeams??(data.campaign?[0]:[0,1]);
        if(!Array.isArray(editable)||editable.some(i=>i!==0&&i!==1))throw Error('戰前可編輯陣營無效');
        if(data.campaign){
          if(typeof data.token!=='string')throw Error('探索戰鬥資料無效');
        }
        campaign=data.campaign?data.token:null;$('reset').hidden=!!campaign;
        config=cleanConfig;configuredLoadouts=clean;skills=cleanSkills;enemySkill=cleanEnemySkill;limits=data.limits;activeSkillsEnabled=data.activeSkillsEnabled!==false;allySkillsEnabled=data.allySkillsEnabled!==false;repositionTeams=editable;previewReady=true;reset();
      }catch(error){running=false;previewReady=false;draw();$('battle-message').textContent='編隊資料無效：'+error.message;}
    });
  }
  $('battle-start-dock').append($('play'));
  $('battle-bottom-controls').append($('battle-actions'));
  reset();requestAnimationFrame(frame);
  if(preview)parent.postMessage({type:'minimajo-preview-ready'},'*');
})();
