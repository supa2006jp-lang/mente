import * as R from 'replicad';import {cadSubshapes} from './cad-topology.js';
const bounds=s=>{const box=s.boundingBox;try{return box.bounds.map(p=>[...p]);}finally{box.delete();}},overlaps=(a,b)=>a[0].every((v,k)=>v<=b[1][k]+1e-7&&a[1][k]>=b[0][k]-1e-7);
// (source minus grooves) intersect tool == (source intersect tool) minus grooves.
// Clip the simple source first, instead of repeatedly intersecting thousands of
// grooved faces to prepare a small contact/rib highlight. Final CAD is unchanged.
export function supportLocalPreview(source,masks){
 const parts=cadSubshapes(source,'solid');let pieces,tools;try{pieces=parts.map(shape=>({shape,box:bounds(shape)}));tools=masks.map(shape=>({shape,box:bounds(shape)}));}catch(error){parts.forEach(p=>p.delete());throw error;}
 return {clip(tool){const box=bounds(tool),results=[];try{for(const part of pieces){if(!overlaps(part.box,box))continue;let shape=part.shape.intersect(tool);try{for(const mask of tools)if(overlaps(mask.box,box)&&overlaps(mask.box,part.box)){const next=shape.cut(mask.shape);shape.delete();shape=next;}results.push(shape);shape=null;}finally{shape?.delete();}}return results.length===1?results.pop():R.makeCompound(results);}finally{results.forEach(p=>p.delete());}},delete(){parts.forEach(p=>p.delete());}};
}
