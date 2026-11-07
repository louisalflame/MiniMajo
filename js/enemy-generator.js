(function(root){
 'use strict';
 const X=typeof module!=='undefined'?require('./expedition.js'):root.Expedition;
 const Echo=typeof module!=='undefined'?require('./echo-levels.js'):root.EchoLevels;
 const defaults={count:20,lawCount:10,SR:60,SSR:35,UR:5};
 function validate(input){
  const result={};
  for(const field of ['count','lawCount']){
   const value=input?.[field],min=field==='count'?1:0;
   if(!Number.isInteger(value)||value<min||value>1000)throw Error((field==='count'?'角色':'法則')+'抽選次數需為 '+min+'～1000 整數。');
   result[field]=value;
  }
  const row=Echo.validate({levels:[input]}).levels[0];
  return {...result,...row};
 }
 function generate(items,laws,input,random=Math.random){
  const settings=validate(input),board=Array(10).fill(null),attached=Array.from({length:10},()=>[]);
  const lawPool=laws.filter(l=>l.shopWeight>0);
  if(settings.lawCount&&!lawPool.length)throw Error('沒有正權重的可抽法則；可將法則抽選次數設為 0。');
  let completed=0;
  for(;completed<settings.count;completed++){
   const candidates=items.filter(u=>{
    const existing=board.find(x=>x?.id===u.id);
    return existing?existing.stars<6:X.firstFit(board,u)>=0;
   });
   const unit=Echo.pick(candidates,{levels:[settings]},1,random);
   if(!unit)break;
   const existing=board.find(x=>x?.id===unit.id);
   if(existing)existing.stars++;
   else board[X.firstFit(board,unit)]={...unit,stars:unit.stars};
  }
  const occupied=board.flatMap((u,i)=>u?[i]:[]);
  if(!occupied.length)throw Error('沒有可加入的角色；請確認階級權重、角色出現權重與十格佔位。');
  const total=lawPool.reduce((sum,l)=>sum+l.shopWeight,0);
  for(let i=0;i<settings.lawCount;i++){
   let roll=random()*total,law=lawPool.at(-1);
   for(const entry of lawPool){roll-=entry.shopWeight;if(roll<0){law=entry;break;}}
   const slot=occupied[Math.floor(random()*occupied.length)];
   attached[slot].push(structuredClone(law));
  }
  return {slots:board.map(u=>u?.id??null),stars:board.map(u=>u?.stars??null),laws:attached,completed,lawCount:settings.lawCount};
 }
 const api={defaults,validate,generate};
 if(typeof module!=='undefined')module.exports=api;else root.EnemyGenerator=api;
})(globalThis);
