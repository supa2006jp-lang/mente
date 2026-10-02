import {fuseThread} from './thread-fuse.js';
import * as THREE from 'three';
import * as R from 'replicad';
export function coilOnRim(base,p){
 if(!base)throw Error('選択した円筒がありません');
 const center=new THREE.Vector3(...p.rim.center),radius=p.rim.radius;let support=null;
 for(const face of base.faces){if(face.geomType!=='CYLINDRE')continue;const cyl=face.surface.wrapped.Cylinder(),loc=cyl.Location(),axis=cyl.Axis().Direction(),origin=new THREE.Vector3(loc.X(),loc.Y(),loc.Z()),n=new THREE.Vector3(axis.X(),axis.Y(),axis.Z()),v=center.clone().sub(origin).dot(n),bounds=face.UVBounds;
  if(Math.abs(cyl.Radius()-radius)>.02||center.clone().sub(origin).addScaledVector(n,-v).length()>.02)continue;
  const end=Math.abs(v-bounds.vMin)<Math.abs(v-bounds.vMax)?bounds.vMin:bounds.vMax;if(Math.abs(v-end)>.02)continue;
  support={center:origin.addScaledVector(n,end),direction:n.multiplyScalar(end===bounds.vMin?1:-1),radius:cyl.Radius()};break;
 }
 if(!support)throw Error('円筒の端の円周を選択してください');
 if(!Number.isFinite(p.pitch+p.wire+p.turns)||p.wire<=0||p.pitch<=p.wire*1.05||!Number.isInteger(p.turns)||p.turns<1||p.turns>30)throw Error('ピッチは断面の太さより大きく、巻き数は1〜30にしてください');

 const section=R.drawCircle(p.wire/2).sketchOnPlane(new R.Plane([support.radius,0,0],[1,0,0],[0,-1,0])).wire;
 const z=new THREE.Vector3(0,0,1),angle=z.angleTo(support.direction),axis=z.clone().cross(support.direction);if(axis.lengthSq()<1e-12)axis.set(1,0,0);axis.normalize();
 const place=shape=>{if(angle>1e-9)shape=shape.rotate(angle*180/Math.PI,[0,0,0],axis.toArray());return shape.translate(support.center.toArray());};
 // Short helical faces avoid unstable periodic intersections after axis reversal.
 let result=base.clone();const length=p.pitch*p.turns,step=p.pitch*.75;
 for(let start=0;start<length-1e-8;start+=step){const span=Math.min(step,length-start),path=R.makeHelix(p.pitch,span,support.radius);const coil=R.genericSweep(section,path,{frenet:true}).rotate(start/p.pitch*360,[0,0,0],[0,0,1]).translate([0,0,start+p.wire/2]);result=fuseThread(result,place(coil),{requireJoined:true});}
 return result;

}
