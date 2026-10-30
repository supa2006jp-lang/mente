import * as THREE from 'three';
import {KernelClient} from './kernel-client.js';
import {draggableDialog} from './draggable-dialog.js';
import {honeycombDefaults,honeycombSettings} from './honeycomb-layout.js';
export function createHoneycombDialog({scene,meshes,host,getFeatures,bodyName,apply,notify}){
 const worker=new KernelClient(),dialog=document.createElement('dialog');dialog.id='honeycomb-dialog';
 dialog.setAttribute('aria-labelledby','honeycomb-title');
 dialog.innerHTML=`<form><div class="dialog-heading"><h2 id="honeycomb-title">ハニカム格子</h2><button type="button" id="honeycomb-close" aria-label="閉じる">×</button></div>
 <p>円柱は側面を一周、直方体は側面4面に六角穴を開けます。上下と角には枠を残します。</p>
 <label>対象ボディ<select id="honeycomb-target"></select></label>
 <label>加工範囲<select id="honeycomb-scope"><option value="all">全側面</option><option value="selected">選択した平面だけ（箱）</option></select></label>
 <div class="honeycomb-fields"><label>六角穴の幅 (mm)<input id="honeycomb-cell" type="number" min="1" max="500" step="any" required></label><label>格子の幅 (mm)<input id="honeycomb-rib" type="number" min="0.4" max="100" step="any" required></label><label>側壁の厚み (mm)<input id="honeycomb-thickness" type="number" min="0.4" max="100" step="any" required></label><label>端の枠幅 (mm)<input id="honeycomb-border" type="number" min="0.4" max="500" step="any" required></label></div>
 <label>箱の高さ方向<select id="honeycomb-heightAxis"><option value="Z">Z方向に近い辺</option><option value="Y">Y方向に近い辺</option><option value="X">X方向に近い辺</option></select></label>
 <label class="honeycomb-check"><input id="honeycomb-hollow" type="checkbox">指定した側壁厚で内側を空洞にする</label>
 <p class="honeycomb-help">ONでは上面・底面も側壁と同じ厚みにします。OFFでは指定した深さまで側面を加工します。先にシェルしたボディにも使えます。穴の幅は向かい合う辺どうしの距離です。円柱では内側の格子幅を保つため間隔を調整します。</p>
 <p id="honeycomb-status" role="status" aria-live="polite"></p><p id="honeycomb-error" role="alert"></p>
 <div class="editor-actions"><button type="button" id="honeycomb-cancel">キャンセル</button><button type="submit" id="honeycomb-apply" class="accent" disabled>作成</button></div></form>`;
 const style=document.createElement('style');style.textContent=`#honeycomb-dialog{position:fixed;left:auto;right:16px;top:80px;margin:0;width:min(400px,calc(100vw - 32px));max-height:calc(100vh - 104px);box-sizing:border-box;overflow:auto;z-index:1100}#honeycomb-dialog .dialog-heading h2{font-size:20px}#honeycomb-dialog p{line-height:1.6}#honeycomb-dialog label{display:flex;flex-direction:column;gap:6px;margin:12px 0}#honeycomb-dialog input,#honeycomb-dialog select{box-sizing:border-box;min-width:0;width:100%}#honeycomb-dialog .honeycomb-fields{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}#honeycomb-dialog .honeycomb-check{flex-direction:row;align-items:center}#honeycomb-dialog .honeycomb-check input{width:auto}#honeycomb-dialog .honeycomb-help{font-size:12px;color:#526c80}#honeycomb-error{color:#b44b21}#honeycomb-status{font-weight:600}#honeycomb-dialog .editor-actions{position:sticky;bottom:-20px;background:#f5fbff;padding:12px 0;margin-bottom:0}`;
 style.textContent+='#honeycomb-dialog{background:#f5fbff;color:#214e65;border:1px solid #86b0c9;border-radius:14px;box-shadow:0 12px 36px #102d4830}#honeycomb-dialog .dialog-heading{border-bottom:1px solid #ccdee8;padding-bottom:12px}#honeycomb-dialog label{color:#214e65}#honeycomb-close,#honeycomb-cancel{color:#f5fbff}';
 document.head.append(style);document.body.append(dialog);draggableDialog(dialog);
 const $=key=>dialog.querySelector('#honeycomb-'+key),fields=['cell','rib','thickness','border','hollow','scope','heightAxis'];
 let original=null,history=null,editing=null,id=null,face=null,version=0,timer=null,cached=null,preview=null,hidden=null,applying=false;
 function clearPreview(){if(preview){preview.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});preview.removeFromParent();preview=null;}if(hidden){const [mesh,visible]=hidden;if(mesh.parent)mesh.visible=visible;hidden=null;}delete host.dataset.honeycombPreview;}
 function close(){version++;clearTimeout(timer);worker.reset();cached=null;clearPreview();if(dialog.open)dialog.close();}
 dialog.addEventListener('close',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}});$('close').onclick=$('cancel').onclick=close;
 function spec(){
  const settings=Object.fromEntries(fields.map(key=>[key,$(key).type==='checkbox'?$(key).checked:$(key).type==='number'?Number($(key).value):$(key).value]));
  honeycombSettings(settings);
  if(settings.scope==='selected'&&(!face||face.bodyId!==$('target').value))throw Error('箱の側面を選択してから開いてください');
  return {type:'honeycomb',id,target:$('target').value,...settings,...(settings.scope==='selected'?{faceNormal:face.normal}:{} )};
 }
 async function refresh(){
  clearTimeout(timer);const token=++version;worker.reset();cached=null;clearPreview();$('apply').disabled=true;$('error').textContent='';
  if(!dialog.open)return;
  let input;try{if(!dialog.querySelector('form').checkValidity())throw Error('数値の入力範囲を確認してください');input=spec();}catch(error){$('status').textContent='';$('error').textContent=error.message;return;}
  $('status').textContent='プレビューを計算しています…';
  try{
   const result=await worker.run(history,input,{onProgress:p=>{if(token===version)$('status').textContent=p.stage;}});
   if(token!==version||!dialog.open||getFeatures()!==original)return;
   const group=new THREE.Group();for(const output of result.outputs){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(output.vertices,3));geometry.setIndex(output.triangles);geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xd4ab63,roughness:.65,side:THREE.DoubleSide}));group.add(mesh);const lines=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,28),new THREE.LineBasicMaterial({color:0x725324}));group.add(lines);}
   preview=group;scene.add(group);const mesh=meshes.get(input.target);if(mesh){hidden=[mesh,mesh.visible];mesh.visible=false;}
   cached={input,result,signature:JSON.stringify(input)};host.dataset.honeycombPreview=JSON.stringify(result.analysis.honeycomb);
   $('status').textContent=(result.analysis.honeycomb.kind==='cylinder'?'円柱・一周':'直方体')+' ／ 六角穴 '+result.analysis.honeycomb.holeCount+'個';$('apply').disabled=false;
  }catch(error){if(token===version&&dialog.open){$('status').textContent='';$('error').textContent=error.message;}}
 }
 function change(){version++;worker.reset();cached=null;clearPreview();$('apply').disabled=true;$('status').textContent='プレビューを更新します…';clearTimeout(timer);timer=setTimeout(refresh,300);}
 for(const el of dialog.querySelectorAll('input,select'))el.addEventListener('input',change);
 dialog.querySelector('form').onsubmit=async event=>{
  event.preventDefault();if(applying||!cached)return;const current=cached,token=version;
  if(getFeatures()!==original||current.signature!==JSON.stringify(spec())){notify('設定が変わりました。プレビューを確認してください');change();return;}
  applying=true;for(const el of dialog.querySelectorAll('input,select,button[type=submit]'))el.disabled=true;
  try{await apply(current.input,current.result,editing,original,()=>dialog.open&&version===token);close();}
  catch(error){if(dialog.open)$('error').textContent=error.message;}
  finally{applying=false;for(const el of dialog.querySelectorAll('input,select'))el.disabled=false;$('target').disabled=!!editing;$('apply').disabled=!cached;}
 };
 function open(target,feature=null,selectedFace=null){
  close();original=getFeatures();editing=feature;history=feature?original.slice(0,original.findIndex(f=>f.id===feature.id)):original;id=feature?.spec.id||feature?.id||crypto.randomUUID();face=selectedFace;
  if(feature?.spec.faceNormal)face={bodyId:feature.spec.target,normal:feature.spec.faceNormal};
  const ids=feature?[feature.spec.target]:[...meshes.keys()];$('target').replaceChildren(...ids.map(body=>new Option(bodyName(body),body)));if(ids.includes(target))$('target').value=target;
  if(!ids.length){notify('先に円柱か直方体を作成してください');return;}
  $('target').disabled=!!feature;const settings={...honeycombDefaults,...feature?.spec};for(const key of fields){if($(key).type==='checkbox')$(key).checked=settings[key];else $(key).value=settings[key];}
  $('apply').textContent=feature?'変更を適用':'作成';$('error').textContent='';dialog.show();refresh();
 }
 return {open,close,get active(){return dialog.open;}};
}
