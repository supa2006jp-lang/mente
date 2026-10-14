import * as R from 'replicad';
import * as THREE from 'three';
import {fuseSolid} from './solid-fuse.js';

export const simpleBossDefaults={diameter:6,length:4,clearance:.2,extendInside:true};
export function validateSimpleBoss(p){
 if(p.extendInside!==undefined&&typeof p.extendInside!=='boolean')throw Error('内側への自動延長の設定が不正です');
 if(!['male','female'].includes(p.role))throw Error('簡易ボスのオス・メスを選択してください');
 for(const [key,min,max,label] of [['diameter',1,50,'棒の直径'],['length',1,100,'差し込み長さ'],['clearance',0,1,'片側のすき間']])if(!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw Error(label+'を'+min+'〜'+max+' mmで指定してください');
 if(!['point','normal'].every(key=>Array.isArray(p[key])&&p[key].length===3&&p[key].every(v=>Number.isFinite(v)&&Math.abs(v)<=10000))||Math.abs(Math.hypot(...p.normal)-1)>1e-5)throw Error('ソリッドの平面上の位置を指定してください');
 return p;
}

export function makeSimpleBoss(source,p){
 validateSimpleBoss(p);if(!source)throw Error('簡易ボスを追加するソリッドを選択してください');
 const owned=[],hold=s=>(owned.push(s),s),point=new THREE.Vector3(...p.point),normal=new THREE.Vector3(...p.normal);let output;
 try{
  const base=hold(R.deserializeShape(source.serialize()).asShape3D());
  const vertex=hold(R.makeVertex(p.point)),faces=base.faces;let found=false;
  try{for(const face of faces){if(face.geomType!=='PLANE'||R.measureDistanceBetween(vertex,face)>1e-4)continue;
   const n=face.normalAt(p.point);try{const actual=new THREE.Vector3(...n.toTuple()).normalize();if(Math.abs(actual.dot(normal))>.99999){normal.copy(actual);found=true;break;}}finally{n.delete();}
  }}finally{faces.forEach(f=>f.delete());}
  if(!found)throw Error('配置点がソリッドの平面上にありません。紫グリッドの面の内側を選択してください');
  const inward=normal.clone().negate(),radius=p.diameter/2,holeRadius=radius+p.clearance,depth=p.length+p.clearance,floor=1.2,wall=1.6,lead=Math.min(.4,radius*.25,p.length*.2);let extendedInside=false,prepared=base;
  const cylinder=(r,h,dir,start=0)=>hold(R.makeCylinder(r,h,point.clone().addScaledVector(dir,start).toArray(),dir.toArray()));
  const contained=tool=>{const hit=hold(base.intersect(tool)),expected=R.measureVolume(tool);return expected-R.measureVolume(hit)<=Math.max(1e-5,expected*1e-5);};
  // Keep a closed socket with a printable bottom and surrounding material.
  // Male roots overlap the body, rather than merely touching the surface.
  const support=p.role==='female'?cylinder(holeRadius+1.2,depth+floor-.001,inward,.001):cylinder(radius,.049,inward,.001);
  if(!contained(support)){
   if(p.role==='male')throw Error('棒の根元全体を支える平面がありません。面の内側に位置を移してください');
   if(p.extendInside===false)throw Error('穴の周囲・底に1.2 mmの材料を残せません。内側への自動延長をオンにするか、位置・長さ・径を変更してください');
   if(!contained(cylinder(holeRadius+wall,.019,inward,.001)))throw Error('受け筒の根元を支える面が不足しています。面の内側に位置を移すか、棒径を小さくしてください');
   prepared=hold(fuseSolid(base,cylinder(holeRadius+wall,depth+floor,inward)));extendedInside=true;
  }
  if(p.role==='male'){
   const stem=cylinder(radius,p.length-lead+.05,normal,-.05),u=new THREE.Vector3(Math.abs(normal.x)<.9?1:0,Math.abs(normal.x)<.9?0:1,0);u.addScaledVector(normal,-u.dot(normal)).normalize();
   const a=new R.Plane(point.clone().addScaledVector(normal,p.length-lead).toArray(),u.toArray(),normal.toArray()),b=new R.Plane(point.clone().addScaledVector(normal,p.length).toArray(),u.toArray(),normal.toArray());
   const tip=hold(R.drawCircle(radius).sketchOnPlane(a).loftWith(R.drawCircle(radius-lead).sketchOnPlane(b),{ruled:true})),rod=hold(fuseSolid(stem,tip));output=fuseSolid(base,rod);
  }else{const tool=cylinder(holeRadius,depth+.01,inward,-.01);output=prepared.cut(tool);}
  const check=new (R.getOC().BRepCheck_Analyzer)(output.wrapped,true,false),solids=output.solids,originalSolids=base.solids;
  try{if(!check.IsValid()||solids.length!==originalSolids.length)throw Error('簡易ボスを正常なソリッドにできません。位置や寸法を変更してください');}finally{check.delete();solids.forEach(s=>s.delete());originalSolids.forEach(s=>s.delete());}
  const before=R.measureVolume(p.role==='female'?prepared:base),after=R.measureVolume(output);if(!Number.isFinite(after)||(p.role==='male'?after-before:before-after)<1e-7)throw Error('簡易ボスを追加できません。位置や寸法を変更してください');
  const result={shape:output,analysis:{role:p.role,point:p.point,normal:normal.toArray(),diameter:p.diameter,length:p.length,clearance:p.clearance,holeDiameter:p.diameter+2*p.clearance,holeDepth:depth,bottomThickness:floor,extendedInside,receiverDepth:depth+floor,receiverWall:wall}};output=null;return result;
 }finally{output?.delete();owned.reverse().forEach(s=>s.delete());}
}
