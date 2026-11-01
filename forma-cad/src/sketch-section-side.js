import * as THREE from 'three';
import {basisFor} from './frames.js';

// Clipping retains the positive half-space. Keep the far side of the working
// plane, with a small dead band to avoid flicker when looking along the plane.
export function sketchSectionReverse(face,camera,previous=false){
 const facing=basisFor(face).n.dot(camera.getWorldDirection(new THREE.Vector3()));
 return Math.abs(facing)<.001?previous:facing<0;
}
