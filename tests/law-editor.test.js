const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.handlers={};this.dataset={};this.value='';}
 append(...nodes){nodes.forEach(n=>{n.parent=this;this.children.push(n);});}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 remove(){this.parent.children=this.parent.children.filter(x=>x!==this);}
 setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(k,f){this.handlers[k]=f;}
 get options(){return this.children;}
 querySelectorAll(q){return this.children.flatMap(n=>[...(q.split(',').includes(n.tag)?[n]:[]),...n.querySelectorAll(q)]);}
}
function setup(store=new Map()){
 const nodes=new Map([...fs.readFileSync('editor.html','utf8').matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element('div')]));
 const context={document:{getElementById:id=>nodes.get(id),createElement:t=>new Element(t)},structuredClone,confirm:()=>true,Event:class{},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},addEventListener(){},dispatchEvent(){}};
 context.window=context;Object.assign(context,{ItemDB:require('../js/database.js'),Laws:require('../js/laws.js'),Effects:require('../js/effects.js'),Statuses:require('../js/statuses.js'),Formula:require('../js/formula.js'),CharacterEnums:require('../js/enums.js')});
 vm.createContext(context);for(const f of ['formula-editor','effect-editor','law-editor'])vm.runInContext(fs.readFileSync('js/'+f+'.js','utf8'),context);
 return {nodes,context,store};
}
const submit=n=>n.get('law-form').onsubmit({preventDefault(){}});

test('removed journey timings are absent and player skill timing saves',()=>{
 const {nodes:n,store}=setup();n.get('law-new').onclick();n.get('law-add-passive').onclick();
 const card=n.get('law-passives').children[0],when=card.querySelectorAll('select').find(x=>x.attrs['aria-label']==='觸發時機');
 for(const kind of ['starUp','victory','travel','rest','purchase','sale'])assert.equal(when.options.some(o=>o.value===kind),false);
 when.value='playerSkill';when.onchange();submit(n);assert.equal(JSON.parse(store.get('minimajo.laws.v1')).laws[0].passives[0].when,'playerSkill');
});

test('law editor creates visual conditions and constant effects without attack multipliers, persists and reloads',()=>{
 let {nodes:n,store}=setup();assert.equal(n.get('law-form').hidden,true);assert.equal(n.get('law-list').children.length,1);
 n.get('law-new').onclick();assert.equal(n.get('law-form').hidden,false);n.get('law-name').value='反擊法則';n.get('law-stats').children[0].children[0].value=25;n.get('law-add-passive').onclick();
 const card=n.get('law-passives').children[0],find=label=>card.querySelectorAll('select').find(x=>x.attrs['aria-label']===label);
 find('觸發時機').value='attacked';card.children.find(x=>x.textContent==='＋ 角色條件').onclick();find('條件屬性').value='stars';find('條件屬性').onchange();find('條件數值').value='4';
 assert.equal(find('倍率模式'),undefined);
 const numeric=card.querySelectorAll('input').find(x=>x.attrs['aria-label']==='常數整數');numeric.value='9';numeric.oninput();submit(n);
 const saved=JSON.parse(store.get('minimajo.laws.v1')).laws[0];assert.equal(saved.stats.maxHp,25);assert.equal(saved.passives[0].when,'attacked');assert.equal(saved.passives[0].subject.conditions[0].value,4);assert.equal(saved.passives[0].effects[0].actions[0].amount.constant,9);
 ({nodes:n}=setup(store));assert.equal(n.get('law-name').value,'反擊法則');assert.equal(n.get('law-passives').children.length,1);
 n.get('law-copy').onclick();submit(n);assert.equal(JSON.parse(store.get('minimajo.laws.v1')).laws.length,2);
 n.get('law-delete').onclick();assert.equal(JSON.parse(store.get('minimajo.laws.v1')).laws.length,1);
});
test('invalid law and failed storage preserve saved library and editable draft',()=>{
 const {nodes:n,store,context}=setup();n.get('law-new').onclick();submit(n);const before=store.get('minimajo.laws.v1');n.get('law-name').value='';submit(n);assert.equal(store.get('minimajo.laws.v1'),before);
 n.get('law-name').value='修改';context.localStorage.setItem=()=>{throw Error('quota');};submit(n);assert.equal(context.LawLibrary.get()[0].name,'新法則');assert.equal(n.get('law-name').value,'修改');assert.match(n.get('law-message').textContent,/quota/);
});

test('law editor defaults, persists and validates price and weight including zeros',()=>{
 let {nodes:n,store}=setup();n.get('law-new').onclick();assert.equal(n.get('law-shop-price').value,50);assert.equal(n.get('law-shop-weight').value,100);
 n.get('law-shop-price').value='0';n.get('law-shop-weight').value='0';submit(n);
 assert.equal(JSON.parse(store.get('minimajo.laws.v1')).laws[0].shopPrice,0);assert.equal(JSON.parse(store.get('minimajo.laws.v1')).laws[0].shopWeight,0);
 ({nodes:n}=setup(store));assert.equal(n.get('law-shop-price').value,0);const saved=store.get('minimajo.laws.v1');
 for(const v of ['',-1,1.5,1000001,'bad']){n.get('law-shop-price').value=v;submit(n);assert.equal(store.get('minimajo.laws.v1'),saved);}
 n.get('law-shop-price').value=50;for(const v of ['',-1,1.5,1000001,'bad']){n.get('law-shop-weight').value=v;submit(n);assert.equal(store.get('minimajo.laws.v1'),saved);}
});

test('law editor saves reloads and copies description and optional image path',()=>{
 let {nodes:n,store}=setup();n.get('law-new').onclick();assert.equal(n.get('law-description').value,'');assert.equal(n.get('law-image-path').value,'');n.get('law-description').value='介紹\n第二行';n.get('law-image-path').value='images/laws/test.png';submit(n);({nodes:n}=setup(store));assert.equal(n.get('law-description').value,'介紹\n第二行');assert.equal(n.get('law-image-path').value,'images/laws/test.png');n.get('law-copy').onclick();assert.equal(n.get('law-description').value,'介紹\n第二行');n.get('law-image-path').value='';submit(n);assert.equal(JSON.parse(store.get('minimajo.laws.v1')).laws[1].imagePath,'');
});
