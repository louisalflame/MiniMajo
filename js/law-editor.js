(()=>{
 'use strict';
 const $=id=>document.getElementById(id),key='minimajo.laws.v1',clone=x=>structuredClone(x);
 let laws=[],selected=null,draft=null,dirty=false;
 const say=t=>$('law-message').textContent=t;
 try{laws=Laws.read(localStorage).laws;}catch(e){say('讀取失敗，原始儲存資料未覆寫：'+e.message);}
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const button=(text,fn)=>{const n=el('button',text);n.type='button';n.onclick=fn;return n;};
 function select(options,value,label){const n=el('select');n.setAttribute('aria-label',label);Object.entries(options).forEach(([v,t])=>{const o=el('option',t);o.value=v;n.append(o);});n.value=String(value);return n;}
 function field(title,control){const n=el('label',title);n.append(control);return n;}
 function changed(){dirty=true;say('尚未儲存。');}
 function leave(){return !dirty||confirm('捨棄目前法則尚未儲存的修改？');}
 function list(){
  const q=$('law-search').value.trim();$('law-list').replaceChildren();
  laws.filter(l=>l.name.includes(q)).forEach(l=>{const b=button(l.name,()=>{if(leave())edit(l);});b.className='item-choice';b.setAttribute('aria-pressed',String(selected===l.id));b.append(el('small',l.passives.length+' 個被動'));$('law-list').append(b);});
  if(!$('law-list').children.length)$('law-list').append(el('p',laws.length?'沒有符合的法則。':'尚無法則，按「＋ 新增」建立。'));
 }
 function passive(p){return EffectEditor.passiveRow(p,changed,say);}
 function edit(l){
  selected=l?.id??null;draft=l?clone(l):null;dirty=false;$('law-form').hidden=!l;$('law-empty').hidden=!!l;$('law-copy').disabled=!l;
  if(l){$('law-name').value=l.name;$('law-description').value=l.description??'';$('law-image-path').value=l.imagePath??'';$('law-shop-price').value=l.shopPrice??50;$('law-shop-weight').value=l.shopWeight??100;$('law-stats').replaceChildren();ItemDB.growthFields.forEach((f,i)=>{const input=el('input');input.type='number';input.min=-10000;input.max=10000;input.step=['cooldown','weakDuration','statusDurationBonus'].includes(f)?'.1':'1';input.required=true;input.value=l.stats[f]??0;input.dataset.field=f;$('law-stats').append(field(ItemDB.growthLabels[i],input));});$('law-passives').replaceChildren(...l.passives.map(passive));}list();
 }
 function read(){return {...draft,name:$('law-name').value,description:$('law-description').value,imagePath:$('law-image-path').value,shopPrice:$('law-shop-price').value===''?NaN:Number($('law-shop-price').value),shopWeight:$('law-shop-weight').value===''?NaN:Number($('law-shop-weight').value),stats:Object.fromEntries([...$('law-stats').children].map(n=>[n.children[0].dataset.field,Number(n.children[0].value)])),passives:[...$('law-passives').children].map(n=>n.read())};}
 function save(next){const clean=Laws.validate(next);localStorage.setItem(key,JSON.stringify({version:1,laws:clean}));laws=clean;window.dispatchEvent(new Event('laws-changed'));}
 function create(copy=false){if(!leave())return;if(laws.length>=100){say('最多 100 個法則。');return;}let l;try{l=copy?Laws.validate([read()])[0]:{name:'新法則',description:'',imagePath:'',shopPrice:50,shopWeight:100,stats:{},passives:[]};}catch(e){say(e.message);return;}l.id='law-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);if(copy)l.name=l.name.slice(0,35)+' 副本';edit(l);dirty=true;say('新法則尚未儲存，填寫後按「儲存法則」。');}
 $('law-new').onclick=()=>create();$('law-copy').onclick=()=>create(true);$('law-search').oninput=list;
 $('law-add-passive').onclick=()=>{if($('law-passives').children.length>=20){say('最多 20 個被動。');return;}$('law-passives').append(passive({when:'action',subject:{relation:'self',conditions:[]},effects:[{type:'damage',amount:10}]}));changed();};
 $('law-form').addEventListener('input',changed);$('law-form').addEventListener('change',changed);
 $('law-form').onsubmit=e=>{e.preventDefault();try{const l=read(),next=laws.some(x=>x.id===selected)?laws.map(x=>x.id===selected?l:x):[...laws,l];save(next);edit(laws.find(x=>x.id===selected));say('已儲存法則。已配置的敵隊保留原快照；移除後重新加入可更新。');}catch(error){say('儲存失敗：'+error.message);}};
 $('law-delete').onclick=()=>{if(!draft||!confirm('刪除「'+draft.name+'」？已配置的敵隊快照不受影響。'))return;try{save(laws.filter(l=>l.id!==selected));edit(laws[0]??null);say('已刪除法則。');}catch(e){say('刪除失敗：'+e.message);}};
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
 window.LawLibrary={get:()=>clone(laws)};edit(laws[0]??null);
})();
