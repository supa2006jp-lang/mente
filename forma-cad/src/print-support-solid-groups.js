import * as R from 'replicad';
import {MODEL_PRECISION} from './model-precision.js';
import {fuseSolids} from './solid-fuse.js';

export function supportShapeBounds(shape){
 const box=shape.boundingBox;
 try{return box.bounds;}finally{box.delete();}
}

export function supportBoxesTouch(a,b){
 const gap=MODEL_PRECISION.contact;
 return [0,1,2].every(axis=>a[0][axis]<=b[1][axis]+gap&&a[1][axis]>=b[0][axis]-gap);
}

// Boxes that cannot touch at the native tolerance are independent, even if
// a box contains a cavity or its shape has several shells.
export function supportSolidGroups(shapes){
 const entries=shapes.map(shape=>({shape,box:supportShapeBounds(shape)})),parents=entries.map((_,i)=>i);
 function root(i){
  while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}
  return i;
 }
 for(let i=0;i<entries.length;i++)for(let j=0;j<i;j++){
  if(supportBoxesTouch(entries[i].box,entries[j].box))parents[root(i)]=root(j);
 }
 const groups=new Map();
 for(const [i,entry] of entries.entries()){
  const index=root(i);
  if(!groups.has(index))groups.set(index,[]);
  groups.get(index).push(entry);
 }
 return [...groups.values()];
}

export function fuseSupportSolids(shapes,{onProgress}={}){
 const groups=supportSolidGroups(shapes);
 const checks={onProgress,verifyFinishedMesh:true};
 if(groups.length<=1)return fuseSolids(shapes,checks);
 const pieces=[];
 try{
  for(const group of groups)pieces.push(fuseSolids(group.map(entry=>entry.shape),checks));
  return R.makeCompound(pieces).asShape3D();
 }finally{pieces.forEach(piece=>piece.delete());}
}
