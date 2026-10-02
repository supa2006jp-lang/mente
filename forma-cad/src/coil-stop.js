import * as R from 'replicad';
import {fuseSolid} from './solid-fuse.js';
const polar=(r,a)=>[r*Math.cos(a),r*Math.sin(a)];
function sector(inner,outer,a,b,z,height){const mid=(a+b)/2;return R.draw(polar(inner,a)).lineTo(polar(outer,a)).threePointsArcTo(polar(outer,b),polar(outer,mid)).lineTo(polar(inner,b)).threePointsArcTo(polar(inner,a),polar(inner,mid)).close().sketchOnPlane('XY',z).extrude(height);}
export function stopLug(q){const {stop:s}=q,a=q.leftHand?-s.beta:0,b=q.leftHand?0:s.beta;return sector(s.inner,s.outer,a,b,q.split-.05,q.seam+s.height+.05);}
function stopPocket(q){const {stop:s}=q,a=q.leftHand?-s.beta:-s.alpha,b=q.leftHand?s.alpha:s.beta;const pocket=sector(s.inner-q.gap,s.outer+q.gap,a,b,q.split+q.seam-.01,s.height+q.gap+.01);return q.closeAngle?pocket.rotate(-q.closeAngle,[0,0,0],[0,0,1]):pocket;}
export function attachCoilStop(body,q){const lug=stopLug(q);try{return fuseSolid(body,lug);}finally{lug.delete();}}
export function cutCoilStopPocket(lid,q,cut){const pocket=stopPocket(q);try{return cut(lid,pocket,true);}finally{pocket.delete();}}
export function checkCoilStop(q){
 const s=q.stop,lug=stopLug(q),outer=R.makeCylinder(q.radius,s.height+q.gap+.1,[0,0,q.split+q.seam]),inner=R.makeCylinder(s.inner-q.gap-.05,s.height+q.gap+.2,[0,0,q.split+q.seam-.05]),pocket=stopPocket(q);let ring,receiver;
 try{ring=outer.cut(inner);receiver=ring.cut(pocket);if(q.closeAngle)receiver=receiver.rotate(q.closeAngle,[0,0,0],[0,0,1]);const distance=R.measureDistanceBetween(lug,receiver);if(!Number.isFinite(distance)||distance>1e-4)throw Error('締め位置の回転止めが接触していません');
  const release=s.height/q.pitch,epsilon=Math.min(.002,q.seam/(2*q.pitch),q.gap/(2*q.pitch),s.height/(4*q.pitch),s.beta/(8*Math.PI)),samples=[0,.001,release*.5,Math.max(0,release-q.gap/q.pitch),release+q.gap/q.pitch],checks=[];let tighteningOverlap=0;
  for(const turns of [...samples,-epsilon]){let moved,overlap;try{moved=receiver.clone().rotate((q.leftHand?-1:1)*turns*360,[0,0,0],[0,0,1]).translate([0,0,turns*q.pitch]);overlap=lug.intersect(moved);const volume=Math.abs(R.measureVolume(overlap));if(!Number.isFinite(volume)||turns>=0&&volume>.001)throw Error('開閉時に回転止めが干渉します');if(turns<0)tighteningOverlap=volume;else checks.push({turns,overlap:volume});}finally{overlap?.delete();moved?.delete();}}
  if(tighteningOverlap<1e-6)throw Error('締め過ぎを止める突起が掛かっていません');return {status:'clear',contactDistance:distance,tighteningOverlap,releaseTurns:release,checks};
 }finally{receiver?.delete();ring?.delete();pocket.delete();inner.delete();outer.delete();lug.delete();}
}
