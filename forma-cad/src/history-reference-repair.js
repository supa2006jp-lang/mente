import * as THREE from 'three';
import {subscribeKernelActivity,KernelClient} from './kernel-client.js';
import {rebuild} from './geometry.js';
import {bodyEdges} from './body-edges.js';
import {cadPosition,copyCadCoordinates} from './cad-coordinates.js';
import {cadFaceGroup,cadFaceGeometry} from './face-selection.js';
import {basisFor} from './frames.js';
import {nearbyRepairEdges,nearbyRepairFaces} from './history-reference-candidates.js';

export function installHistoryReferenceRepair({scene,host,canvas,camera,meshes,getFeatures,onStart,onApply,notify}){
 const kernel=new KernelClient(),ray=new THREE.Raycaster();
 const offer=document.createElement('button');
 offer.id='history-reference-repair-open';offer.type='button';offer.textContent='参照を選び直して変更を続ける';offer.hidden=true;
 document.body.append(offer);
 const dialog=document.createElement('dialog');dialog.id='history-reference-repair';
 dialog.style.cssText='position:fixed;margin:0;right:14px;top:18%;width:min(350px,90vw);max-height:65vh;overflow:auto;z-index:250;padding:16px;background:#f3faff;color:#183d50;border:1px solid #80a0b8;border-radius:10px';
 dialog.innerHTML='<strong data-repair="title"></strong><p>赤は切れた参照、緑は選び直した位置、青は引き継ぐ参照です。</p><div data-repair="slots"></div><div data-repair="candidates"></div><p data-repair="status" role="status"></p><button type="button" data-repair="preview">後続工程を再計算してプレビュー</button><button type="button" data-repair="apply" disabled>変更を適用</button><button type="button" data-repair="cancel">キャンセル</button>';
 document.body.append(dialog);
 const q=name=>dialog.querySelector('[data-repair="'+name+'"]');
 let pending=null,state=null,group=null,markers=null,pickables=[],hidden=[],slots=[],active=0,version=0,busy=false,proposedResult=null,down=null;
 let candidateHighlight=null;
 const valid=()=>state&&getFeatures()===state.original;
 function restore(){
  if(group){group.removeFromParent();group.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});group=null;}
  for(const [mesh,visible] of hidden)mesh.visible=visible;
  hidden=[];pickables=[];markers=null;candidateHighlight=null;
 }
 function display(features,selecting){
  restore();group=new THREE.Group();scene.add(group);
  const rendered=rebuild(features);
  try{
   for(const [id,body] of rendered){
    const material=new THREE.MeshStandardMaterial({color:0x65aaca,roughness:.65,transparent:true,opacity:selecting?.7:1,side:THREE.DoubleSide});
    const geometry=selecting?copyCadCoordinates(body.geometry,body.geometry.clone()):body.geometry.clone();
    const mesh=new THREE.Mesh(geometry,material);mesh.userData.bodyId=id;group.add(mesh);
    if(selecting&&slots.some(slot=>slot.bodyId===id)){
     if(state.spec.type==='shell'||state.spec.face){pickables.push(mesh);}
     else{
      const edges=new THREE.LineSegments(bodyEdges(mesh.geometry),new THREE.LineBasicMaterial({color:0x156da1}));
      edges.userData.bodyId=id;group.add(edges);pickables.push(edges);
     }
    }
   }
  }finally{rendered.forEach(body=>body.geometry.dispose());}
  for(const mesh of meshes.values()){hidden.push([mesh,mesh.visible]);mesh.visible=false;}
  if(selecting)showMarkers();
  renderCandidates();
 }
 const needsSelection=slot=>!slot.kept&&!slot.replacement;
 function controls(){
  q('preview').disabled=busy||!!pending||slots.some(needsSelection);
  q('apply').disabled=busy||!proposedResult;
  for(const button of q('slots').querySelectorAll('button'))button.disabled=busy||button.dataset.kept==='true';
  for(const button of q('candidates').querySelectorAll('button'))button.disabled=busy;
 }
 function slotList(){
  q('slots').replaceChildren(...slots.map((slot,i)=>{
   const button=document.createElement('button');button.type='button';
   button.textContent=(i+1)+' '+(slot.kind==='edge'?'辺':'面')+(slot.kept?' を引き継ぎ':slot.replacement?' ✓':' を選択');
   button.dataset.kept=String(!!slot.kept);
   button.setAttribute('aria-pressed',String(i===active));
   button.onclick=()=>{active=i;proposedResult=null;display(state.prefix,true);slotList();};return button;
  }));
  controls();
 }
 function showCandidate(row){
  if(candidateHighlight){candidateHighlight.removeFromParent();candidateHighlight.geometry.dispose();candidateHighlight.material.dispose();candidateHighlight=null;}
  if(!row||busy||!group)return;
  const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(row.points,3));
  const material={color:0xffa620,depthTest:false,depthWrite:false};
  candidateHighlight=slots[active].kind==='edge'
   ?new THREE.LineSegments(geometry,new THREE.LineBasicMaterial(material))
   :new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({...material,transparent:true,opacity:.6,side:THREE.DoubleSide}));
  candidateHighlight.renderOrder=61;group.add(candidateHighlight);
 }
 function renderCandidates(){
  showCandidate(null);const target=q('candidates'),slot=slots[active];
  target.replaceChildren();
  if(!slot||slot.kept||proposedResult)return;
  const object=pickables.find(object=>object.userData.bodyId===slot.bodyId);
  if(!object)return;
  const ref=slot.original,normal=state.spec.face?basisFor(ref).n:undefined;
  const rows=slot.kind==='edge'?nearbyRepairEdges(object.geometry,ref,slot.highlight):
   nearbyRepairFaces(object.geometry,ref,{normal,planarOnly:!!state.spec.face});
  if(!rows.length)return;
  const title=document.createElement('div');title.textContent='選び直し候補';target.append(title);
  for(const [i,row] of rows.entries()){
   const button=document.createElement('button');button.type='button';button.dataset.repairCandidate=String(i);
   button.textContent=(slot.kind==='edge'?'辺':'面')+' '+(i+1)+'（約 '+Number(row.distance.toFixed(2))+' mm）';
   button.onpointerenter=button.onfocus=()=>showCandidate(row);
   button.onpointerleave=button.onblur=()=>showCandidate(null);
   button.onclick=()=>{if(valid()&&!busy)replaceReference(row.point,row.normal);};
   target.append(button);
  }
  controls();
 }
 function originalGeometry(){
  const old=rebuild(state.replay.before.slice(0,state.index));
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),closest=new THREE.Vector3();
  try{
   for(const slot of slots){
    const mesh=old.get(slot.bodyId),ref=slot.original;
    if(!mesh||!ref||slot.kept)continue;
    if(ref.a&&ref.b){slot.highlight=[...ref.a,...ref.b];continue;}
    const position=cadPosition(mesh.geometry),index=mesh.geometry.index;
    if(slot.kind==='face'){
     const normal=ref.normal?new THREE.Vector3(...ref.normal):Number.isFinite(ref.offset)?basisFor(ref).n:null;
     const point=ref.point?new THREE.Vector3(...ref.point):null;
     if(!point&&!normal)continue;
     const triangle=new THREE.Triangle(a,b,c);
     let nearest=Infinity,selected=-1;
     for(let i=0;i<(index?.count??position.count);i+=3){
      [a,b,c].forEach((v,j)=>v.fromBufferAttribute(position,index?index.getX(i+j):i+j));
      if(normal&&triangle.getNormal(closest).dot(normal)<.85)continue;
      const distance=point?triangle.closestPointToPoint(point,closest).distanceToSquared(point):Math.abs(normal.dot(a)-ref.offset);
      if(distance<nearest){nearest=distance;selected=i/3;}
     }
     if(selected<0)continue;
     const face=cadFaceGroup(mesh.geometry,selected);
     if(face){
      const geometry=cadFaceGeometry(mesh.geometry,face);
      try{slot.highlight=Array.from(geometry.attributes.position.array);}finally{geometry.dispose();}
     }else{
      slot.highlight=[];
      for(let i=selected*3;i<selected*3+3;i++)slot.highlight.push(...a.fromBufferAttribute(position,index?index.getX(i):i).toArray());
     }
    }else if(ref.point){
     const geometry=bodyEdges(mesh.geometry),positions=cadPosition(geometry),point=new THREE.Vector3(...ref.point),segment=new THREE.Line3(a,b);
     try{
      let nearest=Infinity;
      for(let i=0;i<positions.count;i+=2){
       a.fromBufferAttribute(positions,i);b.fromBufferAttribute(positions,i+1);
       const distance=segment.closestPointToPoint(point,true,closest).distanceToSquared(point);
       if(distance<nearest){nearest=distance;slot.highlight=[...a.toArray(),...b.toArray()];}
      }
     }finally{geometry.dispose();}
    }
   }
  }finally{old.forEach(mesh=>mesh.geometry.dispose());}
 }
 function showMarkers(){
  if(markers){markers.removeFromParent();markers.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});}
  markers=new THREE.Group();group.add(markers);
  const geometry=points=>new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  for(const [i,slot] of slots.entries()){
   if(slot.highlight?.length){
    const shape=slot.kind==='edge'
     ?new THREE.LineSegments(geometry(slot.highlight),new THREE.LineBasicMaterial({color:0xe24b42,depthTest:false,transparent:true,opacity:i===active?1:.5}))
     :new THREE.Mesh(geometry(slot.highlight),new THREE.MeshBasicMaterial({color:0xe24b42,side:THREE.DoubleSide,depthTest:false,depthWrite:false,transparent:true,opacity:i===active?.4:.18}));
    shape.renderOrder=59;markers.add(shape);
   }
   const points=slot.kept?slot.kept.map(ref=>[ref.point,0x1765aa]):[[slot.original?.point,0xe24b42],[slot.replacement?.point,0x12a670]];
   for(const [point,color] of points)if(point){
    const marker=new THREE.Points(geometry(point),new THREE.PointsMaterial({color,size:8,sizeAttenuation:false,depthTest:false,depthWrite:false}));
    marker.renderOrder=60;markers.add(marker);
   }
  }
 }
 function close(){
  version++;if(busy)kernel.reset();busy=false;restore();state=null;slots=[];proposedResult=null;
  pending=null;offer.hidden=true;down=null;
  if(dialog.open)dialog.close();
 }
 dialog.addEventListener('close',()=>{if(!dialog.open&&state)close();});
 q('cancel').onclick=close;
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 offer.onclick=()=>{
  const record=pending;
  if(!record||getFeatures()!==record.original){offer.hidden=true;return;}
  if(state)close();
  onStart();state=record;pending=null;offer.hidden=true;proposedResult=null;
  const spec=state.spec,faceMode=spec.type==='shell'||!!spec.face;
  const references=spec.type==='shell'?spec.faces:spec.face?[spec.face]:spec.edges?.length?spec.edges:[{bodyId:spec.target,point:spec.edgePoint}];
  slots=references.map((reference,i)=>({kind:faceMode?'face':'edge',bodyId:reference.bodyId||spec.target,original:reference,kept:state.retained?.[i],replacement:null}));
  active=slots.findIndex(needsSelection);q('title').textContent=(state.index+1)+'工程目 '+(state.features[state.index].name||spec.type);
  q('status').textContent='引き継ぎ '+slots.filter(slot=>slot.kept).length+' 件 ／ 選び直し '+slots.filter(needsSelection).length+' 件';
  try{try{originalGeometry();}catch{}display(state.prefix,true);slotList();dialog.show();}
  catch(error){close();notify(error.message);}
 };
 function pick(event){
  if(!state||busy||!valid()||!slots[active])return;
  const bounds=canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2((event.clientX-bounds.left)/bounds.width*2-1,1-(event.clientY-bounds.top)/bounds.height*2),camera);
  ray.params.Line.threshold=100/Math.max(camera.zoom,1)/bounds.height*8;
  const hit=ray.intersectObjects(pickables.filter(object=>object.userData.bodyId===slots[active].bodyId),false)[0];
  if(!hit){q('status').textContent='選択項目のボディの'+(slots[active].kind==='edge'?'辺':'面')+'をクリックしてください';return;}
  let point,normal;
  const positions=cadPosition(hit.object.geometry);
  if(slots[active].kind==='edge'){
   point=new THREE.Vector3().fromBufferAttribute(positions,hit.index).lerp(new THREE.Vector3().fromBufferAttribute(positions,hit.index+1),.5);
  }else{
   const face=cadFaceGroup(hit.object.geometry,hit.faceIndex),planar=hit.object.geometry.userData.planarFaces;
   if(state.spec.face&&(face?.cylinder||Array.isArray(planar)&&face&&!planar.includes(face.faceId))){
    q('status').textContent='基準にする平面を選択してください。';return;
   }
   point=new THREE.Vector3();
   for(const index of [hit.face.a,hit.face.b,hit.face.c])point.add(new THREE.Vector3().fromBufferAttribute(positions,index));
   point.multiplyScalar(1/3);normal=hit.face.normal.clone();
  }
  replaceReference(point.toArray(),normal?.toArray());
 }
 function replaceReference(point,normal){
  slots[active].replacement={bodyId:slots[active].bodyId,point,...(normal?{normal}: {})};
  proposedResult=null;const next=slots.findIndex(needsSelection);if(next>=0)active=next;
  q('status').textContent=next<0?'参照を選びました。再計算して結果を確認してください。':'次の参照を選んでください。';
  slotList();showMarkers();renderCandidates();
 }
 host.addEventListener('pointerdown',event=>{
  if(event.target!==canvas||!state||event.button!==0||event.shiftKey||event.ctrlKey||event.metaKey)return;
  down={x:event.clientX,y:event.clientY};event.preventDefault();event.stopImmediatePropagation();
 },true);
 host.addEventListener('pointerup',event=>{
  if(!state||event.button!==0||!down)return;
  const start=down;down=null;event.preventDefault();event.stopImmediatePropagation();
  if(Math.hypot(event.clientX-start.x,event.clientY-start.y)<=5)pick(event);
 },true);
 q('preview').onclick=async()=>{
  if(!valid()||busy||slots.some(needsSelection))return;
  const current=++version,spec=structuredClone(state.spec),selected=slots.flatMap(slot=>slot.kept||[slot.replacement]);
  if(spec.type==='shell')spec.faces=selected;
  else if(spec.face){
   const ref=selected[0],n=new THREE.Vector3(...ref.normal).normalize();
   const u=(Math.abs(n.z)<.9?new THREE.Vector3(0,0,1):new THREE.Vector3(1,0,0)).cross(n).normalize();
   const v=n.clone().cross(u);
   spec.face={plane:'CUSTOM',bodyId:ref.bodyId,frame:{u:u.toArray(),v:v.toArray(),n:n.toArray()},offset:n.dot(new THREE.Vector3(...ref.point))};
  }else{spec.edges=selected;delete spec.edgePoint;}
  const repairs=[...(state.repairs||[]).filter(entry=>entry.id!==state.features[state.index].id),{id:state.features[state.index].id,spec}];
  showCandidate(null);busy=true;proposedResult=null;controls();q('status').textContent='後続工程を再計算しています…';
  try{
   const result=await kernel.run(state.features,{...state.replay,repairs});
   if(current!==version||!valid())return;
   proposedResult=result.features;display(result.features,false);
   q('status').textContent='後続工程の再計算が完了しました。形を確認して適用してください。';
  }catch(error){
   if(current!==version||!valid())return;
   q('status').textContent=error.message;
   if(error.referenceRepair){
    pending={...state,index:error.featureIndex,...error.referenceRepair,repairs};
    offer.hidden=false;q('status').textContent+=' 次の工程の参照も選び直せます。';
    offer.textContent='次の工程の参照を選び直す';q('status').after(offer);
   }
  }finally{if(current===version){busy=false;controls();}}
 };
 q('apply').onclick=()=>{
  if(!valid()||busy||!proposedResult)return;
  try{onApply(proposedResult,state.original,state.replay.repairDimensions);close();notify('参照を選び直して後続工程を更新しました');}
  catch(error){q('status').textContent=error.message;}
 };
 subscribeKernelActivity(event=>{
  if(event.state==='queued'&&pending?.client===event.client&&event.id>pending.request){pending=null;offer.hidden=true;}
  if(event.state!=='error'||!event.error?.referenceRepair||state)return;
  const {prefix,spec,retained}=event.error.referenceRepair;
  const index=event.error.featureIndex,operation=event.spec.type==='preview'?event.spec.operation:event.spec;
  const direct=operation.type==='replay';
  const features=direct?event.features:[...prefix,{...event.features[index],spec},...event.features.slice(index+1)];
  const replay=direct?operation:{type:'replay',before:event.features,start:index};
  pending={original:getFeatures(),features,replay,index,prefix,spec,retained,
   repairs:operation.repairs||[],client:event.client,request:event.id};
  offer.textContent='参照を選び直して変更を続ける';
  const captured=pending;
  queueMicrotask(()=>{
   if(pending!==captured)return;
   const actions=document.querySelector('#cad-failure-panel:not([hidden]) #cad-failure-actions');
   const container=[...document.querySelectorAll('dialog[open]')].at(-1);
   offer.style.cssText='';
   if(actions)actions.prepend(offer);
   else if(container)(container.querySelector('.editor-actions')||container).append(offer);
   else{host.append(offer);offer.style.cssText='position:absolute;right:16px;bottom:70px;z-index:230';}
   offer.hidden=false;
  });
 });
 return {close,sync(){if(pending&&pending.original!==getFeatures()){pending=null;offer.hidden=true;}if(state&&!valid())close();}};
}
