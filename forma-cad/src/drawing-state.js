import {canOverrideDrawingDimensionValue,dimensionValue,isCircularDimensionKind,validDimensionColor,validDrawingDimensionDisplayValue} from './drawing-dimensions.js';
import {drawingProjectionNames,validDrawingDetailFactor,validDrawingScale} from './drawing-view-preferences.js';
import {autoDimensionKeys,autoDimensionViewTypes} from './drawing-auto-dimensions.js';
import {validateFrame} from './frames.js';
import {drawingReferenceCircleLimit} from './drawing-dimension-references.js';
import {hasDrawingCommentFont,validCommentWidth} from './drawing-comments.js';
import {validDrawingPrintPalette} from './drawing-print-palette.js';
import {maxDrawingTableHoles} from './drawing-hole-table.js';
import {holeReferenceLimit,validDrawingHoleCenterReference} from './drawing-hole-references.js';
import {maxDrawingLeaders,maxDrawingLeaderText} from './drawing-leaders.js';
import {validDrawingThreadReference} from './drawing-thread-annotations.js';
import {drawingThreadRimKinds} from './drawing-thread-dimensions.js';
import {maxDrawingDimensionPoints} from './drawing-dimension-points.js';
const extraId=id=>typeof id==='string'&&/^(section|detail)-[a-zA-Z0-9-]{1,60}$/.test(id);
const coordinates=(p,axes)=>Array.isArray(p)&&p.length===axes&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e6);
const point=p=>coordinates(p,2);
const validReview=item=>item.review===undefined||typeof item.review==='boolean';
const validDimensionPlacement=placement=>point(placement?.at)&&
 (placement.alongOffset===undefined||Number.isFinite(placement.alongOffset)&&Math.abs(placement.alongOffset)<=1e6);
export function drawingSignature(features){let a=2166136261,b=5381;for(const c of JSON.stringify(features)){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b,33)^c.charCodeAt(0);}return (a>>>0).toString(16)+(b>>>0).toString(16);}
export function readDrawingState(value){if(value==null)return null;const fail=()=>{throw Error('図面編集データが不正です');};if(value.version!==1||typeof value.signature!=='string'||!Array.isArray(value.dimensions)||value.dimensions.length>500)fail();
 const s=structuredClone(value);if(!validDrawingScale(s.scale)||typeof s.hidden!=='boolean'||typeof s.comment!=='string'||s.comment.length>2000||!Array.isArray(s.targets)||s.targets.some(id=>typeof id!=='string')||!['visible','selected'].includes(s.targetMode))fail();
 const o=s.options;if(!o||!['auto','A4','A3'].includes(o.paper)||!['landscape','portrait'].includes(o.orientation)||typeof o.frame!=='boolean')fail();if(o.viewPriority!==undefined&&!['balanced','front'].includes(o.viewPriority)||o.isoMode!==undefined&&!['full','small','hidden'].includes(o.isoMode))fail();if(o.layout!==undefined&&!['projection','compact'].includes(o.layout))fail();for(const key of ['name','material','date'])if(typeof o[key]!=='string'||o[key].length>100)fail();
 if(o.revision!==undefined&&(typeof o.revision!=='string'||o.revision.length>20))fail();
 if(o.showLayoutLabel!==undefined&&typeof o.showLayoutLabel!=='boolean')fail();
 if(o.projectionLocked!==undefined&&typeof o.projectionLocked!=='boolean')fail();
 if(o.linkedProjections!==undefined&&typeof o.linkedProjections!=='boolean')fail();
 if(o.linkedProjectionScales!==undefined&&typeof o.linkedProjectionScales!=='boolean')fail();
 if(o.autoIsoScale!==undefined&&!validDrawingScale(o.autoIsoScale))fail();
 if(o.autoDimensionTypes!==undefined&&(!Array.isArray(o.autoDimensionTypes)||o.autoDimensionTypes.length>autoDimensionKeys.length||new Set(o.autoDimensionTypes).size!==o.autoDimensionTypes.length||o.autoDimensionTypes.some(key=>!autoDimensionKeys.includes(key))))fail();
 if(o.groupRepeatedDimensions!==undefined&&typeof o.groupRepeatedDimensions!=='boolean')fail();
 if(o.uniqueOverallDimensions!==undefined&&typeof o.uniqueOverallDimensions!=='boolean')fail();
 if(o.viewSelection!==undefined&&(!Array.isArray(o.viewSelection)||o.viewSelection.length>drawingProjectionNames.length||
  new Set(o.viewSelection).size!==o.viewSelection.length||o.viewSelection.some(view=>!drawingProjectionNames.includes(view))||
  !o.viewSelection.length&&o.isoMode==='hidden'))fail();
 if(o.commentSize!=null&&(!Number.isFinite(o.commentSize)||o.commentSize<1.5||o.commentSize>10))fail();
 if(o.commentColor!==undefined&&!validDimensionColor(o.commentColor))fail();
 if(o.previewBackground!==undefined&&!validDimensionColor(o.previewBackground))fail();
 for(const key of ['paperBackground','viewBackground'])if(o[key]!==undefined&&!validDimensionColor(o[key]))fail();
 if(o.paperBackground===undefined&&o.previewBackground!==undefined&&o.previewBackground.toLowerCase()!=='#d8e0e5')o.paperBackground=o.previewBackground;
 delete o.previewBackground;
 if(o.commentFont!==undefined&&!hasDrawingCommentFont(o.commentFont))fail();
 if(o.breakAxis!==undefined&&!['longest','x','y','z'].includes(o.breakAxis))fail();
 if(o.breakPercent!==undefined&&(!Number.isInteger(o.breakPercent)||o.breakPercent<20||o.breakPercent>90))fail();
 if(o.pdfLayout!==undefined&&!['multi','manual'].includes(o.pdfLayout))fail();
 if(o.pdfPlacement!==undefined&&!['keep','auto'].includes(o.pdfPlacement))fail();
 if(o.printPalette!==undefined&&!validDrawingPrintPalette(o.printPalette))fail();
 const comments=o.comments===undefined?[]:o.comments;
 if(!Array.isArray(comments)||comments.length>16)fail();
 const commentIds=new Set();
 for(const note of comments){
  if(!note||typeof note.id!=='string'||!/^comment-[a-zA-Z0-9-]{1,60}$/.test(note.id)||commentIds.has(note.id)||
   typeof note.text!=='string'||note.text.length>2000||!Number.isFinite(note.size)||note.size<1.5||note.size>10||
   typeof note.font!=='string'||note.font!==''&&!hasDrawingCommentFont(note.font)||!validDimensionColor(note.color))fail();
  commentIds.add(note.id);
 }
 if(o.commentWidths!==undefined){
  const widths=o.commentWidths;
  if(!widths||typeof widths!=='object'||Array.isArray(widths)||
   Object.entries(widths).some(([id,width])=>(id!=='comment'&&!commentIds.has(id))||!validCommentWidth(width)))fail();
 }
 if(o.breakRange!==undefined&&(!point(o.breakRange)||o.breakRange[0]<.005||o.breakRange[1]>.995||o.breakRange[1]-o.breakRange[0]<.03-1e-10))fail();
 if(o.holeTable!==undefined){
  const table=o.holeTable;
  if(!table||!drawingProjectionNames.includes(table.view)||!point(table.origin)||
   !Array.isArray(table.holes)||!table.holes.length||table.holes.length>maxDrawingTableHoles||
   table.holes.some(hole=>!point(hole?.center)||!Number.isFinite(hole.radius)||hole.radius<=0||hole.radius>1e6)||
   !validReview(table)||table.originReview!==undefined&&typeof table.originReview!=='boolean')fail();
  const validSource=h=>validDrawingThreadReference(h.threadRef)&&(h.sourceId===undefined||typeof h.sourceId==='string'&&h.sourceId.length>0&&h.sourceId.length<=200);
  const numbers=table.holes.map((h,i)=>h.number??i+1);
  if(new Set(numbers).size!==numbers.length||numbers.some(n=>!Number.isSafeInteger(n)||n<1)||
   table.lastNumber!==undefined&&(!Number.isSafeInteger(table.lastNumber)||table.lastNumber<Math.max(...numbers))||
   table.holes.some(h=>!validSource(h)||h.review!==undefined&&typeof h.review!=='boolean'))fail();
  if(table.references!==undefined&&(!Array.isArray(table.references)||table.references.length>holeReferenceLimit||
   table.references.some(h=>!point(h?.center)||!Number.isFinite(h.radius)||h.radius<=0||h.radius>1e6||!validSource(h))))fail();
 }
 if(o.dimensionFontSize!==undefined&&(!Number.isFinite(o.dimensionFontSize)||o.dimensionFontSize<1.5||o.dimensionFontSize>10))fail();
 if(o.dimensionColors!==undefined&&(!o.dimensionColors||typeof o.dimensionColors!=='object'||Array.isArray(o.dimensionColors)||
  Object.entries(o.dimensionColors).some(([key,value])=>!['lineColor','textColor'].includes(key)||!validDimensionColor(value))))fail();
 if(o.frontFrame!==undefined){try{validateFrame(o.frontFrame);}catch{fail();}}
 if(o.autoDimensionViews!==undefined){
  if(!o.autoDimensionViews||typeof o.autoDimensionViews!=='object'||Array.isArray(o.autoDimensionViews))fail();
  for(const [view,types] of Object.entries(o.autoDimensionViews)){
   if(view!=='iso'&&!drawingProjectionNames.includes(view)||!Array.isArray(types)||new Set(types).size!==types.length||
    types.some(type=>!Object.hasOwn(autoDimensionViewTypes(view),type)))fail();
  }
 }
 const sections=o.sections||[],details=o.details||[],markers=o.markers||[];if(!Array.isArray(sections)||sections.length>8||!Array.isArray(details)||details.length>8||!Array.isArray(markers)||markers.length>200)fail();
 const viewNames=new Set(drawingProjectionNames),ids=new Set();for(const section of sections){if(!extraId(section.id)||!section.id.startsWith('section-')||ids.has(section.id)||!viewNames.has(section.view)||!['vertical','horizontal'].includes(section.orientation)||!Number.isFinite(section.coordinate)||Math.abs(section.coordinate)>1e6||typeof section.reverse!=='boolean'||!validReview(section))fail();ids.add(section.id);}
 for(const id of ids)viewNames.add(id);
 for(const detail of details){
  if(!extraId(detail.id)||!detail.id.startsWith('detail-')||ids.has(detail.id)||!viewNames.has(detail.view)||!point(detail.center)||
   !Number.isFinite(detail.radius)||detail.radius<=0||detail.radius>1e6||!validDrawingDetailFactor(detail.factor)||!validReview(detail))fail();
  const placements=detail.dimensionPlacements;
  if(placements!==undefined){
   if(!placements||typeof placements!=='object'||Array.isArray(placements))fail();
   const entries=Object.entries(placements);
   if(entries.length>500||entries.some(([key,item])=>!key.startsWith('[')||key.length>160||!item||
    (item.overview===undefined&&item.pdf===undefined)||
    (item.overview!==undefined&&!validDimensionPlacement(item.overview))||
    (item.pdf!==undefined&&!validDimensionPlacement(item.pdf))))fail();
  }
  ids.add(detail.id);
 }
 for(const id of ids)viewNames.add(id);
 if(s.dimensionPoints!==undefined){
  if(!Array.isArray(s.dimensionPoints)||s.dimensionPoints.length>maxDrawingDimensionPoints)fail();
  const pointIds=new Set();
  for(const item of s.dimensionPoints){
   if(!item||typeof item.id!=='string'||!/^dimension-point-[a-zA-Z0-9-]{1,60}$/.test(item.id)||
    pointIds.has(item.id)||!viewNames.has(item.view)||!point(item.point)||!validReview(item)||
    item.holeRef!==undefined&&!validDrawingHoleCenterReference(item.holeRef))fail();
   pointIds.add(item.id);
  }
 }
 for(const scales of [o.viewScales,o.pdfViewScales])if(scales!==undefined){
  if(!scales||typeof scales!=='object'||Array.isArray(scales)||
   Object.entries(scales).some(([id,scale])=>id!=='iso'&&!viewNames.has(id)||!validDrawingScale(scale)))fail();
 }
 if(o.pdfPageScales!==undefined&&(!o.pdfPageScales||typeof o.pdfPageScales!=='object'||Array.isArray(o.pdfPageScales)||
  Object.entries(o.pdfPageScales).some(([key,scale])=>!/^(?:[1-9]|[12]\d|3[0-2])$/.test(key)||!validDrawingScale(scale))))fail();
 if(o.pageAssignments!==undefined){
  const assignment=o.pageAssignments,validPage=n=>Number.isInteger(n)&&n>=1&&n<=assignment.pageCount;
  const validMap=(map,allowed)=>map&&typeof map==='object'&&!Array.isArray(map)&&Object.entries(map).every(([id,page])=>allowed.has(id)&&validPage(page));
  if(!assignment||!Number.isInteger(assignment.pageCount)||assignment.pageCount<1||assignment.pageCount>32||
   !validMap(assignment.views,new Set([...viewNames,'iso']))||!validMap(assignment.comments,new Set(['comment',...commentIds]))||
   assignment.holeTable!==undefined&&!validPage(assignment.holeTable))fail();
 }
 if(o.pdfPositions!==undefined){
  const allowed=new Set([...viewNames,'iso','comment','holeTable',...commentIds]);
  if(!o.pdfPositions||typeof o.pdfPositions!=='object'||Array.isArray(o.pdfPositions)||
   Object.entries(o.pdfPositions).some(([id,at])=>!allowed.has(id)||!point(at)))fail();
 }
 if(o.leaders!==undefined){
  if(!Array.isArray(o.leaders)||o.leaders.length>maxDrawingLeaders)fail();
  const leaderIds=new Set();
  for(const note of o.leaders){
   if(!note||typeof note.id!=='string'||!/^leader-[a-zA-Z0-9-]{1,60}$/.test(note.id)||leaderIds.has(note.id)||
    !viewNames.has(note.view)||!point(note.anchor)||!point(note.at)||typeof note.text!=='string'||!note.text.trim()||
    note.text.length>maxDrawingLeaderText||!validReview(note)||!validDrawingThreadReference(note.threadRef))fail();
   leaderIds.add(note.id);
  }
 }
 if(o.hiddenViews!==undefined){
  if(!o.hiddenViews||typeof o.hiddenViews!=='object'||Array.isArray(o.hiddenViews))fail();
  for(const [view,visible] of Object.entries(o.hiddenViews))if(view!=='iso'&&!viewNames.has(view)||typeof visible!=='boolean')fail();
 }
 if(o.dimensionReferences!==undefined){
  if(!o.dimensionReferences||typeof o.dimensionReferences!=='object'||Array.isArray(o.dimensionReferences))fail();
  for(const [view,ref] of Object.entries(o.dimensionReferences)){
   if(!viewNames.has(view)||!Array.isArray(ref?.box)||ref.box.length!==4||
    ref.box.some((n,i)=>!Number.isFinite(n)||(i<2?Math.abs(n)>1e6:n<0||n>2e6)))fail();
   if(ref.circles!==undefined&&(!Array.isArray(ref.circles)||ref.circles.length>drawingReferenceCircleLimit||
    ref.circles.some(c=>!point(c?.center)||!Number.isFinite(c.radius)||c.radius<=0||c.radius>1e6)))fail();
  }
 }
 for(const m of markers){if(typeof m.id!=='string'||!/^marker-[a-zA-Z0-9-]{1,60}$/.test(m.id)||!viewNames.has(m.view)||!['line','center'].includes(m.kind)||!validReview(m))fail();if(m.kind==='line'){if(!point(m.a)||!point(m.b))fail();}else if(!point(m.center)||!Number.isFinite(m.radius)||m.radius<=0||m.radius>1e6)fail();}
 if(!o.positions||typeof o.positions!=='object'||Array.isArray(o.positions))fail();for(const [key,p] of Object.entries(o.positions))if(![...drawingProjectionNames,'iso','comment','holeTable',...ids,...commentIds].includes(key)||!point(p))fail();
 for(const d of s.dimensions){
  if(d.precision!=null&&(!Number.isInteger(d.precision)||d.precision<0||d.precision>6))fail();
  if(d.fontSize!=null&&(!Number.isFinite(d.fontSize)||d.fontSize<1.5||d.fontSize>10))fail();
  if(!['horizontal','vertical','aligned','diameter','radius','thread','angle'].includes(d.kind)||!point(d.at))fail();
  if(isCircularDimensionKind(d.kind)){
   if(!point(d.center)||!Number.isFinite(d.radius)||d.radius<=0||d.radius>1e6)fail();
  }else if(!point(d.a)||!point(d.b))fail();
  if(d.kind==='angle'&&!point(d.vertex))fail();
  if(d.view==='iso'){
   if(d.kind!=='aligned'||!coordinates(d.modelA,3)||!coordinates(d.modelB,3)||d.manualEndpoints!==undefined||
    d.repeat!=null||dimensionValue(d)<1e-6||Math.hypot(d.b[0]-d.a[0],d.b[1]-d.a[1])<1e-6)fail();
  }else if(!viewNames.has(d.view)||d.modelA!==undefined||d.modelB!==undefined)fail();
  if(d.pdfPlacement!==undefined&&!validDimensionPlacement(d.pdfPlacement))fail();
  if(!validReview(d)||d.unplaced!==undefined&&(typeof d.unplaced!=='boolean'||d.unplaced&&!d.review))fail();
  if(d.pinned!==undefined&&typeof d.pinned!=='boolean')fail();
  if(d.hidden!==undefined&&typeof d.hidden!=='boolean')fail();
  if(d.displayValue!==undefined&&(!canOverrideDrawingDimensionValue(d)||!validDrawingDimensionDisplayValue(d.displayValue)))fail();
  if(d.manualEndpoints!==undefined&&(!['horizontal','vertical','aligned'].includes(d.kind)||!Array.isArray(d.manualEndpoints)||
   !d.manualEndpoints.length||d.manualEndpoints.length>2||new Set(d.manualEndpoints).size!==d.manualEndpoints.length||
   d.manualEndpoints.some(key=>key!=='a'&&key!=='b')))fail();
  if(d.holeRefs!==undefined&&(d.view==='iso'||!['horizontal','vertical','aligned'].includes(d.kind)||
   !d.holeRefs||typeof d.holeRefs!=='object'||Array.isArray(d.holeRefs)||!Object.keys(d.holeRefs).length||
   Object.entries(d.holeRefs).some(([key,ref])=>key!=='a'&&key!=='b'||!validDrawingHoleCenterReference(ref))))fail();
  if(d.alongOffset!==undefined&&(!['horizontal','vertical','aligned'].includes(d.kind)||
   !Number.isFinite(d.alongOffset)||Math.abs(d.alongOffset)>1e6))fail();
  if(d.arcPoint!==undefined&&(!['radius','thread'].includes(d.kind)||!point(d.arcPoint)))fail();
  if(d.nominalDiameter!==undefined&&(d.kind!=='thread'||!Number.isFinite(d.nominalDiameter)||d.nominalDiameter<=0||d.nominalDiameter>2e6))fail();
  if(d.adjustedDiameter!==undefined&&(d.kind!=='thread'||d.nominalDiameter===undefined||
   !Number.isFinite(d.adjustedDiameter)||d.adjustedDiameter<=0||d.adjustedDiameter>2e6))fail();
  if(d.threadRef!==undefined&&(d.kind!=='thread'||!validDrawingThreadReference(d.threadRef)||
   !drawingThreadRimKinds.includes(d.threadRim)||d.nominalDiameter===undefined))fail();
  if(d.threadRef===undefined&&d.threadRim!==undefined)fail();
  if(d.tolerance!==undefined&&(!Number.isFinite(d.tolerance)||d.tolerance<0||d.tolerance>1e6))fail();
  if(d.note!==undefined&&(typeof d.note!=='string'||d.note.length>60||/[\u0000-\u001f]/.test(d.note)))fail();
  if(['lineColor','textColor'].some(key=>d[key]!==undefined&&!validDimensionColor(d[key])))fail();
  if(d.count!=null||d.centers!=null){if(!['diameter','radius'].includes(d.kind)||!Number.isInteger(d.count)||d.count<2||d.count>200||!Array.isArray(d.centers)||d.centers.length!==d.count||d.centers.some(p=>!point(p)))fail();const ids=new Set(d.centers.map(p=>p.map(n=>Number(n.toFixed(5))).join(',')));if(ids.size!==d.count||!d.centers.some(p=>Math.hypot(p[0]-d.center[0],p[1]-d.center[1])<1e-5))fail();}
  if(d.repeat!=null){const r=d.repeat;if(!['horizontal','vertical','aligned'].includes(d.kind)||!r||!Number.isInteger(r.count)||r.count<2||r.count>199||!Number.isFinite(r.pitch)||r.pitch<=0||Math.abs(dimensionValue(d)-r.count*r.pitch)>1e-5*Math.max(1,dimensionValue(d)))fail();}
 }
 return s;
}
