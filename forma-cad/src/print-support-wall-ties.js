import * as R from 'replicad';
import {supportTieInterval} from './print-support-strength.js';
import {supportAdjustmentError} from './print-support-adjustments.js';
import {supportBoxesTouch,supportShapeBounds as bounds} from './print-support-solid-groups.js';
import {supportOverlapVolume as overlap} from './print-support-boolean.js';

function tieBounds(axis,from,to,row,width,bottom,top){
 const lo=[0,0,bottom],hi=[0,0,top];
 lo[axis]=from;hi[axis]=to;
 lo[1-axis]=row-width/2;hi[1-axis]=row+width/2;
 return [lo,hi];
}

function containedBox(box,shape){
 const tool=R.makeBox(...box),[lo,hi]=box;
 try{
  const volume=(hi[0]-lo[0])*(hi[1]-lo[1])*(hi[2]-lo[2]);
  return Math.abs(volume-overlap(tool,shape))<=1e-5;
 }finally{tool.delete();}
}

function clearOfBodies(shape,box,models,tolerance){
 return models.every(model=>!supportBoxesTouch(box,model.box)||Math.abs(overlap(shape,model.shape))<=tolerance);
}

// Each bridge at this cross-section is contained by the tall box. The smaller
// boxes near the ends prove enough attachment at each individual layer.
function verifiedTieColumn({axis,from,to,row,width,neck,neckWidth,heights,thickness,prism,models,left,right}){
 if(heights.length<3)return false;
 const bottom=heights[0],top=heights.at(-1)+thickness,depth=Math.min(.1,neck);
 if(depth*neckWidth*thickness-.00001<.001)return false;
 const box=tieBounds(axis,from,to,row,width,bottom,top),probe=R.makeBox(...box);
 try{
  const [lo,hi]=box,volume=(hi[0]-lo[0])*(hi[1]-lo[1])*(hi[2]-lo[2]);
  if(!(Math.abs(overlap(probe,prism)-volume)<=1e-5)||!clearOfBodies(probe,box,models,1e-5))return false;
  return containedBox(tieBounds(axis,from,from+depth,row,neckWidth,bottom,top),left)&&
   containedBox(tieBounds(axis,to-depth,to,row,neckWidth,bottom,top),right);
 }catch(error){
  if(error instanceof WebAssembly.RuntimeError)throw error;
  return false;
 }finally{probe.delete();}
}

export function supportWallTiePairs(records,p,sections=[]){
 const neighboringPairs=new Map();
 function addNeighbors(rows,accept){
  const columns=[];
  for(const record of rows){
   if(columns.at(-1)?.[0].center===record.center)columns.at(-1).push(record);
   else columns.push([record]);
  }
  for(let i=1;i<columns.length;i++)for(const left of columns[i-1])for(const right of columns[i]){
   if(accept(left,right))neighboringPairs.set(JSON.stringify([left.id,right.id]),[left,right]);
  }
 }
 const groupNeighbors=group=>{
  addNeighbors(group.filter(record=>!record.local),()=>true);
  addNeighbors(group,(left,right)=>left.local||right.local);
 };
 if(sections.length)for(const {span} of sections){
  groupNeighbors(records.filter(({span:row,local})=>row&&
   (row[0]===span[0]&&row[1]===span[1]||local&&row[0]<span[1]&&row[1]>span[0])));
 }else groupNeighbors(records);
 return [...neighboringPairs.values()].filter(([left,right])=>
  right.center-left.center<=(left.local||right.local||p.wallOffset?1.4:1.05)*p.wallPitch);
}

// Short horizontal bridges join neighboring fins. Narrow ends leave a place to
// cut them after printing, while the middle restrains motion across the fins.
export function makeWallTies(records,prism,bodies,p,onProgress,sections=[],pairs=supportWallTiePairs(records,p,sections)){
 const shapes=[],levels=new Set(),intervals=new Set(),attachments=[],thickness=2*p.layerHeight,width=Math.max(1.6,Math.min(3,2*p.wallThickness)),neckWidth=Math.min(width,Math.max(.6,p.wallThickness));let skipped=0,attempts=0;
 const models=[...bodies.values()].map(shape=>({shape,box:bounds(shape)}));
 const ribBounds=new Map(records.map(record=>[record,bounds(record.shape)]));
 onProgress?.({stage:'薄壁の横つなぎを作成しています'});
 try{
  for(const [left,right] of pairs){
   const axis=left.axis,other=1-axis;
   const a=ribBounds.get(left),b=ribBounds.get(right),lo=Math.max(a[0][other],b[0][other]),hi=Math.min(a[1][other],b[1][other]),bottom=Math.max(a[0][2],b[0][2]),top=Math.min(a[1][2],b[1][2])-Math.max(1,3*p.layerHeight);
   const interval=supportTieInterval(top-bottom,p);intervals.add(Number(interval.toFixed(6)));
   if(hi-lo<width+.2)continue;const rows=hi-lo>=3*width?[lo+(hi-lo)/3,lo+2*(hi-lo)/3]:[(lo+hi)/2],from=left.center+p.wallThickness/2-.12,to=right.center-p.wallThickness/2+.12,gap=to-from;
   if(gap<=.3)continue;
   const neck=Math.min(.7,gap/3),heights=[];
   for(let k=1;bottom+k*interval+thickness<=top+1e-6;k++){
    const z=p.bedZ+Math.ceil((bottom+k*interval-p.bedZ)/p.layerHeight-1e-7)*p.layerHeight;if(z+thickness>top+1e-6)break;
    attempts+=rows.length;
    if(attempts>512)throw supportAdjustmentError('横つなぎが多すぎます。高さの間隔を広げてください',{kind:'tie-limit'});
    heights.push(z);
   }
   if(!heights.length)continue;
   const layouts=rows.map(row=>({
    row,proven:verifiedTieColumn({axis,from,to,row,width,neck,neckWidth,heights,thickness,prism,models,left:left.shape,right:right.shape}),
    points:[[from,-neckWidth/2],[from+neck,-neckWidth/2],[from+neck,-width/2],[to-neck,-width/2],[to-neck,-neckWidth/2],[to,-neckWidth/2],[to,neckWidth/2],[to-neck,neckWidth/2],[to-neck,width/2],[from+neck,width/2],[from+neck,neckWidth/2],[from,neckWidth/2]].map(([x,y])=>axis===0?[x,row+y]:[row+y,x]),
   }));
   for(const z of heights){
    for(const {row,proven,points} of layouts){
     onProgress?.({stage:'薄壁の横つなぎを作成しています（'+(shapes.length+1)+'箇所目）'});
     let drawing=R.draw(points[0]);for(const point of points.slice(1))drawing=drawing.lineTo(point);let tie=drawing.close().sketchOnPlane('XY',z).extrude(thickness);
     try{
      if(!proven){
       const volume=R.measureVolume(tie),box=tieBounds(axis,from,to,row,width,z,z+thickness);
       // Keep whole, attached bridges around holes and obstructions.
       if(Math.abs(overlap(tie,prism)-volume)>Math.max(.0001,volume*1e-6)||overlap(tie,left.shape)<.001||
        overlap(tie,right.shape)<.001||!clearOfBodies(tie,box,models,.0001)){skipped++;continue;}
      }
      shapes.push(tie);tie=null;levels.add(Number(z.toFixed(6)));attachments.push({ribs:[left.id,right.id],z});
     }finally{tie?.delete();}
    }
   }
  }
  return {shapes,levels:[...levels].sort((a,b)=>a-b),intervals:[...intervals].sort((a,b)=>a-b),attachments,skipped,thickness,width,neckWidth};
 }catch(e){shapes.forEach(s=>s.delete());throw e;}
}
