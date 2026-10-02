import {detentDimensions} from './coil-detent.js';
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]], add=(a,b)=>[a[0]+b[0],a[1]+b[1]], mul=(a,n)=>[a[0]*n,a[1]*n], len=a=>Math.hypot(...a), unit=a=>mul(a,1/len(a));
const turnProfile=(profile,degrees)=>{const angle=degrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);return profile.map(([x,y])=>[x*c-y*s,x*s+y*c]);};
function cornerData(profile){return profile.map((vertex,i)=>{const before=unit(sub(profile[(i+profile.length-1)%profile.length],vertex)),after=unit(sub(profile[(i+1)%profile.length],vertex)),angle=Math.acos(Math.max(-1,Math.min(1,before[0]*after[0]+before[1]*after[1])));return {vertex,before,after,cot:1/Math.tan(angle/2),centerScale:1/Math.sin(angle/2)};});}
function boundary(corners,radius){const segments=[];for(let i=0;i<corners.length;i++){const current=corners[i],next=corners[(i+1)%corners.length],center=add(current.vertex,mul(unit(add(current.before,current.after)),radius*current.centerScale)),startPoint=add(current.vertex,mul(current.before,radius*current.cot)),endPoint=add(current.vertex,mul(current.after,radius*current.cot)),start=Math.atan2(startPoint[1]-center[1],startPoint[0]-center[0]),end=Math.atan2(endPoint[1]-center[1],endPoint[0]-center[0]);let delta=end-start;while(delta>Math.PI)delta-=2*Math.PI;while(delta< -Math.PI)delta+=2*Math.PI;let previous=startPoint;for(let step=1;step<=32;step++){const theta=start+delta*step/32,point=step===32?endPoint:add(center,[radius*Math.cos(theta),radius*Math.sin(theta)]);segments.push([previous,point]);previous=point;}segments.push([endPoint,add(next.vertex,mul(next.before,radius*next.cot))]);}return segments;}
function distance(point,[a,b]){const v=sub(b,a),s=v[0]*v[0]+v[1]*v[1],t=s?Math.max(0,Math.min(1,((point[0]-a[0])*v[0]+(point[1]-a[1])*v[1])/s)):0;return len(sub(point,add(a,mul(v,t))));}
function inside(point,segments){let crossings=0;for(const [a,b] of segments)if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])crossings++;return crossings%2===1;}
function clearance(segments,{radius,start,end}){const steps=Math.max(128,Math.ceil((end-start)*480));let minimum=Infinity;for(let i=0;i<=steps;i++){const angle=start+(end-start)*i/steps,point=[radius*Math.cos(angle),radius*Math.sin(angle)];if(!inside(point,segments))return 0;for(const segment of segments)minimum=Math.min(minimum,distance(point,segment));}return minimum;}
export function ridgeVerticalFilletLimitDetail(q,requested){
 if(!q.profile||!q.jointLatch||q.latchStyle!=='ridge')return null;
 const d=detentDimensions(q),body=cornerData(q.profile),lid=cornerData(turnProfile(q.profile,q.closeAngle));
 const edgeLimit=Math.min(...body.map((corner,i)=>len(sub(q.profile[(i+1)%body.length],corner.vertex))/(corner.cot+body[(i+1)%body.length].cot)))*.999,maximum=Math.min(requested,edgeLimit);
 const edgeReason={type:'profile-edge',label:'多角形の辺長'};
 const angles=(a,b)=>q.leftHand?[-(d.phase+b),-(d.phase+a)]:[d.phase+a,d.phase+b],bodyAngles=angles(d.reliefStart,d.reliefEnd),lidAngles=angles(d.toothA-d.c/d.inner,d.toothB+d.c/d.inner);
 const footprints=[{name:'逃げ溝',corners:body,arc:{radius:d.reliefOuter,start:bodyAngles[0],end:bodyAngles[1]},minimum:Math.max(d.backing,1.5)},{name:'受け溝',corners:lid,arc:{radius:d.toothOuter+d.c,start:lidAngles[0],end:lidAngles[1]},minimum:d.backing}];
 const failing=radius=>footprints.filter(({corners,arc,minimum})=>clearance(boundary(corners,radius),arc)<minimum-1e-6);
 const wallReason=radius=>({type:'ridge-wall',label:(failing(radius).map(item=>item.name).join('・')||'逃げ溝・受け溝')+'の外壁厚確保'});
 if(maximum<.05)return {radius:0,reason:edgeReason};
 if(failing(.001).length)return {radius:0,reason:wallReason(.001)};
 if(!failing(maximum).length)return {radius:maximum,reason:maximum<requested-1e-8?edgeReason:null};
 let low=0,high=maximum;
 for(let i=0;i<16;i++){const middle=(low+high)/2;if(!failing(middle).length)low=middle;else high=middle;}
 return {radius:Math.max(0,low-.3),reason:wallReason(high)};
}
export function ridgeVerticalFilletLimit(q,requested){return ridgeVerticalFilletLimitDetail(q,requested)?.radius??null;}
