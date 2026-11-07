const {test}=require('node:test'),assert=require('node:assert/strict');
const {loadImages}=require('../js/asset-preloader.js');
test('image preload waits for every decode, bounds concurrency, and reports failures without skipping remaining images',async()=>{
 let active=0,max=0,finished=0,release;const gate=new Promise(resolve=>release=resolve),progress=[];
 const task=loadImages(['a','b','a','bad','c'],{concurrency:2,onProgress:s=>progress.push(s),load:async url=>{active++;max=Math.max(max,active);await gate;active--;finished++;if(url==='bad')throw Error('offline');}});
 await Promise.resolve();assert.equal(finished,0);assert.equal(active,2);release();
 const failed=await task;assert.deepEqual(failed,['bad']);assert.equal(finished,4);assert.equal(max,2);
 assert.deepEqual(progress.at(-1),{completed:4,total:4,failed:1});
 const retried=[];assert.deepEqual(await loadImages(failed,{load:async url=>retried.push(url)}),[]);assert.deepEqual(retried,['bad']);
});
