import {findRegions} from './regions.js';
import {basisFor} from './frames.js';
import {depthToGridPlane} from './extrusion-extent.js';
const copy=x=>JSON.parse(JSON.stringify(x));
const signature=r=>JSON.stringify([...(r.sourceIds||[])].sort())+':'+r.holes.length;
export function refreshRegion(region,before,after){
 if(!region?.sourceIds?.length)return region;
 const ids=new Set(region.sourceIds),oldSketches=before.filter(f=>f.kind==='sketch'&&ids.has(f.id)),newSketches=after.filter(f=>f.kind==='sketch'&&ids.has(f.id));
 if(JSON.stringify(oldSketches)===JSON.stringify(newSketches))return region;
 const previous=findRegions(oldSketches),old=previous.find(r=>r.id===region.id);
 if(!old)throw Error('元のスケッチ領域を特定できません。輪郭を選び直してください');
 const next=findRegions(newSketches),matches=next.filter(r=>signature(r)===signature(old));
 if(previous.filter(r=>signature(r)===signature(old)).length!==1||matches.length!==1)throw Error('輪郭の数や接続が変わりました。閉じた領域を選び直してください');
 return copy(matches[0]);
}
export function replayHistory(before,proposed,start,run,remap){
 const next=copy(proposed),prefix=[];
 for(let i=0;i<next.length;i++){
  let f=next[i];try{
   if(i>start||(i===start&&f.kind==='cadop'&&f.spec)){
    if(f.region){const region=refreshRegion(f.region,before.slice(0,i),prefix);if(region!==f.region){const n=basisFor(region).n;f={...f,region,plane:region.plane,frame:region.frame,x:n.x*region.offset,y:n.y*region.offset,z:n.z*region.offset};}}
    if(f.kind==='cadop'&&f.spec){let spec=copy(f.spec);if(spec.type==='pipe'){const path=prefix.find(p=>p.id===spec.path&&p.kind==='sketch');if(path)spec.pathFeature=copy(path);}if(spec.region)spec.region=refreshRegion(spec.region,before.slice(0,i),prefix);if(spec.sections)spec.sections=spec.sections.map(r=>refreshRegion(r,before.slice(0,i),prefix));spec=remap?remap(before.slice(0,i),prefix,spec):spec;const result=run(prefix,{...spec,id:spec.id||f.id});f={...f,spec,...result};}
   }
   if(i>=start&&f.kind==='extrusion'&&f.gridExtentPlane)f={...f,depth:depthToGridPlane(f,f.gridExtentPlane)};
   if(i>=start&&f.kind==='extrusion'&&(f.operation!=='new'||f.capHoles||f.holesOnly||f.untilSolid||f.taperAngle||f.cadResult)&&run){const {cadResult,...input}=f;f={...input,cadResult:run(prefix,{type:'extrusion',target:f.target,feature:input})};}
   prefix.push(f);
  }catch(e){throw Error((i+1)+'工程目「'+(f.name||f.spec?.type||'形状')+'」: '+(e.message||'形状を再計算できません。寸法を小さくしてください')+'。変更前の形状を保持しています');}
 }
 return prefix;
}
