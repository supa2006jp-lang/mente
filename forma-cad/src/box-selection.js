import * as THREE from 'three';
import {accelerateMeshPicking} from './mesh-picking.js';
import {cylindricalSelection} from './cylindrical-selection.js';

export function installBoxSelection(canvas,host,{enabled,getControls,onSelect,pointMode=()=>false,resolvePoint,onPoint}){
 const box=document.createElement('div'),anchor=document.createElement('span');
 box.id='selection-box';box.hidden=true;anchor.hidden=true;anchor.setAttribute('aria-hidden','true');box.append(anchor);host.append(box);
 let drag=null;
 canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0||event.altKey||event.shiftKey||!enabled())return;
  const controls=getControls(),point=pointMode(),{clientX,clientY}=event;
  const start=point?resolvePoint({clientX,clientY}):null;
  drag={id:event.pointerId,x:clientX,y:clientY,active:false,point,start,add:event.ctrlKey||event.metaKey,controls,wasEnabled:controls.enabled};
  controls.enabled=false;canvas.setPointerCapture(event.pointerId);
 },{capture:true});
 function pointRange(drag,event){
  const start=drag.start||{clientX:drag.x,clientY:drag.y};
  const opposite=resolvePoint(event)||event;
  // A snapped corner takes priority over snapping the midpoint.
  const center=resolvePoint({clientX:(start.clientX+opposite.clientX)/2,clientY:(start.clientY+opposite.clientY)/2},{snap:!opposite.snapped});
  const end=center?.snapped?{clientX:2*center.clientX-start.clientX,clientY:2*center.clientY-start.clientY}:opposite;
  return {start,end,center};
 }
 canvas.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  drag.active ||= Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>5;
  if(!drag.active)return;
  event.preventDefault();event.stopImmediatePropagation();
  const rect=host.getBoundingClientRect(),range=drag.point?pointRange(drag,event):null;
  const startX=range?.start.clientX??drag.x,startY=range?.start.clientY??drag.y;
  const x=range?.end.clientX??event.clientX,y=range?.end.clientY??event.clientY;
  box.hidden=false;
  box.dataset.point=String(drag.point);
  box.dataset.snapped=String(!!(range?.center?.snapped||range?.end.snapped));
  box.dataset.crossing=String(!drag.point&&x<drag.x);
  if(drag.point){
   box.style.setProperty('--point-x',x<startX?'0%':'100%');
   box.style.setProperty('--point-y',y<startY?'0%':'100%');
  }
  anchor.hidden=!range?.start.snapped;
  Object.assign(box.style,{left:Math.min(startX,x)-rect.left+'px',top:Math.min(startY,y)-rect.top+'px',width:Math.abs(x-startX)+'px',height:Math.abs(y-startY)+'px'});
 },{capture:true});
 function finish(event,cancelled=false){
  if(!drag||event.pointerId!==drag.id)return;
  const finished=drag;drag=null;box.hidden=true;
  finished.controls.enabled=finished.wasEnabled;
  if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
  if(finished.active||cancelled){event.preventDefault();event.stopImmediatePropagation();}
  if(!finished.active||cancelled||!enabled()||finished.point!==pointMode())return;
  if(finished.point){
   const {center}=pointRange(finished,event);
   if(center)onPoint(center.point);
   return;
  }
  const rect=canvas.getBoundingClientRect(),{x,y,add}=finished,{clientX,clientY}=event;
  onSelect({left:Math.min(x,clientX)-rect.left,right:Math.max(x,clientX)-rect.left,top:Math.min(y,clientY)-rect.top,bottom:Math.max(y,clientY)-rect.top,crossing:clientX<x,add});
 }
 canvas.addEventListener('pointerup',e=>finish(e),{capture:true});canvas.addEventListener('pointercancel',e=>finish(e,true),{capture:true});
 canvas.addEventListener('lostpointercapture',e=>finish(e,true),{capture:true});
 function cancel(){if(!drag)return;const d=drag;drag=null;box.hidden=true;d.controls.enabled=d.wasEnabled;if(canvas.hasPointerCapture(d.id))canvas.releasePointerCapture(d.id);return true;}
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&drag){cancel();e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
 return {cancel};
}

function clipTriangle(points,rect){
 let polygon=points;
 for(const [axis,value,sign] of [['x',rect.left,1],['x',rect.right,-1],['y',rect.top,1],['y',rect.bottom,-1]]){
  const output=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],insideA=(a[axis]-value)*sign>=0,insideB=(b[axis]-value)*sign>=0;if(insideA)output.push(a);if(insideA!==insideB){const t=(value-a[axis])/(b[axis]-a[axis]);output.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}polygon=output;if(!polygon.length)break;
 }
 return polygon;
}

export function rangeFaceHits(features,meshes,camera,width,height,rect){
 const visible=meshes.filter(m=>m.visible),hits=[],ray=new THREE.Raycaster(),project=p=>{const q=p.clone().project(camera);return {x:(q.x+1)*width/2,y:(1-q.y)*height/2,z:q.z};};
 ray.firstHitOnly=true;for(const mesh of visible)accelerateMeshPicking(mesh);
 for(const mesh of visible){
  const positions=mesh.geometry.attributes.position;
  const enclosed=Array.from({length:positions.count},(_,i)=>project(new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld))).every(q=>q.x>=rect.left&&q.x<=rect.right&&q.y>=rect.top&&q.y<=rect.bottom&&q.z>=-1&&q.z<=1);
  const g=mesh.geometry,p=g.attributes.position,ix=g.index,vertex=i=>new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i):i).applyMatrix4(mesh.matrixWorld),groups=new Map(),seen=new Set();
  for(let i=0;i<(ix?.count??p.count);i+=3){const points=[vertex(i),vertex(i+1),vertex(i+2)],normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();if(!normal.lengthSq())continue;const face=g.userData.faceGroups?.find(f=>i>=f.start&&i<f.start+f.count),key=face?'face:'+face.faceId:[...normal.toArray(),normal.dot(points[0])].map(v=>Math.round(v*1e5)).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push({points,index:i/3});}
  for(const [key,triangles] of groups){
   let all=triangles,temporary=null;
   if(!key.startsWith('face:')){const first=triangles[0],point=first.points[0].clone().add(first.points[1]).add(first.points[2]).multiplyScalar(1/3),curved=cylindricalSelection(features,mesh.userData.bodyId,g,first.index,point);if(curved){temporary=curved.geometry;const a=temporary.attributes.position,bounds=new THREE.Box3().setFromBufferAttribute(a),curveKey=JSON.stringify([bounds.min.toArray(),bounds.max.toArray()]);if(seen.has(curveKey)){temporary.dispose();continue;}seen.add(curveKey);all=[];for(let j=0;j<a.count;j+=3)all.push({points:[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(a,j+k).applyMatrix4(mesh.matrixWorld))});}}
   const projected=all.map(t=>({...t,screen:t.points.map(project)}));
   if(enclosed){const t=triangles.reduce((best,t)=>new THREE.Triangle(...t.points).getArea()>new THREE.Triangle(...best.points).getArea()?t:best),point=t.points[0].clone().add(t.points[1]).add(t.points[2]).multiplyScalar(1/3),normal=new THREE.Triangle(...t.points).getNormal(new THREE.Vector3());hits.push({object:mesh,point,faceIndex:t.index,face:{normal}});temporary?.dispose();continue;}
   if(!rect.crossing&&projected.some(t=>t.screen.some(q=>q.x<rect.left||q.x>rect.right||q.y<rect.top||q.y>rect.bottom||q.z<-1||q.z>1))){temporary?.dispose();continue;}
   for(const t of projected){
    if(t.screen.some(q=>q.z<-1||q.z>1))continue;const polygon=clipTriangle(t.screen,rect);if(polygon.length<3)continue;
    const center=polygon.reduce((a,p)=>({x:a.x+p.x/polygon.length,y:a.y+p.y/polygon.length}),{x:0,y:0});ray.setFromCamera(new THREE.Vector2(center.x/width*2-1,1-center.y/height*2),camera);const hit=ray.intersectObjects(visible,false)[0];
    if(!hit||hit.object!==mesh)continue;const tri=new THREE.Triangle(...t.points);if(tri.closestPointToPoint(hit.point,new THREE.Vector3()).distanceTo(hit.point)>.001)continue;
    hits.push(hit);break;
   }
   temporary?.dispose();
  }
 }
 return hits;
}

// Body crossing selects a visible intersection and stops immediately for that
// body; it does not reconstruct every CAD surface as a face selection would.
export function rangeCrossingBodyIds(meshes,camera,width,height,rect){
 const visible=meshes.filter(m=>m.visible),ray=new THREE.Raycaster(),ids=[];ray.firstHitOnly=true;visible.forEach(accelerateMeshPicking);
 for(const mesh of visible){
  mesh.updateWorldMatrix(true,false);const g=mesh.geometry,p=g.attributes.position,ix=g.index,screen=[];
  for(let i=0;i<p.count;i++){const point=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld),q=point.clone().project(camera);screen.push({x:(q.x+1)*width/2,y:(1-q.y)*height/2,z:q.z});}
  if(screen.length&&screen.every(q=>q.x>=rect.left&&q.x<=rect.right&&q.y>=rect.top&&q.y<=rect.bottom&&q.z>=-1&&q.z<=1)){ids.push(mesh.userData.bodyId);continue;}
  for(let i=0;i<(ix?.count??p.count);i+=3){
   const indices=[0,1,2].map(k=>ix?ix.getX(i+k):i+k),points=indices.map(k=>screen[k]);if(points.some(q=>q.z<-1||q.z>1))continue;const polygon=clipTriangle(points,rect);if(polygon.length<3)continue;
   const center=polygon.reduce((a,q)=>({x:a.x+q.x/polygon.length,y:a.y+q.y/polygon.length}),{x:0,y:0});ray.setFromCamera(new THREE.Vector2(center.x/width*2-1,1-center.y/height*2),camera);const hit=ray.intersectObjects(visible,false)[0];if(hit?.object===mesh){ids.push(mesh.userData.bodyId);break;}
  }
 }
 return ids;
}
