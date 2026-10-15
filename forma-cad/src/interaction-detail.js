import * as THREE from 'three';
export function installInteractionDetail({scene,meshes,canvas,canUse,host}){
 const label=document.createElement('label');label.style.cssText='font-size:12px;white-space:nowrap;display:flex;align-items:center;gap:5px';label.title='面数が多いボディは視点操作中だけ外形の枠で表示します。保存・出力する形状は変わりません。';label.innerHTML='<input id="interaction-detail-enabled" type="checkbox" checked>操作中は簡易表示';document.querySelector('.navigation').append(label);
 let down=null,saved=[],helpers=[];
 function restore(){for(const [object,visible] of saved)object.visible=visible;saved=[];for(const helper of helpers){helper.geometry.dispose();helper.material.dispose();helper.removeFromParent();}helpers=[];delete host.dataset.interactionDetail;}
 // Capture at the window: the CAD Shift-orbit handler stops propagation on
 // the canvas, so later canvas listeners would never see that camera gesture.
 window.addEventListener('pointerdown',event=>{if(event.target===canvas&&(event.shiftKey||event.button===1||event.button===2||event.pointerType==='touch')&&canUse())down={id:event.pointerId,x:event.clientX,y:event.clientY};},{capture:true});
 window.addEventListener('pointermove',event=>{
  if(!down||event.pointerId!==down.id||saved.length||!label.querySelector('input').checked||!canUse()||Math.hypot(event.clientX-down.x,event.clientY-down.y)<4)return;
  for(const mesh of meshes.values()){
   if(!mesh.visible||(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3<200000)continue;
   const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];if(materials.every(material=>!material.visible))continue;
   const helper=new THREE.Box3Helper(new THREE.Box3().setFromObject(mesh),0x3f9bb0);helper.name='interactive-outline';scene.add(helper);helpers.push(helper);
   for(const object of [...materials,...mesh.children]){saved.push([object,object.visible]);object.visible=false;}
  }
  if(saved.length)host.dataset.interactionDetail='outline';
 },{capture:true});
 const finish=()=>{down=null;restore();};for(const event of ['pointerup','pointercancel','blur'])window.addEventListener(event,finish,{capture:true});label.querySelector('input').onchange=finish;
 return {restore};
}
