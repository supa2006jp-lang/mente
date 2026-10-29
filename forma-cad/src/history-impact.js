import {filletSuppressionState} from './fillet-state.js';
const strings=value=>Array.isArray(value)?value.filter(v=>typeof v==='string'):typeof value==='string'?[value]:[];
export function featureReads(feature){
 const ids=new Set(),add=value=>strings(value).forEach(id=>ids.add(id)),spec=feature.spec||{};
 add(spec.pathFeature?.sourceIds);if(!(feature.kind==='extrusion'&&feature.operation==='new'))add(feature.target);add(feature.targetBodies);add(feature.barrierBodies);add(feature.sourceSketchIds);add(feature.offsetLink?.region?.sourceIds);
 if(feature.sketchMirrorLink?.enabled){add(feature.sketchMirrorLink.source.featureId);add(feature.sketchMirrorLink.axis.featureId);}
 add(feature.endPlane?.bodyId);add(feature.gridExtentPlane?.bodyId);add(spec.pinTarget);add(spec.lidTarget);
 for(const key of ['target','targets','cutTargets','other','others','path','sourceBody'])add(spec[key]);
 for(const ref of [...(spec.edges||[]),...(spec.faces||[]),spec.face,spec.rim,spec.placement,spec.source,spec.destination].filter(Boolean))add(ref.bodyId);
 for(const region of [feature.region,spec.region,...(spec.sections||[])].filter(Boolean)){add(region.sourceIds);add(region.bodyId);add(region.gridSourceBodyId);add(region.cadFace?.bodyId);add(region.overlapTargets);add(region.overlapSource?.sourceIds);}
 return ids;
}
// Only explicitly audited, input-local operations may reuse cached geometry.
// Unknown operations and neighbourhood/contact searches deliberately fall back.
export function localHistoryFeature(feature){
 if(feature.kind==='sketch')return !feature.offsetLink&&!feature.textSurface;
 if(feature.kind==='extrusion')return feature.operation==='new'&&!feature.barrier&&!feature.untilSolid&&!feature.overlapOnly&&!feature.region?.overlapSource&&!feature.faceBatch;
 if(feature.kind!=='cadop'||!feature.spec)return false;
 if(feature.spec.type==='loft')return !!feature.spec.sections?.length&&feature.spec.sections.every(r=>r.sourceIds?.length||r.bodyId||r.cadFace?.bodyId);
 if(['fillet','chamfer','shell','pull','simpleBoss','split'].includes(feature.spec.type)&&!featureReads(feature).size)return false;
 return ['thread','fillet','chamfer','shell','pull','simpleBoss','split','loft','sphere'].includes(feature.spec.type);
}
export function reusableHistoryResult(feature){
 const result=feature.cadResult||(feature.kind==='cadop'?feature:null);
 if(feature.kind==='sketch')return true;
 if(!result)return feature.kind==='extrusion'&&feature.operation==='new';
 if(feature.kind==='cadop'&&!result.outputs?.length&&filletSuppressionState(feature.spec)!=='suppressed')return false;
 return Array.isArray(result.outputs)&&Array.isArray(result.remove)&&result.outputs.every(o=>o.brep||o.vertices?.length&&o.triangles?.length);
}
export function featureWrites(feature){
 const result=feature.cadResult||(feature.kind==='cadop'?feature:null),ids=new Set(result?.outputs?.map(o=>o.id)||[]);
 for(const id of result?.remove||[])ids.add(id);
 if(!result)ids.add(feature.kind==='extrusion'&&feature.operation!=='new'?feature.target:feature.id);
 return ids;
}
export function historyImpact(features,id){
 const index=features.findIndex(f=>f.id===id);if(index<0)return {index:-1,steps:[],affected:0};
 const changed=new Set([id,...featureWrites(features[index])]),steps=[];
 for(let i=index+1;i<features.length;i++){
  const feature=features[i],references=[...featureReads(feature)].filter(resource=>changed.has(resource)),affected=references.length>0,recalculate=affected||!localHistoryFeature(feature)||!reusableHistoryResult(feature);
  if(affected||recalculate&&feature.spec){changed.add(feature.id);for(const resource of featureWrites(feature))changed.add(resource);}
  steps.push({id:feature.id,index:i,name:feature.name||feature.spec?.type||'工程',affected,recalculate,references});
 }
 return {index,steps,affected:steps.filter(step=>step.affected).length,recalculated:steps.filter(step=>step.recalculate).length};
}
