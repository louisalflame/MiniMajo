// Calibrate approved original PNGs with CSS; never modify bitmap pixels.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),meta=JSON.parse(fs.readFileSync(path.join(root,'docs/ui-style/sources/layout/battle.json'))),map=Object.fromEntries(meta.files.map(m=>[m.file,m]));
function art(file,box){const m=map[file],[x,y,r,b]=box||m.bounds,w=r-x,h=b-y;return `url("../assets/ui/battle/v1/${file}") ${m.width===w?50:x/(m.width-w)*100}% ${m.height===h?50:y/(m.height-h)*100}% / ${m.width/w*100}% ${m.height/h*100}% no-repeat`;}
let css=`/* User-approved battle UI with fracture background 4. Scoped to battle, no roster skin changes. */
body.battle-page{background:#080f16 url("../assets/ui/battle/v1/background-fracture-4.png") center/cover no-repeat;--battle-reserved-height:320px;--text:#efdfbf;--muted:#c0b79f}
body.battle-page.preview-mode{--battle-reserved-height:320px}
body.battle-page .battlefield{grid-template-rows:44px 62px minmax(0,auto) 176px}
body.battle-page .stage-heading{grid-row:1;grid-column:1}
body.battle-page .stage-heading .clock{transform:none}
body.battle-page #battle-start-dock{grid-row:2;grid-column:1;width:240px;justify-self:center;align-self:end;padding:0;transform:none}
body.battle-page .arena-scroll{grid-row:3;margin-top:-26px;max-height:none}
body.battle-page .side-label{height:30px;margin:0;box-sizing:border-box;width:210px;max-width:none;position:relative;display:flex;align-items:center;gap:0;padding:0 0 0 48px;color:#efdfbf;font:700 18px/1.2 "PMingLiU",serif;letter-spacing:3px}
body.battle-page .side-label .side-dot{display:none}
body.battle-page .enemy-formation .side-label{background:${art('faction-enemy.png')}}
body.battle-page .ally-formation .side-label{background:${art('faction-ally.png')}}
body.battle-page .versus{height:10px;visibility:hidden}
body.battle-page .combat-skill{grid-row:4;height:176px;margin-top:-26px;align-self:start;align-items:flex-start;padding-top:0}
body.battle-page .skill-copy{display:none}
body.battle-page .skill-control{display:flex;align-items:center;gap:12px}
body.battle-page .cast-hover{transform:translateY(-28px)}
body.battle-page .skill-control::before,body.battle-page .skill-control::after{color:#efdfbf;font:700 20px/1.2 "PMingLiU",serif;letter-spacing:2px;white-space:nowrap;pointer-events:none}
body.battle-page .skill-control::before{content:"－極"}body.battle-page .skill-control::after{content:"式－"}
body.battle-page .skill-orb{width:164px;height:164px;padding:0;background:transparent;box-shadow:none;color:#a8b9c1;isolation:isolate}
body.battle-page .skill-orb::before{content:"";position:absolute;inset:16%;border-radius:50%;background:#091720c9;z-index:-1;pointer-events:none}
body.battle-page .skill-orb::after{content:"";position:absolute;inset:0;background:${art('skill-ring.png')};pointer-events:none;z-index:2}
body.battle-page .skill-orb:hover:not(:disabled){background:transparent;box-shadow:none;filter:brightness(1.13)}
body.battle-page .skill-orb:disabled{opacity:.65}
body.battle-page .skill-orb>span:first-child{font-size:25px}
body.battle-page #skill-art{width:68%;height:68%;border-radius:50%;z-index:0}
body.battle-page .skill-orb svg{z-index:3;stroke-width:2;pointer-events:none}
body.battle-page .ring-base{stroke:#45525b}
body.battle-page #skill-progress{stroke:#b1d6e1}
body.battle-page .combat-skill .battle-actions{height:48px;right:28px;top:0;align-items:flex-start}
body.battle-page .combat-skill .minor-actions{gap:10px}
body.battle-page :is(#speed,#battle-gear,#battle-stats){position:relative;display:inline-flex;align-items:center;justify-content:center;gap:10px;height:48px;min-height:48px;min-width:0;flex:0 0 auto;box-sizing:border-box;border:0;border-radius:0;margin:0;padding:0 14px;background:transparent;box-shadow:none;color:#183343;font:700 18px/1.2 "PMingLiU",serif;letter-spacing:0;isolation:isolate}
body.battle-page #speed{width:88px}
body.battle-page #battle-gear{width:150px}
body.battle-page #battle-stats{width:156px;white-space:nowrap}
body.battle-page .minor-actions:has(#battle-stats:not([hidden])) #reset{position:absolute;right:0;top:58px}
body.battle-page :is(#battle-gear,#battle-stats)[hidden]{display:none}
body.battle-page #battle-gear>.battle-book{display:block;position:relative;width:42px;height:30px;flex:none;z-index:1;background:${art('preparation-book.png')}}
body.battle-page .battle-button-skin{position:absolute;inset:0;pointer-events:none;z-index:-1;display:block}
body.battle-page .battle-button-skin>i{position:absolute;top:0;bottom:0;display:block}
body.battle-page :is(#speed,#battle-gear,#battle-stats):hover:not(:disabled){filter:brightness(1.1)}
body.battle-page :is(#speed,#battle-gear,#battle-stats):focus-visible{outline:2px solid #e0c29a;outline-offset:4px}
body.battle-page #battle-start-dock #play{border:0;border-radius:0;box-shadow:none;background:${art('button-paper.png')};color:#183343;font:700 20px/1.2 "PMingLiU",serif;padding:12px 28px;letter-spacing:2px}
body.battle-page .skill-tooltip{background:#10202a;border-color:#b5a586;color:#efdfbf}
@media(max-width:1100px){body.battle-page .skill-control{gap:8px}body.battle-page .skill-control::before,body.battle-page .skill-control::after{font-size:16px}body.battle-page #speed{width:72px}body.battle-page #battle-gear{width:126px}body.battle-page .combat-skill .minor-actions{gap:6px}}
@media(min-width:701px) and (max-height:850px){body.battle-page .skill-control{gap:8px}body.battle-page .skill-control::before,body.battle-page .skill-control::after{font-size:16px}body.battle-page .combat-skill .battle-actions{right:12px}}
@media(max-width:700px){body.battle-page,body.battle-page.preview-mode{--battle-reserved-height:390px}body.battle-page .battlefield{grid-template-rows:44px 62px minmax(0,auto) 224px}body.battle-page .arena-scroll{margin-top:0}body.battle-page .combat-skill{height:224px;margin-top:0;align-items:flex-start;padding-top:0}body.battle-page .combat-skill .battle-actions{top:164px;left:0;right:0;height:48px;justify-content:center}body.battle-page .skill-orb{width:152px;height:152px}body.battle-page .stage-heading .clock{transform:none}body.battle-page .clock strong{font-size:24px}body.battle-page #battle-start-dock{width:190px;transform:none}body.battle-page #battle-start-dock #play{width:190px;font-size:18px}body.battle-page .side-label{width:190px;font-size:16px}}
`;
const [x,y,r,b]=map['button-paper.png'].bounds,h=b-y,cap=h*.7;
for(const [i,box]of [[1,[x,y,x+cap,b]],[2,[x+cap,y,r-cap,b]],[3,[r-cap,y,r,b]]])css+=`body.battle-page .battle-button-skin>i:nth-child(${i}){${i===1?'left:0;width:33.6px':i===2?'left:33.6px;right:33.6px':'right:0;width:33.6px'};background:${art('button-paper.png',box)}}\n`;
fs.writeFileSync(path.join(root,'css/battle-art.css'),css);
