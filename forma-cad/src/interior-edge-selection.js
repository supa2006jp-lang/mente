import * as R from 'replicad';
import * as THREE from 'three';
import {MeshBVH,acceleratedRaycast} from 'three-mesh-bvh';
import {cadMesh} from './cad-mesh.js';
import {resolveFilletEdges} from './solid-fillet.js';
import {selectedCadFaces} from './face-pull.js';

const vec=p=>new THREE.Vector3(...p);
function sample(edge,t){const p=edge.pointAt(t);try{return p.toTuple();}finally{p.delete();}}
function center(face){const p=face.center;try{return vec(p.toTuple());}finally{p.delete();}}
function normal(face,point){const n=face.normalAt(point);try{return vec(n.toTuple()).normalize();}finally{n.delete();}}
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

function isNearLoop(loop,p,tolerance){
 return loop.some((a,i)=>{
  const b=loop[(i+1)%loop.length],dx=b[0]-a[0],dy=b[1]-a[1],lengthSquared=dx*dx+dy*dy;
  const t=Math.max(0,Math.min(1,lengthSquared?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/lengthSquared:0));
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)<tolerance;
 });
}

export function exteriorVerticalEdges(shape,{bodyId,onProgress,axis='Z'}={}){
 const axisIndex=['X','Y','Z'].indexOf(axis);
 if(axisIndex<0)throw Error('辺の方向は X・Y・Z から選んでください');
 const project=point=>[point[(axisIndex+1)%3],point[(axisIndex+2)%3],point[axisIndex]];
 let edges;
 try{edges=resolveFilletEdges(shape);}catch(error){if(error.code==='fillet-selection')return [];throw error;}
 try{
  const candidates=[];
  for(const edge of edges){
   if(edge.geomType!=='LINE')continue;
   const a=sample(edge,0),b=sample(edge,1),start=project(a),end=project(b);
   const length=Math.abs(end[2]-start[2]);
   if(length<=1e-6||Math.hypot(end[0]-start[0],end[1]-start[1])>length*1e-6)continue;
   candidates.push({bodyId,a,b,point:sample(edge,.5),length,key:'exterior-'+axis+'-'+bodyId+'-'+edge.hashCode});
  }
  if(!candidates.length)return [];
  const {vertices,triangles}=cadMesh(shape,{tolerance:.001,angularTolerance:.05});
  const sectionVertices=vertices.slice();
  for(let i=0;i<vertices.length;i+=3){
   sectionVertices[i]=vertices[i+(axisIndex+1)%3];
   sectionVertices[i+1]=vertices[i+(axisIndex+2)%3];
   sectionVertices[i+2]=vertices[i+axisIndex];
  }
  const sections=new Map(),tolerance=1e-6;
  return candidates.filter((edge,index)=>{
   if(index%20===0)onProgress?.({stage:'外側の'+axis+'方向の辺を調べています',current:index,total:candidates.length});
   // Try another cut when the section coincides with other geometry.
   for(const fraction of [.5,.37,.63]){
    const z=edge.a[axisIndex]+(edge.b[axisIndex]-edge.a[axisIndex])*fraction;
    const key=z.toPrecision(14);
    if(!sections.has(key))sections.set(key,horizontalLoops(sectionVertices,triangles,z,tolerance));
    const loops=sections.get(key),xy=project(edge.point);
    const matching=loops.filter(loop=>isNearLoop(loop,xy,tolerance*4));
    if(matching.length!==1)continue;
    const [loop]=matching;
    return !loops.some(other=>other!==loop&&contains(other,loop[0]));
   }
   return false;
  }).map(edge=>({...edge,reference:{a:edge.a,b:edge.b,point:edge.point}}));
 }finally{edges.forEach(edge=>edge.delete());}
}

function openingDirections(faces){
 const directions=[{up:new THREE.Vector3(0,0,1),rimFaces:new Set()}];
 for(const face of faces){
  if(face.geomType!=='PLANE')continue;
  const wires=face.wires;
  try{if(wires.length<2)continue;}
  finally{wires.forEach(wire=>wire.delete());}
  const up=normal(face);
  let direction=directions.find(item=>item.up.dot(up)>1-1e-10);
  if(!direction){direction={up,rimFaces:new Set()};directions.push(direction);}
  direction.rimFaces.add(face);
 }
 return directions;
}

function cavitySection({up,rimFaces},records,meshData,rayHit,epsilon,tolerance){
 const x=new THREE.Vector3(0,Math.abs(up.y)<.9?1:0,Math.abs(up.y)<.9?0:1).cross(up).normalize();
 const y=up.clone().cross(x);
 const project=p=>[p.dot(x),p.dot(y),p.dot(up)];
 const rimNeighbors=new Set();
 for(const {faces} of records){
  if(faces.some(face=>rimFaces.has(face)))for(const face of faces)if(!rimFaces.has(face))rimNeighbors.add(face);
 }
 let vertices;
 const sections=new Map(),mouthIds=new Map(),reverse=up.clone().negate();
 const mouthLevels=[...new Set([...rimFaces].map(face=>center(face).dot(up)-epsilon/2))].sort((a,b)=>b-a);
 function section(z){
  const key=z.toPrecision(13);
  if(!sections.has(key)){
   if(!vertices){
    vertices=new Float64Array(meshData.vertices.length);
    const point=new THREE.Vector3();
    for(let i=0;i<vertices.length;i+=3)vertices.set(project(point.fromArray(meshData.vertices,i)),i);
   }
   sections.set(key,{loops:horizontalLoops(vertices,meshData.triangles,z,tolerance),open:new Map()});
  }
  return sections.get(key);
 }
 function enclosed(loops,p){const enclosing=loops.filter(loop=>contains(loop,p));return enclosing.length>0&&enclosing.length%2===0?enclosing.sort((a,b)=>area(a)-area(b))[0]:null;}
 function openTowardOpening(p,rim){
  const cut=section(p[2]),loop=enclosed(cut.loops,p);if(!loop)return null;
  if(rim&&isNearLoop(loop,p,epsilon*4))return null;
  if(cut.open.has(loop))return cut.open.get(loop);
  // Testing the whole void cross-section also accepts corners under a small
  // inward lip, provided the same cavity has an exposed opening and a floor.
  const mean=loop.reduce((a,p)=>[a[0]+p[0]/loop.length,a[1]+p[1]/loop.length],[0,0]),candidates=[p.slice(0,2),mean];
  const polygon=loop.map(p=>new THREE.Vector2(...p));for(const t of THREE.ShapeUtils.triangulateShape(polygon,[])){candidates.push(t.reduce((a,i)=>[a[0]+loop[i][0]/3,a[1]+loop[i][1]/3],[0,0]));}
  let result=null;
  for(const xy of candidates){
   if(enclosed(cut.loops,xy)!==loop)continue;
   const q=x.clone().multiplyScalar(xy[0]).addScaledVector(y,xy[1]).addScaledVector(up,p[2]);
   if(rayHit(q,up)||!rayHit(q,reverse))continue;
   // Follow this unobstructed ray to a section just inside the rim. The
   // same mouth identifies the compartment at every depth, including steps.
   for(const level of mouthLevels){
    if(level<p[2])break;
    const mouth=enclosed(section(level).loops,xy);
    if(!mouth)continue;
    if(!mouthIds.has(mouth))mouthIds.set(mouth,mouthIds.size+1);
    result={mouth:mouthIds.get(mouth)};
    break;
   }
   result??={mouth:null};
   break;
  }
  cut.open.set(loop,result);return result;
 }
 function findMouth(samples){
  let mouth=null;
  for(const {air,side,offset} of samples){
   const q=project(air);
   // A convex chamfer or blend facing the opening can be part of its rim.
   let rim=false;
   if(offset.dot(up)>1e-5){
    const r=project(side);
    rim=section(r[2]).loops.filter(loop=>contains(loop,r)).length%2===0;
   }
   const opening=openTowardOpening(q,rim);
   if(!opening)return null;
   mouth??=opening.mouth;
  }
  return {mouth};
 }
 return {up,rimFaces,rimNeighbors,findMouth,mouthAt:air=>openTowardOpening(project(air),false)?.mouth};
}

function assignCompartments(edges,vertexKey){
 const atVertex=new Map();
 for(const edge of edges){
  for(const key of new Set([vertexKey(edge.a),vertexKey(edge.b)])){
   const id=edge.direction+'|'+key;
   if(!atVertex.has(id))atVertex.set(id,[]);
   atVertex.get(id).push(edge);
  }
 }
 // A segmented rim can have no single planar mouth. Group those edges by
 // shared vertices and adopt the mouth ID when the group borders one mouth.
 let component=0;
 for(const edge of edges){
  if(edge.compartment!==null)continue;
  const group=[edge],mouths=new Set(),pending='connected-'+(++component);
  edge.compartment=pending;
  for(const member of group){
   for(const point of [member.a,member.b]){
    for(const next of atVertex.get(member.direction+'|'+vertexKey(point))){
     if(next.compartment===null){next.compartment=pending;group.push(next);}
     else if(next.compartment.startsWith('mouth-'))mouths.add(next.compartment);
    }
   }
  }
  if(mouths.size===1)for(const member of group)member.compartment=[...mouths][0];
 }
}

export function interiorEdges(shape,{bodyId,onProgress,faceSeeds=[],onFaceSelection,onCompartmentFaces}={}){
 let edges;try{edges=resolveFilletEdges(shape);}catch(error){if(error.code==='fillet-selection')return [];throw error;}
 const faces=shape.faces,byHash=new Map(),meshData=cadMesh(shape,{tolerance:.001,angularTolerance:.05}),box=shape.boundingBox;
 let bounds;try{bounds=box.bounds;}finally{box.delete();}
 const diagonal=vec(bounds[1]).distanceTo(vec(bounds[0])),epsilon=Math.max(.006,Math.min(.02,diagonal*1e-5)),tolerance=Math.max(1e-7,diagonal*1e-8);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float64Array(meshData.vertices),3));geometry.setIndex(meshData.triangles);geometry.boundsTree=new MeshBVH(geometry);
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material);mesh.raycast=acceleratedRaycast;mesh.updateMatrixWorld();const ray=new THREE.Raycaster();ray.firstHitOnly=true;ray.near=epsilon*.05;
 const selected=[];
 const seedFaces=[];
 const incidentEdges=new Map();
 const rayHit=(p,direction)=>{ray.set(p,direction);return ray.intersectObject(mesh,false)[0];};
 try{
  for(const seed of faceSeeds){
   let resolved;
   try{
    [resolved]=selectedCadFaces(shape,[seed]);
    const face=faces.find(candidate=>candidate.isSame(resolved));
    if(!face)continue;
    seedFaces.push({seed,face});
    if(!incidentEdges.has(face))incidentEdges.set(face,[]);
   }catch(error){if(error instanceof WebAssembly.RuntimeError)throw error;}
   finally{resolved?.delete();}
  }
  for(const edge of edges){const key=edge.hashCode;if(!byHash.has(key))byHash.set(key,[]);byHash.get(key).push({edge,faces:[]});}
  for(const face of faces){const boundary=face.edges;try{for(const e of boundary)for(const record of byHash.get(e.hashCode)||[])if(record.edge.isSame(e)&&!record.faces.includes(face))record.faces.push(face);}finally{boundary.forEach(e=>e.delete());}}
  const records=[...byHash.values()].flat(),vertexFaces=new Map(),vertexKey=p=>p.map(x=>Math.round(x/Math.max(1e-6,tolerance))).join(',');
  const cavities=openingDirections(faces).map((direction,index)=>({index,...cavitySection(direction,records,meshData,rayHit,epsilon,tolerance)}));
  for(const record of records)for(const t of [0,1]){const key=vertexKey(sample(record.edge,t));if(!vertexFaces.has(key))vertexFaces.set(key,new Set());for(const face of record.faces)vertexFaces.get(key).add(face);}
  for(const [index,record]of records.entries()){
   if(index%20===0)onProgress?.({stage:'開口のある空間の内側を調べています',current:index,total:records.length});
   if(record.faces.length!==2)continue;
   // OCCT differential normals on lofted surfaces are not necessarily unit
   // length. Normalize each before forming the two dihedral bisectors.
   const samples=[];
   for(const t of [.3,.5,.7]){
    const p=sample(record.edge,t),[a,b]=record.faces.map(face=>normal(face,p));
    const offset=a.clone().add(b);
    if(offset.length()<1e-6)break;
    const air=vec(p).addScaledVector(offset.normalize(),epsilon);
    const side=vec(p).addScaledVector(a.clone().sub(b).normalize(),epsilon);
    samples.push({air,side,offset,normals:[a,b]});
   }
   if(samples.length!==3)continue;
   const endpoints=[sample(record.edge,0),sample(record.edge,1)];
   let opening;
   const cavity=cavities.find(({up,rimNeighbors,findMouth})=>{
    if(record.faces.every(face=>rimNeighbors.has(face))){
     const lower=vec(endpoints[0]).dot(up)<vec(endpoints[1]).dot(up)?endpoints[0]:endpoints[1];
     const facing=Math.min(...record.faces.map(face=>normal(face,sample(record.edge,.5)).dot(up)));
     const adjacent=vertexFaces.get(vertexKey(lower));
     if(facing>1e-5&&[...adjacent].some(face=>!record.faces.includes(face)&&normal(face,lower).dot(up)<facing-1e-4))return false;
    }
    opening=findMouth(samples);
    return opening!==null;
   });
   if(!cavity)continue;
   const nearBack=record.faces.some((_,i)=>samples.every(({normals})=>normals[i].dot(cavity.up)>Math.SQRT1_2));
   const compartment=opening.mouth===null?null:'mouth-'+cavity.index+'-'+opening.mouth;
   const edge=record.edge,curved=edge.geomType!=='LINE',segments=curved?Math.min(2048,Math.max(96,Math.ceil(Math.PI*Math.sqrt(diagonal/.02)))):1,points=Array.from({length:segments+1},(_,i)=>sample(edge,i/segments)),length=points.slice(1).reduce((sum,p,i)=>sum+vec(p).distanceTo(vec(points[i])),0),point=sample(edge,.5),reference={point,a:points[0],b:points.at(-1),...(curved?{curved:true}:{})};
   selected.push({bodyId,point,a:points[0],b:points.at(-1),length,points,curved,reference,compartment,direction:cavity.index,corner:nearBack?'back':'side',key:'interior-'+bodyId+'-'+edge.hashCode});
   for(const face of record.faces){
    if(onCompartmentFaces&&!incidentEdges.has(face))incidentEdges.set(face,[]);
    incidentEdges.get(face)?.push(selected.at(-1));
   }
  }
  assignCompartments(selected,vertexKey);
  const compartmentsByFace=new Map([...incidentEdges].map(([face,items])=>[face,new Set(items.map(edge=>edge.compartment))]));
  for(const {seed,face} of seedFaces){
   const adjacent=compartmentsByFace.get(face);
   if(adjacent.size===1){onFaceSelection?.(seed,[...adjacent][0]);continue;}
   const outward=normal(face,seed.point);
   const air=vec(seed.point).addScaledVector(outward,face.geomType==='PLANE'?epsilon:.1);
   let compartment=null;
   for(const cavity of cavities){
    const mouth=cavity.mouthAt(air);
    const id='mouth-'+cavity.index+'-'+mouth;
    if(mouth!=null&&selected.some(edge=>edge.compartment===id)){compartment=id;break;}
   }
   if(compartment&&!adjacent.size)adjacent.add(compartment);
   onFaceSelection?.(seed,compartment,compartment?null:cavities.some(cavity=>cavity.rimFaces.has(face))?'rim':'unmatched');
  }
  if(onCompartmentFaces){
   const groups=new Map(meshData.faceGroups.map(group=>[group.faceId,group]));
   const surfaces=[];
   for(const [face,compartments] of compartmentsByFace){
    if(compartments.size!==1)continue;
    const group=groups.get(face.hashCode);
    if(!group?.count)continue;
    const positions=new Float32Array(group.count*3);
    for(let i=0;i<group.count;i++){
     const vertex=meshData.triangles[group.start+i]*3;
     positions[i*3]=meshData.vertices[vertex];
     positions[i*3+1]=meshData.vertices[vertex+1];
     positions[i*3+2]=meshData.vertices[vertex+2];
    }
    surfaces.push({bodyId,compartment:compartments.values().next().value,positions});
   }
   onCompartmentFaces(surfaces);
  }
  return selected;
 }finally{edges.forEach(e=>e.delete());faces.forEach(f=>f.delete());geometry.boundsTree=null;geometry.dispose();material.dispose();}
}

export function inspectInteriorEdges(bodies,spec,onProgress){
 const exterior=spec.type==='exteriorVerticalEdges';
 const ids=[...new Set(spec.targets||[spec.target])];
 if(!ids.length||ids.length>100||ids.some(id=>!bodies.has(id)))throw Error('辺をまとめて選ぶボディを選択してください');
 const findEdges=exterior?exteriorVerticalEdges:interiorEdges;
 const axis=spec.axis??'Z';
 const faceSeeds=exterior?[]:(spec.faceSeeds??(spec.faceSeed?[spec.faceSeed]:[]));
 const faceResults=new Map(faceSeeds.map(seed=>[seed,{bodyId:seed.bodyId,compartment:null,reason:'unmatched'}]));
 const compartmentFaces=[];
 const edges=ids.flatMap(bodyId=>findEdges(bodies.get(bodyId),{bodyId,onProgress,axis,
  faceSeeds:faceSeeds.filter(seed=>seed.bodyId===bodyId),
  onFaceSelection:(seed,compartment,reason=null)=>faceResults.set(seed,{bodyId,compartment,reason}),
  onCompartmentFaces:!exterior&&spec.includeCompartmentFaces?surfaces=>{for(const face of surfaces)compartmentFaces.push(face);}:undefined,
 }));
 const selection={bodyIds:ids,edgeCount:edges.length};
 const faceSelections=[...faceResults.values()];
 return {edges,...(spec.includeCompartmentFaces&&!exterior?{compartmentFaces}:{}),analysis:exterior?{exteriorVerticalEdges:{...selection,axis}}:{interiorEdges:{...selection,rimIncluded:false,faceSelections,...(spec.faceSeed?{faceCompartment:faceSelections[0]?.compartment??null}:{})}}};
}
