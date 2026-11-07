// Crop approved 4x4 alpha sheets without redrawing their symbols.
// Usage: node tools/split-law-icons.cjs <sharp module path>
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require(process.argv[2]||'sharp');
const dir=path.resolve(__dirname,'../docs/ui-style/sources/law-icons');
const out=path.resolve(__dirname,'../tmp/asset-exports/law-icons');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
(async()=>{
 const mapping=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../assets/ui/law-icons/v1/manifest.json'),'utf8')).files;
 const sources=[];
 for(let batch=1;batch<=2;batch++){
  const file=`b-runes-batch${batch}-alpha-v1.png`,buffer=fs.readFileSync(path.join(dir,file));
  const {data,info}=await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  if(!data.some((v,i)=>i%4===3&&v===0))throw Error(`${file}: missing transparent background`);
  sources.push({file,sha256:hash(buffer),data,info});
 }
 fs.mkdirSync(out,{recursive:true});const files=[],tiles=[];
 for(const [index,entry] of mapping.entries()){
  const source=sources[entry.batch-1],{data,info}=source;
  const left=Math.round((entry.column-1)*info.width/4),right=Math.round(entry.column*info.width/4);
  const top=Math.round((entry.row-1)*info.height/4),bottom=Math.round(entry.row*info.height/4);
  let x0=right,y0=bottom,x1=-1,y1=-1,edgeInk=0;
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
   if(data[(y*info.width+x)*4+3]<24)continue;
   x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
   if(x===left||x===right-1||y===top||y===bottom-1)edgeInk++;
  }
  if(x1<0||edgeInk)throw Error(`Empty or clipped cell: ${entry.name}, edge pixels ${edgeInk}`);
  x0=Math.max(left,x0-3);y0=Math.max(top,y0-3);x1=Math.min(right-1,x1+3);y1=Math.min(bottom-1,y1+3);
  const bounds={left:x0,top:y0,width:x1-x0+1,height:y1-y0+1};
  const glyph=await sharp(data,{raw:info}).extract(bounds).resize({width:208,height:208,fit:'inside'}).png().toBuffer();
  const png=await sharp({create:{width:256,height:256,channels:4,background:'#00000000'}}).composite([{input:glyph,gravity:'centre'}]).png().toBuffer();
  const filename=`${String(index+1).padStart(2,'0')}-law.png`;
  fs.writeFileSync(path.join(out,filename),png);
  const {data:pixels,info:outputInfo}=await sharp(png).raw().toBuffer({resolveWithObject:true});
  if(outputInfo.width!==256||outputInfo.height!==256||outputInfo.channels!==4)throw Error('Invalid output format');
  for(let y=0;y<256;y++)for(let x=0;x<256;x++)if((x<20||y<20||x>=236||y>=236)&&pixels[(y*256+x)*4+3])throw Error('Unsafe output margin');
  files.push({...entry,file:filename,size:[256,256],source:source.file,sourceCell:{left,top,width:right-left,height:bottom-top},inkBounds:bounds,sha256:hash(png)});
  const thumb=await sharp(png).resize(112,112).png().toBuffer();
  const label=Buffer.from(`<svg width="144" height="24"><text x="72" y="17" text-anchor="middle" fill="#20333e" font-family="Microsoft JhengHei,sans-serif" font-size="12">${index+1} ${entry.name}</text></svg>`);
  const tile=await sharp({create:{width:144,height:148,channels:4,background:'#eee7d9'}}).composite([{input:thumb,left:16,top:4},{input:label,left:0,top:120}]).png().toBuffer();
  tiles.push({input:tile,left:index%8*144,top:Math.floor(index/8)*148});
 }
 await sharp({create:{width:1152,height:592,channels:4,background:'#eee7d9'}}).composite(tiles).png().toFile(path.join(out,'contact-sheet.png'));
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({status:'approved sheets; extracted only; not applied to game',method:'Built-in image_gen background removal; equal 4x4 cell crop, alpha>=24 bounds plus 3px guard, preserve all pixels within bounds, fit to 208px on transparent 256px canvas.',sources:sources.map(({file,sha256})=>({file,sha256})),files},null,2)+'\n');
 console.log(`Exported and verified ${files.length} transparent 256px icons; contact-sheet.png and manifest.json saved.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
