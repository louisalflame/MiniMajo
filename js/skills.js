(function(root){
  const EffectRules=typeof module!=='undefined'?require('./effects.js'):root.Effects;
  const fields=typeof module!=='undefined'?require('./enums.js'):root.CharacterEnums;
  const effects=['damage','shield','heal','posture','restore'];
  const base={物理:{name:'破陣突擊',effects:[{type:'damage',amount:32},{type:'posture',amount:20}]},精神:{name:'凝神反擊',effects:[{type:'damage',amount:20},{type:'restore',amount:35}]},魔法:{name:'奧術爆發',effects:[{type:'damage',amount:48}]}};
  const bonus={人類:{type:'heal',amount:12},獸人:{type:'posture',amount:15},機人:{type:'shield',amount:18}};
  const defaults=Object.keys(base).flatMap((affinity,a)=>Object.keys(bonus).map((race,r)=>({id:`skill-${a}-${r}`,name:`${base[affinity].name}・${race}`,cooldown:8,mode:'all',conditions:[{kind:'majority',field:'affinity',value:affinity},{kind:'majority',field:'race',value:race}],effects:[...base[affinity].effects,bonus[race]]})));
  defaults.forEach(skill=>{skill.description=EffectRules.description(skill.effects);skill.imagePath='';});
  function selector(x){
    if(!x||!['race','affinity','id','rarity','job','stars'].includes(x.field)||typeof x.value!=='string'||!x.value.trim()||x.value.length>80||fields[x.field]&&!fields[x.field].includes(x.value))throw Error('條件需指定有效的種族、類型、角色 ID、星等、階級或職業。');
    return {field:x.field,value:x.value.trim()};
  }
 const filterFields={race:'種族',affinity:'戰鬥類型',id:'指定角色',rarity:'階級',job:'職業',stars:'星等'};
 const comparisons={eq:'等於',ne:'不等於',gt:'大於',gte:'不小於',lt:'小於',lte:'不大於'};
 function filter(x){
  if(!x||!Object.hasOwn(filterFields,x.field))throw Error('角色篩選欄位無效。');
  const op=x.op===undefined?'eq':x.op,allowed=x.field==='stars'?Object.keys(comparisons):['eq','ne','in','notIn'];
  if(!allowed.includes(op))throw Error('角色篩選比較方式無效。');
  const valid=v=>x.field==='stars'?Number.isInteger(v)&&v>=1&&v<=6:typeof v==='string'&&!!v.trim()&&v.length<=80&&(!fields[x.field]||fields[x.field].includes(v));
  if(['in','notIn'].includes(op)){
   if(!Array.isArray(x.value)||!x.value.length||x.value.length>500||!x.value.every(valid))throw Error('請選擇有效的角色篩選值，至少一項。');
   return {field:x.field,op,value:[...new Set(x.value.map(v=>v.trim()))]};
  }
  if(!valid(x.value))throw Error('角色篩選值無效。');
  return {field:x.field,op,value:typeof x.value==='string'?x.value.trim():x.value};
 }
 function filterMatches(item,f){
  if(!item)return false;
  const value=f.field==='stars'?Number(item.stars):item[f.field];
  if(f.op==='in'||f.op==='notIn')return f.op==='in'?f.value.includes(value):!f.value.includes(value);
  return EffectRules.compare(value,f.op,f.value);
 }
 function validImagePath(value){
  return typeof value==='string'&&value.length<=240&&(value.trim()===''||(!/[\\:*?"<>|#%\u0000-\u001f]/.test(value)&&!value.startsWith('/')&&value.split('/').every(part=>part.trim()!==''&&!['.','..'].includes(part))&&/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(value.trim())));
 }
  function validate(data){
    if(!data||data.version!==1||!Array.isArray(data.skills)||data.skills.length>500)throw Error('極式資料需要 version: 1 與 skills 陣列（最多 500 筆）。');
    const ids=new Set();
    return {version:1,skills:data.skills.map(x=>{
      if(!x||typeof x.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(x.id)||ids.has(x.id))throw Error('極式 ID 必須唯一且使用英數字、底線或連字號。');ids.add(x.id);
      if(typeof x.name!=='string'||!x.name.trim()||x.name.length>60)throw Error('極式名稱需為 1～60 字。');
      if(!Number.isFinite(x.cooldown)||x.cooldown<.1||x.cooldown>120||Math.abs(x.cooldown*10-Math.round(x.cooldown*10))>1e-8)throw Error('CD 需為 0.1～120 秒，以 0.1 秒為單位。');
      if(!['all','any'].includes(x.mode)||!Array.isArray(x.conditions)||x.conditions.length>12)throw Error('條件需為全部／任一成立，最多 12 條。');
      if(!Array.isArray(x.effects)||x.effects.length>8)throw Error('極式需有 1～8 個效果。');
      const cleanEffects=x.effects.map(e=>EffectRules.validate(e,{allowAttack:false}));
      const imagePath=x.imagePath===undefined?'':x.imagePath;
      if(!validImagePath(imagePath))throw Error('極式圖案請填專案內的相對圖片路徑，可留空。');
      const description=x.description===undefined?EffectRules.description(cleanEffects):x.description;
      if(typeof description!=='string'||description.length>2000)throw Error('極式說明需為最多 2000 字的文字，可留空。');
      const conditions=x.conditions.map(c=>{
        if(c?.kind==='count'&&c.filters!==undefined){
          if(!Object.hasOwn(comparisons,c.op)||!Number.isInteger(c.count)||c.count<0||c.count>10)throw Error('數量需為 0～10，並選擇比較方式。');
          if(!Array.isArray(c.filters)||c.filters.length>12||!['all','any'].includes(c.filterMode??'all'))throw Error('角色篩選最多 12 條，需指定全部／任一符合。');
          return {kind:'count',op:c.op,count:c.count,filterMode:c.filterMode??'all',filters:c.filters.map(filter)};
        }
        const selected=selector(c);
        if(c.kind==='majority'){if(!fields[c.field])throw Error('多數條件僅支援固定分類。');return {kind:c.kind,...selected};}
        if(c.kind==='count'){if(!['gte','eq','lte'].includes(c.op)||!Number.isInteger(c.count)||c.count<0||c.count>10)throw Error('數量需為 0～10，並選擇比較方式。');return {kind:c.kind,...selected,op:c.op,count:c.count};}
        if(c.kind==='slot'){if(!Number.isInteger(c.slot)||c.slot<1||c.slot>10)throw Error('站位需為 1～10。');return {kind:c.kind,...selected,slot:c.slot};}
        if(c.kind==='before')return {kind:c.kind,...selected,other:selector(c.other)};
        throw Error('不支援的條件類型。');
      });
      return {id:x.id,name:x.name.trim(),cooldown:x.cooldown,mode:x.mode,conditions,description,imagePath:imagePath.trim(),effects:cleanEffects};
    })};
  }
  function matches(item,filter){return !!item&&(String(item[filter.field])===filter.value);}
  function majority(items,field){const counts={};items.filter(Boolean).forEach(x=>counts[x[field]]=(counts[x[field]]||0)+1);let best;items.filter(Boolean).forEach(x=>{if(!best||counts[x[field]]>counts[best])best=x[field];});return best;}
  function condition(items,c){
    if(c.kind==='count'&&c.filters!==undefined){
      const count=items.filter(x=>x&&(!c.filters.length||(c.filterMode==='any'?c.filters.some(f=>filterMatches(x,f)):c.filters.every(f=>filterMatches(x,f))))).length;
      return EffectRules.compare(count,c.op,c.count);
    }
    if(c.kind==='majority')return String(majority(items,c.field))===c.value;
    if(c.kind==='slot')return matches(items[c.slot-1],c);
    if(c.kind==='before')return items.some((x,i)=>matches(x,c)&&items.some((y,j)=>j>i&&matches(y,c.other)));
    const count=items.filter(x=>matches(x,c)).length;return c.op==='gte'?count>=c.count:c.op==='lte'?count<=c.count:count===c.count;
  }
  function evaluate(items,skills){return skills.map((skill,index)=>{const checks=skill.conditions.map(c=>condition(items,c));return {skill,index,checks,matched:items.some(Boolean)&&(checks.length===0|| (skill.mode==='all'?checks.every(Boolean):checks.some(Boolean)))};});}
  function choose(items,skills=defaults){const hit=evaluate(items,skills).find(x=>x.matched);return hit?{...JSON.parse(JSON.stringify(hit.skill)),enabled:true}:{name:'無符合的極式',effects:[],cooldown:0,enabled:false};}
  const api={filterFields,comparisons,filter,filterMatches,validImagePath,read:(storage,warnings)=>(typeof module!=='undefined'?require('./saved-data.js'):root.SavedData).read('skills',storage,warnings),load:(data,warnings,...args)=>(typeof module!=='undefined'?require('./saved-data.js'):root.SavedData).skills(data,warnings,...args),defaults,validate,evaluate,choose,condition};if(typeof module!=='undefined')module.exports=api;else root.SkillDB=api;
})(globalThis);
