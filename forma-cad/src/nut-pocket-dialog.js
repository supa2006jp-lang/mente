import * as THREE from 'three';
import {draggableDialog} from './draggable-dialog.js';
import {scopedFaceGrid} from './face-grid.js';
import {holePointSnapPixels,nearestFaceGridPoint,nearestHolePoint,sketchPointsOnFace} from './face-hole-points.js';
import {basisFor} from './frames.js';
import {newPocketNut,nutPocketSource,validateNutPocket} from './nut-pocket-settings.js';
import {pointInRing,regionContains} from './regions.js';
import {faceCenterCandidate} from './selection-candidates.js';

const number=value=>Number(value.toFixed(3)),gridLift=.02,pointLift=.025;

export function createNutPocketDialog({scene,meshes,canvas,camera,kernel,getFeatures,bodyName,fitTarget,pickFace,gridStep,showPoint,apply,openBolt,notify}){
 const dialog=document.createElement('dialog');
 dialog.id='nut-pocket-dialog';
 dialog.setAttribute('aria-labelledby','nut-pocket-title');
 dialog.innerHTML=`<div class="dialog-heading">
 <h2 id="nut-pocket-title">六角ナットの埋め込み穴</h2>
 <button type="button" id="nut-pocket-close" aria-label="閉じる">×</button>
 </div><form id="nut-pocket-form">
 <p id="nut-pocket-source"></p>
 <label>加工先ボディ<select id="nut-pocket-target"></select></label>
 <button type="button" id="nut-pocket-repick-face" hidden>加工面を選び直す</button>
 <label>配置方法<select id="nut-pocket-mode">
 <option value="rim">既存の円穴</option>
 <option value="center">面の中心</option>
 <option value="grid">グリッド交点・スケッチ点</option>
 </select></label>
 <p id="nut-pocket-opening" role="status"></p>
 <button type="button" id="nut-pocket-repick" hidden>位置を選び直す</button>
 <label id="nut-pocket-bore-field" hidden>ねじ用の貫通穴径 (mm)<input type="number" id="nut-pocket-bore-diameter" min="0.1" max="10000" step="any" required></label>
 <label>片側のすき間 (mm)<input type="number" id="nut-pocket-clearance" min="0" step="any" required></label>
 <p id="nut-pocket-size"></p>
 <p id="nut-pocket-status" role="status"></p>
 <p id="nut-pocket-bolt-info" hidden></p>
 <button type="button" id="nut-pocket-bolt" class="accent" hidden>加工してボルト作成へ</button>
 <div class="editor-actions">
 <button type="button" id="nut-pocket-cancel">キャンセル</button>
 <button type="submit" id="nut-pocket-apply" class="accent" disabled>加工する</button>
 </div></form>`;
 document.body.append(dialog);
 draggableDialog(dialog);
 const $=name=>dialog.querySelector('#nut-pocket-'+name);
 const raycaster=new THREE.Raycaster();
 const rimLine=new THREE.LineLoop(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x0085a3,depthTest:false}));
 rimLine.visible=false;rimLine.renderOrder=32;scene.add(rimLine);
 let original,history,editing,nut,inlineNut,id,openings=null,activeFace=null,selection=null,hovered=null,manualMode=false,gridOverlay=null;
 let revision=0,scan=0,timer=null,preview=null,hidden=null,cached=null,busy=false;
 const mode=()=>$('mode').value,isRim=()=>mode()==='rim';

 function hover(rim){
  if(rim===hovered)return;
  hovered=rim;rimLine.visible=!!rim;
  if(!rim)return;
  const center=new THREE.Vector3(...rim.center),normal=new THREE.Vector3(...rim.normal);
  const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
  const points=Array.from({length:80},(_,i)=>{
   const angle=i*Math.PI/40;
   return new THREE.Vector3(rim.radius*Math.cos(angle),rim.radius*Math.sin(angle),0).applyQuaternion(rotation).add(center);
  });
  rimLine.geometry.dispose();
  rimLine.geometry=new THREE.BufferGeometry().setFromPoints(points);
 }
 function rimAt(event){
  const rect=canvas.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);
  const ray=raycaster.ray,visible=[...meshes.values()].filter(mesh=>mesh.visible);
  const first=raycaster.intersectObjects(visible,false)[0]?.distance??Infinity;
  const margin=(camera.top-camera.bottom)/(camera.zoom*rect.height)*6;
  let nearest=null,distance=first+.001;
  for(const rim of activeFace.rims??[]){
   const center=new THREE.Vector3(...rim.center),normal=new THREE.Vector3(...rim.normal),facing=ray.direction.dot(normal);
   if(facing>=-1e-5)continue;
   const depth=center.clone().sub(ray.origin).dot(normal)/facing;
   if(depth<0||depth>distance)continue;
   if(ray.at(depth,new THREE.Vector3()).distanceTo(center)>rim.radius+Math.min(margin,rim.radius*.5))continue;
   nearest=rim;distance=depth;
  }
  return nearest;
 }
 function clearFaceGrid(){
  if(!gridOverlay)return;
  const {grid}=gridOverlay;
  grid.removeFromParent();
  grid.traverse(item=>{item.geometry.dispose();if(item.material!==grid.material)item.material.dispose();});
  grid.material.dispose();
  gridOverlay=null;
 }
 function clearHover(){hover(null);showPoint(null);}
 function displayGrid(face,basis){
  const spacing=gridStep();
  if(gridOverlay?.face!==face||gridOverlay.spacing!==spacing){
   clearFaceGrid();
   const {grid,step}=scopedFaceGrid(face,'face',spacing),{u,v,n}=basis;
   const outline=new THREE.BufferGeometry().setFromPoints(face.outer.map(([x,y])=>new THREE.Vector3(x,0,y)));
   grid.add(new THREE.LineLoop(outline,grid.material));
   if(activeFace?.face===face&&activeFace.points.length){
    const marks=activeFace.points.map(point=>new THREE.Vector3(point.dot(u),gridLift-pointLift,point.dot(v)));
    const geometry=new THREE.BufferGeometry().setFromPoints(marks);
    grid.add(new THREE.Points(geometry,new THREE.PointsMaterial({color:0x008eb1,size:8,sizeAttenuation:false,depthWrite:false})));
   }
   grid.applyMatrix4(new THREE.Matrix4().makeBasis(u,n.clone().negate(),v));
   grid.position.copy(n).multiplyScalar(face.offset+gridLift);
   grid.material.color.set(0x9359ba);grid.material.transparent=true;grid.material.opacity=.85;grid.material.depthWrite=false;
   grid.renderOrder=3;scene.add(grid);gridOverlay={face,spacing,step,grid};
  }
  return gridOverlay.step;
 }
 function hitFace(event){
  const candidate=pickFace(event,$('target').value);
  if(!candidate)throw Error('加工先ボディの平面をクリックしてください。');
  return candidate;
 }
 function faceRims({face,basis:{u,v,n}}){
  if(openings===null)return null;
  return openings.filter(rim=>{
   const center=new THREE.Vector3(...rim.center);
   if(n.dot(new THREE.Vector3(...rim.normal))<.999999||Math.abs(center.dot(n)-face.offset)>1e-4)return false;
   const uv=[center.dot(u),center.dot(v)],tolerance=Math.max(.002,rim.radius*.005);
   return face.holes.some(ring=>pointInRing(uv,ring)&&ring.every(point=>Math.abs(Math.hypot(point[0]-uv[0],point[1]-uv[1])-rim.radius)<=tolerance));
  });
 }
 function updatePlacementMode(){
  if(activeFace)activeFace.rims=faceRims(activeFace);
  if(manualMode||selection||openings===null)return;
  $('mode').value=(activeFace?.rims??openings).length?'rim':'grid';
 }
 function refreshGrid(){
  if(dialog.open&&activeFace&&!selection)displayGrid(activeFace.face,activeFace.basis);
 }
 function obscured(point,visible){
  const first=raycaster.intersectObjects(visible,false)[0];
  return first&&first.distance<raycaster.ray.origin.distanceTo(point)-.001;
 }

 function positionAt(event){
  const {face,basis,center,points}=activeFace,{u,v,n}=basis;
  const requestedMode=mode(),lift=requestedMode==='grid'?gridLift:0;
  const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
  raycaster.setFromCamera(new THREE.Vector2(x/rect.width*2-1,1-y/rect.height*2),camera);
  // The guides are raised slightly to avoid z-fighting. Pick in that same
  // displayed plane and keep the resulting machining point on the solid face.
  const ray=raycaster.ray,hit=ray.intersectPlane(new THREE.Plane(n,-face.offset-lift),new THREE.Vector3());
  const visible=[...meshes.values()].filter(mesh=>mesh.visible);
  if(!hit||ray.direction.dot(n)>=-1e-5||obscured(hit,visible))throw Error('紫のグリッドが表示された面で位置を選んでください。');
  const inside=regionContains(face,[hit.dot(u),hit.dot(v)]);
  const screenDistance=(point,height)=>{
   const p=point.clone().addScaledVector(n,height).project(camera);
   return Math.hypot((p.x+1)*rect.width/2-x,(1-p.y)*rect.height/2-y);
  };
  let point=null,snap=requestedMode;
  if(snap==='center'){
   if(inside&&center&&regionContains(face,[center.dot(u),center.dot(v)]))point=center;
  }else{
   point=nearestHolePoint(points,candidate=>screenDistance(candidate,pointLift));
   if(point)snap='point';
   else point=nearestFaceGridPoint(face,basis,hit,displayGrid(face,basis),candidate=>screenDistance(candidate,gridLift),inside?Infinity:holePointSnapPixels);
  }
  if(point){
   const screen=point.clone().project(camera);
   raycaster.setFromCamera(new THREE.Vector2(screen.x,screen.y),camera);
   if(screen.z>=-1&&screen.z<=1&&!obscured(point,visible)){
    showPoint(point.clone().addScaledVector(n,snap==='point'?pointLift:lift),basis,snap);
    return {point:point.toArray(),normal:n.toArray(),snap};
   }
  }
  showPoint(null);
  throw Error(snap==='center'?'選んだ面の中心を指定できません。グリッド交点かスケッチ点を選んでください。':
   '選んだ面の内側にあるグリッド交点かスケッチ点をクリックしてください。');
 }
 function picking(){
  return dialog.open&&!busy&&!selection&&!!$('target').value&&getFeatures()===original;
 }
 canvas.addEventListener('pointermove',event=>{
  if(!picking())return;
  if(event.buttons){clearHover();if(!activeFace)clearFaceGrid();return;}
  if(!activeFace){
   try{const {face}=hitFace(event);displayGrid(face,basisFor(face));}
   catch{clearFaceGrid();}
  }else if(isRim()){
   if(activeFace.rims?.length)hover(rimAt(event));
  }else{
   try{positionAt(event);}catch{clearHover();}
  }
 });
 canvas.addEventListener('pointerleave',()=>{
  if(!picking())return;
  clearHover();if(!activeFace)clearFaceGrid();
 });
 function clearPreview(){
  if(hidden){hidden.mesh.visible=hidden.visible;hidden=null;}
  if(preview){
   preview.removeFromParent();preview.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});preview=null;
  }
 }
 function invalidate(){
  revision++;clearTimeout(timer);cached=null;clearPreview();clearHover();clearFaceGrid();
 }
 function controls(){
  $('target').disabled=busy;
  $('mode').disabled=busy;
  $('clearance').disabled=busy;
  $('bore-field').hidden=isRim();$('bore-diameter').disabled=busy||isRim();
  $('repick-face').hidden=!activeFace&&!selection;$('repick-face').disabled=busy;
  $('repick').hidden=!selection||!activeFace;$('repick').disabled=busy;
  $('apply').disabled=busy||!cached;
  const bolt=cached?.result.analysis.bolt;
  $('bolt').hidden=!bolt;$('bolt').disabled=busy;
  $('bolt-info').hidden=!cached;
  if(cached)$('bolt-info').textContent=bolt?'ボルトの首下 '+number(bolt.length)+' mm（座面からナットまで '+number(bolt.grip)+' mm ＋ ナット厚 '+number(bolt.nutHeight)+' mm）':
   'ボルトの寸法を合わせるには、ねじ径が通り、反対側に座面がある貫通穴が必要です。';
 }
 function setSize(){
  const clearance=$('clearance').valueAsNumber;
  $('size').textContent=Number.isFinite(clearance)&&clearance>=0?
   '仕上がりの対辺 '+number(nut.across+2*clearance)+' mm ／ 深さ '+number(nut.depth)+' mm':'';
 }
 function showPreview(output,target){
  const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(output.vertices,3)).setIndex(output.triangles);
  if(output.normals?.length===output.vertices.length)geometry.setAttribute('normal',new THREE.Float32BufferAttribute(output.normals,3));
  else geometry.computeVertexNormals();
  preview=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x68bbad,roughness:.7}));
  preview.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry,30),new THREE.LineBasicMaterial({color:0x245c55})));
  const mesh=meshes.get(target);
  if(mesh){hidden={mesh,visible:mesh.visible};mesh.visible=false;}
  scene.add(preview);
 }
 function schedule(){
  if(!dialog.open||busy)return;
  invalidate();controls();setSize();
  if(!selection){refreshGrid();return;}
  const status=$('status'),token=revision;
  let spec;
  const placement=isRim()?{opening:selection}:{placement:selection,boreDiameter:$('bore-diameter').valueAsNumber};
  try{
   spec=validateNutPocket({type:'nutPocket',id,sourceBody:nut.bodyId,target:$('target').value,...placement,clearance:$('clearance').valueAsNumber,
    ...(inlineNut?{nut:inlineNut}:{})});
  }
  catch(error){status.textContent=error.message;return;}
  status.textContent='六角ポケットの加工形状を確認しています…';
  timer=setTimeout(async()=>{
   try{
    const result=await kernel.run(history,inlineNut?{...spec,type:'nutPocketPreview'}:spec,{foreground:true,document:original});
    if(token!==revision||!dialog.open)return;
    if(getFeatures()!==original)throw Error('モデルが変更されました。加工する穴を選び直してください');
    showPreview(result.outputs[0],spec.target);
    cached={spec,result};status.textContent='緑色で加工後の本体を表示しています。';controls();
   }catch(error){if(token===revision&&dialog.open)status.textContent=error.message;}
  },160);
 }
 function instruction(){
  if(!$('target').value)return '加工先ボディを選択してください。';
  if(!activeFace)return '最初に、埋め込みたい側の平面をクリックしてください。';
  if(mode()==='center')return '紫のグリッドが表示された面をもう一度クリックして、中心を確定してください。';
  if(mode()==='grid')return '選んだ面で、紫のグリッド交点か青いスケッチ点をクリックしてください。';
  if(activeFace.rims===null)return '選んだ面の円穴を探しています…';
  return activeFace.rims.length?'選んだ面の円穴の内側か縁をクリックしてください。':'選んだ面に円穴がありません。「面の中心」か「グリッド交点・スケッチ点」を選べます。';
 }
 function resetSelection(){
  selection=null;invalidate();controls();setSize();
  $('opening').textContent='';$('status').textContent=instruction();refreshGrid();
 }
 async function loadTarget(saved=null){
  const token=++scan,target=$('target').value,status=$('status');
  if(!saved&&!manualMode)$('mode').value='rim';
  openings=null;activeFace=null;resetSelection();
  if(!target)return;
  if(!saved)fitTarget(target);
  if(saved)choose(saved.placement??saved.opening);
  try{
   const result=await kernel.run(history,{type:'nutPocketOpenings',target},{foreground:true,document:original});
   if(token!==scan||!dialog.open)return;
   if(getFeatures()!==original)throw Error('モデルが変更されました。埋め込み穴を開き直してください');
   openings=result.openings;
   updatePlacementMode();
   if(!selection){controls();status.textContent=instruction();}
  }catch(error){if(token===scan&&dialog.open&&isRim()&&!selection)status.textContent=error.message;}
 }
 function choose(candidate){
  selection=candidate;
  $('opening').textContent=isRim()?'選択した円穴 Ø'+number(candidate.radius*2)+' mm':
   {center:'面の中心',grid:'グリッドの交点',point:'スケッチ点'}[candidate.snap]+'  '+candidate.point.map(number).join(' / ')+' mm';
  schedule();
 }
 function clear(){
  scan++;invalidate();openings=null;activeFace=null;selection=null;busy=false;
  // This worker is dedicated to this dialog, including its history replay.
  kernel.reset();original=null;history=null;editing=null;nut=null;inlineNut=null;
 }
 function close(){if(dialog.open){dialog.close();clear();}}
 $('close').onclick=$('cancel').onclick=close;
 dialog.addEventListener('close',()=>{if(!dialog.open&&original)clear();});
 $('target').onchange=()=>loadTarget();
 $('mode').onchange=()=>{manualMode=true;resetSelection();};
 $('clearance').oninput=$('bore-diameter').oninput=schedule;
 $('repick').onclick=resetSelection;
 $('repick-face').onclick=()=>{activeFace=null;resetSelection();};
 async function submit(withBolt=false){
  if(!cached||busy)return;
  const token=revision,{spec,result}=cached,wasEditing=!!editing;
  const bolt=result.analysis.bolt;
  if(withBolt&&!bolt)return;
  const current=()=>dialog.open&&token===revision&&getFeatures()===original;
  busy=true;controls();
  try{
   let confirmed=result;
   if(inlineNut){
    $('status').textContent='六角ナットと埋め込み穴を作成しています…';
    confirmed=await kernel.run(history,spec,{foreground:true,document:original});
    if(!current())return;
   }
   if(withBolt&&!confirmed.analysis.bolt)throw Error('確定する形状の貫通穴と座面から、ボルトの寸法を確認できませんでした。');
   await apply(spec,confirmed,editing,original,current,kernel);
   if(token!==revision||!dialog.open)return;
   close();notify(wasEditing?'六角ナットの埋め込み穴を更新しました':'六角ナットの埋め込み穴を作成しました');
   if(withBolt)openBolt(confirmed.analysis.bolt);
  }catch(error){if(token===revision&&dialog.open)$('status').textContent=error.message;}
  finally{if(token===revision&&dialog.open){busy=false;controls();}}
 }
 $('form').onsubmit=event=>{event.preventDefault();void submit();};
 $('bolt').onclick=()=>{if($('form').reportValidity())void submit(true);};
 return {
  get active(){return dialog.open;},
  close,
  refreshGrid,
  pick(event){
   if(!picking())return;
   try{
    if(!activeFace){
     const {face,hit}=hitFace(event);
     const basis=basisFor(face),features=getFeatures();
     activeFace={face,basis,center:faceCenterCandidate(hit,features)?.point,
      points:sketchPointsOnFace(features,face,basis)};
     updatePlacementMode();resetSelection();return;
    }
    if(isRim()){
     const rim=activeFace.rims?.length&&rimAt(event);
     if(rim)choose(rim);
     else $('status').textContent=instruction();
     return;
    }
    choose(positionAt(event));
   }catch(error){clearHover();$('status').textContent=error.message;}
  },
  open(source,feature=null){
   if(dialog.open)return;
   const before=getFeatures(),index=feature?before.indexOf(feature):before.length;
   if(index<0)return;
   const saved=feature?.spec,settings=saved?.nut??(typeof source==='object'?source:null);
   const prefix=before.slice(0,index),selected=settings?newPocketNut(settings):nutPocketSource(prefix,source);
   if(!selected){notify('ねじ作成で作った六角ナットを選択してください');return;}
   const targets=[...meshes].filter(([body,mesh])=>mesh.visible&&body!==selected.bodyId&&body!==selected.screwId).map(([body])=>body);
   if(saved&&!targets.includes(saved.target))targets.push(saved.target);
   if(!targets.length){notify('加工先ボディを表示してください');return;}
   original=before;history=prefix;editing=feature;nut=selected;inlineNut=settings;id=feature?.id??crypto.randomUUID();
   $('target').replaceChildren(...(targets.length>1?[new Option('加工先を選択','')]:[]),...targets.map(body=>new Option(bodyName(body),body)));
   $('target').value=saved?.target??(targets.length===1?targets[0]:'');
   const savedSnap=saved?.placement?.snap;
   $('mode').value=savedSnap==='point'?'grid':savedSnap??'rim';manualMode=!!saved;
   $('clearance').value=saved?.clearance??.2;
   $('bore-diameter').value=saved?.boreDiameter??number(nut.diameter+Math.min(.4,(nut.across-nut.diameter)/2));
   const name=inlineNut?'六角ナット M'+nut.diameter:bodyName(nut.bodyId);
   $('source').textContent=name+' ／ 対辺 '+number(nut.across)+' mm ／ 高さ '+number(nut.depth)+' mm';
   $('apply').textContent=editing?'変更を適用':'加工する';
   setSize();controls();dialog.show();void loadTarget(saved);
  },
 };
}
