import {cadPosition} from './cad-coordinates.js';
import * as THREE from 'three';
import {basisFor,validateFrame} from './frames.js';
const solidBounds=new WeakMap();
const projectedRanges=new WeakMap();
function meshBounds(mesh){
 const position=cadPosition(mesh.geometry);let cached=solidBounds.get(mesh.geometry);
 if(!cached||cached.position!==position||cached.version!==position.version){cached={position,version:position.version,box:new THREE.Box3().setFromBufferAttribute(position)};solidBounds.set(mesh.geometry,cached);}
 mesh.updateWorldMatrix(true,false);return cached.box.clone().applyMatrix4(mesh.matrixWorld);
}

export function sectionBasis(plane,frame){
 if(plane==='CUSTOM'){validateFrame(frame);return basisFor({frame});}
 if(!['XY','XZ','YZ'].includes(plane))throw Error('断面の平面を選択してください。');
 return basisFor({plane});
}
export function sectionFaceOrientation(face){
 if(!face)return null;
 const basis=basisFor(face),frame=Object.fromEntries(['u','v','n'].map(key=>[key,basis[key].toArray()]));validateFrame(frame);
 for(const plane of ['XY','XZ','YZ'])if(Math.abs(basis.n.dot(basisFor({plane}).n))>1-1e-8)return {plane};
 return {plane:'CUSTOM',frame};
}
function normalRange(mesh,plane,frame){
 const basis=sectionBasis(plane,frame),box=meshBounds(mesh),axis={XY:'z',XZ:'y',YZ:'x'}[plane];
 if(axis)return [box.min[axis],box.max[axis]];
 // Cache exact vertex projections: a rotated AABB can extend beyond the solid.
 const position=cadPosition(mesh.geometry),key=[...basis.n.toArray(),...mesh.matrixWorld.elements].join(','),old=projectedRanges.get(mesh.geometry);
 if(old?.key===key&&old.position===position&&old.version===position.version)return old.range;
 let min=Infinity,max=-Infinity;const point=new THREE.Vector3();
 for(let i=0;i<position.count;i++){const d=point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld).dot(basis.n);min=Math.min(min,d);max=Math.max(max,d);}
 const range=[min,max];projectedRanges.set(mesh.geometry,{key,position,version:position.version,range});return range;
}
export function sectionSplitSpec({target,plane,frame,offset,keep='both'},mesh,id){
 if(!mesh?.visible)throw Error('分離するボディを選択してください。');
 const basis=sectionBasis(plane,frame);
 if(String(offset).trim()===''||!Number.isFinite(Number(offset)))throw Error('断面位置を数値で指定してください。');
 if(!['both','positive','negative'].includes(keep))throw Error('残す側を選択してください。');
 const distance=Number(offset),[min,max]=normalRange(mesh,plane,frame),tolerance=Math.max(1e-7,(max-min)*1e-8);
 if(!Number.isFinite(min)||distance<=min+tolerance||distance>=max-tolerance)throw Error('断面がボディの内部を横切る位置に動かしてください。');
 return {type:'split',sectionSplit:true,keep,id,target,plane,offset:distance,splitFrame:Object.fromEntries(['u','v','n'].map(key=>[key,basis[key].toArray()]))};
}

export function sectionCenter(mesh,plane,frame){
 if(!mesh?.visible)throw Error('中央に合わせるボディを選択してください。');
 const basis=sectionBasis(plane,frame);
 return meshBounds(mesh).getCenter(new THREE.Vector3()).dot(basis.n);
}
export const sectionColors={negative:0x6cafd2,positive:0xe4aa55};
export function isSectionSplit(feature){return feature.kind==='cadop'&&feature.spec?.type==='split'&&(feature.spec.sectionSplit||feature.name==='断面で分離');}
export function sectionBodyStyles(features){
 const styles=new Map();
 for(const f of features){
  const result=f.cadResult||(f.kind==='cadop'?f:null);if(!result)continue;
  const inherited=styles.get(f.spec?.target);for(const id of result.remove||[])styles.delete(id);
  if(isSectionSplit(f))for(const output of result.outputs){const side=f.spec.keep==='positive'?'positive':output.id===f.spec.target?'negative':'positive',axis={XY:'Z',XZ:'Y',YZ:'X'}[f.spec.plane];styles.set(output.id,{color:f.spec.colorize===false?undefined:sectionColors[side],side,label:(side==='positive'?'＋':'−')+(axis||'')+'側'});}
  else if(inherited)for(const output of result.outputs)if(!styles.has(output.id))styles.set(output.id,inherited);
 }
 return styles;
}
