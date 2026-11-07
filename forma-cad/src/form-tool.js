import * as THREE from 'three';
import {draggableDialog} from './draggable-dialog.js';
import {addFormPoint,canRemoveFormPoint,effectiveFormRing,formKnots,formMirrorPoint,formPointCount,formPointLimit,formRingOutline,formSectionLimit,guidedFormRing,interpolateFormRing,moveFormPoint,newFormProfile,removeFormPoint,setFormCorner,setFormSymmetry,setFormSymmetryPlane,validFormWall,validateFormProfile} from './form-profile.js';
import {formGuideBindings,formGuideCoordinate,formGuideFromSketch,formGuideLimit} from './form-guides.js';
import {formSourceContour,importFormRings} from './form-source.js';
import {nativeSketchRegion} from './native-sketch-arcs.js';
import {basisFor,planarFace} from './frames.js';
import {defaultFormOrientation,formBasis,formLocal,formWorld,validFormOrientation} from './form-orientation.js';
import {addFormSeam,findFormSeam,formSeamEnd,formSeamLimit,formSeams,formSeamsAt} from './form-seam.js';
import {formProjection,formProjectionPoint,projectFormOutline} from './form-silhouette.js';
import {analyzeCoilPrint} from './coil-print-check.js';
import {formDragGeometry} from './form-drag-preview.js';
import {formSymmetryU,symmetryFromFace,symmetryFromSketch} from './form-symmetry.js';
import {formSectionBounds,formSectionSizeAxes,formSmoothAxes,resizeFormSection,smoothFormPoint} from './form-refinement.js';
import {formCurvatureChanges} from './form-curvature.js';

const formViews={iso:'斜め',front:'正面',right:'右側面',top:'上面'};
const defaultWall={thickness:2,opening:'start'};
const formUndoLimit=30;

function previewMaterial(zebra){
 if(!zebra)return new THREE.MeshStandardMaterial({
  color:0x63c4dc,transparent:true,opacity:.62,depthWrite:false,side:THREE.DoubleSide
 });
 return new THREE.ShaderMaterial({
  side:THREE.DoubleSide,
  vertexShader:`
   varying vec3 surfaceNormal;
   varying vec3 viewPosition;
   void main(){
    surfaceNormal=normalMatrix*normal;
    vec4 p=modelViewMatrix*vec4(position,1.0);
    viewPosition=p.xyz;
    gl_Position=projectionMatrix*p;
   }`,
  fragmentShader:`
   varying vec3 surfaceNormal;
   varying vec3 viewPosition;
   void main(){
    vec3 normal=normalize(surfaceNormal)*(gl_FrontFacing?1.0:-1.0);
    vec3 incident=isOrthographic?vec3(0.0,0.0,-1.0):normalize(viewPosition);
    vec3 reflection=reflect(incident,normal);
    float wave=sin(dot(reflection,vec3(0.85,0.52,0.0))*36.0);
    float edge=max(fwidth(wave),0.02);
    vec3 color=mix(vec3(0.07,0.12,0.18),vec3(0.94,0.97,1.0),smoothstep(-edge,edge,wave));
    gl_FragColor=vec4(color,1.0);
   }`
 });
}

export function createFormTool({host,scene,camera,meshes,screenPoint,kernel,wallKernel,clearanceKernel,getFeatures,getRegions,setView,setReference,bodyName,fit,apply,notify}){
 const dialog=document.createElement('dialog');
 dialog.id='form-dialog';
 dialog.className='form-editor';
 dialog.setAttribute('aria-labelledby','form-title');
 dialog.innerHTML=`
  <div class="dialog-heading"><h2 id="form-title">フォーム編集</h2><button type="button" id="form-close" aria-label="閉じる">×</button></div>
  <div class="form-actions form-history">
   <button type="button" id="form-undo" title="Ctrl／⌘+Z">元に戻す</button>
   <button type="button" id="form-redo" title="Ctrl+Y／⌘+Shift+Z">やり直す</button>
  </div>
  <div class="form-views" role="group" aria-label="フォームの視点">${Object.entries(formViews).map(([key,label])=>'<button type="button" data-form-view="'+key+'" aria-pressed="false">'+label+'</button>').join('')}</div>
  <label id="form-reference-field" hidden>この視点の下絵<select id="form-reference"></select></label>
  <p id="form-view-help">制御点をドラッグして、断面内の位置を調整します。</p>
  <details id="form-orientation">
   <summary>断面の向き</summary>
   <label>断面の基準平面<select id="form-base-plane"><option>XY</option><option>XZ</option><option>YZ</option></select></label>
   <div class="form-coordinate-row">
    <label>横軸まわり (°)<input id="form-tilt-u" type="number" min="-180" max="180" step="1"></label>
    <label>縦軸まわり (°)<input id="form-tilt-v" type="number" min="-180" max="180" step="1"></label>
   </div>
   <p id="form-orientation-help">すべての断面を同じ向きに配置します。</p>
  </details>
  <details id="form-sources">
   <summary>スケッチ・ロフトから断面を取り込む</summary>
   <label>スケッチ断面（複数選択）<select id="form-sketches" multiple size="4"></select></label>
   <div class="form-actions"><button type="button" id="form-import-sketches">選んだ断面を取り込む</button></div>
   <label>既存ロフト<select id="form-loft"></select></label>
   <div class="form-actions"><button type="button" id="form-import-loft">このロフトをフォームで編集</button></div>
   <p id="form-source-help">高さの異なる、穴のない水平な閉じた輪郭を選びます。</p>
   <p id="form-source-error" class="form-invalid" role="alert"></p>
  </details>
  <label class="form-check"><input id="form-symmetric" type="checkbox"> <span id="form-symmetric-label">左右対称（X=0）</span></label>
  <details id="form-symmetry-plane">
   <summary>左右対称の基準面</summary>
   <label><span id="form-symmetry-label">対称面の位置 X (mm)</span><input id="form-symmetry-offset" type="number" min="-10000" max="10000" step="0.1"></label>
   <div class="form-actions form-history"><button type="button" id="form-symmetry-pick">ソリッドの平面を選ぶ</button><button type="button" id="form-symmetry-reset">中央に戻す</button></div>
   <label>中心線のスケッチ<select id="form-symmetry-source"></select></label>
   <div class="form-actions"><button type="button" id="form-symmetry-use">中心線を対称面にする</button></div>
   <p>フォームの左右方向に直交する平面か、下絵などに沿って描いた中心線を選べます。対称を使用中は、固定していない断面を新しい中心へ移動します。</p>
   <p id="form-symmetry-note" role="status"></p>
  </details>
  <label>断面<select id="form-section"></select></label>
  <label class="form-check"><input id="form-lock" type="checkbox"> この断面の輪郭と高さを固定</label>
  <label><span id="form-z-label">断面の高さ Z (mm)</span><input id="form-z" type="number" step="0.1"></label>
  <details id="form-size">
   <summary>断面の幅・高さを調整</summary>
   <div class="form-coordinate-row">
    <label>幅 U (mm)<input id="form-width" type="number" min="0.1" max="20000" step="any"></label>
    <label>高さ V (mm)<input id="form-height" type="number" min="0.1" max="20000" step="any"></label>
   </div>
   <label>高さの固定位置<select id="form-size-anchor"><option value="center">中央</option><option value="bottom">下端</option><option value="top">上端</option></select></label>
   <p id="form-size-note" role="status"></p>
   <div class="form-actions"><button type="button" id="form-resize">幅・高さを反映</button></div>
  </details>
  <label>制御点<select id="form-point"></select></label>
  <div class="form-coordinate-row">
   <label><span id="form-x-label">X (mm)</span><input id="form-x" type="number" step="0.1"></label>
   <label><span id="form-y-label">Y (mm)</span><input id="form-y" type="number" step="0.1"></label>
  </div>
  <details id="form-points">
   <summary>制御点を追加・角を残す</summary>
   <div class="form-actions form-history"><button type="button" id="form-add-point">次の点との間に追加</button><button type="button" id="form-delete-point">追加点を削除</button></div>
   <label class="form-check"><input id="form-corner" type="checkbox"> この点を角にする</label>
   <div class="form-actions"><button type="button" id="form-corner-all">同じ位置の断面にも反映</button></div>
   <p>追加は選んだ断面のこの区間に適用します。角は丸めずに残します。</p>
  </details>
  <details id="form-seam">
   <summary>既存の平面に滑らかにつなぐ</summary>
   <p>始端か終端の断面で点を選びます。その点から次の点までを、断面と同じ位置にある平面の境界辺に合わせます。</p>
   <div class="form-actions"><button type="button" id="form-seam-pick">接続する平面を画面で選ぶ</button></div>
   <div id="form-seam-list"></div>
   <div class="form-actions"><button type="button" id="form-seam-clear">すべての接続を解除</button></div>
   <p id="form-seam-note" role="status"></p>
  </details>
  <details id="form-wall">
   <summary>外形を保って薄肉化する</summary>
   <label class="form-check"><input type="checkbox" id="form-wall-enabled"> 内側に壁厚を付ける</label>
   <label>壁厚 (mm)<input id="form-wall-thickness" type="number" min="0.1" max="100" step="0.1" value="2"></label>
   <label>開口する端<select id="form-wall-opening"><option value="start">始端</option><option value="end">終端</option><option value="both">両端</option></select></label>
   <p id="form-wall-result" role="status"></p>
   <div id="form-wall-search-tools" hidden>
    <div class="form-actions"><button type="button" id="form-wall-search">壁厚候補を探す</button></div>
    <p id="form-wall-search-status" role="status"></p>
    <div id="form-wall-candidates" class="form-candidate-list"></div>
   </div>
  </details>
  <details id="form-outline-compare">
   <summary>下絵の輪郭とのズレを表示</summary>
   <label>比較する閉じたスケッチ輪郭<select id="form-outline-source"></select></label>
   <label>許容差 (mm)<input id="form-outline-tolerance" type="number" min="0.1" max="50" step="0.1" value="1"></label>
   <p>下絵からスケッチ化した輪郭を選びます。青は下絵、緑は許容差内、赤は張り出し、橙は不足です。</p>
   <p id="form-outline-result" role="status"></p>
  </details>
  <details id="form-guides">
   <summary>ガイド線で曲面を整える</summary>
   <label>スケッチのガイド線<select id="form-guide-source"></select></label>
   <div class="form-actions"><button type="button" id="form-guide-add">選んだ制御点にガイドを追加</button></div>
   <div id="form-guide-list"></div>
   <p>断面の進行方向に沿い、両端の断面に届く線や開いたスプラインを選びます。水平断面では XZ・YZ が対象です。</p>
   <p id="form-guide-error" class="form-invalid" role="alert"></p>
  </details>
  <label>ソフト編集の範囲 <output id="form-soft-value"></output><input id="form-soft" type="range" min="0" max="100" step="1" aria-label="ソフト編集の範囲"></label>
  <div class="form-actions"><button type="button" id="form-insert">中間断面を追加</button><button type="button" id="form-remove">断面を削除</button></div>
  <div class="form-view-options">
   <label class="form-check"><input id="form-zebra" type="checkbox"> ゼブラ表示</label>
   <label class="form-check"><input id="form-compare" type="checkbox"> 変更前の輪郭</label>
  </div>
  <details id="form-curvature">
   <summary>曲面のうねりを表示・補正</summary>
   <label class="form-check"><input type="checkbox" id="form-heat"> 曲率の変化を色で表示</label>
   <p id="form-heat-note">黄色から赤ほど曲がり方の変化が大きい箇所です。表示用メッシュから推定します。</p>
   <p>色付きの曲面をクリックすると近くの制御点を選びます。制御点を直接選ぶこともできます。</p>
   <label>補正の強さ <output id="form-smooth-value">30%</output><input type="range" id="form-smooth-strength" min="5" max="80" value="30"></label>
   <div class="form-actions"><button type="button" id="form-smooth-preview">部分補正をプレビュー</button></div>
   <div id="form-smooth-actions" class="form-actions form-history" hidden>
    <button type="button" id="form-smooth-cancel">補正を取り消す</button><button type="button" id="form-smooth-apply">補正を適用</button>
   </div>
   <p id="form-smooth-note" role="status"></p>
  </details>
  <details id="form-clearance">
   <summary>既存ボディとの干渉・隙間</summary>
   <label>比較するボディ<select id="form-clearance-target"></select></label>
   <label>確保したい隙間 (mm)<input type="number" id="form-clearance-gap" min="0" max="10000" step="any" value="0.3"></label>
   <div class="form-actions"><button type="button" id="form-clearance-check">干渉・隙間を確認</button></div>
   <p id="form-clearance-note" role="status"></p>
  </details>
  <p id="form-status" role="status"></p>
  <div class="form-actions"><button type="button" id="form-cancel">キャンセル</button><button type="button" id="form-apply">ソリッドに変換</button></div>`;
 document.body.append(dialog);
 draggableDialog(dialog);
 const $=id=>dialog.querySelector('#form-'+id);
 const overlay=document.createElement('div');
 overlay.className='form-control-overlay';
 overlay.hidden=true;host.append(overlay);
 const raycaster=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,0,1)),viewDirection=new THREE.Vector3();
 let form,editing,original,baseline,section=0,point=0,group,preview,markers=[],drag,hiddenMesh,axes=formBasis();
 let sources=[],lofts=[],listedRegions,guideSources=[],view='iso',displayRings=[],bindings=[],pickingSeam=false,seamRequest=0;
 let comparison,previewMesh,outlineSources=[],outlineRegions,outlineByView={},comparisonRevision=0;
 let wallOverlay,undoStack=[],redoStack=[],checkpoint,wallSearch,wallSearchTimer,wallFailure;
 let fastPreview,dragFrame=0,pickingSymmetry=false,symmetrySources=[];
 let sizeRing,sizePoints,heatSource,heatValues,smoothDraft,smoothOverlay,clearanceJob,clearanceOverlay;
 let revision=0,timer,working=false,busy=false,issue=null,ready=-1,fitPending=false;
 const active=()=>dialog.open;
 const current=()=>active()&&getFeatures()===original;

 function dispose(object){
  if(!object)return;
  object.removeFromParent();
  object.traverse(child=>{child.geometry?.dispose();child.material?.dispose();});
 }
 function clear(){
  revision++;clearTimeout(timer);busy=false;drag=null;ready=-1;issue=null;
  dispose(group);dispose(preview);group=preview=null;
  comparisonRevision++;dispose(comparison);comparison=previewMesh=null;stopFacePick();
  clearFastPreview();clearWallSearch();
  clearSmoothing();clearClearance();clearanceKernel.reset();
  heatSource=heatValues=sizeRing=sizePoints=null;delete host.dataset.formCurvature;
  dispose(wallOverlay);wallOverlay=null;undoStack=[];redoStack=[];checkpoint=null;
  overlay.replaceChildren();overlay.hidden=true;markers=[];
  setReference(undefined);delete host.dataset.formView;
  if(hiddenMesh){const {mesh,visible}=hiddenMesh;if(mesh.parent)mesh.visible=visible;hiddenMesh=null;}
 }
 function close(){
  if(!active())return;
  dialog.close();clear();
 }
 function text(message,error=false){
  $('status').textContent=message;$('status').classList.toggle('form-invalid',error);
 }
 function field(input,value){
  if(document.activeElement!==input)input.value=Number(value.toFixed(3));
 }
 function capture(){
  return {data:JSON.stringify(form),section,point,editing,baseline};
 }
 function record(){
  const next=capture();
  if(checkpoint&&next.data===checkpoint.data&&next.editing===checkpoint.editing)return;
  if(checkpoint){
   undoStack.push(checkpoint);
   if(undoStack.length>formUndoLimit)undoStack.shift();
  }
  redoStack=[];checkpoint=next;
 }
 function syncHistory(){
  $('undo').disabled=busy||Boolean(drag)||!undoStack.length;
  $('redo').disabled=busy||Boolean(drag)||!redoStack.length;
 }
 function travelHistory(direction){
  const from=direction==='undo'?undoStack:redoStack,to=direction==='undo'?redoStack:undoStack;
  if(!current()||busy||drag||!from.length)return false;
  const prior=from.pop();
  to.push(capture());checkpoint=prior;
  const previousOrientation=form.orientation;
  const previousSymmetry=formSymmetryU(form);
  form=JSON.parse(prior.data);section=prior.section;point=prior.point;
  baseline=prior.baseline;
  stopFacePick();setDraftFeature(prior.editing);
  fitPending=JSON.stringify(previousOrientation)!==JSON.stringify(form.orientation)||previousSymmetry!==formSymmetryU(form);
  syncGuides();syncSeamList();structure();changed(false);syncView();
  if($('sources').open)listSources();
  if($('guides').open)listGuideSources();
  if($('symmetry-plane').open)listSymmetrySources();
  return true;
 }
 function syncFields(){
  const ring=form.rings[section],locked=ring.locked||busy;
  const effective=displayRings[section],knot=formKnots(ring)[point];
  const seams=formSeams(form),endSeams=formSeamsAt(form,section),atSeam=endSeams.length>0;
  const fixedPoint=endSeams.some(seam=>[seam.from,seam.to].includes(knot));
  const orientation=form.orientation??defaultFormOrientation;
  $('base-plane').value=orientation.plane;
  field($('tilt-u'),orientation.tiltU);field($('tilt-v'),orientation.tiltV);
  const fixedOrientation=seams.length>0||form.rings.some(r=>r.reference);
  for(const key of ['base-plane','tilt-u','tilt-v'])$(key).disabled=busy||fixedOrientation;
  $('orientation-help').textContent=fixedOrientation?'取り込んだ輪郭や接続を保持している間は、断面の向きが固定されます。':'全断面と設定済みのガイドをまとめて回転します。';
  const local=orientation.plane!=='XY'||orientation.tiltU!==0||orientation.tiltV!==0;
  $('x-label').textContent=(local?'断面内 U':'X')+' (mm)';$('y-label').textContent=(local?'断面内 V':'Y')+' (mm)';
  $('z-label').textContent=(local?'断面の位置 W':'断面の高さ Z')+' (mm)';
  const symmetryU=formSymmetryU(form),symmetryAxis=local?'U':'X';
  $('symmetric-label').textContent='左右対称（'+symmetryAxis+' = '+Number(symmetryU.toFixed(3))+' mm）';
  $('symmetry-label').textContent='対称面の位置 '+symmetryAxis+' (mm)';
  field($('symmetry-offset'),symmetryU);
  $('section').value=String(section);$('section').disabled=busy;
  $('point').value=String(point);$('point').disabled=busy;
  $('symmetric').checked=form.symmetric;$('symmetric').disabled=busy||seams.length>0;
  const noSymmetry=busy||seams.length>0||form.rings.every(r=>r.locked);
  $('symmetry-offset').disabled=noSymmetry;
  $('symmetry-pick').disabled=!pickingSymmetry&&(noSymmetry||![...meshes.values()].some(mesh=>mesh.visible));
  $('symmetry-reset').disabled=noSymmetry||!form.symmetryPlane;
  $('symmetry-source').disabled=noSymmetry||!symmetrySources.length;
  $('symmetry-use').disabled=noSymmetry||!$('symmetry-source').value;
  $('lock').checked=ring.locked;$('lock').disabled=busy||atSeam;
  $('lock').title=ring.reference?'固定を外すと、元の輪郭を制御点で近似して編集します。':'';
  $('soft').value=String(form.soft??0);$('soft').disabled=busy||Boolean(drag);
  $('soft-value').textContent=form.soft?form.soft+'%':'オフ';
  for(const [axis,key] of ['x','y'].entries()){
   const guide=bindings.find(entry=>entry.knot===knot&&entry.guide.axis===axis);
   $(key).disabled=locked||fixedPoint||Boolean(guide)||axis===0&&form.symmetric&&formMirrorPoint(ring,point)===point;
   $(key).title=guide?'ガイド線の位置を使用しています。':'';
   field($(key),effective.points[point][axis]);
  }
  $('z').disabled=locked||atSeam;field($('z'),ring.z);
  $('add-point').disabled=locked||endSeams.some(seam=>knot===seam.from)||ring.points.length>=formPointLimit;
  $('delete-point').disabled=busy||!canRemoveFormPoint(form,section,point);
  $('corner').disabled=locked;$('corner').checked=Boolean(ring.corners?.includes(knot));
  $('corner-all').disabled=locked||!form.rings.some((other,i)=>i!==section&&!other.locked&&formKnots(other).includes(knot));
  $('guide-add').disabled=busy||!$('guide-source').value||!Number.isInteger(knot)||(form.guides?.length??0)>=formGuideLimit;
  for(const button of $('guide-list').querySelectorAll('button'))button.disabled=busy;
  $('insert').disabled=busy||form.rings.length>=formSectionLimit;
  $('remove').disabled=locked||atSeam||form.rings.length<=2;
  $('seam-pick').disabled=!pickingSeam&&(busy||locked||section!==0&&section!==form.rings.length-1||
   form.rings.some(r=>r.reference)||![...meshes.values()].some(mesh=>mesh.visible)||
   seams.length>=formSeamLimit&&!endSeams.some(seam=>seam.from===knot));
  $('seam-clear').disabled=busy||!seams.length;
  for(const button of $('seam-list').querySelectorAll('button'))button.disabled=busy;
  const wall=form.wall??defaultWall;
  $('wall-enabled').checked=Boolean(form.wall);$('wall-enabled').disabled=busy;
  field($('wall-thickness'),wall.thickness);$('wall-thickness').disabled=busy||!form.wall;
  $('wall-opening').value=wall.opening;$('wall-opening').disabled=busy||!form.wall;
  syncHistory();
  syncSectionSize();syncSmoothing();syncClearance();
  $('apply').disabled=busy||Boolean(smoothDraft)||ready!==revision;
  $('reference').disabled=busy;
  $('import-sketches').disabled=busy||$('sketches').selectedOptions.length<2;
  $('import-loft').disabled=busy||!$('loft').value;
 }
 function select(s,p){
  stopFacePick();
  clearSmoothing();
  const knot=formKnots(form.rings[section])[point];
  section=s;
  if(p===undefined){
   const knots=formKnots(form.rings[s]);
   point=knots.reduce((best,value,i)=>Math.abs(value-knot)<Math.abs(knots[best]-knot)?i:best,0);
  }else point=p;
  if(checkpoint){checkpoint.section=section;checkpoint.point=point;}
  pointChoices();syncFields();draw();updateMarkers();
 }
 function projectedReferences(){
  const axis=view==='front'?'y':view==='right'?'x':'z';
  return original.filter(feature=>feature.kind==='referenceImage'&&!feature.surface&&Math.abs(basisFor(feature).n[axis])>1-1e-8);
 }
 function syncReference(){
  $('reference-field').hidden=view==='iso';
  if(view==='iso'){setReference(undefined);return;}
  const options=projectedReferences(),saved=form.references?.[view];
  const id=saved===undefined?options.find(f=>!f.hidden)?.id??'':options.some(f=>f.id===saved)?saved:'';
  $('reference').replaceChildren(new Option('なし',''),...options.map(f=>new Option(f.name,f.id)));
  $('reference').value=id;
  setReference(id||null);
 }
 function cameraView(){
  const {x,y,z}=camera.getWorldDirection(viewDirection);
  return z<-.9999?'top':y>.9999?'front':x<-.9999?'right':'iso';
 }
 function syncView(){
  host.dataset.formView=view;
  for(const button of dialog.querySelectorAll('[data-form-view]'))
   button.setAttribute('aria-pressed',String(button.dataset.formView===view));
  const normal=Math.abs(camera.getWorldDirection(viewDirection).dot(axes.n));
  $('view-help').textContent=normal>.999?'選択した断面の制御点を表示します。':
   normal<.035?'断面を横から見る方向では、ドラッグで断面の位置も変更できます。':
   '制御点をドラッグして、断面内の位置を調整します。';
  syncReference();
  if($('outline-compare').open)listOutlines();
 }
 function chooseView(next){
  if(drag)finishDrag();
  setView(next);camera.updateMatrixWorld(true);
  view=next;syncView();updateMarkers();
 }
 function syncGuides(){
  $('guide-list').replaceChildren(...(form.guides??[]).map((guide,i)=>{
   const row=document.createElement('div'),label=document.createElement('span'),remove=document.createElement('button');
   row.className='form-guide-row';
   label.textContent=(guide.axis===0?'正面':'側面')+'・基準点 '+(guide.knot+1)+' ／ '+guide.name;
   remove.type='button';remove.textContent='解除';remove.onclick=()=>{
    form.guides.splice(i,1);$('guide-error').textContent='';syncGuides();changed();
   };
   row.append(label,remove);return row;
  }));
 }
 function syncSeamNote(message){
  const count=form?formSeams(form).length:0;
  $('seam-note').textContent=message??(pickingSeam?'モデル上で接続先の平面をクリックしてください。':
   count?'接続先 '+count+' 箇所 ／ 緑の辺で傾きを合わせます。':'接続を設定すると左右対称は解除されます。');
  $('seam-pick').textContent=pickingSeam?'面の選択をやめる':'接続する平面を画面で選ぶ';
  $('seam-pick').setAttribute('aria-pressed',String(pickingSeam));
 }
 function replaceSeams(seams){
  delete form.seam;
  if(seams.length)form.seams=seams;else delete form.seams;
 }
 function syncSeamList(){
  $('seam-list').replaceChildren(...formSeams(form).map((seam,i)=>{
   const row=document.createElement('div'),label=document.createElement('span'),remove=document.createElement('button');
   row.className='form-guide-row';
   label.textContent=(seam.end==='start'?'始端':'終端')+' ／ '+seam.name;
   remove.type='button';remove.textContent='解除';
   remove.onclick=()=>{replaceSeams(formSeams(form).filter((_,j)=>j!==i));stopFacePick();syncSeamList();changed();};
   row.append(label,remove);return row;
  }));
 }
 function syncSymmetryNote(message){
  $('symmetry-note').textContent=message??(pickingSymmetry?'モデル上で対称面にする平面をクリックしてください。':
   form?.symmetryPlane?.source?'対称面の基準 ／ '+form.symmetryPlane.source:'');
  $('symmetry-pick').textContent=pickingSymmetry?'面の選択をやめる':'ソリッドの平面を選ぶ';
  $('symmetry-pick').setAttribute('aria-pressed',String(pickingSymmetry));
 }
 function stopFacePick(){
  seamRequest++;pickingSeam=pickingSymmetry=false;delete host.dataset.formSeamPick;
  syncSeamNote();syncSymmetryNote();
 }
 function applySymmetryPlane(u,source){
  const draft=structuredClone(form),knot=formKnots(form.rings[section])[point];
  setFormSymmetryPlane(draft,source?{u,source:source.slice(0,100)}:{u});
  validateFormProfile(draft);
  form=draft;point=formKnots(form.rings[section]).indexOf(knot);
  stopFacePick();structure();fitPending=true;changed();
 }
 function pickFace(event){
  if(!pickingSeam&&!pickingSymmetry||event.button!==0||!current())return;
  event.stopImmediatePropagation();event.preventDefault();
  const symmetry=pickingSymmetry,note=symmetry?syncSymmetryNote:syncSeamNote;
  const rect=host.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);
  const hit=raycaster.intersectObjects([...meshes.values()].filter(mesh=>mesh.visible),false)[0];
  if(!hit){note('既存ソリッドの平面をクリックしてください。');return;}
  const request=++seamRequest,mesh=hit.object;
  Promise.resolve(mesh.userData.drawingCoordinatesReady).then(()=>{
   if(!current()||request!==seamRequest)return;
   const data=mesh.geometry.userData;
   const group=data.faceGroups?.find(g=>hit.faceIndex*3>=g.start&&hit.faceIndex*3<g.start+g.count);
   if(group&&data.planarFaces&&!data.planarFaces.includes(group.faceId))throw Error('既存ソリッドの平面を選んでください。');
   const face=planarFace(mesh.geometry,hit.faceIndex),ring=form.rings[section];
   if(symmetry){applySymmetryPlane(symmetryFromFace(face,axes),bodyName(mesh.userData.bodyId));return;}
   const seam=findFormSeam(face,axes,displayRings[section],formKnots(ring),point,formSeamEnd(form,section),bodyName(mesh.userData.bodyId));
   const draft={...form,seams:addFormSeam(form,seam),symmetric:false};delete draft.seam;
   validateFormProfile(draft);
   form=draft;stopFacePick();syncSeamList();changed();
  }).catch(error=>{if(current()&&request===seamRequest)note(error.message??'平面を取得できません。');});
 }
 host.addEventListener('pointerdown',pickFace,true);
 let heatClick;
 host.addEventListener('pointerdown',event=>{
  heatClick=event.button===0&&event.target.matches('canvas')&&current()&&$('curvature').open&&host.dataset.formCurvature==='visible'&&
   !pickingSeam&&!pickingSymmetry?[event.clientX,event.clientY]:null;
 },true);
 host.addEventListener('click',event=>{
  const from=heatClick;heatClick=null;
  if(!from||!event.target.matches('canvas')||!current()||busy||ready!==revision||
   Math.hypot(event.clientX-from[0],event.clientY-from[1])>4)return;
  const rect=host.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);
  const hit=raycaster.intersectObject(preview,false)[0];
  if(!hit||raycaster.intersectObjects([...meshes.values()].filter(mesh=>mesh.visible),false)[0]?.distance<hit.distance-1e-4)return;
  let best=Infinity,choice;
  for(const [s,ring] of displayRings.entries())for(const [p,position] of ring.points.entries()){
   if(!formSmoothAxes(form,s,p,bindings).some(Boolean))continue;
   const distance=hit.point.distanceToSquared(formWorld(axes,...position,ring.z));
   if(distance<best){best=distance;choice=[s,p];}
  }
  if(choice){event.stopImmediatePropagation();select(...choice);$('smooth-note').textContent='断面 '+(section+1)+' の制御点 '+(point+1)+' を選択しました。';}
 },true);
 function listOutlines(){
  outlineRegions=getRegions();
  outlineSources=outlineRegions.flatMap(region=>{
   const points=projectFormOutline(region,view);
   return points?[{region,points}]:[];
  });
  const names=new Map(original.map(feature=>[feature.id,feature.groupNumber?'スケッチ'+feature.groupNumber:feature.name]));
  $('outline-source').replaceChildren(new Option(view==='iso'?'正面・右側面・上面を選択':
   outlineSources.length?'閉じた輪郭を選択':'この視点に平行な閉じた輪郭がありません',''),
   ...outlineSources.map(({region},i)=>new Option((names.get(region.sourceIds?.[0])||'輪郭')+' ／ '+Number(region.area.toFixed(2))+' mm²',i)));
  const index=outlineSources.findIndex(({region})=>region.id===outlineByView[view]);
  $('outline-source').value=index<0?'':String(index);
  $('outline-source').disabled=!outlineSources.length;
  drawComparison();
 }
 async function drawComparison(){
  const token=++comparisonRevision,projectionView=view;
  dispose(comparison);comparison=null;
  $('outline-result').textContent='';
  if(!$('outline-compare').open||!formProjection[view]||!$('outline-source').value)return;
  if(!previewMesh){$('outline-result').textContent='曲面のプレビューを待っています…';return;}
  const {points,region}=outlineSources[Number($('outline-source').value)],tolerance=$('outline-tolerance').valueAsNumber;
  if(!Number.isFinite(tolerance)||tolerance<.1||tolerance>50){$('outline-result').textContent='許容差を0.1〜50 mmで指定してください。';return;}
  try{
   $('outline-result').textContent='輪郭を比較しています…';
   const {vertices,triangles}=previewMesh;
   const report=await kernel.run([],{type:'formOutlineComparison',view:projectionView,outline:points,tolerance,mesh:{vertices,triangles}});
   if(token!==comparisonRevision||!current())return;
   const normal=formProjection[projectionView].normal,basis=basisFor(region),offset=basis.n.getComponent(normal)*region.offset;
   comparison=new THREE.Group();
   function add(segments,color){
    if(!segments.length)return;
    const vertices=segments.flatMap(({p,q})=>[formProjectionPoint(projectionView,p,offset),formProjectionPoint(projectionView,q,offset)]);
    const line=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(vertices),new THREE.LineBasicMaterial({color,depthTest:false}));
    line.renderOrder=68;comparison.add(line);
   }
   add(report.referenceSegments.filter(segment=>!segment.missing),0x246cdd);
   add(report.referenceSegments.filter(segment=>segment.missing),0xe88514);
   for(const [state,color] of Object.entries({match:0x05986f,inside:0xe88514,outside:0xd63841}))
    add(report.segments.filter(segment=>segment.state===state),color);
   scene.add(comparison);
   $('outline-result').textContent='最大のズレ 約 '+Number(report.max.toFixed(2))+' mm（プレビュー形状）';
  }catch(error){if(token===comparisonRevision&&current())$('outline-result').textContent=error.message;}
 }
 function drawGuides(){
  if(form.rings.some((ring,i)=>i&&ring.z<=form.rings[i-1].z))return;
  for(const binding of bindings){
   const {guide,knot}=binding;
   const min=form.rings[0].z,max=form.rings.at(-1).z;
   const heights=[...new Set([...form.rings.map(r=>r.z),...guide.points.map(([z])=>z).filter(z=>z>min&&z<max)])].sort((a,b)=>a-b);
   const vertices=heights.map(z=>{
    const i=Math.max(1,displayRings.findIndex(r=>r.z>=z));
    const a=displayRings[i-1],b=displayRings[i],axis=1-guide.axis;
    const start=a.points[formKnots(a).indexOf(knot)][axis],end=b.points[formKnots(b).indexOf(knot)][axis];
    const coordinates=[];coordinates[axis]=start+(end-start)*(z-a.z)/(b.z-a.z);
    coordinates[guide.axis]=formGuideCoordinate(binding,z);
    return formWorld(axes,...coordinates,z);
   });
   const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(vertices),
    new THREE.LineDashedMaterial({color:0xc3288d,dashSize:1.8,gapSize:.85,depthTest:false}));
   line.computeLineDistances();line.renderOrder=62;group.add(line);
  }
 }
 function draw(){
  dispose(group);group=new THREE.Group();
  if($('compare').checked)for(const {points} of baseline){
   const vertices=[...points,points[0]];
   const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(vertices),
    new THREE.LineDashedMaterial({color:0x374753,dashSize:1.6,gapSize:1.1,depthTest:false}));
   line.computeLineDistances();line.renderOrder=61;group.add(line);
  }
  const bad=new Set(issue?.formSections||[]);
  for(const [i,ring] of displayRings.entries()){
   const outline=formRingOutline(ring,axes),vertices=outline.map(([x,y])=>formWorld(axes,x,y,ring.z));
   const geometry=new THREE.BufferGeometry().setFromPoints(vertices);
   const color=bad.has(i)?0xd73540:ring.locked?0xe59526:i===section?0x148bd4:0x72a5bd;
   const line=new THREE.LineLoop(geometry,new THREE.LineBasicMaterial({color,depthTest:false}));
   line.renderOrder=60;group.add(line);
  }
  drawGuides();
  if(form.symmetric&&$('symmetry-plane').open){
   const u=formSymmetryU(form),ys=displayRings.flatMap(ring=>ring.points.map(p=>p[1]));
   const a=Math.min(...ys),b=Math.max(...ys),start=displayRings[0].z,end=displayRings.at(-1).z;
   const geometry=new THREE.BufferGeometry().setFromPoints([[u,a,start],[u,b,start],[u,b,end],[u,a,end],[u,a,start]].map(p=>formWorld(axes,...p)));
   const outline=new THREE.Line(geometry,new THREE.LineDashedMaterial({color:0x158476,dashSize:1.8,gapSize:1,depthTest:false}));
   outline.computeLineDistances();outline.renderOrder=63;group.add(outline);
  }
  for(const {a,b,z} of formSeams(form)){
   const geometry=new THREE.BufferGeometry().setFromPoints([formWorld(axes,...a,z),formWorld(axes,...b,z)]);
   const seam=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0x12aa7d,depthTest:false}));
   seam.renderOrder=66;group.add(seam);
  }
  for(const xyz of issue?.formPoints||[]){
   const cross=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
    formWorld(axes,xyz[0]-1,xyz[1]-1,xyz[2]),formWorld(axes,xyz[0]+1,xyz[1]+1,xyz[2]),
    formWorld(axes,xyz[0]-1,xyz[1]+1,xyz[2]),formWorld(axes,xyz[0]+1,xyz[1]-1,xyz[2])
   ]),new THREE.LineBasicMaterial({color:0xf02a35,depthTest:false}));
   cross.renderOrder=62;group.add(cross);
  }
  scene.add(group);
  for(const {el,s,p} of markers){
   el.classList.toggle('active',s===section&&p===point);
   el.classList.toggle('locked',form.rings[s].locked);
   el.classList.toggle('seam',formSeamsAt(form,s).some(seam=>[seam.from,seam.to].includes(formKnots(form.rings[s])[p])));
   el.classList.toggle('corner',Boolean(form.rings[s].corners?.includes(formKnots(form.rings[s])[p])));
   el.classList.toggle('invalid',bad.has(s));
   el.setAttribute('aria-pressed',String(s===section&&p===point));
  }
 }
 function addMarker(s,p){
  const el=document.createElement('button');
  el.type='button';el.className='form-control-point';el.dataset.section=s;el.dataset.point=p;
  el.title='断面 '+(s+1)+'・制御点 '+(p+1);el.setAttribute('aria-label',el.title);
  el.addEventListener('click',()=>{if(!busy)select(s,p);});
  el.addEventListener('pointerdown',event=>{
   if(event.button!==0||busy||pickingSeam||pickingSymmetry)return;
   event.stopPropagation();event.preventDefault();el.focus({preventScroll:true});select(s,p);
   const ring=form.rings[s],seams=formSeamsAt(form,s);
   if(ring.locked||seams.some(seam=>[seam.from,seam.to].includes(formKnots(ring)[p])))return;
   const [dx,dy,dz]=formLocal(axes,camera.getWorldDirection(viewDirection));
   const axis=Math.abs(dz)>=.035?'z':Math.abs(dx)>Math.abs(dy)?'x':'y';
   const origin=new THREE.Vector3(...displayRings[s].points[p],ring.z);
   const at=projectToPlane(event,origin,axis);
   if(!at)return;
   drag={el,id:event.pointerId,s,p,origin,axis,at,x:ring.points[p][0],y:ring.points[p][1],
    from:form.rings.map(ring=>({points:ring.points.map(point=>point.slice())}))};
   el.setPointerCapture(event.pointerId);
   syncHistory();
  });
  el.addEventListener('pointermove',event=>{
   if(drag?.id!==event.pointerId||drag.el!==el)return;
   const {s,p,origin,axis}=drag,at=projectToPlane(event,origin,axis);
   if(!at)return;
   const ring=form.rings[s],knot=formKnots(ring)[p],snap=n=>Math.round(n*100)/100;
   const isGuided=axis=>bindings.some(entry=>entry.knot===knot&&entry.guide.axis===axis);
   if(axis!=='z'&&!formSeamsAt(form,s).length){
    const lower=Math.max((form.rings[s-1]?.z??-10000)+.1,...(form.guides??[]).map(guide=>guide.points[0][0]));
    const upper=Math.min((form.rings[s+1]?.z??10000)-.1,...(form.guides??[]).map(guide=>guide.points.at(-1)[0]));
    ring.z=THREE.MathUtils.clamp(snap(origin.z+at.z-drag.at.z),lower,upper);
   }
   const x=axis==='x'||isGuided(0)?drag.x:snap(drag.x+at.x-drag.at.x);
   const y=axis==='y'||isGuided(1)?drag.y:snap(drag.y+at.y-drag.at.y);
   if(moveFormPoint(form,s,p,x,y,{from:drag.from}))changed();
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(type,event=>{
   if(drag?.id===event.pointerId&&drag.el===el)finishDrag();
  });
  overlay.append(el);return {el,s,p};
 }
 function projectToPlane(event,origin,axis){
  const box=host.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((event.clientX-box.left)/box.width*2-1,1-(event.clientY-box.top)/box.height*2),camera);
  const normal=axes[{x:'u',y:'v',z:'n'}[axis]];
  if(Math.abs(raycaster.ray.direction.dot(normal))<.035)return null;
  plane.normal.copy(normal);plane.constant=-origin[axis];
  const hit=raycaster.ray.intersectPlane(plane,new THREE.Vector3());
  return hit?new THREE.Vector3(...formLocal(axes,hit)):null;
 }
 function pointChoices(){
  $('point').replaceChildren(...formKnots(form.rings[section]).map((knot,i)=>
   new Option(Number.isInteger(knot)?'基準点 '+(knot+1):'追加点 '+(i+1),i)));
 }
 function syncSectionSize(){
  if(!$('size').open||drag)return;
  const ring=displayRings[section],editable=formSectionSizeAxes(form,section,bindings);
  if(sizeRing!==form.rings[section]||sizePoints!==ring.points){
   sizeRing=form.rings[section];sizePoints=ring.points;
   const {size}=formSectionBounds(ring,axes);
   ['width','height'].forEach((key,i)=>$(key).value=Number(size[i].toFixed(3)));
  }
  $('width').disabled=busy||!editable[0];$('height').disabled=busy||!editable[1];
  $('size-anchor').disabled=$('height').disabled;
  $('resize').disabled=busy||!editable.some(Boolean);
  $('size-note').textContent=ring.locked?'固定した断面です。':
   formSeamsAt(form,section).length?'接続先の境界を固定している断面です。':
    editable.every(Boolean)?'幅は中央から調整します。左右対称の場合は対称面を保ちます。':'ガイド線が決めている方向の寸法は固定されます。';
 }
 function syncHeat(){
  if(!preview)return;
  const show=$('heat').checked;
  if(show&&previewMesh&&heatSource!==previewMesh){
   heatSource=previewMesh;heatValues=formCurvatureChanges(previewMesh);
  }
  if(show&&previewMesh&&heatValues){
   const base=new THREE.Color(0x517d92),yellow=new THREE.Color(0xffcf42),red=new THREE.Color(0xeb353d);
   const rgb=new Float32Array(heatValues.length*3),color=new THREE.Color();
   heatValues.forEach((value,i)=>{
    const t=THREE.MathUtils.smoothstep(value,.08,.55);
    if(t<.5)color.copy(base).lerp(yellow,2*t);else color.copy(yellow).lerp(red,2*t-1);
    color.toArray(rgb,i*3);
   });
   preview.geometry.setAttribute('color',new THREE.BufferAttribute(rgb,3));
   preview.material.dispose();
   preview.material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide});
   host.dataset.formCurvature='visible';
  }else{
   preview.material.dispose();preview.material=previewMaterial($('zebra').checked);
   delete host.dataset.formCurvature;
  }
  $('heat-note').textContent=show&&previewMesh&&!heatValues?'この表示メッシュでは曲率を推定できませんでした。':
   '黄色から赤ほど曲がり方の変化が大きい箇所です。表示用メッシュから推定します。';
 }
 function clearSmoothing(){
  dispose(smoothOverlay);smoothOverlay=smoothDraft=null;
  $('smooth-note').textContent='';
  delete host.dataset.formSmoothing;
 }
 function syncSmoothing(){
  const editable=formSmoothAxes(form,section,point,bindings).some(Boolean);
  $('smooth-preview').disabled=busy||Boolean(drag)||ready!==revision||!editable;
  $('smooth-actions').hidden=!smoothDraft;
  $('smooth-strength').disabled=busy||!editable;
  if(!editable)$('smooth-note').textContent='固定点、接続端、角を残す点は補正できません。';
 }
 function previewSmoothing(){
  clearSmoothing();
  try{
   smoothDraft=smoothFormPoint(form,section,point,$('smooth-strength').valueAsNumber/100);
   if(!smoothDraft){$('smooth-note').textContent='この制御点には補正できる移動がありません。';return;}
   if(clearanceJob||clearanceOverlay)clearClearance('補正を適用した後にもう一度検査できます。');
   const geometry=formDragGeometry(smoothDraft,axes),ring=effectiveFormRing(smoothDraft,smoothDraft.rings[section]);
   smoothOverlay=new THREE.Group();
   const surface=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({
    color:0x1ab98e,transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2
   }));
   const outline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(formRingOutline(ring,axes).map(p=>formWorld(axes,...p,ring.z))),
    new THREE.LineBasicMaterial({color:0x007e5a,depthTest:false}));
   outline.renderOrder=67;smoothOverlay.add(surface,outline);scene.add(smoothOverlay);
   host.dataset.formSmoothing='preview';
   $('smooth-note').textContent='緑が補正後の簡易外形です。適用すると精密に計算します。';
  }catch(error){clearSmoothing();$('smooth-note').textContent=error.message;}
  finally{syncFields();}
 }
 function clearClearance(message=''){
  if(clearanceJob){const job=clearanceJob;clearanceJob=null;clearanceKernel.cancel(job.id);}
  dispose(clearanceOverlay);clearanceOverlay=null;
  $('clearance-note').textContent=message;
  delete host.dataset.formClearance;
 }
 function clearanceTargets(){
  const excluded=editing?.spec.id||editing?.id;
  return [...meshes].filter(([id,mesh])=>id!==excluded&&mesh.visible).map(([id])=>id);
 }
 function listClearanceTargets(){
  const target=$('clearance-target'),selected=target.value,ids=clearanceTargets();
  target.replaceChildren(new Option(ids.length?'比較するボディを選択':'表示中の別ボディがありません',''),
   ...ids.map(id=>new Option(bodyName(id),id)));
  target.value=ids.includes(selected)?selected:'';
  if(!target.value&&ids.length===1)target.value=ids[0];
  syncClearance();
 }
 function syncClearance(){
  const check=$('clearance-check'),running=Boolean(clearanceJob);
  check.textContent=running?'検査を中止':'干渉・隙間を確認';
  check.disabled=!running&&(busy||Boolean(drag||smoothDraft)||ready!==revision||!$('clearance-target').value);
 }
 function drawClearance(row,highlight,near){
  if(!highlight&&!row.points)return;
  clearanceOverlay=new THREE.Group();
  if(highlight){
   const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(highlight.vertices,3));
   geometry.setIndex(highlight.triangles);
   const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({
    color:0xeb3444,transparent:true,opacity:.55,side:THREE.DoubleSide,depthTest:false,depthWrite:false
   }));
   mesh.renderOrder=68;clearanceOverlay.add(mesh);
  }else if(row.points){
   const color=row.status==='interference'?0xeb3444:near?0xf2a125:0x119b78;
   const geometry=new THREE.BufferGeometry().setFromPoints(row.points.map(p=>new THREE.Vector3(...p)));
   const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color,depthTest:false,depthWrite:false}));
   const points=new THREE.Points(geometry.clone(),new THREE.PointsMaterial({
    color,size:8,sizeAttenuation:false,depthTest:false,depthWrite:false
   }));
   line.renderOrder=68;points.renderOrder=69;clearanceOverlay.add(line,points);
  }
  scene.add(clearanceOverlay);
 }
 async function checkClearance(){
  if(clearanceJob){clearClearance('検査を中止しました。');syncClearance();return;}
  const target=$('clearance-target').value,gap=$('clearance-gap').valueAsNumber;
  if(!current()||$('clearance-check').disabled||!clearanceTargets().includes(target))return;
  clearClearance();
  if(!Number.isFinite(gap)||gap<0||gap>10000){
   $('clearance-note').textContent='隙間は0〜10000 mmで指定してください。';return;
  }
  const token=revision,job={id:null};
  clearanceJob=job;syncClearance();
  $('clearance-note').textContent='干渉と最短距離を計算しています…';
  const stillCurrent=()=>current()&&revision===token&&clearanceJob===job;
  try{
   const request=clearanceKernel.run(original,{type:'formClearance',target,form:structuredClone(form)},{timeout:18000,onProgress:progress=>{
    if(stillCurrent())$('clearance-note').textContent=progress.stage;
   }});
   job.id=clearanceKernel.next;
   const {row,highlight}=await request;
   if(!stillCurrent())return;
   if(!row||row.status==='unknown')throw Error('この組合せの干渉を判定できませんでした。');
   const near=row.status==='gap'&&row.distance+1e-6<gap;
   const fmt=value=>Number(value.toPrecision(5));
   $('clearance-note').textContent=bodyName(target)+' ／ '+(row.status==='interference'?'干渉あり '+fmt(row.volume)+' mm³（赤）':
    row.status==='contact'?'接触しています（最短距離 0 mm）':
     '最短距離 '+fmt(row.distance)+' mm'+(near?'（指定の隙間を下回ります・橙）':'（指定の隙間を確保）'));
   drawClearance(row,highlight,near);
   host.dataset.formClearance=near?'near':row.status;
  }catch(error){if(stillCurrent())$('clearance-note').textContent=error.message;}
  finally{if(stillCurrent()){clearanceJob=null;syncClearance();}}
 }
 function structure(){
  const choices=form.rings.map((ring,i)=>new Option('断面 '+(i+1)+(ring.locked?'（固定）':''),i));
  $('section').replaceChildren(...choices);
  overlay.replaceChildren();
  markers=form.rings.flatMap((ring,s)=>ring.points.map((_,p)=>addMarker(s,p)));
  pointChoices();
 }
 function clearFastPreview(){
  if(dragFrame)cancelAnimationFrame(dragFrame);
  dragFrame=0;dispose(fastPreview);fastPreview=null;
  delete host.dataset.formPreviewMode;
 }
 function renderFastPreview(){
  dragFrame=0;
  if(!current()||!drag?.moved)return;
  if(form.rings.some((ring,i)=>i&&ring.z<=form.rings[i-1].z)){draw();updateMarkers();return;}
  const geometry=formDragGeometry(form,axes);
  if(fastPreview){fastPreview.geometry.dispose();fastPreview.geometry=geometry;}
  else{fastPreview=new THREE.Mesh(geometry,previewMaterial(false));scene.add(fastPreview);}
  if(preview)preview.visible=false;
  host.dataset.formPreviewMode='fast';
  draw();updateMarkers();
 }
 function finishDrag(){
  const {el,id,moved,deferred}=drag;
  if(moved&&dragFrame){cancelAnimationFrame(dragFrame);renderFastPreview();}
  drag=null;
  if(el.hasPointerCapture(id))el.releasePointerCapture(id);
  record();syncFields();
  if(moved){
   host.dataset.formPreviewMode='calculating';text('曲面を精密計算しています…');
   if(form.wall)$('wall-result').textContent='内側の形状を確認しています…';
  }
  if(moved||deferred){clearTimeout(timer);timer=setTimeout(refresh,0);}
 }
 function syncWallSearch(){
  $('wall-search-tools').hidden=!wallFailure;
  $('wall-search').textContent=wallSearch?'候補の計算を中止':'壁厚候補を探す';
 }
 function cancelWallSearch(){
  clearTimeout(wallSearchTimer);
  const job=wallSearch;
  wallSearch=null;
  if(job)wallKernel.cancel(job.id);
 }
 function clearWallSearch(){
  cancelWallSearch();wallFailure=null;
  $('wall-candidates').replaceChildren();$('wall-search-status').textContent='';
  syncWallSearch();
 }
 function renderWallCandidates(values){
  $('wall-candidates').replaceChildren(...values.slice().sort((a,b)=>Math.abs(a-form.wall.thickness)-Math.abs(b-form.wall.thickness)).map(thickness=>{
   const button=document.createElement('button');
   button.type='button';button.textContent=thickness+' mm を使う';
   button.onclick=()=>{form.wall={...form.wall,thickness};changed();};
   return button;
  }));
 }
 async function searchWall(){
  if(!current()||!wallFailure||wallSearch||drag||busy)return;
  const token=revision,job={id:null,valid:[]};
  wallSearch=job;syncWallSearch();
  $('wall-search-status').textContent='近い壁厚をCADで調べています…';
  $('wall-candidates').replaceChildren();
  const stillCurrent=()=>current()&&token===revision&&wallSearch===job;
  try{
   const request=wallKernel.run([],{type:'formWallSearch',form:structuredClone(form)},{foreground:true,onProgress:progress=>{
    if(!stillCurrent()||!progress.wallCandidates)return;
    job.valid=progress.wallCandidates;
    $('wall-search-status').textContent=progress.stage+'（'+progress.current+' / '+progress.total+'）';
    renderWallCandidates(job.valid);
   }});
   job.id=wallKernel.next;
   const result=await request;
   if(!stillCurrent())return;
   renderWallCandidates(result.valid);
   $('wall-search-status').textContent=result.valid.length?'CADで確認できた候補です。':
    result.tried<result.total?'時間内に通る候補は見つかりませんでした。':'試した範囲では通る候補が見つかりませんでした。';
  }catch(error){
   if(stillCurrent())$('wall-search-status').textContent=job.valid.length?'途中までにCADで確認できた候補です。':'候補の計算を完了できませんでした。';
  }finally{
   if(stillCurrent()){wallSearch=null;syncWallSearch();}
  }
 }
 function changed(save=true){
  if(save&&!drag)record();
  revision++;ready=-1;issue=null;
  axes=formBasis(form.orientation);
  bindings=formGuideBindings(form);displayRings=form.rings.map(ring=>effectiveFormRing(form,ring,bindings));
  previewMesh=heatSource=heatValues=null;delete host.dataset.formCurvature;drawComparison();
  clearSmoothing();
  if(clearanceJob||clearanceOverlay||$('clearance-note').textContent)
   clearClearance('形状が変わりました。必要に応じてもう一度検査してください。');
  dispose(wallOverlay);wallOverlay=null;
  if(wallFailure||wallSearch)clearWallSearch();
  $('wall-result').textContent=form.wall?(drag?'ドラッグ後に薄肉化を計算します。':'内側の形状を確認しています…'):'';
  syncFields();clearTimeout(timer);
  if(drag){
   drag.moved=true;
   if(!dragFrame)dragFrame=requestAnimationFrame(renderFastPreview);
   text('簡易プレビュー ／ 離すと精密計算します');
   return;
  }
  draw();updateMarkers();text('曲面を確認しています…');
  timer=setTimeout(refresh,180);
 }
 async function refresh(){
  if(!current()||working||busy)return;
  if(drag){drag.deferred=true;return;}
  working=true;const token=revision;
  try{
   const input=structuredClone(form);
   validateFormProfile(input);
   const mesh=await kernel.run([],{type:'formPreview',form:input},{timeout:10000,foreground:true});
   if(!current()||token!==revision)return;
   clearFastPreview();
   dispose(preview);
   const geometry=new THREE.BufferGeometry();
   geometry.setAttribute('position',new THREE.Float32BufferAttribute(mesh.vertices,3));
   geometry.setIndex(mesh.triangles);
   if(mesh.normals?.length===mesh.vertices.length)geometry.setAttribute('normal',new THREE.Float32BufferAttribute(mesh.normals,3));
   else geometry.computeVertexNormals();
   preview=new THREE.Mesh(geometry,previewMaterial($('zebra').checked));
   scene.add(preview);
   if(fitPending){fitPending=false;geometry.computeBoundingBox();fit(geometry.boundingBox);}
   const canApply=mesh.formWall?.valid!==false;
   ready=canApply?token:-1;
   text(canApply?'ソリッドに変換できます。固定した断面は橙色で表示します。':'薄肉化を完了できませんでした。壁厚や開口を確認してください。',!canApply);
   if(mesh.formWall)inspectWall(mesh,input.wall,token);
   if(!canApply){
    wallFailure=mesh.formWall;syncWallSearch();
    wallSearchTimer=setTimeout(()=>{if(current()&&revision===token)searchWall();},350);
   }
   previewMesh=mesh;drawComparison();
   if($('heat').checked)syncHeat();
  }catch(error){
   if(current()&&token===revision){clearFastPreview();dispose(preview);preview=null;issue=error.diagnostics;draw();text(error.message,true);$('wall-result').textContent='';}
  }finally{
   working=false;
   if(current()){
    syncFields();
    if(token!==revision&&!drag){clearTimeout(timer);timer=setTimeout(refresh,160);}
   }
  }
 }
 async function inspectWall(mesh,wall,token){
  const status=mesh.formWall,check=()=>!current()||token!==revision;
  const output=$('wall-result');
  output.textContent=status.valid?'指定した壁厚で薄肉化できました。厚みを確認しています…':status.message+' 薄い箇所の目安を調べています…';
  try{
   const threshold=status.valid?Math.max(.08,wall.thickness-Math.max(.06,wall.thickness*.08)):wall.thickness*2;
   const report=await analyzeCoilPrint([{id:'form',vertices:mesh.vertices,triangles:mesh.triangles}],
    {minThickness:threshold,checkOverhang:false,shouldCancel:check});
   if(check())return;
   const {thin}=report.outputs[0];
   if(thin.length){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(thin,3));
    wallOverlay=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({
     color:status.valid?0xe53843:0xe88917,side:THREE.DoubleSide,depthWrite:false,
     polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2
    }));
    wallOverlay.renderOrder=57;scene.add(wallOverlay);
   }
   output.textContent=status.valid?
    (thin.length?'薄肉化できました。赤い箇所は指定値より薄い可能性があります（表示形状から測った目安）。':'薄肉化できました。表示形状の厚み検査で注意箇所は見つかりませんでした。'):
    status.message+(thin.length?' 橙は、くり抜く前から幅が狭い箇所の目安です。':' 表示形状から注意箇所は特定できませんでした。');
  }catch(error){
   if(!check())output.textContent=(status.valid?'薄肉化できました。':status.message)+' 厚みの色分けを計算できませんでした。';
  }
 }
 function update(){
  if(!active())return;
  if(!current()){close();return;}
  const nextView=cameraView();
  if(!drag&&view!==nextView){view=nextView;syncView();}
  if($('sources').open&&getRegions()!==listedRegions)listSources();
  if($('outline-compare').open&&getRegions()!==outlineRegions)listOutlines();
  const target=$('clearance-target').value;
  if($('clearance').open&&target&&!meshes.get(target)?.visible){
   clearClearance('比較するボディが非表示になりました。');listClearanceTargets();
  }
  updateMarkers();
 }
 function updateMarkers(){
  const aligned=Math.abs(camera.getWorldDirection(viewDirection).dot(axes.n))>.9999;
  for(const {el,s,p} of markers){
   const ring=displayRings[s],at=screenPoint(formWorld(axes,...ring.points[p],ring.z));
   el.hidden=aligned&&s!==section||at.z < -1||at.z > 1||at.x<0||at.y<0||at.x>host.clientWidth||at.y>host.clientHeight;
   if(!el.hidden)el.style.transform='translate('+Math.round(at.x)+'px,'+Math.round(at.y)+'px) translate(-50%,-50%)';
  }
 }
 function setDraftFeature(feature){
  if(hiddenMesh){const {mesh,visible}=hiddenMesh;if(mesh.parent)mesh.visible=visible;hiddenMesh=null;}
  editing=feature;
  if(feature){
   const mesh=meshes.get(feature.spec.id||feature.id);
   if(mesh){hiddenMesh={mesh,visible:mesh.visible};mesh.visible=false;}
  }
  $('apply').textContent=editing?'変更を適用':'ソリッドに変換';
  $('sources').hidden=Boolean(editing);
  if(editing)$('sources').open=false;
  if($('clearance').open)listClearanceTargets();
 }
 function showDraft(draft,feature,fitView){
  form=draft;axes=formBasis(form.orientation);
  baseline=form.rings.map(ring=>({points:formRingOutline(effectiveFormRing(form,ring),axes).map(([x,y])=>formWorld(axes,x,y,ring.z))}));
  const editable=form.rings.findIndex((ring,i)=>i>0&&!ring.locked);
  section=editable<0?0:editable;point=0;fitPending=fitView;
  setDraftFeature(feature);$('sources').open=false;
  syncView();syncGuides();syncSeamNote();syncSymmetryNote();syncSeamList();structure();changed();
 }
 function open(feature=null){
  close();original=getFeatures();
  listedRegions=null;$('source-error').textContent='';
  view=cameraView();
  guideSources=[];$('guide-source').replaceChildren(new Option('線を選択',''));
  symmetrySources=[];$('symmetry-source').replaceChildren(new Option('中心線を選択',''));$('symmetry-plane').open=false;
  outlineByView={};outlineRegions=null;$('outline-compare').open=false;$('seam').open=false;$('orientation').open=false;
  $('wall').open=Boolean(feature?.spec.form?.wall);
  $('guides').open=false;$('points').open=false;$('guide-error').textContent='';
  $('zebra').checked=false;$('compare').checked=false;$('heat').checked=false;
  $('size').open=$('curvature').open=$('clearance').open=false;
  $('size-anchor').value='center';$('smooth-strength').value=30;$('smooth-value').textContent='30%';
  $('clearance-target').replaceChildren();
  dialog.show();overlay.hidden=false;
  showDraft(feature?structuredClone(feature.spec.form):newFormProfile(),feature,!feature);
 }
 function listSources(){
  listedRegions=getRegions();
  const selectedIds=new Set([...$('sketches').selectedOptions].map(option=>sources[Number(option.value)]?.id));
  const sketches=new Map(original.filter(f=>f.kind==='sketch').map(f=>[f.id,f]));
  sources=listedRegions.flatMap(region=>{
   const contour=formSourceContour(region,axes);
   return contour?[{region,id:region.id,z:contour.z}]:[];
  }).sort((a,b)=>a.z-b.z);
  $('sketches').replaceChildren(...sources.map(({region,id,z},i)=>{
   const names=[...new Set(region.sourceIds?.map(id=>{
    const sketch=sketches.get(id);return sketch?.groupNumber?'スケッチ'+sketch.groupNumber:sketch?.name;
   }).filter(Boolean))].join('・');
   return new Option((names||'スケッチ輪郭')+' ／ Z '+Number(z.toFixed(3))+' mm ／ '+Number(region.area.toFixed(2))+' mm²',i,false,selectedIds.has(id));
  }));
  const selectedLoft=$('loft').value;
  lofts=original.filter(feature=>feature.spec?.type==='loft');
  $('loft').replaceChildren(new Option(lofts.length?'ロフトを選択':'ロフトがありません',''),
   ...lofts.map((feature,i)=>new Option(feature.name+' ／ 工程 '+(original.indexOf(feature)+1),i)));
  if(selectedLoft)$('loft').value=selectedLoft;
  $('source-help').textContent=sources.length
   ?'Ctrl／⌘を押しながら、位置の異なる断面を選びます。元の輪郭は固定されます。'
   :'表示中のスケッチに、断面方向と平行な閉じた輪郭がありません。';
  syncFields();
 }
 function importDraft(regions,feature=null){
  if(!current()||busy)return;
  $('source-error').textContent='';
  try{
   const rings=importFormRings(regions?.map(region=>nativeSketchRegion(region,original)),formPointCount,formSectionLimit,axes);
   if(rings.length<formSectionLimit){
    const widest=rings.slice(0,-1).reduce((best,ring,i)=>rings[i+1].z-ring.z>rings[best+1].z-rings[best].z?i:best,0);
    if(rings[widest+1].z-rings[widest].z>=.2)rings.splice(widest+1,0,interpolateFormRing(rings[widest],rings[widest+1]));
   }
   const draft={version:1,symmetric:false,soft:form.soft??0,rings,...(form.orientation?{orientation:form.orientation}:{})};
   validateFormProfile(draft);
   dispose(preview);preview=null;
   showDraft(draft,feature,true);
  }catch(error){$('source-error').textContent=error.message;}
 }
 $('sources').ontoggle=()=>{if(current()&&$('sources').open)listSources();};
 $('sketches').onchange=$('loft').onchange=syncFields;
 $('import-sketches').onclick=()=>importDraft([...$('sketches').selectedOptions].map(option=>sources[Number(option.value)].region));
 $('import-loft').onclick=()=>{const feature=lofts[Number($('loft').value)];if(feature)importDraft(feature.spec.sections,feature);};
 $('soft').oninput=()=>{form.soft=Number($('soft').value);syncFields();};
 $('soft').onchange=()=>{record();syncHistory();};
 $('zebra').onchange=()=>{
  if($('zebra').checked)$('heat').checked=false;
  syncHeat();
 };
 $('heat').onchange=()=>{if($('heat').checked)$('zebra').checked=false;syncHeat();};
 $('size').ontoggle=()=>{if(current()&&$('size').open)syncSectionSize();};
 $('resize').onclick=()=>{
  if(!current()||$('resize').disabled)return;
  try{
   const next=resizeFormSection(form,section,[$('width').valueAsNumber,$('height').valueAsNumber],$('size-anchor').value,axes);
   if(next){form=next;changed();}
   else $('size-note').textContent='幅・高さは現在の寸法と同じです。';
  }catch(error){$('size-note').textContent=error.message;}
 };
 $('smooth-strength').oninput=()=>{
  $('smooth-value').textContent=$('smooth-strength').value+'%';
  if(smoothDraft)previewSmoothing();
 };
 $('smooth-preview').onclick=previewSmoothing;
 $('smooth-cancel').onclick=()=>{clearSmoothing();syncFields();};
 $('smooth-apply').onclick=()=>{if(smoothDraft&&!busy){form=smoothDraft;changed();}};
 $('curvature').ontoggle=()=>{
  if(current()&&!$('curvature').open&&smoothDraft){clearSmoothing();syncFields();}
 };
 $('clearance').ontoggle=()=>{
  if(!current())return;
  if($('clearance').open)listClearanceTargets();else{clearClearance();syncClearance();}
 };
 $('clearance-check').onclick=checkClearance;
 $('clearance-gap').onchange=$('clearance-target').onchange=()=>{clearClearance();syncClearance();};
 $('compare').onchange=draw;
 for(const button of dialog.querySelectorAll('[data-form-view]'))button.onclick=()=>chooseView(button.dataset.formView);
 $('reference').onchange=()=>{
  (form.references??={})[view]=$('reference').value;syncReference();record();syncHistory();
 };
 function listGuideSources(){
  if(!current()||!$('guides').open)return;
  guideSources=original.flatMap(feature=>{
   const guide=formGuideFromSketch(feature,axes);
   return guide?[{...guide,name:feature.name||'スケッチ線',group:feature.groupNumber}]:[];
  });
  $('guide-source').replaceChildren(new Option(guideSources.length?'線を選択':'対応するスケッチ線がありません',''),
   ...guideSources.map(({name,group,axis},i)=>new Option((axis===0?'正面':'側面')+' ／ '+(group?'スケッチ'+group+'・':'')+name,i)));
  syncFields();
 }
 $('guides').ontoggle=listGuideSources;
 function listSymmetrySources(){
  if(!current()||!$('symmetry-plane').open)return;
  const selected=$('symmetry-source').value;
  symmetrySources=original.flatMap(feature=>{
   const u=symmetryFromSketch(feature,axes);
   return u===null?[]:[{id:feature.id,u,name:feature.name||'スケッチ線',group:feature.groupNumber}];
  });
  $('symmetry-source').replaceChildren(new Option(symmetrySources.length?'中心線を選択':'左右位置が一定の直線がありません',''),
   ...symmetrySources.map(({id,name,group,u})=>new Option((group?'スケッチ'+group+'・':'')+name+' ／ '+Number(u.toFixed(3))+' mm',id)));
  if(symmetrySources.some(line=>line.id===selected))$('symmetry-source').value=selected;
  syncFields();
 }
 $('symmetry-plane').ontoggle=()=>{
  if(!current())return;
  if($('symmetry-plane').open)listSymmetrySources();
  else if(pickingSymmetry){stopFacePick();syncFields();}
  draw();
 };
 $('symmetry-source').onchange=syncFields;
 $('symmetry-use').onclick=()=>{
  const line=symmetrySources.find(line=>line.id===$('symmetry-source').value);
  if(!line)return;
  try{applySymmetryPlane(line.u,line.name);}
  catch(error){syncSymmetryNote(error.message);}
 };
 $('symmetry-offset').onchange=()=>{
  try{applySymmetryPlane($('symmetry-offset').valueAsNumber);}
  catch(error){$('symmetry-offset').value=String(formSymmetryU(form));syncSymmetryNote(error.message);}
 };
 $('symmetry-reset').onclick=()=>{
  try{applySymmetryPlane(0);}
  catch(error){syncSymmetryNote(error.message);}
 };
 $('symmetry-pick').onclick=()=>{
  const start=!pickingSymmetry;stopFacePick();
  if(start){pickingSymmetry=true;host.dataset.formSeamPick='true';syncSymmetryNote();}
  syncFields();
 };
 $('outline-compare').ontoggle=()=>{if(current()&&$('outline-compare').open)listOutlines();else drawComparison();};
 $('outline-source').onchange=()=>{
  outlineByView[view]=$('outline-source').value?outlineSources[Number($('outline-source').value)].region.id:null;
  drawComparison();
 };
 $('outline-tolerance').onchange=drawComparison;
 $('seam-pick').onclick=()=>{
  const start=!pickingSeam;stopFacePick();
  if(start){pickingSeam=true;host.dataset.formSeamPick='true';syncSeamNote();}
  syncFields();
 };
 $('seam').ontoggle=()=>{if(current()&&!$('seam').open&&pickingSeam){stopFacePick();syncFields();}};
 $('seam-clear').onclick=()=>{replaceSeams([]);stopFacePick();syncSeamList();changed();};
 $('wall-search').onclick=()=>{
  if(wallSearch){
   const {valid}=wallSearch;
   cancelWallSearch();syncWallSearch();
   $('wall-search-status').textContent=valid.length?'中止までに確認できた候補です。':'候補の計算を中止しました。';
  }else{clearTimeout(wallSearchTimer);searchWall();}
 };
 $('wall-enabled').onchange=()=>{
  if($('wall-enabled').checked)form.wall={...defaultWall};
  else delete form.wall;
  changed();
 };
 $('wall-thickness').onchange=$('wall-opening').onchange=()=>{
  if(!form.wall)return;
  const next={thickness:$('wall-thickness').valueAsNumber,opening:$('wall-opening').value};
  if(!validFormWall(next)){
   $('wall-thickness').value=form.wall.thickness;
   $('wall-result').textContent='壁厚は0.1〜100 mmで指定してください。';
   return;
  }
  form.wall=next;changed();
 };
 for(const id of ['base-plane','tilt-u','tilt-v'])$(id).onchange=()=>{
  if($(id).disabled)return;
  const next={plane:$('base-plane').value,tiltU:$('tilt-u').valueAsNumber,tiltV:$('tilt-v').valueAsNumber};
  if(!validFormOrientation(next)){text('断面の角度は−180°〜180°で指定してください。',true);return;}
  stopFacePick();
  if(next.plane==='XY'&&!next.tiltU&&!next.tiltV)delete form.orientation;
  else form.orientation=next;
  fitPending=true;changed();syncView();
  if($('sources').open)listSources();
  if($('guides').open)listGuideSources();
  if($('symmetry-plane').open)listSymmetrySources();
 };
 $('guide-source').onchange=syncFields;
 $('guide-add').onclick=()=>{
  if(!current()||$('guide-add').disabled)return;
  const {axis,points,name}=guideSources[Number($('guide-source').value)];
  const guide={axis,points,name,knot:formKnots(form.rings[section])[point]};
  const draft={...form,guides:[...(form.guides??[]),guide]};
  try{validateFormProfile(draft);form=draft;$('guide-error').textContent='';syncGuides();changed();}
  catch(error){$('guide-error').textContent=error.message;}
 };
 $('section').onchange=()=>select(Number($('section').value));
 $('point').onchange=()=>select(section,Number($('point').value));
 $('lock').onchange=()=>{
  const draft=structuredClone(form),ring=draft.rings[section],knot=formKnots(ring)[point];
  try{
   if($('lock').checked)draft.rings[section]={...guidedFormRing(draft,ring),locked:true};
   else{ring.locked=false;delete ring.reference;if(draft.symmetric)setFormSymmetry(draft,true);}
   form=draft;point=formKnots(form.rings[section]).indexOf(knot);structure();changed();
  }catch(error){syncFields();text(error.message,true);}
 };
 $('symmetric').onchange=()=>{
  const draft=structuredClone(form),knot=formKnots(form.rings[section])[point];
  try{
   setFormSymmetry(draft,$('symmetric').checked);validateFormProfile(draft);
   form=draft;point=formKnots(form.rings[section]).indexOf(knot);structure();changed();
  }catch(error){syncFields();text(error.message,true);}
 };
 $('add-point').onclick=()=>{
  try{point=addFormPoint(form,section,point);structure();changed();}
  catch(error){text(error.message,true);}
 };
 $('delete-point').onclick=()=>{
  if($('delete-point').disabled)return;
  point=removeFormPoint(form,section,point);structure();changed();
 };
 $('corner').onchange=()=>{setFormCorner(form,section,point,$('corner').checked);changed();};
 $('corner-all').onclick=()=>{
  const knot=formKnots(form.rings[section])[point];
  for(const [s,ring] of form.rings.entries()){
   const index=formKnots(ring).indexOf(knot);
   if(index>=0)setFormCorner(form,s,index,$('corner').checked);
  }
  changed();
 };
 for(const axis of ['x','y','z'])$(axis).onchange=()=>{
  const input=$(axis),value=input.valueAsNumber;
  if(!Number.isFinite(value)){syncFields();return;}
  const ring=form.rings[section];
  if(input.disabled||ring.locked)return;
  if(axis==='z')ring.z=value;
  else{
   const coordinates=ring.points[point].slice();coordinates[axis==='x'?0:1]=value;
   moveFormPoint(form,section,point,...coordinates);
  }
  changed();
 };
 $('insert').onclick=()=>{
  const i=Math.min(section,form.rings.length-2),a=form.rings[i],b=form.rings[i+1];
  form.rings.splice(i+1,0,interpolateFormRing(a,b));
  section=i+1;point=0;structure();changed();
 };
 $('remove').onclick=()=>{
  if(form.rings[section].locked||form.rings.length<=2||formSeamsAt(form,section).length)return;
  form.rings.splice(section,1);section=Math.min(section,form.rings.length-1);point=0;structure();changed();
 };
 $('undo').onclick=()=>travelHistory('undo');
 $('redo').onclick=()=>travelHistory('redo');
 window.addEventListener('keydown',event=>{
  if(!active()||!event.ctrlKey&&!event.metaKey||event.altKey||event.target.closest?.('input,textarea,[contenteditable]'))return;
  const key=event.key.toLowerCase();
  if(key!=='z'&&key!=='y')return;
  event.preventDefault();event.stopImmediatePropagation();
  if(!event.repeat)travelHistory(key==='y'||event.shiftKey?'redo':'undo');
 },true);
 $('apply').onclick=async()=>{
  if(!current()||ready!==revision||busy||smoothDraft)return;
  clearClearance();
  stopFacePick();
  busy=true;syncFields();text('ソリッドと後続工程を計算しています…');
  const token=revision,saved=original,feature=editing,isCurrent=()=>current()&&revision===token;
  const spec={type:'form',id:feature?.spec.id||feature?.id||crypto.randomUUID(),form:structuredClone(form)};
  try{
   const result=await kernel.run([],spec,{timeout:15000,foreground:true});
   if(!isCurrent())return;
   await apply(spec,result,feature,saved,isCurrent);
   if(active()&&revision===token)close();
   notify(feature?'フォームと後続工程を更新しました':'フォームをソリッドに変換しました');
  }catch(error){
   if(isCurrent()){issue=error.diagnostics;draw();text(error.message,true);}
  }finally{if(isCurrent()){busy=false;syncFields();}}
 };
 $('close').onclick=$('cancel').onclick=close;
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('close',()=>{if(!dialog.open&&!overlay.hidden)clear();});
 return {open,close,update,get active(){return active();},get preview(){return fastPreview??preview;}};
}
