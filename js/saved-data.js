(function(root){
 'use strict';
 // Tolerant persistence boundary. Editing/game validators remain strict.
 const node=typeof module!=='undefined',warnings=[];
 const modules={echo:['echo-levels','EchoLevels'],characters:['database','ItemDB'],skills:['skills','SkillDB'],statuses:['statuses','Statuses'],laws:['laws','Laws'],enemies:['enemy-teams','EnemyTeams'],map:['hex-map','HexMap'],config:['config','GameConfig'],effects:['effects','Effects']};
 const get=k=>node?require('./'+modules[k][0]+'.js'):root[modules[k][1]];
 const keys={echo:'minimajo.echo.v1',characters:'minimajo.characters.v2',skills:'minimajo.skills.v1',statuses:'minimajo.statuses.v1',laws:'minimajo.laws.v1',enemies:'minimajo.enemies.v1',map:'minimajo.map.v1',config:'minimajo.config.v1',capacity:'minimajo.capacity.v2'};
 const clone=x=>structuredClone(x),object=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
 function note(w,path,reason='缺少或無效，已填入預設值'){const message=path+'：'+reason;if(!w.includes(message))w.push(message);}
 function choose(value,fallback,valid,w,path){if(valid(value))return clone(value);note(w,path);return clone(fallback);}
 const number=(v,d,min,max,step,w,p)=>choose(v,d,x=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max&&(step===0||Math.abs(x/step-Math.round(x/step))<1e-8),w,p);
 const text=(v,d,max,w,p)=>choose(v,d,x=>typeof x==='string'&&!!x.trim()&&x.length<=max,w,p);
 const option=(v,d,values,w,p)=>choose(v,d,x=>values.includes(x),w,p);
 function list(v,d,max,w,p){const a=choose(v,d,Array.isArray,w,p);if(a.length>max)note(w,p,'超過上限，僅載入前 '+max+' 筆；原檔未修改');return a.slice(0,max);}
 function id(v,prefix,index,seen,w,path){if(typeof v!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(v)||seen.has(v)){note(w,path,'ID 缺少、無效或重複，已產生獨立 ID');let n=index;do{v=prefix+'-'+n++;}while(seen.has(v));}seen.add(v);return v;}
 function attempt(fn){try{return {value:fn()};}catch{return null;}}
 function growth(data,w,p){const D=get('characters'),source=object(data),out={};for(const f of D.growthFields)out[f]=number(source[f]??0,0,-10000,10000,['cooldown','weakDuration','statusDurationBonus'].includes(f)?.1:1,w,p+'.'+f);return out;}
 function growthTable(data,w,p){const source=object(data),out={};for(const job of ['守護','破陣','飛襲','支援']){const rows=source[job];out[job]=Array.from({length:5},(_,i)=>growth(Array.isArray(rows)?rows[i]:null,w,p+'.'+job+'['+i+']'));if(rows!==undefined&&(!Array.isArray(rows)||rows.length!==5))note(w,p+'.'+job);}return out;}
 function bonusTable(data,kind,w,p){
  const source=object(data),defaults=get('characters').validateBonuses(undefined,kind),out={};
  if(!data||typeof data!=='object'||Array.isArray(data))note(w,p);
  for(const key of Object.keys(defaults)){
   const row=object(source[key]);if(row!==source[key])note(w,p+'.'+key);
   out[key]={};for(const f of get('characters').growthFields)out[key][f]=number(row[f],0,-10000,10000,['cooldown','weakDuration','statusDurationBonus'].includes(f)?.1:1,w,p+'.'+key+'.'+f);
  }return out;
 }
 function attributes(data,w,p){return list(data??[],[],10,w,p).filter((c,i)=>{if(c&&get('effects').targetFields[c.field]?.includes(c.value))return true;note(w,p+'['+i+']','無效條件已略過');return false;}).map(c=>({field:c.field,value:c.value}));}
 function predicate(data,w,p){
  const E=get('effects'),c=object(data),field=option(c.field,'injured',Object.keys(E.conditionFields),w,p+'.field');
  const numeric=!E.targetFields[field]&&!['injured','down','hasStatus','missingStatus'].includes(field)||field==='stars';
  const op=option(c.op===undefined?'eq':c.op,'eq',numeric?Object.keys(E.operators):['eq','ne'],w,p+'.op');let value;
  if(E.targetFields[field])value=option(c.value,E.targetFields[field][0],E.targetFields[field],w,p+'.value');
  else if(['injured','down'].includes(field))value=choose(c.value,true,v=>typeof v==='boolean',w,p+'.value');
  else if(['hasStatus','missingStatus'].includes(field))value=option(c.value,'poison',Object.keys(get('statuses').names),w,p+'.value');
  else value=number(c.value,0,0,field==='hpRatio'?100:10000,0,w,p+'.value');
  return {field,op,value};
 }
 function predicates(data,w,p){return list(data===undefined?[]:data,[],12,w,p).map((c,i)=>predicate(c,w,p+'['+i+']'));}
 function searchRule(data,w,p,type='damage'){
  const E=get('effects'),t=object(data),side=option(t.side,type==='swap'?'ally':'enemy',type==='swap'?['ally']:type==='jump'?['enemy']:['ally','enemy'],w,p+'.side');
  const base=option(t.base===undefined?'actor':t.base,'actor',['swap','jump','move'].includes(type)?['actor']:['actor','main','event'],w,p+'.base');
  const modes=['main','event'].includes(base)?Object.keys(E.relativeModes):Object.keys(E.targetModes).filter(m=>!(side==='enemy'&&['self','adjacent','allLeft','allRight'].includes(m))&&!(['swap','jump'].includes(type)&&['self','all','adjacent','allLeft','allRight'].includes(m))&&!(side==='ally'&&m==='opposite'));
  const exclude=t.excludeSelf===undefined?{}:{excludeSelf:choose(t.excludeSelf,false,v=>typeof v==='boolean',w,p+'.excludeSelf')};
  return {...exclude,...(['main','event'].includes(base)?{base}:{}),side,mode:option(t.mode,['main','event'].includes(base)?'target':'primary',modes,w,p+'.mode'),range:option(t.range===undefined?'limited':t.range,'limited',['limited','unlimited'],w,p+'.range'),targetCond:predicates(t.targetCond,w,p+'.targetCond'),targetCondMode:option(t.targetCondMode===undefined?'all':t.targetCondMode,'all',['all','any'],w,p+'.targetCondMode')};
 }
 function effect(data,w,p){
  const E=get('effects'),T=get('statuses'),raw=object(data),direct=attempt(()=>E.validate(raw));if(direct)return direct.value;
  if(raw.actions!==undefined){
   let rows=list(raw.actions,[{type:'damage',amount:1}],8,w,p+'.actions');if(!rows.length){rows=[{type:'damage',amount:1}];note(w,p+'.actions');}
   let movementType;
   const actions=rows.map((entry,i)=>{
    const q=p+'.actions['+i+']',source=object(entry);if(source.actions!==undefined){note(w,q,'作用內容不可巢狀，已改為傷害 1');return {type:'damage',amount:1};}
    let action=E.payload(effect(E.payload(source),w,q));
    if(['swap','jump'].includes(action.type)){if(movementType&&movementType!==action.type){note(w,q,'互換與跳躍不能共用目標，已改為傷害 1');action={type:'damage',amount:1};}else movementType=action.type;}return action;
   });
   const type=E.searchType({actions}),representative=actions.find(a=>a.type===type),rule=effect({...representative,...raw,actions:undefined,type,amount:1},w,p);
   return E.validate({cond:rule.cond??[],condMode:rule.condMode??'all',targets:E.selectors(rule),actions});
  }
  const type=option(raw.type,'damage',['damage','heal','shield','posture','restore','advance','advanceSkill','cleanse','status','swap','jump'],w,p+'.type');
  const e={type};
  if(type==='jump'&&raw.swapFallback!==undefined)e.swapFallback=choose(raw.swapFallback,false,v=>typeof v==='boolean',w,p+'.swapFallback');
  if(!['swap','jump','cleanse'].includes(type)){
   if(['damage','heal','shield','posture','restore'].includes(type)&&raw.amount&&typeof raw.amount==='object'){
    const a=raw.amount,q=p+'.amount',m=a.multiplier===undefined?0:a.multiplier;let multiplier;
    if(m&&typeof m==='object'&&!Array.isArray(m)){const min=number(m.min,.8,0,100,0,w,q+'.multiplier.min');let max=number(m.max,1.2,0,100,0,w,q+'.multiplier.max');if(max<min){max=Math.max(min,1.2);note(w,q+'.multiplier.max','小於最小倍率，已補為合法上限');}multiplier={min,max};}
    else multiplier=number(m,0,0,100,0,w,q+'.multiplier');
    const f=a.formula===undefined?'0':a.formula,formula=attempt(()=>E.calculate(f))?f:'0';if(formula!==f)note(w,q+'.formula');
    e.amount={multiplier,formula,constant:number(a.constant===undefined?0:a.constant,0,-10000,10000,1,w,q+'.constant')};
   }else{const invalidStatusAmount=type==='status'&&(raw.amount?.multiplier!==undefined||raw.amount?.constant!==undefined);const amount=invalidStatusAmount?null:attempt(()=>E.validate({type:type==='status'?'posture':type,amount:raw.amount}));e.amount=amount?amount.value.amount:1;if(!amount)note(w,p+'.amount');}
  }
  if(raw.range!==undefined)e.range=number(raw.range,1,1,3,1,w,p+'.range');
  if(raw.when!==undefined)note(w,p+'.when','舊條件已移除，請重新設定發動條件');
  if(type==='status'){
   e.status=option(raw.status,'poison',Object.keys(T.names),w,p+'.status');e.target=option(raw.target,'self',['self','enemy'],w,p+'.target');
   const d=object(T.normalizeDuration(e.status,raw.duration)),kind=option(d.kind,'seconds',T.durationPolicy(e.status)==='attacks'?['attacks']:T.durationPolicy(e.status)==='permanent'?['permanent']:T.timed(e.status)?['seconds']:['seconds','actions'],w,p+'.duration.kind');e.duration=kind==='permanent'?{kind}:{kind,value:number(d.kind==='permanent'?1:d.value,1,1,999,kind==='seconds'?.1:1,w,p+'.duration.value')};
  }
  if(raw.targeting!==undefined||raw.conditions!==undefined||['swap','jump'].includes(type)){
   const t=object(raw.targeting),base=E.targeting(e);const side=option(t.side??base.side,base.side,type==='swap'?['ally']:type==='jump'?['enemy']:['ally','enemy'],w,p+'.targeting.side');
   const modes=Object.keys(E.targetModes).filter(mode=>!(side==='enemy'&&['self','adjacent','allLeft','allRight'].includes(mode))&&!(['swap','jump'].includes(type)&&['self','all','adjacent','allLeft','allRight'].includes(mode))&&!(side==='ally'&&mode==='opposite'));
   e.targeting={side,mode:option(t.mode??base.mode,modes.includes(base.mode)?base.mode:'primary',modes,w,p+'.targeting.mode'),filter:option(t.filter??'any','any',Object.keys(E.targetFilters),w,p+'.targeting.filter'),range:option(t.range??base.range,base.range,['limited','unlimited'],w,p+'.targeting.range')};
   if(['hasStatus','missingStatus'].includes(e.targeting.filter)){if(Object.hasOwn(T.names,t.status))e.targeting.status=t.status;else{e.targeting.filter='any';note(w,p+'.targeting.status','引用不存在的狀態，已取消此篩選');}}
   const conditions=attributes(t.conditions??raw.conditions??[],w,p+'.targeting.conditions');if(conditions.length)e.targeting.conditions=conditions;
   if(raw.conditions!==undefined)note(w,p+'.conditions','舊條件已移到 targeting.conditions');
  }
  if(raw.cond!==undefined)e.cond=list(raw.cond,[],10,w,p+'.cond').map((entry,i)=>{
   const c=object(entry),q=p+'.cond['+i+']',subject=option(c.subject,'self',['self','count'],w,q+'.subject');
   if(subject==='count')return {subject,side:option(c.side,'enemy',['ally','enemy'],w,q+'.side'),op:option(c.op,'gte',Object.keys(E.operators),w,q+'.op'),value:number(c.value,1,0,10,1,w,q+'.value'),targetCond:predicates(c.targetCond,w,q+'.targetCond'),targetCondMode:option(c.targetCondMode===undefined?'all':c.targetCondMode,'all',['all','any'],w,q+'.targetCondMode')};
   return {subject,...predicate(c,w,q)};
  });
  if(raw.condMode!==undefined)e.condMode=option(raw.condMode,'all',['all','any'],w,p+'.condMode');
  if(raw.targets!==undefined)e.targets=list(raw.targets,[],['swap','jump'].includes(type)?1:8,w,p+'.targets').map((t,i)=>searchRule(t,w,p+'.targets['+i+']',type));
  return E.validate(e);
 }
 const effects=(data,w,p)=>list(data,[],8,w,p).map((e,i)=>effect(e,w,p+'['+i+']'));
 function gainedStatusCondition(value,w,path){
  const L=get('laws'),T=get('statuses'),raw=object(value);
  const mode=option(value===undefined?'any':raw.mode,'any',Object.keys(L.statusModes),w,path+'.mode');
  if(mode!=='specified')return {mode};
  if(Object.hasOwn(T.names,raw.status))return {mode,status:raw.status};
  note(w,path+'.status','找不到指定狀態，已補為不限');
  return {mode:'any'};
 }
 function passives(data,w,path){const L=get('laws');if(data===undefined)note(w,path,'缺少角色／法則被動，預設空陣列');return list(data===undefined?[]:data,[],20,w,path).flatMap((entry,j)=>{if(['starUp','victory','travel','rest','purchase','sale'].includes(entry?.when)){note(w,path+'['+j+']','已移除非戰鬥觸發時機，略過此被動');return [];}const a=object(entry),q=path+'['+j+']',when=option(a.when,'action',L.timings,w,q+'.when'),subject=object(a.subject);return {when,...(when==='statusGained'?{statusCondition:gainedStatusCondition(a.statusCondition,w,q+'.statusCondition')}:{}),subject:{relation:option(subject.relation??(when==='allySkillResolved'?'ally':['normalDown','normalKill'].includes(when)?'enemy':'self'),when==='allySkillResolved'?'ally':['normalDown','normalKill'].includes(when)?'enemy':'self',when==='allySkillResolved'?['ally']:['normalDown','normalKill'].includes(when)?['enemy']:['swapInitiated','swapReceived'].includes(when)?['self']:['self','ally','enemy','any'],w,q+'.subject.relation'),conditions:attributes(subject.conditions??[],w,q+'.subject.conditions')},effects:effects(a.effects,w,q+'.effects')};});}
 function characters(data,w=warnings){
  const D=get('characters'),direct=attempt(()=>D.validate(data));if(direct&&['raceBonuses','rarityBonuses'].every(k=>data[k]&&Object.keys(direct.value[k]).every(key=>D.growthFields.every(f=>Object.hasOwn(data[k][key]??{},f))))&&data.items.every(x=>x.description!==undefined&&x.attack!==undefined&&x.attackRange!==undefined&&x.passives!==undefined&&x.detailImageFile!==undefined))return direct.value;
  const raw=object(data),seen=new Set(),jobGrowth=growthTable(raw.jobGrowth,w,'characters.jobGrowth');
  const raceBonuses=bonusTable(raw.raceBonuses,'race',w,'characters.raceBonuses'),rarityBonuses=bonusTable(raw.rarityBonuses,'rarity',w,'characters.rarityBonuses');
  let rows=list(raw.items,[],500,w,'characters.items');if(!rows.length){rows=[{}];note(w,'characters.items','角色庫至少需要一筆，已建立空白角色供編輯');}
  const items=rows.map((value,i)=>{const x=object(value),p='characters.items['+i+']';return {
   id:id(x.id,'recovered-character',i,seen,w,p+'.id'),name:text(x.name,'未命名角色',40,w,p+'.name'),description:choose(x.description,get('effects').description(effects(x.effects,w,p+'.effects')),v=>typeof v==='string'&&v.length<=2000,w,p+'.description'),imageFile:choose(x.imageFile,'',v=>(node?require('./character-art.js'):root.CharacterArt).validFile(v),w,p+'.imageFile'),detailImageFile:choose(x.detailImageFile,'',v=>(node?require('./character-art.js'):root.CharacterArt).validFile(v),w,p+'.detailImageFile'),
   race:option(x.race,'人類',['人類','獸人','機人'],w,p+'.race'),affinity:option(x.affinity,'物理',['物理','精神','魔法'],w,p+'.affinity'),job:option(x.job,'守護',['守護','破陣','飛襲','支援'],w,p+'.job'),rarity:option(x.rarity,'SR',['SR','SSR','UR'],w,p+'.rarity'),
   stars:number(x.stars,1,1,6,1,w,p+'.stars'),space:number(x.space,1,1,99,1,w,p+'.space'),maxHp:number(x.maxHp,1,1,10000,1,w,p+'.maxHp'),attack:number(x.attack,10,0,10000,1,w,p+'.attack'),attackRange:number(x.attackRange,Math.max(1,...(Array.isArray(x.effects)?x.effects:[]).map(e=>Number.isInteger(e?.range)&&e.range>=1&&e.range<=3?e.range:1)),1,10,1,w,p+'.attackRange'),moveDistance:number(x.moveDistance,0,0,2,1,w,p+'.moveDistance'),cooldown:number(x.cooldown,1,.1,120,.1,w,p+'.cooldown'),
   shopPrice:number(x.shopPrice,0,0,1000000,1,w,p+'.shopPrice'),shopWeight:number(x.shopWeight,0,0,1000000,1,w,p+'.shopWeight'),passives:passives(x.passives,w,p+'.passives'),movement:x.movement===undefined?get('effects').movement():searchRule(x.movement,w,p+'.movement','move'),effects:effects(x.effects,w,p+'.effects')};});
  return D.validate({version:2,jobGrowth,raceBonuses,rarityBonuses,items});
 }
 function skills(data,w=warnings){
  const S=get('skills'),direct=attempt(()=>S.validate(data));if(direct&&data.skills.every(x=>x.description!==undefined))return direct.value;const seen=new Set();
  function countCondition(value,p){
   const c=object(value),filters=list(c.filters,[],12,w,p+'.filters').map((value,i)=>{
    const f=object(value),q=p+'.filters['+i+']',field=option(f.field,'race',Object.keys(S.filterFields),w,q+'.field'),numeric=field==='stars',op=option(f.op===undefined?'eq':f.op,'eq',numeric?Object.keys(S.comparisons):['eq','ne','in','notIn'],w,q+'.op');
    const defaults={race:'人類',affinity:'物理',rarity:'SR',job:'守護',id:'missing-character',stars:1},fallback=defaults[field];
    const clean=(v,path)=>choose(v,fallback,v=>!!attempt(()=>S.filter({field,op:'eq',value:v})),w,path);
    let result;
    if(['in','notIn'].includes(op)){const rows=list(f.value,[fallback],500,w,q+'.value');if(!rows.length){rows.push(fallback);note(w,q+'.value','至少需選擇一項，已補預設值');}result=rows.map((v,j)=>clean(v,q+'.value['+j+']'));}
    else result=clean(f.value,q+'.value');
    return S.filter({field,op,value:result});
   });
   return {kind:'count',filters,filterMode:option(c.filterMode===undefined?'all':c.filterMode,'all',['all','any'],w,p+'.filterMode'),op:option(c.op,'gte',Object.keys(S.comparisons),w,p+'.op'),count:number(c.count,1,0,10,1,w,p+'.count')};
  }
  const rows=list(object(data).skills,[],500,w,'skills.skills').map((value,i)=>{const x=object(value),p='skills.skills['+i+']';
   const s={imagePath:choose(x.imagePath===undefined?'':x.imagePath,'',S.validImagePath,w,p+'.imagePath'),description:choose(x.description,get('effects').description(effects(x.effects,w,p+'.effects')),v=>typeof v==='string'&&v.length<=2000,w,p+'.description'),id:id(x.id,'recovered-skill',i,seen,w,p+'.id'),name:text(x.name,'未命名技能',60,w,p+'.name'),cooldown:number(x.cooldown,1,.1,120,.1,w,p+'.cooldown'),mode:option(x.mode,'all',['all','any'],w,p+'.mode'),effects:effects(x.effects,w,p+'.effects'),conditions:[]};
   s.conditions=list(x.conditions,[],12,w,p+'.conditions').flatMap((c,j)=>{if(c?.kind==='count'&&(c.filters!==undefined||c.filterMode!==undefined))return [countCondition(c,p+'.conditions['+j+']')];const result=attempt(()=>S.validate({version:1,skills:[{...s,conditions:[c]}]}));if(result)return result.value.skills[0].conditions;note(w,p+'.conditions['+j+']','無效條件已略過');return [];});return s;});return S.validate({version:1,skills:rows});
 }
 function statuses(data,w=warnings){
  const T=get('statuses'),direct=attempt(()=>T.validateLibrary(data));if(direct)return direct.value;const seen=new Set();
  const rows=list(object(data).statuses,[],200,w,'statuses.statuses').map((value,i)=>{const x=object(value),p='statuses.statuses['+i+']';let rules=list(x.effects,[{behavior:'power',value:0}],8,w,p+'.effects');if(!rules.length){rules=[{behavior:'power',value:0}];note(w,p+'.effects');}
   return {id:id(x.id,'recovered-status',i,seen,w,p+'.id'),name:text(x.name,'未命名狀態',40,w,p+'.name'),description:choose(x.description===undefined?'':x.description,'',v=>typeof v==='string'&&v.length<=2000,w,p+'.description'),imagePath:choose(x.imagePath===undefined?'':x.imagePath,'',T.validImagePath,w,p+'.imagePath'),classification:option(x.classification===undefined?T.defaultClassification(x.id):x.classification,T.defaultClassification(x.id),Object.keys(T.classifications),w,p+'.classification'),enhanced:choose(x.enhanced===undefined?Object.hasOwn(T.enhancedKinds,x.id):x.enhanced,Object.hasOwn(T.enhancedKinds,x.id),v=>typeof v==='boolean'&&(!Object.hasOwn(T.enhancedKinds,x.id)||v),w,p+'.enhanced'),effects:rules.map((r,j)=>{r=object(r);const path=p+'.effects['+j+']',behavior=option(r.behavior,'power',Object.keys(T.behaviors),w,path+'.behavior');if(behavior==='taunt'){if(r.value!==1||r.scale!==undefined||r.formula!==undefined)note(w,path,'嘲諷固定啟用，已補為固定值 1');return {behavior,value:1};}if(r.formula!==undefined){const valid=attempt(()=>get('effects').calculate(r.formula));if(valid)return {behavior,formula:r.formula};note(w,path+'.formula','公式無效，改用固定值 0');return {behavior,value:0};}const key=r.scale!==undefined?'scale':'value';return {behavior,[key]:number(r[key],0,0,10000,0,w,path+'.'+key)};})};});
  for(const d of rows)if(d.enhanced&&d.effects.some(e=>['taunt','dodge','haste','fatigue'].includes(e.behavior))){d.effects=Object.hasOwn(T.enhancedKinds,d.id)?[{behavior:T.enhancedKinds[d.id],scale:1}]:d.effects;if(!Object.hasOwn(T.enhancedKinds,d.id))d.enhanced=false;note(w,'statuses.'+d.id+'.enhanced','已修復與持續時間限制衝突的強化設定');}
  for(const d of T.defaults)if(!seen.has(d.id)){rows.push(clone(d));note(w,'statuses.'+d.id,'缺少內建狀態，已補入預設');}
  // Reserve room for mandatory built-ins while keeping every representable definition.
  if(rows.length>200){const builtin=new Set(T.defaults.map(x=>x.id));const kept=rows.filter(x=>builtin.has(x.id)).concat(rows.filter(x=>!builtin.has(x.id)).slice(0,200-builtin.size));note(w,'statuses.statuses','超過 200 筆，已保留內建狀態及上限內自訂狀態');return T.validateLibrary({version:1,statuses:kept});}
  return T.validateLibrary({version:1,statuses:rows});
 }
 function laws(data,w=warnings,p='laws.laws',options={}){
  const L=get('laws'),source=Array.isArray(data)?data:object(data).laws,direct=attempt(()=>L.validate(source,options));if(direct)return {version:1,laws:direct.value};const seen=new Set();
  const rows=list(source,[],options.allowDuplicates?Infinity:100,w,p).map((value,i)=>{const x=object(value),path=p+'['+i+']';return {id:id(x.id,'recovered-law',i,options.allowDuplicates?new Set():seen,w,path+'.id'),name:text(x.name,'未命名法則',40,w,path+'.name'),description:choose(x.description===undefined?'':x.description,'',v=>typeof v==='string'&&v.length<=2000,w,path+'.description'),imagePath:choose(x.imagePath===undefined?'':x.imagePath,'',L.validImagePath,w,path+'.imagePath'),shopPrice:number(x.shopPrice,50,0,1000000,1,w,path+'.shopPrice'),shopWeight:number(x.shopWeight,100,0,1000000,1,w,path+'.shopWeight'),stats:growth(x.stats,w,path+'.stats'),passives:passives(x.passives,w,path+'.passives')};});return {version:1,laws:L.validate(rows,options)};
 }
 function slots(data,items,w,p){
  if(!Array.isArray(data)||data.length!==10)note(w,p,'已補齊為十格空位');const source=Array.isArray(data)?data:[],occupied=new Set();
  return Array.from({length:10},(_,i)=>{const value=source[i];if(value===null||value===undefined||value==='')return null;
   const unit=items.find(u=>u.id===value);if(!unit||!Number.isInteger(unit.space)||unit.space<1||i+unit.space>10||Array.from({length:unit.space},(_,j)=>i+j).some(n=>occupied.has(n))){note(w,p+'['+i+']','引用失效、重疊或超界，該起始格已設為空位');return null;}
   for(let n=i;n<i+unit.space;n++)occupied.add(n);return value;});
 }
 function enemies(data,w=warnings,items=get('characters').defaults,skillDefinitions){
  const E=get('enemies'),seen=new Set();const rows=list(object(data).teams,[],300,w,'enemies.teams').map((value,i)=>{const x=object(value),p='enemies.teams['+i+']',board=slots(x.slots,items,w,p+'.slots');
   const team={id:id(x.id,'recovered-team',i,seen,w,p+'.id'),name:text(x.name,'未命名敵隊',40,w,p+'.name'),category:option(x.category,'normal',Object.keys(E.categories),w,p+'.category'),matchLevel:number(x.matchLevel,1,1,1000000,1,w,p+'.matchLevel'),weight:number(x.weight,0,0,1000000,1,w,p+'.weight'),slots:board,stars:[],laws:[]};
   team.skillId=choose(x.skillId,null,v=>v===null||typeof v==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(v),w,p+'.skillId');
   if(team.skillId!==null&&skillDefinitions&&!skillDefinitions.some(skill=>skill.id===team.skillId)){team.skillId=null;note(w,p+'.skillId','極式引用失效，已設為無極式');}
   for(let n=0;n<10;n++){const u=items.find(u=>u.id===board[n]),star=x.stars?.[n];team.stars[n]=u&&star!=null?number(star,u.stars,u.stars,6,1,w,p+'.stars['+n+']'):null;team.laws[n]=u?laws(x.laws?.[n]??[],w,p+'.laws['+n+']',{allowDuplicates:true}).laws:[];}
   if(!board.some(Boolean)&&team.weight!==0){team.weight=0;note(w,p+'.weight','空隊伍已停用抽選，請在敵隊編輯器補入角色');}return team;});return E.validate({version:1,teams:rows});
 }
 function config(data,w=warnings,items){
  // Config fields, including rarity star-sale bonuses, repair independently; preserve valid zeroes.
  const C=get('config'),x=object(data),out={version:1};for(const [k,id,label,d,min,max,step] of C.fields)out[k]=number(x[k],d,min,max,step,w,'config.'+k);
  // The old overtime amount was also its growth increment.
  if(x.overtimeGrowth===undefined&&Number.isInteger(x.overtimeDamage)&&x.overtimeDamage>0&&x.overtimeDamage<=10000)out.overtimeGrowth=x.overtimeDamage;
  if(items)out.startingActive=slots(x.startingActive,items,w,'config.startingActive');
  else{if(!Array.isArray(x.startingActive)||x.startingActive.length!==10)note(w,'config.startingActive','缺少初始編隊，已補為十格空位');out.startingActive=Array.from({length:10},(_,i)=>{const v=x.startingActive?.[i];if(v==null)return null;if(typeof v==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(v))return v;note(w,'config.startingActive['+i+']');return null;});}
  return C.validate(out,items);
 }
 function map(data,w=warnings){
  const H=get('map'),x=object(data),radius=number(x.radius,4,2,6,1,w,'map.radius'),seed=text(x.seed,'MINIMAJO',60,w,'map.seed'),base=H.defaults(radius),r=object(x.rules),q=object(r.quotas),decay=object(x.rewardDecay),rules={quotas:{}};
  for(const k of Object.keys(base.quotas))rules.quotas[k]=number(q[k],k==='fragile'?0:base.quotas[k],0,1+3*radius*(radius+1)-2,1,w,'map.rules.quotas.'+k);
  for(const k of ['eliteSpacing','restSpacing','shopSpacing','supplySpacing','safeRadius'])rules[k]=number(r[k],base[k],0,12,1,w,'map.rules.'+k);
  let previous=100;const stages=list(decay.stages===undefined?H.decayDefaults.stages:decay.stages,H.decayDefaults.stages,10,w,'map.rewardDecay.stages').map((entry,i)=>{const row=object(entry),p='map.rewardDecay.stages['+i+']';let tier=option(row.tier,H.decayDefaults.stages[i]?.tier??'none',Object.keys(H.rewardTiers),w,p+'.tier');if(H.rewardTiers[tier].moneyPercent>previous){tier=Object.keys(H.rewardTiers).find(k=>H.rewardTiers[k].moneyPercent===previous);note(w,p+'.tier','獎勵不能回升，已維持前階級');}previous=H.rewardTiers[tier].moneyPercent;return {after:number(row.after,H.decayDefaults.stages[i]?.after??1,1,999,1,w,p+'.after'),tier};});
  if(x.rewardDecay===undefined)note(w,'map.rewardDecay','使用預設獎勵衰減階段；探索警戒已移除');
  const out={version:1,radius,seed,rules,rewardDecay:H.validateDecay({enabled:choose(decay.enabled===undefined?true:decay.enabled,true,v=>typeof v==='boolean',w,'map.rewardDecay.enabled'),stages})};
  if(!attempt(()=>H.generate(radius,seed,rules))){out.rules=base;note(w,'map.rules','配額與間距組合無法生成，已套用此半徑的預設規則；原始設定仍在原檔');if(!attempt(()=>H.generate(radius,seed,base))){out.seed='MINIMAJO';note(w,'map.seed','此種子無法生成預設規則，使用預設種子');}}
  return out;
 }
 function echo(data,w=warnings){
  const E=get('echo'),source=object(data).levels;
  let levels;
  if(!Array.isArray(source)||!source.length){note(w,'echo.levels','缺少或無效等級表，使用預設六級');levels=clone(E.defaults.levels);}
  else levels=list(source,[],100,w,'echo.levels').map((row,i)=>{
   const fallback=E.defaults.levels[i]??E.defaults.levels.at(-1),clean={};
   for(const rarity of E.rarities)clean[rarity]=number(object(row)[rarity],fallback[rarity],0,1000000,1,w,'echo.levels['+i+'].'+rarity);
   if(!E.rarities.some(r=>clean[r]>0)){clean.SR=100;note(w,'echo.levels['+i+']','全部權重為 0，已將 SR 補為 100 以恢復抽選');}return clean;
  });
  return E.validate({version:1,levels});
 }
 function capacity(data,w=warnings){return Array.from({length:2},(_,i)=>number(data?.[i],10,1,10,1,w,'capacity['+i+']'));}
 function parse(storage,key,w){const raw=storage?.getItem(key);if(raw==null)return undefined;try{return JSON.parse(raw);}catch{note(w,key,'JSON 無法解析，此區暫用預設；原始瀏覽器資料未覆寫');return undefined;}}
 function read(kind,storage,w=warnings,overrideItems){
  const raw=parse(storage,keys[kind],w);
  if(kind==='echo')return echo(raw??get('echo').defaults,w);
  if(kind==='characters')return characters(raw??{version:2,items:get('characters').defaults},w);
  if(kind==='skills')return skills(raw??{version:1,skills:get('skills').defaults},w);
  if(kind==='statuses')return statuses(raw??{version:1,statuses:get('statuses').defaults},w);
  if(kind==='laws')return laws(raw??{version:1,laws:[]},w);
  if(kind==='config'||kind==='enemies'){const items=overrideItems??read('characters',storage,w).items;return kind==='config'?config(raw??get('config').defaults,w,items):enemies(raw??get('enemies').defaults(items),w,items,read('skills',storage,w).skills);}
  if(kind==='capacity')return capacity(raw??[10,10],w);
  if(kind==='map'){if(raw===undefined){const H=get('map'),m=H.generate();return {version:1,radius:m.radius,seed:m.seed,rules:m.rules,rewardDecay:H.validateDecay()};}return map(raw,w);}
  throw Error('未知資料區域：'+kind);
 }
 const api={warnings,keys,read,echo,characters,skills,statuses,laws,enemies,config,map,capacity};if(node)module.exports=api;else root.SavedData=api;
})(globalThis);
