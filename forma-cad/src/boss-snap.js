import * as R from 'replicad';
import {Matrix4, Quaternion, Vector3} from 'three';

export const snapBossMinimum = Object.freeze({diameter:5,length:8,bossWall:1.6});
export const snapBossLengthMin = diameter => Math.max(snapBossMinimum.length,diameter*1.6);
export const snapBossClearanceMax = diameter => Math.min(1,Math.floor((diameter*.08-.1+1e-8)*20)/20);

export function snapBossSettings({pinStyle,diameter,length,bossWall,clearance}) {
 if(pinStyle === undefined || pinStyle === 'straight')return null;
 if(pinStyle !== 'snap')throw Error('棒の形状を選択してください');
 const minLength = Number(snapBossLengthMin(diameter).toFixed(8));
 if(diameter < snapBossMinimum.diameter || length < minLength-1e-8 || bossWall < snapBossMinimum.bossWall) {
  throw Error(`割りボスは軸径5 mm以上、差し込み長さ${minLength} mm以上、受けの肉厚1.6 mm以上で作成できます`);
 }
 const maxClearance = snapBossClearanceMax(diameter);
 if(clearance > maxClearance+1e-8)throw Error(`先端を受け穴に掛けるには、片側のすき間を${maxClearance} mm以下にしてください`);
 const scale = diameter/5, shaftRadius = diameter/2, headRadius = shaftRadius+.4*scale;
 return {scale,shaftRadius,headRadius,slotWidth:1.2*scale,axialGap:Math.max(.5,clearance),neckRadius:shaftRadius+clearance,pocketRadius:headRadius+clearance};
}

function turnProfile(points,hold) {
 let drawing = R.draw(points[0]);
 for(const point of points.slice(1))drawing = drawing.lineTo(point);
 return hold(drawing.close().sketchOnPlane('XZ').revolve([0,0,1]));
}

// Model insertion depth along local +Z, then orient it into the receiving part.
export function placeSnapTool(shape,origin,inward,splitDirection,hold) {
 const across = new Vector3().crossVectors(inward,splitDirection);
 const rotation = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(splitDirection,across,inward));
 if(rotation.w < 0)rotation.set(-rotation.x,-rotation.y,-rotation.z,-rotation.w);
 const axis = new Vector3(rotation.x,rotation.y,rotation.z), magnitude = axis.length();
 if(magnitude > 1e-9)shape = hold(shape.clone().rotate(2*Math.atan2(magnitude,rotation.w)*180/Math.PI,[0,0,0],axis.divideScalar(magnitude).toArray()));
 return hold(shape.clone().translate(origin));
}

export function makeSnapSocket(s,length,hold) {
 const {scale,neckRadius,pocketRadius,axialGap} = s;
 return turnProfile([[0,-.02],[pocketRadius,-.02],[pocketRadius,0],
  [neckRadius,.4*scale],[neckRadius,length-3.4*scale],[pocketRadius,length-3*scale],
  [pocketRadius,length+axialGap],[0,length+axialGap]],hold);
}

export function makeSnapPin(s,length,rootDepth,hold) {
 const {scale,shaftRadius,headRadius,slotWidth} = s;
 const shoulder = length-2.8*scale, slotEnd = 2.1*scale, halfSlot = slotWidth/2, span = headRadius+.1;
 let pin = turnProfile([[0,-rootDepth],[shaftRadius,-rootDepth],[shaftRadius,shoulder],
  [headRadius,length-2.4*scale],[headRadius,length-1.4*scale],[shaftRadius-.25*scale,length],[0,length]],hold);
 const slit = hold(R.makeBox([-halfSlot,-span,slotEnd],[halfSlot,span,length+.1]));
 const roundedRoot = hold(R.makeCylinder(halfSlot,span*2,[0,-span,slotEnd],[0,1,0]));
 pin = hold(pin.cut(slit));
 pin = hold(pin.cut(roundedRoot));

 // Relieve the head beside the split. Each prong can then pass through the
 // narrowest allowed throat by deflecting inward without closing the slit.
 const deflection = .56*scale;
 for(const sign of [-1,1]) {
  const side = hold(R.makeBox([sign<0?-span:0,-span,shoulder],[sign<0?0:span,span,length+.1]));
  const compressedEnvelope = hold(R.makeCylinder(shaftRadius+.025,length-shoulder+.2,[sign*deflection,0,shoulder-.05]));
  const excess = hold(side.cut(compressedEnvelope));
  pin = hold(pin.cut(excess));
 }
 return pin;
}
