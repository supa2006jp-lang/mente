import * as THREE from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';

export function createOffsetPlanePreview({scene,camera,canvas,host,controls,measurement,getState,setValues,getSnap,onError}){
 const proxy=new THREE.Object3D(),plane=new THREE.Group();scene.add(proxy,plane);plane.visible=false;
 const face=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0xb16af4,transparent:true,opacity:.22,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));face.renderOrder=12;plane.add(face);
 const line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-.5,-.5,0],[.5,-.5,0],[.5,.5,0],[-.5,.5,0]].map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color:0x9354c4,depthTest:false}));line.renderOrder=13;plane.add(line);
 const cross=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([[-.5,0,0],[.5,0,0],[0,-.5,0],[0,.5,0]].map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color:0x9354c4,depthTest:false,transparent:true,opacity:.5}));cross.renderOrder=13;plane.add(cross);
 const control=new TransformControls(camera,canvas),helper=control.getHelper();scene.add(helper);control.enabled=false;control.setSize(1.1);control.setSpace('local');
 const panel=document.createElement('div');panel.id='offset-plane-handles';panel.hidden=true;panel.style.cssText='position:absolute;left:20px;top:140px;z-index:10;background:#fffef5ee;color:#244559;border:1px solid #b494cf;border-radius:6px;padding:8px;max-width:270px';
 panel.innerHTML='<div style="display:flex;gap:6px"><button type="button" id="offset-plane-translate">↕ 距離</button><button type="button" id="offset-plane-rotate">↻ 角度</button></div><div id="offset-plane-values" style="margin-top:6px;font-size:12px"></div><div style="font-size:11px;margin-top:4px">矢印／リングをドラッグ · Shiftで微調整</div>';
 host.append(panel);const translate=panel.querySelector('#offset-plane-translate'),rotate=panel.querySelector('#offset-plane-rotate'),values=panel.querySelector('#offset-plane-values');
 let mode='translate',state=null,enabledBefore=null,shift=false,measurementHidden=null;
 function release(){if(enabledBefore!==null){controls.enabled=enabledBefore;enabledBefore=null;}}
 function snap(){control.setTranslationSnap(null);control.setRotationSnap(shift?null:THREE.MathUtils.degToRad(15));}
 function setMode(next){mode=next;control.setMode(mode);control.showX=control.showY=mode==='rotate';control.showZ=true;translate.setAttribute('aria-pressed',String(mode==='translate'));rotate.setAttribute('aria-pressed',String(mode==='rotate'));snap();update();}
 translate.onclick=()=>setMode('translate');rotate.onclick=()=>setMode('rotate');
 function clear(){control.pointerUp({button:0});control.detach();control.enabled=false;plane.visible=false;panel.hidden=true;state=null;release();if(measurementHidden!==null){measurement.hidden=measurementHidden;measurementHidden=null;}delete host.dataset.offsetPlanePreview;}
 function update(){
  let next;try{next=getState();}catch(error){clear();onError(error);return;}
  if(!next){if(state)clear();return;}
  if(measurementHidden===null)measurementHidden=measurement.hidden;measurement.hidden=true;
  state=next;plane.visible=true;panel.hidden=false;plane.position.copy(state.origin);plane.quaternion.copy(state.quaternion);plane.scale.set(state.width,state.height,1);
  if(!control.dragging){proxy.position.copy(state.origin);proxy.quaternion.copy(mode==='translate'?state.baseQuaternion:state.quaternion);proxy.updateMatrixWorld(true);}
  if(control.object!==proxy)control.attach(proxy);control.enabled=true;control.showX=control.showY=mode==='rotate';control.showZ=true;snap();
  values.textContent=Number(state.distance.toFixed(3))+' mm ／ X '+state.angles[0].toFixed(1)+'° · Y '+state.angles[1].toFixed(1)+'° · Z '+state.angles[2].toFixed(1)+'°';
  host.dataset.offsetPlanePreview=JSON.stringify({origin:state.origin.toArray(),frame:state.frame,offset:state.offset,distance:state.distance,angles:state.angles,mode});
 }
 control.addEventListener('dragging-changed',event=>{if(event.value){if(enabledBefore===null)enabledBefore=controls.enabled;controls.enabled=false;}else release();});
 control.addEventListener('mouseDown',()=>{host.dataset.offsetPlaneDragAxis=control.axis;});
 control.addEventListener('objectChange',()=>{
  if(!state||!control.dragging)return;
  if(mode==='translate'){let distance=proxy.position.clone().sub(state.pivot).dot(state.basis.n);const options=getSnap();if(!shift&&options.enabled)distance=Math.round(distance/options.step)*options.step;distance=Math.max(-10000,Math.min(10000,distance));proxy.position.copy(state.pivot).addScaledVector(state.basis.n,distance);setValues({distance});}
  else{const relative=state.baseQuaternion.clone().invert().multiply(proxy.quaternion),euler=new THREE.Euler().setFromQuaternion(relative,'XYZ');setValues({angles:[euler.x,euler.y,euler.z].map(THREE.MathUtils.radToDeg)});}
  update();
 });
 canvas.addEventListener('pointerdown',()=>{if(state&&control.axis&&enabledBefore===null){enabledBefore=controls.enabled;controls.enabled=false;}},{capture:true});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{if(name==='pointercancel')control.pointerUp({button:0});if(!control.dragging)release();});
 for(const name of ['keydown','keyup'])window.addEventListener(name,event=>{if(!state||event.key!=='Shift')return;shift=name==='keydown';snap();});
 window.addEventListener('blur',()=>{shift=false;snap();clear();});
 setMode('translate');
 return {update,clear,get interacting(){return !!state&&(control.dragging||!!control.axis);}};
}
