export const ALL_BODIES_TARGET='__all_bodies__';
export function allExtrusionTargets(feature){return feature.targetAllBodies===true||(feature.operation==='cut'&&feature.cutAllBodies===true);}
