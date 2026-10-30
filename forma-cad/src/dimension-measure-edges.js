import * as THREE from 'three';
import {sketchSegments} from './sketch-selection.js';
import {mergedStraightEdges} from './move-edge-midpoints.js';
import {smoothEdgeChains} from './smooth-edge-chains.js';
import {basisFor} from './frames.js';

// Preserve complete curved edges; a tessellation chord must not be reported as
// the length of the circular rim or spline the user clicked.
export function measurementEdges(features,meshes){
 const result=[];
 for(const f of features.filter(f=>f.kind==='sketch'&&!f.groupHidden&&f.profile!=='point')){
  const segments=sketchSegments(f);if(!segments.length)continue;
  if(['circle','spline'].includes(f.profile)||f.arc)result.push({key:'sketch:'+f.id,segments,straight:false,label:f.profile==='circle'?'円周の長さ':'曲線の長さ（近似）',length:f.profile==='circle'?Math.PI*f.diameter:undefined,approximate:f.profile!=='circle',...(f.profile==='circle'?{circle:{center:[f.x,f.y,f.z],radius:f.diameter/2,normal:basisFor(f).n.toArray()}}:{})});
  else for(const s of segments)result.push({key:'sketch:'+f.id+':'+s.index,segments:[s],straight:true,label:'スケッチの辺の長さ'});
 }
 for(const mesh of meshes){
  if(!mesh.visible)continue;mesh.updateWorldMatrix(true,false);
  for(const child of mesh.children.filter(c=>c.isLineSegments&&c.visible)){
   const geometry=child.geometry;if(!geometry?.attributes.position)continue;child.updateWorldMatrix(true,false);const matrix=child.matrixWorld,world=p=>p.clone().applyMatrix4(matrix),prefix='solid:'+mesh.userData.bodyId+':'+child.uuid,scale=new THREE.Vector3().setFromMatrixScale(matrix),uniform=Math.abs(scale.x-scale.y)<1e-8&&Math.abs(scale.y-scale.z)<1e-8;
   for(const [i,s]of mergedStraightEdges(geometry).entries())result.push({key:prefix+':line:'+i,segments:[{a:world(s.a),b:world(s.b)}],straight:true,label:'ソリッドの辺の長さ'});
   const chains=smoothEdgeChains(geometry),curves=new Set([...chains.values()]);for(const [i,arc]of geometry.userData.arcEdges||[])if(!chains.has(i))curves.add(arc);for(const circle of geometry.userData.circularEdges?.values()||[])curves.add(circle);
   const circles=new Set(geometry.userData.circularEdges?.values()||[]);let i=0;for(const curve of curves){const points=curve.points.map(p=>world(new THREE.Vector3(...p))),segments=points.slice(1).map((b,i)=>({a:points[i],b}));if(!segments.length)continue;let circle;if(uniform&&circles.has(curve)){const center=world(new THREE.Vector3(...curve.center)),normal=points[0].clone().sub(center).cross(points[Math.floor(points.length/4)].clone().sub(center)).normalize();if(normal.length()>.9)circle={center:center.toArray(),radius:curve.radius*scale.x,normal:normal.toArray()};}result.push({key:prefix+':curve:'+i++,segments,straight:false,length:uniform&&Number.isFinite(curve.length)?curve.length*scale.x:undefined,approximate:!uniform||!Number.isFinite(curve.radius),label:'ソリッドの曲線の長さ',...(circle?{circle}:{})});}
  }
 }
 return result;
}
