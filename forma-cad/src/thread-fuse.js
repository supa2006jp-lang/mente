import * as R from 'replicad';

export function fuseThread(base,ridge,{requireJoined=false}={}){
 const before=R.measureVolume(base),added=R.measureVolume(ridge),oc=R.getOC();
 const acceptable=result=>{
  const after=R.measureVolume(result),checker=new oc.BRepCheck_Analyzer(result.wrapped,true,false);
  const valid=checker.IsValid();checker.delete();
  const joined=!requireJoined||(result.solids.length===base.solids.length&&after>before+Math.abs(added)*.01);
  return valid&&joined&&Number.isFinite(after)&&after>before+1e-7&&after<=before+Math.abs(added)+Math.max(.001,before*1e-6);
 };
 let standard=null;
 try{
  const result=base.fuse(ridge);
  if(acceptable(result)){
   standard=result;
   const remainder=base.cut(result),lost=Math.abs(R.measureVolume(remainder));remainder.delete();
   if(lost<.001)return result;
  }
  if(!standard)result.delete();
 }catch{}
 const builder=new oc.BRepAlgoAPI_Fuse(base.wrapped,ridge.wrapped);
 try{
  // Axis alignment introduces roundoff at periodic helical seams.
  builder.SetFuzzyValue(1e-6);
  builder.Build();
  // Preserve the boolean topology instead of merging periodic faces again.
  const result=R.cast(builder.Shape()).asShape3D();
  if(!acceptable(result)){result.delete();if(standard)return standard;throw Error('ねじ山を正常に結合できませんでした。ピッチまたは長さを調整してください');}
  if(standard)standard.delete();
  return result;
 }finally{builder.delete();}
}
