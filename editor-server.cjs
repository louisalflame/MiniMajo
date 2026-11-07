const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const Backup=require('./js/editor-backup.js');
const limit=20_000_000,hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.gif':'image/gif','.avif':'image/avif','.woff2':'font/woff2'};
function createEditorServer({root=__dirname,dataFile=path.join(root,'minimajo-editor.json')}={}){
 root=path.resolve(root);let writes=Promise.resolve();
 async function read(){
  let bytes;try{bytes=await fs.readFile(dataFile);}catch(e){if(e.code==='ENOENT')throw Object.assign(Error('找不到固定資料檔 minimajo-editor.json；請放回檔案後重新讀取，不會自動建立空檔。'),{status:404});throw e;}
  if(bytes.length>limit)throw Object.assign(Error('固定資料檔不得超過 20 MB。'),{status:413});
  let parsed;try{parsed=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));}catch{throw Object.assign(Error('minimajo-editor.json 的 JSON 無法解析；原檔未修改。'),{status:422});}
  try{return {...Backup.prepare(parsed),revision:hash(bytes)};}catch(e){throw Object.assign(Error('固定資料檔無效：'+e.message),{status:422});}
 }
 async function save(file,revision){
  const current=await read();if(!revision||revision!==current.revision)throw Object.assign(Error('固定資料檔已被其他分頁或程式修改；請先下載目前資料備份，再重新讀取，避免覆蓋別處的新資料。'),{status:409});
  let clean;try{clean=Backup.validate(file);}catch(e){throw Object.assign(e,{status:422});}
  const bytes=Buffer.from(JSON.stringify(clean,null,2)+'\n');if(bytes.length>limit)throw Object.assign(Error('資料不得超過 20 MB。'),{status:413});
  const temporary=dataFile+'.'+crypto.randomUUID()+'.tmp';
  try{
   const handle=await fs.open(temporary,'wx');try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
   // Recheck after preparing the replacement; an external edit must not be overwritten.
   if((await read()).revision!==revision)throw Object.assign(Error('寫入前發現固定檔案已變更，已取消覆蓋。'),{status:409});
   await fs.rename(temporary,dataFile);return {revision:hash(bytes)};
  }finally{await fs.unlink(temporary).catch(e=>{if(e.code!=='ENOENT')throw e;});}
 }
 const server=http.createServer(async(req,res)=>{
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':types['.json'],'Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try{
   const host=req.headers.host??'',port=server.address()?.port;
   if(![ '127.0.0.1:'+port,'localhost:'+port ].includes(host))return json(403,{error:'僅允許本機來源。'});
   const url=new URL(req.url,'http://'+host);
   if(url.pathname==='/api/editor-info'&&req.method==='GET')return json(200,{app:'MiniMajo',root,dataFile:path.resolve(dataFile)});
   if(url.pathname==='/api/editor-data'){
    if(req.method==='GET')return json(200,await read());
    if(req.method!=='PUT')return json(405,{error:'不支援的操作。'});
    if(req.headers['x-minimajo-editor']!=='1'||req.headers.origin&&req.headers.origin!=='http://'+host)return json(403,{error:'不允許此來源寫入固定檔案。'});
    if(!req.headers['content-type']?.startsWith('application/json'))return json(415,{error:'需要 JSON 資料。'});
    let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>limit)return json(413,{error:'資料不得超過 20 MB。'});chunks.push(chunk);}
    let file;try{file=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return json(400,{error:'寫入資料的 JSON 無法解析。'});}
    const task=writes.then(()=>save(file,req.headers['if-match']));writes=task.catch(()=>{});return json(200,await task);
   }
   if(!['GET','HEAD'].includes(req.method))return json(405,{error:'不支援的操作。'});
   const name=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname),file=path.resolve(root,'.'+name);
   if(!file.startsWith(root+path.sep)||name.split(/[\\/]/).some(part=>part.startsWith('.'))||!types[path.extname(file).toLowerCase()])return json(404,{error:'找不到頁面。'});
   const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file).toLowerCase()],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch(e){json(e.status??(e.code==='ENOENT'?404:500),{error:e.message});}
 });
 return server;
}
async function startEditor({root=__dirname,port=4173}={}){
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('MINIMAJO_PORT 需為 1～65535。');
 root=path.resolve(root);const server=createEditorServer({root}),url='http://127.0.0.1:'+port+'/editor.html';
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});return {server,url,reused:false};}
 catch(e){
  if(e.code!=='EADDRINUSE')throw e;
  try{const response=await fetch('http://127.0.0.1:'+port+'/api/editor-info',{signal:AbortSignal.timeout(2000)}),info=await response.json();if(response.ok&&info.app==='MiniMajo'&&typeof info.root==='string'&&path.resolve(info.root).toLowerCase()===root.toLowerCase())return {server:null,url,reused:true};}catch{}
  throw Error('連接埠 '+port+' 已被其他程式或其他專案使用，未停止或取代該程式。請關閉占用程式，或以 MINIMAJO_PORT 指定其他連接埠。');
 }
}
function openBrowser(url){
 const child=require('node:child_process').spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{detached:true,stdio:'ignore',windowsHide:true});
 child.once('error',()=>console.error('無法自動開啟瀏覽器，請手動開啟：'+url));child.unref();
}
if(require.main===module)startEditor({port:Number(process.env.MINIMAJO_PORT??4173)}).then(({url,reused})=>{
 console.log((reused?'MiniMajo 已在執行，沿用現有服務。':'MiniMajo 已啟動，使用期間請保持此視窗開啟。')+'\n編輯器：'+url+'\n固定資料檔：'+path.join(__dirname,'minimajo-editor.json'));
 if(process.argv.includes('--open'))openBrowser(url);
}).catch(e=>{console.error('MiniMajo 啟動失敗：'+e.message);process.exitCode=1;});
module.exports={createEditorServer,startEditor};
