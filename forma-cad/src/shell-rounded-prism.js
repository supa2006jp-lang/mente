import * as R from 'replicad';
import {Vector3} from 'three';

const tolerance=1e-7;
function vectorAndDelete(value){
 try{return new Vector3(...value.toTuple());}
 finally{value.delete();}
}

function roundedRectangle(face){
 const wires=face.clone().innerWires();
 try{if(wires.length)return null;}
 finally{wires.forEach(wire=>wire.delete());}
 const edges=face.edges;
 try{
  const lines=edges.filter(edge=>edge.geomType==='LINE');
  const arcs=edges.filter(edge=>edge.geomType==='CIRCLE');
  if(edges.length!==8||lines.length!==4||arcs.length!==4)return null;
  const arcLength=arcs[0].length;
  if(arcs.some(edge=>Math.abs(edge.length-arcLength)>tolerance))return null;
  const directions=lines.map(edge=>vectorAndDelete(edge.endPoint).sub(vectorAndDelete(edge.startPoint)).normalize());
  const x=directions[0];
  const across=directions.findIndex(direction=>Math.abs(x.dot(direction))<tolerance);
  if(across<0)return null;
  const radius=arcLength*2/Math.PI;
  return {x,radius,width:lines[0].length+2*radius,height:lines[across].length+2*radius};
 }finally{edges.forEach(edge=>edge.delete());}
}

function extrudeRectangle(origin,x,axis,width,height,radius,depth){
 const plane=new R.Plane(origin.toArray(),x.toArray(),axis.toArray());
 try{return R.drawRoundedRectangle(width,height,radius).sketchOnPlane(plane).extrude(depth);}
 finally{plane.delete();}
}

// A corner disappears when the inward offset reaches its radius. Verify
// the whole source is a rounded extrusion before replacing that offset
// with an exact rectangular cavity. Cut the original to retain its exterior.
export function shellRoundedPrism(base,opening,thickness,originalVolume){
 if(opening.geomType!=='PLANE')return null;
 const section=roundedRectangle(opening);
 if(!section||thickness+tolerance<section.radius)return null;
 const {x,radius,width,height}=section;
 const innerWidth=width-2*thickness,innerHeight=height-2*thickness;
 if(innerWidth<=tolerance||innerHeight<=tolerance)return null;
 const inward=vectorAndDelete(opening.normalAt()).normalize().negate();
 const center=vectorAndDelete(opening.center);
 const openingArea=R.measureArea(opening),volumeTolerance=Math.max(1e-6,originalVolume*1e-8);
 const faces=base.faces;
 let outer,extra,missing,cavity,result;
 try{
  const opposite=faces.find(face=>face.geomType==='PLANE'&&
   vectorAndDelete(face.normalAt()).normalize().dot(inward)>1-tolerance&&
   Math.abs(R.measureArea(face)-openingArea)<=Math.max(1e-6,openingArea*1e-8));
  if(!opposite)return null;
  const depth=vectorAndDelete(opposite.center).sub(center).dot(inward);
  if(depth-thickness<=tolerance||Math.abs(openingArea*depth-originalVolume)>volumeTolerance)return null;
  outer=extrudeRectangle(center,x,inward,width,height,radius,depth);
  extra=outer.cut(base);
  missing=base.cut(outer);
  if(Math.abs(R.measureVolume(extra))>volumeTolerance||Math.abs(R.measureVolume(missing))>volumeTolerance)return null;

  const lead=Math.min(thickness,1);
  const cavityStart=center.clone().addScaledVector(inward,-lead);
  cavity=extrudeRectangle(cavityStart,x,inward,innerWidth,innerHeight,0,depth-thickness+lead);
  result=base.cut(cavity);
  const expected=originalVolume-innerWidth*innerHeight*(depth-thickness);
  if(Math.abs(R.measureVolume(result)-expected)>volumeTolerance)return null;
  const answer=result;result=null;
  return answer;
 }finally{
  result?.delete();cavity?.delete();missing?.delete();extra?.delete();outer?.delete();
  faces.forEach(face=>face.delete());
 }
}
