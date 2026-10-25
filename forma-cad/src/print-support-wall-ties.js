import * as R from 'replicad';
import {supportTieInterval} from './print-support-strength.js';
const bounds=s=>{const b=s.boundingBox;try{return b.bounds;}finally{b.delete();}};
const overlap=(a,b)=>{const s=a.intersect(b);try{return R.measureVolume(s);}finally{s.delete();}};

// Short horizontal bridges join neighboring fins. Narrow ends leave a place to
// cut them after printing, while the middle restrains motion across the fins.
export function makeWallTies(records,prism,bodies,p,onProgress){
 const shapes=[],levels=new Set(),intervals=new Set(),attachments=[],thickness=2*p.layerHeight,width=Math.max(1.6,Math.min(3,2*p.wallThickness)),neckWidth=Math.min(width,Math.max(.6,p.wallThickness));let skipped=0,attempts=0;
 try{
  for(let i=1;i<records.length;i++){
   const left=records[i-1],right=records[i],axis=left.axis,other=1-axis;if(right.center-left.center>p.wallPitch*1.05)continue;
   const a=bounds(left.shape),b=bounds(right.shape),lo=Math.max(a[0][other],b[0][other]),hi=Math.min(a[1][other],b[1][other]),bottom=Math.max(a[0][2],b[0][2]),top=Math.min(a[1][2],b[1][2])-Math.max(1,3*p.layerHeight);
   const interval=supportTieInterval(top-bottom,p);intervals.add(Number(interval.toFixed(6)));
   if(hi-lo<width+.2)continue;const rows=hi-lo>=3*width?[lo+(hi-lo)/3,lo+2*(hi-lo)/3]:[(lo+hi)/2],from=left.center+p.wallThickness/2-.12,to=right.center-p.wallThickness/2+.12,gap=to-from;
   if(gap<=.3)continue;const neck=Math.min(.7,gap/3);
   for(let k=1;bottom+k*interval+thickness<=top+1e-6;k++){
    const z=p.bedZ+Math.ceil((bottom+k*interval-p.bedZ)/p.layerHeight-1e-7)*p.layerHeight;if(z+thickness>top+1e-6)break;
    for(const row of rows){
     if(++attempts>512)throw Error('横つなぎが多すぎます。高さの間隔を広げてください');
     onProgress?.({stage:'薄壁の横つなぎを作成しています（'+(shapes.length+1)+'箇所目）'});
     const points=[[from,-neckWidth/2],[from+neck,-neckWidth/2],[from+neck,-width/2],[to-neck,-width/2],[to-neck,-neckWidth/2],[to,-neckWidth/2],[to,neckWidth/2],[to-neck,neckWidth/2],[to-neck,width/2],[from+neck,width/2],[from+neck,neckWidth/2],[from,neckWidth/2]].map(([x,y])=>axis===0?[x,row+y]:[row+y,x]);
     let drawing=R.draw(points[0]);for(const point of points.slice(1))drawing=drawing.lineTo(point);let tie=drawing.close().sketchOnPlane('XY',z).extrude(thickness);
     try{
      const volume=R.measureVolume(tie);
      // Do not clip a bridge into disconnected floating fragments around holes.
      if(Math.abs(overlap(tie,prism)-volume)>Math.max(.0001,volume*1e-6)||overlap(tie,left.shape)<.001||overlap(tie,right.shape)<.001||[...bodies.values()].some(body=>overlap(tie,body)>.0001)){skipped++;continue;}
      shapes.push(tie);tie=null;levels.add(Number(z.toFixed(6)));attachments.push({ribs:[left.id,right.id],z});
     }finally{tie?.delete();}
    }
   }
  }
  return {shapes,levels:[...levels].sort((a,b)=>a-b),intervals:[...intervals].sort((a,b)=>a-b),attachments,skipped,thickness,width,neckWidth};
 }catch(e){shapes.forEach(s=>s.delete());throw e;}
}
