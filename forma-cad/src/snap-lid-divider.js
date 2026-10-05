import * as R from 'replicad';
import {snapLidSides} from './snap-lid-opening.js';
import {roundSnapProfile} from './snap-lid-fillet.js';

export function snapLidDividerSettings(face,p,info){
 if(p.divider!==undefined&&typeof p.divider!=='boolean')throw Error('仕切りの設定を確認してください');
 if(!p.divider)return null;
 const thickness=p.dividerThickness??2.4,direction=p.dividerDirection??'short',compartments=p.dividerCompartments??2;
 if(!Number.isInteger(compartments)||compartments<2||compartments>4)throw Error('収納部分は2〜4分割で指定してください');
 const offsets=p.dividerOffsets??Array(compartments-1).fill(0);
 if(!Array.isArray(offsets)||offsets.length!==compartments-1||!offsets.every(Number.isFinite))throw Error('各仕切りの位置を正しい数値で指定してください');
 if(!Number.isFinite(thickness)||thickness<1.2)throw Error('仕切りの厚さは0.6 mmノズル用に1.2 mm以上にしてください');
 if(!['short','long'].includes(direction))throw Error('仕切りの向きを選択してください');
 let sides;try{sides=snapLidSides(face);}catch{throw Error('仕切りは四角い箱で使用できます。別の輪郭ではオフにしてください');}
 const side=sides.reduce((a,b)=>(direction==='short'?b.length<a.length-1e-6:b.length>a.length+1e-6)?b:a);
 const center=sides.reduce((sum,s)=>[sum[0]+s.center[0]/4,sum[1]+s.center[1]/4],[0,0]);
 const across=Math.max(...sides.map(s=>Math.abs((s.center[0]-center[0])*side.normal[0]+(s.center[1]-center[1])*side.normal[1])))*2;
 const along=Math.max(...sides.map(s=>Math.abs((s.center[0]-center[0])*side.tangent[0]+(s.center[1]-center[1])*side.tangent[1])))*2;
 const innerWidth=across-2*p.bodyWall,span=along-2*p.bodyWall,equalWidth=(innerWidth-(compartments-1)*thickness)/compartments;
 const positions=offsets.map((offset,i)=>-innerWidth/2+(i+1)*equalWidth+(i+.5)*thickness+offset);
 const compartmentWidths=Array.from({length:compartments},(_,i)=>(i===compartments-1?innerWidth/2:positions[i]-thickness/2)-(i===0?-innerWidth/2:positions[i-1]+thickness/2));
 const compartmentWidth=Math.min(...compartmentWidths);
 if(compartmentWidth<1.2||span<1.2)throw Error('仕切りを入れる空間が足りません。位置を戻すか、仕切り・本体壁厚を小さくしてください');
 return {thickness,direction,compartments,offsets:[...offsets],positions,compartmentWidths,innerWidth,center,tangent:side.tangent,normal:side.normal,span,outerSpan:along+2,height:info.bodyHeight-p.floor+p.insertion,zMin:info.lowerMin+p.floor,zMax:info.seam+p.insertion,compartmentWidth};
}

export function makeSnapLidDivider(q){
 // Reserve strips inside the cavity, joining floor and walls up to the neck top.
 const parts=[];
 try{
  for(const position of q.positions??[0])parts.push(R.makeBox([-q.outerSpan/2,-q.thickness/2,q.zMin-.02],[q.outerSpan/2,q.thickness/2,q.zMax])
   .rotate(Math.atan2(q.tangent[1],q.tangent[0])*180/Math.PI,[0,0,0],[0,0,1])
   .translate([q.center[0]+q.normal[0]*position,q.center[1]+q.normal[1]*position,0]));
  if(parts.length===1)return parts.pop();
  return R.makeCompound(parts.map(part=>part.clone())).asShape3D();
 }finally{parts.forEach(part=>part.delete());}
}

// Round every compartment's wall junctions for the full body/neck height.
export function roundSnapCompartmentProfiles(face,tool,radius,compartments=2){
 let vector,slice,divided;const result=[];let faces=[];
 try{
  const center=face.center;let z;try{z=center.toTuple()[2];}finally{center.delete();}
  vector=new R.Vector([0,0,.02]);slice=R.basicFaceExtrusion(face,vector);divided=slice.cut(tool);faces=divided.faces;
  for(const f of faces){if(f.geomType!=='PLANE')continue;const center=f.center;let atZ;try{atZ=center.toTuple()[2];}finally{center.delete();}if(Math.abs(atZ-z)<1e-5)result.push(roundSnapProfile(f,radius));}
  if(result.length!==compartments)throw Error('指定した数の収納部分を作れません');
  return result;
 }catch{for(const f of result)f.delete();throw Error('仕切りの接合部を丸められません。位置やフィレット半径を調整してください');}
 finally{faces.forEach(f=>f.delete());divided?.delete();slice?.delete();vector?.delete();}
}
