import * as R from 'replicad';
import {Matrix4, Quaternion, Vector3} from 'three';

export const snapBossMinimum = Object.freeze({diameter:5,length:8,bossWall:1.6});
export const snapBossLengthMin = diameter => Math.max(snapBossMinimum.length,diameter*1.6);
export const snapBossMinimumAxialPlay = .05;
export const snapBossEngagementPresets = Object.freeze([
 {id:'light',label:'軽め',rise:.3,minimumOverlap:.05},
 {id:'standard',label:'標準',rise:.4,minimumOverlap:.1},
 {id:'strong',label:'強め',rise:.5,minimumOverlap:.1},
]);

export function snapBossClearanceMax(diameter,engagement='standard') {
 const preset=snapBossEngagementPresets.find(item=>item.id===engagement);
 return Math.min(1,Math.floor((diameter/5*preset.rise-preset.minimumOverlap+1e-8)*20)/20);
}

export function snapBossShoulderLimits(diameter,clearance) {
 const scale=diameter/5;
 return {
  min:-Math.floor(2*scale*20+1e-8)/20,
  max:Math.floor((.6*scale+clearance-snapBossMinimumAxialPlay)*20+1e-8)/20,
 };
}

export function snapBossSettings({pinStyle,diameter,length,bossWall,clearance,snapEngagement='standard',snapShoulderOffset=0,snapRetentionRidge=false}) {
 if(pinStyle === undefined || pinStyle === 'straight')return null;
 if(pinStyle !== 'snap')throw Error('棒の形状を選択してください');
 const minLength = Number(snapBossLengthMin(diameter).toFixed(8));
 if(diameter < snapBossMinimum.diameter || length < minLength-1e-8 || bossWall < snapBossMinimum.bossWall) {
  throw Error(`割りボスは軸径5 mm以上、差し込み長さ${minLength} mm以上、受けの肉厚1.6 mm以上で作成できます`);
 }
 const preset = snapBossEngagementPresets.find(item=>item.id===snapEngagement);
 if(!preset)throw Error('割りボスの掛かりを選択してください');
 const maxClearance = snapBossClearanceMax(diameter,snapEngagement);
 if(clearance > maxClearance+1e-8)throw Error(`先端を受け穴に掛けるには、片側のすき間を${maxClearance} mm以下にしてください`);
 const scale = diameter/5, shaftRadius = diameter/2, headRadius = shaftRadius+preset.rise*scale;
 if(typeof snapRetentionRidge!=='boolean')throw Error('受け穴の内側の突起の設定を確認してください');
 if(snapRetentionRidge&&clearance<.1-1e-8)throw Error('内側の突起を使うには、片側のすき間を0.10 mm以上にしてください');
 if(!snapRetentionRidge){
  const {min,max}=snapBossShoulderLimits(diameter,clearance);
  if(!Number.isFinite(snapShoulderOffset)||snapShoulderOffset<min-1e-8||snapShoulderOffset>max+1e-8)
   throw Error(`受け穴の段の移動は${min}〜${max} mmで指定してください`);
 }
 const retentionRidgeHeight=snapRetentionRidge?Math.min(.15,clearance-.05):0;
 // Place the retaining face from the seated pin, including a little axial
 // clearance so the shoulders do not overlap at full insertion.
 const shoulderOffset=snapRetentionRidge ? .6*scale+clearance-snapBossMinimumAxialPlay : snapShoulderOffset;
 return {scale,shaftRadius,headRadius,engagement:preset.id,slotWidth:1.2*scale,axialGap:Math.max(.5,clearance),neckRadius:shaftRadius+clearance,pocketRadius:headRadius+clearance,shoulderOffset,retentionRidgeHeight};
}

function socketProfile({scale,neckRadius,pocketRadius,axialGap,shoulderOffset=0,retentionRidgeHeight=0},length) {
 const ramp=pocketRadius-neckRadius;
 const shoulder=length-3*scale+shoulderOffset;
 const start=shoulder-ramp-retentionRidgeHeight;
 const throat=retentionRidgeHeight?[
  [neckRadius,start-scale],
  [neckRadius-retentionRidgeHeight,start-.6*scale],
  [neckRadius-retentionRidgeHeight,start],
 ]:[[neckRadius,start]];
 return [[pocketRadius,0],[neckRadius,ramp],...throat,[pocketRadius,shoulder],[pocketRadius,length+axialGap]];
}

function pinProfile({scale,shaftRadius,headRadius},length,rootDepth=0) {
 return [[shaftRadius,-rootDepth],[shaftRadius,length-2.4*scale-(headRadius-shaftRadius)],
  [headRadius,length-2.4*scale],[headRadius,length-1.4*scale],[shaftRadius-.25*scale,length]];
}

function profileRadius(profile,depth) {
 const end=profile.findIndex(([,z])=>z>=depth);
 if(end<=0)return profile[end===0?0:profile.length-1][0];
 const [r0,z0]=profile[end-1],[r1,z1]=profile[end];
 return r0+(r1-r0)*(depth-z0)/(z1-z0);
}

export function snapBossInsertion(analysis,insertion) {
 const {diameter,clearance,length,snap}=analysis;
 const shaftRadius=diameter/2,scale=diameter/5,headRadius=snap.headDiameter/2;
 const pocketRadius=snap.pocketDiameter/2,neckRadius=shaftRadius+clearance;
 const socket=socketProfile({scale,neckRadius,pocketRadius,axialGap:snap.axialGap,shoulderOffset:snap.shoulderOffset,retentionRidgeHeight:snap.retentionRidgeHeight},length);
 const pin=pinProfile({scale,shaftRadius,headRadius},length);
 const remaining=length-insertion;
 const depths=new Set([0,insertion,...socket.map(([,z])=>z),...pin.map(([,z])=>z-remaining)]);
 let contact=null;
 for(const depth of depths){
  if(depth<0||depth>insertion)continue;
  const pinRadius=profileRadius(pin,depth+remaining),socketRadius=profileRadius(socket,depth);
  const deflection=pinRadius-socketRadius;
  if(deflection>(contact?.deflection??1e-6))contact={depth,pinRadius,socketRadius,deflection};
 }
 const shoulderDepth=pin[2][1]-remaining;
 if(contact)return {state:'contact',...contact};
 const catchingDepth=socket.at(-2)[1]-clearance;
 if(shoulderDepth>=catchingDepth-1e-6)return {state:'engaged',depth:shoulderDepth,pinRadius:headRadius,deflection:0};
 return {state:insertion>0?'approaching':'outside',deflection:0};
}

export function snapBossAxialPlay({diameter,clearance,snap}) {
 // Both shoulders rise at 45°. The receiver reaches the head radius
 // one radial clearance before the end of its ramp.
 return Math.max(0,.6*(diameter/5)+clearance-(snap.shoulderOffset??0));
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
 const profile=socketProfile(s,length);
 return turnProfile([[0,-.02],[s.pocketRadius,-.02],...profile,[0,profile.at(-1)[1]]],hold);
}

export function makeSnapPin(s,length,rootDepth,hold) {
 const {scale,headRadius,shaftRadius,slotWidth} = s;
 const profile=pinProfile(s,length,rootDepth);
 const shoulder = profile[1][1], slotEnd = 2.1*scale, halfSlot = slotWidth/2, span = headRadius+.1;
 let pin = turnProfile([[0,-rootDepth],...profile,[0,length]],hold);
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
