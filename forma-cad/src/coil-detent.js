// A local rounded detent on a rooted internal flexure and its matching lid groove.
import * as R from 'replicad';
import {fuseSolid} from './solid-fuse.js';
import {choosePocketPhase,arcBacking} from './latch-pocket-phase.js';
import {coilOverlapVolume} from './coil-collision.js';
const polar=(r,a)=>[r*Math.cos(a),r*Math.sin(a)];
function sector(inner,outer,a,b,z,height){return R.draw(polar(inner,a)).lineTo(polar(outer,a)).threePointsArcTo(polar(outer,b),polar(outer,(a+b)/2)).lineTo(polar(inner,b)).threePointsArcTo(polar(inner,a),polar(inner,(a+b)/2)).close().sketchOnPlane('XY',z).extrude(height);}
const signed=(shape,q)=>q.leftHand?shape.mirror('XZ'):shape;
const add=(a,b)=>fuseSolid(a,b);
// Keep a broad printable crest, but make the opening-side shoulder steeper
// than the closing-side ramp. The lid cutter uses the same peak angle so its
// small clearance does not drift to one side of the tooth.
function mountain(base,crest,start,end,z,height,peakAngle,halfTopAngle){
 const peak=peakAngle??start+(end-start)*.3,halfTop=halfTopAngle??.35/crest;
 return R.draw(polar(base,start)).lineTo(polar(crest,peak-halfTop))
  .threePointsArcTo(polar(crest,peak+halfTop),polar(crest,peak))
  .lineTo(polar(base,end))
  .threePointsArcTo(polar(base,start),polar(base,(start+end)/2)).close()
  .sketchOnPlane('XY',z).extrude(height);
}
// Pull the mountain-facing tightening face back along its own normal.
// The top stays level and the lid pocket stays put, allowing slightly more
// rotation before the stop contacts the receiver.
function setBackMountainSideStop(stop,d,s){
 if(d.stopFaceSetback===0)return stop.clone();
 const co=Math.cos(d.stopB),si=Math.sin(d.stopB),normal=[-si,co,0],radial=[co,si,0];
 const origin=[(d.stopInner-3)*co-d.stopFaceSetback*normal[0],(d.stopInner-3)*si-d.stopFaceSetback*normal[1],0];
 const cutter=R.draw([0,s-.2]).lineTo([2,s-.2]).lineTo([2,s+d.stopHeight+.2]).lineTo([0,s+d.stopHeight+.2]).close().sketchOnPlane(new R.Plane(origin,normal,radial)).extrude(d.stopOuter-d.stopInner+6);
 try{return stop.cut(cutter);}finally{cutter.delete();}
}
const stopProbeDegrees=d=>2+Math.asin(d.stopFaceSetback/d.stopInner)*180/Math.PI;
export function detentDimensions(q){
 const c=q.latchGap??.3,requested=q.requestedLatchEngagement??q.latchEngagement??.8,t=q.latchExtraFirm?1.3:1.2,firm=q.latchFirm===true,backing=firm?1.2:.6,hand=q.leftHand?-1:1;
 const stopFaceSetback=q.stopFaceSetback??0;
 if(typeof stopFaceSetback!=='number'||!Number.isFinite(stopFaceSetback)||stopFaceSetback<0||stopFaceSetback>1)throw Error('回転止め面の引き込み量は0〜1 mmで指定してください');
 const reachLimit=wall=>(q.radius-q.maleRadius-.3-t-2*c-wall)/2;
 let maxEngagement=reachLimit(firm && q.profile?.length ? .6 : backing),e=Math.max(.4,Math.min(requested,maxEngagement));
 const size=(reach,corner)=>{const inner=q.maleRadius+reach+.3,outer=inner+t,channel=outer+c,toothOuter=channel+reach,rootAngle=.10,beamWidth=firm?(corner?6.6:7.6)+(q.latchExtraFirm?.4:0):6,length=firm?(corner?12.5:11.5)-(q.latchExtraFirm?.5:0):13.5,endAngle=rootAngle+beamWidth/((inner+outer)/2),crestWidth=Math.min(5.2,beamWidth-1.2),toothA=endAngle-crestWidth/outer,toothB=endAngle;return {inner,outer,channel,toothOuter,rootAngle,endAngle,toothA,toothB,length,beamWidth,crestWidth};};
 let geometry=size(e,!!q.profile),placement=firm?choosePocketPhase(q,{...geometry,c},backing):{phase:0,minimumBacking:q.radius-geometry.toothOuter-c,meetsMinimum:true};
 if(firm&&!placement.meetsMinimum){maxEngagement=reachLimit(backing);e=Math.max(.4,Math.min(requested,maxEngagement));geometry=size(e,false);placement=choosePocketPhase(q,{...geometry,c},backing);}
 const {inner,outer,channel,toothOuter,rootAngle,endAngle,toothA,toothB,length,beamWidth,crestWidth}=geometry,net=e,h=.6+e+.02,height=h+c+(firm?1.2:.7),slot=.3,release=e+.2;
 // Keep the body mountain phase fixed when calibrating the lid's outer angle.
 // Check the rotated receiver outline without relocating the printed body.
 let receiverBacking=placement.minimumBacking;
 if(q.profile&&q.closeAngle){const angle=q.closeAngle*Math.PI/180,co=Math.cos(angle),si=Math.sin(angle),rotated=q.profile.map(([x,y])=>[x*co-y*si,x*si+y*co]),a=placement.phase+toothA-c/inner,b=placement.phase+toothB+c/inner;
  receiverBacking=Math.min(receiverBacking,arcBacking(rotated,toothOuter+c,q.leftHand?-b:a,q.leftHand?-a:b,inner-c));
  if(receiverBacking<backing-1e-7)throw Error('角度補正すると山の受け側の壁厚が不足します。補正角を小さくするか筒の厚さを増やしてください');
 }
 if(maxEngagement<.4-1e-8||h<.6||firm&&!placement.meetsMinimum)throw Error('壁の厚さに山と溝を収められません。筒の厚さを増やしてください');
 if(inner-release<q.maleRadius+.1-1e-7)throw Error('山の腕が内側へたわむ空間が不足しています');
 // Free only the tooth's angular footprint. The former full-arm relief left
 // one nozzle-width of exterior wall near a polygon flat.
 const reliefStart=toothA-.02,reliefEnd=toothB+.02;
 const reliefBackingAt=outerRadius=>q.profile?arcBacking(q.profile,outerRadius,q.leftHand?-(placement.phase+reliefEnd):placement.phase+reliefStart,q.leftHand?-(placement.phase+reliefStart):placement.phase+reliefEnd,outer):q.radius-outerRadius;
 const minimumReliefOuter=toothOuter+c,minimumReliefBacking=q.profile?Math.max(backing,1.5):backing;
 if(reliefBackingAt(minimumReliefOuter)<minimumReliefBacking-1e-7)throw Error('山の逃げ溝の外側に十分な壁を残せません。筒の厚さを増やすか山の高さを下げてください');
 let reliefOuter=toothOuter+slot;
 if(reliefBackingAt(reliefOuter)<minimumReliefBacking){let low=minimumReliefOuter,high=reliefOuter;for(let i=0;i<24;i++){const middle=(low+high)/2;if(reliefBackingAt(middle)>=minimumReliefBacking)low=middle;else high=middle;}reliefOuter=low;}
 const reliefBacking=reliefBackingAt(reliefOuter);
 const stopInner=inner,stopOuter=q.radius-backing-c,stopBeta=6/((stopInner+stopOuter)/2),stopAlpha=2*Math.PI*height/q.pitch+c/inner,stopA=Math.max(Math.PI*1.5,toothB+c/inner+.15+stopAlpha),stopB=stopA+stopBeta,requiredPitch=2*Math.PI*height/(2*Math.PI-stopBeta-(toothB-toothA)-3*c/inner-.3);
 if(!Number.isFinite(requiredPitch)||requiredPitch<=0)throw Error('Internal pockets cannot fit within one turn');
 return {requiredSplit:q.wall+length+.5,requiredLidHeight:height+c+.5,requiredPitch,c,e,requested,maxEngagement,net,toothOuter,inner,outer,t,backing,receiverBacking,phase:placement.phase,channel,reliefStart,reliefEnd,reliefOuter,reliefBacking,h,length,beamWidth,crestWidth,rootAngle,endAngle,toothA,toothB,depth:length,slot,release,stopHeight:height,stopA,stopB,stopInner,stopOuter,stopAlpha,stopFaceSetback,hand};
}
export function detentShapes(q){const d=detentDimensions(q),s=q.split;if(!Number.isFinite(d.requiredPitch)||q.pitch<d.requiredPitch-1e-7)throw Error('山と回転止めの受けが重なります。ピッチを増やしてください');let beam,tooth,stop,channel,stopPocket,pocket;const cuts=[];
 try{
  beam=sector(d.inner,d.outer,d.rootAngle,d.endAngle,s-d.depth,d.depth);

  const peakAngle=d.toothA+.3*(d.toothB-d.toothA),halfTopAngle=.35/d.toothOuter;
  tooth=mountain(d.outer-.05,d.toothOuter,d.toothA,d.toothB,s-.05,d.h+.05,peakAngle,halfTopAngle);
  const lower=R.makeCylinder(d.toothOuter+.1,.7,[0,0,s-.1]),taper=R.drawCircle(d.toothOuter).sketchOnPlane('XY',s+.6).loftWith(R.drawCircle(d.channel-.02).sketchOnPlane('XY',s+d.h),{ruled:true});let allowance,trimmed;
  try{allowance=add(lower,taper);trimmed=tooth.intersect(allowance);tooth.delete();tooth=trimmed;}finally{lower.delete();taper.delete();allowance?.delete();}

  const fullStop=sector(d.stopInner,d.stopOuter,d.stopA,d.stopB,s-.1,d.stopHeight+.1);
  try{stop=setBackMountainSideStop(fullStop,d,s);}finally{fullStop.delete();}
  channel=R.makeCylinder(d.channel,d.h+d.c+.02,[0,0,s-.01]);
  pocket=mountain(d.channel-.06,d.toothOuter+d.c,d.toothA-d.c/d.inner,d.toothB+d.c/d.inner,s-.01,d.h+d.c+.02,peakAngle,halfTopAngle);
  stopPocket=sector(d.stopInner-d.c,d.stopOuter+d.c,d.stopA-d.stopAlpha,d.stopB,s-.01,d.stopHeight+d.c+.02);
  // Vertical annular cantilever: radial and endpoint slots free the upper
  // arm, while its lower end stays rooted in the body and prints upward.
  cuts.push(sector(d.inner-d.release-.02,d.inner,d.rootAngle-.04,d.endAngle+.04,s-d.depth,d.depth+.01));
  cuts.push(sector(d.outer,d.outer+d.slot,d.rootAngle-.04,d.endAngle+.04,s-d.depth,d.depth+.01));
  cuts.push(sector(d.inner-d.release-.02,d.outer+d.slot,d.rootAngle-.04,d.rootAngle,s-d.depth,d.depth+.01));
  cuts.push(sector(d.inner-d.release-.02,d.outer+d.slot,d.endAngle,d.endAngle+.04,s-d.depth,d.depth+.01));
  cuts.push(sector(d.outer,d.reliefOuter,d.reliefStart,d.reliefEnd,s-(d.c+d.e)-.1,d.c+d.e+.11));
  const toothFoot=mountain(d.outer-.05,d.toothOuter,d.toothA,d.toothB,s-(d.c+d.e),d.c+d.e+.05,peakAngle,halfTopAngle);
  const ca=(d.toothA+d.toothB)/2,co=Math.cos(ca),si=Math.sin(ca),wedge=R.draw([d.outer-.2,s-(d.c+d.e)]).lineTo([d.toothOuter+.1,s+.05]).lineTo([d.outer-.2,s+.05]).close().sketchOnPlane(new R.Plane([-si*2,co*2,0],[co,si,0],[si,-co,0])).extrude(4);let support,upper,arm;
  try{support=toothFoot.intersect(wedge);upper=add(tooth,support);arm=add(beam,upper);}finally{wedge.delete();toothFoot.delete();support?.delete();upper?.delete();}
  beam.delete();beam=null;tooth.delete();tooth=null;
  const raw={d,arm,stop,channel,pocket,stopPocket,cuts};
  if(d.phase){for(const k of ['arm','stop','channel','pocket','stopPocket']){const old=raw[k];raw[k]=old.rotate(d.phase*180/Math.PI,[0,0,0],[0,0,1]);old.delete();}raw.cuts=cuts.map(shape=>{const rotated=shape.rotate(d.phase*180/Math.PI,[0,0,0],[0,0,1]);shape.delete();return rotated;});}
  if(q.leftHand){for(const k of ['arm','stop','channel','pocket','stopPocket']){const old=raw[k];raw[k]=signed(old,q);old.delete();}raw.cuts=raw.cuts.map(shape=>{const result=signed(shape,q);shape.delete();return result;});}
  return raw;
 }catch(e){beam?.delete();tooth?.delete();stop?.delete();channel?.delete();pocket?.delete();stopPocket?.delete();cuts.forEach(s=>s.delete());throw e;}
}
export function attachDetent(body,lid,q){const shapes=detentShapes(q);let b=body.clone(),l=lid.clone();try{for(const cut of shapes.cuts){const next=b.cut(cut);b.delete();b=next;}let next=add(b,shapes.arm);b.delete();b=next;next=add(b,shapes.stop);b.delete();b=next;for(const cut of [shapes.channel,shapes.pocket,shapes.stopPocket]){next=l.cut(cut);l.delete();l=next;}return {body:b,lid:l,d:shapes.d};}catch(e){b.delete();l.delete();throw e;}finally{for(const k of ['arm','stop','channel','pocket','stopPocket'])shapes[k].delete();shapes.cuts.forEach(s=>s.delete());}}
// Retraction is a rigid geometric approximation of the flexible arm. The
// real arm remains rooted; elastic force and fatigue are not solved here.
export function detentReleaseMotion(body,q){const shapes=detentShapes(q),d=shapes.d,a=d.hand*(d.phase+(d.toothA+d.toothB)/2);let fixed;
 try{fixed=body.cut(shapes.arm);}catch(error){for(const key of ['arm','stop','channel','pocket','stopPocket'])shapes[key].delete();shapes.cuts.forEach(s=>s.delete());throw error;}
 return {at(travel=d.release){const shifted=shapes.arm.clone().translate([-travel*Math.cos(a),-travel*Math.sin(a),0]);try{return R.makeCompound([fixed.clone(),shifted]);}catch(error){shifted.delete();throw error;}},delete(){fixed.delete();for(const key of ['arm','stop','channel','pocket','stopPocket'])shapes[key].delete();shapes.cuts.forEach(s=>s.delete());}};
}
export function releasedDetentBody(body,q,travel){const motion=detentReleaseMotion(body,q);try{return motion.at(travel);}finally{motion.delete();}}
export function checkDetent(q,onProgress){const shapes=detentShapes(q),d=shapes.d,s=q.split,angle=d.hand*(d.phase+(d.toothA+d.toothB)/2),poses=[0,.0005,.001,.002,.003,.005,.0075,.01,.015,.02,.03,.05,.125,.15,.175,.2,.225,.25,.275,.3,.325,.35,Math.max(.125,d.h/q.pitch-.001),d.h/q.pitch,.3],checks=[];let receiver;
 const collide=coilOverlapVolume;
 try{
  receiver=R.makeCylinder(q.radius,d.stopHeight+d.c+.1,[0,0,s]);const bore=R.makeCylinder(q.boreRadius,d.stopHeight+d.c+.3,[0,0,s-.1]);let next;try{next=receiver.cut(bore);}finally{bore.delete();}receiver.delete();receiver=next;
  for(const tool of [shapes.channel,shapes.pocket,shapes.stopPocket]){next=receiver.cut(tool);receiver.delete();receiver=next;}
  for(const [index,turns] of poses.entries()){onProgress?.({stage:'山の掛かりと解除を確認しています',current:index+1,total:poses.length});const moved=receiver.clone().rotate(d.hand*turns*360,[0,0,0],[0,0,1]).translate([0,0,turns*q.pitch]);let arm;
   try{const measure=delta=>{const shifted=shapes.arm.clone().translate([-delta*Math.cos(angle),-delta*Math.sin(angle),0]);try{return collide(shifted,moved);}finally{shifted.delete();}};const rigid=measure(0);let delta=0;if(rigid>1e-7){if(measure(d.release)>1e-7)throw Error('山の腕を内側へたわませても解除できません。山と溝のすき間・掛かり量を調整してください');let low=0,high=d.release;for(let i=0;i<14;i++){const mid=(low+high)/2;if(measure(mid)>1e-7)low=mid;else high=mid;}delta=Math.min(d.release,high+.02);}checks.push({turns,rigidOverlap:rigid,deflection:delta,releasedOverlap:measure(delta)});}finally{moved.delete();arm?.delete();}
  }
  const stopped=receiver.clone().rotate(-d.hand*stopProbeDegrees(d),[0,0,0],[0,0,1]);let tighteningOverlap;try{tighteningOverlap=collide(shapes.stop,stopped);}finally{stopped.delete();}
  if(checks[0].rigidOverlap>1e-6||Math.max(...checks.map(c=>c.rigidOverlap))<1e-4||checks.some(c=>!Number.isFinite(c.rigidOverlap)||!Number.isFinite(c.releasedOverlap)||!Number.isFinite(c.deflection)||c.releasedOverlap>1e-6)||tighteningOverlap<1e-6)throw Error('山と溝の掛かり・解除を正常に確認できませんでした');
  return {dimensions:d,checks,tighteningOverlap,openingOverlap:Math.max(...checks.map(c=>c.rigidOverlap)),releaseTravel:d.release,status:'clear',sampled:true,rigidGeometryOnly:true};
 }finally{receiver?.delete();for(const k of ['arm','stop','channel','pocket','stopPocket'])shapes[k].delete();shapes.cuts.forEach(s=>s.delete());}
}

// Verify the real receiver after the mouth runout and exterior finishing cuts.
export function checkDetentReceiver(lid,q,reference){
 const shapes=detentShapes(q),d=shapes.d,probe=reference.checks.reduce((a,b)=>b.rigidOverlap>a.rigidOverlap?b:a);let stopProbe,openingProbe;
 try{
  stopProbe=shapes.stop.clone().rotate(d.hand*stopProbeDegrees(d),[0,0,0],[0,0,1]);
  const overlap=coilOverlapVolume(stopProbe,lid),retention=overlap/reference.tighteningOverlap;
  if(!Number.isFinite(retention)||overlap<1e-6||retention<.8)throw Error('山の締め止めの受け面が不足しています。分割位置またはピッチを調整してください');
  // The final lid can differ from the analytical receiver after mouth relief
  // and fillets. Measure the actual mountain collision at the locked phase.
  openingProbe=lid.clone().rotate(d.hand*probe.turns*360,[0,0,0],[0,0,1]).translate([0,0,probe.turns*q.pitch]);
  const mountainOverlap=coilOverlapVolume(shapes.arm,openingProbe),mountainRetention=mountainOverlap/probe.rigidOverlap;
  if(!Number.isFinite(mountainRetention)||mountainOverlap<1e-5||mountainRetention<.8)throw Error('山と溝の保持面が不足しています。ピッチまたはすき間を調整してください');
  return {status:'clear',tighteningOverlap:overlap,retention,mountainOverlap,mountainRetention,probeTurns:probe.turns};
 }finally{stopProbe?.delete();openingProbe?.delete();for(const k of ['arm','stop','channel','pocket','stopPocket'])shapes[k].delete();shapes.cuts.forEach(s=>s.delete());}
}
