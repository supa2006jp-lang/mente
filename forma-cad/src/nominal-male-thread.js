import * as R from 'replicad';import * as THREE from 'three';
import {offsetThreadProfile} from './thread-pull.js';import {fuseThread} from './thread-fuse.js';import {cutThread} from './thread-cut.js';
export function nominalMaleThread(base,selected,spec,length){
 const pitch=spec.pitch,radius=selected.radius,h=pitch*.541266,root=radius-h-pitch*.02;
 if(root<=0)throw Error('直径に対してピッチが大きすぎます');
 const place=shape=>{const z=new THREE.Vector3(0,0,1),angle=z.angleTo(selected.normal)*180/Math.PI,axis=z.cross(selected.normal);if(angle>1e-6)shape=shape.rotate(angle,[0,0,0],axis.length()<1e-6?[1,0,0]:axis.normalize().toArray());return shape.translate(selected.origin.toArray());};
 // The male profile occupies the gap between successive female ridges.
 const slope=.325/.561266,crestHalf=pitch*(.5-.45+.02*slope),rootHalf=pitch*(.375+.04*slope);
 let points=[[-pitch*.02,-rootHalf],[h+pitch*.02,-crestHalf],[h+pitch*.02,crestHalf],[-pitch*.02,rootHalf]];
 if(spec.threadFaceOffsets){const offsets=[...spec.threadFaceOffsets];offsets[3]=Math.max(offsets[3]||0,-(spec.threadCylinderOffset||0));points=offsetThreadProfile(points,offsets);}
 if(points.some(p=>root+p[0]<=0))throw Error('ねじの調整距離が大きすぎます');
 let drawing=R.draw(points[0]);for(const p of points.slice(1))drawing=drawing.lineTo(p);
 const section=drawing.close().sketchOnPlane(new R.Plane([root,0,0],[1,0,0],[0,-1,0])).wire;
 const sleeve=R.makeCylinder(radius+.01,length,[0,0,0]).cut(R.makeCylinder(root+(spec.threadCylinderOffset||0),length,[0,0,0]));
 const core=cutThread(base,place(sleeve));
 let failure;
 // Keep helical boolean intersections short and move their seams between retries.
 for(const turns of [3.25,2.5,1.75]){
  try{
   let result=core.clone();
   for(let start=0;start<length-1e-8;start+=pitch*turns){
    const span=Math.min(pitch*turns,length-start),path=R.makeHelix(pitch,span+(start+span>=length-1e-8?pitch*.5:0),root,undefined,undefined,!!spec.leftHand);
    let ridge=R.genericSweep(section,path,{frenet:true}).rotate(180+(spec.leftHand?-1:1)*start/pitch*360,[0,0,0],[0,0,1]).translate([0,0,start]);
    ridge=ridge.cutPlane('XY',.0001,'positive').cutPlane('XY',length-.0001,'negative');
    result=fuseThread(result,place(ridge),{requireJoined:true});
   }
   return result;
  }catch(error){failure=error;}
 }
 throw failure;
}
