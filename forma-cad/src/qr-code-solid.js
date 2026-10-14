import * as R from 'replicad';
import * as THREE from 'three';
import {fuseSolids} from './solid-fuse.js';
import {qrCodeLayout,validateQrPlacement} from './qr-code-layout.js';

export function makeQrCode(p,onProgress){
 validateQrPlacement(p);const layout=qrCodeLayout(p),parts=[];let shape;
 try{
  parts.push(R.makeBox([-p.size/2,-p.size/2,0],[p.size/2,p.size/2,1]));
  for(const r of layout.rectangles)parts.push(R.makeBox([r.x,r.y,.98],[r.x+r.width,r.y+r.height,2]));
  onProgress?.({stage:'QRコードの土台と模様を一体にしています'});shape=fuseSolids(parts,{onProgress});
  const frame=new THREE.Matrix4().makeBasis(...['u','v','n'].map(k=>new THREE.Vector3(...p.frame[k]))),q=new THREE.Quaternion().setFromRotationMatrix(frame),angle=2*Math.acos(THREE.MathUtils.clamp(q.w,-1,1)),axis=new THREE.Vector3(q.x,q.y,q.z);
  if(angle>1e-8)shape=shape.rotate(angle*180/Math.PI,[0,0,0],axis.normalize().toArray());shape=shape.translate(p.point);
  const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;
  try{if(!check.IsValid()||solids.length!==1)throw Error('QRコードを一体のソリッドにできません。サイズを変更してください');}finally{check.delete();solids.forEach(s=>s.delete());}
  const result={shape,analysis:{size:p.size,modules:layout.count,moduleSize:layout.pitch,quietModules:layout.quiet,baseThickness:1,patternThickness:1,totalThickness:2,version:layout.version,rectangles:layout.rectangles.length,point:p.point,frame:p.frame}};shape=null;return result;
 }finally{shape?.delete();parts.forEach(part=>part.delete());}
}
