(() => {
 'use strict';
 const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
 const svg=(tag,attrs={})=>{const el=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));return el;};
 let state=HexMap.explore(HexMap.generate()),selected=state.current;
 let decaySettings=HexMap.validateDecay();
 const descriptions={fragile:'離開後地板崩塌，無法再次踏入；不會產生獎勵。',empty:'可自由通行的空地，沒有事件或養成獎勵，移動仍計入回合。',entrance:'旅程的起點。選擇相鄰格，開始探索。',battle:'工坊僅模擬戰鬥完成；正式旅程會開啟實際戰鬥。',elite:'工坊僅模擬菁英戰鬥完成；正式旅程依設定抽選菁英敵隊。',rest:'抵達後自動提升整備預覽的回響等級一級，隨即消耗。',shop:'抵達時開啟商店；關閉視窗後事件消耗，不能再次開啟。',goal:'旅程的目的地。位置始終可見，抵達即完成本次探索。'};
 function center(cell){return {x:Math.sqrt(3)*36*(cell.q+cell.r/2),y:54*cell.r};}
 function redraw(focusId){
  const all=$('map-reveal-all').checked,views=Object.keys(state.map.cells).map(id=>HexMap.view(state,id,all));
  const canvas=$('hex-map-svg');canvas.replaceChildren();
  const extent=Math.sqrt(3)*36*state.map.radius+48,height=54*state.map.radius+48;canvas.setAttribute('viewBox',[-extent,-height,extent*2,height*2].join(' '));
  const trail=svg('g',{'aria-hidden':'true',class:'map-trail'});
  for(let i=1;i<state.path.length;i++){const a=center(state.map.cells[state.path[i-1]]),b=center(state.map.cells[state.path[i]]);trail.append(svg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y}));}canvas.append(trail);
  let focusNode;
  for(const v of views){
   const {x,y}=center(v),info=v.type?HexMap.types[v.type]:null;
   const group=svg('g',{transform:`translate(${x} ${y})`,class:['hex-cell',v.visible?'known':'fog',v.type||'',v.current?'current':'',v.reachable?'reachable':'',v.cleared?'cleared':'',v.collapsed?'collapsed':'',v.id===selected?'selected':''].join(' '),role:'button',tabindex:v.id===selected?'0':'-1','aria-label':`座標 ${v.q}, ${v.r}，${info?.name||'迷霧，內容未知'}${v.current?'，目前位置':v.reachable?'，可前往':''}${v.collapsed?'，已崩塌，無法通行':v.cleared?'，已完成':''}`,'aria-pressed':String(v.id===selected)});
   const points=Array.from({length:6},(_,i)=>{const angle=(60*i-30)*Math.PI/180;return `${33*Math.cos(angle)},${33*Math.sin(angle)}`;}).join(' ');
   group.append(svg('polygon',{points}));
   const reward=!v.cleared?HexMap.rewardAt(state,v.id,decaySettings):null;if(reward){const title=svg('title');title.textContent=HexMap.rewardText(reward);group.append(title);group.setAttribute('aria-label',group.getAttribute('aria-label')+'，'+title.textContent);const badge=svg('text',{y:-16,class:'hex-reward','aria-hidden':'true'});badge.textContent=reward.label+' '+reward.moneyPercent+'%';group.append(badge);}
   const icon=svg('text',{y:2,class:'hex-icon','aria-hidden':'true'});icon.textContent=v.collapsed?'×':v.current?'◉':v.cleared&&['battle','elite','shop','rest'].includes(v.type)?'✧':info?.icon||'·';group.append(icon);
   const label=svg('text',{y:19,class:'hex-label','aria-hidden':'true'});label.textContent=v.current?'你在這裡':v.id===state.map.goal?'終點':info?.name||'';group.append(label);
   if(v.cleared&&!v.current&&!v.collapsed){const mark=svg('text',{x:18,y:-13,class:'hex-cleared','aria-hidden':'true'});mark.textContent='✓';group.append(mark);}
   const choose=()=>{selected=v.id;if(!travel(v.id))redraw(v.id);};group.addEventListener('click',choose);
   group.addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' '){event.preventDefault();choose();return;}
    const step={ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowUp:[0,-1],ArrowDown:[0,1],Home:[-1,1],End:[1,-1]}[event.key];
    if(step){event.preventDefault();const id=HexMap.key(v.q+step[0],v.r+step[1]);if(state.map.cells[id]){selected=id;redraw(id);}}
   });
   canvas.append(group);if(v.id===focusId)focusNode=group;
  }
  $('map-alarm-level').textContent=decaySettings.enabled?'獎勵衰減已啟用':'獎勵衰減已關閉';
  $('map-alarm-power').textContent=HexMap.rewardText(HexMap.rewardAt(state,selected,decaySettings));
  $('map-alarm-progress').textContent='移動 '+state.steps+' 回合 · 揭露後開始計時，進入後鎖定';
  const counts={};Object.values(state.map.cells).forEach(c=>counts[c.type]=(counts[c.type]||0)+1);
  $('map-applied-rules').textContent='本圖配置：戰鬥 '+(counts.battle||0)+' / 菁英 '+(counts.elite||0)+' / 營地 '+(counts.rest||0)+' / 商店 '+(counts.shop||0)+' / 脆弱地板 '+(counts.fragile||0)+' / 空地 '+(counts.empty||0);
  $('map-steps').textContent=String(state.steps);$('map-explored').textContent=state.revealed.size+' / '+views.length;
  $('map-current').textContent=state.current;$('map-preview-flag').hidden=!all;
  $('map-overview').textContent=`半徑 ${state.map.radius} · ${views.length} 格 · 入口 ${state.map.entrance} → 終點 ${state.map.goal}`;
  $('map-status').textContent=state.complete?'已抵達終點！可重置探索或重新生成地圖。':state.pending?'已抵達'+HexMap.types[state.map.cells[state.pending].type].name+'，完成此事件後可繼續。':'點擊高亮相鄰格即可前進，脆弱地板離開後無法回頭。';
  const v=HexMap.view(state,selected,all),type=v.type;
  $('map-node-title').textContent=v.collapsed?'崩塌的地板':type?HexMap.types[type].name:'未知節點';$('map-node-coordinate').textContent='座標 '+selected;
  $('map-node-description').textContent=v.collapsed?'地板已崩塌，無法再次進入。':v.cleared&&['battle','elite','shop','rest'].includes(type)?'此事件已消耗，現在只能通行。':type?descriptions[type]:'迷霧遮住此處的內容。走近至相鄰格後才會揭露。';
  $('map-node-state').textContent=v.collapsed?'已崩塌，禁止通行':v.current?'目前所在格':v.cleared?'已消耗，可通行':v.reachable?'相鄰格，可前往':'先移動到鄰近位置';
  $('map-resolve').hidden=!state.pending||state.map.cells[state.pending]?.type==='shop';$('map-resolve').textContent=state.pending?({battle:'模擬戰鬥勝利',elite:'模擬菁英戰鬥勝利',rest:'完成休息預覽',shop:'離開商店預覽'}[state.map.cells[state.pending].type]):'完成事件';
  $('map-event-note').hidden=!state.pending;$('map-event-note').textContent=state.pending?'目前事件：'+HexMap.types[state.map.cells[state.pending].type].name+'。工坊只模擬事件完成。':'';
  if(focusNode)focusNode.focus({preventScroll:true});
 }
 function saveSettings(){
  if(typeof localStorage==='undefined')return;
  try{localStorage.setItem('minimajo.map.v1',JSON.stringify({version:1,radius:state.map.radius,seed:state.map.seed,rules:state.map.rules,rewardDecay:decaySettings}));$('map-error').textContent='已儲存；下次從首頁開始遊戲會套用此設定。';}catch{$('map-error').textContent='無法儲存地圖設定；目前僅套用在預覽。';}
 }
 function readRules(){return {quotas:Object.fromEntries(HexMap.quotaTypes.map(type=>[type,$('map-count-'+type).value===''?NaN:Number($('map-count-'+type).value)])),eliteSpacing:Number($('map-spacing-elite').value),restSpacing:Number($('map-spacing-rest').value),shopSpacing:Number($('map-spacing-shop').value),supplySpacing:Number($('map-spacing-supply').value),safeRadius:Number($('map-safe-radius').value)};}
 function quotaHint(){const radius=Number($('map-radius').value),available=3*radius*(radius+1)-1,total=Object.values(readRules().quotas).reduce((a,b)=>a+b,0);$('map-quota-hint').textContent=!Number.isFinite(total)?'請填入有效配額，草稿尚未套用。':'草稿：事件 '+total+' 格 / 可用 '+available+' 格；其餘 '+Math.max(0,available-total)+' 格為空地（入口／終點另計）。';}
 function fillDefaults(){try{const radius=Number($('map-radius').value);if(!Number.isInteger(radius)||radius<2||radius>6)throw Error('請先填入 2～6 的地圖半徑。');const rules=HexMap.defaults(radius);for(const type of HexMap.quotaTypes)$('map-count-'+type).value=rules.quotas[type];quotaHint();$('map-error').textContent='';}catch(error){$('map-error').textContent=error.message;}}
 $('map-defaults').addEventListener('click',fillDefaults);
 $('map-radius').addEventListener('change',fillDefaults);
 for(const type of HexMap.quotaTypes)$('map-count-'+type).addEventListener('input',quotaHint);
 function applyDecay(){try{const next=HexMap.validateDecay({enabled:$('map-decay-enabled').checked,stages:[...$('map-decay-stages').children].map(row=>row.read())});decaySettings=next;state.rewardDecay=next;saveSettings();redraw();}catch(error){$('map-error').textContent=error.message;}}
 function fillDecay(){
  $('map-decay-enabled').checked=decaySettings.enabled;$('map-decay-stages').replaceChildren();
  decaySettings.stages.forEach((stage,i)=>{
   const row=document.createElement('div'),after=document.createElement('input'),tier=document.createElement('select'),remove=document.createElement('button');row.className='map-rule-grid';
   Object.assign(after,{type:'number',min:1,max:999,step:1,value:stage.after});after.setAttribute('aria-label','階段 '+(i+1)+' 間隔回合');
   for(const [key,value] of Object.entries(HexMap.rewardTiers)){const option=document.createElement('option');option.value=key;option.textContent=value.label;tier.append(option);}tier.value=stage.tier;tier.setAttribute('aria-label','階段 '+(i+1)+' 獎勵階級');
   const label=document.createElement('label');label.textContent='再經過幾回合';label.append(after);const target=document.createElement('label');target.textContent='獎勵降為';target.append(tier);
   remove.type='button';remove.textContent='移除此階段';remove.addEventListener('click',()=>{decaySettings=HexMap.validateDecay({enabled:decaySettings.enabled,stages:decaySettings.stages.filter((x,index)=>index!==i)});state.rewardDecay=decaySettings;fillDecay();saveSettings();redraw();});
   after.addEventListener('change',applyDecay);tier.addEventListener('change',applyDecay);row.read=()=>({after:after.value===''?NaN:Number(after.value),tier:tier.value});row.append(label,target,remove);$('map-decay-stages').append(row);
  });
 }
 $('map-decay-enabled').addEventListener('change',applyDecay);
 $('map-decay-add').addEventListener('click',()=>{if(decaySettings.stages.length>=10)return;decaySettings.stages.push({after:1,tier:decaySettings.stages.at(-1)?.tier??'high'});fillDecay();applyDecay();});
 function regenerate(){try{const map=HexMap.generate(Number($('map-radius').value),$('map-seed').value,readRules());state=HexMap.explore(map,decaySettings);globalThis.ExpeditionUI?.reset();selected=state.current;saveSettings();redraw();}catch(error){$('map-error').textContent=error.message;}}
 $('map-generate').addEventListener('click',regenerate);
 $('map-reset').addEventListener('click',()=>{state=HexMap.explore(state.map,decaySettings);globalThis.ExpeditionUI?.reset();selected=state.current;redraw();});
 $('map-new-seed').addEventListener('click',()=>{$('map-seed').value='MOON-'+Math.random().toString(36).slice(2,9).toUpperCase();regenerate();});
 $('map-reveal-all').addEventListener('change',()=>redraw());
 function travel(id){
  if(!HexMap.move(state,id))return false;
  const type=state.map.cells[state.pending]?.type;
  if(type==='rest'){HexMap.resolve(state);globalThis.ExpeditionUI?.upgradeEcho?.();}
  redraw(id);
  if(type==='shop')globalThis.ExpeditionUI?.open('shop',state.current);
  return true;
 }
 $('expedition-dialog').addEventListener('close',()=>{
  if($('expedition-dialog').getAttribute('data-mode')==='shop'&&state.map.cells[state.pending]?.type==='shop')HexMap.resolve(state);
  redraw();
 });
 $('map-resolve').addEventListener('click',()=>{const type=state.map.cells[state.pending]?.type;if(HexMap.resolve(state)){if(type==='rest')globalThis.ExpeditionUI?.upgradeEcho?.();selected=state.current;redraw();$('hex-map-svg').focus();}});
 $('map-gear').addEventListener('click',()=>globalThis.ExpeditionUI?.open('gear'));
 $('map-shop-sample').addEventListener('click',()=>globalThis.ExpeditionUI?.open('shop','sample'));
 try{if(typeof localStorage!=='undefined'){
  const saved=HexMap.read(localStorage);if(saved){
   if(saved.version!==1)throw Error('地圖存檔版本無效');
   const map=HexMap.generate(saved.radius,saved.seed,saved.rules);decaySettings=HexMap.validateDecay(saved.rewardDecay);state=HexMap.explore(map,decaySettings);selected=state.current;
   $('map-radius').value=map.radius;$('map-seed').value=map.seed;
   for(const type of HexMap.quotaTypes)$('map-count-'+type).value=map.rules.quotas[type];
   for(const type of ['elite','rest','shop','supply'])$('map-spacing-'+type).value=map.rules[type+'Spacing'];$('map-safe-radius').value=map.rules.safeRadius;

  }
 }}catch(error){$('map-error').textContent='地圖設定讀取失敗：'+error.message;}
 fillDecay();state.rewardDecay=decaySettings;quotaHint();redraw();
})();
