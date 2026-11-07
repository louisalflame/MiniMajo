// CSS calibration from measured original PNG bounds; no bitmap modification.
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const meta=JSON.parse(fs.readFileSync(path.join(root,'docs/ui-style/sources/layout/shop.json'))),map=Object.fromEntries(meta.files.map(f=>[f.file,f]));
const scope='body.immersive-game dialog.ui-panel#expedition-dialog[data-mode=shop]';
const placement=(file,box)=>{const m=map[file],[x,y,r,b]=box||m.bounds,w=r-x,h=b-y;return `url("../assets/ui/shop/v1/${file}") ${x/(m.width-w)*100}% ${y/(m.height-h)*100}% / ${m.width/w*100}% ${m.height/h*100}% no-repeat`;};
let css=`/* Approved shop D art. Background and individual PNGs, never a flattened UI. */
.currency-crystal{display:inline-block;flex:none;width:13px;height:26px;background:${placement('currency-crystal.png')};vertical-align:middle}
body.immersive-game #journey-wallet #expedition-gold,${scope} #shop-wallet{display:flex;align-items:center;justify-content:center;gap:9px}
body.immersive-game #journey-wallet #expedition-gold::before,${scope} #shop-wallet::before{content:"";display:inline-block;width:13px;height:26px;background:${placement('currency-crystal.png')};flex:none}
body [data-card-skin] .roster-price .roster-stat-icon{width:9px;height:18px;background:${placement('currency-crystal.png')}}
body .roster-price .roster-stat-icon svg{display:none}
${scope}{--shop-team-width:min(1348px,calc(100vw - 512px),calc((100dvh - 218px) * 1340 / 1056));--shop-content-width:calc(var(--shop-team-width) + 448px);--shop-product-block-height:calc(46px + var(--shop-row-width) * 352 / 1404);background:#282b24 url("../assets/ui/shop/v1/background-alchemy.png") center/cover no-repeat;color:#f2dfb9;--text:#f2dfb9;--muted:#d0c3a7;--panel-ink:#183849;box-shadow:none}
${scope}::backdrop{background:#20251f}
${scope}>.ui-panel-body{grid-template-columns:200px minmax(0,1fr) 200px}
${scope} .shop-sidebar,${scope} .roster-inspect{background:${placement('sidebar-panel.png')};color:#183849;--text:#183849;--muted:#53646a;--panel-ink:#183849;border:0;box-sizing:border-box;padding:30px 18px;position:relative}
${scope} .shop-sidebar{gap:14px;padding-bottom:88px}
${scope} [data-card-skin] .roster-card-hud{bottom:0;padding-bottom:clamp(11px,15cqi,18px)}
${scope} .ui-panel-title{flex:none;display:grid;place-items:center;width:174px;max-width:100%;height:58px;margin:0;padding:0;font:900 25px/1.2 "PMingLiU",serif;letter-spacing:4px;color:#f2dfb9;background:url("../assets/ui/common/title-plaque-v3.png") center/100% 182% no-repeat}
${scope} #expedition-close{flex:none;box-sizing:border-box;width:48px;height:47px;padding:0;margin:2px 0 0;border:0;border-radius:0;background:${placement('exit-button.png')};color:transparent;font-size:0;box-shadow:none;text-shadow:none}
${scope} #expedition-close:is(:hover,:focus-visible){filter:brightness(1.08)}
${scope} .shop-tabs{width:164px;max-width:100%;gap:12px}
${scope} #shop-wallet{color:#183849;font:700 20px/1.4 "PMingLiU",serif;white-space:nowrap;margin:0}
${scope} .shop-controls{max-width:100%}
${scope} .shop-reroll-label{display:flex;align-items:center;justify-content:center;gap:6px;position:relative;z-index:1}
${scope} .shop-reroll-label .currency-crystal{width:11px;height:22px}
${scope} .roster-inspect{padding:64px 21px 36px;display:flex;flex-direction:column;overflow:hidden;scrollbar-color:#6b7c7c #ead8b3}
${scope} .shop-inspect-content{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin}
${scope} .roster-inspect::before{content:"角色介紹";display:block;flex:none;text-align:center;font:700 22px/1.5 "PMingLiU",serif;letter-spacing:2px;margin-bottom:22px}
${scope} #roster-selected{display:block;line-height:1.7;color:#183849}
${scope} #roster-selected:has(.shop-inspect-stars){display:flex;align-items:center;gap:8px;font-size:18px}
${scope} .shop-inspect-stars{display:flex;align-items:center;flex-wrap:wrap;gap:2px;max-width:60px}
${scope} .shop-inspect-stars img{width:11px;height:13px;object-fit:contain}
${scope} .shop-basic-stats{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:0 6px;margin:10px 0 20px;font-size:12px}
${scope} .shop-basic-stats[hidden]{display:none}
${scope} .shop-basic-stats :is(dt,dd){margin:0;padding:6px 0;line-height:1.6;border-bottom:1px solid #17344926;overflow-wrap:anywhere}
${scope} .shop-basic-stats dt{display:flex;align-items:center;gap:6px;min-width:0;color:#53646a}
${scope} .shop-basic-stats dd{text-align:right;color:#183849}
${scope} .shop-basic-stats .detail-stat-icon{order:-1;width:18px;height:18px;flex:none;object-fit:contain;filter:brightness(0) saturate(100%) invert(18%) sepia(36%) saturate(711%) hue-rotate(161deg) brightness(91%) contrast(94%)}
${scope} .shop-basic-stats .detail-category-label{position:absolute;width:1px;height:1px;padding:0;border:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
${scope} .shop-basic-stats .detail-category-value{grid-column:1/-1;text-align:left;border:0;padding:4px 0;display:flex;align-items:center;gap:6px}
${scope} .shop-basic-stats .detail-category-end{position:relative;margin-bottom:9px;padding-bottom:17px}
${scope} .roster-effects-title{color:#183849}
${scope} .roster-heading{gap:8px;padding:8px 0;color:#f2dfb9}
${scope} .roster-heading h3{font:700 16px/1.5 "PMingLiU",serif;color:#f2dfb9;letter-spacing:2px}
${scope} #roster-top-section .roster-heading{display:none}
${scope} .roster-heading::after{display:none}
${scope} .law-price{display:flex;align-items:center;gap:4px}
${scope} .law-price .currency-crystal{width:9px;height:18px}
${scope} button.law-card{background:#102331;color:#f2dfb9;border:1px solid #bfae88;border-radius:3px;--panel-ink:#f2dfb9}
${scope} button.law-card:not(:disabled):hover{background:#1e3a49}
${scope} button.law-card:disabled{opacity:.78}
${scope} .law-card-name,${scope} .law-card .law-price{color:#f2dfb9}
${scope} .law-card-stats{color:#d3c7ae}
${scope} .law-target-zone{background:#10233180;border:1px dashed #cbb99188}
${scope} #law-target-name{color:#f2dfb9}
${scope} button:focus-visible{outline:2px solid #75c0d2;outline-offset:3px}
`;
const buttonSel=scope+' :is(.shop-tabs button,#shop-reroll)';
css+=`${buttonSel}{--button-height:44px;--cap-width:calc(var(--button-height) * .78);box-sizing:border-box;position:relative;isolation:isolate;height:var(--button-height);min-height:var(--button-height);border:0;border-radius:0;padding:0 var(--cap-width);color:#183849;font:700 17px/1.3 "PMingLiU",serif;box-shadow:none;text-shadow:none;background-color:transparent;background-origin:content-box;background-clip:content-box;width:164px;max-width:100%}
${buttonSel}::before,${buttonSel}::after{content:"";position:absolute;top:0;bottom:0;width:var(--cap-width);pointer-events:none;z-index:-1}
${buttonSel}::before{left:0}${buttonSel}::after{right:0}
${buttonSel}:hover{filter:brightness(1.06)}${buttonSel}:disabled{filter:saturate(.55);opacity:.55}
`;
for(const [file,sel]of [['button-paper.png',buttonSel],['button-navy.png',buttonSel+'[aria-selected=true]']]){
 const m=map[file],[x,y,r,b]=m.bounds,h=b-y,cap=h*.78,w=r-x;
 const art=(sx,sw)=>`url("../assets/ui/shop/v1/${file}") ${sx/(m.width-sw)*100}% ${y/(m.height-h)*100}%/${m.width/sw*100}% calc(var(--button-height) * ${m.height/h}) no-repeat`;
 css+=`${sel}{background-image:url("../assets/ui/shop/v1/${file}");background-position:${(x+cap)/(m.width-(w-2*cap))*100}% ${y/(m.height-h)*100}%;background-size:${m.width/(w-2*cap)*100}% calc(var(--button-height) * ${m.height/h});background-repeat:no-repeat}${sel}::before{background:${art(x,cap)}}${sel}::after{background:${art(r-cap,cap)}}`;
}
css+=`${buttonSel}[aria-selected=true]{color:#f2dfb9}\n`;
// Share the exact preparation PNG/cap and divider definitions.
const prep=fs.readFileSync(path.join(root,'css/preparation-dialog.css'),'utf8');
const sell=prep.slice(prep.indexOf('body #expedition-dialog[data-mode=gear] #roster-sell-zone{'),prep.indexOf('body #expedition-dialog[data-mode=gear] #roster-sell-zone.drop-hover{')).replaceAll('body #expedition-dialog[data-mode=gear]',scope);
const lines=prep.slice(prep.indexOf('body #expedition-dialog[data-mode=gear] .roster-heading{gap:'),prep.indexOf('body #expedition-dialog[data-mode=gear] #roster-sell-zone.drop-hover{filter')).replaceAll('body #expedition-dialog[data-mode=gear]',scope);
css+=sell+lines+`
${scope} #roster-sell-zone{--art-height:40px;position:relative;grid-area:1 / 2 / 2 / 3;margin:0 0 6px;cursor:default}
${scope} #roster-sell-zone.drop-hover{filter:brightness(1.2);background:transparent url("../assets/ui/preparation/v1/sell-zone.png") 50% 50.1099%/113.243% calc(var(--art-height) * 724 / 269) no-repeat!important}
${scope} .raster-divider{filter:brightness(0) invert(89%) sepia(22%) saturate(365%) hue-rotate(342deg) brightness(104%) contrast(92%)}
@media(max-width:900px){
 ${scope}{--shop-product-block-height:calc(46px + var(--shop-row-width) * 352 / 1404)}
 ${scope}>.ui-panel-body{grid-template-columns:100px minmax(0,1fr);grid-template-rows:auto auto 150px auto auto}
 ${scope} .shop-sidebar{padding:18px 6px 64px;gap:12px}
 ${scope} .ui-panel-title{width:90px;height:40px;font-size:18px;letter-spacing:2px}
 ${scope} #expedition-close{width:42px;height:41px;padding:0;font-size:0}
 ${scope} .shop-tabs{width:88px}
 ${buttonSel}{--button-height:38px;font-size:13px;padding:0 10px}
 ${scope} #shop-reroll{width:88px;padding:0 7px;font-size:11px}
 ${scope} .shop-reroll-label{gap:3px}
 ${scope} .shop-reroll-label .currency-crystal{width:8px;height:16px}
 ${scope} #shop-wallet{font-size:16px;gap:6px}
 ${scope} .roster-inspect{padding:24px 8px 14px;border:14px solid transparent;background:none;border-image:url("../assets/ui/shop/v1/sidebar-panel.png") 210 175 220 175 fill / 14px / 0 stretch}
 ${scope} .roster-inspect::before{font-size:17px;margin-bottom:8px}
}
`;
// Approved law-option panel: nine parts keep corner geometry at every size.
const lawMeta=JSON.parse(fs.readFileSync(path.join(root,'docs/ui-style/sources/layout/shop-laws.json'))),lawMap=Object.fromEntries(lawMeta.files.map(m=>[m.file,m]));
const lawCrop=(file,box)=>{const m=lawMap[file],[x,y,r,b]=box||m.bounds,w=r-x,h=b-y;return `url("../assets/ui/shop/laws-v1/${file}") ${x/(m.width-w)*100}% ${y/(m.height-h)*100}% / ${m.width/w*100}% ${m.height/h*100}% no-repeat`;};
css+=`
${scope} .law-panel-skin{position:absolute;inset:0;display:grid;grid-template-columns:8px minmax(0,1fr) 8px;grid-template-rows:8px minmax(0,1fr) 8px;pointer-events:none;z-index:-1}
${scope} button.law-card{--law-art-size:clamp(40px,calc((var(--shop-product-block-height) - 10px) / 2 - 32px),64px);position:relative;isolation:isolate;grid-template-columns:var(--law-art-size) minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);gap:7px 12px;padding:14px 18px;background:none;color:#183849;border:0;border-radius:0;--panel-ink:#183849}
${scope} button.law-card:not(:disabled):hover{background:none;filter:brightness(1.04)}
${scope} .law-card-header{grid-area:1 / 2 / 2 / 3;display:flex;align-items:flex-start;justify-content:space-between;gap:8px;min-width:0}
${scope} .law-card-name{flex:1;min-width:0;color:#183849;font-size:16px;line-height:1.4;max-height:none;overflow:visible;overflow-wrap:anywhere}
${scope} .law-card .law-price{color:#183849;font-size:14px;line-height:1.6;flex:none;margin:0;overflow:visible}
${scope} .law-card-copy{grid-area:2 / 2 / 3 / 3;align-self:stretch;height:100%;max-height:100%;min-height:0;min-width:0;overflow:auto;scrollbar-width:thin;overscroll-behavior:contain;padding-right:3px}
${scope} .law-card .law-description{display:block;font-size:14px;line-height:1.7;overflow:visible;max-height:none}
${scope} .law-card-stats{display:block;color:#53646a;font-size:12px;line-height:1.6;overflow:visible;max-height:none;margin-top:8px}
${scope} .law-card .law-product-art{grid-area:1 / 1 / 3 / 2;position:relative;box-sizing:border-box;align-self:start;width:var(--law-art-size);height:var(--law-art-size);min-height:0;max-height:none;border:0;background:none;padding:7px;display:grid;place-items:center}
${scope} button.law-card[data-sold=true]{grid-template-columns:1fr;grid-template-rows:1fr;place-items:center}
${scope} .law-sold-label{grid-area:1/1/-1/-1;align-self:center;justify-self:center;font-size:18px;line-height:1.5;color:#53646a}
${scope} .law-product-art::after{content:"";position:absolute;inset:0;background:${lawCrop('law-icon-frame.png')};pointer-events:none}
${scope} .law-product-art .law-product-image{width:100%;height:100%;object-fit:contain;min-height:0}
${scope} .law-art-placeholder{font-size:9px;line-height:1.4;text-align:center}
${scope} #law-shop-panel .law-target-layout{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0}
${scope} #law-target-zone{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;width:100%;padding:0;border:0;background:none;overflow:visible}
${scope} #law-target-art{position:relative;isolation:isolate;width:min(calc((var(--shop-product-block-height) - 28px) * .8),100%);height:auto;aspect-ratio:4/5;flex:none;display:block;padding:0;box-sizing:border-box;background:#102331}
${scope} #law-target-art::after{content:"";position:absolute;inset:0;z-index:4;border:0;background:url("../assets/ui/character-details/v1/portrait-frame-v1.png") center/100% 100% no-repeat;pointer-events:none}
${scope} .law-target-placeholder{position:absolute;inset:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#d9c8a6;font-size:12px;text-align:center}
${scope} .law-target-placeholder img{width:28px;height:28px;object-fit:contain}
${scope} .law-recipient-card{position:relative;display:block;width:100%;height:100%;background:#112331}
${scope} .law-recipient-card .character-image:not([hidden]){display:block;width:100%;height:100%;object-fit:cover;object-position:center}
${scope} #law-target-name{position:relative;isolation:isolate;box-sizing:border-box;display:grid;place-items:center;width:min(calc((var(--shop-product-block-height) - 28px) * .8),100%);height:28px;min-height:28px;padding:3px 8px;color:#183849;font:700 12px/1.5 "PMingLiU",serif;text-align:center;flex:none}
${scope} #law-target-name:empty{display:none}
${scope} #roster-laws:empty{display:none}
${scope} .shop-equipped-title{font:700 17px/1.5 "PMingLiU",serif;border-top:1px solid #18384955;padding-top:12px;margin:18px 0 12px}
${scope} .shop-equipped-law{display:grid;grid-template-columns:36px minmax(0,1fr);gap:8px;margin-bottom:18px}
${scope} .shop-equipped-law .law-product-art{position:relative;width:36px;height:36px;padding:4px;border:0;background:none;box-sizing:border-box;display:grid;place-items:center;align-self:start}
${scope} .shop-equipped-text{min-width:0;overflow-wrap:anywhere}
${scope} .shop-equipped-text strong{font-size:13px;color:#183849}
${scope} .shop-equipped-text p{white-space:pre-wrap;font-size:12px;line-height:1.8;margin:5px 0 0;color:#183849}
${scope} .shop-equipped-text .shop-equipped-attributes{color:#53646a}
`;
const panel=lawMap['law-option-panel.png'],[lx,ly,lr,lb]=panel.bounds,xx=[lx,lx+110,lr-110,lr],yy=[ly,ly+110,lb-110,lb];
for(let row=0;row<3;row++)for(let col=0;col<3;col++)css+=`${scope} .law-panel-skin>i:nth-child(${row*3+col+1}){background:${lawCrop(panel.file,[xx[col],yy[row],xx[col+1],yy[row+1]])}}\n`;
css+=`@media(max-width:900px){
 ${scope} #law-shop-panel:not([hidden]){grid-template-columns:220px calc(var(--law-slot-width) * 3) 220px;overflow-x:auto;overflow-y:hidden;overscroll-behavior:contain}
 ${scope} button.law-card{--law-art-size:48px}
}\n`;
fs.writeFileSync(path.join(root,'css/shop-art.css'),css);
