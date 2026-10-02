import * as THREE from 'three';
import {patternTransforms} from './patterns.js';
export function installPatternPreview({scene,host,getMesh,getSpec}){
 const dialog=document.getElementById('tools-dialog'),fields=document.getElementById('cad-fields'),command=document.getElementById('cad-command');let group=null;
 function clear(){if(group){scene.remove(group);group.traverse(o=>{if(o.material)o.material.dispose();});group=null;}delete host.dataset.patternPreview;}
 function update(){
  clear();if(!dialog.open||!['rectangular','circular'].includes(command.value))return;
  if([...fields.querySelectorAll('input')].some(i=>i.value===''||!i.checkValidity()))return;
  try{const spec=getSpec(),matrices=patternTransforms(spec),mesh=getMesh(spec.target);if(!mesh)return;
   group=new THREE.Group();for(const matrix of matrices){const copy=mesh.clone(true);copy.visible=true;copy.applyMatrix4(matrix);copy.traverse(o=>{if(o.material){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=o.isMesh?.45:.8;o.material.depthWrite=false;o.material.color.set(0x438fcb);}});group.add(copy);}
   scene.add(group);host.dataset.patternPreview=JSON.stringify(matrices.map(m=>new THREE.Vector3().setFromMatrixPosition(m).toArray()));
  }catch{clear();}
 }
 fields.addEventListener('input',update);fields.addEventListener('change',update);command.addEventListener('change',update);dialog.addEventListener('close',clear);
 new MutationObserver(update).observe(dialog,{attributes:true,attributeFilter:['open']});new MutationObserver(update).observe(fields,{childList:true});
}
