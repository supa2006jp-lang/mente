import {supportContactLines} from './print-support-contact-lines.js';
import * as R from 'replicad';
import {resolveSupportFaces,supportSelectedFaceMeshes} from './print-support-faces.js';
import {fuseSolids} from './solid-fuse.js';
import {makeWallTies} from './print-support-wall-ties.js';
import {makeWallWindows} from './print-support-wall-windows.js';
import {makeWallRoof} from './print-support-wall-roof.js';
import {roofRemovalDetails} from './print-support-roof-removal.js';
import {cadMesh} from './cad-mesh.js';
import {ribReference,supportPrintSettings} from './print-support-print-settings.js';
import {supportRibRisk} from './print-support-strength.js';
import {supportMaterialEstimate} from './print-support-material.js';
import {supportRibPlacement} from './print-support-rib-placement.js';
import {makeSupportBottomSkins} from './print-support-bottom-skin.js';
const tuple=v=>{try{return v.toTuple();}finally{v.delete();}};
const bounds=s=>{const b=s.boundingBox;try{return b.bounds;}finally{b.delete();}};
function roofSupportIssues(roof,original,remaining,p){
 const issues=[],parts=roof.solids,overlap=(a,b)=>{const s=a.intersect(b);try{return R.measureVolume(s)>.0001;}finally{s.delete();}};
 try{for(const part of parts){const before=original.filter(r=>overlap(part,r.shape)),after=remaining.filter(r=>overlap(part,r.shape));if(before.length===after.length)continue;
  if(after.length<2)issues.push('薄皮の支えが不足します。各区画を支えるリブを2枚以上残してください');
  else if(after[0]!==before[0]||after.at(-1)!==before.at(-1))issues.push('薄皮の端が片持ちになります。両端のリブを戻すか薄皮をオフにしてください');
  else if(after.some((r,i)=>i&&r.center-after[i-1].center>p.wallPitch*1.05))issues.push('薄皮を支えるリブの間隔が設定値を超えます。リブを戻すか薄皮をオフにしてください');
 }}finally{parts.forEach(s=>s.delete());}return issues;
}
function scopedBlocker(face,p,z,cells){
 const shifted=face.translate([0,0,p.layerHeight]),vector=new R.Vector([0,0,p.bedZ-z-p.layerHeight]);let blocker;
 try{blocker=R.basicFaceExtrusion(shifted,vector);for(const cell of cells){const tool=R.makeBox(cell.low,cell.high);try{const next=blocker.cut(tool);blocker.delete();blocker=next;}finally{tool.delete();}}const result=blocker;blocker=null;return result;}finally{blocker?.delete();shifted.delete();vector.delete();}
}
function inset(face,distance){
 const owned=[],hold=s=>(owned.push(s),s);
 try{
  function offset(wire,smaller,amount=distance){const original=hold(R.makeFace(wire.clone())),area=R.measureArea(original);for(const sign of [1,-1]){let w,f;try{w=wire.clone().offset2D(sign*amount,'intersection');f=R.makeFace(w.clone());const a=R.measureArea(f);if(a>1e-6&&(smaller?a<area:a>area)){const answer=w;w=null;return answer;}}catch{}finally{w?.delete();f?.delete();}}throw Error('薄壁の外周のすき間を作れません。柱型を選ぶか対象面を選び直してください');}
  const outer=hold(face.clone().outerWire()),inner=face.clone().innerWires();inner.forEach(hold);const out=hold(offset(outer,true)),holes=inner.map(w=>hold(offset(w,false,.5))),profile=hold(R.makeFace(out.clone()));return holes.length?R.addHolesInFace(profile,holes):profile.clone();
 }finally{owned.forEach(s=>s.delete());}
}
export function makeWallSupports(bodies,p,onProgress){
 const contactRegions=[],bottomSeams={enabled:!!p.bottomSeams,count:0,skipped:0,sections:0,spacing:p.bottomSectionLength,width:p.bottomSeamWidth},tieIntervals=new Set(),tieAttachments=[],bottomSkins=[],bottomHeights=[];let selectedFacePreview=null;
 const model=bodies.get(p.target);if(!model)throw Error('サポートを付けるボディを選択してください');
 const selection=p.mode==='face'?resolveSupportFaces(model,p):null,faces=selection?.faces||model.faces,owned=[],hold=s=>(owned.push(s),s),walls=[],wallRecords=[],candidateRibs=[],ribIssues=[],excludedScope=[],ties=[],roofs=[],roofTabs=[],roofPreview=[],roofPlacements=[],roofMatched=[],tieLevels=new Set(),blockers=[],baseBodyIds=new Set();let omitted=0,faceCount=0,shape=null,skippedTies=0,roofCuts=0,roofSkippedCuts=0,roofSections=0,roofSkippedTabs=0,roofManualInvalid=0,windows={enabled:false,count:0,skipped:0,limited:false,removedVolume:0,savedPercent:0};
 try{
  selectedFacePreview=p.preview&&selection?supportSelectedFaceMeshes(selection):null;for(const face of faces){const n=tuple(face.normalAt()),b=bounds(face);if(n[2]>-.5||b[0][2]<=p.bedZ+p.topGap+1)continue;if(face.geomType!=='PLANE'||n[2]>-.999999){if(p.mode==='face')throw Error('薄壁型は水平な平面の下面を選択してください');omitted++;continue;}
   const z=tuple(face.center)[2],profile=hold(inset(face,p.edgeMargin)),shifted=hold(profile.translate([0,0,-p.topGap])),v=new R.Vector([0,0,p.bedZ-z+p.topGap]);let prism;try{prism=hold(R.basicFaceExtrusion(shifted,v));}finally{v.delete();}
   const pb=bounds(prism),axis=p.wallDirection==='x'?1:p.wallDirection==='y'?0:pb[1][0]-pb[0][0]>=pb[1][1]-pb[0][1]?0:1,span=pb[1][axis]-pb[0][axis],placement=supportRibPlacement(pb[0][axis],pb[1][axis],p),count=placement.count,records=[],allRecords=[],excludedCells=[];if(candidateRibs.length+count>96)throw Error('薄壁の本数が多すぎます。壁の間隔を広げるか対象面を絞ってください');let made=0;
   for(let i=0;i<count;i++){
    onProgress?.({stage:'薄壁サポートを作成しています（'+(walls.length+1)+'枚目）'});const center=placement.centers[i],a=[pb[0][0]-1,pb[0][1]-1,p.bedZ-1],b=[pb[1][0]+1,pb[1][1]+1,z+1];a[axis]=center-p.wallThickness/2;b[axis]=center+p.wallThickness/2;
    const stripe=hold(R.makeBox(a,b));let wall=hold(prism.intersect(stripe));if(R.measureVolume(wall)<.001)continue;
    if(p.connectFeet&&!p.wallBottomSkin){const fa=[...a],fb=[...b];fa[axis]=placement.cells[i][0];fb[axis]=placement.cells[i][1];fa[2]=p.bedZ;fb[2]=p.bedZ+p.footThickness;const footBox=hold(R.makeBox(fa,fb)),foot=hold(prism.intersect(footBox));if(R.measureVolume(foot)>.001)wall=hold(wall.fuse(foot));}
    if(p.baseMode==='bed'){let blocked=false;for(const model of bodies.values()){const common=hold(wall.intersect(model));if(R.measureVolume(common)>.0001){blocked=true;break;}}if(blocked){omitted++;continue;}}
    else for(const [id,model]of bodies){const common=hold(wall.intersect(model));if(R.measureVolume(common)>.0001){baseBodyIds.add(id);wall=hold(wall.cut(model));}}
    if(R.measureVolume(wall)<.001)continue;
    const ribId=ribReference(axis,center,z,pb),excluded=p.excludedRibs.includes(ribId),record={id:ribId,shape:wall,axis,center};allRecords.push(record);
    const candidate={id:ribId,number:candidateRibs.length+1,axis,center,excluded,bounds:bounds(wall)};
    if(p.preview&&(!p.contactLines||excluded)){const display=wall.intersect(stripe);try{Object.assign(candidate,cadMesh(display));}finally{display.delete();}}candidateRibs.push(candidate);
    if(excluded){const low=[...a],high=[...b];low[axis]=i===0?pb[0][axis]-1:placement.cells[i][0];high[axis]=i===count-1?pb[1][axis]+1:placement.cells[i][1];const cell={low,high};excludedCells.push(cell);excludedScope.push(cell);continue;}
    walls.push(wall);records.push(record);wallRecords.push(record);made++;
   }
   if(p.wallBottomSkin&&records.length){const made=makeSupportBottomSkins(records,prism,bodies,p,onProgress);made.shapes.forEach(s=>{bottomSkins.push(hold(s));if(p.contactLines)contactRegions.push({shape:s,role:'lower',axis:records[0].axis});});bottomHeights.push(...made.heights);for(const key of ['count','skipped','sections'])bottomSeams[key]+=made.seams[key];if(bottomSeams.count>128)throw Error('底面薄皮の分割数が多すぎます');}
   if(p.wallTies&&records.length>1){const made=makeWallTies(records,prism,bodies,p,onProgress);if(ties.length+made.shapes.length>512){made.shapes.forEach(s=>s.delete());throw Error('横つなぎが多すぎます。高さの間隔を広げるか対象面を絞ってください');}made.shapes.forEach(s=>ties.push(hold(s)));made.levels.forEach(z=>tieLevels.add(z));made.intervals.forEach(v=>tieIntervals.add(v));tieAttachments.push(...made.attachments);skippedTies+=made.skipped;}
   if(p.wallRoof){const roof=makeWallRoof(allRecords,prism,bodies,p,z-p.topGap,onProgress);if(roof){if(p.contactLines)contactRegions.push({shape:hold(roof.clone()),role:'upper',axis:allRecords[0].axis});if(excludedCells.length)ribIssues.push(...roofSupportIssues(roof,allRecords,records,p));
    if(p.roofSeams||p.roofTabs||p.preview){try{const detail=roofRemovalDetails(roof,records.length>=2?records:allRecords,shifted,bodies,records.length>=2?p:{...p,roofTabs:false},z-p.topGap,onProgress,{seams:128-roofCuts,tabs:64-roofTabs.length});roofs.push(hold(detail.roof));detail.tabs.forEach(tab=>roofTabs.push(hold(tab)));roofPreview.push(...detail.preview);roofPlacements.push(...detail.placements);roofMatched.push(...detail.matched);roofManualInvalid+=detail.manualInvalid;roofCuts+=detail.seams.count;roofSkippedCuts+=detail.seams.skipped;roofSections+=detail.seams.sections;roofSkippedTabs+=detail.tabInfo.skipped;}finally{roof.delete();}}
    else roofs.push(hold(roof));
   }}
   if(made){faceCount++;const blocker=scopedBlocker(face,p,z,[]);if(R.measureVolume(blocker)>.001)blockers.push(blocker);else blocker.delete();}
  }
  // A second ceiling's overlapping blocker must not cover an omitted cell either.
  for(const cell of excludedScope){const tool=R.makeBox(cell.low,cell.high);try{for(let i=0;i<blockers.length;i++){const b=bounds(blockers[i]);if([0,1,2].some(k=>b[1][k]<=cell.low[k]||b[0][k]>=cell.high[k]))continue;const next=blockers[i].cut(tool);blockers[i].delete();blockers[i]=next;}}finally{tool.delete();}}
  for(let i=blockers.length-1;i>=0;i--)if(R.measureVolume(blockers[i])<.001){blockers[i].delete();blockers.splice(i,1);}
  if(!candidateRibs.length)throw Error('薄壁を置ける水平な下面がありません。土台と高さを確認してください');
  const missingRibs=p.excludedRibs.filter(id=>!candidateRibs.some(r=>r.id===id));if(missingRibs.length)ribIssues.push('リブの配置が変わったため古い除外指定を使えません。除外をすべて解除してください');if(!walls.length)ribIssues.push('すべてのリブが除外されています。1枚以上戻してください');
  if(ribIssues.length&&!p.preview)throw Error([...new Set(ribIssues)].join('。'));
  const missingPlacements=p.wallRoof&&p.roofTabs?(p.roofTabPlacements||[]).filter(v=>!roofMatched.includes(v.sectionId)).map(v=>v.sectionId):[];roofManualInvalid+=missingPlacements.length;
  if(roofManualInvalid&&!p.preview)throw Error('指定した位置にタブを作成できません。プレビューで位置を選び直すか自動配置に戻してください');
  if(walls.length)shape=fuseSolids([...walls,...ties,...roofs,...roofTabs,...bottomSkins],{onProgress,verifyMesh:!!(p.edgeRibs||p.wallBottomSkin)});if(shape&&p.wallWindows){const cut=makeWallWindows(shape,wallRecords,ties,p,onProgress,[...roofs,...roofTabs,...bottomSkins]);shape.delete();shape=cut.shape;windows=cut.analysis;}let contactAnalysis={enabled:!!p.contactLines,width:p.lineWidth,spacing:p.interfaceSpacing,depth:p.layerHeight,upper:0,lower:0,bedPreserved:0,slots:0,removedVolume:0};if(shape&&p.contactLines){const cut=supportContactLines(shape,contactRegions,p,onProgress);shape.delete();shape=cut.shape;contactAnalysis=cut.analysis;if(windows.enabled){windows.originalVolume=R.measureVolume(shape)+windows.removedVolume;windows.savedPercent=windows.originalVolume?100*windows.removedVolume/windows.originalVolume:0;}}if(p.preview&&p.contactLines&&shape)for(const record of wallRecords){const candidate=candidateRibs.find(r=>r.id===record.id),display=shape.intersect(record.shape);try{Object.assign(candidate,cadMesh(display));}finally{display.delete();}}if(shape){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{if(!check.IsValid())throw Error('正常な薄壁サポートを作成できませんでした');}finally{check.delete();}}
  if(shape)for(const model of bodies.values()){const common=hold(shape.intersect(model));if(R.measureVolume(common)>.0001)throw Error('薄壁が本体に入り込むため作成を中止しました');}
  const solids=shape?.solids||[];let components;try{components=solids.length;}finally{solids.forEach(s=>s.delete());}
  for(const candidate of candidateRibs)if(!candidate.excluded){const b=candidate.bounds;candidate.risk=supportRibRisk({height:b[1][2]-b[0][2],thickness:p.wallThickness,bottom:b[0][2],top:b[1][2],levels:tieAttachments.filter(a=>a.ribs.includes(candidate.id)).map(a=>a.z)});}
  const analysis={style:'walls',contactInterface:contactAnalysis,edgeMargin:p.edgeMargin,count:walls.length,contacts:[],components,topGap:p.topGap,bottomGap:0,baseMode:p.baseMode,baseBodyIds:[...baseBodyIds],modelBasedCount:baseBodyIds.size?walls.length:0,bedBasedCount:baseBodyIds.size?0:walls.length,footDiameter:p.footDiameter,postDiameter:p.wallThickness,reinforcements:ties.length,skipped:omitted,omittedReinforcement:skippedTies,limited:false,bedZ:p.bedZ,wallPitch:p.wallPitch,wallThickness:p.wallThickness,layerHeight:p.layerHeight,faceCount,blockerCount:blockers.length,complete:omitted===0&&!ribIssues.length,wallTies:{enabled:p.wallTies,interval:p.tieInterval,count:ties.length,levels:[...tieLevels].sort((a,b)=>a-b),thickness:2*p.layerHeight,neckWidth:Math.min(Math.max(1.6,Math.min(3,2*p.wallThickness)),Math.max(.6,p.wallThickness))}};
  analysis.bottomSkin={enabled:!!p.wallBottomSkin,count:bottomSkins.length,layers:p.bottomSkinLayers,thickness:p.bottomSkinLayers*p.layerHeight,heights:[...new Set(bottomHeights)].sort((a,b)=>a-b),contactGap:0,...(p.bottomSeams?{seams:bottomSeams}:{})};analysis.wallTies.auto=!!p.autoReinforce;analysis.wallTies.intervals=[...tieIntervals].sort((a,b)=>a-b);analysis.strength={heuristic:true,ribs:candidateRibs.filter(r=>!r.excluded).map(({id,number,risk})=>({id,number,...risk})),skippedTies};const volume=shape?R.measureVolume(shape):0;analysis.material=supportMaterialEstimate(volume,p,windows.enabled?windows.originalVolume:volume);
  analysis.roof={enabled:!!p.wallRoof,count:roofs.length,layers:p.roofLayers??2,thickness:(p.roofLayers??2)*p.layerHeight};if(p.wallRoof&&p.roofSeams)analysis.roof.seams={enabled:true,count:roofCuts,skipped:roofSkippedCuts,sections:roofSections,spacing:p.roofSectionLength,width:p.roofSeamWidth};if(p.wallRoof&&p.roofTabs)analysis.roof.tabs={enabled:true,count:roofTabs.length,skipped:roofSkippedTabs,length:p.roofTabLength,width:4,...((p.roofTabPlacements||[]).length?{manualInvalid:roofManualInvalid}:{})};if(roofManualInvalid)analysis.complete=false;analysis.windows=windows;analysis.printSettings=supportPrintSettings(p);analysis.ribs={total:candidateRibs.length,excluded:candidateRibs.filter(r=>r.excluded).length,direction:p.wallDirection,edgeAligned:!!p.edgeRibs,issues:[...new Set(ribIssues)],missing:missingRibs};analysis.selection={mode:p.mode,count:selection?.faces.length||0};const result={shape,analysis,blockers,...(selectedFacePreview?{selectedFaces:selectedFacePreview}:{}),...(p.preview?{ribPreview:candidateRibs,roofPreview:{contactLines:!!p.contactLines,parts:roofPreview,placements:roofPlacements,missing:missingPlacements}}:{})};shape=null;return result;
 }catch(e){blockers.forEach(s=>s.delete());throw e;}finally{shape?.delete();owned.forEach(s=>s.delete());faces.forEach(f=>f.delete());}
}
