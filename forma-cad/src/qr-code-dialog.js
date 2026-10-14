import * as THREE from 'three';
import {qrCodeLayout,validateQrPlacement} from './qr-code-layout.js';
import {draggableDialog} from './draggable-dialog.js';

export function qrCodeDialog({scene,meshes,host,kernel,getFeatures,apply,notify}){
 const dialog=document.createElement('dialog');dialog.id='qr-code-dialog';
 dialog.innerHTML='<div class="dialog-heading"><h2>QRコード作成</h2><button type="button" id="qr-code-close" aria-label="閉じる">×</button></div><form id="qr-code-form"><label>大きさ・一辺 (mm)<input id="qr-code-size" type="number" value="40" min="10" max="300" step="any" required></label><label>データの内容<textarea id="qr-code-text" rows="3" maxlength="2000" placeholder="ID番号・文字列・URLなど" required></textarea></label><canvas id="qr-code-image" width="232" height="232" aria-label="入力内容のQRコードプレビュー"></canvas><p id="qr-code-position"></p><p id="qr-code-info" role="status"></p><p>土台1 mm＋模様1 mmを一体の新規ボディにします。大きさは読み取り用の余白を含みます。作成後に移動・回転で調整できます。</p><details><summary>印刷するときの色</summary><p>読み取りには土台と模様の色の差が必要です。高さ1 mmでフィラメントを替えるか、浮き出た模様を塗ってください。</p></details><p id="qr-code-warning" role="status"></p><p id="qr-code-error" role="alert"></p><div class="editor-actions"><button type="button" id="qr-code-cancel">キャンセル</button><button type="submit" id="qr-code-apply" class="accent" disabled>作成</button></div></form>';
 document.body.append(dialog);draggableDialog(dialog);const $=key=>dialog.querySelector('#qr-code-'+key);
 let original,history,editing,placement,id,preview=null,hidden=null,current=null,busy=false,inflight=false,version=0,timer;
 const spec=()=>({type:'qrCode',id,size:$('size').value.trim()===''?NaN:Number($('size').value),text:$('text').value,point:[...placement.point],frame:structuredClone(placement.frame)});
 function clear(){if(hidden){hidden.mesh.visible=hidden.visible;hidden=null;}if(preview){scene.remove(preview);preview.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});preview=null;}delete host.dataset.qrCodePreview;}
 function close(){version++;clearTimeout(timer);if(inflight){kernel.reset();inflight=false;}current=null;busy=false;clear();dialog.close();}
 $('cancel').onclick=$('close').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('close',()=>{if(!dialog.open&&(current||preview||inflight))close();});
 function controls(){for(const input of [$('size'),$('text')])input.disabled=busy;$('apply').disabled=busy||!current;}
 function update(){
  if(busy)return;clear();current=null;$('error').textContent='';$('warning').textContent='';$('info').textContent='';$('image').hidden=true;controls();
  try{const input=validateQrPlacement(spec()),layout=qrCodeLayout(input),transform=new THREE.Matrix4().makeBasis(...['u','v','n'].map(k=>new THREE.Vector3(...input.frame[k])));transform.setPosition(...input.point);
   preview=new THREE.Group();preview.applyMatrix4(transform);const base=new THREE.Mesh(new THREE.BoxGeometry(input.size,input.size,1),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.8}));base.position.z=.5;preview.add(base);
   for(const r of layout.rectangles){const block=new THREE.Mesh(new THREE.BoxGeometry(r.width,r.height,1.02),new THREE.MeshStandardMaterial({color:0x111111,roughness:.8}));block.position.set(r.x+r.width/2,r.y+r.height/2,1.49);preview.add(block);}scene.add(preview);
   if(editing){const mesh=meshes.get(id);if(mesh){hidden={mesh,visible:mesh.visible};mesh.visible=false;}}
   const canvas=$('image'),scale=6,total=layout.count+8;canvas.width=canvas.height=total*scale;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000';for(let y=0;y<layout.count;y++)for(let x=0;x<layout.count;x++)if(layout.matrix[y][x])ctx.fillRect((x+4)*scale,(y+4)*scale,scale,scale);canvas.hidden=false;
   $('info').textContent=input.size+' × '+input.size+' × 2 mm ／ 1マス '+Number(layout.pitch.toFixed(3))+' mm ／ '+layout.count+' × '+layout.count+' マス';if(layout.pitch<.6)$('warning').textContent='模様が細かくなっています。サイズを大きくすると印刷しやすくなります。';
   host.dataset.qrCodePreview=JSON.stringify({size:input.size,modules:layout.count,moduleSize:layout.pitch,point:input.point,frame:input.frame,baseThickness:1,patternThickness:1});current={key:JSON.stringify(input)};controls();
  }catch(error){clear();$('error').textContent=error.message;}
 }
 function schedule(){version++;clearTimeout(timer);current=null;controls();timer=setTimeout(update,120);}
 $('form').addEventListener('input',schedule);
 $('form').onsubmit=async event=>{event.preventDefault();if(busy||!current)return;const input=spec();if(JSON.stringify(input)!==current.key)return;const request=++version;busy=true;controls();$('error').textContent='土台と模様を結合しています…';inflight=true;
  try{if(getFeatures()!==original)throw Error('モデルが変更されました。グリッド上の位置を選択し直してください');const result=await kernel.run(history,input,{onProgress:p=>{if(request===version&&dialog.open)$('error').textContent=p.stage||'QRコードを作成しています…';}});if(request!==version||!dialog.open)return;inflight=false;
   await apply(input,result,editing,original,()=>request===version&&dialog.open);if(request!==version||!dialog.open)return;close();notify(editing?'QRコードを更新しました':'QRコードを新しいボディとして作成しました · 移動／回転で調整できます');
  }catch(error){if(request===version&&dialog.open){inflight=false;$('error').textContent=error.message;}}finally{if(request===version){busy=false;controls();}}
 };
 return {close,open(next,feature=null){if(dialog.open)close();original=getFeatures();editing=feature;const index=feature?original.findIndex(f=>f.id===feature.id):-1;if(feature&&index<0)return;history=feature?original.slice(0,index):original;placement=feature?.spec||next;id=feature?.id||crypto.randomUUID();$('size').value=feature?.spec.size??40;$('text').value=feature?.spec.text??'';$('position').textContent='中心 X / Y / Z：'+placement.point.map(v=>Number(v.toFixed(3))).join(' / ')+' mm';$('apply').textContent=feature?'変更を適用':'作成';busy=false;current=null;dialog.show();update();}};
}
