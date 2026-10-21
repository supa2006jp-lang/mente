import * as THREE from 'three';

const tuple=vector=>{try{return vector.toTuple();}finally{vector.delete();}};
function wirePoints(wire){
 const edges=wire.edges;
 try{
  if(edges.some(edge=>edge.geomType!=='LINE'))return null;
  const remaining=edges.map(edge=>[tuple(edge.startPoint),tuple(edge.endPoint)]),first=remaining.shift();
  if(!first)return null;
  const points=[first[0]],distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));let end=first[1];
  while(remaining.length){
   points.push(end);const index=remaining.findIndex(pair=>pair.some(p=>distance(p,end)<1e-8));
   if(index<0)return null;
   const pair=remaining.splice(index,1)[0];end=distance(pair[0],end)<1e-8?pair[1]:pair[0];
  }
  return distance(end,points[0])<1e-8?points:null;
 }finally{edges.forEach(edge=>edge.delete());}
}
function planarTriangles(face){
 if(face.geomType!=='PLANE')return null;
 const outer=face.clone().outerWire(),holes=face.clone().innerWires();
 try{
  const rings=[outer,...holes].map(wirePoints);if(rings.some(r=>!r||r.length<3))return null;
  const n=new THREE.Vector3(...tuple(face.normalAt())).normalize(),reference=Math.abs(n.x)<.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0),u=reference.addScaledVector(n,-reference.dot(n)).normalize(),v=n.clone().cross(u),origin=new THREE.Vector3(...rings[0][0]);
  const projected=rings.map(r=>r.map(p=>{const q=new THREE.Vector3(...p).sub(origin);return new THREE.Vector2(q.dot(u),q.dot(v));})),points=rings.flat(),triangles=THREE.ShapeUtils.triangulateShape(projected[0],projected.slice(1));
  return {vertices:points.flat(),normals:points.flatMap(()=>n.toArray()),triangles:triangles.flatMap(t=>{const [a,b,c]=t.map(i=>new THREE.Vector3(...points[i]));return b.sub(a).cross(c.sub(a)).dot(n)<0?[t[0],t[2],t[1]]:t;})};
 }finally{outer.delete();holes.forEach(wire=>wire.delete());}
}

// Re-triangulate straight planar wires only after native meshing fails its
// area/volume checks. Exact CAD geometry and curved face meshes stay intact.
export function repairStraightPlanarMesh(shape,mesh){
 const result={vertices:[],normals:[],triangles:[],faceGroups:[],planarFaces:[]},faces=shape.faces;
 try{
  for(const face of faces){
   const faceId=face.hashCode,start=result.triangles.length,base=result.vertices.length/3,repaired=planarTriangles(face);
   if(face.geomType==='PLANE')result.planarFaces.push(faceId);
   if(repaired){result.vertices.push(...repaired.vertices);result.normals.push(...repaired.normals);result.triangles.push(...repaired.triangles.map(i=>base+i));}
   else for(const group of mesh.faceGroups.filter(g=>g.faceId===faceId))for(let i=group.start;i<group.start+group.count;i++){
    const index=mesh.triangles[i]*3;result.triangles.push(result.vertices.length/3);result.vertices.push(...mesh.vertices.slice(index,index+3));result.normals.push(...mesh.normals.slice(index,index+3));
   }
   result.faceGroups.push({faceId,start,count:result.triangles.length-start});
  }
  return result;
 }finally{faces.forEach(face=>face.delete());}
}
