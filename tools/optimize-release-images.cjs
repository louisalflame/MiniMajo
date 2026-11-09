// Generate checked-in website derivatives; never resize or overwrite source artwork.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function optimize(){
 const sharp=require(process.env.MINIMAJO_SHARP_MODULE||'sharp'),entries=[];
 let previous;try{previous=JSON.parse(fs.readFileSync(path.join(root,'release-images/manifest.json'),'utf8'));}catch{}
 const cached=new Map(previous?.version===1&&previous.scale===.5&&previous.quality===85&&previous.alphaQuality===100?previous.files.map(e=>[e.source,e]):[]);
 function walk(dir){for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const name=dir+'/'+entry.name;if(entry.isSymbolicLink())throw Error('素材不可使用符號連結：'+name);if(entry.isDirectory())walk(name);else if(/\.png$/i.test(name))entries.push(name);}}
 walk('assets');
 const files=[];
 for(const source of entries.sort()){
  const input=fs.readFileSync(path.join(root,source)),meta=await sharp(input).metadata();
  const width=Math.max(1,Math.round(meta.width/2)),height=Math.max(1,Math.round(meta.height/2));
  const output=source.replace(/\.png$/i,'.webp');
  // Window luminance is also read by the star-position algorithm.
  const lossless=source.endsWith('-window.png');
  const old=cached.get(source),target=path.join(root,'release-images',output);
  if(old&&old.sourceSha256===hash(input)&&!!old.lossless===lossless&&fs.existsSync(target)&&hash(fs.readFileSync(target))===old.sha256){files.push({...old,lossless});continue;}
  const bytes=await sharp(input).resize(width,height,{kernel:'lanczos3'}).webp({quality:85,alphaQuality:100,effort:6,lossless}).toBuffer();
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);
  files.push({source,output,sourceSha256:hash(input),sha256:hash(bytes),original:[meta.width,meta.height],size:[width,height],sourceBytes:input.length,bytes:bytes.length,alpha:!!meta.hasAlpha,lossless});
 }
 const manifest={format:'minimajo-release-images',version:1,scale:.5,quality:85,alphaQuality:100,files};
 fs.writeFileSync(path.join(root,'release-images/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({count:files.length,sourceMiB:files.reduce((s,f)=>s+f.sourceBytes,0)/1048576,webpMiB:files.reduce((s,f)=>s+f.bytes,0)/1048576},null,2));
}
if(require.main===module)optimize().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={optimize};
