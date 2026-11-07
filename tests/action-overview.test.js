const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
class Element{
 constructor(tag,text=''){this.tag=tag;this.textContent=text;this.children=[];this.value='';this.handlers={};}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(){}
 addEventListener(name,fn){this.handlers[name]=fn;}
}
const text=node=>node.textContent+node.children.map(text).join('\n');
test('overview renders saved passive timing, scope, conditions and ordered effects and refreshes without writes',()=>{
 const ids=['overview-race','overview-affinity','overview-job','overview-rarity','overview-search','overview-count','overview-list','overview-reset'];
 const nodes=Object.fromEntries(ids.map(id=>[id,new Element('div')])),events={};
 const Effects=require('../js/effects.js'),Laws=require('../js/laws.js');
 const item={...require('../js/database.js').defaults[0],effects:[],passives:[{when:'dodged',subject:{relation:'ally',conditions:[{field:'race',value:'人類'},{field:'stars',value:2}]},effects:[{type:'shield',amount:7,target:'self'},{type:'heal',amount:3,target:'self'}]}]};
 vm.runInNewContext(fs.readFileSync('js/action-overview.js','utf8'),{document:{getElementById:id=>nodes[id],createElement:tag=>new Element(tag)},window:{addEventListener:(name,fn)=>events[name]=fn},CharacterLibrary:{getItems:()=>[structuredClone(item)]},CharacterEnums:require('../js/enums.js'),Effects,Laws,EffectEditor:{describe:Effects.describe}});
 let rendered=text(nodes['overview-list']);assert.match(rendered,/被動 1 · 角色閃避成功時/);assert.match(rendered,/同陣營角色（含自己）/);assert.match(rendered,/種族＝人類、星數＝2/);assert.ok(rendered.includes('主效果：'+Effects.describe(item.passives[0].effects[0])));assert.ok(rendered.includes('副效果 1：'+Effects.describe(item.passives[0].effects[1])));
 item.passives=[{when:'playerSkill',effects:[]}];events['characters-changed']();rendered=text(nodes['overview-list']);assert.match(rendered,/不檢查事件角色範圍與屬性/);assert.match(rendered,/無發動效果/);
 delete item.passives;events['workspace-tab-change']({detail:'action-overview'});assert.match(text(nodes['overview-list']),/無被動效果/);
 nodes['overview-search'].value='不存在的角色';nodes['overview-search'].handlers.input();assert.match(text(nodes['overview-list']),/沒有符合/);
 nodes['overview-reset'].handlers.click();assert.match(text(nodes['overview-count']),/1／1/);
});
