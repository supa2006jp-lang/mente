import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {basisFor} from './frames.js';

export function validateExtrusionSymmetry(f){
 if(f.symmetric!==undefined&&typeof f.symmetric!=='boolean')throw Error('押し出し方向の設定が不正です');
 if(f.symmetric&&(f.untilSolid||f.gridExtentPlane))throw Error('対称押し出しでは片側の到達面を指定できません。片側に切り替えてください');
}

// The two tapered halves meet at the sketch plane. Remove their shared caps
// so the preview/STL contains only the outside surface of the combined body.
export function symmetricSurface(parts,feature){
 const n=basisFor(feature.region||feature).n,offset=feature.region?.offset??n.dot(new THREE.Vector3(feature.x,feature.y,feature.z));
 const tolerance=Math.max(1e-5,Math.abs(offset)*2e-7),surfaces=[];
 try{
  for(const original of parts){
   const g=original.index?original.toNonIndexed():original,p=g.attributes.position,keep=[],v=new THREE.Vector3();
   let scale=Math.abs(offset);for(const coordinate of p.array)scale=Math.max(scale,Math.abs(coordinate));const planeTolerance=Math.max(tolerance,scale*2e-7);
   for(let i=0;i<p.count;i+=3)if(![0,1,2].every(j=>Math.abs(v.fromBufferAttribute(p,i+j).dot(n)-offset)<planeTolerance))keep.push(i,i+1,i+2);
   const surface=new THREE.BufferGeometry();
   for(const [name,attribute] of Object.entries(g.attributes)){const values=[];for(const i of keep)for(let j=0;j<attribute.itemSize;j++)values.push(attribute.array[i*attribute.itemSize+j]);surface.setAttribute(name,new THREE.BufferAttribute(new attribute.array.constructor(values),attribute.itemSize,attribute.normalized));}
   surfaces.push(surface);if(g!==original)g.dispose();
  }
  return mergeGeometries(surfaces);
 }finally{for(const surface of surfaces)surface.dispose();}
}
