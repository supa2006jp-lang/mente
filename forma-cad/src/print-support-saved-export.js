import {Matrix4,Vector3} from 'three';
import {printSupportExportMesh} from './print-support-export-mesh.js';
import {inspectPrintSupportPackage} from './print-support-preflight.js';
import {printPlacementMatrix} from './print-layout.js';

function moveMatrix(move){
 const pivot=move.rotation&&move.pivot?move.pivot:[0,0,0],matrix=new Matrix4().makeTranslation(...pivot.map(v=>-v));
 const rotation=move.rotation||['X','Y','Z'].map(axis=>axis===(move.axis||'Z')?move.angle:0);
 const axes=[new Vector3(1,0,0),new Vector3(0,1,0),new Vector3(0,0,1)];
 for(const [i,angle] of rotation.entries())if(angle)matrix.premultiply(new Matrix4().makeRotationAxis(axes[i],angle*Math.PI/180));
 matrix.premultiply(new Matrix4().makeTranslation(...pivot));
 return matrix.premultiply(new Matrix4().makeTranslation(move.x,move.y,move.z));
}

function bodyPlacement(features,start,id){
 const placement=new Matrix4();
 for(const feature of features.slice(start)){
  const result=feature.cadResult||feature;
  if(result.remove?.includes(id))throw Error('本体・土台・リブのいずれかが削除されています');
  if(!result.outputs?.some(output=>output.id===id))continue;
  const spec=feature.spec;
  let move;
  if(spec?.type==='move'&&!spec.copy&&spec.moveMode!=='複製して移動')
   move={...spec,...result.analysis?.contactMove?.transform};
  if(spec?.type==='assemblyMate')move=result.analysis?.assembly?.transform;
  if(spec?.type==='printLayout'){
   const row=result.analysis?.placements?.find(item=>item.id===id);
   if(row){placement.premultiply(printPlacementMatrix(row));continue;}
  }
  if(!move||![move.x,move.y,move.z].every(Number.isFinite))throw Error('作成後に本体・土台・リブの形状が変わりました。現在の形状でサポートを作り直してください');
  placement.premultiply(moveMatrix(move));
 }
 return placement;
}

const samePlacement=(a,b)=>a.elements.every((value,i)=>Math.abs(value-b.elements[i])<1e-6);

export function savedSupportPackage(features,ids,bodies,regenerate,onProgress){
 if(!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length)throw Error('出力する連結リブサポートを選択してください');
 const parts=new Set(),blockers=[];
 let layerHeight;
 for(const [number,id] of ids.entries()){
  const index=features.findIndex(feature=>feature.id===id&&feature.spec?.type==='printSupport'&&feature.spec.style==='walls');
  if(index<0)throw Error('連結リブサポートの工程が見つかりません');
  const feature=features[index],prefix=features.slice(0,index);
  onProgress?.({stage:'保存済みの連結リブサポートを確認しています',current:number+1,total:ids.length});
  const record=feature.analysis?.supportExport??regenerate(prefix,feature.spec);
  if(!record?.complete||!record.blockers?.length)throw Error('3MF出力に必要な除外範囲がありません。連結リブサポートの配置を確認してください');
  if(layerHeight!==undefined&&layerHeight!==record.layerHeight)throw Error('一括出力する積層ピッチを揃えてください');
  layerHeight=record.layerHeight;
  const supportId=feature.spec.id||id,related=[supportId,feature.spec.target,...record.baseBodyIds];
  const placement=bodyPlacement(features,index+1,supportId);
  if(new Vector3(0,0,1).transformDirection(placement).z<1-1e-9)
   throw Error('印刷面に対してリブが傾いています。印刷方向を合わせてサポートを作り直してください');
  for(const part of related){
   if(!bodies.has(part))throw Error('出力に必要な本体・土台・リブがありません');
   if(!samePlacement(placement,bodyPlacement(features,index+1,part)))
    throw Error('本体・土台とリブの位置がずれています。まとめて移動してから出力してください');
   parts.add(part);
  }
  const point=new Vector3();
  for(const mesh of record.blockers){
   const vertices=[];
   for(let i=0;i<mesh.vertices.length;i+=3){
    point.fromArray(mesh.vertices,i).applyMatrix4(placement);vertices.push(point.x,point.y,point.z);
   }
   blockers.push({vertices,triangles:mesh.triangles});
  }
 }
 const result={complete:true,layerHeight,blockers,bodies:[...parts].map(id=>({id,...printSupportExportMesh(bodies.get(id))}))};
 const report=inspectPrintSupportPackage(result);
 if(!report.ok)throw Error(report.issues[0].message);
 return result;
}
