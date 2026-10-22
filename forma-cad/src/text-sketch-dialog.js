import * as THREE from 'three';
import {parseTextFont,TEXT_FONT_URL,textSketchLayout,textSketchFeatures} from './text-sketch.js';
import {findRegions,regionFaceGeometry} from './regions.js';
import {draggableDialog} from './draggable-dialog.js';

export function createTextSketchDialog({scene,canvas,camera,host,getFeatures,getSnap,onApply,notify}){
 const dialog=document.createElement('dialog');dialog.id='text-sketch-dialog';dialog.style.cssText='width:340px;max-width:calc(100vw - 24px);max-height:calc(100vh - 40px);overflow:auto';
 dialog.innerHTML='<div class="dialog-heading"><h2>押し出せる文字</h2><button type="button" data-close aria-label="閉じる">×</button></div><form><label>文字（80文字・5行まで）<textarea id="text-sketch-text" rows="3" maxlength="160" placeholder="文字を入力" required></textarea></label><p id="text-sketch-font-name">Noto Sans CJK JP（日本語・英数字）</p><details><summary>別のフォントを使う</summary><label>フォントファイル（端末内で読み込み）<input id="text-sketch-font" type="file" accept=".ttf,.otf,.woff"></label><button type="button" id="text-sketch-default-font">標準フォントに戻す</button></details><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label>文字の高さ (mm)<input id="text-sketch-height" type="number" min="1" max="500" step="0.1" value="10" required></label><label>追加の字間 (mm)<input id="text-sketch-spacing" type="number" min="0" max="100" step="0.1" value="0" required></label><label>横位置 (mm)<input id="text-sketch-u" type="number" min="-10000" max="10000" step="0.1" value="0" required></label><label>縦位置 (mm)<input id="text-sketch-v" type="number" min="-10000" max="10000" step="0.1" value="0" required></label><label>角度 (°)<input id="text-sketch-angle" type="number" min="-360" max="360" step="1" value="0" required></label><label>揃え方<select id="text-sketch-align"><option value="left">左揃え</option><option value="center">中央揃え</option><option value="right">右揃え</option></select></label></div><p id="text-sketch-plane"></p><button type="button" id="text-sketch-place" aria-pressed="false">画面で位置を指定</button><p>選択した平面、または表示中の基準平面に配置します。位置指定中はグリッドに吸着します（Shiftで解除）。</p><p id="text-sketch-info" role="status"></p><p id="text-sketch-error" role="alert" style="color:#f4b49a"></p><div class="editor-actions" style="flex-wrap:wrap"><button type="button" data-close>キャンセル</button><button id="text-sketch-apply" type="submit" disabled>スケッチに配置</button><button id="text-sketch-extrude" type="submit" class="accent" disabled>配置して押し出す</button></div></form>';
 document.body.append(dialog);draggableDialog(dialog);const $=id=>dialog.querySelector('#text-sketch-'+id),form=dialog.querySelector('form');
 $('text').style.cssText='width:100%;box-sizing:border-box;font:inherit;resize:vertical';
 for(const input of form.querySelectorAll('input[type="number"]'))input.step='any';
 let placement,original,font,fontName='Noto Sans CJK JP',defaultFontPromise,preview=null,prepared=null,revision=0,fontRevision=0,timer,placing=false,busy=false;
 const defaultFont=()=>defaultFontPromise??=(fetch(TEXT_FONT_URL).then(r=>{if(!r.ok)throw Error('標準フォントを読み込めません。再試行するか、フォントファイルを指定してください');return r.arrayBuffer();}).then(parseTextFont).catch(e=>{defaultFontPromise=null;throw e;}));
 function clear(){prepared=null;if(preview){scene.remove(preview);preview.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});preview=null;}delete host.dataset.textSketchPreview;controls();}
 function controls(){for(const id of ['apply','extrude'])$(id).disabled=!prepared||busy;}
 function setPlacing(value){placing=value;$('place').setAttribute('aria-pressed',String(value));$('place').textContent=value?'配置位置をクリックしてください':'画面で位置を指定';canvas.style.cursor=value?'crosshair':'';}
 function close(){revision++;fontRevision++;clearTimeout(timer);setPlacing(false);clear();dialog.close();}
 for(const button of dialog.querySelectorAll('[data-close]'))button.onclick=close;
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',()=>{if(preview||placing)close();});
 const spec=()=>Object.fromEntries(['text','height','spacing','u','v','angle','align'].map(k=>[k,['text','align'].includes(k)?$(k).value:$(k).value.trim()===''?NaN:Number($(k).value)]));
 function update(){
  if(!dialog.open||busy)return;clear();$('error').textContent='';$('info').textContent='';if(!font){$('info').textContent='フォントを読み込んでいます…';return;}
  try{
   const layout=textSketchLayout(font,spec()),sketches=textSketchFeatures(layout,placement,{fontName});if(original.length+sketches.length+layout.contours.filter(r=>!r.hole).length>150)throw Error('工程数が150を超えます。文字数を減らすか工程を整理してください');
   const regions=findRegions(sketches);if(!regions.length)throw Error('押し出せる文字輪郭がありません');preview=new THREE.Group();
   for(const region of regions){const fill=new THREE.Mesh(regionFaceGeometry(region),new THREE.MeshBasicMaterial({color:0x12b8d0,side:THREE.DoubleSide,transparent:true,opacity:.8,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}));fill.renderOrder=12;preview.add(fill);}
   const b=placement.frame,positions=[];for(const ring of layout.contours)for(let i=0;i<ring.points.length;i++)for(const p of [ring.points[i],ring.points[(i+1)%ring.points.length]])positions.push(...b.n.map((n,j)=>n*placement.offset+b.u[j]*p[0]+b.v[j]*p[1]));
   const line=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)),new THREE.LineBasicMaterial({color:0x087fa1,depthTest:false}));line.renderOrder=13;preview.add(line);scene.add(preview);
   prepared={sketches,key:JSON.stringify(spec())};const width=layout.bounds.max[0]-layout.bounds.min[0],height=layout.bounds.max[1]-layout.bounds.min[1];$('info').textContent=Number(width.toFixed(2))+' × '+Number(height.toFixed(2))+' mm ／ 押し出し領域 '+regions.length+'個';host.dataset.textSketchPreview=JSON.stringify({text:layout.text,regions:regions.length,holes:layout.contours.filter(r=>r.hole).length,vertices:layout.vertices,bounds:layout.bounds,plane:placement,origin:[layout.u,layout.v],angle:layout.angle});controls();
  }catch(e){clear();$('error').textContent=e.message;}
 }
 function schedule(){revision++;clearTimeout(timer);clear();timer=setTimeout(update,140);}
 form.addEventListener('input',e=>{if(e.target!==$('font'))schedule();});
 async function loadFont(source,name){const token=++fontRevision;revision++;clearTimeout(timer);font=null;clear();$('error').textContent='';$('font-name').textContent='フォントを読み込んでいます…';try{const loaded=await source();if(token!==fontRevision||!dialog.open)return;font=loaded;fontName=name;$('font-name').textContent=name;update();}catch(e){if(token===fontRevision&&dialog.open){$('error').textContent=e.message;$('font-name').textContent='フォントを選んでください';}}}
 $('font').onchange=()=>{const file=$('font').files[0];if(!file)return;loadFont(async()=>{if(file.size>32*1024*1024)throw Error('フォントは32 MB以下にしてください');return parseTextFont(await file.arrayBuffer());},file.name);};
 $('default-font').onclick=()=>{$('font').value='';loadFont(defaultFont,'Noto Sans CJK JP');};
 $('place').onclick=()=>setPlacing(!placing);
 canvas.addEventListener('pointerdown',e=>{
  if(!dialog.open||!placing||e.button!==0)return;e.preventDefault();e.stopImmediatePropagation();const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);const point=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(...placement.frame.n),-placement.offset),new THREE.Vector3());if(!point){notify('作図平面を見やすい向きに回転してください');return;}
  const snap=getSnap(),step=snap.step,coordinate=axis=>{let n=point.dot(new THREE.Vector3(...placement.frame[axis]));if(snap.enabled&&!e.shiftKey&&step>0)n=Math.round(n/step)*step;return Number(n.toFixed(6));};$('u').value=coordinate('u');$('v').value=coordinate('v');setPlacing(false);update();
 },true);
 // A placement click is owned by this tool; do not let its release confirm another command.
 canvas.addEventListener('click',e=>{if(dialog.open){e.stopImmediatePropagation();}},true);
 form.onsubmit=async e=>{e.preventDefault();if(!prepared||busy||prepared.key!==JSON.stringify(spec()))return;const request=++revision,batch=prepared.sketches,extrude=e.submitter===$('extrude');busy=true;controls();try{if(getFeatures()!==original)throw Error('モデルが変更されました。文字を開き直してください');await onApply(batch,{original,extrude,isCurrent:()=>request===revision&&dialog.open});if(request===revision)close();}catch(error){if(request===revision&&dialog.open)$('error').textContent=error.message;}finally{busy=false;controls();}};
 return {get active(){return dialog.open;},get reference(){return dialog.open?placement:null;},close,open(next){close();original=getFeatures();placement=structuredClone(next);busy=false;for(const [key,value]of Object.entries({u:next.u??0,v:next.v??0}))$(key).value=value;$('plane').textContent='配置平面：'+(placement.label||placement.plane||'任意平面');$('error').textContent='';dialog.show();if(font)update();else loadFont(defaultFont,'Noto Sans CJK JP');$('text').focus();}};
}
