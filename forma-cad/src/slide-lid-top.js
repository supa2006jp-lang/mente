import * as R from 'replicad';
import {fuseSolid} from './solid-fuse.js';
export function topSlideLayout({length:L,width:W,height:H},p){
 const {wall:w,lidThickness:t,clearance:g,railDepth:d,cover}=p,S=W/2-w,k=g*(Math.SQRT2-1),bodyHeight=H-t-g,capLower=H-t,upper=bodyHeight-cover,railCore=2*d+1.2+2*k,lower=upper-railCore-2*g,root=S-k,tip=S+d-g,low=lower+g,high=upper-g,stemWidth=1.8,stemOuter=S-g,stemInner=stemOuter-stemWidth;
 if(2*stemInner<2)throw Error('蓋裏のレールを入れる幅が足りません。元の直方体を広げるか壁を薄くしてください');
 // Every outward expansion rises at 45 degrees with the cap face on the print bed.
 const right=[[stemInner,low],[root,low],[tip,lower+d+k],[tip,upper-d-k],[root,high],[stemOuter,high+root-stemOuter],[stemOuter,capLower+.05],[stemInner,capLower+.05]],left=right.map(([y,z])=>[-y,z]).reverse();
 return {bodyHeight,capLower,capUpper:H,upper,lower,railCore,tipHeight:1.2,stemWidth,right,left,railFront:-L/2+g,railBack:L/2-w-g,capFront:-L/2,capBack:L/2,printFlipped:true};
}
export function topSlideBlank(q,{length:L,width:W},section,hold,corners=null){
 let lid=hold(corners?R.drawRoundedRectangle(L,W,corners.radius).sketchOnPlane("XY",q.capLower).extrude(q.capUpper-q.capLower):R.makeBox([q.capFront,-W/2,q.capLower],[q.capBack,W/2,q.capUpper]));
 for(const points of [q.right,q.left])lid=hold(fuseSolid(lid,hold(section(points,q.railFront,q.railBack))));return lid;
}
export function topSlideSweep(q,{width:W},travel,section,hold){
 let swept=hold(R.makeBox([q.capFront-travel,-W/2,q.capLower],[q.capBack,W/2,q.capUpper]));for(const points of [q.right,q.left])swept=hold(swept.fuse(hold(section(points,q.railFront-travel,q.railBack))));return swept;
}
export function topSlideGrip(lid,q,{width:W},p,hold){
 const width=Math.min(18,W-3),depth=Math.min(.8,p.lidThickness-1.2);if(depth<.05)return {lid,grip:null};let plane;
 try{plane=new R.Plane([0,width/2,0],[1,0,0],[0,-1,0]);const tool=hold(R.draw([q.capFront-.02,q.capUpper+.02]).lineTo([q.capFront+depth,q.capUpper+.02]).lineTo([q.capFront-.02,q.capUpper-depth]).close().sketchOnPlane(plane).extrude(width));return {lid:hold(lid.cut(tool)),grip:{width,length:depth,depth,type:'frontBevel'}};}finally{plane?.delete();}
}

export function slideFinishingOptions(p,{length:L,width:W},top){
 for(const flag of ['leadIn','roundLidCorners'])if(p[flag]!==undefined&&typeof p[flag]!=='boolean')throw Error('面取り・蓋の角丸の設定を確認してください');
 let leadIn=null,lidCorners=null;
 if(p.leadIn){const requested=p.leadInSize??.6;if(!Number.isFinite(requested)||requested<.1||requested>2)throw Error('差し込みの面取りは0.1〜2 mmで指定してください');leadIn={requested,entrance:Math.max(0,Math.min(requested,p.wall-p.railDepth-1.2,p.wall/2)),ridge:Math.min(requested,p.railDepth-.3,(L-2*p.wall)/4)};}
 if(p.roundLidCorners){if(!top)throw Error('蓋の四隅の角丸は上面を覆う蓋で使用できます');const requestedRadius=p.lidCornerRadius??2;if(!Number.isFinite(requestedRadius)||requestedRadius<.1||requestedRadius>1000)throw Error('蓋の角丸の半径は0.1〜1000 mmで指定してください');lidCorners={requestedRadius,radius:Math.min(requestedRadius,p.wall+p.clearance-.3,L/4,W/4)};}
 return {leadIn,lidCorners};
}
export function slideLeadIn(body,lid,p,info,top,lower,hold,q){
 if(!q)return {body,lid};const {length:L,width:W,height:H}=info,S=W/2-p.wall,front=-L/2,back=L/2-p.wall-p.clearance;
 const prism=(points,z0,z1)=>{let d=R.draw(points[0]);for(const point of points.slice(1))d=d.lineTo(point);return hold(d.close().sketchOnPlane('XY',z0).extrude(z1-z0));};
 for(const side of [-1,1]){
  if(q.entrance>1e-6){const c=q.entrance,y=S+p.railDepth;const tool=prism([[front-.02,side*(y-.02)],[front-.02,side*(y+c+.02)],[front+c+.02,side*(y-.02)]],lower,H+.02);body=hold(body.cut(tool));}
  // The far end enters first. Only trim the outer ridge, leaving its stem and cap intact.
  const c=q.ridge,y=S+p.railDepth-p.clearance;const tool=prism([[back-c-.02,side*(y+.02)],[back+.02,side*(y+.02)],[back+.02,side*(y-c-.02)]],lower-.02,top?top.capLower:info.height+.02);lid=hold(lid.cut(tool));
 }
 return {body,lid};
}
