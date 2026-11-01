import * as THREE from 'three';

// Native CIRCLE edges are evidence; a regular polygon's display rim is not.
export function solidBoundaryInfo(shape,id){
 const edges=shape.edges,faces=shape.faces,box=shape.boundingBox;
 try{
  const circles=[];
  for(const edge of edges){
   if(edge.geomType!=='CIRCLE')continue;
   const points=[.11,.43,.79].map(t=>{const p=edge.pointAt(t);try{return new THREE.Vector3(...p.toTuple());}finally{p.delete();}}),[a,b,c]=points,u=b.clone().sub(a),v=c.clone().sub(a),w=u.clone().cross(v),den=2*w.lengthSq();if(den<1e-14)continue;
   const center=a.clone().add(w.clone().cross(u).multiplyScalar(v.lengthSq()/den)).add(v.clone().cross(w).multiplyScalar(u.lengthSq()/den));circles.push({center:center.toArray(),radius:center.distanceTo(a),normal:w.normalize().toArray()});
  }
  const faceKinds=faces.map(f=>{if(f.geomType!=='PLANE')return f.geomType;const n=f.normalAt();try{return ['PLANE',n.toTuple().map(v=>Math.round(v*1e6)/1e6)];}finally{n.delete();}});
  return {id,bounds:box.bounds.map(p=>p.map(v=>Math.round(v*1e6)/1e6)),topology:JSON.stringify([edges.map(e=>e.geomType).sort(),faceKinds]),circles};
 }finally{box.delete();edges.forEach(e=>e.delete());faces.forEach(f=>f.delete());}
}
