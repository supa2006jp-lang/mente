import * as THREE from 'three';
import {analyzePrintPreflight} from './print-preflight.js';
import {analyzePrintQuality} from './print-quality.js';
import {cadPosition} from './cad-coordinates.js';
import {draggablePanel} from './draggable-panel.js';
export function createPrintPreflightView({scene,host,meshes,getFeatures,getBodyName,canOpen,onOpen,onChoose,openDimensions,openThin,notify}){
 const panel=document.createElement('section');panel.id='print-preflight-panel';panel.className='workspace-panel';panel.hidden=true;
 panel.innerHTML='<label>ノズル径 (mm)<input id="preflight-nozzle" type="number" min="0.1" max="2" step="0.05" value="0.6"></label><div style="display:flex;gap:6px">'+['X','Y','Z'].map(axis=>'<label>造形範囲 '+axis+'<input id="preflight-limit-'+axis+'" type="number" min="0.1" max="10000" value="180" step="any"></label>').join('')+'</div><label><input id="preflight-thin" type="checkbox" checked>薄さも確認する</label><p id="preflight-status" role="status"></p><strong id="preflight-size"></strong><div id="preflight-issues"></div><p class="hint">表示中の形状を確認します。薄さ・接地判定は表示メッシュからの目安です。空洞の内壁を分離した面群として数える場合があります。</p><div class="workspace-actions"><button id="preflight-check" type="button">チェックする</button><button id="preflight-cancel" type="button" hidden>確認を中止</button><button id="preflight-dimensions" type="button">最大寸法を詳しく</button><button id="preflight-thickness" type="button">薄さを詳しく</button><button id="preflight-close" type="button">閉じる</button></div>';
 host.parentElement.append(panel);draggablePanel(panel,'印刷前チェック');
 const button=document.createElement('button');button.type='button';button.id='print-preflight-tool';button.textContent='✓ 印刷前チェック';button.setAttribute('aria-pressed','false');document.querySelector('.navigation').append(button);
 const q=name=>panel.querySelector('#preflight-'+name);let revision=0,original=null,overlay=null,busy=false,visibility='';
 function clear(){if(overlay){overlay.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});overlay.removeFromParent();overlay=null;}delete host.dataset.printPreflight;}
 function stop(){revision++;busy=false;q('cancel').hidden=true;q('check').disabled=false;}
 function close(){stop();clear();panel.hidden=true;button.setAttribute('aria-pressed','false');}
 function mark(issue){
  clear();overlay=new THREE.Group();const material=new THREE.LineBasicMaterial({color:0xe54235,depthTest:false});
  if(issue.segments?.length){const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(issue.segments,3));overlay.add(new THREE.LineSegments(geometry,material));}
  else if(issue.surface?.length){material.dispose();const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(issue.surface,3));overlay.add(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xe54235,side:THREE.DoubleSide,transparent:true,opacity:.75,depthTest:false})));}
  else {material.dispose();const mesh=meshes.get(issue.bodyId);if(mesh){const box=issue.bounds?new THREE.Box3(new THREE.Vector3(...issue.bounds.min),new THREE.Vector3(...issue.bounds.max)):new THREE.Box3().setFromObject(mesh);const helper=new THREE.Box3Helper(box,0xe54235);helper.material.depthTest=false;overlay.add(helper);}}
  overlay.renderOrder=40;overlay.traverse(object=>object.renderOrder=40);scene.add(overlay);host.dataset.printPreflight=issue.bodyId;onChoose(issue.bodyId);
 }
 async function check(){
  stop();clear();const request=revision;original=getFeatures();visibility=[...meshes].filter(([,mesh])=>mesh.visible).map(([id])=>id).join('|');busy=true;q('check').disabled=true;q('cancel').hidden=false;q('issues').replaceChildren();q('size').textContent='';q('status').textContent='メッシュを確認しています…';
  const current=()=>request===revision&&!panel.hidden&&getFeatures()===original;
  try{
   const outputs=[];for(const [id,mesh] of meshes){if(!mesh.visible)continue;mesh.updateMatrixWorld(true);const p=cadPosition(mesh.geometry),vertices=[],point=new THREE.Vector3();for(let i=0;i<p.count;i++)vertices.push(...point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).toArray());outputs.push({id,vertices,triangles:mesh.geometry.index?Array.from(mesh.geometry.index.array):Array.from({length:p.count},(_,i)=>i)});}
   if(!outputs.length)throw Error('表示中のボディがありません');
   const capacity=['X','Y','Z'].map(axis=>q('limit-'+axis).value.trim()?Number(q('limit-'+axis).value):NaN),result=await analyzePrintPreflight(outputs,{capacity,shouldCancel:()=>!current(),onProgress:p=>{if(current())q('status').textContent=p.stage;}});
   if(q('thin').checked){q('status').textContent='薄い壁と模様を確認しています…';const quality=await analyzePrintQuality(outputs,{nozzle:Number(q('nozzle').value),shouldCancel:()=>!current()});for(const body of quality.outputs){if(body.red.length||body.yellow.length)result.issues.push({bodyId:body.id,type:'thin',severity:body.red.length?'error':'warning',message:'ノズル径未満 '+body.red.length/9+' 面 / ノズル径の2倍未満 '+body.yellow.length/9+' 面',surface:body.red.length?body.red:body.yellow});}}
   if(!current())return;
   q('size').textContent='全体 '+result.dimensions.size.map(v=>Number(v.toFixed(2))).join(' × ')+' mm ／ '+(result.dimensions.fits?'造形範囲内':'全体配置が造形範囲を超えます');
   q('status').textContent=result.bodies+' ボディを確認：'+result.issues.length+' 件の確認箇所';
   if(!result.issues.length)q('issues').textContent='今回のチェック項目で問題は見つかりませんでした。';
   for(const issue of result.issues){const row=document.createElement('button');row.type='button';row.dataset.bodyId=issue.bodyId;row.dataset.issueType=issue.type;row.style.cssText='display:block;width:100%;white-space:normal;text-align:left;margin:7px 0;padding:9px;border-color:'+(issue.severity==='error'?'#d84336':'#b88520');row.textContent=getBodyName(issue.bodyId)+'：'+issue.message+'（選択して拡大）';row.onclick=()=>mark(issue);q('issues').append(row);}
  }catch(error){if(current()&&error.name!=='AbortError')q('status').textContent=error.message;}
  finally{if(request===revision){busy=false;q('check').disabled=false;q('cancel').hidden=true;}}
 }
 function open(){if(!canOpen()){notify('編集中の操作を終了してから印刷前チェックを開いてください');return;}onOpen?.();panel.hidden=false;button.setAttribute('aria-pressed','true');check();}
 button.onclick=()=>panel.hidden?open():close();q('check').onclick=check;q('close').onclick=close;q('cancel').onclick=()=>{stop();q('status').textContent='確認を中止しました。モデルは変更していません。';};q('dimensions').onclick=()=>{close();openDimensions();};q('thickness').onclick=()=>{close();openThin();};
 for(const input of panel.querySelectorAll('input'))input.addEventListener('input',()=>{stop();clear();q('issues').replaceChildren();q('size').textContent='';q('status').textContent='設定が変わりました。「チェックする」で再確認してください。';});
 return {open,close,sync(){if(!panel.hidden&&(original!==getFeatures()||visibility!==[...meshes].filter(([,mesh])=>mesh.visible).map(([id])=>id).join('|')||!canOpen()))close();}};
}
