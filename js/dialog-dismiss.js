(function(root){
 'use strict';
 // Both press and release must be outside: a drag leaving a dialog is not dismissal.
 function bind(dialog,close){
  let pressedOutside=false;
  const outside=e=>{if(e.target!==dialog)return false;const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
  dialog.addEventListener('pointerdown',e=>{pressedOutside=e.button===0&&outside(e);});
  dialog.addEventListener('pointercancel',()=>{pressedOutside=false;});
  dialog.addEventListener('click',e=>{const dismiss=pressedOutside&&outside(e);pressedOutside=false;if(dismiss)close();});
 }
 const api={bind};if(typeof module!=='undefined')module.exports=api;else root.DialogDismiss=api;
})(globalThis);
