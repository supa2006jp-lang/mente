import * as R from 'replicad';
import {snapLidSides} from './snap-lid-opening.js';
import {roundSnapProfile} from './snap-lid-fillet.js';

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

// Use each compartment's outline so its new wall junctions are rounded for
// the entire height, including the neck. Bottom fillets are applied afterward.
export function roundSnapCompartmentProfiles(face,tool,radius){
 let vector,slice,divided;const result=[];let faces=[];
 try{
  const center=face.center;let z;try{z=center.toTuple()[2];}finally{center.delete();}
  vector=new R.Vector([0,0,.02]);slice=R.basicFaceExtrusion(face,vector);divided=slice.cut(tool);faces=divided.faces;
  for(const f of faces){if(f.geomType!=='PLANE')continue;const center=f.center;let atZ;try{atZ=center.toTuple()[2];}finally{center.delete();}if(Math.abs(atZ-z)<1e-5)result.push(roundSnapProfile(f,radius));}
  if(result.length!==2)throw Error('収納部分を2つの空間にできません');
  return result;
 }catch{for(const f of result)f.delete();throw Error('仕切りの接合部を丸められません。フィレット半径を小さくしてください');}
 finally{faces.forEach(f=>f.delete());divided?.delete();slice?.delete();vector?.delete();}
}
