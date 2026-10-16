import * as R from 'replicad';import * as THREE from 'three';
import {offsetThreadProfile} from './thread-pull.js';import {fuseThread} from './thread-fuse.js';import {cutThread} from './thread-cut.js';
import {fuseSolids} from './solid-fuse.js';
export function nominalMaleThread(base,selected,spec,length,onProgress){
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
 const outer=R.makeCylinder(radius+.01,length,[0,0,0]),inner=R.makeCylinder(root+(spec.threadCylinderOffset||0),length,[0,0,0]);let sleeve,core;
 try{
 sleeve=place(outer.cut(inner));core=cutThread(base,sleeve);
 let failure;
 // Keep helical boolean intersections short and move their seams between retries.
 for(const turns of [3.25,2.5,1.75]){
  const ridges=[];let result;
  try{
   for(let start=0;start<length-1e-8;start+=pitch*turns){
    onProgress?.({stage:'ねじ山を作成しています',current:Math.round(start/pitch),total:Math.ceil(length/pitch)});
    const span=Math.min(pitch*turns,length-start),path=R.makeHelix(pitch,span+(start+span>=length-1e-8?pitch*.5:0),root,undefined,undefined,!!spec.leftHand);
    let ridge;
    try{
     ridge=R.genericSweep(section,path,{frenet:true}).rotate(180+(spec.leftHand?-1:1)*start/pitch*360,[0,0,0],[0,0,1]).translate([0,0,start]);
     for(const [offset,side] of [[.0001,'positive'],[length-.0001,'negative']]){const trimmed=ridge.cutPlane('XY',offset,side);ridge.delete();ridge=trimmed;}
     ridges.push(place(ridge));ridge=null;
    }finally{ridge?.delete();path.delete();}
   }
   try{
    // Fuse all short sweeps once; growing pairwise fuses repeat expensive
    // whole-thread retention cuts after every few turns.
    result=fuseSolids([core,...ridges],{onProgress});
    const coreSolids=core.solids,resultSolids=result.solids;let joined;
    try{joined=coreSolids.length===resultSolids.length;}finally{[...coreSolids,...resultSolids].forEach(shape=>shape.delete());}
    if(!joined)throw Error('ねじ山が芯から分離しています');
    onProgress?.({stage:'ねじの芯が保持されていることを確認しています'});
    const missing=core.cut(result);try{if(Math.abs(R.measureVolume(missing))>=.001)throw Error('ねじの芯を保持できませんでした');}finally{missing.delete();}
   }catch(error){
    result?.delete();result=core.clone();
    for(const ridge of ridges){const next=fuseThread(result,ridge,{requireJoined:true});result.delete();result=next;}
   }
   const output=result;result=null;return output;
  }catch(error){failure=error;}
  finally{result?.delete();ridges.forEach(shape=>shape.delete());}
 }
 throw failure;
 }finally{core?.delete();sleeve?.delete();outer.delete();inner.delete();section.delete();}
}
