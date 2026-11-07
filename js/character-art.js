(function(root){
 'use strict';
 // A filename, never a URL or a path. Empty means artwork has not been assigned.
 function validFile(value){
  return typeof value==='string'&&value.length<=120&&(value.trim()===''||
   (!/[\\/:*?"<>|\u0000-\u001f]/.test(value)&&!value.trim().startsWith('.')&&/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(value.trim())));
 }
 function source(value){return validFile(value)&&value.trim()?'assets/characters/'+encodeURIComponent(value.trim()):'';}
 function mount(document,container,unit,placeholders=[],{detail=false}={}){
  const sources=[...new Set((detail?[unit.detailImageFile,unit.imageFile]:[unit.imageFile]).map(source).filter(Boolean))];
  if(!sources.length)return null;let index=0;
  const image=document.createElement('img');image.className='character-image';image.alt=unit.name;image.hidden=true;
  image.addEventListener('load',()=>{image.hidden=false;placeholders.forEach(node=>node.hidden=true);});
  image.addEventListener('error',()=>{image.hidden=true;placeholders.forEach(node=>node.hidden=false);if(++index<sources.length)image.src=sources[index];});
  container.append(image);image.src=sources[0];return image;
 }
 function create(document,unit,className,tag='span',options={}){
  const container=document.createElement(tag);container.className='character-art '+className;
  const placeholder=document.createElement('span');placeholder.textContent='角色圖片';container.append(placeholder);
  mount(document,container,unit,[placeholder],options);return container;
 }
 const api={validFile,source,mount,create};
 if(typeof module!=='undefined')module.exports=api;else root.CharacterArt=api;
})(globalThis);
