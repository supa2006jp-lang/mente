import * as R from 'replicad';
import * as THREE from 'three';

// Revolving a transverse circle/line around a parallel axis describes a plane.
// OC can retain a singular surface-of-revolution parameterization instead;
// boolean intersections of those caps can fail even for valid closed solids.
function isPlanarRevolution(face){
 if(face.geomType!=='REVOLUTION_SURFACE')return false;
 const owned=[];
 try{
  const surface=face.surface,axis=surface.wrapped.AxeOfRevolution(),direction=axis.Direction(),curve=surface.wrapped.BasisCurve();owned.push(surface,axis,direction,curve);
  const n=new THREE.Vector3(direction.X(),direction.Y(),direction.Z()),oc=R.getOC();
  if(curve.GetType()===oc.GeomAbs_CurveType.GeomAbs_Circle){
   const circle=curve.Circle(),circleAxis=circle.Axis(),d=circleAxis.Direction();owned.push(circle,circleAxis,d);
   return n.cross(new THREE.Vector3(d.X(),d.Y(),d.Z())).length()<1e-10;
  }
  if(curve.GetType()===oc.GeomAbs_CurveType.GeomAbs_Line){
   const a=curve.Value(0),b=curve.Value(1);owned.push(a,b);
   return Math.abs(n.dot(new THREE.Vector3(b.X()-a.X(),b.Y()-a.Y(),b.Z()-a.Z()).normalize()))<1e-10;
  }
  return false;
 }finally{owned.reverse().forEach(item=>item.delete());}
}

export function canonicalRevolvedPlanes(shape){
 const faces=shape.faces,replacements=[];let count=0;
 try{
  for(const original of faces){
   if(!isPlanarRevolution(original)){replacements.push(original.clone());continue;}
   const outer=original.clone().outerWire(),wires=original.wires,builder=new (R.getOC().BRepBuilderAPI_MakeFace)(outer.wrapped,true);let face;
   try{
    for(const wire of wires)if(!wire.isSame(outer))builder.Add(wire.wrapped);
    if(!builder.IsDone())throw Error('回転形状の平面を作成できません');
    face=R.cast(builder.Face());
    const point=original.pointOnSurface(.5,.5),normal=original.normalAt(point.toTuple()),newNormal=face.normalAt(point.toTuple());
    try{if(new THREE.Vector3(...normal.toTuple()).dot(new THREE.Vector3(...newNormal.toTuple()))<0){const reversed=face.flipOrientation();face.delete();face=reversed;}}
    finally{point.delete();normal.delete();newNormal.delete();}
    replacements.push(face);face=null;count++;
   }finally{face?.delete();builder.delete();outer.delete();wires.forEach(wire=>wire.delete());}
  }
  return count?R.makeSolid(replacements):shape.clone();
 }finally{faces.forEach(face=>face.delete());replacements.forEach(face=>face.delete());}
}
