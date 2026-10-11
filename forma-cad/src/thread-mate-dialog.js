import * as THREE from 'three';
import {threadMateSource} from './thread-source.js';
import {draggableDialog} from './draggable-dialog.js';
export function threadMateDialog({scene,meshes,host,kernel,getFeatures,bodyName,fitPreview,pickPoint,apply,notify}){
 const dialog=document.createElement('dialog');dialog.id='thread-mate-dialog';dialog.className='thread-mate-dialog';
 dialog.innerHTML='<div class="dialog-heading"><h2>相手ねじを作成</h2><button type="button" id="thread-mate-close" aria-label="閉じる">×</button></div><form id="thread-mate-form"><label>元のねじ<select id="thread-mate-target"></select></label><p id="thread-mate-source" role="status"></p><label>作成先<select id="thread-mate-destination"><option value="new">新しいボディを作成</option><option value="existing">既存ボディに加工</option></select></label><div id="thread-mate-existing" hidden><label>加工先ボディ<select id="thread-mate-body"></select></label><button type="button" id="thread-mate-pick">平面上の配置点を選択</button><p id="thread-mate-position" role="status">配置点を選択してください</p><div id="thread-mate-offsets" hidden><label>面上の横移動 (mm)<input id="thread-mate-u" type="number" step="any" value="0"></label><label>面上の縦移動 (mm)<input id="thread-mate-v" type="number" step="any" value="0"></label></div></div><label>相手の種類<output id="thread-mate-kind"></output></label><label id="thread-mate-length-label"><span>ねじの長さ (mm)</span><input id="thread-mate-length" type="number" min="0.1" max="10000" step="any" required></label><label id="thread-mate-wall-label">ナットの肉厚 (mm)<input id="thread-mate-wall" type="number" min="0.1" max="1000" step="any" required></label><label>ねじ面の逃がし量 (mm)<input id="thread-mate-clearance" type="number" min="0" step="any" required></label><p>径・ピッチ・回転方向は元のねじから引き継ぎます。逃がし量0で基準形状、正の値で相手側のねじ面をマイナス方向へ自動プルし、はめ合いに余裕を付けます。</p><p id="thread-mate-placement-help"></p><p id="thread-mate-info" role="status"></p><p id="thread-mate-error" role="alert"></p><div class="editor-actions"><button type="button" id="thread-mate-cancel">キャンセル</button><button type="submit" id="thread-mate-apply" class="accent" disabled>作成</button></div></form>';
 document.body.append(dialog);draggableDialog(dialog);
 const $=name=>dialog.querySelector('#thread-mate-'+name);
 let original,history,editing,id,info=null,cached=null,preview=null,hidden=[],timer=null,revision=0,inflight=false,busy=false,fitted=false,placement=null,picking=false;
 const fields=['length','wall','clearance'],existing=()=>$('destination').value==='existing';
 const located=()=>{
  if(!placement)return null;
  const point=new THREE.Vector3(...placement.point).addScaledVector(new THREE.Vector3(...placement.u),Number($('u').value)).addScaledVector(new THREE.Vector3(...placement.v),Number($('v').value));
  return {bodyId:$('body').value,point:point.toArray(),normal:[...placement.normal]};
 };
 const input=()=>({type:'threadMate',id,target:$('target').value,...Object.fromEntries(fields.map(k=>[k,Number($(k).value)])),...(existing()?{destination:'existing',placement:located()}:{} )});
 function clear(){for(const [mesh,visible]of hidden)mesh.visible=visible;hidden=[];if(!preview)return;scene.remove(preview);preview.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});preview=null;delete host.dataset.threadMate;}
 function invalidate(){revision++;clearTimeout(timer);if(inflight){kernel.reset();inflight=false;}cached=null;$('apply').disabled=true;clear();return revision;}
 function close(){invalidate();busy=false;info=null;picking=false;dialog.close();}
 $('close').onclick=$('cancel').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',()=>{invalidate();busy=false;picking=false;});
 function positionText(){const p=located();$('position').textContent=p?'中心：'+p.point.map(v=>Number(v.toFixed(3))).join(', ')+' mm':'配置点を選択してください';}
 function controls(){
  for(const el of dialog.querySelectorAll('input,select,button'))el.disabled=busy&&!['thread-mate-close','thread-mate-cancel'].includes(el.id);
  for(const key of fields)$(key).disabled=busy||!info||key==='wall'&&(!info.internal||existing());
  $('wall-label').hidden=!info?.internal||existing();$('existing').hidden=!existing();$('offsets').hidden=!placement;
  $('pick').disabled=busy||!info||!$('body').value;$('pick').textContent=picking?'加工先の平面上をクリック…':'平面上の配置点を選択';
  $('length-label').querySelector('span').textContent=existing()&&info?.internal?'ねじ穴の深さ (mm)':'ねじの長さ (mm)';
  $('kind').textContent=!info?'':info.internal?(existing()?'雌ねじ（ねじ穴）':'雌ねじ（円筒ナット）'):(existing()?'雄ねじ（面から突出）':'雄ねじ（円柱）');
  $('placement-help').textContent=existing()?'加工先の平面上で中心点を指定します。ねじ穴は面の内側へ、雄ねじは面の外側へ加工します。元のねじボディは変更しません。':'対象ボディの最後に作成した通常のねじを使用します。新しいパーツは既存のソリッドの右側に離して、底面をZ=0にして配置します。';
  $('apply').disabled=busy||!cached;
 }
 function bodiesForTarget(){
  const ids=new Set(history.flatMap(f=>(f.outputs||f.cadResult?.outputs)?.map(o=>o.id)||(f.operation==='new'&&f.kind==='extrusion'?[f.id]:[])));
  const previous=$('body').value;
  $('body').replaceChildren(...[...ids].filter(body=>body!==$('target').value&&meshes.has(body)).map(body=>new Option(bodyName(body),body)));
  if([...$('body').options].some(o=>o.value===previous))$('body').value=previous;
 }
 function schedule(){if(!info)return;const request=invalidate();$('info').textContent='';
  if(existing()&&!placement){$('error').textContent=$('body').value?'「平面上の配置点を選択」を押し、加工先の面上をクリックしてください':'元のねじとは別の加工先ボディが必要です';controls();return;}
  if(![...fields,...(existing()?['u','v']:[])].every(k=>$(k).disabled||$(k).value.trim()&&$(k).checkValidity())){$('error').textContent='寸法を正しい数値で指定してください';return;}
  positionText();$('error').textContent='相手ねじを計算しています…';timer=setTimeout(async()=>{inflight=true;const spec=input();try{
   const result=await kernel.run(history,spec);if(request!==revision||!dialog.open)return;if(getFeatures()!==original)throw Error('モデルが変更されました。開き直してください');
   preview=new THREE.Group();for(const out of result.outputs){const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(out.vertices,3)).setIndex(out.triangles);if(out.normals?.length===out.vertices.length)g.setAttribute('normal',new THREE.Float32BufferAttribute(out.normals,3));else g.computeVertexNormals();preview.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x64c8b0,roughness:.65,side:THREE.DoubleSide})));}
   const hide=new Set([...(editing?.outputs||[]).map(o=>o.id),...(existing()?result.outputs.map(o=>o.id):[])]);
   for(const body of hide){const mesh=meshes.get(body);if(mesh){hidden.push([mesh,mesh.visible]);mesh.visible=false;}}
   scene.add(preview);host.dataset.threadMate=JSON.stringify(result.analysis);cached={key:JSON.stringify(spec),result};
   if(!fitted&&!existing()){const box=new THREE.Box3().setFromObject(preview);for(const mesh of meshes.values())if(mesh.visible)box.expandByObject(mesh);fitPreview(box);fitted=true;}
   $('info').textContent=(info.internal?(existing()?'ねじ穴':'円筒ナット'):(existing()?'突出した雄ねじ':'ねじ付き円柱'))+' ／ Ø'+Number(info.diameter.toFixed(4))+' × '+info.pitch+' mm ／ '+(info.leftHand?'左ねじ':'右ねじ')+' ／ 長さ '+spec.length+' mm ／ 逃がし量 '+spec.clearance+' mm';
   $('error').textContent=existing()?'緑色：加工後のボディ（元のねじは変更しません）':'緑色：新しく作成する相手ねじ';$('apply').disabled=false;
  }catch(e){if(request===revision&&dialog.open)$('error').textContent=e.message;}finally{if(request===revision)inflight=false;}},250);
 }
 async function prepare(values=null){const request=invalidate();info=null;picking=false;controls();$('apply').disabled=true;$('source').textContent='ねじの径とピッチを確認しています…';$('error').textContent='';inflight=true;
  try{const result=await kernel.run(history,{type:'threadMateInfo',target:$('target').value});if(request!==revision||!dialog.open)return;info=result.analysis;
   $('source').textContent=info.designation+' ／ '+(info.leftHand?'左ねじ':'右ねじ')+' ／ 元のねじ長さ '+Number(info.length.toFixed(3))+' mm';
   for(const key of fields)$(key).value=values?.[key]??info[key];$('clearance').max=info.pitch*.4;controls();inflight=false;schedule();
  }catch(e){if(request===revision&&dialog.open){inflight=false;$('source').textContent='';$('error').textContent=e.message;}}
 }
 $('target').onchange=()=>{placement=null;$('u').value=$('v').value='0';bodiesForTarget();prepare();};
 $('destination').onchange=()=>{picking=false;controls();schedule();};
 $('body').onchange=()=>{picking=false;placement=null;$('u').value=$('v').value='0';positionText();controls();schedule();};
 $('pick').onclick=()=>{invalidate();picking=true;controls();$('error').textContent='加工先「'+bodyName($('body').value)+'」の平面上で中心点をクリックしてください';};
 $('form').addEventListener('input',e=>{if(!['target','destination','body'].some(k=>e.target===$(k)))schedule();});
 $('form').onsubmit=async e=>{e.preventDefault();if(busy||!cached||$('apply').disabled)return;const spec=input(),request=revision;if(JSON.stringify(spec)!==cached.key)return;busy=true;controls();
  try{await apply(spec,cached.result,editing,original,()=>request===revision&&dialog.open);if(request!==revision||!dialog.open)return;close();notify(editing?'相手ねじを更新しました':spec.destination==='existing'?'既存ボディに相手ねじを加工しました':'相手ねじを新しいボディとして作成しました');}
  catch(e){if(request===revision&&dialog.open)$('error').textContent=e.message;}finally{if(request===revision){busy=false;controls();}}
 };
 return {open(target,feature=null){if(dialog.open)close();original=getFeatures();editing=feature;const index=feature?original.findIndex(f=>f.id===feature.id):-1;if(feature&&index<0)return;
  history=feature?original.slice(0,index):original;const candidates=[...new Set(history.flatMap(f=>(f.outputs||f.cadResult?.outputs)?.map(o=>o.id)||(f.operation==='new'&&f.kind==='extrusion'?[f.id]:[])))].filter(body=>threadMateSource(history,body));
  if(!candidates.length){notify('通常のねじで作成したボディを選択してください');return;}
  id=feature?.spec.id||crypto.randomUUID();info=null;cached=null;busy=false;fitted=false;picking=false;placement=null;$('u').value=$('v').value='0';
  $('target').replaceChildren(...candidates.map(body=>new Option(bodyName(body),body)));$('target').value=feature?.spec.target||target||candidates[0];if(!$('target').value)$('target').value=candidates[0];
  $('destination').value=feature?.spec.destination||'new';bodiesForTarget();
  if(feature?.spec.placement){const p=feature.spec.placement,n=new THREE.Vector3(...p.normal),u=(Math.abs(n.x)<.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0));u.addScaledVector(n,-u.dot(n)).normalize();placement={...p,u:u.toArray(),v:n.clone().cross(u).toArray()};$('body').value=p.bodyId;}
  positionText();$('apply').textContent=feature?'変更を適用':'作成';dialog.querySelector('h2').textContent=feature?'相手ねじを再編集':'相手ねじを作成';controls();dialog.show();prepare(feature?.spec||null);
 },pick(event){
  if(!dialog.open||!picking||busy)return;
  try{const candidate=pickPoint(event);if(!candidate)throw Error('加工先の平面上をクリックしてください');if(candidate.bodyId!==$('body').value)throw Error('指定した加工先ボディの平面を選択してください');
   const {frame}=candidate.face;placement={point:candidate.point.toArray(),normal:[...frame.n],u:[...frame.u],v:[...frame.v]};$('u').value=$('v').value='0';picking=false;positionText();controls();schedule();
  }catch(e){$('error').textContent=e.message;}
 },get active(){return dialog.open;}};
}
