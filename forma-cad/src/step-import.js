import {cadMesh} from './cad-mesh.js';
import {healthBudget,inspectShapeHealth} from './geometry-health.js';
import {MODEL_PRECISION} from './model-precision.js';
import * as R from 'replicad';
export async function importStepBodies(spec){
 if(!(spec.data instanceof ArrayBuffer)||!spec.data.byteLength||spec.data.byteLength>30000000)throw Error('STEPファイルは空でない30 MB以下のファイルを指定してください');
 let shape;const solids=[];
 try{
  R.getOC().Interface_Static.SetCVal('xstep.cascade.unit','MM');
  shape=await R.importSTEP(new Blob([spec.data]));solids.push(...shape.solids);
  if(!solids.length)throw Error('ソリッドが見つかりません。サーフェスではなくソリッドを含むSTEPを指定してください');
  if(solids.length>Math.min(100,spec.maxBodies??100))throw Error('ボディ数が多すぎます。部品を分けて読み込んでください（最大100個・工程合計150個）');
  const budget=healthBudget(),rows=[];const outputs=solids.map((solid,i)=>{
   const check=new (R.getOC().BRepCheck_Analyzer)(solid.wrapped,true,false);let valid;try{valid=check.IsValid();}finally{check.delete();}
   if(!valid||!(R.measureVolume(solid)>1e-8))throw Error((i+1)+'番目のボディの形状が不正です。元のソフトで修復して書き出してください');
   const mesh=cadMesh(solid);if(mesh.vertices.length>3000000||mesh.triangles.length>3000000)throw Error('形状が複雑すぎます。部品を分けて読み込んでください');
   const id=spec.id+'-'+i;rows.push(inspectShapeHealth(solid,{id,spec,budget}));const faces=solid.faces;try{return {id,...mesh,cadCoordinatePrecision:true,planarFaces:faces.filter(f=>f.geomType==='PLANE').map(f=>f.hashCode),brep:solid.serialize()};}finally{faces.forEach(f=>f.delete());}
  });return {outputs,remove:[],analysis:{geometryHealth:{version:MODEL_PRECISION.version,rows}}};
 }catch(e){if(/[\u3040-\u9fff]/.test(e.message||''))throw e;throw Error('STEPを読み込めませんでした。ファイルが正常か、ソリッドとして書き出されているか確認してください');}
 finally{for(const solid of solids)solid.delete();shape?.delete();}
}
