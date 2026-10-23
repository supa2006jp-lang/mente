import * as R from 'replicad';
import {portableSketch,translateTemplateSketch,sketchTemplateVertices,validateSelectionTemplate} from './selection-template.js';
import {vertexBounds} from './template-placement.js';
import {verifiedCadMesh} from './verified-cad-mesh.js';
import {serializeCadShape} from './cad-serialization.js';

export function exportSelectionTemplate(features,spec,bodiesFor,onProgress){
 const targets=spec.targets||[],sketches=(spec.sketches||[]).map(portableSketch);
 if(!targets.length&&!sketches.length)throw Error('保存するスケッチまたはソリッドを選択してください');
 if(targets.length+sketches.length>100||new Set(targets.map(t=>t.id)).size!==targets.length)throw Error('選択部品は100要素までです');
 const bodies=targets.length?bodiesFor(features):new Map(),bounds=[];
 try{
  for(const target of targets){const shape=bodies.get(target.id);if(!shape)throw Error('保存するソリッドが見つかりません');bounds.push(vertexBounds(shape.mesh().vertices));}
  for(const sketch of sketches)bounds.push(vertexBounds(sketchTemplateVertices(sketch)));
  const min=[0,1,2].map(i=>Math.min(...bounds.map(b=>b.min[i]))),max=[0,1,2].map(i=>Math.max(...bounds.map(b=>b.max[i]))),origin=[(min[0]+max[0])/2,(min[1]+max[1])/2,min[2]],delta=origin.map(x=>-x),solids=[];
  for(const [i,target]of targets.entries()){onProgress?.({stage:'選択したソリッドを保存しています',current:i+1,total:targets.length});const shape=bodies.get(target.id).clone().translate(delta);try{solids.push({name:target.name||'ソリッド',brep:serializeCadShape(shape)});}finally{shape.delete();}}
  return validateSelectionTemplate({format:'forma-selection-template',version:1,units:'mm',name:spec.name,origin,sketches:sketches.map(f=>translateTemplateSketch(f,delta)),solids});
 }finally{bodies.forEach(s=>s.delete());}
}
export function importSelectionTemplate(spec,onProgress){
 const data=validateSelectionTemplate(spec.data),position=spec.position||[0,0,0];
 if(typeof spec.id!=='string'||!spec.id||spec.id.length>60||position.length!==3||position.some(x=>!Number.isFinite(x)||Math.abs(x)>10000))throw Error('貼り付け位置が不正です');
 const features=[],groups=new Map();
 for(const [i,source]of data.sketches.entries()){const f=translateTemplateSketch(source,position);if(!groups.has(source.groupId))groups.set(source.groupId,spec.id+'-group-'+groups.size);features.push({...f,id:spec.id+'-sketch-'+i,groupId:groups.get(source.groupId),groupHidden:false});}
 for(const [i,source]of data.solids.entries()){
  onProgress?.({stage:'保存したソリッドを読み込んでいます',current:i+1,total:data.solids.length});let shape,placed;
  try{
   shape=R.deserializeShape(source.brep).asShape3D();if(!(R.measureVolume(shape)>1e-8))throw Error('部品に立体形状がありません');
   placed=shape.clone().translate(position);const check=new (R.getOC().BRepCheck_Analyzer)(placed.wrapped,true,false);try{if(!check.IsValid())throw Error('部品の形状が不正です');}finally{check.delete();}
   const mesh=verifiedCadMesh(placed,{tolerance:.08,angularTolerance:.15}),id=spec.id+'-solid-'+i,faces=placed.faces;let planarFaces;try{planarFaces=faces.filter(f=>f.geomType==='PLANE').map(f=>f.hashCode);}finally{faces.forEach(f=>f.delete());}
   features.push({kind:'cadop',id,name:source.name||data.name,outputs:[{id,...mesh,cadCoordinatePrecision:true,planarFaces:mesh.planarFaces||planarFaces,brep:serializeCadShape(placed)}],remove:[]});
  }finally{placed?.delete();shape?.delete();}
 }
 return {features};
}
