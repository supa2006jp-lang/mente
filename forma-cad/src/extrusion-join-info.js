import * as R from 'replicad';
import {basisFor} from './frames.js';

// Contact IDs come from the same native test used for the boolean. Tip contacts
// distinguish a destination from an incidental side contact along the sweep.
export function extrusionJoinInfo(feature,tool,bodies,bodyIds){
 const sourceId=feature.region?.cadFace?.bodyId||feature.region?.bodyId||feature.region?.gridSourceBodyId||null;
 const direction=basisFor(feature.region||feature).n.multiplyScalar(Math.sign(feature.depth)),faces=bodyIds.length>=3?tool.faces:[],tips=[];
 try{
  let furthest=-Infinity;
  if(bodyIds.length>=3)for(const face of faces){
   if(face.geomType!=='PLANE')continue;
   const normal=face.normalAt().toTuple();if(Math.abs(normal.reduce((sum,x,i)=>sum+x*direction.getComponent(i),0))<1-1e-6)continue;
   const box=face.boundingBox;let position;try{position=box.center.reduce((sum,x,i)=>sum+x*direction.getComponent(i),0);}finally{box.delete();}
   if(position>furthest+1e-6){tips.length=0;furthest=position;}if(Math.abs(position-furthest)<1e-6)tips.push(face);
  }
  const candidates=bodyIds.filter(id=>id!==sourceId),endBodyIds=tips.length?candidates.filter(id=>tips.some(face=>R.measureDistanceBetween(face,bodies.get(id))<=1e-6)):[];
  const rank=id=>{const box=bodies.get(id).boundingBox;try{return box.center.reduce((sum,x,i)=>sum+x*direction.getComponent(i),0);}finally{box.delete();}};
  const ranked=candidates.map(id=>({id,position:rank(id)})).sort((a,b)=>b.position-a.position).map(item=>item.id);
  return {bodyIds:[...bodyIds],sourceId,endBodyIds:ranked.filter(id=>endBodyIds.includes(id)),destinationCandidates:ranked};
 }finally{faces.forEach(face=>face.delete());}
}
