import * as R from 'replicad';
import {cadMesh} from './cad-mesh.js';
import {cutWithClearance} from './cut-clearance.js';
import {STL_MESH} from './mesh-quality.js';
import {MODEL_PRECISION,volumeAllowance} from './model-precision.js';
import {solidMeshComplete} from './solid-mesh.js';

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
function solidCount(shape){
 const solids=shape.solids;
 try{return solids.length;}
 finally{solids.forEach(solid=>solid.delete());}
}

function cylinderTilt(face,inward){
 const surface=face.surface,cylinder=surface.wrapped.Cylinder(),axis=cylinder.Axis(),dir=axis.Direction();
 try{
  const direction=[dir.X(),dir.Y(),dir.Z()],sign=dot(direction,inward)<0?-1:1;
  return Math.hypot(...direction.map((n,i)=>n-sign*inward[i]));
 }finally{dir.delete();axis.delete();cylinder.delete();surface.delete();}
}

function prismDepth(base,opening,second,inward,volume){
 const faces=base.faces;
 let opposite,sideTilt=0;
 try{
  for(const face of faces){
   if(face.isSame(opening))continue;
   if(face.geomType==='CYLINDRE'){
    const tilt=cylinderTilt(face,inward);
    if(tilt>angular)return null;
    sideTilt=Math.max(sideTilt,tilt);
    continue;
   }
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

function sectionBounds(shape){
 const box=shape.boundingBox;
 try{return box.bounds;}
 finally{box.delete();}
}

function containsSectionBounds(outer,inner){
 return inner.every((point,i)=>point.every((value,j)=>i?value<=outer[i][j]+contact:value>=outer[i][j]-contact));
}

function sectionsOverlap(a,b){
 return a[0].every((lo,i)=>lo<=b[1][i]+contact&&b[0][i]<=a[1][i]+contact);
}

function faceWithVoids(ring,holes){
 if(!holes.length)return ring.face.clone();
 const area=ring.area-holes.reduce((sum,hole)=>sum+hole.area,0);
 if(!(area>minVolume))return null;
 let face=R.addHolesInFace(ring.face,holes.map(hole=>hole.wire));
 try{
  if(!valid(face)||Math.abs(R.measureArea(face)-area)>Math.max(topology,area*MODEL_PRECISION.relativeVolume))return null;
  const result=face;face=null;return result;
 }finally{face?.delete();}
}

// Native offset wires can bound independent pockets, or they can be nested
// around a through-hole. Assign each wire to its smallest enclosing section.
function sectionFaces(wires){
 const rings=[];
 let profiles=[];
 try{
  for(const wire of wires){
   const face=R.makeFace(wire),ring={wire,face,area:0,box:null,parent:null,depth:0};
   rings.push(ring);
   ring.area=R.measureArea(face);ring.box=sectionBounds(face);
   if(!valid(face)||!(ring.area>minVolume))return null;
  }
  rings.sort((a,b)=>b.area-a.area);
  for(const [i,ring] of rings.entries()){
   const point=R.makeVertex(tuple(ring.wire.startPoint));
   try{
    for(let j=i-1;j>=0;j--){
     const candidate=rings[j];
     if(!sectionsOverlap(candidate.box,ring.box))continue;
     if(R.measureDistanceBetween(candidate.wire,ring.wire)<=topology)return null;
     if(!ring.parent&&containsSectionBounds(candidate.box,ring.box)&&R.measureDistanceBetween(point,candidate.face)<=contact){
      ring.parent=candidate;ring.depth=candidate.depth+1;
     }
    }
   }finally{point.delete();}
  }
  for(const ring of rings){
   if(ring.depth%2)continue;
   const profile=faceWithVoids(ring,rings.filter(hole=>hole.parent===ring));
   if(!profile)return null;
   profiles.push(profile);
  }
  const result=profiles;profiles=[];return result;
 }finally{profiles.forEach(face=>face.delete());rings.forEach(ring=>ring.face.delete());}
}

function insetProfile(opening,thickness){
 const border=R.makeCompound(opening.wires),oc=R.getOC();
 let offset,inset,wires=[],profiles;
 try{
  offset=new oc.BRepOffsetAPI_MakeOffset(opening.wrapped,oc.GeomAbs_JoinType.GeomAbs_Arc,false);
  offset.Perform(-thickness,0);
  if(!offset.IsDone())return null;
  inset=R.cast(offset.Shape());
  wires=inset instanceof R.Wire?[inset.clone()]:inset.wires;
  if(!wires.length)return null;
  for(const wire of wires){
   if(!(Math.abs(R.measureDistanceBetween(border,wire)-thickness)<=contact))return null;
   const point=R.makeVertex(tuple(wire.startPoint));
   try{if(R.measureDistanceBetween(point,opening)>contact)return null;}
   finally{point.delete();}
  }
  profiles=sectionFaces(wires);
  if(!profiles)return null;
  const area=profiles.reduce((sum,face)=>sum+R.measureArea(face),0);
  if(!(area>minVolume&&area<R.measureArea(opening)))return null;
  const result={profiles,area};profiles=null;return result;
 }finally{profiles?.forEach(face=>face.delete());wires.forEach(wire=>wire.delete());inset?.delete();offset?.delete();border.delete();}
}

// A cavity that spans the full depth is a 2D subtraction. The original cap
// wires and the cavity wires all remain boundaries, and alternating nested
// sections retain the outside wall and any independent bore walls.
function throughShell(opening,profiles,inward,depth){
 const wires=opening.wires,parts=[];
 let material;
 try{
  for(const profile of profiles)wires.push(...profile.wires);
  material=sectionFaces(wires);
  if(!material)return null;
  for(const section of material)parts.push(extrude(section,inward,depth));
  if(parts.length===1)return parts.pop();
  return R.makeCompound(parts.splice(0)).asShape3D();
 }finally{parts.forEach(part=>part.delete());material?.forEach(face=>face.delete());wires.forEach(wire=>wire.delete());}
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
 if(openings.length>2||opening?.geomType!=='PLANE'||solidCount(base)!==1)return null;
 const inward=tuple(opening.normalAt()).map(value=>-value);
 const depth=prismDepth(base,opening,second,inward,original);
 if(depth===null)return null;
 const cavityDepth=depth-(second?0:thickness);
 if(cavityDepth<=topology)return null;
 const inset=insetProfile(opening,thickness);
 if(!inset)return null;
 const {profiles,area}=inset,lead=Math.min(thickness,1),tools=[],removed=[];
 let result,combined;
 try{
  if(second){
   result=throughShell(opening,profiles,inward,depth);
   if(!result)return null;
   const before=sectionBounds(base),after=sectionBounds(result);
   if(!containsSectionBounds(before,after)||!containsSectionBounds(after,before))return null;
   if(!solidMeshComplete(result,cadMesh(result,STL_MESH)))return null;
  }else{
   for(const profile of profiles){
    const start=profile.clone().translate(inward.map(value=>-lead*value));
    try{tools.push(extrude(start,inward,cavityDepth+lead));}
    finally{start.delete();}
   }
   result=cutWithClearance(base,tools);
  }
  const volume=R.measureVolume(result);
  const count=solidCount(result);
  if(count<1||!second&&count!==1||!(volume>minVolume)||
   Math.abs(original-volume-area*cavityDepth)>volumeAllowance(original))return null;
  // A through-shell can leave a detached bore wall. The regular geometry
  // inspection reports the resulting solid count for that body.
  if(onRemoved){
   try{
    for(const profile of profiles)removed.push(extrude(profile,inward,cavityDepth));
    if(removed.length>1)combined=R.makeCompound(removed.splice(0));
    onRemoved(combined??removed[0]);
   }catch(error){
    if(error instanceof WebAssembly.RuntimeError)throw error;
    // Let the normal preview path try to color the already checked result.
   }
  }
  const shape=result;result=null;return shape;
 }finally{
  combined?.delete();removed.forEach(shape=>shape.delete());result?.delete();
  tools.forEach(tool=>tool.delete());profiles.forEach(profile=>profile.delete());
 }
}
