import * as R from 'replicad';import {cadSubshapes} from './cad-topology.js';
const bounds=s=>{const box=s.boundingBox;try{return box.bounds.map(p=>[...p]);}finally{box.delete();}},overlaps=(a,b)=>a[0].every((v,k)=>v<=b[1][k]+1e-7&&a[1][k]>=b[0][k]-1e-7);
// Contact layers and ribs share native edges with the source. Default boolean
// operations can update that shared data, breaking a later circular-edge clip.
// Keep these display-only operations exact and non-destructive on both inputs.
function previewBoolean(kind,source,tool){
 const oc=R.getOC(),builder=kind==='cut'?new oc.BRepAlgoAPI_Cut():new oc.BRepAlgoAPI_Common(),a=new oc.NCollection_List_TopoDS_Shape(),b=new oc.NCollection_List_TopoDS_Shape();
 try{a.Append(source.wrapped);b.Append(tool.wrapped);builder.SetArguments(a);builder.SetTools(b);builder.SetNonDestructive(true);builder.SetFuzzyValue(0);builder.Build();if(builder.HasErrors())throw Error('サポートの表示用形状の切り出しに失敗しました');return R.cast(builder.Shape()).asShape3D();}
 finally{builder.delete();a.delete();b.delete();}
}
// (source minus grooves) intersect tool == (source intersect tool) minus grooves.
// Clip the simple source first, instead of repeatedly intersecting thousands of
// grooved faces to prepare a small contact/rib highlight. Final CAD is unchanged.
export function supportLocalPreview(source,masks){
 const parts=cadSubshapes(source,'solid');let pieces,tools;try{pieces=parts.map(shape=>({shape,box:bounds(shape)}));tools=masks.map(shape=>({shape,box:bounds(shape)}));}catch(error){parts.forEach(p=>p.delete());throw error;}
 return {clip(tool){const box=bounds(tool),results=[];try{for(const part of pieces){if(!overlaps(part.box,box))continue;let shape=previewBoolean('common',part.shape,tool);try{for(const mask of tools)if(overlaps(mask.box,box)&&overlaps(mask.box,part.box)){const next=previewBoolean('cut',shape,mask.shape);shape.delete();shape=next;}results.push(shape);shape=null;}finally{shape?.delete();}}return results.length===1?results.pop():R.makeCompound(results);}finally{results.forEach(p=>p.delete());}},delete(){parts.forEach(p=>p.delete());}};
}
