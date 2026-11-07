(function(root){
 const Effects=typeof module!=='undefined'?require('./effects.js'):root.Effects,Skills=typeof module!=='undefined'?require('./skills.js'):root.SkillDB;
 const Status=typeof module!=='undefined'?require('./statuses.js'):root.Statuses;
 const Config=typeof module!=='undefined'?require('./config.js'):root.GameConfig;
 const alive=u=>!!u&&u.hp>0;
 function capacity(items,limit=3){const used=items.filter(Boolean).reduce((n,x)=>n+(x.space??1),0);return {used,limit,valid:Number.isInteger(limit)&&limit>=1&&limit<=99&&items.filter(Boolean).every(x=>Number.isInteger(x.space??1)&&(x.space??1)>=1&&(x.space??1)<=99)&&used<=limit};}
 function skillFor(items,skills){return Skills.choose(items,skills);}
 function create(loadouts,skills,limits=[3,3],options={}){const config=Config.validate(options.config??Config.defaults);const s={config,activeSkillsEnabled:options.activeSkillsEnabled!==false,allySkillsEnabled:options.allySkillsEnabled!==false,footprints:!!options.footprints,tick:0,started:false,blocked:loadouts.some((a,i)=>!capacity(a,limits[i]).valid),done:false,winner:null,skillDefinitions:structuredClone(skills||Skills.defaults),enemySkillDefinition:options.enemySkill?structuredClone(options.enemySkill):null,events:[],feedback:[],teams:loadouts.map((a,i)=>{const items=a.map((x,slot)=>x?{...structuredClone(x),slot,startSlot:slot,battleId:i+':'+slot,stats:{damage:0,shield:0,heal:0,actions:0},maxHp:x.maxHp??180,hp:x.maxHp??180,weakDuration:x.weakDuration??config.weakDuration,shield:0,posture:0,statuses:[],weakUntil:0,moveDistance:x.moveDistance??1,nextAction:Math.round(x.cooldown*10)}:null);const skill=i===0?skillFor(items,skills):options.enemySkill?skillFor(items,[options.enemySkill]):null;return {capacity:capacity(a,limits[i]),items,units:items.filter(Boolean),skillReady:options.activeSkillsEnabled!==false&&(i!==0||options.allySkillsEnabled!==false)&&skill?.enabled?Math.round(skill.cooldown*10):0,skill};})};if(s.footprints)s.teams.forEach(t=>{t.layoutValid=layoutValid(t.items);if(!t.layoutValid)s.blocked=true;});return s;}
 function log(s,event){s.events.push({tick:s.tick,...event});s.events=s.events.slice(-12);}
 function record(s,actor,target,type,amount){if(!['damage','heal','shield'].includes(type)||amount<=0)return;if(actor)actor.stats[type]+=amount;s.feedback.push({target:target.battleId,slot:target.slot,team:s.teams[1].units.includes(target)?1:0,type,amount});if(type==='heal'||type==='shield')cue(s,target,type);}
 function source(s,id){return s.teams.flatMap(t=>t.units).find(u=>u.battleId===id);}
 // Presentation-only cues use stable runtime identities, independent of log truncation and movement.
 function cue(s,unit,type,detail={}){(s.visuals??=[]).push({target:unit.battleId,type,...detail});}
 // Events are queued after state changes. Each ordinary action (or status pulse)
 // shares one chain; every attached passive may execute at most once in it.
 function lawEvent(s,when,subject,causer=null,gainedStatus=null){
  if(!subject)return;
  const subjectTeam=s.teams.findIndex(t=>t.units.includes(subject));
  for(let team=0;team<2;team++)for(const owner of s.teams[team].units){
   if(['normalDown','normalKill'].includes(when)&&owner!==causer)continue;
   if(!alive(owner)&&!(when==='death'&&owner===subject))continue;
   [{name:'角色被動',passives:owner.passives??[],innate:true},...(owner.laws??[])].forEach((law,li)=>(law.passives??[]).forEach((p,pi)=>{
    const relation=p.subject?.relation??'self';
    if(p.when!==when)return;
    if((when==='playerSkill'||when==='allySkillResolved')&&team!==subjectTeam)return;
    if(when==='statusGained'){
     const condition=p.statusCondition;
     if(condition?.mode==='specified'&&condition.status!==gainedStatus)return;
     if(['positive','negative'].includes(condition?.mode)&&Status.classification(gainedStatus)!==condition.mode)return;
    }
    if(when!=='playerSkill'&&((relation==='self'&&owner!==subject)||(relation==='ally'&&team!==subjectTeam)||(relation==='enemy'&&team===subjectTeam)))return;
    if(when!=='playerSkill'&&!(p.subject?.conditions??[]).every(c=>subject[c.field]===c.value))return;
    (s.lawQueue??=[]).push({team,owner,law,eventAnchors:snapshot(s,[subject]),passive:p,key:owner.battleId+':'+li+':'+pi,dying:when==='death'&&owner===subject});
   }));
  }
 }
 function drainLaws(s){
  if(s.lawDraining)return;
  const root=!s.lawUsed;if(root)s.lawUsed=new Set();s.lawDraining=true;
  try{
   let cursor=0;const queue=s.lawQueue??=[];
   while(cursor<queue.length){
    const {team,owner,law,eventAnchors,passive,key,dying}=queue[cursor++];
    if(s.lawUsed.has(key)||(!alive(owner)&&!dying)||(!dying&&Status.active(owner,'stun')))continue;
    s.lawUsed.add(key);
    cue(s,owner,'passive');
    log(s,{team,name:owner.name,type:'status',amount:'',detail:law.innate?'角色被動觸發':'法則「'+law.name+'」觸發'});
    let enemy=primaryEnemy(s,team,owner,passive.effects),mainSucceeded=false,anchors=[];
    for(let i=0;i<passive.effects.length;i++){
     if((!alive(owner)&&!dying)||(!dying&&Status.active(owner,'stun')))break;
     if(!alive(enemy))enemy=primaryEnemy(s,team,owner,passive.effects);
     const e=passive.effects[i],targets=Effects.eligible(e,s,team,owner,enemy)?recipients(s,team,owner,e,enemy,false,anchors,eventAnchors):[];
     if(i===0&&!targets.length)break;if(i>0&&!mainSucceeded)break;
     let applied=false;
     if(i===0)anchors=snapshot(s,targets);
    applied=applyGroup(s,team,owner,e,targets,enemy,law.name,false,dying,law.innate===true);
     if(i===0)mainSucceeded=applied;
     if(['swap','jump'].includes(Effects.searchType(e)))enemy=primaryEnemy(s,team,owner,passive.effects);
    }
   }
   queue.length=0;
  }finally{s.lawDraining=false;if(root)delete s.lawUsed;}
 }
 function death(s,team,u){if(alive(u)||u.deathAnnounced)return;u.deathAnnounced=true;u.statuses=[];cue(s,u,'death');log(s,{team,name:u.name,type:'status',detail:'死亡',amount:''});lawEvent(s,'death',u);}
 function choose(s,list){if(list.length===1)return list[0];return list[Math.min(list.length-1,Math.floor((s.random||Math.random)()*list.length))];}
 function width(s,u){return s.footprints?(u.space??1):1;}
 function distance(s,a,b){return 1+Math.max(0,b.slot-(a.slot+width(s,a)-1),a.slot-(b.slot+width(s,b)-1));}
 function layoutValid(items){const occupied=new Set();for(let slot=0;slot<items.length;slot++){const u=items[slot];if(!u)continue;const w=u.space??1;if(!Number.isInteger(w)||w<1||slot+w>items.length)return false;for(let n=slot;n<slot+w;n++){if(occupied.has(n))return false;occupied.add(n);}}return true;}
 function target(s,team,actor,range=1){const candidates=s.teams[1-team].items.filter(alive).filter(x=>distance(s,actor,x)<=range);if(!candidates.length)return null;const nearest=Math.min(...candidates.map(x=>distance(s,actor,x)));return choose(s,candidates.filter(x=>distance(s,actor,x)===nearest));}
 function tauntTarget(s,actor,candidates,range){
  const taunts=candidates.filter(u=>Status.active(u,'taunt')&&distance(s,actor,u)<=range);
  if(!taunts.length)return null;
  const nearest=Math.min(...taunts.map(u=>distance(s,actor,u)));
  return choose(s,taunts.filter(u=>distance(s,actor,u)===nearest));
 }
 function move(s,team,actor){const own=s.teams[team].items,rule=Effects.movement(actor.movement),enemies=selectRecipients(s,team,actor,{type:'move'}, {...rule,range:'unlimited'},true);if(!enemies.length)return false;
 const w=width(s,actor),nearest=slot=>Math.min(...enemies.map(x=>distance(s,{...actor,slot},x))),before=nearest(actor.slot),choices=[];
 for(const direction of [-1,1])for(let n=1;n<=actor.moveDistance;n++){
  const slot=actor.slot+direction*n;
  if(slot<0||slot+w>own.length||own.some(u=>alive(u)&&u!==actor&&slot<u.slot+width(s,u)&&slot+w>u.slot))break;
  if(nearest(slot)<before)choices.push(slot);
 }
 if(!choices.length)return false;const best=Math.min(...choices.map(nearest)),slot=choose(s,choices.filter(x=>nearest(x)===best)),from=actor.slot;
 own[from]=null;
 // Dead characters remain in units for the result, but no longer occupy battlefield cells.
 if(s.footprints)own.forEach((u,i)=>{if(u&&!alive(u)&&slot<u.slot+width(s,u)&&slot+w>u.slot)own[i]=null;});
 own[slot]=actor;actor.slot=slot;cue(s,actor,'relocate',{kind:'move',fromSlot:from,toSlot:slot});log(s,{team,name:actor.name,type:'status',amount:'',detail:'移動 '+(from+1)+' → '+(slot+1)+'（消耗行動）'});lawEvent(s,'move',actor);drainLaws(s);return true;}
 function finish(s){s.teams.forEach((t,i)=>t.skill=i===0?skillFor(t.items.map(x=>alive(x)?x:null),s.skillDefinitions):s.enemySkillDefinition?skillFor(t.items.map(x=>alive(x)?x:null),[s.enemySkillDefinition]):null);const lost=s.teams.map(t=>!t.units.some(alive));if(lost.some(Boolean)){s.done=true;s.winner=lost.every(Boolean)||!lost.some(Boolean)?'draw':lost[0]?1:0;}}
 function canSwap(s,team,a,b){if(a===b||!alive(a)||!alive(b)||!s.teams[team].units.includes(a)||!s.teams[team].units.includes(b))return false;const units=s.teams[team].units.filter(alive),cells=new Set();for(const u of units){const slot=u===a?b.slot:u===b?a.slot:u.slot,w=width(s,u);if(slot<0||slot+w>s.teams[team].items.length)return false;for(let n=slot;n<slot+w;n++){if(cells.has(n))return false;cells.add(n);}}return true;}
 function swap(s,team,a,b){if(!canSwap(s,team,a,b))return false;const items=s.teams[team].items,from=a.slot;items[a.slot]=null;items[b.slot]=null;a.slot=b.slot;b.slot=from;items.forEach((u,i)=>{if(u&&!alive(u)&&[a,b].some(v=>v.slot<u.slot+width(s,u)&&v.slot+width(s,v)>u.slot))items[i]=null;});items[a.slot]=a;items[b.slot]=b;cue(s,a,'relocate',{kind:'swap',fromSlot:from,toSlot:a.slot});cue(s,b,'relocate',{kind:'swap',fromSlot:a.slot,toSlot:b.slot});log(s,{team,name:a.name,type:'status',amount:'',detail:'與 '+b.name+' 互換位置'});lawEvent(s,'move',a);lawEvent(s,'move',b);lawEvent(s,'swapInitiated',a);lawEvent(s,'swapReceived',b);lawEvent(s,'swapped',a);drainLaws(s);return true;}
 function canJump(s,team,actor,enemy){
  if(!alive(actor)||!alive(enemy)||!s.teams[team].units.includes(actor)||!s.teams[1-team].units.includes(enemy)||actor.slot===enemy.slot)return false;
  const slot=enemy.slot,w=width(s,actor);
  return slot>=0&&slot+w<=s.teams[team].items.length&&!s.teams[team].units.some(u=>alive(u)&&u!==actor&&slot<u.slot+width(s,u)&&slot+w>u.slot);
 }
 function jump(s,team,actor,enemy){
  if(!canJump(s,team,actor,enemy))return false;
  const items=s.teams[team].items,from=actor.slot;items[from]=null;actor.slot=enemy.slot;
  items.forEach((u,i)=>{if(u&&!alive(u)&&actor.slot<u.slot+width(s,u)&&actor.slot+width(s,actor)>u.slot)items[i]=null;});
  items[actor.slot]=actor;cue(s,actor,'relocate',{kind:'jump',fromSlot:from,toSlot:actor.slot});log(s,{team,name:actor.name,type:'status',amount:'',detail:'跳到 '+enemy.name+' 對面（'+(from+1)+' → '+(actor.slot+1)+'）'});lawEvent(s,'move',actor);drainLaws(s);return true;
 }
 function jumpPlan(s,team,actor,enemy,swapFallback){
  if(!alive(actor)||!alive(enemy)||!s.teams[team].units.includes(actor)||!s.teams[1-team].units.includes(enemy))return null;
  if(distance(s,actor,enemy)===1)return {kind:'stay'};
  if(canJump(s,team,actor,enemy))return {kind:'jump'};
  if(!swapFallback)return null;
  const ally=s.teams[team].items[enemy.slot];
  return canSwap(s,team,actor,ally)?{kind:'swap',ally}:null;
 }
 function selectRecipients(s,team,actor,e,t,moving=false,ignoreRange=false,anchors=[],eventAnchors=[],automatic=false){
  const type=Effects.searchType(e);let candidates=s.teams[t.side==='ally'?team:1-team].items.filter(alive);
  if(t.excludeSelf)candidates=candidates.filter(u=>u!==actor);
  if(['main','event'].includes(t.base)){
   const references=t.base==='event'?eventAnchors:anchors;
   candidates=candidates.filter(u=>references.some(a=>{
    if(a.team!==(t.side==='ally'?team:1-team))return false;
    const center=u===a.unit,left=u.slot+width(s,u)===a.slot,right=a.slot+a.width===u.slot;
    return t.mode==='target'?center:t.mode==='left'?left:t.mode==='right'?right:t.mode==='neighbors'?!center&&(left||right):center||left||right;
   }));
   return candidates.filter(u=>Effects.matchAll(u,t.targetCond,t.targetCondMode,s.tick));
  }
  if(moving)candidates=candidates.filter(u=>u!==actor);
  if(!moving&&!ignoreRange&&!['jump','swap'].includes(type)&&Effects.usesRange(t))candidates=candidates.filter(u=>distance(s,actor,u)<=(actor.attackRange??e.range??1));
  if(t.mode==='opposite')candidates=candidates.filter(u=>t.side==='enemy'&&distance(s,actor,u)===1);
  if(t.mode==='self')candidates=candidates.filter(u=>u===actor);
  if(['allLeft','allRight','leftmost','rightmost'].includes(t.mode))candidates=candidates.filter(u=>u!==actor);
  if(t.mode==='allLeft')candidates=candidates.filter(u=>u.slot+width(s,u)<=actor.slot);
  if(t.mode==='allRight')candidates=candidates.filter(u=>u.slot>=actor.slot+width(s,actor));
  if(t.mode==='adjacent')candidates=candidates.filter(u=>u===actor||u.slot+width(s,u)===actor.slot||actor.slot+width(s,actor)===u.slot);
  candidates=candidates.filter(u=>Effects.matchAll(u,t.targetCond,t.targetCondMode,s.tick));
  if(type==='jump'){
   const jumpEffect=Effects.parts(e).find(part=>part.type==='jump');
   candidates=candidates.filter(u=>jumpPlan(s,team,actor,u,jumpEffect?.swapFallback));
  }
  if(type==='swap')candidates=candidates.filter(u=>canSwap(s,team,actor,u));
  if(automatic&&!moving&&t.side==='enemy'&&!['jump','swap'].includes(type)&&['primary','lowestHp','lowestHpRatio','highestPosture','random'].includes(t.mode)){const forced=tauntTarget(s,actor,candidates,actor.attackRange??e.range??1);if(forced)return [forced];}
  if(!candidates.length)return [];
  if(['all','self','adjacent','allLeft','allRight'].includes(t.mode))return candidates;
  if(t.mode==='leftmost')return [candidates.reduce((a,b)=>a.slot<b.slot?a:b)];
  if(t.mode==='rightmost')return [candidates.reduce((a,b)=>a.slot+width(s,a)>b.slot+width(s,b)?a:b)];
  if(t.mode==='random')return [choose(s,candidates)];
  const score=u=>t.mode==='lowestHp'?u.hp:t.mode==='lowestHpRatio'?u.hp/u.maxHp:t.mode==='highestPosture'?-u.posture:distance(s,actor,u);
  const best=Math.min(...candidates.map(score)),ties=candidates.filter(u=>score(u)===best);
  return [t.mode==='primary'?choose(s,ties):ties[0]];
 }
 function recipients(s,team,actor,e,primary,ignoreRange=false,anchors=[],eventAnchors=[],automatic=false){
  if(automatic&&!e.actions&&!e.targets&&!e.targeting&&!['swap','jump'].includes(e.type)&&Effects.targeting(e).side==='enemy'){const forced=tauntTarget(s,actor,s.teams[1-team].items.filter(alive),actor.attackRange??e.range??1);if(forced)return [forced];}
  // Legacy effects share the action's original enemy; explicit groups search independently.
  if(!e.actions&&!e.targets&&!e.targeting&&!['swap','jump'].includes(e.type))return Effects.targeting(e).side==='enemy'?(alive(primary)&&(ignoreRange||distance(s,actor,primary)<=(actor.attackRange??e.range??1))?[primary]:[]):alive(actor)?[actor]:[];
  return [...new Set(Effects.selectors(e).flatMap(t=>selectRecipients(s,team,actor,e,t,false,ignoreRange,anchors,eventAnchors,automatic)))];
 }
 function primaryEnemy(s,team,actor,effects,ignoreRange=false){return target(s,team,actor,ignoreRange?999:Math.max(1,...effects.flatMap(e=>Effects.selectors(e).map(t=>Effects.usesRange(t)?actor.attackRange??e.range??1:999))));}
 function knockdown(s,team,u,actor=null,automatic=false){if(alive(u)&&u.weakUntil<=s.tick&&u.posture>=s.config.postureLimit){u.weakUntil=s.tick+Math.round(u.weakDuration*10);cue(s,u,'knockdown');log(s,{team,name:u.name,type:'status',detail:'倒地 '+u.weakDuration+' 秒',amount:''});lawEvent(s,'down',u);if(automatic&&actor&&s.teams[1-team].units.includes(actor))lawEvent(s,'normalDown',u,actor);}}
 function damage(s,team,actor,recipient,amount,{automatic=false,reaction=false}={}){
  const hostile=s.teams[1-team].units.includes(recipient),recipientTeam=hostile?1-team:team;
  const down=recipient.weakUntil>s.tick,posture=Math.ceil(amount*s.config.posturePercent/100);
  // Reactions use the recipient's pre-hit rules, but only living recipients react.
  const counter=hostile&&automatic&&!reaction&&amount>0?Status.sum(recipient,'counter'):0;
  const rage=hostile&&!reaction&&amount>0?Status.sum(recipient,'rage'):0;
  amount=Math.round(amount*(down?s.config.downMultiplier:1));
  const blocked=Math.min(recipient.shield,amount);recipient.shield-=blocked;recipient.hp=Math.max(0,recipient.hp-amount+blocked);
  record(s,actor,recipient,'damage',amount);
  if(amount>0){cue(s,recipient,'hit',{shieldOnly:blocked>=amount});if(reaction&&actor)cue(s,actor,'attack');}
  if(hostile&&amount>0){
   lawEvent(s,'attacked',recipient);
   if(automatic&&!reaction)lawEvent(s,'normalHit',actor);
  }
  if(!alive(recipient)){death(s,recipientTeam,recipient);if(automatic&&hostile&&!reaction)lawEvent(s,'normalKill',recipient,actor);return;}
  if(!reaction&&!down){recipient.posture=Math.min(s.config.postureLimit,recipient.posture+posture);knockdown(s,recipientTeam,recipient,actor,automatic&&!reaction);}
  if(rage>0){recipient.nextAction=Math.max(s.tick,recipient.nextAction-Math.round(rage*10));log(s,{team:recipientTeam,name:recipient.name,type:'status',detail:'受擊進度 +'+rage+' 秒',amount:''});}
  if(counter>0&&alive(actor)){
   const reflected=Math.max(0,counter+Status.sum(recipient,'power')-Status.sum(recipient,'weakness'));
   damage(s,recipientTeam,recipient,actor,reflected,{reaction:true});log(s,{team:recipientTeam,name:recipient.name,type:'damage',amount:reflected,detail:'反擊 → '+actor.name});
  }
 }
 function applyEffect(s,team,actor,e,recipient,enemy,name,automatic,allowAttack=automatic){
  if(e.type==='jump'){
   const plan=jumpPlan(s,team,actor,recipient,e.swapFallback);
   if(!plan)return false;
   if(plan.kind==='stay')return true;
   if(plan.kind==='swap')return swap(s,team,actor,plan.ally);
   return jump(s,team,actor,recipient);
  }
  if(e.type==='swap')return swap(s,team,actor,recipient);
  if(e.type==='advanceSkill'){
   const targetTeam=s.teams.findIndex(t=>t.units.includes(recipient));
   const target=s.teams[targetTeam];
   if(!s.activeSkillsEnabled||!target?.skill?.enabled)return false;
   const before=target.skillReady;
   target.skillReady=Math.max(s.tick,before-Math.round(e.amount*10));
   log(s,{team,name,type:'advanceSkill',amount:Math.max(0,before-target.skillReady)/10,detail:'→ '+(targetTeam===0?'我方':'敵方')+'主動技能'});
   return true;
  }
  if(e.type==='advance'){
   recipient.nextAction=Math.max(s.tick,recipient.nextAction-Math.round(e.amount*10));
   log(s,{team,name,type:'advance',amount:e.amount,detail:'→ '+recipient.name+'（'+(recipient.slot+1)+'位）'});return true;
  }
  const hostile=s.teams[1-team].units.includes(recipient);
  if(automatic&&hostile){
   if(s.evaded?.has(recipient))return true;
   if(Status.active(recipient,'dodge')){recipient.statuses=recipient.statuses.filter(x=>Status.amount(x,'dodge',recipient)<=0);s.evaded?.add(recipient);s.feedback.push({target:recipient.battleId,slot:recipient.slot,team:1-team,type:'miss'});log(s,{team:1-team,name:recipient.name,type:'status',amount:'',detail:'閃避普通攻擊'});lawEvent(s,'dodged',recipient);drainLaws(s);return true;}
  }
  if(e.type==='cleanse'){
   let oldest=null;
   for(const status of recipient.statuses??[]){
    if(Status.classification(status.kind)!=='negative')continue;
    if(!oldest||status.appliedAt<oldest.appliedAt)oldest=status;
   }
   if(oldest){
    recipient.statuses=recipient.statuses.filter(status=>status!==oldest);
    log(s,{team,name,type:'status',detail:'→ '+recipient.name+' 解除 '+Status.names[oldest.kind],amount:''});
   }
   return true;
  }
  let amount=Effects.amount(e,s,team,{self:actor,enemy:hostile?recipient:enemy,target:recipient,allowAttack});
  if(e.type==='status'){
   if(!Status.fixed(e.status))amount=Math.max(0,Math.min(10000,amount+(actor.statusAmountBonus??0)));
   const duration=Status.normalizeDuration(e.status,e.duration);
   const statusEffect=duration.kind==='seconds'?{...e,duration:{kind:'seconds',value:Math.max(1,Math.min(999,Math.round((duration.value+(actor.statusDurationBonus??0))*10)/10))}}:e;
   Status.apply(recipient,statusEffect,amount,s.tick).sourceId=actor.battleId;
   log(s,{team,name,type:'status',amount:'',detail:'→ '+recipient.name+' '+Status.names[e.status]});
   lawEvent(s,'statusGained',recipient,null,e.status);
   drainLaws(s);
   return true;
  }
  if(e.type==='damage')damage(s,team,actor,recipient,amount,{automatic});
  if(e.type==='posture'&&recipient.weakUntil<=s.tick){recipient.posture=Math.min(s.config.postureLimit,recipient.posture+amount);knockdown(s,hostile?1-team:team,recipient,actor,automatic);}
  if(e.type==='shield')recipient.shield+=amount;
  if(e.type==='heal'){amount=Math.min(amount,recipient.maxHp-recipient.hp);recipient.hp+=amount;}
  if(e.type==='restore'){amount=recipient.weakUntil>s.tick?0:Math.min(amount,recipient.posture);recipient.posture-=amount;}
  if(e.type!=='damage')record(s,actor,recipient,e.type,amount);
  if(amount>0&&['heal','shield'].includes(e.type)){lawEvent(s,e.type,actor);lawEvent(s,e.type==='heal'?'healed':'shielded',recipient);}
  log(s,{team,name,type:e.type,amount,detail:'→ '+recipient.name+'（'+(recipient.slot+1)+'位）'});drainLaws(s);return true;
 }
 function snapshot(s,targets){return targets.map(unit=>({unit,slot:unit.slot,width:width(s,unit),team:s.teams.findIndex(t=>t.units.includes(unit))}));}
 function applyGroup(s,team,actor,group,targets,enemy,name,automatic,dying=false,allowAttack=automatic){
  let applied=false;
  for(const action of Effects.parts(group)){
   const advancedTeams=new Set();
   for(const recipient of targets){
    if((!alive(actor)&&!dying)||(!dying&&Status.active(actor,'stun')))return applied;
    if(!alive(recipient))continue;
    if(action.type==='damage')cue(s,actor,'attack');
    if(action.type==='advanceSkill'){
     const targetTeam=s.teams.findIndex(t=>t.units.includes(recipient));
     if(advancedTeams.has(targetTeam))continue;
     advancedTeams.add(targetTeam);
    }
    applied=applyEffect(s,team,actor,action,recipient,enemy,name,automatic,allowAttack)||applied;
   }
  }
  return applied;
 }
 function resolve(s,actions){
  for(const {team,actor,effects,name,automatic=false,playerSkill=false} of actions){
   if(!alive(actor)||Status.active(actor,'stun'))continue;
   s.lawUsed=new Set();s.evaded=new Set();
   if(automatic){actor.stats.actions++;actor.nextAction+=Math.round(actor.cooldown*10);lawEvent(s,'action',actor);drainLaws(s);}
   if(playerSkill){lawEvent(s,'playerSkill',actor);drainLaws(s);}
   let enemy=primaryEnemy(s,team,actor,effects),mainSucceeded=false,anchors=[];
   for(let index=0;index<effects.length;index++){
    if(!alive(actor)||Status.active(actor,'stun'))break;
    if(!alive(enemy))enemy=primaryEnemy(s,team,actor,effects);
    const e=effects[index],targets=Effects.eligible(e,s,team,actor,enemy)?recipients(s,team,actor,e,enemy,false,anchors,[],automatic):[];
    if(index===0&&!targets.length){if(automatic&&!move(s,team,actor))log(s,{team,name,type:'status',detail:'主效果無法執行，無可用移動路徑',amount:''});break;}
    if(index>0&&!mainSucceeded)break;
    let applied=false;
    if(index===0)anchors=snapshot(s,targets);
    applied=applyGroup(s,team,actor,e,targets,enemy,name,automatic);
    if(index===0)mainSucceeded=applied;
    if(['swap','jump'].includes(Effects.searchType(e)))enemy=primaryEnemy(s,team,actor,effects);
   }
   if(playerSkill)lawEvent(s,'allySkillResolved',actor);
   drainLaws(s);delete s.lawUsed;delete s.evaded;finish(s);if(s.done)break;
  }
  finish(s);
 }
 function canCast(s,i){if(i!==0&&i!==1)return false;const t=s.teams[i];return s.activeSkillsEnabled!==false&&(i!==0||s.allySkillsEnabled!==false)&&s.started&&!s.blocked&&!s.done&&t.units.some(alive)&&!Status.active(t.items.find(alive),'stun')&&t.skill?.enabled===true&&s.tick>=t.skillReady;}
 function cast(s,i){if(!canCast(s,i))return false;const t=s.teams[i],actor=t.items.find(alive);t.skillReady=s.tick+Math.round(t.skill.cooldown*10);resolve(s,[{team:i,actor,name:t.skill.name,effects:t.skill.effects,playerSkill:true}]);return true;}
 function tickStatuses(s){
  s.teams.forEach((t,team)=>t.units.filter(alive).forEach(u=>{
   const frozen=Status.active(u,'stun');
   const downSpeed=u.weakUntil>s.tick?1-s.config.downSlowPercent/100:1;
   const speed=Status.speed(u)*downSpeed;
   u.nextAction+=frozen?1:1-speed;
   if(u.weakUntil&&u.weakUntil<=s.tick){u.weakUntil=0;u.posture=0;}
   for(const x of [...u.statuses]){
    if(!alive(u))break;
    if(s.tick>=x.nextPulse&&(x.until===null||x.nextPulse<=x.until)){
     x.nextPulse+=10;
     for(const rule of x.rules??Status.rules(x.kind)){
      if(!alive(u))break;
      const kind=rule.behavior;
      if(!['poison','regen','confusion','calm'].includes(kind))continue;
      let amount=Status.amount({...x,rules:[rule]},kind,u);
      if(kind==='poison'){u.hp=Math.max(0,u.hp-amount);record(s,source(s,x.sourceId),u,'damage',amount);}
      if(kind==='regen'){amount=Math.min(amount,u.maxHp-u.hp);u.hp+=amount;record(s,source(s,x.sourceId),u,'heal',amount);}
      if(kind==='confusion'&&u.weakUntil<=s.tick){u.posture=Math.min(s.config.postureLimit,u.posture+amount);knockdown(s,team,u);}
      if(kind==='calm'&&u.weakUntil<=s.tick)u.posture=Math.max(0,u.posture-amount);
      if(amount)log(s,{team,name:u.name,type:'status',detail:Status.names[x.kind]});
      if(!alive(u))death(s,team,u);
      if(kind==='regen'&&amount>0){const healer=source(s,x.sourceId);if(healer)lawEvent(s,'heal',healer);lawEvent(s,'healed',u);}
      drainLaws(s);
     }
    }
    if(alive(u)&&Status.amount(x,'stun',u)>0&&x.remaining!==null&&s.tick>=x.skipAt){x.remaining--;x.skipAt+=Math.round(u.cooldown*10);}
   }
   u.statuses=u.statuses.filter(x=>(x.until===null||x.until>s.tick)&&(x.remaining===null||x.remaining>0));
  }));
 }
 function overtime(s){const amount=Config.damage(s.config,s.tick);if(!amount)return;(s.visuals??=[]).push({type:'overtimePulse'});s.teams.forEach((t,team)=>t.units.filter(alive).forEach(u=>{record(s,null,u,'damage',amount);u.hp=Math.max(0,u.hp-amount);if(!u.hp)death(s,team,u);log(s,{team,name:u.name,type:'damage',amount,detail:'超時傷害（穿盾）'});}));drainLaws(s);}
 function step(s){if(s.done||s.blocked)return [];s.started=true;finish(s);if(s.done)return [];s.tick++;overtime(s);finish(s);if(s.done)return s.events;tickStatuses(s);finish(s);if(s.done)return s.events;const actions=[];
 const due=s.teams.flatMap((t,i)=>t.units.filter(u=>alive(u)&&!Status.active(u,'stun')&&s.tick+1e-8>=u.nextAction).map(actor=>({team:i,actor,eligible:[...actor.statuses],actionCount:actor.stats.actions})));
 due.sort((a,b)=>((a.team+s.tick)%2)-((b.team+s.tick)%2)||a.actor.slot-b.actor.slot);
 for(const {team,actor} of due)actions.push({team,actor,name:actor.name,effects:actor.effects,automatic:true});resolve(s,actions);due.forEach(({actor,eligible,actionCount})=>{if(actor.stats.actions>actionCount)Status.actionEnd(actor,eligible);});return s.events;
 }
 const api={capacity,create,step,cast,canCast,skillFor,target,move,distance,layoutValid,recipients,canSwap,swap,canJump,jump};if(typeof module!=='undefined')module.exports=api;else root.Battle=api;
})(globalThis);

