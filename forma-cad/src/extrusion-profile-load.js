import {nativeSketchRegion,nativeRingSegments} from './native-sketch-arcs.js';
import {circularRing} from './circular-ring.js';
import {ellipticalRing} from './elliptical-ring.js';
export function extrusionProfileLoad(regions,features=[]){
 return regions.map((region,index)=>{const native=nativeSketchRegion(region,features),rings=[region.outer,...region.holes];let points=0,edges=0,curves=0;
  for(const ring of rings){points+=ring.length;if(circularRing(ring)||ellipticalRing(ring)){edges++;curves++;}else{const segments=nativeRingSegments(ring,native._nativeArcSources);edges+=segments.length;curves+=segments.filter(s=>s.via).length;}}
  const level=edges>=200?'high':edges>=80?'medium':'low';return {id:region.id,index,points,edges,curves,level,sourceIds:[...region.sourceIds||[]],canOrganize:level!=='low'&&!!region.sourceIds?.length&&!region.cadFace&&!region.bodyId};
 });
}
