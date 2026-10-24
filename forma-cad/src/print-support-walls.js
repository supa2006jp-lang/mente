import * as R from 'replicad';
import {selectedConnectedPlanarFace} from './cad-planar-face.js';
import {fuseSolids} from './solid-fuse.js';
import {makeWallTies} from './print-support-wall-ties.js';
import {makeWallWindows} from './print-support-wall-windows.js';
import {makeWallRoof} from './print-support-wall-roof.js';
import {roofRemovalDetails} from './print-support-roof-removal.js';
const tuple=v=>{try{return v.toTuple();}finally{v.delete();}};
const bounds=s=>{const b=s.boundingBox;try{return b.bounds;}finally{b.delete();}};
function inset(face,distance){
 const owned=[],hold=s=>(owned.push(s),s);
 try{
  function offset(wire,smaller){const original=hold(R.makeFace(wire.clone())),area=R.measureArea(original);for(const sign of [1,-1]){let w,f;try{w=wire.clone().offset2D(sign*distance,'intersection');f=R.makeFace(w.clone());const a=R.measureArea(f);if(a>1e-6&&(smaller?a<area:a>area)){const answer=w;w=null;return answer;}}catch{}finally{w?.delete();f?.delete();}}throw Error('薄壁の外周のすき間を作れません。柱型を選ぶか対象面を選び直してください');}
  const outer=hold(face.clone().outerWire()),inner=face.clone().innerWires();inner.forEach(hold);const out=hold(offset(outer,true)),holes=inner.map(w=>hold(offset(w,false))),profile=hold(R.makeFace(out.clone()));return holes.length?R.addHolesInFace(profile,holes):profile.clone();
 }finally{owned.forEach(s=>s.delete());}
}
export function makeWallSupports(bodies,p,onProgress){
 const model=bodies.get(p.target);if(!model)throw Error('サポートを付けるボディを選択してください');
 const faces=p.mode==='face'?[selectedConnectedPlanarFace(model,p.faces[0])]:model.faces,owned=[],hold=s=>(owned.push(s),s),walls=[],wallRecords=[],ties=[],roofs=[],roofTabs=[],tieLevels=new Set(),blockers=[],baseBodyIds=new Set();let omitted=0,faceCount=0,shape=null,skippedTies=0,roofCuts=0,roofSkippedCuts=0,roofSections=0,roofSkippedTabs=0,windows={enabled:false,count:0,skipped:0,limited:false,removedVolume:0,savedPercent:0};
 try{
  for(const face of faces){const n=tuple(face.normalAt()),b=bounds(face);if(n[2]>-.5||b[0][2]<=p.bedZ+p.topGap+1)continue;if(face.geomType!=='PLANE'||n[2]>-.999999){if(p.mode==='face')throw Error('薄壁型は水平な平面の下面を選択してください');omitted++;continue;}
   const z=tuple(face.center)[2],profile=hold(inset(face,.5)),shifted=hold(profile.translate([0,0,-p.topGap])),v=new R.Vector([0,0,p.bedZ-z+p.topGap]);let prism;try{prism=hold(R.basicFaceExtrusion(shifted,v));}finally{v.delete();}
   const pb=bounds(prism),axis=pb[1][0]-pb[0][0]>=pb[1][1]-pb[0][1]?0:1,span=pb[1][axis]-pb[0][axis],count=Math.max(1,Math.ceil(span/p.wallPitch)),records=[];if(walls.length+count>96)throw Error('薄壁の本数が多すぎます。壁の間隔を広げるか対象面を絞ってください');let made=0;
   for(let i=0;i<count;i++){
    onProgress?.({stage:'薄壁サポートを作成しています（'+(walls.length+1)+'枚目）'});const center=pb[0][axis]+span*(i+.5)/count,a=[pb[0][0]-1,pb[0][1]-1,p.bedZ-1],b=[pb[1][0]+1,pb[1][1]+1,z+1];a[axis]=center-p.wallThickness/2;b[axis]=center+p.wallThickness/2;
    const stripe=hold(R.makeBox(a,b));let wall=hold(prism.intersect(stripe));if(R.measureVolume(wall)<.001)continue;
    if(p.connectFeet){const fa=[...a],fb=[...b];fa[axis]=center-span/count/2;fb[axis]=center+span/count/2;fa[2]=p.bedZ;fb[2]=p.bedZ+p.footThickness;const footBox=hold(R.makeBox(fa,fb)),foot=hold(prism.intersect(footBox));if(R.measureVolume(foot)>.001)wall=hold(wall.fuse(foot));}
    if(p.baseMode==='bed'){let blocked=false;for(const model of bodies.values()){const common=hold(wall.intersect(model));if(R.measureVolume(common)>.0001){blocked=true;break;}}if(blocked){omitted++;continue;}}
    else for(const [id,model]of bodies){const common=hold(wall.intersect(model));if(R.measureVolume(common)>.0001){baseBodyIds.add(id);wall=hold(wall.cut(model));}}
    if(R.measureVolume(wall)<.001)continue;
    walls.push(wall);const record={shape:wall,axis,center};records.push(record);wallRecords.push(record);made++;
   }
   if(p.wallTies&&records.length>1){const made=makeWallTies(records,prism,bodies,p,onProgress);if(ties.length+made.shapes.length>512){made.shapes.forEach(s=>s.delete());throw Error('横つなぎが多すぎます。高さの間隔を広げるか対象面を絞ってください');}made.shapes.forEach(s=>ties.push(hold(s)));made.levels.forEach(z=>tieLevels.add(z));skippedTies+=made.skipped;}
   if(p.wallRoof){const roof=makeWallRoof(records,prism,bodies,p,z-p.topGap,onProgress);if(roof){
    if(p.roofSeams||p.roofTabs){try{const detail=roofRemovalDetails(roof,records,shifted,bodies,p,z-p.topGap,onProgress,{seams:128-roofCuts,tabs:64-roofTabs.length});roofs.push(hold(detail.roof));detail.tabs.forEach(tab=>roofTabs.push(hold(tab)));roofCuts+=detail.seams.count;roofSkippedCuts+=detail.seams.skipped;roofSections+=detail.seams.sections;roofSkippedTabs+=detail.tabInfo.skipped;}finally{roof.delete();}}
    else roofs.push(hold(roof));
   }}
   if(made){faceCount++;const fullShift=hold(face.translate([0,0,p.layerHeight])),vec=new R.Vector([0,0,p.bedZ-z-p.layerHeight]);try{blockers.push(R.basicFaceExtrusion(fullShift,vec));}finally{vec.delete();}}
  }
  if(!walls.length)throw Error('薄壁を置ける水平な下面がありません。土台と高さを確認してください');
  shape=fuseSolids([...walls,...ties,...roofs,...roofTabs],{onProgress});if(p.wallWindows){const cut=makeWallWindows(shape,wallRecords,ties,p,onProgress,[...roofs,...roofTabs]);shape.delete();shape=cut.shape;windows=cut.analysis;}const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{if(!check.IsValid())throw Error('正常な薄壁サポートを作成できませんでした');}finally{check.delete();}
  for(const model of bodies.values()){const common=hold(shape.intersect(model));if(R.measureVolume(common)>.0001)throw Error('薄壁が本体に入り込むため作成を中止しました');}
  const solids=shape.solids;let components;try{components=solids.length;}finally{solids.forEach(s=>s.delete());}
  const analysis={style:'walls',count:walls.length,contacts:[],components,topGap:p.topGap,bottomGap:0,baseMode:p.baseMode,baseBodyIds:[...baseBodyIds],modelBasedCount:baseBodyIds.size?walls.length:0,bedBasedCount:baseBodyIds.size?0:walls.length,footDiameter:p.footDiameter,postDiameter:p.wallThickness,reinforcements:ties.length,skipped:omitted,omittedReinforcement:skippedTies,limited:false,bedZ:p.bedZ,wallPitch:p.wallPitch,wallThickness:p.wallThickness,layerHeight:p.layerHeight,faceCount,blockerCount:blockers.length,complete:omitted===0,wallTies:{enabled:p.wallTies,interval:p.tieInterval,count:ties.length,levels:[...tieLevels].sort((a,b)=>a-b),thickness:2*p.layerHeight,neckWidth:Math.min(Math.max(1.6,Math.min(3,2*p.wallThickness)),Math.max(.6,p.wallThickness))}};
  analysis.roof={enabled:!!p.wallRoof,count:roofs.length,layers:p.roofLayers??2,thickness:(p.roofLayers??2)*p.layerHeight};if(p.wallRoof&&p.roofSeams)analysis.roof.seams={enabled:true,count:roofCuts,skipped:roofSkippedCuts,sections:roofSections,spacing:p.roofSectionLength,width:p.roofSeamWidth};if(p.wallRoof&&p.roofTabs)analysis.roof.tabs={enabled:true,count:roofTabs.length,skipped:roofSkippedTabs,length:p.roofTabLength,width:4};analysis.windows=windows;const result={shape,analysis,blockers};shape=null;return result;
 }catch(e){blockers.forEach(s=>s.delete());throw e;}finally{shape?.delete();owned.forEach(s=>s.delete());faces.forEach(f=>f.delete());}
}
