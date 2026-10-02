import * as R from 'replicad';
import {latchDimensions} from './coil-latch.js';
import {detentDimensions} from './coil-detent.js';
import {ridgeVerticalFilletLimitDetail} from './coil-fillet-clearance.js';

function cornerLoss(profile){
 if(!profile)return 0;
 return Math.max(...profile.map((v,i)=>{const a=profile[(i+profile.length-1)%profile.length].map((x,k)=>x-v[k]),b=profile[(i+1)%profile.length].map((x,k)=>x-v[k]),dot=(a[0]*b[0]+a[1]*b[1])/Math.hypot(...a)/Math.hypot(...b),angle=Math.acos(Math.max(-1,Math.min(1,dot)));return 1/Math.sin(angle/2)-1;}));
}
function exteriorEdges(shape,q,lid){
 const angle=(lid?q.closeAngle:0)*Math.PI/180,profile=q.profile?.map(([x,y])=>[x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle)]),edges=shape.edges,cap=lid?q.height:0;
 return {select(vertical,capEnabled){return edges.filter(edge=>{const points=[0,.25,.5,.75,1].map(t=>{const p=edge.pointAt(t);try{return p.toTuple();}finally{p.delete();}});
  if(capEnabled&&points.every(p=>Math.abs(p[2]-cap)<1e-6&&Math.hypot(p[0],p[1])>=q.radius-1e-6))return true;
  return vertical&&profile&&edge.geomType==='LINE'&&points.every(p=>profile.some(v=>Math.hypot(p[0]-v[0],p[1]-v[1])<1e-6));
 });},delete(){edges.forEach(edge=>edge.delete());}};
}
function valid(shape,before){const oc=R.getOC(),check=new oc.BRepCheck_Analyzer(shape.wrapped,true,false),solids=shape.solids;try{const volume=R.measureVolume(shape);return check.IsValid()&&solids.length===1&&Number.isFinite(volume)&&volume>1e-7&&volume<=before+Math.max(1e-6,before*1e-8);}finally{check.delete();solids.forEach(s=>s.delete());}}
function radii(maximum){return maximum>=.05?[...new Set([maximum,maximum-.1,maximum-.25,maximum/2,maximum/4,.05].filter(value=>value>=.05&&value<=maximum))]:[0];}
function filletGroup(shape,q,lid,verticalRadius,capRadius){
 let current=shape.clone(),verticalEdges=0,capEdges=0;
 try{
  for(const [radius,vertical,cap] of [[verticalRadius,true,false],[capRadius,false,true]]){
   if(radius<.05)continue;
   const selector=exteriorEdges(current,q,lid);
   try{const chosen=selector.select(vertical,cap);if(!chosen.length)continue;const next=current.fillet(radius,finder=>finder.inList(chosen));current.delete();current=next;if(vertical)verticalEdges=chosen.length;else capEdges=chosen.length;}
   finally{selector.delete();}
  }
  return {shape:current,verticalEdges,capEdges};
 }catch(error){current.delete();throw error;}
}
export function filletCoilExteriors(body,lid,q){
 const d=q.jointLatch?(q.latchStyle==='ridge'?detentDimensions(q):latchDimensions(q)):null,loss=cornerLoss(q.profile);
 const requestedVerticalRadius=q.requestedVerticalFilletRadius??q.requestedFilletRadius??q.filletRadius;
 const requestedCapRadius=q.requestedCapFilletRadius??q.requestedFilletRadius??q.filletRadius;
 const legacyVerticalLimit=d&&loss>1e-9?Math.max(0,(d.receiverBacking-d.backing)/loss):Infinity;
 const verticalEnabled=q.filletVertical!==false&&!!q.profile,capEnabled=q.filletBodyBottom!==false||q.filletLidTop!==false;
 const ridgeLimit=verticalEnabled?ridgeVerticalFilletLimitDetail(q,requestedVerticalRadius):null;
 const maxVertical=verticalEnabled?Math.min(requestedVerticalRadius,ridgeLimit?.radius??legacyVerticalLimit):0;
 const maxCap=capEnabled?q.filletRadius:0,before=[R.measureVolume(body),R.measureVolume(lid)];
 const verticalBoundReason=ridgeLimit?.reason??(maxVertical<requestedVerticalRadius-1e-8?{type:'latch-wall',label:'固定部の外壁厚確保'}:null);
 const reductionReason=(requested,bounded,actual,boundReason)=>actual<requested-1e-8?(actual<bounded-1e-8?{type:'kernel',label:'形状計算上限'}:boundReason??{type:'dimension',label:'寸法制約'}):null;
 if(verticalEnabled&&maxVertical<.05)throw Error('縦の角を丸められません。受け溝の外側に必要な壁厚を確保できません');
 if(maxVertical<.05&&maxCap<.05)throw Error('外側のフィレットを作成できません');
 for(const verticalRadius of radii(maxVertical))for(const capRadius of radii(maxCap)){
  let parts=[];
  try{
   const results=[];
   for(const [i,shape] of [body,lid].entries()){
    const result=filletGroup(shape,q,!!i,verticalRadius,(i?q.filletLidTop:q.filletBodyBottom)!==false?capRadius:0);
    results.push(result);parts.push(result.shape);
    if(verticalEnabled&&!result.verticalEdges)throw Error('vertical edges missing');
    if((i?q.filletLidTop:q.filletBodyBottom)!==false&&!result.capEdges)throw Error('cap edges missing');
   }
   if(results.every(result=>!result.verticalEdges&&!result.capEdges))throw Error('外側のフィレット対象の辺を特定できませんでした');
   if(parts.some((shape,i)=>!valid(shape,before[i])))throw Error('正常なフィレットを作成できませんでした');
   const appliedVertical=results.some(result=>result.verticalEdges)?verticalRadius:0,appliedCap=results.some(result=>result.capEdges)?capRadius:0;
   return {parts,analysis:{status:'clear',requestedRadius:requestedCapRadius,requestedVerticalRadius,requestedCapRadius,radius:appliedCap||appliedVertical,verticalRadius:appliedVertical,capRadius:appliedCap,
    verticalReason:verticalEnabled?reductionReason(requestedVerticalRadius,maxVertical,appliedVertical,verticalBoundReason):null,
    capReason:capEnabled?reductionReason(requestedCapRadius,maxCap,appliedCap,q.capFilletReason):null,
    verticalCorners:appliedVertical>=.05,locations:{bodyBottom:q.filletBodyBottom!==false,lidTop:q.filletLidTop!==false,vertical:appliedVertical>=.05},edges:results.map(result=>result.verticalEdges+result.capEdges)}};
  }catch{parts.forEach(shape=>shape.delete());}
 }
 throw Error('外側の自動フィレットを作成できませんでした。半径を小さくしてください');
}
