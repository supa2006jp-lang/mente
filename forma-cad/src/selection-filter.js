import * as THREE from 'three';
import {rangeCrossingBodyIds} from './box-selection.js';
export function rangeBodyIds(features,meshes,camera,width,height,rect){
 if(rect.crossing)return rangeCrossingBodyIds(meshes,camera,width,height,rect);
 return meshes.filter(m=>m.visible&&(()=>{const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){const q=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld).project(camera),x=(q.x+1)*width/2,y=(1-q.y)*height/2;if(x<rect.left||x>rect.right||y<rect.top||y>rect.bottom||q.z<-1||q.z>1)return false;}return p.count>0;})()).map(m=>m.userData.bodyId);
}
function crosses(a,b,r){let lo=0,hi=1;for(const [p,q] of [[a.x-b.x,a.x-r.left],[b.x-a.x,r.right-a.x],[a.y-b.y,a.y-r.top],[b.y-a.y,r.bottom-a.y]]){if(Math.abs(p)<1e-12){if(q<0)return false;}else if(p<0)lo=Math.max(lo,q/p);else hi=Math.min(hi,q/p);}return lo<=hi;}
export function rangeEdgeHits(meshes,camera,width,height,rect){
 const hits=[],seen=new Set(),project=p=>{const q=p.clone().project(camera);return {x:(q.x+1)*width/2,y:(1-q.y)*height/2,z:q.z};},inside=q=>q.x>=rect.left&&q.x<=rect.right&&q.y>=rect.top&&q.y<=rect.bottom;
 for(const mesh of meshes){if(!mesh.visible)continue;const g=mesh.children[0]?.geometry,p=g?.attributes.position;if(!p)continue;
  for(let i=0;i<p.count;i+=2){const circle=g.userData.circularEdges?.get(i),arc=g.userData.arcEdges?.get(i),curve=circle||arc,key=arc?mesh.uuid+':arc:'+arc.key:circle?mesh.uuid+':'+circle.center.join(',')+':'+circle.radius:mesh.uuid+':'+i;if(seen.has(key))continue;
   const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),points=(curve?curve.points.map(p=>new THREE.Vector3(...p)):[a,b]).map(project);
   if(points.some(p=>p.z<-1||p.z>1))continue;const selected=rect.crossing?points.some(inside)||points.some((p,j)=>j&&crosses(points[j-1],p,rect)):points.every(inside);
   if(selected){seen.add(key);hits.push({mesh,a,b,point:a.clone().lerp(b,.5),circle,arc});}
  }
 }return hits;
}
