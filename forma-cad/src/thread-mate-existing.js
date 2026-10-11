import * as R from 'replicad';
import * as THREE from 'three';
import {allThreadPullSpec} from './thread-pull-spec.js';
import {fuseSolid} from './solid-fuse.js';
import {threadCylinderInfo} from './thread-cylinder.js';

// Validate the placement against CAD geometry as well as the viewport hit.
export function machineThreadMate(features,spec,info,{bodies,run}){
 const placement=spec.placement;
 if(!placement||placement.bodyId===spec.target)throw Error('元のねじとは別の加工先ボディを選択してください');
 if(!['point','normal'].every(k=>Array.isArray(placement[k])&&placement[k].length===3&&placement[k].every(Number.isFinite)))throw Error('加工する平面上の位置を指定してください');
 const point=new THREE.Vector3(...placement.point),normal=new THREE.Vector3(...placement.normal);
 if(Math.abs(normal.length()-1)>1e-5)throw Error('加工面の方向が不正です');
 const current=bodies(features),resources=[],hold=shape=>(resources.push(shape),shape);
 try{
  const base=current.get(placement.bodyId);if(!base)throw Error('加工先ボディがありません');
  const vertex=hold(R.makeVertex(point.toArray())),faces=base.faces;let found=false;
  try{for(const face of faces){if(face.geomType!=='PLANE'||R.measureDistanceBetween(vertex,face)>1e-4)continue;const n=face.normalAt(point.toArray());try{if(new THREE.Vector3(...n.toTuple()).normalize().dot(normal)>.99999){found=true;break;}}finally{n.delete();}}}finally{faces.forEach(f=>f.delete());}
  if(!found)throw Error('配置点が加工先の平面上にありません。面を選択し直してください');
  const direction=normal.clone().multiplyScalar(info.internal?-1:1),radius=info.diameter/2;
  const cylinder=(r,length,start=0)=>hold(R.makeCylinder(r,length,point.clone().addScaledVector(direction,start).toArray(),direction.toArray()));
  // A fully supported section avoids detached male threads or open, partial holes.
  const support=info.internal?cylinder(radius+.1+info.clearance,info.length-.0002,.0001):hold(R.makeCylinder(radius,.02,point.clone().addScaledVector(normal,-.021).toArray(),normal.toArray()));
  const contact=hold(base.intersect(support)),expected=R.measureVolume(support);
  if(expected-R.measureVolume(contact)>Math.max(1e-5,expected*1e-5))throw Error(info.internal?'指定した径・深さのねじ穴を囲む材料が不足しています。位置か長さを変更してください':'ねじの根元全体を支える平面が必要です。面の内側へ位置を移動してください');
  const tool=cylinder(radius,info.length+.01,-.01);
  const prepared=hold(info.internal?base.cut(tool):fuseSolid(base,tool));
  const before=R.measureVolume(base),after=R.measureVolume(prepared);
  if(!Number.isFinite(after)||after<=0||(info.internal?before-after:after-before)<1e-7)throw Error('指定位置に相手ねじを加工できません');
  const output={id:placement.bodyId,brep:prepared.serialize(),...prepared.mesh({tolerance:.08,angularTolerance:.15})};
  const intermediate={kind:'cadop',id:spec.id+'-prepare',name:'相手ねじの下地',outputs:[output],remove:[]};
  const u=(Math.abs(direction.x)<.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0));u.addScaledVector(direction,-u.dot(direction)).normalize();
  const surfacePoint=point.clone().addScaledVector(direction,info.length/2).addScaledVector(u,radius).toArray(),selected=threadCylinderInfo(prepared,surfacePoint);
  if(!selected)throw Error('相手ねじの下地となる円筒面を作成できません');
  const a=selected.normal.toArray(),dominant=a.reduce((best,v,i)=>Math.abs(v)>Math.abs(a[best])?i:best,0);
  if(a[dominant]<0){selected.origin.addScaledVector(selected.normal,selected.height);selected.normal.negate();selected.fromTop=!selected.fromTop;}
  const start=Math.min(point.clone().sub(selected.origin).dot(selected.normal),point.clone().addScaledVector(direction,info.length).sub(selected.origin).dot(selected.normal));
  const offset=Math.max(0,selected.fromTop?selected.height-start-info.length:start);
  let thread={type:'thread',target:placement.bodyId,surfacePoint,pitch:info.pitch,fullLength:false,length:info.length,offset,leftHand:info.leftHand,profile:'metric60',threadVersion:2,modeled:true,designation:info.designation};
  if(info.clearance)thread=allThreadPullSpec(thread,-info.clearance);
  const result=run([...features,intermediate],thread),shape=hold(R.deserializeShape(result.outputs[0].brep).asShape3D()),check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);
  try{if(!check.IsValid())throw Error('相手ねじの加工後の形状が不正です。位置や寸法を変更してください');}finally{check.delete();}
  const solids=shape.solids,oldSolids=base.solids;try{if(solids.length!==oldSolids.length)throw Error('相手ねじの加工でボディが分離します。位置や長さを変更してください');}finally{solids.forEach(s=>s.delete());oldSolids.forEach(s=>s.delete());}
  return {...result,analysis:{...info,placement:'existing',bodyId:placement.bodyId,position:point.toArray(),direction:direction.toArray()}};
 }finally{resources.reverse().forEach(shape=>shape.delete());current.forEach(b=>b.delete());}
}
