import * as R from 'replicad';
import {Vector3} from 'three';
import {cutWithClearance,enlargeForClearance} from './cut-clearance.js';
import {MODEL_PRECISION,volumeAllowance} from './model-precision.js';
import {containsExactly} from './solid-contained-union.js';
import {solidMeshComplete} from './solid-mesh.js';

function vectorAndDelete(vector){
 try{return new Vector3(...vector.toTuple());}
 finally{vector.delete();}
}

function sweep(profile,axis,depth){
 const direction=new R.Vector(axis.clone().multiplyScalar(depth).toArray());
 try{return R.basicFaceExtrusion(profile,direction);}
 finally{direction.delete();}
}

function isSingleSolid(shape){
 const solids=shape.solids;
 try{return solids.length===1;}
 finally{solids.forEach(solid=>solid.delete());}
}

function shellAtShoulder(source,shoulder,center,axis,step,thickness,openingArea,sourceVolume){
 const rims=shoulder.clone().innerWires();
 let profile,plane,above,boss,stock,envelope,passage,result;
 try{
  if(rims.length!==1)return null;
  profile=R.makeFace(rims[0]);
  const area=R.measureArea(profile);
  if(Math.abs(area-openingArea)>Math.max(MODEL_PRECISION.contact**2,area*MODEL_PRECISION.relativeVolume))return null;
  plane=new R.Plane(center.toArray(),null,axis.toArray());
  above=source.cutPlane(plane,0,'positive');
  if(!(above instanceof R.Solid))return null;

  // The whole region above the shoulder must be a straight sweep of its
  // inner rim. Prove both directions of containment, including thin details.
  boss=sweep(profile,axis,step);
  const bossVolume=area*step;
  if(!containsExactly(above,boss,bossVolume)||!containsExactly(boss,above,bossVolume))return null;
  stock=source.cutPlane(plane,0,'negative');
  if(!(stock instanceof R.Solid))return null;

  // The shoulder offsets past the cap. Keep its exact outward offset and
  // extend the original aperture through it using the same native profile.
  envelope=enlargeForClearance(stock,thickness);
  if(!containsExactly(envelope,source,sourceVolume))return null;
  passage=sweep(profile,axis,thickness+step);
  result=cutWithClearance(envelope,[source,passage]);
  const envelopeVolume=R.measureVolume(envelope),shellVolume=R.measureVolume(result);
  const expected=envelopeVolume-sourceVolume-area*(thickness-step);
  if(!(shellVolume>MODEL_PRECISION.minVolume&&Math.abs(shellVolume-expected)<=volumeAllowance(envelopeVolume))||
     !isSingleSolid(result)||!solidMeshComplete(result))return null;
  const shape=result;result=null;
  return shape;
 }finally{
  result?.delete();passage?.delete();envelope?.delete();stock?.delete();boss?.delete();above?.delete();
  plane?.delete();profile?.delete();rims.forEach(rim=>rim.delete());
 }
}

export function shellSteppedExterior(base,opening,thickness,sourceVolume){
 if(opening.geomType!=='PLANE'||!isSingleSolid(base))return null;
 const openingRims=opening.clone().innerWires();
 try{if(openingRims.length)return null;}
 finally{openingRims.forEach(rim=>rim.delete());}
 const axis=vectorAndDelete(opening.normalAt()).normalize(),openingCenter=vectorAndDelete(opening.center);
 const openingArea=R.measureArea(opening);
 // Boolean plane cuts can update shared topology. Isolate them from the
 // original body and from the stored selection used for history replay.
 const source=R.deserializeShape(base.serialize()).asShape3D(),faces=source.faces;
 try{
  for(const shoulder of faces){
   if(shoulder.geomType!=='PLANE')continue;
   const center=vectorAndDelete(shoulder.center),step=openingCenter.clone().sub(center).dot(axis);
   const extension=thickness-step;
   if(step<=MODEL_PRECISION.contact||extension<=MODEL_PRECISION.contact)continue;
   if(vectorAndDelete(shoulder.normalAt()).normalize().distanceTo(axis)>MODEL_PRECISION.angular)continue;
   const shape=shellAtShoulder(source,shoulder,center,axis,step,thickness,openingArea,sourceVolume);
   if(shape)return {shape,extension};
  }
  return null;
 }finally{faces.forEach(face=>face.delete());source.delete();}
}
