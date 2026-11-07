(function(root){
 const D=typeof module!=='undefined'?require('./database.js'):root.ItemDB,E=typeof module!=='undefined'?require('./effects.js'):root.Effects,Status=typeof module!=='undefined'?require('./statuses.js'):root.Statuses;
 const timings=['action','attacked','heal','healed','shield','shielded','down','death','move','swapInitiated','swapReceived','playerSkill','dodged','normalDown','normalKill','normalHit','statusGained','swapped','allySkillResolved'];
 const labels=['角色行動時','被攻擊時','發動治療時','被治療時','發動疊盾時','被疊盾時','倒地時','死亡時','移動位置時','自身主動互換位置時','自身被互換位置時','我方使用極式時','角色閃避成功時','自身普通行動使敵人倒地時','自身普通行動擊殺敵人時','普通攻擊命中敵人時','獲得狀態時','互換位置時','我方極式結算後'];
 const statusModes={any:'不限',positive:'正面',negative:'負面',specified:'指定狀態'};
 function statusCondition(value={mode:'any'}){
  if(!value||!Object.hasOwn(statusModes,value.mode))throw Error('狀態條件無效。');
  if(value.mode==='specified'){
   if(!Object.hasOwn(Status.names,value.status))throw Error('請選擇有效的指定狀態。');
   return {mode:value.mode,status:value.status};
  }
  return {mode:value.mode};
 }
 const battleTimings=[...timings];
 function validImagePath(value){
  return typeof value==='string'&&value.length<=240&&(value.trim()===''||(!/[\\:*?"<>|#%\u0000-\u001f]/.test(value)&&!value.startsWith('/')&&value.split('/').every(part=>part.trim()!==''&&!['.','..'].includes(part))&&/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(value.trim())));
 }
 function validate(laws,{allowDuplicates=false}={}){
  if(!Array.isArray(laws)||(!allowDuplicates&&laws.length>100))throw Error('法則需為陣列；法則庫最多 100 筆定義。');const ids=new Set();
  return laws.map(l=>{
   if(!l||typeof l.id!=='string'||! /^[a-zA-Z0-9_-]{1,80}$/.test(l.id)||(!allowDuplicates&&ids.has(l.id))||typeof l.name!=='string'||!l.name.trim()||l.name.length>40)throw Error('法則 ID／名稱無效或重複。');ids.add(l.id);
   for(const f of ['shopPrice','shopWeight'])if(!Number.isInteger(l[f])||l[f]<0||l[f]>1000000)throw Error('法則售價與出現權重需為 0～1000000 的整數。');
   const description=l.description===undefined?'':l.description,imagePath=l.imagePath===undefined?'':l.imagePath;
   if(typeof description!=='string'||description.length>2000)throw Error('法則敘述最多 2000 字，可留空。');
   if(!validImagePath(imagePath))throw Error('法則圖案請填專案內的相對圖片路徑，可留空。');
   const stats=D.validateGrowth({守護:Array(5).fill(l.stats??{})}).守護[0];
   const passives=validatePassives(l.passives);return {id:l.id,name:l.name.trim(),description,imagePath:imagePath.trim(),shopPrice:l.shopPrice,shopWeight:l.shopWeight,stats,passives};
  });
 }
 function validatePassives(data,{allowAttack=false}={}){
   if(!Array.isArray(data===undefined?[]:data)||(data===undefined?[]:data).length>20)throw Error('法則被動最多 20 筆。');
   return (data??[]).map(p=>{
    if(!timings.includes(p.when)||!Array.isArray(p.effects)||p.effects.length>8)throw Error('法則觸發時機／效果無效。');
    const subject=p.subject??{relation:p.when==='allySkillResolved'?'ally':['normalDown','normalKill'].includes(p.when)?'enemy':'self',conditions:[]};
    if(!['self','ally','enemy','any'].includes(subject.relation)||!Array.isArray(subject.conditions)||subject.conditions.length>10)throw Error('法則角色條件無效。');
    if(['swapInitiated','swapReceived'].includes(p.when)&&subject.relation!=='self')throw Error('自身互換時機的事件角色需為法則持有者自己。');
    if(['normalDown','normalKill'].includes(p.when)&&subject.relation!=='enemy')throw Error('普通行動倒地／擊殺時機的事件角色固定為被命中的敵人。');
    if(p.when==='allySkillResolved'&&subject.relation!=='ally')throw Error('極式結算事件限同陣營。');
    const conditions=subject.conditions.map(c=>{const allowed={race:['人類','獸人','機人'],affinity:['物理','精神','魔法'],job:['守護','破陣','飛襲','支援'],rarity:['SR','SSR','UR'],stars:[1,2,3,4,5,6]};if(!allowed[c.field]?.includes(c.value))throw Error('法則條件需使用種族、類型、職業、階級或星數的有效值。');return {field:c.field,value:c.value};});
    return {when:p.when,...(p.when==='statusGained'?{statusCondition:statusCondition(p.statusCondition)}:{}),subject:{relation:subject.relation,conditions},effects:p.effects.map(e=>E.validate(e,{allowAttack}))};
   });
 }
 function attach(unit,laws,config){const entries=validate(laws,{allowDuplicates:true}),sum={};for(const l of entries)for(const f of D.growthFields)sum[f]=(sum[f]||0)+l.stats[f];return {...D.bonuses(unit,sum,config),laws:structuredClone(entries)};}
 const api={statusModes,statusCondition,validatePassives,validImagePath,read:(storage,warnings)=>(typeof module!=='undefined'?require('./saved-data.js'):root.SavedData).read('laws',storage,warnings),load:(data,warnings,...args)=>(typeof module!=='undefined'?require('./saved-data.js'):root.SavedData).laws(data,warnings,...args),validate,attach,timings,labels,battleTimings};if(typeof module!=='undefined')module.exports=api;else root.Laws=api;
})(globalThis);
