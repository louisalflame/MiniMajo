const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../js/battle.js'),E=require('../js/effects.js'),L=require('../js/laws.js');
const unit=(job='支援',space=1,effects=[])=>({name:job,job,space,maxHp:100,cooldown:.1,moveDistance:0,effects});
const row=(...entries)=>{const a=Array(10).fill(null);for(const [slot,u] of entries)a[slot]=u;return a;};
const swap=E.validate({type:'swap',targeting:{side:'ally',mode:'primary',conditions:[{field:'job',value:'支援'}]}});
test('swap filters teammates and allows following attack from new position without changing identity',()=>{
 const s=B.create([row([0,unit('破陣',1,[swap,{type:'damage',amount:10}])],[4,unit()]),row([4,unit()])],[],[10,10],{footprints:true});const a=s.teams[0].items[0],b=s.teams[0].items[4];B.step(s);assert.equal(a.slot,4);assert.equal(b.slot,0);assert.equal(a.startSlot,0);assert.equal(a.stats.actions,1);assert.equal(s.teams[1].items[4].hp,90);assert.equal(s.teams[0].items[4],a);
});
test('wide swaps reject overlap, third-party collision and boundary overflow atomically',()=>{
 for(const [a,b,other] of [[2,1,null],[0,4,5],[0,9,null]]){const s=B.create([row([a,unit('破陣',2)],[b,unit()],...(other===null?[]:[[other,unit()]])),row([0,unit()])],[],[10,10],{footprints:true});const own=s.teams[0],before=own.items.slice(),positions=own.units.map(u=>u.slot);assert.equal(B.swap(s,0,own.items[a],own.items[b]),false);assert.deepEqual(own.items,before);assert.deepEqual(own.units.map(u=>u.slot),positions);}
 const s=B.create([row([0,unit('破陣',2)],[4,unit('支援',2)]),row([0,unit()])],[],[10,10],{footprints:true});assert.equal(B.swap(s,0,s.teams[0].items[0],s.teams[0].items[4]),true);assert.equal(B.layoutValid(s.teams[0].items),true);
});
test('swap excludes dead and self; validates conditions and own swap law timings',()=>{
 const s=B.create([row([0,unit('支援',1,[swap])],[4,unit()]),row([0,unit()])],[],[10,10],{footprints:true});s.teams[0].items[4].hp=0;B.step(s);assert.equal(s.teams[0].items[0].slot,0);
 assert.throws(()=>E.validate({...swap,targeting:{side:'enemy',mode:'primary'}}));assert.throws(()=>E.validate({...swap,targeting:{...swap.targeting,conditions:[{field:'job',value:'不存在'}]}}));assert.throws(()=>E.validate({...swap,targeting:{side:'ally',mode:'all'}}));
 for(const when of ['swapInitiated','swapReceived']){const law={shopPrice:50,shopWeight:100,id:when,name:when,passives:[{when,subject:{relation:'self',conditions:[]},effects:[swap]}]};assert.equal(L.validate([law])[0].passives[0].when,when);law.passives[0].subject.relation='ally';assert.throws(()=>L.validate([law]));}
});


test('swap observers receive one event for the initiator after a successful enemy swap',()=>{
 const advance=E.validate({type:'advance',amount:1,targets:[{side:'ally',mode:'self'}]});
 const observer={...unit(),cooldown:10,passives:[{when:'swapped',subject:{relation:'enemy',conditions:[]},effects:[advance]}]};
 observer.passives.push({when:'swapped',subject:{relation:'enemy',conditions:[{field:'job',value:'支援'}]},effects:[advance]});
 const s=B.create([row([0,observer]),row([0,unit('破陣')],[4,unit()])],[],[10,10],{footprints:true});
 const [a,b]=s.teams[1].units;
 assert.equal(B.swap(s,1,a,a),false);
 assert.equal(s.teams[0].units[0].nextAction,100);
 assert.equal(B.swap(s,1,a,b),true);
 assert.equal(a.slot,4);
 assert.equal(s.teams[0].units[0].nextAction,90);
});
