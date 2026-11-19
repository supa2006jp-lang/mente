import {meshCsgBrush,meshCsgData} from './mesh-csg-data.js';
import {extrusionCutMatches} from './extrusion-auto-cut.js';
import {outwardExtrusion} from './extrusion-direction.js';
// Only the mesh positions and their world transforms are needed for the
// automatic operation decision. Photos and CAD history never cross this path.
export function extrusionProbeBodies(meshes){return [...meshes].filter(([,m])=>m.visible).map(([id,m])=>({id,...meshCsgData(m)}));}
export function meshExtrusionProbe(spec){
 const bodies=new Map();
 try{
  for(const value of spec.bodies)bodies.set(value.id,meshCsgBrush(value));
  return spec.direction?{features:spec.features.map(f=>outwardExtrusion(f,bodies))}:{matches:extrusionCutMatches(spec.feature,bodies,spec.source)};
 }finally{for(const m of bodies.values()){m.geometry.dispose();m.material.dispose();}}
}
