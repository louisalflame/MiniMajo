(function(root){
  const Status=typeof module!=='undefined'?require('./statuses.js'):root.Statuses;
  const refs={};
  const formulaStats={hp:'目前 HP',maxHp:'最大 HP',missingHp:'已損 HP',shield:'護盾',posture:'失衡值',attack:'基礎攻擊力'};
  for(const [key,label] of Object.entries({self:'施放者',enemy:'敵方參照',target:'實際受作用目標'})){
    for(const [stat,name] of Object.entries(formulaStats))refs[key+'.'+stat]=label+' '+name;
  }
  refs.time='戰鬥秒數';
  const targetSides={ally:'我方',enemy:'敵方'};
  const targetModes={self:'自身',primary:'最近單體',opposite:'正對面',all:'全體',adjacent:'自身＋左右鄰居',lowestHp:'血量最少（數值）',lowestHpRatio:'血量最低（比例）',highestPosture:'失衡最高',random:'隨機一人',allLeft:'自身左側全體同伴',allRight:'自身右側全體同伴',leftmost:'最左側一人',rightmost:'最右側一人'};
  const relativeModes={target:'目標本身',left:'左鄰',right:'右鄰',neighbors:'左右鄰居（不含目標）',targetNeighbors:'目標＋左右鄰居'};
  const targetFilters={any:'無條件',injured:'已受傷',down:'目前倒地',hasStatus:'持有指定狀態',missingStatus:'未持有指定狀態'};
  const targetFields={race:['人類','獸人','機人'],affinity:['物理','精神','魔法'],job:['守護','破陣','飛襲','支援'],rarity:['SR','SSR','UR'],stars:[1,2,3,4,5,6]};
  const conditionFields={race:'種族',affinity:'類型',job:'職業',rarity:'階級',stars:'星數',hp:'目前 HP',hpRatio:'HP 百分比',shield:'護盾',posture:'失衡',injured:'已受傷',down:'目前倒地',hasStatus:'持有狀態',missingStatus:'未持有狀態'};
  const operators={eq:'等於',ne:'不等於',lt:'小於',lte:'不大於',gt:'大於',gte:'不小於'};
  function condition(c){
    if(!c||!Object.hasOwn(conditionFields,c.field))throw Error('條件欄位無效。');
    const op=c.op===undefined?'eq':c.op;if(!Object.hasOwn(operators,op))throw Error('條件比較方式無效。');
    if(targetFields[c.field]){if(!targetFields[c.field].includes(c.value)||(!['eq','ne'].includes(op)&&c.field!=='stars'))throw Error('角色屬性條件無效。');}
    else if(['injured','down'].includes(c.field)){if(typeof c.value!=='boolean'||!['eq','ne'].includes(op))throw Error('戰鬥條件需為是／否。');}
    else if(['hasStatus','missingStatus'].includes(c.field)){if(!Object.hasOwn(Status.names,c.value)||!['eq','ne'].includes(op))throw Error('條件狀態無效。');}
    else if(!Number.isFinite(c.value)||c.value<0||c.value>(c.field==='hpRatio'?100:10000))throw Error('條件數值超出範圍。');
    return {field:c.field,op,value:c.value};
  }
  function conditions(rows=[]){if(!Array.isArray(rows)||rows.length>12)throw Error('目標條件最多 12 條。');return rows.map(condition);}
  function conditionMode(mode='all'){if(!['all','any'].includes(mode))throw Error('條件需為全部／任一符合。');return mode;}
  function gate(c){
    if(c?.subject==='count'){
      if(!['ally','enemy'].includes(c.side)||!Object.hasOwn(operators,c.op)||!Number.isInteger(c.value)||c.value<0||c.value>10)throw Error('角色數量條件無效。');
      return {subject:'count',side:c.side,op:c.op,value:c.value,targetCond:conditions(c.targetCond),targetCondMode:conditionMode(c.targetCondMode)};
    }
    if(c?.subject!=='self')throw Error('發動條件只能指定施放者或戰場角色數量。');
    return {subject:c.subject,...condition(c)};
  }
  function gates(rows=[]){if(!Array.isArray(rows)||rows.length>10)throw Error('發動條件最多 10 條。');return rows.map(gate);}
  function selector(t,type='damage'){
    if(!t||typeof t!=='object'||Array.isArray(t)||t.range!==undefined&&!['limited','unlimited'].includes(t.range))throw Error('目標搜尋設定無效。');
    if(t.base!==undefined&&!['actor','main','event'].includes(t.base))throw Error('搜尋基準無效。');
    if(t.excludeSelf!==undefined&&typeof t.excludeSelf!=='boolean')throw Error('排除自身需為是或否。');
    const exclude=t.excludeSelf===undefined?{}:{excludeSelf:t.excludeSelf};
    if(['main','event'].includes(t.base)){
      if(['swap','jump'].includes(type)||!Object.hasOwn(relativeModes,t.mode)||!Object.hasOwn(targetSides,t.side))throw Error('主效果目標搜尋設定無效。');
      return {...exclude,base:t.base,side:t.side,mode:t.mode,range:'unlimited',targetCond:conditions(t.targetCond),targetCondMode:conditionMode(t.targetCondMode)};
    }
    const old=targeting({type,targeting:t});
    if(old.mode==='opposite'&&old.side!=='enemy')throw Error('正對面僅能選取敵方。');
    const result={...exclude,side:old.side,mode:old.mode,range:old.range,targetCond:conditions(t.targetCond===undefined?legacyConditions(old):t.targetCond),targetCondMode:conditionMode(t.targetCondMode)};
    if(type==='swap'&&(result.side!=='ally'||['self','all','adjacent','opposite','allLeft','allRight'].includes(result.mode)))throw Error('互換位置需選同陣營單體。');
    if(type==='jump'&&(result.side!=='enemy'||['self','all','adjacent'].includes(result.mode)))throw Error('跳躍需選敵方單體。');
    return result;
  }
  function usesRange(t){return t.mode==='primary';}
  function legacyConditions(t){return [...(t.conditions??[]).map(c=>({...c,op:'eq'})),...(t.filter&&t.filter!=='any'?[{field:t.filter==='down'?'down':t.filter,op:'eq',value:['hasStatus','missingStatus'].includes(t.filter)?t.status:true}]:[])];}
  function parts(e){return Array.isArray(e?.actions)?e.actions:[e];}
  function searchType(e){const types=parts(e).map(p=>p?.type);return types.includes('swap')?'swap':types.includes('jump')?'jump':types[0]??'damage';}
  function payload(e){return Object.fromEntries(['type','amount','status','target','duration','swapFallback'].filter(key=>e[key]!==undefined).map(key=>[key,e[key]]));}
  function selectors(e){return e.targets??[selector(targeting(e),searchType(e))];}
  function movement(value){if(['main','event'].includes(value?.base))throw Error('移動不能依主效果目標或事件角色搜尋。');return selector(value===undefined?{side:'enemy',mode:'primary',range:'unlimited'}:value);}
  function compare(a,op,b){return ({eq:()=>a===b,ne:()=>a!==b,lt:()=>a<b,lte:()=>a<=b,gt:()=>a>b,gte:()=>a>=b})[op??'eq']();}
  function matches(u,c,tick){
    if(!u||u.hp<=0)return false;
    const value=c.field==='hpRatio'?u.hp/u.maxHp*100:c.field==='injured'?u.hp<u.maxHp:c.field==='down'?u.weakUntil>tick:['hasStatus','missingStatus'].includes(c.field)?(c.field==='hasStatus'?Status.has(u,c.value):!Status.has(u,c.value)):u[c.field];
    return compare(value,c.op,['hasStatus','missingStatus'].includes(c.field)?true:c.value);
  }
  function matchAll(u,rows=[],mode='all',tick=0){return !rows.length||(mode==='any'?rows.some(c=>matches(u,c,tick)):rows.every(c=>matches(u,c,tick)));}
  function eligible(e,s,team,actor,enemy){
    const rows=e.cond??[];
    const check=c=>c.subject==='count'?compare(s.teams[c.side==='ally'?team:1-team].units.filter(u=>u.hp>0&&matchAll(u,c.targetCond,c.targetCondMode,s.tick)).length,c.op,c.value):c.subject==='self'&&matches(actor,c,s.tick);
    return !rows.length||(e.condMode==='any'?rows.some(check):rows.every(check));
  }
  function targeting(e){
    if(e.actions&&e.targeting===undefined)return targeting(parts(e).find(p=>p.type===searchType(e))??{type:'damage'});
    if(e.targeting!==undefined){
      const t=e.targeting;if(!t||!Object.hasOwn(targetSides,t.side)||!Object.hasOwn(targetModes,t.mode)||!Object.hasOwn(targetFilters,t.filter??'any')||!['limited','unlimited'].includes(t.range??'limited'))throw Error('效果目標設定無效。');
      if(t.mode==='opposite'&&t.side!=='enemy')throw Error('正對面僅能選取敵方。');
      if(['self','adjacent','allLeft','allRight'].includes(t.mode)&&t.side!=='ally')throw Error('自身、鄰居與左右同伴搜尋僅能選擇我方。');
      const filter=t.filter??'any';if(['hasStatus','missingStatus'].includes(filter)&&!Object.hasOwn(Status.names,t.status))throw Error('請選擇目標篩選狀態。');
      const conditions=t.conditions===undefined?[]:t.conditions;if(!Array.isArray(conditions)||conditions.length>10)throw Error('目標屬性條件最多 10 個。');const clean=conditions.map(c=>{if(!c||!targetFields[c.field]?.includes(c.value))throw Error('目標屬性條件無效。');return {field:c.field,value:c.value};});
      return {...(clean.length?{conditions:clean}:{}),side:t.side,mode:t.mode,filter,range:t.range??'limited',...(['hasStatus','missingStatus'].includes(filter)?{status:t.status}:{})};
    }
    if(e.type==='jump')return {side:'enemy',mode:'primary',filter:'any',range:'unlimited'};
    if(e.type==='swap')return {side:'ally',mode:'primary',filter:'any',range:'unlimited'};
    const hostile=['damage','posture'].includes(e.type)||(e.type==='status'&&e.target==='enemy');
    return {side:hostile?'enemy':'ally',mode:hostile?'primary':'self',filter:'any',range:'limited'};
  }
  function describeCondition(c){const value=typeof c.value==='boolean'?(c.value?'是':'否'):['hasStatus','missingStatus'].includes(c.field)?Status.names[c.value]:c.value;return conditionFields[c.field]+' '+operators[c.op??'eq']+' '+value;}
  function describeTarget(e){if(e.targets)return e.targets.length?e.targets.map(t=>(t.base==='event'?'本次事件角色 · ':t.base==='main'?'主效果目標 · ':'')+targetSides[t.side]+' · '+(relativeModes[t.mode]??targetModes[t.mode])+(t.excludeSelf?' · 排除自身':'')+(t.targetCond?.length?' · '+t.targetCond.map(describeCondition).join(t.targetCondMode==='any'?' 或 ':' 且 '):'')+(t.side==='enemy'?' · '+(usesRange(t)?'角色攻擊距離':'不限距離'):'')).join('；'):'無搜尋組（略過）';const t=targeting(e);return (t.base==='event'?'本次事件角色 · ':t.base==='main'?'主效果目標 · ':'')+targetSides[t.side]+' · '+(relativeModes[t.mode]??targetModes[t.mode])+(t.filter!=='any'?' · '+targetFilters[t.filter]+(t.status?'「'+Status.names[t.status]+'」':''):'')+(t.conditions?.length?' · '+t.conditions.map(c=>({race:'種族',affinity:'類型',job:'職業',rarity:'階級',stars:'星數'}[c.field])+'＝'+c.value).join('、'):'')+(t.side==='enemy'?' · '+(usesRange(t)?'角色攻擊距離':'不限距離'):'');}
  function calculate(source,values={},random=()=>0){
    if(typeof source!=='string'||source.length>200||!source.trim())throw Error('公式需為 1～200 字。');
    const tokens=source.match(/\d+(?:\.\d+)?|[a-zA-Z][a-zA-Z.]*|[()+*/-]|\S/g);let pos=0;
    function atom(){const t=tokens[pos++];if(t==='rand'){if(tokens[pos++]!=='(')throw Error('隨機範圍格式錯誤。');const low=Number(tokens[pos++]);if(tokens[pos++]!==',')throw Error('隨機範圍需要上下限。');const high=Number(tokens[pos++]);if(tokens[pos++]!==')'||!Number.isInteger(low)||!Number.isInteger(high)||low<0||high>10000||low>high)throw Error('隨機範圍需為 0～10000 整數，最小值不可大於最大值。');return low+Math.floor(random()*(high-low+1));}if(t==='+'||t==='-')return (t==='-'?-1:1)*atom();if(t==='('){const v=sum();if(tokens[pos++]!==')')throw Error('公式括號不完整。');return v;}if(/^\d+(?:\.\d+)?$/.test(t||''))return Number(t);if(Object.hasOwn(refs,t))return values[t]??1;throw Error('公式包含不支援的數值或名稱。');}
    function product(){let v=atom();while(['*','/'].includes(tokens[pos])){const op=tokens[pos++],right=atom();v=op==='*'?v*right:right===0?0:v/right;}return v;}
    function sum(){let v=product();while(['+','-'].includes(tokens[pos])){const op=tokens[pos++],right=product();v=op==='+'?v+right:v-right;}return v;}
    const result=sum();if(pos!==tokens.length||!Number.isFinite(result))throw Error('公式無效或結果超出範圍。');return result;
  }
  function validate(e,options={}){
    const allowAttack=options?.allowAttack!==false;
    if(e?.actions!==undefined){
      if(!Array.isArray(e.actions)||e.actions.length<1||e.actions.length>8)throw Error('每組效果需要 1～8 項作用內容。');
      const actions=e.actions.map(action=>{
        if(!action||['actions','cond','condMode','targets','targeting','range','when','conditions'].some(key=>action[key]!==undefined))throw Error('作用內容不可另設發動條件、目標或巢狀效果組。');
        return payload(validate({...action,targets:[]},options));
      });
      if(actions.some(a=>a.type==='swap')&&actions.some(a=>a.type==='jump'))throw Error('互換與跳躍需要不同陣營目標，請拆成不同效果組。');
      const type=searchType({actions}),representative=actions.find(a=>a.type===type),rule=validate({...representative,...e,type,actions:undefined,amount:1},options);
      return {cond:rule.cond??[],condMode:rule.condMode??'all',targets:selectors(rule),actions};
    }
    if(e&&Object.hasOwn(e,'conditions'))throw Error('角色條件請設定於 targeting.conditions。');
    const extra={};
    if(e?.cond!==undefined)extra.cond=gates(e.cond);
    if(e?.condMode!==undefined)extra.condMode=conditionMode(e.condMode);
    if(e?.targets!==undefined){if(!Array.isArray(e.targets)||e.targets.length>8||(['swap','jump'].includes(e.type)&&e.targets.length>1))throw Error('目標搜尋最多 8 組，互換／跳躍最多一組。');extra.targets=e.targets.map(t=>selector(t,e.type));}
    const targetConfig=e?.targets?.length?e.targets[0]:targeting(e||{});
    if(e?.when!==undefined)throw Error('舊 when 條件已移除，請使用施放者或戰場人數條件。');const range=e?.range??1;if(!Number.isInteger(range)||range<1||range>3)throw Error('攻擊距離需為 1～3。');const condition={...extra,...(e?.targeting!==undefined?{targeting:targeting(e)}:{}),...(e?.range!==undefined?{range}:{})};
    if(e?.type==='jump'){if(e.swapFallback!==undefined&&typeof e.swapFallback!=='boolean')throw Error('跳躍換位備援需為是或否。');if(targetConfig.side!=='enemy'||['self','all','adjacent'].includes(targetConfig.mode))throw Error('跳躍需選敵方單體。');return {type:'jump',...(e.swapFallback===undefined?{}:{swapFallback:e.swapFallback}),...condition,...(e.targets?{}:{targeting:targetConfig})};}
    if(e?.type==='swap'){if(targetConfig.side!=='ally'||['self','all','adjacent'].includes(targetConfig.mode))throw Error('互換位置需選同陣營單體。');return {type:'swap',...condition,...(e.targets?{}:{targeting:targetConfig})};}
    if(e?.type==='status'){if(e.amount?.multiplier!==undefined||e.amount?.constant!==undefined)throw Error('狀態施加量使用常數或數值公式。');const detail=Status.validate(e.targeting||e.targets?{...e,target:targetConfig.side==='enemy'?'enemy':'self'}:e);const numeric=validate({type:'posture',amount:Status.fixed(e.status)?1:e.amount});return {type:'status',...detail,amount:numeric.amount,...condition};}
    if(e?.type==='cleanse')return {type:'cleanse',...condition};
    if(['advance','advanceSkill'].includes(e?.type)){
      if(typeof e.amount!=='number'||!Number.isFinite(e.amount)||e.amount<0||e.amount>10000||Math.abs(e.amount*10-Math.round(e.amount*10))>1e-8)throw Error('加快秒數需為 0～10000，最多一位小數。');
      return {type:e.type,amount:e.amount,...condition};
    }
    if(!e||!['damage','shield','heal','posture','restore'].includes(e.type))throw Error('不支援的效果（狀態系統尚未開放）。');
    if(typeof e.amount==='number'){if(!Number.isInteger(e.amount)||e.amount<0||e.amount>10000)throw Error('常數需為 0～10000 整數。');return {type:e.type,amount:e.amount,...condition};}
    if(e.amount&&typeof e.amount==='object'&&!Array.isArray(e.amount)){
      if(Object.hasOwn(e.amount,'kind'))throw Error('請使用技能倍率與常數項設定。');
      const formula=e.amount.formula===undefined?'0':e.amount.formula;calculate(formula);
      if(['damage','heal','shield'].includes(e.type)||e.amount.multiplier!==undefined||e.amount.constant!==undefined){
        const constant=e.amount.constant===undefined?0:e.amount.constant;
        if(!Number.isInteger(constant)||Math.abs(constant)>10000)throw Error('常數整數需為 -10000～10000。');
        return {type:e.type,amount:{...(allowAttack?{multiplier:validateMultiplier(e.amount.multiplier===undefined?0:e.amount.multiplier)}:{}),formula:formula.trim(),constant},...condition};
      }
      return {type:e.type,amount:{formula:formula.trim()},...condition};
    }
    throw Error('請設定常數或有效公式。');
  }
  for(const key of ['hp','maxHp','missingHp','shield','posture'])refs['target.'+key]='實際受作用目標 '+key;
  function validateMultiplier(value){
    const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100;
    if(valid(value))return value;
    if(value&&typeof value==='object'&&!Array.isArray(value)&&valid(value.min)&&valid(value.max)&&value.min<=value.max)return {min:value.min,max:value.max};
    throw Error('倍率需為 0～100，區間最小值不可大於最大值。');
  }
  function attackValue(actor,type){const kinds={damage:['power','weakness'],heal:['healing','healingWeakness'],shield:['hard','fragile']},[up,down]=kinds[type]??[];return Math.max(0,(actor?.attack??10)+(actor?.outputBonuses?.[type]??0)+(up?Status.sum(actor??{},up)-Status.sum(actor??{},down):0));}
  function amount(e,s,i,context){
    const a=typeof e.amount==='number'?{constant:e.amount}:e.amount,values={time:s.tick/10};
    ['self','enemy','target'].forEach((side,j)=>{const t=context?(j===2?context.target:j?context.enemy:context.self):s.teams[j?1-i:i];for(const key of ['hp','maxHp','shield','posture'])values[side+'.'+key]=t?.[key]??(key==='maxHp'?180:0);values[side+'.missingHp']=t?(t.maxHp??180)-t.hp:0;values[side+'.attack']=(context?t:t?.units?.[0])?.attack??(context&&!t?0:10);});
    try{
      const m=context?.allowAttack===false?0:a.multiplier??0,multiplier=typeof m==='number'?m:m.min+(s.random||Math.random)()*(m.max-m.min);
      const actor=context?.self??s.teams?.[i]?.units?.[0];
      let power=0;
      if(multiplier!==0){
        if(['posture','restore'].includes(e.type))power=Math.max(0,actor?.attack??10);
        else if(['damage','heal','shield'].includes(e.type))power=attackValue(actor,e.type);
      }
      const result=power*multiplier+calculate(a.formula??'0',values,s.random||Math.random)+(a.constant??0)+(e.type==='posture'?(actor?.outputBonuses?.posture??0):0);
      return Math.max(0,Math.min(10000,Math.round(result)));
    }catch{return 0;}
  }
  function describeAmount(value){
    if(value===undefined)return '';if(typeof value==='number')return String(value);
    const m=value.multiplier??0,multiplier=typeof m==='number'?String(m):m.min+'～'+m.max;
    const terms=[...(typeof m==='object'||m!==0?['攻擊力 × '+multiplier]:[]),...(value.formula&&value.formula!=='0'?['('+value.formula+')']:[]),...(value.constant?[String(value.constant)]:[])];
    return terms.join(' + ')||'0';
  }
  function describePayload(e){
    if(e.type==='cleanse')return '解除 1 個負面狀態';
    if(e.type==='advanceSkill')return '直接加快主動技能時間 '+e.amount+' 秒';
    if(e.type==='advance')return '直接加快時間 '+e.amount+' 秒';
    if(e.type==='swap')return '互換位置';if(e.type==='jump')return e.swapFallback?'跳到敵人對面（落點有隊友時可換位）':'跳到敵人對面空格';
    if(e.type==='status')return Status.names[e.status]+(Status.fixed(e.status)?'':describeAmount(e.amount))+' · '+(e.duration.kind==='permanent'?'永久':e.duration.value+(e.duration.kind==='seconds'?'秒':e.duration.kind==='attacks'?'次敵方普通攻擊':'次行動'));
    return describeAmount(e.amount)+' '+({damage:'傷害',shield:'護盾',heal:'治療',posture:'增加失衡',restore:'降低失衡'})[e.type];
  }
  function describe(e){const prefix=e.cond?.length?'['+e.cond.map(c=>c.subject==='count'?targetSides[c.side]+'符合條件人數 '+operators[c.op]+' '+c.value:'施放者：'+describeCondition(c)).join(e.condMode==='any'?' 或 ':' 且 ')+'] ':'';
    return prefix+parts(e).map(describePayload).join(' ＋ ')+' → '+describeTarget(e);
  }
  function description(effects){return effects.map(describe).join('\n').slice(0,2000);}
  const api={relativeModes,parts,searchType,payload,validateMultiplier,describeAmount,attackValue,usesRange,conditionFields,operators,condition,conditions,conditionMode,gate,gates,selector,selectors,movement,legacyConditions,compare,matches,matchAll,eligible,describe,description,targetFields,refs,calculate,validate,amount,targeting,describeTarget,targetSides,targetModes,targetFilters};if(typeof module!=='undefined')module.exports=api;else root.Effects=api;
})(globalThis);
