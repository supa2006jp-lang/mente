import {cadPosition} from './cad-coordinates.js';
import * as THREE from 'three';
import {STLExporter} from 'three/addons/exporters/STLExporter.js';
import {currentBodyMeshRecords} from './mesh-quality.js';

export function stlMeshSnapshot(features,meshes){
 const records=currentBodyMeshRecords(features),bodies=[];
 for(const [id,mesh] of meshes){
  if(!mesh.visible)continue;const output=records.get(id)?.output;
  if(output?.brep){bodies.push({id,brep:output.brep});continue;}
  const p=cadPosition(mesh.geometry),v=new THREE.Vector3(),vertices=[];mesh.updateMatrixWorld(true);
  for(let i=0;i<p.count;i++)vertices.push(...v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).toArray());
  bodies.push({id,vertices,triangles:mesh.geometry.index?Array.from(mesh.geometry.index.array):Array.from({length:p.count},(_,i)=>i)});
 }
 if(!bodies.length)throw Error('表示中のソリッドがありません');return bodies;
}
export async function createPreciseStl(bodies,run,{isCurrent=()=>true,onProgress,onInspection}={}){
 const ensure=()=>{if(!isCurrent())throw Error('モデルが変更されたためSTL出力を中止しました。もう一度保存してください');};ensure();
 const result=await run([],{type:'stlMeshes',bodies},{onProgress});ensure();onInspection?.(result.inspection);ensure();
 if(!result.inspection?.ok||!result.inspection.complete||result.inspection.checkedBodies!==bodies.length||result.outputs.length!==bodies.length){const error=Error('STLの検査で未解決の問題が見つかったため保存を中止しました。「STL出力の検査」で場所を確認してください');error.code='stl-inspection';error.inspection=result.inspection;throw error;}
 const group=new THREE.Group();
 try{
  for(const output of result.outputs){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(output.vertices,3));geometry.setIndex(output.triangles);group.add(new THREE.Mesh(geometry));}
  group.updateMatrixWorld(true);return new STLExporter().parse(group,{binary:true});
 }finally{group.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});}
}
