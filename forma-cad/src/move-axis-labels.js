import * as THREE from 'three';

export function installMoveAxisLabels(control,helper,camera,canvas,host){
 const layer=document.createElement('div');layer.id='move-axis-labels';layer.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:6';host.append(layer);
 const labels=control._gizmo.gizmo.translate.children.filter(o=>{if(!o.isMesh||!/^[XYZ]$/.test(o.name))return false;o.geometry.computeBoundingBox();return Math.abs(o.geometry.boundingBox.getCenter(new THREE.Vector3())[o.name.toLowerCase()])>.45;}).map(arrow=>{
  arrow.geometry.computeBoundingBox();const axis=arrow.name.toLowerCase(),sign=Math.sign(arrow.geometry.boundingBox.getCenter(new THREE.Vector3())[axis]);
  const el=document.createElement('span');el.textContent=arrow.name+'（'+(sign>0?'＋':'−')+'）';el.dataset.axis=arrow.name;el.dataset.sign=String(sign);
  el.style.cssText='position:absolute;transform:translate(-50%,-50%);font:600 14px sans-serif;white-space:nowrap;background:rgba(255,255,255,.92);border:1px solid currentColor;border-radius:4px;padding:2px 4px;';el.style.color={X:'#b82020',Y:'#087a2c',Z:'#244fcb'}[arrow.name];layer.append(el);
  const tip=new THREE.Vector3();tip[axis]=sign*.6;return {arrow,el,tip};
 });
 function update(){
  layer.hidden=!control.object||control.mode!=='translate'||!helper.visible;
  if(!layer.hidden){
   helper.updateMatrixWorld(true);const r=canvas.getBoundingClientRect(),h=host.getBoundingClientRect(),center=control.object.getWorldPosition(new THREE.Vector3()).project(camera);
   for(const {arrow,el,tip} of labels){const p=tip.clone().applyMatrix4(arrow.matrixWorld).project(camera);el.hidden=!arrow.visible||p.z< -1||p.z>1;
    const dx=(p.x-center.x)*r.width,dy=-(p.y-center.y)*r.height,length=Math.hypot(dx,dy)||1;
    el.style.left=(r.left-h.left+(p.x+1)*r.width/2+dx/length*28)+'px';el.style.top=(r.top-h.top+(1-p.y)*r.height/2+dy/length*22)+'px';
   }
  }
  requestAnimationFrame(update);
 }
 update();
}
