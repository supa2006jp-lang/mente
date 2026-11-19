import * as THREE from 'three';
import {Brush} from 'three-bvh-csg';
import {cadPosition} from './cad-coordinates.js';

// The preview CSG engine uses Float32 buffers. Subtract the local center
// from the CAD positions before rounding, and carry it in the object matrix.
export function meshCsgData(mesh){
 const source=cadPosition(mesh.geometry),center=new THREE.Box3().setFromBufferAttribute(source).getCenter(new THREE.Vector3());
 const positions=[];
 for(let i=0;i<source.count;i++)positions.push(source.getX(i)-center.x,source.getY(i)-center.y,source.getZ(i)-center.z);
 mesh.updateWorldMatrix(true,false);
 const matrix=mesh.matrixWorld.clone().multiply(new THREE.Matrix4().makeTranslation(center));
 return {positions,indices:mesh.geometry.index?Array.from(mesh.geometry.index.array):null,matrix:matrix.toArray()};
}

export function meshCsgBrush({positions,indices,matrix}){
 const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 if(indices)geometry.setIndex(indices);
 geometry.computeVertexNormals();
 const brush=new Brush(geometry);
 brush.matrixAutoUpdate=false;
 brush.matrix.fromArray(matrix);
 brush.updateMatrixWorld(true);
 return brush;
}
