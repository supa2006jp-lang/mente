import * as R from 'replicad';
// Unifying coincident periodic faces can remove part of a trimmed inner wall.
// Retry the boolean without face unification if the simplified result is invalid.
export function fuseSolid(base,tool){
 const oc=R.getOC(),a=Math.abs(R.measureVolume(base)),b=Math.abs(R.measureVolume(tool)),eps=Math.max(1e-6,(a+b)*1e-8);
 const acceptable=shape=>{const check=new oc.BRepCheck_Analyzer(shape.wrapped,true,false);try{const volume=R.measureVolume(shape);return check.IsValid()&&Number.isFinite(volume)&&volume>=Math.max(a,b)-eps&&volume<=a+b+eps;}finally{check.delete();}};
 let result;try{result=base.fuse(tool);if(acceptable(result))return result;}catch{}result?.delete();
 for(const tolerance of [0,1e-6]){const builder=new oc.BRepAlgoAPI_Fuse(base.wrapped,tool.wrapped);result=null;try{builder.SetNonDestructive(true);builder.SetFuzzyValue(tolerance);builder.Build();result=R.cast(builder.Shape()).asShape3D();if(acceptable(result))return result;}catch{}finally{builder.delete();}result?.delete();}
 throw Error('正常なソリッドとして結合できませんでした。元のボディは変更していません');
}
