import * as R from 'replicad';
import * as THREE from 'three';
import {selectedCadFaces} from './face-pull.js';
// Recover circular section centers from exact surface evaluations, including tilted cones.
export function section(face,v){
 const pts=[.07,.38,.69].map(u=>{const p=face.pointOnSurface(u,v);try{return new THREE.Vector3(...p.toTuple());}finally{p.delete();}});
 const [p,q,r]=pts,a=q.clone().sub(p),b=r.clone().sub(p),cross=a.clone().cross(b),den=2*cross.lengthSq();
 if(den<1e-16)throw Error('内壁の円形断面を取得できません');
 const offset=cross.clone().cross(a).multiplyScalar(b.lengthSq()).add(b.clone().cross(cross).multiplyScalar(a.lengthSq())).divideScalar(den),center=p.clone().add(offset);
 return {center,r:offset.length()};
}
// The finite wall height keeps the cut above the cup floor.
export function interiorTool(reference,selection){
 const face=selectedCadFaces(reference,[selection])[0];
 try{
  if(!['CYLINDRE','CONE'].includes(face.geomType))throw Error('円筒または円錐の内壁を選択してください。自由曲面・平面にはまだ対応していません');
  const a=section(face,0),b=section(face,1),n=b.center.clone().sub(a.center),h=n.length();n.normalize();
  if(!(h>1e-6&&a.r>1e-6&&b.r>1e-6))throw Error('内壁の範囲を取得できません');
  const radial=new THREE.Vector3(...selection.point).sub(a.center);radial.addScaledVector(n,-radial.dot(n));
  const normal=face.normalAt(selection.point);try{if(new THREE.Vector3(...normal.toTuple()).dot(radial)>=-1e-6)throw Error('外壁が選択されています。容器の内側の壁を選択してください');}finally{normal.delete();}
  const u=radial.normalize(),planeNormal=u.clone().cross(n).normalize(),plane=new R.Plane(a.center.toArray(),u.toArray(),planeNormal.toArray());
  return R.draw([0,0]).lineTo([a.r,0]).lineTo([b.r,h]).lineTo([0,h]).close().sketchOnPlane(plane).revolve(n.toArray(),{origin:a.center.toArray(),angle:360});
 }finally{face.delete();}
}
export function trimInterior(target,reference,selection){
 if(!target||!reference||!selection?.point)throw Error('基準の内壁と切り取る対象ボディを選択してください');
 const tool=interiorTool(reference,selection);let result;
 try{
  result=target.cut(tool);
  const before=R.measureVolume(target),after=R.measureVolume(result);
  if(!(after>1e-7))throw Error('対象全体が内側に入っています。切り取るボディを選び直してください');
  if(before-after<Math.max(1e-7,before*1e-9))throw Error('選択した内壁の範囲には、取り除くはみ出しがありません');
  const check=new (R.getOC().BRepCheck_Analyzer)(result.wrapped,true,false);try{if(!check.IsValid())throw Error('有効な切り取り形状を作成できませんでした');}finally{check.delete();}
  return result;
 }catch(e){result?.delete();throw e;}finally{tool.delete();}
}
