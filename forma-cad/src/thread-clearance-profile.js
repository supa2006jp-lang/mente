import {offsetThreadProfile} from './thread-pull.js';

// A geometric tolerance, not a printer/nozzle limit. Keep a nonzero ridge
// protruding into the bore and a nonzero attachment to its cylindrical wall.
const minimumRidge=.001;
export function threadClearanceProfile(pitch,root,previous,distance){
 if(![pitch,root,previous,distance].every(Number.isFinite)||pitch<=0||root<=0||distance<0)throw Error('すき間用のねじ寸法が不正です');
 const points=[[pitch*.02,-pitch*.45],[-pitch*.541266,-pitch*.125],[-pitch*.541266,pitch*.125],[pitch*.02,pitch*.45]];
 const lead=Math.sqrt(1+(pitch/(2*Math.PI*root))**2);
 const clearanceAt=gap=>gap*lead+Math.max(.0001,gap*.0001)+previous;
 function ridgeAt(gap){
  const clearance=clearanceAt(gap);let profile;
  try{profile=offsetThreadProfile(points,[-clearance,-clearance,-clearance,Math.max(0,clearance)]);}catch{return null;}
  const height=clearance-Math.min(...profile.map(point=>point[0])),crossings=[];
  for(let i=0;i<profile.length;i++){
   const a=profile[i],b=profile[(i+1)%profile.length];
   if((a[0]<=clearance&&b[0]>=clearance)||(a[0]>=clearance&&b[0]<=clearance)){
    if(Math.abs(b[0]-a[0])<1e-12)crossings.push(a[1],b[1]);
    else crossings.push(a[1]+(b[1]-a[1])*(clearance-a[0])/(b[0]-a[0]));
   }
  }
  const width=crossings.length?Math.max(...crossings)-Math.min(...crossings):0;
  return height>=minimumRidge&&width>=minimumRidge?{clearance,height,width}:null;
 }
 // Only cheap 2D intersections are searched. The expensive helix is built once.
 let low=0,high=Math.max(pitch,Math.abs(previous)*2);
 while(ridgeAt(high))high*=2;
 if(ridgeAt(0))for(let i=0;i<48;i++){const middle=(low+high)/2;if(ridgeAt(middle))low=middle;else high=middle;}
 const ridge=ridgeAt(distance),maxGap=Math.floor(low*1000)/1000;
 if(!ridge)throw Error('このすき間では受け側のねじ山が残りません。ピッチ '+pitch+' mm・現在のねじ形状では、すき間を約 '+maxGap+' mm 以下にしてください（計算上の目安）。');
 return {...ridge,pitch,maxGap,minimumRidge};
}
