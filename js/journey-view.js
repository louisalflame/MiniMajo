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
 // SVG has affine image transforms, so tessellate the ground into small
 // triangles. Both texture and hex clipping then stay in SVG coordinates,
 // without a foreignObject/CSS 3D compositing boundary under phone rotation.
 function groundMesh(cell,camera){
  const center=world(cell),origin={x:center.x-.53*Math.sqrt(3)/2,y:center.y-.53};
  const width=53*Math.sqrt(3),height=106,result=[],steps=4;
  const projected=p=>project({x:origin.x+p.x/100,y:origin.y+p.y/100},camera);
  for(let row=0;row<steps;row++)for(let col=0;col<steps;col++){
   const x=col*width/steps,y=row*height/steps,w=width/steps,h=height/steps;
   for(const local of [[{x,y},{x:x+w,y},{x:x+w,y:y+h}],[{x,y},{x:x+w,y:y+h},{x,y:y+h}]]){
    const [a,b,c]=local,[pa,pb,pc]=local.map(projected),det=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);
    const ax=((pb.x-pa.x)*(c.y-a.y)-(pc.x-pa.x)*(b.y-a.y))/det;
    const ay=((pb.y-pa.y)*(c.y-a.y)-(pc.y-pa.y)*(b.y-a.y))/det;
    const bx=((pc.x-pa.x)*(b.x-a.x)-(pb.x-pa.x)*(c.x-a.x))/det;
    const by=((pc.y-pa.y)*(b.x-a.x)-(pb.y-pa.y)*(c.x-a.x))/det;
    const matrix=[ax,ay,bx,by,pa.x-ax*a.x-bx*a.y,pa.y-ay*a.x-by*a.y];
    // A tiny internal overlap hides raster sampling seams, while the parent
    // hex clip keeps the original outer contour exact.
    const mid={x:(a.x+b.x+c.x)/3,y:(a.y+b.y+c.y)/3};
    const points=local.map(p=>{const distance=Math.hypot(p.x-mid.x,p.y-mid.y);return `${p.x+(p.x-mid.x)*.15/distance},${p.y+(p.y-mid.y)*.15/distance}`;}).join(' ');
    result.push({local,matrix,points,transform:`matrix(${matrix.join(' ')})`});
   }
  }
  return result;
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
 const api={world,camera,blend,project,tile,symbol,groundMesh,frontier};if(typeof module!=='undefined')module.exports=api;else root.JourneyView=api;
})(globalThis);

