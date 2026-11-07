const {test}=require('node:test'),assert=require('node:assert/strict');
const G=require('../js/enemy-generator.js'),D=require('../js/database.js'),E=require('../js/enemy-teams.js');
const unit=(id,space=1,stars=1,rarity='SR',shopWeight=100)=>({...D.defaults[0],id,name:id,space,stars,rarity,shopWeight});
const settings={count:20,lawCount:0,SR:1,SSR:0,UR:0};
const law={id:'law',name:'法則',shopWeight:1,shopPrice:1,stats:{maxHp:1},passives:[]};
test('generator upgrades repeated hits directly from initial stars, caps at six and stops without looping',()=>{
 const items=[unit('a',3,2)],before=structuredClone(items),result=G.generate(items,[],settings,()=>0);
 assert.equal(result.completed,5);assert.equal(result.stars[0],6);assert.equal(result.slots.filter(Boolean).length,1);
 assert.deepEqual(result.slots.slice(1),Array(9).fill(null));assert.deepEqual(items,before);
 const team={id:'t',name:'隊伍',category:'normal',matchLevel:1,weight:100,...result};
 assert.equal(E.formation(E.validate({version:1,teams:[team]}).teams[0],items)[0].stars,6);
});
test('full board excludes unplaceable roles while existing roles can still upgrade; zero weights stay excluded',()=>{
 const items=[unit('a',6),unit('b',4),unit('wide',5),unit('zero',1,1,'SR',0),unit('disabled',1,1,'UR')];
 let rolls=[0,0,0,0.99];
 const result=G.generate(items,[],{...settings,count:1000},()=>rolls.length?rolls.shift():0);
 assert.equal(result.completed,12);assert.equal(result.slots[0],'a');assert.equal(result.slots[6],'b');
 assert.equal(result.stars[0],6);assert.equal(result.stars[6],6);
 assert.equal(E.formation({name:'t',...result},items).filter(Boolean).length,2);
});
test('missing tiers redistribute weight, and rarity precedes character weights',()=>{
 const items=[unit('s',1,1,'SR',1000000),unit('u',1,1,'UR',1)];
 const result=G.generate(items,[],{...settings,count:1,SR:1,SSR:0,UR:1},(()=>{let r=[.5,0];return ()=>r.shift();})());
 assert.equal(result.slots[0],'u');
 assert.equal(G.generate([items[1]],[],{...settings,count:1,UR:1},()=>0).slots[0],'u');
});
test('laws stack as independent snapshots and recipients are uniform by character rather than occupied space',()=>{
 const items=[unit('a',3),unit('b')],laws=[{...law,shopWeight:0},{...law,id:'enabled'}],before=structuredClone(laws);
 let rolls=[0,0,0,.99,0,.49,0,.5,0,.99];
 const result=G.generate(items,laws,{...settings,count:2,lawCount:3},()=>rolls.shift());
 assert.equal(result.laws[0].length,1);assert.equal(result.laws[3].length,2);
 assert.equal(result.laws[3][0].id,'enabled');assert.notEqual(result.laws[3][0],result.laws[3][1]);
 result.laws[3][0].stats.maxHp=99;assert.deepEqual(laws,before);assert.equal(result.laws[3][1].stats.maxHp,1);
});
test('invalid or empty pools fail clearly, counts are bounded, legal zero law count and tier weights remain',()=>{
 assert.equal(G.validate(settings).lawCount,0);
 for(const patch of [{count:0},{count:1001},{count:1.2},{lawCount:-1},{lawCount:1001},{SR:0},{UR:'1'},{SSR:NaN}])assert.throws(()=>G.validate({...settings,...patch}));
 assert.throws(()=>G.generate([],[],settings),/沒有可加入/);
 assert.throws(()=>G.generate([unit('off',1,1,'SR',0)],[],settings),/沒有可加入/);
 assert.throws(()=>G.generate([unit('a')],[],{...settings,lawCount:1}),/沒有正權重/);
});
