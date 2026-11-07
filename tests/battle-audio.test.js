const test=require('node:test'),assert=require('node:assert/strict'),Audio=require('../js/battle-audio.js');
function setup(saved){
 const sources=[],contexts=[],values=new Map(saved?[['minimajo.battleAudio.enabled',saved]]:[]);
 const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
 const node=()=>({connect(){},disconnect(){this.disconnected=true;}});
 class Context{
  constructor(){this.state='suspended';this.currentTime=0;this.sampleRate=48000;this.destination=node();contexts.push(this);}
  resume(){this.state='running';return Promise.resolve();}
  createGain(){return {...node(),gain:param()};}
  createDynamicsCompressor(){return {...node(),threshold:param(),ratio:param()};}
  createBuffer(c,n){return {getChannelData:()=>new Float32Array(n)};}
  source(){const s={...node(),frequency:param(),start(){this.started=true;},stop(){this.stopped=true;}};sources.push(s);return s;}
  createOscillator(){return this.source();}createBufferSource(){return this.source();}
 }
 const audio=Audio.create({AudioContext:Context,storage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}});
 return {audio,sources,contexts,values};
}
test('audio is lazy, deduplicates AoE hits, distinguishes shield cues, and caps polyphony',()=>{
 const {audio,sources,contexts}=setup();audio.events([{type:'hit'}]);assert.equal(contexts.length,0);
 audio.unlock();assert.equal(contexts.length,1);
 audio.events(Array.from({length:10},()=>({type:'hit',shieldOnly:true})));assert.equal(sources.length,2);
 audio.events([{type:'hit',shieldOnly:true}]);assert.equal(sources.length,2,'same-kind rapid bursts are throttled');
 contexts[0].currentTime=.2;audio.events([{type:'hit',shieldOnly:false},{type:'hit',shieldOnly:true}]);assert.equal(sources.length,4,'mixed batch uses one HP impact');
 for(let i=0;i<10;i++){contexts[0].currentTime+=1;audio.events([{type:'hit'},{type:'knockdown'},{type:'passive'},{type:'overtimePulse'}]);}
 assert.ok(sources.length<=12,'bounded simultaneous voice allocation');
 audio.stop();assert.ok(sources.every(s=>s.stopped&&s.disconnected));
 audio.play('ultimate');assert.equal(sources.length,15,'stopped voices free their capacity');
});
test('mute stops active sounds, survives a new page, and can unlock again',()=>{
 const {audio,sources,values}=setup();audio.unlock();audio.play('ultimate');assert.equal(sources.length,3);
 audio.setEnabled(false);assert.ok(sources.every(s=>s.stopped));audio.play('hit');assert.equal(sources.length,3);
 assert.equal(values.get('minimajo.battleAudio.enabled'),'off');assert.equal(setup('off').audio.enabled,false);
 audio.setEnabled(true);audio.play('hit');assert.equal(sources.length,5);
});

test('volume is adjustable before and after audio unlock, including zero',()=>{
 const {audio,sources}=setup();assert.equal(audio.volume,60);audio.setVolume(0);audio.unlock();audio.play('hit');assert.equal(sources.length,0);
 audio.setVolume(100);audio.play('hit');assert.equal(sources.length,2);audio.setVolume(0);assert.ok(sources.every(s=>s.stopped));
 audio.setVolume('bad');assert.equal(audio.volume,60);
});
test('unavailable or rejected Web Audio and blocked preference storage do not interrupt battle',()=>{
 const audio=Audio.create({AudioContext:null,storage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}});
 assert.doesNotThrow(()=>{audio.unlock();audio.play('hit');audio.setEnabled(false);audio.setEnabled(true);audio.stop();});
 const failed=Audio.create({AudioContext:class{constructor(){throw Error('unavailable');}}});assert.doesNotThrow(()=>failed.unlock());
});
