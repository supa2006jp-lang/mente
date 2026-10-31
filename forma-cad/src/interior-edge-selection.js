import * as R from 'replicad';
import * as THREE from 'three';
import {MeshBVH,acceleratedRaycast} from 'three-mesh-bvh';
import {cadMesh} from './cad-mesh.js';
import {resolveFilletEdges} from './solid-fillet.js';

const vec=p=>new THREE.Vector3(...p);
function sample(edge,t){const p=edge.pointAt(t);try{return p.toTuple();}finally{p.delete();}}
function normalZ(face,point){const n=face.normalAt(point);try{return vec(n.toTuple()).normalize().z;}finally{n.delete();}}
const area=loop=>Math.abs(loop.reduce((s,p,i)=>{const q=loop[(i+1)%loop.length];return s+p[0]*q[1]-p[1]*q[0];},0)/2);
function contains(loop,p){let inside=false;for(let i=0,j=loop.length-1;i<loop.length;j=i++){const a=loop[i],b=loop[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}

// Horizontal cuts of a closed CAD tessellation produce nested loops. A void
// bounded by walls is inside an even, nonzero number of loops; exterior air is
// inside none. Never guess a cavity from an incomplete/open section.
function horizontalLoops(vertices,triangles,z,tolerance){
 const nodes=new Map(),segments=new Set(),point=i=>vertices.slice(i*3,i*3+3),key=p=>p.slice(0,2).map(x=>Math.round(x/tolerance)).join(',');
 function node(p){const k=key(p);if(!nodes.has(k))nodes.set(k,{p:p.slice(0,2),next:new Set()});return k;}
 for(let i=0;i<triangles.length;i+=3){
  const ps=[0,1,2].map(j=>point(triangles[i+j])),hits=[];
  for(let j=0;j<3;j++){const a=ps[j],b=ps[(j+1)%3];if((a[2]<z)===(b[2]<z))continue;const t=(z-a[2])/(b[2]-a[2]);hits.push(a.map((v,k)=>v+(b[k]-v)*t));}
  if(hits.length!==2)continue;const a=node(hits[0]),b=node(hits[1]);if(a===b)continue;const k=a<b?a+'|'+b:b+'|'+a;if(segments.has(k))continue;segments.add(k);nodes.get(a).next.add(b);nodes.get(b).next.add(a);
 }
 for(const n of nodes.values())if(n.next.size&&n.next.size!==2)return [];
 const visited=new Set(),loops=[];
 for(const [start,n]of nodes){if(visited.has(start)||!n.next.size)continue;const loop=[];let current=start,previous=null;
  do{if(visited.has(current))return [];visited.add(current);const item=nodes.get(current);loop.push(item.p);const next=[...item.next].find(k=>k!==previous);previous=current;current=next;}while(current!==start&&current!==undefined);
  if(current!==start)return [];if(loop.length>=3&&area(loop)>tolerance*tolerance*4)loops.push(loop);
 }
 return loops;
}

export function interiorEdges(shape,{bodyId,onProgress}={}){
 let edges;try{edges=resolveFilletEdges(shape);}catch(error){if(error.code==='fillet-selection')return [];throw error;}
 const faces=shape.faces,byHash=new Map(),meshData=cadMesh(shape,{tolerance:.001,angularTolerance:.05}),box=shape.boundingBox;
 let bounds;try{bounds=box.bounds;}finally{box.delete();}
 const diagonal=vec(bounds[1]).distanceTo(vec(bounds[0])),epsilon=Math.max(.006,Math.min(.02,diagonal*1e-5)),tolerance=Math.max(1e-7,diagonal*1e-8);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float64Array(meshData.vertices),3));geometry.setIndex(meshData.triangles);geometry.boundsTree=new MeshBVH(geometry);
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material);mesh.raycast=acceleratedRaycast;mesh.updateMatrixWorld();const ray=new THREE.Raycaster();ray.firstHitOnly=true;ray.near=epsilon*.05;
 const sections=new Map(),selected=[];
 function rayHit(p,z){ray.set(vec(p),new THREE.Vector3(0,0,z));return ray.intersectObject(mesh,false)[0];}
 function section(z){const key=z.toPrecision(13);if(!sections.has(key))sections.set(key,{loops:horizontalLoops(meshData.vertices,meshData.triangles,z,tolerance),open:new Map()});return sections.get(key);}
 function enclosed(loops,p){const enclosing=loops.filter(loop=>contains(loop,p));return enclosing.length>0&&enclosing.length%2===0?enclosing.sort((a,b)=>area(a)-area(b))[0]:null;}
 function nearLoop(loop,p){return loop.some((a,i)=>{const b=loop[(i+1)%loop.length],d=[b[0]-a[0],b[1]-a[1]],n=d[0]**2+d[1]**2,t=Math.max(0,Math.min(1,n?((p[0]-a[0])*d[0]+(p[1]-a[1])*d[1])/n:0));return Math.hypot(p[0]-a[0]-t*d[0],p[1]-a[1]-t*d[1])<epsilon*4;});}
 function openAbove(p,rim){
  const cut=section(p[2]),loop=enclosed(cut.loops,p);if(!loop)return false;
  if(rim&&nearLoop(loop,p))return false;
  if(cut.open.has(loop))return cut.open.get(loop);
  // Testing the whole void cross-section also accepts corners under a small
  // inward lip, provided the same cavity has an exposed opening and a floor.
  const mean=loop.reduce((a,p)=>[a[0]+p[0]/loop.length,a[1]+p[1]/loop.length],[0,0]),candidates=[p.slice(0,2),mean];
  const polygon=loop.map(p=>new THREE.Vector2(...p));for(const t of THREE.ShapeUtils.triangulateShape(polygon,[])){candidates.push(t.reduce((a,i)=>[a[0]+loop[i][0]/3,a[1]+loop[i][1]/3],[0,0]));}
  let result=false;for(const xy of candidates){if(enclosed(cut.loops,xy)!==loop)continue;const q=[xy[0],xy[1],p[2]];if(!rayHit(q,1)&&rayHit(q,-1)){result=true;break;}}
  cut.open.set(loop,result);return result;
 }
 try{
  for(const edge of edges){const key=edge.hashCode;if(!byHash.has(key))byHash.set(key,[]);byHash.get(key).push({edge,faces:[]});}
  for(const face of faces){const boundary=face.edges;try{for(const e of boundary)for(const record of byHash.get(e.hashCode)||[])if(record.edge.isSame(e)&&!record.faces.includes(face))record.faces.push(face);}finally{boundary.forEach(e=>e.delete());}}
  const records=[...byHash.values()].flat(),rimFaces=new Set(),rimNeighbors=new Set(),vertexFaces=new Map(),vertexKey=p=>p.map(x=>Math.round(x/Math.max(1e-6,tolerance))).join(',');
  for(const face of faces){if(face.geomType!=='PLANE'||normalZ(face)<.999999)continue;const wires=face.wires;try{if(wires.length>1)rimFaces.add(face);}finally{wires.forEach(w=>w.delete());}}
  for(const record of records){if(record.faces.some(f=>rimFaces.has(f)))for(const face of record.faces)if(!rimFaces.has(face))rimNeighbors.add(face);for(const t of [0,1]){const key=vertexKey(sample(record.edge,t));if(!vertexFaces.has(key))vertexFaces.set(key,new Set());for(const face of record.faces)vertexFaces.get(key).add(face);}}
  for(const [index,record]of records.entries()){
   if(index%20===0)onProgress?.({stage:'上面が開いた空間の内側を調べています',current:index,total:records.length});
   if(record.faces.length!==2)continue;let inside=true;
   const endpoints=[sample(record.edge,0),sample(record.edge,1)],lower=endpoints.reduce((a,b)=>a[2]<b[2]?a:b);
   if(record.faces.every(f=>rimNeighbors.has(f))){const z=Math.min(...record.faces.map(f=>normalZ(f,sample(record.edge,.5))));if(z>1e-5&&[...(vertexFaces.get(vertexKey(lower))||[])].some(f=>!record.faces.includes(f)&&normalZ(f,lower)<z-1e-4))continue;}
   // OCCT differential normals on lofted surfaces are not necessarily unit
   // length. Normalize each before forming the two dihedral bisectors.
   for(const t of [.3,.5,.7]){const p=sample(record.edge,t),normals=record.faces.map(f=>f.normalAt(p));let offset,cross;try{const a=vec(normals[0].toTuple()).normalize(),b=vec(normals[1].toTuple()).normalize();offset=a.clone().add(b);cross=a.clone().sub(b);}finally{normals.forEach(n=>n.delete());}if(offset.length()<1e-6){inside=false;break;}const q=vec(p).addScaledVector(offset.normalize(),epsilon).toArray(),r=vec(p).addScaledVector(cross.normalize(),epsilon).toArray(),concave=section(r[2]).loops.filter(loop=>contains(loop,r)).length%2===1;
    // A convex, upward-facing blend/chamfer next to the opening boundary is
    // part of the rim, even when its lower edge is below the topmost plane.
    if(!openAbove(q,!concave&&offset.z>1e-5)){inside=false;break;}}
   if(!inside)continue;const edge=record.edge,curved=edge.geomType!=='LINE',segments=curved?Math.min(2048,Math.max(96,Math.ceil(Math.PI*Math.sqrt(diagonal/.02)))):1,points=Array.from({length:segments+1},(_,i)=>sample(edge,i/segments)),length=points.slice(1).reduce((sum,p,i)=>sum+vec(p).distanceTo(vec(points[i])),0),point=sample(edge,.5),reference={point,a:points[0],b:points.at(-1),...(curved?{curved:true}:{})};
   selected.push({bodyId,point,a:points[0],b:points.at(-1),length,points,curved,reference,key:'interior-'+bodyId+'-'+edge.hashCode});
  }
  return selected;
 }finally{edges.forEach(e=>e.delete());faces.forEach(f=>f.delete());geometry.boundsTree=null;geometry.dispose();material.dispose();}
}

export function inspectInteriorEdges(bodies,spec,onProgress){
 const ids=[...new Set(spec.targets||[spec.target])];if(!ids.length||ids.length>100||ids.some(id=>!bodies.has(id)))throw Error('内側の辺を選ぶボディを選択してください');
 const edges=[];for(const id of ids)edges.push(...interiorEdges(bodies.get(id),{bodyId:id,onProgress}));
 return {edges,analysis:{interiorEdges:{bodyIds:ids,edgeCount:edges.length,up:[0,0,1],rimIncluded:false}}};
}
