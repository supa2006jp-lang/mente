import * as THREE from 'three';
import {findRegions,regionFaceGeometry} from './regions.js';
import {sketchSolidOverlapRegions} from './sketch-solid-overlap.js';
import {cadPosition} from './cad-coordinates.js';
export function needsBackgroundSketchAnalysis(features){let count=0;for(const f of features)if(f.kind==='sketch'&&!f.construction){count+=f.profile==='circle'?128:f.profile==='spline'?Math.max(64,(f.points?.length||0)*16):f.profile==='polyline'?f.points.length:f.profile==='rect'?4:1;}return count>128;}
export function sketchAnalysisBodies(meshes){return [...meshes].filter(([,m])=>m.visible).map(([id,m])=>{m.updateWorldMatrix(true,false);return {id,positions:Array.from(cadPosition(m.geometry).array),indices:m.geometry.index?Array.from(m.geometry.index.array):null,matrix:m.matrixWorld.toArray()};});}
export function analyzeSketchRegions({features,bodies=[]}){
 const meshes=[];try{
  for(const b of bodies){const g=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float64Array(b.positions),3));if(b.indices)g.setIndex(b.indices);const m=new THREE.Mesh(g);m.matrixAutoUpdate=false;m.matrix.fromArray(b.matrix);m.updateMatrixWorld(true);meshes.push(m);}
  const regions=findRegions(features),overlap=sketchSolidOverlapRegions(regions,meshes,{includeOutside:true}),faces=[...regions,...overlap].map(region=>{const g=regionFaceGeometry(region);try{return {id:region.id,positions:g.attributes.position.array.slice(),indices:g.index?.array.slice()||null};}finally{g.dispose();}});
  return {regions,overlap,faces};
 }finally{for(const m of meshes){m.geometry.dispose();m.material.dispose();}}
}
