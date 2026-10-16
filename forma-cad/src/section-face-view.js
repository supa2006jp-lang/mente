import * as THREE from 'three';
import {basisFor} from './frames.js';
import {sketchViewUp} from './sketch-view.js';

export function sectionFaceView(face,sectionNormal,offset,camera,center,distance){
 if(!face)return null;
 const basis=basisFor(face),direction=face.cadFace?.normal?new THREE.Vector3(...face.cadFace.normal):basis.n.clone();
 if(!direction.toArray().every(Number.isFinite)||direction.lengthSq()<1e-12)return null;
 direction.normalize();
 const target=center.clone().addScaledVector(sectionNormal,offset-center.dot(sectionNormal));
 return {target,position:target.clone().addScaledVector(direction,Math.max(2,distance)),up:sketchViewUp(camera,basis),reverse:direction.dot(sectionNormal)>0};
}
