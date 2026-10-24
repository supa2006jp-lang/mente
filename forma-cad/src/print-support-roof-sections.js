import {measureVolume as partVolume} from 'replicad';
const rounded=n=>Number(n.toFixed(6));
export function roofSectionDescriptor(part,records,p,top){
 const box=part.boundingBox;let bounds;try{bounds=box.bounds.map(a=>[...a]);}finally{box.delete();}
 const axis=records[0].axis,other=1-axis,low=bounds[0][other]+2.3,high=bounds[1][other]-2.3;
 // A reference fingerprint, not a coordinate tolerance for changing geometry.
 // Upstream changes that alter a section invalidate its manual placement.
 const id=JSON.stringify([axis,rounded(top+p.topGap),...bounds.flatMap(a=>a.slice(0,2).map(rounded)),rounded(Math.abs(partVolume(part))/(p.roofLayers*p.layerHeight))]);
 return {id,axis,bounds,limits:[low,high],sides:[records[0].center-p.wallThickness/2,records.at(-1).center+p.wallThickness/2],top};
}
