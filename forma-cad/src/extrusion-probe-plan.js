import {extrusionProbeBodies} from './extrusion-mesh-probe.js';
// Keep exact current bodies and only the sketches used by this profile. Photos,
// display triangles and superseded CAD history are not needed by a probe.
export function extrusionProbePlan(model,meshes,request){
 const visible=[...meshes].filter(([,m])=>m.visible).map(([id])=>id),latest=new Map();
 for(const f of model){const r=f.cadResult||(f.kind==='cadop'?f:null);if(!r)continue;for(const id of r.remove||[])latest.delete(id);for(const o of r.outputs||[])latest.set(o.id,o);}
 if(visible.every(id=>latest.get(id)?.brep)){
  const ids=new Set((request.features||[request.feature]).flatMap(f=>f.region?.sourceIds||f.sourceSketchIds||[])),sketches=model.filter(f=>f.kind==='sketch'&&ids.has(f.id)),outputs=visible.map(id=>({id,brep:latest.get(id).brep}));
  return {history:[...sketches,{kind:'cadop',id:'probe-bodies',outputs,remove:[]}],spec:{...request,type:'nativeExtrusionProbe'}};
 }
 return {history:[],spec:{...request,type:'meshExtrusionProbe',bodies:extrusionProbeBodies(meshes)}};
}
