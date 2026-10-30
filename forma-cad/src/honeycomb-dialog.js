import * as THREE from 'three';
import {KernelClient} from './kernel-client.js';
import {draggableDialog} from './draggable-dialog.js';
import {honeycombDefaults,honeycombSettings,planHoneycomb} from './honeycomb-layout.js';
import {honeycombTargetHistory} from './honeycomb-history.js';
import {loadHoneycombPreferences,saveHoneycombPreferences} from './honeycomb-preferences.js';
import {installHoneycombAppliedDimensions} from './honeycomb-applied-dimensions.js';
export function createHoneycombDialog({scene,meshes,host,getFeatures,bodyName,apply,notify}){
 const worker=new KernelClient(),dialog=document.createElement('dialog');dialog.id='honeycomb-dialog';
 dialog.setAttribute('aria-labelledby','honeycomb-title');
 dialog.innerHTML=`<form><div class="dialog-heading"><h2 id="honeycomb-title">ハニカム格子</h2><button type="button" id="honeycomb-close" aria-label="閉じる">×</button></div>
 <p>円柱は側面を一周、直方体は側面4面に六角穴を開けます。端と角には枠を残します。</p>
 <label>対象ボディ<select id="honeycomb-target"></select></label>
 <label>加工範囲<select id="honeycomb-scope"><option value="all">全側面</option><option value="selected">選択した平面だけ（箱）</option></select></label>
 <label>精密プレビュー<select id="honeycomb-preview-mode"><option value="auto">自動で計算</option><option value="manual">手動・配置だけ表示</option></select></label>
 <label>上面・底面<select id="honeycomb-caps"><option value="closed">両方残す</option><option value="top">上面を開く</option><option value="bottom">底面を開く</option><option value="both">両方開く</option></select></label>
 <label>穴の配置<select id="honeycomb-layout"><option value="size">穴の幅で指定</option><option value="count">個数・段数から自動調整</option></select></label>
 <div id="honeycomb-count-fields" class="honeycomb-fields" hidden><label>横の最大個数<input id="honeycomb-columns" type="number" min="1" max="100" step="1" required></label><label>段数<input id="honeycomb-rows" type="number" min="1" max="100" step="1" required></label></div>
 <div class="honeycomb-fields"><label>六角穴の幅 (mm)<input id="honeycomb-cell" type="number" min="1" max="500" step="any" required></label><label>格子の幅 (mm)<input id="honeycomb-rib" type="number" min="0.4" max="100" step="any" required></label><label>側壁の厚み (mm)<input id="honeycomb-thickness" type="number" min="0.4" max="100" step="any" required></label><label>角の枠幅 (mm)<input id="honeycomb-border" type="number" min="0.4" max="500" step="any" required></label><label>上側の枠幅 (mm)<input id="honeycomb-topBorder" type="number" min="0.4" max="500" step="any" required></label><label>下側の枠幅 (mm)<input id="honeycomb-bottomBorder" type="number" min="0.4" max="500" step="any" required></label></div>
 <label>箱の高さ方向<select id="honeycomb-heightAxis"><option value="Z">Z方向に近い辺</option><option value="Y">Y方向に近い辺</option><option value="X">X方向に近い辺</option></select></label>
 <label class="honeycomb-check"><input id="honeycomb-hollow" type="checkbox">指定した側壁厚で内側を空洞にする</label>
 <p class="honeycomb-help">中空化ONでは、残す上面・底面を側壁と同じ厚みにします。OFFは指定した深さの加工です。個数指定は枠を保って穴の幅を自動計算します。箱の横個数は各面の最大値で、交互の段は1個少なくなります。円柱は1周の個数です。1工程240穴まで。</p>
 <p class="honeycomb-help">上下の枠幅は、側面に穴を開けずに残す高さです（壁厚以上を確保）。手動では水色の配置線だけを表示し、「精密確認」または「作成」で立体を計算します。</p>
 <p id="honeycomb-status" role="status" aria-live="polite"></p><p id="honeycomb-error" role="alert"></p>
 <button type="button" id="honeycomb-use-suggestion" hidden>収まる設定に変更</button>
 <button type="button" id="honeycomb-save-settings">設定を保存</button>
 <small class="honeycomb-help">数値・開口・配置の設定を、このブラウザーで次回使う初期値として保存します。</small>
 <p id="honeycomb-settings-status" role="status" aria-live="polite"></p>
 <div class="editor-actions"><button type="button" id="honeycomb-cancel">キャンセル</button><button type="button" id="honeycomb-precise" hidden>精密確認</button><button type="submit" id="honeycomb-apply" class="accent" disabled>作成</button></div></form>`;
 const style=document.createElement('style');style.textContent=`#honeycomb-dialog{position:fixed;left:auto;right:16px;top:80px;margin:0;width:min(400px,calc(100vw - 32px));max-height:calc(100vh - 104px);box-sizing:border-box;overflow:auto;z-index:1100}#honeycomb-dialog .dialog-heading h2{font-size:20px}#honeycomb-dialog p{line-height:1.6}#honeycomb-dialog label{display:flex;flex-direction:column;gap:6px;margin:12px 0}#honeycomb-dialog input,#honeycomb-dialog select{box-sizing:border-box;min-width:0;width:100%}#honeycomb-dialog .honeycomb-fields{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}#honeycomb-dialog .honeycomb-check{flex-direction:row;align-items:center}#honeycomb-dialog .honeycomb-check input{width:auto}#honeycomb-dialog .honeycomb-help{font-size:12px;color:#526c80}#honeycomb-error{color:#b44b21}#honeycomb-status{font-weight:600}#honeycomb-dialog .editor-actions{position:sticky;bottom:-20px;background:#f5fbff;padding:12px 0;margin-bottom:0}`;
 style.textContent+='#honeycomb-dialog{background:#f5fbff;color:#214e65;border:1px solid #86b0c9;border-radius:14px;box-shadow:0 12px 36px #102d4830}#honeycomb-dialog .dialog-heading{border-bottom:1px solid #ccdee8;padding-bottom:12px}#honeycomb-dialog label{color:#214e65}#honeycomb-close,#honeycomb-cancel{color:#f5fbff}';
 document.head.append(style);document.body.append(dialog);draggableDialog(dialog);
 style.textContent+='#honeycomb-precise,#honeycomb-use-suggestion,#honeycomb-save-settings{background:#e1f2f8;color:#16536b;border-color:#8ab3ca}#honeycomb-save-settings{width:100%;margin-top:8px}#honeycomb-settings-status{font-size:12px;color:#176c52}#honeycomb-settings-status[data-error=true]{color:#b44b21}#honeycomb-dialog .editor-actions{gap:8px}';
 const $=key=>dialog.querySelector('#honeycomb-'+key),fields=['cell','rib','thickness','border','topBorder','bottomBorder','hollow','scope','heightAxis','layout','columns','rows'];
 const preferenceKey='forma-honeycomb-preview-mode';try{const mode=localStorage.getItem(preferenceKey);$('preview-mode').value=['manual','auto'].includes(mode)?mode:loadHoneycombPreferences()?.previewMode||'auto';}catch{}
 const manual=()=>$('preview-mode').value==='manual';
 let original=null,history=null,editing=null,id=null,face=null,version=0,timer=null,cached=null,preview=null,hidden=null,applying=false,inflight=false,suggestion=null,source=null,sourceTarget=null,placementReady=false;
 const resultCache=new Map();let computations=0,cacheHits=0,inspections=0,dimensionCell=null;
 const appliedDimensions=installHoneycombAppliedDimensions(dialog,()=>({kind:source&&sourceTarget===$('target').value&&(source.kind==='cylinder'||source.heightAxis===$('heightAxis').value)?source.kind:null,cell:dimensionCell,error:$('error').textContent}));
 const stats=()=>host.dataset.honeycombPerformance=JSON.stringify({computations,cacheHits,inspections,inflight,mode:$('preview-mode').value});
 function clearPreview(){placementReady=false;dimensionCell=null;if(preview){preview.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});preview.removeFromParent();preview=null;}if(hidden){const [mesh,visible]=hidden;if(mesh.parent)mesh.visible=visible;hidden=null;}delete host.dataset.honeycombPreview;delete host.dataset.honeycombPlacement;appliedDimensions.update();}
 function close(){version++;clearTimeout(timer);worker.reset();inflight=false;cached=null;resultCache.clear();source=null;clearPreview();if(dialog.open)dialog.close();}
 dialog.addEventListener('close',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}});$('close').onclick=$('cancel').onclick=close;
 function formSettings(){
  const settings=Object.fromEntries(fields.map(key=>[key,$(key).type==='checkbox'?$(key).checked:$(key).type==='number'?Number($(key).value):$(key).value]));
  if(settings.layout==='size'){settings.columns=Number.isInteger(settings.columns)&&settings.columns>0?settings.columns:6;settings.rows=Number.isInteger(settings.rows)&&settings.rows>0?settings.rows:4;}
  else settings.cell=Number.isFinite(settings.cell)&&settings.cell>=1?settings.cell:10;
  settings.topOpen=['top','both'].includes($('caps').value);settings.bottomOpen=['bottom','both'].includes($('caps').value);
  honeycombSettings(settings);
  return settings;
 }
 function spec(){
  const settings=formSettings();
  if(settings.scope==='selected'&&(!face||face.bodyId!==$('target').value))throw Error('箱の側面を選択してから開いてください');
  return {type:'honeycomb',id,target:$('target').value,...settings,...(settings.scope==='selected'?{faceNormal:face.normal}:{} )};
 }
 $('save-settings').onclick=()=>{
  if(applying)return;
  try{if(!dialog.querySelector('form').checkValidity())throw Error('数値の入力範囲を確認してください');saveHoneycombPreferences(formSettings(),$('preview-mode').value);$('settings-status').dataset.error='false';$('settings-status').textContent='設定を保存しました。次回からこの設定で開きます。';}
  catch(error){$('settings-status').dataset.error='true';$('settings-status').textContent=error.message;}
 };
 function showMode(){const count=$('layout').value==='count';$('count-fields').hidden=!count;for(const key of ['columns','rows'])$(key).disabled=!count||applying;$('cell').closest('label').hidden=count;$('cell').disabled=count||applying;$('caps').disabled=!$('hollow').checked||applying;$('target').disabled=!!editing||applying;$('precise').hidden=!manual();$('precise').disabled=inflight||applying||!placementReady&&!cached;appliedDimensions.update();}
 function showError(error){$('status').textContent='';$('error').textContent=error.message;dimensionCell=null;appliedDimensions.update();suggestion=error.diagnostics?.honeycombSuggestion||null;$('use-suggestion').hidden=!suggestion;if(suggestion)$('use-suggestion').textContent='横 '+suggestion.columns+'個・'+suggestion.rows+'段に変更（'+suggestion.holeCount+'穴）';}
 $('use-suggestion').onclick=()=>{if(!suggestion)return;$('layout').value='count';$('columns').value=suggestion.columns;$('rows').value=suggestion.rows;change();};
 function placement(input){
  if(!source||sourceTarget!==input.target||source.kind==='box'&&input.heightAxis!==source.heightAxis)return;
  const plan=planHoneycomb(source,input),positions=[],origin=new THREE.Vector3(...source.origin),n=new THREE.Vector3(...source.n),u=new THREE.Vector3(...source.u),v=new THREE.Vector3(...source.v);
  const world=(x,y,z)=>origin.clone().addScaledVector(u,x).addScaledVector(v,y).addScaledVector(n,z);
  for(const grid of plan.grids)for(const [x,z]of grid.centers){
   const polygon=grid.hex.map(([dx,dz])=>{if(source.kind==='box')return world(...grid.at).addScaledVector(new THREE.Vector3(...grid.u),x+dx).addScaledVector(n,z+dz).addScaledVector(new THREE.Vector3(...grid.n),.025);
    const angle=x/grid.pitch*2*Math.PI/grid.columns,radial=u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(v,Math.sin(angle)),tangent=n.clone().cross(radial);
    return origin.clone().addScaledVector(n,z+dz).addScaledVector(radial,Math.sqrt(Math.max(0,source.radius**2-dx**2))+.025).addScaledVector(tangent,dx);
   });for(let i=0;i<6;i++)positions.push(...polygon[i].toArray(),...polygon[(i+1)%6].toArray());
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));preview=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x00a1ad,depthTest:true,depthWrite:false,transparent:true,opacity:.9}));preview.renderOrder=100;scene.add(preview);placementReady=true;dimensionCell=plan.cell;appliedDimensions.update();host.dataset.honeycombPlacement=JSON.stringify({holeCount:plan.holeCount,cell:plan.cell,topBorder:Math.max(input.topBorder,input.thickness),bottomBorder:Math.max(input.bottomBorder,input.thickness)});return plan;
 }
 function renderResult(input,result){
  clearPreview();const group=new THREE.Group();for(const output of result.outputs){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(output.vertices,3));geometry.setIndex(output.triangles);geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xd4ab63,roughness:.65,side:THREE.DoubleSide}));group.add(mesh);const lines=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,28),new THREE.LineBasicMaterial({color:0x725324}));group.add(lines);}
  preview=group;scene.add(group);const mesh=meshes.get(input.target);if(mesh){hidden=[mesh,mesh.visible];mesh.visible=false;}
  cached={input,result,signature:JSON.stringify(input)};const info=result.analysis.honeycomb;source={...info.source,heightAxis:input.heightAxis};sourceTarget=input.target;dimensionCell=info.cell;host.dataset.honeycombPreview=JSON.stringify(info);
  $('status').textContent='精密プレビュー ／ '+(info.kind==='cylinder'?'円柱・一周':'直方体')+' ／ 六角穴 '+info.holeCount+'個 ／ 横 '+info.columns+'・'+info.rows+'段 ／ 穴幅 '+Number(info.cell.toFixed(3))+' mm';$('apply').disabled=applying;showMode();stats();
 }
 async function refresh({forceExact=false}={}){
  clearTimeout(timer);const token=++version;cached=null;$('apply').disabled=true;$('error').textContent='';$('use-suggestion').hidden=true;
  if(!dialog.open)return;
  let input;try{if(!dialog.querySelector('form').checkValidity())throw Error('数値の入力範囲を確認してください');input=spec();if(source&&sourceTarget===input.target&&input.heightAxis===source.heightAxis)planHoneycomb(source,input);}catch(error){clearPreview();showError(error);return;}
  const signature=JSON.stringify(input);if(resultCache.has(signature)){cacheHits++;renderResult(input,resultCache.get(signature));return;}
  if(manual()&&!forceExact){
   try{
    if(!source||sourceTarget!==input.target||source.kind==='box'&&input.heightAxis!==source.heightAxis){
     inflight=true;inspections++;stats();showMode();$('status').textContent='対象の形と大きさを確認しています…';
     const result=await worker.run(honeycombTargetHistory(history,input.target),{type:'honeycombInspect',target:input.target,heightAxis:input.heightAxis});
     if(token!==version||!dialog.open||getFeatures()!==original)return;source={...result.info,heightAxis:input.heightAxis};sourceTarget=input.target;
    }
    clearPreview();const plan=placement(input);if(!plan)throw Error('対象の形状を確認できませんでした');
    $('status').textContent='配置プレビュー ／ '+plan.holeCount+'穴・穴幅 '+Number(plan.cell.toFixed(3))+' mm ／ 精密計算は手動';$('apply').disabled=applying;
   }catch(error){if(token===version&&dialog.open){clearPreview();showError(error);}}
   finally{if(token===version){inflight=false;showMode();stats();}}
   return;
  }
  $('status').textContent='プレビューを計算しています…';
  try{
   inflight=true;computations++;stats();showMode();const result=await worker.run(honeycombTargetHistory(history,input.target),input,{onProgress:p=>{if(token===version)$('status').textContent=p.stage;}});
   if(token!==version||!dialog.open||getFeatures()!==original)return;
   resultCache.set(signature,result);while(resultCache.size>3)resultCache.delete(resultCache.keys().next().value);renderResult(input,result);
  }catch(error){if(token===version&&dialog.open){clearPreview();showError(error);}}finally{if(token===version){inflight=false;showMode();stats();}}
 }
 function change(event){version++;if(inflight){worker.reset();inflight=false;}cached=null;clearPreview();$('apply').disabled=true;$('error').textContent='';$('use-suggestion').hidden=true;
  if(event?.target===$('preview-mode'))try{localStorage.setItem(preferenceKey,$('preview-mode').value);}catch{}
  if(event?.target===$('caps')&&$('caps').value!=='closed')$('hollow').checked=true;
  if(!$('hollow').checked)$('caps').value='closed';showMode();
  $('status').textContent='プレビューを更新します…';clearTimeout(timer);
  try{const input=spec();if(resultCache.has(JSON.stringify(input))){cacheHits++;renderResult(input,resultCache.get(JSON.stringify(input)));return;}placement(input);}catch(error){showError(error);return;}
  timer=setTimeout(refresh,manual()?0:500);stats();
 }
 for(const el of dialog.querySelectorAll('input,select'))el.addEventListener('input',change);
 $('precise').onclick=()=>{if(inflight||applying)return;refresh({forceExact:true});};
 dialog.querySelector('form').onsubmit=async event=>{
  event.preventDefault();if(applying||inflight)return;
  if(getFeatures()!==original){notify('モデルが変更されました。開き直してください');return;}
  applying=true;$('save-settings').disabled=true;for(const el of dialog.querySelectorAll('input,select,button[type=submit]'))el.disabled=true;
  try{
   if(!cached||cached.signature!==JSON.stringify(spec()))await refresh({forceExact:true});
   if(!cached||!dialog.open||getFeatures()!==original)return;
   const current=cached,token=version;await apply(current.input,current.result,editing,original,()=>dialog.open&&version===token);close();
  }
  catch(error){if(dialog.open)$('error').textContent=error.message;}
  finally{applying=false;$('save-settings').disabled=false;for(const el of dialog.querySelectorAll('input,select'))el.disabled=false;showMode();$('apply').disabled=!cached&&!(manual()&&placementReady);}
 };
 function open(target,feature=null,selectedFace=null){
  close();original=getFeatures();editing=feature;history=feature?original.slice(0,original.findIndex(f=>f.id===feature.id)):original;id=feature?.spec.id||feature?.id||crypto.randomUUID();face=selectedFace;
  if(feature?.spec.faceNormal)face={bodyId:feature.spec.target,normal:feature.spec.faceNormal};
  const ids=feature?[feature.spec.target]:[...meshes.keys()];$('target').replaceChildren(...ids.map(body=>new Option(bodyName(body),body)));if(ids.includes(target))$('target').value=target;
  if(!ids.length){notify('先に円柱か直方体を作成してください');return;}
  const saved=feature?null:loadHoneycombPreferences();$('settings-status').dataset.error='false';$('settings-status').textContent=saved?'保存した設定を使用しています。':'';$('save-settings').disabled=false;
  $('target').disabled=!!feature;const settings={...honeycombDefaults,...(feature?feature.spec:saved?.settings)};if(!feature&&settings.scope==='selected'&&(!face||face.bodyId!==$('target').value))settings.scope='all';if(settings.topBorder===undefined)settings.topBorder=settings.border;if(settings.bottomBorder===undefined)settings.bottomBorder=settings.border;for(const key of fields){if($(key).type==='checkbox')$(key).checked=settings[key];else $(key).value=settings[key];}
  $('caps').value=settings.topOpen?(settings.bottomOpen?'both':'top'):settings.bottomOpen?'bottom':'closed';computations=cacheHits=inspections=0;showMode();$('apply').textContent=feature?'変更を適用':'作成';$('error').textContent='';dialog.show();refresh();
 }
 return {open,close,get active(){return dialog.open;}};
}
