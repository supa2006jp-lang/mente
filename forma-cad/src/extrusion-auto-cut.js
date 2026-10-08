import {Brush,INTERSECTION} from 'three-bvh-csg';
import * as THREE from 'three';
import {evaluator,makeGeometry,volume} from './geometry.js';
import {basisFor} from './frames.js';

// Reject contact-only candidates before the expensive CSG intersection.
function rangeAlong(mesh,normal){
 mesh.updateMatrixWorld(true);
 const positions=mesh.geometry.attributes.position,point=new THREE.Vector3();
 let min=Infinity,max=-Infinity;
 for(let i=0;i<positions.count;i++){
  const value=point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).dot(normal);
  min=Math.min(min,value);max=Math.max(max,value);
 }
 return [min,max];
}
function positiveBoxOverlap(a,b){
 return ['x','y','z'].every(axis=>Math.min(a.max[axis],b.max[axis])-Math.max(a.min[axis],b.min[axis])>1e-5);
}
// Rank intersected bodies by actual shared volume, rather than by their bounds.
// A bounding-box test alone would switch to cut for cavities and nearby parts.
export function extrusionIntersections(feature,bodies){
 const geometry=makeGeometry({...feature,operation:'new',holesOnly:false,throughAll:false});
 const tool=new Brush(geometry);tool.updateMatrixWorld(true);
 const toolBounds=new THREE.Box3().setFromBufferAttribute(geometry.attributes.position);
 const normal=basisFor(feature).n,[toolMin,toolMax]=rangeAlong(tool,normal);
 const matches=[];
 try{
  for(const [id,mesh] of bodies){
   if(!mesh.visible||!positiveBoxOverlap(toolBounds,new THREE.Box3().setFromObject(mesh)))continue;
   const [bodyMin,bodyMax]=rangeAlong(mesh,normal);
   if(Math.min(toolMax,bodyMax)-Math.max(toolMin,bodyMin)<=1e-4)continue;
   const target=new Brush(mesh.geometry);target.position.copy(mesh.position);target.quaternion.copy(mesh.quaternion);target.scale.copy(mesh.scale);target.updateMatrixWorld(true);
   const overlap=evaluator.evaluate(target,tool,INTERSECTION);
   try{const amount=volume(overlap.geometry);if(amount>1e-5)matches.push({id,volume:amount});}
   finally{overlap.geometry.dispose();}
  }
 }finally{geometry.dispose();}
 return matches.sort((a,b)=>b.volume-a.volume);
}
// Grid profiles deliberately omit CAD-face references so only their clipped
// polygons are extruded. Keep their source body for the operation decision:
// outward contact with that source is join, even with tessellation slivers.
export function extrusionCutMatches(feature,bodies,source=feature.region?.cadFace?.bodyId||feature.region?.bodyId||feature.region?.gridSourceBodyId){
 const sourceFace=source&&feature.region?.outer&&bodies.get(source)?.visible;
 if(!sourceFace)return extrusionIntersections(feature,bodies);
 if(feature.depth<0)return feature.region.gridSourceBodyId?extrusionIntersections(feature,bodies):[{id:source,volume:Infinity}];
 const others=new Map([...bodies].filter(([id])=>id!==source));
 return others.size?extrusionIntersections(feature,others):[];
}
