// Lossless export of approved PNG regions. Original generated sources stay intact.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),source=path.join(root,'docs/ui-style/sources/character-details'),dest=path.join(root,'tmp/asset-exports/character-details');
const regions={
 'portrait-frame-v1.png':[79,95,964,1212],
 'nameplate-v1.png':[48,227,2077,257],
 'section-heading-v1.png':[74,264,2015,189],
 'horizontal-divider-v1.png':[69,417,1636,53],
 'vertical-divider-v1.png':[500,35,24,1465]
};
function read(b){
 let width,height,depth,type,interlace;const chunks=[];
 for(let p=8;p<b.length;){const n=b.readUInt32BE(p),tag=b.toString('ascii',p+4,p+8),data=b.subarray(p+8,p+8+n);if(tag==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);depth=data[8];type=data[9];interlace=data[12];}if(tag==='IDAT')chunks.push(data);p+=n+12;}
 if(depth!==8||type!==6||interlace)throw Error('Expected RGBA8 PNG');
 const raw=zlib.inflateSync(Buffer.concat(chunks)),stride=width*4,pixels=Buffer.alloc(stride*height);let offset=0;
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++){const filter=raw[offset++];if(filter>4)throw Error('Unsupported PNG filter');for(let x=0;x<stride;x++){const pos=y*stride+x,a=x>=4?pixels[pos-4]:0,up=y?pixels[pos-stride]:0,c=y&&x>=4?pixels[pos-stride-4]:0;pixels[pos]=(raw[offset++]+(filter===0?0:filter===1?a:filter===2?up:filter===3?Math.floor((a+up)/2):paeth(a,up,c)))&255;}}
 return {width,height,pixels};
}
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function chunk(tag,data){const type=Buffer.from(tag),n=Buffer.alloc(4),crc=Buffer.alloc(4);n.writeUInt32BE(data.length);let c=0xffffffff;for(const v of Buffer.concat([type,data]))c=crcTable[(c^v)&255]^(c>>>8);crc.writeUInt32BE((c^0xffffffff)>>>0);return Buffer.concat([n,type,data,crc]);}
function encode(width,height,pixels){const head=Buffer.alloc(13);head.writeUInt32BE(width);head.writeUInt32BE(height,4);head[8]=8;head[9]=6;const raw=Buffer.alloc((width*4+1)*height);for(let y=0;y<height;y++)pixels.copy(raw,y*(width*4+1)+1,y*width*4,(y+1)*width*4);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);}
fs.mkdirSync(dest,{recursive:true});const manifest={approved:'User approved concept v3, split PNGs, then explicitly authorized application on 2026-10-31',method:'RGBA lossless region export; no recolor, resize, repaint or alpha thresholding',files:[]};
for(const [file,[x,y,width,height]]of Object.entries(regions)){
 const original=fs.readFileSync(path.join(source,file)),image=read(original);if(x<0||y<0||x+width>image.width||y+height>image.height)throw Error('Invalid export region');
 const pixels=Buffer.alloc(width*height*4);for(let row=0;row<height;row++)image.pixels.copy(pixels,row*width*4,((y+row)*image.width+x)*4,((y+row)*image.width+x+width)*4);
 const output=encode(width,height,pixels),verified=read(output);if(!verified.pixels.equals(pixels))throw Error('Export pixel mismatch');
 fs.writeFileSync(path.join(dest,file),output);manifest.files.push({file,region:[x,y,width,height],sourceSha256:crypto.createHash('sha256').update(original).digest('hex'),sha256:crypto.createHash('sha256').update(output).digest('hex')});
}
fs.writeFileSync(path.join(dest,'approved-assets.json'),JSON.stringify(manifest,null,2)+'\n');console.log('Exported and pixel-verified 5 approved transparent PNGs.');
