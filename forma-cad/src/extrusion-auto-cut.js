import {cadPosition} from './cad-coordinates.js';
import {meshCsgBrush,meshCsgData} from './mesh-csg-data.js';
import {INTERSECTION} from 'three-bvh-csg';
import * as THREE from 'three';
import {evaluator,makeGeometry,volume} from './geometry.js';
import {basisFor} from './frames.js';

// Reject contact-only candidates before the expensive CSG intersection.
function rangeAlong(mesh,normal){
 const positions=cadPosition(mesh.geometry),point=new THREE.Vector3();
 let min=Infinity,max=-Infinity;
 for(let i=0;i<positions.count;i++){
  const value=point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).dot(normal);
  min=Math.min(min,value);max=Math.max(max,value);
 }
 return [min,max];
}

function worldBounds(mesh){
 mesh.updateWorldMatrix(true,false);
 return new THREE.Box3().setFromBufferAttribute(cadPosition(mesh.geometry)).applyMatrix4(mesh.matrixWorld);
}
function positiveBoxOverlap(a,b){
 return ['x','y','z'].every(axis=>Math.min(a.max[axis],b.max[axis])-Math.max(a.min[axis],b.min[axis])>1e-5);
}
// Rank intersected bodies by actual shared volume, rather than by their bounds.
// A bounding-box test alone would switch to cut for cavities and nearby parts.
export function extrusionIntersections(feature,bodies){
 const geometry=makeGeometry({...feature,operation:'new',holesOnly:false,throughAll:false});
 const profile=new THREE.Mesh(geometry);
 const matches=[];
 let tool;
 try{
  const toolBounds=worldBounds(profile);
  const normal=basisFor(feature).n,[toolMin,toolMax]=rangeAlong(profile,normal);
  for(const [id,mesh] of bodies){
   if(!mesh.visible||!positiveBoxOverlap(toolBounds,worldBounds(mesh)))continue;
   const [bodyMin,bodyMax]=rangeAlong(mesh,normal);
   if(Math.min(toolMax,bodyMax)-Math.max(toolMin,bodyMin)<=1e-4)continue;
   tool??=meshCsgBrush(meshCsgData(profile));
   const target=meshCsgBrush(meshCsgData(mesh));
   let overlap;
   try{overlap=evaluator.evaluate(target,tool,INTERSECTION);const amount=volume(overlap.geometry);if(amount>1e-5)matches.push({id,volume:amount});}
   finally{overlap?.geometry.dispose();target.geometry.dispose();target.material.dispose();}
  }
 }finally{tool?.geometry.dispose();tool?.material.dispose();geometry.dispose();profile.material.dispose();}
 return matches.sort((a,b)=>b.volume-a.volume);
}
// Grid profiles deliberately omit CAD-face references so only their clipped
// polygons are extruded. Keep their source body for the operation decision:
// outward contact with that source is join, even with tessellation slivers.
export function extrusionCutCandidates(feature,source,visibleIds){
 const sourceFace=!feature.symmetric&&feature.profileOffset===undefined&&source&&feature.region?.outer&&visibleIds.includes(source);
 if(sourceFace&&feature.depth<0&&!feature.region.gridSourceBodyId)return {matches:[{id:source,volume:Infinity}]};
 const targets=sourceFace&&feature.depth>=0?visibleIds.filter(id=>id!==source):visibleIds;
 return targets.length?{targets}:{matches:[]};
}

export function extrusionCutMatches(feature,bodies,source=feature.region?.cadFace?.bodyId||feature.region?.bodyId||feature.region?.gridSourceBodyId){
 const visibleIds=[...bodies].filter(([,mesh])=>mesh.visible).map(([id])=>id);
 const {matches,targets}=extrusionCutCandidates(feature,source,visibleIds);
 return matches??extrusionIntersections(feature,new Map(targets.map(id=>[id,bodies.get(id)])));
}
