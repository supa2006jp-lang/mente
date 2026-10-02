import {sectionSplitSpec} from './section-split.js';
import {draggablePanel} from './draggable-panel.js';
import * as THREE from 'three';
export function sectionSegments(geometry,plane){
 const p=geometry.attributes.position,ix=geometry.index,out=[];const count=ix?ix.count:p.count;
 for(let i=0;i<count;i+=3){const vs=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i+j):i+j)),ds=vs.map(v=>plane.distanceToPoint(v)),hits=[];
  for(let j=0;j<3;j++){const k=(j+1)%3;if(Math.abs(ds[j])<1e-7)hits.push(vs[j]);if(ds[j]*ds[k]<0)hits.push(vs[j].clone().lerp(vs[k],ds[j]/(ds[j]-ds[k])));}
  const unique=hits.filter((v,j)=>!hits.slice(0,j).some(w=>w.distanceToSquared(v)<1e-12));if(unique.length===2)out.push(...unique[0].toArray(),...unique[1].toArray());
 }return out;
}
export function sectionCap(segments,plane){
 const n=plane.normal,u=new THREE.Vector3(Math.abs(n.x)<.9?1:0,Math.abs(n.x)<.9?0:1,0);u.addScaledVector(n,-u.dot(n)).normalize();const v=n.clone().cross(u),nodes=new Map(),edges=new Set(),key=p=>p.map(x=>Math.round(x*1e5)).join(',');
 for(let i=0;i<segments.length;i+=6){const a=segments.slice(i,i+3),b=segments.slice(i+3,i+6),ka=key(a),kb=key(b),e=[ka,kb].sort().join('|');if(ka===kb||edges.has(e))continue;edges.add(e);for(const [k,p,q] of [[ka,a,kb],[kb,b,ka]]){if(!nodes.has(k))nodes.set(k,{p:new THREE.Vector2(new THREE.Vector3(...p).dot(u),new THREE.Vector3(...p).dot(v)),links:[]});nodes.get(k).links.push(q);}}
 const used=new Set(),loops=[];for(const [start,node] of nodes){if(used.has(start)||node.links.length!==2)continue;let current=start,previous=null,loop=[],valid=true;do{if(used.has(current)||nodes.get(current).links.length!==2){valid=false;break;}used.add(current);const item=nodes.get(current);loop.push(item.p);const next=item.links.find(k=>k!==previous);previous=current;current=next;}while(current!==start);if(valid&&loop.length>=3)loops.push(loop);}
 const inside=(p,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;};const depths=loops.map((l,i)=>loops.filter((other,j)=>i!==j&&inside(l[0],other)).length),vertices=[];
 for(let i=0;i<loops.length;i++){if(depths[i]%2)continue;const outer=loops[i],holes=loops.filter((l,j)=>depths[j]===depths[i]+1&&inside(l[0],outer)),points=[outer,...holes].flat();for(const triangle of THREE.ShapeUtils.triangulateShape(outer,holes))for(const index of triangle){const p=points[index],world=u.clone().multiplyScalar(p.x).addScaledVector(v,p.y).addScaledVector(n,-plane.constant);vertices.push(...world.toArray());}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;
}
export function sectionView({renderer,scene,meshes,raycaster,host,camera,getControls,getSelectedBody=()=>null,getBodyName=id=>id,canSplit=()=>true,onSplit,onClose=()=>{}}){
 renderer.localClippingEnabled=true;const plane=new THREE.Plane(),group=new THREE.Group();scene.add(group);let active=false,splitBusy=false,splitError='',editing=false;
 const panel=document.createElement('div');panel.id='section-panel';panel.hidden=true;panel.innerHTML='<label>平面<select id="section-plane"><option>XY</option><option>XZ</option><option>YZ</option></select></label><label>位置 (mm)<input id="section-offset" type="number" step="0.1" value="0"></label><label><input id="section-reverse" type="checkbox"> 反対側を表示</label><label>分離するボディ<select id="section-target"></select></label><label>残す側<select id="section-keep"><option value="both">両側を残す</option><option value="positive">＋側を残す</option><option value="negative">−側を残す</option></select></label><div id="section-color-legend"><span class="section-negative">● −側</span><span class="section-positive">● ＋側</span></div><button id="section-split" type="button">この位置で分離</button><p id="section-split-error" role="status" aria-live="polite"></p><small>残す側を選んで分離します。履歴から再編集でき、元に戻すにも対応。</small><button id="section-close" type="button">断面表示を終了</button>';host.parentElement.append(panel);draggablePanel(panel,'断面表示');
 const button=document.createElement('button');button.id='section-toggle';button.textContent='◩ 断面表示';button.setAttribute('aria-pressed','false');document.querySelector('.navigation').append(button);
 const input=id=>panel.querySelector('#'+id);
 function updateTargets(preferred){
  const target=input('section-target'),value=preferred||target.value,items=[...meshes].filter(([,mesh])=>mesh.visible).map(([id])=>[id,getBodyName(id)]);
  if(JSON.stringify(items)!==target.dataset.items){target.replaceChildren(...items.map(([id,name])=>new Option(name,id)));target.dataset.items=JSON.stringify(items);}
  if(items.some(([id])=>id===value))target.value=value;
 }
 function splitSpec(){const target=input('section-target').value;return sectionSplitSpec({target,plane:input('section-plane').value,offset:input('section-offset').value,keep:input('section-keep').value},meshes.get(target));}
 function updateSplitState(){
  input('section-target').disabled=splitBusy||editing;
  let hint='';try{splitSpec();if(!canSplit())hint='先に現在の編集や操作を終了してください。';}catch(error){hint=error.message;}
  const action=input('section-split'),label=splitBusy?'分離を計算中…':editing?'変更を適用':'この位置で分離';action.disabled=splitBusy||!!hint;if(action.textContent!==label)action.textContent=label;
  const message=splitBusy?'分離を計算中…':splitError||hint,status=input('section-split-error');if(status.textContent!==message)status.textContent=message;
 }
 function setBusy(value){splitBusy=value;for(const control of panel.querySelectorAll('input,select,button'))control.disabled=value;button.disabled=value;handle.disabled=value;updateSplitState();}
 input('section-split').onclick=async()=>{
  if(splitBusy||!active)return;
  try{const spec=splitSpec();if(!canSplit())throw Error('先に現在の編集や操作を終了してください。');splitError='';setBusy(true);await onSplit(spec);setActive(false,{applied:true});}
  catch(error){splitError=error.message;}
  finally{setBusy(false);}
 };

 const handle=document.createElement('button');handle.id='section-drag';handle.type='button';handle.textContent='↕';handle.title='ドラッグして断面を移動';handle.setAttribute('aria-label',handle.title);handle.hidden=true;host.parentElement.append(handle);
 const guide=new THREE.LineLoop(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x078db5,transparent:true,opacity:.65,depthTest:false}));guide.renderOrder=6;scene.add(guide);let anchor=new THREE.Vector3(),drag=null;
 function normal(){return new THREE.Vector3(...{XY:[0,0,1],XZ:[0,1,0],YZ:[1,0,0]}[input('section-plane').value]);}
 function update(){if(active)updateSplitState();handle.hidden=!active;guide.visible=active;if(!active)return;const r=renderer.domElement.getBoundingClientRect(),parent=host.parentElement.getBoundingClientRect(),p=anchor.clone().project(camera);handle.hidden=p.z< -1||p.z>1;handle.style.left=(r.left-parent.left+Math.max(25,Math.min(r.width-25,(p.x+1)*r.width/2)))+'px';handle.style.top=(r.top-parent.top+Math.max(25,Math.min(r.height-25,(1-p.y)*r.height/2)))+'px';}
 handle.onpointerdown=e=>{if(e.button!==0||splitBusy)return;e.preventDefault();e.stopPropagation();const r=renderer.domElement.getBoundingClientRect(),a=anchor.clone().project(camera),b=anchor.clone().add(normal()).project(camera);let dx=(b.x-a.x)*r.width/2,dy=-(b.y-a.y)*r.height/2;if(Math.hypot(dx,dy)<.2){dx=0;dy=-r.height*camera.zoom/(camera.top-camera.bottom);}drag={id:e.pointerId,x:e.clientX,y:e.clientY,offset:Number(input('section-offset').value),dx,dy,enabled:getControls().enabled};getControls().enabled=false;handle.setPointerCapture(e.pointerId);};
 handle.onpointermove=e=>{if(!drag||e.pointerId!==drag.id)return;e.preventDefault();const d=((e.clientX-drag.x)*drag.dx+(e.clientY-drag.y)*drag.dy)/(drag.dx*drag.dx+drag.dy*drag.dy);input('section-offset').value=Number((drag.offset+d).toFixed(2));refresh();};
 function endDrag(e){if(!drag||e.pointerId!==drag.id)return;const enabled=drag.enabled;drag=null;getControls().enabled=enabled;if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);}
 handle.onpointerup=endDrag;handle.onpointercancel=endDrag;handle.onlostpointercapture=endDrag;

 function refresh(){
  updateTargets();const axis={XY:'Z',XZ:'Y',YZ:'X'}[input('section-plane').value];
  input('section-keep').options[1].textContent='＋'+axis+'側を残す';input('section-keep').options[2].textContent='−'+axis+'側を残す';
  panel.querySelector('.section-negative').textContent='● −'+axis+'側';panel.querySelector('.section-positive').textContent='● ＋'+axis+'側';
  panel.querySelector('.panel-drag-handle').textContent=editing?'断面で分離を再編集':'断面表示';input('section-close').textContent=editing?'キャンセル':'断面表示を終了';
  for(const c of [...group.children]){c.geometry.dispose();c.material.dispose();group.remove(c);}
  const direction={XY:[0,0,1],XZ:[0,1,0],YZ:[1,0,0]}[input('section-plane').value],sign=input('section-reverse').checked?-1:1;plane.set(new THREE.Vector3(...direction).multiplyScalar(sign),-sign*Number(input('section-offset').value||0));
  for(const mesh of meshes.values()){mesh.traverse(o=>{if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.clippingPlanes=active?[plane]:null;if(o.isMesh)m.side=active?THREE.DoubleSide:THREE.FrontSide;m.needsUpdate=true;}}});if(active&&mesh.visible){const segments=sectionSegments(mesh.geometry,plane);if(segments.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(segments,3));const lines=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0xe98322,depthTest:true}));lines.renderOrder=4;group.add(lines);const cap=sectionCap(segments,plane);if(cap.attributes.position.count){const fill=new THREE.Mesh(cap,new THREE.MeshBasicMaterial({color:0xeab777,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}));group.add(fill);}else cap.dispose();}}}
  const box=new THREE.Box3();for(const mesh of meshes.values())if(mesh.visible)box.expandByObject(mesh);if(box.isEmpty())box.set(new THREE.Vector3(-20,-20,-20),new THREE.Vector3(20,20,20));
  const n=normal(),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());center.addScaledVector(n,Number(input('section-offset').value||0)-center.dot(n));const u=new THREE.Vector3(n.x?0:1,n.x?1:0,0),v=n.clone().cross(u),a=Math.max(10,Math.abs(size.dot(u))/2+5),b=Math.max(10,Math.abs(size.dot(v))/2+5);anchor.copy(center).addScaledVector(u,a);guide.geometry.dispose();guide.geometry=new THREE.BufferGeometry().setFromPoints([[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>center.clone().addScaledVector(u,x*a).addScaledVector(v,y*b)));update();
  host.dataset.sectionActive=String(active);host.dataset.sectionSegments=String(group.children.reduce((n,c)=>n+(c.isLineSegments?c.geometry.attributes.position.count/2:0),0));
 }
 function setActive(value,{applied=false}={}){const wasEditing=editing;active=value;if(!active)editing=false;panel.hidden=!active;button.setAttribute('aria-pressed',String(active));refresh();if(!active&&wasEditing)onClose({applied});}
 button.onclick=()=>{if(splitBusy)return;if(!active){splitError='';input('section-keep').value='both';updateTargets(getSelectedBody());const box=new THREE.Box3();for(const m of meshes.values())if(m.visible)box.expandByObject(m);if(!box.isEmpty()){const axis={XY:'z',XZ:'y',YZ:'x'}[input('section-plane').value];input('section-offset').value=Number(box.getCenter(new THREE.Vector3())[axis].toFixed(2));}}setActive(!active);};input('section-close').onclick=()=>setActive(false);
 panel.addEventListener('input',event=>{splitError='';if(event.target.id==='section-keep'&&event.target.value!=='both')input('section-reverse').checked=event.target.value==='negative';refresh();});const intersect=raycaster.intersectObjects.bind(raycaster);raycaster.intersectObjects=(...args)=>intersect(...args).filter(hit=>!active||!hit.object.userData.bodyId||plane.distanceToPoint(hit.point)>=-1e-6);
 return {refresh,update,edit(spec){editing=true;splitError='';input('section-plane').value=spec.plane;input('section-offset').value=spec.offset;input('section-keep').value=spec.keep||'both';input('section-reverse').checked=spec.keep==='negative';updateTargets(spec.target);setActive(true);input('section-offset').focus();input('section-offset').select();},cancel(){if(drag)endDrag({pointerId:drag.id});if(active)setActive(false);}};
}
