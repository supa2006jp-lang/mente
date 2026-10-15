import {findRegions} from './regions.js';
import {filletSuppressionState,isFilletBodySuppressed,filletBodyTargets} from './fillet-state.js';
import {basisFor,worldPoint} from './frames.js';
import {depthToGridPlane} from './extrusion-extent.js';
import {refreshLinkedOffset} from './linked-sketch-offset.js';
const copy=x=>JSON.parse(JSON.stringify(x));
const signature=r=>JSON.stringify([...(r.sourceIds||[])].sort())+':'+r.holes.length;
function remapFillet(before,after,spec,previous,remap){
 // Disabled edges retain the coordinates of their original input shape. When
 // restoring dependent fillets together, those coordinates become valid again;
 // mapping from the temporary unrounded topology would reject them incorrectly.
 const restored=new Set(filletBodyTargets(spec).filter(id=>isFilletBodySuppressed(previous,id)&&!isFilletBodySuppressed(spec,id)));
 if(!restored.size)return remap(before,after,spec);
 if(!spec.edges?.length)return restored.has(spec.target)?spec:remap(before,after,spec);
 const edges=spec.edges.filter(edge=>!restored.has(edge.bodyId));
 if(!edges.length)return spec;
 const mapped=remap(before,after,{...spec,edges});let index=0;
 return {...mapped,edges:spec.edges.map(edge=>restored.has(edge.bodyId)?edge:mapped.edges[index++])};
}
export function refreshRegion(region,before,after){
 if(region?.overlapSource){
  let source=refreshRegion(region.overlapSource,before,after);if(source===region.overlapSource)return region;
  const old=region.overlapSource,oldBasis=basisFor(old),nextBasis=basisFor(source);
  if(oldBasis.n.dot(nextBasis.n)<0){
   const frame={u:nextBasis.u.toArray(),v:nextBasis.v.negate().toArray(),n:nextBasis.n.negate().toArray()},ring=points=>points.map(([u,v])=>[u,-v]).reverse();
   source={...source,plane:'CUSTOM',frame,offset:-source.offset,outer:ring(source.outer),holes:source.holes.map(ring)};
  }
  const bounds=r=>[0,1].map(i=>[Math.min(...r.outer.map(p=>p[i])),Math.max(...r.outer.map(p=>p[i]))]),a=bounds(old),b=bounds(source),map=p=>p.map((v,i)=>b[i][0]+(v-a[i][0])*(b[i][1]-b[i][0])/Math.max(1e-9,a[i][1]-a[i][0]));
  const seed=region.overlapPoint,local=seed?[oldBasis.u.toArray().reduce((s,v,i)=>s+v*seed[i],0),oldBasis.v.toArray().reduce((s,v,i)=>s+v*seed[i],0)]:null;
  return {...region,plane:source.plane,frame:source.frame,offset:source.offset,outer:region.outer.map(map),holes:region.holes.map(h=>h.map(map)),sourceIds:source.sourceIds,overlapSource:source,overlapPoint:local?worldPoint(source,map(local)).toArray():undefined};
 }
 if(!region?.sourceIds?.length)return region;
 const ids=new Set(region.sourceIds),oldSketches=before.filter(f=>f.kind==='sketch'&&ids.has(f.id)),newSketches=after.filter(f=>f.kind==='sketch'&&ids.has(f.id));
 if(JSON.stringify(oldSketches)===JSON.stringify(newSketches))return region;
 const previous=findRegions(oldSketches),old=previous.find(r=>r.id===region.id);
 if(!old)throw Error('元のスケッチ領域を特定できません。輪郭を選び直してください');
 const next=findRegions(newSketches),matches=next.filter(r=>signature(r)===signature(old));
 if(previous.filter(r=>signature(r)===signature(old)).length!==1||matches.length!==1)throw Error('輪郭の数や接続が変わりました。閉じた領域を選び直してください');
 return copy(matches[0]);
}
export function replayHistory(before,proposed,start,run,remap,resolvePartition,onStep){
 const next=copy(proposed),prefix=[];
 for(let i=0;i<next.length;i++){
  let f=next[i];try{
   if(i>=start)onStep?.({stage:(i+1)+'工程目「'+(f.name||f.spec?.type||'形状')+'」を再計算しています',current:i-start,total:next.length-start,featureId:f.id});
   if(i>start||(i===start&&f.kind==='cadop'&&f.spec)){
    const refresh=r=>{const updated=refreshRegion(r,before.slice(0,i),prefix);if(updated?.overlapSource){if(!resolvePartition)throw Error('区切られた領域の再計算にはCADエンジンが必要です');return resolvePartition(updated,prefix);}return updated;};
    if(f.offsetLink)f=refreshLinkedOffset(f,refresh(f.offsetLink.region));
    if(f.region){const region=refresh(f.region);if(region!==f.region){const n=basisFor(region).n;f={...f,region,plane:region.plane,frame:region.frame,x:n.x*region.offset,y:n.y*region.offset,z:n.z*region.offset};}}
    if(f.kind==='cadop'&&f.spec){let spec=copy(f.spec);if(spec.type==='pipe'){const path=prefix.find(p=>p.id===spec.path&&p.kind==='sketch');if(path)spec.pathFeature=copy(path);}if(spec.region)spec.region=refresh(spec.region);if(spec.sections)spec.sections=spec.sections.map(refresh);if(remap&&!(spec.type==='fillet'&&filletSuppressionState(spec)==='suppressed'))spec=spec.type==='fillet'?remapFillet(before.slice(0,i),prefix,spec,before.find(old=>old.id===f.id)?.spec,remap):remap(before.slice(0,i),prefix,spec);const result=run(prefix,{...spec,id:spec.id||f.id});f={...f,spec,...result};}
   }
   if(i>=start&&f.kind==='extrusion'&&f.gridExtentPlane)f={...f,depth:depthToGridPlane(f,f.gridExtentPlane)};
   if(i>=start&&f.kind==='extrusion'&&(f.operation!=='new'||f.capHoles||f.holesOnly||f.untilSolid||f.overlapOnly||f.region?.overlapSource||f.taperAngle||f.cadResult)&&run){const {cadResult,...input}=f;f={...input,cadResult:run(prefix,{type:'extrusion',target:f.target,feature:input})};}
   prefix.push(f);
  }catch(e){throw Object.assign(Error((i+1)+'工程目「'+(f.name||f.spec?.type||'形状')+'」: '+(e.message||'形状を再計算できません。寸法を小さくしてください')+'。変更前の形状を保持しています'),{code:e.code,diagnostics:e.diagnostics,featureId:f.id,featureIndex:i,failedOperation:f.spec?.type||f.kind});}
 }
 return prefix;
}
