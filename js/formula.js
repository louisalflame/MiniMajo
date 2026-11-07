(function(root){
  const effects=typeof module!=='undefined'?require('./effects.js'):root.Effects;
  function parse(source){
    effects.calculate(source);const tokens=source.match(/\d+(?:\.\d+)?|[a-zA-Z][a-zA-Z.]*|[(),+*/-]/g);let at=0;
    function atom(){const t=tokens[at++];if(t==='rand'){at++;const min=tokens[at++];at++;const max=tokens[at++];at++;return {kind:'random',min,max};}if(t==='+'||t==='-')return {kind:'unary',op:t,value:atom()};if(t==='('){const x=sum();at++;return x;}return Object.hasOwn(effects.refs,t)?{kind:'ref',value:t}:{kind:'number',value:t};}
    function product(){let left=atom();while(['*','/'].includes(tokens[at]))left={kind:'binary',op:tokens[at++],left,right:atom()};return left;}
    function sum(){let left=product();while(['+','-'].includes(tokens[at]))left={kind:'binary',op:tokens[at++],left,right:product()};return left;}
    return sum();
  }
  function serialize(n){
    if(n.kind==='random')return `rand(${n.min===''?'?':n.min},${n.max===''?'?':n.max})`;
    if(n.kind==='number')return n.value===''?'?':String(n.value);
    if(n.kind==='ref')return n.value;
    if(n.kind==='unary')return n.op+(n.value.kind==='binary'?'('+serialize(n.value)+')':serialize(n.value));
    const priority=x=>x.kind==='binary'?(['+','-'].includes(x.op)?1:2):3,p=priority(n);
    const left=serialize(n.left),right=serialize(n.right);
    return (priority(n.left)<p?'('+left+')':left)+n.op+(priority(n.right)<=p?'('+right+')':right);
  }
  const api={parse,serialize};if(typeof module!=='undefined')module.exports=api;else root.Formula=api;
})(globalThis);
