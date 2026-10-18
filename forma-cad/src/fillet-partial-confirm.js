import * as THREE from 'three';
import {draggableDialog} from './draggable-dialog.js';
export function acceptedFilletSpec(spec,partial){
 if(!partial?.edges?.length)throw Error('適用できるフィレットの辺がありません');
 const next=structuredClone(spec);for(const key of ['partialMode','targets','face','edgePoint'])delete next[key];next.edges=structuredClone(partial.edges);next.target=next.edges[0].bodyId;return next;
}
let dialog=null;
function confirmationDialog(){
 if(dialog)return dialog;dialog=document.createElement('dialog');dialog.id='partial-fillet-confirm';dialog.setAttribute('aria-labelledby','partial-fillet-title');dialog.style.cssText='position:fixed;margin:0;padding:22px;width:min(420px,calc(100vw - 32px));box-sizing:border-box;background:#142232;color:#e2edf5;border:1px solid #5a7b92;border-radius:12px;z-index:200;max-height:85vh;overflow:auto';
 dialog.innerHTML='<div class="dialog-heading"><h2 id="partial-fillet-title">可能な辺だけフィレット</h2></div><p data-summary></p><p data-budget></p><p>緑：加工後のプレビュー<br>赤：今回は掛けずに残す辺</p><p>指定半径のまま、検証できた辺だけに適用しますか？ 視点を回して確認できます。</p><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" data-cancel>キャンセル</button><button type="button" data-accept>可能な辺だけ適用</button></div>';document.body.append(dialog);draggableDialog(dialog);return dialog;
}
export async function confirmPartialFillet(result,spec,{scene,meshes,host,toolsDialog,fields,isCurrent}){
 const partial=result.analysis?.partialFillet;if(!partial)return true;
 const prompt=confirmationDialog(),group=new THREE.Group(),hidden=[];let finish;
 const answer=new Promise(resolve=>{finish=resolve;});const cancel=()=>finish(false),accept=()=>finish(isCurrent());
 try{
  for(const output of result.outputs){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(output.vertices,3));geometry.setIndex(output.triangles);geometry.computeVertexNormals();group.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x54ba83,roughness:.7,side:THREE.DoubleSide})));const original=meshes.get(output.id);if(original){hidden.push([original,original.visible]);original.visible=false;}}
  for(const edge of partial.rejected){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(edge.points.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color:0xf45a48,depthTest:false}));line.renderOrder=45;group.add(line);}
  scene.add(group);host.dataset.partialFilletPreview=JSON.stringify({accepted:partial.accepted,skipped:partial.skipped,untested:partial.untested,radius:spec.radius});
  prompt.querySelector('[data-summary]').textContent='半径 R'+spec.radius+' mm ／ 適用できる辺：'+partial.accepted+'本 ／ 残す辺：'+(partial.skipped+partial.untested)+'本';prompt.querySelector('[data-budget]').textContent=partial.untested?(partial.limitReason==='time'?'検査の時間上限':'検査上限')+'に達した '+partial.untested+'本は、未確認のため残します。必要な辺を選んで追加できます。':'';
  prompt.querySelector('[data-cancel]').addEventListener('click',cancel);prompt.querySelector('[data-accept]').addEventListener('click',accept);prompt.addEventListener('cancel',cancel);prompt.addEventListener('close',cancel);toolsDialog.addEventListener('close',cancel);toolsDialog.addEventListener('change',cancel);fields.addEventListener('input',cancel);prompt.show();return await answer;
 }finally{
  prompt.querySelector('[data-cancel]').removeEventListener('click',cancel);prompt.querySelector('[data-accept]').removeEventListener('click',accept);prompt.removeEventListener('cancel',cancel);prompt.removeEventListener('close',cancel);toolsDialog.removeEventListener('close',cancel);toolsDialog.removeEventListener('change',cancel);fields.removeEventListener('input',cancel);prompt.close();group.removeFromParent();group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});for(const [object,visible]of hidden)object.visible=visible;delete host.dataset.partialFilletPreview;
 }
}
