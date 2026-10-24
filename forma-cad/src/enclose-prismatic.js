import * as R from 'replicad';
import {selectedCadFaces} from './face-pull.js';
import {cadMesh} from './cad-mesh.js';
import {solidMeshComplete} from './solid-mesh.js';
const tuple=v=>{try{return v.toTuple();}finally{v.delete();}};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),add=(a,b,d=1)=>a.map((v,i)=>v+b[i]*d);
const volume=s=>s?Math.abs(R.measureVolume(s)):0;
function extrude(face,n,length,shift=0){const v=new R.Vector(n.map(x=>x*length));let prism;try{prism=R.basicFaceExtrusion(face,v);return shift?prism.translate(n.map(x=>x*shift)):prism.clone();}finally{prism?.delete();v.delete();}}
function planeAt(point,n){const x=Math.abs(n[0])<.9?[1,0,0]:[0,1,0];return new R.Plane(point,x.map((v,i)=>v-n[i]*dot(x,n)),n);}
function offsetProfile(face,distance,rounded){
 if(!distance)return face.clone();const wire=face.clone().outerWire(),area=R.measureArea(face);
 try{for(const sign of [1,-1]){let offset,profile;try{offset=wire.clone().offset2D(sign*distance,rounded?'arc':'intersection');profile=R.makeFace(offset.clone());if(R.measureArea(profile)>area+1e-6){const answer=profile;profile=null;return answer;}}catch{}finally{profile?.delete();offset?.delete();}}}finally{wire.delete();}
 throw Error('断面のオフセットを作成できません');
}
function closedOffset(face,n,height,distance,rounded){
 let profile,prism;const planes=[];
 try{
  profile=offsetProfile(face,distance,rounded);prism=extrude(profile,n,height+2*distance,-distance);
  if(rounded&&distance){const origin=tuple(face.center);planes.push(planeAt(add(origin,n,-distance),n),planeAt(add(origin,n,height+distance),n));const filleted=prism.clone().fillet(distance,filter=>filter.either(planes.map(plane=>finder=>finder.inPlane(plane))));prism.delete();prism=filleted;}
  const answer=prism;prism=null;return answer;
 }finally{prism?.delete();profile?.delete();planes.forEach(p=>p.delete());}
}
// Only use the section route if an exact extrusion reproduces the whole source.
// No polygon fitting, arc guessing, changed wall thickness or relaxed tolerance.
export function prismaticEnclosure(base,thickness,{clearance=0,faces=[],roundedCorners=true}={}){
 let source,profile,outer,inner,result;const openings=[],owned=[];
 try{
  source=R.deserializeShape(base.serialize()).asShape3D();const solids=source.solids;try{if(solids.length!==1)return null;}finally{solids.forEach(s=>s.delete());}
  const all=source.faces;owned.push(...all);if(all.length>80)return null;
  const sourceVolume=volume(source),eps=Math.max(1e-6,sourceVolume*1e-8),planes=all.filter(f=>f.geomType==='PLANE');let n,height;
  scan:for(const a of planes){const holes=a.clone().innerWires();const hasHoles=holes.length>0;holes.forEach(w=>w.delete());if(hasHoles)continue;const outward=tuple(a.normalAt()),axis=outward.map(v=>-v),origin=tuple(a.center),area=R.measureArea(a);
   for(const b of planes){if(a===b||dot(outward,tuple(b.normalAt()))>-.999999||Math.abs(R.measureArea(b)-area)>Math.max(1e-6,area*1e-8))continue;const length=dot(add(tuple(b.center),origin,-1),axis);if(length<1e-6||Math.abs(area*length-sourceVolume)>eps)continue;
    let candidate,missing,extra;try{candidate=extrude(a,axis,length);missing=source.cut(candidate);extra=candidate.cut(source);if(volume(missing)<=eps&&volume(extra)<=eps){profile=a;n=axis;height=length;break scan;}}finally{extra?.delete();missing?.delete();candidate?.delete();}
   }
  }
  if(!profile)return null;
  if(faces.length){openings.push(...selectedCadFaces(source,faces));if(openings.some(f=>f.geomType!=='PLANE'))return null;}
  outer=closedOffset(profile,n,height,clearance+thickness,roundedCorners);inner=closedOffset(profile,n,height,clearance,roundedCorners);
  for(const face of openings){const normal=tuple(face.normalAt()),plane=planeAt(tuple(face.center),normal);let check,split;
   try{check=source.split(plane,0,1e-7);if(volume(check.positive)>eps)return null;split=outer.split(plane,0,1e-7);if(!split.negative)return null;outer.delete();outer=split.negative;split.negative=null;}
   finally{check?.positive?.delete();check?.negative?.delete();split?.positive?.delete();split?.negative?.delete();plane.delete();}
  }
  result=outer.cut(inner);const analyzer=new (R.getOC().BRepCheck_Analyzer)(result.wrapped,true,false);try{if(!analyzer.IsValid()||volume(result)<=eps||!solidMeshComplete(result,cadMesh(result)))return null;}finally{analyzer.delete();}
  const overlap=result.intersect(inner);try{if(volume(overlap)>eps)return null;}finally{overlap.delete();}
  if(!faces.length){const missing=inner.cut(outer);try{if(volume(missing)>eps||Math.abs(volume(result)-(volume(outer)-volume(inner)))>eps)return null;}finally{missing.delete();}}
  const answer=result;result=null;return answer;
 }finally{result?.delete();inner?.delete();outer?.delete();openings.forEach(f=>f.delete());owned.forEach(f=>f.delete());source?.delete();}
}
