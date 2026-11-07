(() => {
 function startJourneyUI(){
 'use strict';
 const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
 const svg=(tag,attrs={})=>{const el=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));return el;};
 const artRoot='assets/ui/map/v1/';
 // Source canvas and visible bounds. Keep the original transparent PNGs intact.
 const floors={
  'normal-walkable':[1217,1293,82,38,1134,1254],
  'normal-blocked':[1261,1247,116,34,1142,1214],
  'fragile-walkable':[1199,1312,70,38,1130,1272],
  'fragile-collapsed':[1201,1310,62,36,1138,1262]
 };
 const standees={
  battle:['battle',1145,1374,96,72,1048,1270,64],
  elite:['elite',1199,1312,96,40,1100,1186,82],
  goal:['boss',1199,1312,102,40,1094,1194,108],
  rest:['camp',1199,1312,114,58,1082,1194,62],
  shop:['shop',1192,1320,96,56,1082,1242,62]
 };
 function floorArt(cell,camera,clip){
  const kind=cell.collapsed?'fragile-collapsed':cell.type==='fragile'?'fragile-walkable':cell.current||cell.reachable?'normal-walkable':'normal-blocked';
  const [iw,ih,left,top,right,bottom]=floors[kind];
  const sx=53*Math.sqrt(3)/(right-left),sy=106/(bottom-top);
  const art=svg('foreignObject',{width:1,height:1,class:'map-floor-art','aria-hidden':'true','data-floor':kind});
  const surface=document.createElement('div');
  surface.setAttribute('style',`width:${53*Math.sqrt(3)}px;height:106px;transform:${JourneyView.groundTransform(cell,camera)};background:url("${artRoot}tiles/${kind}.png") ${-left*sx}px ${-top*sy}px / ${iw*sx}px ${ih*sy}px no-repeat`);
  art.append(surface);
  const layer=svg('g',{'clip-path':`url(#${clip})`,'pointer-events':'none'});
  layer.append(art);
  return layer;
 }
 function eventArt(type,x,y,scale,reward){
  const [name,iw,ih,left,top,right,bottom,size]=standees[type];
  const width=size*scale,height=width*(bottom-top)/(right-left);
  const art=svg('svg',{x:x-width/2,y:y-height,width,height,viewBox:`${left} ${top} ${right-left} ${bottom-top}`,class:'map-standee','aria-hidden':'true'});
  art.append(svg('image',{href:`assets/ui/map/v2/standees/${name}.png`,width:iw,height:ih,style:`filter:brightness(${.36+.64*(reward?.moneyPercent??100)/100})`}));
  return art;
 }
 const help=$('map-help-dialog'),helpTrigger=$('map-help-open');
 const rewardTip=$('map-reward-tooltip');
 const closeHelp=()=>{if(help.open)help.close();};
 helpTrigger.addEventListener('click',()=>{if(!help.open){help.showModal();helpTrigger.setAttribute('aria-expanded','true');help.focus({preventScroll:true});}});
 help.addEventListener('cancel',event=>{event.preventDefault();closeHelp();});
 help.addEventListener('close',()=>{helpTrigger.setAttribute('aria-expanded','false');helpTrigger.focus({preventScroll:true});});
 DialogDismiss.bind(help,closeHelp);
 const publicRelease=!!document.documentElement?.hasAttribute('data-public-release');
 const dataStorage=globalThis.MiniMajoPublicData?.storage??(publicRelease?{getItem:()=>null}:localStorage);
 const characters=ItemDB.read(dataStorage).items,skills=SkillDB.read(dataStorage).skills;
 let settings=null,enemies=null,run;
 try{if(globalThis.publicDataError||globalThis.statusLibraryError)throw Error(globalThis.publicDataError||globalThis.statusLibraryError);settings=HexMap.read(dataStorage);enemies=EnemyTeams.read(dataStorage);run=Journey.create(characters,skills,undefined,settings,enemies,GameConfig.read(dataStorage),Laws.read(dataStorage).laws,EchoLevels.read(dataStorage));}
 catch(error){$('journey-message').textContent='無法開始旅程：'+error.message+(publicRelease?' 請重新整理；若仍無法遊玩，請稍後再試。':' 請回編輯器修正並儲存設定。');$('journey-gear').disabled=true;$('map-resolve').hidden=true;return;}
 let state=run.map,selected=state.current,payload=null,frameReady=false,battleOpen=false,preparing=false,completedBattleToken=null;
 let angle=0,cameraOrigin=JourneyView.world(state.map.cells[state.current]),moving=false,drag=null;
 ExpeditionUI.bind(run.roster);
 const descriptions={entrance:'旅程的起點。點擊相鄰格開始探索。',empty:'安靜的空地，可自由通過。',fragile:'只能通過一次；離開後地板崩塌，無法再次進入。',battle:'擊敗迷霧守衛，獲得 '+run.config.normalReward+' 金幣及角色三選一。每場戰鬥全員滿血出場。',elite:'依菁英敵隊權重抽選對手，勝利可獲得 '+run.config.eliteReward+' 金幣。',shop:'招募角色、購買法則，或出售自己的角色。關閉商店後此事件即消耗，無法再次購物。',rest:'抵達時自動免費提升一級回響等級，營地隨即消耗。',goal:'擊敗終點 BOSS 才能完成旅程，勝利獲得 '+run.config.bossReward+' 金幣。'};
 function showRewardTip(text,x,y){
  if(moving||drag)return;
  if(rewardTip.textContent!==text)rewardTip.textContent=text;
  rewardTip.hidden=false;
  const {width,height}=rewardTip.getBoundingClientRect();
  rewardTip.style.left=Math.max(8,x+12+width<=window.innerWidth-8?x+12:x-width-12)+'px';
  rewardTip.style.top=Math.max(8,y+12+height<=window.innerHeight-8?y+12:y-height-12)+'px';
 }
 function hideRewardTip(){rewardTip.hidden=true;}
 function redraw(focusId){
  hideRewardTip();
  const visibleIds=state.revealed;
  if(!visibleIds.has(selected))selected=state.current;
  const camera={...JourneyView.camera(state.map,state.current,angle),origin:cameraOrigin};
  const views=[...visibleIds].map(id=>HexMap.view(state,id)).sort((a,b)=>JourneyView.tile(a,camera).y-JourneyView.tile(b,camera).y);
  const canvas=$('hex-map-svg'),viewWidth=Math.max(800,680*(canvas.clientWidth||800)/(canvas.clientHeight||680)),viewLeft=(800-viewWidth)/2;
  canvas.replaceChildren();canvas.setAttribute('viewBox',`${viewLeft} 0 ${viewWidth} 680`);
  const defs=svg('defs');canvas.append(defs);
  const tiles=[];
  let focusNode;
  for(const v of views){
   const {x,y,points,scale}=JourneyView.tile(v,camera),info=v.type?HexMap.types[v.type]:null;
   if(!points)continue;
   const group=svg('g',{class:['hex-cell',v.visible?'known':'fog',v.type||'',v.current?'current':'',v.reachable?'reachable':'',v.cleared?'cleared':'',v.collapsed?'collapsed':'',v.id===selected?'selected':''].join(' '),role:'button',tabindex:v.id===selected?'0':'-1','aria-label':`座標 ${v.q}, ${v.r}，${info?.name||'迷霧，內容未知'}${v.current?'，目前位置':v.reachable?'，可前往':''}${v.collapsed?'，已崩塌，無法通行':v.cleared?'，已完成':''}`,'aria-pressed':String(v.id===selected)});
   const clipId=`map-floor-${v.q}-${v.r}`;
   const clip=svg('clipPath',{id:clipId});clip.append(svg('polygon',{points}));defs.append(clip);
   group.append(
    svg('polygon',{points,class:'map-floor-depth',transform:`translate(0 ${5*scale})`}),
    svg('polygon',{points,class:'map-floor-base'}),
    floorArt(v,camera,clipId),
    svg('polygon',{points,class:'map-floor-rim'})
   );
   const reward=!v.cleared?HexMap.rewardAt(state,v.id):null;
   if(reward){
    const text='獎勵 - '+reward.label;
    group.setAttribute('aria-label',group.getAttribute('aria-label')+'，'+text);
    group.addEventListener('pointermove',event=>{if(event.pointerType!=='touch')showRewardTip(text,event.clientX,event.clientY);});
    group.addEventListener('pointerleave',hideRewardTip);
    group.addEventListener('focus',()=>{
     const rect=group.getBoundingClientRect();
     showRewardTip(text,rect.left+rect.width/2,rect.bottom);
    });
    group.addEventListener('blur',hideRewardTip);
   }
   if(scale&&!v.cleared&&standees[v.type]){
    group.append(eventArt(v.type,x,y,scale,reward));
   }
   const choose=()=>{if(moving||drag)return;selected=v.id;if(v.current&&state.pending===v.id){arrive();return;}if(!travel(v.id))redraw(v.id);};group.addEventListener('click',choose);
   group.addEventListener('keydown',event=>{
    if(moving)return;
    if(event.key==='Enter'||event.key===' '){event.preventDefault();choose();return;}
    const direction={ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowUp:[0,-1],ArrowDown:[0,1],Home:[-1,-1],End:[1,-1]}[event.key];
    if(direction){event.preventDefault();const candidates=views.filter(c=>{const p=JourneyView.tile(c,camera);return c.id!==v.id&&p.points&&p.x>=0&&p.x<=800&&p.y>=0&&p.y<=680;}).map(c=>{const p=JourneyView.tile(c,camera),dx=p.x-x,dy=p.y-y,dot=dx*direction[0]+dy*direction[1];return {id:c.id,dot,score:dot/Math.hypot(dx,dy)/Math.hypot(...direction)};}).filter(c=>c.dot>0).sort((a,b)=>b.score-a.score||a.dot-b.dot);if(candidates.length){selected=candidates[0].id;redraw(selected);}}
   });
   tiles.push(group);if(v.id===focusId)focusNode=group;
  }

  const frontier=JourneyView.frontier(state.map,visibleIds,camera);
  const fogGradient=svg('radialGradient',{id:'frontier-mist'});
  for(const [offset,opacity] of [['0%',.9],['45%',.68],['75%',.28],['100%',0]])fogGradient.append(svg('stop',{offset,'stop-color':'#78858b','stop-opacity':opacity}));
  const blur=svg('filter',{id:'frontier-soften',x:'-30%',y:'-30%',width:'160%',height:'160%'});blur.append(svg('feGaussianBlur',{stdDeviation:9}));
  const noise=svg('filter',{id:'frontier-cloud',x:'-30%',y:'-50%',width:'160%',height:'200%'});
  noise.append(svg('feTurbulence',{type:'fractalNoise',baseFrequency:'.018 .035',numOctaves:2,seed:8,result:'noise'}),svg('feDisplacementMap',{in:'SourceGraphic',in2:'noise',scale:28,xChannelSelector:'R',yChannelSelector:'G'}),svg('feGaussianBlur',{stdDeviation:3}));
  const fade=svg('linearGradient',{id:'frontier-edge-fade'});
  for(const [offset,color] of [['0%','black'],['12%','white'],['88%','white'],['100%','black']])fade.append(svg('stop',{offset,'stop-color':color}));
  const mask=svg('mask',{id:'frontier-clear',maskUnits:'userSpaceOnUse',x:viewLeft,y:0,width:viewWidth,height:680});mask.append(svg('rect',{x:viewLeft,width:viewWidth,height:680,fill:'url(#frontier-edge-fade)'}));
  const clear=svg('g',{filter:'url(#frontier-soften)'});
  for(const v of views){const p=JourneyView.tile(v,camera).points;if(p)clear.append(svg('polygon',{points:p,fill:'black',stroke:'black','stroke-width':12}));}
  mask.append(clear);defs.append(fogGradient,fade,blur,noise,mask);
  const hints=svg('g',{class:'journey-frontier-edges','aria-hidden':'true','pointer-events':'none'});
  for(const cell of frontier)for(const d of cell.paths)hints.append(svg('path',{d}));
  canvas.append(hints);
  const fog=svg('g',{class:'journey-frontier-fog','aria-hidden':'true','pointer-events':'none',mask:'url(#frontier-clear)'});
  const clouds=svg('g',{filter:'url(#frontier-cloud)'});
  for(const cell of frontier)clouds.append(svg('ellipse',{cx:cell.x,cy:cell.y-12*cell.scale,rx:165*cell.scale,ry:78*cell.scale,fill:'url(#frontier-mist)'}));
  fog.append(clouds);canvas.append(fog,...tiles);
  const player=svg('text',{x:400,y:364,class:'journey-player','aria-hidden':'true'});player.textContent='♢';canvas.append(player);
  $('expedition-progress').textContent=String(run.roster.echoLevel);$('expedition-progress').setAttribute('aria-label','回響等級：'+run.roster.echoLevel);
  $('map-echo-tooltip-level').textContent='回響等級 '+run.roster.echoLevel;
  $('map-echo-tooltip-odds').textContent=EchoLevels.describe(run.roster.echoSettings,run.roster.echoLevel);
  $('expedition-gold').textContent=String(run.roster.gold);$('expedition-gold').setAttribute('aria-label','水晶：'+run.roster.gold);
  $('map-steps').textContent=state.steps;$('map-explored').textContent=state.visited.size+' 格';$('map-current').textContent=state.current;
  $('map-overview').textContent='';$('map-overview').hidden=true;$('map-preview-flag').hidden=true;
  $('map-help-decay').textContent=state.rewardDecay.enabled?'普通與菁英戰鬥從首次揭露後開始計算移動回合，拖得越久，獎勵越少；BOSS不衰減。原地整備與戰鬥時間不計回合，進入敵人格時鎖定獎勵。':'本局未啟用戰利品衰減；各戰鬥維持全階級獎勵。';
  $('map-status').textContent=state.complete?'已抵達終點，旅程完成！':run.rewardChoice?'請先領取戰鬥角色獎勵。':state.pending?'完成目前事件後即可繼續前進。':'點擊相鄰格即可前進；脆弱地板離開後無法回頭。';
  const v=HexMap.view(state,selected),type=v.type;
  $('map-node-title').textContent=v.collapsed?'崩塌的地板':type?HexMap.types[type].name:'未知節點';$('map-node-coordinate').textContent='座標 '+selected;
  const consumed=v.cleared&&['battle','elite','shop','rest'].includes(type);
  $('map-node-description').textContent=v.collapsed?'地板已崩塌，不能再次進入。':consumed?'此事件已消耗，現在只能通行，不會再次觸發。':type?descriptions[type]:'走近此處才會揭露事件。';$('map-node-state').textContent=v.collapsed?'已崩塌，禁止通行':v.current?'目前所在格':consumed?'事件已消耗，可通行':v.reachable?'相鄰格，點擊前進':'先移動到鄰近位置';
  if(!consumed){const reward=HexMap.rewardAt(state,selected);if(reward)$('map-node-description').textContent=HexMap.rewardText(reward);}
  const pendingType=state.map.cells[state.pending]?.type;
  $('map-resolve').hidden=moving||!['battle','elite','goal'].includes(pendingType);$('map-resolve').textContent='重新進入戰鬥';
  $('map-event-note').hidden=!state.pending;$('map-event-note').textContent=state.pending?'目前事件：'+HexMap.types[pendingType].name+' · '+state.pending+' · '+HexMap.rewardText(HexMap.rewardAt(state,state.pending)):'';
  $('journey-new').hidden=!state.complete;
  $('journey-new').disabled=rewardUI.pending();
  if(focusNode)focusNode.focus({preventScroll:true});
 }
 function message(text){$('journey-message').textContent=text;}
 const rewardUI=JourneyRewardUI.create({
  document,
  describeEffect:EffectEditor.describe,
  getReward:()=>run.rewardChoice,
  claim:(token,index)=>Journey.claim(run,token,index),
  skip:token=>Journey.skipReward(run,token),
  openPreparation:()=>ExpeditionUI.open('gear'),
  onComplete(){redraw();focusBattleReturn();},
  onClaim(result){
   redraw();
   focusBattleReturn();
  }
 });
 function sendBattle(){if(frameReady&&payload)$('journey-frame').contentWindow.postMessage(payload,'*');}
 function focusBattleReturn(){
  $('journey-frame').focus();$('journey-frame').contentWindow.postMessage({type:'minimajo-focus-return'},'*');
 }
 function enterBattle(){try{payload=Journey.start(run);completedBattleToken=null;battleOpen=true;$('journey-map').hidden=true;$('journey-battle').hidden=false;$('journey-battle-gear').hidden=false;$('journey-return').hidden=true;$('journey-battle-status').textContent='';sendBattle();$('journey-frame').focus();}catch(e){message(e.message);}}
 function slide(done){
  const from={...cameraOrigin},to=JourneyView.world(state.map.cells[state.current]);
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(reduced||!globalThis.requestAnimationFrame){cameraOrigin=to;redraw();done();return;}
  moving=true;let start;
  const frame=time=>{start??=time;const t=Math.min(1,(time-start)/480);cameraOrigin=JourneyView.blend(from,to,t);if(t===1)moving=false;redraw();if(t<1)requestAnimationFrame(frame);else done();};
  redraw();requestAnimationFrame(frame);
 }
 function arrive(){
  const type=state.map.cells[state.pending]?.type;
  if(type==='shop')ExpeditionUI.open('shop',state.current);
  else if(type==='rest'){
   Journey.resolve(run);
  }else if(['battle','elite','goal'].includes(type))enterBattle();
  redraw();
 }
 function travel(id){
  if(moving||drag||battleOpen||rewardUI.pending()||!Journey.move(run,id))return false;
  message('');slide(arrive);return true;
 }
 const mapCanvas=$('hex-map-svg');
 mapCanvas.addEventListener('contextmenu',e=>e.preventDefault());
 mapCanvas.addEventListener('pointerdown',e=>{if(e.button!==2)return;e.preventDefault();drag={id:e.pointerId,x:e.clientX,angle};mapCanvas.setPointerCapture(e.pointerId);});
 mapCanvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;if(!(e.buttons&2)){drag=null;return;}angle=drag.angle+(e.clientX-drag.x)*.006;redraw();});
 const stopDrag=e=>{if(drag?.id!==e.pointerId)return;drag=null;if(mapCanvas.hasPointerCapture(e.pointerId))mapCanvas.releasePointerCapture(e.pointerId);};
 mapCanvas.addEventListener('pointerup',stopDrag);mapCanvas.addEventListener('pointercancel',stopDrag);mapCanvas.addEventListener('lostpointercapture',()=>{drag=null;});globalThis.addEventListener('blur',()=>{drag=null;});
 $('map-resolve').addEventListener('click',()=>{if(!moving&&['battle','elite','goal'].includes(state.map.cells[state.pending]?.type))enterBattle();});
 $('journey-gear').addEventListener('click',()=>ExpeditionUI.open('gear'));
 $('journey-battle-gear').addEventListener('click',()=>{
  if(!battleOpen||run.encounter?.started)return;
  if(preparing){ExpeditionUI.open('gear');return;}
  $('journey-frame').contentWindow.postMessage({type:'minimajo-prepare',token:run.encounter?.token},'*');
 });
 $('expedition-dialog').addEventListener('close',()=>{
  if(preparing){try{payload=Journey.prepare(run);preparing=false;$('journey-battle-status').textContent='';sendBattle();}catch(error){payload=null;$('journey-battle-status').textContent=error.message;}}

  if($('expedition-dialog').getAttribute('data-mode')==='shop'&&state.map.cells[state.pending]?.type==='shop')Journey.resolve(run);
  redraw();
 });
 $('journey-return').addEventListener('click',()=>{
  if(run.encounter)return;
  if(rewardUI.pending()){rewardUI.show();return;}
  $('journey-frame').contentWindow.postMessage({type:'minimajo-pause'},'*');
  if(run.encounter){Journey.settle(run,{token:run.encounter.token,winner:'draw',hp:run.encounter.allies.filter(Boolean).map(u=>u.maxHp)});}
  payload=null;completedBattleToken=null;battleOpen=false;preparing=false;$('journey-battle').hidden=true;$('journey-map').hidden=false;redraw();$('map-resolve').hidden?$('journey-gear').focus():$('map-resolve').focus();
 });
 globalThis.addEventListener('message',event=>{
  if(event.source!==$('journey-frame').contentWindow)return;
  if(event.data?.type==='minimajo-reposition'){
   const data=event.data;
   try{if(!battleOpen||data.token!==run.encounter?.token||run.encounter.started||data.team!==0||preparing)throw Error('只能在開戰前調整我方站位。');payload=Journey.reposition(run,data.from,data.to);sendBattle();}
   catch(error){$('journey-frame').contentWindow.postMessage({type:'minimajo-reposition-error',requestId:data.requestId,token:data.token,message:error.message},'*');}
   return;
  }
  if(event.data?.type==='minimajo-preview-ready'){frameReady=true;sendBattle();return;}
  if(event.data?.type==='minimajo-journey-return'){
   if(battleOpen&&!run.encounter&&completedBattleToken!==null&&event.data.token===completedBattleToken)$('journey-return').click();
   return;
  }
  if(battleOpen&&event.data?.token===run.encounter?.token){
   if(event.data.type==='minimajo-battle-state'&&event.data.started===true){run.encounter.started=true;$('journey-battle-gear').hidden=true;return;}
   if(event.data.type==='minimajo-prepare-ready'&&event.data.allowed===true&&!run.encounter.started){preparing=true;ExpeditionUI.open('gear');return;}
  }
  if(!battleOpen||event.data?.type!=='minimajo-journey-result')return;
  try{const result=Journey.settle(run,event.data);if(!result)return;completedBattleToken=event.data.token;payload=null;const text=result.winner===0?'':result.winner==='draw'?'平手':'戰鬥敗北，可返回整備後重試。';$('journey-battle-status').textContent=text;$('journey-return').textContent='返回地圖';$('journey-return').hidden=false;$('journey-battle-gear').hidden=true;redraw();if(result.winner===0&&state.complete){location.assign('index.html');return;}if(result.winner===0)rewardUI.show();else if(result.winner===1){selected=state.current;cameraOrigin=JourneyView.world(state.map.cells[state.current]);$('journey-return').click();}}catch(e){$('journey-battle-status').textContent=e.message;}
 });
 $('journey-new').addEventListener('click',()=>{if(!state.complete||rewardUI.pending())return;run=Journey.create(characters,skills,undefined,settings,enemies,GameConfig.read(dataStorage),Laws.read(dataStorage).laws,EchoLevels.read(dataStorage));state=run.map;selected=state.current;angle=0;cameraOrigin=JourneyView.world(state.map.cells[state.current]);ExpeditionUI.bind(run.roster);redraw();});
 const requestReady=()=>$('journey-frame').contentWindow.postMessage({type:'minimajo-request-ready'},'*');
 globalThis.addEventListener('resize',()=>redraw());
 $('journey-frame').addEventListener('load',requestReady);
 requestReady();
 redraw();
 }
 if(globalThis.MiniMajoAssetsReady)globalThis.MiniMajoAssetsReady.then(startJourneyUI);
 else startJourneyUI();
})();
