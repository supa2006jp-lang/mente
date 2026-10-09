import {ballJointThreadDimensions} from './ball-joint-thread.js';
const round=v=>Number(v.toFixed(3));
export const ballJointFixSizes=[[3,.5],[4,.7],[5,.8],[6,1],[8,1.25],[10,1.5],[12,1.75],[16,2]];
// Explicit per-side values take precedence; old shared dimensions migrate to both sides.
export function ballJointFixDimensions(values,role,fallback={}){
 const prefix=role==='ball'?'fixBall':'fixSocket';
 return Object.fromEntries(['Diameter','Pitch','Depth','Chamfer','ChamferSize'].map(key=>[key[0].toLowerCase()+key.slice(1),values[prefix+key]!==undefined?values[prefix+key]:values['fix'+key]!==undefined?values['fix'+key]:fallback[prefix+key]]));
}
export function ballJointFixSettings(values={},fallback={}){
 return Object.fromEntries(['ball','socket'].flatMap(role=>Object.entries(ballJointFixDimensions(values,role,fallback)).map(([key,value])=>[(role==='ball'?'fixBall':'fixSocket')+key[0].toUpperCase()+key.slice(1),value])));
}
export function ballJointFixChamferDimensions(diameter,pitch,size){
 const wallRadius=diameter/2+.2,endRadius=diameter/2-.6*pitch;
 return {entryRadius:wallRadius+size,endRadius,leadDepth:wallRadius+size-endRadius};
}
export const ballJointMountPitches=[.7,.75,.8,1,1.25,1.5,1.75,2,2.5,3,3.5,4,5];
function dimensions(s){
 const r=s.ballDiameter/2,core=r+s.clearance+s.wall,mouthRadius=r*.94,mouth=s.splitPosition-Math.sqrt((r+s.clearance)**2-mouthRadius**2),coneEnd=s.splitPosition+r*.15,root=s.splitPosition+r+s.wall,lowerEnd=s.splitPosition-r-s.neckLength,coneDepth=Math.min(1.2,s.wall*.5,core-mouthRadius-1.2),coneHeight=coneEnd-mouth,contactTravel=s.coneClearance*coneHeight/coneDepth,clampingTravel=(s.coneClearance+s.clearance)*coneHeight/coneDepth;
 // Keep the ball/socket and helical thread phase identical to the original joint.
 // Shorten only the nut's shoulder end to permit additional axial tightening.
 const t=ballJointThreadDimensions(s),baseAvailableTravel=s.printSafe?(s.threadClearance+s.clearance)*coneHeight/coneDepth+.3:2*s.threadPitch-.15,threadStart=coneEnd+(s.printSafe?baseAvailableTravel+.15:2*s.threadPitch),baseNutTop=s.printSafe?Math.max(root,threadStart+2.25*s.threadPitch):root,socketTop=s.printSafe?baseNutTop+baseAvailableTravel+.15:root+2*s.threadPitch,threadLength=baseNutTop-coneEnd,nutBottom=mouth-.6,nutTop=baseNutTop-s.extraClampTravel,availableTravel=baseAvailableTravel+s.extraClampTravel,extraClampMax=Math.max(0,Math.min(1.5,baseNutTop-threadStart-2*s.threadPitch));
 return {extraClampMax,r,core,mouthRadius,mouth,coneEnd,root,lowerEnd,coneDepth,coneHeight,contactTravel,clampingTravel,threadStart,nutTop,availableTravel,socketTop,threadLength,nutBottom,depth:t.depth,threadProfile:t,clampReserve:(availableTravel-clampingTravel)*coneDepth/coneHeight};
}
export function ballJointDefaults(info){
 const radius=Math.min(info.radius*.65,info.height*.18),wall=Math.max(1.8,round(radius*.3));
 const s={splitPosition:round(info.height/2),ballDiameter:round(radius*2),neckDiameter:round(Math.max(2.5,radius*.8)),neckLength:2.5,clearance:.25,wall,threadPitch:Math.max(.8,round(radius*.25)),threadClearance:.25,coneClearance:.1,extraClampTravel:0,slotWidth:1,slotCount:4,nutWall:2,pose:'print',printSafe:true,threadNozzle:.6,mountThread:false,mountSide:'both',mountClearance:.15,fixHole:false,fixSide:'both'};
 s.threadPitch=ballJointThreadDimensions(s).minPitch;
 const d=dimensions(s),mountLength=Math.max(1,Math.floor(Math.min(6,d.lowerEnd-1.2,info.height-d.socketTop-1.2)*10)/10);
 return {...s,...ballJointFixSettings({fixDiameter:6,fixPitch:1,fixDepth:Math.max(.1,mountLength),fixChamfer:false,fixChamferSize:.3}),mountPitch:ballJointMountPitches.filter(p=>p<=Math.min(1.5,mountLength/2.5)).at(-1)||.7,mountLength};
}
export function ballJointSettings(info,p){
 const defaults=ballJointDefaults(info),s={...defaults,...p,...ballJointFixSettings(p,defaults),printSafe:p.printSafe??false};
 // Saved joints without the separate seat gap retain their original geometry.
 if(p.coneClearance===undefined)s.coneClearance=s.threadClearance;
 if(!s.printSafe&&p.threadPitch===undefined)s.threadPitch=Math.max(.8,round(Math.min(info.radius*.65,info.height*.18)*.25));
 for(const [key,min,max,label]of [['splitPosition',.1,10000,'分割位置'],['ballDiameter',6,120,'球の直径'],['neckDiameter',2,100,'首の直径'],['neckLength',1,50,'首の長さ'],['clearance',.05,.8,'球と受けの片側すき間'],['wall',1.2,10,'受けの厚さ'],['threadPitch',.6,8,'ねじピッチ'],['threadClearance',.1,.6,'ねじの片側すき間'],['coneClearance',.02,.6,'締め付け面の片側すき間'],['extraClampTravel',0,1.5,'追加締め代'],['slotWidth',.6,3,'切り込み幅'],['nutWall',1.6,10,'ナットの厚さ']])if(!Number.isFinite(s[key])||s[key]<min||s[key]>max)throw Error(label+'を '+min+'〜'+max+' mmで指定してください');
 if(![4,6].includes(s.slotCount))throw Error('切り込みの数は4・6本から選択してください');if(!['print','assembled','exploded'].includes(s.pose))throw Error('配置を選択してください');
 if(typeof s.mountThread!=='boolean')throw Error('取付ねじの設定を確認してください');
 if(!['ball','socket','both'].includes(s.mountSide))throw Error('取付ねじを付ける土台を選択してください');
 if(s.mountThread)for(const [key,min,max,label]of [['mountPitch',.6,5,'取付ねじピッチ'],['mountLength',1,100,'取付ねじの長さ'],['mountClearance',0,.6,'取付ねじの片側すき間']])if(!Number.isFinite(s[key])||s[key]<min||s[key]>max)throw Error(label+'を '+min+'〜'+max+' mmで指定してください');
 if(typeof s.fixHole!=='boolean')throw Error('固定用ねじ穴の設定を確認してください');
 if(!['ball','socket','both'].includes(s.fixSide))throw Error('固定用ねじ穴を付ける側を選択してください');
 if(typeof s.printSafe!=='boolean'||![.4,.6,.8].includes(s.threadNozzle))throw Error('印刷向けねじの設定を確認してください');
 const d=dimensions(s),{r,core,mouthRadius,mouth,coneEnd,root,lowerEnd,coneDepth,threadLength,depth,threadStart,socketTop,nutTop,nutBottom,coneHeight,contactTravel,clampingTravel,availableTravel,threadProfile}=d;
 if(s.extraClampTravel>d.extraClampMax+1e-7)throw Error('追加締め代を '+Math.max(0,Math.floor(d.extraClampMax*100)/100)+' mm以下にしてください（ねじの重なる長さを2巻き以上残します）');
 if(s.printSafe&&depth-s.threadClearance<s.threadNozzle*.5-1e-7)throw Error('ねじのすき間が大きすぎて山がかみ合いません。片側すき間を小さくしてください');
 if(s.printSafe&&s.threadPitch<threadProfile.minPitch-1e-7)throw Error('印刷向けの太いねじはピッチ '+threadProfile.minPitch.toFixed(2)+' mm以上にしてください。「ノズルに合わせる」で設定できます');
 if(s.neckDiameter>s.ballDiameter*.65||s.neckDiameter>info.radius*1.8)throw Error('首の直径を球径の65%以下、元の円柱径より小さくしてください');
 if(lowerEnd<2||socketTop>info.height-2)throw Error('球と受けを収める長さが足りません。分割位置を変えるか、球径・首の長さ・受け厚さを小さくしてください（両端に2 mm以上必要です）');
 if(!s.printSafe&&threadLength<4*s.threadPitch+.3)throw Error('ねじの長さが足りません。ピッチを '+round((threadLength-.3)/4)+' mm以下にするか、球径を大きくしてください');
 const mouthWall=core-coneDepth-mouthRadius;if(mouthWall<1.2)throw Error('受け口の厚さが足りません。受けの厚さを増やしてください');
 if(clampingTravel+.2>availableTravel)throw Error('ナットの締め代が足りません。ねじのすき間を小さくするか、ピッチを大きくしてください');
 if(s.slotWidth*s.slotCount>Math.PI*mouthRadius)throw Error('切り込みが広すぎます。幅か本数を小さくしてください');
 const mountingThreads=[];
 if(s.mountThread){
  if(!ballJointMountPitches.includes(s.mountPitch)||s.mountPitch>=info.radius)throw Error('取付ねじピッチは一覧から、土台の半径より小さい値を選んでください');
  if(s.mountLength<2*s.mountPitch+.2)throw Error('取付ねじは2巻き以上必要です。長さを増やすかピッチを小さくしてください');
  if(s.mountLength/s.mountPitch>20)throw Error('取付ねじは20巻き以内にしてください');
  const rootRadius=info.radius-s.mountClearance-s.mountPitch*.561266;
  if(rootRadius<1.2)throw Error('土台径に対して取付ねじのピッチ・すき間が大きすぎます');
  for(const [role,height,start]of [['ball',lowerEnd,0],['socket',info.height-socketTop,info.height-s.mountLength]])if(s.mountSide===role||s.mountSide==='both'){
   if(s.mountLength>height-1.2+1e-7)throw Error((role==='ball'?'球側':'受け側')+'の土台が短すぎます。取付ねじの長さを '+Math.max(0,Math.floor((height-1.2)*10)/10)+' mm以下にするか、分割位置・球径を調整してください（根元に1.2 mmを確保します）');
   mountingThreads.push({role,diameter:info.radius*2,actualDiameter:2*(info.radius-s.mountClearance),rootDiameter:rootRadius*2,pitch:s.mountPitch,length:s.mountLength,clearance:s.mountClearance,turns:s.mountLength/s.mountPitch,start,rightHand:true});
  }
 }
 const fixingHoles=[];
 if(s.fixHole){
  for(const [role,height,start]of [['ball',lowerEnd,0],['socket',info.height-socketTop,info.height]])if(s.fixSide===role||s.fixSide==='both'){
   const {diameter,pitch,depth:holeDepth,chamfer,chamferSize}=ballJointFixDimensions(s,role),label=role==='ball'?'球側':'受け側';
   for(const [value,min,max,name]of [[diameter,3,40,'固定ねじの呼び径'],[pitch,.5,5,'固定ねじのピッチ'],[holeDepth,.1,100,'固定ねじ穴の深さ']])if(!Number.isFinite(value)||value<min||value>max)throw Error(label+'の'+name+'を '+min+'〜'+max+' mmで指定してください');
   if(pitch>=diameter/2)throw Error(label+'の固定ねじのピッチを呼び径の半分より小さくしてください');
   if(holeDepth<2*pitch+.2)throw Error(label+'の固定ねじ穴は2巻き以上必要です。深さを増やすかピッチを小さくしてください');
   if(holeDepth/pitch>20)throw Error(label+'の固定ねじ穴は20巻き以内にしてください');
   if(holeDepth>height-1.2+1e-7)throw Error(label+'の固定ねじ穴が深すぎます。深さを '+Math.max(0,Math.floor((height-1.2)*10)/10)+' mm以下にしてください（穴底に1.2 mmを残します）');
   const outside=mountingThreads.some(t=>t.role===role)?info.radius-s.mountClearance-s.mountPitch*.561266:info.radius;
   if(outside-diameter/2-.2<1.2)throw Error(label+'の固定ねじ穴の周囲が薄すぎます。呼び径を小さくしてください（外周に1.2 mmを残します）');
   if(typeof chamfer!=='boolean')throw Error(label+'の入口の面取り設定を確認してください');
   const lead=chamfer?ballJointFixChamferDimensions(diameter,pitch,chamferSize):null;
   if(chamfer){
    if(!Number.isFinite(chamferSize)||chamferSize<.1||chamferSize>5)throw Error(label+'の面取り幅を 0.1〜5 mmで指定してください');
    if(outside-lead.entryRadius<1.2-1e-7)throw Error(label+'の面取り後の入口が薄すぎます。面取り幅か呼び径を小さくしてください（外周に1.2 mmを残します）');
    if(holeDepth-lead.leadDepth<pitch+.2-1e-7)throw Error(label+'の面取り後のねじが短すぎます。面取り幅を小さくするか、穴の深さを増やしてください（面取りの奥に1巻き以上を残します）');
   }
   fixingHoles.push({role,diameter,pitch,depth:holeDepth,pull:-.2,wallDiameter:diameter+.4,start,rightHand:true,chamfer,chamferSize:chamfer?chamferSize:0,entryDiameter:2*(lead?.entryRadius??diameter/2+.2),leadDepth:lead?.leadDepth??0});
  }
 }
 return {...s,...d,mountingThreads,fixingHoles,nutRadius:core+depth+s.threadClearance+s.nutWall+.7};
}
