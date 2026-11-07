'use strict';
importScripts('config.js','enums.js','character-art.js','statuses.js','effects.js','skills.js','database.js','laws.js','echo-levels.js','expedition.js','enemy-teams.js','battle.js','enemy-tournament.js');
self.onmessage=event=>{
 try{
  const run=event.data;Statuses.configure(run.statusLibrary);
  let batch=[],last=performance.now();
  for(const match of EnemyTournament.schedule(run)){
   batch.push(EnemyTournament.simulate(run,match));
   if(performance.now()-last>=100||batch.length>=100){self.postMessage({type:'progress',batch});batch=[];last=performance.now();}
  }
  self.postMessage({type:'done',batch});
 }catch(error){self.postMessage({type:'error',message:error.message});}
};
