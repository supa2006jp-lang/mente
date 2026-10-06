import * as R from 'replicad';
import {slideDividerLayout} from './slide-divider-layout.js';
import {filletSnapEnd,filletSnapOutside} from './snap-lid-fillet.js';
const positive=(v,label,min=.05,max=1000)=>{if(!Number.isFinite(v)||v<min||v>max)throw Error(label+'は'+min+'〜'+max+' mmで指定してください');return v;};
export function slideLidOptions(p,{length:L,width:W,height:H},lower){
 for(const key of ['lock','filletInside','filletOutside','divider'])if(p[key]!==undefined&&typeof p[key]!=='boolean')throw Error('オプションの設定を確認してください');
 const length=L-2*p.wall,width=W-2*p.wall,range=[[-length/2,-width/2],[length/2,width/2]];let divider=null,pockets=[range];
 if(p.divider){
  const layout=slideDividerLayout(p,length,width),{compartments,direction,thickness,index,positions,offsets,compartmentWidths}=layout;
  pockets=Array.from({length:compartments},(_,i)=>{const a=[...range[0]],b=[...range[1]],span=layout.span;a[index]=i===0?-span/2:positions[i-1]+thickness/2;b[index]=i===compartments-1?span/2:positions[i]-thickness/2;return [a,b];});
  divider={compartments,direction,thickness,sizing:layout.sizing,requestedWidths:layout.requestedWidths,offsets,positions,compartmentWidths,zMin:p.floor,zMax:lower,height:lower-p.floor,lidClearance:p.clearance};
 }
 let fillet=null;
 if(p.filletInside||p.filletOutside){
  const requestedInner=p.filletInside?positive(p.innerFilletRadius??1,'内側のフィレット半径'):0,requestedOuter=p.filletOutside?positive(p.outerFilletRadius??1,'外側のフィレット半径'):0;
  const innerRadius=Math.min(requestedInner,...pockets.flatMap(([a,b])=>[(b[0]-a[0])/4,(b[1]-a[1])/4]),(lower-p.floor)/2),outerRadius=Math.max(0,Math.min(requestedOuter,p.floor-1.2,(p.wall-p.railDepth-1.2)/(Math.SQRT2-1),Math.min(L,W)/4));
  if(p.filletInside&&innerRadius<.05||p.filletOutside&&outerRadius<.05)throw Error('フィレットを入れる余裕がありません。壁厚・底厚・収納部分を大きくしてください');
  fillet={requestedInnerRadius:requestedInner,requestedOuterRadius:requestedOuter,innerRadius,innerEndRadius:innerRadius,outerRadius,compartments:pockets.length,innerBottomEdges:0,outerEdges:0};
 }
 const lockHeight=p.lock?positive(p.lockHeight??.35,'抜け止めの掛かり',.1,.6):0;
 if(p.lock&&(p.wall/2<p.clearance+lockHeight+.13||p.wall/2-p.clearance-lockHeight-p.clearance*Math.SQRT2-.05<.6))throw Error('抜け止めを内側に収める壁厚が足りません。壁厚を増やすか掛かり・すき間を小さくしてください');
 const lockThickness=p.lidStyle==='top'?2*p.railDepth+1.2+2*p.clearance*(Math.SQRT2-1):p.lidThickness;
 if(p.lock&&lockThickness-lockHeight-p.clearance*Math.SQRT2<1.2-1e-6)throw Error('抜け止めの溝の上に1.2 mm以上の蓋厚が必要です。蓋を厚くするか掛かりを小さくしてください');
 return {pockets,divider,fillet,lockHeight};
}
export function slideOuterFillet(shape,q){return filletSnapOutside(shape,0,q.outerRadius);}
export function slidePocket([a,b],floor,top,q){
 const r=q?.innerRadius??0;let tool=r?R.drawRoundedRectangle(b[0]-a[0],b[1]-a[1],r).sketchOnPlane('XY',floor).extrude(top-floor).translate([(a[0]+b[0])/2,(a[1]+b[1])/2,0]):R.makeBox([...a,floor],[...b,top]);
 if(r){try{const rounded=filletSnapEnd(tool,floor,q.innerEndRadius);tool.delete();tool=rounded.shape;q.innerBottomEdges+=rounded.edges;}catch(error){tool.delete();throw error;}}
 return tool;
}
function triangle(x,z,r,y,width){let plane;try{plane=new R.Plane([0,y+width/2,0],[1,0,0],[0,-1,0]);return R.draw([x-r,z-r]).lineTo([x+r,z-r]).lineTo([x,z]).close().sketchOnPlane(plane).extrude(width);}finally{plane?.delete();}}
export function slideLock(body,lid,p,{length:L,width:W,lockCenters,lockWidth,lockThickness=p.lidThickness},lower){
 const g=p.clearance,h=p.lockHeight??.35,S=W/2-p.wall,x=-L/2+p.wall/2,low=lower+g,peak=low+h,width=lockWidth??Math.min(6,2*S-2),centers=lockCenters??(2*S>=18?[-S+4,S-4]:[0]),owned=[],hold=s=>(owned.push(s),s);let outBody,outLid;
 try{
  for(const y of centers){const bump=hold(triangle(x,peak,g+h+.08,y,width)),groovePeak=peak+g*Math.SQRT2,groove=hold(triangle(x,groovePeak,groovePeak-low+.05,y,width+2*g));outBody=hold((outBody||body).fuse(bump));outLid=hold((outLid||lid).cut(groove));}
  return {body:outBody.clone(),lid:outLid.clone(),analysis:{height:h,width,count:centers.length,x,ys:centers,peak,grooveDepth:h+g*Math.SQRT2,remainingLid:lockThickness-h-g*Math.SQRT2,requiredFlex:Math.max(0,h-g),slidingContact:0}};
 }finally{owned.reverse().forEach(s=>s.delete());}
}
