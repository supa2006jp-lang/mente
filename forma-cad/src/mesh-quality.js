export const THREAD_DISPLAY_MESH=Object.freeze({purpose:'thread-display',version:1,tolerance:.1,angularTolerance:.35});
export const STL_MESH=Object.freeze({tolerance:.02,angularTolerance:.12});
const copies=new Set(['move','mirror','rectangular','circular','printLayout']);
export function currentBodyMeshRecords(features){
 const records=new Map();
 for(const [index,feature] of features.entries()){
  if(['sketch','plane','referenceImage'].includes(feature.kind))continue;
  const result=feature.cadResult||(feature.kind==='cadop'?feature:null),spec=feature.spec||{},target=spec.target||feature.target;
  const inherited=!!records.get(target)?.thread;
  if(result){
   const threads=new Map((result.outputs||[]).map(o=>[o.id,records.get(o.id)?.thread]));
   const joinedThread=spec.type==='join'&&(inherited||[spec.other,...(spec.others||[])].some(id=>records.get(id)?.thread));
   for(const id of result.remove||[])records.delete(id);
   for(const output of result.outputs||[]){
    const mirrorSource=spec.type==='mirror'?result.analysis?.mirrors?.find(item=>item.outputId===output.id)?.bodyId:null;
    const copiedThread=mirrorSource?!!records.get(mirrorSource)?.thread:inherited;
    const thread=!!output.threadSource||output.displayMesh?.purpose==='thread-display'||['thread','copiedThread'].includes(spec.type)||!!threads.get(output.id)||copies.has(spec.type)&&copiedThread||joinedThread;
    records.set(output.id,{output,feature,index,thread:!!thread});
   }
  }else{
   const id=feature.operation==='new'?feature.id:feature.target;if(id)records.set(id,{output:null,feature,index,thread:feature.operation!=='new'&&!!records.get(id)?.thread});
  }
 }
 return records;
}
export function threadDisplayForOperation(features,spec,id,sourceId){
 const records=currentBodyMeshRecords(features),operation=spec.type==='filletRadiusSearch'?spec.operation:spec;
 if(sourceId!==undefined)return records.get(sourceId)?.thread?THREAD_DISPLAY_MESH:null;
 if(['thread','copiedThread'].includes(operation.type)||records.get(id)?.thread)return THREAD_DISPLAY_MESH;
 if(copies.has(operation.type)&&records.get(operation.target)?.thread)return THREAD_DISPLAY_MESH;
 if(operation.type==='join'&&[operation.target,operation.other,...(operation.others||[])].some(key=>records.get(key)?.thread))return THREAD_DISPLAY_MESH;
 const region=operation.feature?.region;if(operation.type==='extrusion'&&operation.feature?.holesOnly&&records.get(region?.cadFace?.bodyId||region?.bodyId)?.thread)return THREAD_DISPLAY_MESH;
 return null;
}
export function needsThreadDisplay(output){const q=output?.displayMesh;return !!output?.brep&&(!q||q.purpose!==THREAD_DISPLAY_MESH.purpose||q.version!==1||q.tolerance!==THREAD_DISPLAY_MESH.tolerance||q.angularTolerance!==THREAD_DISPLAY_MESH.angularTolerance);}
export function lightweightThreadBodies(features){return [...currentBodyMeshRecords(features)].filter(([,r])=>r.thread&&needsThreadDisplay(r.output)).map(([id,r])=>({id,brep:r.output.brep}));}
export function applyThreadDisplayMeshes(features,result){
 const next=structuredClone(features),records=currentBodyMeshRecords(next);
 for(const mesh of result.outputs||[]){const output=records.get(mesh.id)?.output;if(!output?.brep)throw Error('ねじの元のCAD形状が見つかりません');const {brep,id,...display}=mesh;Object.assign(output,display);}
 return next;
}
