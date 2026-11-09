const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {rewriteCss,optimizeFiles}=require('../tools/release-images.cjs');
const entries=new Map([['assets/panel.png',{original:[200,100]}]]);
test('half-size images retain border geometry for shorthand and separate slice declarations',()=>{
 const shorthand=rewriteCss('a{border-image:url("../assets/panel.png") 10 20 fill / 38px / 0 round}',entries);
 assert.equal(shorthand,'a{border-image:url("../assets/panel.png") 10% 10% 10% 10% fill / 38px / 0 round}');
 assert.match(rewriteCss('a{border-image:url("../assets/panel.png") 10 /19px stretch}',entries),/10% 5% 10% 5% \/19px/);
 assert.match(rewriteCss('a{border-image-source:url("../assets/panel.png");border-image-slice:10 20 30 40 fill;border-image-width:38px}',entries),/border-image-slice:10% 10% 30% 20% fill;border-image-width:38px/);
 assert.equal(rewriteCss('a{background:url("../assets/panel.png") 50%/100%}',entries),'a{background:url("../assets/panel.png") 50%/100%}');
});
test('every published derivative matches source hashes, half dimensions and WebP bytes',()=>{
 const manifest=JSON.parse(fs.readFileSync('release-images/manifest.json'));
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 const pngs=[];function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const name=dir+'/'+entry.name;if(entry.isDirectory())walk(name);else if(name.endsWith('.png'))pngs.push(name);}}walk('assets');
 assert.deepEqual(manifest.files.map(e=>e.source).sort(),pngs.sort());
 for(const entry of manifest.files){
  const source=fs.readFileSync(entry.source),output=fs.readFileSync('release-images/'+entry.output);
  assert.equal(hash(source),entry.sourceSha256,entry.source);assert.equal(hash(output),entry.sha256,entry.output);
  assert.deepEqual(entry.original,[source.readUInt32BE(16),source.readUInt32BE(20)]);
  assert.deepEqual(entry.size,entry.original.map(n=>Math.max(1,Math.round(n/2))));
  assert.equal(output.toString('ascii',0,4),'RIFF');assert.equal(output.toString('ascii',8,12),'WEBP');
 }
 assert.ok(manifest.files.reduce((sum,e)=>sum+e.bytes,0)<manifest.files.reduce((sum,e)=>sum+e.sourceBytes,0)/4);
});
test('stale source artwork fails instead of silently publishing old derivatives',()=>{
 assert.throws(()=>optimizeFiles(new Map([['assets/characters/yun-detail.png',Buffer.from('changed')]]),{data:{}},{root:process.cwd(),sourceFile:()=>{throw Error('should not read');}}),/缺少或已過期/);
});
