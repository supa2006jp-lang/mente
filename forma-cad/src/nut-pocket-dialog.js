import * as THREE from 'three';
import {draggableDialog} from './draggable-dialog.js';
import {nutPocketSource,validateNutPocket} from './nut-pocket-settings.js';

const number=value=>Number(value.toFixed(3));

export function createNutPocketDialog({scene,meshes,canvas,camera,kernel,getFeatures,bodyName,fitTarget,apply,notify}){
 const dialog=document.createElement('dialog');
 dialog.id='nut-pocket-dialog';
 dialog.setAttribute('aria-labelledby','nut-pocket-title');
 dialog.innerHTML=`<div class="dialog-heading">
 <h2 id="nut-pocket-title">六角ナットの埋め込み穴</h2>
 <button type="button" id="nut-pocket-close" aria-label="閉じる">×</button>
 </div><form id="nut-pocket-form">
 <p id="nut-pocket-source"></p>
 <label>加工先ボディ<select id="nut-pocket-target"></select></label>
 <p id="nut-pocket-opening" role="status"></p>
 <button type="button" id="nut-pocket-repick" hidden>穴口を選び直す</button>
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
 let original,history,editing,nut,id,openings=[],opening=null,hovered=null;
 let revision=0,scan=0,timer=null,preview=null,hidden=null,cached=null,busy=false;

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
 function picking(){return dialog.open&&!busy&&!opening&&openings.length>0&&getFeatures()===original;}
 canvas.addEventListener('pointermove',event=>{if(picking())hover(event.buttons?null:rimAt(event));});
 canvas.addEventListener('pointerleave',()=>hover(null));
 function clearPreview(){
  if(hidden){hidden.mesh.visible=hidden.visible;hidden=null;}
  if(preview){
   preview.removeFromParent();preview.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});preview=null;
  }
 }
 function invalidate(){
  revision++;clearTimeout(timer);cached=null;clearPreview();hover(null);
 }
 function controls(){
  $('target').disabled=busy;
  $('clearance').disabled=busy;
  $('repick').hidden=!opening;$('repick').disabled=busy;
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
  if(!opening)return;
  const status=$('status'),token=revision;
  let spec;
  try{spec=validateNutPocket({type:'nutPocket',id,sourceBody:nut.bodyId,target:$('target').value,opening,clearance:$('clearance').valueAsNumber});}
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
 async function loadOpenings(saved=null){
  const token=++scan,target=$('target').value,status=$('status');
  opening=null;openings=[];invalidate();controls();
  $('opening').textContent='';
  if(!target){status.textContent='加工先ボディを選択してください。';return;}
  if(!saved)fitTarget(target);
  status.textContent='加工先の円穴を探しています…';
  try{
   const result=await kernel.run(history,{type:'nutPocketOpenings',target},{foreground:true,document:original});
   if(token!==scan||!dialog.open)return;
   if(getFeatures()!==original)throw Error('モデルが変更されました。埋め込み穴を開き直してください');
   openings=result.openings;
   if(saved){choose(saved);return;}
   status.textContent=openings.length?'埋め込みたい側から、3D画面で円穴の内側か縁をクリックしてください。':'加工先に平面から開いた円穴が見つかりません。';
  }catch(error){if(token===scan&&dialog.open)status.textContent=error.message;}
 }
 function choose(rim){
  opening=rim;$('opening').textContent='選択した円穴 Ø'+number(rim.radius*2)+' mm';
  schedule();
 }
 function clear(){
  scan++;invalidate();openings=[];opening=null;busy=false;
  // This worker is dedicated to this dialog, including its history replay.
  kernel.reset();original=null;history=null;editing=null;nut=null;
 }
 function close(){if(dialog.open){dialog.close();clear();}}
 $('close').onclick=$('cancel').onclick=close;
 dialog.addEventListener('close',()=>{if(!dialog.open&&original)clear();});
 $('target').onchange=()=>loadOpenings();
 $('clearance').oninput=schedule;
 $('repick').onclick=()=>{
  opening=null;invalidate();controls();$('opening').textContent='';
  $('status').textContent='埋め込みたい側から、3D画面で円穴の内側か縁をクリックしてください。';
 };
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
   const rim=rimAt(event);
   if(rim)choose(rim);
   else $('status').textContent='加工先ボディの、手前から見える円穴の内側か縁をクリックしてください。';
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
   if(!targets.length){notify('円穴のある加工先ボディを表示してください');return;}
   original=before;history=prefix;editing=feature;nut=selected;id=feature?.id??crypto.randomUUID();
   $('target').replaceChildren(...(targets.length>1?[new Option('加工先を選択','')]:[]),...targets.map(body=>new Option(bodyName(body),body)));
   $('target').value=saved?.target??(targets.length===1?targets[0]:'');
   $('clearance').value=saved?.clearance??.2;
   $('source').textContent=bodyName(source)+' ／ 対辺 '+number(nut.across)+' mm ／ 高さ '+number(nut.depth)+' mm';
   $('apply').textContent=editing?'変更を適用':'加工する';
   setSize();controls();dialog.show();void loadOpenings(saved?.opening);
  },
 };
}
