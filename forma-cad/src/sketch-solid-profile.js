import * as R from 'replicad';
import {partitionSection,validateExtrusionOverlap} from './extrusion-overlap.js';

// Resolve the same selected sketch patch for every profile-based command.
// Display polygons are only for picking; the CAD face keeps native arcs/holes.
export function selectedProfileFaces(region,bodies,makeFace){
 if(!region.overlapSource)return [makeFace(region)];
 validateExtrusionOverlap({overlapOnly:true,mode:'solid',region,overlapTargets:region.overlapTargets});
 const targets=region.overlapTargets.map(id=>bodies?.get(id));
 if(targets.some(body=>!body))throw Error('輪郭の参照先ボディが見つかりません。領域を選び直してください');
 const source=makeFace(region.overlapSource),point=region.overlapPoint?R.makeVertex(region.overlapPoint):null,faces=[];
 try{
  {
   const section=partitionSection(source,targets,region.partitionSide==='outside');
   if(!section)throw Error('選択した領域がなくなりました。領域を選び直してください');
   const patches=section.faces;
   try{for(const patch of patches)if(R.measureArea(patch)>1e-7&&(!point||R.measureDistanceBetween(patch,point)<=1e-4))faces.push(patch.clone());}
   finally{patches.forEach(face=>face.delete());section.delete();}
  }
  if(!faces.length)throw Error(region.partitionSide==='outside'?'選択した外側の領域がなくなりました。領域を選び直してください':'選択した領域とソリッドが重なっていません。領域を選び直してください');
  return faces;
 }catch(error){faces.forEach(face=>face.delete());throw error;}
 finally{point?.delete();source.delete();}
}
