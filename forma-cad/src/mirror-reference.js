import * as R from 'replicad';
import * as THREE from 'three';
const tuple=v=>{try{return v.toTuple();}finally{v.delete();}};
export function nativeMirrorPlane(bodies,reference){
 const shape=bodies.get(reference.bodyId);if(!shape)throw Error('ミラーの基準ボディが見つかりません');
 const faces=shape.faces,point=R.makeVertex(reference.point),normal=new THREE.Vector3(...reference.normal).normalize();
 try{
  const matches=faces.filter(f=>f.geomType==='PLANE'&&new THREE.Vector3(...tuple(f.normalAt())).normalize().dot(normal)>.999999).map(face=>({face,d:R.measureDistanceBetween(point,face)})).sort((a,b)=>a.d-b.d);
  if(!matches.length||matches[0].d>.2)throw Error('ミラーの基準面を選び直してください');
  const face=matches[0].face,n=new THREE.Vector3(...tuple(face.normalAt())).normalize(),offset=n.dot(new THREE.Vector3(...tuple(face.center)));
  return {mirrorNormal:n.toArray(),mirrorOrigin:n.multiplyScalar(offset).toArray()};
 }finally{point.delete();faces.forEach(f=>f.delete());}
}
