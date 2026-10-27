import * as R from 'replicad';
import {MODEL_PRECISION} from './model-precision.js';
import {solidMeshComplete} from './solid-mesh.js';

function valid(shape){const checker=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{return checker.IsValid();}finally{checker.delete();}}
function exactBoolean(a,b,type){
 const oc=R.getOC(),builder=new oc[type](),args=new oc.NCollection_List_TopoDS_Shape(),tools=new oc.NCollection_List_TopoDS_Shape();
 try{args.Append(a.wrapped);tools.Append(b.wrapped);builder.SetArguments(args);builder.SetTools(tools);builder.SetNonDestructive(true);builder.SetFuzzyValue(0);builder.Build();if(builder.HasErrors())return null;return R.cast(builder.Shape()).asShape3D();}
 finally{builder.delete();args.delete();tools.delete();}
}
function containsExactly(container,body,volume){
 let difference,common;
 try{
  if(!valid(container)||!valid(body))return false;
  difference=exactBoolean(body,container,'BRepAlgoAPI_Cut');
  // Require an actually empty topology, not a small-volume leftover. Thin
  // protrusions or disconnected slivers must never be silently discarded.
  if(!difference||!(difference instanceof R.Compound)||difference.wrapped.NbChildren()!==0||!valid(difference))return false;
  common=exactBoolean(body,container,'BRepAlgoAPI_Common');
  if(!common||!valid(common))return false;
  return Math.abs(R.measureVolume(common)-volume)<=Math.max(MODEL_PRECISION.minVolume,volume*MODEL_PRECISION.relativeVolume);
 }catch{return false;}
 finally{difference?.delete();common?.delete();}
}

// A fallback for a failed native fuse. If one existing solid contains every
// input exactly, their union is that existing solid. Do not rebuild coincident
// surfaces or change any tolerance. Keep this bounded for large selections.
export function containedUnion(shapes,volumes,onProgress){
 if(shapes.length<2||shapes.length>16||shapes.some(shape=>!(shape instanceof R.Solid))||volumes.some(v=>!Number.isFinite(v)||v<=MODEL_PRECISION.minVolume))return null;
 const largest=volumes.indexOf(Math.max(...volumes)),container=shapes[largest],boxes=shapes.map(shape=>{const box=shape.boundingBox;try{return box.bounds.map(p=>[...p]);}finally{box.delete();}}),bounds=boxes[largest];
 if(boxes.some(box=>box[0].some((v,i)=>v<bounds[0][i]-MODEL_PRECISION.topology)||box[1].some((v,i)=>v>bounds[1][i]+MODEL_PRECISION.topology)))return null;
 for(let i=0;i<shapes.length;i++)if(i!==largest){onProgress?.({stage:'重複するボディの完全包含を確認しています（'+(i+1)+' / '+shapes.length+'）'});if(!containsExactly(container,shapes[i],volumes[i]))return null;}
 // Mesh validation works on an independent copy so it cannot update shared
 // face triangulation caches on the source/history shapes.
 const copy=R.deserializeShape(container.serialize()).asShape3D();let accepted=false;
 try{if(!valid(copy)||!solidMeshComplete(copy))return null;accepted=true;return copy;}
 finally{if(!accepted)copy.delete();}
}
