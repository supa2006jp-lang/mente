import * as THREE from 'three';
import {sectionBasis} from './section-split.js';
import {OFFSET_PLANE_SIZE} from './offset-plane.js';

// A section cap is display geometry. Transfer its plane, without adding a
// split or a model feature; the eventual sketch stores this frame and offset.
export function sectionSketchPlane({plane,frame,offset,reverse=false,anchor=[0,0,0]}){
 if(String(offset).trim()===''||!Number.isFinite(Number(offset))||Math.abs(Number(offset))>10000)throw Error('断面位置は−10000〜10000 mmで指定してください');
 if(!Array.isArray(anchor)||anchor.length!==3||!anchor.every(Number.isFinite))throw Error('断面の作図位置が不正です');
 const {u,v,n}=sectionBasis(plane,frame),point=new THREE.Vector3(...anchor),distance=Number(offset);
 point.addScaledVector(n,distance-point.dot(n));
 // Face the removed side, so entering the sketch does not look through the
 // retained solid. Flipping V as well as N preserves a right-handed frame.
 if(!reverse){v.negate();n.negate();}
 const center=[point.dot(u),point.dot(v)],half=OFFSET_PLANE_SIZE/2;
 return {kind:'plane',name:'断面の作図平面',plane:'CUSTOM',sectionSketch:true,frame:{u:u.toArray(),v:v.toArray(),n:n.toArray()},offset:point.dot(n),anchor:point.toArray(),outer:[[-half,-half],[half,-half],[half,half],[-half,half]].map(p=>p.map((value,i)=>value+center[i])),holes:[],area:OFFSET_PLANE_SIZE**2};
}
