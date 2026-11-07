const {test}=require('node:test'),assert=require('node:assert/strict'),{bind}=require('../js/dialog-dismiss.js');
test('outside dismissal requires both press and click beyond dialog bounds',()=>{
 const handlers={},dialog={addEventListener:(t,f)=>handlers[t]=f,getBoundingClientRect:()=>({left:100,top:100,right:400,bottom:400})};let count=0;bind(dialog,()=>count++);
 const event=(x,y,target=dialog)=>({button:0,clientX:x,clientY:y,target});
 handlers.pointerdown(event(110,110));handlers.click(event(10,10));assert.equal(count,0);
 handlers.pointerdown(event(10,10));handlers.click(event(110,110));assert.equal(count,0);
 handlers.pointerdown(event(10,10));handlers.pointercancel();handlers.click(event(10,10));assert.equal(count,0);
 handlers.pointerdown(event(10,10));handlers.click(event(10,10));assert.equal(count,1);
 handlers.pointerdown(event(10,10,{}));handlers.click(event(10,10));assert.equal(count,1);
});
