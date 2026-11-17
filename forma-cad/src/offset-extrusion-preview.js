import * as THREE from 'three';
import {Line2} from 'three/addons/lines/Line2.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {worldPoint} from './frames.js';
import {offsetExtrusionRegions} from './offset-extrusion.js';
import {offsetExtrusionSize} from './offset-extrusion-guides.js';

export function offsetExtrusionOutlinePaths(regions,distance){
 const paths=items=>items.flatMap(region=>[region.outer,...region.holes].map(ring=>ring.map(point=>worldPoint(region,point).toArray())));
 const pieces=regions.flatMap((region,sourceIndex)=>offsetExtrusionRegions(region,distance).map(shifted=>({region,shifted,sourceIndex}))),guides=[],dimensions=[];
 for(const {region,shifted,sourceIndex} of pieces){const index=guides.length;
  for(const [ringIndex,points] of [shifted.outer,...shifted.holes].entries())guides.push({region,points,hole:ringIndex>0,sourceIndex,world:points.map(point=>worldPoint(region,point).toArray())});
  dimensions.push({...offsetExtrusionSize(region,shifted,distance),guideIndex:index});
 }
 return {source:paths(regions),offset:paths(pieces.map(piece=>piece.shifted)),guides,dimensions};
}

// These lines are a lightweight guide. The extrusion command still verifies
// the exact native CAD offset before enabling confirmation.
export function createOffsetExtrusionPreview({scene,host,canvas}){
 const group=new THREE.Group();group.visible=false;scene.add(group);let data=null;
 function clear(){for(const child of [...group.children]){group.remove(child);child.geometry.dispose();child.material.dispose();}group.visible=false;data=null;delete host.dataset.offsetExtrusionPreview;delete host.dataset.offsetExtrusionSizes;}
 function update(){if(!group.visible)return;for(const child of group.children)if(child.material.resolution)child.material.resolution.set(canvas.clientWidth,canvas.clientHeight);}
 function show(regions,distance){
  clear();const paths=offsetExtrusionOutlinePaths(regions,distance);
  if(!paths.offset.length)throw Error('プレビューする輪郭がありません。対象を選び直してください');
  for(const [kind,rings] of [['source',paths.source],['offset',paths.offset]])for(const points of rings){
   const closed=[...points,points[0]],geometry=new LineGeometry().setPositions(closed.flat()),material=new LineMaterial({color:kind==='offset'?0xff8a24:0x536b80,linewidth:kind==='offset'?3:1.5,depthTest:false,depthWrite:false,transparent:true,opacity:1,toneMapped:false,dashed:kind==='source',dashSize:3,gapSize:2});
   const line=new Line2(geometry,material);line.computeLineDistances();line.renderOrder=kind==='offset'?101:100;line.userData.offsetOutline=kind;group.add(line);
  }
  data=paths;group.visible=true;update();
  const box=new THREE.Box3().setFromPoints(paths.offset.flatMap(ring=>ring.map(point=>new THREE.Vector3(...point))));
  host.dataset.offsetExtrusionPreview=JSON.stringify({distance,sourceRings:paths.source.length,offsetRings:paths.offset.length,bounds:[box.min.toArray(),box.max.toArray()]});
  host.dataset.offsetExtrusionSizes=JSON.stringify(paths.dimensions);
 }
 return {show,clear,update,get objects(){return group.children;},get data(){return data;}};
}
