import * as R from 'replicad';
// Reproduce legacy boolean fragments independently of the current union cleanup.
export function rawUnion(shapes){
 const oc=R.getOC(),builder=new oc.BRepAlgoAPI_Fuse(),args=new oc.NCollection_List_TopoDS_Shape(),tools=new oc.NCollection_List_TopoDS_Shape();
 try{args.Append(shapes[0].wrapped);shapes.slice(1).forEach(s=>tools.Append(s.wrapped));builder.SetArguments(args);builder.SetTools(tools);builder.SetNonDestructive(true);builder.Build();if(builder.HasErrors())throw Error('Legacy fixture union failed');return R.cast(builder.Shape()).asShape3D();}
 finally{builder.delete();args.delete();tools.delete();}
}
