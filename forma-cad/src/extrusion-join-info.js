import * as R from 'replicad';
import {basisFor} from './frames.js';
import {extrusionTargetEntries} from './extrusion-targets.js';

export function extrusionJoinContacts(feature,tool,bodies){
 const targets=extrusionTargetEntries(feature,bodies),bounds=new Map(),bodyIds=[];
 const boxOf=shape=>{if(!bounds.has(shape)){const box=shape.boundingBox;try{bounds.set(shape,box.bounds.map(p=>[...p]));}finally{box.delete();}}return bounds.get(shape);};
 const touches=(a,b)=>{const x=boxOf(a),y=boxOf(b);return !x[0].some((lo,i)=>lo>y[1][i]+1e-6||x[1][i]<y[0][i]-1e-6)&&R.measureDistanceBetween(a,b)<=1e-6;};
 for(const [id,body]of targets)if(touches(body,tool))bodyIds.push(id);
 const source=feature.region?.cadFace?.bodyId||feature.region?.bodyId||feature.region?.gridSourceBodyId,sourceId=bodies.has(source)?source:source&&bodies.has(feature.target)?feature.target:null,sourceContactIds=[];
 // Persist this opt-in on new commands. Older saved joins must replay with
 // their original scope rather than silently absorbing adjacent bodies.
 if(feature.joinSourceContacts===true&&!feature.barrier&&bodyIds.includes(sourceId)){
  const connected=new Set([sourceId]),queue=[sourceId];
  for(let i=0;i<queue.length;i++)for(const [id,body]of targets)if(!connected.has(id)&&touches(bodies.get(queue[i]),body)){connected.add(id);queue.push(id);if(!bodyIds.includes(id)){bodyIds.push(id);sourceContactIds.push(id);}}
 }
 return {bodyIds,sourceContactIds};
}

// Contact IDs come from the same native test used for the boolean. Tip contacts
// distinguish a destination from an incidental side contact along the sweep.
export function extrusionJoinInfo(feature,tool,bodies,bodyIds,sourceContactIds=[]){
 const sourceId=feature.region?.cadFace?.bodyId||feature.region?.bodyId||feature.region?.gridSourceBodyId||null;
 const direction=basisFor(feature.region||feature).n.multiplyScalar(Math.sign(feature.depth)),faces=bodyIds.length>=2?tool.faces:[],tips=[];
 try{
  let furthest=-Infinity;
  for(const face of faces){
   if(face.geomType!=='PLANE')continue;
   const normal=face.normalAt().toTuple();if(Math.abs(normal.reduce((sum,x,i)=>sum+x*direction.getComponent(i),0))<1-1e-6)continue;
   const box=face.boundingBox;let position;try{position=box.center.reduce((sum,x,i)=>sum+x*direction.getComponent(i),0);}finally{box.delete();}
   if(position>furthest+1e-6){tips.length=0;furthest=position;}if(Math.abs(position-furthest)<1e-6)tips.push(face);
  }
  const candidates=bodyIds.filter(id=>id!==sourceId),endBodyIds=tips.length?candidates.filter(id=>tips.some(face=>R.measureDistanceBetween(face,bodies.get(id))<=1e-6)):[];
  const rank=id=>{const box=bodies.get(id).boundingBox;try{return box.center.reduce((sum,x,i)=>sum+x*direction.getComponent(i),0);}finally{box.delete();}};
  const ranked=candidates.map(id=>({id,position:rank(id)})).sort((a,b)=>b.position-a.position).map(item=>item.id);
  return {bodyIds:[...bodyIds],sourceId,endBodyIds:ranked.filter(id=>endBodyIds.includes(id)),destinationCandidates:ranked,...(sourceContactIds.length?{sourceContactIds:[...sourceContactIds]}:{})};
 }finally{faces.forEach(face=>face.delete());}
}
