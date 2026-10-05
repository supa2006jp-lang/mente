import * as THREE from 'three';
import {rebuild} from './geometry.js';
import {planPrintLayout} from './print-layout.js';
import {draggableDialog} from './draggable-dialog.js';
export function printLayoutDialog({scene,host,meshes,kernel,getFeatures,bodyName,fitPreview,apply,notify}){
 const plate=new THREE.Group();plate.name='print-plate-180';plate.visible=false;
 const surface=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshBasicMaterial({color:0x64cada,transparent:true,opacity:.13,side:THREE.DoubleSide,depthWrite:false}));surface.position.z=-.04;plate.add(surface);
 const corners=m=>[[-90+m,-90+m,.025],[90-m,-90+m,.025],[90-m,90-m,.025],[-90+m,90-m,.025],[-90+m,-90+m,.025]].map(p=>new THREE.Vector3(...p));
 const border=new THREE.Line(new THREE.BufferGeometry().setFromPoints(corners(0)),new THREE.LineBasicMaterial({color:0x0084a6}));plate.add(border);
 const inset=new THREE.Line(new THREE.BufferGeometry().setFromPoints(corners(2)),new THREE.LineDashedMaterial({color:0xb47813,dashSize:2,gapSize:2}));inset.computeLineDistances();plate.add(inset);scene.add(plate);let plateMargin=2;function setMargin(value){plateMargin=value;inset.geometry.dispose();inset.geometry=new THREE.BufferGeometry().setFromPoints(corners(value));inset.computeLineDistances();inset.visible=value>0;}
 const toggle=document.createElement('button');toggle.id='print-plate-toggle';toggle.type='button';toggle.textContent='180 mmプレート';toggle.setAttribute('aria-pressed','false');document.querySelector('.navigation').append(toggle);
 const readout=document.createElement('div');readout.id='print-plate-readout';readout.hidden=true;readout.textContent='印刷プレート 180 × 180 mm ／ 原点中心・XY平面';Object.assign(readout.style,{position:'absolute',top:'10px',left:'50%',transform:'translateX(-50%)',padding:'7px 10px',border:'1px solid #69aabd',borderRadius:'5px',background:'#effaffec',color:'#17617a',fontSize:'12px',pointerEvents:'none',maxWidth:'45%'});host.append(readout);
 function showPlate(value){plate.visible=value;readout.hidden=!value;toggle.setAttribute('aria-pressed',String(value));host.dataset.printPlate=String(value);}
 toggle.onclick=()=>showPlate(!plate.visible);
 const dialog=document.createElement('dialog');dialog.id='print-layout-dialog';Object.assign(dialog.style,{position:'fixed',margin:'0',width:'min(390px,calc(100vw - 32px))',maxHeight:'85vh',overflow:'auto'});
 const style=document.createElement('style');style.textContent='#print-layout-dialog{z-index:110;background:#192733;color:#dce6ef;border:1px solid #63849b;border-radius:10px;padding:18px;box-shadow:0 10px 30px #0006}#print-layout-dialog h2{font-size:17px}#print-layout-dialog p{font-size:13px;line-height:1.6}#print-layout-dialog label{display:block;font-size:13px;margin:12px 0}#print-layout-dialog input[type=number]{display:block;width:100%;padding:9px;background:#243649;color:white;border:1px solid #486071;border-radius:5px;margin-top:5px}#print-layout-error{color:#ffb295}#print-layout-dialog .plate-check{display:flex;align-items:center;gap:8px}#print-layout-dialog .plate-check input{accent-color:#46cbe0}#print-layout-dialog .dialog-heading{cursor:grab;touch-action:none}#print-layout-dialog .editor-actions{display:flex;gap:10px}#print-layout-dialog .editor-actions button{flex:1}';document.head.append(style);
 dialog.innerHTML='<form id="print-layout-form"><div class="dialog-heading"><h2>180 mmプレートに自動配置</h2><button type="button" id="print-layout-close" aria-label="閉じる">×</button></div><p>表示中のソリッドを180 × 180 mmの四角の中に並べ、各ボディの底をZ=0に合わせます。モデルの大きさは保ちます。</p><label>端からの余白 (mm)<input id="print-layout-margin" type="number" value="2" min="0" max="20" step="0.5" required></label><label>部品同士の間隔 (mm)<input id="print-layout-gap" type="number" value="3" min="0" max="30" step="0.5" required></label><label class="plate-check"><input id="print-layout-rotation" type="checkbox" checked>Z軸方向に90°回転して配置してよい</label><p>印刷する上下方向は保ちます。見えているソリッドだけが対象です。形状の外接四角を使って重なりを避けます。</p><p id="print-layout-info"></p><p id="print-layout-error" role="status" aria-live="polite"></p><div class="editor-actions"><button type="button" id="print-layout-cancel">キャンセル</button><button type="submit" id="print-layout-apply" class="accent" disabled>配置を確定</button></div></form>';
 document.body.append(dialog);draggableDialog(dialog);const $=id=>document.getElementById('print-layout-'+id);
 let original,history,editing,id,targets=[],items=null,plan=null,preview=null,hidden=[],version=0,busy=false,loading=false,wasVisible=false,wasMargin=2,applied=false,fitted=false;
 function clearPreview(){if(preview){scene.remove(preview);preview.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});preview=null;}for(const [m,v]of hidden)m.visible=v;hidden=[];}
 function close(){++version;if(loading||busy)kernel.reset();loading=busy=false;clearPreview();items=null;plan=null;delete host.dataset.printLayout;if(!applied){setMargin(wasMargin);showPlate(wasVisible);}}
 dialog.addEventListener('close',close);dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.close();});$('close').onclick=$('cancel').onclick=()=>dialog.close();
 function options(){return {margin:Number($('margin').value),gap:Number($('gap').value),allowRotation:$('rotation').checked};}
 function spec(){return {type:'printLayout',id,targets:[...targets],...options()};}
 function update(){
  if(busy||!items)return;plan=null;$('apply').disabled=true;$('error').textContent='';$('info').textContent='';
  if(![...dialog.querySelectorAll('input[type=number]')].every(el=>el.value.trim()&&el.checkValidity())){clearPreview();delete host.dataset.printLayout;$('error').textContent='余白・間隔を正しい数値で指定してください';return;}
  try{const next=planPrintLayout(items,options());
   if(!preview){preview=new THREE.Group();const bodies=rebuild(history);try{for(const target of targets){const source=bodies.get(target);if(!source)throw Error('配置するボディがありません');const m=new THREE.Mesh(source.geometry.clone(),new THREE.MeshStandardMaterial({color:0x68b4cf,roughness:.65}));m.userData.layoutId=target;m.matrixAutoUpdate=false;preview.add(m);} }finally{for(const b of bodies.values())b.geometry.dispose();}
    for(const target of targets){const m=meshes.get(target);if(m){hidden.push([m,m.visible]);m.visible=false;}}scene.add(preview);
   }
   for(const placement of next.placements){const m=preview.children.find(m=>m.userData.layoutId===placement.id),pivot=new THREE.Vector3(...placement.pivot);m.matrix.makeTranslation(...placement.translation).multiply(new THREE.Matrix4().makeTranslation(...pivot.toArray())).multiply(new THREE.Matrix4().makeRotationZ(placement.rotation*Math.PI/180)).multiply(new THREE.Matrix4().makeTranslation(...pivot.negate().toArray()));m.matrixWorldNeedsUpdate=true;}
   setMargin(next.margin);showPlate(true);
   if(!fitted){const box=new THREE.Box3().setFromObject(plate);box.union(new THREE.Box3().setFromObject(preview));fitPreview(box);fitted=true;}
   plan=next;host.dataset.printLayout=JSON.stringify(next);$('info').textContent=targets.length+'個を配置 ／ 使用範囲 '+next.used.width.toFixed(2)+' × '+next.used.height.toFixed(2)+' mm ／ 全ての底面 Z=0。';$('apply').disabled=false;
  }catch(error){clearPreview();delete host.dataset.printLayout;$('error').textContent=error.message;}
 }
 $('form').addEventListener('input',update);
 $('form').onsubmit=async e=>{e.preventDefault();if(busy||!plan||$('apply').disabled)return;const input=spec(),current=version;busy=true;$('apply').disabled=true;for(const el of dialog.querySelectorAll('input'))el.disabled=true;$('error').textContent='配置したソリッドを保存しています…';
  try{const result=await kernel.run(history,input);if(current!==version||!dialog.open)return;if(getFeatures()!==original)throw Error('モデルが変更されました。開き直してください');await apply(input,result,editing,original,()=>current===version&&dialog.open);if(current!==version||!dialog.open)return;busy=false;applied=true;dialog.close();notify('180 × 180 mmのプレート内に'+targets.length+'個のソリッドを配置しました');}
  catch(error){if(current===version&&dialog.open)$('error').textContent=error.message;}
  finally{if(current===version){busy=false;for(const el of dialog.querySelectorAll('input'))el.disabled=false;if(dialog.open&&plan)$('apply').disabled=false;}}
 };
 return {open:async(feature=null)=>{
  if([...document.querySelectorAll('dialog[open]')].some(d=>d!==dialog)){notify('編集中の操作を終了してから印刷配置してください');return;}if(dialog.open)dialog.close();original=getFeatures();editing=feature;history=feature?original.slice(0,original.findIndex(f=>f.id===feature.id)):original;id=feature?.id||crypto.randomUUID();targets=feature?.spec.targets||[...meshes].filter(([,m])=>m.visible).map(([id])=>id);if(!targets.length){notify('表示中のソリッドがありません');return;}
  const request=++version;items=null;plan=null;busy=false;loading=true;applied=false;fitted=false;wasVisible=plate.visible;wasMargin=plateMargin;for(const el of dialog.querySelectorAll('input'))el.disabled=false;$('margin').value=feature?.spec.margin??2;$('gap').value=feature?.spec.gap??3;$('rotation').checked=feature?.spec.allowRotation??true;$('apply').disabled=true;$('info').textContent='';$('error').textContent='ボディの正確な寸法を確認しています…';showPlate(true);dialog.show();
  try{const result=await kernel.run(history,{type:'printLayoutInfo',targets});if(request!==version||!dialog.open)return;if(getFeatures()!==original)throw Error('モデルが変更されました。開き直してください');items=result.items.map(b=>({...b,name:bodyName(b.id)}));update();}
  catch(error){if(request===version&&dialog.open)$('error').textContent=error.message;}
  finally{if(request===version)loading=false;}
 },get active(){return dialog.open;}};
}
