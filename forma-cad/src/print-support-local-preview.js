import * as R from 'replicad';
import {cadSubshapes} from './cad-topology.js';
import {MODEL_PRECISION} from './model-precision.js';
import {supportNonDestructiveBoolean} from './print-support-boolean.js';
import {supportBoxesTouch,supportShapeBounds as bounds} from './print-support-solid-groups.js';

const {topology}=MODEL_PRECISION;
const overlaps=(a,b)=>a[0].every((v,k)=>v<=b[1][k]+topology&&a[1][k]>=b[0][k]-topology);
const contains=(a,b)=>a[0].every((v,k)=>v<=b[0][k]+topology&&a[1][k]>=b[1][k]-topology);
const maxRibsPerCut=4;

function cutGrooves(base,masks){
 let shape=base;
 try{
  for(const {shape:mask} of masks){
   const next=supportNonDestructiveBoolean('cut',shape,mask);
   shape.delete();
   shape=next;
  }
  const result=shape;
  shape=null;
  return result;
 }finally{shape?.delete();}
}

function cutRibBatch(batch){
 const copies=[],cuts=[];
 let cut,solids=[];
 try{
  for(const {shape} of batch)copies.push(shape.clone());
  cut=cutGrooves(R.makeCompound(copies),batch[0].masks);
  solids=cadSubshapes(cut,'solid');
  const byRib=batch.map(()=>[]);
  for(const solid of solids){
   const box=bounds(solid),owner=batch.findIndex(rib=>contains(rib.box,box));
   if(owner===-1)return null;
   byRib[owner].push(solid);
  }
  // An empty rib can be valid, but requires the individual cut to confirm it.
  if(byRib.some(parts=>!parts.length))return null;
  for(const parts of byRib){
   cuts.push(parts.length===1?parts[0].clone():R.makeCompound(parts));
  }
  return cuts;
 }catch(error){
  cuts.forEach(shape=>shape.delete());
  if(error instanceof WebAssembly.RuntimeError)throw error;
  return null;
 }finally{
  cut?.delete();
  solids.forEach(solid=>solid.delete());
  copies.forEach(copy=>copy.delete());
 }
}

// (source minus grooves) intersect tool == (source intersect tool) minus grooves.
// Clip the simple source first, instead of repeatedly intersecting thousands of
// grooved faces to prepare a small contact/rib highlight.
export function supportLocalPreview(source,masks,maskRecipes){
 const parts=cadSubshapes(source,'solid');
 let pieces,tools;
 try{
  pieces=parts.map(shape=>({shape,box:bounds(shape)}));
  tools=masks.map((shape,index)=>({shape,index,box:bounds(shape),key:maskRecipes?.get(shape)}));
 }catch(error){parts.forEach(part=>part.delete());throw error;}

 function clip(tool,{contained=false}={}){
  const box=bounds(tool),results=[];
  try{
   // An unwindowed rib is already a subset of the union.
   for(const part of contained?[{shape:tool,box}]:pieces){
    if(!overlaps(part.box,box))continue;
    const relevant=tools.filter(mask=>overlaps(mask.box,box)&&overlaps(mask.box,part.box));
    const base=contained?tool.clone():supportNonDestructiveBoolean('common',part.shape,tool);
    results.push(cutGrooves(base,relevant));
   }
   return results.length===1?results.pop():R.makeCompound(results);
  }finally{results.forEach(part=>part.delete());}
 }

 function* meshSteps(records,{contained=false,cache,meshShape,onRib}){
  const groups=new Map(),meshes=[];
  const entries=records.map(({shape})=>{
   if(!contained)return {shape};
   const box=bounds(shape),masks=tools.filter(mask=>overlaps(mask.box,box));
   // Only grooves that meet an unwindowed rib can affect its mesh.
   const key=cache&&JSON.stringify([shape.serialize(),...masks.map(mask=>mask.key??=mask.shape.serialize())]);
   const saved=key&&cache.get(key);
   const entry={shape,box,masks,key,saved};
   if(saved||!masks.length)return entry;

   const maskSet=masks.map(mask=>mask.index).join(',');
   if(!groups.has(maskSet))groups.set(maskSet,[]);
   const batches=groups.get(maskSet);
   // Distinct bounds let us assign the cut solids to their original ribs.
   // Keep batches small so previews can yield between native cuts.
   let batch=batches.find(batch=>batch.length<maxRibsPerCut&&!batch.some(rib=>supportBoxesTouch(box,rib.box)));
   if(!batch){batch=[];batches.push(batch);}
   batch.push(entry);
   entry.batch=batch;
   return entry;
  });
  try{
   for(const [index,entry] of entries.entries()){
    onRib?.(records[index],index);
    yield;
    if(entry.saved){meshes.push(structuredClone(entry.saved));continue;}
    const batch=entry.batch;
    if(batch?.length>1){
     const cuts=cutRibBatch(batch);
     for(const [offset,rib] of batch.entries()){
      rib.cut=cuts?.[offset];
      rib.batch=null;
     }
    }
    const cut=entry.cut??(contained?cutGrooves(entry.shape.clone(),entry.masks):clip(entry.shape));
    try{
     const mesh=meshShape(cut),key=entry.key;
     if(key)cache.set(key,structuredClone(mesh),key.length+8*(mesh.vertices.length+mesh.triangles.length+(mesh.normals?.length||0)));
     meshes.push(mesh);
    }finally{entry.cut=null;cut.delete();}
   }
   return meshes;
  }finally{entries.forEach(entry=>entry.cut?.delete());}
 }

 return {clip,meshSteps,delete(){parts.forEach(part=>part.delete());}};
}
