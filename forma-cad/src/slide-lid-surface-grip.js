import * as R from 'replicad';
import {slideGripLayout} from './slide-grip-layout.js';
export function slideSurfaceGrip(lid,p,info,top,upper,hold,corners=null){
 if(p.surfaceGrip!==undefined&&typeof p.surfaceGrip!=='boolean')throw Error('滑り止めの設定を確認してください');
 if(!p.surfaceGrip)return {lid,surfaceGrip:null};
 if(p.grip)throw Error('滑り止めと爪掛け溝はどちらか一方を選択してください');
 const q=slideGripLayout(p,info,top,upper,corners),{offsetY,width,opening,depth,positions,zTop}=q;
 let plane;try{plane=new R.Plane([0,offsetY+width/2,0],[1,0,0],[0,-1,0]);const lip=opening/2*(1+.02/depth);for(const x of positions){const tool=hold(R.draw([x-lip,zTop+.02]).lineTo([x+lip,zTop+.02]).lineTo([x,zTop-depth]).close().sketchOnPlane(plane).extrude(width));lid=hold(lid.cut(tool));}return {lid,surfaceGrip:q};}finally{plane?.delete();}
}
