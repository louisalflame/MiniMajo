(()=>{
 'use strict';
 const $=id=>document.getElementById(id),node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 let data=EchoLevels.read(localStorage),dirty=false;
 const say=text=>$('echo-message').textContent=text;
 function changed(){dirty=true;say('尚未儲存。');}
 function read(){return {version:1,levels:[...$('echo-rows').children].map(row=>Object.fromEntries(EchoLevels.rarities.map((r,i)=>{const value=row.children[i+1].children[0].value;return [r,value===''?NaN:Number(value)];})))};}
 function refreshChances(){const levels=read().levels;[...$('echo-rows').children].forEach((row,i)=>{try{row.children[4].textContent=EchoLevels.describe(EchoLevels.validate({levels:[levels[i]]}),1);}catch{row.children[4].textContent='請填合法權重，且至少一項大於 0。';}});}
 function render(){
  $('echo-rows').replaceChildren(...data.levels.map((weights,i)=>{
   const row=node('tr');row.append(node('th','等級 '+(i+1)));
   for(const rarity of EchoLevels.rarities){const cell=node('td'),input=node('input');input.type='number';input.min=0;input.max=1000000;input.step=1;input.required=true;input.value=weights[rarity];input.setAttribute('aria-label','回響等級 '+(i+1)+' '+rarity+' 權重');cell.append(input);row.append(cell);}
   const chance=node('td');row.addEventListener('input',()=>{changed();refreshChances();});row.append(chance);return row;
  }));
  for(const [i,row] of [...$('echo-rows').children].entries())row.children[4].textContent=EchoLevels.describe(data,i+1);
  $('echo-remove').disabled=data.levels.length<=1;$('echo-add').disabled=data.levels.length>=100;
 }
 $('echo-add').addEventListener('click',()=>{if(data.levels.length>=100)return;try{data=EchoLevels.validate(read());data.levels.push(structuredClone(data.levels.at(-1)));changed();render();}catch(error){say(error.message);}});
 $('echo-remove').addEventListener('click',()=>{if(data.levels.length<=1)return;try{const next=read();next.levels.pop();data=EchoLevels.validate(next);changed();render();}catch(error){say(error.message);}});
 $('echo-form').addEventListener('submit',event=>{event.preventDefault();try{const next=EchoLevels.validate(read());localStorage.setItem(EchoLevels.key,JSON.stringify(next));data=next;dirty=false;render();say('已儲存回響等級；新旅程或重置工坊探索時套用。');}catch(error){say('儲存失敗：'+error.message);}});
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});render();
})();
