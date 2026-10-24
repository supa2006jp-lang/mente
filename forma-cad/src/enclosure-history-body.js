import * as R from 'replicad';
import {cadMesh} from './cad-mesh.js';
import {solidMeshComplete} from './solid-mesh.js';
import {encloseParts} from './enclose.js';

// Old enclosure outputs may retain inconsistent offset boundaries. Rebuild only
// that derived operation from its saved recipe, never edit an input BREP in place.
export function enclosureHistoryBody(feature,output,source){
 let shape=R.deserializeShape(output.brep).asShape3D(),parts;
 try{
  let complete=false;try{complete=solidMeshComplete(shape,cadMesh(shape));}catch{}if(complete)return shape;
  try{
   parts=encloseParts(source,feature.spec);const index=feature.outputs.findIndex(o=>o.id===output.id);
   if(index<0||!parts[index]||!solidMeshComplete(parts[index],cadMesh(parts[index])))return shape;
   const rebuilt=parts[index].clone();shape.delete();shape=rebuilt;return shape;
  }catch{return shape;}
 }finally{parts?.forEach(s=>s.delete());}
}
