import * as R from 'replicad';

// The document already stores the render mesh. BREP only needs exact surfaces,
// curves and topology, not another copy of their cached triangulations.
// Deserialize independently: shallow CAD clones share face caches with inputs.
export function serializeCadShape(shape){
 return compactBrep(shape.serialize());
}
export function compactBrep(brep){
 const copy=R.deserializeShape(brep).asShape3D();
 try{R.getOC().BRepTools.Clean(copy.wrapped,false);return copy.serialize();}
 finally{copy.delete();}
}
