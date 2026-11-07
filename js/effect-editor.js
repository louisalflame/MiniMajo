(() => {
  const names={damage:'傷害',shield:'護盾',heal:'治療',posture:'增加失衡',restore:'降低失衡',advance:'直接加快時間 N 秒',advanceSkill:'直接加快主動技能時間 N 秒',status:'施加角色狀態',cleanse:'解除 1 個負面狀態',swap:'互換位置',jump:'跳到敵人對面空格'};
  function node(tag,text){const n=document.createElement(tag);if(text)n.textContent=text;return n;}
  function select(values,value){const s=node('select');Object.entries(values).forEach(([v,t])=>{const o=node('option',t);o.value=v;s.append(o);});s.value=value;if(values===Statuses.names)window.addEventListener?.('statuses-changed',()=>{const previous=s.value;s.replaceChildren();Object.entries(Statuses.names).forEach(([v,t])=>{const o=node('option',t);o.value=v;s.append(o);});s.value=previous;s.onchange?.();});return s;}
  function label(title,control){const wrap=node('label',title);control.setAttribute('aria-label',title);wrap.append(control);return wrap;}
  function button(title,run){const b=node('button',title);b.type='button';b.onclick=run;return b;}
  function section(title){const box=node('fieldset');box.className='effect-section';box.append(node('legend',title));return box;}
  function conditionList(initial=[],initialMode='all',change=()=>{},gates=false){
    const box=section(gates?'1．發動條件 cond':'目標條件 targetCond'),mode=select({all:'全部符合',any:'任一符合'},initialMode),rows=node('div');
    box.append(label('條件組合',mode),rows);mode.onchange=change;
    function add(c){
      const card=node('div');card.className='effect-condition';const content=node('div');let read;
      const subject=gates?select({self:'施放者',count:'戰場角色數量'},c.subject??'self'):null;
      function build(v){
        content.replaceChildren();
        if(subject?.value==='count'){
          const side=select(Effects.targetSides,v.side??'enemy'),op=select(Effects.operators,v.op??'gte'),value=node('input');Object.assign(value,{type:'number',min:0,max:10,step:1,required:true,value:v.value??1});
          const nested=conditionList(v.targetCond??[],v.targetCondMode??'all',change);
          content.append(label('計算陣營',side),label('人數比較',op),label('人數',value),nested.node);
          side.onchange=op.onchange=value.oninput=change;read=()=>({subject:'count',side:side.value,op:op.value,value:Number(value.value),targetCond:nested.read(),targetCondMode:nested.mode()});return;
        }
        const field=select(Effects.conditionFields,v.field??'injured'),op=select(Effects.operators,v.op??'eq'),holder=node('div');let value;
        function values(next){
          holder.replaceChildren();const f=field.value;
          if(Effects.targetFields[f])value=select(Object.fromEntries(Effects.targetFields[f].map(x=>[x,String(x)])),String(next??Effects.targetFields[f][0]));
          else if(['injured','down'].includes(f))value=select({true:'是',false:'否'},String(next??true));
          else if(['hasStatus','missingStatus'].includes(f))value=select(Statuses.names,next??Object.keys(Statuses.names)[0]);
          else {value=node('input');Object.assign(value,{type:'number',min:0,max:f==='hpRatio'?100:10000,step:'any',required:true,value:next??0});}
          const numeric=['hp','hpRatio','shield','posture','stars'].includes(f);for(const option of op.options)option.disabled=!numeric&&!['eq','ne'].includes(option.value);if(!numeric&&!['eq','ne'].includes(op.value))op.value='eq';
          holder.append(label('條件值',value));value.onchange=value.oninput=change;
        }
        values(v.value);field.onchange=()=>{values();change();};op.onchange=change;
        content.append(label('條件欄位',field),label('比較方式',op),holder);
        read=()=>({...(subject?{subject:subject.value}:{}),field:field.value,op:op.value,value:['injured','down'].includes(field.value)?value.value==='true':['hp','hpRatio','shield','posture','stars'].includes(field.value)?Number(value.value):value.value});
      }
      if(subject){card.append(label('判斷對象',subject));subject.onchange=()=>{build({});change();};}
      card.append(content,button('移除條件',()=>{card.remove();change();}));build(c);card.read=()=>read();rows.append(card);
    }
    initial.forEach(add);box.append(button('＋ 加入條件',()=>{if(rows.children.length<(gates?10:12)){add({field:'injured',op:'eq',value:true});change();}}),node('small',gates?'空條件代表每次行動皆可發動。條件不成立時，主效果改走移動分支；副效果僅略過自己。':'先依條件篩選，再選取目標；空條件不限制。僅搜尋存活角色。'));
    return {node:box,read:()=>[...rows.children].map(r=>r.read()),mode:()=>mode.value};
  }
  function searchEditor(initial,change=()=>{},type='damage',moving=false,allowEvent=false){
    const box=section(moving?'主效果未能執行 → 移動搜尋':'目標搜尋組'),controls=node('div');controls.className='effect-search-controls';
    const base=select({actor:'施放者',main:'主效果選中的目標',...(allowEvent?{event:'本次事件角色'}:{})},initial.base??'actor'),side=select(Effects.targetSides,initial.side),mode=select(['main','event'].includes(initial.base)?Effects.relativeModes:Effects.targetModes,initial.mode);
    base.options[1].disabled=moving;
    const range={value:moving||type==='jump'?'unlimited':'limited'};
    const cond=conditionList(initial.targetCond??[],initial.targetCondMode??'all',change);
    controls.append(label('搜尋基準',base),label('搜尋陣營',side),label('選取方式',mode));
    const excludeSelf=node('input');
    excludeSelf.type='checkbox';excludeSelf.checked=initial.excludeSelf===true;
    excludeSelf.onchange=change;
    if(!moving)controls.append(label('排除自身',excludeSelf));
    box.append(controls,cond.node);
    function sync(nextType=type){if(nextType==='jump'&&type!=='jump')range.value='unlimited';type=nextType;base.disabled=moving||['swap','jump'].includes(type);if(base.disabled&&['main','event'].includes(base.value)){base.value='actor';rebuildModes();}if(['main','event'].includes(base.value)){side.disabled=false;return;}if(type==='swap')side.value='ally';if(type==='jump')side.value='enemy';side.disabled=['swap','jump'].includes(type);for(const option of mode.options)option.disabled=((side.value==='enemy'||moving)&&['self','adjacent','allLeft','allRight'].includes(option.value))||(side.value!=='enemy'&&option.value==='opposite')||(type==='swap'&&['self','all','adjacent','opposite','allLeft','allRight'].includes(option.value)||type==='jump'&&['self','all','adjacent'].includes(option.value));if([...mode.options].some(o=>o.value===mode.value&&o.disabled))mode.value='primary';}
    function rebuildModes(){const previous=mode.value,values=['main','event'].includes(base.value)?Effects.relativeModes:Effects.targetModes;mode.replaceChildren();Object.entries(values).forEach(([v,t])=>{const o=node('option',t);o.value=v;mode.append(o);});mode.value=Object.hasOwn(values,previous)?previous:['main','event'].includes(base.value)?'target':'primary';}
    base.onchange=()=>{rebuildModes();sync();change();};
    box.append(node('small','依主效果目標搜尋僅用於副效果：以命中時的佔位找緊貼左右邊緣的同陣營角色，不跨空格、不受射程限制；主目標死亡仍保留定位。主效果多人時合併去重。'));
    if(allowEvent)box.append(node('small','本次事件角色指觸發被動的角色，例如被治療時為受治療者。依事件發生時的佔位定位，僅選存活角色；沒有事件上下文時略過，不另外選人。玩家極式事件以技能施放者為事件角色。'));
    for(const control of [side,mode])control.onchange=()=>{sync();change();};sync();
    if(moving)box.append(node('small','搜尋不受攻擊射程限制，排除自身。移動消耗本次行動；無對象或無合法路徑時原地等待。'));
    return {node:box,sync,setMain:value=>{base.options[1].disabled=moving||value;},read:()=>({...(!moving&&(excludeSelf.checked||initial.excludeSelf!==undefined)?{excludeSelf:excludeSelf.checked}:{}),...(['main','event'].includes(base.value)?{base:base.value}:{}),side:side.value,mode:mode.value,range:['main','event'].includes(base.value)||moving?'unlimited':range.value,targetCond:cond.read(),targetCondMode:cond.mode()})};
  }
  function refreshRoles(container,change){
    [...container.children].forEach((card,i)=>{card.roleName=i===0?'主效果':'副效果 '+i;card.updateRole();card.promote.hidden=i===0;card.promote.onclick=()=>{container.insertBefore(card,container.children[0]);refreshRoles(container,change);change();};card.up.disabled=i===0;card.down.disabled=i===container.children.length-1;card.up.hidden=card.down.hidden=false;card.up.onclick=()=>{container.insertBefore(card,container.children[i-1]);refreshRoles(container,change);change();};card.down.onclick=()=>{container.insertBefore(container.children[i+1],card);refreshRoles(container,change);change();};});
  }
  function payloadRow(effect,remove,change,{allowAttack=true}={}){
    const root=node('fieldset');root.className='effect-action';const heading=node('legend'),type=select(names,effect.type);type.setAttribute('aria-label','效果類型');root.typeControl=type;root.actionTitle=heading;
    const statusPanel=node('div'),body=node('fieldset');body.className='effect-value';let statusRead,read;
    function setupStatus(e){statusPanel.replaceChildren();const kind=select(Statuses.names,e.status||'poison'),duration=select({permanent:'永久',seconds:'N 秒',actions:'N 次角色行動',attacks:'1 次敵方普通攻擊'},e.duration?.kind||'seconds'),value=node('input');value.type='number';value.min=1;value.max=999;value.required=true;value.value=e.duration?.value||5;for(const [title,control] of [['狀態',kind],['持續方式',duration],['持續數值',value]]){const wrap=node('label',title);wrap.append(control);statusPanel.append(wrap);}const help=node('small','同名狀態覆蓋數值並刷新時間；僵直的行動次數按原始冷卻計算被跳過的行動機會。');statusPanel.append(help);
      function sync(){const fixed=type.value==='status'&&Statuses.fixed(kind.value);body.hidden=fixed;body.disabled=fixed;const policy=Statuses.durationPolicy(kind.value),timed=policy==='seconds',locked=policy!=='free';if(locked)duration.value=policy;else if(['attacks','permanent'].includes(duration.value))duration.value='seconds';for(const o of duration.children){if(o.value==='attacks'||o.value==='permanent'){o.hidden=o.value!==policy;o.disabled=o.hidden;}}if(policy==='attacks')value.value=1;duration.disabled=locked;value.disabled=['permanent','attacks'].includes(duration.value);value.hidden=value.disabled;value.step=duration.value==='actions'?1:.1;help.textContent=Statuses.policyLabel(Statuses.snapshot().statuses.find(d=>d.id===kind.value));}
      kind.onchange=()=>{sync();change();};duration.onchange=()=>{sync();change();};sync();statusRead=()=>({status:kind.value,duration:duration.value==='permanent'?{kind:'permanent'}:{kind:duration.value,value:Number(value.value)}});
    }
    setupStatus(effect);
    function build(e){body.replaceChildren();body.hidden=false;body.disabled=false;statusPanel.hidden=type.value!=='status';statusPanel.querySelectorAll('input,select').forEach(x=>x.disabled=type.value!=='status');if(type.value==='status')setupStatus(e);if(type.value==='jump'){
        const fallback=select({no:'不換位',yes:'與落點隊友換位'},e.swapFallback?'yes':'no');
        fallback.onchange=change;
        body.append(label('落點被佔用時',fallback),node('small','已在目標對面時直接接續作用。啟用換位時，隊友須從落點格開始佔位，且互換後雙方站位均合法。'));
        read=()=>({type:'jump',swapFallback:fallback.value==='yes'});
        return;
      }
      if(['swap','cleanse'].includes(type.value)){body.hidden=true;body.disabled=true;read=()=>({type:type.value});return;}
      if(['advance','advanceSkill'].includes(type.value)){
        const seconds=node('input');Object.assign(seconds,{type:'number',min:0,max:10000,step:.1,required:true,value:e.amount??1});seconds.oninput=change;
        body.append(label('加快秒數',seconds),node('small',type.value==='advanceSkill'?'提前目標所屬陣營的主動技能冷卻，同一項作用每個陣營只計一次，最多提前至就緒，仍需手動施放。':'直接將目標的下次角色行動提前，最多提前至就緒；不改變原始行動間隔、戰鬥時間或極式冷卻。最早在下一次戰鬥更新時行動，僵直仍阻擋行動。'));
        read=()=>({type:type.value,amount:Number(seconds.value)});return;
      }
      if(['damage','heal','shield','posture','restore'].includes(type.value)){
        const amount=typeof e.amount==='number'?{constant:e.amount}:e.amount??{},builder=FormulaEditor.create(amount.formula??'0',change),constant=node('input');
        Object.assign(constant,{type:'number',min:-10000,max:10000,step:1,required:true,value:amount.constant??0});constant.oninput=change;
        const additive=section('常數項：戰鬥數值運算群組 ＋ 常數整數');additive.append(builder.node,label('常數整數',constant));let readMultiplier;
        if(allowAttack){
          const initial=amount.multiplier??0,mode=select({fixed:'固定倍率',range:'隨機倍率區間'},typeof initial==='number'?'fixed':'range');mode.setAttribute('aria-label','倍率模式');
          const fields={};for(const [key,title,value] of [['multiplier','技能倍率',typeof initial==='number'?initial:1],['min','最小倍率（含）',initial.min??.8],['max','最大倍率（含）',initial.max??1.2]]){
            const input=node('input');Object.assign(input,{type:'number',min:0,max:100,step:'any',required:true,value});fields[key]={input,wrap:label(title,input)};input.oninput=change;
          }
          function update(){for(const key of ['multiplier','min','max']){const active=mode.value==='fixed'?key==='multiplier':key!=='multiplier';fields[key].wrap.hidden=!active;fields[key].input.disabled=!active;}}
          mode.onchange=()=>{update();change();};body.append(node('p',['posture','restore'].includes(type.value)?'基礎攻擊力 × 技能倍率 ＋ 常數項':'（攻擊力＋對應狀態增減＋法則＋職業成長）× 技能倍率 ＋ 常數項'),mode,fields.multiplier.wrap,fields.min.wrap,fields.max.wrap,node('small','倍率 1.5 代表 150%；倍率 0 只計常數項。常數項不乘技能倍率，也不接受攻擊力增減。'));update();
          readMultiplier=()=>mode.value==='fixed'?Number(fields.multiplier.input.value):{min:Number(fields.min.input.value),max:Number(fields.max.input.value)};
        }else body.append(node('p','效果量＝戰鬥數值運算群組 ＋ 常數整數'),node('small','極式與法則被動不使用角色攻擊力或技能倍率。'));
        body.append(additive,node('small','所有項目加總後才四捨五入並限制 0～10000。'));
        read=()=>({type:type.value,amount:{...(allowAttack?{multiplier:readMultiplier()}:{}),formula:builder.read(),constant:Number(constant.value)}});return;
      }
      const mode=select({constant:'常數',random:'範圍隨機',formula:'視覺化公式'},typeof e.amount==='object'?(Formula.parse(e.amount.formula).kind==='random'?'random':'formula'):'constant');mode.setAttribute('aria-label','數值模式');
      const input=node('input');input.type='number';input.min=1;input.max=10000;input.step=1;input.required=true;input.setAttribute('aria-label','常數數值');input.value=typeof e.amount==='number'?e.amount:10;
      let builder=FormulaEditor.create(typeof e.amount==='object'?e.amount.formula:'enemy.hp * 0.2 + 5',change);
      const range=node('div');range.className='fields';const parsed=typeof e.amount==='object'?Formula.parse(e.amount.formula):null;const bounds={};for(const [key,title,value] of [['min','最小值（含）',parsed?.kind==='random'?parsed.min:5],['max','最大值（含）',parsed?.kind==='random'?parsed.max:15]]){const label=node('label',title),n=node('input');n.type='number';n.min=0;n.max=10000;n.step=1;n.required=true;n.value=value;label.append(n);range.append(label);bounds[key]=n;}
      const hint=node('small','依施放當下數值計算；除零為 0，結果四捨五入並限制為 0～10000。');
      function update(){const formula=mode.value==='formula';input.hidden=mode.value!=='constant';input.disabled=mode.value!=='constant';range.hidden=mode.value!=='random';Object.values(bounds).forEach(n=>n.disabled=mode.value!=='random');builder.node.hidden=!formula;builder.node.querySelectorAll('input,select,button,textarea').forEach(control=>control.disabled=!formula);hint.hidden=!formula;}
      mode.onchange=()=>{update();change();};body.append(mode,input,range,builder.node,hint);update();read=()=>({type:type.value,amount:mode.value==='random'?{formula:`rand(${bounds.min.value||'?'},${bounds.max.value||'?'})`}:mode.value==='formula'?{formula:builder.read()}:Number(input.value)});

    }

    root.up=button('作用上移',()=>{});root.down=button('作用下移',()=>{});root.removeButton=button('移除作用內容',()=>remove(root));
    root.append(heading,root.up,root.down,label('效果類型',type),statusPanel,body,root.removeButton);build(effect);
    type.onchange=()=>{build({amount:['advance','advanceSkill'].includes(type.value)?1:10});change();};
    root.read=()=>({...read(),...(type.value==='status'&&Statuses.fixed(statusRead().status)?{amount:1}:{}),...(type.value==='status'?statusRead():{})});return root;
  }
  function row(effect,remove,change,options={}){
    const root=node('div');root.className='effect-card';const heading=node('h4','效果'),promote=button('設為主效果',()=>{});promote.hidden=true;root.roleTitle=heading;root.roleName='效果';root.promote=promote;root.up=button('上移',()=>{});root.down=button('下移',()=>{});root.up.hidden=root.down.hidden=true;
    const groups=node('div'),actions=node('div'),gates=conditionList(effect.cond??[],effect.condMode??'all',change,true),targetBox=section('2．目標搜尋 targets'),payload=section('3．作用內容');
    const type=()=>Effects.searchType({actions:[...actions.children].map(card=>({type:card.typeControl.value}))});
    root.updateRole=()=>{heading.textContent=root.roleName+' · '+[...actions.children].map(card=>names[card.typeControl.value]).join('＋');for(const card of groups.children)card.setMain(root.roleName==='主效果');};
    function sync(){
      for(const card of groups.children)card.sync(type());
      [...actions.children].forEach((card,i)=>{card.actionTitle.textContent='作用 '+(i+1)+' · '+names[card.typeControl.value];card.up.disabled=i===0;card.down.disabled=i===actions.children.length-1;card.removeButton.disabled=actions.children.length===1;
        card.up.onclick=()=>{actions.insertBefore(card,actions.children[i-1]);sync();change();};card.down.onclick=()=>{actions.insertBefore(actions.children[i+1],card);sync();change();};});root.updateRole();
    }
    function addAction(action){const card=payloadRow(action,card=>{if(actions.children.length===1)return;card.remove();sync();change();},()=>{sync();change();},options);actions.append(card);sync();}
    Effects.parts(effect).forEach(addAction);
    function addTarget(t){const search=searchEditor(t,change,type(),false,options.allowEvent===true),card=search.node;card.read=search.read;card.sync=search.sync;card.setMain=search.setMain;card.setMain(root.roleName==='主效果');card.append(button('移除此搜尋組',()=>{card.remove();change();}));groups.append(card);}
    Effects.selectors(effect).forEach(addTarget);
    targetBox.append(node('small','本組作用共用同一次搜尋結果，先合併去重再執行。最近單體使用角色攻擊距離；正對面只選對面佔位。'),groups,button('＋ 加入目標搜尋組',()=>{if(groups.children.length>=(['swap','jump'].includes(type())?1:8))return;addTarget(Effects.selector(Effects.targeting({type:type(),target:'enemy'}),type()));change();}));
    payload.append(node('small','符合發動條件並找到目標後，依序執行本組全部作用；不重新判斷條件或搜尋目標。目標死亡時略過其後作用。每組至少 1 項、最多 8 項。互換與跳躍需分成不同效果組。'),actions,button('＋ 加入作用內容',()=>{if(actions.children.length<8){addAction({type:'damage',amount:10});change();}}));
    root.append(heading,promote,root.up,root.down,gates.node,targetBox,payload,button('移除效果',()=>remove(root)));sync();
    root.read=()=>{const targets=[...groups.children].map(card=>card.read());if(root.roleName==='主效果'&&targets.some(t=>t.base==='main'))throw Error('主效果不能依自身目標搜尋，請改選施放者或將此效果移至副效果。');return {cond:gates.read(),condMode:gates.mode(),targets,actions:[...actions.children].map(card=>card.read())};};return root;
  }
   const fields={race:'種族',affinity:'戰鬥類型',job:'職業',rarity:'階級',stars:'星數'};
 function condition(c,changed){
  const el=node;
  const row=el('div');row.className='law-condition';const kind=select(fields,c.field),value=select({},'');kind.setAttribute('aria-label','條件屬性');value.setAttribute('aria-label','條件數值');
  function options(v){value.replaceChildren();CharacterEnums[kind.value].forEach(x=>{const o=el('option',x+(kind.value==='stars'?' 星':''));o.value=String(x);value.append(o);});value.value=String(v??CharacterEnums[kind.value][0]);}
  options(c.value);kind.onchange=()=>{options();changed();};
  row.append(kind,el('span','等於'),value,button('移除條件',()=>{row.remove();changed();}));row.read=()=>({field:kind.value,value:kind.value==='stars'?Number(value.value):value.value});return row;
 }
 function passiveRow(p,changed=()=>{},say=()=>{},{allowAttack=false}={}){
  const el=node,field=label;
  const card=el('fieldset');card.className='law-passive';card.append(el('legend','當事件發生 → 檢查角色 → 發動效果'));
  const when=select(Object.fromEntries(Laws.timings.map((t,i)=>[t,Laws.labels[i]])),p.when,'觸發時機'),relation=select({self:'持有者自己',ally:'同陣營角色（含自己）',enemy:'敵方角色',any:'任意角色'},p.subject?.relation??'self','事件角色範圍');
  function syncRelation(){const own=['swapInitiated','swapReceived','playerSkill'].includes(when.value);const result=['normalDown','normalKill'].includes(when.value);const allySkill=when.value==='allySkillResolved';relation.disabled=own||result||allySkill;if(allySkill)relation.value='ally';if(own)relation.value='self';if(result)relation.value='enemy';}when.onchange=()=>{syncRelation();changed();};syncRelation();
  card.append(field('觸發時機',when),field('事件中的角色',relation));
  const conditions=el('div');(p.subject?.conditions??[]).forEach(c=>conditions.append(condition(c,changed)));
  card.append(el('p','下列條件需全部符合；沒有條件表示不限制角色屬性。玩家極式事件不檢查事件角色範圍與屬性，雙方持有者皆可觸發。'),conditions,button('＋ 角色條件',()=>{if(conditions.children.length>=10){say('最多 10 個角色條件。');return;}conditions.append(condition({field:'race',value:'人類'},changed));changed();}));
  const statusMode=select(Laws.statusModes,p.statusCondition?.mode??'any');
  const statusId=select(Statuses.names,p.statusCondition?.status??Object.keys(Statuses.names)[0]);
  const specifiedStatus=field('指定狀態',statusId);
  const statusFilter=el('div');
  statusFilter.append(field('狀態條件',statusMode),specifiedStatus);
  card.append(statusFilter);
  function syncStatusFilter(){
   statusFilter.hidden=when.value!=='statusGained';
   specifiedStatus.hidden=statusMode.value!=='specified';
   statusId.disabled=statusFilter.hidden||specifiedStatus.hidden;
   statusMode.disabled=statusFilter.hidden;
  }
  statusMode.onchange=()=>{syncStatusFilter();changed();};
  statusId.onchange=changed;
  syncStatusFilter();
  card.append(el('p','自身普通行動倒地／擊殺時機：只計自己 CD 到時普通行動的直接主／副效果，排除反擊、持續傷害、被動與手動技能。事件角色為被打倒地／擊殺的敵人；同一行動每條被動最多發動一次。'));
  card.append(el('p','普通攻擊命中敵人時，事件角色為攻擊者。正值傷害被護盾吸收仍算命中，同一次行動每條被動最多發動一次。'));
  const swapHint=el('p','每次成功互換只觸發一次，事件角色為發起互換的人。');
  const syncSwapHint=()=>{swapHint.hidden=when.value!=='swapped';};
  syncSwapHint();card.append(swapHint);
  when.onchange=()=>{syncRelation();syncStatusFilter();syncSwapHint();changed();};
  const effects=el('div');function addEffect(e){effects.append(EffectEditor.row(e,row=>{row.remove();changed();},changed,{allowAttack,allowEvent:true}));}
  (p.effects??[]).forEach(addEffect);
  card.append(el('h4','發動效果'),effects,button('＋ 發動效果',()=>{if(effects.children.length>=8){say('每個被動最多 8 個效果。');return;}addEffect({type:'damage',amount:10});changed();}),button('移除這個被動',()=>{card.remove();changed();}));
  card.read=()=>({when:when.value,...(when.value==='statusGained'?{statusCondition:{mode:statusMode.value,...(statusMode.value==='specified'?{status:statusId.value}:{})}}:{}),subject:{relation:relation.value,conditions:[...conditions.children].map(n=>n.read())},effects:[...effects.children].map(n=>n.read())});return card;
 }

  window.EffectEditor={passiveRow,row,searchEditor,conditionList,refreshRoles,describe:Effects.describe};
})();
