(function(root){
 const names={poison:'中毒',regen:'再生',confusion:'混亂',calm:'鎮靜',counter:'反擊',stun:'僵直',power:'強化',weakness:'虛弱',hard:'堅硬',fragile:'脆弱',haste:'急速',fatigue:'倦怠',rage:'激怒'};
 const enhancedKinds={enhancedPoison:'poison',enhancedRegen:'regen',enhancedPower:'power',enhancedWeakness:'weakness',enhancedHard:'hard',enhancedFragile:'fragile'};
 names.taunt='嘲諷';names.dodge='閃避';for(const [id,base] of Object.entries(enhancedKinds))names[id]='強化'+names[base];
 const behaviors={taunt:'普通行動優先瞄準射程內的嘲諷者（仍須符合目標條件）',dodge:'完全迴避一次敵方普通攻擊',poison:'每秒扣除 HP（穿盾）',regen:'每秒恢復 HP',confusion:'每秒增加失衡',calm:'每秒降低失衡',counter:'受到普通攻擊時反擊',stun:'停止行動與技能',power:'增加傷害攻擊力',weakness:'降低傷害攻擊力',healing:'增加治療攻擊力',healingWeakness:'降低治療攻擊力',hard:'增加護盾攻擊力',fragile:'降低護盾攻擊力',haste:'增加行動速度',fatigue:'降低行動速度',rage:'受到攻擊時推進行動進度（秒）'};
 const classifications={positive:'正面',negative:'負面',neutral:'中性'};
 function defaultClassification(id){
  const base=enhancedKinds[id]??id;
  if(['poison','confusion','stun','weakness','fragile','fatigue'].includes(base))return 'negative';
  if(['regen','calm','counter','power','hard','haste','rage','taunt','dodge'].includes(base))return 'positive';
  return 'neutral';
 }
 const defaults=Object.entries(names).map(([id,name])=>({id,name,classification:defaultClassification(id),description:'',imagePath:'',enhanced:Object.hasOwn(enhancedKinds,id),effects:[{behavior:enhancedKinds[id]??id,...(['taunt','dodge','stun','haste','fatigue','rage'].includes(id)?{value:['taunt','dodge','stun','rage'].includes(id)?1:.5}:{scale:1})}]}));
 let definitions=structuredClone(defaults);
 function validImagePath(value){
  return typeof value==='string'&&value.length<=240&&(value.trim()===''||(!/[\\:*?"<>|#%\u0000-\u001f]/.test(value)&&!value.startsWith('/')&&value.split('/').every(part=>part.trim()!==''&&!['.','..'].includes(part))&&/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(value.trim())));
 }
 function validateLibrary(data){
  if(data?.version!==1||!Array.isArray(data.statuses)||data.statuses.length>200)throw Error('狀態庫需為 version 1，最多 200 筆。');const ids=new Set();
  const statuses=data.statuses.map(d=>{if(!d||typeof d.id!=='string'||! /^[a-zA-Z0-9_-]{1,80}$/.test(d.id)||ids.has(d.id)||typeof d.name!=='string'||!d.name.trim()||d.name.length>40||!Array.isArray(d.effects)||!d.effects.length||d.effects.length>8)throw Error('狀態 ID、名稱或效果設定無效。');ids.add(d.id);
   const description=d.description===undefined?'':d.description,imagePath=d.imagePath===undefined?'':d.imagePath;
   if(typeof description!=='string'||description.length>2000)throw Error('狀態敘述最多 2000 字，可留空。');
   if(!validImagePath(imagePath))throw Error('狀態圖案請填專案內的相對圖片路徑，可留空。');
   const classification=d.classification===undefined?defaultClassification(d.id):d.classification;
   if(!Object.hasOwn(classifications,classification))throw Error('狀態分類無效。');
   const enhanced=d.enhanced===undefined?Object.hasOwn(enhancedKinds,d.id):d.enhanced;if(typeof enhanced!=='boolean'||Object.hasOwn(enhancedKinds,d.id)&&!enhanced)throw Error('強化狀態標記無效。');
   if(enhanced&&d.effects.some(e=>['taunt','dodge','haste','fatigue'].includes(e.behavior)))throw Error('強化狀態不可包含嘲諷、閃避或限秒數的速度規則。');
   return {id:d.id,name:d.name.trim(),description,imagePath:imagePath.trim(),classification,enhanced,effects:d.effects.map(e=>{if(!Object.hasOwn(behaviors,e.behavior))throw Error('狀態效果種類無效。');if(e.behavior==='taunt'){if(e.value!==1||e.scale!==undefined||e.formula!==undefined)throw Error('嘲諷規則固定為啟用，無須設定數值、倍率或公式。');return {behavior:'taunt',value:1};}if(e.formula!==undefined){const E=typeof module!=='undefined'?require('./effects.js'):root.Effects;E.calculate(e.formula);return {behavior:e.behavior,formula:e.formula};}const key=e.scale!==undefined?'scale':'value',n=e[key];if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>10000)throw Error('狀態數值需為 0～10000。');return {behavior:e.behavior,[key]:n};})};});
  for(const d of defaults)if(!ids.has(d.id))throw Error('需保留內建狀態：'+d.name);return {version:1,statuses};
 }
 function configure(data){const next=validateLibrary(data);definitions=next.statuses;Object.keys(names).forEach(k=>delete names[k]);definitions.forEach(d=>names[d.id]=d.name);}
 const snapshot=()=>({version:1,statuses:structuredClone(definitions)});
 const classification=kind=>definitions.find(d=>d.id===kind)?.classification??'neutral';
 const imagePath=kind=>definitions.find(d=>d.id===kind)?.imagePath??'';
 const rules=kind=>definitions.find(d=>d.id===kind)?.effects??[];
 function policy(def){if(def?.effects?.some(e=>e.behavior==='dodge'))return 'attacks';if(def?.enhanced)return 'permanent';if(def?.effects?.some(e=>['haste','fatigue'].includes(e.behavior)))return 'seconds';return 'free';}
 const durationPolicy=kind=>policy(definitions.find(d=>d.id===kind));
 function policyLabel(def){const p=policy(def);return (def?.enhanced?'強化狀態：施加數值累加；':'一般狀態：同名覆蓋數值並刷新；')+({attacks:'持續固定為 1 次敵方普通攻擊，不疊層',permanent:'持續固定為永久，無須設定時間',seconds:'持續時間僅限秒數',free:'持續時間可設秒數或角色行動次數'}[p]);}
 function normalizeDuration(kind,d){const p=durationPolicy(kind);return p==='attacks'?{kind:'attacks',value:1}:p==='permanent'?{kind:'permanent'}:d;}
 const fixed=kind=>!rules(kind).some(e=>e.scale!==undefined);
 const timed=kind=>rules(kind).some(e=>['haste','fatigue'].includes(e.behavior));
 function value(e,x,u){if(e.formula!==undefined){const E=typeof module!=='undefined'?require('./effects.js'):root.Effects;const values={time:0};for(const side of ['self','enemy','target'])for(const k of ['hp','maxHp','shield','posture'])values[side+'.'+k]=u[k]??0;for(const side of ['self','enemy','target']){values[side+'.missingHp']=(u.maxHp??0)-(u.hp??0);values[side+'.attack']=u.attack??10;}return Math.max(0,Math.min(10000,E.calculate(e.formula,values))); }return e.scale!==undefined?x.amount*e.scale:e.value;}
 function amount(x,kind,u){return (x.rules??rules(x.kind)).filter(e=>e.behavior===kind).reduce((n,e)=>n+(['haste','fatigue','rage'].includes(kind)?value(e,x,u):Math.round(value(e,x,u))),0);}
 const active=(u,kind)=>(u.statuses||[]).some(x=>amount(x,kind,u)>0);
 function validate(e){
  if(!Object.hasOwn(names,e.status)||!['self','enemy'].includes(e.target))throw Error('請指定有效狀態與目標。');
  const d=normalizeDuration(e.status,e.duration);if(d?.kind==='permanent'&&durationPolicy(e.status)!=='permanent')throw Error('一般狀態請使用秒數或角色行動次數。');if(!d||!['permanent','seconds','actions','attacks'].includes(d.kind)||d.kind==='attacks'&&durationPolicy(e.status)!=='attacks')throw Error('請設定狀態持續時間。');
  if(d.kind!=='permanent'&&(!Number.isFinite(d.value)||d.value<1||d.value>999||d.kind==='actions'&&!Number.isInteger(d.value)||d.kind==='seconds'&&Math.abs(d.value*10-Math.round(d.value*10))>1e-8))throw Error('持續時間需為 1～999 秒（0.1 秒單位）或整數次行動。');
  if(timed(e.status)&&d.kind!=='seconds')throw Error('急速／倦怠使用秒數設定持續時間。');
  return {status:e.status,target:e.target,duration:d.kind==='permanent'?{kind:d.kind}:{kind:d.kind,value:d.value}};
 }
 function apply(u,e,amount,tick){e={...e,duration:normalizeDuration(e.status,e.duration)};const previous=(u.statuses||[]).find(x=>x.kind===e.status);const entry={kind:e.status,rules:structuredClone(rules(e.status)),amount:durationPolicy(e.status)==='permanent'?(previous?.amount??0)+amount:amount,appliedAt:tick,until:e.duration.kind==='seconds'?tick+Math.round(e.duration.value*10):null,remaining:e.duration.kind==='actions'?e.duration.value:null,attacks:e.duration.kind==='attacks'?1:null,nextPulse:previous?.nextPulse??tick+10,skipAt:tick+Math.round(u.cooldown*10)};u.statuses=u.statuses||[];u.statuses=u.statuses.filter(x=>x.kind!==e.status);u.statuses.push(entry);return entry;}
 const sum=(u,kind)=>(u.statuses||[]).reduce((n,x)=>n+amount(x,kind,u),0);
 const has=(u,kind)=>(u.statuses||[]).some(x=>x.kind===kind);
 const speed=u=>Math.max(0,Math.min(10,1+sum(u,'haste')-sum(u,'fatigue')));
 function actionEnd(u,eligible){u.statuses=(u.statuses||[]).filter(x=>{if(eligible.includes(x)&&x.remaining!==null&&!amount(x,'stun',u))x.remaining--;return x.remaining===null||x.remaining>0;});}
 function label(x,tick){return names[x.kind]+(fixed(x.kind)?'':x.amount)+' · '+(x.attacks!=null?x.attacks+'次敵方普通攻擊':x.until!==null?Math.max(0,(x.until-tick)/10).toFixed(1)+'秒':x.remaining!==null?x.remaining+'次行動':'永久');}
 const api={imagePath,classifications,defaultClassification,classification,enhancedKinds,policy,policyLabel,durationPolicy,normalizeDuration,validImagePath,read:(storage,warnings)=>(typeof module!=='undefined'?require('./saved-data.js'):root.SavedData).read('statuses',storage,warnings),load:(data,warnings,...args)=>(typeof module!=='undefined'?require('./saved-data.js'):root.SavedData).statuses(data,warnings,...args),behaviors,defaults,validateLibrary,configure,snapshot,rules,fixed,timed,amount,active,names,validate,apply,sum,has,speed,actionEnd,label};if(typeof module!=='undefined')module.exports=api;else root.Statuses=api;
})(globalThis);
