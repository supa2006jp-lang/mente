import * as R from 'replicad';
import * as THREE from 'three';

// A boolean can be a valid solid while silently dropping a swept ridge. Check
// its exposed native surfaces, independently of the display tessellation.
export function verifyThreadRidges(result,ridges,{origin,normal},root,length){
 let checked=0;
 for(const ridge of ridges){
  const faces=ridge.faces,candidates=[];
  try{for(const face of faces){
   if(face.geomType!=='BSPLINE_SURFACE')continue;
    const point=face.pointOnSurface(.5,.5);
    try{
     const position=new THREE.Vector3(...point.toTuple()),delta=position.clone().sub(origin),z=delta.dot(normal),radius=delta.addScaledVector(normal,-z).length();
     if(z<=.001||z>=length-.001||radius<=root+.01)continue;
     candidates.push({point:position.toArray(),radius});
    }finally{point.delete();}
  }}finally{faces.forEach(face=>face.delete());}
  // A continuous spine has one crest face per turn. Sample those faces rather
  // than repeatedly querying the same flanks, including their buried portions.
  const threshold=root+(Math.max(root,...candidates.map(c=>c.radius))-root)*.8;
  for(const candidate of candidates){
   if(candidate.radius<threshold)continue;
   const vertex=R.makeVertex(candidate.point);
   try{
    if(R.measureDistanceBetween(ridge,vertex)>1e-5)continue;
    if(R.measureDistanceBetween(result,vertex)>1e-4)throw Error('結合後のねじ山を保持できませんでした');
    checked++;
   }finally{vertex.delete();}
  }
 }
 if(!checked)throw Error('ねじ山の形状を確認できませんでした');
 return checked;
}
