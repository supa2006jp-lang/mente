import * as R from 'replicad';
import * as THREE from 'three';
import {fuseThread} from './thread-fuse.js';
import {fuseSolid} from './solid-fuse.js';
import {coilOverlapVolume} from './coil-collision.js';
import {filletCoilExteriors} from './coil-fillet.js';
import {coilOpening,coilOpeningLimit} from './coil-opening.js';
import {coilMouthRunout,cutCoilMouthRunout} from './coil-runout.js';
import {prismJointInfo,polygonCylinder} from './coil-prism.js';
import {attachCoilStop,cutCoilStopPocket,checkCoilStop} from './coil-stop.js';
import {attachLatch,checkLatch,latchReleaseMotion,latchDimensions,checkLatchStopReceiver} from './coil-latch.js';
import {attachDetent,checkDetent,detentReleaseMotion,detentDimensions,checkDetentReceiver} from './coil-detent.js';

const positive=(value,name,min=.01)=>{if(!Number.isFinite(value)||value<min)throw Error(name+'は '+min+' mm以上で指定してください');return value;};
const valid=shape=>{const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;try{return check.IsValid()&&solids.length===1&&R.measureVolume(shape)>1e-7;}finally{check.delete();solids.forEach(s=>s.delete());}};

function cylinderSurface(face){
 const owned=[],hold=object=>(owned.push(object),object);
 try{
  const surface=hold(face.surface),cylinder=hold(surface.wrapped.Cylinder()),location=hold(cylinder.Location()),axis=hold(cylinder.Axis()),direction=hold(axis.Direction());
  return {radius:cylinder.Radius(),location:[location.X(),location.Y(),location.Z()],axis:[direction.X(),direction.Y(),direction.Z()],bounds:face.UVBounds};
 }finally{for(const object of owned.reverse())object.delete();}
}
export function cylinderJointInfo(base){
 if(!base)throw Error('変換する円柱を選択してください');
 const faces=base.faces;let info;
 try{
  if(faces.filter(f=>f.geomType==='PLANE').length!==2||faces.some(f=>!['CYLINDRE','PLANE'].includes(f.geomType)))throw Error('未加工の円柱を1つ選択してください。穴・シェル・段差のあるボディには変換できません');
  const sides=faces.filter(f=>f.geomType==='CYLINDRE').map(cylinderSurface),first=sides[0];
  if(first){
   const {radius,bounds}=first,height=bounds.vMax-bounds.vMin,axis=new THREE.Vector3(...first.axis),origin=new THREE.Vector3(...first.location).addScaledVector(axis,bounds.vMin),expected=Math.PI*radius*radius*height,actual=R.measureVolume(base);
   const coaxial=sides.every(side=>{const n=new THREE.Vector3(...side.axis),o=new THREE.Vector3(...side.location).sub(origin);return Math.abs(side.radius-radius)<1e-5&&Math.abs(Math.abs(n.dot(axis))-1)<1e-7&&o.addScaledVector(axis,-o.dot(axis)).length()<1e-5&&Math.abs(side.bounds.vMax-side.bounds.vMin-height)<1e-5;});
   if(height>.01&&coaxial&&Math.abs(actual-expected)<=Math.max(.001,expected*1e-6)){
    const major=axis.toArray().reduce((a,v,i,arr)=>Math.abs(v)>Math.abs(arr[a])?i:a,0);
    if(axis.getComponent(major)<0){origin.addScaledVector(axis,height);axis.negate();}
    info={radius,height,origin:origin.toArray(),axis:axis.toArray()};
   }
  }
 }finally{faces.forEach(face=>face.delete());}
 if(!info)throw Error('未加工の円柱を1つ選択してください。穴・シェル・段差のあるボディには変換できません');
 return info;
}

export function coilJointInfo(base,p={},preferredAxis){if(p.jointAxis!==undefined&&!['自動','X','Y','Z'].includes(p.jointAxis))throw Error('変換する軸を選択してください');try{const info=cylinderJointInfo(base),manual={X:[1,0,0],Y:[0,1,0],Z:[0,0,1]}[p.jointAxis];if(manual&&Math.abs(new THREE.Vector3(...info.axis).dot(new THREE.Vector3(...manual)))<1-1e-7)throw Error('指定した軸と円柱の軸が一致していません');return {...info,shapeType:'cylinder'};}catch{return prismJointInfo(base,p,preferredAxis);}}
export function resolveCoilJoint(info,p){
 const filletBodyBottom=p.filletBodyBottom??true,filletLidTop=p.filletLidTop??true,filletVertical=p.filletVertical??true;if([filletBodyBottom,filletLidTop,filletVertical].some(value=>typeof value!=='boolean'))throw Error('フィレット対象の設定が不正です');
 const autoFillet=p.autoFillet??false;if(typeof autoFillet!=='boolean')throw Error('自動フィレットの設定が不正です');if(autoFillet&&!filletBodyBottom&&!filletLidTop&&!filletVertical)throw Error('丸める箇所を1つ以上選択してください');if(autoFillet&&info.shapeType!=='polygon'&&!filletBodyBottom&&!filletLidTop)throw Error('円柱では本体の底または蓋の上部を選択してください');const legacyFilletRadius=p.filletRadius??2,requestedVerticalFilletRadius=p.filletVerticalRadius??legacyFilletRadius,requestedCapFilletRadius=p.filletCapRadius??legacyFilletRadius;
 if(autoFillet)for(const [radius,name] of [[requestedVerticalFilletRadius,'縦角'],[requestedCapFilletRadius,'端面']])if(!Number.isFinite(radius)||radius<.05||radius>10)throw Error(name+'のフィレット半径は0.05〜10 mmで指定してください');
 const latchStyle=p.latchStyle??'claw';if(!['claw','ridge'].includes(latchStyle))throw Error('固定方式を選択してください');
 const stopFaceSetback=p.stopFaceSetback??0;if(typeof stopFaceSetback!=='number'||!Number.isFinite(stopFaceSetback)||stopFaceSetback<0||stopFaceSetback>1)throw Error('回転止め面の引き込み量は0〜1 mmで指定してください');
 // The old claw-strength checkboxes stay saved for switching back, but cannot silently resize the new ridge.
 const latchExtraFirm=latchStyle==='ridge'?true:p.latchExtraFirm??false;if(typeof latchExtraFirm!=='boolean')throw Error('爪の追加強化の設定が不正です');const latchFirm=latchStyle==='ridge'?true:p.latchFirm??false;if(typeof latchFirm!=='boolean')throw Error('爪の強さの設定が不正です');if(latchExtraFirm&&!latchFirm)throw Error('爪の追加強化には腕と受け側の強化を有効にしてください');
 const jointLatch=p.jointLatch??false;if(typeof jointLatch!=='boolean')throw Error('爪の設定が不正です');
 const fixationDimensions=latchStyle==='ridge'?detentDimensions:latchDimensions;
 const latchGap=p.latchGap??.3,requestedLatchEngagement=p.latchEngagement??.8;let latchEngagement=requestedLatchEngagement;if(jointLatch&&(!Number.isFinite(latchGap)||latchGap<.05||latchGap>1||!Number.isFinite(latchEngagement)||latchEngagement<.4||latchEngagement>1.6))throw Error((latchStyle==='ridge'?'山と溝のすき間は0.05〜1 mm、山の高さは':'爪のすき間は0.05〜1 mm、掛かり量は')+'0.4〜1.6 mmで指定してください');
 const rimSeat=jointLatch?true:p.rimSeat??false;if(typeof rimSeat!=='boolean')throw Error('縁の面で止める設定が不正です');const auto=p.autoAdjust!==false,notes=[],alignStop=rimSeat?false:p.alignStop??info.shapeType==='polygon',closeAngleAdjustment=p.closeAngle??0,closeAngleZero=p.closeAngleZero??0,closeAngle=closeAngleZero+closeAngleAdjustment;const angleLimit=jointLatch?10:180;if(![-2,0,2].includes(closeAngleZero))throw Error('角度補正の基準が不正です');if(!Number.isFinite(closeAngleAdjustment)||Math.abs(closeAngleAdjustment)>angleLimit)throw Error('締め位置の角度補正は−'+angleLimit+'〜'+angleLimit+'°で指定してください');if(typeof alignStop!=='boolean')throw Error('回転止めの設定が不正です');
 let wire=positive(p.wire,'コイルの太さ',.1),pitch=positive(p.pitch,'ピッチ',.1),wall=positive(p.wall,'筒の厚さ',.1),gap=positive(p.jointGap,'かみ合わせのすき間',.05),seam=positive(p.jointSeam,'合わせ目のすき間',rimSeat?0:.01);
 if(rimSeat){if(seam)notes.push('縁の面で止めるため、合わせ目 '+seam.toFixed(2)+' → 0.00 mm');seam=0;}
 if(!Number.isInteger(p.turns)||p.turns<1||p.turns>30)throw Error('巻き数は1〜30の整数で指定してください');
 if(p.hand!=='右ねじ'&&p.hand!=='左ねじ')throw Error('ねじの向きを選択してください');
 if(!Number.isFinite(p.jointSplit)||p.jointSplit<0)throw Error('分割位置はソリッドの底からの距離で指定してください（0は自動）');
 if(jointLatch&&info.radius<10)throw Error((latchStyle==='ridge'?'山と溝付き接合':'爪付き接合')+'は内接円の半径10 mm以上のソリッドを選択してください');
 const adjust=(value,minimum,name)=>{if(value>=minimum-1e-8)return value;if(!auto)throw Error(name+'は '+minimum.toFixed(2)+' mm以上が必要です。自動調整を有効にしてください');notes.push(name+' '+value.toFixed(2)+' → '+minimum.toFixed(2)+' mm');return minimum;};
 // Reserve a 1.4 mm stop lug plus its matching pocket and backing wall.
 // The former 0.6 mm lug could disappear when sliced for a 0.6 mm nozzle.
 const stopThickness=1.4,stopBackingWall=.6,stopPilotClearance=.1;
 wire=adjust(wire,Math.max(.4,2*(gap+.15)),'コイルの太さ');wall=adjust(wall,alignStop?stopThickness+stopBackingWall+stopPilotClearance+2*gap:rimSeat?1.8:.6,'筒の厚さ');
 // The pilot must extend past the groove crest: exact tangency makes OCCT
 // omit triangles at its annular shoulder. Reserve the relief inside the
 // radius calculation so the requested backing wall is still preserved.
 if(jointLatch)wall=adjust(wall,Math.max(1.8,.3+(latchExtraFirm?1.3:1.2)+2*latchGap+2*.4+(latchFirm?1.2:.6)-wire/2-gap-.01),'筒の厚さ');
 const pilotRelief=.01,radius=info.radius,crest=wire/2,maleRadius=radius-crest-gap-wall-pilotRelief;
 const requestedBoreWall=p.bodyBoreWall??0;
 if(!Number.isFinite(requestedBoreWall)||requestedBoreWall<0||requestedBoreWall>10000||requestedBoreWall>0&&requestedBoreWall<.6)throw Error('本体内穴の壁厚は0（肉厚に連動）または0.6 mm以上で指定してください');
 const bodyBoreWall=requestedBoreWall===0?wall:requestedBoreWall,innerRadius=maleRadius-bodyBoreWall;
 if(jointLatch){const maximum=fixationDimensions({...info,radius,maleRadius,wall,pitch,latchGap,latchEngagement,requestedLatchEngagement,latchFirm,latchExtraFirm,closeAngle:0,leftHand:p.hand==='左ねじ',split:0}).e;if(latchEngagement>maximum+1e-8){if(!auto)throw Error((latchStyle==='ridge'?'山の高さ':'爪の掛かり量')+'は '+maximum.toFixed(2)+' mm以下が必要です。自動調整を有効にしてください');latchEngagement=Math.max(.4,maximum);notes.push((latchStyle==='ridge'?'内側に収める山の高さ ':'内側に収める爪の掛かり量 ')+requestedLatchEngagement.toFixed(2)+' → '+latchEngagement.toFixed(2)+' mm');}}
 if(innerRadius<.5||maleRadius<wire*1.5)throw Error('外径に対してコイル・すき間・肉厚・本体内穴の壁厚が大きすぎます。いずれかを小さくしてください');
 // The normal separation of successive helical grooves must leave a land.
 const minimum=wire+2*gap+.5;
 const pitchMin=minimum/Math.sqrt(1-(minimum/(2*Math.PI*maleRadius))**2);
 if(!Number.isFinite(pitchMin))throw Error('この断面はコイル接合に小さすぎます');
 pitch=adjust(pitch,Math.max(Math.ceil(pitchMin*100)/100,jointLatch?3.3:0),'ピッチ');
 if(jointLatch){const preliminary=fixationDimensions({...info,leftHand:p.hand==='左ねじ',radius,maleRadius,wall,pitch,latchGap,latchEngagement,requestedLatchEngagement,latchFirm,latchExtraFirm,closeAngle:0,split:0});if(!Number.isFinite(preliminary.requiredPitch))throw Error(latchStyle==='ridge'?'この寸法では山の受け溝を作れません':'この寸法では内蔵爪の受けを作れません');pitch=adjust(pitch,Math.ceil(preliminary.requiredPitch*100)/100,'ピッチ');}
 const lead=adjust(Math.max(.8,wire),seam+.2,'入口の案内長さ'),pilot=Math.max(wire,pitch/4),extension=Math.max(wire/2+gap,pitch/4),threadLength=pitch*p.turns,neckLength=lead+wire+threadLength+gap+pilot;
 const latchSize=jointLatch?fixationDimensions({...info,leftHand:p.hand==='左ねじ',outerRadius:info.outerRadius||radius,radius,maleRadius,pilot,innerRadius,wall,pitch,latchGap,latchEngagement,requestedLatchEngagement,latchFirm,latchExtraFirm,closeAngle:0,split:0}):null;
 const minimumSplit=Math.max(wall+1,latchSize?.requiredSplit??0);let split=p.jointSplit||info.height*.6;split=adjust(split,minimumSplit,'分割位置');
 const latchLidHeight=latchSize?.requiredLidHeight??0,minimumLidHeight=Math.max(neckLength+extension+.2+wall,latchLidHeight);
 const requiredHeight=split+minimumLidHeight;
 const height=adjust(info.height,requiredHeight,'全高');if(height>10000)throw Error('接合後の全高は10000 mm以内にしてください。巻き数やピッチを小さくしてください');
 if(split>=height-wall)throw Error('分割位置をソリッドの内部に指定してください');
 const stop=alignStop?{inner:radius-wall+stopPilotClearance+gap,outer:radius-stopBackingWall-gap,height:Math.min(.8,Math.max(.4,pitch*.2)),beta:Math.min(.25,2/(radius-wall/2))}:null;if(stop){stop.alpha=2*Math.PI*stop.height/pitch+gap/stop.inner;}
 const capFilletBounds=[{radius:wall*.35,type:'wall',label:'接合部肉厚'},{radius:split*.2,type:'body-height',label:'本体高さ'},{radius:(height-split-seam)*.2,type:'lid-height',label:'蓋高さ'}],filletRadius=autoFillet?Math.min(requestedCapFilletRadius,...capFilletBounds.map(bound=>bound.radius)):.5;
 const capFilletBound=autoFillet&&filletRadius<requestedCapFilletRadius-1e-8?capFilletBounds.find(bound=>Math.abs(bound.radius-filletRadius)<1e-8):null;
 const capFilletReason=capFilletBound?{type:capFilletBound.type,label:capFilletBound.label}:null;
 if(autoFillet&&(filletBodyBottom||filletLidTop)&&filletRadius<requestedCapFilletRadius-1e-8)notes.push('端面のフィレット半径 '+requestedCapFilletRadius.toFixed(2)+' → '+filletRadius.toFixed(2)+' mm');
 const resolved={...info,auto,autoFillet,filletBodyBottom,filletLidTop,filletVertical,requestedFilletRadius:autoFillet?requestedCapFilletRadius:.5,requestedVerticalFilletRadius:autoFillet?requestedVerticalFilletRadius:.5,requestedCapFilletRadius:autoFillet?requestedCapFilletRadius:.5,filletRadius,capFilletReason,jointLatch,latchFirm,latchExtraFirm,latchStyle,latchVersion:jointLatch?(latchStyle==='ridge'?'rounded-detent-v2':'internal-v1'):null,latchGap,latchEngagement,requestedLatchEngagement,stopFaceSetback,outerRadius:info.outerRadius||radius,rimSeat,alignStop,closeAngle,closeAngleZero,closeAngleAdjustment,stop,sourceHeight:info.height,height,wire,pitch,turns:p.turns,wall,bodyBoreWall,gap,seam,split,minimumSplit,minimumLidHeight,lead,pilot,extension,threadLength,neckLength,maleRadius,innerRadius,pilotRelief,pilotRadius:maleRadius+crest+gap+pilotRelief,boreRadius:maleRadius+gap,leftHand:p.hand==='左ねじ',notes};resolved.mouthRunout=coilMouthRunout(resolved);if(jointLatch){const fixation=fixationDimensions(resolved);if(latchStyle==='ridge')resolved.stopFacePreview={angle:fixation.hand*(fixation.phase+fixation.stopB),inner:fixation.stopInner,outer:fixation.stopOuter,height:fixation.stopHeight};}return resolved;
}

function cutChecked(base,tool,requireLoss=false,clean=result=>result){
 const before=R.measureVolume(base),eps=Math.max(1e-7,before*1e-9),accept=result=>valid(result)&&R.measureVolume(result)<=before+eps&&(!requireLoss||R.measureVolume(result)<before-eps);
 let result;try{result=clean(base.cut(tool));if(accept(result))return result;}catch{}result?.delete();
 const oc=R.getOC();for(const tolerance of [0,1e-6,1e-5,1e-4]){const builder=new oc.BRepAlgoAPI_Cut(base.wrapped,tool.wrapped);result=null;try{builder.SetNonDestructive(true);builder.SetFuzzyValue(tolerance);builder.Build();result=clean(R.cast(builder.Shape()).asShape3D());if(accept(result))return result;}catch{}finally{builder.delete();}result?.delete();}
 throw Error('コイルの受け溝を正常に作れませんでした。太さ・ピッチ・すき間を調整してください');
}
function helixTube(q,sectionRadius,start,span){
 const slope=(q.leftHand?-1:1)*q.pitch/(2*Math.PI),section=R.drawCircle(sectionRadius).sketchOnPlane(new R.Plane([q.maleRadius,0,0],[1,0,0],[0,q.maleRadius,slope])).wire;
 let path,shape;try{path=R.makeHelix(q.pitch,span,q.maleRadius,undefined,undefined,q.leftHand);shape=R.genericSweep(section,path,{frenet:true});return shape.rotate((q.leftHand?-1:1)*start/q.pitch*360,[0,0,0],[0,0,1]).translate([0,0,start]);}finally{section.delete();path?.delete();}
}
function localParts(q,onProgress){
 const {radius:r,split:s,wall:w,maleRadius:rm,boreRadius:rb,innerRadius:ri}=q;let body,lid,neck,tool;
 try{
  onProgress?.({stage:'本体と蓋の筒を作成しています'});const outer=(height,z=0)=>q.profile?polygonCylinder(q.profile,height,z):R.makeCylinder(r,height,[0,0,z]);body=outer(s);neck=R.makeCylinder(rm,q.neckLength+.05,[0,0,s-.05]);const joined=fuseSolid(body,neck);body.delete();body=joined;neck.delete();neck=null;
  tool=R.makeCylinder(ri,s+q.neckLength-w+.1,[0,0,w]);let cut=cutChecked(body,tool,true);body.delete();body=cut;tool.delete();tool=null;
  // Orient only the exterior before cutting. The thread and stop remain in
  // their common closed phase, avoiding rotated periodic tool seams.
  lid=outer(q.height-s-q.seam,s+q.seam);if(q.profile&&q.closeAngle)lid=lid.rotate(q.closeAngle,[0,0,0],[0,0,1]);tool=R.makeCylinder(rb,q.height-s-q.seam-w+.1,[0,0,s+q.seam-.1]);cut=cutChecked(lid,tool,true);lid.delete();lid=cut;tool.delete();tool=null;
  if(q.stop){const cut=cutCoilStopPocket(lid,{...q,closeAngle:0},cutChecked);lid.delete();lid=cut;}
  const start=s+q.lead+q.wire/2,finish=start+q.threadLength,step=q.pitch*.75;
  for(let z=start;z<finish-1e-8;z+=step){
   onProgress?.({stage:'オスのコイルを作成しています',current:Math.round((z-start)/step)+1,total:Math.ceil(q.threadLength/step)});const ridge=helixTube(q,q.wire/2,z,Math.min(step,finish-z));
   try{const next=fuseThread(body,ridge,{requireJoined:true});body.delete();body=next;}finally{ridge.delete();}
  }
  tool=R.makeCylinder(q.pilotRadius,q.pilot+.02,[0,0,s+q.seam-.01]);cut=cutChecked(lid,tool,true);lid.delete();lid=cut;tool.delete();tool=null;
  // Extend the female path through the mouth. On opening, each male turn moves
  // downward along this same path in the lid's frame, including its end caps.
  const grooveStart=s+q.seam-q.extension,grooveEnd=finish+q.extension,pilotTop=s+q.seam+q.pilot+.01,axialReach=(q.wire/2+q.gap)/Math.sqrt(1+(q.pitch/(2*Math.PI*rm))**2);
  for(let z=grooveStart;z<grooveEnd-1e-8;z+=step){
   onProgress?.({stage:'メスの受け溝を作成しています',current:Math.round((z-grooveStart)/step)+1,total:Math.ceil((grooveEnd-grooveStart)/step)});const span=Math.min(step,grooveEnd-z),cutter=helixTube(q,q.wire/2+q.gap,z,span);
   // A cutter wholly swallowed by the pilot is an intentional no-op. Other
   // groove segments must remove material, including during preview.
   try{const next=cutChecked(lid,cutter,z+span+axialReach>pilotTop+1e-5);lid.delete();lid=next;}finally{cutter.delete();}
  }
  if(q.stop){onProgress?.({stage:'締め位置の回転止めを作成しています'});const joined=attachCoilStop(body,q);body.delete();body=joined;}
  if(q.jointLatch){onProgress?.({stage:q.latchStyle==='ridge'?'固定用の山と溝を作成しています':'固定用の爪と締め止めを作成しています'});const joined=q.latchStyle==='ridge'?attachDetent(body,lid,q):attachLatch(body,lid,q);body.delete();lid.delete();body=joined.body;lid=joined.lid;}
  const relieved=cutCoilMouthRunout(lid,q,cutChecked);lid.delete();lid=relieved;
  if(!valid(body)||!valid(lid))throw Error('接合部を正常な2つのソリッドとして作れませんでした');
  return [body,lid];
 }catch(e){body?.delete();lid?.delete();throw e;}finally{neck?.delete();tool?.delete();}
}
export function screwLidPose(lid,q,turns){return lid.clone().rotate((q.leftHand?-1:1)*turns*360,[0,0,0],[0,0,1]).translate([0,0,turns*q.pitch]);}
function checkMotion(body,lid,q,onProgress){
 const stop=q.stop?checkCoilStop(q):null;let seating;
 if(q.rimSeat){
  const distance=R.measureDistanceBetween(body,lid);
  if(!Number.isFinite(distance)||distance>1e-5)throw Error('本体と蓋の縁が接触していません');
  const probeTurns=.01/q.pitch,moved=screwLidPose(lid,q,-probeTurns);
  try{
   const volume=coilOverlapVolume(body,moved);
   if(!Number.isFinite(volume)||volume<1e-5)throw Error('縁の面で締め込みを止められませんでした');
   const d=q.jointLatch?(q.latchStyle==='ridge'?detentDimensions(q):latchDimensions(q)):null;seating={status:'clear',contactDistance:distance,tighteningOverlap:volume,probeTurns,bearingWidth:d?Math.min(d.receiverBacking,d.backing):q.wall};
  }finally{moved.delete();}
 }
 const latch=q.jointLatch?(q.latchStyle==='ridge'?checkDetent(q,onProgress):checkLatch(q,onProgress)):null;if(latch){onProgress?.({stage:'固定用の受けを確認しています'});latch.actualReceiver=q.latchStyle==='ridge'?checkDetentReceiver(lid,q,latch):checkLatchStopReceiver(lid,q,latch);}
 let releaseMotion;
 try{
  if(q.jointLatch)releaseMotion=q.latchStyle==='ridge'?detentReleaseMotion(body,q):latchReleaseMotion(body,q);
 const tipCrossing=(q.lead+q.wire/2+q.threadLength-q.seam)/q.pitch;const samples=[0,...(q.rimSeat?[.001,.01]:[]),.125,.5,1,Math.max(0,tipCrossing-q.gap/q.pitch),tipCrossing+q.gap/q.pitch,q.neckLength/q.pitch+1],checks=[];
 const poses=[...new Set([...samples,...(latch?.checks.map(c=>c.turns)||[])])].sort((a,b)=>a-b);for(const [index,turns] of poses.entries()){onProgress?.({stage:'開閉の干渉を確認しています',current:index+1,total:poses.length});const moved=screwLidPose(lid,q,turns),deflection=latch?.checks.find(c=>c.turns===turns)?.deflection??0,openingBody=deflection>0?releaseMotion.at(deflection):null;try{const volume=coilOverlapVolume(openingBody||body,moved);if(!Number.isFinite(volume))throw Error('開閉の干渉量を測定できませんでした');if(volume>.001)throw Error('開閉時の干渉を検出しました。かみ合わせのすき間を増やしてください');const distance=(turns===0&&!q.stop)||turns===.125||q.rimSeat&&(turns===.001||turns===.01)?R.measureDistanceBetween(openingBody||body,moved):null;if(distance!=null&&!Number.isFinite(distance))throw Error('開閉のすき間を測定できませんでした');if(distance!=null&&!(q.jointLatch&&deflection>0)&&distance<(q.rimSeat?Math.min(q.gap,turns*q.pitch):Math.min(q.gap,q.seam))-.02)throw Error('開閉時のすき間が不足しています。すき間の設定を増やしてください');checks.push({turns,overlap:volume,...(q.jointLatch?{deflection}:{}),...(distance!=null?{distance}:{})});}finally{openingBody?.delete();moved.delete();}}
 return {checks,checkedTurns:Math.max(...poses),status:'clear',sampled:true,...(stop?{stop}:{}),...(seating?{seating}:{}),...(latch?{latch}:{})};
 }finally{releaseMotion?.delete();}
}
function besideBody(body,lid){
 const flipped=lid.clone().rotate(180,[0,0,0],[1,0,0]),bodyBox=body.boundingBox,lidBox=flipped.boundingBox;
 try{const [bodyLo,bodyHi]=bodyBox.bounds,[lidLo,lidHi]=lidBox.bounds;return flipped.translate([bodyHi[0]+5-lidLo[0],(bodyLo[1]+bodyHi[1]-lidLo[1]-lidHi[1])/2,-lidLo[2]]);}finally{flipped.delete();bodyBox.delete();lidBox.delete();}
}
function place(shape,q){const z=new THREE.Vector3(0,0,1),direction=new THREE.Vector3(...q.axis),angle=z.angleTo(direction),axis=z.clone().cross(direction);if(axis.lengthSq()<1e-12)axis.set(1,0,0);axis.normalize();return shape.clone().rotate(angle*180/Math.PI,[0,0,0],axis.toArray()).translate(q.origin);}
// Cache closed geometry separately from verification. Preview never promotes
// an unverified pair; apply and replay must finish the native motion checks.
const coreJointCache=new Map(),jointCache=new Map();
function cacheJoint(cache,key,value,limit){cache.set(key,value);if(cache.size>limit){const first=cache.keys().next().value;cache.get(first).parts.forEach(shape=>shape.delete());cache.delete(first);}}
function coilCoreKey(q){const {autoFillet,filletBodyBottom,filletLidTop,filletVertical,requestedFilletRadius,requestedVerticalFilletRadius,requestedCapFilletRadius,filletRadius,capFilletReason,fillet,notes,...geometry}=q;return JSON.stringify(geometry);}

function closedCoilJoint(q,onProgress,preview){
 const key=JSON.stringify(q);let cached=jointCache.get(key);
 if(!cached){
  const coreKey=coilCoreKey(q);let core=coreJointCache.get(coreKey);
  if(!core){const parts=localParts(q,onProgress);core={parts};cacheJoint(coreJointCache,coreKey,core,2);}else onProgress?.({stage:'コイルと爪の形状を再利用しています'});
  let parts;
  if(q.autoFillet){onProgress?.({stage:'本体と蓋の外側の角を丸めています'});const rounded=filletCoilExteriors(core.parts[0],core.parts[1],q);parts=rounded.parts;q.fillet=rounded.analysis;if(q.filletBodyBottom||q.filletLidTop){if(rounded.analysis.capRadius<.05)q.notes.push('端面は丸められませんでした');else if(rounded.analysis.capRadius<q.filletRadius-1e-8)q.notes.push('端面のフィレット半径 '+q.filletRadius.toFixed(2)+' → '+rounded.analysis.capRadius.toFixed(2)+' mm');}if(q.profile&&q.filletVertical){if(rounded.analysis.verticalRadius>=.05){if(rounded.analysis.verticalRadius<q.requestedVerticalFilletRadius-1e-8)q.notes.push('縦角のフィレット半径 '+q.requestedVerticalFilletRadius.toFixed(2)+' → '+rounded.analysis.verticalRadius.toFixed(2)+' mm');}else q.notes.push('縦の角は丸められませんでした');}}
  else parts=core.parts.map(shape=>shape.clone());
  cached={parts,analysis:{...q,motion:{status:'pending',checks:[],checkedTurns:coilOpeningLimit(q)}}};cacheJoint(jointCache,key,cached,4);
 }
 if(!preview&&cached.analysis.motion.status!=='clear')cached.analysis.motion=checkMotion(cached.parts[0],cached.parts[1],q,onProgress);
 return cached;
}
export function makeCoilJoint(base,p,onProgress,{preview=false,preferredAxis}={}){
 const q=resolveCoilJoint(coilJointInfo(base,p,preferredAxis),p),opening=p.jointPose==='開閉スライダー'?coilOpening(q,preview?0:p.jointOpenTurns??0):null;if(opening&&p.flipLidToGrid)throw Error('開閉スライダーでは蓋を逆さに置けません。表示姿勢を変更してください');const cached=closedCoilJoint(q,onProgress,preview);
 onProgress?.({stage:'本体と蓋を配置しています'});let local=cached.parts.map(shape=>shape.clone());
 try{
  if(opening){if(!preview){const opened=screwLidPose(local[1],q,opening.turns);local[1].delete();local[1]=opened;}}
  else if(p.jointPose==='1回転開く'){const opened=screwLidPose(local[1],q,1);local[1].delete();local[1]=opened;}
  else if(p.jointPose==='分けて並べる'){const beside=besideBody(local[0],local[1]);local[1].delete();local[1]=beside;}
  else if(p.jointPose&&p.jointPose!=='閉じた状態')throw Error('表示する姿勢を選択してください');
  const frame=p.jointPose==='分けて並べる'?{...q,axis:[0,0,1],origin:[q.origin[0],q.origin[1],0]}:q,parts=local.map(shape=>place(shape,frame));
  if(p.flipLidToGrid){
   const beside=besideBody(parts[0],cached.parts[1]);parts[1].delete();parts[1]=beside;
  }
  return {parts,analysis:structuredClone(cached.analysis)};
 }finally{local.forEach(shape=>shape.delete());}
}

// Keep the closed pair's absolute thread phase and the original claw phase.
// Regenerating at a lower split would change their relative orientation.
export function makeCoilTestPiece(base,p,onProgress,{preview=false,preferredAxis}={}){
 const q=resolveCoilJoint(coilJointInfo(base,p,preferredAxis),p),cached=closedCoilJoint(q,onProgress,preview),bodyLow=Math.max(0,q.split-q.minimumSplit),lidTop=Math.min(q.height,q.split+q.minimumLidHeight),span=(q.outerRadius||q.radius)+1;
 const crop=(shape,low,high)=>{const tool=R.makeBox([-span,-span,low],[span,span,high]);try{return shape.intersect(tool);}finally{tool.delete();}};
 const closeHole=(shape,radius,z,height)=>{const disk=R.makeCylinder(radius,height,[0,0,z]);try{const joined=fuseSolid(shape,disk);if(!valid(joined)){joined.delete();throw Error('試し刷り用の底板を正常に作れませんでした');}return joined;}finally{disk.delete();}};
 let body,lid,placedBody,placedLid;
 try{
  onProgress?.({stage:'接合部分を残して試し刷り用に短くしています'});
  body=crop(cached.parts[0],bodyLow,q.height+1);if(bodyLow>1e-6){const next=closeHole(body,q.innerRadius+.05,bodyLow,q.wall+.01);body.delete();body=next;}
  lid=crop(cached.parts[1],q.split+q.seam-.1,lidTop);if(lidTop<q.height-1e-6){const next=closeHole(lid,q.boreRadius+.05,lidTop-q.wall-.01,q.wall+.01);lid.delete();lid=next;}
  const originalVolumes={body:R.measureVolume(cached.parts[0]),lid:R.measureVolume(cached.parts[1])},testVolumes={body:R.measureVolume(body),lid:R.measureVolume(lid)};originalVolumes.total=originalVolumes.body+originalVolumes.lid;testVolumes.total=testVolumes.body+testVolumes.lid;
  placedBody=body.clone().translate([0,0,-bodyLow]);placedLid=besideBody(placedBody,lid);
  const bodyBox=placedBody.boundingBox,lidBox=placedLid.boundingBox,flipped=lid.clone().rotate(180,[0,0,0],[1,0,0]),flipBox=flipped.boundingBox;
  let testPiece;
  try{const [bl,bh]=bodyBox.bounds,[ll,lh]=lidBox.bounds,[fl]=flipBox.bounds;testPiece={bodyLow,lidTop,bodyHeight:bh[2]-bl[2],lidHeight:lh[2]-ll[2],floorThickness:q.wall,spacing:ll[0]-bh[0],bodyTranslation:[0,0,-bodyLow],lidRotation:180,lidTranslation:ll.map((v,i)=>v-fl[i]),originalVolumes,testVolumes,originalVolume:originalVolumes.total,testVolume:testVolumes.total,savedPercent:100*(1-testVolumes.total/originalVolumes.total)};}finally{bodyBox.delete();lidBox.delete();flipBox.delete();flipped.delete();}
  return {parts:[placedBody,placedLid],analysis:{...structuredClone(cached.analysis),testPiece}};
 }catch(error){placedBody?.delete();placedLid?.delete();throw error;}finally{body?.delete();lid?.delete();}
}
