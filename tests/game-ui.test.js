const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
class Element {
 animate(frames,options){const animation={frames,options,playbackRate:1,cancel(){this.cancelled=true;}};(this.animations??=[]).push(animation);return animation;}
 constructor(){this.children=[];this.style={};this.attributes={};this.handlers={};this.textContent='';this.className='';this.disabled=false;this.classList={add:()=>{},remove:()=>{},toggle:()=>{}};}
 showModal(){this.open=true;}close(){this.open=false;}
 focus(){this.focused=true;}
 setAttribute(k,v){this.attributes[k]=v;}
 append(...items){for(const item of items){item.remove();item.parent=this;this.children.push(item);}}
 replaceChildren(...items){this.children.forEach(x=>x.parent=null);this.children=[];this.append(...items);}
 insertBefore(item,before){item.remove();const i=this.children.indexOf(before);item.parent=this;if(i<0)this.children.push(item);else this.children.splice(i,0,item);}
 remove(){if(this.parent){const siblings=this.parent.children;siblings.splice(siblings.indexOf(this),1);this.parent=null;}}
 querySelector(selector){return this.children.find(x=>selector.slice(1).split(' ').every(c=>(x.className||'').split(' ').includes(c)))||this.children.map(x=>x.querySelector(selector)).find(Boolean)||null;}
 addEventListener(type,handler){this.handlers[type]=handler;}
 click(){if(!this.disabled)this.handlers.click?.();}
}
function setup(preview=false){
 const html=fs.readFileSync(path.join(root,'battle.html'),'utf8');
 const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 const field=new Element(),document={body:new Element(),hidden:false,handlers:{},createElement:()=>new Element(),getElementById:id=>elements.get(id),querySelector:s=>s==='.battlefield'?field:null,addEventListener(type,fn){this.handlers[type]=fn;}};
 let callback,now=0;const messages=[],globalHandlers={},parent={postMessage:message=>messages.push(message)};
 const audioCalls=[],audio={enabled:true,setVolume(value){this.volume=value;audioCalls.push(['volume',value]);},unlock(){audioCalls.push(['unlock']);},events(cues){audioCalls.push(['events',structuredClone(cues)]);},play(kind){audioCalls.push(['play',kind]);},stop(){audioCalls.push(['stop']);},setEnabled(value){this.enabled=value;audioCalls.push(['enabled',value]);}};
 let capturedState;const engine=require('../js/battle.js'),battle={...engine,create(...args){capturedState=engine.create(...args);return capturedState;}};
 const context=vm.createContext({document,structuredClone,location:{search:preview?"?preview=1":""},URLSearchParams,parent,addEventListener:(type,fn)=>globalHandlers[type]=fn,performance:{now:()=>now},requestAnimationFrame:fn=>{callback=fn;},setTimeout:()=>{},BattleAudio:{create:()=>audio},Laws:require('../js/laws.js'),GameConfig:require('../js/config.js'),UIIcons:require('../js/ui-icons.js'),CharacterDetails:require('../js/character-details.js'),DialogDismiss:require('../js/dialog-dismiss.js'),CharacterCardSkin:require('../js/character-card-skin.js'),CharacterArt:require('../js/character-art.js'),ItemDB:require('../js/database.js'),SkillDB:require('../js/skills.js'),Battle:battle,Effects:require('../js/effects.js'),Statuses:require('../js/statuses.js')});
 vm.runInContext(fs.readFileSync(path.join(root,'js/game.js'),'utf8'),context);
 return {elements,document,messages,audioCalls,get state(){return capturedState;},send:data=>globalHandlers.message({source:parent,data}),advance(ticks){for(let i=0;i<ticks;i++){now+=100;callback(now);}}};
}

test('battle audio follows live cues, mute controls, pause and successful skill casts',()=>{
 const {elements:e,state,advance,audioCalls,document}=setup();
 e.get('play').click();assert.ok(audioCalls.some(c=>c[0]==='unlock'));advance(22);
 assert.ok(audioCalls.some(c=>c[0]==='events'&&c[1].some(e=>e.type==='hit')));
 state.teams[0].skillReady=state.tick;e.get('play').click();e.get('play').click();e.get('cast').click();assert.ok(audioCalls.some(c=>c[0]==='play'&&c[1]==='ultimate'));
 e.get('battle-sound').click();assert.equal(e.get('battle-sound-label').textContent,'靜音');assert.equal(e.get('battle-sound').attributes['aria-pressed'],'false');
 e.get('battle-sound').click();assert.equal(e.get('battle-sound-label').textContent,'音效');
 e.get('play').click();assert.equal(audioCalls.at(-1)[0],'stop');
 const count=audioCalls.filter(c=>c[0]==='events').length;advance(3);assert.equal(audioCalls.filter(c=>c[0]==='events').length,count);
 e.get('play').click();document.hidden=true;document.handlers.visibilitychange();assert.equal(audioCalls.at(-1)[0],'stop');
});

test('battle snapshots apply configured volume and accept older snapshots without the volume field',()=>{
 const {send,audioCalls,elements:e}=setup(true),unit=require('../js/database.js').defaults[0],config={...require('../js/config.js').defaults};delete config.battleVolume;
 const data={type:'minimajo-preview',loadouts:[[unit,...Array(9).fill(null)],[unit,...Array(9).fill(null)]],skills:[],limits:[10,10],config};
 send(data);assert.equal(e.get('play').disabled,false);assert.ok(audioCalls.some(c=>c[0]==='volume'&&c[1]===60));
 send({...data,config:{...config,battleVolume:0}});assert.equal(audioCalls.filter(c=>c[0]==='volume').at(-1)[1],0);
});
test('standalone battle entry loads fixed teams, supports cast, pause, speed, reset and completion',()=>{
 const {elements:e,document,advance}=setup();
 assert.equal(e.get('enemy-units').children.length,7);assert.equal(e.get('ally-units').children.length,7);
 assert.equal(e.get('enemy-units').children[0].attributes['aria-label'],'失誓騎士');
 assert.equal(e.get('ally-units').children[0].attributes['aria-label'],'月誓劍士');
 assert.equal(e.get('timer').textContent,'02:00');assert.equal(e.get('cast').disabled,true);
 e.get('play').click();assert.equal(e.get('cast').disabled,true);
 assert.equal(e.get('skill-progress').style.strokeDashoffset,'100');assert.equal(e.get('cast-state').textContent,'8.0 秒後就緒');
 advance(10);assert.equal(e.get('timer').textContent,'01:59');
 e.get('play').click();advance(20);assert.equal(e.get('timer').textContent,'01:59');
 e.get('play').click();e.get('speed').click();advance(10);assert.equal(e.get('timer').textContent,'01:57');
 document.hidden=true;document.handlers.visibilitychange();document.hidden=false;advance(10);assert.equal(e.get('phase').textContent,'已暫停');assert.equal(e.get('timer').textContent,'01:57');
 e.get('reset').click();assert.equal(e.get('timer').textContent,'02:00');assert.equal(e.get('phase').textContent,'等待開戰');assert.equal(e.get('log').children.length,0);
 e.get('play').click();advance(1200);assert.equal(e.get('phase').textContent,'試煉結束');assert.equal(e.get('play').disabled,true);assert.equal(e.get('cast').disabled,true);
 assert.match(e.get('battle-message').textContent,/試煉完成|試煉失敗|試煉終結/);
 e.get('reset').click();assert.equal(e.get('play').disabled,false);assert.equal(e.get('ally-count').textContent,'6 / 6 人 · 9 / 10 格');
});
test('homepage opens journey and battle loads no editor controllers',()=>{
 const home=fs.readFileSync(path.join(root,'index.html'),'utf8'),battle=fs.readFileSync(path.join(root,'battle.html'),'utf8');
 assert.match(home,/href="play.html"/);assert.doesNotMatch(home,/editor.html#battle/);
 assert.doesNotMatch(battle,/js\/(?:app|skill-editor|tabs)\.js/);
 assert.ok(battle.indexOf('id="enemy-units"')<battle.indexOf('id="ally-units"'));
 for(const match of battle.matchAll(/(?:src|href)="([^"#]+)"/g))assert.ok(fs.existsSync(path.join(root,match[1].split('?')[0])),match[1]);
});

test('auto mode casts ready allied skills repeatedly and switching back stops automatic casts',()=>{
 const {elements:e,state,advance}=setup();
 e.get('play').click();advance(80);
 assert.equal(state.teams[0].skillReady,80,'manual mode leaves a ready skill uncast');
 e.get('auto-cast').click();
 assert.equal(e.get('auto-cast-label').textContent,'自動');assert.equal(e.get('auto-cast').attributes['aria-pressed'],'true');
 assert.equal(state.teams[0].skillReady,160,'switching to auto casts immediately when ready');
 advance(80);assert.equal(state.teams[0].skillReady,240,'auto casts again after cooldown');
 e.get('auto-cast').click();assert.equal(e.get('auto-cast-label').textContent,'手動');
 advance(80);assert.equal(state.teams[0].skillReady,240);
 assert.equal(state.teams[1].skill,null,'enemy never auto-casts');
});

test('auto casting respects prebattle, pause, visibility, stun and disabled skills, and keeps mode on reset',()=>{
 const {elements:e,state,document,advance}=setup();
 e.get('auto-cast').click();assert.equal(state.started,false);assert.equal(state.teams[0].skillReady,80);
 state.teams[0].skillReady=0;advance(1);assert.equal(state.teams[0].skillReady,0);
 e.get('play').click();e.get('play').click();advance(2);assert.equal(state.teams[0].skillReady,0);
 e.get('play').click();advance(1);assert.equal(state.teams[0].skillReady,80);
 state.teams[0].skillReady=0;document.hidden=true;document.handlers.visibilitychange();advance(2);assert.equal(state.teams[0].skillReady,0);
 document.hidden=false;
 const own=state.teams[0].units[0],Statuses=require('../js/statuses.js');
 Statuses.apply(own,{status:'stun',duration:{kind:'seconds',value:2}},1,state.tick);
 e.get('play').click();advance(2);assert.equal(state.teams[0].skillReady,0);
 own.statuses=[];state.activeSkillsEnabled=false;advance(2);assert.equal(state.teams[0].skillReady,0);
 state.activeSkillsEnabled=true;advance(1);assert.ok(state.teams[0].skillReady>state.tick);
 e.get('reset').click();assert.equal(e.get('auto-cast').attributes['aria-pressed'],'true');
});

test('combat cues use runtime identity, combine attack and hit, pause and reset without replay',()=>{
 const {elements:e,state,advance}=setup();
 const ally=e.get('ally-units').children[0],enemy=e.get('enemy-units').children[0];
 const own=state.teams[0].units[0],foe=state.teams[1].units[0];
 state.visuals=[{target:own.battleId,type:'attack'},{target:own.battleId,type:'attack'},{target:own.battleId,type:'hit'},{target:own.battleId,type:'passive'},{target:foe.battleId,type:'attack'}];
 e.get('play').click();
 assert.equal(state.visuals.length,0);assert.equal(ally.animations.length,2);
 assert.equal(ally.animations[0].frames[1].translate,'0 -14px');
 assert.equal(enemy.animations[0].frames[1].translate,'0 14px');
 const halo=ally.querySelector('.unit-passive-halo');assert.equal(halo.animations.length,1);
 assert.equal(halo.animations[0].frames.at(-1).opacity,0);
 e.get('play').click();assert.ok(ally.animations.every(a=>a.playbackRate===0));
 advance(2);assert.equal(ally.animations.length,2);
 e.get('play').click();assert.ok(ally.animations.every(a=>a.playbackRate===1));
 e.get('reset').click();assert.ok(ally.animations.every(a=>a.cancelled));assert.ok(halo.animations[0].cancelled);
});

test('overtime enters exactly at zero once, pulses on actual damage, pauses and clears on reset',()=>{
 const {elements:e,state,advance}=setup();
 state.config.battleSeconds=1;state.config.overtimePulse=.3;
 e.get('play').click();advance(9);assert.equal(e.get('battle-overtime').hidden,true);
 advance(1);assert.equal(e.get('timer').textContent,'+00:00');assert.equal(e.get('battle-overtime').hidden,false);
 assert.equal(e.get('overtime-title').animations.length,1);assert.equal(e.get('overtime-entry').animations.length,1);
 advance(2);assert.equal(e.get('overtime-pulse').animations,undefined);
 advance(1);assert.equal(e.get('overtime-pulse').animations.length,1);
 e.get('play').click();assert.equal(e.get('overtime-title').animations[0].playbackRate,0);
 e.get('play').click();assert.equal(e.get('overtime-title').animations.length,1,'pause and resume must not replay the title');
 e.get('reset').click();assert.equal(e.get('battle-overtime').hidden,true);
 assert.equal(e.get('overtime-title').animations[0].cancelled,true);
});

test('HP loss trail preserves cumulative hits, freezes on pause and clears when healing covers it',()=>{
 const {elements:e,state}=setup(),unit=state.teams[0].units[0],card=e.get('ally-units').children[0];
 const trail=card.querySelector('.hp-loss-trail'),fill=card.querySelector('.hp-meter').querySelector('.meter-fill');
 unit.hp=180;e.get('play').click();
 assert.equal(fill.style.width,'75%');assert.equal(trail.animations[0].frames[0].width,'100%');
 assert.equal(trail.animations[0].frames.at(-1).width,'75%');
 trail.animations[0].currentTime=180;unit.hp=120;e.get('play').click();
 const second=trail.animations[1];assert.equal(second.frames[0].width,'87.5%');assert.equal(second.frames.at(-1).width,'50%');
 assert.equal(second.playbackRate,0);assert.ok(trail.animations[0].cancelled);
 unit.hp=230;e.get('play').click();assert.ok(second.cancelled);assert.equal(trail.style.width,(230/240*100)+'%');
 unit.shield=300;e.get('play').click();assert.equal(trail.animations.length,2,'shield gain alone must not create HP loss');
});

test('hit flash distinguishes shield absorption and a knockdown overrides the attack lunge',()=>{
 const {elements:e,state}=setup(),unit=state.teams[0].units[0],card=e.get('ally-units').children[0];
 const flash=card.querySelector('.unit-hit-flash');
 state.visuals=[{target:unit.battleId,type:'hit',shieldOnly:true}];e.get('play').click();
 assert.equal(flash.style.background,'#96d9fa55');
 state.visuals=[{target:unit.battleId,type:'hit',shieldOnly:false},{target:unit.battleId,type:'hit',shieldOnly:true},{target:unit.battleId,type:'attack'},{target:unit.battleId,type:'knockdown'}];
 e.get('play').click();assert.equal(flash.style.background,'#ffe0bc44');
 assert.ok(card.animations.some(a=>a.frames.some(f=>f.translate==='0 9px')));
 assert.ok(!card.animations.some(a=>a.frames.some(f=>f.translate==='0 -14px')));
 const icon=card.querySelector('.stagger').children[1];assert.equal(icon.animations[0].frames[1].transform,'scale(1.65)');
 assert.equal(icon.animations[0].playbackRate,0);
});

test('MISS floats without moving its target, pauses, speeds up, and clears on reset',()=>{
 const {elements:e,state}=setup(),unit=state.teams[0].units[0],root=e.get('ally-units').children[0];
 state.feedback.push({target:unit.battleId,team:0,slot:unit.slot,type:'miss'});e.get('play').click();
 const miss=e.get('ally-units').children.find(el=>el.className==='combat-floats').children[0];assert.equal(miss.textContent,'MISS');assert.equal(root.animations,undefined);
 e.get('play').click();assert.equal(miss.animations[0].playbackRate,0);
 e.get('speed').click();e.get('play').click();assert.equal(miss.animations[0].playbackRate,2);
 e.get('reset').click();assert.equal(miss.animations[0].cancelled,true);
});

test('heal and shield cues animate their own layers and ready cue plays once per charge',()=>{
 const {elements:e,state,advance}=setup(),unit=state.teams[0].units[0],root=e.get('ally-units').children[0];
 state.visuals=[{target:unit.battleId,type:'heal'},{target:unit.battleId,type:'shield'}];e.get('play').click();
 assert.equal(root.querySelector('.unit-heal-sweep').animations.length,1);assert.equal(root.querySelector('.unit-shield-gain').animations.length,1);
 advance(80);assert.equal(e.get('cast').animations.length,1);e.get('cast').animations[0].onfinish();
 e.get('play').click();e.get('play').click();assert.equal(e.get('cast').animations.length,1);
 const Status=require('../js/statuses.js');Status.apply(unit,{status:'stun',duration:{kind:'seconds',value:2}},1,state.tick);e.get('play').click();e.get('play').click();unit.statuses=[];e.get('play').click();e.get('play').click();
 assert.equal(e.get('cast').animations.length,1,'stun ending does not replay an already announced charge');
 e.get('cast').click();advance(80);assert.equal(e.get('cast').animations.length,2);
});

test('ten-cell formations reserve wide portraits and keep an empty tenth slot',()=>{
 const {elements:e}=setup();
 for(const id of ['enemy-units','ally-units']){
  const children=e.get(id).children,occupied=new Set();
  assert.equal(children.length,7);
  const cards=children.filter(x=>x.className==='unit');assert.equal(cards.length,6);
  assert.deepEqual(cards.map(x=>x.style.gridColumn),['1 / span 1','2 / span 2','4 / span 1','5 / span 3','8 / span 1','9 / span 1']);
  for(const card of cards){
   const [start,span]=card.style.gridColumn.split(' / span ').map(Number);
   for(let n=start;n<start+span;n++){assert.ok(n<=10);assert.ok(!occupied.has(n));occupied.add(n);}
   assert.equal(card.querySelector('.portrait image-slot').className,'portrait image-slot');
   assert.equal(card.querySelector('.portrait image-slot').children[1].textContent,'角色圖片');
  }
  assert.equal(occupied.size,9);assert.equal(children[6].style.gridColumn,'10');assert.equal(children[6].attributes['aria-label'],'第 10 格，空位');
 }
});

test('inspection pauses temporarily, resumes prior playback, and respects manual pause',()=>{
 const {elements:e,document,advance}=setup();
 const ally=e.get('ally-units').children[0],enemy=e.get('enemy-units').children[3];
 e.get('play').click();advance(10);ally.click();
 assert.equal(e.get('character-detail').hidden,false);assert.equal(e.get('detail-name').textContent,'月誓劍士');
 assert.equal(e.get('play').disabled,true);assert.equal(e.get('cast').disabled,true);
 advance(20);assert.equal(e.get('timer').textContent,'01:59');
 enemy.handlers.keydown({key:'Enter',preventDefault(){}});
 assert.equal(e.get('detail-name').textContent,'空殼守衛');assert.equal(e.has('detail-side'),false);assert.equal(e.get('character-detail').open,true);assert.equal(enemy.title,undefined);
 assert.equal(ally.attributes['aria-expanded'],'false');
 document.handlers.keydown({key:'Escape',preventDefault(){}});
 assert.equal(e.get('character-detail').hidden,true);assert.equal(e.get('character-detail').open,false);assert.equal(enemy.focused,true);
 advance(10);assert.equal(e.get('timer').textContent,'01:58');assert.equal(e.get('play').disabled,false);assert.equal(e.get('play').textContent,'暫停');
 e.get('play').click();ally.click();document.handlers.keydown({key:'Escape',preventDefault(){}});advance(10);assert.equal(e.get('timer').textContent,'01:58');
 ally.click();e.get('reset').click();assert.equal(e.get('character-detail').hidden,true);assert.equal(e.get('phase').textContent,'等待開戰');
});
test('skill explanation never casts or pauses the battle',()=>{
 const {elements:e,advance}=setup();e.get('play').click();
 e.get('skill-help').click();assert.equal(e.get('skill-tooltip').hidden,false);assert.equal(e.get('cast').disabled,true);
 advance(10);assert.equal(e.get('timer').textContent,'01:59');assert.equal(e.get('cast').disabled,true);
 e.get('skill-help').click();assert.equal(e.get('skill-tooltip').hidden,true);
 e.get('skill-control').handlers.pointerenter();assert.equal(e.get('skill-tooltip').hidden,false);
 e.get('skill-control').handlers.pointerleave();assert.equal(e.get('skill-tooltip').hidden,true);
});

test('workshop preview receives edited data and renders movement after the opposite enemy dies',()=>{
 const {elements:e,send,advance,messages}=setup(true);
 assert.equal(e.get('play').disabled,true);
 const base=require('../js/database.js').defaults[0];
 const hero={...base,id:'hero',name:'工坊移動測試',maxHp:100,cooldown:.1,moveDistance:2,effects:[{type:'damage',amount:100,range:1}]};
 const target={...base,id:'target',name:'標靶',maxHp:100,cooldown:120,moveDistance:0,effects:[]};
 const own=Array(10).fill(null),enemy=Array(10).fill(null);own[0]=hero;enemy[0]=target;enemy[4]={...target,id:'far'};
 send({type:'minimajo-preview',loadouts:[own,enemy],skills:[],limits:[10,10]});
 assert.equal(e.get('ally-units').children[0].attributes['aria-label'],'工坊移動測試');
 assert.equal(e.get('skill-name').textContent,'無符合的極式');assert.equal(e.get('play').disabled,false);
 e.get('play').click();advance(1);assert.ok(e.get('enemy-count').textContent.startsWith('1 / 2 人'));
 advance(1);assert.equal(e.get('ally-units').children[0].style.gridColumn,'3 / span 1');
 advance(1);assert.equal(e.get('ally-units').children[0].style.gridColumn,'5 / span 1');
 assert.equal(e.get('ally-units').children[0].querySelector('.slot-range').textContent,'05');
 send({type:'minimajo-pause'});advance(10);assert.equal(e.get('phase').textContent,'已暫停');
 assert.ok(messages.some(x=>x.type==='minimajo-battle-state'&&x.started));
 e.get('play').click();advance(1);assert.equal(e.get('phase').textContent,'試煉結束');
 e.get('battle-result-confirm').click();e.get('battle-stats').click();assert.equal(e.get('battle-stats-note').hidden,true);assert.equal(e.get('ally-units').children[0].style.gridColumn,'1 / span 1');const restored=e.get('enemy-units').children.filter(n=>n.className==='unit');assert.equal(restored.length,2);assert.equal(restored[1].style.gridColumn,'5 / span 1');assert.equal(e.get('ally-units').children[0].querySelector('.battle-totals').children[0].textContent,'傷害 200');assert.equal(e.get('ally-units').children[0].querySelector('.battle-totals').children[3].textContent,'行動 4');e.get('battle-result-confirm').click();e.get('battle-stats').click();assert.equal(e.get('ally-units').children[0].style.gridColumn,'5 / span 1');
 send({type:'minimajo-preview',loadouts:[],skills:[],limits:[10,10]});assert.equal(e.get('play').disabled,true);assert.match(e.get('battle-message').textContent,/編隊資料無效/);
});

test('preview switch controls allied skills and enemies never auto-cast',()=>{
 const {elements:e,send,advance}=setup(true),D=require('../js/database.js'),S=require('../js/skills.js');
 const member={...D.defaults[0],cooldown:120,effects:[]},row=()=>[member,...Array(9).fill(null)];
 const data={type:'minimajo-preview',loadouts:[row(),row()],skills:S.defaults,limits:[10,10],activeSkillsEnabled:false};
 send(data);e.get('play').click();advance(30);
 assert.equal(e.get('cast').disabled,true);assert.match(e.get('cast-state').textContent,/極式已關閉/);assert.equal(e.get('log').children.length,0);assert.equal(e.get('timer').textContent,'01:57');
 send({...data,activeSkillsEnabled:true});e.get('play').click();assert.equal(e.get('cast').disabled,true);advance(79);assert.equal(e.get('cast').disabled,true);advance(1);assert.equal(e.get('cast').disabled,false);assert.equal(e.get('log').children.length,0);e.get('cast').click();assert.ok(e.get('log').children.length>0);
});

test('campaign bridge starts at full health, selected skill and reports one final result',()=>{
 const {elements:e,send,messages,advance}=setup(true),D=require('../js/database.js'),S=require('../js/skills.js');
 const ally={...D.defaults[0],cooldown:.1,effects:[{type:'damage',amount:999,range:3}]},enemy={...D.defaults[0],maxHp:20,cooldown:120};
 send({type:'minimajo-preview',campaign:true,token:'run-1',loadouts:[[ally,...Array(9).fill(null)],[enemy,...Array(9).fill(null)]],skills:[S.defaults[0]],limits:[10,10]});
 assert.equal(e.get('reset').hidden,true);assert.equal(e.get('ally-units').children[0].querySelector('.hp-meter').querySelector('.meter-value').textContent,'180/180');
 e.get('play').click();advance(5);assert.equal(messages.filter(m=>m.type==='minimajo-journey-result').length,0);assert.equal(e.get('battle-result').open,true);assert.equal(e.get('battle-result-title').textContent,'VICTORY');
 const tick=e.get('timer').textContent;advance(50);assert.equal(e.get('timer').textContent,tick);e.get('play').click();assert.equal(messages.filter(m=>m.type==='minimajo-journey-result').length,0);
 let prevented=false;e.get('battle-result').handlers.cancel({preventDefault(){prevented=true;}});assert.ok(prevented);
 e.get('battle-result-confirm').click();e.get('battle-result-confirm').click();const result=messages.filter(m=>m.type==='minimajo-journey-result');assert.equal(result.length,1);assert.equal(result[0].winner,0);assert.equal(result[0].token,'run-1');assert.deepEqual(Array.from(result[0].hp),[180]);
  assert.equal(e.get('play').textContent,'返回地圖');assert.equal(e.get('play').disabled,false);e.get('play').click();
  assert.equal(messages.at(-1).type,'minimajo-journey-return');assert.equal(messages.at(-1).token,'run-1');
  e.get('battle-result-confirm').click();e.get('battle-stats').click();e.get('battle-result-confirm').click();e.get('battle-stats').click();e.get('reset').click();advance(10);assert.equal(messages.filter(m=>m.type==='minimajo-journey-result').length,1);assert.deepEqual(Array.from(result[0].hp),[180]);
});

test('ordered heal shield and damage emit separate colored numbers',()=>{
 const {elements:e,send,advance,messages}=setup(true),base=require('../js/database.js').defaults[0];
 const own={...base,maxHp:100,cooldown:.1,effects:[{type:'heal',amount:5},{type:'shield',amount:3}]},enemy={...base,maxHp:100,cooldown:.1,effects:[{type:'damage',amount:8}]};
 send({type:'minimajo-preview',campaign:true,token:'floats',loadouts:[[own,...Array(9).fill(null)],[enemy,...Array(9).fill(null)]],skills:[],limits:[10,10]});e.get('play').click();advance(2);
 const ownCard=e.get('ally-units').children[0];assert.equal(ownCard.querySelector('.hp-meter').querySelector('.meter-value').textContent,'98/100');
 const floats=e.get('ally-units').children.find(n=>n.className==='combat-floats').children.slice(-3);assert.deepEqual(floats.map(n=>[n.className,n.textContent]).sort(),[['combat-number damage','−8'],['combat-number heal','+3'],['combat-number shield','+3']]);
 send({type:'minimajo-pause'});advance(5);assert.equal(floats.length,3);assert.equal(messages.filter(m=>m.type==='minimajo-journey-result').length,0);
});

test('battle iframe accepts stacked law snapshots with their accumulated stats',()=>{
 const {elements:e,send}=setup(true),D=require('../js/database.js'),L=require('../js/laws.js');
 const law={shopPrice:50,shopWeight:100,id:'stack',name:'強化',stats:{maxHp:20},passives:[]};
 const own=L.attach(D.defaults[0],[law,law]),row=u=>[u,...Array(9).fill(null)];
 send({type:'minimajo-preview',loadouts:[row(own),row(D.defaults[0])],skills:[],limits:[10,10]});
 assert.equal(e.get('play').disabled,false);e.get('ally-units').children[0].click();
 assert.equal(e.get('detail-name').textContent,own.name);
 assert.ok(e.get('character-detail').hidden===false);
});

test('iframe preview executes death laws before reporting campaign victory and includes law damage in stats',()=>{
 const {elements:e,send,advance,messages}=setup(true),D=require('../js/database.js'),L=require('../js/laws.js');
 const row=u=>[u,...Array(9).fill(null)];
 const death=L.validate([{id:'death',name:'死亡反擊',shopPrice:0,shopWeight:0,stats:{},passives:[{when:'death',subject:{relation:'self',conditions:[]},effects:[{type:'damage',amount:100}]}]}]);
 const ally={...D.defaults[0],cooldown:.1,maxHp:100,effects:[{type:'damage',amount:100}]};
 const enemy={...D.defaults[1],maxHp:100,cooldown:120,effects:[],laws:death};
 send({type:'minimajo-preview',campaign:true,token:'death-chain',loadouts:[row(ally),row(enemy)],skills:[],limits:[10,10]});
 e.get('play').click();advance(1);
 assert.equal(messages.filter(m=>m.type==='minimajo-journey-result').length,0);assert.equal(e.get('battle-result-title').textContent,'GAME SET');e.get('battle-result-confirm').click();
 const results=messages.filter(m=>m.type==='minimajo-journey-result');assert.equal(results.length,1);assert.equal(results[0].winner,'draw');
 e.get('battle-result-confirm').click();e.get('battle-stats').click();assert.equal(e.get('enemy-units').children[0].querySelector('.battle-totals').children[0].textContent,'傷害 100');
});

test('campaign preparation locks start until refreshed and refuses preparation after starting',()=>{
 const {elements:e,send,messages}=setup(true),base=require('../js/database.js').defaults[0];
 const team=Array(10).fill(null);team[0]=base;
 const payload={type:'minimajo-preview',campaign:true,token:'before',loadouts:[team,team],skills:[],limits:[10,10]};send(payload);
 assert.equal(e.get('skill-name').textContent,'');assert.equal(e.get('cast-state').textContent,'');assert.equal(e.get('phase').textContent,'');assert.equal(e.get('battle-message').textContent,'');assert.equal(e.get('cast').disabled,true);
 e.get('cast-hover').handlers.pointerenter();assert.equal(e.get('skill-tooltip').hidden,true);
 send({type:'minimajo-prepare',token:'wrong'});assert.equal(e.get('play').disabled,false);
  assert.equal(e.get('battle-gear').hidden,false);e.get('battle-gear').click();
  assert.equal(messages.at(-1).type,'minimajo-prepare-ready');assert.equal(messages.at(-1).token,'before');assert.equal(messages.at(-1).allowed,true);
  assert.equal(e.get('play').disabled,true);send(payload);
 send({type:'minimajo-prepare',token:'before'});assert.equal(messages.at(-1).allowed,true);assert.equal(e.get('play').disabled,true);e.get('play').click();
 send({...payload,token:'after'});assert.equal(e.get('play').disabled,false);e.get('play').click();assert.ok(messages.some(m=>m.type==='minimajo-battle-state'&&m.token==='after'&&m.started));
  assert.equal(e.get('battle-gear').hidden,true);
 send({type:'minimajo-prepare',token:'after'});assert.equal(messages.at(-1).allowed,false);e.get('play').click();send({type:'minimajo-prepare',token:'after'});assert.equal(messages.at(-1).allowed,false);
});

test('draw exposes statistics without replacing the normal HUD or showing victory prose',()=>{
 const {elements:e,send,advance}=setup(true),D=require('../js/database.js'),C=require('../js/config.js');const team=Array(10).fill(null);team[0]={...D.defaults[0],maxHp:1,cooldown:120,effects:[]};
 send({type:'minimajo-preview',campaign:true,token:'draw-stats',loadouts:[team,team],skills:[],limits:[10,10],config:{...C.defaults,battleSeconds:1,overtimePulse:1,overtimeDamage:10000}});
 e.get('play').click();advance(20);assert.equal(e.get('battle-stats').hidden,false);e.get('battle-result-confirm').click();e.get('battle-stats').click();assert.equal(e.get('battle-stats').attributes['aria-pressed'],'true');const unit=e.get('ally-units').children[0];assert.equal(unit.querySelector('.unit-hud').hidden,false);assert.equal(unit.querySelector('.battle-totals').hidden,false);assert.equal(e.get('battle-message').textContent,'');assert.equal(e.get('battle-stats-note').hidden,true);
});

test('compact HUD keeps numeric labels inside two meters and one title row',()=>{
 const {elements:e}=setup(),card=e.get('ally-units').children[0],hud=card.querySelector('.unit-hud');
 const title=hud.querySelector('.roster-card-heading');
 assert.equal(title.children.length,3);
 assert.equal(title.children[0].attributes['aria-label'],'人類');
 assert.equal(title.children[2].textContent,'月誓劍士');
 assert.equal(card.querySelector('.card-star-column').attributes['aria-label'],'1 星');
 assert.equal(card.querySelector('.card-star-column').children.length,1);
 const hp=hud.querySelector('.meter hp-meter'),posture=hud.querySelector('.meter stagger');
 assert.equal(hp.querySelector('.meter-value').textContent,'240/240');
 assert.equal(posture.children[2].textContent,'0/100');
 assert.equal(hp.attributes['aria-valuemax'],'240');
 assert.equal(hp.attributes['aria-valuetext'],'240 / 240');assert.equal(hp.title,'240 / 240');
 assert.equal(hud.children[3].children[0].attributes['aria-label'],'攻擊力 10');
 assert.equal(hud.children.length,4); // name/overlays, health, posture, attack/range
 card.click();assert.equal(e.get('detail-stars').children.length,1);assert.equal(e.get('detail-stars').children[0].src,'assets/ui/card-icons/approved-v1/star.png');
});

test('health and shield share one track below at and above maximum HP without duplicate shield badges',()=>{
 for(const [hp,shield,red,blue,text]of [[60,30,60,30,'60+30/100'],[80,40,200/3,100/3,'80+40/100'],[60,40,60,40,'60+40/100'],[60,0,60,0,'60/100'],[0,100,0,100,'0+100/100'],[0,0,0,0,'0/100']]){
  const env=setup(true),base={...require('../js/database.js').defaults[0],maxHp:100,cooldown:120,effects:[]},row=[base,...Array(9).fill(null)];env.send({type:'minimajo-preview',loadouts:[row,row],skills:[],limits:[10,10]});
  const card=env.elements.get('ally-units').children[0],unit=env.state.teams[0].units[0];unit.hp=hp;unit.shield=shield;card.click();
  const meter=card.querySelector('.hp-meter'),fill=meter.querySelector('.meter-fill'),armor=meter.querySelector('.shield-fill'),value=meter.querySelector('.meter-value');
  assert.ok(Math.abs(parseFloat(fill.style.width)-red)<1e-8);assert.ok(Math.abs(parseFloat(armor.style.left)-red)<1e-8);assert.ok(Math.abs(parseFloat(armor.style.width)-blue)<1e-8);assert.equal(armor.hidden,shield===0);
  assert.equal(shield?value.children.map(n=>n.textContent).join(''):value.textContent,text);assert.equal(meter.attributes['aria-valuemax'],'100');assert.equal(meter.attributes['aria-valuenow'],String(hp));if(shield)assert.equal(value.children[1].className,'shield-value');
  assert.ok(!card.querySelector('.unit-status').children.some(n=>n.attributes['aria-label']?.startsWith('護盾 ')));
  const stats=env.elements.get('detail-stats').children,labels=stats.filter((_,i)=>i%2===0).map(n=>n.textContent);for(const omitted of ['佔用','傷害／治療／護盾攻擊力','下次行動'])assert.ok(!labels.includes(omitted));assert.equal(labels[labels.indexOf('血量')+1],'護盾');
 }
});

test('absorbed damage updates the merged shield segment and returns to plain HP text when depleted',()=>{
 const env=setup(true),base=require('../js/database.js').defaults[0],ally={...base,maxHp:100,cooldown:120,effects:[]},enemy={...base,maxHp:100,cooldown:.1,effects:[{type:'damage',amount:30,range:10}]};
 env.send({type:'minimajo-preview',loadouts:[[ally,...Array(9).fill(null)],[enemy,...Array(9).fill(null)]],skills:[],limits:[10,10]});const unit=env.state.teams[0].units[0],card=env.elements.get('ally-units').children[0],meter=card.querySelector('.hp-meter');unit.hp=80;unit.shield=40;env.elements.get('play').click();
 env.advance(1);assert.equal(unit.hp,80);assert.equal(unit.shield,10);assert.equal(meter.querySelector('.meter-fill').style.width,'80%');assert.equal(meter.querySelector('.shield-fill').style.width,'10%');assert.equal(meter.querySelector('.meter-value').children.map(n=>n.textContent).join(''),'80+10/100');
 env.advance(1);assert.equal(unit.hp,60);assert.equal(unit.shield,0);assert.equal(meter.querySelector('.shield-fill').hidden,true);assert.equal(meter.querySelector('.meter-fill').style.width,'60%');assert.equal(meter.querySelector('.meter-value').textContent,'60/100');
});

test('full-card action light freezes on pause and recharges without an action flash',()=>{
 const {elements:e,send,advance}=setup(true),base=require('../js/database.js').defaults[0];
 const row=unit=>[unit,...Array(9).fill(null)];
 const actor={...base,cooldown:1,effects:[],moveDistance:0};
 send({type:'minimajo-preview',loadouts:[row(actor),row({...actor,cooldown:120})],skills:[],limits:[10,10]});
 const card=e.get('ally-units').children[0],light=card.querySelector('.meter unit-action-meter');
 assert.equal(light.children[0].style.height,'0%');
 e.get('play').click();advance(5);assert.equal(light.children[0].style.height,'50%');
 e.get('play').click();advance(10);assert.equal(light.children[0].style.height,'50%');
 e.get('play').click();advance(5);assert.equal(card.attributes['data-acting'],undefined);assert.equal(light.children[0].style.height,'0%');
 advance(3);assert.ok(Math.abs(parseFloat(light.children[0].style.height)-30)<.001);
 e.get('reset').click();assert.equal(e.get('ally-units').children[0].querySelector('.meter unit-action-meter').children[0].style.height,'0%');
});

test('defeated enemy formation retains ten distinct empty cells and statistics preserve footprints',()=>{
 const {elements:e,send,advance}=setup(true),base=require('../js/database.js').defaults[0],row=u=>[u,...Array(9).fill(null)];
 send({type:'minimajo-preview',loadouts:[row({...base,cooldown:.1,effects:[{type:'damage',amount:999,range:10}]}),row({...base,maxHp:1,space:3,cooldown:120})],skills:[],limits:[10,10]});
 e.get('play').click();advance(1);
 const cells=e.get('enemy-units').children.filter(n=>n.className==='empty-slot');
 assert.equal(cells.length,10);assert.deepEqual(cells.map(n=>n.style.gridColumn),Array.from({length:10},(_,i)=>String(i+1)));
 e.get('battle-result-confirm').click();e.get('battle-stats').click();assert.equal(e.get('enemy-units').children.filter(n=>n.className==='empty-slot').length,7);
 assert.equal(e.get('enemy-units').children.find(n=>n.className==='unit').style.gridColumn,'1 / span 3');
});

test('battle skill art changes with selected skill and falls back for empty or failed images',()=>{
 const {elements:e,send}=setup(true),D=require('../js/database.js'),skill={id:'art',name:'圖案技能',imagePath:'images/skills/test.png',cooldown:1,mode:'all',conditions:[],effects:[]};const loadouts=[[D.defaults[0],...Array(9).fill(null)],[D.defaults[1],...Array(9).fill(null)]],payload={type:'minimajo-preview',loadouts,skills:[skill],limits:[10,10]};send(payload);const image=e.get('skill-art'),fallback=e.get('skill-art-fallback');assert.equal(image.src,skill.imagePath);assert.equal(image.hidden,true);image.onload();assert.equal(image.hidden,false);assert.equal(fallback.hidden,true);image.onerror();assert.equal(image.hidden,true);assert.equal(fallback.hidden,false);send({...payload,skills:[{...skill,imagePath:''}]});assert.equal(image.hidden,true);assert.equal(fallback.hidden,false);image.onload();assert.equal(image.hidden,true);
});

test('battle HUD and details show four-star output totals with live status bonuses',()=>{
 const {elements:e,send,advance}=setup(true);
 const D=require('../js/database.js'),L=require('../js/laws.js');
 const base={...D.defaults[0],attack:20,cooldown:.1,growth:[{damage:3,heal:8},{damage:4},{damage:5,shield:4}],effects:[{type:'status',target:'self',status:'power',amount:6,duration:{kind:'seconds',value:5}}]};
 const ally=L.attach(D.atStars(base,4),[{id:'attack',name:'攻擊',shopPrice:0,shopWeight:0,stats:{damage:2,heal:1,shield:3,statusDurationBonus:2,statusAmountBonus:3}}]);
 const row=u=>[u,...Array(9).fill(null)];
 send({type:'minimajo-preview',loadouts:[row(ally),row({...D.defaults[0],cooldown:120,effects:[]})],skills:[],limits:[10,10]});
 const card=()=>e.get('ally-units').children[0];
 const attackLabel=()=>card().querySelector('.unit-hud').children[3].children[0].attributes['aria-label'];
 assert.equal(attackLabel(),'攻擊力 34');
 e.get('play').click();advance(2);
 assert.equal(attackLabel(),'攻擊力 43');
 card().click();
 const stats=e.get('detail-stats').children;
 for(const [label,total] of [['攻擊力','43'],['治療力','29'],['護盾力','27'],['狀態秒數加成','+2 秒'],['狀態層數加成','+3']]){
  assert.equal(stats[stats.findIndex(n=>n.textContent===label)+1].textContent,total);
 }
});
