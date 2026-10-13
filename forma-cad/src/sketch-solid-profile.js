import * as R from 'replicad';
import {commonSection,validateExtrusionOverlap} from './extrusion-overlap.js';

// Resolve the same selected sketch patch for every profile-based command.
// Display polygons are only for picking; the CAD face keeps native arcs/holes.
export function selectedProfileFaces(region,bodies,makeFace){
 if(!region.overlapSource)return [makeFace(region)];
 validateExtrusionOverlap({overlapOnly:true,mode:'solid',region,overlapTargets:region.overlapTargets});
 const targets=region.overlapTargets.map(id=>bodies?.get(id));
 if(targets.some(body=>!body))throw Error('輪郭の参照先ボディが見つかりません。領域を選び直してください');
 const source=makeFace(region.overlapSource),point=region.overlapPoint?R.makeVertex(region.overlapPoint):null,faces=[];
 try{
  for(const body of targets){
   const section=commonSection(source,body);if(!section)continue;
   const patches=section.faces;
   try{for(const patch of patches)if(R.measureArea(patch)>1e-7&&(!point||R.measureDistanceBetween(patch,point)<=1e-4))faces.push(patch.clone());}
   finally{patches.forEach(face=>face.delete());section.delete();}
  }
  if(!faces.length)throw Error('選択した領域とソリッドが重なっていません。領域を選び直してください');
  return faces;
 }catch(error){faces.forEach(face=>face.delete());throw error;}
 finally{point?.delete();source.delete();}
}
