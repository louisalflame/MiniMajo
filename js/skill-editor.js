(() => {
  const $=id=>document.getElementById(id),clone=x=>JSON.parse(JSON.stringify(x));
  const key='minimajo.skills.v1',labels={damage:'傷害 → 敵方',shield:'護盾 → 自己',heal:'治療 → 自己',posture:'體幹傷害 → 敵方',restore:'體幹恢復 → 自己'};
  let data={version:1,skills:clone(SkillDB.defaults)},selected,dirty=false,teams=[[],[]],characters=[];
  function message(text){$('skill-message').textContent=text;}
  try{data=SkillDB.read(localStorage);}catch(e){message('無法讀取極式存檔，已使用預設極式；原存檔尚未覆寫。');}

  function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
  function select(options,value){const n=el('select');options.forEach(([v,t])=>{const o=el('option',t);o.value=v;n.append(o);});n.value=value;return n;}
  function field(title,input){const n=el('label',title);input.setAttribute('aria-label',title);n.append(input);return n;}
  function number(value,min,max,step=1){const n=el('input');Object.assign(n,{type:'number',value,min,max,step,required:true});return n;}
  function button(text,action){const n=el('button',text);n.type='button';n.onclick=action;return n;}
  function discard(){return !dirty||confirm('有尚未儲存的極式修改，要捨棄嗎？');}
  function mark(){dirty=true;message('尚未儲存；下方條件預覽使用草稿，試打仍使用已儲存版本。');preview();}
  function selector(initial){
    const wrap=el('div');wrap.className='fields';const type=select([['race','種族'],['affinity','戰鬥類型'],['id','指定角色'],['stars','星等'],['rarity','階級'],['job','職業']],initial.field);let value;
    function refresh(v){
      if(value)value.parentElement.remove();
      if(CharacterEnums[type.value])value=select(CharacterEnums[type.value].map(x=>[x,type.value==='stars'?x+' 星':x]),v||CharacterEnums[type.value][0]);
      else {const options=characters.map(c=>[c.id,c.name]);if(v&&!characters.some(c=>c.id===v))options.unshift([v,'缺少角色：'+v]);if(!options.length)options.push(['','請先建立角色']);value=select(options,v||options[0][0]);}
      wrap.append(field('符合值',value));
    }
    wrap.append(field('篩選欄位',type));refresh(initial.value);type.onchange=()=>{refresh();mark();};return {node:wrap,read:()=>({field:type.value,value:value.value})};
  }
  function conditionRow(initial){
    const row=el('div');row.className='condition-row';const kind=select([['count','隊伍數量'],['slot','指定站位'],['before','排序：A 排在 B 之前'],['majority','隊伍多數（平手取最前）']],initial.kind);
    const body=el('div');let read;
    function build(c){body.replaceChildren();
      if(c.kind==='count'){
        const filters=countFilters(c.filters??[{field:c.field??'race',op:'eq',value:c.field==='stars'?Number(c.value):c.value??'人類'}],c.filterMode??'all'),op=select(Object.entries(SkillDB.comparisons),c.op??'gte'),n=number(c.count??1,0,10);
        body.append(filters.node,field('數量比較',op),field('人數',n));read=()=>({kind:'count',filters:filters.read(),filterMode:filters.mode(),op:op.value,count:Number(n.value)});return;
      }
      const a=selector(c);body.append(a.node);
      if(c.kind==='slot'){const n=select(Array.from({length:10},(_,i)=>[String(i+1),'第 '+(i+1)+' 格']),String(c.slot||1));body.append(field('站位',n));read=()=>({kind:'slot',...a.read(),slot:Number(n.value)});}
      if(c.kind==='before'){const b=selector(c.other||{field:'affinity',value:'魔法'});body.append(el('p','A（上方）必須排在 B（下方）之前'),b.node);read=()=>({kind:'before',...a.read(),other:b.read()});}
      if(c.kind==='majority'){body.append(el('small','多數條件適用種族／戰鬥類型／星等／階級／職業；平票採最前方角色。'));read=()=>({kind:'majority',...a.read()});}
    }
    row.append(field('條件類型',kind),body,button('移除此條件',()=>{row.remove();mark();}));build(initial);kind.onchange=()=>{build({kind:kind.value,field:'race',value:'人類'});mark();};row.read=()=>read();$('skill-conditions').append(row);
  }
  function countFilters(initial,initialMode){
    const box=el('fieldset'),mode=select([['all','全部符合（AND）'],['any','任一符合（OR）']],initialMode),rows=el('div');box.className='effect-section skill-count-filters';
    box.append(el('legend','1．角色篩選'),field('角色篩選組合',mode),rows);mode.onchange=mark;
    function add(initial){
      const row=el('div'),controls=el('div'),type=select(Object.entries(SkillDB.filterFields),initial.field??'race');row.className='effect-condition';let read;
      function build(f){
        controls.replaceChildren();const numeric=type.value==='stars',ops=numeric?SkillDB.comparisons:{eq:'等於',ne:'不等於',in:'符合任一所選值（OR）',notIn:'排除所選值'},op=select(Object.entries(ops),f.op??'eq'),values=el('div');let valueRead;
        function valueEditor(value){
          values.replaceChildren();const choices=CharacterEnums[type.value]??characters.map(c=>c.id),options=choices.map(v=>[v,type.value==='id'?(characters.find(c=>c.id===v)?.name??v):v]);
          for(const v of (Array.isArray(value)?value:[value]))if(v!==undefined&&!choices.includes(v)&&type.value==='id')options.unshift([v,'缺少角色：'+v]);
          if(['in','notIn'].includes(op.value)){
            values.className='skill-filter-values';const selected=Array.isArray(value)?value:[value],checks=options.map(([v,text])=>{const input=el('input');input.type='checkbox';input.value=v;input.checked=selected.includes(v);input.onchange=mark;values.append(field(text,input));return input;});valueRead=()=>checks.filter(c=>c.checked).map(c=>c.value);
          }else{
            values.className='';const input=numeric?number(Array.isArray(value)?value[0]??1:value??1,1,6):select(options,Array.isArray(value)?value[0]??options[0]?.[0]:value??options[0]?.[0]);input.onchange=mark;values.append(field('篩選值',input));valueRead=()=>numeric?Number(input.value):input.value;
          }
        }
        controls.append(field('比較方式',op),values);valueEditor(f.value);op.onchange=()=>{const previous=valueRead();valueEditor(previous);mark();};read=()=>({field:type.value,op:op.value,value:valueRead()});
      }
      row.append(field('角色篩選欄位',type),controls,button('移除角色篩選',()=>{row.remove();mark();}));build(initial);type.onchange=()=>{build({});mark();};row.read=()=>read();rows.append(row);
    }
    initial.forEach(add);box.append(button('＋ 加入角色篩選',()=>{if(rows.children.length>=12){message('每組最多 12 條角色篩選。');return;}add({field:'race',op:'eq',value:'人類'});mark();}),el('small','先篩選同時符合條件的角色，再比較人數；同一角色只計一次，多格角色不重複計數。空篩選計算全部角色。'));
    return {node:box,read:()=>[...rows.children].map(row=>row.read()),mode:()=>mode.value};
  }
  function effectRow(effect){$('skill-effects').append(EffectEditor.row(effect,row=>{if($('skill-effects').children.length===1){message('至少保留一個效果。');return;}row.remove();EffectEditor.refreshRoles($('skill-effects'),mark);mark();},mark,{allowAttack:false}));EffectEditor.refreshRoles($('skill-effects'),mark);}
  function draft(){return {id:selected,imagePath:$('skill-image-path').value,description:$('skill-edit-description').value,name:$('skill-edit-name').value,cooldown:Number($('skill-cd').value),mode:$('skill-mode').value,conditions:[...$('skill-conditions').children].map(r=>r.read()),effects:[...$('skill-effects').children].map(r=>r.read())};}
  function list(){const picker=$('skill-select');picker.replaceChildren();data.skills.forEach(s=>{const o=el('option',s.name);o.value=s.id;picker.append(o);});picker.value=selected||'';}
  function edit(id){selected=id;list();const s=data.skills.find(x=>x.id===id);$('skill-form').hidden=!s;dirty=false;if(!s){preview();return;}$('skill-edit-name').value=s.name;$('skill-image-path').value=s.imagePath??'';$('skill-edit-description').value=s.description??s.effects.map(EffectEditor.describe).join('\n');$('skill-cd').value=s.cooldown;$('skill-mode').value=s.mode;$('skill-conditions').replaceChildren();s.conditions.forEach(conditionRow);$('skill-effects').replaceChildren();s.effects.forEach(effectRow);preview();}
  function preview(){
    const out=$('skill-matches');out.replaceChildren();
    teams.slice(0,1).forEach((team,i)=>{const evaluated=SkillDB.evaluate(team,data.skills);const heading=el('strong',`${i?'敵方':'我方'}符合極式`);out.append(heading);
      const matches=evaluated.filter(x=>x.matched);out.append(el('p',matches.length?`符合：${matches.map(x=>x.skill.name).join('、')}`:'目前隊伍沒有符合條件的極式。'));
      if(selected){try{const d=SkillDB.validate({version:1,skills:[draft()]}).skills[0],check=SkillDB.evaluate(team,[d])[0];out.append(el('p',`編輯中極式：${check.matched?'符合':'不符合'}${check.checks.length?' · '+check.checks.map((yes,n)=>`條件 ${n+1} ${yes?'✓':'✗'}`).join('／'):' · 無條件'}`));}catch(e){out.append(el('p',`草稿待修正：${e.message}`));}}
    });
  }
  function persist(){let saved=true;try{localStorage.setItem(key,JSON.stringify(data));}catch(e){saved=false;}message(saved?'極式已儲存，試煉場已重置並套用。':'瀏覽器無法儲存，請匯出極式備份；本分頁已套用。');window.dispatchEvent(new Event('skills-changed'));}
  $('skill-select').onchange=()=>{const next=$('skill-select').value;if(discard())edit(next);else $('skill-select').value=selected;};
  $('skill-form').addEventListener('input',mark);$('skill-form').addEventListener('change',mark);
  $('skill-form').onsubmit=e=>{e.preventDefault();try{const changed=draft();data=SkillDB.validate({version:1,skills:data.skills.map(x=>x.id===selected?changed:x)});edit(selected);persist();}catch(error){message(error.message);}};
  function add(copy){if(!discard())return;if(data.skills.length>=500){message('最多 500 個極式。');return;}const s=copy?clone(data.skills.find(x=>x.id===selected)):{name:'新極式',cooldown:8,mode:'all',conditions:[{kind:'count',field:'race',value:'人類',op:'gte',count:2}],effects:[{type:'damage',amount:30}]};s.description??=s.effects.map(EffectEditor.describe).join('\n');s.id=`skill-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;if(copy)s.name=s.name.slice(0,55)+' 副本';data.skills.push(s);edit(s.id);persist();}
  $('skill-new').onclick=()=>add(false);$('skill-copy').onclick=()=>add(true);
  $('skill-delete').onclick=()=>{if(!confirm('刪除此極式？未儲存修改也會捨棄，隊伍將重新判定極式。'))return;data.skills=data.skills.filter(x=>x.id!==selected);edit(data.skills[0]?.id);persist();};
  $('skill-add-condition').onclick=()=>{if($('skill-conditions').children.length>=12){message('最多 12 條條件。');return;}conditionRow({kind:'count',field:'race',value:'人類',op:'gte',count:1});mark();};
  $('skill-add-effect').onclick=()=>{if($('skill-effects').children.length>=8){message('最多 8 個效果。');return;}effectRow({type:'damage',amount:10});mark();};
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  window.SkillEditor={getSkills:()=>data.skills,setTeams:(next,roster)=>{teams=next;characters=roster;if(!dirty)edit(selected);else preview();}};
  edit(data.skills[0]?.id);
})();
