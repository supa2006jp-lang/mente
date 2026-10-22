import * as THREE from 'three';
import {KernelClient} from './kernel-client.js';
import {draggablePanel} from './draggable-panel.js';

const labels={'invalid-solid':'正常でないソリッド','unexpected-volume':'移動による予期しない体積変化',disconnected:'分離した塊','small-component':'微小・極端に細い部品','short-edge':'極端に短い辺','narrow-face':'細い面（幅の目安）','micro-gap':'微小な隙間'};
const fmt=n=>Number(n.toFixed(8)).toLocaleString(undefined,{maximumFractionDigits:8});
export function createGeometryHealthView(context){
 const {scene,host,meshes,getFeatures,getBodyName,canOpen,notify}=context,kernel=new KernelClient();
 const panel=document.createElement('section');panel.id='geometry-health-panel';panel.className='workspace-panel';panel.hidden=true;panel.setAttribute('aria-label','形状の検査');
 panel.innerHTML='<p class="hint">微小な面・辺、細い部品、分離、狭い隙間の確認候補です。意図した形状の可能性もあります。修正候補はプレビューを確認してから適用します。</p><label>詳細検査で確認する寸法（mm未満）<input id="geometry-health-threshold" type="number" min="0.000001" max="1" step="any" value="0.01"></label><div class="workspace-actions"><button type="button" id="geometry-health-check">表示中の全ボディを詳しく検査</button><button type="button" id="geometry-health-cancel" hidden>検査を中止</button></div><p id="geometry-health-status" role="status" aria-live="polite"></p><label><input type="checkbox" id="geometry-health-new-only">今回新しく発生した候補だけ表示</label><div id="geometry-health-results"></div><div id="geometry-health-repair" hidden><strong>接触位置への移動プレビュー</strong><p id="geometry-health-repair-status" role="status"></p><p class="hint">水色：移動後 ／ 橙の線：移動前。ボディ全体を移動し、結合や穴埋めはしません。</p><button type="button" id="geometry-health-repair-apply" disabled>この移動を確定</button><button type="button" id="geometry-health-repair-cancel">修正を取り消す</button></div><button type="button" id="geometry-health-close">閉じる</button>';
 host.parentElement.append(panel);draggablePanel(panel,'形状の検査');
 const button=document.createElement('button');button.id='geometry-health-tool';button.type='button';button.textContent='◇ 形状の検査';button.setAttribute('aria-pressed','false');document.querySelector('.navigation').append(button);
 const q=id=>panel.querySelector('#geometry-health-'+id);let current=null,report=null,revision=0,overlay=null,busy=false,prepared=null,hiddenSource=null;
 function clearOverlay(){prepared=null;q('repair').hidden=true;q('repair-apply').disabled=true;if(hiddenSource){hiddenSource.mesh.visible=hiddenSource.visible;hiddenSource=null;}if(overlay){overlay.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});overlay.removeFromParent();overlay=null;}delete host.dataset.geometryHealthHighlight;delete host.dataset.geometryHealthRepair;}
 function close(){revision++;kernel.reset();busy=false;panel.hidden=true;q('cancel').hidden=true;q('check').disabled=false;button.setAttribute('aria-pressed','false');clearOverlay();}
 function show(finding){clearOverlay();let box;
  if(finding.bounds?.length===2)box=new THREE.Box3(new THREE.Vector3(...finding.bounds[0]),new THREE.Vector3(...finding.bounds[1]));else if(meshes.has(finding.bodyId))box=new THREE.Box3().setFromObject(meshes.get(finding.bodyId));if(!box||box.isEmpty())return;
  const padding=Math.max(.05,box.getSize(new THREE.Vector3()).length()*.005);box.expandByScalar(padding);overlay=new THREE.Group();const helper=new THREE.Box3Helper(box,finding.severity==='error'?0xe04f40:0xe5a020);helper.material.depthTest=false;helper.renderOrder=100;overlay.add(helper);scene.add(overlay);host.dataset.geometryHealthHighlight=JSON.stringify(finding);
 }
 function render(){
  const list=q('results');list.replaceChildren();let count=0;
  for(const row of report?.rows||[]){if(!meshes.has(row.id))continue;
   const heading=document.createElement('strong');heading.textContent=getBodyName(row.id);list.append(heading);
   const metrics=document.createElement('p');metrics.className='hint';metrics.textContent='体積 '+(row.before?fmt(row.before.volume)+' → ':'')+fmt(row.after.volume)+' mm³ ／ 塊 '+(row.before?row.before.solids+' → ':'')+row.after.solids+' 個 ／ 検査寸法 '+fmt(row.threshold)+' mm未満';list.append(metrics);
   for(const finding of [...row.findings].sort((a,b)=>({new:0,unknown:1,existing:2}[a.change]??1)-({new:0,unknown:1,existing:2}[b.change]??1))){if(q('new-only').checked&&finding.change!=='new')continue;count++;const b=document.createElement('button');b.type='button';b.className='geometry-health-finding';b.dataset.code=finding.code;b.dataset.change=finding.change||'uncompared';b.textContent=({new:'【今回新しく発生】',existing:'【加工前から存在】',unknown:'【比較未完了】'}[finding.change]||'【比較なし】')+(labels[finding.code]||finding.code)+(Number.isFinite(finding.size)?'：'+fmt(finding.size)+' mm':'')+(finding.count?'：'+finding.count+' 個':'')+(finding.otherId?' ／ '+getBodyName(finding.otherId):'')+' — 場所を表示';b.onclick=()=>show(finding);list.append(b);
    if(finding.code==='micro-gap'&&finding.otherId&&meshes.has(finding.otherId)){
     const actions=document.createElement('div');actions.className='workspace-actions';
     for(const [target,other]of [[row.id,finding.otherId],[finding.otherId,row.id]]){const repair=document.createElement('button');repair.type='button';repair.dataset.gapRepair=target;repair.textContent=getBodyName(target)+'を相手に接触させる（プレビュー）';repair.onclick=()=>previewRepair(finding,row,target,other);actions.append(repair);}list.append(actions);
    }
   }
  }
  const changes=(report?.rows||[]).flatMap(r=>r.findings),totals={new:changes.filter(f=>f.change==='new').length,existing:changes.filter(f=>f.change==='existing').length,unknown:changes.filter(f=>f.change==='unknown').length};const summary=report?.rows?.some(r=>r.comparison)?'今回新規 '+totals.new+' 件 ／ 加工前から '+totals.existing+' 件 ／ 比較未完了 '+totals.unknown+' 件。 ':'';const partial=report?.partial||report?.rows?.some(r=>r.partial);q('status').textContent=report?summary+(partial?'検査上限に達したため一部のみ確認しました。未検査の箇所があります。':count?'確認候補 '+count+' 件。ボタンを押すと場所を枠で表示します。':q('new-only').checked?'今回新しく発生したと確認できた候補はありません。':'指定した検査条件で確認候補は見つかりませんでした。'):'加工後の簡易検査結果はまだありません。「詳しく検査」を実行できます。';host.dataset.geometryHealth=JSON.stringify({findings:count,partial:!!partial});
 }
 function open(){if(!canOpen()){notify('編集中の操作を終了してから形状を検査してください');return;}context.onOpen?.();panel.hidden=false;button.setAttribute('aria-pressed','true');render();}
 button.onclick=()=>panel.hidden?open():close();q('close').onclick=close;q('new-only').onchange=()=>{clearOverlay();render();};
 async function previewRepair(finding,row,target,other){
  if(busy||!canOpen())return;const original=getFeatures(),request=++revision;clearOverlay();q('repair').hidden=false;q('repair-status').textContent='精密な接触位置と食い込みを確認しています…';busy=true;q('cancel').hidden=false;q('check').disabled=true;
  try{const result=await kernel.run(original,{type:'geometryGapRepair',id:crypto.randomUUID(),target,other,expectedGap:finding.size,threshold:row.threshold});
   if(request!==revision||getFeatures()!==original||panel.hidden)return;
   overlay=new THREE.Group();for(const output of result.result.outputs){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(output.vertices,3));g.setIndex(output.triangles);g.computeVertexNormals();overlay.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x38bbd1,transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide})));}
   const source=meshes.get(target);if(source){hiddenSource={mesh:source,visible:source.visible};const edges=new THREE.LineSegments(new THREE.EdgesGeometry(source.geometry,25),new THREE.LineBasicMaterial({color:0xe49b26,depthTest:false}));source.updateWorldMatrix(true,false);edges.applyMatrix4(source.matrixWorld);overlay.add(edges);source.visible=false;}
   scene.add(overlay);prepared={original,...result};q('repair-apply').disabled=false;q('repair-status').textContent=getBodyName(target)+' → '+getBodyName(other)+' ／ 隙間 '+fmt(result.beforeGap)+' mm → 接触。移動量 '+fmt(Math.hypot(...result.translation))+' mm';host.dataset.geometryHealthRepair=JSON.stringify({target,other,translation:result.translation});
  }catch(error){if(request===revision)q('repair-status').textContent=error.message;}
  finally{if(request===revision){busy=false;q('cancel').hidden=true;q('check').disabled=false;}}
 }
 q('repair-cancel').onclick=()=>{revision++;kernel.reset();busy=false;q('cancel').hidden=true;q('check').disabled=false;clearOverlay();};
 q('repair-apply').onclick=()=>{const ready=prepared;if(!ready||busy||getFeatures()!==ready.original||!canOpen())return;try{clearOverlay();context.applyHealthOperation(ready.original,ready.spec,ready.result,'微小な隙間を接触位置まで移動');close();notify('接触位置まで移動しました。ボディは個別に保持しています');}catch(error){q('status').textContent=error.message;}};
 q('cancel').onclick=()=>{revision++;kernel.reset();busy=false;q('cancel').hidden=true;q('check').disabled=false;clearOverlay();q('status').textContent='検査を中止しました。形状は変更していません';};
 q('check').onclick=async()=>{
  if(busy)return;
  const threshold=Number(q('threshold').value);if(!q('threshold').value||!Number.isFinite(threshold)||threshold<1e-6||threshold>1){q('status').textContent='検査寸法は0.000001〜1 mmで指定してください';return;}
  const original=getFeatures(),targets=[...meshes].filter(([,m])=>m.visible).map(([id])=>id),request=++revision;if(!targets.length){q('status').textContent='表示中のボディがありません';return;}
  busy=true;q('cancel').hidden=false;q('check').disabled=true;clearOverlay();q('status').textContent='精密なCAD形状を検査しています…';
  try{const result=await kernel.run(original,{type:'geometryHealth',targets,threshold},{onProgress:p=>{if(request===revision)q('status').textContent=p.stage;}});if(request!==revision||getFeatures()!==original||panel.hidden)return;report=result;render();}
  catch(error){if(request===revision)q('status').textContent=error.message;}
  finally{if(request===revision){busy=false;q('cancel').hidden=true;q('check').disabled=false;}}
 };
 const style=document.createElement('style');style.textContent='#geometry-health-panel input[type=checkbox]{width:auto;display:inline;margin-right:6px}#geometry-health-results strong{display:block;margin-top:12px}#geometry-health-results .geometry-health-finding{display:block;width:100%;margin:5px 0;text-align:left;white-space:normal;overflow-wrap:anywhere;border-left:4px solid #dfaa31}#geometry-health-results [data-change=new]{border-left-color:#df5b29;background:#fff0db}#geometry-health-results [data-change=existing]{border-left-color:#8b9da8}#geometry-health-repair{margin-top:12px;border:2px solid #168eaa;padding:9px}#geometry-health-repair-apply{background:#087e9e;color:white}#geometry-health-tool[data-warnings=true]{background:#fff0c9;color:#694500;border-color:#c58a19}';document.head.append(style);
 return {open,close,sync(){
  button.disabled=!meshes.size||!canOpen();if(!panel.hidden&&!canOpen())close();const features=getFeatures();if(features===current)return;current=features;if(busy)close();clearOverlay();
  const f=features.findLast(f=>(f.cadResult?.analysis||f.analysis)?.geometryHealth);report=f?(f.cadResult?.analysis||f.analysis).geometryHealth:null;
  const count=(report?.rows||[]).filter(r=>meshes.has(r.id)).reduce((n,r)=>n+r.findings.length,0);const partial=report?.partial||report?.rows?.some(r=>r.partial);button.dataset.warnings=String(count>0||!!partial);button.textContent='◇ 形状の検査'+(count?'（'+count+'）':partial?'（未検査あり）':'');button.title=count?'加工後の形状に確認候補があります。小さい形状は削除していません':partial?'検査上限に達した箇所があります。詳しい検査で確認してください':'微小な突起・隙間・分離を確認します';if(!panel.hidden)render();
 }};
}
