export function edgeTreatmentBodyIds({bodyIds=[],faces=[]}={}){
 return [...new Set([...bodyIds,...faces.map(face=>face.bodyId)])].filter(id=>typeof id==='string'&&id);
}
// A range can contain every face of several bodies while bodyIds is empty.
// Both preview and commit must resolve that selection to the same body list.
export function edgeTreatmentSpec(spec,{bodyIds=[],faces=[],edges=[],face=null,allBodies=false}={}){
 const next={...spec};for(const key of ['targets','edges','face','edgePoint'])delete next[key];
 if(edges.length){next.target=edges[0].bodyId;next.edges=structuredClone(edges);return next;}
 const ids=edgeTreatmentBodyIds({bodyIds,faces});
 if(allBodies&&ids.length>1){next.targets=ids;if(!ids.includes(next.target))next.target=ids[0];}
 else if(face)next.face=structuredClone(face);
 return next;
}
