import * as R from 'replicad';
import * as THREE from 'three';
import {selectedCadFaces} from './face-pull.js';
import {section} from './trim-interior.js';

export function surfaceTrimTool(target,reference,selection,side='通常'){
 if(!target||!reference||!selection?.point)throw Error('基準面と切り取るボディを選択してください');
 if(!['通常','反転'].includes(side))throw Error('削る側を選択してください');
 const face=selectedCadFaces(reference,[selection])[0];
 try{
  const v=face.normalAt(selection.point),normal=new THREE.Vector3(...v.toTuple()).normalize();v.delete();if(side==='反転')normal.negate();
  if(face.geomType==='PLANE'){
   // The plane is extended across the target, irrespective of its trimmed outline.
   const p=face.pointOnSurface(.5,.5),origin=new THREE.Vector3(...p.toTuple());p.delete();
   const bounds=target.boundingBox;let span;try{const [lo,hi]=bounds.bounds,a=new THREE.Vector3(...lo),b=new THREE.Vector3(...hi);span=a.distanceTo(b)+origin.distanceTo(a.clone().add(b).multiplyScalar(.5))+1;}finally{bounds.delete();}
   return R.drawRectangle(span*2,span*2).sketchOnPlane(new R.Plane(origin.toArray(),undefined,normal.toArray())).extrude(span);
  }
  if(!['CYLINDRE','CONE'].includes(face.geomType))throw Error('平面・円筒面・円錐面を選択してください。球面や自由曲面にはまだ対応していません');
  const a=section(face,0),b=section(face,1),n=b.center.clone().sub(a.center),h=n.length();n.normalize();
  if(!(h>1e-6&&a.r>1e-6&&b.r>1e-6))throw Error('基準面の範囲を取得できません');
  const radial=new THREE.Vector3(...selection.point).sub(a.center);radial.addScaledVector(n,-radial.dot(n));
  const inward=normal.dot(radial)<0,u=radial.normalize(),plane=new R.Plane(a.center.toArray(),u.toArray(),u.clone().cross(n).toArray());
  const inner=R.draw([0,0]).lineTo([a.r,0]).lineTo([b.r,h]).lineTo([0,h]).close().sketchOnPlane(plane).revolve(n.toArray(),{origin:a.center.toArray(),angle:360});
  if(inward)return inner;
  // Remove only the outside within this wall's height; preserve geometry above/below it.
  let envelope;const bounds=target.boundingBox;
  try{
   const [lo,hi]=bounds.bounds;let radius=Math.max(a.r,b.r);
   for(const x of [lo[0],hi[0]])for(const y of [lo[1],hi[1]])for(const z of [lo[2],hi[2]]){const d=new THREE.Vector3(x,y,z).sub(a.center);radius=Math.max(radius,d.addScaledVector(n,-d.dot(n)).length());}
   envelope=R.makeCylinder(radius+1,h,a.center.toArray(),n.toArray());return envelope.cut(inner);
  }finally{bounds.delete();envelope?.delete();inner.delete();}
 }finally{face.delete();}
}

export function trimSurface(target,reference,selection,side='通常'){
 const tool=surfaceTrimTool(target,reference,selection,side);let result;
 try{
  result=target.cut(tool);const before=R.measureVolume(target),after=R.measureVolume(result);
  if(!(after>1e-7))throw Error('対象全体が削る側にあります。削る側を反転するか、対象ボディを選び直してください');
  if(before-after<Math.max(1e-7,before*1e-9))throw Error('指定した側には取り除く部分がありません。削る側または対象を変更してください');
  const check=new (R.getOC().BRepCheck_Analyzer)(result.wrapped,true,false);try{if(!check.IsValid())throw Error('有効な切り取り形状を作成できませんでした');}finally{check.delete();}
  return result;
 }catch(e){result?.delete();throw e;}finally{tool.delete();}
}
