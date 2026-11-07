/* Short synthesized battle cues. Audio is created only after user interaction. */
(function(root){
 'use strict';
 const cooldowns={hit:.075,shield:.09,knockdown:.18,passive:.2,ultimate:.35,overtime:.3};
 function create({AudioContext=root.AudioContext||root.webkitAudioContext,storage,volume=60}={}){
  let context,master,bus,noise,enabled=true;const voices=new Set(),last=new Map();
  const cleanVolume=value=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(100,value)):60;
  volume=cleanVolume(volume);
  try{storage??=root.localStorage;enabled=storage?.getItem('minimajo.battleAudio.enabled')!=='off';}catch{}
  function stop(){
   for(const voice of voices){try{voice.source.stop();}catch{}voice.source.disconnect();voice.gain.disconnect();}
   voices.clear();last.clear();
  }
  function unlock(){
   if(!enabled||!AudioContext)return;
   try{
    if(!context){
     context=new AudioContext();master=context.createGain();master.gain.value=volume/100*.6;
     bus=context.createDynamicsCompressor();bus.threshold.value=-10;bus.ratio.value=4;
     bus.connect(master);master.connect(context.destination);
     noise=context.createBuffer(1,Math.ceil(context.sampleRate*.15),context.sampleRate);
     const samples=noise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*(1-i/samples.length);
    }
    if(context.state==='suspended')return context.resume().catch(()=>{});
   }catch{context=undefined;}
  }
  function voice({frequency=180,end=frequency,duration=.12,volume=.3,type='sine',delay=0,hiss=false}={}){
   if(voices.size>=12)return;
   const at=context.currentTime+delay,source=hiss?context.createBufferSource():context.createOscillator(),gain=context.createGain();
   if(hiss)source.buffer=noise;
   else{source.type=type;source.frequency.setValueAtTime(frequency,at);source.frequency.exponentialRampToValueAtTime(Math.max(20,end),at+duration);}
   gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+.005);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
   source.connect(gain);gain.connect(bus);const entry={source,gain};voices.add(entry);
   source.onended=()=>{source.disconnect();gain.disconnect();voices.delete(entry);};source.start(at);source.stop(at+duration+.01);
  }
  function play(kind){
   if(!enabled||volume===0||context?.state!=='running'||!(kind in cooldowns))return;
   const now=context.currentTime;if(now-(last.get(kind)??-Infinity)<cooldowns[kind])return;last.set(kind,now);
   // Soft transients, short tails and a bounded voice count keep team-wide hits readable.
   if(kind==='hit'){voice({frequency:155,end:52,duration:.09,volume:.55,type:'triangle'});voice({hiss:true,duration:.045,volume:.16});}
   if(kind==='shield'){voice({frequency:760,end:480,duration:.14,volume:.18});voice({frequency:1130,end:840,duration:.1,volume:.07});}
   if(kind==='knockdown'){voice({frequency:105,end:32,duration:.22,volume:.65,type:'triangle'});voice({hiss:true,duration:.1,volume:.2});}
   if(kind==='passive'){voice({frequency:510,end:680,duration:.16,volume:.1});voice({frequency:765,duration:.14,volume:.07,delay:.045});}
   if(kind==='ultimate'){voice({frequency:90,end:38,duration:.32,volume:.6,type:'triangle'});voice({frequency:240,end:720,duration:.28,volume:.17});voice({frequency:960,end:640,duration:.24,volume:.1,delay:.09});}
   if(kind==='overtime'){voice({frequency:125,end:48,duration:.23,volume:.3});}
  }
  function events(cues){
   const kinds=new Set();
   for(const cue of cues){
    if(cue.type==='hit')kinds.add(cue.shieldOnly?'shield':'hit');
    if(cue.type==='knockdown'||cue.type==='passive')kinds.add(cue.type);
    if(cue.type==='overtimePulse')kinds.add('overtime');
   }
   if(kinds.has('hit'))kinds.delete('shield');
   let count=0;for(const kind of ['knockdown','hit','shield','passive','overtime'])if(kinds.has(kind)&&count++<3)play(kind);
  }
  return {unlock,play,events,stop,get volume(){return volume;},setVolume(value){volume=cleanVolume(value);if(master)master.gain.value=volume/100*.6;if(volume===0)stop();},get enabled(){return enabled;},setEnabled(value){enabled=!!value;try{storage?.setItem('minimajo.battleAudio.enabled',enabled?'on':'off');}catch{}if(!enabled)stop();else unlock();}};
 }
 const api={create};root.BattleAudio=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
