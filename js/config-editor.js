(()=>{
 const $=id=>document.getElementById(id),fields=Object.fromEntries(GameConfig.fields.map(([k,id])=>[k,id])),boards={startingActive:'config-starting-active'};
 let draft=GameConfig.validate(GameConfig.defaults),dirty=false;
 const message=text=>$('config-message').textContent=text;
 const items=()=>CharacterLibrary.getItems();
 const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 function mark(){dirty=true;message('尚未儲存。');example();}
 function example(){
  const c={...draft,...Object.fromEntries(Object.entries(fields).map(([k,id])=>[k,($(id).value===''?NaN:Number($(id).value))]))};
  try{GameConfig.validate(c);const start=Math.round(c.battleSeconds*10),pulse=Math.round(c.overtimePulse*10);$('config-overtime-example').textContent='前四次扣血：'+[1,2,3,4].map(n=>{const tick=start+n*pulse;return tick/10+' 秒扣 '+GameConfig.damage(c,tick);}).join(' ／ ');}catch{$('config-overtime-example').textContent='請填入有效數值以預覽超時扣血。';}
 }
 function renderBoards(){
  const library=items();
  for(const [key,id] of Object.entries(boards)){
   const slots=draft[key];$(id).replaceChildren(...slots.map((value,i)=>{
    const cell=node('label','第 '+(i+1)+' 格'),select=node('select'),empty=node('option','空位');empty.value='';select.append(empty);select.setAttribute('aria-label',(key==='startingActive'?'初始出戰':'初始儲存')+'第 '+(i+1)+' 格');
    const owner=slots.findIndex((other,j)=>j<i&&other&&j+(library.find(u=>u.id===other)?.space??1)>i);
    for(const u of library){const option=node('option',u.name+'（'+u.space+' 格／'+u.stars+' 星）');option.value=u.id;option.disabled=i+u.space>10||slots.some((other,j)=>other&&j!==i&&i<j+(library.find(x=>x.id===other)?.space??1)&&i+u.space>j);select.append(option);}
    if(value&&!library.some(u=>u.id===value)){const missing=node('option','缺少角色：'+value);missing.value=value;select.append(missing);}
    select.value=value??'';select.disabled=owner>=0&&!value;select.onchange=()=>{slots[i]=select.value||null;mark();renderBoards();};
    const u=library.find(u=>u.id===value),info=node('small',owner>=0?'由第 '+(owner+1)+' 格角色佔用':u?u.name+' · '+u.space+' 格':'');cell.append(select,info);return cell;
   }));
  }
 }
 try{draft=GameConfig.read(localStorage);}catch(e){message('讀取失敗：'+e.message);}
 for(const [k,id] of Object.entries(fields))$(id).value=draft[k];renderBoards();example();
 $('config-form').addEventListener('input',mark);
 window.addEventListener('characters-changed',()=>{renderBoards();message('角色資料已更新，請檢查初始隊伍配置。');});
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
 $('config-form').addEventListener('submit',e=>{e.preventDefault();try{
  const data=GameConfig.validate({...draft,...Object.fromEntries(Object.entries(fields).map(([k,id])=>[k,($(id).value===''?NaN:Number($(id).value))]))},items());
  localStorage.setItem(GameConfig.key,JSON.stringify(data));draft=data;dirty=false;renderBoards();
  window.ExpeditionUI?.reset();window.dispatchEvent(new Event('config-changed'));message('已儲存。試打與整備預覽已重置，正式旅程於下一局套用。');
 }catch(error){message(error.message);}});
})();
