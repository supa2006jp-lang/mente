import * as R from 'replicad';
import {fuseSolid} from './solid-fuse.js';
export function topSlideLayout({length:L,width:W,height:H},p){
 const {wall:w,lidThickness:t,clearance:g,railDepth:d,cover}=p,S=W/2-w,k=g*(Math.SQRT2-1),bodyHeight=H-t-g,capLower=H-t,upper=bodyHeight-cover,railCore=2*d+1.2+2*k,lower=upper-railCore-2*g,root=S-k,tip=S+d-g,low=lower+g,high=upper-g,stemWidth=1.8,stemOuter=S-g,stemInner=stemOuter-stemWidth;
 if(2*stemInner<2)throw Error('蓋裏のレールを入れる幅が足りません。元の直方体を広げるか壁を薄くしてください');
 // Every outward expansion rises at 45 degrees with the cap face on the print bed.
 const right=[[stemInner,low],[root,low],[tip,lower+d+k],[tip,upper-d-k],[root,high],[stemOuter,high+root-stemOuter],[stemOuter,capLower+.05],[stemInner,capLower+.05]],left=right.map(([y,z])=>[-y,z]).reverse();
 return {bodyHeight,capLower,capUpper:H,upper,lower,railCore,tipHeight:1.2,stemWidth,right,left,railFront:-L/2+g,railBack:L/2-w-g,capFront:-L/2,capBack:L/2,printFlipped:true};
}
export function topSlideBlank(q,{length:L,width:W},section,hold){
 let lid=hold(R.makeBox([q.capFront,-W/2,q.capLower],[q.capBack,W/2,q.capUpper]));
 for(const points of [q.right,q.left])lid=hold(fuseSolid(lid,hold(section(points,q.railFront,q.railBack))));return lid;
}
export function topSlideSweep(q,{width:W},travel,section,hold){
 let swept=hold(R.makeBox([q.capFront-travel,-W/2,q.capLower],[q.capBack,W/2,q.capUpper]));for(const points of [q.right,q.left])swept=hold(swept.fuse(hold(section(points,q.railFront-travel,q.railBack))));return swept;
}
export function topSlideGrip(lid,q,{width:W},p,hold){
 const width=Math.min(18,W-3),depth=Math.min(.8,p.lidThickness-1.2);if(depth<.05)return {lid,grip:null};let plane;
 try{plane=new R.Plane([0,width/2,0],[1,0,0],[0,-1,0]);const tool=hold(R.draw([q.capFront-.02,q.capUpper+.02]).lineTo([q.capFront+depth,q.capUpper+.02]).lineTo([q.capFront-.02,q.capUpper-depth]).close().sketchOnPlane(plane).extrude(width));return {lid:hold(lid.cut(tool)),grip:{width,length:depth,depth,type:'frontBevel'}};}finally{plane?.delete();}
}
