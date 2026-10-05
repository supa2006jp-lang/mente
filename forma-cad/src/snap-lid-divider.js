import * as R from 'replicad';
import {snapLidSides} from './snap-lid-opening.js';

export function snapLidDividerSettings(face,p,info){
 if(p.divider!==undefined&&typeof p.divider!=='boolean')throw Error('中央仕切りの設定を確認してください');
 if(!p.divider)return null;
 const thickness=p.dividerThickness??2.4,direction=p.dividerDirection??'short';
 if(!Number.isFinite(thickness)||thickness<1.2)throw Error('仕切りの厚さは0.6 mmノズル用に1.2 mm以上にしてください');
 if(!['short','long'].includes(direction))throw Error('仕切りの向きを選択してください');
 let sides;try{sides=snapLidSides(face);}catch{throw Error('中央仕切りは四角い箱で使用できます。別の輪郭ではオフにしてください');}
 const side=sides.reduce((a,b)=>(direction==='short'?b.length<a.length-1e-6:b.length>a.length+1e-6)?b:a);
 const center=sides.reduce((sum,s)=>[sum[0]+s.center[0]/4,sum[1]+s.center[1]/4],[0,0]);
 const across=Math.max(...sides.map(s=>Math.abs((s.center[0]-center[0])*side.normal[0]+(s.center[1]-center[1])*side.normal[1])))*2;
 const along=Math.max(...sides.map(s=>Math.abs((s.center[0]-center[0])*side.tangent[0]+(s.center[1]-center[1])*side.tangent[1])))*2;
 const compartmentWidth=(across-2*p.bodyWall-thickness)/2,span=along-2*p.bodyWall;
 if(compartmentWidth<1.2||span<1.2)throw Error('仕切りを入れる空間が足りません。仕切り・本体壁厚を小さくするか箱を大きくしてください');
 return {thickness,direction,center,tangent:side.tangent,normal:side.normal,span,outerSpan:along+2,height:info.bodyHeight-p.floor+p.insertion,zMin:info.lowerMin+p.floor,zMax:info.seam+p.insertion,compartmentWidth};
}

export function makeSnapLidDivider(q){
 // Reserve material within the cavity, joining the existing floor and walls.
 // Continue to the inner wall top, clipped by the body and neck envelopes.
 return R.makeBox([-q.outerSpan/2,-q.thickness/2,q.zMin-.02],[q.outerSpan/2,q.thickness/2,q.zMax])
  .rotate(Math.atan2(q.tangent[1],q.tangent[0])*180/Math.PI,[0,0,0],[0,0,1])
  .translate([q.center[0],q.center[1],0]);
}
