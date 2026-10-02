import {softRotationSnap} from './rotation-snap.js';
import {contactTranslation} from './move-contact-geometry.js';
import * as THREE from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {installMoveAxisLabels} from './move-axis-labels.js';
export function createMoveTool({scene,camera,canvas,host,getMeshes,getReferencePoints=()=>[],getReferenceLines=()=>[],getGridPlane=()=>({normal:[0,0,1],offset:0}),getGridSnap=()=>({enabled:false,step:10,plane:'XY'}),getControls,getSelectedEdge,onStart,onApply}){
 const control=new TransformControls(camera,canvas),helper=control.getHelper();scene.add(helper);control.setSize(.8);control.setSpace('world');control.enabled=false;
 installMoveAxisLabels(control,helper,camera,canvas,host);
 const panel=document.createElement('form');panel.id='move-panel';panel.hidden=true;panel.innerHTML='<strong>移動／回転</strong><p id="move-hint">移動するボディをクリック</p><div class="move-modes"><button type="button" data-mode="translate">↔ 移動</button><button type="button" data-mode="rotate">↻ 回転</button></div><div class="move-fields">'+[['x','X移動 (mm)'],['rx','X回転 (°)'],['y','Y移動 (mm)'],['ry','Y回転 (°)'],['z','Z移動 (mm)'],['rz','Z回転 (°)']].map(([id,label])=>'<label>'+label+'<input id="move-'+id+'" type="number" step="any" value="0" required min="-10000" max="10000"></label>').join('')+'</div><small>矢印・平面ハンドルで移動、リングで回転。回転中心はボディの中心です。ホイールで拡大・縮小。</small><p id="move-error" role="alert"></p><div><button type="button" id="move-cancel">キャンセル</button><button id="move-apply" type="submit">確定</button></div>';host.parentElement.append(panel);
 const fields=['x','y','z','rx','ry','rz'].map(id=>panel.querySelector('#move-'+id)),hint=panel.querySelector('#move-hint'),error=panel.querySelector('#move-error');
 const rotationOptions=document.createElement('div');rotationOptions.innerHTML='<label id="move-edge-angle-label" hidden>辺を軸に回転 (°)<input id="move-edge-angle" type="number" step="any" value="0"></label><label>90°回転の軸 <select id="move-quarter-axis"><option>X</option><option>Y</option><option selected>Z</option></select></label><button type="button" id="move-minus90">−90°</button> <button type="button" id="move-plus90">＋90°</button>';panel.querySelector('.move-fields').after(rotationOptions);
 const edgeInput=panel.querySelector('#move-edge-angle'),axisSelect=panel.querySelector('#move-quarter-axis');
 let chosenCenter=null,chosenAxisPivot=null,pickingCenter=false,chosenEdge=null,edgeAxis=null,alignment=new THREE.Quaternion(),baseRotation=new THREE.Quaternion(),pickingAxis=false,edgeAngle=0;
 const rotation=()=>proxy.quaternion.clone().multiply(alignment.clone().invert());
 const degrees=()=>{const e=new THREE.Euler().setFromQuaternion(rotation(),'ZYX');return [e.x,e.y,e.z].map(x=>Number((x*180/Math.PI).toFixed(10)));};
 let pointMove=null;
 let revision=0,active=false,busy=false,original=null,proxy=null,center=null,enabledBefore=true;
 const ray=new THREE.Raycaster(),dragRay=new THREE.Raycaster();
 function softMoveSnap(){
  if(!proxy||!control.dragging||control.mode!=='translate'||!dragStartPosition||!dragStartBounds)return;
  const {enabled,step,plane}=getGridSnap(),gridEnabled=enabled&&Number.isFinite(step)&&step>0;
  const eligible={XY:'XY',XZ:'XZ',YZ:'YZ'}[plane]||'XY',axes=control.axis||'',rect=canvas.getBoundingClientRect();
  const contactLimit=Math.min(10,Math.max(2,(Number.isFinite(step)?step:10)*.5));
  const targets=getMeshes().filter(mesh=>mesh!==original&&mesh.visible).map(mesh=>({mesh,bounds:new THREE.Box3().setFromObject(mesh)}));
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
 function clearPreview(){control.detach();if(original)original.visible=true;if(proxy){scene.remove(proxy);proxy.traverse(o=>{if(o.userData.moveMaterial)o.material.dispose();});}original=null;proxy=null;delete host.dataset.moveGridSnap;delete host.dataset.moveContactSnap;}
 function close(force=false){if(busy&&!force)return;++revision;busy=false;control.dragging=false;control.axis=null;if(dragPointer&&canvas.hasPointerCapture(dragPointer.id))canvas.releasePointerCapture(dragPointer.id);dragPointer=null;pointMove=null;pickingCenter=false;centerMarkers.replaceChildren();pickingAxis=false;clearPreview();active=false;control.enabled=false;panel.hidden=true;for(const el of panel.querySelectorAll('button,input,select'))el.disabled=false;pickButton.setAttribute('aria-pressed','false');getControls().enabled=enabledBefore;host.dataset.moveActive='false';delete host.dataset.movePreview;}
 function mode(value){control.setMode(value);control.setSpace(edgeAxis&&value==='rotate'?'local':'world');control.showX=control.showY=!(edgeAxis&&value==='rotate');control.showZ=true;for(const button of panel.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===value));}
 for(const button of panel.querySelectorAll('[data-mode]'))button.onclick=()=>mode(button.dataset.mode);
 function mark(){host.dataset.movePreview=JSON.stringify({position:proxy.position.toArray(),rotation:degrees().map(x=>x*Math.PI/180),edgeAxis:edgeAxis?.toArray(),pivot:center.toArray(),hingeAngle:edgeAxis?edgeAngle:null});updateGroundButton();}
 function select(mesh){baseRotation.identity();clearPreview();original=mesh;if(!chosenEdge||chosenEdge.bodyId!==mesh.userData.bodyId){chosenEdge=null;chosenAxisPivot=null;const hinge=lidHinge(mesh,chosenCenter);if(hinge){chosenEdge={bodyId:hinge.bodyId,a:[...hinge.a],b:[...hinge.b]};chosenAxisPivot=[...hinge.pivot];}}edgeAngle=0;center=chosenCenter?new THREE.Vector3(...chosenCenter):new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());edgeAxis=chosenEdge&&!chosenEdge.circle&&chosenEdge.bodyId===mesh.userData.bodyId?new THREE.Vector3(...chosenEdge.b).sub(new THREE.Vector3(...chosenEdge.a)).normalize():null;if(edgeAxis)center=chosenAxisPivot?new THREE.Vector3(...chosenAxisPivot):new THREE.Vector3(...chosenEdge.a).add(new THREE.Vector3(...chosenEdge.b)).multiplyScalar(.5);alignment=edgeAxis?new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),edgeAxis):new THREE.Quaternion();proxy=new THREE.Group();proxy.quaternion.copy(alignment);proxy.position.copy(center);const copy=mesh.clone(true);copy.position.sub(center).applyQuaternion(alignment.clone().invert());copy.quaternion.premultiply(alignment.clone().invert());copy.traverse(o=>{if(o.material){o.material=o.material.clone();o.userData.moveMaterial=true;if(o.isMesh)o.material.color.set(0x3868ad);}});proxy.add(copy);scene.add(proxy);original.visible=false;fields.forEach(f=>f.value='0');edgeInput.value='0';panel.querySelector('#move-edge-angle-label').hidden=!edgeAxis;axisSelect.disabled=!!edgeAxis;fields.slice(3).forEach(f=>f.parentElement.hidden=!!edgeAxis);panel.querySelector('small').textContent=edgeAxis?'選択した直線を軸に回転します。ヒンジの点からは奥へ続く軸線を使います。ホイールで拡大・縮小、Shift＋ホイールで視点を水平回転。':'先端がグリッドの目盛りや他のボディに近づくと吸着します。「回転中心を選択」で円・円弧などの中心、「回転軸を選択」で直線の辺を指定できます。ホイールで拡大・縮小。';control.attach(proxy);control.enabled=true;hint.textContent='ボディを選択済み · ドラッグまたは数値で調整';panel.querySelector('#move-apply').disabled=false;mode(edgeAxis?'rotate':'translate');mark();}
 function start(){if(active){close();return;}chosenCenter=null;chosenAxisPivot=null;chosenEdge=getSelectedEdge?.();onStart();enabledBefore=getControls().enabled;getControls().enabled=false;active=true;panel.hidden=false;error.textContent='';hint.textContent='移動するボディをクリック';panel.querySelector('#move-apply').disabled=true;fields.forEach(f=>f.value='0');host.dataset.moveActive='true';mode('translate');if(chosenEdge){const mesh=getMeshes().find(m=>m.userData.bodyId===chosenEdge.bodyId);if(mesh)select(mesh);}}
 let dragPointer=null;canvas.addEventListener('pointerdown',e=>{dragPointer={id:e.pointerId,x:e.clientX,y:e.clientY};},{capture:true});canvas.addEventListener('pointermove',e=>{dragPointer={id:e.pointerId,x:e.clientX,y:e.clientY};},{capture:true});
 canvas.addEventListener('pointerdown',e=>{if(!active||busy||e.button!==0||e.shiftKey)return;if(pickingCenter||pointMove){e.preventDefault();e.stopImmediatePropagation();return;}if(pickingAxis){pickAxis(e);e.preventDefault();e.stopImmediatePropagation();return;}if(control.axis)return;const r=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);const hit=ray.intersectObjects(getMeshes().filter(m=>m.visible),false)[0];if(hit){select(hit.object);e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
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
  edgeAngle=dragHinge.angle+dragHinge.accum*180/Math.PI;
  proxy.quaternion.copy(dragHinge.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),dragHinge.accum)).normalize();
  proxy.updateMatrixWorld(true);
 }else if(control.dragging&&control.mode==='rotate'&&dragStartRotation){
  const axis=control.rotationAxis.clone().normalize(),local=control.space==='local'&&!['E','XYZE'].includes(control.axis);
  const start=local?alignment.clone().invert().multiply(dragStartRotation).multiply(alignment):dragStartRotation;
  const offset=2*Math.atan2(start.x*axis.x+start.y*axis.y+start.z*axis.z,start.w),raw=control.rotationAngle,delta=softRotationSnap(offset+raw)-offset-raw;
  if(Math.abs(delta)>1e-10){const correction=new THREE.Quaternion().setFromAxisAngle(axis,delta);if(local)proxy.quaternion.multiply(correction);else proxy.quaternion.premultiply(correction);proxy.updateMatrixWorld(true);}
 }
 if(control.dragging&&control.mode==='translate')softMoveSnap();
 const d=proxy.position.clone().sub(center),e=new THREE.Euler().setFromQuaternion(rotation(),'ZYX'),values=[...d.toArray(),e.x*180/Math.PI,e.y*180/Math.PI,e.z*180/Math.PI];fields.forEach((f,i)=>f.value=Number(values[i].toFixed(5)));if(edgeAxis)edgeInput.value=Number(edgeAngle.toFixed(5));mark();});
 panel.addEventListener('input',()=>{if(!proxy||busy)return;const v=fields.map(f=>Number(f.value));if(fields.some(f=>!f.value||!f.checkValidity())||v.some(x=>!Number.isFinite(x)))return;proxy.position.copy(center).add(new THREE.Vector3(...v.slice(0,3)));if(edgeAxis){if(!Number.isFinite(Number(edgeInput.value)))return;edgeAngle=Number(edgeInput.value);proxy.quaternion.copy(baseRotation).multiply(alignment).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Number(edgeInput.value)*Math.PI/180));}else proxy.quaternion.setFromEuler(new THREE.Euler(...v.slice(3).map(x=>x*Math.PI/180),'ZYX'));proxy.updateMatrixWorld(true);mark();});

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
 pickButton.onclick=()=>{pointMove=null;if(!proxy||busy){error.textContent='先に移動するボディを選択してください';return;}pickingCenter=false;centerMarkers.replaceChildren();pickingAxis=!pickingAxis;control.enabled=!pickingAxis;pickButton.setAttribute('aria-pressed',String(pickingAxis));hint.textContent=pickingAxis?'ヒンジ中心・スケッチ点・直線・辺をクリック。通常の点はX/Y/Z方向を選びます':'ボディを選択済み · ドラッグまたは数値で調整';};
 function pickAxis(e){
  if(!proxy)return;proxy.updateMatrixWorld(true);const mesh=proxy.children[0],edges=mesh.children[0],attr=edges?.geometry?.attributes.position;
  const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,refs=getReferencePoints();
  let nearest=null,pointDistance=12;
  for(const ref of refs){
   const world=new THREE.Vector3(...ref.point),projected=world.clone().project(camera);
   if(projected.z< -1||projected.z>1)continue;
   const d=Math.hypot((projected.x+1)*rect.width/2-x,(1-projected.y)*rect.height/2-y);
   if(d<pointDistance){nearest={ref,world};pointDistance=d;}
  }
  if(nearest){
   const hinge=refs.find(ref=>ref.bodyId===original.userData.bodyId&&ref.a&&ref.b&&new THREE.Vector3(...ref.b).sub(new THREE.Vector3(...ref.a)).cross(nearest.world.clone().sub(new THREE.Vector3(...ref.a))).length()<1e-3);
   if(hinge){selectAxis({a:new THREE.Vector3(...hinge.a),b:new THREE.Vector3(...hinge.b)},nearest.world);return;}
   const point=nearest.world.clone().sub(proxy.position).applyQuaternion(rotation().invert()).add(center);
   pickingAxis=false;pickButton.setAttribute('aria-pressed','false');changeCenter(point);
   hint.textContent='点を回転中心に設定しました。X・Y・Zの回転軸を選んでください';
   return;
  }
  let best=null,distance=10;
  for(let i=0;i<(attr?.count||0);i+=2){if(edges.geometry.userData.circularEdges?.has(i))continue;const a=new THREE.Vector3().fromBufferAttribute(attr,i),b=new THREE.Vector3().fromBufferAttribute(attr,i+1),wa=a.clone().applyMatrix4(edges.matrixWorld),wb=b.clone().applyMatrix4(edges.matrixWorld),pa=wa.clone().project(camera),pb=wb.clone().project(camera);if(pa.z< -1||pa.z>1||pb.z< -1||pb.z>1)continue;const ax=(pa.x+1)*rect.width/2,ay=(1-pa.y)*rect.height/2,bx=(pb.x+1)*rect.width/2,by=(1-pb.y)*rect.height/2,dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(x-ax-t*dx,y-ay-t*dy);if(d<distance){const point=wa.clone().lerp(wb,t),screen=point.clone().project(camera);ray.setFromCamera(new THREE.Vector2(screen.x,screen.y),camera);const hit=ray.intersectObject(mesh,false)[0];if(hit&&hit.distance<ray.ray.origin.distanceTo(point)-.02)continue;best={a,b};distance=d;}}
  for(const line of getReferenceLines()){
   const wa=new THREE.Vector3(...line.a),wb=new THREE.Vector3(...line.b),pa=wa.clone().project(camera),pb=wb.clone().project(camera);if(pa.z< -1||pa.z>1||pb.z< -1||pb.z>1||wa.distanceTo(wb)<1e-8)continue;
   const ax=(pa.x+1)*rect.width/2,ay=(1-pa.y)*rect.height/2,bx=(pb.x+1)*rect.width/2,by=(1-pb.y)*rect.height/2,dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(x-ax-t*dx,y-ay-t*dy);
   if(d<=distance){const point=wa.clone().lerp(wb,t),screen=point.clone().project(camera);ray.setFromCamera(new THREE.Vector2(screen.x,screen.y),camera);const hit=ray.intersectObjects([mesh,...getMeshes().filter(m=>m!==original&&m.visible)],false)[0];if(hit&&hit.distance<ray.ray.origin.distanceTo(point)-.02)continue;const inv=rotation().invert();best={a:wa.sub(proxy.position).applyQuaternion(inv).add(center),b:wb.sub(proxy.position).applyQuaternion(inv).add(center)};distance=d;}
  }
  if(!best){error.textContent='回転軸にするスケッチ点・直線・ソリッドの辺をクリックしてください';return;}
  selectAxis(best);
 }
 function selectAxis(best,pivot=null){
  const oldRotation=rotation(),oldCenter=center.clone(),oldPosition=proxy.position.clone(),target=original;
  chosenCenter=null;chosenAxisPivot=pivot?.toArray()||null;chosenEdge={bodyId:target.userData.bodyId,a:best.a.toArray(),b:best.b.toArray()};select(target);
  baseRotation.copy(oldRotation);proxy.quaternion.copy(oldRotation).multiply(alignment);proxy.position.copy(oldPosition).add(center.clone().sub(oldCenter).applyQuaternion(oldRotation));
  const delta=proxy.position.clone().sub(center);fields.slice(0,3).forEach((f,i)=>f.value=delta.getComponent(i));fields.slice(3).forEach((f,i)=>f.value=degrees()[i]);proxy.updateMatrixWorld(true);pickingAxis=false;pickButton.setAttribute('aria-pressed','false');control.enabled=true;error.textContent='';hint.textContent='回転軸を選択済み · リング・角度・±90°で調整';mark();
 }

 const centerMarkers=document.createElement('div');centerMarkers.id='move-center-markers';host.parentElement.append(centerMarkers);
 const pointButton=document.createElement('button');pointButton.type='button';pointButton.id='move-point-to-point';pointButton.textContent='点から点へ移動';panel.querySelector('.move-fields').after(pointButton);
 function showMovePoints(){
  if(!pointMove||!proxy)return;proxy.updateMatrixWorld(true);centerMarkers.replaceChildren();const rect=canvas.getBoundingClientRect(),parent=host.parentElement.getBoundingClientRect(),candidates=[],copy=proxy.children[0];
  const meshes=pointMove.source?[copy,...getMeshes().filter(m=>m!==original&&m.visible)]:[copy];
  const refs=[];
  for(const mesh of meshes){mesh.updateMatrixWorld(true);const edges=mesh.children[0]?.geometry,positions=edges?.attributes.position,items=[...(mesh.userData.references||[]),...new Set(edges?.userData.circularEdges?.values()||[])].map(r=>r.center?{point:r.center}:r);
   if(positions)for(let i=0;i<positions.count;i++)items.push({point:new THREE.Vector3().fromBufferAttribute(positions,i).toArray()});
   for(const item of items){const point=new THREE.Vector3(...item.point).applyMatrix4(mesh.matrixWorld);point.owner=mesh.uuid;refs.push(point);}
  }
  for(const ref of [...(pointMove.source?[{point:[0,0,0]}]:[]),...getReferencePoints()]){const point=new THREE.Vector3(...ref.point);point.isSketchPoint=ref.name==='スケッチ点';refs.unshift(point);}
  refs.sort((a,b)=>Number(!!b.isSketchPoint)-Number(!!a.isSketchPoint)||a.clone().project(camera).z-b.clone().project(camera).z);
  for(const world of refs){const p=world.clone().project(camera);if(p.z< -1||p.z>1)continue;const x=(p.x+1)*rect.width/2,y=(1-p.y)*rect.height/2;if(x<0||x>rect.width||y<0||y>rect.height||candidates.some(c=>Math.hypot(c.x-x,c.y-y)<12))continue;candidates.push({x,y});
   const button=document.createElement('button');button.type='button';button.className='move-center-point'+(world.isSketchPoint?' sketch-reference-point':'');button.textContent=world.isSketchPoint?'●':'⊙';button.title=pointMove.source?'移動先の点':'移動元の点';button.dataset.point=JSON.stringify(world.toArray());button.dataset.owner=world.owner||'';button.style.left=(rect.left-parent.left+x)+'px';button.style.top=(rect.top-parent.top+y)+'px';
   button.onpointerdown=e=>{e.preventDefault();e.stopPropagation();if(!pointMove.source){pointMove.source=world.clone();hint.textContent='移動先の点を選択してください';showMovePoints();return;}proxy.position.add(world.clone().sub(pointMove.source));proxy.updateMatrixWorld(true);const delta=proxy.position.clone().sub(center);fields.slice(0,3).forEach((f,i)=>f.value=Number(delta.getComponent(i).toFixed(8)));pointMove=null;centerMarkers.replaceChildren();control.enabled=true;hint.textContent='2点を合わせました。「確定」で適用';error.textContent='';mark();};centerMarkers.append(button);
  }
 }
 pointButton.onclick=()=>{if(!proxy||busy){error.textContent='先に移動するボディを選択してください';return;}if(pointMove){pointMove=null;centerMarkers.replaceChildren();control.enabled=true;hint.textContent='点から点への移動を中止しました';return;}pickingAxis=false;pickingCenter=false;control.enabled=false;pointMove={source:null};error.textContent='';hint.textContent='移動元の点を選択してください（スケッチ点も選択できます）';showMovePoints();let last='';const refresh=()=>{if(!pointMove)return;const state=camera.matrixWorld.elements.join(',');if(state!==last){last=state;showMovePoints();}requestAnimationFrame(refresh);};requestAnimationFrame(refresh);};
 let markerPointer=null;
 function updateMarkerVisibility(){
  let hit=null;if(markerPointer&&proxy){proxy.updateMatrixWorld(true);const rect=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((markerPointer.x-rect.left)/rect.width*2-1,1-(markerPointer.y-rect.top)/rect.height*2),camera);hit=ray.intersectObjects([proxy.children[0],...getMeshes().filter(m=>m!==original&&m.visible)],false)[0];}
  for(const button of centerMarkers.children){
   if(button.classList.contains('sketch-reference-point')||button.classList.contains('hinge-reference-point')){button.style.visibility='visible';continue;}
   const rect=button.getBoundingClientRect();let visible=!!(markerPointer&&hit&&button.dataset.owner===hit.object.uuid&&Math.hypot(markerPointer.x-(rect.left+rect.width/2),markerPointer.y-(rect.top+rect.height/2))<38);
   if(visible){const point=new THREE.Vector3(...JSON.parse(button.dataset.point)).applyMatrix4(hit.object.matrixWorld.clone().invert()),localHit=hit.point.clone().applyMatrix4(hit.object.matrixWorld.clone().invert()),g=hit.object.geometry,group=g.userData.faceGroups?.find(f=>hit.faceIndex*3>=f.start&&hit.faceIndex*3<f.start+f.count);
    if(!group||g.userData.planarFaces?.includes(group.faceId))visible=Math.abs(point.clone().sub(localHit).dot(hit.face.normal))<.001;
    else{visible=false;const pos=g.attributes.position,ix=g.index,t=new THREE.Triangle(),nearest=new THREE.Vector3();for(let i=group.start;i<group.start+group.count;i+=3){t.a.fromBufferAttribute(pos,ix?ix.getX(i):i);t.b.fromBufferAttribute(pos,ix?ix.getX(i+1):i+1);t.c.fromBufferAttribute(pos,ix?ix.getX(i+2):i+2);if(t.closestPointToPoint(point,nearest).distanceTo(point)<.001){visible=true;break;}}}
   }
   button.style.visibility=visible?'visible':'hidden';
  }
 }
 host.parentElement.addEventListener('pointermove',e=>{markerPointer={x:e.clientX,y:e.clientY};updateMarkerVisibility();});
 host.parentElement.addEventListener('pointerleave',()=>{markerPointer=null;updateMarkerVisibility();});
 new MutationObserver(updateMarkerVisibility).observe(centerMarkers,{childList:true});
 const centerButton=document.createElement('button');centerButton.type='button';centerButton.id='move-pick-center';centerButton.textContent='回転中心を選択';rotationOptions.prepend(centerButton);
 const resetCenter=document.createElement('button');resetCenter.type='button';resetCenter.id='move-reset-center';resetCenter.textContent='ボディ中心に戻す';rotationOptions.append(resetCenter);
 function changeCenter(point){
  const oldRotation=rotation(),oldCenter=center.clone(),oldPosition=proxy.position.clone(),target=original;
  chosenCenter=point.toArray();chosenAxisPivot=null;chosenEdge=null;select(target);if(edgeAxis){baseRotation.copy(oldRotation);proxy.quaternion.copy(oldRotation).multiply(alignment);}else proxy.quaternion.copy(oldRotation);proxy.position.copy(oldPosition).add(center.clone().sub(oldCenter).applyQuaternion(oldRotation));
  const delta=proxy.position.clone().sub(center);fields.slice(0,3).forEach((f,i)=>f.value=Number(delta.getComponent(i).toFixed(5)));fields.slice(3).forEach((f,i)=>f.value=degrees()[i]);proxy.updateMatrixWorld(true);pickingCenter=false;centerMarkers.replaceChildren();control.enabled=true;mode('rotate');error.textContent='';hint.textContent=edgeAxis?'ヒンジ軸を選択済み · リング・角度・±90°で調整':'回転中心を選択済み · リング・角度・±90°で調整';panel.querySelector('small').textContent=edgeAxis?'選択した点から奥へ伸びるヒンジ軸で回転します。ホイールで拡大・縮小、Shift＋ホイールで視点を水平回転。':'選択した中心を通るX・Y・Z軸で回転します。';mark();
 }
 function showCenters(){
  if(!pickingCenter||!proxy)return;
  proxy.updateMatrixWorld(true);centerMarkers.replaceChildren();
  const rect=canvas.getBoundingClientRect(),parent=host.parentElement.getBoundingClientRect(),copy=proxy.children[0],candidates=[];
  const sources=[{children:[],matrixWorld:new THREE.Matrix4(),userData:{references:getReferencePoints()}},copy,...getMeshes().filter(m=>m!==original&&m.visible)];
  const refs=[];
  for(const mesh of sources){
   const circular=[...new Set(mesh.children[0]?.geometry?.userData.circularEdges?.values()||[])].map(c=>({point:c.center,name:'円・円弧',kind:'center'}));
   for(const ref of [...circular,...(mesh.userData.references||[])]){
    if(ref.kind==='midpoint')continue;
    const world=new THREE.Vector3(...ref.point).applyMatrix4(mesh.matrixWorld),projected=world.clone().project(camera);
    refs.push({mesh,ref,world,projected,priority:ref.name==='スケッチ点'?0:ref.name==='ヒンジ軸中心'&&ref.bodyId===original.userData.bodyId?1:ref.name==='ヒンジ軸中心'?2:3});
   }
  }
  // When several points on one hinge axis overlap on screen, use the cap facing the camera.
  refs.sort((a,b)=>a.priority-b.priority||a.projected.z-b.projected.z);
  for(const {mesh,ref,world,projected:p} of refs){
   if(p.z< -1||p.z>1)continue;
   const x=(p.x+1)*rect.width/2,y=(1-p.y)*rect.height/2;
   if(x<0||x>rect.width||y<0||y>rect.height||candidates.some(c=>Math.hypot(c.x-x,c.y-y)<12))continue;
   candidates.push({x,y});
   const button=document.createElement('button');button.type='button';
   button.className='move-center-point'+(ref.name==='スケッチ点'?' sketch-reference-point':ref.name==='ヒンジ軸中心'?' hinge-reference-point':'');
   button.textContent=ref.name==='スケッチ点'?'●':'⊙';button.dataset.point=JSON.stringify(world.toArray());button.dataset.owner=mesh.uuid||'';
   button.title=ref.name==='ヒンジ軸中心'?'ヒンジ軸中心を選択':ref.name+'の中心';button.setAttribute('aria-label',button.title);
   button.style.left=(rect.left-parent.left+x)+'px';button.style.top=(rect.top-parent.top+y)+'px';
   button.onpointerdown=e=>{e.preventDefault();e.stopPropagation();const point=world.clone().sub(proxy.position).applyQuaternion(rotation().invert()).add(center);changeCenter(point);};
   centerMarkers.append(button);
  }
 }
 centerButton.onclick=()=>{pointMove=null;if(!proxy||busy){error.textContent='先にボディを選択してください';return;}pickingAxis=false;pickButton.setAttribute('aria-pressed','false');pickingCenter=!pickingCenter;control.enabled=!pickingCenter;hint.textContent=pickingCenter?'円・円弧などの中心マーカー（⊙）をクリック':'ボディを選択済み';centerMarkers.replaceChildren();if(pickingCenter){showCenters();let last=camera.matrixWorld.elements.join(',');const refresh=()=>{if(!pickingCenter)return;const state=camera.matrixWorld.elements.join(',');if(state!==last){last=state;showCenters();}requestAnimationFrame(refresh);};requestAnimationFrame(refresh);}};
 resetCenter.onclick=()=>{if(proxy&&!busy)changeCenter(new THREE.Box3().setFromObject(original).getCenter(new THREE.Vector3()));};
 panel.querySelector('#move-cancel').onclick=()=>close();
 for(const [id,delta] of [['move-plus90',90],['move-minus90',-90]])panel.querySelector('#'+id).onclick=()=>{if(!proxy||busy)return;mode('rotate');const input=edgeAxis?edgeInput:fields[3+['X','Y','Z'].indexOf(axisSelect.value)];input.value=Number(input.value)+delta;input.dispatchEvent(new Event('input',{bubbles:true}));};
 panel.onsubmit=async e=>{e.preventDefault();if(!proxy||busy||!panel.reportValidity())return;const v=fields.map(f=>Number(f.value)),request=revision;busy=true;control.enabled=false;for(const el of panel.querySelectorAll('button,input,select'))el.disabled=true;error.textContent='形状を確定中…';try{await onApply({type:'move',target:original.userData.bodyId,x:v[0],y:v[1],z:v[2],rotation:degrees(),pivot:center.toArray()});if(request!==revision)return;busy=false;close();}catch(e){if(request!==revision)return;busy=false;error.textContent=e.message;control.enabled=active;}finally{if(request===revision){for(const el of panel.querySelectorAll('button,input,select'))el.disabled=false;axisSelect.disabled=!!edgeAxis;}}};
 window.addEventListener('keydown',e=>{if(active&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}},{capture:true});
 window.addEventListener('keydown',e=>{if(!active||e.key==='Escape')return;if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){if(busy){e.preventDefault();e.stopImmediatePropagation();}else close();}else if(!e.target.matches('input,select,textarea')&&['e','l'].includes(e.key.toLowerCase())){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
 document.addEventListener('click',e=>{if(active&&e.target.closest('.toolbar, .command-toolbar')&&!e.target.closest('#move-tool'))close();},{capture:true});
 window.addEventListener('resize',()=>{if(pickingCenter)showCenters();});
 return {start,place(mesh){if(active)close();start();chosenEdge=null;select(mesh);},cancel:close,get active(){return active;},get selectedBodyId(){return original?.userData.bodyId||null;}};
}
