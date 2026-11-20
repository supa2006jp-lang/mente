import * as R from 'replicad';
import {bridgeRibSuggestion,supportBridgeSpans,supportIntervals,supportMeshTriangles} from './print-support-bridges.js';
import {supportHorizontalCap} from './print-support-coverage.js';
import {supportFallbackColumns} from './print-support-column-fallback.js';
import {makeSupportLocalRib,supportRibBounds,widerSupportRib} from './print-support-local-rib.js';

const mid=(a,b)=>(a+b)/2;
const epsilon=1e-6;
const boxesOverlap=(a,b)=>[0,1,2].every(i=>a[0][i]<b[1][i]-epsilon&&a[1][i]>b[0][i]+epsilon);
const intersects=(shape,body,floor)=>{
 const common=shape.intersect(body);
 try{return Math.abs(R.measureVolume(common))>.0001&&supportRibBounds(common)[1][2]>floor+epsilon;}finally{common.delete();}
};

function pointInBand(band,axis,ratio=.5){
 const point=[];
 point[axis]=band.start+(band.end-band.start)*ratio;
 point[1-axis]=mid(band.from,band.to);
 return point;
}

function outsideZones(point,zones){
 return !zones.some(([x0,y0,x1,y1])=>point[0]>x0-epsilon&&point[0]<x1+epsilon&&point[1]>y0-epsilon&&point[1]<y1+epsilon);
}

function narrowsBand(triangles,band,axis){
 const spans=supportIntervals(triangles,1-axis,mid(band.from,band.to));
 return spans.some(([a,b])=>Math.min(b,band.end)-Math.max(a,band.start)>.05&&
  Math.max(a-band.start,band.end-b)<band.width-.05);
}

// The samples propose positions. Only the native landing actually made there
// can reduce an uncovered span or be included in the saved support.
export function fillSupportGaps({face,item,bounds,height,top,axis,bodies,settings:p,limits,prism,sideGap,
 footprint,reference,candidates,records,excludedCells,hold,onProgress,makeId,getBases,widthsApplied,protectionTools}){
 const ribs=[],columns=[],excluded=[],bases=new Set();
 if(!records.length||!item||!footprint||!reference)return {ribs,columns,excluded,bases};
 const other=1-axis,ceiling=supportMeshTriangles(reference),landings=[];
 const boundsById=new Map(candidates.filter(rib=>!rib.excluded).map(rib=>[rib.id,rib.bounds]));
 for(const record of records){
  const cap=supportHorizontalCap(record.shape,top);
  if(cap)landings.push(...supportMeshTriangles(cap));
 }
 if(!landings.length)return {ribs,columns,excluded,bases};
 const zones=[...(p.noSupport||[]),...excludedCells.map(({low,high})=>[low[0],low[1],high[0],high[1]])];
 const widthLimit=Math.max(8,p.wallPitch-p.wallThickness+.05);
 const stationValues=[
  ...candidates.flatMap(rib=>rib.bounds.map(point=>point[other])),
  ...zones.flatMap(zone=>[zone[other],zone[other+2]]),
 ];
 const stations=[...new Set(stationValues.map(at=>Number(at.toFixed(5))))].sort((a,b)=>a-b);
 const sampleStations=stations.length<=100?stations:Array.from({length:100},(_,i)=>stations[Math.floor(i*(stations.length-1)/99)]);
 const calculate=()=>supportBridgeSpans(ceiling,landings,axis,widthLimit,{regions:true,stations:sampleStations});
 let bridge=calculate();
 if(!bridge)return {ribs,columns,excluded,bases};
 const before=Math.max(bridge.max,bridge.unbraced),attempted=new Set(),excludedBands=[];
 const floor=p.bedZ+(p.connectFeet&&!p.wallBottomSkin?p.footThickness:0);
 function overlapsRibs(shape,box){
  const overlaps=(body,other)=>boxesOverlap(box,other)&&intersects(shape,body,floor);
  return records.some(record=>overlaps(record.shape,boundsById.get(record.id)))||
   ribs.some(rib=>overlaps(rib.shape,rib.bounds))||columns.some(column=>overlaps(column.shape,column.bounds));
 }
 const ribCapacity=Math.max(0,limits.ribs-candidates.length),capacity=Math.min(8,ribCapacity+limits.columns);
 for(let attempt=0;attempt<40&&ribs.length+columns.length<capacity;attempt++){
  const band=bridge.bands.filter(band=>band.width>widthLimit&&
   !attempted.has(JSON.stringify([band.from,band.to,band.start,band.end]))&&
   outsideZones(pointInBand(band,axis),[...zones,...excludedBands])).sort((a,b)=>b.width-a.width||a.from-b.from||a.start-b.start)[0];
  if(!band)break;
  attempted.add(JSON.stringify([band.from,band.to,band.start,band.end]));
  const point=pointInBand(band,axis);
  const previews=[...candidates,...ribs.map(rib=>rib.candidate),...excluded.map(rib=>rib.candidate)];
  const placement={bounds,margin:p.edgeMargin,footprint,stripes:previews.map(rib=>({
   center:rib.center,span:rib.bounds.map(v=>v[other]),
  }))};
  const proposal=(ribs.length+excluded.length<ribCapacity)?
   bridgeRibSuggestion({...item,bridges:bridge,bridgePlacement:placement,override:{noSupport:[...zones,...excludedBands]}},point,band.risk):null;
  if(proposal?.rib){
   const {at,length}=proposal.rib,center=at[axis],span=[at[other]-length/2,at[other]+length/2];
   const id=makeId(center,at[other],length);
   const context={prism,bodies,sideGap,settings:p,axis,top,hold,requireTop:true};
   const base=makeSupportLocalRib({...context,center,span,width:p.wallThickness});
   if(base&&!overlapsRibs(base.shape,base.bounds)){
    const width=p.ribWidths?.find(row=>row.id===id)?.width;
    const wider=width&&widerSupportRib({...context,piece:base,originalSlot:base.slot,stripes:[],stripe:{center},
     thickness:p.wallThickness,width});
    const useWider=wider&&!overlapsRibs(wider.shape,wider.bounds);
    const made=useWider?wider:base;
    const cap=supportHorizontalCap(made.shape,top),triangles=cap?supportMeshTriangles(cap):[];
    if(narrowsBand(triangles,band,axis)){
     const skipped=p.excludedRibs.includes(id);
     const detail={candidate:{id,ribId:id,exclusionId:id,axis,center,ceiling:height,bounds:made.bounds,
      excluded:skipped,local:true,automatic:true,autoBlocked:p.excludedRibBlockers.includes(id),
      ...(useWider?{thickness:width}:{}),band:made.bounds.map(point=>point[axis])},...made,span};
     if(skipped){
      excluded.push(detail);
      const box=[];
      [box[axis],box[axis+2]]=[band.start,band.end];
      [box[other],box[other+2]]=span;
      excludedBands.push(box);
     }else{
      ribs.push(detail);landings.push(...triangles);made.bases.forEach(id=>bases.add(id));
      if(useWider)widthsApplied.add(id);
      bridge=calculate();
     }
     continue;
    }
   }
  }
  if(columns.length>=limits.columns)continue;
  const radius=p.fallbackDiameter/2;
  const positions=[.5,.35,.65,.23,.77].map(ratio=>pointInBand(band,axis,ratio)).filter(at=>
   at[axis]-radius>band.start&&at[axis]+radius<band.end&&outsideZones(at,excludedBands)&&
   !columns.some(column=>Math.hypot(column.point[0]-at[0],column.point[1]-at[1])<Math.max(2*radius,p.wallPitch*.65)));
  if(!positions.length)continue;
  for(const position of positions){
   const [column]=supportFallbackColumns({face,faceBounds:bounds,height,bodies,bases:getBases(),limit:1,
    settings:{...p,noSupport:[...zones,...excludedBands]},positions:[position],onProgress,protectionTools});
   if(!column)continue;
   column.blocker.delete();delete column.blocker;hold(column.shape);
   const box=supportRibBounds(column.shape);
   if(overlapsRibs(column.shape,box))continue;
   const cap=supportHorizontalCap(column.shape,top),triangles=cap?supportMeshTriangles(cap):[];
   if(!narrowsBand(triangles,band,axis))continue;
   columns.push({...column,bounds:box,local:true});landings.push(...triangles);
   if(column.baseBodyId)bases.add(column.baseBodyId);
   bridge=calculate();break;
  }
 }
 return {ribs,columns,excluded,bases,before,after:Math.max(bridge.max,bridge.unbraced)};
}
