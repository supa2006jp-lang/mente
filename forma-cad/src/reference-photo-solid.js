import * as R from 'replicad';
import * as THREE from 'three';
import {basisFor,validateFrame} from './frames.js';

const tuple=p=>{try{return p.toTuple();}finally{p.delete();}},vec=p=>new THREE.Vector3(...p);
// Adaptive integration is necessary after circles become rational splines.
// The default non-adaptive properties can differ by more than 0.01%.
export function photoSolidVolume(shape){if(!(shape instanceof R.Solid)){const parts=shape.solids;try{if(!parts.length)return 0;}finally{parts.forEach(p=>p.delete());}}const oc=R.getOC(),p=new oc.GProp_GProps();try{const error=oc.BRepGProp.VolumePropertiesGK(shape.wrapped,p,1e-10,true,true,false,false,false);if(error<0||!Number.isFinite(p.Mass()))throw Error('ソリッドの体積を検証できませんでした');return Math.abs(p.Mass());}finally{p.delete();}}
function photoFaceArea(face){const oc=R.getOC(),p=new oc.GProp_GProps();try{oc.BRepGProp.SurfaceProperties(face.wrapped,p,1e-10,false);return Math.abs(p.Mass());}finally{p.delete();}}
export function photoFitSettings(photo){
 return {frame:structuredClone(photo.frame),offset:photo.offset,center:[...photo.center],width:photo.width,height:photo.height,angle:photo.angle,sourceAngle:photo.surface?.fittedAngle||0};
}
export function validatePhotoFit(p){
 validateFrame(p?.frame);
 if(![p.offset,p.width,p.height,p.angle,p.sourceAngle,...(p.center||[])].every(Number.isFinite)||p.center?.length!==2||p.width<.01||p.height<.01||p.width>10000||p.height>10000||Math.abs(p.offset)>10000||p.center.some(n=>Math.abs(n)>10000)||Math.abs(p.angle)>36000||Math.abs(p.sourceAngle)>36000)throw Error('写真の配置・サイズを確認してください');
 return p;
}
function faceDrawing(face,b){
 const surface=face.surface,plane=surface.wrapped.Plane(),origin=plane.Location(),ax=plane.XAxis(),ay=plane.YAxis(),x=ax.Direction(),y=ay.Direction();
 try{
  const u=vec([x.X(),x.Y(),x.Z()]),v=vec([y.X(),y.Y(),y.Z()]),o=vec([origin.X(),origin.Y(),origin.Z()]);let d=R.drawFaceOutline(face);
  if(u.clone().cross(v).dot(b.n)<0)d=d.mirror([1,0],[0,0],'plane');
  return d.rotate(Math.atan2(u.dot(b.v),u.dot(b.u))*180/Math.PI,[0,0]).translate(o.dot(b.u),o.dot(b.v));
 }finally{y.delete();x.delete();ay.delete();ax.delete();origin.delete();plane.delete();surface.delete();}
}
function capDrawing(face,b){
 let drawing=faceDrawing(face,b);const wires=face.clone().innerWires();
 try{for(const wire of wires){const hole=R.makeFace(wire.clone());try{drawing=drawing.cut(faceDrawing(hole,b));}finally{hole.delete();}}return drawing;}finally{wires.forEach(w=>w.delete());}
}
export function fitPhotoSolid(base,settings,onProgress){
 const p=validatePhotoFit(settings),b=basisFor(p),faces=base.faces;let original,remainder,extra,next;
 try{
  const caps=faces.filter(f=>f.geomType==='PLANE'&&vec(tuple(f.normalAt())).dot(b.n)>.999999&&Math.abs(vec(tuple(f.center)).dot(b.n)-p.offset)<1e-4);
  if(caps.length!==1)throw Error('写真を貼った平面を特定できません。ソリッドの面に写真を貼り直してください');
  const face=caps[0],area=photoFaceArea(face),baseVolume=photoSolidVolume(base),thickness=baseVolume/area;
  if(!Number.isFinite(thickness)||thickness<.01||thickness>10000)throw Error('ソリッドの厚みを確認してください');
  const plane=new R.Plane(b.n.clone().multiplyScalar(p.offset).toArray(),b.u.toArray(),b.n.toArray());
  try{
   onProgress?.({stage:'写真の面から元の断面と厚みを検証しています'});
   const drawing=capDrawing(face,b);original=drawing.clone().sketchOnPlane(plane).extrude(-thickness);
   remainder=base.cut(original);extra=original.cut(base);const allowance=Math.max(1e-6,baseVolume*1e-7);
   if(photoSolidVolume(remainder)+photoSolidVolume(extra)>allowance)throw Error('厚み方向に断面が変わる形状には対応していません。同じ断面が続く板・角柱・円柱を選んでください');
   const aligned=drawing.rotate(-p.sourceAngle,[0,0]),box=aligned.boundingBox;box.wrapped.SetGap(0);
   const bounds=box.bounds,center=box.center,width=bounds[1][0]-bounds[0][0],height=bounds[1][1]-bounds[0][1],sx=p.width/width,sy=p.height/height;
   box.delete();
   if(![sx,sy].every(n=>Number.isFinite(n)&&n>=.01&&n<=100))throw Error('写真に合わせる倍率が大きすぎます。幅・高さは元の1〜10000%の範囲にしてください');
   onProgress?.({stage:'写真の幅・高さに合わせてソリッドを作成しています'});
   next=aligned.translate(-center[0],-center[1]).stretch(sx,[0,1],[0,0]).stretch(sy,[1,0],[0,0]).rotate(p.angle,[0,0]).translate(p.center).sketchOnPlane(plane).extrude(-thickness);
   if(Math.abs(photoSolidVolume(next)-area*thickness*sx*sy)>Math.max(1e-6,area*thickness*sx*sy*1e-7))throw Error('写真サイズへの変更結果を検証できませんでした');
   const a=p.angle*Math.PI/180,s=-p.sourceAngle*Math.PI/180,c=Math.cos(a),d=Math.sin(a),cs=Math.cos(s),ss=Math.sin(s),matrix=[c*sx*cs-d*sy*ss,c*sx*-ss-d*sy*cs,d*sx*cs+c*sy*ss,d*sx*-ss+c*sy*cs,p.center[0]-c*sx*center[0]+d*sy*center[1],p.center[1]-d*sx*center[0]-c*sy*center[1]];
   const result={shape:next,info:{width:p.width,height:p.height,thickness,beforeWidth:width,beforeHeight:height,scale:[sx,sy],matrix,angle:p.angle}};next=null;return result;
  }finally{plane.delete();}
 }finally{next?.delete();extra?.delete();remainder?.delete();original?.delete();faces.forEach(f=>f.delete());}
}
export function fittedPhotoSurface(photo,info){
 const [a,b,c,d,x,y]=info.matrix,map=ring=>ring.map(([u,v])=>[a*u+b*v+x,c*u+d*v+y]);
 return {...photo,surface:{...photo.surface,outer:map(photo.surface.outer),holes:photo.surface.holes.map(map),fittedAngle:info.angle}};
}
