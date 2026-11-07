const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const B=require('../js/editor-backup.js');
test('import previews repairs before confirmation; cancel and invalid JSON never write',async()=>{
 const nodes={},data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 let approved=false,reloads=0,confirmations=0;
 const context={document:{getElementById:id=>nodes[id]??(nodes[id]={})},SavedData:{warnings:[]},EditorBackup:B,EditorFileSession:{replace:async file=>B.restore(storage,file)},localStorage:storage,location:{reload:()=>reloads++},confirm:message=>{confirmations++;assert.match(message,/已補值/);assert.equal(nodes['database-recovery'].hidden,false);assert.match(nodes['database-recovery-details'].textContent,/battleSeconds/);assert.equal(data.size,0);return approved;}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/backup-ui.js'),'utf8'),context);
 const backup=B.collect(storage);delete backup.data.config.battleSeconds;
 const event={target:{files:[{size:100,text:async()=>JSON.stringify(backup)}],value:'file'}};
 await nodes['database-import'].onchange(event);assert.equal(data.size,0);assert.equal(reloads,0);assert.equal(event.target.value,'');
 approved=true;await nodes['database-import'].onchange(event);assert.equal(data.size,9);assert.equal(reloads,1);assert.equal(confirmations,2);
 const before=new Map(data);event.target.files[0].text=async()=>'{broken';await nodes['database-import'].onchange(event);assert.deepEqual(data,before);assert.match(nodes['database-message'].textContent,/匯入失敗/);assert.equal(reloads,1);
});
