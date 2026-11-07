const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {build,sourceFile}=require('../tools/build-release.cjs');
test('release is independent, preserves source settings, and failed builds preserve the last output',()=>{
 const before=fs.readFileSync('minimajo-editor.json'),result=build(),dir=result.output;
 assert.deepEqual(fs.readFileSync('minimajo-editor.json'),before);
 for(const name of ['index.html','play.html','battle.html','css/battle.css','js/journey.js','assets/characters','404.html','_headers'])assert.ok(fs.existsSync(path.join(dir,name)),name);
 for(const name of ['editor.html','editor-server.cjs','minimajo-editor.json','docs','tests','tools','.git','js/app.js','js/backup-ui.js'])assert.ok(!fs.existsSync(path.join(dir,name)),name);
 assert.doesNotMatch(fs.readFileSync(path.join(dir,'index.html'),'utf8'),/editor\.html/);
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'release.json')));
 const html=fs.readFileSync(path.join(dir,'play.html'),'utf8');
 assert.match(html,/data-assets-loading/);assert.match(html,/iframe[^>]+data-src=/);assert.match(html,/js\/asset-preloader.js/);
 assert.ok(html.includes(manifest.data));assert.ok(html.indexOf(manifest.data)<html.indexOf('js/storage.js'));assert.ok(html.indexOf('js/public-data.js')<html.indexOf('js/status-loader.js'));
 const store={getItem(){throw Error('must not read editor/browser cache');},setItem(){throw Error('must not write browser cache');}};
 const context=vm.createContext({console,structuredClone,localStorage:store,document:{documentElement:{hasAttribute:()=>true}},window:null});context.window=context;
 for(const name of [manifest.data,'js/storage.js','js/saved-data.js','js/public-data.js','js/config.js','js/statuses.js','js/effects.js','js/status-loader.js','js/enums.js','js/character-art.js','js/database.js','js/skills.js','js/hex-map.js','js/laws.js','js/echo-levels.js','js/expedition.js','js/enemy-teams.js','js/journey.js'])vm.runInContext(fs.readFileSync(path.join(dir,name),'utf8'),context,{filename:name});
 function imageFiles(folder){return fs.readdirSync(path.join(dir,folder),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?imageFiles(folder+'/'+entry.name):/\.(png|jpe?g|webp|svg|gif|avif)$/i.test(entry.name)?[folder+'/'+entry.name]:[]);}
 assert.deepEqual([...context.MiniMajoRelease.images],imageFiles('assets').sort());
 const release=context.MiniMajoRelease;
 assert.deepEqual([...release.criticalImages,...release.backgroundImages].sort(),[...release.images]);
 assert.equal(new Set([...release.criticalImages,...release.backgroundImages]).size,release.images.length);
 assert.ok(release.backgroundImages.some(name=>name.startsWith('assets/characters/')));
 assert.ok(release.criticalImages.every(name=>!name.startsWith('assets/characters/')));
 for(const library of [release.file.data.statuses.statuses,release.file.data.laws.laws,release.file.data.skills.skills])for(const entry of library)if(entry.imagePath)assert.ok(release.backgroundImages.includes(entry.imagePath),entry.imagePath);
 const run=vm.runInContext(`(()=>{const s=MiniMajoPublicData.storage;return Journey.create(ItemDB.read(s).items,SkillDB.read(s).skills,'release-test',HexMap.read(s),EnemyTeams.read(s),GameConfig.read(s),Laws.read(s).laws,EchoLevels.read(s));})()`,context);
 assert.equal(context.publicDataError,undefined);assert.equal(context.statusLibraryError,undefined);
 assert.equal(run.roster.active.length,10);assert.ok(run.roster.active.some(Boolean));assert.equal(run.roster.gold,JSON.parse(before).data.config.startingGold);
 const bad=path.resolve('tmp/release-invalid-'+process.pid+'.json');fs.writeFileSync(bad,'{"not":"a save"}');
 try{assert.throws(()=>build({dataFile:bad}),/完整編輯資料/);assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'release.json'))).version,result.version);}finally{fs.unlinkSync(bad);}
 assert.throws(()=>sourceFile('js/Journey.js'),/大小寫/);assert.throws(()=>sourceFile('../README.md'),/不合法/);
});
test('missing or incomplete public settings fail explicitly instead of using local cache',()=>{
 for(const release of [undefined,{format:'minimajo-public',version:'x',file:{format:'minimajo-editor',data:{}}}]){
  const context={MiniMajoRelease:release,SavedData:require('../js/saved-data.js'),localStorage:{getItem(){throw Error('must not read');}}};
  vm.runInNewContext(fs.readFileSync('js/public-data.js','utf8'),context);
  assert.match(context.publicDataError,/公開遊戲設定/);assert.equal(context.MiniMajoPublicData,undefined);
 }
});

