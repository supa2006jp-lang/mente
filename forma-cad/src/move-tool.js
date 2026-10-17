import {softRotationSnap,rotationAngleText} from './rotation-snap.js';
import {contactTranslation} from './move-contact-geometry.js';
import * as THREE from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {installMoveAxisLabels} from './move-axis-labels.js';
import {createMoveAxisPicker,moveCenterCandidates,movePointCandidates} from './move-axis-picker.js';
import {movePointDistanceText} from './move-point-guide.js';
import {constrainMoveDelta,cursorMovePlane,cursorMovePoint,movePreviewChildMatrix,createMoveGhost,disposeMoveGhost} from './move-cursor.js';
import {snapshotMoveReferences,transformedMoveReferences,findFreeMoveSnap,createFreeMoveSnapMarker} from './move-free-snap.js';
export function createMoveTool({scene,camera,canvas,host,getMeshes,getSelection=()=>[],getReferencePoints=()=>[],getReferenceLines=()=>[],getGridPlane=()=>({normal:[0,0,1],offset:0}),getGridSnap=()=>({enabled:false,step:10,plane:'XY'}),getControls,getSelectedEdge,onStart,onApply,onClose=()=>{}}){
 const control=new TransformControls(camera,canvas),helper=control.getHelper();scene.add(helper);control.setSize(.8);control.setSpace('world');control.enabled=false;
 installMoveAxisLabels(control,helper,camera,canvas,host);
 const panel=document.createElement('form');panel.id='move-panel';panel.hidden=true;panel.innerHTML='<strong>移動／回転</strong><p id="move-hint">移動するボディをクリック</p><div class="move-modes"><button type="button" data-mode="translate">↔ 移動</button><button type="button" data-mode="rotate">↻ 回転</button></div><div class="move-fields">'+[['x','X移動 (mm)'],['rx','X回転 (°)'],['y','Y移動 (mm)'],['ry','Y回転 (°)'],['z','Z移動 (mm)'],['rz','Z回転 (°)']].map(([id,label])=>'<label>'+label+'<input id="move-'+id+'" type="number" step="any" value="0" required min="-10000" max="10000"></label>').join('')+'</div><small>矢印・平面ハンドルで移動、リングで回転。回転中心はボディの中心です。ホイールで拡大・縮小。</small><p id="move-error" role="alert"></p><div><button type="button" id="move-cancel">キャンセル</button><button id="move-apply" type="submit">確定</button></div>';host.parentElement.append(panel);
 const methodLabel=document.createElement('label');methodLabel.className='move-method';methodLabel.innerHTML='操作<select id="move-method"><option value="move">移動</option><option value="copy">複製して移動</option></select>';panel.querySelector('.move-modes').before(methodLabel);
 const method=panel.querySelector('#move-method'),reverseLabel=document.createElement('label');reverseLabel.className='move-reverse';reverseLabel.hidden=true;reverseLabel.innerHTML='<input id="move-reverse-copy" type="checkbox">移動方向に対して鏡写しに複製';methodLabel.after(reverseLabel);const reverse=panel.querySelector('#move-reverse-copy');
 const fields=['x','y','z','rx','ry','rz'].map(id=>panel.querySelector('#move-'+id)),hint=panel.querySelector('#move-hint'),error=panel.querySelector('#move-error');
 const rotationOptions=document.createElement('div');rotationOptions.innerHTML='<label id="move-edge-angle-label" hidden>辺を軸に回転 (°)<input id="move-edge-angle" type="number" step="any" value="0"></label><label>90°回転の軸 <select id="move-quarter-axis"><option>X</option><option>Y</option><option selected>Z</option></select></label><button type="button" id="move-minus90">−90°</button> <button type="button" id="move-plus90">＋90°</button>';panel.querySelector('.move-fields').after(rotationOptions);
 const edgeInput=panel.querySelector('#move-edge-angle'),axisSelect=panel.querySelector('#move-quarter-axis');
 let pointAction=null,chosenCenter=null,chosenAxisPivot=null,pickingCenter=false,chosenEdge=null,edgeAxis=null,alignment=new THREE.Quaternion(),baseRotation=new THREE.Quaternion(),pickingAxis=false,edgeAngle=0;
 const rotation=()=>proxy.quaternion.clone().multiply(alignment.clone().invert());
 const degrees=()=>{const e=new THREE.Euler().setFromQuaternion(rotation(),'ZYX');return [e.x,e.y,e.z].map(x=>Number((x*180/Math.PI).toFixed(10)));};
 let pointMove=null,pointResult=null,proxyBaseMatrix=null,freeMove=null,ghost=null,hoverTarget=null;
 const copying=()=>method.value==='copy';
 function reflectPreview(){
  if(!proxy||!proxyBaseMatrix)return;const child=proxy.children[0];child.matrix.copy(movePreviewChildMatrix(proxyBaseMatrix,proxy.position,center,proxy.quaternion,copying()&&reverse.checked));
  child.matrixWorldNeedsUpdate=true;proxy.updateMatrixWorld(true);
 }
 method.onchange=()=>{error.textContent='';reverseLabel.hidden=!copying();for(const mesh of originals)mesh.visible=copying();if(proxy)mark();refreshFreeSnap();};reverse.onchange=()=>{error.textContent='';if(proxy)mark();refreshFreeSnap();};
 let revision=0,active=false,busy=false,original=null,originals=[],proxy=null,center=null,enabledBefore=true;
 const previewMeshes=()=>{const meshes=[];proxy?.traverse(o=>{if(o.isMesh)meshes.push(o);});return meshes;};
 const otherMeshes=()=>getMeshes().filter(m=>!originals.includes(m)&&m.visible);
 const selectionBounds=()=>originals.reduce((box,mesh)=>box.union(new THREE.Box3().setFromObject(mesh)),new THREE.Box3());
 const ray=new THREE.Raycaster(),dragRay=new THREE.Raycaster();
 function softMoveSnap(){
  if(!proxy||!control.dragging||control.mode!=='translate'||!dragStartPosition||!dragStartBounds)return;
  const {enabled,step,plane}=getGridSnap(),gridEnabled=enabled&&Number.isFinite(step)&&step>0;
  const eligible={XY:'XY',XZ:'XZ',YZ:'YZ'}[plane]||'XY',axes=control.axis||'',rect=canvas.getBoundingClientRect();
  const contactLimit=Math.min(10,Math.max(2,(Number.isFinite(step)?step:10)*.5));
  const targets=otherMeshes().map(mesh=>({mesh,bounds:new THREE.Box3().setFromObject(mesh)}));
  const gridSnaps=[],contactSnaps=[];
  proxy.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(proxy);
  for(const [name,index] of [['X',0],['Y',1],['Z',2]]){
   if(!axes.includes(name))continue;
   const raw=proxy.position.getComponent(index),direction=Math.sign(raw-dragStartPosition.getComponent(index));
   if(!direction)continue;
   const leading=(direction>0?bounds.max:bounds.min).getComponent(index);
   const oneMillimeter=proxy.position.clone().setComponent(index,raw+1).project(camera);
   const projected=proxy.position.clone().project(camera);
   const pixelsPerMillimeter=Math.hypot((oneMillimeter.x-projected.x)*rect.width/2,(oneMillimeter.y-projected.y)*rect.height/2);
   let contact=null;
   if(pixelsPerMillimeter>.4)for(const {mesh,bounds:targetBounds} of targets){
    if(targetBounds.isEmpty())continue;
    const transverse=[0,1,2].filter(i=>i!==index);
    if(transverse.some(i=>bounds.max.getComponent(i)<=targetBounds.min.getComponent(i)+1e-6||bounds.min.getComponent(i)>=targetBounds.max.getComponent(i)-1e-6))continue;
    const startLeading=(direction>0?dragStartBounds.max:dragStartBounds.min).getComponent(index);
    const far=(direction>0?targetBounds.max:targetBounds.min).getComponent(index);
    if(direction*(far-startLeading)<-1e-6)continue;
    const near=(direction>0?targetBounds.min:targetBounds.max).getComponent(index);
    if(direction*(near-leading)>contactLimit)continue;
    const delta=contactTranslation(proxy,mesh,index,direction);
    if(delta===null||!Number.isFinite(delta)||Math.abs(delta)>contactLimit||Math.abs(delta)*pixelsPerMillimeter>14)continue;
    if(!contact||Math.abs(delta)<Math.abs(contact.delta))contact={delta,at:leading+delta};
   }
   if(contact){
    proxy.position.setComponent(index,raw+contact.delta);
    bounds.translate(new THREE.Vector3().setComponent(index,contact.delta));
    contactSnaps.push(name+'='+Number(contact.at.toFixed(5)));
    continue;
   }
   if(!gridEnabled||!eligible.includes(name))continue;
   const nearest=Math.round(leading/step)*step,delta=nearest-leading,stepPixels=pixelsPerMillimeter*step;
   if(Math.abs(delta)>step*.18||stepPixels<16||Math.abs(delta)*pixelsPerMillimeter>6)continue;
   proxy.position.setComponent(index,raw+delta);
   bounds.translate(new THREE.Vector3().setComponent(index,delta));
   gridSnaps.push(name+'='+Number(nearest.toFixed(5)));
  }
  if(contactSnaps.length){host.dataset.moveContactSnap=contactSnaps.join(',');hint.textContent='他のボディに接触：'+contactSnaps.map(item=>item[0]).join('・')+'方向';}
  else delete host.dataset.moveContactSnap;
  if(gridSnaps.length){host.dataset.moveGridSnap=gridSnaps.join(',');if(!contactSnaps.length)hint.textContent='先端がグリッドに吸着：'+gridSnaps.join(' / ')+' mm';}
  else delete host.dataset.moveGridSnap;
  if(!gridSnaps.length&&!contactSnaps.length)hint.textContent='ドラッグで移動 · 先端はグリッドと他のボディに吸着';
  proxy.updateMatrixWorld(true);
 }
 function lidHinge(mesh,preferredCenter=null){
  const bodyId=mesh.userData.bodyId;
  if(typeof bodyId!=='string'||!bodyId.endsWith('-part2'))return null;
  for(const ref of getReferencePoints()){
   if(ref.bodyId!==bodyId||ref.name!=='ヒンジ軸中心'||!ref.a||!ref.b)continue;
   const a=new THREE.Vector3(...ref.a),b=new THREE.Vector3(...ref.b),axis=b.clone().sub(a);
   if(axis.lengthSq()<1e-8)continue;
   if(preferredCenter&&new THREE.Vector3(...preferredCenter).sub(a).cross(axis).length()/axis.length()>.05)continue;
   return {bodyId,a:ref.a,b:ref.b,pivot:preferredCenter||a.add(b).multiplyScalar(.5).toArray()};
  }
  return null;
 }

 function dragVector(pointer,pivot,axis){
  if(!pointer)return null;
  const rect=canvas.getBoundingClientRect();
  dragRay.setFromCamera(new THREE.Vector2((pointer.x-rect.left)/rect.width*2-1,1-(pointer.y-rect.top)/rect.height*2),camera);
  if(Math.abs(dragRay.ray.direction.dot(axis))<.05)return null;
  const world=new THREE.Vector3();
  if(!dragRay.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(axis,pivot),world))return null;
  world.sub(pivot);
  world.addScaledVector(axis,-world.dot(axis));
  return world.lengthSq()>1e-8?world.normalize():null;
 }
 function clearPreview(){control.detach();for(const mesh of originals)mesh.visible=true;if(proxy){scene.remove(proxy);proxy.traverse(o=>{if(o.userData.moveMaterial)o.material.dispose();});}original=null;originals=[];proxy=null;delete host.dataset.moveGridSnap;delete host.dataset.moveContactSnap;}
 function close(force=false,applied=false){if(busy&&!force)return;finishFreeMove(false);const targets=originals.map(m=>m.userData.bodyId);++revision;busy=false;control.dragging=false;control.axis=null;if(dragPointer&&canvas.hasPointerCapture(dragPointer.id))canvas.releasePointerCapture(dragPointer.id);dragPointer=null;pointMove=null;pickingCenter=false;closeCenterPicker();closePointPicker();pickingAxis=false;closeAxisPicker();clearPreview();active=false;control.enabled=false;panel.hidden=true;for(const el of panel.querySelectorAll('button,input,select'))el.disabled=false;pickButton.setAttribute('aria-pressed','false');getControls().enabled=enabledBefore;host.dataset.moveActive='false';delete host.dataset.movePreview;onClose({targets,applied,force});}
 function mode(value){control.setMode(value);control.setSpace(edgeAxis&&value==='rotate'?'local':'world');control.showX=control.showY=!(edgeAxis&&value==='rotate');control.showZ=true;for(const button of panel.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===value));}
 for(const button of panel.querySelectorAll('[data-mode]'))button.onclick=()=>{finishFreeMove(false);stopPointModes();mode(button.dataset.mode);};
 function mark(){if(pointResult)closePointPicker();hideGhost();reflectPreview();host.dataset.movePreview=JSON.stringify({copy:copying(),reverseCopy:copying()&&reverse.checked,targets:originals.map(m=>m.userData.bodyId),position:proxy.position.toArray(),rotation:degrees().map(x=>x*Math.PI/180),edgeAxis:edgeAxis?.toArray(),pivot:center.toArray(),hingeAngle:edgeAxis?edgeAngle:null});updateGroundButton();}
 function select(selection){
  const meshes=[...new Set([].concat(selection))];if(!meshes.length)return;
  baseRotation.identity();clearPreview();originals=meshes;original=meshes[0];
  if(!chosenEdge||!meshes.some(mesh=>chosenEdge.bodyId===mesh.userData.bodyId)){
   chosenEdge=null;chosenAxisPivot=null;const hinge=pointAction||meshes.length>1?null:lidHinge(original,chosenCenter);
   if(hinge){chosenEdge={bodyId:hinge.bodyId,a:[...hinge.a],b:[...hinge.b]};chosenAxisPivot=[...hinge.pivot];}
  }
  edgeAngle=0;center=chosenCenter?new THREE.Vector3(...chosenCenter):selectionBounds().getCenter(new THREE.Vector3());
  edgeAxis=chosenEdge&&!chosenEdge.circle&&!chosenEdge.arc&&!chosenEdge.curve?new THREE.Vector3(...chosenEdge.b).sub(new THREE.Vector3(...chosenEdge.a)).normalize():null;
  if(edgeAxis)center=chosenAxisPivot?new THREE.Vector3(...chosenAxisPivot):new THREE.Vector3(...chosenEdge.a).add(new THREE.Vector3(...chosenEdge.b)).multiplyScalar(.5);
  alignment=edgeAxis?new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),edgeAxis):new THREE.Quaternion();
  proxy=new THREE.Group();proxy.quaternion.copy(alignment);proxy.position.copy(center);
  const copy=meshes.length===1?original.clone(true):new THREE.Group();
  if(meshes.length>1)for(const mesh of meshes)copy.add(mesh.clone(true));
  copy.position.sub(center).applyQuaternion(alignment.clone().invert());copy.quaternion.premultiply(alignment.clone().invert());
  copy.traverse(o=>{if(o.material){o.material=o.material.clone();o.userData.moveMaterial=true;if(o.isMesh)o.material.color.set(o.userData.qrColors?0xffffff:0x3868ad);}});
  proxy.add(copy);scene.add(proxy);copy.updateMatrix();proxyBaseMatrix=copy.matrix.clone();copy.matrixAutoUpdate=false;
  for(const mesh of originals)mesh.visible=copying();fields.forEach((f,i)=>f.value=i<3?'0':'0.0');edgeInput.value='0.0';
  panel.querySelector('#move-edge-angle-label').hidden=!edgeAxis;axisSelect.disabled=!!edgeAxis;fields.slice(3).forEach(f=>f.parentElement.hidden=!!edgeAxis);
  resetCenter.textContent=meshes.length>1?'選択全体の中心に戻す':'ボディ中心に戻す';
  panel.querySelector('small').textContent=edgeAxis?'選択した直線を共通の軸として回転します。ホイールで拡大・縮小。':meshes.length>1?'選択したボディを一緒に動かします。回転中心は選択全体の中心です。「回転中心を選択」で変更できます。':'先端がグリッドの目盛りや他のボディに近づくと吸着します。「回転中心を選択」「回転軸を選択」で基準を変更できます。';
  control.attach(proxy);control.enabled=true;hint.textContent=meshes.length>1?meshes.length+'個のボディをまとめて移動／回転':'ボディを選択済み · ドラッグまたは数値で調整';panel.querySelector('#move-apply').disabled=false;mode(edgeAxis?'rotate':'translate');mark();
  if(pointAction){mode(pointAction==='rotate'?'rotate':'translate');if(pointAction==='origin'){fields.slice(0,3).forEach((f,i)=>f.value=String(-chosenCenter[i]));fields[0].dispatchEvent(new Event('input',{bubbles:true}));}hint.textContent=(pointAction==='rotate'?'選択した点を回転中心に使用':'選択した点を原点（0, 0, 0）に合わせます')+' · 確定で反映';}
 }
 function start({copy=false}={}){if(active){close();return;}method.value=copy?'copy':'move';reverse.checked=false;reverseLabel.hidden=!copy;pointAction=null;chosenCenter=null;chosenAxisPivot=null;chosenEdge=getSelectedEdge?.();const selectedIds=new Set(getSelection());const selectedMeshes=getMeshes().filter(m=>m.visible&&selectedIds.has(m.userData.bodyId));onStart();enabledBefore=getControls().enabled;getControls().enabled=false;active=true;panel.hidden=false;error.textContent='';hint.textContent='移動するボディをクリック';panel.querySelector('#move-apply').disabled=true;fields.forEach((f,i)=>f.value=i<3?'0':'0.0');host.dataset.moveActive='true';mode('translate');if(selectedMeshes.length)select(selectedMeshes);else if(chosenEdge){const mesh=getMeshes().find(m=>m.userData.bodyId===chosenEdge.bodyId);if(mesh)select(mesh);}}
 let dragPointer=null;canvas.addEventListener('pointerdown',e=>{dragPointer={id:e.pointerId,x:e.clientX,y:e.clientY};},{capture:true});canvas.addEventListener('pointermove',e=>{dragPointer={id:e.pointerId,x:e.clientX,y:e.clientY};},{capture:true});
 canvas.addEventListener('pointerdown',e=>{if(!active||busy||e.button!==0||e.shiftKey)return;if(freeMove){followCursor(e);finishFreeMove(false);hint.textContent='自在移動の位置を決めました。「確定」で適用';e.preventDefault();e.stopImmediatePropagation();return;}if(pickingCenter){const candidate=centerPicker.pick(e);if(candidate)chooseCenterCandidate(candidate);else error.textContent='橙色の○で表示された点をクリックしてください';e.preventDefault();e.stopImmediatePropagation();return;}if(pointMove){const candidate=pointPicker.pick(e);if(candidate)chooseMovePoint(candidate);else error.textContent='表示された○のポイントをクリックしてください';e.preventDefault();e.stopImmediatePropagation();return;}if(pickingAxis){pickAxis(e);e.preventDefault();e.stopImmediatePropagation();return;}if(control.axis)return;const r=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);const hit=ray.intersectObjects(getMeshes().filter(m=>m.visible),false)[0];if(hit){select(hit.object);e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
 let dragStartRotation=null,dragHinge=null,dragStartPosition=null,dragStartBounds=null;
 control.addEventListener('mouseDown',()=>{
  dragStartPosition=proxy?.position.clone()||null;dragStartBounds=proxy?new THREE.Box3().setFromObject(proxy):null;
  dragStartRotation=proxy?rotation():null;
  if(proxy&&edgeAxis&&control.mode==='rotate'&&control.axis==='Z'){
   const axis=new THREE.Vector3(0,0,1).applyQuaternion(proxy.quaternion).normalize(),pivot=proxy.position.clone();
   const previousVector=dragVector(dragPointer,pivot,axis);
   dragHinge={quaternion:proxy.quaternion.clone(),angle:edgeAngle,accum:0,previousRaw:0,
    axis,pivot,previousVector,useRay:!!previousVector,
    cameraPosition:camera.position.clone(),cameraQuaternion:camera.quaternion.clone(),cameraZoom:camera.zoom};
  }else dragHinge=null;
 });
 control.addEventListener('mouseUp',()=>{dragStartRotation=null;dragHinge=null;dragStartPosition=null;dragStartBounds=null;delete host.dataset.moveGridSnap;delete host.dataset.moveContactSnap;});
 control.addEventListener('objectChange',()=>{if(!proxy)return;
 if(control.dragging&&dragHinge){
  const changedCamera=dragHinge.cameraPosition.distanceToSquared(camera.position)>1e-10||Math.abs(dragHinge.cameraQuaternion.dot(camera.quaternion))<1-1e-10||Math.abs(dragHinge.cameraZoom-camera.zoom)>1e-10;
  const raw=control.rotationAngle;
  if(dragHinge.useRay){
   const current=dragVector(dragPointer,dragHinge.pivot,dragHinge.axis);
   if(current&&dragHinge.previousVector&&!changedCamera){
    const step=Math.atan2(dragHinge.axis.dot(dragHinge.previousVector.clone().cross(current)),dragHinge.previousVector.dot(current));
    if(Math.abs(step)<Math.PI/2)dragHinge.accum+=step;
   }
   dragHinge.previousVector=current;
  }else if(Number.isFinite(raw)&&!changedCamera)dragHinge.accum+=raw-dragHinge.previousRaw;
  if(Number.isFinite(raw))dragHinge.previousRaw=raw;
  dragHinge.cameraPosition.copy(camera.position);
  dragHinge.cameraQuaternion.copy(camera.quaternion);
  dragHinge.cameraZoom=camera.zoom;
  edgeAngle=softRotationSnap(dragHinge.angle*Math.PI/180+dragHinge.accum)*180/Math.PI;
  proxy.quaternion.copy(dragHinge.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),(edgeAngle-dragHinge.angle)*Math.PI/180)).normalize();
  proxy.updateMatrixWorld(true);
 }else if(control.dragging&&control.mode==='rotate'&&dragStartRotation){
  const axis=control.rotationAxis.clone().normalize(),local=control.space==='local'&&!['E','XYZE'].includes(control.axis);
  const start=local?alignment.clone().invert().multiply(dragStartRotation).multiply(alignment):dragStartRotation;
  const offset=2*Math.atan2(start.x*axis.x+start.y*axis.y+start.z*axis.z,start.w),raw=control.rotationAngle,delta=softRotationSnap(offset+raw)-offset-raw;
  if(Math.abs(delta)>1e-10){const correction=new THREE.Quaternion().setFromAxisAngle(axis,delta);if(local)proxy.quaternion.multiply(correction);else proxy.quaternion.premultiply(correction);proxy.updateMatrixWorld(true);}
 }
 if(control.dragging&&control.mode==='translate')softMoveSnap();
 const d=proxy.position.clone().sub(center),e=new THREE.Euler().setFromQuaternion(rotation(),'ZYX'),values=[...d.toArray(),e.x*180/Math.PI,e.y*180/Math.PI,e.z*180/Math.PI];fields.forEach((f,i)=>f.value=i<3?Number(values[i].toFixed(5)):rotationAngleText(values[i]));if(edgeAxis)edgeInput.value=rotationAngleText(edgeAngle);mark();});
 panel.addEventListener('input',event=>{
  if(!proxy||busy)return;error.textContent='';const v=fields.map(f=>Number(f.value)),index=fields.indexOf(event.target);
  if(fields.some(f=>!f.value||!f.checkValidity())||v.some(x=>!Number.isFinite(x)))return;
  if(index>=0||event.target===edgeInput){finishFreeMove(false);stopPointModes();}
  if(index>=0&&index<3)proxy.position.copy(center).add(new THREE.Vector3(...v.slice(0,3)));
  else if(edgeAxis&&event.target===edgeInput){
   if(!edgeInput.value||!Number.isFinite(Number(edgeInput.value)))return;edgeAngle=Number(edgeInput.value);
   proxy.quaternion.copy(baseRotation).multiply(alignment).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),edgeAngle*Math.PI/180));
  }else if(index>=3&&!edgeAxis){const angles=degrees();angles[index-3]=v[index];proxy.quaternion.setFromEuler(new THREE.Euler(...angles.map(x=>x*Math.PI/180),'ZYX'));}
  else return;
  proxy.updateMatrixWorld(true);mark();
 });
 for(const field of [...fields.slice(3),edgeInput])field.addEventListener('blur',()=>{if(field.value&&Number.isFinite(Number(field.value)))field.value=rotationAngleText(Number(field.value));});

 const groundButton=document.createElement('button');groundButton.type='button';groundButton.id='move-to-grid';groundButton.title='ボディの底面を表示中の基準グリッド平面に合わせます。下にあるボディも上へ戻せます。';panel.querySelector('.move-fields').after(groundButton);
 function updateGroundButton(){
  if(!proxy){groundButton.textContent='↕ グリッド面に接地';return;}
  proxy.updateMatrixWorld(true);
  const plane=getGridPlane(),normal=new THREE.Vector3(...plane.normal).normalize(),bounds=new THREE.Box3().setFromObject(proxy);
  if(bounds.isEmpty()){groundButton.textContent='↕ グリッド面に接地';return;}
  let minimum=Infinity;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])minimum=Math.min(minimum,normal.x*x+normal.y*y+normal.z*z);
  const distance=(plane.offset||0)-minimum;
  groundButton.textContent=distance>.0001?'↑ グリッド面まで上げる':distance<-.0001?'↓ グリッド面まで下ろす':'✓ グリッド面に接地済み';
 }
 updateGroundButton();
 groundButton.onclick=()=>{
  if(!proxy||busy){error.textContent='先に移動するボディを選択してください';return;}
  finishFreeMove(false);stopPointModes();
  const plane=getGridPlane(),normal=new THREE.Vector3(...plane.normal).normalize();let minimum=Infinity;proxy.updateMatrixWorld(true);
  proxy.traverse(o=>{if(!o.isMesh||!o.geometry?.attributes.position)return;const pos=o.geometry.attributes.position,p=new THREE.Vector3();for(let i=0;i<pos.count;i++)minimum=Math.min(minimum,p.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld).dot(normal));});
  if(!Number.isFinite(minimum))return;
  const distance=(plane.offset||0)-minimum;
  proxy.position.addScaledVector(normal,distance);proxy.updateMatrixWorld(true);
  const delta=proxy.position.clone().sub(center);
  fields.slice(0,3).forEach((f,i)=>f.value=Number(delta.getComponent(i).toFixed(8)));
  error.textContent='';
  hint.textContent=(distance>.0001?'グリッド面まで上げました':distance<-.0001?'グリッド面まで下ろしました':'グリッド面に接地しています')+'。「確定」で適用';
  mark();
 };
 const pickButton=document.createElement('button');pickButton.type='button';pickButton.id='move-pick-axis';pickButton.textContent='回転軸を選択';rotationOptions.prepend(pickButton);
 const axisStatus=document.createElement('small');axisStatus.id='move-axis-pick-status';axisStatus.hidden=true;axisStatus.setAttribute('role','status');rotationOptions.prepend(axisStatus);
 function axisTransform(){proxy.updateMatrixWorld(true);const matrix=proxy.matrixWorld.clone().multiply(proxy.children[0].matrix);if(originals.length===1){original.updateMatrixWorld(true);matrix.multiply(original.matrixWorld.clone().invert());}return matrix;}
 function axisSources(){
  const transform=axisTransform(),selected=new Set(originals.map(m=>m.userData.bodyId));
  const convert=ref=>{if(!selected.has(ref.bodyId))return ref;const next={...ref};for(const key of ['point','a','b'])if(ref[key])next[key]=new THREE.Vector3(...ref[key]).applyMatrix4(transform).toArray();return next;};
  return {meshes:previewMeshes(),occluders:[...previewMeshes(),...getMeshes().filter(m=>m.visible)],lines:getReferenceLines().map(convert),points:getReferencePoints().map(convert),pointKinds:pointKinds()};
 }
 const axisPicker=createMoveAxisPicker({host,canvas,camera,getSources:axisSources,getRevision:()=>proxy?[...proxy.matrixWorld.elements,...proxy.children[0].matrix.elements].join(','):'',onPick:chooseAxisCandidate,onUpdate:candidates=>{const lines=candidates.filter(c=>c.kind==='line').length,points=candidates.length-lines;axisStatus.textContent=lines||points?'選択可能：直線 '+lines+' 本・点 '+points+' 個。橙色の線・○をクリック':'この視点では候補が見えません。視点を回して確認してください';}});
 function closeAxisPicker(){axisPicker.close();axisStatus.hidden=true;helper.visible=!!control.object;}
 pickButton.onclick=()=>{finishFreeMove(false);pointMove=null;if(!proxy||busy){error.textContent='先に移動するボディを選択してください';return;}pickingCenter=false;closeCenterPicker();closePointPicker();pickingAxis=!pickingAxis;control.enabled=!pickingAxis;pickButton.setAttribute('aria-pressed',String(pickingAxis));error.textContent='';if(pickingAxis){helper.visible=false;axisStatus.hidden=false;axisPicker.open();}else closeAxisPicker();hint.textContent=pickingAxis?'橙色の直線・○の点から選択。カーソルを合わせると強調表示します':'ボディを選択済み · ドラッグまたは数値で調整';};
 function chooseAxisCandidate(candidate){
  if(!pickingAxis||!proxy)return;const inverse=axisTransform().invert(),basePoint=point=>point.clone().applyMatrix4(inverse);
  if(candidate.kind==='line')selectAxis({a:basePoint(candidate.a),b:basePoint(candidate.b)});
  else if(candidate.ref.a&&candidate.ref.b)selectAxis({a:basePoint(new THREE.Vector3(...candidate.ref.a)),b:basePoint(new THREE.Vector3(...candidate.ref.b))},basePoint(candidate.point));
  else{pickingAxis=false;pickButton.setAttribute('aria-pressed','false');closeAxisPicker();changeCenter(basePoint(candidate.point));hint.textContent='点を回転中心に設定しました。X・Y・Zの回転軸を選んでください';}
 }
 function pickAxis(event){const candidate=axisPicker.pick(event);if(candidate)chooseAxisCandidate(candidate);else error.textContent='橙色の直線または○の点をクリックしてください';}
 function selectAxis(best,pivot=null){
  const oldRotation=rotation(),oldCenter=center.clone(),oldPosition=proxy.position.clone(),target=originals.slice();
  chosenCenter=null;chosenAxisPivot=pivot?.toArray()||null;chosenEdge={bodyId:original.userData.bodyId,a:best.a.toArray(),b:best.b.toArray()};select(target);
  baseRotation.copy(oldRotation);proxy.quaternion.copy(oldRotation).multiply(alignment);proxy.position.copy(oldPosition).add(center.clone().sub(oldCenter).applyQuaternion(oldRotation));
  const delta=proxy.position.clone().sub(center);fields.slice(0,3).forEach((f,i)=>f.value=delta.getComponent(i));fields.slice(3).forEach((f,i)=>f.value=rotationAngleText(degrees()[i]));proxy.updateMatrixWorld(true);pickingAxis=false;closeAxisPicker();pickButton.setAttribute('aria-pressed','false');control.enabled=true;error.textContent='';hint.textContent='回転軸を選択済み · リング・角度・±90°で調整';mark();
 }

 const pointButton=document.createElement('button');pointButton.type='button';pointButton.id='move-point-to-point';pointButton.textContent='点から点へ移動';panel.querySelector('.move-fields').after(pointButton);
 const freeButton=document.createElement('button');freeButton.type='button';freeButton.id='move-free';freeButton.textContent='自在移動';freeButton.setAttribute('aria-pressed','false');pointButton.after(freeButton);
 const moveOptions=document.createElement('div');moveOptions.className='move-point-options';moveOptions.innerHTML='<label>移動方向（点・自在）<select id="move-direction"><option value="free">自由</option><option value="X">Xのみ</option><option value="Y">Yのみ</option><option value="Z">Zのみ</option><option value="XY">XY平面（高さ固定）</option></select></label><fieldset id="move-point-filters"><legend>候補点</legend>'+[['vertex','頂点'],['midpoint','中点'],['center','中心・原点'],['sketch','スケッチ点']].map(([kind,label])=>'<label><input type="checkbox" data-point-kind="'+kind+'" checked>'+label+'</label>').join('')+'</fieldset><label><input id="move-hover-preview" type="checkbox" checked>移動先を半透明でプレビュー</label>';freeButton.after(moveOptions);
 moveOptions.style.cssText='font-size:12px;display:grid;gap:6px;margin:8px 0';
 const filterBox=moveOptions.querySelector('fieldset');filterBox.style.cssText='display:flex;flex-wrap:wrap;gap:6px 10px;border:1px solid #b6cbd7;border-radius:5px;padding:6px';
 for(const label of filterBox.querySelectorAll('label'))label.style.cssText='display:flex;align-items:center;gap:3px';
 for(const input of moveOptions.querySelectorAll('input[type=checkbox]'))input.style.cssText='width:auto;margin:0 3px 0 0';
 const freeSnapLabel=document.createElement('label');freeSnapLabel.innerHTML='<input id="move-free-snap" type="checkbox" checked>自在移動で吸着（Altで一時解除）';freeSnapLabel.querySelector('input').style.cssText='width:auto;margin:0 3px 0 0';moveOptions.append(freeSnapLabel);
 const freeSnapEnabled=panel.querySelector('#move-free-snap'),freeSnapStatus=document.createElement('p');freeSnapStatus.id='move-free-snap-status';freeSnapStatus.setAttribute('role','status');freeSnapStatus.style.cssText='color:#006847;font-size:12px;margin:6px 0';freeSnapStatus.hidden=true;freeButton.after(freeSnapStatus);
 const freeSnapMarker=createFreeMoveSnapMarker({host,canvas,camera});
 const directionSelect=panel.querySelector('#move-direction'),hoverPreview=panel.querySelector('#move-hover-preview');
 const pointKinds=()=>[...filterBox.querySelectorAll('input:checked')].map(input=>input.dataset.pointKind);
 const directionNote=()=>directionSelect.value==='free'?'':'（'+directionSelect.selectedOptions[0].textContent+'）';
 const pointStatus=document.createElement('p');pointStatus.style.cssText='font-size:12px;line-height:1.5;margin:6px 0';pointStatus.id='move-point-status';pointStatus.hidden=true;pointStatus.setAttribute('role','status');pointButton.after(pointStatus);let pointCount=0;
 const pointSource=()=>pointMove?.source?pointMove.source.clone().applyMatrix4(axisTransform()):null;
 const destination=point=>{const source=pointSource();return source.clone().add(constrainMoveDelta(point.clone().sub(source),directionSelect.value));};
 function hideGhost(){disposeMoveGhost(ghost);ghost=null;hoverTarget=null;delete host.dataset.moveGhost;}
 function showGhost(candidate){
  hideGhost();hoverTarget=candidate;if(!hoverPreview.checked||!pointMove?.source||!candidate||!proxy)return;
  const delta=destination(candidate.point).sub(pointSource()),position=proxy.position.clone().add(delta);
  ghost=createMoveGhost(proxy);ghost.matrix.copy(proxy.matrixWorld);ghost.matrix.setPosition(position);
  ghost.children[0].matrix.copy(movePreviewChildMatrix(proxyBaseMatrix,position,center,proxy.quaternion,copying()&&reverse.checked));
  scene.add(ghost);ghost.updateMatrixWorld(true);host.dataset.moveGhost=JSON.stringify({delta:delta.toArray(),targets:originals.map(m=>m.userData.bodyId)});
 }
 function translationFields(){const delta=proxy.position.clone().sub(center);fields.slice(0,3).forEach((f,i)=>f.value=Number(delta.getComponent(i).toFixed(8)));}
 function stopPointModes(){pointMove=null;closePointPicker();pickingAxis=false;closeAxisPicker();pickButton.setAttribute('aria-pressed','false');pickingCenter=false;closeCenterPicker();control.enabled=!!proxy&&!busy;}
 function finishFreeMove(restore){
  if(!freeMove)return;
  const start=freeMove.startPosition;freeMove=null;freeSnapMarker.close();freeSnapStatus.hidden=true;freeButton.setAttribute('aria-pressed','false');delete host.dataset.moveFree;
  control.enabled=!!proxy&&!busy;helper.visible=!!control.object;
  if(restore&&proxy){proxy.position.copy(start);proxy.updateMatrixWorld(true);translationFields();mark();hint.textContent='自在移動を中止し、開始位置に戻しました';}
 }
 function freeSourceCandidates(rect){
  const points=transformedMoveReferences(freeMove.sourceReferences);
  return {points,candidates:moveCenterCandidates({meshes:[],occluders:previewMeshes(),points,pointKinds:pointKinds(),camera,width:rect.width,height:rect.height})};
 }
 function freeTargetCandidates(rect){
  const meshes=getMeshes().filter(mesh=>mesh.visible),selected=new Set(originals.map(mesh=>mesh.userData.bodyId)),points=getReferencePoints().filter(ref=>!selected.has(ref.bodyId)||copying());
  for(const mesh of meshes)mesh.updateMatrixWorld(true);
  const signature=[rect.width,rect.height,...camera.matrixWorld.elements,...camera.projectionMatrix.elements,pointKinds().join(','),...meshes.flatMap(mesh=>[mesh.uuid,...mesh.matrixWorld.elements]),JSON.stringify(points)].join(',');
  if(signature!==freeMove.targetSignature){
   freeMove.targetSignature=signature;
   freeMove.targets=moveCenterCandidates({meshes:[],occluders:meshes,points:[...transformedMoveReferences(snapshotMoveReferences(meshes)),...points.map((ref,i)=>({...ref,key:'reference:'+i})),{point:[0,0,0],name:'原点',kind:'center',key:'origin'}],pointKinds:pointKinds(),camera,width:rect.width,height:rect.height});
  }
  return freeMove.targets;
 }
 function refreshFreeSnap(){if(freeMove?.lastPointer)followCursor(freeMove.lastPointer);}
 function freeMoveHint(){return getGridSnap().plane+'基準平面に平行にカーソルへ追従'+directionNote()+'。クリックで位置決定 ／ Escで開始位置へ戻す';}
 function followCursor(event){
  if(!freeMove||!proxy||busy)return;
  freeMove.lastPointer={clientX:event.clientX,clientY:event.clientY,altKey:event.altKey===true};
  const rect=canvas.getBoundingClientRect(),point=cursorMovePoint(camera,rect,event.clientX,event.clientY,freeMove.plane);if(!point){hint.textContent='基準平面が線状に見えています。視点を少し回転してください';return;}
  hint.textContent=freeMoveHint();
  if(!freeMove.anchor){
   freeMove.anchor=point;
   const closest=freeSourceCandidates(rect).candidates.map(candidate=>({candidate,distance:Math.hypot(candidate.screen.x-(event.clientX-rect.left),candidate.screen.y-(event.clientY-rect.top))})).filter(item=>item.distance<=16).sort((a,b)=>a.distance-b.distance)[0];
   freeMove.gridKey=closest?.candidate.ref.key||null;return;
  }
  const delta=constrainMoveDelta(point.sub(freeMove.anchor),directionSelect.value,freeMove.plane.normal);
  proxy.position.copy(freeMove.basePosition).add(delta);proxy.updateMatrixWorld(true);reflectPreview();
  let snap=null;const released=event.altKey||freeMove.altPressed;
  if(freeSnapEnabled.checked&&!released){
   const sources=freeSourceCandidates(rect),reference=sources.points.find(ref=>ref.key===freeMove.gridKey);
   snap=findFreeMoveSnap({sources:sources.candidates,targets:freeTargetCandidates(rect),position:proxy.position,pivot:center,direction:directionSelect.value,planeNormal:freeMove.plane.normal,mirrored:copying()&&reverse.checked,camera,width:rect.width,height:rect.height,grid:getGridSnap(),gridSource:{point:reference?new THREE.Vector3(...reference.point):proxy.position.clone(),name:reference?.name||'移動中心'},previous:freeMove.previousSnap});
  }
  if(snap)proxy.position.copy(snap.position);freeMove.previousSnap=snap;
  proxy.updateMatrixWorld(true);translationFields();mark();freeSnapStatus.hidden=false;
  if(snap){freeSnapMarker.show(snap);freeSnapStatus.textContent=snap.source+' → '+snap.target+'に吸着';}
  else{freeSnapMarker.close();freeSnapStatus.textContent=released?'Alt：吸着を一時解除中':freeSnapEnabled.checked?'頂点・中点・中心・グリッドに近づくと吸着':'吸着なしで自在移動';}
  host.dataset.moveFree=JSON.stringify({position:proxy.position.toArray(),direction:directionSelect.value});
 }
 canvas.addEventListener('pointermove',event=>{if(freeMove){followCursor(event);event.stopImmediatePropagation();}},{capture:true});
 freeButton.onclick=()=>{
  if(!proxy||busy){error.textContent='先に移動するボディを選択してください';return;}
  if(freeMove){finishFreeMove(false);hint.textContent='自在移動の位置を決めました。「確定」で適用';return;}
  stopPointModes();mode('translate');control.enabled=false;helper.visible=false;control.axis=null;error.textContent='';
  freeMove={startPosition:proxy.position.clone(),basePosition:proxy.position.clone(),anchor:null,sourceReferences:snapshotMoveReferences(previewMeshes()),plane:cursorMovePlane(proxy.position,getGridPlane().normal)};
  freeSnapStatus.hidden=false;freeSnapStatus.textContent='頂点・中点・中心・グリッドに吸着 ／ Altで一時解除';freeButton.setAttribute('aria-pressed','true');host.dataset.moveFree=JSON.stringify({position:proxy.position.toArray(),direction:directionSelect.value});hint.textContent=freeMoveHint();
 };
 filterBox.onchange=()=>{hideGhost();if(pointMove)pointPicker.open();else if(pickingCenter)centerPicker.open();else if(pickingAxis)axisPicker.open();refreshFreeSnap();};
 directionSelect.onchange=()=>{hideGhost();if(pointResult)closePointPicker();if(pointMove)pointPicker.open();if(freeMove){freeMove.basePosition.copy(proxy.position);freeMove.anchor=null;freeMove.previousSnap=null;freeSnapMarker.close();hint.textContent=freeMoveHint();}};
 freeSnapEnabled.onchange=refreshFreeSnap;
 for(const type of ['keydown','keyup'])window.addEventListener(type,event=>{if(event.key!=='Alt'||!freeMove)return;event.preventDefault();freeMove.altPressed=type==='keydown';if(freeMove.lastPointer){freeMove.lastPointer.altKey=freeMove.altPressed;refreshFreeSnap();}});
 window.addEventListener('blur',()=>{if(freeMove){freeMove.altPressed=false;if(freeMove.lastPointer)freeMove.lastPointer.altKey=false;}});
 hoverPreview.onchange=()=>{const candidate=hoverTarget;showGhost(candidate);};
 function updatePointStatus(candidate=null){
  if(pointResult){pointStatus.textContent='移動元：'+pointResult.sourceName+' → 移動先：'+pointResult.targetName+' ／ '+movePointDistanceText(pointResult.source.distanceTo(pointResult.target))+directionNote()+'（確定で反映）';return;}
  if(!pointMove)return;
  pointStatus.textContent=pointMove.source?(candidate?'移動元：'+pointMove.name+' → 移動先：'+candidate.ref.name+' ／ 移動距離 '+movePointDistanceText(pointSource().distanceTo(destination(candidate.point)))+directionNote():'青：選択した移動元 ／ 橙：移動先 '+pointCount+' 点から選択'+directionNote()):'青：移動元 '+pointCount+' 点から選択';
 }
 const pointPicker=createMoveAxisPicker({host,canvas,camera,id:'move-point-candidates',dataset:'movePoint',getCandidates:movePointCandidates,getSources:()=>{if(!pointMove)return {meshes:[],occluders:[],points:[]};const sources=axisSources(),meshes=pointMove.source?[...sources.meshes,...getMeshes().filter(m=>m.visible)]:sources.meshes;return {...sources,meshes,pointKinds:pointKinds(),source:!!pointMove.source,points:[...(pointMove.source?[{point:[0,0,0],name:'原点'}]:[]),...sources.points]};},getRevision:()=>proxy?[...proxy.matrixWorld.elements,...proxy.children[0].matrix.elements].join(','):'',palette:()=>pointMove&&!pointMove.source?{color:'#1679bf',hover:'#005c9e',fill:'#c7eaff'}:{color:'#d56b00',hover:'#ff7900',fill:'#ffdb81'},getGuide:candidate=>pointResult||pointMove?.source&&{source:pointSource(),target:candidate?destination(candidate.point):null},onPick:chooseMovePoint,onUpdate:candidates=>{hideGhost();pointCount=candidates.length;updatePointStatus();},onHover:candidate=>{updatePointStatus(candidate);showGhost(candidate);}});
 function closePointPicker(){hideGhost();pointPicker.close();pointResult=null;pointStatus.hidden=true;pointButton.setAttribute('aria-pressed','false');helper.visible=!!control.object;}
 function chooseMovePoint(candidate){
  if(!pointMove||!proxy||busy)return;error.textContent='';
  if(!pointMove.source){pointMove.source=candidate.point.clone().applyMatrix4(axisTransform().invert());pointMove.name=candidate.ref.name;hint.textContent='移動元を青で固定しました。橙色の移動先に合わせると補助線と距離を表示します';pointPicker.open();return;}
  const source=pointSource(),target=destination(candidate.point),sourceName=pointMove.name,targetName=candidate.ref.name,distance=source.distanceTo(target);
  proxy.position.add(target.clone().sub(source));proxy.updateMatrixWorld(true);translationFields();pointMove=null;closePointPicker();control.enabled=true;mark();pointResult={source,target,sourceName,targetName};pointStatus.hidden=false;pointPicker.open();hint.textContent=(directionSelect.value==='free'?'2点を合わせました':'指定方向に合わせました')+'（移動距離 '+movePointDistanceText(distance)+'）。「確定」で適用';
 }
 pointButton.onclick=()=>{finishFreeMove(false);if(!proxy||busy){error.textContent='先に移動するボディを選択してください';return;}if(pointMove){pointMove=null;closePointPicker();control.enabled=true;hint.textContent='点から点への移動を中止しました';return;}closePointPicker();pickingAxis=false;closeAxisPicker();pickButton.setAttribute('aria-pressed','false');pickingCenter=false;closeCenterPicker();control.enabled=false;helper.visible=false;pointMove={source:null};pointButton.setAttribute('aria-pressed','true');pointStatus.hidden=false;error.textContent='';hint.textContent='青い○から移動元を選択してください。点の種類はカーソルを合わせると確認できます';pointPicker.open();};
 const centerButton=document.createElement('button');centerButton.type='button';centerButton.id='move-pick-center';centerButton.textContent='回転中心を選択';rotationOptions.prepend(centerButton);
 const resetCenter=document.createElement('button');resetCenter.type='button';resetCenter.id='move-reset-center';resetCenter.textContent='ボディ中心に戻す';rotationOptions.append(resetCenter);
 function changeCenter(point){
  const oldRotation=rotation(),oldCenter=center.clone(),oldPosition=proxy.position.clone(),target=originals.slice();
  chosenCenter=point.toArray();chosenAxisPivot=null;chosenEdge=null;select(target);if(edgeAxis){baseRotation.copy(oldRotation);proxy.quaternion.copy(oldRotation).multiply(alignment);}else proxy.quaternion.copy(oldRotation);proxy.position.copy(oldPosition).add(center.clone().sub(oldCenter).applyQuaternion(oldRotation));
  const delta=proxy.position.clone().sub(center);fields.slice(0,3).forEach((f,i)=>f.value=Number(delta.getComponent(i).toFixed(5)));fields.slice(3).forEach((f,i)=>f.value=rotationAngleText(degrees()[i]));proxy.updateMatrixWorld(true);pickingCenter=false;closeCenterPicker();closePointPicker();control.enabled=true;mode('rotate');error.textContent='';hint.textContent=edgeAxis?'ヒンジ軸を選択済み · リング・角度・±90°で調整':'回転中心を選択済み · リング・角度・±90°で調整';panel.querySelector('small').textContent=edgeAxis?'選択した点から奥へ伸びるヒンジ軸で回転します。ホイールで拡大・縮小、Shift＋ホイールで視点を水平回転。':'選択した中心を通るX・Y・Z軸で回転します。';mark();
 }
 const centerStatus=document.createElement('small');centerStatus.id='move-center-pick-status';centerStatus.hidden=true;centerStatus.setAttribute('role','status');centerButton.before(centerStatus);
 const centerPicker=createMoveAxisPicker({host,canvas,camera,id:'move-center-candidates',dataset:'moveCenter',getCandidates:moveCenterCandidates,getSources:()=>{const sources=axisSources(),meshes=[...sources.meshes,...otherMeshes()];return {...sources,meshes,occluders:meshes};},getRevision:()=>proxy?[...proxy.matrixWorld.elements,...proxy.children[0].matrix.elements].join(','):'',onPick:chooseCenterCandidate,onUpdate:candidates=>{centerStatus.textContent=candidates.length?'選択可能：'+candidates.length+' 点。橙色の○をクリック':'この視点では候補が見えません。視点を回して確認してください';}});
 function closeCenterPicker(){centerPicker.close();centerStatus.hidden=true;centerButton.setAttribute('aria-pressed','false');helper.visible=!!control.object;}
 function chooseCenterCandidate(candidate){if(!pickingCenter||!proxy||busy)return;const point=candidate.point.clone().applyMatrix4(axisTransform().invert());changeCenter(point);hint.textContent=candidate.ref.name+'を回転中心に設定しました · リング・角度で調整';}
 centerButton.onclick=()=>{finishFreeMove(false);pointMove=null;if(!proxy||busy){error.textContent='先にボディを選択してください';return;}pickingAxis=false;closeAxisPicker();pickButton.setAttribute('aria-pressed','false');pickingCenter=!pickingCenter;control.enabled=!pickingCenter;closePointPicker();error.textContent='';if(pickingCenter){helper.visible=false;centerButton.setAttribute('aria-pressed','true');centerStatus.hidden=false;centerPicker.open();hint.textContent='橙色の○から回転中心を選択。頂点・辺の中点・面や円の中心・スケッチ点を選べます';}else{closeCenterPicker();hint.textContent='ボディを選択済み';}};
 resetCenter.onclick=()=>{if(proxy&&!busy){finishFreeMove(false);stopPointModes();changeCenter(selectionBounds().getCenter(new THREE.Vector3()));}};
 panel.querySelector('#move-cancel').onclick=()=>close();
 for(const [id,delta] of [['move-plus90',90],['move-minus90',-90]])panel.querySelector('#'+id).onclick=()=>{if(!proxy||busy)return;mode('rotate');const input=edgeAxis?edgeInput:fields[3+['X','Y','Z'].indexOf(axisSelect.value)];const angle=(edgeAxis?edgeAngle:degrees()[['X','Y','Z'].indexOf(axisSelect.value)])+delta;input.value=String(angle);input.dispatchEvent(new Event('input',{bubbles:true}));input.value=rotationAngleText(angle);};
 panel.onsubmit=async e=>{e.preventDefault();if(!proxy||busy||!panel.reportValidity())return;finishFreeMove(false);stopPointModes();const v=fields.map(f=>Number(f.value)),request=revision;busy=true;control.enabled=false;for(const el of panel.querySelectorAll('button,input,select'))el.disabled=true;error.textContent='形状を確定中…';try{if(copying()&&reverse.checked&&proxy.position.distanceTo(center)<1e-7)throw Error('鏡写しにする移動方向を指定してください');await onApply({type:'move',copy:copying(),reverseCopy:copying()&&reverse.checked,target:original.userData.bodyId,...(originals.length>1?{targets:originals.map(m=>m.userData.bodyId)}:{}),x:v[0],y:v[1],z:v[2],rotation:degrees(),pivot:center.toArray()});if(request!==revision)return;busy=false;close(false,true);}catch(e){if(request!==revision)return;busy=false;error.textContent=e.message;control.enabled=active;}finally{if(request===revision){for(const el of panel.querySelectorAll('button,input,select'))el.disabled=false;axisSelect.disabled=!!edgeAxis;}}};
 window.addEventListener('keydown',e=>{if(active&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(freeMove)finishFreeMove(true);else close();}},{capture:true});
 window.addEventListener('keydown',e=>{if(!active||e.key==='Escape')return;if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){if(busy){e.preventDefault();e.stopImmediatePropagation();}else close();}else if(!e.target.matches?.('input,select,textarea')&&['e','l'].includes(e.key.toLowerCase())){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
 document.addEventListener('click',e=>{if(active&&e.target.closest('.toolbar, .command-toolbar')&&!e.target.closest('#move-tool'))close();},{capture:true});
 return {start,fromPoint(reference,action='rotate'){
  if(busy)return;if(!['rotate','origin'].includes(action)||!Array.isArray(reference?.point)||reference.point.length!==3||!reference.point.every(Number.isFinite))throw Error('有効な中心・中点を選択してください');
  const point=[...reference.point],bodyId=reference.bodyId;if(active)close();start();chosenEdge=null;chosenAxisPivot=null;chosenCenter=point;pointAction=action;
  const mesh=getMeshes().find(m=>(m.visible||originals.includes(m))&&m.userData.bodyId===bodyId);if(mesh)select(mesh);else {mode(action==='rotate'?'rotate':'translate');hint.textContent='選択した点を基準にするボディをクリック';}
 },place(mesh){if(active)close();start();chosenEdge=null;select(mesh);},cancelFreeMove(){if(!freeMove)return false;finishFreeMove(true);return true;},cancel:close,get active(){return active;},get pickingReference(){return !!(pointMove||pickingAxis||pickingCenter);},get selectedBodyIds(){return originals.map(m=>m.userData.bodyId);},get selectedBodyId(){return original?.userData.bodyId||null;}};
}
