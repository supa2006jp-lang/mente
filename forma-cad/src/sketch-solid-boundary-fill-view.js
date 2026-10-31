import * as THREE from 'three';
import {completeSketchWithSolidBoundary} from './sketch-solid-boundary-fill.js';
import {regionFaceGeometry} from './regions.js';
import {makeSketchGeometry} from './geometry.js';
import {sketchLine} from './sketch-line.js';

export function createSolidBoundaryFill({host,getFeatures,getBoundaries,getGroupId,isEnabled,isDrawing}){
 let timer=null,revision=0;const hint=document.createElement('small');hint.id='solid-boundary-fill-hint';hint.hidden=true;hint.style.cssText='color:#7ce4bb;font-size:12px';document.getElementById('solid-boundary-fill-toggle').closest('label').append(hint);
 function clear(){clearTimeout(timer);revision++;hint.hidden=true;delete host.dataset.solidBoundaryFill;}
 function complete(feature){if(!isEnabled()||feature.kind!=='sketch'||feature.construction||feature.textOutline||feature.closed||!['line','polyline','spline'].includes(feature.profile))return null;return completeSketchWithSolidBoundary(getFeatures(),feature,getBoundaries(feature),{groupId:feature.groupId||getGroupId()||'__new-sketch'});}
 function preview(parent,feature){
  if(!isEnabled()||!isDrawing()||feature.profile!=='line'||feature.construction)return;const id=revision,original=getFeatures();timer=setTimeout(()=>{if(id!==revision||!parent.parent||!isDrawing()||getFeatures()!==original)return;try{const plan=complete({...feature,id:'solid-boundary-preview'});if(!plan)return;const group=new THREE.Group();group.name='solid-boundary-fill-preview';for(const f of plan.added)group.add(sketchLine(makeSketchGeometry(f),{color:0x10b981,depthTest:false,order:7,construction:true}));const fill=new THREE.Mesh(regionFaceGeometry(plan.region),new THREE.MeshBasicMaterial({color:0x10b981,transparent:true,opacity:.18,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));fill.raycast=()=>{};fill.renderOrder=6;group.add(fill);group.traverse(o=>{o.raycast=()=>{};});parent.add(group);const edges=plan.added.reduce((n,f)=>n+f.points.length-(f.closed?0:1),0);hint.textContent=`緑の破線：ソリッド境界 ${edges}辺を取り込み、輪郭を閉じます`;hint.hidden=false;host.dataset.solidBoundaryFill=JSON.stringify({edges,area:plan.region.area,bodyIds:plan.bodyIds,paths:plan.added.map(f=>f.points)});}catch(error){hint.textContent='境界の自動取り込みを省略：'+error.message;hint.hidden=false;}},80);
 }
 return {clear,complete,preview,dispose(){clear();hint.remove();}};
}
