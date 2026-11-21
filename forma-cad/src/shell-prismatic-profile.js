import * as R from 'replicad';
import {cutWithClearance} from './cut-clearance.js';
import {MODEL_PRECISION,volumeAllowance} from './model-precision.js';

const {angular,contact,topology,minVolume}=MODEL_PRECISION;
const dot=(a,b)=>a.reduce((sum,value,i)=>sum+value*b[i],0);
function tuple(vector){
 try{return vector.toTuple();}
 finally{vector.delete();}
}
function valid(shape){
 const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);
 try{return check.IsValid();}
 finally{check.delete();}
}
function singleSolid(shape){
 const solids=shape.solids;
 try{return solids.length===1;}
 finally{solids.forEach(solid=>solid.delete());}
}

function prismDepth(base,opening,second,inward,volume){
 const faces=base.faces;
 let opposite,sideTilt=0;
 try{
  for(const face of faces){
   if(face.isSame(opening))continue;
   if(face.geomType!=='PLANE')return null;
   const alignment=dot(tuple(face.normalAt()),inward);
   if(Math.abs(alignment)<=angular){sideTilt=Math.max(sideTilt,Math.abs(alignment));continue;}
   if(opposite||alignment<1-angular)return null;
   opposite=face;
  }
  if(!opposite||second&&!opposite.isSame(second))return null;
  const origin=tuple(opening.center),end=tuple(opposite.center);
  const depth=dot(end.map((value,i)=>value-origin[i]),inward),area=R.measureArea(opening);
  if(!(depth>topology)||sideTilt*depth>contact||
   Math.abs(R.measureArea(opposite)-area)*depth>volumeAllowance(volume)||
   Math.abs(area*depth-volume)>volumeAllowance(volume))return null;
  return depth;
 }finally{faces.forEach(face=>face.delete());}
}

function insetProfile(opening,thickness){
 const holes=opening.clone().innerWires();
 try{if(holes.length)return null;}
 finally{holes.forEach(wire=>wire.delete());}
 const outer=opening.clone().outerWire(),oc=R.getOC();
 let offset,inset,profile;
 try{
  offset=new oc.BRepOffsetAPI_MakeOffset(opening.wrapped,oc.GeomAbs_JoinType.GeomAbs_Arc,false);
  offset.Perform(-thickness,0);
  if(!offset.IsDone())return null;
  inset=R.cast(offset.Shape());
  if(!(inset instanceof R.Wire)||
   !(Math.abs(R.measureDistanceBetween(outer,inset)-thickness)<=contact))return null;
  profile=R.makeFace(inset);
  const area=R.measureArea(profile);
  if(!valid(profile)||!(area>minVolume&&area<R.measureArea(opening)))return null;
  const result={profile,area};profile=null;return result;
 }finally{profile?.delete();inset?.delete();offset?.delete();outer.delete();}
}

function extrude(profile,axis,depth){
 const direction=new R.Vector(axis.map(value=>value*depth));
 let shape;
 try{
  shape=R.basicFaceExtrusion(profile,direction);
  if(R.measureVolume(shape)<0)shape.wrapped.Reverse();
  const result=shape;shape=null;return result;
 }finally{shape?.delete();direction.delete();}
}

// Faceted extrusions can defeat the 3D shell offset. For an untapered prism,
// inset the native cap and cut a cavity perpendicular to it.
export function shellPrismaticProfile(base,openings,thickness,original,onRemoved){
 const [opening,second]=openings;
 if(openings.length>2||opening?.geomType!=='PLANE'||!singleSolid(base))return null;
 const inward=tuple(opening.normalAt()).map(value=>-value);
 const depth=prismDepth(base,opening,second,inward,original);
 if(depth===null)return null;
 const cavityDepth=depth-(second?0:thickness);
 if(cavityDepth<=topology)return null;
 const inset=insetProfile(opening,thickness);
 if(!inset)return null;
 const {profile,area}=inset,lead=Math.min(thickness,1);
 let start,tool,result,removed;
 try{
  start=profile.clone().translate(inward.map(value=>-lead*value));
  tool=extrude(start,inward,cavityDepth+(second?2:1)*lead);
  result=cutWithClearance(base,[tool]);
  const volume=R.measureVolume(result);
  if(!singleSolid(result)||!(volume>minVolume)||
   Math.abs(original-volume-area*cavityDepth)>volumeAllowance(original))return null;
  if(onRemoved){
   removed=extrude(profile,inward,cavityDepth);
   onRemoved(removed);
  }
  const shape=result;result=null;return shape;
 }finally{removed?.delete();result?.delete();tool?.delete();start?.delete();profile.delete();}
}
