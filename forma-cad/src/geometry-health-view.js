import * as THREE from 'three';
import {KernelClient} from './kernel-client.js';
import {draggablePanel} from './draggable-panel.js';

const labels={'invalid-solid':'正常でないソリッド','unexpected-volume':'移動による予期しない体積変化',disconnected:'分離した塊','small-component':'微小・極端に細い部品','short-edge':'極端に短い辺','narrow-face':'細い面（幅の目安）','micro-gap':'微小な隙間'};
const fmt=n=>Number(n.toFixed(8)).toLocaleString(undefined,{maximumFractionDigits:8});
export function createGeometryHealthView(context){
 const {scene,host,meshes,getFeatures,getBodyName,canOpen,notify}=context,kernel=new KernelClient();
 const panel=document.createElement('section');panel.id='geometry-health-panel';panel.className='workspace-panel';panel.hidden=true;panel.setAttribute('aria-label','形状の検査');
 panel.innerHTML='<p class="hint">微小な面・辺、細い部品、分離、狭い隙間の確認候補です。意図した形状の可能性もあります。自動削除・自動修正はしません。</p><label>詳細検査で確認する寸法（mm未満）<input id="geometry-health-threshold" type="number" min="0.000001" max="1" step="any" value="0.01"></label><div class="workspace-actions"><button type="button" id="geometry-health-check">表示中の全ボディを詳しく検査</button><button type="button" id="geometry-health-cancel" hidden>検査を中止</button></div><p id="geometry-health-status" role="status" aria-live="polite"></p><div id="geometry-health-results"></div><button type="button" id="geometry-health-close">閉じる</button>';
 host.parentElement.append(panel);draggablePanel(panel,'形状の検査');
 const button=document.createElement('button');button.id='geometry-health-tool';button.type='button';button.textContent='◇ 形状の検査';button.setAttribute('aria-pressed','false');document.querySelector('.navigation').append(button);
 const q=id=>panel.querySelector('#geometry-health-'+id);let current=null,report=null,revision=0,overlay=null,busy=false;
 function clearOverlay(){if(overlay){overlay.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});overlay.removeFromParent();overlay=null;}delete host.dataset.geometryHealthHighlight;}
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
   for(const finding of row.findings){count++;const b=document.createElement('button');b.type='button';b.className='geometry-health-finding';b.dataset.code=finding.code;b.textContent=(labels[finding.code]||finding.code)+(Number.isFinite(finding.size)?'：'+fmt(finding.size)+' mm':'')+(finding.count?'：'+finding.count+' 個':'')+(finding.otherId?' ／ '+getBodyName(finding.otherId):'')+' — 場所を表示';b.onclick=()=>show(finding);list.append(b);}
  }
  const partial=report?.partial||report?.rows?.some(r=>r.partial);q('status').textContent=report?(partial?'検査上限に達したため一部のみ確認しました。未検査の箇所があります。':count?'確認候補 '+count+' 件。ボタンを押すと場所を枠で表示します。':'指定した検査条件で確認候補は見つかりませんでした。'):'加工後の簡易検査結果はまだありません。「詳しく検査」を実行できます。';host.dataset.geometryHealth=JSON.stringify({findings:count,partial:!!partial});
 }
 function open(){if(!canOpen()){notify('編集中の操作を終了してから形状を検査してください');return;}context.onOpen?.();panel.hidden=false;button.setAttribute('aria-pressed','true');render();}
 button.onclick=()=>panel.hidden?open():close();q('close').onclick=close;
 q('cancel').onclick=()=>{revision++;kernel.reset();busy=false;q('cancel').hidden=true;q('check').disabled=false;q('status').textContent='検査を中止しました。形状は変更していません';};
 q('check').onclick=async()=>{
  const threshold=Number(q('threshold').value);if(!q('threshold').value||!Number.isFinite(threshold)||threshold<1e-6||threshold>1){q('status').textContent='検査寸法は0.000001〜1 mmで指定してください';return;}
  const original=getFeatures(),targets=[...meshes].filter(([,m])=>m.visible).map(([id])=>id),request=++revision;if(!targets.length){q('status').textContent='表示中のボディがありません';return;}
  busy=true;q('cancel').hidden=false;q('check').disabled=true;clearOverlay();q('status').textContent='精密なCAD形状を検査しています…';
  try{const result=await kernel.run(original,{type:'geometryHealth',targets,threshold},{onProgress:p=>{if(request===revision)q('status').textContent=p.stage;}});if(request!==revision||getFeatures()!==original||panel.hidden)return;report=result;render();}
  catch(error){if(request===revision)q('status').textContent=error.message;}
  finally{if(request===revision){busy=false;q('cancel').hidden=true;q('check').disabled=false;}}
 };
 const style=document.createElement('style');style.textContent='#geometry-health-results strong{display:block;margin-top:12px}#geometry-health-results .geometry-health-finding{display:block;width:100%;margin:5px 0;text-align:left;border-left:4px solid #dfaa31}#geometry-health-tool[data-warnings=true]{background:#fff0c9;color:#694500;border-color:#c58a19}';document.head.append(style);
 return {open,close,sync(){
  button.disabled=!meshes.size||!canOpen();const features=getFeatures();if(features===current)return;current=features;if(busy)close();clearOverlay();
  const f=features.findLast(f=>(f.cadResult?.analysis||f.analysis)?.geometryHealth);report=f?(f.cadResult?.analysis||f.analysis).geometryHealth:null;
  const count=(report?.rows||[]).filter(r=>meshes.has(r.id)).reduce((n,r)=>n+r.findings.length,0);const partial=report?.partial||report?.rows?.some(r=>r.partial);button.dataset.warnings=String(count>0||!!partial);button.textContent='◇ 形状の検査'+(count?'（'+count+'）':partial?'（未検査あり）':'');button.title=count?'加工後の形状に確認候補があります。小さい形状は削除していません':partial?'検査上限に達した箇所があります。詳しい検査で確認してください':'微小な突起・隙間・分離を確認します';if(!panel.hidden)render();
 }};
}
