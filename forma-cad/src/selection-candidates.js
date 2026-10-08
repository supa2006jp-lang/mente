import * as THREE from 'three';
import {basisFor,planarFace,worldPoint} from './frames.js';
import {cadFaceGroup,cadFaceKey} from './face-selection.js';
const rounded=v=>Math.round(v*1e4)/1e4;
export function edgeCandidateKey(hit){const curve=hit.arc||hit.circle,body=hit.mesh.userData.bodyId;if(hit.arc)return body+':arc:'+hit.arc.key;if(hit.circle)return body+':circle:'+curve.center.map(rounded).join(',')+':'+rounded(curve.radius);return body+':edge:'+ [hit.a.toArray().map(rounded).join(','),hit.b.toArray().map(rounded).join(',')].sort().join('|');}
export function faceCandidateKey(hit,features=[]){const g=hit.object.geometry,body=hit.object.userData.bodyId,group=cadFaceGroup(g,hit.faceIndex);if(group)return cadFaceKey(body,group);const n=hit.face.normal;for(const f of [...features].reverse()){if(f.kind==='extrusion'&&f.id===body&&f.profile==='circle'){const axis=basisFor(f).n;if(Math.abs(n.dot(axis))<.05){const delta=hit.point.clone().sub(new THREE.Vector3(f.x,f.y,f.z)),radius=delta.addScaledVector(axis,-delta.dot(axis)).length(),r=f.diameter/2;for(const expected of f.mode==='thin'?[r+(f.side==='outside'?f.wall:f.side==='center'?f.wall/2:0),r-(f.side==='inside'?f.wall:f.side==='center'?f.wall/2:0)]:[r])if(Math.abs(radius-expected)<Math.max(.002,expected*.003))return body+':cylinder:'+rounded(expected);}}}return body+':plane:'+n.toArray().map(rounded).join(',')+':'+rounded(n.dot(hit.point));}
export function allMeshHits(raycaster,meshes){const sides=new Map(),first=raycaster.firstHitOnly;try{raycaster.firstHitOnly=false;for(const mesh of meshes)for(const material of [].concat(mesh.material)){if(!sides.has(material))sides.set(material,material.side);material.side=THREE.DoubleSide;}return raycaster.intersectObjects(meshes,false);}finally{for(const [material,side]of sides)material.side=side;raycaster.firstHitOnly=first;}}
export function screenEdgeCandidates(meshes,camera,width,height,x,y,tolerance=10){const candidates=[];camera.updateMatrixWorld(true);const project=p=>{const q=p.clone().project(camera);return {x:(q.x+1)*width/2,y:(1-q.y)*height/2,z:q.z};};for(const mesh of meshes){if(!mesh.visible)continue;mesh.updateMatrixWorld(true);const geometry=mesh.children[0]?.geometry,attr=geometry?.attributes.position;if(!attr)continue;for(let i=0;i<attr.count;i+=2){const a=new THREE.Vector3().fromBufferAttribute(attr,i).applyMatrix4(mesh.matrixWorld),b=new THREE.Vector3().fromBufferAttribute(attr,i+1).applyMatrix4(mesh.matrixWorld),p=project(a),q=project(b);if(p.z<-1||p.z>1||q.z<-1||q.z>1)continue;const dx=q.x-p.x,dy=q.y-p.y,len=dx*dx+dy*dy;if(len<.01)continue;const t=Math.max(0,Math.min(1,((x-p.x)*dx+(y-p.y)*dy)/len)),distance=Math.hypot(x-p.x-dx*t,y-p.y-dy*t);if(distance>tolerance)continue;const point=a.clone().lerp(b,t);candidates.push({mesh,a,b,point,distance,depth:point.clone().project(camera).z,circle:geometry.userData.circularEdges?.get(i),arc:geometry.userData.arcEdges?.get(i)});}}return candidates.sort((a,b)=>Math.abs(a.distance-b.distance)>.25?a.distance-b.distance:a.depth-b.depth);}
export function screenMidpointCandidates(meshes,camera,width,height,x,y,edges=[],tolerance=28){
 const nearEdges=new Set(edges.filter(e=>!e.arc&&!e.circle).map(e=>e.mesh.userData.bodyId+':'+e.a.clone().add(e.b).multiplyScalar(.5).toArray().map(rounded).join(','))),out=[];
 for(const mesh of meshes){if(!mesh.visible)continue;mesh.updateMatrixWorld(true);for(const ref of mesh.userData.references||[]){if(ref.kind!=='midpoint')continue;const point=new THREE.Vector3(...ref.point).applyMatrix4(mesh.matrixWorld),p=point.clone().project(camera);if(p.z<-1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1)continue;const distance=Math.hypot((p.x+1)*width/2-x,(1-p.y)*height/2-y),key=mesh.userData.bodyId+':'+point.toArray().map(rounded).join(',');if(distance>tolerance&&!nearEdges.has(key))continue;const normal=new THREE.Vector3(...ref.normal).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).toArray();out.push({mesh,point,reference:{...ref,bodyId:mesh.userData.bodyId,point:point.toArray(),normal},distance,depth:p.z});}}
 return out.sort((a,b)=>a.distance-b.distance||a.depth-b.depth);
}
export function midpointCandidateKey(hit){return hit.mesh.userData.bodyId+':midpoint:'+hit.point.toArray().map(rounded).join(',');}
const faceCenters=new WeakMap();
// Use the whole planar face, including its holes, rather than the clicked triangle.
export function faceCenterCandidate(hit,features=[]){
 const mesh=hit.object,g=mesh.geometry,key=faceCandidateKey(hit,features),group=cadFaceGroup(g,hit.faceIndex),normal=hit.face.normal.clone();let centers=faceCenters.get(g);if(!centers){centers=new Map();faceCenters.set(g,centers);}let point=centers.get(key);
 if(point===undefined){point=null;
  if(group){if(!group.cylinder&&(!g.userData.planarFaces||g.userData.planarFaces.includes(group.faceId))){const p=g.attributes.position,ix=g.index,sum=new THREE.Vector3();let area=0,planar=true;for(const part of group.parts||[group])for(let i=part.start;i<part.start+part.count;i+=3){const [a,b,c]=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i+j):i+j)),cross=b.clone().sub(a).cross(c.clone().sub(a)),weight=cross.length()/2;if(!weight)continue;if(cross.normalize().dot(normal)<.99999){planar=false;break;}sum.add(a.add(b).add(c).multiplyScalar(weight/3));area+=weight;}if(planar&&area>1e-8)point=sum.divideScalar(area);}}
  else if((mesh.userData.references||[]).some(ref=>ref.kind==='center'&&Math.abs(normal.dot(new THREE.Vector3(...ref.normal)))>.99999&&Math.abs(normal.dot(new THREE.Vector3(...ref.point))-normal.dot(new THREE.Vector3().fromBufferAttribute(g.attributes.position,g.index?g.index.getX(hit.faceIndex*3):hit.faceIndex*3)))<1e-4)){
   try{const face=planarFace(g,hit.faceIndex),parts=[face.outer,...face.holes];let area=0,x=0,y=0;for(const [index,loop]of parts.entries()){let twice=0,cx=0,cy=0;for(let i=0;i<loop.length;i++){const a=loop[i],b=loop[(i+1)%loop.length],cross=a[0]*b[1]-b[0]*a[1];twice+=cross;cx+=(a[0]+b[0])*cross;cy+=(a[1]+b[1])*cross;}if(Math.abs(twice)<1e-8)continue;const weight=Math.abs(twice)/2*(index?-1:1);area+=weight;x+=cx/(3*twice)*weight;y+=cy/(3*twice)*weight;}if(area>1e-8)point=worldPoint(face,[x/area,y/area]);}catch{}}
  centers.set(key,point);
 }
 if(!point)return null;mesh.updateMatrixWorld(true);const world=point.clone().applyMatrix4(mesh.matrixWorld),n=normal.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).toArray();return {mesh,point:world,reference:{bodyId:mesh.userData.bodyId,point:world.toArray(),normal:n,name:'ソリッド面',kind:'center'}};
}
function faceDirection(hit,features){
 const mesh=hit.object,group=cadFaceGroup(mesh.geometry,hit.faceIndex);
 if(group?.cylinder||faceCandidateKey(hit,features).includes(':cylinder:'))return '曲面';
 mesh.updateMatrixWorld(true);
 const n=hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld));
 if(n.z>.999)return '上面';if(n.z<-.999)return '底面';
 if(Math.abs(n.x)>.999)return '側面（X'+(n.x>0?'＋':'−')+'）';
 if(Math.abs(n.y)>.999)return '側面（Y'+(n.y>0?'＋':'−')+'）';
 return '斜面';
}
const coordinates=point=>point.map((v,i)=>['X','Y','Z'][i]+' '+(Math.abs(v)<.005?0:v).toFixed(2)).join(' / ')+' mm';
export function selectionCandidates(hits,edges,{mode='auto',name=id=>id,features=[],midpoints=[]}={}){
 const out=[],seen=new Set(),counts={edge:0,midpoint:0},front=hits[0]?.distance??Infinity;
 const add=(kind,key,hit,bodyId,behind,direction='')=>{
  if(seen.has(key))return;seen.add(key);
  const title=kind==='body'?'ボディ全体':kind==='face'?direction:kind==='faceCenter'?'面の中心 · '+direction:(kind==='midpoint'?'中点':'辺')+' '+(++counts[kind]);
  const center=kind==='face'?faceCenterCandidate(hit,features):null,point=['midpoint','faceCenter'].includes(kind)?hit.reference.point:center?.reference.point;
  out.push({kind,key,hit,bodyId,label:title+' — '+name(bodyId)+(behind?'（奥）':''),detail:point?coordinates(point):''});
 };
 if(['auto','edge'].includes(mode))for(const m of midpoints)add('midpoint',midpointCandidateKey(m),m,m.mesh.userData.bodyId,false);
 if(['auto','edge'].includes(mode))for(const e of edges)add('edge',edgeCandidateKey(e),e,e.mesh.userData.bodyId,false);
 if(['auto','face'].includes(mode))for(const h of hits){const key=faceCandidateKey(h,features);if(seen.has(key))continue;const direction=faceDirection(h,features);add('face',key,h,h.object.userData.bodyId,h.distance>front+.05,direction);const center=faceCenterCandidate(h,features);if(center){center.reference.faceName=direction;add('faceCenter',key+':center',center,h.object.userData.bodyId,h.distance>front+.05,direction);}}
 if(['auto','body'].includes(mode))for(const h of hits)add('body',h.object.userData.bodyId+':body',h,h.object.userData.bodyId,h.distance>front+.05);
 return out;
}
