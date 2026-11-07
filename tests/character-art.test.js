const {test}=require('node:test'),assert=require('node:assert/strict');
const Art=require('../js/character-art.js'),D=require('../js/database.js'),Saved=require('../js/saved-data.js');

test('character filenames accept empty and local artwork names, reject paths and invalid values',()=>{
 for(const name of ['', '  ', 'moon.png','月影 魔女.WEBP','portrait.jpeg','sprite.svg'])assert.equal(Art.validFile(name),true,name);
 for(const name of [undefined,null,0,'✨','../moon.png','a/b.png','a\\b.png','https://host/a.png','bad?.png','a\n.png','x'.repeat(121)+'.png'])assert.equal(Art.validFile(name),false,String(name));
 assert.equal(Art.source(' 月影 #1.png '),'assets/characters/'+encodeURIComponent('月影 #1.png'));
 assert.equal(Art.source(''),'');assert.equal(Art.source('../a.png'),'');
 assert.throws(()=>D.validate({version:2,items:[{...D.defaults[0],imageFile:'../a.png'}]}),/圖片檔名/);
 const unit=D.validate({version:2,items:[{...D.defaults[0],imageFile:' moon.png '}]}).items[0];
 assert.equal(D.runtime(D.atStars(unit,6)).imageFile,'moon.png');
});

test('legacy icons and invalid artwork repair only the filename without writing original storage',()=>{
 const legacy={...D.defaults[0],icon:'🗡️',name:'保留角色',shopWeight:0};delete legacy.imageFile;
 const input={version:2,items:[legacy,{...D.defaults[1],imageFile:42},{...D.defaults[2],imageFile:''},{...D.defaults[3],imageFile:'axe.png'}]},raw=JSON.stringify(input),warnings=[];
 const data=Saved.read('characters',{getItem:()=>raw,setItem:()=>assert.fail('read must not write')},warnings);
 assert.deepEqual(data.items.map(x=>x.imageFile),['','','','axe.png']);
 assert.equal(data.items[0].name,'保留角色');assert.equal(data.items[0].shopWeight,0);assert.equal(data.items[0].maxHp,legacy.maxHp);
 assert.ok(warnings.some(x=>x.includes('items[0].imageFile')));assert.ok(warnings.some(x=>x.includes('items[1].imageFile')));
 assert.ok(!warnings.some(x=>x.includes('items[2].imageFile')));assert.equal(JSON.stringify(input),raw);
});

class Element{
 constructor(){this.children=[];this.handlers={};this.hidden=false;}
 append(...children){this.children.push(...children);}
 addEventListener(type,fn){this.handlers[type]=fn;}
}
const document={createElement:()=>new Element()};
test('detail art field survives validation growth runtime and complete backup',()=>{
 const item={...D.defaults[0],imageFile:'card.png',detailImageFile:' detail.png '};
 const unit=D.runtime(D.atStars(D.validate({version:2,items:[item]}).items[0],6));
 assert.equal(unit.detailImageFile,'detail.png');assert.equal(unit.imageFile,'card.png');
 for(const detailImageFile of [null,42,'../detail.png','bad.txt','x'.repeat(121)+'.png'])assert.throws(()=>D.validate({version:2,items:[{...item,detailImageFile}]}),/詳情圖片檔名/);
 const Backup=require('../js/editor-backup.js'),raw=JSON.stringify({version:2,items:[item]});
 const file=Backup.collect({getItem:key=>key==='minimajo.characters.v2'?raw:null});
 assert.equal(Backup.prepare(file).file.data.characters.items[0].detailImageFile,'detail.png');
});
test('detail art read repairs individual missing invalid fields and preserves explicit empty values',()=>{
 const old={...D.defaults[0]};delete old.detailImageFile;
 const input={version:2,items:[old,{...D.defaults[1],detailImageFile:42},{...D.defaults[2],detailImageFile:''},{...D.defaults[3],detailImageFile:'detail.png'}]},before=JSON.stringify(input),warnings=[];
 const loaded=Saved.characters(input,warnings);
 assert.deepEqual(loaded.items.map(u=>u.detailImageFile),['','','','detail.png']);
 assert.ok(warnings.some(w=>w.includes('items[0].detailImageFile')));assert.ok(warnings.some(w=>w.includes('items[1].detailImageFile')));
 assert.ok(!warnings.some(w=>w.includes('items[2].detailImageFile')));assert.equal(JSON.stringify(input),before);
});
test('only detail portraits prefer detail art and fall back through card art then placeholder',()=>{
 const unit={name:'魔女',imageFile:'card.png',detailImageFile:'detail.png'};
 assert.equal(Art.create(document,unit,'roster-art').children[1].src,'assets/characters/card.png');
 const [placeholder,image]=Art.create(document,unit,'detail-portrait','span',{detail:true}).children;
 assert.equal(image.src,'assets/characters/detail.png');image.handlers.error();assert.equal(image.src,'assets/characters/card.png');
 image.handlers.load();assert.equal(placeholder.hidden,true);image.handlers.error();assert.equal(placeholder.hidden,false);assert.equal(image.hidden,true);
 assert.equal(Art.create(document,{...unit,detailImageFile:''},'detail-portrait','span',{detail:true}).children[1].src,'assets/characters/card.png');
});
test('artwork keeps its placeholder until loaded and restores it on image error',()=>{
 const host=Art.create(document,{name:'魔女',imageFile:'witch.png'},'reward-art','div'),[placeholder,image]=host.children;
 assert.equal(image.src,'assets/characters/witch.png');assert.equal(image.alt,'魔女');assert.equal(image.hidden,true);assert.equal(placeholder.hidden,false);
 image.handlers.error();assert.equal(image.hidden,true);assert.equal(placeholder.hidden,false);
 image.handlers.load();assert.equal(image.hidden,false);assert.equal(placeholder.hidden,true);
 image.handlers.error();assert.equal(image.hidden,true);assert.equal(placeholder.hidden,false);
 assert.equal(Art.create(document,{imageFile:''},'roster-art').children.length,1);
});
