import {supportLocalPreview} from './print-support-local-preview.js';
import {supportNonDestructiveBoolean} from './print-support-boolean.js';
import {contactRoleSettings} from './print-support-contact-settings.js';
import {bottomContactInsetMask,upperContactRimInterior} from './print-support-contact-inset.js';
import * as R from 'replicad';
import {supportAdjustmentError} from './print-support-adjustments.js';
import {supportBoxesTouch,supportSolidGroups} from './print-support-solid-groups.js';
import {MODEL_PRECISION} from './model-precision.js';
import {cachedSupportGeometry} from './print-support-cache.js';
import {finishCadSteps} from './cad-steps.js';
const volume=s=>Math.abs(R.measureVolume(s)),bounds=s=>{const b=s.boundingBox;try{return b.bounds;}finally{b.delete();}},parts=s=>{const p=s.solids;try{return p.length;}finally{p.forEach(s=>s.delete());}};
const displayMesh=shape=>shape.mesh({tolerance:.08,angularTolerance:.15});
const contactCommon=(shape,tool)=>supportNonDestructiveBoolean('common',shape,tool,{simplify:true});
function validContactResult(shape,count){
 if(parts(shape)!==count)return false;
 const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);
 try{return check.IsValid();}finally{check.delete();}
}

function contactBoundaryLimits(skin,axis,height){
 const limits=new Set(),faces=skin.faces;
 try{
  for(const face of faces){
   if(face.geomType!=='PLANE'||!bounds(face).every(point=>Math.abs(point[2]-height)<=MODEL_PRECISION.contact))continue;
   const edges=face.edges;
   try{
    for(const edge of edges){
     const [low,high]=bounds(edge);
     if(high[axis]-low[axis]>MODEL_PRECISION.contact)limits.add(low[axis]).add(high[axis]);
    }
   }finally{edges.forEach(edge=>edge.delete());}
  }
  return limits;
 }finally{faces.forEach(face=>face.delete());}
}

function nearestFreeGrooveOffset(alignments,maximum,clearance){
 let low=Infinity,high=-Infinity;
 for(const alignment of alignments){
  const start=alignment-clearance;
  if(start>high+MODEL_PRECISION.contact){
   if(low<=0&&high>=0)break;
   low=start;
  }
  high=alignment+clearance;
 }
 if(low>0||high<0)return 0;
 return [low-MODEL_PRECISION.contact,high+MODEL_PRECISION.contact].filter(offset=>Math.abs(offset)<=maximum)
  .sort((a,b)=>Math.abs(a)-Math.abs(b))[0]??null;
}

function contactGrooveOffset(skin,spans,axis,height,settings){
 if(!spans.length)return 0;
 // A groove tangent to a hole or a corner can leave four faces sharing a
 // vertical edge. Translate the pattern together to keep its pitch and width.
 const maximum=Math.min(.08,settings.width/4,settings.spacing/2),clearance=.03;
 const boundaries=spans.flat(),alignments=[];
 for(const limit of contactBoundaryLimits(skin,axis,height))for(const boundary of boundaries){
  const offset=limit-boundary;
  if(Math.abs(offset)<=maximum+clearance+MODEL_PRECISION.contact)alignments.push(offset);
 }
 if(!alignments.some(offset=>Math.abs(offset)<=MODEL_PRECISION.contact))return 0;
 alignments.sort((a,b)=>a-b);
 return nearestFreeGrooveOffset(alignments,maximum,clearance)??nearestFreeGrooveOffset(alignments,maximum,.002)??0;
}

function makeGrooveMask(shape,spans,{role,axis,z,top,b,settings,rimWidth,cache,skinKey}){
 const other=1-axis,offset=contactGrooveOffset(shape,spans,other,role==='upper'?top:z,settings);
 const stripes=[];
 let compound,cut,interior,trimmed;
 try{
  for(const [from,to] of spans){
   const low=[...b[0]],high=[...b[1]];
   low[axis]-=.01;high[axis]+=.01;
   low[other]=from+offset;high[other]=to+offset;
   low[2]=z;high[2]=top;
   stripes.push(R.makeBox(low,high));
  }
  compound=R.makeCompound(stripes);
  let preserved=0;
  if(rimWidth){
   const rimKey=cache&&JSON.stringify(['rim',skinKey,z,top,rimWidth]);
   const rim=cachedSupportGeometry(cache,rimKey,()=>{
    const {interior,preserved}=upperContactRimInterior(shape,z,top,rimWidth);
    return {shape:interior,preserved};
   });
   interior=rim.shape;preserved=rim.preserved;
   if(interior){
    // The grooves already lie within the contact layer.
    trimmed=contactCommon(shape,compound);
    cut=contactCommon(trimmed,interior);
   }
  }else cut=contactCommon(shape,compound);
  if(!cut||volume(cut)<=.0001)return {shape:null,offset,preserved};
  const result=cut;cut=null;
  return {shape:result,offset,preserved};
 }finally{
  cut?.delete();trimmed?.delete();interior?.delete();compound?.delete();
  stripes.forEach(stripe=>stripe.delete());
 }
}

// One layer of grooves replaces a solid contact face with parallel landing
// lines. Bottom grooves start on the model, not in air. Bed feet stay solid.
export function supportContactLines(original,regions,p,onProgress,options){
 return finishCadSteps(supportContactSteps(original,regions,p,onProgress,options));
}

export function* supportContactSteps(original,regions,p,onProgress,{ribRecords=[],ribsAreContained=false,allowPartial=false,cache,meshCache,previewCache,structure}={}){
 // The supplied structure identifies the exact ceiling and tie snapshots.
 // Equivalent layouts can arrive through different pitch settings.
 const previewKey=previewCache&&p.preview&&structure&&JSON.stringify([
  structure,allowPartial,p.bedZ,p.layerHeight,p.lineWidth,
  contactRoleSettings(p,'upper'),contactRoleSettings(p,'lower'),p.topContactRim?p.topContactRimWidth:0,p.bottomContactInset,
 ]);
 const saved=previewKey&&previewCache.get(previewKey);
 if(saved){
  let shape;
  try{
   const details=structuredClone(saved.details);
   shape=R.deserializeShape(saved.brep).asShape3D();
   onProgress?.({stage:'線状接触層とリブの表示を再利用しています'});
   return {shape,...details};
  }catch(error){
   shape?.delete();
   previewCache.delete(previewKey);
   if(error instanceof WebAssembly.RuntimeError)throw error;
  }
 }
 const masks=[],landings=[],preview=[],ribPreview=[],groups=[],skipped=new Set();let result=null,local=null;const analysis={enabled:true,width:p.interfaceLineWidth,spacing:p.interfaceSpacing,depth:p.layerHeight,upper:0,lower:0,bedPreserved:0,slots:0,removedVolume:0};
 try{
  for(const {shape,role,axis,supportFace}of regions){
   const settings=contactRoleSettings(p,role);if(!settings.enabled)continue;const b=bounds(shape),other=1-axis;if(role==='lower'&&b[0][2]<=p.bedZ+1e-6){analysis.bedPreserved++;continue;}const low=b[0][other],high=b[1][other],pitch=settings.width+settings.spacing;
   onProgress?.({stage:(role==='upper'?'上面':'底面')+'に線状の接触層を作成しています',supportFace});
   yield;
   const z=role==='upper'?Math.max(b[0][2],b[1][2]-p.layerHeight):b[0][2],top=role==='upper'?b[1][2]:Math.min(b[1][2],z+p.layerHeight),start=masks.length,slots=analysis.slots,cutCount=analysis[role],relief=analysis.bottomEndRelief?.count??0;
   let offset=0;
   try{
    const spans=[];
    for(let at=low+settings.width;at<high-settings.width-1e-6;at+=pitch){
     if(++analysis.slots>1024)throw Error('接触層の線が多すぎます。線の隙間を広げるか対象面を絞ってください');
     spans.push([at,Math.min(at+settings.spacing,high-settings.width)]);
    }
    const skinKey=cache&&shape.serialize(),rimWidth=role==='upper'&&p.topContactRim?p.topContactRimWidth:0;
    if(role==='lower'&&p.bottomContactInset>0){
     if(b[1][axis]-b[0][axis]<2*p.bottomContactInset+p.lineWidth||high-low<2*p.bottomContactInset+pitch+settings.width)
      throw Error('底面の端の逃げが大きすぎて十分な接触線を残せません。値を小さくするか0にしてください');
     const insetKey=cache&&JSON.stringify(['inset',skinKey,z,top,p.bottomContactInset]);
     const inset=cachedSupportGeometry(cache,insetKey,()=>({shape:bottomContactInsetMask(shape,z,top,p.bottomContactInset)}));
     masks.push(inset.shape);landings.push({shape,b,z,top,width:settings.width});
     analysis.bottomEndRelief={distance:p.bottomContactInset,count:(analysis.bottomEndRelief?.count||0)+1};
    }
    if(!spans.length)continue;
    const grooveKey=cache&&JSON.stringify(['grooves',skinKey,role,axis,z,top,settings.width,settings.spacing,rimWidth]);
    const groove=cachedSupportGeometry(cache,grooveKey,()=>makeGrooveMask(shape,spans,{role,axis,z,top,b,settings,rimWidth,cache,skinKey}));
    offset=groove.offset;
    if(rimWidth){
     analysis.topRim??={enabled:true,width:p.topContactRimWidth,count:0};analysis.topRim.count++;
     if(groove.preserved)analysis.topRim.preserved=(analysis.topRim.preserved||0)+groove.preserved;
    }
    if(groove.shape){masks.push(groove.shape);analysis[role]++;}
    if(groove.reused)onProgress?.({stage:'計算済みの線状接触層を再利用しています',supportFace});
   }finally{
    if(masks.length>start)groups.push({shape,role,offset,masks:masks.slice(start),slots:analysis.slots-slots,cut:analysis[role]-cutCount,relief:(analysis.bottomEndRelief?.count??0)-relief});
   }
  }
  onProgress?.({stage:'接触層をサポート全体に反映しています'});
  yield;
  const count=parts(original);
  const maskBounds=new Map(masks.map(mask=>[mask,bounds(mask)]));
  function applySequentially(source,tools){
   let cut=source.clone();
   try{
    for(const mask of tools){
     const next=supportNonDestructiveBoolean('cut',cut,mask,{simplify:!allowPartial});
     cut.delete();cut=next;
    }
    const answer=cut;cut=null;return answer;
   }finally{cut?.delete();}
  }
  function applyCachedMasks(source,tools){
   if(!cache||!tools.length)return applySequentially(source,tools);
   const brep=source.serialize();
   const keys=tools.map(mask=>mask.serialize());
   const keyFor=count=>JSON.stringify(['cut',allowPartial,brep,...keys.slice(0,count)]);
   const {shape,reused}=cachedSupportGeometry(cache,keyFor(tools.length),()=>{
    if(tools.length===1)return {shape:applySequentially(source,tools)};
    // Keep the native cut order. For example, an unchanged bottom layer can
    // be restored when only the last, upper contact layer has been edited.
    const prefix=cachedSupportGeometry(cache,keyFor(tools.length-1),()=>({shape:applySequentially(source,tools.slice(0,-1))}));
    try{
     if(prefix.reused)onProgress?.({stage:'変更していない接触層を再利用しています'});
     return {shape:applySequentially(prefix.shape,tools.slice(-1))};
    }finally{prefix.shape.delete();}
   });
   if(reused)onProgress?.({stage:'接触層を反映済みのリブを再利用しています'});
   return shape;
  }
  function* applyIndependentMasks(source,tools){
   const solids=source.solids;
   const pieces=[];
   try{
    const independent=supportSolidGroups(solids);
    if(independent.length<=1)return null;
    for(const group of independent){
     yield;
     const part=group.length===1?group[0].shape.clone():R.makeCompound(group.map(entry=>entry.shape)).asShape3D();
     try{
      const relevant=tools.filter(mask=>group.some(entry=>supportBoxesTouch(entry.box,maskBounds.get(mask))));
      const cut=applyCachedMasks(part,relevant);
      pieces.push(cut);
      if(parts(cut)!==group.length)return null;
     }finally{part.delete();}
    }
    return R.makeCompound(pieces).asShape3D();
   }catch(error){
    if(error instanceof WebAssembly.RuntimeError)throw error;
    return null;
   }finally{
    pieces.forEach(piece=>piece.delete());
    solids.forEach(solid=>solid.delete());
   }
  }
  function* applyMasks(source,tools){
   return tools.length?((yield* applyIndependentMasks(source,tools))??applyCachedMasks(source,tools)):source.clone();
  }
  let activeMasks=masks;
  result=yield* applyMasks(original,masks);
  if(allowPartial?!validContactResult(result,count):parts(result)!==count){
   if(!allowPartial)throw supportAdjustmentError('接触層でサポートが分断されます。薄皮を2層以上にするか、線の隙間を狭くしてください',
    {kind:'contact-split',roles:[...new Set(groups.map(group=>group.role))]});
   result.delete();result=original.clone();activeMasks=[];
   for(const group of groups){
    const next=yield* applyMasks(result,group.masks);
    if(validContactResult(next,count)){result.delete();result=next;activeMasks.push(...group.masks);continue;}
    next.delete();skipped.add(group.shape);analysis.slots-=group.slots;analysis[group.role]-=group.cut;
    if(group.relief)analysis.bottomEndRelief.count-=group.relief;
   }
   if(skipped.size)analysis.skippedDisconnected=skipped.size;
  }
  const grooveOffsets=groups.filter(group=>group.cut&&group.offset&&!skipped.has(group.shape)).map(({role,offset})=>({role,offset}));
  if(grooveOffsets.length)analysis.grooveOffsets=grooveOffsets;
  for(const {shape,b,z,top,width}of landings){if(skipped.has(shape))continue;const box=R.makeBox([b[0][0],b[0][1],z],[b[1][0],b[1][1],top]);let layer,remaining;try{layer=shape.intersect(box);remaining=result.intersect(layer);if(volume(remaining)<p.lineWidth*width*(top-z))throw Error('底面の端の逃げが大きすぎて十分な接触線を残せません。値を小さくするか0にしてください');}finally{remaining?.delete();layer?.delete();box.delete();}}
  analysis.settings={upper:contactRoleSettings(p,'upper'),lower:contactRoleSettings(p,'lower')};
  if(p.preview){
   local=supportLocalPreview(original,activeMasks);
   for(const {shape,role,axis,supportFace,contained} of regions){
    if(skipped.has(shape)||!contactRoleSettings(p,role).enabled)continue;
    const b=bounds(shape);
    if(role==='lower'&&b[0][2]<=p.bedZ+1e-6)continue;
    const a=[...b[0]],c=[...b[1]];
    if(role==='upper')a[2]=Math.max(a[2],c[2]-p.layerHeight);
    else c[2]=Math.min(c[2],a[2]+p.layerHeight);
    let box,mask,display;
    try{
     if(a[2]===b[0][2]&&c[2]===b[1][2])mask=shape.clone();
     else{box=R.makeBox(a,c);mask=shape.intersect(box);}
     display=local.clip(mask,{contained:ribsAreContained&&contained});
     if(volume(display)>.0001)preview.push({id:role+'-'+preview.length,role,axis,ceilingId:supportFace?.ceilingId,
      bounds:bounds(display),...displayMesh(display)});
    }finally{display?.delete();mask?.delete();box?.delete();}
   }
  }
  if(p.preview)for(const [index,record]of ribRecords.entries()){
   onProgress?.({stage:'リブの表示を準備しています（'+(index+1)+'／'+ribRecords.length+'枚）',supportFace:record.supportFace});
   yield;
   ribPreview.push({id:record.id,...local.mesh(record.shape,{contained:ribsAreContained,cache:meshCache,meshShape:displayMesh})});
  }
  analysis.removedVolume=Math.max(0,volume(original)-volume(result));
  const flatSkinPreview=p.preview?[...skipped].map(part=>({...displayMesh(part),policy:'flat'})):[];
  const details={analysis,preview,ribPreview,flatSkinPreview};
  if(previewKey){
   const brep=result.serialize(),size=JSON.stringify(details).length;
   previewCache.set(previewKey,{brep,details:structuredClone(details)},previewKey.length+brep.length+size);
  }
  const shape=result;result=null;return {shape,...details};
 }finally{local?.delete();result?.delete();masks.forEach(s=>s.delete());}
}
