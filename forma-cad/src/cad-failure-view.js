import * as THREE from 'three';
import {moveMatrix} from './fillet-grid-reference.js';
export function createCadFailureView({scene,host,meshes,getFeatures,onChoose,onFeature}){
 const panel=document.createElement('section');panel.id='cad-failure-panel';panel.className='workspace-panel';panel.hidden=true;panel.innerHTML='<strong>加工できなかった箇所</strong><p id="cad-failure-message" role="status"></p><p id="cad-failure-location" class="hint"></p><div id="cad-failure-actions" class="workspace-actions"></div><button type="button" id="cad-failure-clear">表示を消す</button>';
 host.parentElement.append(panel);let overlay=null,original=null;
 const q=name=>panel.querySelector('#cad-failure-'+name);
 function clear(){if(overlay){overlay.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});overlay.removeFromParent();overlay=null;}panel.hidden=true;delete host.dataset.failedBodies;}
 function action(text,handler){const button=document.createElement('button');button.type='button';button.textContent=text;button.onclick=handler;q('actions').append(button);}
 function show(error,spec,features){
  if(error.code==='cancelled')return;clear();original=getFeatures();let operation=spec?.type==='preview'?spec.operation:spec;
  if(operation?.type==='extrusionBatch')operation={type:'extrusion',feature:operation.features?.[0],target:operation.features?.[0]?.target};
  if(operation?.type==='replay'&&error.featureId)operation=features.find(feature=>feature.id===error.featureId)?.spec||operation;
  const diagnostics=error.diagnostics,ids=[...new Set(diagnostics?.bodyIds||[operation?.target,...(operation?.targets||[]),operation?.other,...(operation?.others||[]),operation?.feature?.target].filter(Boolean))].filter(id=>meshes.has(id));
  overlay=new THREE.Group();
  if(diagnostics?.edges?.length){
   for(const edge of diagnostics.edges){const points=edge.points.map(p=>new THREE.Vector3(...p));if(Number.isInteger(error.featureIndex))for(const feature of features.slice(error.featureIndex+1)){const p=feature.spec;if(p?.type==='move'&&!p.copy&&p.moveMode!=='複製して移動'&&(p.target===edge.bodyId||p.targets?.includes(edge.bodyId)))for(const point of points)point.applyMatrix4(moveMatrix(p));}const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xef4438,depthTest:false}));line.renderOrder=45;overlay.add(line);}
   q('location').textContent=diagnostics.certainty==='faulty-contour'?'赤：計算エンジンが失敗を報告した辺。後続の形状変更がある場合は当時の形です。':'赤：今回指定した辺。原因の辺を1本に絞り込めなかったため、指定範囲を表示しています。';
  }else{
   for(const id of ids){const helper=new THREE.Box3Helper(new THREE.Box3().setFromObject(meshes.get(id)),0xef4438);helper.material.depthTest=false;helper.renderOrder=45;overlay.add(helper);}
   q('location').textContent=ids.length?'赤枠：確認が必要なボディ。局所的な原因は特定できていません。':'';
  }
  scene.add(overlay);host.dataset.failedBodies=JSON.stringify(ids);q('message').textContent=error.message;q('actions').replaceChildren();
  const type=error.failedOperation||operation?.type,input=document.querySelector(type==='fillet'?'#fillet-history-dialog[open] #fillet-history-radius, #tools-dialog[open] #cad-radius':type==='shell'?'#tools-dialog[open] #cad-thickness':type==='chamfer'?'#tools-dialog[open] #cad-distance':'#extrude-distance:not([hidden]) #viewport-depth');
  const sameFeature=!error.featureId||spec?.type!=='replay'||error.featureId===document.querySelector('#fillet-history-dialog[open]')?.dataset.featureId;
  if(sameFeature&&input&&Number.isFinite(Number(input.value))&&Number(input.value)!==0)action(['fillet','shell','chamfer'].includes(type)?'寸法を半分にしてプレビュー':'押し出しを1 mm延長してプレビュー',()=>{const value=Number(input.value);input.value=String(['fillet','shell','chamfer'].includes(type)?value/2:value+Math.sign(value));input.dispatchEvent(new Event('input',{bubbles:true}));});
  for(const id of ids)action('対象ボディを選択して拡大',()=>onChoose(id));
  if(error.featureId)action('失敗した工程を開く',()=>onFeature(error.featureId));
  const dialog=document.querySelector('#fillet-history-dialog[open],#tools-dialog[open]');if(dialog){panel.style.cssText='position:static;width:auto;max-height:200px;margin:10px 0;box-shadow:none';const actions=dialog.querySelector('.editor-actions');actions?actions.before(panel):dialog.append(panel);dialog.addEventListener('close',clear,{once:true});}else{host.parentElement.append(panel);panel.style.cssText='';}
  panel.hidden=false;
 }
 q('clear').onclick=clear;
 return {show,clear,sync(){if(!panel.hidden&&original!==getFeatures())clear();}};
}
