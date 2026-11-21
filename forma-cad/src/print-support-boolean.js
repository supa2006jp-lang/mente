import * as R from 'replicad';

// Set the operands on an empty builder so each operation is built once.
// The ribs, skins and previews may share topology. Keep their geometry intact.
export function supportNonDestructiveBoolean(kind,source,tool,{simplify=false}={}){
 const oc=R.getOC();
 const builder=kind==='cut'?new oc.BRepAlgoAPI_Cut():new oc.BRepAlgoAPI_Common();
 const argumentsList=new oc.NCollection_List_TopoDS_Shape(),toolsList=new oc.NCollection_List_TopoDS_Shape();
 let result;
 try{
  argumentsList.Append(source.wrapped);toolsList.Append(tool.wrapped);
  builder.SetArguments(argumentsList);builder.SetTools(toolsList);
  builder.SetNonDestructive(true);builder.SetFuzzyValue(0);
  builder.Build();
  if(builder.HasErrors())throw Error('サポートの形状を切り出せませんでした');
  if(simplify)builder.SimplifyResult(true,true,.001);
  result=builder.Shape();
  return R.cast(result).asShape3D();
 }finally{result?.delete();builder.delete();argumentsList.delete();toolsList.delete();}
}

export function supportOverlapVolume(source,tool){
 let common;
 try{common=supportNonDestructiveBoolean('common',source,tool);}
 catch(error){
  if(error instanceof WebAssembly.RuntimeError)throw error;
  common=source.intersect(tool);
 }
 try{return R.measureVolume(common);}
 finally{common.delete();}
}
