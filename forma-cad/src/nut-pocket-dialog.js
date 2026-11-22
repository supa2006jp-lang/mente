import * as THREE from 'three';
import {draggableDialog} from './draggable-dialog.js';
import {scopedFaceGrid} from './face-grid.js';
import {basisFor,worldPoint} from './frames.js';
import {nutPocketSource,validateNutPocket} from './nut-pocket-settings.js';
import {regionContains} from './regions.js';
import {faceCenterCandidate} from './selection-candidates.js';

const number=value=>Number(value.toFixed(3));

export function createNutPocketDialog({scene,meshes,canvas,camera,kernel,getFeatures,bodyName,fitTarget,pickFace,gridStep,showPoint,apply,notify}){
 const dialog=document.createElement('dialog');
 dialog.id='nut-pocket-dialog';
 dialog.setAttribute('aria-labelledby','nut-pocket-title');
 dialog.innerHTML=`<div class="dialog-heading">
 <h2 id="nut-pocket-title">六角ナットの埋め込み穴</h2>
 <button type="button" id="nut-pocket-close" aria-label="閉じる">×</button>
 </div><form id="nut-pocket-form">
 <p id="nut-pocket-source"></p>
 <label>加工先ボディ<select id="nut-pocket-target"></select></label>
 <label>配置方法<select id="nut-pocket-mode">
 <option value="rim">既存の円穴</option>
 <option value="center">面の中心</option>
 <option value="grid">グリッドの交点</option>
 </select></label>
 <p id="nut-pocket-opening" role="status"></p>
 <button type="button" id="nut-pocket-repick" hidden>位置を選び直す</button>
 <label id="nut-pocket-bore-field" hidden>ねじ用の貫通穴径 (mm)<input type="number" id="nut-pocket-bore-diameter" min="0.1" max="10000" step="any" required></label>
 <label>片側のすき間 (mm)<input type="number" id="nut-pocket-clearance" min="0" step="any" required></label>
 <p id="nut-pocket-size"></p>
 <p id="nut-pocket-status" role="status"></p>
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
 let original,history,editing,nut,id,openings=null,selection=null,hovered=null,manualMode=false,gridOverlay=null;
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
  for(const rim of openings){
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
  gridOverlay.grid.removeFromParent();gridOverlay.grid.geometry.dispose();gridOverlay.grid.material.dispose();
  gridOverlay=null;
 }
 function clearSelectionFeedback(){
  hover(null);clearFaceGrid();showPoint(null);
 }
 function displayGrid(face,basis){
  const spacing=gridStep();
  if(gridOverlay?.face!==face||gridOverlay.spacing!==spacing){
   clearFaceGrid();
   const {grid,step}=scopedFaceGrid(face,'face',spacing),{u,v,n}=basis;
   grid.applyMatrix4(new THREE.Matrix4().makeBasis(u,n.clone().negate(),v));
   grid.position.copy(n).multiplyScalar(face.offset+.02);
   grid.material.color.set(0x9359ba);grid.material.transparent=true;grid.material.opacity=.7;grid.material.depthWrite=false;
   grid.renderOrder=3;scene.add(grid);gridOverlay={face,spacing,step,grid};
  }
  return gridOverlay.step;
 }
 function faceAt(event){
  const candidate=pickFace(event,$('target').value);
  if(!candidate)throw Error('加工先ボディの平面をクリックしてください。');
  const {face,hit}=candidate,basis=basisFor(face),{u,v,n}=basis;
  let point,error;
  if(mode()==='center'){
   point=faceCenterCandidate(hit,getFeatures())?.point;
   error='面の中心に加工できる平面がありません。グリッドの交点を選んでください。';
  }else{
   const step=displayGrid(face,basis);
   const uv=[u,v].map(axis=>Math.round(hit.point.dot(axis)/step)*step);
   point=worldPoint(face,uv);
   error='面の内側にあるグリッドの交点をクリックしてください。';
  }
  if(!point||!regionContains(face,[point.dot(u),point.dot(v)])){
   showPoint(null);
   return {error};
  }
  showPoint(point,basis,mode());
  return {placement:{point:point.toArray(),normal:n.toArray(),snap:mode()}};
 }
 function picking(){
  return dialog.open&&!busy&&!selection&&!!$('target').value&&(!isRim()||openings?.length>0)&&getFeatures()===original;
 }
 canvas.addEventListener('pointermove',event=>{
  if(!picking())return;
  if(event.buttons){clearSelectionFeedback();return;}
  if(isRim()){hover(rimAt(event));return;}
  try{faceAt(event);}catch{clearSelectionFeedback();}
 });
 canvas.addEventListener('pointerleave',()=>{if(picking())clearSelectionFeedback();});
 function clearPreview(){
  if(hidden){hidden.mesh.visible=hidden.visible;hidden=null;}
  if(preview){
   preview.removeFromParent();preview.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});preview=null;
  }
 }
 function invalidate(){
  revision++;clearTimeout(timer);cached=null;clearPreview();clearSelectionFeedback();
 }
 function controls(){
  $('target').disabled=busy;
  $('mode').disabled=busy;
  $('clearance').disabled=busy;
  $('bore-field').hidden=isRim();$('bore-diameter').disabled=busy||isRim();
  $('repick').hidden=!selection;$('repick').disabled=busy;
  $('apply').disabled=busy||!cached;
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
  if(!selection)return;
  const status=$('status'),token=revision;
  let spec;
  const placement=isRim()?{opening:selection}:{placement:selection,boreDiameter:$('bore-diameter').valueAsNumber};
  try{spec=validateNutPocket({type:'nutPocket',id,sourceBody:nut.bodyId,target:$('target').value,...placement,clearance:$('clearance').valueAsNumber});}
  catch(error){status.textContent=error.message;return;}
  status.textContent='六角ポケットの加工形状を確認しています…';
  timer=setTimeout(async()=>{
   try{
    const result=await kernel.run(history,spec,{foreground:true,document:original});
    if(token!==revision||!dialog.open)return;
    if(getFeatures()!==original)throw Error('モデルが変更されました。加工する穴を選び直してください');
    showPreview(result.outputs[0],spec.target);
    cached={spec,result};status.textContent='緑色で加工後の本体を表示しています。';controls();
   }catch(error){if(token===revision&&dialog.open)status.textContent=error.message;}
  },160);
 }
 function instruction(){
  if(!$('target').value)return '加工先ボディを選択してください。';
  if(mode()==='center')return '加工したい平面をクリックすると、面の中心に六角ポケットと貫通穴を作ります。';
  if(mode()==='grid')return '加工したい平面にマウスを合わせ、グリッドの交点をクリックしてください。';
  if(openings===null)return '加工先の円穴を探しています…';
  return openings.length?'埋め込みたい側から、3D画面で円穴の内側か縁をクリックしてください。':'円穴が見つかりません。配置方法で「面の中心」か「グリッドの交点」を選べます。';
 }
 function resetSelection(){
  selection=null;invalidate();controls();setSize();
  $('opening').textContent='';$('status').textContent=instruction();
 }
 async function loadTarget(saved=null){
  const token=++scan,target=$('target').value,status=$('status');
  if(!saved&&!manualMode)$('mode').value='rim';
  openings=null;resetSelection();
  if(!target)return;
  if(!saved)fitTarget(target);
  if(saved)choose(saved.placement??saved.opening);
  try{
   const result=await kernel.run(history,{type:'nutPocketOpenings',target},{foreground:true,document:original});
   if(token!==scan||!dialog.open)return;
   if(getFeatures()!==original)throw Error('モデルが変更されました。埋め込み穴を開き直してください');
   openings=result.openings;
   if(!manualMode&&!openings.length&&isRim()&&!selection)$('mode').value='center';
   if(!selection){controls();status.textContent=instruction();}
  }catch(error){if(token===scan&&dialog.open&&isRim()&&!selection)status.textContent=error.message;}
 }
 function choose(candidate){
  selection=candidate;
  $('opening').textContent=isRim()?'選択した円穴 Ø'+number(candidate.radius*2)+' mm':
   (candidate.snap==='center'?'面の中心':'グリッドの交点')+'  '+candidate.point.map(number).join(' / ')+' mm';
  schedule();
 }
 function clear(){
  scan++;invalidate();openings=null;selection=null;busy=false;
  // This worker is dedicated to this dialog, including its history replay.
  kernel.reset();original=null;history=null;editing=null;nut=null;
 }
 function close(){if(dialog.open){dialog.close();clear();}}
 $('close').onclick=$('cancel').onclick=close;
 dialog.addEventListener('close',()=>{if(!dialog.open&&original)clear();});
 $('target').onchange=()=>loadTarget();
 $('mode').onchange=()=>{manualMode=true;resetSelection();};
 $('clearance').oninput=$('bore-diameter').oninput=schedule;
 $('repick').onclick=resetSelection;
 $('form').onsubmit=async event=>{
  event.preventDefault();
  if(!cached||busy)return;
  const token=revision,{spec,result}=cached,wasEditing=!!editing;
  const current=()=>dialog.open&&token===revision&&getFeatures()===original;
  busy=true;controls();
  try{
   await apply(spec,result,editing,original,current,kernel);
   if(token!==revision||!dialog.open)return;
   close();notify(wasEditing?'六角ナットの埋め込み穴を更新しました':'六角ナットの埋め込み穴を作成しました');
  }catch(error){if(token===revision&&dialog.open)$('status').textContent=error.message;}
  finally{if(token===revision&&dialog.open){busy=false;controls();}}
 };
 return {
  get active(){return dialog.open;},
  close,
  pick(event){
   if(!picking())return;
   if(isRim()){
    const rim=rimAt(event);
    if(rim)choose(rim);
    else $('status').textContent='加工先ボディの、手前から見える円穴の内側か縁をクリックしてください。';
    return;
   }
   try{
    const candidate=faceAt(event);
    if(candidate.placement)choose(candidate.placement);
    else $('status').textContent=candidate.error;
   }catch(error){clearSelectionFeedback();$('status').textContent=error.message;}
  },
  open(source,feature=null){
   if(dialog.open)return;
   const before=getFeatures(),index=feature?before.indexOf(feature):before.length;
   if(index<0)return;
   const prefix=before.slice(0,index),selected=nutPocketSource(prefix,source);
   if(!selected){notify('ねじ作成で作った六角ナットを選択してください');return;}
   const targets=[...meshes].filter(([body,mesh])=>mesh.visible&&body!==source&&body!==selected.screwId).map(([body])=>body);
   const saved=feature?.spec;
   if(saved&&!targets.includes(saved.target))targets.push(saved.target);
   if(!targets.length){notify('加工先ボディを表示してください');return;}
   original=before;history=prefix;editing=feature;nut=selected;id=feature?.id??crypto.randomUUID();
   $('target').replaceChildren(...(targets.length>1?[new Option('加工先を選択','')]:[]),...targets.map(body=>new Option(bodyName(body),body)));
   $('target').value=saved?.target??(targets.length===1?targets[0]:'');
   $('mode').value=saved?.placement?.snap??'rim';manualMode=!!saved;
   $('clearance').value=saved?.clearance??.2;
   $('bore-diameter').value=saved?.boreDiameter??number(nut.diameter+Math.min(.4,(nut.across-nut.diameter)/2));
   $('source').textContent=bodyName(source)+' ／ 対辺 '+number(nut.across)+' mm ／ 高さ '+number(nut.depth)+' mm';
   $('apply').textContent=editing?'変更を適用':'加工する';
   setSize();controls();dialog.show();void loadTarget(saved);
  },
 };
}
