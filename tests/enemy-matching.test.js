const {test}=require('node:test'),assert=require('node:assert/strict'),E=require('../js/enemy-teams.js'),D=require('../js/database.js'),J=require('../js/journey.js'),H=require('../js/hex-map.js'),Saved=require('../js/saved-data.js'),Backup=require('../js/editor-backup.js');
const team=(id,matchLevel,weight=100,category='normal')=>({id,name:id,matchLevel,weight,category,slots:[D.defaults[0].id,...Array(9).fill(null)]});
const pick=(teams,level,random=()=>0,category='normal')=>E.pick({version:1,teams},category,D.defaults,random,undefined,level).team.id;
test('exact matching beats any weight at other levels; closest level wins when absent',()=>{
 const teams=[team('early',1,1000000),team('exact',5,1),team('late',9,1000000)];for(const random of [()=>0,()=>.999])assert.equal(pick(teams,5,random),'exact');assert.equal(pick(teams,3),'early');assert.equal(pick(teams,7),'exact');assert.equal(pick(teams,8),'late');assert.equal(pick(teams,100),'late');
});
test('only same-level teams use weights, while disabled or empty teams cannot match',()=>{
 const teams=[team('one',3,1),team('three',3,3),team('disabled',4,0),{...team('empty',4),slots:Array(10).fill(null)}];assert.equal(pick(teams,4,()=>.249),'one');assert.equal(pick(teams,4,()=>.25),'three');assert.throws(()=>pick([team('disabled',1,0)],1));
});
test('boss ignores matching levels and other categories never enter the pool',()=>{
 const teams=[team('normal',4),team('boss-one',1,1,'boss'),team('boss-high',90,3,'boss')];assert.equal(pick(teams,4,()=>0,'boss'),'boss-one');assert.equal(pick(teams,4,()=>.25,'boss'),'boss-high');assert.equal(pick(teams,4,()=>.99),'normal');
});
test('enemy match level defaults, validates, repairs independently and survives backup',()=>{
 const source=team('valid',7),file=Backup.collect({getItem:()=>null});file.data.enemies={version:1,teams:[source]};assert.equal(Backup.prepare(file).file.data.enemies.teams[0].matchLevel,7);
 const legacy={...source};delete legacy.matchLevel;assert.equal(E.validate({version:1,teams:[legacy]}).teams[0].matchLevel,1);
 for(const invalid of [0,1.5,'2',null,1000001]){const raw={version:1,teams:[{...source,matchLevel:invalid}]},warnings=[];assert.throws(()=>E.validate(raw));const loaded=Saved.enemies(raw,warnings,D.defaults).teams[0];assert.equal(loaded.matchLevel,1);assert.equal(loaded.name,source.name);assert.equal(loaded.weight,source.weight);assert.deepEqual(loaded.slots,source.slots);assert.equal(raw.teams[0].matchLevel,invalid);assert.ok(warnings.some(w=>w.includes('matchLevel')));}
});
test('hidden player level rises once per victory including zero loot and boss; retries keep foes',()=>{
 const enemies={version:1,teams:[team('lv1',1),team('lv2',2),team('elite2',2,100,'elite'),team('boss',99,100,'boss')]},s=J.create(undefined,[],undefined,null,enemies);assert.equal(s.playerLevel,1);
 const next=H.neighbors(s.map.map,s.map.current)[0];s.map.map.cells[next].type='battle';J.move(s,next);let p=J.start(s);assert.equal(p.enemyName,'lv1');const hp=p.loadouts[0].filter(Boolean).map(u=>u.maxHp);J.settle(s,{token:p.token,winner:1,hp});assert.equal(s.playerLevel,1);s.playerLevel=2;assert.ok(J.move(s,next));p=J.start(s);assert.equal(p.enemyName,'lv1');J.settle(s,{token:p.token,winner:'draw',hp});assert.equal(s.playerLevel,2);
 for(const [type,name] of [['battle','lv2'],['elite','elite2'],['goal','boss']]){s.map.pending=next;s.map.map.cells[next].type=type;s.map.rewardLocks[next]={tier:'none',...H.rewardTiers.none,age:99,nextIn:null,nextTier:null,locked:true};delete s.enemyRolls[next];p=J.start(s);assert.equal(p.enemyName,name);const level=s.playerLevel,result={token:p.token,winner:0,hp};assert.equal(J.settle(s,{...result,token:'stale'}),null);assert.equal(s.playerLevel,level);J.settle(s,result);assert.equal(s.playerLevel,level+1);assert.equal(J.settle(s,result),null);assert.equal(s.playerLevel,level+1);J.claim(s,p.token,null);}
 assert.equal(J.create().playerLevel,1);
});
