const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../js/database.js'),X=require('../js/expedition.js'),C=require('../js/config.js'),E=require('../js/enemy-teams.js'),B=require('../js/editor-backup.js');
const db=()=>D.validate({version:2,items:[D.defaults[0]],jobGrowth:{破陣:Array.from({length:5},()=>({maxHp:10,damage:2}))},raceBonuses:{人類:{maxHp:30,damage:4,cooldown:-.2}},rarityBonuses:{SR:{maxHp:20,damage:3,weakDuration:-.5}}});

test('fractional knockdown growth and classification/law increments stay at tenths of a second',()=>{
 const data=D.validate({version:2,items:[{...D.defaults[0],stars:3}],jobGrowth:{破陣:Array.from({length:5},()=>({weakDuration:-.2}))},raceBonuses:{人類:{weakDuration:-1}}});
 const u=D.atStars(data.items[0],6);assert.equal(u.weakDuration,2.4);assert.equal(u.weakDuration+' 秒','2.4 秒');
 const withLaw=require('../js/laws.js').attach(u,[{id:'time',name:'倒地減時',shopPrice:0,shopWeight:1,stats:{weakDuration:-.1},passives:[]}]);
 assert.equal(withLaw.weakDuration,2.3);assert.equal(D.runtime(withLaw).weakDuration,2.3);
 assert.equal(D.bonuses(u,{weakDuration:-10000}).weakDuration,.1);assert.equal(D.bonuses(u,{weakDuration:10000}).weakDuration,120);
});

test('race and rarity increments apply once at every star including a higher starting star',()=>{
 const data=db(),original=structuredClone(data),base=data.items[0];
 for(let star=1;star<=6;star++){
  const u=D.atStars(base,star);assert.equal(u.maxHp,230+(star-1)*10);assert.equal(u.outputBonuses.damage,7+(star-1)*2);
  assert.equal(u.cooldown,1.8);assert.equal(u.weakDuration,3.5);assert.equal(u.effects[0].amount,16);
 }
 const high={...base,stars:4};assert.equal(D.atStars(high,4).maxHp,230);assert.equal(D.atStars(high,6).maxHp,250);
 assert.deepEqual(D.validate(JSON.parse(JSON.stringify(data))),original);assert.deepEqual(data,original);
 const enemy=E.formation({name:'測試',slots:[base.id,...Array(9).fill(null)],stars:[6,...Array(9).fill(null)]},data.items);
 assert.equal(enemy[0].maxHp,280);assert.equal(D.runtime(enemy[0]).outputBonuses.damage,17);
});

test('journey snapshot, shop, merging and repeat law purchases do not duplicate classification bonuses',()=>{
 const data=db(),base=data.items[0],config={...C.defaults,startingGold:1000,startingActive:[base.id,base.id,...Array(8).fill(null)]};
 const s=X.create(data.items,[],config,[{id:'law',name:'測試',shopPrice:0,shopWeight:100,stats:{maxHp:5,damage:1},passives:[]}]);
 data.items[0].raceBonus.maxHp=999;assert.equal(s.library[0].raceBonus.maxHp,30);assert.equal(s.active[0].maxHp,230);
 X.merge(s,'active',0,'active',1);assert.equal(s.active[1].maxHp,240);assert.equal(s.active[1].outputBonuses.damage,9);
 const stock=X.shop(s,'test');assert.equal(stock.find(Boolean).maxHp,230);
 // Rebuild via the same public transaction used by the law shop.
 const laws=X.lawShop(s,'test');X.buyLaw(s,'test',0,s.active[1].instanceId);assert.equal(s.active[1].maxHp,245);
 X.buyLaw(s,'test',1,s.active[1].instanceId);assert.equal(s.active[1].maxHp,250);assert.equal(s.active[1].outputBonuses.damage,11);
 assert.equal(laws.length,4);
});

test('bonus rows validate numeric limits and clamp the combined stat only after adding all categories',()=>{
 for(const value of [null,[],false,'3',Infinity,10001,.5])assert.throws(()=>D.validateBonuses({人類:{maxHp:value}},'race'));
 assert.throws(()=>D.validateBonuses({SR:null},'rarity'));
 assert.equal(D.validateBonuses({人類:{cooldown:-.1,maxHp:0}},'race').人類.cooldown,-.1);
 const data=D.validate({version:2,items:[{...D.defaults[0],maxHp:9999}],raceBonuses:{人類:{maxHp:100}},rarityBonuses:{SR:{maxHp:-100}}});
 assert.equal(D.atStars(data.items[0],1).maxHp,9999);
});

test('old and malformed bonus tables are repaired per field, logged and retained by full backup',()=>{
 const file=B.collect({getItem:()=>null});file.data.characters=db();
 const raw=structuredClone(file);raw.data.characters.raceBonuses.人類={maxHp:44,damage:0,heal:'bad',cooldown:-.3,shield:10001};raw.data.characters.rarityBonuses.SR=null;
 const before=JSON.stringify(raw),prepared=B.prepare(raw),chars=prepared.file.data.characters;
 assert.equal(chars.raceBonuses.人類.maxHp,44);assert.equal(chars.raceBonuses.人類.damage,0);assert.equal(chars.raceBonuses.人類.heal,0);assert.equal(chars.raceBonuses.人類.shield,0);assert.equal(chars.raceBonuses.人類.cooldown,-.3);
 assert.equal(chars.rarityBonuses.SR.maxHp,0);assert.ok(prepared.warnings.some(x=>x.includes('raceBonuses.人類.heal')));assert.ok(prepared.warnings.some(x=>x.includes('rarityBonuses.SR')));assert.equal(JSON.stringify(raw),before);
 const legacy=structuredClone(file);delete legacy.data.characters.raceBonuses;delete legacy.data.characters.rarityBonuses;
 const old=B.prepare(legacy);assert.equal(old.file.data.characters.raceBonuses.人類.maxHp,0);assert.ok(old.warnings.some(x=>x.includes('raceBonuses')));
 const store=new Map(),storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 B.restore(storage,file);assert.deepEqual(B.collect(storage).data.characters,file.data.characters);
});
