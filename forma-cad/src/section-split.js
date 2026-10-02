import * as THREE from 'three';
import {basisFor} from './frames.js';
const solidBounds=new WeakMap();
function meshBounds(mesh){
 const position=mesh.geometry.attributes.position;let cached=solidBounds.get(mesh.geometry);
 if(!cached||cached.position!==position||cached.version!==position.version){cached={position,version:position.version,box:new THREE.Box3().setFromBufferAttribute(position)};solidBounds.set(mesh.geometry,cached);}
 mesh.updateWorldMatrix(true,false);return cached.box.clone().applyMatrix4(mesh.matrixWorld);
}

export function sectionSplitSpec({target,plane,offset},mesh,id){
 if(!mesh?.visible)throw Error('分離するボディを選択してください。');
 if(!['XY','XZ','YZ'].includes(plane))throw Error('断面の平面を選択してください。');
 if(String(offset).trim()===''||!Number.isFinite(Number(offset)))throw Error('断面位置を数値で指定してください。');
 const distance=Number(offset),axis={XY:'z',XZ:'y',YZ:'x'}[plane],box=meshBounds(mesh);
 const tolerance=Math.max(1e-7,(box.max[axis]-box.min[axis])*1e-8);
 if(box.isEmpty()||distance<=box.min[axis]+tolerance||distance>=box.max[axis]-tolerance)throw Error('断面がボディの内部を横切る位置に動かしてください。');
 const basis=basisFor({plane});
 return {type:'split',id,target,plane,offset:distance,splitFrame:Object.fromEntries(['u','v','n'].map(key=>[key,basis[key].toArray()]))};
}
