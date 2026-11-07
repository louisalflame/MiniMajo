const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../js/battle.js'),D=require('../js/database.js'),E=require('../js/effects.js'),L=require('../js/laws.js'),S=require('../js/statuses.js'),Backup=require('../js/editor-backup.js');
const unit=(extra={})=>({...D.defaults[0],cooldown:120,maxHp:500,space:1,passives:[],effects:[],...extra});
const action=(type,amount,mode='primary',side='enemy',base)=>E.validate({targets:[{side,mode,...(base?{base}:{})}],actions:[{type,amount}]});
const shield=()=>action('shield',7,'self','ally');
const passive=(when,effects=[shield()])=>({when,subject:{relation:'enemy',conditions:[]},effects});
const state=(effects,p=[passive('normalDown'),passive('normalKill')],enemy=unit())=>B.create([[unit({cooldown:.1,effects,passives:p})],[enemy]],[],[10,10],{footprints:true});
test('automatic direct damage and direct posture trigger only on new knockdown',()=>{
 for(const type of ['damage','posture']){const s=state([action(type,type==='damage'?10:100)]);s.teams[1].units[0].posture=99;B.step(s);assert.equal(s.teams[0].units[0].shield,7);assert.ok(s.teams[1].units[0].weakUntil>s.tick);B.step(s);assert.equal(s.teams[0].units[0].shield,7);}
});
test('lethal direct main and secondary actions trigger kill but not knockdown',()=>{
 for(const effects of [[action('damage',500)],[action('damage',1),action('damage',500)]]){const s=state(effects);B.step(s);assert.equal(s.teams[1].units[0].hp,0);assert.equal(s.teams[0].units[0].shield,7);}
 const s=state([action('posture',100),action('damage',500)]);B.step(s);assert.equal(s.teams[0].units[0].shield,14);
});
test('only the actual causer owns the trigger; same-side observers and enemy do not fire',()=>{
 const p=passive('normalKill'),a=Array(10).fill(null),b=Array(10).fill(null);a[0]=unit({cooldown:.1,effects:[action('damage',500)],passives:[p]});a[2]=unit({passives:[p]});b[0]=unit({passives:[p]});
 const s=B.create([a,b],[],[10,10],{footprints:true});B.step(s);assert.deepEqual(s.teams[0].units.map(u=>u.shield),[7,0]);assert.equal(s.teams[1].units[0].shield,0);
});
test('multi-target action triggers each innate and attached passive once per chain',()=>{
 const p=passive('normalKill'),law=L.validate([{id:'kill',name:'擊殺',shopPrice:0,shopWeight:0,passives:[p]}])[0];
 const s=B.create([[unit({cooldown:.1,effects:[action('damage',500,'all')],passives:[p],laws:[law]})],[unit(),unit()]],[],[10,10]);B.step(s);assert.equal(s.teams[0].units[0].shield,14);assert.deepEqual(s.teams[1].units.map(u=>u.hp),[0,0]);
});
test('event target supports pursuing knocked enemy and splashing beside killed enemy',()=>{
 const s=state([action('posture',100)],[passive('normalDown',[action('damage',10,'target','enemy','event')])]);B.step(s);assert.equal(s.teams[1].units[0].hp,485);
 const a=Array(10).fill(null),b=Array(10).fill(null);a[3]=unit({cooldown:.1,effects:[action('damage',500)],passives:[passive('normalKill',[action('damage',10,'neighbors','enemy','event')])]});b[2]=unit();b[3]=unit({space:3});b[6]=unit();
 const killed=B.create([a,b],[],[10,10],{footprints:true});B.step(killed);assert.deepEqual(killed.teams[1].units.map(u=>u.hp),[490,0,490]);
});
test('manual skills, passive direct effects and friendly fire do not trigger',()=>{
 const manual=state([]);manual.started=true;manual.teams[0].skill={enabled:true,name:'技能',cooldown:1,effects:[action('posture',100),action('damage',500)]};B.cast(manual,0);assert.equal(manual.teams[0].units[0].shield,0);
 const nested=state([], [{when:'action',subject:{relation:'self',conditions:[]},effects:[action('posture',100),action('damage',500)]},passive('normalKill'),passive('normalDown')]);B.step(nested);assert.equal(nested.teams[0].units[0].shield,0);
 const friendly=state([action('posture',100,'self','ally'),action('damage',500,'self','ally')]);B.step(friendly);assert.equal(friendly.teams[0].units[0].shield,0);
});
test('counter and source-attributed periodic poison/confusion do not trigger',()=>{
 const s=state([action('damage',1)],[],unit({passives:[passive('normalKill')]}));s.teams[0].units[0].hp=1;S.apply(s.teams[1].units[0],{status:'counter',duration:{kind:'permanent'}},10,0);B.step(s);assert.equal(s.teams[0].units[0].hp,0);assert.equal(s.teams[1].units[0].shield,0);
 for(const kind of ['poison','confusion']){const pulse=state([]);pulse.teams[0].units[0].nextAction=1200;const x=S.apply(pulse.teams[1].units[0],{status:kind,duration:{kind:'permanent'}},500,0);x.sourceId=pulse.teams[0].units[0].battleId;for(let i=0;i<10;i++)B.step(pulse);assert.equal(pulse.teams[0].units[0].shield,0);}
});
test('event attributes filter victims and new timings survive fieldwise backup repairs',()=>{
 const p=passive('normalKill');p.subject.conditions=[{field:'race',value:'機人'}];const s=state([action('damage',500)],[p],unit({race:'人類'}));B.step(s);assert.equal(s.teams[0].units[0].shield,0);
 const file=Backup.collect({getItem:()=>null});file.data.characters.items[0].passives=[passive('normalDown'),passive('normalKill')];const saved=Backup.prepare(file).file.data.characters.items[0].passives;assert.deepEqual(saved.map(p=>p.when),['normalDown','normalKill']);
 file.data.characters.items[0].passives[0].subject.relation='self';const before=structuredClone(file),fixed=Backup.prepare(file);assert.equal(fixed.file.data.characters.items[0].passives[0].subject.relation,'enemy');assert.deepEqual(file,before);assert.ok(fixed.warnings.length);assert.throws(()=>L.validatePassives([{...passive('normalKill'),subject:{relation:'self',conditions:[]}}]));
});

test('normal hit identifies the attacker and fires once for shielded multi-target damage',()=>{
 const watcher=unit({passives:[{when:'normalHit',subject:{relation:'ally',conditions:[{field:'affinity',value:'物理'}]},effects:[action('shield',7,'target','ally','event')]}]});
 const attacker=unit({affinity:'物理',cooldown:.1,effects:[action('damage',10,'all')]});
 const s=B.create([[attacker,watcher],[unit(),unit()]],[],[10,10]);
 s.teams[1].units.forEach(u=>u.shield=20);
 B.step(s);
 assert.deepEqual(s.teams[0].units.map(u=>u.shield),[7,0]);
 assert.deepEqual(s.teams[1].units.map(u=>u.hp),[500,500]);
});
test('normal hit skips zero damage, dodge, movement and manual skill damage',()=>{
 const onHit={when:'normalHit',subject:{relation:'self',conditions:[]},effects:[shield()]};
 for(const mode of ['zero','dodge','move','skill']){
  const s=state(mode==='skill'?[]:[action('damage',mode==='zero'?0:10)],[onHit]);
  if(mode==='dodge')S.apply(s.teams[1].units[0],{status:'dodge'},1,0);
  if(mode==='move'){
   const enemy=s.teams[1].items[0];
   s.teams[1].items.splice(0,1,null,null,enemy);
   enemy.slot=2;
   s.teams[0].items.push(null,null);
  }
  if(mode==='skill'){
   s.started=true;
   s.teams[0].skill={enabled:true,name:'技能',cooldown:1,effects:[action('damage',10)]};
   B.cast(s,0);
  }else B.step(s);
  assert.equal(s.teams[0].units[0].shield,0,mode);
  if(mode==='move')assert.equal(s.teams[0].units[0].slot,1);
 }
});


test('status gain matches the applied status and recipient, including on refresh',()=>{
 const gift=kind=>E.validate({targets:[{side:'ally',mode:'self'}],actions:[{type:'status',status:kind,target:'self',amount:1,duration:{kind:'seconds',value:5}}]});
 const reward=(mode,status)=>({
  when:'statusGained',statusCondition:{mode,status},subject:{relation:'ally',conditions:[{field:'affinity',value:'物理'}]},
  effects:[action('shield',7,'target','ally','event')]
 });
 const recipient=unit({affinity:'物理',cooldown:.1,effects:[gift('power'),gift('poison')]});
 const listeners=[reward('positive'),reward('negative'),reward('specified','power'),reward('specified','dodge')];
 const s=B.create([[recipient,unit({passives:listeners})],[unit()]],[],[10,10]);
 const a=s.teams[0].units[0];
 B.step(s);
 assert.equal(a.shield,21);
 B.step(s);
 assert.equal(a.shield,42);
 a.statuses=a.statuses.filter(status=>status.kind!=='power');
 B.step(s);
 assert.equal(a.shield,63);
});
test('status gain filters and classifications survive fieldwise backup repair',()=>{
 const file=Backup.collect({getItem:()=>null});
 const passive={when:'statusGained',subject:{relation:'ally',conditions:[]},statusCondition:{mode:'specified',status:'power'},effects:[shield()]};
 file.data.characters.items[0].passives=[passive];
 const loaded=Backup.prepare(file);
 assert.deepEqual(loaded.file.data.characters.items[0].passives[0].statusCondition,passive.statusCondition);
 assert.equal(loaded.file.data.statuses.statuses.find(x=>x.id==='poison').classification,'negative');
 file.data.characters.items[0].passives[0].statusCondition.status='missing';
 file.data.statuses.statuses.find(x=>x.id==='power').classification=123;
 const repaired=Backup.prepare(file);
 assert.deepEqual(repaired.file.data.characters.items[0].passives[0].statusCondition,{mode:'any'});
 assert.equal(repaired.file.data.statuses.statuses.find(x=>x.id==='power').classification,'positive');
 assert.ok(repaired.warnings.some(x=>x.includes('statusCondition.status')));
 assert.ok(repaired.warnings.some(x=>x.includes('classification')));
});

test('ally skill resolution observes completed effects and only reaches the casting team',()=>{
 const reward=E.validate({type:'shield',amount:{formula:'self.hp'},targets:[{side:'ally',mode:'self'}]});
 const p=L.validatePassives([{when:'allySkillResolved',effects:[reward]}]);
 const s=B.create([[unit({passives:p}),unit({passives:p})],[unit({passives:p})]],[],[10,10]);
 s.teams[0].units[0].hp=300;
 s.started=true;
 s.teams[0].skill={enabled:true,name:'技能',cooldown:1,effects:[action('heal',50,'self','ally')]};
 assert.equal(B.cast(s,0),true);
 assert.deepEqual(s.teams[0].units.map(u=>u.shield),[350,500]);
 assert.equal(s.teams[1].units[0].shield,0);
 assert.equal(B.cast(s,0),false);
 assert.equal(s.teams[0].units[0].shield,350);
});

test('exclude self is applied before random selection and repaired separately on load',()=>{
 const e=E.validate({targets:[{side:'ally',mode:'random',excludeSelf:true}],actions:[{type:'shield',amount:7}]});
 const s=B.create([[unit({cooldown:.1,effects:[e]}),unit()],[unit()]],[],[10,10]);s.random=()=>0;
 B.step(s);
 assert.deepEqual(s.teams[0].units.map(u=>u.shield),[0,7]);
 const file=Backup.collect({getItem:()=>null});
 file.data.characters.items[0].effects=[e];
 assert.equal(Backup.prepare(file).file.data.characters.items[0].effects[0].targets[0].excludeSelf,true);
 file.data.characters.items[0].effects[0].targets[0].excludeSelf='bad';
 const repaired=Backup.prepare(file);
 assert.equal(repaired.file.data.characters.items[0].effects[0].targets[0].excludeSelf,false);
 assert.ok(repaired.warnings.some(w=>w.includes('excludeSelf')));
});

test('permanent stacks emit gain events without letting a passive trigger itself twice per chain',()=>{
 const gain=E.validate({targets:[{side:'ally',mode:'self'}],actions:[{type:'status',status:'enhancedPower',amount:3}]});
 const p={when:'statusGained',statusCondition:{mode:'specified',status:'enhancedPower'},subject:{relation:'self',conditions:[]},effects:[gain]};
 const s=state([gain],[p]);
 const a=s.teams[0].units[0];
 for(const total of [6,12,18]){
  B.step(s);
  assert.equal(S.sum(a,'power'),total);
 }
});
