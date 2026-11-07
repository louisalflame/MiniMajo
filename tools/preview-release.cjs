// Static public-release preview, separate from the editor's fixed-file service.
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../dist'),slow=process.argv.includes('--slow');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.gif':'image/gif','.avif':'image/avif'};
if(!fs.existsSync(path.join(root,'release.json'))){console.error('請先執行 node tools/build-release.cjs 產生 dist。');process.exitCode=1;}
else{
 const server=http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  try{
   const url=new URL(req.url,'http://127.0.0.1'),name=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname),file=path.resolve(root,'.'+name);
   if(!file.startsWith(root+path.sep)||name.split(/[\\/]/).some(part=>part.startsWith('.'))||!fs.realpathSync(file).startsWith(root+path.sep)||!types[path.extname(file)])throw Error('not found');
   const bytes=fs.readFileSync(file),send=()=>{if(res.destroyed)return;res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-cache, max-age=0, must-revalidate','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);};
   if(slow&&/\.(png|jpe?g|webp|svg|gif|avif)$/i.test(file))setTimeout(send,250);else send();
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('找不到頁面');}
 });
 server.on('error',error=>{console.error('預覽服務無法啟動：'+error.message);process.exitCode=1;});
 server.listen(4174,'127.0.0.1',()=>console.log('公開版預覽：http://127.0.0.1:4174/'+(slow?'（圖片延遲250ms，方便查看 Loading）':'')+'\n保持此程序開啟，Ctrl+C 停止。'));
}
