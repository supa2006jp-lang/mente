import {currentBodyMeshRecords} from './mesh-quality.js';
import {isColorChoice} from './color-choice.js';

export const DEFAULT_VOLUME_COLOR='#a3a197';
export function volumeColorOverride(record,id){
 const feature=record?.feature;
 return feature?.bodyColors?.[id]??feature?.automaticBodyColors?.[id];
}
export function volumeParts(record,id){
 return isColorChoice(volumeColorOverride(record,id))?null:record?.output?.materialParts??null;
}
export function volumeColorRecords(features){
 const records=currentBodyMeshRecords(features);
 return new Map([...records].flatMap(([id,record])=>{const parts=volumeParts(record,id);return parts?.length?[[id,parts]]:[];}));
}
export function validateVolumeParts(parts){
 if(!Array.isArray(parts)||parts.length<2||parts.length>150)throw Error('色別の立体データが不正です');
 let size=0;
 for(const part of parts){
  if(!part||typeof part!=='object')throw Error('色別の立体データが不正です');
  const {color,opacity,vertices,triangles,normals,brep,painted}=part;
  if(!isColorChoice(color)||opacity!==undefined&&(!Number.isFinite(opacity)||opacity<.1||opacity>=1)||painted!==undefined&&typeof painted!=='boolean'||typeof brep!=='string'||!brep.length||!Array.isArray(vertices)||!vertices.length||vertices.length%3||vertices.some(n=>!Number.isFinite(n)||Math.abs(n)>100000)||!Array.isArray(triangles)||!triangles.length||triangles.length%3||triangles.some(i=>!Number.isInteger(i)||i<0||i>=vertices.length/3)||normals!==undefined&&(!Array.isArray(normals)||normals.length!==vertices.length||normals.some(n=>!Number.isFinite(n))))throw Error('色別の立体データが不正です');
  size+=vertices.length+triangles.length;
 }
 if(size>12000000)throw Error('色別の立体データが大きすぎます');
}
