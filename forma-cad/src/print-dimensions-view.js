import * as THREE from 'three';
import {printDimensions} from './print-dimensions.js';
import {draggablePanel} from './draggable-panel.js';

export function createPrintDimensionsView({scene,camera,host,meshes,kernel,getFeatures,getSelection,getBodyName,canOpen,getExploded=()=>false,onOpen,notify}){
 const panel=document.createElement('div');panel.id='print-dimensions-panel';panel.className='print-dimensions-panel';panel.hidden=true;
 panel.innerHTML='<label>確認するソリッド<select id="print-dimensions-target"></select></label><strong id="print-dimensions-total"></strong><p id="print-dimensions-status" role="status" aria-live="polite"></p><details id="print-dimensions-printer"><summary id="print-dimensions-capacity">造形範囲 180 × 180 × 180 mm（変更）</summary><fieldset><legend>プリンターの造形範囲（mm）</legend><div class="print-dimensions-limits">'+['X','Y','Z'].map(axis=>'<label>'+axis+'<input id="print-dimensions-limit-'+axis.toLowerCase()+'" type="number" min="0.001" max="10000" step="any" value="180" required></label>').join('')+'</div></fieldset></details><table class="print-dimensions-table"><thead><tr><th>軸</th><th>最大寸法</th><th>余裕／超過</th></tr></thead><tbody id="print-dimensions-axes"></tbody></table><p class="print-dimensions-hint">現在の向きでの外形寸法です。複数ボディは間の距離も含めます。非表示のボディは含めません。</p><details><summary>各ボディの寸法</summary><div id="print-dimensions-bodies"></div></details><div class="editor-actions"><button id="print-dimensions-refresh" type="button">再計測</button><button id="print-dimensions-close" type="button">閉じる</button></div>';
 host.parentElement.append(panel);draggablePanel(panel,'最大寸法・造形範囲の確認');
 const button=document.createElement('button');button.id='print-dimensions-tool';button.type='button';button.textContent='↔ 最大寸法';button.title='ソリッドのXYZの最大寸法と、プリンターの造形範囲への収まりを確認';button.setAttribute('aria-pressed','false');document.querySelector('.navigation').append(button);
 const labels=document.createElement('div');labels.id='print-dimensions-labels';labels.hidden=true;labels.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:9';host.append(labels);
 const labelNodes=['X','Y','Z'].map(axis=>{const node=document.createElement('span');node.className='print-dimension-label';node.dataset.axis=axis;labels.append(node);return node;});
 const $=id=>panel.querySelector('#'+id),format=value=>Math.abs(value)<.0005?'0':Number(value.toFixed(3)).toString();
 let cache=null,history=null,bodyKey='',choiceKey='',version=0,boxHelper=null,measurement=null;
 function clearOverlay(){measurement=null;labels.hidden=true;if(boxHelper){scene.remove(boxHelper);boxHelper.geometry.dispose();boxHelper.material.dispose();boxHelper=null;}delete host.dataset.printDimensions;}
 function close(){++version;panel.hidden=true;button.setAttribute('aria-pressed','false');clearOverlay();cache=null;history=null;bodyKey='';choiceKey='';}
 function choices(){
  const visible=[...meshes].filter(([,mesh])=>mesh.visible).map(([id])=>id),selected=getSelection().filter(id=>visible.includes(id));
  const key=JSON.stringify([visible,selected]);if(key!==choiceKey){const previous=$('print-dimensions-target').value;choiceKey=key;$('print-dimensions-target').replaceChildren(new Option('表示中のすべて','all'));if(selected.length)$('print-dimensions-target').add(new Option('選択したボディ（'+selected.length+'個）','selected'));for(const id of visible)$('print-dimensions-target').add(new Option(getBodyName(id),id));if([...$('print-dimensions-target').options].some(option=>option.value===previous))$('print-dimensions-target').value=previous;}
  return {visible,selected};
 }
 function positionLabels(){
  if(!measurement)return;
  const {min,max}=measurement,points=[[(min[0]+max[0])/2,min[1],min[2]],[max[0],(min[1]+max[1])/2,min[2]],[max[0],max[1],(min[2]+max[2])/2]];
  for(const [i,node]of labelNodes.entries()){const point=new THREE.Vector3(...points[i]).project(camera);node.hidden=point.z< -1||point.z>1;node.style.left=(point.x+1)*host.clientWidth/2+'px';node.style.top=(1-point.y)*host.clientHeight/2+'px';}
 }
 function render(){
  clearOverlay();if(!cache)return;
  try{
   const {selected}=choices(),target=$('print-dimensions-target').value,ids=target==='all'?cache.map(item=>item.id):target==='selected'?selected:[target];
   const limits=['x','y','z'].map(axis=>{const input=$('print-dimensions-limit-'+axis);return input.value.trim()===''?NaN:Number(input.value);});
   const result=printDimensions(cache.filter(item=>ids.includes(item.id)),limits);measurement=result;$('print-dimensions-capacity').textContent='造形範囲 '+limits.map(format).join(' × ')+' mm（変更）';
   $('print-dimensions-total').textContent=result.dimensions.map(axis=>axis.axis+' '+format(axis.length)).join(' × ')+' mm';
   $('print-dimensions-axes').replaceChildren();for(const axis of result.dimensions){const row=document.createElement('tr');row.dataset.fits=String(axis.fits);for(const value of [axis.axis,format(axis.length)+' mm',axis.fits?'余裕 '+format(Math.max(0,axis.remaining))+' mm':'超過 '+(Math.abs(axis.remaining)<.001?'<0.001':format(-axis.remaining))+' mm']){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}$('print-dimensions-axes').append(row);}
   $('print-dimensions-status').textContent=result.fits?'造形範囲内です（現在の向きの寸法）':result.dimensions.filter(axis=>!axis.fits).map(axis=>axis.axis).join('・')+'方向が造形範囲を超えています';$('print-dimensions-status').dataset.fits=String(result.fits);
   $('print-dimensions-bodies').replaceChildren();for(const item of result.bodies){const row=document.createElement('p');row.textContent=getBodyName(item.id)+'：'+item.size.map(format).join(' × ')+' mm';$('print-dimensions-bodies').append(row);}
   boxHelper=new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(...result.min),new THREE.Vector3(...result.max)),0xb28fe0);boxHelper.material.depthTest=false;boxHelper.material.depthWrite=false;boxHelper.renderOrder=15;scene.add(boxHelper);labels.hidden=false;
   for(const [i,node]of labelNodes.entries())node.textContent=['X','Y','Z'][i]+' '+format(result.size[i])+' mm';positionLabels();
   host.dataset.printDimensions=JSON.stringify({...result,targets:ids});
  }catch(error){$('print-dimensions-total').textContent='';$('print-dimensions-axes').replaceChildren();$('print-dimensions-bodies').replaceChildren();$('print-dimensions-status').textContent=error.message;delete $('print-dimensions-status').dataset.fits;}
 }
 async function measure(force=false){
  if(panel.hidden)return;const current=getFeatures(),{visible}=choices(),key=JSON.stringify(visible);
  if(!force&&history===current&&bodyKey===key)return;
  history=current;bodyKey=key;cache=null;clearOverlay();const request=++version;$('print-dimensions-total').textContent='';$('print-dimensions-axes').replaceChildren();$('print-dimensions-bodies').replaceChildren();$('print-dimensions-status').textContent='CAD形状から最大寸法を確認しています…';delete $('print-dimensions-status').dataset.fits;
  try{if(!visible.length)throw Error('表示中のソリッドがありません');const result=await kernel.run(current,{type:'printLayoutInfo',targets:visible});if(request!==version||panel.hidden||getFeatures()!==current)return;cache=result.items;render();}
  catch(error){if(request===version&&!panel.hidden)$('print-dimensions-status').textContent=error.message;}
 }
 function open(){if(!panel.hidden){close();return;}if(!canOpen()){notify('編集中の操作を終了してから最大寸法を確認してください');return;}onOpen?.();panel.hidden=false;button.setAttribute('aria-pressed','true');choices();$('print-dimensions-target').value=getSelection().length?'selected':'all';measure(true);}
 button.onclick=open;$('print-dimensions-close').onclick=close;$('print-dimensions-refresh').onclick=()=>measure(true);
 $('print-dimensions-target').onchange=render;for(const axis of ['x','y','z'])$('print-dimensions-limit-'+axis).oninput=render;
 function sync(){if(panel.hidden)return;if(!canOpen()||getExploded()){close();return;}const previous=choiceKey;choices();measure();if(previous!==choiceKey&&cache)render();positionLabels();}
 return {close,open,sync};
}
