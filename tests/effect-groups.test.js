const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../js/battle.js'),D=require('../js/database.js'),E=require('../js/effects.js'),Backup=require('../js/editor-backup.js');
const unit=(effects=[],extra={})=>({...D.defaults[0],maxHp:1000,attack:20,attackRange:3,cooldown:120,effects,...extra});
const group=(actions,targets=[{side:'enemy',mode:'primary'}],cond=[])=>E.validate({cond,targets,actions});
function battle(effect,enemy=[unit()]){return B.create([[unit([effect],{cooldown:.1})],enemy]);}
test('shared condition and targets are evaluated once before ordered contents',()=>{
 const e=group([{type:'heal',amount:100},{type:'shield',amount:{formula:'target.hp / 10'}}],[{side:'ally',mode:'self',targetCond:[{field:'injured',value:true}]}],[{subject:'self',field:'injured',value:true}]);
 const s=battle(e);s.teams[0].units[0].hp=900;B.step(s);assert.equal(s.teams[0].units[0].hp,1000);assert.equal(s.teams[0].units[0].shield,100);
});
test('ranking is fixed within a group and overlapping searches are deduplicated',()=>{
 const e=group([{type:'heal',amount:200},{type:'damage',amount:10}],[{side:'enemy',mode:'lowestHp'},{side:'enemy',mode:'lowestHp'}]);
 const s=battle(e,[unit(),unit()]);s.teams[1].units[0].hp=500;s.teams[1].units[1].hp=600;B.step(s);assert.deepEqual(s.teams[1].units.map(u=>u.hp),[690,600]);
});
test('posture then damage reads immediate knockdown and dead targets are skipped',()=>{
 const s=battle(group([{type:'posture',amount:100},{type:'damage',amount:10}]));B.step(s);assert.equal(s.teams[1].units[0].hp,985);
 const lethal=battle(group([{type:'damage',amount:1000},{type:'heal',amount:100},{type:'shield',amount:100}] ),[unit(),unit()]);B.step(lethal);assert.equal(lethal.teams[1].units[0].hp,0);assert.equal(lethal.teams[1].units[0].shield,0);assert.equal(lethal.teams[1].units[1].hp,1000);
});
test('empty main targets suppress every content and secondary group',()=>{
 const s=battle(group([{type:'damage',amount:100},{type:'shield',amount:100}],[]));s.teams[0].units[0].effects.push(group([{type:'damage',amount:100}]));B.step(s);assert.equal(s.teams[1].units[0].hp,1000);assert.equal(s.teams[0].units[0].shield,0);
});
test('active skill groups retain ordered contents without using actor attack',()=>{
 const skill={id:'multi',name:'複合技能',cooldown:.1,mode:'all',conditions:[],effects:[group([{type:'damage',amount:{multiplier:5,constant:10}},{type:'posture',amount:20}])]};
 const s=B.create([[unit()],[unit()]],[skill]);s.started=true;s.teams[0].skillReady=0;assert.equal(B.cast(s,0),true);assert.equal(s.teams[1].units[0].hp,990);assert.equal(s.teams[1].units[0].posture,25);
});
test('group validation rejects nested rules, empty contents and conflicting movement',()=>{
 for(const actions of [[],[{type:'damage',amount:1,cond:[]}],[{actions:[{type:'damage',amount:1}]}],[{type:'jump'},{type:'swap'}],Array.from({length:9},()=>({type:'damage',amount:1}))])assert.throws(()=>group(actions));
 assert.throws(()=>group([{type:'damage',amount:1}],undefined,[{subject:'legacyEnemy',field:'down',value:true}]));
});
test('complete backup preserves grouped data and repairs only invalid action fields',()=>{
 const file=Backup.collect({getItem:()=>null}),e=group([{type:'damage',amount:{multiplier:2,formula:'target.hp / 10',constant:0}},{type:'shield',amount:0}]);file.data.characters.items[0].effects=[e];
 assert.deepEqual(Backup.prepare(file).file.data.characters.items[0].effects,[e]);
 file.data.characters.items[0].effects[0].actions[0].amount.multiplier='bad';const before=structuredClone(file),prepared=Backup.prepare(file),saved=prepared.file.data.characters.items[0].effects[0];assert.equal(saved.actions[0].amount.multiplier,0);assert.equal(saved.actions[0].amount.formula,'target.hp / 10');assert.equal(saved.actions[1].amount,0);assert.deepEqual(file,before);assert.ok(prepared.warnings.some(w=>w.includes('actions[0].amount.multiplier')));
});

test('counter death cancels the remaining contents of the same group',()=>{
 const Status=require('../js/statuses.js'),s=battle(group([{type:'damage',amount:1},{type:'posture',amount:90}]));s.teams[0].units[0].hp=10;Status.apply(s.teams[1].units[0],{status:'counter',duration:{kind:'permanent'}},20,0);B.step(s);assert.equal(s.teams[0].units[0].hp,0);assert.equal(s.teams[1].units[0].posture,1);
});
test('law passive groups execute all contents without actor attack multipliers',()=>{
 const L=require('../js/laws.js'),effects=[group([{type:'shield',amount:{multiplier:5,constant:7}},{type:'heal',amount:10}],[{side:'ally',mode:'self'}])],laws=L.validate([{id:'multi',name:'複合法則',shopPrice:0,shopWeight:0,stats:{},passives:[{when:'action',effects}]}]);
 const s=B.create([[unit([],{cooldown:.1,laws})],[unit()]]);s.teams[0].units[0].hp=900;B.step(s);assert.equal(s.teams[0].units[0].shield,7);assert.equal(s.teams[0].units[0].hp,910);
});
test('grouped jump keeps selected enemy for its following damage',()=>{
 const a=Array(10).fill(null),b=Array(10).fill(null);a[0]=unit([group([{type:'jump'},{type:'damage',amount:10}])],{cooldown:.1});b[5]=unit();const s=B.create([a,b],[],[10,10],{footprints:true});B.step(s);assert.equal(s.teams[0].units[0].slot,5);assert.equal(s.teams[1].units[0].hp,990);
});
