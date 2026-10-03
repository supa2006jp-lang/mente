import * as R from 'replicad';
import * as THREE from 'three';
import {svgWrapPieces} from './svg-wrap-pattern.js';
import {fuseSolid} from './solid-fuse.js';
export function svgCylinderInfo(base,point){
 if(!base||!Array.isArray(point)||point.length!==3||!point.every(Number.isFinite))throw Error('円柱の側面を先に選択してください');
 const faces=base.faces,vertex=R.makeVertex(point),cylinders=[];let seed;
 try{
  for(const face of faces){if(face.geomType!=='CYLINDRE')continue;const surface=face.surface,cyl=surface.wrapped.Cylinder(),loc=cyl.Location(),dir=cyl.Axis().Direction();
   try{const axis=new THREE.Vector3(dir.X(),dir.Y(),dir.Z()),origin=new THREE.Vector3(loc.X(),loc.Y(),loc.Z()),bounds=face.UVBounds,entry={face,axis,origin,bounds,radius:cyl.Radius()};cylinders.push(entry);if(!seed&&R.measureDistanceBetween(vertex,face)<.02)seed=entry;}finally{surface.delete();cyl.delete();loc.delete();dir.delete();}
  }
  if(!seed)throw Error('円柱の側面を先に選択してください');
  const axis=seed.axis.clone(),dominant=axis.toArray().reduce((a,v,i)=>Math.abs(v)>Math.abs(axis.getComponent(a))?i:a,0);if(axis.getComponent(dominant)<0)axis.negate();
  const line=seed.origin.clone().addScaledVector(axis,-seed.origin.dot(axis)),range=c=>[c.bounds.vMin,c.bounds.vMax].map(v=>c.origin.clone().addScaledVector(c.axis,v).dot(axis)).sort((a,b)=>a-b),[low,high]=range(seed);
  const delta=new THREE.Vector3(...point).sub(line),radial=delta.addScaledVector(axis,-delta.dot(axis)),normal=seed.face.normalAt(point);try{if(new THREE.Vector3(...normal.toTuple()).dot(radial)<0)throw Error('SVG巻き付けは円柱の外側の側面を選択してください');}finally{normal.delete();}
  const x=new THREE.Vector3(Math.abs(axis.x)<.9?1:0,Math.abs(axis.x)<.9?0:1,0);x.addScaledVector(axis,-x.dot(axis)).normalize();const y=axis.clone().cross(x),intervals=[],tau=Math.PI*2;
  for(const c of cylinders){if(Math.abs(c.radius-seed.radius)>1e-5||Math.abs(c.axis.dot(axis))<.999999||c.origin.clone().sub(line).addScaledVector(axis,-c.origin.dot(axis)).length()>1e-5)continue;const [a,b]=range(c);if(Math.abs(a-low)>1e-4||Math.abs(b-high)>1e-4)continue;
   const center=c.face.pointOnSurface(.5,.5);let d;try{d=new THREE.Vector3(...center.toTuple()).sub(line);}finally{center.delete();}const span=Math.min(tau,c.bounds.uMax-c.bounds.uMin),mid=Math.atan2(d.dot(y),d.dot(x)),start=((mid-span/2)%tau+tau)%tau;intervals.push([start,Math.min(tau,start+span)]);if(start+span>tau)intervals.push([0,start+span-tau]);
  }
  intervals.sort((a,b)=>a[0]-b[0]);let covered=0;for(const [a,b]of intervals){if(a>covered+1e-4)break;covered=Math.max(covered,b);}if(covered<tau-1e-4)throw Error('1周ある円柱の側面を選択してください');
  return {radius:seed.radius,height:high-low,origin:line.addScaledVector(axis,low).toArray(),axis:axis.toArray().map(v=>Object.is(v,-0)?0:v)};
 }finally{vertex.delete();for(const face of faces)face.delete();}
}
function curvedFace(reference,region,angle,height,offset){
 const sketch=ring=>{const p=ring.map(([x,y])=>[x*Math.PI*2+angle,y*height+offset]);let drawing=R.draw(p[0]);for(const q of p.slice(1))drawing=drawing.lineTo(q);return drawing.close().sketchOnFace(reference,'native');};
 const outer=sketch(region.outer);let face=outer.face();outer.delete();
 for(const hole of region.holes){const inner=sketch(hole),wire=inner.wires(),next=R.addHolesInFace(face,[wire]);face.delete();wire.delete();inner.delete();face=next;}
 if(face.orientation!==reference.orientation){const next=face.flipOrientation();face.delete();face=next;}return face;
}
export function wrapSvgSolid(base,spec,onProgress){
 const info=svgCylinderInfo(base,spec.surfacePoint),{radius}=info;
 if(!Number.isFinite(spec.depth)||spec.depth<.01||spec.depth>Math.min(10,radius*.8))throw Error('凹凸の深さは0.01 mm以上、半径の80%以下で指定してください');
 if(!Number.isFinite(spec.height)||spec.height<=0||!Number.isFinite(spec.offset)||spec.offset<0||spec.offset+spec.height>info.height+.0001)throw Error('模様の高さと下端の位置を円柱の側面内に収めてください');
 if(!Number.isFinite(spec.angle)||!['mirror','single','repeat'].includes(spec.seam)||!['emboss','engrave'].includes(spec.operation))throw Error('巻き付け設定を確認してください');
 if(!Array.isArray(spec.pattern)||!spec.pattern.length||spec.pattern.length>80||spec.pattern.some(r=>!Array.isArray(r.outer)||!Array.isArray(r.holes)||[r.outer,...r.holes].some(ring=>ring.length<3||ring.length>2500||ring.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v)||v<-.0001||v>1.0001)))))throw Error('SVG図案のデータを確認してください');
 if(spec.pattern.reduce((count,r)=>count+[r.outer,...r.holes].reduce((n,ring)=>n+ring.length,0),0)>2500)throw Error('図案が細かすぎます。輪郭を減らしてください');
 if(spec.seam==='repeat'&&(!Number.isInteger(spec.repeatCount)||spec.repeatCount<1||spec.repeatCount>24))throw Error('繰り返し回数は1〜24の整数にしてください');
 const pieces=svgWrapPieces(spec.pattern,spec.seam,spec.repeatCount),cylinder=R.makeCylinder(radius,info.height),reference=cylinder.faces.find(f=>f.geomType==='CYLINDRE'),oc=R.getOC();let result=base.clone();
 try{for(const [index,piece]of pieces.entries()){
  onProgress?.({stage:'SVGを円柱に巻き付けています',current:index+1,total:pieces.length});
  const face=curvedFace(reference,piece,spec.angle*Math.PI/180,spec.height,spec.offset),builder=new oc.BRepOffsetAPI_MakeThickSolid();let tool,placed;
  try{builder.MakeThickSolidBySimple(face.wrapped,spec.operation==='engrave'?-spec.depth:spec.depth);tool=R.cast(builder.Shape()).asShape3D();if(R.measureVolume(tool)<0){const corrected=R.cast(tool.wrapped.Reversed()).asShape3D();tool.delete();tool=corrected;}
   const axis=new THREE.Vector3(...info.axis),z=new THREE.Vector3(0,0,1),turn=z.angleTo(axis)*180/Math.PI,rotation=z.clone().cross(axis);if(rotation.lengthSq()<1e-16)rotation.set(1,0,0);else rotation.normalize();
   placed=tool.clone().rotate(turn,[0,0,0],rotation.toArray()).translate(info.origin);const next=spec.operation==='engrave'?result.cut(placed):fuseSolid(result,placed);result.delete();result=next;
  }finally{placed?.delete();tool?.delete();face.delete();builder.delete();}
 }
 const check=new oc.BRepCheck_Analyzer(result.wrapped,true,false);try{if(!check.IsValid()||!(R.measureVolume(result)>0))throw Error('この図案と深さでは正常な形状を作れません。深さを小さくしてください');}finally{check.delete();}
 if(Math.abs(R.measureVolume(result)-R.measureVolume(base))<1e-7)throw Error('図案がボディと重なっていません');
 return {shape:result,info};
 }catch(error){result.delete();throw error;}finally{reference.delete();cylinder.delete();}
}
