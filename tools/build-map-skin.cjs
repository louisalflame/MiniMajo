// Reuse approved PNGs only. New texture candidates are preview-only.
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const battle=JSON.parse(fs.readFileSync(path.join(root,'docs/ui-style/sources/layout/battle.json'))),shop=JSON.parse(fs.readFileSync(path.join(root,'docs/ui-style/sources/layout/shop.json')));
const art=(set,file,box)=>{const m=(set==='battle'?battle:shop).files.find(m=>m.file===file),[x,y,r,b]=box||m.bounds,w=r-x,h=b-y;return `url("../assets/ui/${set}/v1/${file}") ${m.width===w?50:x/(m.width-w)*100}% ${m.height===h?50:y/(m.height-h)*100}% / ${m.width/w*100}% ${m.height/h*100}% no-repeat`;};
let css=`/* Map toolbar and fog viewport. All bitmap controls reuse approved art. */
body.immersive-game{background:radial-gradient(ellipse at 50% 35%,#19232a,#090e13 78%)}
body.immersive-game>header{position:fixed;top:8px;left:8px;width:48px;height:48px;padding:0;margin:0;z-index:4;background:none}
body.immersive-game #journey-home{display:block;width:48px;height:48px;padding:0;outline-offset:3px}
body.immersive-game .map-home-art{display:block;width:48px;height:47px;background:${art('shop','exit-button.png')}}
body.immersive-game .journey-shell{padding:0;max-width:none;margin:0}
body.immersive-game #journey-map .map-heading{position:absolute;top:24px;right:clamp(24px,4vw,80px);left:auto;max-width:calc(100% - 96px);height:48px;gap:12px;padding:0;z-index:3}
body.immersive-game #journey-wallet{position:relative;isolation:isolate;display:flex;align-items:center;gap:7px;height:48px;padding:0 18px;margin:0;color:#e7d6b5;font:700 20px/1.2 "PMingLiU",serif;white-space:nowrap}
body.immersive-game #expedition-progress{font:inherit}
body.immersive-game #journey-wallet #expedition-gold{margin-left:10px;font:inherit}
body.immersive-game .map-echo-icon{display:block;width:25px;height:28px;flex:none;color:#e7c991}
body.immersive-game .map-echo-icon svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
body.immersive-game .map-echo-icon :is(circle:not(.echo-ring),.echo-points){fill:currentColor;stroke:none}
body :is(#journey-gear,#reward-gear).map-paper-button{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:10px;width:150px;height:48px;min-height:48px;min-width:0;flex:none;padding:0 14px;margin:0;border:0;border-radius:0;background:transparent;box-shadow:none;isolation:isolate;color:#183343;text-shadow:none;font:700 18px/1.2 "PMingLiU",serif;letter-spacing:0}
body .map-button-skin{position:absolute;inset:0;z-index:-1;pointer-events:none}
body .map-button-skin>i{position:absolute;top:0;bottom:0}
body .map-book-art{display:block;flex:none;width:42px;height:30px;background:${art('battle','preparation-book.png')}}
body.immersive-game #map-help-open{display:grid;place-items:center;flex:none;width:44px;height:44px;padding:6px;margin:0;border:0;background:transparent;color:#e7d6b5;box-shadow:none}
body.immersive-game #map-help-open svg{width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
body :is(#journey-gear,#reward-gear).map-paper-button:hover:not(:disabled),body.immersive-game #map-help-open:hover:not(:disabled){background:transparent;filter:brightness(1.14)}
body.immersive-game :is(#journey-home,#journey-gear,#map-help-open):focus-visible{outline:2px solid #d6b98e;outline-offset:3px}
body.immersive-game #journey-map .map-stage{background:linear-gradient(#090e1380,#090e1380),url("../assets/ui/map/v1/slate-background.png") center/cover no-repeat}
body.immersive-game #journey-map .map-stage-top{display:none}
body.immersive-game #journey-map #hex-map-svg{height:100dvh;min-height:420px}
body.immersive-game #journey-map .map-canvas::before,body.immersive-game #journey-map .map-canvas::after{inset:-12% -16%;filter:blur(18px)}
body.immersive-game #journey-message{position:fixed;margin:0;left:16px;right:16px;bottom:8px;z-index:3;pointer-events:none}
body.immersive-game #journey-new:not([hidden]){position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:3}
body dialog.ui-panel#map-help-dialog{width:min(760px,92vw);max-height:90dvh;padding:44px 34px 28px;color:#173449}
body dialog.ui-panel#map-help-dialog>.ui-panel-body{max-height:calc(86dvh - 90px);overflow:auto;overscroll-behavior:contain;line-height:1.9;font-size:15px}
body #map-help-dialog h3{font:700 19px/1.5 "PMingLiU",serif;margin:20px 0 8px;color:#173449}
body #map-help-dialog section:first-child h3{margin-top:4px}
body #map-help-dialog p{margin:6px 0 12px;white-space:normal;color:#243f4c}
body #map-help-dialog table{width:100%;border-collapse:collapse;color:#173449;font-size:14px}
body #map-help-dialog :is(th,td){border-bottom:1px solid #17344933;padding:7px 10px;text-align:left;background:transparent}
@media(max-width:650px){body.immersive-game #journey-map .map-heading{top:16px;right:12px;gap:8px}body.immersive-game #journey-wallet{font-size:17px;gap:5px;padding-inline:12px}body.immersive-game #journey-wallet #expedition-gold{margin-left:4px}body :is(#journey-gear,#reward-gear).map-paper-button{width:116px;gap:7px;padding:0 10px;font-size:17px}body .map-book-art{width:34px;height:26px}body.immersive-game #map-help-open{width:36px;padding:4px}body.immersive-game .map-echo-icon{width:22px}body dialog.ui-panel#map-help-dialog{padding:42px 19px 22px}body dialog.ui-panel#map-help-dialog>.ui-panel-body{font-size:14px}}
`;
const m=battle.files.find(m=>m.file==='button-paper.png'),[x,y,r,b]=m.bounds,cap=(b-y)*.7;
for(const [i,box]of [[1,[x,y,x+cap,b]],[2,[x+cap,y,r-cap,b]],[3,[r-cap,y,r,b]]])css+=`body .map-button-skin>i:nth-child(${i}){${i===1?'left:0;width:33.6px':i===2?'left:33.6px;right:33.6px':'right:0;width:33.6px'};background:${art('battle','button-paper.png',box)}}\n`;
const navy=shop.files.find(m=>m.file==='button-navy.png'),[nx,ny,nr,nb]=navy.bounds,ncap=(nb-ny)*.55;
for(const [i,box]of [[1,[nx,ny,nx+ncap,nb]],[2,[nx+ncap,ny,nr-ncap,nb]],[3,[nr-ncap,ny,nr,nb]]]){
 const position=i===1?'left:0;width:26.4px':i===2?'left:26.4px;right:26.4px':'right:0;width:26.4px';
 css+=`body.immersive-game .map-wallet-skin>i:nth-child(${i}){${position};background:${art('shop','button-navy.png',box)}}\n`;
}
css+=`@media(max-width:360px){body.immersive-game #journey-gear.map-paper-button{width:96px}body.immersive-game #journey-map .map-heading{gap:5px;right:8px}}\n`;
fs.writeFileSync(path.join(root,'css/map-art.css'),css);
