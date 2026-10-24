import * as R from 'replicad';
const bounds=shape=>{const b=shape.boundingBox;try{return b.bounds;}finally{b.delete();}};
const solidCount=shape=>{const solids=shape.solids;try{return solids.length;}finally{solids.forEach(s=>s.delete());}};
const overlaps=(a,b)=>a[0].every((v,i)=>v<b[1][i]-1e-6&&a[1][i]>b[0][i]+1e-6);
function freeIntervals(lo,hi,blocked){
 const intervals=[];let cursor=lo;
 for(const [a,b] of blocked.filter(([a,b])=>b>lo&&a<hi).sort((a,b)=>a[0]-b[0])){if(a>cursor)intervals.push([cursor,Math.min(a,hi)]);cursor=Math.max(cursor,b);}
 if(cursor<hi)intervals.push([cursor,hi]);return intervals;
}
function prism(points,axis,center,thickness){
 const origin=[0,0,0];origin[axis]=center+(axis===0?-1:1)*thickness/2;
 const plane=new R.Plane(origin,axis===0?[0,1,0]:[1,0,0],axis===0?[1,0,0]:[0,-1,0]);
 try{let drawing=R.draw(points[0]);for(const point of points.slice(1))drawing=drawing.lineTo(point);return drawing.close().sketchOnPlane(plane).extrude(thickness);}finally{plane.delete();}
}
// Keep the entire root/top bands and continuous rails under tie connections.
// A full rectangular guard must fit inside the original wall, so windows cannot
// open onto an existing edge/hole or remove a landing on a non-flat base.
export function makeWallWindows(shape,records,ties,p,onProgress){
 const originalVolume=R.measureVolume(shape),tools=[],tieBoxes=ties.map(bounds),wallBoxes=records.map(record=>({record,box:bounds(record.shape)}));let skipped=0,attempts=0,limited=false,result=null;
 try{
  scan: for(const record of records){
   const {axis,center}=record,other=1-axis,b=bounds(record.shape),margin=Math.max(2,2*p.wallThickness),band=Math.max(3,4*p.layerHeight),localTies=tieBoxes.filter(t=>t[0][axis]<=center+p.wallThickness/2+.001&&t[1][axis]>=center-p.wallThickness/2-.001);
   const across=freeIntervals(b[0][other]+margin,b[1][other]-margin,localTies.map(t=>[t[0][other]-1,t[1][other]+1]));
   const vertical=freeIntervals(b[0][2]+band,b[1][2]-band,localTies.map(t=>[t[0][2]-1.2,t[1][2]+1.2]));
   for(const [lo,hi] of across)for(const [bottom,top] of vertical){
    const nx=Math.max(1,Math.ceil((hi-lo+2)/10)),nz=Math.max(1,Math.ceil((top-bottom+2)/20)),width=(hi-lo-2*(nx-1))/nx,height=(top-bottom-2*(nz-1))/nz;
    if(width<3||height<Math.max(8,1.5*width))continue;
    for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
     if(++attempts>256){limited=true;break scan;}
     const x=lo+i*(width+2)+width/2,z0=p.bedZ+Math.ceil((bottom+j*(height+2)-p.bedZ)/p.layerHeight-1e-7)*p.layerHeight,z1=p.bedZ+Math.floor((bottom+j*(height+2)+height-p.bedZ)/p.layerHeight+1e-7)*p.layerHeight,z=(z0+z1)/2;
     if(z1-z0<Math.max(8,1.5*width))continue;
     onProgress?.({stage:'リブの中央を窓抜きしています（'+(tools.length+1)+'箇所目）'});
     let guard=null,common=null,tool=null;
     try{
      guard=prism([[x-width/2-margin,z0-band],[x+width/2+margin,z0-band],[x+width/2+margin,z1+band],[x-width/2-margin,z1+band]],axis,center,p.wallThickness);common=guard.intersect(record.shape);
      const volume=R.measureVolume(guard);if(Math.abs(R.measureVolume(common)-volume)>Math.max(.0001,volume*1e-6)){skipped++;continue;}
      tool=prism([[x,z0],[x+width/2,z],[x,z1],[x-width/2,z]],axis,center,p.wallThickness+.2);
      const box=bounds(tool);if(tieBoxes.some(b=>overlaps(box,b))||wallBoxes.some(item=>item.record!==record&&overlaps(box,item.box))){skipped++;continue;}
      tools.push(tool);tool=null;
     }finally{tool?.delete();common?.delete();guard?.delete();}
    }
   }
  }
  if(tools.length){
   const compound=R.makeCompound(tools);try{result=shape.cut(compound);}finally{compound.delete();}
   if(solidCount(result)!==solidCount(shape))throw Error('窓抜きでリブが分断されるため中止しました。窓抜きをオフにしてください');
  }else result=shape.clone();
  const removedVolume=Math.max(0,originalVolume-R.measureVolume(result)),analysis={enabled:true,count:tools.length,skipped,limited,originalVolume,removedVolume,savedPercent:originalVolume?100*removedVolume/originalVolume:0};
  const answer=result;result=null;return {shape:answer,analysis};
 }finally{result?.delete();tools.forEach(s=>s.delete());}
}
