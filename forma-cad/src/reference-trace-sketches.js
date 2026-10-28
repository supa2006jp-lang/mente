import {defaults,validateFeature} from './geometry.js';
import {basisFor} from './frames.js';

export function referenceTraceSketches(reference,result,rings,groupNumber){
 const b=basisFor(reference),frame={u:b.u.toArray(),v:b.v.toArray(),n:b.n.toArray()},origin=b.n.multiplyScalar(reference.offset),a=reference.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),groupId=crypto.randomUUID();
 return rings.flatMap((ring,i)=>{
  let pieces=[{points:ring.points,closed:true}];
  if(ring.pieces?.some(p=>p.arc)){pieces=[];for(const p of ring.pieces){if(!p.arc&&pieces.length&&!pieces.at(-1).arc)pieces.at(-1).points.push(...p.points.slice(1));else pieces.push({...p,points:p.points.map(v=>[...v]),closed:false});}}
  return pieces.map((piece,j)=>{const points=piece.points.map(([px,py])=>{const x=(px/result.width-.5)*reference.width,y=(.5-py/result.height)*reference.height;return [reference.center[0]+x*c-y*s,reference.center[1]+x*s+y*c];});return validateFeature({...defaults,id:crypto.randomUUID(),kind:'sketch',name:reference.name.replace(/\.[^.]+$/,'').slice(0,55)+' 輪郭'+(i+1)+(pieces.length>1?'・'+(j+1):''),groupId,groupNumber,profile:'polyline',closed:piece.closed,plane:reference.plane,frame,x:origin.x,y:origin.y,z:origin.z,angle:0,points,...(piece.arc?{arc:{endTangent:piece.endTangent?[piece.endTangent[0]*c+piece.endTangent[1]*s,piece.endTangent[0]*s-piece.endTangent[1]*c]:[1,0]}}:{})});});
 });
}
