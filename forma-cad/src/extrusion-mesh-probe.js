import * as THREE from 'three';
import {extrusionCutMatches} from './extrusion-auto-cut.js';
import {outwardExtrusion} from './extrusion-direction.js';
// Only the render meshes and their world transforms are needed for the
// automatic operation decision. Photos and CAD history never cross this path.
export function extrusionProbeBodies(meshes){return [...meshes].filter(([,m])=>m.visible).map(([id,m])=>{m.updateWorldMatrix(true,false);return {id,positions:Array.from(m.geometry.attributes.position.array),indices:m.geometry.index?Array.from(m.geometry.index.array):null,matrix:m.matrixWorld.toArray()};});}
export function meshExtrusionProbe(spec){
 const bodies=new Map();try{for(const value of spec.bodies){const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(value.positions,3));if(value.indices)g.setIndex(value.indices);g.computeVertexNormals();g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(value.positions.length/3*2),2));const m=new THREE.Mesh(g);m.matrix.fromArray(value.matrix).decompose(m.position,m.quaternion,m.scale);m.updateMatrixWorld(true);bodies.set(value.id,m);}return spec.direction?{features:spec.features.map(f=>outwardExtrusion(f,bodies))}:{matches:extrusionCutMatches(spec.feature,bodies,spec.source)};}finally{for(const m of bodies.values()){m.geometry.dispose();m.material.dispose();}}
}
