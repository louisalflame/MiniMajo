(() => {
  function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
  function pick(options,value,label){const s=el('select');s.setAttribute('aria-label',label);Object.entries(options).forEach(([v,t])=>{const o=el('option',t);o.value=v;s.append(o);});s.value=value;return s;}
  function create(source,change){
    let tree=Formula.parse(source);const root=el('div');root.className='formula-builder';const canvas=el('div'),summary=el('p'),error=el('p');summary.className='formula-summary';error.setAttribute('role','status');
    const advanced=el('details'),raw=el('textarea');raw.rows=2;raw.readOnly=true;raw.setAttribute('aria-label','進階公式文字');advanced.append(el('summary','查看對應公式文字'),raw);
    const legend=el('small','每個「運算群組」都是一組括號：先算內層，再算外層。可將數值切換成另一個運算群組。');
    function readable(n){if(n.kind==='random')return `隨機整數 ${n.min}～${n.max}`;if(n.kind==='ref')return Effects.refs[n.value];if(n.kind==='number')return n.value;if(n.kind==='unary')return n.op+'('+readable(n.value)+')';return '('+readable(n.left)+' '+({'+':'+','-':'−','*':'×','/':'÷'}[n.op])+' '+readable(n.right)+')';}
    function update(){const formula=Formula.serialize(tree);raw.value=formula;summary.textContent='效果數值 = '+readable(tree);try{Effects.calculate(formula);error.textContent='';}catch(e){error.textContent=e.message;}change();}
    function view(n,set,path){
      const box=el('div');box.className='formula-node';
      const mode=pick({number:'固定數值',random:'範圍隨機',ref:'戰鬥數值',binary:'運算群組',...(n.kind==='unary'?{unary:'正負號'}:{})},n.kind,path+'來源');box.append(mode);
      mode.onchange=()=>{const replacement=mode.value==='number'?{kind:'number',value:'10'}:mode.value==='random'?{kind:'random',min:'5',max:'15'}:mode.value==='ref'?{kind:'ref',value:'enemy.hp'}:{kind:'binary',op:'*',left:n,right:{kind:'number',value:'1'}};set(replacement);render();update();};
      if(n.kind==='number'){const input=el('input');input.type='number';input.min=0;input.step='any';input.required=true;input.value=n.value;input.setAttribute('aria-label',path+'固定數值');input.oninput=()=>{n.value=input.value;update();};box.append(input);}
      if(n.kind==='random'){for(const [key,label] of [['min','最小值（含）'],['max','最大值（含）']]){const wrap=el('label',label),input=el('input');input.type='number';input.min=0;input.max=10000;input.step=1;input.required=true;input.value=n[key];input.setAttribute('aria-label',path+label);input.oninput=()=>{n[key]=input.value;update();};wrap.append(input);box.append(wrap);}box.append(el('small','每次效果觸發時獨立抽取，包含上下限。'));}
      if(n.kind==='ref'){const source=pick(Effects.refs,n.value,path+'戰鬥數值');source.onchange=()=>{n.value=source.value;update();};box.append(source);}
      if(n.kind==='unary'){const sign=pick({'+':'正號','-':'負號'},n.op,path+'正負號');sign.onchange=()=>{n.op=sign.value;update();};box.append(sign,view(n.value,x=>n.value=x,path+'數值'));}
      if(n.kind==='binary'){
        const group=el('div');group.className='formula-group';const left=el('div'),right=el('div');left.append(el('span','左側數值'),view(n.left,x=>n.left=x,path+'左側'));right.append(el('span','右側數值'),view(n.right,x=>n.right=x,path+'右側'));
        const op=pick({'+':'＋ 加上','-':'− 減去','*':'× 乘以','/':'÷ 除以'},n.op,path+'運算');op.onchange=()=>{n.op=op.value;update();};group.append(left,op,right);box.append(group);
        const actions=el('div');actions.className='formula-actions';for(const [key,label] of [['left','只保留左側'],['right','只保留右側']]){const b=el('button',label);b.type='button';b.onclick=()=>{set(n[key]);render();update();};actions.append(b);}box.append(actions);
      }
      return box;
    }
    function render(){canvas.replaceChildren(view(tree,x=>tree=x,'公式'));}
    root.append(legend,canvas,summary,error,advanced);render();raw.value=Formula.serialize(tree);summary.textContent='效果數值 = '+readable(tree);
    return {node:root,read:()=>Formula.serialize(tree)};
  }
  window.FormulaEditor={create};
})();
