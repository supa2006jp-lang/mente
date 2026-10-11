import * as THREE from 'three';
export function threadCylinderInfo(base,surfacePoint){
 const point=new THREE.Vector3(...surfacePoint),faces=base.faces;
 try{for(const face of faces){
  if(face.geomType!=='CYLINDRE')continue;
  const surface=face.surface,cyl=surface.wrapped.Cylinder(),loc=cyl.Location(),axis=cyl.Axis(),dir=axis.Direction();
  try{
   const origin=new THREE.Vector3(loc.X(),loc.Y(),loc.Z()),normal=new THREE.Vector3(dir.X(),dir.Y(),dir.Z()),bounds=face.UVBounds;
   const delta=point.clone().sub(origin),v=delta.dot(normal),radius=cyl.Radius(),radial=delta.addScaledVector(normal,-v);
   if(Math.abs(radial.length()-radius)<.3&&v>=bounds.vMin-.1&&v<=bounds.vMax+.1){
    const n=face.normalAt(point.toArray());try{return {origin:origin.addScaledVector(normal,bounds.vMin),normal,radius,internal:new THREE.Vector3(...n.toTuple()).dot(radial)<0,height:bounds.vMax-bounds.vMin,fromTop:v>(bounds.vMin+bounds.vMax)/2};}finally{n.delete();}
   }
  }finally{dir.delete();axis.delete();loc.delete();cyl.delete();surface.delete();}
 }}finally{faces.forEach(f=>f.delete());}
 return null;
}
