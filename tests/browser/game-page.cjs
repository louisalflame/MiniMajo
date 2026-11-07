// DOM operations address the game scene; input, screenshots and routing use the real page.
const sceneMethods=new Set(['locator','frameLocator','getByRole','getByLabel','getByText','getByTitle','getByTestId','getByAltText','getByPlaceholder','evaluate','evaluateHandle','waitForFunction','waitForSelector']);
function gamePage(page){return new Proxy(page,{get(target,key){
 if(sceneMethods.has(key))return(...args)=>{
  const scene=target.frames().find(frame=>frame.name()==='minimajo-game-scene')??target;
  return scene[key](...args);
 };
 const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
}});}
module.exports={gamePage};
