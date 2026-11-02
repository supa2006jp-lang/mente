import * as THREE from 'three';
import {basisFor} from './frames.js';
import {makeSketchGeometry} from './geometry.js';

// Frame the sketch's actual outlines, not the full temporary grid. Leave room
// above and around it for the drawing toolbar and dimensions.
export function fitSketchEditView(camera,features,width,height){
 const first=features.find(f=>f.kind==='sketch');if(!first||width<=0||height<=0)return null;
 const b=basisFor(first),offset=new THREE.Vector3(first.x,first.y,first.z).dot(b.n),min=[Infinity,Infinity],max=[-Infinity,-Infinity],p=new THREE.Vector3();
 for(const f of features){
  if(f.kind!=='sketch'||basisFor(f).n.distanceTo(b.n)>1e-5||Math.abs(new THREE.Vector3(f.x,f.y,f.z).dot(b.n)-offset)>1e-5)continue;
  const geometry=makeSketchGeometry(f),positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){p.fromBufferAttribute(positions,i);const values=[p.dot(b.u),p.dot(b.v)];for(let k=0;k<2;k++){min[k]=Math.min(min[k],values[k]);max[k]=Math.max(max[k],values[k]);}}
  geometry.dispose();
 }
 if(!min.every(Number.isFinite)||!max.every(Number.isFinite))return null;
 const span=max.map((value,i)=>value-min[i]),target=b.u.clone().multiplyScalar((min[0]+max[0])/2).addScaledVector(b.v,(min[1]+max[1])/2).addScaledVector(b.n,offset),left=Math.min(230,width*.22),right=Math.min(70,width*.08),top=Math.min(180,height*.2),bottom=Math.min(160,height*.2);
 camera.zoom=THREE.MathUtils.clamp(Math.min((width-left-right)*.85/Math.max(span[0],10),(height-top-bottom)*.85/Math.max(span[1],10))*200/height,.002,10000);
 const pixelsPerMM=camera.zoom*height/200;target.addScaledVector(b.u,-(left-right)/2/pixelsPerMM).addScaledVector(b.v,(top-bottom)/2/pixelsPerMM);
 camera.up.copy(b.v);camera.position.copy(target).addScaledVector(b.n,Math.max(180,Math.hypot(...span)*2));camera.lookAt(target);
 camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 return target;
}
