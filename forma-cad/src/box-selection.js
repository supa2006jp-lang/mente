import * as THREE from 'three';
import {accelerateMeshPicking} from './mesh-picking.js';
import {cylindricalSelection} from './cylindrical-selection.js';

export function installBoxSelection(canvas,host,{enabled,getControls,onSelect}){
 const box=document.createElement('div');box.id='selection-box';box.hidden=true;host.append(box);let drag=null;
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0||e.altKey||e.shiftKey||!enabled())return;const controls=getControls();drag={id:e.pointerId,x:e.clientX,y:e.clientY,active:false,add:e.ctrlKey||e.metaKey,controls,wasEnabled:controls.enabled};controls.enabled=false;canvas.setPointerCapture(e.pointerId);},{capture:true});
 canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;drag.active ||=Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>5;if(!drag.active)return;e.preventDefault();e.stopImmediatePropagation();const r=host.getBoundingClientRect();box.hidden=false;box.dataset.crossing=String(e.clientX<drag.x);Object.assign(box.style,{left:Math.min(drag.x,e.clientX)-r.left+'px',top:Math.min(drag.y,e.clientY)-r.top+'px',width:Math.abs(e.clientX-drag.x)+'px',height:Math.abs(e.clientY-drag.y)+'px'});},{capture:true});
 function finish(e,cancel=false){if(!drag||e.pointerId!==drag.id)return;const d=drag;drag=null;box.hidden=true;d.controls.enabled=d.wasEnabled;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(d.active||cancel){e.preventDefault();e.stopImmediatePropagation();}if(d.active&&!cancel){const r=canvas.getBoundingClientRect();onSelect({left:Math.min(d.x,e.clientX)-r.left,right:Math.max(d.x,e.clientX)-r.left,top:Math.min(d.y,e.clientY)-r.top,bottom:Math.max(d.y,e.clientY)-r.top,crossing:e.clientX<d.x,add:d.add});}}
 canvas.addEventListener('pointerup',e=>finish(e),{capture:true});canvas.addEventListener('pointercancel',e=>finish(e,true),{capture:true});
 canvas.addEventListener('lostpointercapture',e=>finish(e,true),{capture:true});
 function cancel(){if(!drag)return;const d=drag;drag=null;box.hidden=true;d.controls.enabled=d.wasEnabled;if(canvas.hasPointerCapture(d.id))canvas.releasePointerCapture(d.id);}
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
  const enclosed=Array.from({length:positions.count},(_,i)=>project(new THREE.Vector3().fromBufferAttribute(positions,i))).every(q=>q.x>=rect.left&&q.x<=rect.right&&q.y>=rect.top&&q.y<=rect.bottom&&q.z>=-1&&q.z<=1);
  const g=mesh.geometry,p=g.attributes.position,ix=g.index,vertex=i=>new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i):i),groups=new Map(),seen=new Set();
  for(let i=0;i<(ix?.count??p.count);i+=3){const points=[vertex(i),vertex(i+1),vertex(i+2)],normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();if(!normal.lengthSq())continue;const face=g.userData.faceGroups?.find(f=>i>=f.start&&i<f.start+f.count),key=face?'face:'+face.faceId:[...normal.toArray(),normal.dot(points[0])].map(v=>Math.round(v*1e5)).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push({points,index:i/3});}
  for(const [key,triangles] of groups){
   let all=triangles,temporary=null;
   if(!key.startsWith('face:')){const first=triangles[0],point=first.points[0].clone().add(first.points[1]).add(first.points[2]).multiplyScalar(1/3),curved=cylindricalSelection(features,mesh.userData.bodyId,g,first.index,point);if(curved){temporary=curved.geometry;const a=temporary.attributes.position,bounds=new THREE.Box3().setFromBufferAttribute(a),curveKey=JSON.stringify([bounds.min.toArray(),bounds.max.toArray()]);if(seen.has(curveKey)){temporary.dispose();continue;}seen.add(curveKey);all=[];for(let j=0;j<a.count;j+=3)all.push({points:[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(a,j+k))});}}
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
