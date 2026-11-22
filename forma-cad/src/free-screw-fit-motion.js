import * as THREE from 'three';
import {sectionSegments} from './section-view.js';
import {sectionFillStrips} from './coil-section.js';
import {freeScrewFitPose,freeScrewSectionAngle,freeScrewSectionOutline,freeScrewSectionOverlap} from './free-screw-section-data.js';

export function createFreeScrewFitMotion(result,settings){
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(result.nutMesh.vertices,3));
 geometry.setIndex(new THREE.BufferAttribute(result.nutMesh.triangles,1));
 return {
  at(advance){
   if(advance===result.advance)return result;
   const pose=freeScrewFitPose(settings,advance);
   const angle=(freeScrewSectionAngle+pose.rotation)*Math.PI/180,sin=Math.sin(angle),cos=Math.cos(angle);
   const segments=sectionSegments(geometry,new THREE.Plane(new THREE.Vector3(sin,cos,0),0));
   for(let i=0;i<segments.length;i+=3){
    segments[i]=cos*segments[i]-sin*segments[i+1];
    segments[i+2]+=pose.nutBottom;
   }
   const fill=sectionFillStrips(segments),triangles=[];
   for(let i=0;i<fill.length;i+=3)triangles.push(fill.slice(i,i+3));
   const nut=freeScrewSectionOutline(triangles);
   if(nut.length<2)throw Error('この位置のナット断面を計算できませんでした');
   return {...pose,nut,...freeScrewSectionOverlap(result.screw,nut)};
  },
  dispose:()=>geometry.dispose(),
 };
}
