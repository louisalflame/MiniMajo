const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Icons=require('../js/ui-icons.js'),Statuses=require('../js/statuses.js');
class Element{
 constructor(){this.children=[];this.attributes={};}
 setAttribute(k,v){this.attributes[k]=v;}getAttribute(k){return k==='src'?this.src:this.attributes[k];}
 append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}
}
const document={createElement:()=>new Element()};
test('all approved status PNGs render from configured imagePath, including custom permanent counter ID',()=>{
 const m=require('../assets/ui/status-icons/v1/manifest.json');
 const before=Statuses.snapshot();try{
 const lib=Statuses.snapshot();for(const f of m.files){const def=lib.statuses.find(s=>s.id===f.id);if(def)def.imagePath='assets/ui/status-icons/v1/'+path.basename(f.file);else lib.statuses.push({id:f.id,name:f.name,imagePath:'assets/ui/status-icons/v1/'+path.basename(f.file),enhanced:true,effects:[{behavior:'counter',scale:1}]});}Statuses.configure(lib);
 for(const f of m.files){
  const icon=Icons.createStatus(document,f.id),img=icon.children[0];assert.equal(img.src,'assets/ui/status-icons/v1/'+path.basename(f.file));
  assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'..',img.src))).digest('hex'),f.sha256);
 }
 }finally{Statuses.configure(before);}
});
test('imagePath is the only artwork source: changes are honored and blank/broken paths use the same generic symbol',()=>{
 const before=Statuses.snapshot();try{
  const lib=Statuses.snapshot();lib.statuses.find(s=>s.id==='power').imagePath='images/statuses/custom.png';Statuses.configure(lib);
  const host=Icons.createStatus(document,'power','強化'),img=host.children[0];assert.equal(img.src,'images/statuses/custom.png');assert.equal(host.attributes['aria-label'],'強化');
  assert.equal(img.hidden,true);assert.equal(host.children[1].className,'ui-icon');img.onload();assert.equal(img.hidden,false);assert.equal(host.children[1].hidden,true);
  img.onerror();assert.equal(host.children[0].className,'ui-icon');assert.ok(host.children[0].innerHTML.includes('<svg'));assert.equal(host.children[0].children.length,0);
  lib.statuses.find(s=>s.id==='power').imagePath='assets/ui/status-icons/v1/regen.png';Statuses.configure(lib);assert.equal(Icons.createStatus(document,'power').children[0].src,'assets/ui/status-icons/v1/regen.png');
  lib.statuses.find(s=>s.id==='power').imagePath='';Statuses.configure(lib);const blank=Icons.createStatus(document,'power');assert.equal(blank.className,'ui-icon');
  const unknown=Icons.createStatus(document,'unknown');assert.equal(unknown.className,'ui-icon');assert.ok(unknown.innerHTML.includes('<svg'));
  assert.equal(blank.innerHTML,unknown.innerHTML);
 }finally{Statuses.configure(before);}
});
