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
 vm.createContext(context);for(const f of ['formula-editor','status-editor'])vm.runInContext(fs.readFileSync('js/'+f+'.js','utf8'),context);
 return {nodes,context,store};
}

test('dodge rule locks unused parameters and switching back restores editing',()=>{
 const {nodes:n}=setup();n.get('status-new').onclick();
 const row=n.get('status-rules').children[0],find=label=>row.querySelectorAll('select,input').find(x=>x.attrs['aria-label']===label);
 const behavior=find('狀態作用'),mode=find('狀態數值模式'),value=find('倍率或固定值');
 mode.value='formula';mode.onchange();behavior.value='dodge';behavior.onchange();
 assert.equal(mode.disabled,true);assert.equal(mode.value,'value');assert.equal(value.disabled,true);assert.equal(Number(value.value),1);
 assert.deepEqual(JSON.parse(JSON.stringify(row.read())),{behavior:'dodge',value:1});
 assert.match(n.get('status-policy').textContent,/1 次敵方普通攻擊/);
 behavior.value='power';behavior.onchange();assert.equal(mode.disabled,false);assert.equal(value.disabled,false);
});
test('status editor adds compound formula rules, saves and reloads',()=>{
 const original=require('../js/statuses.js').snapshot();try{
 let {nodes:n,store}=setup();assert.equal(n.get('status-list').children.length,21);n.get('status-new').onclick();n.get('status-name').value='自訂灼燒';n.get('status-add').onclick();
 const row=n.get('status-rules').children[1],mode=row.querySelectorAll('select').find(x=>x.attrs['aria-label']==='狀態數值模式');mode.value='formula';mode.onchange();
 n.get('status-form').onsubmit({preventDefault(){}});const saved=JSON.parse(store.get('minimajo.statuses.v1'));assert.equal(saved.statuses.at(-1).name,'自訂灼燒');assert.equal(saved.statuses.at(-1).effects.length,2);assert.match(saved.statuses.at(-1).effects[1].formula,/self.maxHp/);
 ({nodes:n}=setup(store));assert.equal(n.get('status-list').children.length,22);n.get('status-list').children.at(-1).onclick();assert.equal(n.get('status-name').value,'自訂灼燒');assert.equal(n.get('status-rules').children.length,2);
 }finally{require('../js/statuses.js').configure(original);}
});

test('status editor preserves description and optional art path through save reload and copy',()=>{
 const original=require('../js/statuses.js').snapshot();try{
 let {nodes:n,store}=setup();n.get('status-new').onclick();assert.equal(n.get('status-description').value,'');assert.equal(n.get('status-image-path').value,'');n.get('status-description').value='效果介紹\n第二行';n.get('status-image-path').value='images/statuses/test.png';n.get('status-form').onsubmit({preventDefault(){}});
 ({nodes:n}=setup(store));n.get('status-list').children.at(-1).onclick();assert.equal(n.get('status-description').value,'效果介紹\n第二行');assert.equal(n.get('status-image-path').value,'images/statuses/test.png');n.get('status-copy').onclick();assert.equal(n.get('status-description').value,'效果介紹\n第二行');n.get('status-image-path').value='';n.get('status-form').onsubmit({preventDefault(){}});assert.equal(JSON.parse(store.get('minimajo.statuses.v1')).statuses.at(-1).imagePath,'');
 }finally{require('../js/statuses.js').configure(original);}
});

test('taunt editor locks strength, preserves free duration policy and saves/reloads',()=>{
 const S=require('../js/statuses.js'),original=S.snapshot();try{
 let {nodes:n,store}=setup();n.get('status-list').children.find(x=>x.textContent==='嘲諷').onclick();const row=n.get('status-rules').children[0],find=label=>row.querySelectorAll('select,input').find(x=>x.attrs['aria-label']===label);
 assert.equal(find('狀態數值模式').disabled,true);assert.equal(find('倍率或固定值').disabled,true);assert.equal(n.get('status-enhanced').disabled,true);assert.match(n.get('status-policy').textContent,/秒數或角色行動次數/);
 n.get('status-form').onsubmit({preventDefault(){}});assert.deepEqual(JSON.parse(store.get('minimajo.statuses.v1')).statuses.find(x=>x.id==='taunt').effects,[{behavior:'taunt',value:1}]);
 ({nodes:n}=setup(store));n.get('status-list').children.find(x=>x.textContent==='嘲諷').onclick();assert.equal(n.get('status-name').value,'嘲諷');
 }finally{S.configure(original);}
});
