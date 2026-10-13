import * as THREE from 'three';

export function constrainMoveDelta(delta,direction='free'){
 const result=delta.clone();
 for(const axis of ['x','y','z'])if(direction!=='free'&&!direction.toLowerCase().includes(axis))result[axis]=0;
 return result;
}

export function movePointKind(ref){
 if(ref.kind==='sketch'||/スケッチ/.test(ref.name||''))return 'sketch';
 if(ref.kind==='vertex'||ref.kind==='midpoint')return ref.kind;
 return 'center';
}

// A fixed view plane and a grab offset keep the first cursor event from jumping.
export function cursorMovePoint(camera,rect,x,y,plane){
 if(rect.width<=0||rect.height<=0)return null;
 camera.updateMatrixWorld(true);
 const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),camera);
 return ray.ray.intersectPlane(plane,new THREE.Vector3());
}

export function movePreviewChildMatrix(base,position,center,quaternion,mirror=false){
 const matrix=base.clone(),n=position.clone().sub(center);
 if(mirror&&n.length()>1e-7){
  n.normalize().applyQuaternion(quaternion.clone().invert());
  matrix.premultiply(new THREE.Matrix4().set(1-2*n.x*n.x,-2*n.x*n.y,-2*n.x*n.z,0,-2*n.y*n.x,1-2*n.y*n.y,-2*n.y*n.z,0,-2*n.z*n.x,-2*n.z*n.y,1-2*n.z*n.z,0,0,0,0,1));
 }
 return matrix;
}

export function createMoveGhost(proxy){
 const ghost=proxy.clone(true);ghost.name='move-destination-ghost';ghost.matrixAutoUpdate=false;
 ghost.traverse(object=>{
  if(!object.material)return;
  const clone=material=>{const result=material.clone();result.transparent=true;result.opacity=object.isMesh?.28:.6;result.depthWrite=false;result.color?.set(0x00a9bd);return result;};
  object.material=Array.isArray(object.material)?object.material.map(clone):clone(object.material);
 });
 return ghost;
}

export function disposeMoveGhost(ghost){
 ghost?.removeFromParent();ghost?.traverse(object=>{for(const material of [].concat(object.material||[]))material.dispose();});
}
