const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/reward-mask-data.js','utf8');
const load=protocol=>{const c=vm.createContext({location:{protocol}});vm.runInContext(source,c);return c.RewardMaskAssets;};
test('file reward masks embed the exact approved PNG bytes for every frame and icon',()=>{
 const masks=load('file:'),files=[];
 for(const job of ['melee','ranged','tank','healer'])for(const rarity of ['sr','ssr','ur'])files.push('assets/ui/card-frames/v3/'+job+'-'+rarity+'-window.png');
 for(const icon of ['human','machine','beast','physical','magic','mental','health','attack','range','posture'])files.push('assets/ui/card-icons/approved-v1/'+icon+'.png');
 for(const file of files){const uri=masks.resolve(file);assert.ok(uri.startsWith('data:image/png;base64,'));assert.deepEqual(Buffer.from(uri.split(',')[1],'base64'),fs.readFileSync(file));}
});
test('HTTP masks and unknown candidate paths keep their original resource URLs',()=>{
 const file='assets/ui/card-icons/approved-v1/health.png',candidate='docs/ui-style/candidate/icon.png';
 for(const protocol of ['http:','https:'])assert.equal(load(protocol).resolve(file),file);
 assert.equal(load('file:').resolve(candidate),candidate);
});
