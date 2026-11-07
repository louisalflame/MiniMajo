const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../js/config.js'),B=require('../js/battle.js'),S=require('../js/statuses.js'),J=require('../js/journey.js'),D=require('../js/database.js');
const unit={name:'坦補',maxHp:100,cooldown:.1,effects:[{type:'heal',amount:100},{type:'shield',amount:100}]};
const tick=(s,n)=>{for(let i=0;i<n;i++)B.step(s);};
test('Config validates bounded positive integers and snapshots into each battle and journey',()=>{
 for(const key of ['battleSeconds','overtimeDamage','overtimeInterval'])for(const value of [0,-1,.5,Infinity,'10'])assert.throws(()=>C.validate({...C.defaults,[key]:value}));
 const config={...C.defaults,battleSeconds:2,overtimeDamage:7,overtimeGrowth:7,overtimeInterval:3},s=B.create([[unit],[unit]],[],[3,3],{config}),run=J.create(D.defaults,[],undefined,null,null,config);config.overtimeDamage=999;assert.equal(s.config.overtimeDamage,7);assert.equal(run.config.overtimeDamage,7);
});
test('overtime begins after X and adds Y after each A pulses without shields or hit triggers',()=>{
 const config={...C.defaults,battleSeconds:2,overtimeDamage:7,overtimeGrowth:7,overtimeInterval:3};assert.deepEqual([20,29,30,40,50,60,90].map(t=>C.damage(config,t)),[0,0,7,7,7,14,21]);
 const passive={...unit,effects:[],cooldown:120},s=B.create([[passive],[passive]],[],[3,3],{config});const u=s.teams[0].units[0];u.shield=999;S.apply(u,{status:'rage',duration:{kind:'permanent'}},1,0);S.apply(u,{status:'counter',duration:{kind:'permanent'}},100,0);
 tick(s,29);assert.equal(u.hp,100);tick(s,1);assert.equal(u.hp,93);assert.equal(s.teams[1].units[0].hp,93);assert.equal(u.shield,999);assert.equal(u.posture,0);assert.equal(u.nextAction,1200);tick(s,30);assert.equal(u.hp,65);
});
test('escalating overtime kills full-healing shield teams before their next heal and ends once',()=>{
 const s=B.create([[unit],[unit]],[],[3,3],{config:{...C.defaults,battleSeconds:1,overtimeDamage:50,overtimeGrowth:50,overtimeInterval:1}});tick(s,29);assert.equal(s.done,false);tick(s,1);assert.equal(s.done,true);assert.equal(s.tick,30);assert.equal(s.winner,'draw');assert.ok(s.teams.every(t=>t.units[0].hp===0));const copy=JSON.stringify(s);tick(s,20);assert.equal(JSON.stringify(s),copy);
});
test('Config editor saves, reloads and rejects invalid drafts without replacing saved data',()=>{
 function element(){return {children:[],append(...n){this.children.push(...n);},replaceChildren(...n){this.children=n;},setAttribute(){},addEventListener(k,fn){this[k]=fn;}};}
 const fs=require('node:fs'),vm=require('node:vm'),store=new Map(),nodes=new Map([...C.fields.map(f=>f[1]),'config-starting-active','config-overtime-example','config-message','config-form'].map(id=>[id,element()]));let changes=0;
 const boot=()=>vm.runInNewContext(fs.readFileSync('js/config-editor.js','utf8'),{GameConfig:C,CharacterLibrary:{getItems:()=>D.defaults},document:{getElementById:id=>nodes.get(id),createElement:element},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},window:{addEventListener(){},dispatchEvent(){changes++;}},Event:class{}});
 boot();nodes.get('config-time').value=45;nodes.get('config-form').submit({preventDefault(){}});assert.equal(changes,1);assert.equal(JSON.parse(store.get(C.key)).battleSeconds,45);boot();assert.equal(nodes.get('config-time').value,45);nodes.get('config-damage').value=0;nodes.get('config-form').submit({preventDefault(){}});assert.equal(changes,1);assert.equal(JSON.parse(store.get(C.key)).overtimeDamage,10);
 nodes.get('config-damage').value=10;let select=nodes.get('config-starting-active').children[0].children[0];select.value='axe';select.onchange();nodes.get('config-form').submit({preventDefault(){}});assert.equal(JSON.parse(store.get(C.key)).startingActive[0],'axe');
 select=nodes.get('config-starting-active').children[0].children[0];select.value='herb';select.onchange();nodes.get('config-form').submit({preventDefault(){}});boot();assert.equal(nodes.get('config-starting-active').children[0].children[0].value,'herb');
 const saved=store.get(C.key);select=nodes.get('config-starting-active').children[0].children[0];select.value='missing';select.onchange();nodes.get('config-form').submit({preventDefault(){}});assert.equal(store.get(C.key),saved);assert.match(nodes.get('config-message').textContent,/不存在/);
});

test('all tuning fields validate ranges and initial roster constraints',()=>{
 for(const [key,id,label,value,min,max,step] of C.fields){for(const invalid of [min-step,max+step,NaN,Infinity,'1',null,undefined])assert.throws(()=>C.validate({...C.defaults,[key]:invalid}),key);}
 assert.throws(()=>C.validate({...C.defaults,startingActive:3}));
 const source={...C.defaults,startingActive:Array(10).fill(null),startingGold:0,shopCount:0,sellPercent:0,normalReward:0,posturePercent:0,downMultiplier:0};assert.deepEqual(C.validate(source),source);
});
test('economy tuning snapshots control initial formation, shop count, sale rounding and zero stock',()=>{
 const X=require('../js/expedition.js'),config={...C.defaults,startingGold:19,startingActive:['short-sword',...Array(9).fill(null)],shopCount:2,sellPercent:33};
 const roster=X.create(D.defaults,[],config);config.sellPercent=100;assert.equal(roster.gold,19);assert.equal(roster.active.filter(Boolean).length,1);assert.equal(roster.reserve.filter(Boolean).length,0);
 assert.equal(X.shop(roster,'a',()=>0).filter(Boolean).length,2);assert.equal(X.sell(roster,'active',0),9);assert.equal(roster.gold,28);
 const empty=X.create(D.defaults,[],{...C.defaults,startingActive:Array(10).fill(null),shopCount:0});assert.equal(empty.active.filter(Boolean).length,0);assert.equal(X.shop(empty,'empty').filter(Boolean).length,0);
});
test('custom base journey rewards settle once for each encounter category',()=>{
 for(const [type,reward] of [['battle',7],['elite',11],['goal',13]]){
 const config={...C.defaults,normalReward:7,eliteReward:11,bossReward:13,},run=J.create(D.defaults,[],undefined,null,null,config);
 const id=Object.keys(run.map.map.cells).find(id=>run.map.map.cells[id].type===type);run.map.pending=id;const payload=J.start(run);config.normalReward=999;
 const result={token:payload.token,winner:0,hp:payload.loadouts[0].filter(Boolean).map(u=>u.maxHp)};assert.equal(J.settle(run,result).reward,reward);assert.equal(run.roster.gold,300+reward);assert.equal(run.map.alertPoints,undefined);assert.equal(J.settle(run,result),null);
 }
});
test('configured posture threshold, conversion and down multiplier apply to direct and periodic effects',()=>{
 const config={...C.defaults,postureLimit:10,posturePercent:100,downMultiplier:2},attacker={...unit,effects:[{type:'damage',amount:10}]},passive={...unit,cooldown:120,effects:[]};
 const state=B.create([[attacker],[passive]],[],[3,3],{config});tick(state,1);const victim=state.teams[1].units[0];assert.equal(victim.posture,10);assert.ok(victim.weakUntil>0);assert.equal(victim.hp,90);tick(state,1);assert.equal(victim.hp,70);
 const periodic=B.create([[passive],[passive]],[],[3,3],{config});const p=periodic.teams[0].units[0];S.apply(p,{status:'confusion',duration:{kind:'permanent'}},10,0);tick(periodic,10);assert.equal(p.posture,10);assert.ok(p.weakUntil>periodic.tick);
 const noPosture=B.create([[attacker],[passive]],[],[3,3],{config:{...config,posturePercent:0}});tick(noPosture,1);assert.equal(noPosture.teams[1].units[0].posture,0);
});

test('fixed initial formations preserve slots, duplicate instances, references and footprints',()=>{
 const X=require('../js/expedition.js'),slots=(...ids)=>[...ids,...Array(10-ids.length).fill(null)],wide={...D.defaults[0],space:2};
 const config={...C.defaults,startingActive:slots(wide.id,null,wide.id)},items=[wide,...D.defaults.slice(1)].reverse();
 const run=X.create(items,[],config);assert.equal(run.active[1],null);assert.equal(run.active[2].id,wide.id);assert.ok(run.reserve.every(u=>u===null));assert.notEqual(run.active[0].instanceId,run.active[2].instanceId);
 config.startingActive[0]='axe';assert.equal(run.config.startingActive[0],wide.id);run.active[0].maxHp=1;assert.equal(run.active[2].maxHp,180);
 assert.throws(()=>X.create(items,[],{...config,startingActive:slots(wide.id,'axe')}),/重疊/);
 assert.throws(()=>X.create(items,[],{...config,startingActive:[...Array(9).fill(null),wide.id]}),/超出/);
 assert.throws(()=>X.create(items,[],{...config,startingActive:slots('deleted')}),/不存在/);
 const Backup=require('../js/editor-backup.js'),backup=Backup.collect({getItem:()=>null});backup.data.config.startingActive=slots('deleted');assert.ok(Backup.validate(backup).data.config.startingActive.every(x=>x===null));
});
test('overtime cadence and linear growth are independent and use exact tick boundaries',()=>{
 const config={...C.defaults,battleSeconds:1,overtimePulse:.3,overtimeDamage:7,overtimeInterval:1,overtimeGrowth:4};
 assert.deepEqual([10,12,13,16,19,22,23,25,34].map(t=>C.damage(config,t)),[0,0,7,7,7,7,0,11,15]);
 assert.equal(C.damage({...config,overtimeGrowth:0},100),7);
 const state=B.create([[{...unit,cooldown:120,effects:[]}],[{...unit,cooldown:120,effects:[]}]],[],[3,3],{config});tick(state,12);assert.equal(state.teams[0].units[0].hp,100);tick(state,1);assert.equal(state.teams[0].units[0].hp,93);
});
test('base down duration reaches growth, laws, shop, encounter and runtime without resetting to four',()=>{
 const X=require('../js/expedition.js'),E=require('../js/enemy-teams.js'),L=require('../js/laws.js');
 const config={...C.defaults,weakDuration:2.5,postureLimit:1},base=D.validate({version:2,items:D.defaults,jobGrowth:{破陣:[{weakDuration:-1.2},{},{},{},{}]}}).items[0];
 const grown=D.atStars(base,2,config);assert.equal(grown.weakDuration,1.3);
 const law={shopPrice:50,shopWeight:100,id:'duration',name:'倒地增量',stats:{weakDuration:.7},passives:[]},enhanced=L.attach(grown,[law],config);assert.equal(enhanced.weakDuration,2);assert.equal(D.runtime(enhanced).weakDuration,2);
 assert.equal(D.atStars({...base,growth:[{weakDuration:-100},{},{},{},{}]},2,config).weakDuration,.1);
 const run=J.create(D.defaults,[],undefined,null,null,config);assert.equal(run.roster.active[0].weakDuration,2.5);assert.equal(X.shop(run.roster,'duration',()=>0)[0].weakDuration,2.5);
 run.map.pending=Object.keys(run.map.map.cells).find(id=>run.map.map.cells[id].type==='battle');const payload=J.start(run);assert.equal(payload.loadouts[1].find(Boolean).weakDuration,2.5);
 const victim={...unit,cooldown:120,effects:[]},state=B.create([[{...unit,effects:[{type:'damage',amount:2}]}],[victim]],[],[3,3],{config});tick(state,1);assert.equal(state.teams[1].units[0].weakUntil,26);
 const fromRuntime=B.create([[D.runtime(D.defaults[0])],[victim]],[],[3,3],{config});assert.equal(fromRuntime.teams[0].units[0].weakDuration,2.5);
});
test('only allies have active skills even after composition refresh or explicit enemy cast',()=>{
 const skill={id:'test',name:'主動',cooldown:1,mode:'all',conditions:[],effects:[{type:'damage',amount:1}]},state=B.create([[unit],[unit]],[skill]);state.started=true;
 assert.equal(state.teams[1].skill,null);assert.equal(B.canCast(state,0),false);assert.equal(B.canCast(state,1),false);const before=JSON.stringify(state);assert.equal(B.cast(state,1),false);assert.equal(JSON.stringify(state),before);tick(state,10);assert.equal(state.teams[1].skill,null);assert.equal(B.cast(state,0),true);
});

test('initial reserve is always empty and config page contains editable overtime controls',()=>{
 const X=require('../js/expedition.js'),fs=require('node:fs'),html=fs.readFileSync('editor.html','utf8'),panel=html.slice(html.indexOf('<div id="page-config"'),html.indexOf('<div id="page-characters"'));
 const run=X.create(D.defaults,[],{...C.defaults,startingReserve:['axe',...Array(9).fill(null)]});assert.ok(run.reserve.every(u=>u===null));assert.equal(Object.hasOwn(run.config,'startingReserve'),false);assert.equal(panel.includes('id="config-starting-reserve"'),false);
 for(const id of ['config-time','config-pulse','config-damage','config-interval','config-growth']){assert.ok(panel.includes('id="'+id+'" type="number"'),id);}
});

test('configured down speed reduction combines with haste, expires, and preserves stun freeze',()=>{
 const passive={...unit,cooldown:10,effects:[]};
 const make=percent=>B.create([[passive],[passive]],[],[10,10],{config:{...C.defaults,downSlowPercent:percent}});
 const s=make(20),u=s.teams[0].units[0];u.weakUntil=3;
 B.step(s);assert.ok(Math.abs(u.nextAction-100.2)<1e-8);
 B.step(s);assert.ok(Math.abs(u.nextAction-100.4)<1e-8);
 B.step(s);assert.ok(Math.abs(u.nextAction-100.4)<1e-8);assert.equal(u.weakUntil,0);
 const fast=make(20),f=fast.teams[0].units[0];f.weakUntil=10;
 S.apply(f,{status:'haste',duration:{kind:'seconds',value:5}},1,0);B.step(fast);
 assert.ok(Math.abs(f.nextAction-99.8)<1e-8);
 S.apply(f,{status:'stun',duration:{kind:'seconds',value:5}},1,fast.tick);const before=f.nextAction;
 B.step(fast);assert.ok(Math.abs(f.nextAction-before-1)<1e-8);
 for(const [percent,next] of [[0,100],[100,101]]){const t=make(percent);t.teams[0].units[0].weakUntil=10;B.step(t);assert.equal(t.teams[0].units[0].nextAction,next);}
});
test('down speed config repairs old files per field and retains a legal zero',()=>{
 const R=require('../js/saved-data.js'),old=structuredClone(C.defaults);delete old.downSlowPercent;
 const warnings=[],loaded=R.config(old,warnings);assert.equal(loaded.downSlowPercent,20);assert.ok(warnings.some(w=>w.includes('downSlowPercent')));
 assert.equal(R.config({...old,downSlowPercent:0},[]).downSlowPercent,0);
 for(const value of [-1,101,.5,'20'])assert.throws(()=>C.validate({...C.defaults,downSlowPercent:value}));
});
