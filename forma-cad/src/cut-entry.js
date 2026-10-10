import * as R from 'replicad';
import * as THREE from 'three';
import {basisFor,worldPoint} from './frames.js';

// Sketch coordinates come from Float32 display meshes. A cut starting a fraction
// inside the exact CAD face can leave a closed, almost zero-thickness roof.
// Extend only an inward, surface-starting tool backwards; keep its far end and
// taper unchanged by adding a short prism of the actual entry cap.
export function cutEntryTool(tool,feature,targets){
 if(feature.operation!=='cut'||feature.hole||!targets.length)return tool;
 const profile=feature.region||feature,direction=basisFor(profile).n.multiplyScalar(Math.sign(feature.depth));
 const origin=feature.region?worldPoint(profile,profile.outer[0]):new THREE.Vector3(feature.x,feature.y,feature.z);
 const tolerance=1e-4,margin=.001;
 const matchingFace=(face,entry=false)=>{
  if(face.geomType!=='PLANE')return false;
  const center=face.center,normal=face.normalAt();
  try{
   const n=new THREE.Vector3(...normal.toTuple()).normalize();
   return (entry?Math.abs(n.dot(direction))>.999999:n.dot(direction)<-.999999)&&
    Math.abs(new THREE.Vector3(...center.toTuple()).sub(origin).dot(direction))<tolerance;
  }finally{center.delete();normal.delete();}
 };
 const caps=[],extensions=[];let result;
 try{
  const onSurface=targets.some(body=>{
   const faces=body.faces;
   try{return faces.some(face=>matchingFace(face));}
   finally{for(const face of faces)face.delete();}
  });
  if(!onSurface)return tool;
  caps.push(...tool.faces);
  for(const cap of caps){
   if(!matchingFace(cap,true))continue;
   const vector=new R.Vector(direction.clone().multiplyScalar(-margin).toArray());
   try{extensions.push(R.basicFaceExtrusion(cap,vector));}
   finally{vector.delete();}
  }
  if(!extensions.length)return tool;
  result=tool.clone();
  for(const extension of extensions){const next=result.fuse(extension);result.delete();result=next;}
  tool.delete();return result;
 }catch(error){result?.delete();tool.delete();throw error;}
 finally{for(const cap of caps)cap.delete();for(const extension of extensions)extension.delete();}
}

