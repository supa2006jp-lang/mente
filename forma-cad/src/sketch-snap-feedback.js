import * as THREE from 'three';
import {sketchLine} from './sketch-line.js';

export function createSketchSnapFeedback(scene,host){
 const group=new THREE.Group();scene.add(group);group.visible=false;let signature='';
 function clear(){for(const object of [...group.children]){object.traverse(o=>{o.geometry?.dispose();for(const m of o.material?[].concat(o.material):[])m.dispose();});group.remove(object);}group.visible=false;signature='';delete host.dataset.snapHighlight;}
 return {group,clear,show(candidate,normal){
  const segments=candidate?.segments||[];if(!segments.length){if(signature)clear();return;}
  const key=JSON.stringify([candidate.kind,segments.map(s=>s.map(p=>p.toArray())),normal.toArray()]);if(key===signature)return;clear();signature=key;
  const extension=candidate.kind==='edgeExtension';
  const geometry=new THREE.BufferGeometry().setFromPoints(segments.flat()),line=sketchLine(geometry,{color:0x10b981,segments:true,depthTest:!extension,order:9,planeNormal:normal,construction:extension});line.traverse(o=>o.raycast=()=>{});group.add(line);group.visible=true;
  host.dataset.snapHighlight=JSON.stringify({kind:candidate.kind,color:'#10b981',segments:segments.map(s=>s.map(p=>p.toArray()))});
 }};
}
