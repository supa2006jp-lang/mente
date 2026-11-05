import * as THREE from 'three';
import {rotationAngleText} from './rotation-snap.js';

export function createMoveRotationFeedback({scene,camera,canvas,host,onAngle}){
 const badge=document.createElement('div');
 badge.hidden=true;badge.style.cssText='position:absolute;z-index:10;pointer-events:none';
 badge.innerHTML='<button type="button" id="move-rotation-readout"></button><input id="move-rotation-edit" type="number" step="any" min="-10000" max="10000" aria-label="回転角度 (°)" hidden>';
 host.append(badge);
 const [readout,input]=badge.children;
 readout.style.cssText='white-space:nowrap;padding:4px 8px;border:1px solid;border-radius:5px;font:600 13px sans-serif;box-shadow:0 2px 7px #1233';
 input.style.cssText='pointer-events:auto;width:7em;padding:4px 8px;border:1px solid #1679bf;border-radius:5px;color:#204d66;background:#f6fbff;font:600 13px sans-serif';
 let angleValue=0,editable=false;
 readout.onclick=()=>{
  if(!editable)return;
  input.value=String(Number(angleValue.toFixed(10)));readout.hidden=true;input.hidden=false;input.focus();input.select();
 };
 function finishEdit(apply,focus=false){
  if(input.hidden)return false;
  const value=input.valueAsNumber;
  input.hidden=true;readout.hidden=false;
  if(apply&&Number.isFinite(value)&&input.checkValidity()&&value!==Number(angleValue.toFixed(10)))onAngle(value);
  if(focus&&editable&&!badge.hidden)readout.focus();
  return true;
 }
 input.addEventListener('blur',()=>finishEdit(true));
 input.addEventListener('keydown',event=>{
  if(event.key!=='Enter')return;
  event.preventDefault();event.stopPropagation();
  if(!input.value||!input.reportValidity())return;
  finishEdit(true,true);
 });
 const outline=new THREE.Group();outline.visible=false;scene.add(outline);
 const outlineMaterial=new THREE.LineDashedMaterial({color:0x536779,transparent:true,opacity:.58,depthTest:false,depthWrite:false,dashSize:2,gapSize:1.2});
 let baseline=null,anchor=null,frame=null;
 const projected=new THREE.Vector3();

 function positionReadout(){
  frame=null;
  if(!anchor)return;
  const rect=canvas.getBoundingClientRect(),base=host.getBoundingClientRect(),p=projected.copy(anchor).project(camera);
  badge.style.left=Math.max(4,Math.min(rect.width-badge.offsetWidth-4,(p.x+1)*rect.width/2+22))+rect.left-base.left+'px';
  badge.style.top=Math.max(4,Math.min(rect.height-badge.offsetHeight-4,(1-p.y)*rect.height/2-37))+rect.top-base.top+'px';
  frame=requestAnimationFrame(positionReadout);
 }
 function hideAngle(){
  finishEdit(false);anchor=null;badge.hidden=true;
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
  showAngle(degrees,{snapped=false,alt=false,edit=false}={},center){
   angleValue=degrees;editable=edit;
   if(!edit)finishEdit(false);
   const angle=(edit?String(Number(degrees.toFixed(3))):rotationAngleText(degrees).replace(/\.0$/,'')).replace(/^-/,'−')+'°';
   readout.textContent=angle+(snapped?' ✓ 吸着':alt?' · 吸着オフ':'');
   readout.tabIndex=edit?0:-1;
   readout.title=edit?'クリックして角度を入力':'';
   readout.setAttribute('aria-label',edit?angle+' · クリックして角度を入力':angle);
   readout.style.pointerEvents=edit?'auto':'none';
   readout.style.cursor=edit?'text':'default';
   readout.style.color=snapped?'#824500':'#204d66';
   readout.style.backgroundColor=snapped?'#fff1d8':'#f6fbff';
   badge.hidden=false;anchor=center;
   if(frame===null)positionReadout();
  },
  get editing(){return !input.hidden;},
  cancelEdit:()=>finishEdit(false,true),
  hideAngle,clear
 };
}
