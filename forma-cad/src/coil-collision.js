import * as R from 'replicad';

// Motion checks only need intersection volume. Build the exact Common once,
// without topology simplification or modification history for a discarded result.
export function coilOverlapVolume(a,b){
 const oc=R.getOC(),argumentsList=new oc.NCollection_List_TopoDS_Shape(),tools=new oc.NCollection_List_TopoDS_Shape(),builder=new oc.BRepAlgoAPI_Common();let overlap,properties;
 try{
  argumentsList.Append(a.wrapped);tools.Append(b.wrapped);builder.SetArguments(argumentsList);builder.SetTools(tools);
  builder.SetNonDestructive(true);builder.SetToFillHistory(false);builder.SetUseOBB(true);builder.Build();
  if(!builder.IsDone()||builder.HasErrors())throw Error('開閉の干渉を計算できませんでした');
  overlap=builder.Shape();properties=new oc.GProp_GProps();oc.BRepGProp.VolumeProperties(overlap,properties,false,false,false);const volume=Math.abs(properties.Mass());
  if(!Number.isFinite(volume))throw Error('開閉の干渉量を測定できませんでした');
  return volume;
 }finally{properties?.delete();overlap?.delete();builder.delete();tools.delete();argumentsList.delete();}
}
