// Extrusions rebuild native bodies from BREP. Keep their exact geometry and
// provenance, including nested thread sources, but omit render-only arrays.
const renderFields=new Set(['vertices','triangles','normals','faceGroups','planarFaces','cadCoordinatePrecision','colors','vertexColors']);
export function compactKernelData(value,seen=new WeakMap()){
 if(!value||typeof value!=='object'||ArrayBuffer.isView(value))return value;
 if(seen.has(value))return seen.get(value);
 const next=Array.isArray(value)?[]:{};seen.set(value,next);
 if(Array.isArray(value)){for(const item of value)next.push(compactKernelData(item,seen));return next;}
 const exact=typeof value.brep==='string'&&value.brep.length>0,result=Array.isArray(value.outputs)&&Array.isArray(value.remove);
 for(const [key,item] of Object.entries(value)){
  if(exact&&renderFields.has(key)||result&&['removed','previewWarnings'].includes(key))continue;
  next[key]=compactKernelData(item,seen);
 }
 return next;
}
export function compactExtrusionRequest(features,spec){
 const operation=spec?.type==='preview'?spec.operation:spec;
 if(!['barrierPreparedPreview','extrusionToolPreview','extrusionJoinInspect','extrusionBatch','extrusion'].includes(operation?.type))return {features,spec};
 return compactKernelData({features,spec});
}
