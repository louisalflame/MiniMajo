(function (root) {
  const EffectRules=typeof module!=='undefined'?require('./effects.js'):root.Effects;
  const Config=typeof module!=='undefined'?require('./config.js'):root.GameConfig;
  const enums=typeof module!=='undefined'?require('./enums.js'):root.CharacterEnums;
  const Art=typeof module!=='undefined'?require('./character-art.js'):root.CharacterArt;
  const defaults = [
    ['short-sword','人類劍士',['人類','物理'],2,'damage',16],
    ['wood-shield','機人守衛',['機人','物理'],3.5,'shield',12],
    ['herb','人類靈療師',['人類','精神'],5,'heal',10],
    ['axe','獸人戰士',['獸人','物理'],3.2,'damage',25],
    ['knife','獸人咒術師',['獸人','魔法'],1.8,'damage',8],
    ['iron-shield','機人念師',['機人','精神'],4.5,'shield',10]
  ].map(([id,name,tags,cooldown,type,amount])=>({id,name,imageFile:'',detailImageFile:'',shopPrice:30,shopWeight:100,space:1,maxHp:180,attack:10,attackRange:1,moveDistance:1,race:tags[0],affinity:tags[1],stars:1,rarity:'SR',job:({damage:'破陣',shield:'守護',heal:'支援'})[type],cooldown,effects:[{type,amount}]}));
  defaults.forEach(item=>{item.description=EffectRules.description(item.effects);item.passives=[];});
  const growthFields=['maxHp','damage','heal','shield','cooldown','posture','weakDuration','moveDistance','range','statusDurationBonus','statusAmountBonus'];
  const growthLabels=['HP','傷害攻擊力','治療攻擊力','護盾攻擊力','冷卻秒數','失衡效果值','倒地秒數','移動距離','攻擊距離','狀態秒數加成','狀態層數加成'];
  function validateBonusRow(row={}){
    if(!row||typeof row!=='object'||Array.isArray(row))throw Error('能力加成設定無效。');
    return Object.fromEntries(growthFields.map(f=>{const n=row[f]===undefined?0:row[f];if(typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>10000||Math.abs(n*10-Math.round(n*10))>1e-8||(!['cooldown','weakDuration','statusDurationBonus'].includes(f)&&!Number.isInteger(n)))throw Error('成長／加成值需為 -10000～10000，秒數可用 0.1 單位，其餘需為整數。');return [f,n];}));
  }
  function validateBonuses(value={},kind){
    if(!value||typeof value!=='object'||Array.isArray(value)||!['race','rarity'].includes(kind))throw Error('種族／階級加成設定無效。');
    return Object.fromEntries(enums[kind].map(key=>[key,validateBonusRow(value[key]===undefined?{}:value[key])]));
  }
  function validateGrowth(value={}){
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('職業成長設定無效。');
    return Object.fromEntries(enums.job.map(job=>{
      const rows=value[job]??Array.from({length:5},()=>({}));
      if(!Array.isArray(rows)||rows.length!==5)throw Error('每個職業需要 2～6 星的五列設定。');
      return [job,rows.map(row=>{
        return validateBonusRow(row);
      })];
    }));
  }
  function bonuses(item,g,config=Config.defaults){
    const result=JSON.parse(JSON.stringify(item));
    result.maxHp=Math.max(1,Math.min(10000,result.maxHp+(g.maxHp||0)));
    result.cooldown=Math.max(.1,Math.min(120,Math.round((result.cooldown+(g.cooldown||0))*10)/10));
    result.moveDistance=Math.max(0,Math.min(9,result.moveDistance+(g.moveDistance||0)));
    result.weakDuration=Math.max(.1,Math.min(120,Math.round(((result.weakDuration??config.weakDuration)+(g.weakDuration||0))*10)/10));
    result.attackRange=Math.max(1,Math.min(10,(result.attackRange??1)+(g.range??0)));
    result.outputBonuses={...result.outputBonuses};
    for(const type of ['damage','heal','shield','posture'])result.outputBonuses[type]=(result.outputBonuses[type]??0)+(g[type]??0);
    result.statusDurationBonus=Math.round(((result.statusDurationBonus??0)+(g.statusDurationBonus??0))*10)/10;
    result.statusAmountBonus=(result.statusAmountBonus??0)+(g.statusAmountBonus??0);
    return result;
  }
  function atStars(item,stars,config=Config.defaults){
    if(!Number.isInteger(stars)||stars<item.stars||stars>6)throw Error('星數需介於角色起始星數與 6 星之間。');
    const rows=item.growth??Array.from({length:5},()=>({})),sum={};
    for(const f of growthFields)sum[f]=(item.raceBonus?.[f]??0)+(item.rarityBonus?.[f]??0);
    for(let n=item.stars;n<stars;n++)for(const f of growthFields)sum[f]=(sum[f]||0)+(rows[n-1]?.[f]||0);
    const result=bonuses(item,sum,config);result.stars=stars;return result;
  }
  function validate(data) {
    if (!data || data.version !== 2 || !Array.isArray(data.items) || !data.items.length || data.items.length > 500) throw Error('需要 version: 2，且包含 1～500 位角色。');
    const jobGrowth=validateGrowth(data.jobGrowth),raceBonuses=validateBonuses(data.raceBonuses,'race'),rarityBonuses=validateBonuses(data.rarityBonuses,'rarity'),ids = new Set();
    return {version:2,jobGrowth,raceBonuses,rarityBonuses,items:data.items.map((x,i)=>{
      const fail=m=>{throw Error(`第 ${i+1} 位角色：${m}`);};
      if (!x || typeof x.id!=='string'|| !/^[a-zA-Z0-9_-]{1,80}$/.test(x.id)||ids.has(x.id)) fail('ID 必須唯一，且僅含英數字、底線或連字號。');
      ids.add(x.id);
      if(!['人類','獸人','機人'].includes(x.race)||!['物理','精神','魔法'].includes(x.affinity))fail('需要有效的種族與戰鬥類型。');
      const space=x.space;if(!Number.isInteger(space)||space<1||space>99)fail('佔用空間需為 1～99 整數。');
      if(typeof x.name!=='string'||!x.name.trim()||x.name.length>40)fail('名稱需要 1～40 字。');
      if(!Art.validFile(x.imageFile))fail('圖片檔名可留空，最多 120 字元，需為 png、jpg、jpeg、webp、gif、avif 或 svg 檔名，不可含路徑。');
      const detailImageFile=x.detailImageFile===undefined?'':x.detailImageFile;
      if(!Art.validFile(detailImageFile))fail('詳情圖片檔名可留空，最多 120 字元，需為支援的圖片檔名，不可含路徑。');
      if(typeof x.cooldown!=='number'||!Number.isFinite(x.cooldown)||x.cooldown<0.1||x.cooldown>120||Math.abs(x.cooldown*10-Math.round(x.cooldown*10))>1e-8)fail('冷卻需為 0.1～120 秒，以 0.1 秒為單位。');
      if(!Array.isArray(x.effects)||x.effects.length>8)fail('需要 0～8 個效果。');
      const stars=x.stars,rarity=x.rarity,job=x.job;if(!Number.isInteger(stars)||stars<1||stars>6||!enums.rarity.includes(rarity)||!enums.job.includes(job))fail('星等、階級或職業無效。');
      const maxHp=x.maxHp,moveDistance=x.moveDistance;if(!Number.isInteger(maxHp)||maxHp<1||maxHp>10000||!Number.isInteger(moveDistance)||moveDistance<0||moveDistance>2)fail('HP 需為 1～10000，移動距離需為 0～2。');
      const attack=x.attack===undefined?10:x.attack,attackRange=x.attackRange===undefined?Math.max(1,...x.effects.map(e=>e.range??1)):x.attackRange;
      if(!Number.isInteger(attack)||attack<0||attack>10000||!Number.isInteger(attackRange)||attackRange<1||attackRange>10)fail('攻擊力需為 0～10000，攻擊距離需為 1～10 整數。');
      const shopPrice=x.shopPrice,shopWeight=x.shopWeight;
      if(!Number.isInteger(shopPrice)||shopPrice<0||shopPrice>1000000||!Number.isInteger(shopWeight)||shopWeight<0||shopWeight>1000000)fail('商店售價與權重需為 0～1000000 的整數。');
      const effects=x.effects.map(EffectRules.validate);
      const description=x.description===undefined?EffectRules.description(effects):x.description;
      if(typeof description!=='string'||description.length>2000)fail('技能說明需為最多 2000 字的文字，可留空。');
      return {growth:structuredClone(jobGrowth[job]),raceBonus:structuredClone(raceBonuses[x.race]),rarityBonus:structuredClone(rarityBonuses[rarity]),id:x.id,shopPrice,shopWeight,space,maxHp,attack,attackRange,moveDistance,movement:EffectRules.movement(x.movement),race:x.race,affinity:x.affinity,name:x.name.trim(),imageFile:x.imageFile.trim(),detailImageFile:detailImageFile.trim(),stars,rarity,job,cooldown:x.cooldown,effects,description,passives:(typeof module!=='undefined'?require('./laws.js'):root.Laws).validatePassives(x.passives,{allowAttack:true})};
    })};
  }
  function runtime(x){
    if(!Number.isInteger(x.moveDistance)||x.moveDistance<0||x.moveDistance>9||!Number.isFinite(x.weakDuration??Config.defaults.weakDuration)||(x.weakDuration??Config.defaults.weakDuration)<.1||(x.weakDuration??Config.defaults.weakDuration)>120)throw Error('本局移動／倒地時間無效。');
    const ranges=x.effects.map(e=>{const n=e.range??1;if(!Number.isInteger(n)||n<1||n>10)throw Error('本局攻擊距離無效。');return n;});
    const clean=validate({version:2,items:[{...x,moveDistance:Math.min(2,x.moveDistance),effects:x.effects.map(e=>({...e,range:Math.min(3,e.range??1)}))}]}).items[0];
    const outputBonuses={};for(const type of ['damage','heal','shield','posture']){const value=x.outputBonuses?.[type]??0;if(!Number.isSafeInteger(value))throw Error('本局攻擊力加成無效。');outputBonuses[type]=value;}
    const statusDurationBonus=x.statusDurationBonus??0,statusAmountBonus=x.statusAmountBonus??0;
    if(!Number.isFinite(statusDurationBonus)||Math.abs(statusDurationBonus*10-Math.round(statusDurationBonus*10))>1e-8||!Number.isSafeInteger(statusAmountBonus))throw Error('本局狀態加成無效。');
    return {...clean,outputBonuses,statusDurationBonus,statusAmountBonus,moveDistance:x.moveDistance,...(x.weakDuration===undefined?{}:{weakDuration:x.weakDuration}),effects:clean.effects.map((e,i)=>({...e,range:ranges[i]}))};
  }
  const api={read:(storage,warnings)=>(typeof module!=='undefined'?require('./saved-data.js'):root.SavedData).read('characters',storage,warnings),load:(data,warnings,...args)=>(typeof module!=='undefined'?require('./saved-data.js'):root.SavedData).characters(data,warnings,...args),runtime,defaults,validate,validateGrowth,validateBonuses,atStars,bonuses,growthFields,growthLabels};
  if(typeof module!=='undefined')module.exports=api;else root.ItemDB=api;
})(globalThis);
