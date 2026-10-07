import * as R from 'replicad';
import {slideGripLayout} from './slide-grip-layout.js';
export function slideSurfaceGrip(lid,p,info,top,upper,hold,corners=null){
 if(p.surfaceGrip!==undefined&&typeof p.surfaceGrip!=='boolean')throw Error('滑り止めの設定を確認してください');
 if(!p.surfaceGrip)return {lid,surfaceGrip:null};
 if(p.grip)throw Error('滑り止めと爪掛け溝はどちらか一方を選択してください');
 const q=slideGripLayout(p,info,top,upper,corners),{opening,depth,zTop}=q;
 // Every segment has a 45-degree V cross section; crossings never cut deeper.
 const lip=opening/2*(1+.02/depth);
 for(const {start,end} of q.segments){
  const length=Math.hypot(end[0]-start[0],end[1]-start[1]),ux=(end[0]-start[0])/length,uy=(end[1]-start[1])/length;
  const plane=new R.Plane([start[0],start[1],0],[-uy,ux,0],[ux,uy,0]);
  try{const tool=hold(R.draw([-lip,zTop+.02]).lineTo([lip,zTop+.02]).lineTo([0,zTop-depth]).close().sketchOnPlane(plane).extrude(length));lid=hold(lid.cut(tool));}
  finally{plane.delete();}
 }
 return {lid,surfaceGrip:q};
}
