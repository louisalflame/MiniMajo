const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../js/database.js');
class Element{
 constructor(){this.children=[];this.handlers={};this.dataset={};this.style={};this.value='';this.classList={toggle(){}};}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(){}
 addEventListener(k,f){this.handlers[k]=f;}
 querySelector(s){for(const child of this.children){if(child.className===s.slice(1))return child;const found=child.querySelector(s);if(found)return found;}return null;}
 querySelectorAll(){return [];}
}
test('character growth form previews, saves shared values, reloads and sends upgraded battle payload',()=>{
 const store=new Map(),html=fs.readFileSync('editor.html','utf8');
 store.set('minimajo.laws.v1',JSON.stringify({version:1,laws:[{id:'trial',name:'試打法則',shopPrice:50,shopWeight:100,stats:{damage:20,maxHp:10},passives:[]}]}));
 function setup(){
  const nodes=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()])),messages=[];
  nodes.get('capacity-self').value=10;nodes.get('capacity-enemy').value=10;
  nodes.get('battle-preview').contentWindow={postMessage:m=>messages.push(m)};
  const handlers={},window={addEventListener:(type,fn)=>{handlers[type]=fn;},dispatchEvent(){}};
  vm.runInNewContext(fs.readFileSync('js/app.js','utf8'),{
   window,document:{getElementById:id=>nodes.get(id),createElement:()=>new Element(),addEventListener(){}},
   GameConfig:require('../js/config.js'),CharacterArt:require('../js/character-art.js'),ItemDB:D,Laws:require('../js/laws.js'),Battle:require('../js/battle.js'),Statuses:require('../js/statuses.js'),
   SkillEditor:{getSkills:()=>[],setTeams(){}},
   EffectEditor:{refreshRoles(){},searchEditor:e=>({node:new Element(),read:()=>e}),row:e=>{const row=new Element();row.read=()=>structuredClone(e);return row;},describe:e=>String(e.amount)},
   localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
   CustomEvent:class{constructor(type,detail){this.type=type;this.detail=detail;}},
   requestAnimationFrame(){},performance:{now:()=>0},confirm:()=>true
  });return {nodes,messages,handlers};
 }
 let {nodes:n,messages,handlers}=setup();
 const firstSlot=()=>n.get('teams').children[0].querySelector('.slots').children[0];
 const addLaw=()=>{const picker=firstSlot().children[3].children[0];picker.value='trial';picker.onchange();};
 addLaw();addLaw();
 assert.equal(messages.at(-1).loadouts[0][0].effects[0].amount,16);assert.equal(messages.at(-1).loadouts[0][0].outputBonuses.damage,40);
 assert.equal(messages.at(-1).loadouts[0][0].laws.length,2);
 assert.equal(messages.at(-1).loadouts[0][0].maxHp,200);
 handlers.message({source:n.get('battle-preview').contentWindow,data:{type:'minimajo-battle-state',started:true}});
 const beforeLocked=messages.length;firstSlot().children[4].children[0].onclick();addLaw();assert.equal(messages.length,beforeLocked);
 handlers.message({source:n.get('battle-preview').contentWindow,data:{type:'minimajo-battle-state',started:false}});
 firstSlot().children[4].children[0].onclick();assert.equal(messages.at(-1).loadouts[0][0].laws.length,1);
 firstSlot().children[4].children[0].onclick();assert.equal(messages.at(-1).loadouts[0][0].effects[0].amount,16);
 const enemySlot=n.get('teams').children[1].querySelector('.slots').children[0];enemySlot.children[3].children[0].value='trial';enemySlot.children[3].children[0].onchange();
 assert.equal(messages.at(-1).loadouts[1][0].effects[0].amount,25);assert.equal(messages.at(-1).loadouts[1][0].outputBonuses.damage,20);
 addLaw();const character=firstSlot().children[1];character.value='herb';character.onchange();assert.equal(messages.at(-1).loadouts[0][0].laws.length,0);
 const original=firstSlot().children[1];original.value='short-sword';original.onchange();
 assert.equal(n.get('image-file').value,'');
 assert.equal(n.get('detail-image-file').value,'');n.get('detail-image-file').value='moon-witch-detail.png';
 n.get('attack').value='37';n.get('attack-range').value='4';
 n.get('character-description').value='自訂傷害\n自訂護盾';n.get('image-file').value='moon-witch.png';n.get('editor-form').onsubmit({preventDefault(){}});
 assert.equal(JSON.parse(store.get('minimajo.characters.v2')).items[0].imageFile,'moon-witch.png');
 assert.equal(JSON.parse(store.get('minimajo.characters.v2')).items[0].detailImageFile,'moon-witch-detail.png');
 assert.equal(messages.at(-1).loadouts[0][0].detailImageFile,'moon-witch-detail.png');
 assert.equal(messages.at(-1).loadouts[0][0].imageFile,'moon-witch.png');assert.equal(messages.at(-1).loadouts[0][0].attack,37);assert.equal(messages.at(-1).loadouts[0][0].attackRange,4);
 const before=store.get('minimajo.characters.v2');
 n.get('image-file').value='../bad.png';n.get('editor-form').onsubmit({preventDefault(){}});
 assert.equal(store.get('minimajo.characters.v2'),before);assert.match(n.get('form-message').textContent,/圖片檔名/);
 n.get('image-file').value='moon-witch.png';
 const rows=n.get('growth-job-1').children;
 rows.forEach(growth=>{growth.children[1].children[0].value=40;growth.children[2].children[0].value=5;for(const label of growth.children.slice(1)){const input=label.children[0];if(input.dataset.field==='statusDurationBonus')input.value=2;if(input.dataset.field==='statusAmountBonus')input.value=3;}});
 n.get('editor-form').handlers.input();
 assert.equal(n.get('growth-preview').children[0].children[6].children[1].textContent,'380（+200）');
 n.get('growth-form').onsubmit({preventDefault(){}});
 const saved=D.validate(JSON.parse(store.get('minimajo.characters.v2')));
 assert.equal(saved.jobGrowth.破陣[1].maxHp,40);assert.equal(saved.items.find(u=>u.id==='axe').growth[1].damage,5);
 const slots=n.get('teams').children[0].querySelector('.slots'),star=slots.children[0].children[2].children[0];
 star.value='6';star.onchange();
 assert.equal(messages.at(-1).loadouts[0][0].maxHp,380);
 assert.equal(messages.at(-1).loadouts[0][0].statusDurationBonus,10);assert.equal(messages.at(-1).loadouts[0][0].statusAmountBonus,15);
 assert.equal(messages.at(-1).loadouts[0][0].effects[0].amount,16);assert.equal(messages.at(-1).loadouts[0][0].outputBonuses.damage,25);
 ({nodes:n}=setup());assert.equal(n.get('character-description').value,'自訂傷害\n自訂護盾');assert.equal(n.get('image-file').value,'moon-witch.png');
 assert.equal(n.get('detail-image-file').value,'moon-witch-detail.png');
 n.get('duplicate').onclick();assert.equal(n.get('image-file').value,'moon-witch.png');assert.equal(n.get('detail-image-file').value,'moon-witch-detail.png');
 n.get('new').onclick();assert.equal(n.get('image-file').value,'');assert.equal(n.get('detail-image-file').value,'');
 assert.equal(n.get('growth-job-1').children[0].children[1].children[0].value,40);
 // Both bonus tabs persist with growth, and saving a character keeps the tables.
 n.get('growth-race').children[0].children[1].children[0].value=25;
 n.get('growth-rarity').children[0].children[1].children[0].value=15;
 n.get('growth-form').onsubmit({preventDefault(){}});
 n.get('editor-form').onsubmit({preventDefault(){}});
 const withBonuses=JSON.parse(store.get('minimajo.characters.v2'));
 assert.equal(withBonuses.raceBonuses.人類.maxHp,25);assert.equal(withBonuses.rarityBonuses.SR.maxHp,15);
 ({nodes:n}=setup());assert.equal(n.get('growth-race').children[0].children[1].children[0].value,25);
 assert.equal(n.get('growth-rarity').children[0].children[1].children[0].value,15);
 const beforeInvalid=store.get('minimajo.characters.v2');n.get('growth-race').children[0].children[1].children[0].value='';
 n.get('growth-form').onsubmit({preventDefault(){}});assert.equal(store.get('minimajo.characters.v2'),beforeInvalid);
});
