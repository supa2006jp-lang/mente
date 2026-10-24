import * as R from 'replicad';
import {fuseSolids} from './solid-fuse.js';
const bounds=s=>{const box=s.boundingBox;try{return box.bounds;}finally{box.delete();}};
const overlap=(a,b)=>{const common=a.intersect(b);try{return R.measureVolume(common);}finally{common.delete();}};
function anchored(shape,records){const parts=shape.solids;try{return parts.length>0&&parts.every(part=>records.filter(r=>overlap(part,r.shape)>.0001).length>=2);}finally{parts.forEach(p=>p.delete());}}
function rectangle(low,high,z){return R.draw([low[0],low[1]]).lineTo([high[0],low[1]]).lineTo([high[0],high[1]]).lineTo([low[0],high[1]]).close().sketchOnPlane('XY',z);}

function holeMasks(profile,depth){const wires=profile.clone().innerWires(),masks=[],vector=new R.Vector([0,0,-depth]);try{for(const wire of wires){const face=R.makeFace(wire.clone());try{masks.push(R.basicFaceExtrusion(face,vector));}finally{face.delete();}}return masks;}catch(e){masks.forEach(s=>s.delete());throw e;}finally{vector.delete();wires.forEach(w=>w.delete());}}

function pullTab(part,record,side,otherCenter,bodies,holes,p,top){
 const axis=record.axis,other=1-axis,width=4,thickness=p.roofLayers*p.layerHeight,drop=p.roofTabLength+.4,bottom=top-thickness-drop,edge=record.center+side*p.wallThickness/2;
 if(bottom<=p.bedZ+p.layerHeight)return null;
 const low=[0,0,bottom],high=[0,0,bottom+p.layerHeight];low[axis]=record.center-p.wallThickness*.375;high[axis]=record.center+p.wallThickness*.375;low[other]=otherCenter-width/2;high[other]=otherCenter+width/2;
 const root=R.makeBox(low,high);let ramp,cap,tab;
 try{
  const volume=R.measureVolume(root);if(Math.abs(overlap(root,record.shape)-volume)>Math.max(1e-7,volume*1e-6))return null;
  const capLow=[...low],capHigh=[...high];capLow[axis]=side<0?edge-p.roofTabLength:edge-p.wallThickness;capHigh[axis]=side<0?edge+p.wallThickness:edge+p.roofTabLength;capLow[2]=top-thickness;capHigh[2]=top;
  cap=R.makeBox(capLow,capHigh);if(overlap(cap,part)<.001)return null;
  ramp=rectangle(low,high,bottom).loftWith([rectangle(capLow,capHigh,top-thickness)]);tab=fuseSolids([ramp,cap]);
  if(holes.some(h=>overlap(tab,h)>.0001)||[...bodies.values()].some(body=>overlap(tab,body)>.0001||R.measureDistanceBetween(tab,body)<=1e-6))return null;
  const answer=tab;tab=null;return answer;
 }finally{tab?.delete();cap?.delete();ramp?.delete();root.delete();}
}

// Cut only the roof, never the fins/ties. Every resulting roof piece must keep
// two fin landings. Tabs start inside an existing fin, then ramp out at >45°.
export function roofRemovalDetails(original,records,profile,bodies,p,top,onProgress,{seams=128,tabs=64}={}){
 let roof=original.clone();const madeTabs=[],holes=[];let cuts=0,skippedCuts=0,skippedTabs=0;
 try{
  const axis=records[0].axis,other=1-axis;
  if(p.roofSeams){
   const b=bounds(roof),span=b[1][other]-b[0][other],count=Math.max(1,Math.ceil(span/p.roofSectionLength));if(count>24||count-1>seams)throw Error('薄皮の分割数が多すぎます。分割の間隔を広げてください');
   for(let i=1;i<count;i++){
    onProgress?.({stage:'薄皮の分割線を作成しています'});const at=b[0][other]+span*i/count,low=[b[0][0]-1,b[0][1]-1,top-p.roofLayers*p.layerHeight-.01],high=[b[1][0]+1,b[1][1]+1,top+.01];low[other]=at-p.roofSeamWidth/2;high[other]=at+p.roofSeamWidth/2;const tool=R.makeBox(low,high);let cut;
    try{cut=roof.cut(tool);if(R.measureVolume(roof)-R.measureVolume(cut)<.0001||!anchored(cut,records)){skippedCuts++;continue;}roof.delete();roof=cut;cut=null;cuts++;}finally{cut?.delete();tool.delete();}
   }
  }
  if(p.roofTabs){
   holes.push(...holeMasks(profile,top-p.bedZ+1));const parts=roof.solids;
   try{
    if(parts.length>tabs)throw Error('薄皮のタブが多すぎます。分割の間隔を広げてください');
    const ends=[{record:records[0],side:-1},{record:records.at(-1),side:1}];
    for(const part of parts){
     onProgress?.({stage:'薄皮を剥がすタブを作成しています'});const b=bounds(part),margin=2.3,low=b[0][other]+margin,high=b[1][other]-margin;let made=null;
     if(high>=low)for(const t of [.5,.25,.75]){const center=low+(high-low)*t;for(const end of ends){made=pullTab(part,end.record,end.side,center,bodies,holes,p,top);if(made)break;}if(made)break;}
     if(made)madeTabs.push(made);else skippedTabs++;
    }
   }finally{parts.forEach(s=>s.delete());}
  }
  const parts=roof.solids;let sections;try{sections=parts.length;}finally{parts.forEach(s=>s.delete());}
  const result={roof,tabs:madeTabs,seams:{enabled:!!p.roofSeams,count:cuts,skipped:skippedCuts,sections,spacing:p.roofSectionLength,width:p.roofSeamWidth},tabInfo:{enabled:!!p.roofTabs,count:madeTabs.length,skipped:skippedTabs,length:p.roofTabLength,width:4}};roof=null;return result;
 }catch(e){madeTabs.forEach(s=>s.delete());throw e;}finally{roof?.delete();holes.forEach(s=>s.delete());}
}
