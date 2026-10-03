export const ALL_BODIES_TARGET='__all_bodies__';
export const SELECTED_BODIES_TARGET='__selected_bodies__';
export function allExtrusionTargets(feature){return feature.targetAllBodies===true||(feature.operation==='cut'&&feature.cutAllBodies===true);}
export function multipleExtrusionTargets(feature){return allExtrusionTargets(feature)||Array.isArray(feature.targetBodies);}
export function extrusionTargetEntries(feature,bodies){
 if(allExtrusionTargets(feature))return [...bodies];
 const ids=feature.targetBodies||[feature.target];
 return [...bodies].filter(([id])=>ids.includes(id));
}

// A preceding extrusion in the same command can merge selected body IDs.
export function batchExtrusionFeature(feature,processed){
 if(!feature.targetBodies)return feature;
 const resolve=id=>{for(const previous of processed){const result=previous.cadResult;if(previous.operation==='join'&&result?.remove.includes(id))id=result.outputs[0]?.id||id;}return id;};
 const targetBodies=[...new Set(feature.targetBodies.map(resolve))];
 return {...feature,target:resolve(feature.target),targetBodies};
}
