// Loaded only by the generated public release, after saved-data.js.
(() => {
 'use strict';
 try {
  const release=globalThis.MiniMajoRelease;
  if(release?.format!=='minimajo-public'||!release.version||release.file?.format!=='minimajo-editor'||!release.file.data)throw Error('公開遊戲設定未完整載入，請重新整理頁面。');
  const values=new Map();
  for(const [kind,key] of Object.entries(SavedData.keys)){
   if(!Object.hasOwn(release.file.data,kind))throw Error('公開遊戲設定缺少 '+kind+'，請重新整理頁面。');
   values.set(key,JSON.stringify(release.file.data[kind]));
  }
  globalThis.MiniMajoPublicData=Object.freeze({version:release.version,storage:Object.freeze({getItem:key=>values.get(key)??null})});
 } catch(error) { globalThis.publicDataError=error.message; }
})();
