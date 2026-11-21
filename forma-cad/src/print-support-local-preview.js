import * as R from 'replicad';import {cadSubshapes} from './cad-topology.js';
import {supportNonDestructiveBoolean} from './print-support-boolean.js';
const bounds=s=>{const box=s.boundingBox;try{return box.bounds.map(p=>[...p]);}finally{box.delete();}},overlaps=(a,b)=>a[0].every((v,k)=>v<=b[1][k]+1e-7&&a[1][k]>=b[0][k]-1e-7);
// (source minus grooves) intersect tool == (source intersect tool) minus grooves.
// Clip the simple source first, instead of repeatedly intersecting thousands of
// grooved faces to prepare a small contact/rib highlight. Final CAD is unchanged.
export function supportLocalPreview(source,masks){
 const parts=cadSubshapes(source,'solid');let pieces,tools;try{pieces=parts.map(shape=>({shape,box:bounds(shape)}));tools=masks.map(shape=>({shape,box:bounds(shape)}));}catch(error){parts.forEach(p=>p.delete());throw error;}
 function clip(tool,{contained=false}={}){
  const box=bounds(tool),results=[];
  try{
   // An unwindowed rib is already a subset of the union.
   for(const part of contained?[{shape:tool,box}]:pieces){
    if(!overlaps(part.box,box))continue;
    let shape=contained?tool.clone():supportNonDestructiveBoolean('common',part.shape,tool);
    try{
     for(const mask of tools)if(overlaps(mask.box,box)&&overlaps(mask.box,part.box)){const next=supportNonDestructiveBoolean('cut',shape,mask.shape);shape.delete();shape=next;}
     results.push(shape);shape=null;
    }finally{shape?.delete();}
   }
   return results.length===1?results.pop():R.makeCompound(results);
  }finally{results.forEach(p=>p.delete());}
 }
 return {clip,mesh(tool,{contained=false,cache,meshShape}){
  const box=contained&&cache?bounds(tool):null;
  // For an unwindowed rib the rest of the assembly cannot affect its mesh.
  // Only grooves whose bounds meet the rib are applied by clip().
  const key=box?JSON.stringify([tool.serialize(),...tools.filter(mask=>overlaps(mask.box,box))
   .map(mask=>mask.brep??=mask.shape.serialize())]):null;
  const saved=key&&cache.get(key);
  if(saved)return structuredClone(saved);
  const shape=clip(tool,{contained});
  try{
   const mesh=meshShape(shape);
   if(key)cache.set(key,structuredClone(mesh),key.length+8*(mesh.vertices.length+mesh.triangles.length+(mesh.normals?.length||0)));
   return mesh;
  }finally{shape.delete();}
 },delete(){parts.forEach(p=>p.delete());}};
}
