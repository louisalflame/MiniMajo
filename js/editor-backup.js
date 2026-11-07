(function(root){
 const node=typeof module!=='undefined',D=node?require('./database.js'):root.ItemDB,S=node?require('./skills.js'):root.SkillDB,T=node?require('./statuses.js'):root.Statuses,L=node?require('./laws.js'):root.Laws,E=node?require('./enemy-teams.js'):root.EnemyTeams,H=node?require('./hex-map.js'):root.HexMap;
 const C=node?require('./config.js'):root.GameConfig;
 const schema='alpha-20261025-fixed-editor-file',keys={echo:'minimajo.echo.v1',config:'minimajo.config.v1',characters:'minimajo.characters.v2',skills:'minimajo.skills.v1',statuses:'minimajo.statuses.v1',laws:'minimajo.laws.v1',enemies:'minimajo.enemies.v1',map:'minimajo.map.v1',capacity:'minimajo.capacity.v2'};
 const R=node?require('./saved-data.js'):root.SavedData;
 function prepare(file){
  if(file?.format!=='minimajo-editor'||!file.data||typeof file.data!=='object'||Array.isArray(file.data))throw Error('請選擇完整編輯資料備份（minimajo-editor 格式）；無法辨識的檔案不會覆寫現有資料。');
  const warnings=[],d=file.data,previous=T.snapshot();
  if(file.schema!==schema||file.version!==1)warnings.push('備份版本不同：已依目前欄位補值，不會因版本標記拒絕資料。');
  for(const k of Object.keys(keys))if(!Object.hasOwn(d,k))warnings.push(k+'：備份缺少此區，使用此區的預設值。');
  try{
   const statuses=R.statuses(d.statuses??{version:1,statuses:T.defaults},warnings);T.configure(statuses);
   const characters=R.characters(d.characters,warnings),skills=R.skills(d.skills,warnings),laws=R.laws(d.laws,warnings),enemies=R.enemies(d.enemies,warnings,characters.items,skills.skills),map=R.map(d.map,warnings),capacity=R.capacity(d.capacity,warnings),config=R.config(d.config,warnings,characters.items),echo=R.echo(d.echo,warnings);
   enemies.teams.forEach(t=>E.formation(t,characters.items));H.generate(map.radius,map.seed,map.rules);
   return {file:{format:'minimajo-editor',version:1,schema,data:{config,characters,skills,statuses,laws,enemies,map,capacity,echo}},warnings};
  }finally{T.configure(previous);}
 }
 function validate(file){return prepare(file).file;}
 function collect(storage){
  const warnings=R.warnings,previous=T.snapshot();try{
   const statuses=R.read('statuses',storage,warnings);T.configure(statuses);
   const data={statuses};for(const k of Object.keys(keys))if(k!=='statuses')data[k]=R.read(k,storage,warnings);
   return validate({format:'minimajo-editor',version:1,schema,data});
  }finally{T.configure(previous);}
 }
 function restore(storage,file){const clean=validate(file),before=Object.fromEntries(Object.values(keys).map(k=>[k,storage.getItem(k)])),written=[];
  try{for(const [k,key] of Object.entries(keys)){storage.setItem(key,JSON.stringify(clean.data[k]));written.push(key);}}
  catch(error){let failed=false;for(const key of written.reverse())try{before[key]===null?storage.removeItem(key):storage.setItem(key,before[key]);}catch{failed=true;}throw Error(failed?'匯入寫入失敗，還原也失敗；請保留備份並重新匯入。':'匯入寫入失敗，已還原原資料：'+error.message);}return clean;
 }
 const api={keys,collect,prepare,validate,restore};if(node)module.exports=api;else root.EditorBackup=api;
})(globalThis);
