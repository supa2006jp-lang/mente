import * as THREE from 'three';
import {sketchLine} from './sketch-line.js';

export function createExtrusionBoundaryFeedback(scene,host){
 const group=new THREE.Group();group.visible=false;scene.add(group);let signature='';
 const style=document.createElement('style');style.textContent='#extrude-handle[data-snap-kind=boundary]{background:#087e61;border-color:#6ee7b7;box-shadow:0 0 0 3px #10b98166,0 2px 8px #1236}';document.head.append(style);
 return {group,clear(){if(!signature)return;for(const o of [...group.children]){o.traverse(child=>{child.geometry?.dispose();for(const material of [].concat(child.material||[]))material.dispose();});group.remove(o);}signature='';group.visible=false;delete host.dataset.extrusionBoundarySnap;},show(candidate,normal,name){
  const key=JSON.stringify([candidate.bodyId,candidate.value]);if(key===signature)return;this.clear();signature=key;
  const line=sketchLine(new THREE.BufferGeometry().setFromPoints(candidate.segments.flat()),{color:0x10b981,segments:true,depthTest:false,order:12,planeNormal:normal});line.traverse(o=>o.raycast=()=>{});group.add(line);group.visible=true;host.dataset.extrusionBoundarySnap=JSON.stringify({bodyId:candidate.bodyId,name,value:candidate.value,color:'#10b981',segments:candidate.segments.map(s=>s.map(p=>p.toArray()))});
 }};
}
