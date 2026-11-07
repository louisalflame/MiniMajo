(function(root){
 'use strict';
 const world=c=>({x:c.q+c.r/2,y:c.r*Math.sqrt(3)/2});
 function camera(map,current,angle=0){return {origin:world(map.cells[current]),forward:{x:Math.cos(angle),y:Math.sin(angle)}};}
 function blend(from,to,t){const eased=t*t*(3-2*t);return {x:from.x+(to.x-from.x)*eased,y:from.y+(to.y-from.y)*eased};}
 function project(point,camera){const dx=point.x-camera.origin.x,dy=point.y-camera.origin.y,depth=dx*camera.forward.x+dy*camera.forward.y,side=dy*camera.forward.x-dx*camera.forward.y,scale=3/(3+depth);return {x:400+side*205*scale,y:90+280*scale,scale};}
 function tile(cell,camera){const c=world(cell),depth=p=>(p.x-camera.origin.x)*camera.forward.x+(p.y-camera.origin.y)*camera.forward.y;
  let vertices=Array.from({length:6},(_,i)=>{const angle=(60*i-30)*Math.PI/180;return {x:c.x+.53*Math.cos(angle),y:c.y+.53*Math.sin(angle)};});
  // Clip the ground plane before projection so cells behind the camera never invert.
  const clipped=[];for(let i=0;i<vertices.length;i++){const a=vertices[i],b=vertices[(i+1)%vertices.length],da=depth(a),db=depth(b),inside=da>=-1.6;if(inside)clipped.push(a);if(inside!==(db>=-1.6)){const t=(-1.6-da)/(db-da);clipped.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}
  const center=depth(c)>=-1.6?project(c,camera):{x:-1000,y:-1000,scale:0};return {...center,points:clipped.map(p=>{const v=project(p,camera);return v.x+','+v.y;}).join(' ')};
 }
 function symbol(cell,camera){const c=world(cell),p=project(c,camera),a=project({x:c.x,y:c.y+.01},camera),b=project({x:c.x-.01,y:c.y},camera);if(tile(cell,camera).scale===0)return 'translate(-1000 -1000) scale(0)';return `matrix(${a.x-p.x} ${a.y-p.y} ${b.x-p.x} ${b.y-p.y} ${p.x} ${p.y})`;}
 // Project a textured ground plane with the same perspective as the SVG tile.
 // The image's local origin is the top left of the hex's world-space bounds.
 function groundTransform(cell,camera){
  const center=world(cell),origin={x:center.x-.53*Math.sqrt(3)/2,y:center.y-.53};
  const p=project(origin,camera),{x:fx,y:fy}=camera.forward;
  const dx=fx*p.scale/300,dy=fy*p.scale/300;
  return `matrix3d(${400*dx-2.05*fy*p.scale},${90*dx},0,${dx},${400*dy+2.05*fx*p.scale},${90*dy},0,${dy},0,0,1,0,${p.x},${p.y},0,1)`;
 }
 // Only the first unknown ring supplies silhouettes; never copy event metadata.
 function frontier(map,revealed,camera){
  const directions=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]],result=[];
  for(const [id,cell] of Object.entries(map.cells)){
   if(revealed.has(id))continue;
   const known=directions.map(([q,r])=>`${cell.q+q},${cell.r+r}`).filter(key=>revealed.has(key));
   const c=world(cell),depth=p=>(p.x-camera.origin.x)*camera.forward.x+(p.y-camera.origin.y)*camera.forward.y;
   if(!known.length||depth(c)<-1.07)continue;
   const vertices=Array.from({length:6},(_,i)=>{const a=(60*i-30)*Math.PI/180;return {x:c.x+.53*Math.cos(a),y:c.y+.53*Math.sin(a)};});
   const paths=known.map(key=>{
    const neighbor=world(map.cells[key]);let edge=0,best=Infinity;
    for(let i=0;i<6;i++){const a=vertices[i],b=vertices[(i+1)%6],d=Math.hypot((a.x+b.x)/2-neighbor.x,(a.y+b.y)/2-neighbor.y);if(d<best){edge=i;best=d;}}
    const a=vertices[edge],b=vertices[(edge+1)%6],prev=vertices[(edge+5)%6],next=vertices[(edge+2)%6];
    return [blend(a,prev,.28),a,b,blend(b,next,.28)].map((p,i)=>{const v=project(p,camera);return `${i?'L':'M'}${v.x},${v.y}`;}).join(' ');
   });
   result.push({...project(c,camera),paths});
  }
  return result;
 }
 const api={world,camera,blend,project,tile,symbol,groundTransform,frontier};if(typeof module!=='undefined')module.exports=api;else root.JourneyView=api;
})(globalThis);

