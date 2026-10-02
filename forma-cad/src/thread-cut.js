import * as R from 'replicad';
export function cutThread(base,tool){
 const oc=R.getOC(),before=R.measureVolume(base);
 const valid=shape=>{const volume=R.measureVolume(shape),check=new oc.BRepCheck_Analyzer(shape.wrapped,true,false);try{return check.IsValid()&&Number.isFinite(volume)&&volume>0&&volume<before-Math.max(1e-5,before*1e-6);}finally{check.delete();}};
 try{const result=base.cut(tool);if(valid(result))return result;result.delete();}catch{}
 for(const tolerance of [1e-7,1e-6,1e-5,1e-4]){
  const builder=new oc.BRepAlgoAPI_Cut(base.wrapped,tool.wrapped);
  try{builder.SetFuzzyValue(tolerance);builder.Build();const result=R.cast(builder.Shape()).asShape3D();if(valid(result))return result;result.delete();}finally{builder.delete();}
 }
 throw Error('ねじ溝を正常に作れませんでした。長さまたはピッチを調整してください');
}
