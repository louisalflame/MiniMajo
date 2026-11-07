const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../js/battle.js'),D=require('../js/database.js'),E=require('../js/effects.js'),S=require('../js/statuses.js'),R=require('../js/saved-data.js'),Backup=require('../js/editor-backup.js');
const unit=(extra={})=>({...D.defaults[0],maxHp:1000,cooldown:120,space:1,effects:[],passives:[],attackRange:3,...extra});
const effect=(mode,extra={})=>E.validate({targets:[{side:'enemy',mode,...extra}],actions:[{type:'damage',amount:10}]});
function state(mode='lowestHp',extra={}){const a=Array(10).fill(null),b=Array(10).fill(null);a[2]=unit({cooldown:.1,effects:[effect(mode)],...extra});b[2]=unit();b[4]=unit();const s=B.create([a,b],[],[10,10],{footprints:true});s.random=()=>0;s.teams[1].items[2].hp=100;s.teams[1].items[2].posture=50;S.apply(s.teams[1].items[4],{status:'taunt',duration:{kind:'permanent'}},1,0);return s;}
const hp=s=>s.teams[1].units.map(u=>u.hp);
test('taunt overrides all five ordinary single-target rankings within actor range',()=>{
 for(const mode of ['primary','lowestHp','lowestHpRatio','highestPosture','random']){const s=state(mode);B.step(s);assert.deepEqual(hp(s),[100,990],mode);}
});
test('out-of-range, dead and condition-rejected taunts do not redirect',()=>{
 const far=state('lowestHp',{attackRange:1});B.step(far);assert.deepEqual(hp(far),[90,1000]);
 const dead=state();dead.teams[1].items[4].hp=0;B.step(dead);assert.deepEqual(hp(dead),[90,0]);
 const filtered=state();filtered.teams[1].items[2].race='機人';filtered.teams[1].items[4].race='人類';filtered.teams[0].units[0].effects=[effect('random',{targetCond:[{field:'race',value:'機人'}]})];B.step(filtered);assert.deepEqual(hp(filtered),[90,1000]);
});
test('multiple taunts choose nearest then randomly among equal footprint distances',()=>{
 const s=state();S.apply(s.teams[1].items[2],{status:'taunt',duration:{kind:'permanent'}},1,0);B.step(s);assert.deepEqual(hp(s),[90,1000]);
 for(const [roll,expected] of [[0,[90,1000]],[.99,[100,990]]]){const t=state();t.teams[0].units[0].space=3;S.apply(t.teams[1].items[2],{status:'taunt',duration:{kind:'permanent'}},1,0);t.random=()=>roll;B.step(t);assert.deepEqual(hp(t),expected);}
});
test('opposite, all, relative targets and allied searches ignore taunt',()=>{
 for(const [mode,expected] of [['opposite',[90,1000]],['all',[90,990]]]){const s=state(mode);B.step(s);assert.deepEqual(hp(s),expected);}
 const relative=state();relative.teams[0].units[0].effects=[effect('opposite'),effect('target',{base:'main'})];B.step(relative);assert.deepEqual(hp(relative),[80,1000]);
 const ally=state();ally.teams[0].units[0].hp=500;ally.teams[0].units[0].effects=[E.validate({targets:[{side:'ally',mode:'lowestHp'}],actions:[{type:'heal',amount:10}]})];B.step(ally);assert.equal(ally.teams[0].units[0].hp,510);assert.deepEqual(hp(ally),[100,1000]);
});
test('manual skills, passives, jump and movement do not redirect to taunt',()=>{
 const manual=state();manual.started=true;manual.teams[0].skill={enabled:true,name:'技能',cooldown:1,effects:[effect('lowestHp')]};B.cast(manual,0);assert.deepEqual(hp(manual),[90,1000]);
 const passive=state();passive.teams[0].units[0].effects=[];passive.teams[0].units[0].passives=[{when:'action',subject:{relation:'self',conditions:[]},effects:[effect('lowestHp')]}];B.step(passive);assert.deepEqual(hp(passive),[90,1000]);
 const jump=state();jump.teams[0].units[0].effects=[E.validate({targets:[{side:'enemy',mode:'lowestHp'}],actions:[{type:'jump'}]})];jump.teams[0].items[2]=null;jump.teams[0].items[0]=jump.teams[0].units[0];jump.teams[0].units[0].slot=0;B.step(jump);assert.equal(jump.teams[0].units[0].slot,2);
 const move=state();move.teams[0].units[0].effects=[];assert.equal(B.move(move,0,move.teams[0].units[0]),false);
});
test('legacy effects redirect, and taunt expires by time or owner actions without stacking',()=>{
 const legacy=state();legacy.teams[0].units[0].effects=[{type:'damage',amount:10}];B.step(legacy);assert.deepEqual(hp(legacy),[100,990]);
 const timed=state();S.apply(timed.teams[1].items[4],{status:'taunt',duration:{kind:'seconds',value:1}},1,0);for(let i=0;i<10;i++)B.step(timed);assert.equal(S.has(timed.teams[1].items[4],'taunt'),false);B.step(timed);assert.equal(timed.teams[1].items[2].hp,80);
 const s=state();const u=s.teams[1].items[4];S.apply(u,{status:'taunt',duration:{kind:'actions',value:2}},1,0);S.apply(u,{status:'taunt',duration:{kind:'actions',value:2}},1,0);assert.equal(u.statuses.length,1);S.actionEnd(u,[...u.statuses]);assert.equal(S.has(u,'taunt'),true);S.actionEnd(u,[...u.statuses]);assert.equal(S.has(u,'taunt'),false);
});
test('new status is fixed-strength and old libraries add it without changing the source',()=>{
 assert.equal(S.fixed('taunt'),true);assert.equal(S.durationPolicy('taunt'),'free');const e=E.validate({type:'status',status:'taunt',amount:99,target:'self',duration:{kind:'seconds',value:3}});assert.equal(e.amount,1);
 const old=S.snapshot();old.statuses=old.statuses.filter(d=>d.id!=='taunt');const original=structuredClone(old),warnings=[],loaded=R.statuses(old,warnings);assert.deepEqual(loaded.statuses.find(d=>d.id==='taunt').effects,[{behavior:'taunt',value:1}]);assert.deepEqual(old,original);assert.ok(warnings.some(w=>w.includes('taunt')));
 const broken=S.snapshot();broken.statuses.find(d=>d.id==='taunt').effects=[{behavior:'taunt',formula:'0'}];const notes=[],fixed=R.statuses(broken,notes);assert.deepEqual(fixed.statuses.find(d=>d.id==='taunt').effects,[{behavior:'taunt',value:1}]);assert.ok(notes.length);assert.throws(()=>S.validateLibrary(broken));
 const file=Backup.collect({getItem:()=>null});file.data.characters.items[0].effects=[e];const saved=Backup.prepare(file).file;assert.equal(saved.data.characters.items[0].effects[0].status,'taunt');assert.ok(saved.data.statuses.statuses.some(d=>d.id==='taunt'));
});
