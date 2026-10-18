import * as THREE from 'three';
import {patternTransforms} from './patterns.js';
import {betweenPattern} from './rectangular-pattern.js';
export function installPatternPreview({scene,host,getMesh,getSpec,fitPreview,getExactPreview=()=>null}){
 const dialog=document.getElementById('tools-dialog'),fields=document.getElementById('cad-fields'),command=document.getElementById('cad-command');let group=null,hidden=null;
 function clear(){if(hidden){hidden.mesh.visible=hidden.visible;hidden=null;}if(group){scene.remove(group);group.traverse(o=>{if(o.material)o.material.dispose();});group=null;}delete host.dataset.patternPreview;}
 function circularPanel(){
  let panel=document.getElementById('pattern-preview-panel');if(panel)return panel;
  panel=document.createElement('section');panel.id='pattern-preview-panel';panel.style.cssText='border-top:1px solid #7593aa;padding-top:8px';panel.innerHTML='<p id="pattern-preview-status" role="status"></p><button type="button" id="pattern-preview-fit">プレビュー全体を表示</button>';fields.append(panel);
  panel.querySelector('button').onclick=()=>{if(!group&&!getExactPreview())update();const preview=group||getExactPreview();if(!preview)return;try{const source=getMesh(getSpec().target),box=new THREE.Box3().setFromObject(preview);if(source)box.expandByObject(source);if(!box.isEmpty())fitPreview?.(box);}catch{}};return panel;
 }
 function update(){
  clear();if(!dialog.open||!['rectangular','circular'].includes(command.value))return;
  const status=command.value==='circular'?circularPanel().querySelector('p'):null;if(status)status.textContent='配置プレビューを準備しています…';
  if([...fields.querySelectorAll('input')].some(i=>!i.disabled&&(i.value===''||!i.checkValidity()))){if(status)status.textContent='個数・角度を入力するとプレビューを表示します';return;}
  try{const spec=getSpec(),matrices=patternTransforms(spec),mesh=getMesh(spec.target);if(!mesh){if(status)status.textContent='対象のボディまたはスケッチを選択してください';return;}
   if(spec.type==='circular'&&['新規かつ切り取り','切り取りのみ'].includes(spec.operation)){if(status)status.textContent=spec.operation==='切り取りのみ'?'穴・くぼみの切り取り結果を計算しています。実体の複製はしません。':'穴を埋めない加工後の形状を計算しています。穴の空間は切り取り専用で、新規ボディにはしません。';return;}
   if(betweenPattern(spec)){hidden={mesh,visible:mesh.visible};mesh.visible=false;}
   group=new THREE.Group();for(const matrix of matrices){const copy=mesh.clone(true);copy.visible=true;copy.applyMatrix4(matrix);copy.traverse(o=>{if(o.material){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=o.isMesh?.45:.8;o.material.depthWrite=false;o.material.color.set(0x438fcb);}});group.add(copy);}
   scene.add(group);if(status)status.textContent='水色：作成予定のコピー '+matrices.length+'個 ／ 原型を含む '+spec.count+'個。確定前のプレビューです。';host.dataset.patternPreview=JSON.stringify(matrices.map(m=>new THREE.Vector3().setFromMatrixPosition(m).toArray()));
  }catch(error){clear();if(status)status.textContent=error.message;}
 }
 fields.addEventListener('input',update);fields.addEventListener('change',update);command.addEventListener('change',update);dialog.addEventListener('close',clear);
 new MutationObserver(update).observe(dialog,{attributes:true,attributeFilter:['open']});new MutationObserver(update).observe(fields,{childList:true});
 return {update,clear,get group(){return group||getExactPreview();}};
}
