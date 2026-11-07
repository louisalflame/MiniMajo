const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../js/database.js'),E=require('../js/enemy-teams.js'),J=require('../js/journey.js');
const make=()=>D.validate({version:2,jobGrowth:{破陣:Array.from({length:5},()=>({maxHp:40,damage:5,heal:3,shield:2}))},items:[{...D.defaults[0],stars:3},{...D.defaults[3],stars:1}]});
test('growth roundtrips and applies fixed increments from each starting star without mutation',()=>{
 const db=make(),base=structuredClone(db),a=D.atStars(db.items[0],6),b=D.atStars(db.items[1],4);
 assert.equal(a.maxHp,300);assert.equal(b.maxHp,300);assert.equal(a.effects[0].amount,16);
 assert.deepEqual(db,base);assert.deepEqual(D.validate(JSON.parse(JSON.stringify(db))),db);
 assert.deepEqual(D.validate({version:2,items:D.defaults}).jobGrowth,D.validateGrowth());
 for(const stars of [2,7,3.5])assert.throws(()=>D.atStars(db.items[0],stars));
 for(const n of [0.5,10001,'4'])assert.throws(()=>D.validate({...db,jobGrowth:{破陣:{damage:n}}}));
});
test('growth changes attack bonuses and HP while preserving constant terms and status effects',()=>{
 const u={...make().items[0],maxHp:9999,effects:[{type:'damage',amount:9999},{type:'heal',amount:10},{type:'shield',amount:10},{type:'damage',amount:{formula:'self.maxHp / 2'}},{type:'status',status:'poison',amount:4}]};
 const result=D.atStars(u,6);
 assert.equal(result.maxHp,10000);assert.equal(result.effects[0].amount,9999);
 assert.equal(result.effects[1].amount,10);assert.equal(result.effects[2].amount,10);
 assert.equal(result.effects[3].amount.formula,u.effects[3].amount.formula);assert.equal(result.outputBonuses.damage,15);assert.deepEqual(result.effects[4],u.effects[4]);
});
test('enemy slots retain independent stars, legacy defaults, and reject invalid levels and footprints',()=>{
 const items=make().items,t={id:'test',name:'測試',category:'normal',weight:100,slots:[items[0].id,items[0].id,...Array(8).fill(null)],stars:[3,6,...Array(8).fill(null)]};
 const board=E.formation(E.validate({version:1,teams:[t]}).teams[0],items);
 assert.equal(board[0].maxHp,180);assert.equal(board[1].maxHp,300);assert.equal(items[0].stars,3);
 const legacy={...t};delete legacy.stars;assert.equal(E.formation(legacy,items)[1].stars,3);
 assert.throws(()=>E.formation({...t,stars:[2,6]},items));
 assert.throws(()=>E.validate({version:1,teams:[{...t,stars:[3,6,5,...Array(7).fill(null)]}]}));
 assert.throws(()=>E.formation(t,items.map(u=>({...u,space:2}))),/重疊/);
});
test('new journey keeps profession growth in snapshot and sends upgraded enemies to battle',()=>{
 const db=make(),teams=E.defaults(db.items);teams.teams.forEach(t=>t.stars=t.slots.map(id=>id?6:null));
 const run=J.create(db.items,[],'growth',null,teams,{...require('../js/config.js').defaults,startingActive:['short-sword',...Array(9).fill(null)],startingReserve:['axe',...Array(9).fill(null)]});
 db.items[0].growth[3].maxHp=999;
 run.map.pending=Object.entries(run.map.map.cells).find(([,c])=>c.type==='battle')[0];
 const payload=J.start(run);
 assert.equal(payload.loadouts[1][0].stars,6);assert.equal(payload.loadouts[1][0].maxHp,300);
 assert.equal(payload.loadouts[1][0].effects[0].amount,16);
});
