import {supportLocalPreview,supportNonDestructiveBoolean} from './print-support-local-preview.js';
import {contactRoleSettings} from './print-support-contact-settings.js';
import {bottomContactInsetMask,upperContactRimMask} from './print-support-contact-inset.js';
import * as R from 'replicad';
const volume=s=>Math.abs(R.measureVolume(s)),bounds=s=>{const b=s.boundingBox;try{return b.bounds;}finally{b.delete();}},parts=s=>{const p=s.solids;try{return p.length;}finally{p.forEach(s=>s.delete());}};
const displayMesh=shape=>shape.mesh({tolerance:.08,angularTolerance:.15});
function validContactResult(shape,count){
 if(parts(shape)!==count)return false;
 const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);
 try{return check.IsValid();}finally{check.delete();}
}
// One layer of grooves replaces a solid contact face with parallel landing
// lines. Bottom grooves start on the model, not in air. Bed feet stay solid.
export function supportContactLines(original,regions,p,onProgress,{ribRecords=[],ribsAreContained=false,allowPartial=false}={}){
 const masks=[],landings=[],preview=[],ribPreview=[],groups=[],skipped=new Set();let result=null,local=null;const analysis={enabled:true,width:p.interfaceLineWidth,spacing:p.interfaceSpacing,depth:p.layerHeight,upper:0,lower:0,bedPreserved:0,slots:0,removedVolume:0};
 try{
  for(const {shape,role,axis}of regions){
   const settings=contactRoleSettings(p,role);if(!settings.enabled)continue;const b=bounds(shape),other=1-axis;if(role==='lower'&&b[0][2]<=p.bedZ+1e-6){analysis.bedPreserved++;continue;}const low=b[0][other],high=b[1][other],pitch=settings.width+settings.spacing;
   const z=role==='upper'?Math.max(b[0][2],b[1][2]-p.layerHeight):b[0][2],top=role==='upper'?b[1][2]:Math.min(b[1][2],z+p.layerHeight),stripes=[],start=masks.length,slots=analysis.slots,cutCount=analysis[role],relief=analysis.bottomEndRelief?.count??0;let compound,cut;
   try{
    for(let at=low+settings.width;at<high-settings.width-1e-6;at+=pitch){if(++analysis.slots>1024)throw Error('接触層の線が多すぎます。線の隙間を広げるか対象面を絞ってください');const a=[...b[0]],c=[...b[1]];a[axis]-=.01;c[axis]+=.01;a[other]=at;c[other]=Math.min(at+settings.spacing,high-settings.width);a[2]=z;c[2]=top;if(c[other]-a[other]>1e-6)stripes.push(R.makeBox(a,c));}
    if(role==='lower'&&p.bottomContactInset>0){if(b[1][axis]-b[0][axis]<2*p.bottomContactInset+p.lineWidth||high-low<2*p.bottomContactInset+pitch+settings.width)throw Error('底面の端の逃げが大きすぎて十分な接触線を残せません。値を小さくするか0にしてください');const rim=bottomContactInsetMask(shape,z,top,p.bottomContactInset);masks.push(rim);landings.push({shape,b,z,top,width:settings.width});analysis.bottomEndRelief={distance:p.bottomContactInset,count:(analysis.bottomEndRelief?.count||0)+1};}
    if(!stripes.length)continue;onProgress?.({stage:(role==='upper'?'上面':'底面')+'に線状の接触層を作成しています'});compound=R.makeCompound(stripes);cut=shape.intersect(compound);
    if(role==='upper'&&p.topContactRim){
     const {mask,preserved}=upperContactRimMask(shape,z,top,p.topContactRimWidth);
     try{const next=cut.cut(mask);cut.delete();cut=next;}finally{mask.delete();}
     analysis.topRim??={enabled:true,width:p.topContactRimWidth,count:0};analysis.topRim.count++;
     if(preserved)analysis.topRim.preserved=(analysis.topRim.preserved||0)+preserved;
    }
    if(volume(cut)>.0001){masks.push(cut);cut=null;analysis[role]++;}
   }finally{
    if(masks.length>start)groups.push({shape,role,masks:masks.slice(start),slots:analysis.slots-slots,cut:analysis[role]-cutCount,relief:(analysis.bottomEndRelief?.count??0)-relief});
    cut?.delete();compound?.delete();stripes.forEach(s=>s.delete());
   }
  }
  const count=parts(original);
  function applyMasks(source,tools){
   let cut=source.clone();
   try{
    for(const mask of tools){
     const next=allowPartial?supportNonDestructiveBoolean('cut',cut,mask):cut.cut(mask);
     cut.delete();cut=next;
    }
    const answer=cut;cut=null;return answer;
   }finally{cut?.delete();}
  }
  let activeMasks=masks;
  result=applyMasks(original,masks);
  if(allowPartial?!validContactResult(result,count):parts(result)!==count){
   if(!allowPartial)throw Error('接触層でサポートが分断されます。薄皮を2層以上にするか、線の隙間を狭くしてください');
   result.delete();result=original.clone();activeMasks=[];
   for(const group of groups){
    const next=applyMasks(result,group.masks);
    if(validContactResult(next,count)){result.delete();result=next;activeMasks.push(...group.masks);continue;}
    next.delete();skipped.add(group.shape);analysis.slots-=group.slots;analysis[group.role]-=group.cut;
    if(group.relief)analysis.bottomEndRelief.count-=group.relief;
   }
   if(skipped.size)analysis.skippedDisconnected=skipped.size;
  }
  for(const {shape,b,z,top,width}of landings){if(skipped.has(shape))continue;const box=R.makeBox([b[0][0],b[0][1],z],[b[1][0],b[1][1],top]);let layer,remaining;try{layer=shape.intersect(box);remaining=result.intersect(layer);if(volume(remaining)<p.lineWidth*width*(top-z))throw Error('底面の端の逃げが大きすぎて十分な接触線を残せません。値を小さくするか0にしてください');}finally{remaining?.delete();layer?.delete();box.delete();}}
  if(p.preview)local=supportLocalPreview(original,activeMasks);analysis.settings={upper:contactRoleSettings(p,'upper'),lower:contactRoleSettings(p,'lower')};if(p.preview)for(const {shape,role,axis}of regions){if(skipped.has(shape)||!contactRoleSettings(p,role).enabled)continue;const b=bounds(shape);if(role==='lower'&&b[0][2]<=p.bedZ+1e-6)continue;const a=[...b[0]],c=[...b[1]];if(role==='upper')a[2]=Math.max(a[2],c[2]-p.layerHeight);else c[2]=Math.min(c[2],a[2]+p.layerHeight);const box=R.makeBox(a,c);let mask,display;try{mask=shape.intersect(box);display=local.clip(mask);if(volume(display)>.0001)preview.push({id:role+'-'+preview.length,role,axis,bounds:bounds(display),...displayMesh(display)});}finally{display?.delete();mask?.delete();box.delete();}}
  if(p.preview)for(const [index,record]of ribRecords.entries()){onProgress?.({stage:'リブの表示を準備しています（'+(index+1)+'／'+ribRecords.length+'枚）'});const display=local.clip(record.shape,{contained:ribsAreContained});try{ribPreview.push({id:record.id,...displayMesh(display)});}finally{display.delete();}}analysis.removedVolume=Math.max(0,volume(original)-volume(result));const flatSkinPreview=p.preview?[...skipped].map(part=>({...displayMesh(part),policy:"flat"})):[];const shape=result;result=null;return {shape,analysis,preview,ribPreview,flatSkinPreview};
 }finally{local?.delete();result?.delete();masks.forEach(s=>s.delete());}
}
