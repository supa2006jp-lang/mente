import * as R from 'replicad';
import {supportBoxesTouch} from './print-support-solid-groups.js';
import {supportOverlapVolume} from './print-support-boolean.js';

const tolerance=1e-6;
const areaOverlap=(a,b)=>Math.abs(supportOverlapVolume(a,b));

function samples(low,high,pitch){
 const count=Math.min(9,Math.max(1,Math.ceil((high-low)/pitch)));
 return Array.from({length:count*2+1},(_,i)=>low+(high-low)*i/(count*2));
}

export function supportFallbackColumns({face,faceBounds,height,bodies,bases,settings:p,limit,onProgress,positions,protectionTools=[]}){
 const radius=p.fallbackDiameter/2,margin=radius+p.edgeMargin,top=height-p.topGap;
 const low=faceBounds[0].map(v=>v+margin),high=faceBounds[1].map(v=>v-margin);
 if(limit<1||low[0]>high[0]+tolerance||low[1]>high[1]+tolerance||top<=p.bedZ+p.layerHeight)return [];
 const pitch=Math.max(p.wallPitch,p.fallbackDiameter*2,4),center=low.map((v,i)=>(v+high[i])/2);
 const points=positions||samples(low[0],high[0],pitch).flatMap(x=>samples(low[1],high[1],pitch).map(y=>[x,y]));
 if(!positions)points.sort((a,b)=>Math.hypot(a[0]-center[0],a[1]-center[1])-Math.hypot(b[0]-center[0],b[1]-center[1]));
 const vector=new R.Vector([0,0,p.layerHeight]),results=[];
 let scope,complete=false,checked=0;
 try{
  scope=R.basicFaceExtrusion(face,vector);
  for(const [x,y] of points){
   if(results.length>=limit||checked>=81)break;
   if(x<low[0]-tolerance||x>high[0]+tolerance||y<low[1]-tolerance||y>high[1]+tolerance)continue;
   if(results.some(column=>Math.hypot(x-column.point[0],y-column.point[1])<pitch*.85))continue;
   if((p.noSupport||[]).some(([x0,y0,x1,y1])=>x+radius>x0&&x-radius<x1&&y+radius>y0&&y-radius<y1))continue;
   checked++;
   onProgress?.({stage:'補完用の柱とすき間を確認しています'});
   const cap=R.makeCylinder(margin,p.layerHeight,[x,y,height]);
   let fits;
   try{fits=Math.abs(areaOverlap(scope,cap)-Math.PI*margin**2*p.layerHeight)<tolerance;}
   finally{cap.delete();}
   if(!fits)continue;
   const base=bases?.find([x,y,height],p.bedZ);
   if(base?.kind==='model'&&base.normal[2]<1-1e-6)continue;
   const bottom=base?.kind==='model'?base.point[2]+p.bottomGap:p.bedZ;
   if(top-bottom<p.layerHeight*2)continue;
   const clearance=R.makeCylinder(radius+Math.max(.015,p.sideGap),top-bottom,[x,y,bottom]);
   let clear;
   try{clear=[...bodies.values()].every(model=>areaOverlap(clearance,model)<tolerance);}
   finally{clearance.delete();}
   if(!clear)continue;
   // Only suppress slicer support directly above the new column.
   const shape=R.makeCylinder(radius,top-bottom,[x,y,bottom]);
   try{
    const box=[[x-radius,y-radius,bottom],[x+radius,y+radius,top]];
    if(protectionTools.some(tool=>supportBoxesTouch(box,tool.bounds)&&areaOverlap(shape,tool.shape)>tolerance)){
     shape.delete();continue;
    }
    const blocker=R.makeCylinder(radius,height+p.layerHeight-bottom,[x,y,bottom]);
    results.push({shape,blocker,point:[x,y,height],top,bottom,radius,baseBodyId:base?.bodyId});
   }catch(error){shape.delete();throw error;}
  }
  complete=true;
  return results;
 }finally{
  scope?.delete();vector.delete();
  if(!complete)for(const {shape,blocker} of results){shape.delete();blocker.delete();}
 }
}
