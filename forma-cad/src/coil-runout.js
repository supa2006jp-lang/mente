import * as R from 'replicad';
const polar=(r,a)=>[r*Math.cos(a),r*Math.sin(a)];
// Height of the lower groove boundary at a fixed angle on the bore cylinder.
// Include the angular displacement of the helical normal section.
export function coilMouthRunout(q){
 const rm=q.maleRadius,rb=q.boreRadius,rc=q.wire/2+q.gap,k=q.pitch/(2*Math.PI*rm),L=Math.sqrt(1+k*k),a=-rm*L*L+Math.sqrt(rm*rm*k*k*L*L+rb*rb*L*L-k*k*rc*rc),b=Math.sqrt(Math.max(0,rc*rc-a*a)),reach=b/L+k*rm*Math.atan(k*b/(L*(rm+a))),thickness=Math.min(.8,reach-.06,q.pitch-2*reach-.04),shoulder=q.split+q.seam+q.pilot+.01;
 return {version:1,reach,thickness,shoulder,radialRelief:Math.min(.1,q.wall*.1),start:shoulder+reach-.015,end:shoulder+reach+thickness+.015,top:shoulder+reach+thickness+.03};
}
export function cutCoilMouthRunout(lid,q,cut){
 // On the inverted lid, the female groove begins as a thin isolated tail.
 // Extend only the rounded-detent mouth relief to that tail, but stop before the next helical land.
 const d=q.mouthRunout||coilMouthRunout(q),sign=q.leftHand?-1:1,tail=q.jointLatch&&q.latchStyle==='ridge'?Math.min(q.pitch/8,Math.max(0,d.reach-d.thickness-.06)):0,a=sign*2*Math.PI*(d.start-tail)/q.pitch,b=sign*2*Math.PI*d.end/q.pitch,lo=Math.min(a,b),hi=Math.max(a,b),inner=Math.max(.01,q.boreRadius-.05),outer=q.pilotRadius+d.radialRelief,foot=q.jointLatch&&q.latchStyle==='ridge'?q.split+q.seam-.02:d.shoulder-.02,tool=R.draw(polar(inner,lo)).lineTo(polar(outer,lo)).threePointsArcTo(polar(outer,hi),polar(outer,(lo+hi)/2)).lineTo(polar(inner,hi)).threePointsArcTo(polar(inner,lo),polar(inner,(lo+hi)/2)).close().sketchOnPlane('XY',foot).extrude(d.top-foot);
 // In rounded-detent mode, open the notch through the lid mouth. Its 0.1 mm
 // radial relief otherwise ends in a horizontal ledge above the pilot bore
 // when the lid is inverted for printing, provoking an interior tree support.
 // Remove the entire fragile radial band through the groove centre. A shallow
 // notch leaves another knife edge further out. A small radial relief prevents
 // a sub-tessellation-width annular face, while retaining at least 90% backing.
 // The bore, pitch, closed angle and normal thread engagement stay intact.
 // Pocket intersections can disconnect an already fragile end. Discard only
 // small fragments confined to the mouth shoulder and its target end thickness.
 const discardTips=result=>{
  const solids=result.solids;try{
   if(solids.length<2)return result;
   const measured=solids.map(shape=>({shape,volume:R.measureVolume(shape)})).sort((a,b)=>b.volume-a.volume),limit=Math.PI*(q.pilotRadius*q.pilotRadius-q.boreRadius*q.boreRadius)*d.thickness;
   let fragmentVolume=0;for(const part of measured.slice(1)){const box=part.shape.boundingBox;try{const [lo,hi]=box.bounds;if(lo[2]<d.shoulder-.025||hi[2]>d.shoulder+d.thickness+.025)return result;const vertices=part.shape.mesh({tolerance:.02,angularTolerance:.08}).vertices;for(let i=0;i<vertices.length;i+=3){const radius=Math.hypot(vertices[i],vertices[i+1]);if(radius<q.boreRadius-.025||radius>outer+.025)return result;}fragmentVolume+=part.volume;}finally{box.delete();}}
   if(fragmentVolume>limit||fragmentVolume>measured[0].volume*.005)return result;
   const main=measured[0].shape.clone();result.delete();return main;
  }finally{solids.forEach(shape=>shape.delete());}
 };
 try{return cut(lid,tool,true,discardTips);}finally{tool.delete();}
}
