import {defaults,validateFeature} from './geometry.js';
import {basisFor} from './frames.js';

export function referenceTraceSketches(reference,result,rings,groupNumber){
 const b=basisFor(reference),frame={u:b.u.toArray(),v:b.v.toArray(),n:b.n.toArray()},origin=b.n.multiplyScalar(reference.offset),a=reference.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),groupId=crypto.randomUUID();
 return rings.map((ring,i)=>{const points=ring.points.map(([px,py])=>{const x=(px/result.width-.5)*reference.width,y=(.5-py/result.height)*reference.height;return [reference.center[0]+x*c-y*s,reference.center[1]+x*s+y*c];});return validateFeature({...defaults,id:crypto.randomUUID(),kind:'sketch',name:reference.name.replace(/\.[^.]+$/,'').slice(0,65)+' 輪郭'+(i+1),groupId,groupNumber,profile:'polyline',closed:true,plane:reference.plane,frame,x:origin.x,y:origin.y,z:origin.z,angle:0,points});});
}
