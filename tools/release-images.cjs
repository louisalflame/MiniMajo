'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
// Convert intrinsic-pixel border slices to percentages before changing image size.
// Display widths, crop percentages, SVG coordinates and the 1600x900 scene stay fixed.
function rewriteCss(text,entries){
 return text.replace(/[^{}]+\{[^{}]*\}/g,rule=>{
  const match=rule.match(/border-image(?:-source)?\s*:\s*url\(["']?([^"')]+)["']?\)/);
  if(!match)return rule;
  const source=path.posix.normalize(path.posix.join('css',match[1])),entry=entries.get(source);
  if(!entry)return rule;
  const convert=slices=>{
   const fill=/\bfill\b/.test(slices),values=slices.replace(/\bfill\b/g,'').trim().split(/\s+/);
   if(!values.length||values.length>4||values.some(v=>!/^\d+(?:\.\d+)?%?$/.test(v)))throw Error('無法轉換圖片切邊：'+slices);
   const sides=[values[0],values[1]??values[0],values[2]??values[0],values[3]??values[1]??values[0]];
   return sides.map((v,i)=>v.endsWith('%')?v:(Number(v)/(i%2?entry.original[0]:entry.original[1])*100)+'%').join(' ')+(fill?' fill':'');
  };
  if(/border-image-source\s*:/.test(rule))return rule.replace(/(border-image-slice\s*:)\s*([^;}]*)/g,(_,prefix,slices)=>prefix+convert(slices));
  return rule.replace(/(border-image\s*:\s*url\([^)]*\))\s*([^/;}]*)/g,(_,prefix,slices)=>prefix+' '+convert(slices)+' ');
 });
}
function optimizeFiles(files,file,{root,sourceFile}){
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'release-images/manifest.json'),'utf8'));
 if(manifest.format!=='minimajo-release-images'||manifest.scale!==.5)throw Error('網站圖片清單無效，請重新執行 optimize-release-images.cjs');
 const entries=new Map(manifest.files.map(entry=>[entry.source,entry]));
 for(const [name,bytes] of [...files])if(/\.png$/i.test(name)){
  const entry=entries.get(name);
  if(!entry||hash(bytes)!==entry.sourceSha256)throw Error('網站縮圖缺少或已過期：'+name+'；請重新執行 optimize-release-images.cjs');
  if(entry.output!==name.replace(/\.png$/i,'.webp')||entry.size.some((n,i)=>n!==Math.max(1,Math.round(entry.original[i]/2))))throw Error('網站縮圖尺寸或路徑錯誤：'+name);
  const optimized=fs.readFileSync(sourceFile('release-images/'+entry.output));
  if(hash(optimized)!==entry.sha256)throw Error('網站縮圖校驗失敗：'+entry.output);
  files.delete(name);files.set(entry.output,optimized);
 }
 for(const [name,bytes] of files)if(/\.(css|js|html)$/.test(name)){
  // HTTP releases need no file:// PNG embeddings.
  if(name==='js/reward-mask-data.js'){files.set(name,Buffer.from('globalThis.RewardMaskAssets={resolve:path=>path};\n'));continue;}
  let text=bytes.toString();if(name.endsWith('.css'))text=rewriteCss(text,entries);
  files.set(name,Buffer.from(text.replace(/\.png\b/g,'.webp')));
 }
 function artwork(value){if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){if(['imageFile','detailImageFile','imagePath'].includes(key)&&typeof item==='string')value[key]=item.replace(/\.png$/i,'.webp');else if(item&&typeof item==='object')artwork(item);}}
 artwork(file.data);
 return manifest;
}
module.exports={optimizeFiles,rewriteCss};
