const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../js/database.js'),B=require('../js/battle.js'),E=require('../js/effects.js'),L=require('../js/laws.js'),S=require('../js/statuses.js'),R=require('../js/saved-data.js'),Backup=require('../js/editor-backup.js');
const unit=extra=>({...D.defaults[0],maxHp:10,cooldown:.1,effects:[],passives:[],...extra});
const status=(kind='power',duration={kind:'seconds',value:10})=>E.validate({targets:[{side:'ally',mode:'self'}],actions:[{type:'status',status:kind,amount:{formula:'self.hp*2'},duration}]});
function run(e,extra={}){
 const actor=unit({statusDurationBonus:2,statusAmountBonus:3,effects:[e],...extra});
 const s=B.create([[actor],[unit({cooldown:120})]],[],[10,10]);B.step(s);return s.teams[0].units[0];
}
test('status bonuses implement HP 10 times two plus three for twelve seconds',()=>{
 const actor=run(status()),x=actor.statuses[0];
 assert.equal(x.amount,23);assert.equal(x.until-x.appliedAt,120);assert.equal(S.sum(actor,'power'),23);
});
test('state duration bonuses exclude action counts, permanent and fixed dodge rules',()=>{
 const actions=run(status('power',{kind:'actions',value:2})).statuses[0];assert.equal(actions.remaining,2);assert.equal(actions.until,null);assert.equal(actions.amount,23);
 const permanent=run(status('enhancedPower')).statuses[0];assert.equal(permanent.until,null);assert.equal(permanent.amount,23);
 const dodge=run(status('dodge')).statuses[0];assert.equal(dodge.attacks,1);assert.equal(dodge.amount,1);
 const taunt=run(status('taunt')).statuses[0];assert.equal(taunt.amount,1);assert.equal(taunt.until-taunt.appliedAt,120);
 const low=run(status(),{statusDurationBonus:-100,statusAmountBonus:-100}).statuses[0];assert.equal(low.amount,0);assert.equal(low.until-low.appliedAt,10);
});
test('status bonuses accumulate through stars, classification, repeated laws and runtime',()=>{
 const base=unit({growth:[{statusDurationBonus:.5,statusAmountBonus:1},{statusDurationBonus:.5,statusAmountBonus:1}],raceBonus:{statusDurationBonus:.5},rarityBonus:{statusAmountBonus:1}});
 const law={id:'status',name:'狀態',shopPrice:0,shopWeight:0,stats:{statusDurationBonus:.25*2,statusAmountBonus:2},passives:[]};
 const actor=D.runtime(L.attach(D.atStars(base,3),[law,law]));
 assert.equal(actor.statusDurationBonus,2.5);assert.equal(actor.statusAmountBonus,7);
 assert.throws(()=>D.validateGrowth({守護:[{statusAmountBonus:.5},{},{},{},{}]}));
 assert.equal(D.validateGrowth({守護:[{statusDurationBonus:.1},{},{},{},{}]}).守護[0].statusDurationBonus,.1);
});
test('status bonuses apply to innate passives and active skills via their caster',()=>{
 const e=status();
 const innate=run(E.validate({type:'shield',amount:0}),{passives:[{when:'action',subject:{relation:'self',conditions:[]},effects:[e]}]});
 assert.equal(innate.statuses[0].amount,23);
 const s=B.create([[unit({cooldown:120,statusDurationBonus:2,statusAmountBonus:3})],[unit({cooldown:120})]],[]);
 s.started=true;s.teams[0].skill={enabled:true,cooldown:1,name:'狀態',effects:[e]};
 assert.equal(B.cast(s,0),true);assert.equal(s.teams[0].units[0].statuses[0].amount,23);
});
test('new growth fields repair independently and preserve zero through backups',()=>{
 const file=Backup.collect({getItem:()=>null});
 file.data.characters.jobGrowth.破陣[0].statusDurationBonus=2;
 file.data.characters.jobGrowth.破陣[0].statusAmountBonus=3;
 const fixed=Backup.prepare(file).file.data.characters;
 assert.equal(fixed.jobGrowth.破陣[0].statusDurationBonus,2);assert.equal(fixed.jobGrowth.破陣[0].statusAmountBonus,3);
 file.data.characters.jobGrowth.破陣[0].statusDurationBonus='bad';
 const before=structuredClone(file),result=Backup.prepare(file);
 assert.equal(result.file.data.characters.jobGrowth.破陣[0].statusDurationBonus,0);
 assert.equal(result.file.data.characters.jobGrowth.破陣[0].statusAmountBonus,3);
 assert.deepEqual(file,before);assert.ok(result.warnings.some(w=>w.includes('statusDurationBonus')));
});
