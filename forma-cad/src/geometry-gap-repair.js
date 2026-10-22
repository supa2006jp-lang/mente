import * as R from 'replicad';
import {MODEL_PRECISION as P,volumeAllowance} from './model-precision.js';

// Offer only a rigid translation between separate bodies. Internal slots need
// an explicit design decision and must never be filled automatically.
export function gapRepairSpec(bodies,request,onProgress){
 const {target,other,expectedGap,threshold=.01,id}=request,source=bodies.get(target),destination=bodies.get(other);
 if(!source||!destination||target===other||!Number.isFinite(threshold)||threshold<P.contact||threshold>1||!Number.isFinite(expectedGap)||expectedGap<=P.contact||typeof id!=='string')throw Error('修正する別ボディ間の隙間を選び直してください');
 const query=new R.DistanceTool();let a,b;
 try{
  const distance=query.distanceBetween(source,destination);
  if(distance<=P.contact||distance>threshold+P.topology||Math.abs(distance-expectedGap)>P.contact||query.wrapped.NbSolution()<1)throw Error('隙間の状態が変わりました。詳しく検査し直してください');
  a=query.wrapped.PointOnShape1(1);b=query.wrapped.PointOnShape2(1);
  const translation=[b.X()-a.X(),b.Y()-a.Y(),b.Z()-a.Z()],length=Math.hypot(...translation);
  // Native closest points give the exact shortest rigid translation. Any
  // third body closer than that travel is conservatively left for manual work.
  for(const [key,obstacle]of bodies)if(key!==target&&key!==other&&R.measureDistanceBetween(source,obstacle)<=length+P.contact)throw Error('途中に別のボディがある可能性があるため、この修正候補は適用できません');
  onProgress?.({stage:'CADの最近接点で移動し、接触と食い込みを確認しています'});
  const move={type:'move',id,target,x:translation[0],y:translation[1],z:translation[2],rotation:[0,0,0]},moved=source.clone().translate(translation);let afterGap;
  try{
   if((afterGap=R.measureDistanceBetween(moved,destination))>P.contact)throw Error('精密な接触を確認できません。平面同士の隙間を選んでください');
   for(const [key,obstacle]of bodies){if(key===target)continue;let before,after;
    try{before=source.intersect(obstacle);after=moved.intersect(obstacle);if(Math.abs(R.measureVolume(after))-Math.abs(R.measureVolume(before))>volumeAllowance(R.measureVolume(source)))throw Error('修正すると別の部分に食い込むため、移動を中止しました');}
    finally{before?.delete();after?.delete();}
   }
  }finally{moved.delete();}
  return {spec:move,beforeGap:distance,afterGap,other,translation};
 }finally{a?.delete();b?.delete();query.delete();}
}
