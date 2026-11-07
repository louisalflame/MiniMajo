const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('loading a different schema never clears or replaces original saved data',()=>{
 const store=new Map([['other.app','safe'],['minimajo.schema','old-schema'],['minimajo.characters.v2','original'],['minimajo.tags.v1','old']]);const before=new Map(store),storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem(){throw Error('must never delete');}};
 const context={localStorage:storage,window:{},console};const source=fs.readFileSync('js/storage.js','utf8');vm.runInNewContext(source,context);vm.runInNewContext(source,context);assert.deepEqual(store,before);assert.equal(context.window.MiniMajoStorage.reset,undefined);
});

test('isolated UI preview skips schema writes and saved status reads',()=>{
 const context={location:{search:'?preview=1&uiPreview=1'},URLSearchParams,window:{},console,
  localStorage:{getItem(){throw Error('must not read');},setItem(){throw Error('must not write');}},Statuses:{read(){throw Error('must not read statuses');},configure(){throw Error('must not replace status defaults');}}};
 vm.runInNewContext(fs.readFileSync('js/storage.js','utf8'),context);
 assert.equal(context.window.MiniMajoStorage.readOnlyPreview,true);
 vm.runInNewContext(fs.readFileSync('js/status-loader.js','utf8'),context);
 assert.equal(context.window.statusLibraryError,undefined);
});
