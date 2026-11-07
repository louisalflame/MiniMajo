const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),E=require('../js/echo-levels.js');
class Element{constructor(){this.children=[];this.handlers={};this.attrs={};this.value='';}append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,fn){this.handlers[k]=fn;}}
function setup(store=new Map()){
 const nodes=new Map([...fs.readFileSync('editor.html','utf8').matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()])),storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},handlers={};
 vm.runInNewContext(fs.readFileSync('js/echo-editor.js','utf8'),{EchoLevels:E,structuredClone,document:{getElementById:id=>nodes.get(id),createElement:()=>new Element()},localStorage:storage,window:{addEventListener:(k,fn)=>handlers[k]=fn}});
 return {nodes,storage,store,handlers};
}
test('echo editor previews probabilities, edits zero weights, adds/removes levels and reloads saved settings',()=>{
 let {nodes:n,store}=setup();assert.equal(n.get('echo-rows').children.length,6);let row=n.get('echo-rows').children[0];
 row.children[1].children[0].value=0;row.children[2].children[0].value=1;row.children[3].children[0].value=3;row.handlers.input();assert.match(row.children[4].textContent,/SSR 25% ／ UR 75%/);
 n.get('echo-add').handlers.click();assert.equal(n.get('echo-rows').children.length,7);n.get('echo-remove').handlers.click();assert.equal(n.get('echo-rows').children.length,6);
 n.get('echo-form').handlers.submit({preventDefault(){}});assert.deepEqual(JSON.parse(store.get(E.key)).levels[0],{SR:0,SSR:1,UR:3});
 ({nodes:n}=setup(store));assert.equal(n.get('echo-rows').children[0].children[1].children[0].value,0);assert.match(n.get('echo-rows').children[0].children[4].textContent,/UR 75%/);
});
test('echo editor rejects invalid drafts and failed writes without losing existing storage or draft',()=>{
 const {nodes:n,store,storage,handlers}=setup();const submit=()=>n.get('echo-form').handlers.submit({preventDefault(){}});submit();const before=store.get(E.key),input=n.get('echo-rows').children[0].children[1].children[0];
 for(const value of ['',-1,.5,1000001,'bad',0]){input.value=value;submit();assert.equal(store.get(E.key),before);}
 input.value=10;n.get('echo-rows').children[0].handlers.input();storage.setItem=()=>{throw Error('quota');};submit();assert.equal(store.get(E.key),before);assert.equal(input.value,10);assert.match(n.get('echo-message').textContent,/quota/);
 let prevented=false;handlers.beforeunload({preventDefault(){prevented=true;}});assert.equal(prevented,true);
});
