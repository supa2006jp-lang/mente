import * as R from 'replicad';
import {MODEL_PRECISION} from './model-precision.js';
const bounds=shape=>{const box=shape.boundingBox;try{return box.bounds;}finally{box.delete();}};
const boxDistance=(a,b)=>Math.hypot(...[0,1,2].map(i=>Math.max(0,a[0][i]-b[1][i],b[0][i]-a[1][i])));
function closest(a,b){
 const query=new (R.getOC().BRepExtrema_DistShapeShape)();
 try{query.LoadS1(a.wrapped);query.LoadS2(b.wrapped);query.Perform();if(!query.IsDone())throw Error('最短距離を計算できません');const distance=query.Value();let points=null;if(query.NbSolution()>0){const p=query.PointOnShape1(1),q=query.PointOnShape2(1);try{points=[[p.X(),p.Y(),p.Z()],[q.X(),q.Y(),q.Z()]];}finally{p.delete();q.delete();}}return {distance,points};}finally{query.delete();}
}
// Check the whole moving rigid group against all stationary bodies. AABB lower
// bounds only prune pairs that cannot overlap or improve the known minimum gap.
export function inspectAssemblyContact(moving,stationary,{preview=false,maxPairs=128,maxMs=2000,onProgress}={}){
 const boxes=new Map([...moving,...stationary].map(([id,shape])=>[id,bounds(shape)])),pairs=[];
 for(const [source,a]of moving)for(const [target,b]of stationary)pairs.push({source,target,a,b,lower:boxDistance(boxes.get(source),boxes.get(target))});pairs.sort((a,b)=>a.lower-b.lower);
 const rows=[],highlights=[],started=performance.now();let nearest=Infinity,checked=0,pruned=0,errors=0;
 for(const pair of pairs){
  if(pair.lower>nearest+MODEL_PRECISION.contact){pruned++;continue;}
  if(checked>=maxPairs||performance.now()-started>maxMs)break;
  onProgress?.({stage:'部品の接触を検査しています（'+(checked+1)+'組目）'});checked++;
  try{
   const {distance,points}=closest(pair.a,pair.b);if(!Number.isFinite(distance))throw Error('距離が不正です');nearest=Math.min(nearest,distance);
   let volume=0,common=null;const a=boxes.get(pair.source),b=boxes.get(pair.target),overlap=[0,1,2].every(i=>Math.min(a[1][i],b[1][i])-Math.max(a[0][i],b[0][i])>MODEL_PRECISION.topology);
   try{
    if(distance<=MODEL_PRECISION.contact&&overlap){common=pair.a.intersect(pair.b);volume=Math.abs(R.measureVolume(common));if(!Number.isFinite(volume))throw Error('共通部分を検査できません');}
    const status=volume>MODEL_PRECISION.minVolume?'interference':distance<=MODEL_PRECISION.contact?'contact':'gap',row={source:pair.source,target:pair.target,status,distance,volume,points};rows.push(row);
    if(preview&&status==='interference'&&common&&highlights.length<24){try{const mesh=common.mesh({tolerance:.04,angularTolerance:.15});if(mesh.triangles.length&&mesh.triangles.length<=120000)highlights.push({source:pair.source,target:pair.target,...mesh});}catch{/* Pair outlines remain available if a complex common region cannot be meshed. */}}
   }finally{common?.delete();}
  }catch(error){errors++;rows.push({source:pair.source,target:pair.target,status:'unknown',message:'この組合せを検査できませんでした'});}
 }
 const complete=checked+pruned===pairs.length&&errors===0,interference=rows.filter(r=>r.status==='interference'),near=rows.filter(r=>Number.isFinite(r.distance)).sort((a,b)=>a.distance-b.distance)[0];
 return {report:{status:interference.length?'interference':!complete?'unknown':near?.status||'none',complete,checked,pruned,total:pairs.length,rows,nearest:near?{source:near.source,target:near.target,distance:near.distance}:null},highlights};
}
