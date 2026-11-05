import * as THREE from 'three';
import {rotationAngleText} from './rotation-snap.js';

export function createMoveRotationFeedback({scene,camera,canvas,host}){
 const readout=document.createElement('output');
 readout.id='move-rotation-readout';readout.hidden=true;readout.setAttribute('aria-live','off');
 readout.style.cssText='position:absolute;z-index:10;pointer-events:none;white-space:nowrap;padding:4px 8px;border:1px solid;border-radius:5px;font:600 13px sans-serif;box-shadow:0 2px 7px #1233';
 host.append(readout);
 const outline=new THREE.Group();outline.visible=false;scene.add(outline);
 const outlineMaterial=new THREE.LineDashedMaterial({color:0x536779,transparent:true,opacity:.58,depthTest:false,depthWrite:false,dashSize:2,gapSize:1.2});
 let baseline=null,anchor=null,frame=null;
 const projected=new THREE.Vector3();

 function positionReadout(){
  frame=null;
  if(!anchor)return;
  const rect=canvas.getBoundingClientRect(),base=host.getBoundingClientRect(),p=projected.copy(anchor).project(camera);
  readout.style.left=Math.max(4,Math.min(rect.width-readout.offsetWidth-4,(p.x+1)*rect.width/2+22))+rect.left-base.left+'px';
  readout.style.top=Math.max(4,Math.min(rect.height-readout.offsetHeight-4,(1-p.y)*rect.height/2-37))+rect.top-base.top+'px';
  frame=requestAnimationFrame(positionReadout);
 }
 function hideAngle(){
  anchor=null;readout.hidden=true;
  if(frame!==null)cancelAnimationFrame(frame);frame=null;
 }
 function clear(){
  hideAngle();
  for(const line of [...outline.children]){line.geometry.dispose();line.removeFromParent();}
  outline.visible=false;baseline=null;delete host.dataset.moveRotationOutline;
 }

 return {
  capture(meshes,rotation){
   if(baseline)return;
   baseline=rotation;
   for(const mesh of meshes){
    const edges=mesh.children[0],position=edges?.geometry.getAttribute('position');
    if(!edges?.isLineSegments||!position?.count)continue;
    edges.updateWorldMatrix(true,false);
    const geometry=new THREE.BufferGeometry().setAttribute('position',position.clone());
    const line=new THREE.LineSegments(geometry,outlineMaterial);
    line.computeLineDistances();line.matrixAutoUpdate=false;line.matrix.copy(edges.matrixWorld);line.renderOrder=34;
    outline.add(line);
   }
  },
  updateOutline(rotation){
   const visible=!!baseline&&outline.children.length>0&&Math.abs(baseline.dot(rotation))<1-1e-9;
   if(visible===outline.visible)return;
   outline.visible=visible;
   if(visible)host.dataset.moveRotationOutline=String(outline.children.length);else delete host.dataset.moveRotationOutline;
  },
  showAngle(degrees,{snapped,alt},center){
   const angle=rotationAngleText(degrees).replace(/\.0$/,'').replace(/^-/,'−')+'°';
   readout.textContent=angle+(snapped?' ✓ 吸着':alt?' · 吸着オフ':'');
   readout.style.color=snapped?'#824500':'#204d66';
   readout.style.backgroundColor=snapped?'#fff1d8':'#f6fbff';
   readout.hidden=false;anchor=center;
   if(frame===null)positionReadout();
  },
  hideAngle,clear
 };
}
