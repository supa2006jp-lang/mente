import * as R from 'replicad';
import {cadMesh} from './cad-mesh.js';
import {THREAD_DISPLAY_MESH,STL_MESH} from './mesh-quality.js';
import {inspectStlMesh,stlInspectionSummary} from './stl-mesh-health.js';
import {inspectCadStl} from './stl-cad-inspection.js';

export function meshBrep(brep,options){
 const shape=R.deserializeShape(brep).asShape3D();
 try{
  // A finer triangulation may be embedded in older BREP files. Remesh an
  // independent native shape; never clean or retessellate a cached CAD input.
  R.getOC().BRepTools.Clean(shape.wrapped,false);
  const mesh=cadMesh(shape,options),faces=shape.faces;
  try{if(!mesh.triangles.length)throw Error('立体が空です');return {...mesh,planarFaces:faces.filter(f=>f.geomType==='PLANE').map(f=>f.hashCode),cadCoordinatePrecision:true};}
  finally{faces.forEach(face=>face.delete());}
 }finally{shape.delete();}
}
export function savedBodyMeshes(spec,onProgress){
 const draft=spec.type==='threadDisplayMeshes',bodies=spec.bodies;
 if(!Array.isArray(bodies)||!bodies.length||new Set(bodies.map(b=>b.id)).size!==bodies.length)throw Error('出力するボディを選択してください');
 const outputs=[],rows=[];
 for(const [index,body] of bodies.entries()){
  onProgress?.({stage:draft?'ねじの表示データを軽くしています':'STL出力用の精密なメッシュを作成しています',current:index+1,total:bodies.length});
  if(typeof body.brep==='string'&&body.brep.length){if(draft)outputs.push({id:body.id,...meshBrep(body.brep,THREAD_DISPLAY_MESH),displayMesh:{...THREAD_DISPLAY_MESH}});else{const checked=inspectCadStl(body,{onProgress});rows.push(checked.report);if(checked.output)outputs.push(checked.output);}continue;}
  if(draft)throw Error('ねじのCAD形状がないため表示品質を変更できません');
  const {vertices,triangles}=body;
  if(!Array.isArray(vertices)||!vertices.length||vertices.length%3||!vertices.every(Number.isFinite)||!Array.isArray(triangles)||!triangles.length||triangles.length%3||!triangles.every(i=>Number.isInteger(i)&&i>=0&&i<vertices.length/3))throw Error('STL出力用の形状データが不正です');
  const {cleanTriangles,...audit}=inspectStlMesh(body);rows.push({id:body.id,...audit,repaired:audit.removedDegenerate>0,attempts:1});
  outputs.push({id:body.id,vertices:[...vertices],triangles:cleanTriangles||[...triangles]});
 }
 return {outputs,remove:[],...(!draft?{inspection:stlInspectionSummary(rows)}:{})};
}
