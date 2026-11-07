(() => {
 'use strict';
 const $=id=>document.getElementById(id),fields=['race','affinity','job','rarity'];
 const make=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
 for(const field of fields){
  const select=$('overview-'+field);select.value='';
  for(const value of CharacterEnums[field]){const option=make('option',value);option.value=value;select.append(option);}
  select.addEventListener('change',render);
 }
 function render(){
  const items=CharacterLibrary.getItems(),query=$('overview-search').value.trim().toLocaleLowerCase();
  const matches=items.filter(item=>(!query||item.name.toLocaleLowerCase().includes(query))&&fields.every(field=>!$('overview-'+field).value||item[field]===$('overview-'+field).value));
  $('overview-count').textContent=`顯示 ${matches.length}／${items.length} 位角色`;
  $('overview-list').replaceChildren(...matches.map(item=>{
   const card=make('article',undefined,'action-overview-card'),info=make('div',undefined,'action-overview-info');
   info.append(make('h3',item.name),make('p',`${item.race} · ${item.affinity} · ${item.job} · ${item.rarity} · 起始 ${item.stars} 星`));
   const effects=make('ol',undefined,'action-overview-effects');effects.setAttribute('aria-label',item.name+'的行動效果');
   item.effects.forEach((effect,i)=>{const row=make('li');row.append(make('strong',i===0?'主效果':'副效果 '+i),make('p',EffectEditor.describe(effect)));effects.append(row);});
   const content=make('div');content.append(item.effects.length?effects:make('p','無行動效果','empty'));
   const passives=make('ol',undefined,'action-overview-effects');passives.setAttribute('aria-label',item.name+'的被動效果');
   (item.passives??[]).forEach((passive,i)=>{
    const row=make('li'),timing=Laws.labels[Laws.timings.indexOf(passive.when)]??passive.when;
    row.append(make('strong',`被動 ${i+1} · ${timing}`));
    const subject=passive.subject??{relation:'self',conditions:[]};
    row.append(make('p',passive.when==='playerSkill'?'雙方持有者皆可觸發，不檢查事件角色範圍與屬性。':'事件角色：'+({self:'持有者自己',ally:'同陣營角色（含自己）',enemy:'敵方角色',any:'任意角色'}[subject.relation]??'持有者自己')+((subject.conditions??[]).length?'；條件（全部符合）：'+subject.conditions.map(c=>Effects.conditionFields[c.field]+'＝'+c.value).join('、'):'；無角色屬性限制。')));
    if(passive.when==='statusGained'){
     const condition=passive.statusCondition??{mode:'any'};
     const value=condition.mode==='specified'?Statuses.names[condition.status]??condition.status:Laws.statusModes[condition.mode];
     row.append(make('p','狀態條件：'+value));
    }
    (passive.effects??[]).forEach((effect,j)=>row.append(make('p',(j===0?'主效果：':'副效果 '+j+'：')+EffectEditor.describe(effect))));
    if(!passive.effects?.length)row.append(make('p','無發動效果','empty'));
    passives.append(row);
   });
   content.append(make('h4','被動效果'),passives.children.length?passives:make('p','無被動效果','empty'));
   card.append(info,content);return card;
  }));
  if(!matches.length)$('overview-list').append(make('p','沒有符合篩選條件的角色。','empty'));
 }
 $('overview-search').addEventListener('input',render);
 $('overview-reset').addEventListener('click',()=>{$('overview-search').value='';fields.forEach(field=>$('overview-'+field).value='');render();});
 window.addEventListener('characters-changed',render);
 window.addEventListener('statuses-changed',render);
 window.addEventListener('workspace-tab-change',event=>{if(event.detail==='action-overview')render();});
 render();
})();
