import {basisFor} from './frames.js';
import {extrusionIntersections} from './extrusion-auto-cut.js';

// Reverse the extrusion frame without moving its footprint. Stored sketches
// retain their original axes; only the new extrusion uses the outward frame.
export function reverseExtrusionFrame(feature){
 const b=basisFor(feature),frame={u:b.u.toArray(),v:b.v.negate().toArray(),n:b.n.negate().toArray()};
 const next={...feature,plane:'CUSTOM',frame,angle:-(feature.angle||0)};
 if(feature.region){
  const ring=points=>points.map(([u,v])=>[u,-v]).reverse();
  next.region={...feature.region,plane:'CUSTOM',frame,offset:-feature.region.offset,outer:ring(feature.region.outer),holes:feature.region.holes.map(ring)};
 }
 if(feature.profile==='line')next.side=feature.side==='inside'?'outside':feature.side==='outside'?'inside':feature.side;
 return next;
}

export function outwardExtrusion(feature,bodies){
 if(feature.operation==='cut'||!bodies.size)return feature;
 const probe={...feature,depth:Math.max(.1,Math.abs(feature.depth)),taperAngle:0};
 try{
  const forward=extrusionIntersections(probe,bodies);
  if(!forward.length)return feature;
  // If both sides enter solids there is no unambiguous outward direction.
  if(extrusionIntersections({...probe,depth:-probe.depth},bodies).length)return feature;
  return reverseExtrusionFrame(feature);
 }catch{return feature;}
}
