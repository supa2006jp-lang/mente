import * as R from 'replicad';
import {basisFor,worldPoint} from './frames.js';
import {validateTaperAngle} from './taper.js';
function faceArea(wire){const face=R.makeFace(wire);try{return R.measureArea(face);}finally{face.delete();}}
function loftTaper(shape,origin,normal,angle){
 const faces=shape.faces,parts=[];let result;
 const coordinate=p=>(p[0]-origin[0])*normal.x+(p[1]-origin[1])*normal.y+(p[2]-origin[2])*normal.z;
 const parallel=face=>{const n=face.normalAt();try{return Math.abs(n.x*normal.x+n.y*normal.y+n.z*normal.z)/n.Length>.999999;}finally{n.delete();}};
 const caps=faces.filter(face=>{if(face.geomType!=='PLANE'||!parallel(face))return false;const c=face.center;try{return Math.abs(coordinate(c.toTuple()))<.01;}finally{c.delete();}});
 const vertices=shape.mesh({tolerance:.1,angularTolerance:.2}).vertices;let height=0;for(let i=0;i<vertices.length;i+=3)height=Math.max(height,coordinate(vertices.slice(i,i+3)));
 const shift=height*Math.tan(angle*Math.PI/180);
 const band=(wire,hole)=>{
  let end,a,b;try{
   const initial=faceArea(wire),delta=hole?-shift:shift;
   end=wire.clone().offset2D(delta,'intersection');
   if((faceArea(end)-initial)*delta<=0){end.delete();end=wire.clone().offset2D(-delta,'intersection');}
   if((faceArea(end)-initial)*delta<=0)throw Error('collapsed');
   const point=end.startPoint;let offset;try{offset=coordinate(point.toTuple());}finally{point.delete();}
   end=end.translate(normal.clone().multiplyScalar(height-offset).toArray());
   a=new R.Sketch(wire.clone());b=new R.Sketch(end);end=null;return a.loftWith(b,{ruled:true});
  }finally{a?.delete();b?.delete();end?.delete();wire.delete();}
 };
 try{
  if(!caps.length)throw Error('missing cap');
  for(const face of caps){let solid=band(face.clone().outerWire(),false);try{for(const hole of face.clone().innerWires()){const tool=band(hole,true);try{const cut=solid.cut(tool);solid.delete();solid=cut;}finally{tool.delete();}}parts.push(solid);solid=null;}finally{solid?.delete();}}
  result=parts.length===1?parts[0].clone():R.makeCompound(parts).asShape3D();return result;
 }finally{for(const part of parts)part.delete();for(const face of faces)face.delete();}
}
export function draftExtrusion(shape,feature){
 const angle=validateTaperAngle(feature.taperAngle??0);if(!angle)return shape;
 const profile=feature.region||feature,b=basisFor(profile),normal=b.n.multiplyScalar(Math.sign(feature.depth)),origin=feature.region?worldPoint(profile,profile.outer[0]).toArray():[feature.x,feature.y,feature.z];
 const plane=new R.Plane(origin,b.u.toArray(),normal.toArray());let drafted,check;
 try{
  // OCCT's positive draft goes inward; Fusion's positive taper goes outward.
  try{drafted=shape.draft(-angle,ff=>ff.when(({normal:faceNormal,element})=>element.geomType!=='PLANE'||Math.abs(faceNormal.x*normal.x+faceNormal.y*normal.y+faceNormal.z*normal.z)/faceNormal.Length<.999999),plane);}
  catch{drafted=loftTaper(shape,origin,normal,angle);}
  check=new (R.getOC().BRepCheck_Analyzer)(drafted.wrapped,true,false);
  if(!check.IsValid()||!(R.measureVolume(drafted)>1e-7))throw Error('invalid');
  return drafted;
 }catch(error){drafted?.delete();throw Error('この角度ではテーパーを作れません。角度や押し出し距離を小さくしてください');}
 finally{check?.delete();shape.delete();plane.delete();}
}
