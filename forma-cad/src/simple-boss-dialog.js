import * as THREE from 'three';
import {simpleBossDefaults,validateSimpleBoss} from './simple-boss.js';
import {draggableDialog} from './draggable-dialog.js';

export function simpleBossDialog({scene,meshes,host,kernel,getFeatures,bodyName,apply,notify}){
 const dialog=document.createElement('dialog');dialog.id='simple-boss-dialog';
 dialog.innerHTML='<div class="dialog-heading"><h2>簡易ボス</h2><button type="button" id="simple-boss-close" aria-label="閉じる">×</button></div><form id="simple-boss-form"><p id="simple-boss-source"></p><label>種類<select id="simple-boss-role"><option value="male">オス（差し込み棒）</option><option value="female">メス（面に埋め込む穴）</option></select></label><label>棒の直径 (mm)<input id="simple-boss-diameter" type="number" min="1" max="50" step="any" value="6" required></label><label>差し込み長さ (mm)<input id="simple-boss-length" type="number" min="1" max="100" step="any" value="4" required></label><label>片側のすき間 (mm)<input id="simple-boss-clearance" type="number" min="0" max="1" step="any" value="0.2" required></label><label id="simple-boss-extend-label" class="simple-boss-checkbox"><input id="simple-boss-extend" type="checkbox" checked>深さが足りなければ内側へ自動延長</label><p id="simple-boss-position"></p><p id="simple-boss-info" role="status"></p><details><summary>寸法と延長について</summary><p>オスは面の外へ突出し、メスは面の内側へ穴を開けます。同じ棒径・長さを使ってください。自動延長時は内側に肉厚1.6 mmの受け筒を追加し、穴の底に1.2 mmを残します。</p></details><p id="simple-boss-error" role="alert"></p><div class="editor-actions"><button type="button" id="simple-boss-cancel">キャンセル</button><button type="submit" id="simple-boss-apply" class="accent" disabled>作成</button></div></form>';
 document.body.append(dialog);draggableDialog(dialog);
 const $=key=>dialog.querySelector('#simple-boss-'+key),keys=['diameter','length','clearance'];
 let original,history,editing,placement,id,preview=null,hidden=null,cached=null,timer=null,version=0,inflight=false,busy=false;
 const spec=()=>({type:'simpleBoss',id,target:placement.target,point:[...placement.point],normal:[...placement.normal],role:$('role').value,extendInside:$('extend').checked,...Object.fromEntries(keys.map(k=>[k,$(k).value.trim()===''?NaN:Number($(k).value)]))});
 function clear(){if(hidden){hidden.mesh.visible=hidden.visible;hidden=null;}if(preview){scene.remove(preview);preview.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});preview=null;}delete host.dataset.simpleBoss;}
 function invalidate(){version++;clearTimeout(timer);cached=null;$('apply').disabled=true;if(inflight){kernel.reset();inflight=false;}clear();return version;}
 function close(){invalidate();busy=false;dialog.close();}
 $('close').onclick=$('cancel').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('close',()=>{if(cached||preview||inflight)invalidate();});
 function controls(){for(const input of dialog.querySelectorAll('input,select'))input.disabled=busy;$('apply').disabled=busy||!cached;}
 function schedule(){
  if(busy)return;$('extend-label').hidden=$('role').value!=='female';const request=invalidate();$('error').textContent='';$('info').textContent='';let input;
  try{input=validateSimpleBoss(spec());}catch(error){$('error').textContent=error.message;return;}
  $('info').textContent='簡易ボスの形状を確認しています…';
  timer=setTimeout(async()=>{
   if(request!==version||!dialog.open)return;inflight=true;
   try{const result=await kernel.run(history,input);if(request!==version||!dialog.open)return;inflight=false;if(getFeatures()!==original)throw Error('モデルが変更されました。配置する面を選択し直してください');
    preview=new THREE.Group();for(const output of result.outputs){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(output.vertices,3));g.setIndex(output.triangles);if(output.normals?.length===output.vertices.length)g.setAttribute('normal',new THREE.Float32BufferAttribute(output.normals,3));else g.computeVertexNormals();preview.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:input.role==='male'?0xc99b50:0x62b5ce,roughness:.65,metalness:.05})));}scene.add(preview);
    const mesh=meshes.get(input.target);if(mesh){hidden={mesh,visible:mesh.visible};mesh.visible=false;}
    cached={key:JSON.stringify(input),result};host.dataset.simpleBoss=JSON.stringify(result.analysis);const a=result.analysis;
    $('info').textContent=input.role==='male'?'棒 Ø'+a.diameter+' mm ／ 突出 '+a.length+' mm ／ 先端に差し込み用の面取り':'穴 Ø'+Number(a.holeDiameter.toFixed(3))+' mm ／ 深さ '+Number(a.holeDepth.toFixed(3))+' mm（差し込み長さ＋すき間）'+(a.extendedInside?' ／ 内側に受け筒を追加：奥行き '+Number(a.receiverDepth.toFixed(3))+' mm・肉厚 '+a.receiverWall+' mm':'');controls();
   }catch(error){if(request===version&&dialog.open){inflight=false;clear();$('info').textContent='';$('error').textContent=error.message;}}
  },180);
 }
 $('form').addEventListener('input',schedule);
 $('form').onsubmit=async event=>{event.preventDefault();if(busy||!cached)return;const input=spec(),request=version;if(cached.key!==JSON.stringify(input))return;busy=true;controls();
  try{await apply(input,cached.result,editing,original,()=>request===version&&dialog.open);if(request!==version||!dialog.open)return;close();notify(editing?'簡易ボスを更新しました':input.role==='male'?'簡易ボスのオスを追加しました':'簡易ボスのメス穴を追加しました');}
  catch(error){if(request===version&&dialog.open)$('error').textContent=error.message;}finally{if(request===version){busy=false;controls();}}
 };
 return {close,open(next,feature=null){
  if(dialog.open)close();original=getFeatures();editing=feature;const index=feature?original.findIndex(f=>f.id===feature.id):-1;if(feature&&index<0)return;history=feature?original.slice(0,index):original;
  placement=feature?.spec||next;id=feature?.id||crypto.randomUUID();busy=false;cached=null;const values=feature?.spec||simpleBossDefaults;
  $('role').value=placement.role;$('extend').checked=values.extendInside!==false;for(const key of keys)$(key).value=values[key];$('source').textContent='対象：'+bodyName(placement.target);$('position').textContent='中心 X / Y / Z：'+placement.point.map(v=>Number(v.toFixed(3))).join(' / ')+' mm';$('apply').textContent=feature?'変更を適用':'作成';controls();dialog.show();schedule();
 }};
}
