import * as R from 'replicad';
import {formCurves,formError,formGeometryRings,validateFormProfile} from './form-profile.js';
import {formBasis,formWorld} from './form-orientation.js';
import {makeTangentFormSolid} from './form-tangent-solid.js';
import {formSeams} from './form-seam.js';

export function makeFormSolid(form,makeRegionWire){
 validateFormProfile(form);
 const rings=formGeometryRings(form),wires=[],axes=formBasis(form.orientation),seams=formSeams(form);
 const allSections=form.rings.map((_,i)=>i);
 let solid,check,parts=[];
 try{
  const wireRings=seams.length?[rings[0],rings.at(-1)]:rings;
  for(const ring of wireRings){
   try{
    if(ring.reference){
     wires.push(makeRegionWire(ring.reference,ring.reference.outer));
     continue;
    }
    if(!form.orientation){
     const drawing=R.draw(ring.points[0]);
     for(const {a,b,end} of formCurves(ring))drawing.bezierCurveTo(end,[a,b]);
     const sketch=drawing.close().sketchOnPlane('XY',ring.z);
     try{wires.push(sketch.wire.clone());}finally{sketch.delete();}
    }else{
     const edges=[];
     try{
      for(const {start,a,b,end} of formCurves(ring))edges.push(R.makeBezierCurve([start,a,b,end].map(([x,y])=>formWorld(axes,x,y,ring.z).toArray())));
      wires.push(R.assembleWire(edges));
     }finally{edges.forEach(edge=>edge.delete());}
    }
   }catch{
    const section=form.rings.findIndex(original=>Math.abs(original.z-ring.z)<1e-7);
    if(section<0)throw formError('ガイド線に沿う中間断面を作成できません。ガイド線を確認してください。',allSections);
    throw formError('断面 '+(section+1)+' の曲線を作成できません。制御点を調整してください。',[section]);
   }
  }
  solid=seams.length?makeTangentFormSolid(rings,seams,axes,wires):R.loft(wires,{ruled:!form.guides?.length});
  check=new (R.getOC().BRepCheck_Analyzer)(solid.wrapped,true,false);
  parts=solid.solids;
  if(parts.length!==1||!check.IsValid()||!(R.measureVolume(solid)>.001))
   throw formError('断面を閉じたソリッドにつなげられません。赤い断面の位置や大きさを調整してください。',allSections);
  const result=solid;solid=null;return result;
 }catch(error){
  if(error?.code==='invalid-form')throw error;
  throw formError('曲面をソリッドにできません。赤い断面の高さや輪郭を調整してください。',allSections);
 }finally{
  check?.delete();parts.forEach(shape=>shape.delete());solid?.delete();
  wires.forEach(wire=>wire.delete());
 }
}
