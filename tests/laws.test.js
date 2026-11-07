const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../js/laws.js'),D=require('../js/database.js'),E=require('../js/enemy-teams.js');
test('attack multiplier and random additive term receive the correct growth and law contributions through runtime',()=>{
 const Effects=require('../js/effects.js'),B=require('../js/battle.js');
 const base=D.validate({version:2,jobGrowth:{飛襲:Array.from({length:5},()=>({damage:5}))},items:[{...D.defaults[0],job:'飛襲',effects:[{type:'damage',amount:{multiplier:1,formula:'rand(10,20)',constant:0}}]}]}).items[0];
 const law={id:'power',name:'加傷',shopPrice:50,shopWeight:100,stats:{damage:30},passives:[]};
 const unit=D.runtime(L.attach(D.atStars(base,2),[law,law]));
 assert.equal(unit.effects[0].amount.formula,'rand(10,20)');assert.equal(unit.outputBonuses.damage,65);
 for(const [random,expected] of [[()=>0,85],[()=>.999,95]]){
  const state=B.create([[unit],[{...D.defaults[1],effects:[]}]],[],[10,10],{footprints:true});state.random=random;
  assert.equal(Effects.amount(unit.effects[0],state,0),expected);
  for(let i=0;i<20;i++)B.step(state);
  assert.equal(state.teams[1].items[0].hp,180-expected);
 }
 const negative=D.runtime(L.attach(D.atStars(base,1),[{...law,stats:{damage:-100}}]));
 assert.equal(Effects.amount(negative.effects[0],{tick:0,teams:[],random:()=>0},0,{self:negative}),10);
 assert.equal(base.effects[0].amount.bonus,undefined);
 assert.equal(L.attach(D.atStars(base,1),[]).effects[0].amount.bonus,undefined);
 const long={...base,effects:[{type:'damage',amount:{formula:'10'+' '.repeat(198)}}]};
 assert.equal(D.runtime(L.attach(long,[law])).outputBonuses.damage,30);
});
test('law snapshots validate all timings, apply stats and survive runtime boundary',()=>{
 const law={shopPrice:50,shopWeight:100,id:'a',name:'法則',stats:{maxHp:50,cooldown:-.5,moveDistance:3,range:4,weakDuration:-1},passives:L.timings.map(when=>({when,subject:{relation:['normalDown','normalKill'].includes(when)?'enemy':when.startsWith('swap')?'self':'ally',conditions:[{field:'job',value:'守護'}]},effects:[{type:'heal',amount:3}]}))};
 const data=E.defaults(D.defaults);data.teams[0].laws=Array.from({length:10},()=>[]);data.teams[0].laws[0]=[law];
 const board=E.formation(E.validate(data).teams[0],D.defaults),u=D.runtime(board[0]);
 assert.equal(u.maxHp,230);assert.equal(u.cooldown,1.5);assert.equal(u.moveDistance,4);assert.equal(u.attackRange,5);assert.equal(u.weakDuration,3);
 assert.equal(board[0].laws[0].passives.length,19);law.stats.maxHp=999;assert.equal(board[0].laws[0].stats.maxHp,50);
 assert.throws(()=>L.validate([{...law,passives:[{when:'bad',effects:[]}]}]));
 assert.throws(()=>L.validate([law,law]));
});
test('per star increments are accumulated only after initial star',()=>{
 const rows=Array.from({length:5},(_,i)=>({maxHp:(i+2)*10}));const db=D.validate({version:2,jobGrowth:{破陣:rows},items:[{...D.defaults[0],stars:3}]});
 assert.equal(D.atStars(db.items[0],3).maxHp,180);assert.equal(D.atStars(db.items[0],5).maxHp,270);
});

test('repeated attached laws stack each snapshot while library IDs remain unique',()=>{
 const law={shopPrice:50,shopWeight:100,id:'stack',name:'強化',stats:{maxHp:20,damage:3},passives:[]};
 const second={...law,stats:{maxHp:40,damage:7}};
 assert.throws(()=>L.validate([law,second]));
 const data=E.defaults(D.defaults);data.teams[0].laws=Array.from({length:10},()=>[]);data.teams[0].laws[0]=[law,second];
 const unit=E.formation(E.validate(data).teams[0],D.defaults)[0],base=D.defaults[0];
 assert.equal(unit.maxHp,base.maxHp+60);assert.equal(unit.effects[0].amount,base.effects[0].amount);assert.equal(unit.outputBonuses.damage,10);
 assert.deepEqual(unit.laws.map(l=>l.id),['stack','stack']);
 unit.laws[0].stats.maxHp=999;assert.equal(unit.laws[1].stats.maxHp,40);assert.equal(law.stats.maxHp,20);
});

test('law descriptions and relative image paths default independently and survive snapshots and backup',()=>{
 const R=require('../js/saved-data.js'),Backup=require('../js/editor-backup.js'),law={id:'art',name:'新法則',shopPrice:0,shopWeight:1,stats:{},passives:[]};assert.equal(L.validate([law])[0].description,'');assert.equal(L.validate([law])[0].imagePath,'');
 const rich={...law,description:'第一行\n第二行',imagePath:'images/laws/法則 圖案.png'},clean=L.validate([rich])[0],file=Backup.collect({getItem:()=>null});file.data.laws.laws=[clean];assert.deepEqual(Backup.prepare(file).file.data.laws.laws,[clean]);assert.equal(L.attach(D.defaults[0],[clean]).laws[0].imagePath,rich.imagePath);
 for(const imagePath of ['../test.png','https://example.com/a.png','/a.png','a\\b.png','javascript:a.svg','a//b.png','a.txt'])assert.throws(()=>L.validate([{...rich,imagePath}]));
 const warnings=[],source={...rich,description:123};assert.equal(R.laws([source],warnings).laws[0].imagePath,rich.imagePath);assert.equal(R.laws([source],warnings).laws[0].description,'');assert.equal(source.description,123);assert.ok(warnings.some(w=>w.includes('description')));
 const repaired=R.laws([{...rich,imagePath:123}],[]).laws[0];assert.equal(repaired.description,rich.description);assert.equal(repaired.imagePath,'');assert.throws(()=>L.validate([{...rich,description:'x'.repeat(2001)}]));
});
