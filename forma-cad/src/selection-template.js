import * as THREE from 'three';
import {defaults,validateFeature} from './geometry.js';
import {basisFor,worldPoint} from './frames.js';
import {planeCoordinates,sketchPoints} from './regions.js';
import {selectedSketchParts} from './sketch-selection.js';
import {previewImageSource} from './project-preview.js';

const fields=['profile','mode','side','plane','width','height','diameter','depth','wall','x','y','z','angle','frame','points','closed','tangents','tangentLengths','arc'];
export function portableSketch(source){
 if(!source||source.kind!=='sketch')throw Error('保存するスケッチのデータが不正です');
 const sketch={...defaults,id:source.id,kind:'sketch',name:(source.name||'スケッチ').slice(0,100),operation:'new',target:'',groupId:source.groupId||source.id};
 for(const key of fields)if(source[key]!==undefined)sketch[key]=structuredClone(source[key]);
 if(sketch.profile!=='spline')delete sketch.arc;
 validateFeature(sketch);return sketch;
}
export function selectedTemplateSketches(features,selection,selectedId=null){
 const chosen=features.filter(f=>f.kind==='sketch'&&(selection.has(f.id)||f.id===selectedId));
 return chosen.flatMap(f=>selection.has(f.id)?selectedSketchParts(f,selection.get(f.id)):[f]).map(portableSketch);
}
export function translateTemplateSketch(source,delta){
 const f=portableSketch(source),d=new THREE.Vector3(...delta),b=basisFor(f);f.x+=d.x;f.y+=d.y;f.z+=d.z;
 if(f.points)f.points=f.points.map(p=>[p[0]+d.dot(b.u),p[1]+d.dot(b.v)]);
 validateFeature(f);return f;
}
export function sketchTemplateVertices(sketch){const r={...sketch,offset:planeCoordinates(sketch).offset};return sketchPoints(sketch).flatMap(p=>worldPoint(r,p).toArray());}
export function validateSelectionTemplate(value){
 // Keep previously saved single-solid files usable through the unified library.
 if(value?.format==='forma-solid-template'&&value.version===1)value={...value,format:'forma-selection-template',origin:[0,0,0],sketches:[],solids:[{name:value.name,brep:value.brep}]};
 if(value?.format!=='forma-selection-template'||value.version!==1||value.units!=='mm'||typeof value.name!=='string'||!value.name.trim()||value.name.length>100||!Array.isArray(value.sketches)||!Array.isArray(value.solids)||!value.sketches.length&&!value.solids.length||value.sketches.length+value.solids.length>100)throw Error('対応する選択部品ファイルではありません（最大100要素）');
 if(!Array.isArray(value.origin)||value.origin.length!==3||value.origin.some(x=>!Number.isFinite(x)||Math.abs(x)>100000))throw Error('部品の配置基準が不正です');
 const sketches=value.sketches.map(portableSketch),solids=value.solids.map(s=>{if(typeof s?.name!=='string'||s.name.length>100||typeof s.brep!=='string'||!s.brep.length||s.brep.length>30000000)throw Error('部品のソリッドデータが不正です');return {name:s.name,brep:s.brep};});
 const ids=new Set();for(const f of sketches){if(typeof f.id!=='string'||!f.id||f.id.length>100||ids.has(f.id)||typeof f.groupId!=='string'||f.groupId.length>100)throw Error('スケッチの識別情報が不正です');ids.add(f.id);}
 return {format:value.format,version:1,units:'mm',category:sketches.length&&solids.length?'mixed':sketches.length?'sketch':'solid',name:value.name.trim(),origin:[...value.origin],sketches,solids,...(previewImageSource(value.preview)?{preview:structuredClone(value.preview)}:{})};
}
