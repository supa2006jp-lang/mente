const round=v=>Number(v.toFixed(3));
export const ballJointMountPitches=[.7,.75,.8,1,1.25,1.5,1.75,2,2.5,3,3.5,4,5];
export function ballJointDefaults(info){const radius=Math.min(info.radius*.65,info.height*.18),wall=Math.max(1.8,round(radius*.3)),pitch=Math.max(.8,round(radius*.25)),mountLength=Math.max(1,Math.floor(Math.min(6,info.height/2-radius-2.5-1.2,info.height/2-radius-wall-2*pitch-1.2)*10)/10);return {splitPosition:round(info.height/2),ballDiameter:round(radius*2),neckDiameter:round(Math.max(2.5,radius*.8)),neckLength:2.5,clearance:.25,wall,threadPitch:pitch,threadClearance:.25,slotWidth:1,slotCount:4,nutWall:2,pose:'print',mountThread:false,mountSide:'both',mountPitch:ballJointMountPitches.filter(p=>p<=Math.min(1.5,mountLength/2.5)).at(-1)||.7,mountLength,mountClearance:.15};}
export function ballJointSettings(info,p){
 const defaults=ballJointDefaults(info),s={...defaults,...p};
 for(const [key,min,max,label]of [['splitPosition',.1,10000,'分割位置'],['ballDiameter',6,120,'球の直径'],['neckDiameter',2,100,'首の直径'],['neckLength',1,50,'首の長さ'],['clearance',.05,.8,'球と受けの片側すき間'],['wall',1.2,10,'受けの厚さ'],['threadPitch',.6,5,'ねじピッチ'],['threadClearance',.1,.6,'ねじの片側すき間'],['slotWidth',.6,3,'切り込み幅'],['nutWall',1.6,10,'ナットの厚さ']])if(!Number.isFinite(s[key])||s[key]<min||s[key]>max)throw Error(label+'を '+min+'〜'+max+' mmで指定してください');
 if(![4,6].includes(s.slotCount))throw Error('切り込みの数は4・6本から選択してください');if(!['print','assembled','exploded'].includes(s.pose))throw Error('配置を選択してください');
 if(typeof s.mountThread!=='boolean')throw Error('取付ねじの設定を確認してください');
 if(!['ball','socket','both'].includes(s.mountSide))throw Error('取付ねじを付ける土台を選択してください');
 if(s.mountThread)for(const [key,min,max,label]of [['mountPitch',.6,5,'取付ねじピッチ'],['mountLength',1,100,'取付ねじの長さ'],['mountClearance',0,.6,'取付ねじの片側すき間']])if(!Number.isFinite(s[key])||s[key]<min||s[key]>max)throw Error(label+'を '+min+'〜'+max+' mmで指定してください');
 const r=s.ballDiameter/2,core=r+s.clearance+s.wall,mouthRadius=r*.94,mouth=s.splitPosition-Math.sqrt((r+s.clearance)**2-mouthRadius**2),coneEnd=s.splitPosition+r*.15,root=s.splitPosition+r+s.wall,lowerEnd=s.splitPosition-r-s.neckLength,coneDepth=Math.min(1.2,s.wall*.5,core-mouthRadius-1.2),threadLength=root-coneEnd,depth=s.threadPitch*.5,threadStart=coneEnd+2*s.threadPitch,socketTop=root+2*s.threadPitch,nutTop=root,nutBottom=mouth-.6;
 if(s.neckDiameter>s.ballDiameter*.65||s.neckDiameter>info.radius*1.8)throw Error('首の直径を球径の65%以下、元の円柱径より小さくしてください');
 if(lowerEnd<2||socketTop>info.height-2)throw Error('球と受けを収める長さが足りません。分割位置を変えるか、球径・首の長さ・受け厚さを小さくしてください（両端に2 mm以上必要です）');
 if(threadLength<4*s.threadPitch+.3)throw Error('ねじの長さが足りません。ピッチを '+round((threadLength-.3)/4)+' mm以下にするか、球径を大きくしてください');
 const mouthWall=core-coneDepth-mouthRadius;if(mouthWall<1.2)throw Error('受け口の厚さが足りません。受けの厚さを増やしてください');
 const coneHeight=coneEnd-mouth,contactTravel=s.threadClearance*coneHeight/coneDepth,clampingTravel=(s.threadClearance+s.clearance)*coneHeight/coneDepth,availableTravel=2*s.threadPitch-.15;
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
 return {...s,mountingThreads,r,core,mouthRadius,mouth,coneEnd,root,lowerEnd,coneDepth,coneHeight,threadLength,depth,threadStart,socketTop,nutTop,nutBottom,nutRadius:core+depth+s.threadClearance+s.nutWall+.7,contactTravel,clampingTravel,availableTravel};
}
