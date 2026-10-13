import * as THREE from 'three';
import {solidVertexPoints} from './vertex-points.js';
import {mergedEdgeMidpoints} from './move-edge-midpoints.js';

// Moving and rotating use geometric references, never the sampled rim vertices.
export function moveBodyPointReferences(mesh){
 mesh.updateMatrixWorld(true);const edges=mesh.children[0],geometry=edges?.geometry,refs=[],placed=[];
 const add=(ref,matrix)=>{const point=new THREE.Vector3(...ref.point).applyMatrix4(matrix);if(placed.some(p=>p.distanceToSquared(point)<1e-6))return;placed.push(point);refs.push({...ref,point:point.toArray(),owner:mesh.uuid});};
 for(const ref of mesh.userData.references||[])if(ref.kind!=='midpoint')add({...ref,name:ref.name==='ソリッド面'?'面の中心':ref.name},mesh.matrixWorld);
 for(const ref of mergedEdgeMidpoints(geometry,(mesh.userData.references||[]).filter(r=>r.kind==='midpoint')))add(ref,edges.matrixWorld);
 const arcs=[...new Set(geometry?.userData.arcEdges?.values()||[])],rimCurves=new Set([...(geometry?.userData.circularEdges?.values()||[]),...arcs]);
 for(const curve of rimCurves)if(curve.center)add({point:curve.center,name:'円・円弧の中心',kind:'center'},edges.matrixWorld);
 const positions=geometry?.attributes.position,nodes=new Map(),key=p=>p.toArray().map(v=>Math.round(v*1e4)).join(',');
 for(let i=0;i<(positions?.count||0);i+=2){
  if(geometry.userData.circularEdges?.has(i)||geometry.userData.arcEdges?.has(i))continue;
  const a=new THREE.Vector3().fromBufferAttribute(positions,i),b=new THREE.Vector3().fromBufferAttribute(positions,i+1);if(a.distanceToSquared(b)<1e-12)continue;
  for(const [point,other]of [[a,b],[b,a]]){const id=key(point),directions=nodes.get(id)||[];directions.push(other.clone().sub(point).normalize());nodes.set(id,directions);}
 }
 const arcEnds=new Set(arcs.flatMap(a=>[a.points[0],a.points.at(-1)]).map(p=>key(new THREE.Vector3(...p))));
 const circles=[...new Set(geometry?.userData.circularEdges?.values()||[])].filter(c=>c.points?.length>=3&&c.radius).map(c=>{const a=new THREE.Vector3(...c.points[0]),b=new THREE.Vector3(...c.points[Math.floor(c.points.length/3)]),d=new THREE.Vector3(...c.points[Math.floor(c.points.length*2/3)]);return {...c,center:new THREE.Vector3(...c.center),normal:b.sub(a).cross(d.sub(a)).normalize()};});
 for(const point of solidVertexPoints(geometry)){
  const id=key(new THREE.Vector3(...point)),directions=nodes.get(id)||[];
  // Boolean T junctions and duplicated rim chords can hide the arc metadata.
  // A nearly continuous tangent is a subdivision, not a new corner.
  if(!arcEnds.has(id)&&directions.some(a=>directions.some(b=>a.dot(b)<-.98)))continue;
  const vertex=new THREE.Vector3(...point),circle=circles.find(c=>{const delta=vertex.clone().sub(c.center),tolerance=Math.max(.001,c.radius*.0003);return Math.abs(delta.dot(c.normal))<tolerance&&Math.abs(delta.length()-c.radius)<tolerance;});
  if(circle&&!arcEnds.has(id)){const radial=vertex.clone().sub(circle.center).normalize();if(!directions.some(d=>Math.abs(d.dot(circle.normal))<.01&&Math.abs(d.dot(radial))>.2))continue;}
  add({point,name:'頂点',kind:'vertex'},edges.matrixWorld);
 }
 return refs;
}
