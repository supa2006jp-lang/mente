import {MODEL_PRECISION} from './model-precision.js';
import * as THREE from 'three';
import {firstMoveContact} from './move-until-contact.js';

// Express the world in coordinates whose +X is the selected face's normal.
// Share geometry; these temporary objects never render or own/dispose buffers.
export function faceMoveContact(moving,targets,normal,{allowTouching=false}={}){
 const direction=new THREE.Vector3(...normal);
 if(!direction.toArray().every(Number.isFinite)||direction.lengthSq()<1e-16)return null;
 direction.normalize();
 const rotation=new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(direction,new THREE.Vector3(1,0,0)));
 function aligned(object){
  object.updateWorldMatrix(true,true);const group=new THREE.Group();
  object.traverseVisible(child=>{if(!child.isMesh||!child.geometry?.attributes.position)return;const mesh=new THREE.Mesh(child.geometry,child.material);mesh.matrixAutoUpdate=false;mesh.matrix.multiplyMatrices(rotation,child.matrixWorld);group.add(mesh);});
  return group;
 }
 if(!moving?.visible)return null;
 const others=targets.filter(m=>m&&m!==moving&&m.visible),source=aligned(moving),copies=others.map(aligned),hit=firstMoveContact(source,copies,0,1);
 if(!hit||!allowTouching&&hit.distance<=MODEL_PRECISION.topology)return null;
 const translation=direction.multiplyScalar(hit.distance).toArray().map(v=>Math.abs(v)<1e-10?0:v);
 if(translation.some(v=>Math.abs(v)>10000))return null;
 return {mesh:others[copies.indexOf(hit.mesh)],distance:hit.distance,translation};
}
