const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../js/battle.js'),D=require('../js/database.js'),E=require('../js/effects.js'),L=require('../js/laws.js'),S=require('../js/skills.js'),J=require('../js/journey.js'),H=require('../js/hex-map.js'),Teams=require('../js/enemy-teams.js'),R=require('../js/saved-data.js');
const shield=n=>E.validate({type:'shield',amount:n,targets:[{side:'ally',mode:'self'}]});
const skill=(id='test')=>S.validate({version:1,skills:[{id,name:id,mode:'all',conditions:[],cooldown:1,effects:[shield(10)]}]}).skills[0];
const passives=L.validatePassives([{when:'playerSkill',effects:[shield(3)]},{when:'allySkillResolved',effects:[shield(5)]}]);
const unit=()=>({...D.defaults[0],maxHp:500,cooldown:120,effects:[],passives,laws:L.validate([{id:'test-law',name:'法則',shopPrice:0,shopWeight:0,passives}])});
test('both sides cast their own ultimate, each timing only reaches its side and repeats after cooldown',()=>{
 const s=B.create([[unit()],[unit()]],[skill('ally')],[10,10],{enemySkill:skill('enemy')});
 assert.equal(B.cast(s,1),false);for(let n=0;n<10;n++)B.step(s);
 assert.equal(s.teams[1].skill.id,'enemy');assert.equal(B.cast(s,1),true);
 assert.deepEqual(s.teams.map(t=>t.units[0].shield),[0,26]);
 assert.equal(B.cast(s,1),false);assert.equal(B.cast(s,0),true);assert.deepEqual(s.teams.map(t=>t.units[0].shield),[26,26]);
 for(let n=0;n<10;n++)B.step(s);assert.equal(B.cast(s,1),true);assert.deepEqual(s.teams.map(t=>t.units[0].shield),[26,52]);
});
test('enemy casts obey disabled switch, readiness, stun and battle end without consuming cooldown',()=>{
 const s=B.create([[unit()],[unit()]],[skill()],[10,10],{enemySkill:skill()});for(let n=0;n<10;n++)B.step(s);
 const ready=s.teams[1].skillReady;
 s.activeSkillsEnabled=false;assert.equal(B.cast(s,1),false);s.activeSkillsEnabled=true;
 const Status=require('../js/statuses.js');Status.apply(s.teams[1].units[0],{status:'stun',duration:{kind:'seconds',value:1}},1,s.tick);
 assert.equal(B.cast(s,1),false);assert.equal(s.teams[1].skillReady,ready);
 s.teams[1].units[0].statuses=[];s.done=true;assert.equal(B.cast(s,1),false);assert.equal(s.teams[1].skillReady,ready);
});
test('journey starts with first eligible player skill; only elite and boss get editor-selected enemy skill',()=>{
 const skills=[{...skill('blocked'),conditions:[{kind:'count',field:'id',value:'missing',op:'gte',count:1}]},skill('first'),skill('enemy')];
 for(const type of ['battle','elite','goal']){
  const s=J.create(undefined,skills,'enemy-ultimate');assert.equal(s.roster.skillId,'first');s.enemies.teams.forEach(t=>t.skillId='enemy');
  const id=H.neighbors(s.map.map,s.map.current)[0];s.map.map.cells[id].type=type;assert.ok(J.move(s,id));
  const payload=J.start(s);assert.equal(payload.enemySkill?.id??null,type==='battle'?null:'enemy');assert.deepEqual(payload.skills.map(x=>x.id),['first']);
  assert.deepEqual(J.prepare(s).enemySkill,payload.enemySkill);
 }
 const empty=J.create(undefined,[],'no-skills');assert.equal(empty.roster.skillId,null);
});
test('enemy skill field repairs per field and invalid references without losing the team',()=>{
 const team=Teams.defaults(D.defaults).teams[0];
 for(const value of [undefined,42,{},'bad id']){const warnings=[],data=R.enemies({version:1,teams:[{...team,skillId:value}]},warnings,D.defaults,[skill()]);assert.equal(data.teams[0].skillId,null);assert.equal(data.teams[0].name,team.name);assert.ok(warnings.some(x=>x.includes('skillId')));}
 const warnings=[],data=R.enemies({version:1,teams:[{...team,skillId:'deleted'}]},warnings,D.defaults,[skill()]);assert.equal(data.teams[0].skillId,null);assert.ok(warnings.some(x=>x.includes('引用失效')));
 assert.equal(R.enemies({version:1,teams:[{...team,skillId:'test'}]},[],D.defaults,[skill()]).teams[0].skillId,'test');
 assert.throws(()=>Teams.validate({version:1,teams:[{...team,skillId:false}]}),/極式/);
});
