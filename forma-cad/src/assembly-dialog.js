import * as THREE from 'three';
import {assemblyLinks} from './assembly-state.js';
import {assemblyAnchors,assemblyFastMatrix} from './assembly-placement.js';
import {createAssemblyAdjustHandles} from './assembly-adjust-handles.js';
import {createAssemblyContactView} from './assembly-contact-view.js';

export function createAssemblyDialog({host,scene,camera,canvas,meshes,kernel,getFeatures,bodyName,onStart,apply,release,notify,getGridSnap=()=>({enabled:false,step:10})}){
 const dialog=document.createElement('dialog');dialog.id='assembly-dialog';
 dialog.style.cssText='position:fixed;inset:80px 12px auto auto;margin:0;width:360px;max-width:calc(100vw - 48px);max-height:calc(100vh - 130px);overflow:auto;padding:18px;z-index:120;background:#f5fbff;color:#193a50;border:1px solid #83a8b9;border-radius:12px;box-shadow:0 8px 28px #152c4940';
 dialog.innerHTML=`<form>
 <div style="display:flex;justify-content:space-between"><strong>部品の位置合わせ・固定</strong><button type="button" data-id="close" aria-label="閉じる">×</button></div>
 <p>動かす面 → 相手の面の順に選択。別ボディのまま固定します。</p>
 <label>合わせ方<select data-id="mode"><option value="plane">平面を合わせる</option><option value="axis">円筒の軸を合わせる</option></select></label>
 <label data-id="alignment-label">位置の基準<select data-id="alignment"><option value="center">面の中心を合わせる</option><option value="boundary">端・角をそろえる</option><option value="picked">クリック位置を合わせる</option></select><small data-id="alignment-help"></small></label>
 <div data-id="anchors" class="assembly-anchor-fields" hidden><label>動かす面の基準<select data-id="source-anchor"></select></label><label>相手の面の基準<select data-id="destination-anchor"></select></label></div>
 <p><button type="button" data-id="source">① 動かす面を選ぶ</button><span data-id="source-name"></span></p>
 <p><button type="button" data-id="destination">② 相手の面を選ぶ</button><span data-id="destination-name"></span></p>
 <label>間隔／軸方向のずらし (mm)<input data-id="offset" type="number" step="any" min="-10000" max="10000" value="0" required></label>
 <div data-id="adjustments"><div class="assembly-adjust-fields"><label>横移動 (mm)<input data-id="u" type="number" step="any" min="-10000" max="10000" value="0" required></label><label>縦移動 (mm)<input data-id="v" type="number" step="any" min="-10000" max="10000" value="0" required></label><label>面上の回転 (°)<input data-id="angle" type="number" step="any" min="-36000" max="36000" value="0" required></label></div><small data-id="handle-help">画面の横・縦・回転ハンドルで調整。緑色は吸着、Shiftで微調整。</small><button type="button" data-id="reset-adjustment">面上の調整を0に戻す</button></div>
 <label><input data-id="flip" type="checkbox">向きを反転</label>
 <p data-id="status" role="status"></p><p data-id="error" role="alert" style="color:#ba4420"></p><div data-id="contact-host"></div>
 <div class="editor-actions"><button type="button" data-id="cancel">キャンセル</button><button type="submit" data-id="apply" class="accent" disabled>位置を合わせて固定</button></div>
 <details open><summary>現在の固定</summary><div data-id="links"></div></details></form>`;
 document.body.append(dialog);const $=id=>dialog.querySelector('[data-id="'+id+'"]');
 const style=document.createElement('style');style.textContent='#assembly-dialog label{display:block;color:#193a50;margin:10px 0}#assembly-dialog input:not([type="checkbox"]),#assembly-dialog select{width:100%;box-sizing:border-box}#assembly-dialog button{background:#e2f0f7;color:#193a50;border:1px solid #8aaaba;border-radius:6px;padding:8px}#assembly-dialog button[aria-pressed="true"]{background:#c6f4ec;border-color:#078b77}#assembly-dialog button.accent{background:#078baa;color:white;border-color:#08778b}#assembly-dialog button:disabled{opacity:.5}#assembly-dialog input[type="checkbox"]{width:auto;display:inline;margin-right:7px}#assembly-dialog .editor-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}#assembly-dialog .assembly-adjust-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}#assembly-dialog .assembly-anchor-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#assembly-dialog [hidden]{display:none!important}#assembly-dialog small{display:block;font-size:12px;line-height:1.5}#assembly-dialog [data-id="contact"]{border:1px solid #b8cbd3;border-radius:6px;padding:10px;margin:8px 0}';dialog.append(style);
 for(const key of ['source-anchor','destination-anchor'])$(key).replaceChildren(...assemblyAnchors.map(([value,label])=>new Option(label,value)));
 let original=null,history=null,editing=null,id=null,picking='source',source=null,destination=null,busy=false,inflight=false,revision=0,timer=null,cached=null,preview=null,movingPreview=null,hidden=[],previewBase=null;
 const previewObjects=new Map(),ray=new THREE.Raycaster();
 const contact=createAssemblyContactView({container:$('contact-host'),scene,bodyName,getObject:bodyId=>previewObjects.get(bodyId)||meshes.get(bodyId)});
 const values=()=>({u:Number($('u').value),v:Number($('v').value),angle:Number($('angle').value),offset:Number($('offset').value)});
 const valid=()=>['offset',...($('mode').value==='plane'?['u','v','angle']:[])].every(key=>$(key).value.trim()&&$(key).checkValidity());
 function anchor(v=values()){
  if(!previewBase)return null;
  return new THREE.Vector3(...previewBase.destination.anchor).addScaledVector(new THREE.Vector3(...previewBase.basis.u),v.u).addScaledVector(new THREE.Vector3(...previewBase.basis.v),v.v).addScaledVector(new THREE.Vector3(...previewBase.basis.n),v.offset);
 }
 const handles=createAssemblyAdjustHandles({host,camera,getGrid:getGridSnap,getState:()=>dialog.open&&previewBase&&movingPreview&&!picking&&!busy&&$('mode').value==='plane'&&valid()?{anchor:anchor().toArray(),basis:previewBase.basis,values:values()}:null,
  onStart:()=>{invalidate(true);$('status').textContent='面上で調整中。離すと隙間・めり込みを検査します。';},
  onChange:next=>{for(const key of ['u','v','angle'])$(key).value=next[key];fast();},onEnd:()=>{if(dialog.open)schedule(true);}
 });
 function clear(){
  contact.clear();for(const [mesh,visible]of hidden)mesh.visible=visible;hidden=[];
  if(preview){scene.remove(preview);preview.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});preview=null;}
  movingPreview=null;previewBase=null;previewObjects.clear();delete host.dataset.assemblyPreview;delete host.dataset.assemblyContact;delete host.dataset.assemblyFastAdjustment;
 }
 function invalidate(keep=false){revision++;clearTimeout(timer);if(inflight){kernel.reset();inflight=false;}cached=null;$('apply').disabled=true;if(keep&&preview){contact.pending();delete host.dataset.assemblyContact;}else clear();return revision;}
 function close(){handles.cancel();invalidate();busy=false;picking=null;if(dialog.open)dialog.close();handles.update();}
 function controls(){
  for(const el of dialog.querySelectorAll('button,input,select'))el.disabled=busy;
  $('apply').disabled=busy||!cached;$('mode').disabled=busy||!!editing;
  const plane=$('mode').value==='plane';$('alignment-label').hidden=!plane;$('anchors').hidden=!plane||$('alignment').value!=='boundary';$('adjustments').hidden=!plane;
  $('alignment-help').textContent={center:'クリック位置によらず、面の中心同士を合わせます。',boundary:'横・縦の方向は画面のハンドルに対応します。曲線や凹形状は面の外形範囲を基準にします。',picked:'選択した位置同士を合わせます。'}[$('alignment').value];
  $('source').disabled=$('destination').disabled=busy||!!editing;
  for(const role of ['source','destination']){$(role).setAttribute('aria-pressed',String(picking===role));const ref=role==='source'?source:destination;$(role+'-name').textContent=ref?' '+bodyName(ref.bodyId):' 未選択';}
 }
 function spec(){return {type:'assemblyMate',id,mode:$('mode').value,...($('mode').value==='plane'?{planeAlignment:$('alignment').value,sourceAnchor:$('source-anchor').value,destinationAnchor:$('destination-anchor').value,slideU:Number($('u').value),slideV:Number($('v').value),twist:Number($('angle').value)}:{}),source,destination,offset:Number($('offset').value),flip:$('flip').checked};}
 function fast(){
  if(!movingPreview||!previewBase||!valid()||$('mode').value!=='plane')return;
  const v=values(),destination=anchor(v);
  movingPreview.matrix.copy(assemblyFastMatrix(previewBase,v));movingPreview.matrixWorldNeedsUpdate=true;movingPreview.updateMatrixWorld(true);
  host.dataset.assemblyFastAdjustment=JSON.stringify({...v,anchor:destination.toArray()});handles.update();
 }
 function meshOf(out,color,opacity=1){const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(out.vertices,3)).setIndex(out.triangles);geometry.computeVertexNormals();return new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.6,transparent:opacity<1,opacity,depthWrite:opacity>=.8,side:THREE.DoubleSide}));}
 function showPreview(result){
  clear();preview=new THREE.Group();movingPreview=new THREE.Group();movingPreview.matrixAutoUpdate=false;preview.add(movingPreview);previewBase=result.analysis.assembly;
  for(const out of result.outputs){const object=meshOf(out,0x36b5aa,.85),live=meshes.get(out.id);object.visible=live?.visible??true;movingPreview.add(object);previewObjects.set(out.id,object);if(live){hidden.push([live,live.visible]);live.visible=false;}}
  const stationary=result.assemblyPreview?.stationary||[];
  for(const out of stationary){const ghost=meshOf(out,0xd6a44b,.3);preview.add(ghost);previewObjects.set(out.id,ghost);const live=meshes.get(out.id);if(live){hidden.push([live,live.visible]);live.visible=false;}}
  scene.add(preview);preview.updateMatrixWorld(true);
  host.dataset.assemblyPreview=JSON.stringify({source:source.bodyId,destination:destination.bodyId,targets:result.outputs.map(o=>o.id),planeAlignment:$('alignment').value,sourceAnchor:previewBase.source.anchor,destinationAnchor:previewBase.destination.anchor,contactAnchor:previewBase.contactAnchor,basis:previewBase.basis,adjustment:previewBase.adjustment});
  host.dataset.assemblyContact=JSON.stringify(result.analysis.assemblyContact);contact.show(result.analysis.assemblyContact,result.assemblyPreview?.highlights);handles.update();
 }
 function schedule(keep=false){
  const request=invalidate(keep);controls();$('error').textContent='';
  if(!source||!destination){$('status').textContent=picking==='destination'?'相手の面をクリックしてください':'動かす部品の面をクリックしてください';handles.update();return;}
  if(!valid()){$('error').textContent='有効な距離・角度を入力してください';handles.update();return;}
  if(keep)fast();$('status').textContent='位置合わせ・隙間・めり込みを確認中…';
  timer=setTimeout(async()=>{inflight=true;try{const input=spec(),result=await kernel.run(history,{...input,preview:true});if(request!==revision||!dialog.open||getFeatures()!==original)return;showPreview(result);cached={input,result};$('status').textContent='水色：移動する '+result.outputs.length+' ボディ ／ 橙色：相手。'+(editing?'固定位置を更新します。':'確定すると相対位置を固定します。');controls();}catch(e){if(request===revision&&dialog.open){$('error').textContent=e.message;$('status').textContent='位置合わせできませんでした。基準や数値を確認してください';}}finally{if(request===revision)inflight=false;}},180);
 }
 function links(){
  const current=assemblyLinks(original,new Set(meshes.keys()));$('links').replaceChildren();if(!current.length)$('links').textContent='固定された部品はありません';
  for(const link of current){const row=document.createElement('p'),button=document.createElement('button');row.append(document.createTextNode(link.bodies.map(bodyName).join(' ↔ ')+' '));button.type='button';button.textContent='固定を解除';button.dataset.releaseId=link.id;button.onclick=async()=>{if(busy)return;invalidate();busy=true;controls();try{await release(link.id,original);close();notify('部品の位置を保って固定を解除しました');}catch(e){$('error').textContent=e.message;}finally{busy=false;controls();}};row.append(button);$('links').append(row);}
 }
 for(const role of ['source','destination'])$(role).onclick=()=>{handles.cancel();invalidate();picking=role;controls();handles.update();$('status').textContent=(role==='source'?'動かす':'相手の')+($('mode').value==='axis'?'円筒面':'平面')+'をクリックしてください';};
 $('mode').onchange=()=>{source=destination=null;picking='source';schedule();};
 for(const key of ['alignment','source-anchor','destination-anchor','flip'])$(key).onchange=()=>schedule();
 for(const key of ['offset','u','v','angle'])$(key).oninput=()=>schedule(true);
 $('reset-adjustment').onclick=()=>{for(const key of ['u','v','angle'])$(key).value='0';schedule(true);};$('close').onclick=$('cancel').onclick=close;
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',()=>{handles.cancel();invalidate();busy=false;handles.update();});
 dialog.querySelector('form').onsubmit=async e=>{
  e.preventDefault();if(busy||handles.dragging||!cached||!dialog.querySelector('form').reportValidity())return;
  const request=revision,{input,result}=cached,{assemblyPreview,...stored}=result;busy=true;controls();handles.update();
  try{await apply(input,stored,editing,original,()=>dialog.open&&request===revision);if(request===revision){close();notify(editing?'部品の固定位置を更新しました':'別ボディのまま位置を合わせて固定しました');}}catch(e){if(request===revision)$('error').textContent=e.message;}finally{if(request===revision){busy=false;controls();}}
 };
 return {
  open(feature=null){onStart();original=getFeatures();editing=feature;const index=feature?original.findIndex(f=>f.id===feature.id):-1;if(feature&&index<0)return;history=feature?original.slice(0,index):original;id=feature?.id||crypto.randomUUID();source=feature?.spec.source||null;destination=feature?.spec.destination||null;const saved=feature?.spec||{};
   $('mode').value=saved.mode||'plane';$('alignment').value=feature?(saved.planeAlignment||'picked'):'center';$('source-anchor').value=saved.sourceAnchor||'center';$('destination-anchor').value=saved.destinationAnchor||'center';$('offset').value=saved.offset??0;$('u').value=saved.slideU??0;$('v').value=saved.slideV??0;$('angle').value=saved.twist??0;$('flip').checked=!!saved.flip;picking=editing?null:'source';busy=false;$('apply').textContent=editing?'固定位置を更新':'位置を合わせて固定';links();dialog.show();schedule();
  },
  async pick(event){
   if(!dialog.open||busy||!picking)return;const rect=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);const hit=ray.intersectObjects([...meshes.values()].filter(m=>m.visible),false)[0];if(!hit){$('error').textContent='部品の面をクリックしてください';return;}
   const role=picking,request=invalidate();busy=true;controls();inflight=true;
   try{const reference={bodyId:hit.object.userData.bodyId,point:hit.point.toArray()},result=await kernel.run(history,{type:'assemblyInfo',mode:$('mode').value,reference});if(request!==revision||!dialog.open||getFeatures()!==original)return;const ref={...reference,...($('mode').value==='plane'?{normal:result.analysis.normal}:{})};if(role==='source'){source=ref;picking='destination';}else{destination=ref;picking=null;}busy=false;inflight=false;schedule();}catch(e){if(request===revision)$('error').textContent=e.message;}finally{if(request===revision){busy=false;inflight=false;controls();}}
  },
  close,cancelDrag:()=>handles.cancelDrag(),sync(){if(dialog.open&&getFeatures()!==original)close();else handles.update();},get active(){return dialog.open;}
 };
}
