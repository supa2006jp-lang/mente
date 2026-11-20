import {supportContactSteps} from './print-support-contact-lines.js';
import * as R from 'replicad';
import {resolveSupportFaces,supportSelectedFaceMeshes,matchSupportFaceOverride,supportFaceContainsPoint} from './print-support-faces.js';
import {supportCoverageFace,supportCoverageRegions,supportHorizontalCap} from './print-support-coverage.js';
import {isSmallExteriorLip,ribPiecesReachingCeiling} from './print-support-exterior.js';
import {fuseSolids} from './solid-fuse.js';
import {makeWallTies,supportWallTiePairs} from './print-support-wall-ties.js';
import {makeWallWindows} from './print-support-wall-windows.js';
import {makeWallRoof} from './print-support-wall-roof.js';
import {roofRemovalDetails} from './print-support-roof-removal.js';
import {cadMesh} from './cad-mesh.js';
import {ribReference,supportPrintSettings} from './print-support-print-settings.js';
import {supportRibRisk} from './print-support-strength.js';
import {supportMaterialEstimate} from './print-support-material.js';
import {supportRibPlacement} from './print-support-rib-placement.js';
import {supportRibSections} from './print-support-rib-sections.js';
import {supportSkinLayer,refreshSupportSkinLayer} from './print-support-skin-layer.js';
import {makeSupportBottomSkins} from './print-support-bottom-skin.js';
import {createSupportSideGap,sideGapFootprint} from './print-support-side-gap.js';
import {supportAdjustmentError} from './print-support-adjustments.js';
import {supportBaseSurfaces} from './print-support-base.js';
import {supportFallbackColumns} from './print-support-column-fallback.js';
import {widerSupportRib} from './print-support-local-rib.js';
import {fillSupportGaps} from './print-support-gap-fill.js';
import {fuseSupportSolidSteps,supportBoxesTouch} from './print-support-solid-groups.js';
import {smallSupportBoreFloor,supportHoleBounds,supportThreadRunoutPlan,tinyRibAtSupportHole} from './print-support-bores.js';
import {supportHoleCylinder,supportHoleProtectionTools} from './print-support-hole-protection.js';
import {createPrintSupportCache} from './print-support-cache.js';
import {finishCadSteps} from './cad-steps.js';
const tuple=v=>{try{return v.toTuple();}finally{v.delete();}};
const bounds=s=>{const b=s.boundingBox;try{return b.bounds;}finally{b.delete();}};
function previewSkin(shape,axis,side,records){
 const parts=shape.solids;
 try{return parts.map(part=>{
  const [low,high]=bounds(part),ribs=[];
  for(const record of records){
   if(record.center<low[axis]||record.center>high[axis])continue;
   const common=part.intersect(record.shape);
   try{if(R.measureVolume(common)>.0001)ribs.push(record.id);}finally{common.delete();}
  }
  const {vertices,triangles}=cadMesh(part);
  return {side,ribs,limits:[low[axis],high[axis]],vertices,triangles};
 });}finally{parts.forEach(part=>part.delete());}
}
function ribGapWidths(candidates){
 for(const rib of candidates){
  const other=1-rib.axis;
  const neighbors=candidates.filter(candidate=>candidate.center!==rib.center&&
   candidate.bounds[0][other]<rib.bounds[1][other]&&candidate.bounds[1][other]>rib.bounds[0][other]&&
   candidate.bounds[0][2]<rib.bounds[1][2]&&candidate.bounds[1][2]>rib.bounds[0][2]);
  const left=neighbors.findLast(candidate=>candidate.center<rib.center&&!candidate.excluded);
  const right=neighbors.find(candidate=>candidate.center>rib.center&&!candidate.excluded);
  const low=left?.bounds[1][rib.axis]??Math.min(rib.band[0],...neighbors.filter(r=>r.center<rib.center).map(r=>r.band[0]));
  const high=right?.bounds[0][rib.axis]??Math.max(rib.band[1],...neighbors.filter(r=>r.center>rib.center).map(r=>r.band[1]));
  rib.unsupportedWidth=Math.max(0,high-low);
 }
}
function scopedBlocker(face,p,z,cells){
 const shifted=face.clone().translate([0,0,p.layerHeight]),vector=new R.Vector([0,0,p.bedZ-z-p.layerHeight]);let blocker;
 try{blocker=R.basicFaceExtrusion(shifted,vector);for(const cell of cells){const tool=R.makeBox(cell.low,cell.high);try{const next=blocker.cut(tool);blocker.delete();blocker=next;}finally{tool.delete();}}const result=blocker;blocker=null;return result;}finally{blocker?.delete();shifted.delete();vector.delete();}
}
function inset(face,distance){
 const owned=[],hold=s=>(owned.push(s),s);
 try{
  function offset(wire,smaller,amount=distance){const original=hold(R.makeFace(wire.clone())),area=R.measureArea(original);for(const sign of [1,-1]){let w,f;try{w=wire.clone().offset2D(sign*amount,'intersection');f=R.makeFace(w.clone());const a=R.measureArea(f);if(a>1e-6&&(smaller?a<area:a>area)){const answer=w;w=null;return answer;}}catch{}finally{w?.delete();f?.delete();}}throw Error('薄壁の外周のすき間を作れません。柱型を選ぶか対象面を選び直してください');}
  const outer=hold(face.clone().outerWire()),inner=face.clone().innerWires();inner.forEach(hold);const out=hold(offset(outer,true)),holes=inner.map(w=>hold(offset(w,false,.5))),profile=hold(R.makeFace(out.clone()));return holes.length?R.addHolesInFace(profile,holes):profile.clone();
 }finally{owned.forEach(s=>s.delete());}
}
function omitSmallBore(face,box,model){
 try{return smallSupportBoreFloor(face,box,model);}
 catch(error){
  if(error instanceof WebAssembly.RuntimeError)throw error;
  return false;
 }
}

function threadOpeningBlocker({center:[x,y,height],radius,top},bodies,bodyBounds,p){
 const mouthBottom=height-p.topGap-p.layerHeight;
 let bottom=p.bedZ;
 // Extend the exclusion through the free space below the hole. If another
 // part lies in that projection, leave its support region available.
 const probe=R.makeCylinder(radius,mouthBottom-p.bedZ,[x,y,p.bedZ]);
 try{
  const span=bounds(probe);
  for(const [id,body] of bodies){
   if(!supportBoxesTouch(span,bodyBounds.get(id)))continue;
   const occupied=probe.intersect(body);
   try{if(Math.abs(R.measureVolume(occupied))>.0001)bottom=Math.max(bottom,bounds(occupied)[1][2]+p.layerHeight);}
   finally{occupied.delete();}
  }
 }catch(error){
  if(error instanceof WebAssembly.RuntimeError)throw error;
  bottom=mouthBottom;
 }finally{probe.delete();}
 bottom=Math.min(bottom,mouthBottom);
 return R.makeCylinder(radius,top+p.layerHeight-bottom,[x,y,bottom]);
}

function* prepareWallCeiling(face,p,{b,z,bodies,bodyBounds,model,modelBounds,skipSmallExterior,sideGap,limits,override,ceilingId,supportFace,progress,getBases,threadRunout,scopeCache,freshLayout,layoutContext,protectionTools}){
 const item=p.preview||p.fillGaps?supportCoverageFace(face,p.target,p,override):null;
 if(item){
  item.ceilingId=ceilingId;
  item.ceilingNumber=supportFace.number;
  item.skin={upper:{enabled:p.wallRoof,present:false},lower:{enabled:p.wallBottomSkin,present:false}};
 }
 const location={ceilingId,number:supportFace.number,...(item?.selection?{selection:item.selection}:{})};
 const coverage=p.preview&&item?{item,height:z,faceBounds:b,index:-1}:null;
 const part={coverage,blocker:null,skippedScope:null,manualBlockers:[],wallRecords:[],candidateRibs:[],
  contactRegions:[],roof:null,tabs:[],bottomSkins:[],ties:[],skinCheck:null,skinPreview:[],
  tiePrism:null,tieSections:[],tieExclusions:[],tieKey:null,
  excludedScope:[],exclusionPreview:[],clearanceRegions:[],fillColumns:[],minRibs:0,ribQuota:null};
 const {manualBlockers,excludedScope,exclusionPreview,clearanceRegions}=part;
 const owned=[],hold=shape=>(owned.push(shape),shape);
 const onProgress=update=>progress?.({...update,supportFace});
 let complete=false;
 try{
  const suppressBores=p.mode==='auto'&&p.skipSmallBores&&!override;
  const boreReason=threadRunout?'thread':suppressBores&&omitSmallBore(face,b,model)?'bore':null;
  if(boreReason){
   if(boreReason==='bore'&&(p.preview||p.saveSupportExport||p.batch===true)){
    const shifted=hold(face.clone().translate([0,0,p.layerHeight]));
    const direction=new R.Vector([0,0,-(p.topGap+2*p.layerHeight)]);
    try{manualBlockers.push(hold(R.basicFaceExtrusion(shifted,direction)));}finally{direction.delete();}
   }
   part.omittedBore=boreReason;
   if(coverage){coverage.item.suppressed=true;coverage.item.suppressedReason=boreReason;}
   complete=true;
   return part;
  }
  if(skipSmallExterior&&!p.noSupport?.length&&!p.edgeAssist&&!p.localRibs?.length&&isSmallExteriorLip(face,b,model,modelBounds,z,item?.face)){
   part.blocker=hold(scopedBlocker(face,p,z,[]));
   part.omittedExterior=true;
   if(coverage)coverage.item.suppressed=true;
   complete=true;
   return part;
  }
  const manualZones=(p.noSupport||[]).map((zone,index)=>({zone,allow:p.allowAutoSupport?.includes(index)}))
   .filter(({zone:[x0,y0,x1,y1]})=>x0<b[1][0]&&x1>b[0][0]&&y0<b[1][1]&&y1>b[0][1]);
  const zoneTools=manualZones.map(({zone:[x0,y0,x1,y1]})=>hold(R.makeBox([x0,y0,p.bedZ-1],[x1,y1,z+p.layerHeight+1])));
  if(zoneTools.length){
   let scope=hold(scopedBlocker(face,p,z,[]));
   const slab=hold(R.makeBox([b[0][0]-1,b[0][1]-1,Math.max(p.bedZ,z-p.layerHeight)],[b[1][0]+1,b[1][1]+1,z+p.layerHeight+1]));
   scope=hold(scope.intersect(slab));
   if(coverage)coverage.item.manualExcluded=[];
   for(const [index,tool] of zoneTools.entries()){
    const blocked=hold(scope.intersect(tool));
    if(R.measureVolume(blocked)<=.000001)continue;
    if(coverage){
     const cap=supportHorizontalCap(blocked,z+p.layerHeight,z);
     if(cap){
      coverage.item.manualExcluded.push(cap);
      exclusionPreview.push({...cap,policy:manualZones[index].allow?'allow':'block'});
     }
    }
    if(manualZones[index].allow){const [low,high]=bounds(tool);excludedScope.push({low,high});}
    else {manualBlockers.push(blocked);scope=hold(scope.cut(tool));}
   }
  }
  const cutouts=[],holes=suppressBores?supportHoleBounds(face):[];
  const scopeBounds=[[b[0][0],b[0][1],p.bedZ],[b[1][0],b[1][1],z-p.topGap]];
  const protectedScopes=protectionTools.filter(tool=>supportBoxesTouch(scopeBounds,tool.bounds));
  const scopeKey=scopeCache&&!freshLayout?JSON.stringify([ceilingId,p.mode==='face'?p.faces:null,p.edgeMargin,p.topGap,p.bedZ,p.sideGap,
   p.roofTabs?p.roofTabLength:0,manualZones.map(item=>item.zone),protectedScopes.map(tool=>tool.protection)]):null;
  let initialFailure=null,skipGapFill=false;
  for(let attempt=0;attempt<4;attempt++){
   const ownedBeforeFace=owned.length;
   const key=attempt===0?scopeKey:null;
   let reusable=key?restoreWallScope(scopeCache,key,hold):null;
   if(reusable)part.reusedScope=true;
   else{
    let profile;
    try{profile=hold(inset(face,p.edgeMargin));}
    catch(error){
     if(!p.fallbackPosts||error.message!=='薄壁の外周のすき間を作れません。柱型を選ぶか対象面を選び直してください')throw error;
     part.skippedScope=hold(scopedBlocker(face,p,z,[]));break;
    }
    const shifted=hold(profile.translate([0,0,-p.topGap])),v=new R.Vector([0,0,p.bedZ-z+p.topGap]);
    let beforeGap;
    try{beforeGap=hold(R.basicFaceExtrusion(shifted,v));}finally{v.delete();}
    for(const tool of zoneTools)beforeGap=hold(beforeGap.cut(tool));
    for(const {shape} of protectedScopes){yield;beforeGap=hold(beforeGap.cut(shape));}
    for(const {low,high} of cutouts)beforeGap=hold(beforeGap.cut(hold(R.makeBox(low,high))));
    const originalVolume=R.measureVolume(beforeGap);
    if(originalVolume<=.001){
     owned.splice(ownedBeforeFace).forEach(item=>item.delete());
     if(!initialFailure)break;
     part.skippedCeiling={height:z,reason:initialFailure.code};
     clearanceRegions.push(...initialFailure.regions.map(region=>({...region,height:z,partial:false})));
     part.skippedScope=hold(scopedBlocker(face,p,z,[]));
     break;
    }
    const originalBounds=bounds(beforeGap),trimmed=sideGap?sideGap.trim(beforeGap,hold):beforeGap;
    const volume=trimmed!==beforeGap?Math.abs(R.measureVolume(trimmed)):null;
    const gapTrimmed=volume!==null&&Math.abs(originalVolume)-volume>1e-6;
    reusable={shifted,beforeGap,prism:gapTrimmed?trimmed:beforeGap,originalBounds,volume,gapTrimmed};
    if(key)saveWallScope(scopeCache,key,reusable);
   }
   const {shifted,beforeGap,prism,originalBounds,volume,gapTrimmed}=reusable;
   let blockedRibs=0;
   const keepThickness=!!sideGap&&p.keepRibThickness===true;
   part.sideGapLimited||=gapTrimmed;
   if(gapTrimmed&&volume<=.001){
    part.skippedScope=hold(scopedBlocker(face,p,z,[]));
    break;
   }
   const protectWidth=keepThickness&&gapTrimmed,pb=protectWidth?bounds(prism):originalBounds;
   const axis=p.wallDirection==='x'?1:p.wallDirection==='y'?0:pb[1][0]-pb[0][0]>=pb[1][1]-pb[0][1]?0:1;
   const other=1-axis,top=z-p.topGap,nominalSpan=originalBounds[1][axis]-originalBounds[0][axis];
   const placementOptions={...p,keepThickness,nominalSpan,
    edgeRibs:p.edgeRibs||p.edgeAssist,ribAxis:axis,noSupport:manualZones.map(item=>item.zone)};
   const extraRibs=p.localRibs?.length||0;
   const ribsPerSection=Math.max(2,1+Math.ceil(nominalSpan/p.wallPitch)+(p.edgeAssist?2*manualZones.length:0));
   const sectionBudget=Math.floor((limits.ribs-extraRibs)/ribsPerSection);
   if(protectWidth&&p.sectionSideGapRibs&&sectionBudget<2)part.ribQuota=limits.ribs;
   const clearCap=protectWidth&&(coverage||p.sectionSideGapRibs&&sectionBudget>=2)?
    cachedWallCap(scopeCache,key,'clear',()=>sideGapFootprint(prism,bodies,top)):null;
   const sections=clearCap&&p.sectionSideGapRibs&&sectionBudget>=2?
    supportRibSections(cachedWallCap(scopeCache,key,'original',()=>supportHorizontalCap(beforeGap,top)),
     [clearCap,...cachedWallCap(scopeCache,key,'levels',()=>sideGap.sectionLevels(originalBounds,top)
      .map(level=>sideGapFootprint(prism,bodies,level,false)).filter(Boolean))],
     axis,p,sectionBudget,required=>{
      if(required>sectionBudget)part.ribQuota=limits.ribs;
      else part.minRibs=Math.max(part.minRibs,required*ribsPerSection+extraRibs);
     }):[];
   const wallsAtEdge=protectWidth&&p.alignSideGapRibs&&!sections.length?sideGap.placement(beforeGap,originalBounds,axis,p.wallThickness):{};
   const anchorLow=wallsAtEdge.low!==undefined,anchorHigh=wallsAtEdge.high!==undefined;
   if(anchorLow)pb[0][axis]=Math.max(pb[0][axis],wallsAtEdge.low);
   if(anchorHigh)pb[1][axis]=Math.min(pb[1][axis],wallsAtEdge.high);
   const stripes=(sections.length?sections:[{low:pb[0][axis],high:pb[1][axis],anchorLow,anchorHigh,nominalSpan}]).flatMap(section=>{
    const {span,low,high,anchorLow,anchorHigh,nominalSpan}=section;
    // An exclusion boundary belongs to the sections it actually crosses.
    const noSupport=span?placementOptions.noSupport.filter(zone=>zone[other]<span[1]&&zone[other+2]>span[0]):placementOptions.noSupport;
    const placement=supportRibPlacement(low,high,{...placementOptions,noSupport,anchorLow,anchorHigh,nominalSpan});
    return placement.centers.map((center,i)=>({center,span,band:[
     i===0?originalBounds[0][axis]-1:placement.cells[i][0],
     i===placement.count-1?originalBounds[1][axis]+1:placement.cells[i][1]],foot:placement.cells[i]}));
   });
   if(!stripes.length){
    part.skippedScope=hold(scopedBlocker(face,p,z,[]));
    part.sideGapLimited||=keepThickness;
    break;
   }
   for(const rib of p.localRibs||[]){
    const center=rib.at[axis],half=p.wallThickness/2,span=[rib.at[other]-rib.length/2,rib.at[other]+rib.length/2];
    if(center-half<pb[0][axis]-1e-6||center+half>pb[1][axis]+1e-6||span[1]<=pb[0][other]||span[0]>=pb[1][other])continue;
    if(stripes.some(item=>Math.abs(center-item.center)<p.wallThickness&&
     (!item.span||span[0]<item.span[1]-1e-6&&span[1]>item.span[0]+1e-6)))continue;
    stripes.push({center,band:[center-half,center+half],foot:[center-half,center+half],rib,span});
   }
   stripes.sort((a,b)=>a.center-b.center||(a.span?.[0]??0)-(b.span?.[0]??0));
   // The pitch is an input to the layout, but identical slots, feet and
   // section boundaries produce the same ribs and skins.
   // Ignore floating-point noise from restoring the exact CAD footprint.
   part.layoutKey=layoutContext&&attempt===0?JSON.stringify([layoutContext,axis,pb,originalBounds,
    gapTrimmed,sections,stripes,stripes.map(({center})=>ribReference(axis,center,z,pb))],
    (_,value)=>typeof value==='number'?Number(value.toFixed(9)):value):null;
   if(part.layoutKey&&!freshLayout){
    const previousKey=scopeCache.layouts.get(part.layoutKey);
    const previous=previousKey&&restoreWallCeiling(scopeCache.ceilings,previousKey,limits.ribs);
    if(previous){
     if(previous.coverage){
      previous.coverage.item.settings.wallPitch=p.wallPitch;
      previous.coverage.item.override=item.override;
     }
     previous.reusedLayout=true;
     return previous;
    }
   }
   const records=[],excludedCells=[],faceCandidates=[],faceBases=new Set();
   part.minRibs=Math.max(part.minRibs,stripes.length);
   if(stripes.length>limits.ribs)throw supportAdjustmentError('薄壁の本数が多すぎます。壁の間隔を広げるか対象面を絞ってください',
    {kind:'rib-limit',total:96-limits.ribs+stripes.length});
   let faceOmittedPieces=0,omittedHoleFragments=0;
   const localPlaced=new Set(),widthsApplied=new Set();
   for(const layout of stripes){
    yield;
    const {center,band,foot,rib,span}=layout;
    onProgress?.({stage:'薄壁サポートを作成しています（'+(records.length+1)+'枚目）'});const a=[pb[0][0]-1,pb[0][1]-1,p.bedZ-1],b=[pb[1][0]+1,pb[1][1]+1,z+1];a[axis]=center-p.wallThickness/2;b[axis]=center+p.wallThickness/2;
    if(span)[a[other],b[other]]=span;
    const stripe=hold(R.makeBox(a,b));
    let wall=hold((protectWidth?beforeGap:prism).intersect(stripe));
    if(R.measureVolume(wall)<.001)continue;
    if(protectWidth){wall=sideGap.trimRib(wall,axis,hold);if(!wall||R.measureVolume(wall)<.001)continue;}
    if(p.connectFeet&&!p.wallBottomSkin&&!rib){const fa=[...a],fb=[...b];[fa[axis],fb[axis]]=foot;fa[2]=p.bedZ;fb[2]=p.bedZ+p.footThickness;const footBox=hold(R.makeBox(fa,fb)),base=hold(prism.intersect(footBox));if(R.measureVolume(base)>.001)wall=hold(wall.fuse(base));}
    const wallBox=bounds(wall),nearby=[...bodies].filter(([id])=>supportBoxesTouch(wallBox,bodyBounds.get(id)));
    if(p.baseMode==='bed'){let blocked=false;for(const [,model] of nearby){const common=hold(wall.intersect(model));if(R.measureVolume(common)>.0001){blocked=true;break;}}if(blocked){blockedRibs++;continue;}}
    else{
     const bases=[];
     for(const [id,model]of nearby){
      const common=hold(wall.intersect(model));
      if(R.measureVolume(common)>.0001){
       if(skipSmallExterior||zoneTools.length)bases.push(id);else faceBases.add(id);
       wall=hold(wall.cut(model));
      }
     }
     if((rib||skipSmallExterior||zoneTools.length)&&bases.length&&R.measureVolume(wall)>.001){
      const retained=ribPiecesReachingCeiling(wall,z-p.topGap);
      faceOmittedPieces+=retained.omitted;
      if(!retained.shape)continue;
      if(retained.shape!==wall)wall=hold(retained.shape);
     }
     if(R.measureVolume(wall)>.001)for(const id of bases)faceBases.add(id);
    }
    if(R.measureVolume(wall)<.001)continue;
    if(rib)localPlaced.add(rib);
    const ribId=ribReference(axis,center,z,pb)+(rib?'@'+JSON.stringify([rib.at[other],rib.length]):span?'~'+JSON.stringify(span):'');
    const low=[...a],high=[...b];[low[axis],high[axis]]=band;
    const solids=wall.solids;
    if(solids.length>1)solids.forEach(hold);else solids.forEach(s=>s.delete());
    const pieces=(solids.length>1?solids:[wall]).map(shape=>({shape,bounds:bounds(shape)})).sort((x,y)=>
     x.bounds[0][other]-y.bounds[0][other]||x.bounds[0][2]-y.bounds[0][2]||x.bounds[1][other]-y.bounds[1][other]||x.bounds[1][2]-y.bounds[1][2]);
    const whole=p.excludedRibs.includes(ribId);
    part.minRibs=Math.max(part.minRibs,faceCandidates.length+pieces.length);
    if(faceCandidates.length+pieces.length>limits.ribs)throw supportAdjustmentError('薄壁の片数が多すぎます。壁の間隔を広げるか対象面を絞ってください',
     {kind:'rib-limit',total:96-limits.ribs+faceCandidates.length+pieces.length});
    if(whole)excludedCells.push({low,high,autoBlocked:p.excludedRibBlockers.includes(ribId),blockHeight:z});
    for(const [part,piece] of pieces.entries()){
     if(holes.length&&tinyRibAtSupportHole(piece.bounds,holes,p)){omittedHoleFragments++;continue;}
     const partId=pieces.length===1?ribId:ribId+'#'+JSON.stringify(piece.bounds.flat().map(n=>Number(n.toFixed(6))))+':'+part;
     const exclusionId=whole?ribId:partId,excluded=whole||p.excludedRibs.includes(partId);
     const widthSetting=!excluded&&p.ribWidths?.find(row=>row.id===partId);
     const wider=widthSetting&&widerSupportRib({piece,originalSlot:stripe,stripes,stripe:layout,
      thickness:p.wallThickness,width:widthSetting.width,axis,prism:beforeGap,bodies,settings:p,sideGap,top,hold});
     if(wider){widthsApplied.add(partId);wider.bases.forEach(id=>faceBases.add(id));}
     const ribPiece=wider||piece;
     const candidate={id:partId,ribId,exclusionId,ceilingId,axis,center,ceiling:z,excluded,local:!!rib,bounds:ribPiece.bounds,
      ...(wider?{thickness:widthSetting.width}:{}),
      band:[Math.max(low[axis],originalBounds[0][axis]),Math.min(high[axis],originalBounds[1][axis])],autoBlocked:p.excludedRibBlockers.includes(exclusionId)};
     if(p.preview&&(!p.contactLines||excluded)){
      const display=ribPiece.shape.intersect(wider?.slot||stripe);
      try{Object.assign(candidate,cadMesh(display));}finally{display.delete();}
     }
     faceCandidates.push(candidate);
     if(!excluded){records.push({id:partId,shape:ribPiece.shape,axis,center,local:!!rib,span,supportFace});continue;}
     if(!whole){
      const start=[...low],end=[...high],ceiling=piece.bounds[1][2]>=z-p.topGap-1e-5;
      if(pieces.length>1){
       start[other]=piece.bounds[0][other];end[other]=piece.bounds[1][other];
       start[2]=piece.bounds[0][2]-.00001;end[2]=ceiling?high[2]:piece.bounds[1][2]+.00001;
      }
      excludedCells.push({low:start,high:end,autoBlocked:candidate.autoBlocked,blockHeight:ceiling?z:piece.bounds[1][2]+p.topGap});
     }
    }
   }
   let fill=null;
   if(p.fillGaps&&!skipGapFill&&records.length){
    let open=beforeGap;
    for(const {low,high} of excludedCells)open=hold(open.cut(hold(R.makeBox(low,high))));
    fill=fillSupportGaps({face,item,bounds:b,height:z,top,axis,bodies,settings:p,limits,prism:open,sideGap,
     footprint:clearCap||(sideGap?sideGapFootprint(prism,bodies,top):supportHorizontalCap(prism,top)),
     reference:supportHorizontalCap(open,top),
     candidates:faceCandidates,records,excludedCells,hold,onProgress,getBases,widthsApplied,protectionTools:protectedScopes,
     makeId:(center,along,length)=>ribReference(axis,center,z,pb)+'@auto:'+JSON.stringify([along,length].map(n=>Number(n.toFixed(6))))});
    for(const {candidate,shape,slot,span} of [...fill.ribs,...fill.excluded]){
     candidate.ceilingId=ceilingId;
     if(p.preview&&(!p.contactLines||candidate.excluded)){
      const display=shape.intersect(slot);
      try{Object.assign(candidate,cadMesh(display));}finally{display.delete();}
     }
     faceCandidates.push(candidate);
     if(candidate.excluded){
      const [low,high]=candidate.bounds.map(point=>[...point]);
      high[2]=z+p.layerHeight;
      excludedCells.push({low,high,autoBlocked:candidate.autoBlocked,blockHeight:z});
     }else records.push({id:candidate.id,shape,axis,center:candidate.center,local:true,span,supportFace});
    }
    if(fill.ribs.length||fill.excluded.length){
     const order=(a,b)=>a.center-b.center;
     records.sort(order);faceCandidates.sort(order);
     part.minRibs=Math.max(part.minRibs,faceCandidates.length);
    }
    for(const id of fill.bases)faceBases.add(id);
   }
   // Keep all output for this ceiling provisional until both skins fit.
   let bottom,roof,skinPrism=prism;
   const prepareTies=records.length>1&&(p.wallTies||scopeCache);
   yield;
   try{
    if(records.length&&(p.wallBottomSkin||p.wallRoof||p.wallTies))for(const {low,high} of excludedCells){
     skinPrism=hold(skinPrism.cut(hold(R.makeBox(low,high))));
    }
    if(p.wallBottomSkin&&records.length){onProgress({stage:'底面の薄皮を計算しています'});bottom=makeSupportBottomSkins(records,skinPrism,bodies,p,onProgress,protectedScopes);bottom.shapes.forEach(hold);}
    if(p.wallRoof){
     onProgress({stage:'上面の薄皮を計算しています'});
     yield;
     if(sections.length){
      const parts=[];
      for(const {span} of sections){
       const nearby=records.filter(record=>record.span===span||record.local&&record.span[0]<span[1]&&record.span[1]>span[0]);
       const made=makeWallRoof(nearby,skinPrism,bodies,p,top,onProgress,{allowPartial:true,trimToRibs:true,span});
       if(made)parts.push(hold(made));
      }
      if(parts.length)roof=parts.length===1?parts[0]:hold(fuseSolids(parts));
     }else{
      const made=makeWallRoof(records,skinPrism,bodies,p,top,onProgress,{allowPartial:!!(zoneTools.length||excludedCells.length||gapTrimmed||protectedScopes.length),trimToRibs:!!(excludedCells.length||gapTrimmed)});
      if(made)roof=hold(made);
     }
    }
     if(cutouts.length&&(!records.length||p.wallRoof&&!roof&&!excludedCells.length))throw initialFailure;
   }catch(error){
    if(fill?.ribs.length&&['support-skin-clearance','support-skin-anchor'].includes(error?.code)){
     skipGapFill=true;
     owned.splice(ownedBeforeFace).forEach(shape=>shape.delete());
     attempt--;continue;
    }
    if(error?.role&&(error.code==='support-skin-clearance'||error.code==='support-skin-anchor')){
     const values=[error.available,...(error.regions||[]).map(region=>region.available)].filter(Number.isFinite);
     const selection=override?.selection??item?.selection;
     error.supportAdjustmentHints=[{kind:error.code==='support-skin-clearance'?'skin-clearance':'skin-anchor',role:error.role,
      ...location,...(selection?{selection}:{}),...(values.length?{available:Math.min(...values)}:{})}];
    }
    if(p.mode!=='auto'){
     if(error?.code==='support-skin-clearance')error.supportClearanceRegions=clearanceDetails(error,b,z);
     throw error;
    }
    if(error?.code!=='support-skin-clearance'&&!(initialFailure&&error?.code==='support-skin-anchor'))throw error;
    initialFailure??=error;
    part.skinFailure??=initialFailure;
    owned.splice(ownedBeforeFace).forEach(item=>item.delete());
    const regions=error.regions||[],margin=.001;
    if(!p.roofTabs&&attempt<3&&error.code==='support-skin-clearance'&&regions.length&&cutouts.length+regions.length<=24){
     for(const region of regions){
      const [low,high]=region.bounds;
      cutouts.push({region,low:[low[0]-margin,low[1]-margin,p.bedZ-margin],high:[high[0]+margin,high[1]+margin,z+p.layerHeight+margin]});
     }
     continue;
    }
    part.skippedCeiling={height:z,reason:initialFailure.code};
    clearanceRegions.push(...clearanceDetails(initialFailure,b,z));
    part.skippedScope=hold(scopedBlocker(face,p,z,[]));
    break;
   }
   ribGapWidths(faceCandidates);
   if(coverage){
    coverage.axis=axis;
    item.skin.upper.present=!!roof;
    item.skin.lower.present=!!bottom?.shapes.length;
    coverage.item.localRibsSkipped=(p.localRibs?.length||0)-localPlaced.size;
    if(p.ribWidths?.length)coverage.item.unappliedRibWidths=p.ribWidths.filter(row=>!widthsApplied.has(row.id)).map(row=>row.id);
    coverage.item.bridgePlacement={bounds:pb,margin:p.edgeMargin,footprint:clearCap,
     stripes:[...stripes,...(fill?.ribs||[]).map(({candidate,span})=>({center:candidate.center,span}))].map(({center,span})=>span?{center,span}:{center})};
   }
   if(fill){
    part.fillColumns=fill.columns;
    if(fill.ribs.length||fill.columns.length){
     part.gapFill={ribs:fill.ribs.length,columns:fill.columns.length,before:fill.before,after:fill.after};
     if(coverage)coverage.item.gapFill=part.gapFill;
    }
   }
   if(p.preview&&records.length)part.skinPreview=[
    ...(bottom?.shapes||[]).flatMap(s=>previewSkin(s,axis,'lower',records)),
    ...(roof?previewSkin(roof,axis,'upper',records):[]),
   ].map(skin=>({...skin,ceilingId,layers:skin.side==='upper'?p.roofLayers:p.bottomSkinLayers}));
   Object.assign(part,{candidateRibs:faceCandidates,wallRecords:records,omittedRibPieces:faceOmittedPieces,omittedHoleFragments,blockedRibs,
    baseBodyIds:[...faceBases],aligned:anchorLow||anchorHigh||sections.length>0,sections:sections.length});
   excludedScope.push(...excludedCells,...cutouts);
   let ceilingScope=null;
   for(const {low,high,autoBlocked,blockHeight} of excludedCells)if(autoBlocked||p.preview){
    ceilingScope??=hold(scopedBlocker(face,p,z,[]));
    const slab=hold(R.makeBox([low[0],low[1],Math.max(p.bedZ,blockHeight-p.layerHeight)],[high[0],high[1],blockHeight+p.layerHeight+1]));
    const blocker=hold(ceilingScope.intersect(slab));
    if(R.measureVolume(blocker)<=.000001)continue;
    if(p.preview){
     const capZ=Math.min(z,blockHeight)+p.layerHeight;
     const cap=supportHorizontalCap(blocker,capZ,Math.min(z,blockHeight));
     if(cap)exclusionPreview.push({...cap,policy:autoBlocked?'block':'allow'});
    }
    if(autoBlocked)manualBlockers.push(blocker);
   }
   clearanceRegions.push(...cutouts.map(({region})=>({...region,height:z,partial:true})));
   if(bottom){
    part.bottomSkins=bottom.shapes;
    part.bottomHeights=bottom.heights;
    part.bottomSeams=bottom.seams;
    if(p.contactLines)for(const shape of bottom.shapes)part.contactRegions.push({shape,role:'lower',axis,supportFace});
   }
   if(prepareTies){
    part.tiePrism=skinPrism;
    part.tieSections=sections;
    if(!(p.wallBottomSkin||p.wallRoof||p.wallTies))part.tieExclusions=excludedCells;
    if(p.wallTies){
     yield;
     makeCeilingTies(part,bodies,p,onProgress,hold);
    }
   }
   if(roof){
    if(p.contactLines)part.contactRegions.push({shape:hold(roof.clone()),role:'upper',axis,supportFace});
    part.roof=roof;
    if(p.roofSeams||p.roofTabs||p.preview){
     const {roof:finished,tabs,...detail}=roofRemovalDetails(roof,records,shifted,bodies,p,z-p.topGap,onProgress,
      {seams:limits.seams,tabs:limits.tabs,sideGap,protectionTools});
     part.roof=hold(finished);
     part.tabs=tabs.map(hold);
     part.roofInfo=detail;
    }
    if(coverage){
     coverage.item.skinSupport=supportSkinLayer(part.roof,records,axis,top,p);
     if(coverage.item.skinSupport&&p.contactLines&&p.roofLayers===1)part.skinCheck=part.roof;
    }
   }
   if(records.length){
    const blocker=hold(scopedBlocker(face,p,z,zoneTools.map(tool=>{const [low,high]=bounds(tool);return {low,high};})));
    if(R.measureVolume(blocker)>.001){
     part.blocker=blocker;
     part.blockerTrimmed=zoneTools.length>0;
     if(coverage){
      coverage.landings=[...records,...part.fillColumns].map(record=>supportHorizontalCap(record.shape,z-p.topGap)).filter(Boolean);
      coverage.checkExcludedEdge=!!(zoneTools.length||excludedCells.length);
      const spans=faceCandidates.filter(r=>!r.excluded).map(r=>r.bounds);
      coverage.ribBounds=[spans[0][0].slice(),spans[0][1].slice()];
      for(const span of spans)for(const k of [0,1]){
       coverage.ribBounds[0][k]=Math.min(coverage.ribBounds[0][k],span[0][k]);
       coverage.ribBounds[1][k]=Math.max(coverage.ribBounds[1][k],span[1][k]);
      }
     }
    }
   }
   break;
  }
  complete=true;
  return part;
 }catch(error){
  if(error?.supportAdjustmentHints)
   error.supportAdjustmentHints=error.supportAdjustmentHints.map(hint=>({...location,...hint}));
  throw error;
 }finally{
  const kept=new Set();
  if(complete)mapCeilingShapes(part,shape=>{kept.add(shape);return shape;});
  for(const shape of owned)if(!kept.has(shape))shape.delete();
 }
}

function makeCeilingTies(part,bodies,p,onProgress,hold){
 const pairs=p.wallTies?supportWallTiePairs(part.wallRecords,p,part.tieSections):[];
 const key=p.wallTies?JSON.stringify([p.tieInterval,p.autoReinforce,pairs.map(([left,right])=>[left.id,right.id])]):null;
 if(key===part.tieKey)return false;
 if(key){
  let prism=part.tiePrism;
  for(const {low,high} of part.tieExclusions)prism=hold(prism.cut(hold(R.makeBox(low,high))));
  const {shapes,...detail}=makeWallTies(part.wallRecords,prism,bodies,p,onProgress,part.tieSections,pairs);
  part.ties=shapes.map(hold);
  part.tieInfo=detail;
  part.tiePrism=prism;
  part.tieExclusions=[];
 }else{
  part.ties=[];
  part.tieInfo=null;
 }
 part.tieKey=key;
 return true;
}

function* prepareWallSupports(bodies,p,onProgress,scopeCache,ceilingContext,layoutContext,cacheRun){
 const coverageRows=[],trimmedBlockers=new Set(),usedOverrides=new Set(),autoSupportFaces=[],adjustmentHints=[];
 const contactRegions=[],bottomSeams={enabled:!!p.bottomSeams,count:0,skipped:0,sections:0,spacing:p.bottomSectionLength,width:p.bottomSeamWidth};
 const tieIntervals=new Set(),tieAttachments=[],bottomSkins=[],bottomHeights=[],skippedCeilings=[],skippedScopes=[],clearanceRegions=[];
 const model=bodies.get(p.target);if(!model)throw Error('サポートを付けるボディを選択してください');
 const bodyBounds=new Map([...bodies].map(([id,body])=>[id,bounds(body)]));
 const skipSmallExterior=p.mode==='auto'&&p.skipSmallExterior===true;
 const modelBounds=skipSmallExterior||p.sideGap?bodyBounds.get(p.target):null;
 const selection=p.mode==='face'?resolveSupportFaces(model,p):null,faces=selection?.faces||model.faces;
 const owned=[],hold=shape=>(owned.push(shape),shape);
 const wallRecords=[],candidateRibs=[],ribIssues=[],excludedScope=[],ties=[],roofs=[],roofTabs=[],roofPreview=[],roofPlacements=[],roofMatched=[];
 const tieLevels=new Set(),blockers=[],baseBodyIds=new Set(),manualBlockers=[],skinPreview=[],exclusionPreview=[],skinChecks=[];
 const columns=[],columnBlockers=[];
 const writtenCeilings=[];
 let shape,sideGap,selectedFacePreview,firstSkinFailure,columnBases,accepted=false;
 let omitted=0,faceCount=0,skippedTies=0,roofCuts=0,roofSkippedCuts=0,roofSections=0,roofSkippedTabs=0,roofManualInvalid=0;
 let omittedExterior=0,omittedRibPieces=0,omittedBoreFaces=0,omittedThreadFaces=0,omittedHoleFragments=0,nonHorizontalFaces=0,sideGapLimited=false,alignedCeilings=0,sectionCount=0;
 let reusedCeilings=0,rebuiltCeilings=0,reusedScopes=0,reusedLayouts=0,faceNumber=0;
 const gapFill={ribs:0,columns:0,faces:0};
 const getBases=()=>p.baseMode==='bedOrModel'?(columnBases??=supportBaseSurfaces(bodies)):null;
 let upperEnabled=false,lowerEnabled=false,upperPerFace=false,lowerPerFace=false;
 let windows={enabled:false,count:0,skipped:0,limited:false,removedVolume:0,savedPercent:0};
 let windowCuts=[];
 const exportFaces=p.preview||p.saveSupportExport||p.batch===true;
 function faceInfo(face){
  const n=tuple(face.normalAt());
  if(n[2]>=0||n[2]>-.5*Math.hypot(...n))return null;
  const b=bounds(face);
  if(b[0][2]<=p.bedZ+p.topGap+1)return null;
  return {b,horizontal:face.geomType==='PLANE'&&n[2]<=-.999999};
 }
 function nonHorizontal(face,b){
  nonHorizontalFaces++;
  const [low,high]=b,margin=p.layerHeight;
  // Blockers apply to each slice. Keep the layers around the omitted face open.
  excludedScope.push({low:[low[0]-margin,low[1]-margin,low[2]-margin],high:[high[0]+margin,high[1]+margin,high[2]+margin]});
  if(!exportFaces)return;
  const item=supportCoverageFace(face,p.target,p,null,false);
  if(!item)return;
  const reason=face.geomType==='PLANE'?'sloped':'curved';
  item.autoSupportReason=reason;
  autoSupportFaces.push({...item.face,bodyId:p.target,reason});
  if(p.preview)coverageRows.push({item,height:item.selection.point[2],faceBounds:b,index:-1});
 }
 try{
  const protectionTools=supportHoleProtectionTools(model,p.holeProtections,hold);
  selectedFacePreview=p.preview&&selection?supportSelectedFaceMeshes(selection):null;
  const eligible=[];
  for(const [index,face] of faces.entries()){
   const info=faceInfo(face);
   if(!info)continue;
   const z=info.horizontal?tuple(face.center)[2]:null;
   eligible.push({face,index,z,...info,override:info.horizontal?matchSupportFaceOverride(face,p.faceOverrides||[],z):null});
  }
  const threadHoles=p.mode==='auto'&&p.skipSmallBores?
   supportThreadRunoutPlan(eligible.filter(row=>row.horizontal),eligible.filter(row=>!row.horizontal)):null;
  if(exportFaces&&threadHoles)for(const opening of threadHoles.blockers)
   manualBlockers.push(threadOpeningBlocker(opening,bodies,bodyBounds,p));
  for(const {face,index,b,horizontal,z,override} of eligible){
   if(!horizontal){
    if(selection)throw Error('薄壁型は水平な平面の下面を選択してください');
    if(!threadHoles?.internalFaces.has(index))nonHorizontal(face,b);
    continue;
   }
   const ceilingId=p.mode+':'+index,supportFace={number:++faceNumber,height:z,ceilingId};
   if(override)usedOverrides.add(override);
   const settings=override?{...p,...override}:p;
   upperEnabled||=settings.wallRoof;
   lowerEnabled||=settings.wallBottomSkin;
   upperPerFace||=settings.wallRoof!==p.wallRoof||settings.roofLayers!==p.roofLayers;
   lowerPerFace||=settings.wallBottomSkin!==p.wallBottomSkin||settings.bottomSkinLayers!==p.bottomSkinLayers;
   const limits={ribs:96-candidateRibs.length,seams:128-roofCuts,tabs:64-roofTabs.length,columns:p.maxSupports-columns.length};
   const partKey=ceilingContext?JSON.stringify([ceilingContext,ceilingId,b,z,override??null,p.roofSeams?limits.seams:null,p.roofTabs?limits.tabs:null,
    p.fillGaps?[limits.ribs,limits.columns]:null]):null;
   const cached=partKey&&!cacheRun.fresh&&restoreWallCeiling(scopeCache.ceilings,partKey,limits.ribs);
   let part=cached;
   if(part){
    reusedCeilings++;
    onProgress?.({stage:'リブと薄皮を再利用しています',supportFace});
   }else{
    onProgress?.({stage:'リブの配置を準備しています',supportFace});
    yield;
    if(p.sideGap&&!sideGap){
     const scope=[[...modelBounds[0]],[...modelBounds[1]]];
     scope[0][2]=p.bedZ;
     if(p.roofTabs)for(const axis of [0,1]){scope[0][axis]-=p.roofTabLength;scope[1][axis]+=p.roofTabLength;}
     sideGap=createSupportSideGap(bodies,scope,p.sideGap);
    }
    const layout=layoutContext&&JSON.stringify([layoutContext,ceilingId,b,z,limits,
     override&&Object.entries(override).filter(([key])=>key!=='wallPitch')]);
    part=yield* prepareWallCeiling(face,settings,{b,z,bodies,bodyBounds,model,modelBounds,skipSmallExterior,sideGap,limits,override,ceilingId,supportFace,progress:onProgress,getBases,
     threadRunout:threadHoles?.runouts.has(index),scopeCache,freshLayout:cacheRun.fresh,layoutContext:layout,protectionTools});
    if(part.reusedScope)reusedScopes++;
    if(part.reusedLayout){
     reusedLayouts++;
     onProgress?.({stage:'同じ配置のリブと薄皮を再利用しています',supportFace});
    }else rebuiltCeilings++;
   }
   // Blockers are owned separately because trimming replaces their shapes.
   const ownBlockers=new Set([part.blocker,...part.manualBlockers]);
   if(part.blocker){
    if(part.coverage&&part.wallRecords.length){
     part.coverage.index=blockers.length;
     if(part.blockerTrimmed)trimmedBlockers.add(part.coverage.index);
    }
    blockers.push(part.blocker);
   }
   manualBlockers.push(...part.manualBlockers);
   mapCeilingShapes(part,shape=>ownBlockers.has(shape)?shape:hold(shape));
   const reusedPart=cached||part.reusedLayout;
   if(reusedPart&&part.tiePrism)yield;
   const rebuiltTies=reusedPart&&part.tiePrism&&makeCeilingTies(part,bodies,settings,
    update=>onProgress?.({...update,supportFace}),hold);
   if(partKey&&(!cached||rebuiltTies)&&!part.skinFailure){
    const entry=snapshotWallCeiling(part);
    scopeCache.ceilings.set(partKey,entry,partKey.length+entry.snapshot.length);
    writtenCeilings.push(partKey);
    if(part.layoutKey)scopeCache.layouts.set(part.layoutKey,partKey,part.layoutKey.length+partKey.length);
   }
   if(part.coverage)coverageRows.push(part.coverage);
   if(part.skippedScope)skippedScopes.push(part.skippedScope);
   for(const column of part.fillColumns)columns.push({...column,ceilingId,ceilingNumber:supportFace.number,id:'column-'+(columns.length+1)});
   if(part.gapFill){gapFill.ribs+=part.gapFill.ribs;gapFill.columns+=part.gapFill.columns;gapFill.faces++;}
   let addedColumns=[];
   if(p.fallbackPosts&&columns.length<p.maxSupports&&!part.candidateRibs.length&&!part.omittedExterior&&!part.omittedBore&&!part.skippedCeiling){
    addedColumns=supportFallbackColumns({face,faceBounds:b,height:z,bodies,bases:getBases(),settings,
     limit:p.maxSupports-columns.length,protectionTools,onProgress:update=>onProgress?.({...update,supportFace})});
    addedColumns.forEach(({shape,blocker})=>{hold(shape);columnBlockers.push(blocker);});
    if(addedColumns.length){
     const footprint={vertices:[],triangles:[]};
     for(const column of addedColumns){
      const {shape,blocker,...info}=column;
      columns.push({...info,shape,ceilingId,ceilingNumber:supportFace.number,id:'column-'+(columns.length+1)});
      if(info.baseBodyId)baseBodyIds.add(info.baseBodyId);
      if(part.coverage){
       const cap=supportHorizontalCap(blocker,z+p.layerHeight,z);
       if(cap){const offset=footprint.vertices.length/3;footprint.vertices.push(...cap.vertices);footprint.triangles.push(...cap.triangles.map(i=>i+offset));}
      }
     }
     if(part.coverage&&footprint.triangles.length)part.coverage.item.supported=footprint;
    }
   }
   if(part.skippedCeiling){
    skippedCeilings.push(part.skippedCeiling);
    adjustmentHints.push(...(part.skinFailure?.supportAdjustmentHints||[]));
   }
   if(part.blockedRibs&&p.baseMode==='bed'&&!addedColumns.length)
    adjustmentHints.push({kind:'base-blocked',ceilingId,number:supportFace.number,selection:part.coverage?.item.selection});
   firstSkinFailure??=part.skinFailure;
   sideGapLimited||=part.sideGapLimited;
   if(part.omittedExterior)omittedExterior++;
   if(part.omittedBore==='bore')omittedBoreFaces++;
   if(part.omittedBore==='thread')omittedThreadFaces++;
   omittedHoleFragments+=part.omittedHoleFragments||0;
   if(part.aligned)alignedCeilings++;
   sectionCount+=part.sections||0;
   if(!addedColumns.length)omitted+=part.blockedRibs||0;
   omittedRibPieces+=part.omittedRibPieces||0;
   if(part.wallRecords.length||addedColumns.length)faceCount++;
   for(const rib of part.candidateRibs){
    rib.number=candidateRibs.length+1;
    if(part.skinPreview.length)rib.skinGroup=skinPreview.length;
    candidateRibs.push(rib);
   }
   if(part.skinPreview.length)skinPreview.push(part.skinPreview);
   wallRecords.push(...part.wallRecords);
   for(const id of part.baseBodyIds||[])baseBodyIds.add(id);
   contactRegions.push(...part.contactRegions);
   clearanceRegions.push(...part.clearanceRegions);
   excludedScope.push(...part.excludedScope);
   exclusionPreview.push(...part.exclusionPreview);
   bottomSkins.push(...part.bottomSkins);
   if(part.bottomSeams){
    bottomHeights.push(...part.bottomHeights);
    for(const key of ['count','skipped','sections'])bottomSeams[key]+=part.bottomSeams[key];
    if(bottomSeams.count>128)throw supportAdjustmentError('底面薄皮の分割数が多すぎます',{kind:'bottom-seams'});
   }
   if(ties.length+part.ties.length>512)throw supportAdjustmentError('横つなぎが多すぎます。高さの間隔を広げるか対象面を絞ってください',
    {kind:'tie-limit'});
   ties.push(...part.ties);
   if(part.tieInfo){
    for(const height of part.tieInfo.levels)tieLevels.add(height);
    for(const interval of part.tieInfo.intervals)tieIntervals.add(interval);
    tieAttachments.push(...part.tieInfo.attachments);
    skippedTies+=part.tieInfo.skipped;
   }
   if(part.roof)roofs.push(part.roof);
   if(part.skinCheck)skinChecks.push({item:part.coverage.item,shape:part.skinCheck});
   roofTabs.push(...part.tabs);
   if(part.roofInfo){
    const detail=part.roofInfo;
    roofPreview.push(...detail.preview.map(part=>({...part,ceilingId})));
    roofPlacements.push(...detail.placements);
    roofMatched.push(...detail.matched);
    roofManualInvalid+=detail.manualInvalid;
    roofCuts+=detail.seams.count;
    roofSkippedCuts+=detail.seams.skipped;
    roofSections+=detail.seams.sections;
    roofSkippedTabs+=detail.tabInfo.skipped;
   }
  }
  onProgress?.({stage:'3MFの自動サポート範囲を調整しています'});
  yield;
  if(selection&&exportFaces){
   const sourceFaces=model.faces;
   try{
    for(const face of sourceFaces){
     const info=faceInfo(face);
     if(!info)continue;
     const {b,horizontal}=info;
     if(!horizontal){nonHorizontal(face,b);continue;}
     const z=tuple(face.center)[2];
     const item=supportCoverageFace(face,p.target,p,null,false);
     if(!item||faces.some(selected=>supportFaceContainsPoint(selected,item.selection.point)))continue;
     if(p.preview)coverageRows.push({item,height:z,faceBounds:b,index:-1});
     skippedScopes.push(hold(scopedBlocker(face,p,z,[])));
    }
   }finally{sourceFaces.forEach(face=>face.delete());}
  }
  const walls=wallRecords.map(record=>record.shape);
  // Leave slicer support available below omitted ceilings and excluded ribs.
  const trimBlockers=tool=>{const [low,high]=bounds(tool);for(let i=0;i<blockers.length;i++){const b=bounds(blockers[i]);if([0,1,2].some(k=>b[1][k]<=low[k]||b[0][k]>=high[k]))continue;const next=blockers[i].cut(tool);blockers[i].delete();blockers[i]=next;trimmedBlockers.add(i);}};
  for(const cell of excludedScope){const tool=R.makeBox(cell.low,cell.high);try{trimBlockers(tool);}finally{tool.delete();}}
  for(const tool of skippedScopes)trimBlockers(tool);
  const coverage=p.preview?supportCoverageRegions(coverageRows,blockers,trimmedBlockers,p):[];
  for(let i=blockers.length-1;i>=0;i--)if(R.measureVolume(blockers[i])<.001){blockers[i].delete();blockers.splice(i,1);}
  // The blocker must cross the sampled layer when its cap lands exactly on a bore floor.
  if(exportFaces)for(const {protection} of protectionTools)manualBlockers.push(supportHoleCylinder(protection,p.layerHeight));
  blockers.push(...manualBlockers.splice(0),...columnBlockers.splice(0));
  if(p.mode==='auto'&&usedOverrides.size!==(p.faceOverrides?.length||0))throw Error('個別設定の下面が見つかりません。設定する下面を選び直してください');
  if(faceNumber===1)for(const hint of adjustmentHints)if(hint.selection)hint.onlyCeiling=true;
  if(!candidateRibs.length&&!columns.length){
   const error=firstSkinFailure||Error(sideGapLimited?(p.keepRibThickness?'指定した厚みと':'')+'側壁との横すき間を確保できる場所がありません。すき間を小さくするか、対象面を選び直してください':omittedExterior?'外側の細い張り出しを省きました。支える場合は対象面を選ぶか、外側の小片を省く設定を外してください':omittedBoreFaces?'小さな丸穴の底・段差を自動配置で省きました。支える場合は下面を選んでください。':'薄壁を置ける水平な下面がありません。土台と高さを確認してください');
   if(firstSkinFailure)error.supportClearanceRegions=clearanceRegions;
   if(coverage.length)error.supportCoverage=coverage;
   if(sideGapLimited)adjustmentHints.push({kind:'no-width'});
   if(omittedExterior)adjustmentHints.push({kind:'exterior-only'});
   if(adjustmentHints.length)error.supportAdjustmentHints=adjustmentHints;
   if(protectionTools.length)error.message+=' 保護範囲の深さ・外側の長さ・余白も確認してください。';
   throw error;
  }
  const missingRibs=p.excludedRibs.filter(id=>!candidateRibs.some(r=>r.id===id||r.ribId===id));if(missingRibs.length)ribIssues.push('リブの配置が変わったため古い除外指定を使えません。除外をすべて解除してください');if(!walls.length&&!columns.length)ribIssues.push('すべてのリブが除外されています。1枚以上戻してください');
  if(ribIssues.length&&!p.preview)throw Error([...new Set(ribIssues)].join('。'));
  const missingPlacements=(faceNumber?upperEnabled:p.wallRoof)&&p.roofTabs?(p.roofTabPlacements||[]).filter(v=>!roofMatched.includes(v.sectionId)).map(v=>v.sectionId):[];roofManualInvalid+=missingPlacements.length;
  if(roofManualInvalid&&!p.preview)throw Error('指定した位置にタブを作成できません。プレビューで位置を選び直すか自動配置に戻してください');
  onProgress?.({stage:'各下面のリブと薄皮を結合しています'});
  function* fuse(solids){
   try{return yield* fuseSupportSolidSteps(solids,{onProgress,cache:scopeCache?.unions});}
   catch(error){
    if((reusedScopes||reusedCeilings||reusedLayouts)&&!(error instanceof WebAssembly.RuntimeError))cacheRun.rejected=true;
    throw error;
   }
  }
  if(walls.length)shape=yield* fuse([...walls,...ties,...roofs,...roofTabs,...bottomSkins]);
  if(shape&&p.wallWindows){
   yield;
   const cut=makeWallWindows(shape,wallRecords,ties,p,onProgress,[...roofs,...roofTabs,...bottomSkins]);
   shape.delete();shape=cut.shape;windows=cut.analysis;windowCuts=cut.cuts;
  }
  if(columns.length){
   const mixed=yield* fuse([...(shape?[shape]:[]),...columns.map(column=>column.shape)]);
   shape?.delete();shape=mixed;
  }
  for(const candidate of candidateRibs)if(!candidate.excluded){const b=candidate.bounds;candidate.risk=supportRibRisk({height:b[1][2]-b[0][2],thickness:candidate.thickness??p.wallThickness,bottom:b[0][2],top:b[1][2],levels:tieAttachments.filter(a=>a.ribs.includes(candidate.id)).map(a=>a.z)});}
  const analysis={style:'walls',edgeMargin:p.edgeMargin,count:walls.length,contacts:[],topGap:p.topGap,bottomGap:0,baseMode:p.baseMode,baseBodyIds:[...baseBodyIds],modelBasedCount:baseBodyIds.size?walls.length:0,bedBasedCount:baseBodyIds.size?0:walls.length,footDiameter:p.footDiameter,postDiameter:p.wallThickness,reinforcements:ties.length,skipped:omitted,omittedReinforcement:skippedTies,limited:false,bedZ:p.bedZ,wallPitch:p.wallPitch,wallThickness:p.wallThickness,layerHeight:p.layerHeight,faceCount,blockerCount:blockers.length,complete:omitted===0&&!ribIssues.length,wallTies:{enabled:p.wallTies,interval:p.tieInterval,count:ties.length,levels:[...tieLevels].sort((a,b)=>a-b),thickness:2*p.layerHeight,neckWidth:Math.min(Math.max(1.6,Math.min(3,2*p.wallThickness)),Math.max(.6,p.wallThickness))}};
  if(p.sideGap)analysis.sideGap=p.sideGap;
  if(protectionTools.length)analysis.holeProtections=protectionTools.map(tool=>tool.protection);
  if(p.fillGaps)analysis.gapFill=gapFill;
  if(p.fallbackPosts){
   const fallback=columns.filter(column=>!column.local);
   analysis.columnFallback={count:fallback.length,faces:new Set(fallback.map(column=>column.ceilingId)).size,diameter:p.fallbackDiameter};
  }
  if(alignedCeilings)analysis.sideGapAlignedCeilings=alignedCeilings;
  if(sectionCount)analysis.sideGapSections=sectionCount;
  if(nonHorizontalFaces)analysis.nonHorizontalFaces=nonHorizontalFaces;
  if(reusedCeilings)analysis.ceilingReuse={reused:reusedCeilings,rebuilt:rebuiltCeilings};
  if(reusedScopes)analysis.ceilingScopeReuse={reused:reusedScopes};
  if(reusedLayouts)analysis.ceilingLayoutReuse={reused:reusedLayouts};
  if(skippedCeilings.length)analysis.skippedCeilings=skippedCeilings;
  if(omittedExterior||omittedRibPieces)analysis.omittedExterior={faces:omittedExterior,ribPieces:omittedRibPieces};
  if(omittedBoreFaces)analysis.omittedBoreFaces=omittedBoreFaces;
  if(omittedThreadFaces)analysis.omittedThreadFaces=omittedThreadFaces;
  if(omittedHoleFragments)analysis.omittedHoleFragments=omittedHoleFragments;
  if(clearanceRegions.length)analysis.clearanceRegions=clearanceRegions;
  analysis.bottomSkin={enabled:faceNumber?lowerEnabled:!!p.wallBottomSkin,...(lowerPerFace?{perFace:true}:{}),count:bottomSkins.length,layers:p.bottomSkinLayers,thickness:p.bottomSkinLayers*p.layerHeight,heights:[...new Set(bottomHeights)].sort((a,b)=>a-b),contactGap:0,...(p.bottomSeams?{seams:bottomSeams}:{})};analysis.wallTies.auto=!!p.autoReinforce;analysis.wallTies.intervals=[...tieIntervals].sort((a,b)=>a-b);analysis.strength={heuristic:true,ribs:candidateRibs.filter(r=>!r.excluded).map(({id,number,risk})=>({id,number,...risk})),skippedTies};
  analysis.roof={enabled:faceNumber?upperEnabled:!!p.wallRoof,...(upperPerFace?{perFace:true}:{}),count:roofs.length,layers:p.roofLayers??2,thickness:(p.roofLayers??2)*p.layerHeight};if(analysis.roof.enabled&&p.roofSeams)analysis.roof.seams={enabled:true,count:roofCuts,skipped:roofSkippedCuts,sections:roofSections,spacing:p.roofSectionLength,width:p.roofSeamWidth};if(analysis.roof.enabled&&p.roofTabs)analysis.roof.tabs={enabled:true,count:roofTabs.length,skipped:roofSkippedTabs,length:p.roofTabLength,width:4,...((p.roofTabPlacements||[]).length?{manualInvalid:roofManualInvalid}:{})};if(roofManualInvalid)analysis.complete=false;analysis.windows=windows;analysis.printSettings=supportPrintSettings(p);analysis.ribs={total:candidateRibs.length,excluded:candidateRibs.filter(r=>r.excluded).length,direction:p.wallDirection,edgeAligned:!!p.edgeRibs,issues:[...new Set(ribIssues)],missing:missingRibs};analysis.selection={mode:p.mode,count:selection?.faces.length||0};const result={shape,analysis,blockers,coverage,autoSupportFaces,selectedFaces:selectedFacePreview,
   wallRecords:p.preview&&p.contactLines?wallRecords.map(record=>({...record,shape:record.shape.clone()})):[],
   contactRegions:contactRegions.map(region=>({...region,shape:region.shape.clone()})),
   skinChecks:skinChecks.map(({item,shape})=>({index:coverage.indexOf(item),shape:shape.clone()})),
   ribPreview:candidateRibs,skinPreview,exclusionPreview,windowCuts,roofPreview:{contactLines:!!p.contactLines,parts:roofPreview,placements:roofPlacements,missing:missingPlacements},
   columnPreview:p.preview?columns.map(({shape,...info})=>({...info,...cadMesh(shape)})):[]};
  shape=null;accepted=true;return {...result,adjustmentHints};
 }catch(e){
  for(const key of writtenCeilings)scopeCache.ceilings.delete(key);
  throw e;
 }finally{
  if(!accepted)[...blockers,...manualBlockers,...columnBlockers].forEach(shape=>shape.delete());
  shape?.delete();owned.forEach(s=>s.delete());faces.forEach(f=>f.delete());sideGap?.dispose();columnBases?.delete();
 }
}

function clearanceDetails(error,bounds,height){
 const regions=error.regions.length?error.regions:[{bounds,role:error.role,thickness:error.thickness}];
 return regions.map(region=>({...region,height,partial:false}));
}

const contactOptions=new Set([
 'topContactLines','bottomContactLines','interfaceLineWidth','interfaceSpacing',
 'bottomInterfaceLineWidth','bottomInterfaceSpacing','bottomContactInset',
 'topContactRim','topContactRimWidth','filamentDiameter','materialDensity',
]);
const finishingOptions=new Set(['wallTies','tieInterval','autoReinforce','wallWindows']);
const wallCaches={
 solids:createPrintSupportCache(8_000_000,48),caps:createPrintSupportCache(4_000_000,96),
 unions:createPrintSupportCache(12_000_000,24),contact:createPrintSupportCache(16_000_000,64),
 ribMeshes:createPrintSupportCache(8_000_000,96),ceilings:createPrintSupportCache(12_000_000,72),
 layouts:createPrintSupportCache(1_000_000,128),structures:createPrintSupportCache(8_000_000,3),
};

function wallBodiesKey(bodies,bodyKey){
 if(!bodyKey)return null;
 const tokens=[...bodies].map(([id,shape])=>[id,bodyKey(shape)]);
 return tokens.every(([,token])=>token!=null)?tokens:null;
}

function wallContextOptions(p,ceilingOnly=false,layoutOnly=false){
 return Object.keys(p).sort()
  .filter(key=>key!=='faceOverrides'&&!contactOptions.has(key)&&!(ceilingOnly&&finishingOptions.has(key))&&!(layoutOnly&&key==='wallPitch'))
  .map(key=>[key,p[key]]);
}

function wallScopeCache(key){
 return key?Object.fromEntries(Object.entries(wallCaches).map(([name,cache])=>[name,cache.scope(key)])):null;
}

function restoreWallScope(cache,key,hold){
 const saved=cache.solids.get(key);
 if(!saved)return null;
 try{
  const beforeGap=hold(R.deserializeShape(saved.beforeGap).asShape3D());
  const prism=saved.gapTrimmed?hold(R.deserializeShape(saved.prism).asShape3D()):beforeGap;
  const shifted=hold(R.deserializeShape(saved.shifted));
  return {...saved,shifted,beforeGap,prism};
 }catch(error){
  cache.solids.delete(key);
  if(error instanceof WebAssembly.RuntimeError)throw error;
  return null;
 }
}

function saveWallScope(cache,key,{shifted,beforeGap,prism,...scope}){
 try{
  const profile=shifted.serialize(),first=beforeGap.serialize(),trimmed=scope.gapTrimmed?prism.serialize():null;
  cache.solids.set(key,{...scope,shifted:profile,beforeGap:first,prism:trimmed},profile.length+first.length+(trimmed?.length||0));
 }catch(error){if(error instanceof WebAssembly.RuntimeError)throw error;}
}

function cachedWallCap(cache,key,name,build){
 if(!key)return build();
 const stamp=key+':'+name,entry=cache.caps.get(stamp);
 if(entry)return entry.mesh;
 const mesh=build();
 const meshes=Array.isArray(mesh)?mesh:mesh?[mesh]:[];
 const size=meshes.reduce((size,{vertices,triangles})=>size+8*(vertices.length+triangles.length),0);
 cache.caps.set(stamp,{mesh},size);
 return mesh;
}

function mapCeilingShapes(part,transform){
 const seen=new Map();
 const map=shape=>{
  if(shape==null)return null;
  if(!seen.has(shape))seen.set(shape,transform(shape));
  return seen.get(shape);
 };
 const mapRecords=records=>records.map(record=>({...record,shape:map(record.shape)}));
 return {...part,blocker:map(part.blocker),skippedScope:map(part.skippedScope),skinCheck:map(part.skinCheck),
  roof:map(part.roof),tiePrism:map(part.tiePrism),tabs:part.tabs.map(map),manualBlockers:part.manualBlockers.map(map),
  bottomSkins:part.bottomSkins.map(map),ties:part.ties.map(map),
  wallRecords:mapRecords(part.wallRecords),contactRegions:mapRecords(part.contactRegions),fillColumns:mapRecords(part.fillColumns)};
}

function restoreWallCeiling(cache,key,ribs){
 const entry=cache.get(key);
 if(!entry||ribs<entry.minRibs||entry.ribQuota!==null&&ribs!==entry.ribQuota)return null;
 const restored=[];
 try{
  const {part,breps}=JSON.parse(entry.snapshot);
  return mapCeilingShapes(part,index=>{
   const shape=R.deserializeShape(breps[index]).asShape3D();
   restored.push(shape);
   return shape;
  });
 }catch(error){
  restored.forEach(shape=>shape.delete());
  cache.delete(key);
  if(error instanceof WebAssembly.RuntimeError)throw error;
  return null;
 }
}

function snapshotWallCeiling(ceiling){
 const breps=[],part=mapCeilingShapes(ceiling,shape=>breps.push(shape.serialize())-1);
 delete part.reusedLayout;
 const snapshot=JSON.stringify({part,breps});
 return {snapshot,minRibs:ceiling.minRibs,ribQuota:ceiling.ribQuota};
}

function mapStructureShapes(prepared,map){
 const mapRecords=records=>records.map(record=>({...record,shape:map(record.shape)}));
 return {...prepared,shape:prepared.shape&&map(prepared.shape),blockers:prepared.blockers.map(map),
  wallRecords:mapRecords(prepared.wallRecords),contactRegions:mapRecords(prepared.contactRegions),skinChecks:mapRecords(prepared.skinChecks)};
}

function reuseWallStructure(cache,key){
 const snapshot=key&&cache.get(key);
 if(!snapshot)return null;
 const restored=[];
 try{
  return mapStructureShapes(JSON.parse(snapshot),brep=>{
   const shape=R.deserializeShape(brep).asShape3D();
   restored.push(shape);return shape;
  });
 }catch(error){
  restored.forEach(shape=>shape.delete());cache.delete(key);
  if(error instanceof WebAssembly.RuntimeError)throw error;
  return null;
 }
}

export function makeWallSupports(bodies,p,onProgress,options){
 return finishCadSteps(makeWallSupportSteps(bodies,p,onProgress,options));
}

export function* makeWallSupportSteps(bodies,p,onProgress,{bodyKey}={}){
 const tokens=p.preview?wallBodiesKey(bodies,bodyKey):null;
 const scopes=wallScopeCache(tokens&&JSON.stringify([tokens,p.target]));
 const key=scopes&&p.contactLines?JSON.stringify([wallContextOptions(p),p.faceOverrides??[]]):null;
 const reused=reuseWallStructure(scopes?.structures,key);
 if(reused)onProgress?.({stage:'リブ本体と横つなぎを再利用しています'});
 let prepared=reused;
 if(!prepared){
  const ceilingContext=scopes&&JSON.stringify(wallContextOptions(p,true));
  const layoutContext=scopes&&!p.fillGaps&&!p.fallbackPosts&&JSON.stringify(wallContextOptions(p,true,true));
  const cacheRun={rejected:false,fresh:false};
  try{prepared=yield* prepareWallSupports(bodies,p,onProgress,scopes,ceilingContext,layoutContext,cacheRun);}
  catch(error){
   if(!cacheRun.rejected)throw error;
   onProgress?.({stage:'結合に使う形状を作り直しています'});
   // Rebuild the input layout to preserve shared CAD edges. Exact matching
   // unions remain safe to use when the rebuilt input has the same topology.
   prepared=yield* prepareWallSupports(bodies,p,onProgress,scopes,ceilingContext,layoutContext,{fresh:true});
  }
 }
 const {analysis,blockers,wallRecords,contactRegions,skinChecks,ribPreview,skinPreview,exclusionPreview,windowCuts,roofPreview,selectedFaces,coverage,autoSupportFaces,adjustmentHints,columnPreview}=prepared;
 let shape=prepared.shape,accepted=false,contactPreview=[],flatSkinPreview=[];
 try{
  if(key&&!reused){
   const snapshot=JSON.stringify(mapStructureShapes(prepared,shape=>shape.serialize()));
   scopes.structures.set(key,snapshot,key.length+snapshot.length);
  }
  const windows=analysis.windows;
  let contactAnalysis={enabled:!!p.contactLines,width:p.lineWidth,spacing:p.interfaceSpacing,depth:p.layerHeight,upper:0,lower:0,bedPreserved:0,slots:0,removedVolume:0};
  if(shape&&p.contactLines){
   const cut=yield* supportContactSteps(shape,contactRegions,p,onProgress,{
    ribRecords:wallRecords,ribsAreContained:!p.wallWindows,
    allowPartial:ribPreview.some(rib=>rib.excluded&&rib.id!==rib.ribId),cache:scopes?.contact,meshCache:scopes?.ribMeshes,
   });
   shape.delete();shape=cut.shape;contactAnalysis=cut.analysis;contactPreview=cut.preview;flatSkinPreview=cut.flatSkinPreview;
   if(contactAnalysis.upper)for(const check of skinChecks){
    const row=coverage[check.index],finished=check.shape.intersect(shape);
    try{row.skinSupport=refreshSupportSkinLayer(row.skinSupport,finished);}finally{finished.delete();}
   }
   const meshesById=new Map(cut.ribPreview.map(mesh=>[mesh.id,mesh]));
   for(const rib of ribPreview)Object.assign(rib,meshesById.get(rib.id));
   if(windows.enabled){
    windows.originalVolume=R.measureVolume(shape)+windows.removedVolume;
    windows.savedPercent=windows.originalVolume?100*windows.removedVolume/windows.originalVolume:0;
   }
  }
  if(shape){
   onProgress?.({stage:'サポート全体と本体の干渉を確認しています'});
   yield;
   const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);
   try{if(!check.IsValid())throw Error('正常な薄壁サポートを作成できませんでした');}finally{check.delete();}
   const supportBox=bounds(shape);
   for(const model of bodies.values()){
    if(!supportBoxesTouch(supportBox,bounds(model)))continue;
    const common=shape.intersect(model);
    try{if(R.measureVolume(common)>.0001)throw Error('薄壁が本体に入り込むため作成を中止しました');}
    finally{common.delete();}
   }
  }
  const solids=shape?.solids||[];
  analysis.components=solids.length;solids.forEach(s=>s.delete());
  const volume=shape?R.measureVolume(shape):0;
  analysis.contactInterface=contactAnalysis;
  analysis.material=supportMaterialEstimate(volume,p,windows.enabled?windows.originalVolume:volume);
  if(reused){delete analysis.ceilingReuse;delete analysis.ceilingScopeReuse;delete analysis.ceilingLayoutReuse;analysis.reusedStructure=true;}
  accepted=true;
  return {shape,analysis,blockers,autoSupportFaces,...(selectedFaces?{selectedFaces}:{}),...(p.preview?{contactPreview,ribPreview,skinPreview,windowCuts,roofPreview,coverage,adjustmentHints,columnPreview,
   printRegions:[...exclusionPreview,...flatSkinPreview]}:{})};
 }finally{
  if(!accepted){shape?.delete();blockers.forEach(s=>s.delete());}
  for(const record of [...wallRecords,...contactRegions,...skinChecks])record.shape.delete();
 }
}
