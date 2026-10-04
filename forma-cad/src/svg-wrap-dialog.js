import * as THREE from 'three';
import {svgWrapPattern} from './svg-wrap-import.js';
import {periodicSvgRegions,svgRepeatLayout} from './svg-wrap-pattern.js';
import {surfacePattern,surfacePatternNames,surfacePatternThumbnail} from './surface-pattern.js';
export function svgWrapDialog({scene,meshes,host,kernel,getFeatures,apply,notify}){
 const dialog=document.createElement('dialog');dialog.id='svg-wrap-dialog';dialog.innerHTML=`<form id="svg-wrap-form"><h2 id="svg-wrap-title">SVGを円柱に巻き付け</h2><p id="svg-wrap-info"></p>
 <label>模様の作り方<select id="svg-wrap-source"><option value="generated">模様を自動生成</option><option value="svg">SVGファイルを読み込む</option></select></label>
 <div id="svg-wrap-auto-fields" hidden><div id="svg-wrap-gallery" role="group" aria-label="模様を画像から選択">${Object.entries(surfacePatternNames).map(([kind,name])=>`<button type="button" data-pattern-kind="${kind}" aria-pressed="false">${surfacePatternThumbnail(kind)}<span>${name}</span></button>`).join('')}</div><label>選択中の模様<select id="svg-wrap-kind">${Object.entries(surfacePatternNames).map(([value,name])=>'<option value="'+value+'">'+name+'</option>').join('')}</select></label>
 <label id="svg-wrap-size-label">1模様の大きさの目安 (mm)<input id="svg-wrap-size" type="number" value="20" min="0.1" step="any" required></label>
 <label class="pattern-size-link"><input id="svg-wrap-auto-rows" type="checkbox" checked>縦横のサイズを連動</label><p id="svg-wrap-size-help"></p>
 <label>段数<input id="svg-wrap-rows" type="number" value="3" min="1" max="8" step="1" required></label>
 <label id="svg-wrap-line-width-label">線の太さ (mm)<input id="svg-wrap-line-width" type="number" value="0.8" min="0.2" step="any" required></label>
 <label>段のずらし<select id="svg-wrap-stagger"><option value="0.5">交互に半分ずらす</option><option value="0">ずらさない</option></select></label>
 <label id="svg-wrap-seed-label" hidden>石目の模様番号<input id="svg-wrap-seed" type="number" value="1" min="0" max="9999" step="1" required></label></div>
 <div id="svg-wrap-file-fields"><label>SVG図案<input id="svg-wrap-file" type="file" accept=".svg,image/svg+xml"></label></div>
 <output id="svg-wrap-filename"></output><svg id="svg-wrap-flat" viewBox="0 0 1000 240" aria-label="1周分の図案"></svg>
 <label>加工<select id="svg-wrap-operation"><option value="emboss">浮き彫り（凸）</option><option value="engrave">彫り込み（凹）</option></select></label>
 <label>凹凸の高さ・深さ (mm)<input id="svg-wrap-depth" type="number" value="0.6" min="0.01" max="10" step="any" required></label>
 <label>模様を付ける範囲の高さ (mm)<input id="svg-wrap-height" type="number" min="0.1" step="any" required></label>
 <label>下端からの位置 (mm)<input id="svg-wrap-offset" type="number" min="0" step="any" required></label>
 <label>開始角度 (°)<input id="svg-wrap-angle" type="number" value="0" min="-36000" max="36000" step="any" required></label>
 <div id="svg-wrap-svg-layout"><label>1周の配置<select id="svg-wrap-seam"><option value="repeat">同じ模様を繰り返して1周</option><option value="mirror">継ぎ目をつなぐ（左右反転した2枚）</option><option value="single">1枚をそのまま1周</option></select></label>
 <label id="svg-wrap-tile-width-label">1枚の幅の目安 (mm)<input id="svg-wrap-tile-width" type="number" value="25" min="0.1" step="any" required></label></div>
 <p id="svg-wrap-seam-help"></p><p id="svg-wrap-mode-help"></p><p id="svg-wrap-error" role="status" aria-live="polite"></p>
 <div class="editor-actions"><button id="svg-wrap-cancel" type="button">キャンセル</button><button id="svg-wrap-apply" class="accent" type="submit" disabled>作成</button></div></form>`;document.body.append(dialog);
 const $=id=>document.getElementById('svg-wrap-'+id);
 let original=null,source=null,editing=null,pattern=null,svgPattern=null,svgFileName='',layout=null,info=null,preview=null,hidden=null,version=0,timer=null,inflight=false,cached=null,applying=false;
 const generated=()=>$('source').value==='generated';
 function showMode(){const auto=generated();$('title').textContent=auto?'円柱の模様を生成':'SVGを円柱に巻き付け';dialog.dataset.patternSource=auto?'generated':'svg';
  for(const [id,hide]of [['auto-fields',!auto],['file-fields',auto],['svg-layout',auto]]){$(id).hidden=hide;for(const el of $(id).querySelectorAll('input,select,button'))el.disabled=hide||!info;}
  $('rows').disabled=!auto||!info||$('auto-rows').checked;
  $('size-label').firstChild.textContent=$('auto-rows').checked?'1模様の大きさの目安 (mm)':'1模様の幅の目安 (mm)';
  $('size-help').textContent=$('auto-rows').checked?'横の枚数と縦の段数を大きさに合わせて自動調整します。範囲に収まるよう実寸を調整します。':'段数を指定して縦の大きさを調整できます。';
  for(const button of $('gallery').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.patternKind===$('kind').value));
  $('seed-label').hidden=$('kind').value!=='stone';$('seed').disabled=!auto||!info||$('kind').value!=='stone';
  $('line-width-label').firstChild.textContent=$('kind').value==='stone'?'石の間のすき間 (mm)':['dots','diamonds','bricks'].includes($('kind').value)?'模様のすき間 (mm)':'線の太さ (mm)';
  $('mode-help').textContent=auto?'幅を円周に合わせ、継ぎ目がつながるよう自動で配置します。作成後は履歴の「模様生成」から再編集できます。':'SVGの塗り・線を立体化します。文字と画像はパスに変換してください。';
 }
 function clear(){if(preview){preview.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});preview.removeFromParent();preview=null;}if(hidden){const [mesh,visible]=hidden;if(mesh.parent)mesh.visible=visible;hidden=null;}delete host.dataset.svgWrapPreview;}
 function close(){clearTimeout(timer);++version;if(inflight||applying)kernel.reset();inflight=false;clear();cached=null;}
 dialog.addEventListener('close',close);dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close();});$('cancel').onclick=()=>dialog.close();
 function settings(){return {version:1,kind:$('kind').value,size:Number($('size').value),rows:Number($('rows').value),autoRows:$('auto-rows').checked,lineWidth:Number($('line-width').value),stagger:Number($('stagger').value),seed:Number($('seed').value)};}
 function spec(){const seam=generated()?'single':$('seam').value;return {type:'svgWrap',id:editing?.spec.id||editing?.id||source.id,target:source.target,surfacePoint:source.surfacePoint,pattern:pattern.regions,fileName:$('filename').textContent,depth:Number($('depth').value),height:Number($('height').value),offset:Number($('offset').value),angle:Number($('angle').value),operation:$('operation').value,seam,patternAspect:pattern.aspect,...(generated()?{generator:layout.settings}:{}),...(seam==='repeat'?{tileWidth:Number($('tile-width').value),repeatCount:svgRepeatLayout(2*Math.PI*info.radius,Number($('tile-width').value)).count}:{})};}
 function flat(input){const svg=$('flat');svg.replaceChildren();if(!pattern)return;const h=generated()?1000*input.height/(2*Math.PI*info.radius):240;svg.setAttribute('viewBox','0 0 1000 '+h);
  for(const r of periodicSvgRegions(pattern.regions,input.seam,input.repeatCount||1)){const path=document.createElementNS('http://www.w3.org/2000/svg','path'),rings=[r.outer,...r.holes];path.setAttribute('d',rings.map(ring=>'M'+ring.map(([x,y])=>x*1000+','+(1-y)*h).join('L')+'Z').join(''));path.setAttribute('fill','#00a8b5');path.setAttribute('fill-rule','evenodd');svg.append(path);}svg.hidden=false;
 }
 function fitSize(center=false){if(!info||!svgPattern||generated())return;try{const circumference=2*Math.PI*info.radius,width=$('seam').value==='repeat'?svgRepeatLayout(circumference,Number($('tile-width').value)).width:circumference*($('seam').value==='mirror'?.5:1),height=Math.max(.1,Math.min(info.height*.8,width*svgPattern.aspect));$('height').value=height.toFixed(2);if(center||Number($('offset').value)+height>info.height)$('offset').value=((info.height-height)/2).toFixed(2);}catch{}}
 function schedule(){if(applying)return;clearTimeout(timer);const current=++version;if(inflight){kernel.reset();inflight=false;}clear();cached=null;$('apply').disabled=true;showMode();const auto=generated(),repeating=!auto&&$('seam').value==='repeat';$('tile-width-label').hidden=!repeating;$('tile-width').disabled=!repeating||!info;if(!info)return;
  let input;try{
   if(auto){layout=surfacePattern(2*Math.PI*info.radius,Number($('height').value),settings());pattern=layout;if($('auto-rows').checked)$('rows').value=layout.settings.rows;$('filename').textContent='自動生成：'+surfacePatternNames[layout.settings.kind];}
   else{layout=null;pattern=svgPattern;$('filename').textContent=svgFileName;if(!pattern)throw Error('SVG図案を選択してください');}
   if(![...dialog.querySelectorAll('input[type=number]:not(:disabled)')].every(el=>el.value.trim()!==''&&el.checkValidity()))throw Error('数値の入力範囲を確認してください');
   input=spec();if(input.offset+input.height>info.height+.0001)throw Error('模様の高さと下端の位置を円柱の側面内に収めてください');flat(input);
   $('seam-help').textContent=auto?'1周 '+layout.count+'枚 × '+layout.settings.rows+'段 ／ 実際の幅 '+layout.width.toFixed(2)+' mm・段の高さ '+layout.rowHeight.toFixed(2)+' mm'+(layout.settings.lineWidth<.6?'。0.6 mmノズルには細い部分があります。':'。'):repeating?'1枚の実際の幅 '+(2*Math.PI*info.radius/input.repeatCount).toFixed(2)+' mm ／ '+input.repeatCount+'回で1周。円周に合うよう幅を調整します。':input.seam==='mirror'?'左右反転した2枚で1周します。横幅は円周に自動で合わせます。':'1枚を円周1周に合わせます。';
  }catch(error){$('flat').replaceChildren();$('error').textContent=error.message;return;}
  $('error').textContent=auto?'模様の立体形状を計算中…':'巻き付け形状を計算中…';timer=setTimeout(async()=>{try{inflight=true;const result=await kernel.run(original,input,{onProgress:p=>{if(current===version&&dialog.open)$('error').textContent=p.stage+' '+p.current+' / '+p.total+'…';}});if(current!==version||!dialog.open)return;if(getFeatures()!==source.fullFeatures)throw Error('モデルが変更されました。開き直してください');clear();preview=new THREE.Group();for(const o of result.outputs){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(o.vertices,3));g.setIndex(o.triangles);g.computeVertexNormals();const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x65afad,roughness:.65,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}));mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g,25),new THREE.LineBasicMaterial({color:0x164b52,transparent:true,opacity:.7})));preview.add(mesh);}const mesh=meshes.get(source.target);if(mesh){hidden=[mesh,mesh.visible];mesh.visible=false;}scene.add(preview);host.dataset.svgWrapPreview='true';cached={key:JSON.stringify(input),result};$('error').textContent='1周のプレビューを確認して確定してください';$('apply').disabled=false;}catch(error){if(current===version&&dialog.open)$('error').textContent=error.message;}finally{if(current===version)inflight=false;}},350);
 }
 $('gallery').addEventListener('click',event=>{const button=event.target.closest('button[data-pattern-kind]');if(!button||button.disabled||applying)return;$('kind').value=button.dataset.patternKind;schedule();});
 $('form').addEventListener('input',e=>{if(e.target!==$('file')){if(e.target===$('tile-width')||e.target===$('seam'))fitSize();schedule();}});
 $('file').onchange=async()=>{const file=$('file').files[0];if(!file)return;const request=++version;clearTimeout(timer);if(inflight){kernel.reset();inflight=false;}clear();cached=null;$('apply').disabled=true;try{if(file.size>5000000)throw Error('SVGは5MB以下にしてください');const text=await file.text();if(request!==version||!dialog.open)return;svgPattern=svgWrapPattern(text);svgFileName=file.name.slice(0,100);fitSize(true);schedule();}catch(error){if(request===version&&dialog.open){svgPattern=null;pattern=null;$('flat').replaceChildren();$('error').textContent=error.message;}}finally{$('file').value='';}};
 $('form').onsubmit=async e=>{e.preventDefault();if(!cached||$('apply').disabled||applying)return;const input=spec();if(JSON.stringify(input)!==cached.key)return;if(getFeatures()!==source.fullFeatures){$('error').textContent='モデルが変更されました。開き直してください';return;}applying=true;const request=version;$('apply').disabled=true;$('error').textContent='加工を確定しています…';try{await apply(input,cached.result,editing,source.fullFeatures,()=>request===version&&dialog.open);if(request!==version||!dialog.open)return;applying=false;dialog.close();notify(input.generator?(editing?'円柱の模様を更新しました':'円柱に凹凸模様を作成しました'):(editing?'SVGの巻き付けを更新しました':'SVGの凹凸模様を円柱に作成しました'));}catch(error){if(request===version&&dialog.open)$('error').textContent=error.message;}finally{applying=false;if(dialog.open&&cached)$('apply').disabled=false;}};
 return {async open(surface,feature=null,mode='svg'){
  if(!surface&&!feature){notify('先に円柱の側面をクリックしてください');return;}if(dialog.open)dialog.close();const fullFeatures=getFeatures();editing=feature;original=feature?fullFeatures.slice(0,fullFeatures.findIndex(f=>f.id===feature.id)):fullFeatures;source={id:crypto.randomUUID(),target:feature?.spec.target||surface.bodyId,surfacePoint:feature?.spec.surfacePoint||surface.point,fullFeatures};
  svgPattern=feature&&!feature.spec.generator?{regions:structuredClone(feature.spec.pattern),aspect:feature.spec.patternAspect||1}:null;svgFileName=feature&&!feature.spec.generator?feature.spec.fileName||'':'';pattern=null;layout=null;info=null;cached=null;applying=false;
  $('source').value=feature?(feature.spec.generator?'generated':'svg'):mode;
  for(const [key,value]of Object.entries({operation:'emboss',depth:.6,seam:'repeat',angle:0,tileWidth:25,...(feature?.spec||{})})){if(['operation','depth','height','offset','seam','angle','tileWidth'].includes(key))$(key==='tileWidth'?'tile-width':key).value=value;}
  const generator={kind:'scales',size:20,rows:3,lineWidth:.8,stagger:.5,seed:1,...(feature?.spec.generator||{})};
  for(const key of ['kind','size','rows','lineWidth','stagger','seed'])$(key==='lineWidth'?'line-width':key).value=generator[key];
  $('auto-rows').checked=feature?feature.spec.generator?.autoRows===true:true;
  showMode();$('source').disabled=true;$('filename').textContent='';$('flat').replaceChildren();$('flat').hidden=true;$('apply').textContent=feature?'変更を適用':'作成';$('apply').disabled=true;$('info').textContent='円柱の寸法を確認中…';$('error').textContent='';dialog.show();const request=++version;
  try{inflight=true;info=await kernel.run(original,{type:'svgWrapInfo',target:source.target,surfacePoint:source.surfacePoint});if(request!==version||!dialog.open)return;inflight=false;$('source').disabled=false;$('info').textContent='直径 '+(info.radius*2).toFixed(2)+' mm ／ 円周 '+(2*Math.PI*info.radius).toFixed(2)+' mm ／ 側面の高さ '+info.height.toFixed(2)+' mm';$('height').max=info.height;$('offset').max=info.height;$('depth').max=Math.min(10,info.radius*.8);if(!feature){$('height').value=(info.height*.8).toFixed(2);$('offset').value=(info.height*.1).toFixed(2);$('size').value=Math.max(20,2*Math.PI*info.radius/12).toFixed(2);}schedule();}catch(error){if(request===version&&dialog.open)$('error').textContent=error.message;}finally{if(request===version)inflight=false;}
 }};
}
