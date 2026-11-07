// Package approved cutouts: locate visible ink, keep a 4px guard, then fit to 256px.
// Canvas receives original PNG data URIs so this also works without an HTTP server.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.MINIMAJO_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'docs/ui-style/sources/detail-icons'),out=path.join(root,'tmp/asset-exports/detail-icons');
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
(async()=>{
 const names=JSON.parse(fs.readFileSync(path.join(dir,'sources.json'),'utf8')).map(n=>n.name);
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage(),files=[];fs.mkdirSync(out,{recursive:true});
  for(const name of names){
   const original=fs.readFileSync(path.join(dir,'sources',name+'.png'));
   const result=await page.evaluate(async uri=>{
    const img=new Image();img.src=uri;await img.decode();
    const scan=document.createElement('canvas');scan.width=img.width;scan.height=img.height;const ctx=scan.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
    const pixels=ctx.getImageData(0,0,img.width,img.height).data;let x0=img.width,y0=img.height,x1=-1,y1=-1,transparent=0,solid=0;
    for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++){const a=pixels[(y*img.width+x)*4+3];if(!a)transparent++;if(a>=16){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}if(a===255)solid++;}
    if(!transparent||!solid||x1<0)throw Error('Expected transparent PNG with opaque ink');
    x0=Math.max(0,x0-4);y0=Math.max(0,y0-4);x1=Math.min(img.width-1,x1+4);y1=Math.min(img.height-1,y1+4);
    const w=x1-x0+1,h=y1-y0+1,scale=208/Math.max(w,h),out=document.createElement('canvas');out.width=out.height=256;const draw=out.getContext('2d');draw.imageSmoothingEnabled=true;draw.imageSmoothingQuality='high';draw.drawImage(img,x0,y0,w,h,(256-w*scale)/2,(256-h*scale)/2,w*scale,h*scale);
    return {png:out.toDataURL('image/png').split(',')[1],sourceSize:[img.width,img.height],bounds:[x0,y0,w,h],transparent,solid};
   },'data:image/png;base64,'+original.toString('base64'));
   const png=Buffer.from(result.png,'base64');fs.writeFileSync(path.join(out,name+'.png'),png);
   const {png:_,...metrics}=result;files.push({file:name+'.png',sourceSha256:hash(original),sha256:hash(png),size:[256,256],...metrics});
  }
  fs.writeFileSync(path.join(out,'approved-assets.json'),JSON.stringify({approved:'2026-10-31: user selected A, 1C/3B/4B and revised 2C, then explicitly authorized applying these icons.',method:'Built-in image_gen transparent cutouts; crop to visible-ink bounds (alpha>=16, plus 4px guard) and proportional canvas resampling. No per-pixel alpha thresholding, repaint, recolor, hole filling or background removal. Navy tint is applied by CSS in details only.',files},null,2)+'\n');
  console.log('Packaged '+files.length+' approved 256px alpha PNGs.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
