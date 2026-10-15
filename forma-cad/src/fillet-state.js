export function filletBodyTargets(spec){
 if(spec?.type!=='fillet')return [];
 return [...new Set(spec.edges?.length?spec.edges.map(edge=>edge.bodyId):[spec.target])].filter(id=>typeof id==='string'&&id);
}
export function isFilletBodySuppressed(spec,bodyId){
 return spec?.type==='fillet'&&(spec.suppressed===true||Array.isArray(spec.suppressedTargets)&&spec.suppressedTargets.includes(bodyId));
}
export function filletSuppressionState(spec){
 const targets=filletBodyTargets(spec),count=targets.filter(id=>isFilletBodySuppressed(spec,id)).length;
 return spec?.suppressed===true||targets.length&&count===targets.length?'suppressed':count?'partial':'active';
}
export function setFilletBodySuppressed(spec,bodyId,value=true){
 const targets=filletBodyTargets(spec),suppressed=targets.filter(id=>id===bodyId?value:isFilletBodySuppressed(spec,id)),next={...spec};
 if(suppressed.length===targets.length){next.suppressed=true;delete next.suppressedTargets;}
 else{delete next.suppressed;if(suppressed.length)next.suppressedTargets=suppressed;else delete next.suppressedTargets;}
 return next;
}
