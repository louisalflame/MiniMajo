// Build an independent static game release; never write the editor source JSON.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Backup=require('../js/editor-backup.js'),Journey=require('../js/journey.js'),Statuses=require('../js/statuses.js');
const root=path.resolve(__dirname,'..');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function poolVersionFor(data){
 const version=data?.config?.teamPoolVersion??1;
 if(!Number.isSafeInteger(version)||version<1||version>1000000)throw Error('歷史隊伍池版本需為1～1000000的整數。');
 // Version 1 deliberately retains the production pool active at migration.
 // Never recompute this alias from editable balance data or engine sources.
 if(version===1)return '6bd22d1e2a92917eb49f59db69a955c0';
 return hash('minimajo-team-pool:'+version).slice(0,32);
}
function sourceFile(name){
 const parts=name.split('/');
 if(parts.some(p=>!p||p==='.'||p==='..')||path.isAbsolute(name)||name.includes('\\'))throw Error('不合法發布路徑：'+name);
 let current=root;
 for(const part of parts){if(!fs.readdirSync(current).includes(part))throw Error('缺檔或路徑大小寫不符：'+name);current=path.join(current,part);if(fs.lstatSync(current).isSymbolicLink())throw Error('發布來源不可使用符號連結：'+name);}
 if(!fs.statSync(current).isFile())throw Error('發布來源不是檔案：'+name);
 return current;
}
function build({dataFile=path.join(root,'minimajo-editor.json')}={}){
 const prepared=Backup.prepare(JSON.parse(fs.readFileSync(dataFile,'utf8').replace(/^\uFEFF/,'')));
 // Fail visibly instead of silently publishing repaired gameplay data.
 const blockingWarnings=prepared.warnings.filter(w=>!/^enemies\.teams\[\d+\]\.skillId：缺少或無效/.test(w));
 if(prepared.warnings.length)console.warn(prepared.warnings.join('\n'));
 if(blockingWarnings.length)throw Error('發布設定需要先修正／儲存：\n'+blockingWarnings.join('\n'));
 const file=prepared.file,previous=Statuses.snapshot();
 try{
  Statuses.configure(file.data.statuses);
  const d=file.data;Journey.create(d.characters.items,d.skills.skills,'release-check',d.map,d.enemies,d.config,d.laws.laws,d.echo);
  for(const category of ['normal','elite','boss'])if(!d.enemies.teams.some(t=>t.category===category&&t.weight>0&&t.slots.some(Boolean)))throw Error('缺少可抽選的敵隊：'+category);
 }finally{Statuses.configure(previous);}
 const files=new Map();
 function add(name){if(!files.has(name))files.set(name,fs.readFileSync(sourceFile(name)));}
 for(const name of ['index.html','play.html','battle.html'])add(name);
 files.set('index.html',Buffer.from(files.get('index.html').toString().replace(/<a\b[^>]*class="workshop-link"[^>]*>[\s\S]*?<\/a>/g,'')));
 // All approved runtime image assets, including dynamic paths and unassigned icons.
 function assets(dir){for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const name=dir+'/'+entry.name;if(entry.isSymbolicLink())throw Error('素材不可使用符號連結：'+name);if(entry.isDirectory())assets(name);else if(/\.(png|jpe?g|webp|svg|gif|avif|woff2?|mp3|ogg|wav)$/i.test(name))add(name);}}
 assets('assets');add('js/public-data.js');add('js/asset-preloader.js');add('css/asset-loading.css');add('js/player-records.js');add('js/record-client.js');
 function reference(from,url){
  if(/^(?:data:|https?:|\/\/|#|var\()/i.test(url))return;
  const clean=decodeURIComponent(url.split(/[?#]/)[0]);if(!clean)return;
  const name=path.posix.normalize(path.posix.join(path.posix.dirname(from),clean));
  if(!/^(?:css\/.*\.css|js\/.*\.js|assets\/.*|(?:index|play|battle)\.html)$/.test(name))throw Error('發布頁引用未允許的檔案：'+from+' → '+url);
  add(name);
 }
 // Follow HTML/CSS dependencies to closure instead of shipping all editor scripts.
 const scanned=new Set();
 for(const [name,bytes] of files){
  if(scanned.has(name))continue;scanned.add(name);const text=bytes.toString();
  if(name.endsWith('.html'))for(const m of text.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g))reference(name,m[1]);
  if(name.endsWith('.css'))for(const m of text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/g))reference(name,(m[1]??m[2]??m[3]).trim());
  if(name.endsWith('.js'))for(const m of text.matchAll(/assets\/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp|svg|gif|avif)\b/g))reference('index.html',m[0]);
 }
 function configuredImages(value){if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){if(['imageFile','detailImageFile','imagePath'].includes(key)&&typeof item==='string'&&item.trim())reference('index.html',key==='imagePath'?item:'assets/characters/'+item);if(item&&typeof item==='object')configuredImages(item);}}
 configuredImages(file.data);
 // Use verified half-size WebP derivatives in public builds only. Source PNGs
 // and the editor JSON remain intact; deployment needs no image codec package.
 require('./release-images.cjs').optimizeFiles(files,file,{root,sourceFile});
 const images=[...files.keys()].filter(name=>/\.(png|jpe?g|webp|svg|gif|avif)$/i.test(name)).sort();
 const deferred=new Set(images.filter(name=>/^assets\/(?:characters\/|ui\/(?:status-icons|law-icons|ultimate-icons)\/)/.test(name)));
 // Editable artwork follows its data field, even if it lives outside the usual folders.
 for(const library of [file.data.statuses.statuses,file.data.laws.laws,file.data.skills.skills])for(const entry of library)if(entry.imagePath)deferred.add(entry.imagePath);
 const criticalImages=images.filter(name=>!deferred.has(name)),backgroundImages=images.filter(name=>deferred.has(name));
 const poolVersion=poolVersionFor(file.data);
 const releaseInfo={format:'minimajo-public',poolVersion,teamPoolVersion:file.data.config.teamPoolVersion};
 const digest=crypto.createHash('sha256').update(JSON.stringify(file));
 // Generated metadata is part of the public payload, so changes to it must
 // also produce a fresh data filename even when runtime sources are unchanged.
 digest.update(JSON.stringify(releaseInfo));
 digest.update(JSON.stringify({criticalImages,backgroundImages}));
 for(const [name,bytes] of [...files].sort(([a],[b])=>a.localeCompare(b)))digest.update(name).update(bytes);
 const version=digest.digest('hex').slice(0,20),dataName='data/game-'+version+'.js';
 files.set(dataName,Buffer.from('globalThis.MiniMajoRelease='+JSON.stringify({...releaseInfo,version,images,criticalImages,backgroundImages,file}).replace(/</g,'\\u003c')+';\n'));
 files.set('data/record-policy.json',Buffer.from(JSON.stringify({format:'minimajo-record-policy',version:1,poolVersion,teamPoolVersion:file.data.config.teamPoolVersion,statuses:file.data.statuses})));
 files.set('index.html',Buffer.from(files.get('index.html').toString().replace('</head>','<script src="js/record-client.js" defer></script></head>')));
 for(const name of ['play.html','battle.html']){
  let html=files.get(name).toString().replace('<html ','<html data-public-release ');
  html=html.replace('<script src="js/storage.js"',`<script src="${dataName}" defer></script><script src="js/storage.js"`);
  html=html.replace(/(<script src="js\/saved-data\.js[^>]*><\/script>)/,'$1<script src="js/public-data.js" defer></script>');
  if(name==='play.html'){
   html=html.replace('<html data-public-release ','<html data-public-release data-assets-loading ')
    .replace('</head>','<link rel="stylesheet" href="css/asset-loading.css"></head>')
    .replace('<script src="js/public-data.js" defer></script>','<script src="js/public-data.js" defer></script><script src="js/asset-preloader.js" defer></script>')
    .replace('<script src="js/journey-ui.js','<script src="js/player-records.js" defer></script><script src="js/record-client.js" defer></script><script src="js/journey-ui.js')
    .replace(/(<iframe\b[^>]*?)\bsrc=/g,'$1data-src=')
    .replace(/(<body\b[^>]*>)/,'$1<section id="asset-loading" role="region" aria-labelledby="asset-loading-title" aria-busy="true"><div class="asset-loading-panel"><h1 id="asset-loading-title">Loading</h1><div id="asset-loading-progress" role="progressbar" aria-label="遊戲載入進度" aria-valuemin="0" aria-valuemax="'+criticalImages.length+'" aria-valuenow="0"><span></span></div><p id="asset-loading-status" role="status" hidden></p><button id="asset-loading-retry" type="button" hidden>重試載入</button></div></section>');
  }
  files.set(name,Buffer.from(html));
 }
 files.set('release.json',Buffer.from(JSON.stringify({...releaseInfo,version,data:dataName},null,2)+'\n'));
 files.set('_routes.json',Buffer.from(JSON.stringify({version:1,include:['/api/*'],exclude:[]},null,2)+'\n'));
 // Revalidate every request so updates cannot mix cached scripts/data from older releases.
 files.set('_headers',Buffer.from('/*\n  Cache-Control: no-cache, max-age=0, must-revalidate\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n'));
 files.set('404.html',Buffer.from('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>找不到頁面 · MiniMajo</title><p>找不到這個頁面。</p><a href="/">返回 MiniMajo 首頁</a></html>'));
 for(const [name,bytes] of files)if(bytes.length>25*1024*1024)throw Error('檔案超過 Pages 25 MiB 限制：'+name);
 if(files.size>20000)throw Error('發布檔案超過 20,000 個。');
 // Only replace dist after validation; restrict every recursive cleanup to these exact paths.
 const tempRoot=path.join(root,'tmp');fs.mkdirSync(tempRoot,{recursive:true});
 const stage=fs.mkdtempSync(path.join(tempRoot,'release-build-')),output=path.join(root,'dist'),old=stage+'-previous';
 function remove(target){if(target!==stage&&target!==old)throw Error('拒絕清除非本次建置目錄');if(path.dirname(target)!==tempRoot)throw Error('建置目錄超界');fs.rmSync(target,{recursive:true,force:true});}
 try{
  for(const [name,bytes] of files){const dest=path.join(stage,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);}
  if(fs.existsSync(output)){if(fs.lstatSync(output).isSymbolicLink())throw Error('dist 不可為符號連結');fs.renameSync(output,old);}
  try{fs.renameSync(stage,output);}catch(error){if(fs.existsSync(old))fs.renameSync(old,output);throw error;}
  remove(old);
 }finally{remove(stage);}
 return {version,files:files.size,bytes:[...files.values()].reduce((sum,b)=>sum+b.length,0),output};
}
if(require.main===module){try{console.log(JSON.stringify(build(),null,2));}catch(error){console.error('發布建置失敗：'+error.message);process.exitCode=1;}}
module.exports={build,sourceFile,poolVersionFor};
