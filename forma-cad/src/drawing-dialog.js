import {circles,viewPoints,insideView,withDetails,snapDimension} from './drawing-annotations.js';
import {prepareDrawingComment,prepareJapanesePDF} from './drawing-pdf-text.js';
import {defaultDrawingCommentColor,drawingCommentFamily,hasDrawingCommentFont,loadDrawingCommentFont} from './drawing-comments.js';
import {TEXT_FONTS} from './text-fonts.js';
import {defaultDrawingDimensionColor,drawingDimensionColor,dimensionValue,pathEndpoints,validDimensionColor} from './drawing-dimensions.js';
import {drawingCurves,angleDimension} from './drawing-curves.js';
import {drawingSignature,readDrawingState} from './drawing-state.js';
import {KernelClient} from './kernel-client.js';
import {installDrawingPresets} from './drawing-presets.js';
import {drawingSheet} from './drawing-sheet.js';
import {defaultDrawingViews,drawingProjectionNames,drawingProjections,drawingViewVisible} from './drawing-view-preferences.js';
import {optimizeDrawingLayout,drawingViewFrames,rescaleDrawingAnnotations} from './drawing-auto-layout.js';
import {drawingViewport} from './drawing-viewport.js';
import {drawingDimensionVisible,drawingModelPoint,drawingPaperPoint,drawingPointOmitted,moveDrawingBreakEdge} from './drawing-break.js';
import {drawingTableHoles,drawingHoleTableMatches,maxDrawingTableHoles} from './drawing-hole-table.js';
import {autoDimensionKeys,autoDimensionTypes,autoDrawingDimensions,overallDrawingDimensions} from './drawing-auto-dimensions.js';
import {arrangeDrawingDimensions,reflowResizedDrawingDimensions} from './drawing-dimension-layout.js';
import {drawingFrontFrame,sameDrawingFront} from './drawing-front.js';
import {captureDrawingReferences,reconcileDrawingDimensions} from './drawing-dimension-references.js';
const scales=[2,1,.5,.2,.1,.05,.02,.01];
const standardDimensionFont=3.2;
const colorFields=[['lineColor','line','寸法線の色'],['textColor','text','数字・注記の色']];
const colorInputs=(scope)=>colorFields.map(([,id,label])=>'<label>'+label+
 '<input type="color" id="drawing-'+scope+'-'+id+'-color"></label>').join('');
export function installDrawing({getFeatures,getVisible,getSelected,getFrontFace=()=>null,download,onChange=()=>{}}){
 const worker=new KernelClient(),dialog=document.createElement('dialog');dialog.id='drawing-dialog';dialog.innerHTML=`<div class="drawing-heading"><h2>三面図</h2><button type="button" id="drawing-close" aria-label="閉じる">×</button></div>
 <div class="drawing-controls"><label>対象<select id="drawing-target"><option value="visible">表示中の全ボディ</option><option value="selected">選択したボディ</option></select></label><label>縮尺<select id="drawing-scale">${scales.map(s=>'<option value="'+s+'"'+(s===1?' selected':'')+'>'+(s>=1?s+':1':'1:'+1/s)+'</option>').join('')}</select></label><label><input type="checkbox" id="drawing-hidden" checked>隠れ線（共通）</label><button id="drawing-generate">三面図を再計算</button></div>
 <div class="drawing-controls drawing-paper-controls"><label>用紙<select id="drawing-paper-size"><option value="auto">自動サイズ</option><option value="A4" selected>A4</option><option value="A3">A3</option></select></label><label>向き<select id="drawing-orientation"><option value="landscape">横</option><option value="portrait">縦</option></select></label><label><input id="drawing-frame" type="checkbox" checked>図枠</label><button id="drawing-fit">用紙に収める</button><button id="drawing-auto-layout" title="各図の上下・左右の位置関係を自由に組み替え、寸法や図枠を含めて大きく配置します">大きく自動配置</button><button id="drawing-arrange">配置をリセット</button><label><input id="drawing-layout-mode" type="checkbox">配置をドラッグ</label></div>
 <div class="drawing-controls drawing-view-options" role="group" aria-label="図面に載せるビュー"><strong>載せるビュー</strong>${drawingProjectionNames.map(view=>{const {label,title}=drawingProjections[view];return '<label><input type="checkbox" value="'+view+'">'+label+' <span>'+title+'</span></label>';}).join('')}<label><input id="drawing-view-iso" type="checkbox" value="iso" checked>ISO <span>俯瞰図</span></label></div>
 <div class="drawing-controls"><label>図の優先<select id="drawing-view-priority"><option value="balanced">共通縮尺</option><option value="front">正面図を優先（1.4倍）</option></select></label><label>俯瞰図<select id="drawing-iso-mode"><option value="full">通常</option><option value="small">小さく（半分）</option><option value="hidden">非表示</option></select></label><small>異なる縮尺は各図に表示します。</small></div>
 <div class="drawing-controls"><label>部品名<input id="drawing-name" maxlength="80"></label><label>材質<input id="drawing-material" maxlength="80"></label><label>作成日<input id="drawing-date" type="date"></label></div>
 <p id="drawing-layout-help">通常配置は第三角法です。「大きく自動配置」は図の位置関係を自由に組み替え、共通縮尺で用紙を広く使います。寸法・コメント・配置は保存されます。</p>
 <div class="drawing-controls"><label>寸法<select id="drawing-dimension-kind"><option value="horizontal">水平</option><option value="vertical">垂直</option><option value="aligned">２点間</option><option value="diameter">直径 Ø</option><option value="radius">半径 R</option><option value="angle">角度</option></select></label><button id="drawing-dimension-add">寸法線を追加</button><button id="drawing-dimension-overall">全体寸法を追加</button><button id="drawing-dimension-undo">最後の寸法を削除</button><button id="drawing-dimension-clear">寸法を全削除</button><button id="drawing-dimension-cancel" hidden>寸法追加を中止</button></div>
 <div class="drawing-controls"><button id="drawing-center-add">中心マーク</button><button id="drawing-center-line">中心線（２点）</button><button id="drawing-centers-all">円の中心を一括表示</button><label>切断線<select id="drawing-section-orientation"><option value="vertical">縦</option><option value="horizontal">横</option></select></label><button id="drawing-section-add">断面図を追加</button><label>詳細倍率<select id="drawing-detail-factor"><option value="2">２倍</option><option value="4">４倍</option><option value="10">10倍</option></select></label><button id="drawing-detail-add">拡大詳細図を追加</button><label><input id="drawing-snap" type="checkbox" checked>寸法線の吸着（Altで解除）</label></div>
 <div id="drawing-extra-editor" class="drawing-controls" hidden><label>断面・詳細図<select id="drawing-extra-target"></select></label><button id="drawing-section-reverse">見る方向を反転</button><label id="drawing-section-position-label">切断位置 (mm)<input id="drawing-section-position" type="number" step="0.1"></label><button id="drawing-extra-delete">この図を削除</button><span>切断線は直接ドラッグ、図の配置は「配置をドラッグ」で変更できます</span></div>
 <div class="drawing-controls"><button id="drawing-undo" disabled>元に戻す</button><button id="drawing-redo" disabled>やり直す</button><span>寸法・コメントをクリックして編集（Ctrl+Z / Ctrl+Y）</span></div><div id="drawing-editor" hidden class="drawing-controls"><strong id="drawing-editor-title"></strong><label id="drawing-precision-label">小数点以下<select id="drawing-precision"><option value="auto">自動（最大３桁）</option>${[0,1,2,3,4,5,6].map(n=>`<option value="${n}">${n}桁</option>`).join('')}</select></label><label id="drawing-font-label">文字サイズ (mm)<input id="drawing-font" type="number" min="1.5" max="10" step="0.1"></label><button id="drawing-edit-comment">本文を編集</button><button id="drawing-delete-selection">選択項目を削除</button><button id="drawing-deselect">編集を終了</button></div><label class="drawing-comment-label">コメント<textarea id="drawing-comment" rows="2" maxlength="2000" placeholder="材質・加工の注意事項など（改行できます）"></textarea></label><p id="drawing-status" role="status"></p><div id="drawing-preview"></div><div class="drawing-actions"><span id="drawing-paper"></span><button id="drawing-svg" disabled>SVG保存</button><button id="drawing-pdf" disabled>PDF保存</button></div>`;
 document.body.append(dialog);const $=id=>dialog.querySelector('#'+id);let saved=null,data=null,sheet=null,revision=0,features=[],visible=[],selected=[],dimensions=[],positions={},picking=null,source='',targets=[],overflow=false,drag=null,selection=null,commentSize=3.5,undo=[],redo=[],replaying=false,suppressClick=false,sections=[],details=[],markers=[],extraTarget='',action=null,busy=false,layoutKind='projection';
 const viewportHost=$('drawing-preview');viewportHost.tabIndex=0;viewportHost.setAttribute('aria-label','図面。ホイールで拡大、ホイール押し込みまたはSpace＋ドラッグで移動');
 $('drawing-comment').closest('label').insertAdjacentHTML('afterend',
  '<div class="drawing-controls drawing-comment-style" role="group" aria-label="コメントの書式">'+
  '<label>コメントの文字色<input id="drawing-comment-color" type="color"></label>'+
  '<label>コメントのフォント<select id="drawing-comment-font"><option value="">標準</option>'+
  TEXT_FONTS.map(({id,label})=>'<option value="'+id+'">'+label+'</option>').join('')+'</select></label>'+
  '<label>コメントの文字サイズ (mm)<input id="drawing-comment-size" type="number" min="1.5" max="10" step="0.1"></label>'+
  '<small id="drawing-comment-font-status" role="status"></small></div>');
 dialog.querySelector('.drawing-view-options').insertAdjacentHTML('afterend','<details id="drawing-hidden-views"><summary>ビュー別の隠れ線</summary><div class="drawing-controls"></div></details>');
 $('drawing-view-priority').closest('.drawing-controls').insertAdjacentHTML('afterend',
  '<div class="drawing-controls"><label>長さの省略表示<select id="drawing-break-axis" title="正投影図の中央を省略します。俯瞰図は全体を表示します。">'+
  '<option value="">なし</option><option value="longest">自動（最長軸）</option><option value="x">X方向</option><option value="y">Y方向</option><option value="z">Z方向</option>'+
  '</select></label><label id="drawing-break-percent-label" hidden>中央の省略割合 (%)<input type="number" id="drawing-break-percent" min="20" max="90" step="1" value="70"></label>'+
  '<button id="drawing-break-center" hidden>中央に戻す</button><small id="drawing-break-help" hidden>図の省略線をドラッグして範囲を調整</small></div>');
 $('drawing-font-label').insertAdjacentHTML('afterend',
  '<label id="drawing-dimension-tolerance-label" hidden>± 公差<input id="drawing-dimension-tolerance" type="number" min="0" max="1000000" step="any" placeholder="例 0.1"></label>'+
  '<label id="drawing-dimension-note-label" hidden>加工指示<input id="drawing-dimension-note" maxlength="60" placeholder="例 貫通、深さ 5 mm"></label>'+
  '<label id="drawing-dimension-pin-label" hidden><input id="drawing-dimension-pin" type="checkbox">寸法の位置を固定</label>'+
  '<div id="drawing-item-colors" class="drawing-color-controls" hidden role="group" aria-label="選択した寸法の色">'+
   colorInputs('item')+'<button id="drawing-item-colors-reset" type="button">図面の色に戻す</button></div>'+
  '<button id="drawing-dimension-relink" hidden>参照点を選び直す</button>');
 $('drawing-generate').insertAdjacentHTML('afterend','<button id="drawing-front-face" title="CADで平面を1つ選択して三面図を開くと、その面が正面になります">選択した面を正面に</button><button id="drawing-front-reset" hidden>標準の向きに戻す</button><small id="drawing-front-status"></small>');
 const viewportBar=document.createElement('div');viewportBar.className='drawing-controls drawing-viewport-controls';viewportBar.innerHTML='<span>画面表示</span><button id="drawing-zoom-out" aria-label="図面を縮小">−</button><output id="drawing-zoom-percent" aria-live="polite">100%</output><button id="drawing-zoom-in" aria-label="図面を拡大">＋</button><button id="drawing-zoom-fit">用紙全体</button><button id="drawing-expand" aria-pressed="false">作業領域を最大化</button><small>ホイール：拡大・縮小 ／ ホイール押し込み・Space＋ドラッグ：移動</small>';viewportHost.before(viewportBar);
 const overflowList=document.createElement('div');overflowList.id='drawing-overflow-list';
 overflowList.className='drawing-controls';overflowList.hidden=true;
 overflowList.setAttribute('role','group');overflowList.setAttribute('aria-label','用紙からはみ出した項目');
 viewportBar.append(overflowList);
 const reviewList=document.createElement('div');reviewList.id='drawing-review-list';
 reviewList.className='drawing-controls';reviewList.hidden=true;
 reviewList.setAttribute('role','group');reviewList.setAttribute('aria-label','参照先を確認する寸法');
 viewportBar.append(reviewList);
 $('drawing-undo').closest('.drawing-controls').classList.add('drawing-history-controls');
 $('drawing-dimension-add').closest('.drawing-controls').classList.add('drawing-dimension-controls');$('drawing-dimension-overall').insertAdjacentHTML('afterend','<button id="drawing-dimension-auto" title="外形・円形部の直径・中心位置をまとめて追加します">寸法を自動入力</button>');
 $('drawing-dimension-auto').insertAdjacentHTML('afterend','<button id="drawing-dimension-arrange" title="既存の寸法を重なりにくい位置へ移動します">寸法を自動配置</button>');
 $('drawing-dimension-arrange').insertAdjacentHTML('afterend',
  '<button id="drawing-hole-start" title="図で基準点をクリックし、表に載せる円を選びます">穴位置表を作成</button>'+
  '<button id="drawing-hole-all" hidden>候補をすべて選択</button><button id="drawing-hole-add" hidden>穴位置表を確定</button>'+
  '<button id="drawing-hole-delete" hidden>穴位置表を削除</button><small id="drawing-hole-review" hidden>形状が変わりました。穴位置表を作り直してください。</small>');
 $('drawing-dimension-add').closest('.drawing-controls').insertAdjacentHTML('afterend',
  '<div class="drawing-controls drawing-dimension-controls"><label>寸法の文字サイズ (mm)<input id="drawing-dimension-font" type="number" min="1.5" max="10" step="0.1" title="図面上の現在の寸法と、これから追加する寸法に適用します"></label>'+
  '<div class="drawing-color-controls" role="group" aria-label="図面全体の寸法色"><span>図面の標準色</span>'+colorInputs('default')+
   '<button id="drawing-default-colors-reset" type="button">既定色に戻す</button></div>'+
  '<details id="drawing-auto-dimension-views"><summary>ビュー別の自動寸法</summary>'+
  drawingProjectionNames.map(view=>'<fieldset data-auto-dimension-view="'+view+'"><legend>'+drawingProjections[view].label+'</legend>'+
   autoDimensionKeys.map(key=>'<label><input type="checkbox" value="'+key+'">'+autoDimensionTypes[key]+'</label>').join('')+
  '</fieldset>').join('')+'</details></div>');
 const viewport=drawingViewport({dialog,host:viewportHost,minus:$('drawing-zoom-out'),plus:$('drawing-zoom-in'),fit:$('drawing-zoom-fit'),percent:$('drawing-zoom-percent'),expand:$('drawing-expand'),canNavigate:()=>!drag&&!busy});
 const isoCheck=$('drawing-view-iso'),isoModeInput=$('drawing-iso-mode');
 const viewChecks=[...dialog.querySelectorAll('.drawing-view-options input:not(#drawing-view-iso)')];
 let viewSelection=[...defaultDrawingViews],lastVisibleIsoMode='full';
 let frontFace=null,frontFrame,autoDimensionViews={},dimensionFontSize=standardDimensionFont;
 let hiddenViews={},dimensionReferences={},dimensionColors={};
 let commentColor=defaultDrawingCommentColor,commentFont='',requestedCommentFont='';
 const defaultBreakPercent=70;
 let breakAxis='',breakPercent=defaultBreakPercent,breakRange,holeTable;
 const hiddenRows=$('drawing-hidden-views').querySelector('.drawing-controls');
 const dimensionViewRows=[...$('drawing-auto-dimension-views').querySelectorAll('fieldset')];
 for(const row of dimensionViewRows)row.onchange=()=>{
  const view=row.dataset.autoDimensionView;
  const enabled=[...row.querySelectorAll('input:checked')].map(input=>input.value);
  if(enabled.length===autoDimensionKeys.length)delete autoDimensionViews[view];
  else autoDimensionViews[view]=enabled;
  persist();
 };
 const applyDimensionFont=d=>dimensionFontSize===standardDimensionFont?d:{...d,fontSize:dimensionFontSize};
 function setViewSelection(views){viewSelection=[...views];for(const input of viewChecks)input.checked=views.includes(input.value);}
 function setIsoMode(mode){
  isoModeInput.value=mode;
  isoCheck.checked=mode!=='hidden';
  if(isoCheck.checked)lastVisibleIsoMode=mode;
 }
 const viewData=name=>withDetails(data,details).views[name],names=()=>Object.keys(sheet?.layout||{}).filter(k=>k!=='iso');
 const status=t=>$('drawing-status').textContent=t,options=()=>({viewSelection,viewPriority:$('drawing-view-priority').value,isoMode:$('drawing-iso-mode').value,layout:layoutKind,paper:$('drawing-paper-size').value,orientation:$('drawing-orientation').value,frame:$('drawing-frame').checked,name:$('drawing-name').value,material:$('drawing-material').value,date:$('drawing-date').value,commentSize,positions,sections,details,markers,
  ...(frontFrame?{frontFrame}:{}),
  ...(Object.keys(autoDimensionViews).length?{autoDimensionViews}:{}),
  ...(dimensionFontSize===standardDimensionFont?{}:{dimensionFontSize}),
  ...(Object.keys(hiddenViews).length?{hiddenViews}:{}),
  ...(Object.keys(dimensionReferences).length?{dimensionReferences}:{}),
  ...(Object.keys(dimensionColors).length?{dimensionColors}:{}),
  ...(commentColor===defaultDrawingCommentColor?{}:{commentColor}),
  ...(commentFont?{commentFont}:{}),
  ...(breakAxis?{breakAxis}:{}),
  ...(breakPercent===defaultBreakPercent?{}:{breakPercent}),
  ...(breakAxis&&breakRange?{breakRange}:{}),
  ...(holeTable?{holeTable}:{}),
 });
 function requestedViews(o){
  const sources=o.details.map(detail=>detail.view).filter(view=>drawingProjectionNames.includes(view));
  if(o.holeTable&&!o.holeTable.review)sources.push(o.holeTable.view);
  return [...new Set([...o.viewSelection,...sources,...(drawingViewVisible('iso',o)?['iso']:[])])];
 }
 function requireVisibleView(o){
  if(!o.viewSelection.length&&!drawingViewVisible('iso',o))throw Error('図面に載せるビューを1つ以上選んでください');
 }
 async function loadMissingViews(next){
  const missing=requestedViews(next).filter(view=>!data.views[view]);
  if(!missing.length)return true;
  const token=++revision,previous=data;
  busy=true;controls();$('drawing-generate').disabled=$('drawing-svg').disabled=$('drawing-pdf').disabled=true;
  status('追加するビューを計算しています…');
  try{
   const result=await worker.request({features,spec:{type:'orthographic',targets,views:missing,frontFrame:next.frontFrame}},300000);
   if(token!==revision||!dialog.open||data!==previous)return false;
   data={...previous,views:{...previous.views,...result.views}};
   return true;
  }finally{
   if(token===revision){worker.reset();busy=false;$('drawing-generate').disabled=false;controls();}
  }
 }
 const presets=installDrawingPresets($('drawing-layout-help'),{read:()=>({...options(),hidden:$('drawing-hidden').checked}),apply:applyPreset,canUse:()=>!!data&&!busy});
 async function applyPreset(values){
  if(!data||busy)throw Error('図面の計算が終わってから呼び出してください');
  const old=options(),scale=Number($('drawing-scale').value),next={...old,...values};
  try{
   requireVisibleView(next);
   if(!await loadMissingViews(next))return;
   const resized=rescaleDrawingAnnotations(dimensions,drawingViewFrames(data,next),scale,scale,drawingViewFrames(data,old));
   const result=optimizeDrawingLayout(data,{scale,dimensions:resized,comment:$('drawing-comment').value,options:next});
   for(const [id,key]of [['paper-size','paper'],['orientation','orientation'],['view-priority','viewPriority']])$('drawing-'+id).value=key==='paper'?result.paper:values[key];
   setIsoMode(values.isoMode);
   $('drawing-frame').checked=values.frame;$('drawing-hidden').checked=values.hidden;
   positions=result.positions;dimensions=result.dimensions;layoutKind='compact';setScale(result.scale);picking=null;action=null;selection=null;render();
  }catch(error){if(dialog.open)render(false);throw error;}
 }
 function setScale(value){const select=$('drawing-scale'),text=String(value);if(![...select.options].some(o=>o.value===text)){const option=new Option('自動 '+(value>=1?Number(value.toFixed(4))+':1':'1:'+Number((1/value).toFixed(4))),text);option.dataset.autoScale='true';select.add(option);}select.value=text;}
 function applyAutomaticLayout(){if(!data)return false;try{const result=optimizeDrawingLayout(data,{scale:Number($('drawing-scale').value),dimensions,comment:$('drawing-comment').value,options:options()});positions=result.positions;dimensions=result.dimensions;layoutKind='compact';setScale(result.scale);$('drawing-paper-size').value=result.paper;picking=null;action=null;selection=null;render();if(!overflow)status('図の位置関係を自由に組み替え、用紙内で大きく自動配置しました。縮尺 '+(result.scale>=1?Number(result.scale.toFixed(4))+':1':'1:'+Number((1/result.scale).toFixed(4)))+'。元に戻すで取消できます');return true;}catch(error){status('自動配置できません：'+error.message);return false;}}
 function persist(){
  if(!data)return;
  dimensionReferences=captureDrawingReferences(withDetails(data,details),dimensions,dimensionReferences);
  const next={version:1,signature:source,targetMode:$('drawing-target').value,targets,scale:Number($('drawing-scale').value),hidden:$('drawing-hidden').checked,comment:$('drawing-comment').value,dimensions:structuredClone(dimensions),options:structuredClone(options())};
  if(JSON.stringify(next)!==JSON.stringify(saved)){
   if(saved&&!replaying&&saved.signature===source){undo.push(structuredClone(saved));if(undo.length>100)undo.shift();redo=[];}
   saved=next;onChange();historyControls();
  }
 }
 function historyControls(){$('drawing-undo').disabled=!data||busy||!undo.length;$('drawing-redo').disabled=!data||busy||!redo.length;}
 function editor(){
  for(const el of viewportHost.querySelectorAll('[data-edit-selected]'))el.removeAttribute('data-edit-selected');
  const marker=selection?.type==='marker',comment=selection?.type==='comment';
  const d=selection?.type==='dimension'?dimensions[selection.index]:null;
  if(selection?.type==='dimension'&&!d)selection=null;
  $('drawing-editor').hidden=!selection;
  if(!selection)return;
  const active=viewportHost.querySelector(marker?'[data-marker="'+selection.id+'"]':comment?'[data-comment]':'[data-dimension="'+selection.index+'"]');
  active?.setAttribute('data-edit-selected','true');
  $('drawing-editor-title').tabIndex=-1;
  $('drawing-editor-title').textContent=marker?'中心線・中心マーク':comment?'コメントを編集':d.review?'寸法の参照先を要確認':'寸法を編集（実測値）';
  $('drawing-precision-label').hidden=!d;
  $('drawing-font-label').hidden=marker;$('drawing-edit-comment').hidden=!comment;
  $('drawing-font').value=comment?commentSize:d?.fontSize??standardDimensionFont;
  $('drawing-precision').value=d?.precision??'auto';
  $('drawing-dimension-tolerance-label').hidden=$('drawing-dimension-note-label').hidden=!d;
  $('drawing-dimension-tolerance-label').firstChild.textContent=d?.kind==='angle'?'± 公差 (°)':'± 公差 (mm)';
  $('drawing-dimension-tolerance').value=d?.tolerance??'';
  $('drawing-dimension-note').value=d?.note??'';
  $('drawing-dimension-pin-label').hidden=!d;
  $('drawing-dimension-pin').checked=!!d?.pinned;
  $('drawing-dimension-pin').disabled=busy;
  $('drawing-item-colors').hidden=!d;
  $('drawing-item-colors-reset').disabled=busy||!colorFields.some(([key])=>d?.[key]!==undefined);
  for(const [key,id] of colorFields){
   const input=$('drawing-item-'+id+'-color');
   input.value=drawingDimensionColor(key,d,dimensionColors);input.disabled=busy;
  }
  const relink=$('drawing-dimension-relink');
  relink.hidden=!d?.review;relink.disabled=busy||!active;
  relink.title=active?'現在の図形で寸法の参照点を指定します':'先に対象のビューを表示してください';
 }
 async function travel(from,to){
  if(!data||!from.length||busy)return;
  persist();
  const previous=structuredClone(saved),previousData=data,previousSelected=selected,next=from.pop();
  to.push(previous);replaying=true;selection=null;picking=null;
  restore(next);$('drawing-target').value=next.targetMode;selected=next.targets.slice();
  const changed=JSON.stringify(targets)!==JSON.stringify(next.targets)||
   JSON.stringify(previous.options.sections)!==JSON.stringify(sections)||
   !sameDrawingFront(previous.options.frontFrame,frontFrame)||requestedViews(options()).some(key=>!data.views[key]);
  saved=structuredClone(next);
  try{
   if(changed){
    const pending=generate(),token=revision;
    if(!await pending){
     if(token!==revision||!dialog.open)return;
     const error=$('drawing-status').textContent;
     to.pop();from.push(next);saved=previous;data=previousData;targets=previous.targets;selected=previousSelected;
     restore(previous);$('drawing-target').value=previous.targetMode;render(false);status(error);
     return;
    }
   }else render(false);
   onChange();
  }finally{replaying=false;historyControls();editor();}
 }
 $('drawing-undo').onclick=()=>travel(undo,redo);$('drawing-redo').onclick=()=>travel(redo,undo);
 $('drawing-deselect').onclick=()=>{selection=null;editor();};
 $('drawing-delete-selection').onclick=()=>{if(selection?.type==='dimension')dimensions.splice(selection.index,1);else if(selection?.type==='comment')$('drawing-comment').value='';else if(selection?.type==='marker')markers=markers.filter(m=>m.id!==selection.id);selection=null;cancelPick();};
 $('drawing-edit-comment').onclick=()=>{$('drawing-comment').focus();};
 $('drawing-comment-color').onchange=()=>{
  const color=$('drawing-comment-color').value;
  if(!data||busy||!validDimensionColor(color))return;
  commentColor=color;render();
 };
 $('drawing-comment-font').onchange=()=>{
  const font=$('drawing-comment-font').value;
  if(!data||busy||font&&!hasDrawingCommentFont(font))return;
  commentFont=font;render();
 };
 function changeAnnotationSize(input,dimension){
  if(!sheet||busy)return;
  const value=input.valueAsNumber;
  if(!Number.isFinite(value)||value<1.5||value>10){controls();return;}
  if(dimension){
   dimension.fontSize=value;
   renderResizedDimensions();
  }else{
   commentSize=value;
   render();
  }
 }
 $('drawing-comment-size').onchange=()=>changeAnnotationSize($('drawing-comment-size'));
 $('drawing-font').onchange=()=>{
  if(selection?.type==='comment')changeAnnotationSize($('drawing-font'));
  else if(selection?.type==='dimension'&&dimensions[selection.index])changeAnnotationSize($('drawing-font'),dimensions[selection.index]);
 };
 $('drawing-precision').onchange=()=>{if(selection?.type!=='dimension')return;const d=dimensions[selection.index];if($('drawing-precision').value==='auto')delete d.precision;else d.precision=Number($('drawing-precision').value);render();};
 $('drawing-dimension-tolerance').onchange=()=>{
  const d=selection?.type==='dimension'&&dimensions[selection.index],input=$('drawing-dimension-tolerance');
  if(!d||busy)return;
  if(input.validity.badInput||!input.validity.valid){editor();return;}
  if(input.value==='')delete d.tolerance;
  else d.tolerance=input.valueAsNumber;
  render();
 };
 $('drawing-dimension-note').onchange=()=>{
  const d=selection?.type==='dimension'&&dimensions[selection.index];
  if(!d||busy)return;
  const note=$('drawing-dimension-note').value.trim();
  if(note)d.note=note;
  else delete d.note;
  render();
 };
 $('drawing-dimension-pin').onchange=()=>{
  const d=selection?.type==='dimension'&&dimensions[selection.index];
  if(!d||busy)return;
  if($('drawing-dimension-pin').checked)d.pinned=true;
  else delete d.pinned;
  render();
 };
 for(const [key,id] of colorFields){
  const whole=$('drawing-default-'+id+'-color'),item=$('drawing-item-'+id+'-color');
  whole.onchange=()=>{
   if(!sheet||busy||!validDimensionColor(whole.value))return;
   if(whole.value===defaultDrawingDimensionColor)delete dimensionColors[key];
   else dimensionColors[key]=whole.value;
   render();
  };
  item.onchange=()=>{
   const d=selection?.type==='dimension'&&dimensions[selection.index];
   if(!d||busy||!validDimensionColor(item.value))return;
   if(item.value===drawingDimensionColor(key,null,dimensionColors))delete d[key];
   else d[key]=item.value;
   render();
  };
 }
 $('drawing-default-colors-reset').onclick=()=>{if(sheet&&!busy){dimensionColors={};render();}};
 $('drawing-item-colors-reset').onclick=()=>{
  const d=selection?.type==='dimension'&&dimensions[selection.index];
  if(!d||busy)return;
  for(const [key] of colorFields)delete d[key];
  render();
 };
 $('drawing-dimension-relink').onclick=()=>{
  const index=selection?.index,d=dimensions[index];
  if(!d?.review||!sheet?.layout[d.view]||busy)return;
  $('drawing-dimension-kind').value=d.kind;
  startDimension(d.kind,{view:d.view,replace:index});
  viewportHost.scrollIntoView({block:'nearest'});
 };
 dialog.addEventListener('keydown',e=>{e.stopPropagation();const input=e.target.matches('input,textarea,select,[contenteditable="true"]');if(input)return;if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();e.stopPropagation();(e.key.toLowerCase()==='y'||e.shiftKey?$('drawing-redo'):$('drawing-undo')).click();}else if((e.key==='Delete'||e.key==='Backspace')&&selection){e.preventDefault();e.stopPropagation();$('drawing-delete-selection').click();}},true);
 function controls(){
  const ready=!!sheet&&!busy,editable=ready&&names().length>0;
  $('drawing-break-axis').value=breakAxis;
  $('drawing-break-axis').disabled=!ready;
  $('drawing-break-percent').value=breakPercent;
  $('drawing-break-percent').disabled=!ready;
  $('drawing-break-percent-label').hidden=!breakAxis;
  $('drawing-break-center').hidden=!breakAxis||!breakRange;
  $('drawing-break-center').disabled=!ready;
  $('drawing-break-help').hidden=!breakAxis;
  $('drawing-break-help').textContent=breakRange?'省略範囲 '+breakRange.map(n=>Number((100*n).toFixed(1))+'%').join(' ～ '):'図の省略線をドラッグして範囲を調整';
  const choosingHoles=action?.kind==='holes'&&!!action.candidates;
  $('drawing-hole-start').disabled=!ready||!viewSelection.length;
  $('drawing-hole-all').hidden=$('drawing-hole-add').hidden=!choosingHoles;
  $('drawing-hole-all').disabled=!ready||!choosingHoles||action.candidates.length>maxDrawingTableHoles;
  $('drawing-hole-add').disabled=!ready||!choosingHoles||!action.selected.size;
  $('drawing-hole-delete').hidden=!holeTable||action?.kind==='holes';
  $('drawing-hole-delete').disabled=!ready;
  $('drawing-hole-review').hidden=!holeTable?.review;
  syncCommentStyle(ready);
  presets.sync();
  if(dialog.open)frontFace??=getFrontFace();
  const face=frontFace&&targets.includes(frontFace.bodyId)?frontFace:null;
  const alreadyFront=face&&sameDrawingFront(frontFrame,drawingFrontFrame(face.frame.n));
  $('drawing-front-face').disabled=!ready||!face||alreadyFront;
  $('drawing-front-reset').hidden=!frontFrame;
  $('drawing-front-reset').disabled=!ready;
  $('drawing-front-status').textContent=alreadyFront?'選択面は現在の正面です':frontFrame?'変更した正面を使用中':face?'選択面を正面にできます':'CADで対象ボディの平面を選択すると使えます';
  $('drawing-dimension-font').disabled=!ready;
  $('drawing-dimension-font').value=dimensionFontSize;
  $('drawing-default-colors-reset').disabled=!ready||!Object.keys(dimensionColors).length;
  for(const [key,id] of colorFields){
   const input=$('drawing-default-'+id+'-color');
   input.value=drawingDimensionColor(key,null,dimensionColors);input.disabled=!ready;
  }
  for(const row of dimensionViewRows){
   const view=row.dataset.autoDimensionView;
   row.hidden=!viewSelection.includes(view);
   row.disabled=!ready;
   for(const input of row.querySelectorAll('input'))input.checked=autoDimensionViews[view]?.includes(input.value)??true;
  }
  for(const input of [...viewChecks,isoCheck])input.disabled=!ready;
  for(const id of ['drawing-view-priority','drawing-iso-mode','drawing-fit','drawing-arrange','drawing-auto-layout'])$(id).disabled=!ready;
  for(const id of ['drawing-dimension-overall','drawing-dimension-auto','drawing-section-add'])$(id).disabled=!ready||!viewSelection.length;
  for(const id of ['drawing-dimension-add','drawing-center-add','drawing-center-line','drawing-centers-all','drawing-detail-add'])$(id).disabled=!editable;
  $('drawing-target').disabled=busy;
  historyControls();editor();extraControls();syncHiddenViews();
  $('drawing-dimension-arrange').disabled=!editable||!dimensions.some(d=>sheet.layout[d.view]);
  $('drawing-dimension-undo').disabled=$('drawing-dimension-clear').disabled=!ready||!dimensions.length;
  $('drawing-dimension-cancel').hidden=!picking&&!action;
 }
 function beginBreakDrag(e,edge){
  const name=edge.closest('[data-view]')?.dataset.view,view=sheet.layout[name],cut=view?.break,start=paperPoint(e);
  if(!cut||!start)return;
  e.preventDefault();
  drag={type:'break',view:name,cut,edge:Number(edge.dataset.breakEdge),start,pointerId:e.pointerId};
  viewportHost.setPointerCapture(e.pointerId);
 }
 function previewBreakDrag(point,dx,dy){
  if(Math.abs(drag.cut.direction?dy:dx)<.3&&!drag.moved)return;
  drag.moved=true;
  const view=sheet.layout[drag.view],direction=drag.cut.direction;
  drag.next=moveDrawingBreakEdge(drag.cut,drag.edge,(direction?dy:dx)/view.scale);
  const svg=viewportHost.querySelector('svg');
  svg.querySelector('[data-break-guide]')?.remove();
  const guide=document.createElementNS('http://www.w3.org/2000/svg','line');
  const attrs=direction?{x1:view.x,x2:view.x+view.width,y1:point[1],y2:point[1]}:{x1:point[0],x2:point[0],y1:view.y,y2:view.y+view.height};
  for(const [key,value] of Object.entries({...attrs,'data-break-guide':'true',stroke:'#0095b6','stroke-width':.6,'stroke-dasharray':'2 1','pointer-events':'none'}))guide.setAttribute(key,value);
  svg.append(guide);
  status('省略範囲 '+drag.next.map(n=>Number((n*100).toFixed(1))+'%').join(' ～ '));
 }
 function clickHoleTable(e){
  const state=action;
  if(!state.candidates){
   const view=hitView(e,true);
   if(!view)throw Error('正投影図で基準点を選んでください');
   const hit=nearest(e,'point'),point=hit?.name===view?hit.point:local(view,paperPoint(e)),v=sheet.layout[view];
   if(drawingPointOmitted(v,point))throw Error('省略範囲の外で基準点を指定してください');
   const candidates=drawingTableHoles(data.views[view]).filter(hole=>drawingDimensionVisible(hole,v));
   if(!candidates.length)throw Error('この図に選べる円がありません');
   Object.assign(state,{view,origin:point,candidates,selected:new Set()});
  }else{
   const v=sheet.layout[state.view],p=paperPoint(e),matrix=viewportHost.querySelector('svg').getScreenCTM();
   let closest=-1,best=10/Math.hypot(matrix.a,matrix.b);
   for(const [index,c] of state.candidates.entries()){
    const q=map(state.view,c.center),r=Math.hypot(p[0]-q[0],p[1]-q[1]),distance=Math.min(r,Math.abs(r-c.radius*v.scale));
    if(distance<best){best=distance;closest=index;}
   }
   if(closest<0)throw Error('円の輪郭または中心付近をクリックしてください');
   if(state.selected.has(closest))state.selected.delete(closest);
   else{
    if(state.selected.size>=maxDrawingTableHoles)throw Error('穴位置表は '+maxDrawingTableHoles+' 件までです');
    state.selected.add(closest);
   }
  }
  updateHoleSelection();
 }
 function updateHoleSelection(){
  render(false);
  status('円をクリックして選択・解除し、「穴位置表を確定」を押してください（'+action.selected.size+' 件選択）');
 }
 function drawHoleSelection(){
  if(action?.kind!=='holes'||!action.candidates||!sheet.layout[action.view])return;
  const svg=viewportHost.querySelector('svg'),v=sheet.layout[action.view],ns='http://www.w3.org/2000/svg';
  const group=document.createElementNS(ns,'g');group.setAttribute('pointer-events','none');
  const add=(tag,attrs)=>{
   const el=document.createElementNS(ns,tag);
   for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);
   group.append(el);
  };
  const [x,y]=map(action.view,action.origin);
  add('path',{d:'M '+(x-2)+' '+y+' h 4 M '+x+' '+(y-2)+' v 4',stroke:'#008a9e','stroke-width':.5});
  action.candidates.forEach((hole,i)=>{
   const [cx,cy]=map(action.view,hole.center),selected=action.selected.has(i);
   add('circle',{cx,cy,r:hole.radius*v.scale,fill:selected?'#008a9e25':'none',stroke:selected?'#008a9e':'#4384a0',
    'stroke-width':selected?.5:.3,'stroke-dasharray':selected?'none':'1 1'});
  });
  svg.append(group);
 }
 function syncCommentStyle(ready){
  $('drawing-comment-color').value=commentColor;
  $('drawing-comment-font').value=commentFont;
  $('drawing-comment-size').value=commentSize;
  $('drawing-comment-color').disabled=$('drawing-comment-font').disabled=$('drawing-comment-size').disabled=!ready;
  $('drawing-comment').style.fontFamily=drawingCommentFamily(commentFont);
  if(commentFont===requestedCommentFont)return;
  const font=commentFont,label=$('drawing-comment-font-status');
  requestedCommentFont=font;
  label.textContent=font?'フォントを読み込んでいます…':'';
  if(!font)return;
  loadDrawingCommentFont(font).then(()=>{
   if(commentFont!==font)return;
   label.textContent='';
   if(dialog.open&&sheet)render(false);
  }).catch(()=>{
   if(commentFont===font)label.textContent='フォントを読み込めませんでした。選び直して再試行してください。';
  });
 }
 function viewLabel(name){
  const node=viewportHost.querySelector('[data-view="'+name+'"] > text');
  return drawingProjections[name]?.label||(name==='iso'?'ISO':node?.textContent??(name.startsWith('section-')?'断面図':'詳細図'));
 }
 function syncHiddenViews(){
  const names=Object.keys(sheet?.layout||{});
  if(JSON.stringify(names)!==JSON.stringify([...hiddenRows.querySelectorAll('select')].map(s=>s.dataset.view))){
   hiddenRows.replaceChildren();
   for(const name of names){
    const label=document.createElement('label'),select=document.createElement('select');
    select.dataset.view=name;select.setAttribute('aria-label',viewLabel(name)+'の隠れ線');
    for(const [text,value] of [['共通設定','default'],['表示','show'],['非表示','hide']])select.add(new Option(text,value));
    select.onchange=()=>{
     if(select.value==='default')delete hiddenViews[name];
     else hiddenViews[name]=select.value==='show';
     render();
    };
    label.append(viewLabel(name),select);hiddenRows.append(label);
   }
  }
  $('drawing-hidden-views').hidden=!names.length;
  for(const select of hiddenRows.querySelectorAll('select')){
   const value=hiddenViews[select.dataset.view];
   select.value=value===undefined?'default':value?'show':'hide';select.disabled=busy;
  }
 }
 function pruneHiddenViews(){
  const keep=new Set([...drawingProjectionNames,'iso',...sections.map(s=>s.id),...details.map(d=>d.id)]);
  for(const name of Object.keys(hiddenViews))if(!keep.has(name))delete hiddenViews[name];
 }
 function renderReviewList(){
  reviewList.replaceChildren();
  dimensions.forEach((d,index)=>{
   if(!d.review)return;
   const button=document.createElement('button');button.type='button';button.textContent=viewLabel(d.view)+' 寸法 '+(index+1);
   button.onclick=()=>{
    if(busy)return;
    selection={type:'dimension',index};editor();
    $('drawing-editor').scrollIntoView({block:'nearest'});
    $('drawing-editor-title').focus({preventScroll:true});
   };
   reviewList.append(button);
  });
  reviewList.hidden=!reviewList.childElementCount;
  if(!reviewList.hidden){
   const label=document.createElement('strong');label.textContent='参照先を要確認 '+reviewList.childElementCount+' 件';reviewList.prepend(label);
  }
 }
 function renderOverflow(){
  const svg=viewportHost.querySelector('svg');
  const nodes=svg.querySelectorAll('[data-view],[data-dimension],[data-comment],[data-marker],[data-section],[data-detail],[data-hole-table],[data-hole-labels]');
  const adjusting=$('drawing-layout-mode').checked;
  overflowList.replaceChildren();
  for(const el of nodes){
   const {view,dimension,comment,marker,section,detail,holeTable:table,holeLabels}=el.dataset;
   const v=sheet.layout[view];
   let box;
   if(v){
    const title=el.querySelector(':scope > text').getBBox(),x=Math.min(v.x,title.x),y=Math.min(v.y,title.y);
    box={x,y,width:Math.max(v.x+v.width,title.x+title.width)-x,height:Math.max(v.y+v.height,title.y+title.height)-y};
   }else box=el.getBBox();
   if(box.x>=4.99&&box.y>=16.99&&box.x+box.width<=sheet.width-4.99&&box.y+box.height<=sheet.contentBottom+.01)continue;
   const name=view?el.querySelector(':scope > text').textContent:dimension!==undefined?'寸法 '+(Number(dimension)+1):
    comment?'コメント':table?'穴位置表':holeLabels?'穴の番号・基準点':marker?'中心表示 '+(markers.findIndex(m=>m.id===marker)+1):
    section?'切断線 '+String.fromCharCode(65+sections.findIndex(s=>s.id===section)):'詳細範囲 D'+(details.findIndex(d=>d.id===detail)+1);
   const adjust=()=>{
    if(busy||drag)return;
    $('drawing-layout-mode').checked=true;
    picking=null;action=null;selection=null;
    render(false);
    viewport.focus(box);viewportHost.scrollIntoView({block:'nearest'});viewportHost.focus({preventScroll:true});
    status(name+'の位置を調整できます。'+(marker||detail||holeLabels?'元の図をドラッグしてください':'赤枠の内側の項目をドラッグしてください'));
   };
   const button=document.createElement('button');
   button.type='button';button.textContent=name;button.onclick=adjust;
   button.setAttribute('aria-label',name+'のはみ出しを調整');
   overflowList.append(button);
   el.setAttribute('data-drawing-overflow','true');
   const outline=document.createElementNS('http://www.w3.org/2000/svg','rect');
   const attrs={x:box.x-.65,y:box.y-.65,width:box.width+1.3,height:box.height+1.3,
    'data-overflow-outline':'true',fill:'none','pointer-events':adjusting||picking||action?'none':'stroke'};
   for(const [key,value] of Object.entries(attrs))outline.setAttribute(key,value);
   outline.onclick=e=>{e.stopPropagation();adjust();};
   svg.append(outline);
  }
  overflow=overflowList.childElementCount>0;
  if(overflow){
   const label=document.createElement('strong');
   label.textContent='はみ出し '+overflowList.childElementCount+' 件';overflowList.prepend(label);
  }
  overflowList.hidden=!overflow;
 }
 function render(commit=true){
 if(!data)return;
 if(commit&&layoutKind==='compact'&&Object.keys(withDetails(data,details).views).some(key=>drawingViewVisible(key,options())&&!positions[key])){
  if(applyAutomaticLayout())return;
  layoutKind='projection';positions={};
 }
 try{sheet=drawingSheet(data,Number($('drawing-scale').value),$('drawing-hidden').checked,dimensions,$('drawing-comment').value,options());$('drawing-preview').innerHTML=sheet.svg;viewport.setSheet(sheet);$('drawing-layout-help').textContent=layoutKind==='compact'?'自由配置で用紙を広く使います。各図の縮尺と断面・詳細図の倍率は図面に表示します。':'第三角法の位置関係で表示します。「大きく自動配置」で位置関係を自由に組み替えられます。';
 renderOverflow();renderReviewList();drawHoleSelection();
 $('drawing-svg').disabled=$('drawing-pdf').disabled=overflow||Object.keys(data.sectionErrors||{}).length>0;$('drawing-paper').textContent='用紙 '+sheet.width.toFixed(1)+' × '+sheet.height.toFixed(1)+' mm';status(overflow?'用紙の外にはみ出しています。縮尺を小さくするか、配置・用紙サイズを変更してください':data.bodyCount+' ボディ · 寸法 '+dimensions.filter(d=>sheet.layout[d.view]&&drawingDimensionVisible(d,sheet.layout[d.view])).length+' 個 · 作業ファイルを保存すると再編集できます');controls();
 if($('drawing-layout-mode').checked){for(const g of $('drawing-preview').querySelectorAll('[data-view]')){const v=sheet.layout[g.dataset.view],b={x:v.x,y:v.y-7,width:v.width,height:v.height+7},rect=document.createElementNS('http://www.w3.org/2000/svg','rect');for(const [k,v] of Object.entries({x:b.x,y:b.y,width:b.width,height:b.height,fill:'transparent','pointer-events':'all'}))rect.setAttribute(k,v);g.prepend(rect);} $('drawing-preview').style.cursor='move';}else $('drawing-preview').style.cursor=picking?'crosshair':'';
 collisionWarning();for(const path of viewportHost.querySelectorAll('[data-break-edge]')){const hit=path.cloneNode();hit.setAttribute('stroke','transparent');hit.setAttribute('stroke-width','4');hit.setAttribute('pointer-events',picking||action?'none':'stroke');path.before(hit);}if(Object.keys(data.sectionErrors||{}).length)status('断面図：'+Object.values(data.sectionErrors).join(' / ')+'（位置を直すか、この断面図を削除してください）');for(const g of $('drawing-preview').querySelectorAll('[data-section],[data-marker]')){const path=g.querySelector('path');if(!path)continue;const hit=path.cloneNode();hit.setAttribute('stroke','transparent');hit.setAttribute('stroke-width','3');hit.removeAttribute('stroke-dasharray');g.prepend(hit);}if(commit)persist();}catch(e){sheet=null;$('drawing-preview').replaceChildren();$('drawing-svg').disabled=$('drawing-pdf').disabled=true;overflowList.hidden=reviewList.hidden=true;status(e.message);}}
 async function generate({refresh=false,targetsChanged=false}={}){
  busy=true;const token=++revision;worker.reset();data=null;sheet=null;picking=null;selection=null;
  $('drawing-preview').replaceChildren();overflowList.hidden=reviewList.hidden=true;$('drawing-svg').disabled=$('drawing-pdf').disabled=true;controls();
  targets=($('drawing-target').value==='selected'?selected:visible).slice();
  if(!targets.length){busy=false;controls();status('対象ボディがありません。閉じてボディを選択してください');return;}
  $('drawing-generate').disabled=true;status('輪郭と隠れ線を計算しています…');
  try{
   const views=requestedViews(options());
   if(refresh&&!targetsChanged){
    for(const {view} of dimensions)if(drawingProjectionNames.includes(view)&&!views.includes(view))views.push(view);
   }
   const result=await worker.request({features,spec:{type:'orthographic',targets,sections,views,frontFrame}},300000);
   if(token!==revision)return;
   data=result;
   if(refresh){
    dimensions=reconcileDrawingDimensions(withDetails(data,details),dimensions,dimensionReferences,{targetsChanged});
    if(holeTable&&!holeTable.review&&(targetsChanged||!drawingHoleTableMatches(holeTable,data.views[holeTable.view]))){
     holeTable={...holeTable,review:true};
    }
    const needsReview=dimensions.filter(d=>d.review).length;
    const wasReplaying=replaying;replaying=true;
    try{render();}finally{replaying=wasReplaying;}
    if(sheet&&!overflow)status('図面を更新しました。引き継いだ寸法 '+(dimensions.length-needsReview)+' 件'+(needsReview?' ／ 要確認 '+needsReview+' 件':''));
   }else if(saved||!applyAutomaticLayout())render();
   const failures=Object.values(result.sectionErrors||{}).filter(Boolean);
   if(failures.length)status('断面図：'+failures.join(' / '));
   return true;
  }catch(e){if(token===revision)status(e.message);}
  finally{if(token===revision){worker.reset();$('drawing-generate').disabled=false;busy=false;controls();}}
 }
 async function changeFrontFrame(next){
  if(!data||busy||sameDrawingFront(frontFrame,next))return;
  if((dimensions.length||sections.length||details.length||markers.length||holeTable)&&
   !window.confirm('向きを変更すると寸法・断面図・詳細図・中心線・穴位置表が解除されます。元に戻すと復元できます。変更しますか？'))return;
  const token=++revision;
  busy=true;controls();
  $('drawing-generate').disabled=$('drawing-svg').disabled=$('drawing-pdf').disabled=true;
  status('正面と各ビューを計算しています…');
  let result,error;
  try{
   result=await worker.request({features,spec:{type:'orthographic',targets,views:requestedViews({...options(),details:[]}),frontFrame:next}},300000);
  }catch(e){error=e;}
  if(token!==revision||!dialog.open)return;
  worker.reset();busy=false;$('drawing-generate').disabled=false;
  if(!result){render(false);status(error?.message||'向きを変更できませんでした');return;}
  frontFrame=next;data=result;
  dimensions=[];sections=[];details=[];markers=[];holeTable=undefined;
  pruneHiddenViews();
  positions=positions.comment?{comment:positions.comment}:{};
  picking=null;action=null;selection=null;
  if(!applyAutomaticLayout()){
   layoutKind='projection';
   render();
  }
 }
 $('drawing-front-face').onclick=()=>{if(frontFace)changeFrontFrame(drawingFrontFrame(frontFace.frame.n));};
 $('drawing-front-reset').onclick=()=>changeFrontFrame(undefined);
 $('drawing-break-axis').onchange=()=>{
  if(!sheet||busy)return;
  breakAxis=$('drawing-break-axis').value;
  breakRange=undefined;
  if(!applyAutomaticLayout())render();
 };
 $('drawing-break-percent').onchange=()=>{
  const percent=$('drawing-break-percent').valueAsNumber;
  if(!sheet||busy||!Number.isInteger(percent)||percent<20||percent>90){controls();return;}
  breakPercent=percent;
  breakRange=undefined;
  if(!applyAutomaticLayout())render();
 };
 $('drawing-break-center').onclick=()=>{
  if(!sheet||busy)return;
  breakRange=undefined;
  if(!applyAutomaticLayout())render();
 };
 $('drawing-hole-start').onclick=()=>beginAction('holes');
 $('drawing-hole-all').onclick=()=>{
  if(action?.kind!=='holes'||!action.candidates||action.candidates.length>maxDrawingTableHoles)return;
  action.selected=new Set(action.candidates.keys());updateHoleSelection();
 };
 $('drawing-hole-add').onclick=()=>{
  if(action?.kind!=='holes'||!action.selected?.size)return;
  holeTable={view:action.view,origin:action.origin,holes:action.candidates.filter((_,i)=>action.selected.has(i))};
  action=null;
  if(!applyAutomaticLayout())render();
 };
 $('drawing-hole-delete').onclick=()=>{
  if(!holeTable||busy)return;
  holeTable=undefined;delete positions.holeTable;render();
 };
 function renderResizedDimensions(){
  const adjusted=reflowResizedDrawingDimensions(dimensions,sheet);
  dimensions=adjusted.dimensions;
  render();
  if(adjusted.moved&&sheet&&!overflow)status($('drawing-status').textContent+' · 自動寸法 '+adjusted.moved+' 件の位置を調整しました');
 }
 $('drawing-dimension-font').onchange=()=>{
  const value=$('drawing-dimension-font').valueAsNumber;
  if(!sheet||busy||!Number.isFinite(value)||value<1.5||value>10){controls();return;}
  dimensionFontSize=value;
  dimensions=dimensions.map(d=>{
   const resized={...d};
   delete resized.fontSize;
   return applyDimensionFont(resized);
  });
  picking=null;action=null;renderResizedDimensions();
 };
 const cancelPick=()=>{picking=null;action=null;render();controls();};
 $('drawing-generate').onclick=()=>generate();$('drawing-target').onchange=()=>{dimensions=[];positions={};sections=[];details=[];markers=[];holeTable=undefined;pruneHiddenViews();generate();};$('drawing-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{viewport.cancel();clearTransient();persist();revision++;busy=false;worker.reset();$('drawing-generate').disabled=false;});
 for(const id of ['drawing-scale','drawing-hidden','drawing-paper-size','drawing-orientation','drawing-frame','drawing-date'])$(id).onchange=()=>{if(layoutKind==='compact'&&['drawing-paper-size','drawing-orientation','drawing-frame'].includes(id))applyAutomaticLayout();else cancelPick();};for(const id of ['drawing-name','drawing-material','drawing-comment']){$(id).oninput=()=>{picking=null;render(false);};$(id).onchange=()=>persist();}
 async function changeDrawingViews(next,reflow=false){
  const previous=options();
  try{
   requireVisibleView(next);
   if(!await loadMissingViews(next))return;
   setViewSelection(next.viewSelection);
   setIsoMode(next.isoMode);
   selection=null;picking=null;action=null;
   if(!reflow||!applyAutomaticLayout())render();
  }catch(error){
   if(!dialog.open)return;
   setViewSelection(previous.viewSelection);
   setIsoMode(previous.isoMode);
   render(false);
   status(error.message||'指定したビューを計算できませんでした');
  }
 }
 for(const input of viewChecks)input.onchange=()=>{if(data&&!busy)changeDrawingViews({...options(),viewSelection:viewChecks.filter(check=>check.checked).map(check=>check.value)});};
 isoCheck.onchange=()=>{
  if(data&&!busy)changeDrawingViews({...options(),isoMode:isoCheck.checked?lastVisibleIsoMode:'hidden'});
 };
 isoModeInput.onchange=()=>{
  if(!data||busy)return;
  const isoMode=isoModeInput.value;
  setIsoMode(saved?.options.isoMode??'full');
  changeDrawingViews({...options(),isoMode},true);
 };
 $('drawing-view-priority').onchange=()=>{
  if(!data||busy)return;
  const previous={...options(),viewPriority:saved?.options.viewPriority??'balanced'},previousDimensions=dimensions,scale=Number($('drawing-scale').value);
  dimensions=rescaleDrawingAnnotations(dimensions,drawingViewFrames(data,options()),scale,scale,drawingViewFrames(data,previous));
  if(!applyAutomaticLayout()){dimensions=previousDimensions;$('drawing-view-priority').value=previous.viewPriority;}
 };
 $('drawing-layout-mode').onchange=cancelPick;$('drawing-auto-layout').onclick=()=>{if(!busy)applyAutomaticLayout();};$('drawing-arrange').onclick=()=>{layoutKind='projection';positions={};cancelPick();};$('drawing-fit').onclick=()=>{layoutKind='projection';positions={};picking=null;for(const scale of scales){setScale(scale);render(false);if(sheet&&!overflow)break;}persist();};
 $('drawing-svg').onclick=async()=>{
  if(!sheet||overflow||Object.keys(data.sectionErrors||{}).length)return;
  const snapshot=sheet;
  if(!snapshot.note?.font){download(snapshot.svg,'three-views.svg','image/svg+xml');return;}
  $('drawing-svg').disabled=true;
  try{
   await loadDrawingCommentFont(snapshot.note.font);
   const svg=new DOMParser().parseFromString(snapshot.svg,'image/svg+xml').documentElement;
   prepareDrawingComment(svg);
   download(new XMLSerializer().serializeToString(svg),'three-views.svg','image/svg+xml');
  }catch(error){status('SVG保存に失敗しました：'+error.message);}
  finally{$('drawing-svg').disabled=busy||!sheet||overflow||Object.keys(data?.sectionErrors||{}).length>0;}
 };
 $('drawing-pdf').onclick=async()=>{if(!sheet||overflow||Object.keys(data.sectionErrors||{}).length)return;const snapshot=sheet;$('drawing-pdf').disabled=true;try{await loadDrawingCommentFont(snapshot.note?.font);const {jsPDF}=await import('jspdf');await import('svg2pdf.js');const pdf=new jsPDF({orientation:snapshot.width>=snapshot.height?'landscape':'portrait',unit:'mm',format:[snapshot.width,snapshot.height]});const svg=new DOMParser().parseFromString(snapshot.svg,'image/svg+xml').documentElement;prepareJapanesePDF(svg);await pdf.svg(svg,{x:0,y:0,width:snapshot.width,height:snapshot.height});download(pdf.output('arraybuffer'),'three-views.pdf','application/pdf');}catch(e){status('PDF保存に失敗しました：'+e.message);}finally{$('drawing-pdf').disabled=!sheet||overflow||Object.keys(data?.sectionErrors||{}).length>0;}};
 function clearViewAnnotations(id){dimensions=dimensions.filter(d=>d.view!==id);markers=markers.filter(m=>m.view!==id);for(const d of details.filter(d=>d.view===id)){clearViewAnnotations(d.id);delete positions[d.id];}details=details.filter(d=>d.view!==id);pruneHiddenViews();}
 function extraControls(){const list=[...sections.map((s,i)=>({id:s.id,label:'断面 '+String.fromCharCode(65+i)+'–'+String.fromCharCode(65+i)})),...details.map((d,i)=>({id:d.id,label:'詳細 D'+(i+1)}))];if(!list.some(e=>e.id===extraTarget))extraTarget=list[0]?.id||'';$('drawing-extra-editor').hidden=!list.length;$('drawing-extra-target').innerHTML=list.map(e=>`<option value="${e.id}">${e.label}</option>`).join('');$('drawing-extra-target').value=extraTarget;const section=sections.find(s=>s.id===extraTarget);$('drawing-section-reverse').hidden=$('drawing-section-position-label').hidden=!section;if(section&&document.activeElement!==$('drawing-section-position'))$('drawing-section-position').value=Number(section.coordinate.toFixed(4));$('drawing-section-reverse').disabled=$('drawing-extra-delete').disabled=$('drawing-section-position').disabled=busy;}
 $('drawing-extra-target').onchange=()=>{extraTarget=$('drawing-extra-target').value;extraControls();};
 $('drawing-extra-delete').onclick=()=>{if(busy)return;clearViewAnnotations(extraTarget);sections=sections.filter(s=>s.id!==extraTarget);details=details.filter(d=>d.id!==extraTarget);pruneHiddenViews();delete positions[extraTarget];if(data.views[extraTarget])delete data.views[extraTarget];if(data.sectionErrors)delete data.sectionErrors[extraTarget];cancelPick();};
 $('drawing-section-reverse').onclick=()=>{const section=sections.find(s=>s.id===extraTarget);if(!section||busy)return;section.reverse=!section.reverse;clearViewAnnotations(section.id);generate();};
 $('drawing-section-position').onchange=()=>{const section=sections.find(s=>s.id===extraTarget),value=Number($('drawing-section-position').value);if(!section||!Number.isFinite(value)||Math.abs(value)>1e6||busy)return;section.coordinate=value;clearViewAnnotations(section.id);generate();};
 const beginAction=kind=>{if(!data||busy)return;picking=null;selection=null;$('drawing-layout-mode').checked=false;action={kind};render();markPoints();status({center:'円・円弧をクリックすると中心マークを追加します',line:'中心線を通す端点・円の中心を２点選択してください',section:'正投影図に切断線を置いてください。円の中心・端点に吸着します',detail:'拡大したい部分の中心をクリックし、次に範囲の半径を指定してください',holes:'正投影図で穴位置表の基準点をクリックしてください。右が＋X、上が＋Yです'}[kind]);};
 $('drawing-center-add').onclick=()=>beginAction('center');$('drawing-center-line').onclick=()=>beginAction('line');$('drawing-section-add').onclick=()=>beginAction('section');$('drawing-detail-add').onclick=()=>beginAction('detail');
 $('drawing-centers-all').onclick=()=>{for(const view of names()){for(const c of circles(viewData(view))){if(!insideView(viewData(view),c.center)||markers.some(m=>m.kind==='center'&&m.view===view&&Math.hypot(m.center[0]-c.center[0],m.center[1]-c.center[1])<1e-5))continue;if(markers.length>=200)break;markers.push({id:'marker-'+crypto.randomUUID(),kind:'center',view,center:c.center,radius:c.radius});}}cancelPick();};
 function hitView(e,onlyBase=false){const p=paperPoint(e),keys=onlyBase?drawingProjectionNames:names().filter(n=>!n.startsWith('detail-'));return keys.find(name=>{const v=sheet.layout[name];return v&&p[0]>=v.x-2&&p[0]<=v.x+v.width+2&&p[1]>=v.y-2&&p[1]<=v.y+v.height+2;});}
 function snapCut(view,axis,value,disable=false){if(disable)return value;let best=1.5/sheet.layout[view].scale,result=value;for(const p of viewPoints(viewData(view))){if(drawingPointOmitted(sheet.layout[view],p))continue;if(Math.abs(p[axis]-value)<best){best=Math.abs(p[axis]-value);result=p[axis];}}return result;}
 function actionClick(e){try{const state=action;if(state.kind==='holes'){clickHoleTable(e);return;}if(state.kind==='center'){if(markers.length>=200)throw Error('中心表示は200個までです');const hit=nearest(e,'arc');if(!hit)throw Error('円・円弧をクリックしてください');if(!markers.some(m=>m.kind==='center'&&m.view===hit.name&&Math.hypot(m.center[0]-hit.arc.center[0],m.center[1]-hit.arc.center[1])<1e-5))markers.push({id:'marker-'+crypto.randomUUID(),kind:'center',view:hit.name,center:hit.arc.center,radius:hit.arc.radius});cancelPick();return;}
 if(state.kind==='line'){if(markers.length>=200)throw Error('中心表示は200個までです');const hit=nearest(e,'point');if(!hit)throw Error('輪郭の端点または円の中心をクリックしてください');if(!state.a){state.a=hit.point;state.view=hit.name;render();markPoints();status('同じ図の２点目を選択してください');return;}if(hit.name!==state.view)throw Error('同じ図の点を選んでください');if(Math.hypot(hit.point[0]-state.a[0],hit.point[1]-state.a[1])<1e-6)throw Error('別の点を選んでください');markers.push({id:'marker-'+crypto.randomUUID(),kind:'line',view:state.view,a:state.a,b:hit.point});cancelPick();return;}
 if(state.kind==='section'){if(sections.length>=8)throw Error('断面図は８個までです');const view=hitView(e,true);if(!view)throw Error('正投影図の内側をクリックしてください');const p=local(view,paperPoint(e));if(drawingPointOmitted(sheet.layout[view],p))throw Error('省略範囲の外に切断線を置いてください');const orientation=$('drawing-section-orientation').value,axis=orientation==='vertical'?0:1,id='section-'+crypto.randomUUID();sections.push({id,view,orientation,coordinate:snapCut(view,axis,p[axis],e.altKey),reverse:false});extraTarget=id;action=null;generate();return;}
 if(state.kind==='detail'){if(details.length>=8)throw Error('詳細図は８個までです');if(!state.center){const view=hitView(e);if(!view)throw Error('拡大元の図の内側をクリックしてください');state.center=local(view,paperPoint(e));if(drawingPointOmitted(sheet.layout[view],state.center)){state.center=null;throw Error('省略範囲の外で中心を選んでください');}state.view=view;status('範囲の外周をクリックしてください');return;}const p=local(state.view,paperPoint(e)),radius=Math.hypot(p[0]-state.center[0],p[1]-state.center[1]);if(radius*sheet.layout[state.view].scale<1)throw Error('範囲を少し大きくしてください');const id='detail-'+crypto.randomUUID();details.push({id,view:state.view,center:state.center,radius,factor:Number($('drawing-detail-factor').value)});extraTarget=id;cancelPick();}}
 catch(err){status(err.message);}}
 function actionPreview(e){const svg=$('drawing-preview').querySelector('svg');svg.querySelector('[data-action-preview]')?.remove();if(!action)return;let attrs;if(action.kind==='detail'&&action.center){const c=map(action.view,action.center),p=paperPoint(e);attrs={cx:c[0],cy:c[1],r:Math.hypot(p[0]-c[0],p[1]-c[1])};}else if(action.kind==='section'){const name=hitView(e,true);if(!name)return;const v=sheet.layout[name],axis=$('drawing-section-orientation').value==='vertical'?0:1,p=local(name,paperPoint(e)),coord=snapCut(name,axis,p[axis],e.altKey),q=map(name,axis===0?[coord,v.by]:[v.bx,coord]);attrs=axis===0?{x1:q[0],x2:q[0],y1:v.y,y2:v.y+v.height}:{x1:v.x,x2:v.x+v.width,y1:q[1],y2:q[1]};}else return;const node=document.createElementNS('http://www.w3.org/2000/svg',attrs.r!==undefined?'circle':'line');for(const [key,val] of Object.entries({...attrs,'data-action-preview':'true',fill:'none',stroke:'#0095b6','stroke-width':.4,'stroke-dasharray':'2 1','pointer-events':'none'}))node.setAttribute(key,val);svg.append(node);}
 function collisionWarning(){const nodes=[...$('drawing-preview').querySelectorAll('[data-dimension] text,[data-comment] text')];let count=0;for(let i=0;i<nodes.length;i++){const a=nodes[i].getBBox();for(let j=i+1;j<nodes.length;j++){const b=nodes[j].getBBox();if(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y){nodes[i].setAttribute('data-overlap','true');nodes[j].setAttribute('data-overlap','true');count++;}}}if(count&&!overflow)status($('drawing-status').textContent+' · 文字の重なり '+count+' 箇所（赤色）');}

 function map(name,p){return drawingPaperPoint(sheet.layout[name],p);}
 function local(name,p){return drawingModelPoint(sheet.layout[name],p);}
 function paperPoint(e){const svg=$('drawing-preview').querySelector('svg'),m=svg?.getScreenCTM();if(!m)return null;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());return [p.x,p.y];}
 function markPoints(){if((!picking&&action?.kind!=='line')||['radius','diameter','angle'].includes(picking?.kind))return;const svg=$('drawing-preview').querySelector('svg');for(const name of names()){if(picking?.view&&picking.view!==name)continue;for(const p of viewPoints(viewData(name))){if(drawingPointOmitted(sheet.layout[name],p))continue;const q=map(name,p),circle=document.createElementNS('http://www.w3.org/2000/svg','circle');for(const [k,v] of Object.entries({cx:q[0],cy:q[1],r:1,fill:'#008caf','data-snap-view':name,'data-snap-point':JSON.stringify(p)}))circle.setAttribute(k,v);svg.append(circle);}}viewport.markers();}
 function startDimension(kind,reference={}){if(!data||busy)return;action=null;selection=null;$('drawing-layout-mode').checked=false;picking={kind,...reference};render();markPoints();status(['diameter','radius'].includes(picking.kind)?'円または円弧をクリックし、寸法を置く位置をクリックしてください':picking.kind==='angle'?'同じ図の直線を２本選び、角度寸法を置く位置をクリックしてください':'同じ図の輪郭端点を２点選び、寸法線を置く位置をクリックしてください');}
 $('drawing-dimension-add').onclick=()=>startDimension($('drawing-dimension-kind').value);
 $('drawing-dimension-cancel').onclick=cancelPick;dialog.addEventListener('cancel',e=>{if(picking||action){e.preventDefault();cancelPick();}});$('drawing-dimension-undo').onclick=()=>{dimensions.pop();selection=null;cancelPick();};$('drawing-dimension-clear').onclick=()=>{dimensions=[];selection=null;cancelPick();};
 $('drawing-dimension-overall').onclick=()=>{if(!data||!sheet||busy)return;for(const d of overallDrawingDimensions(data,Number($('drawing-scale').value),sheet,{uniqueAxes:true}))if(dimensions.length<500&&!dimensions.some(e=>!e.review&&e.overall===d.overall))dimensions.push(applyDimensionFont(d));cancelPick();};
 $('drawing-dimension-auto').onclick=()=>{if(!data||!sheet||busy)return;picking=null;action=null;selection=null;const result=autoDrawingDimensions(data,Number($('drawing-scale').value),dimensions,sheet,{views:autoDimensionViews,fontSize:dimensionFontSize===standardDimensionFont?undefined:dimensionFontSize});dimensions.push(...result.dimensions);if(layoutKind==='compact')applyAutomaticLayout();else render();if(!overflow)status(result.dimensions.length?'寸法を '+result.dimensions.length+' 個、自動追加しました。外形・円形部の下書きです。クリックで編集・削除、元に戻すで一括取消できます。'+(result.skipped?' 小さい円形部・過密な部分は省略しました。':'')+(result.layoutWarnings?' '+result.layoutWarnings+' 個の寸法は配置の調整が必要です。「用紙に収める」や用紙サイズの変更後に自動配置できます。':''):'追加できる寸法はありません。既存の寸法は重複させません。');};
 $('drawing-dimension-arrange').onclick=()=>{if(!data||!sheet||busy||!dimensions.length)return;picking=null;action=null;selection=null;const layout=arrangeDrawingDimensions(dimensions,sheet);dimensions=layout.dimensions;render();if(!overflow)status('寸法を自動配置しました。元に戻すで配置を戻せます。'+(layout.unresolved.length?' '+layout.unresolved.length+' 個は重なりを解消できませんでした。縮尺・用紙サイズを調整してください。':''));};
 function nearest(e,kind){const matrix=$('drawing-preview').querySelector('svg').getScreenCTM(),screen=(name,p)=>{const q=map(name,p);return new DOMPoint(...q).matrixTransform(matrix);};let best=null,distance=12;const test=(name,point,item)=>{if(!insideView(viewData(name),point)||drawingPointOmitted(sheet.layout[name],point))return;const q=screen(name,point),dist=Math.hypot(q.x-e.clientX,q.y-e.clientY);if(dist<distance){best={name,point,...item};distance=dist;}};
 for(const name of names()){if(picking?.view&&picking.view!==name)continue;if(kind==='point'){for(const point of viewPoints(viewData(name)))test(name,point,{});continue;}const curves=drawingCurves(viewData(name).visible);if(kind==='line'){for(const line of curves.lines){const a=screen(name,line.a),b=screen(name,line.b),dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((e.clientX-a.x)*dx+(e.clientY-a.y)*dy)/(dx*dx+dy*dy||1)));test(name,[line.a[0]+t*(line.b[0]-line.a[0]),line.a[1]+t*(line.b[1]-line.a[1])],{line});}}else for(const arc of curves.arcs){const start=Math.atan2(arc.a[1]-arc.center[1],arc.a[0]-arc.center[0]),end=Math.atan2(arc.b[1]-arc.center[1],arc.b[0]-arc.center[0]);let delta=end-start;if(arc.sweep){while(delta<=0)delta+=2*Math.PI;}else while(delta>=0)delta-=2*Math.PI;for(let i=0;i<=160;i++){const t=start+delta*i/160;test(name,[arc.center[0]+arc.radius*Math.cos(t),arc.center[1]+arc.radius*Math.sin(t)],{arc});}}}return best;}
 $('drawing-preview').onclick=e=>{if(suppressClick){suppressClick=false;return;}if(!sheet||drag||busy)return;if(action){actionClick(e);return;}if(!picking){const marker=e.target.closest('[data-marker]');if(marker){selection={type:'marker',id:marker.dataset.marker};editor();return;}const extra=e.target.closest('[data-section],[data-detail]');if(extra){extraTarget=extra.dataset.section||extra.dataset.detail;extraControls();return;}const el=e.target.closest('[data-dimension],[data-comment]');selection=el?.hasAttribute('data-dimension')?{type:'dimension',index:Number(el.dataset.dimension)}:el?{type:'comment'}:null;editor();return;}try{if(picking.ready){if(dimensions.length>=500&&picking.replace===undefined)throw Error('寸法は500個まで追加できます');const p=paperPoint(e),at=local(picking.view,p),snapped=$('drawing-snap').checked&&!e.altKey?snapDimension(picking,at,dimensions,sheet.layout[picking.view].scale,picking.replace):{at},d={...picking,at:snapped.at};delete d.ready;delete d.firstLine;delete d.replace;const refreshed=applyDimensionFont(d);if(picking.replace===undefined)dimensions.push(refreshed);else{const old=dimensions[picking.replace];for(const key of ['precision','fontSize','note','tolerance','lineColor','textColor','pinned'])if(old[key]!==undefined)refreshed[key]=old[key];dimensions[picking.replace]=refreshed;selection={type:'dimension',index:picking.replace};}cancelPick();return;}
 if(['radius','diameter'].includes(picking.kind)){const hit=nearest(e,'arc');if(!hit)throw Error('円・円弧に近い位置をクリックしてください（楕円は対象外）');picking={...picking,view:hit.name,center:hit.arc.center,radius:hit.arc.radius,ready:true};}
 else if(picking.kind==='angle'){const hit=nearest(e,'line');if(!hit)throw Error('直線に近い位置をクリックしてください');if(!picking.firstLine){picking.view=hit.name;picking.firstLine=hit.line;status('２本目の直線を選択してください');return;}Object.assign(picking,angleDimension(picking.firstLine,hit.line),{ready:true});}
 else{const hit=nearest(e,'point');if(!hit)throw Error('青い輪郭端点に近い位置をクリックしてください');if(!picking.a){picking.view=hit.name;picking.a=hit.point;render();markPoints();status('２点目を選択してください');return;}picking.b=hit.point;if(dimensionValue(picking)<1e-6){delete picking.b;throw Error('寸法が０になります。別の端点を選択してください');}picking.ready=true;}
 status('寸法 '+Number(dimensionValue(picking).toFixed(3))+(picking.kind==='angle'?'°':' mm')+'：配置位置をクリックしてください');}catch(err){status(err.message);}};
 const host=$('drawing-preview');host.addEventListener('pointerdown',e=>{if(picking||action||busy||e.button!==0||!sheet)return;const edge=e.target.closest('[data-break-edge]');if(edge){beginBreakDrag(e,edge);return;}const cut=e.target.closest('[data-section]');if(cut){e.preventDefault();extraTarget=cut.dataset.section;const section=sections.find(s=>s.id===extraTarget);drag={type:'section',id:extraTarget,origin:section.coordinate,start:paperPoint(e)};drag.pointerId=e.pointerId;drag.cancelPositions=structuredClone(positions);host.setPointerCapture(e.pointerId);extraControls();return;}if(!$('drawing-layout-mode').checked)return;const dimension=e.target.closest('[data-dimension]'),comment=e.target.closest('[data-comment]'),table=e.target.closest('[data-hole-table]'),view=e.target.closest('[data-view]');if(!dimension&&!comment&&!table&&!view)return;if(dimension&&dimensions[Number(dimension.dataset.dimension)]?.pinned){status('この寸法は固定されています。寸法をクリックして解除できます');return;}e.preventDefault();const start=paperPoint(e);drag=dimension?{type:'dimension',index:Number(dimension.dataset.dimension),origin:[...dimensions[Number(dimension.dataset.dimension)].at],start}:comment?{type:'comment',origin:[sheet.note.x,sheet.note.y],start}:table?{type:'holeTable',name:'holeTable',origin:[sheet.holeBox.x,sheet.holeBox.y],start}:{type:'view',name:view.dataset.view,origin:[sheet.layout[view.dataset.view].x,sheet.layout[view.dataset.view].y],start};drag.pointerId=e.pointerId;drag.cancelPositions=structuredClone(positions);host.setPointerCapture(e.pointerId);});
 host.addEventListener('pointermove',e=>{if(!sheet)return;if(!drag){if(action)actionPreview(e);return;}const p=paperPoint(e),dx=p[0]-drag.start[0],dy=p[1]-drag.start[1];if(drag.type==='break'){previewBreakDrag(p,dx,dy);return;}if(Math.hypot(dx,dy)>.3)drag.moved=true;if(!drag.moved)return;if(drag.type==='section'){const section=sections.find(s=>s.id===drag.id),pos=local(section.view,p),coord=section.orientation==='vertical'?0:1;section.coordinate=snapCut(section.view,coord,pos[coord],e.altKey);render(false);return;}if(drag.type==='dimension'){const d=dimensions[drag.index],s=sheet.layout[d.view].scale,start=map(d.view,drag.origin),at=local(d.view,[start[0]+dx,start[1]+dy]),snap=$('drawing-snap').checked&&!e.altKey?snapDimension(d,at,dimensions,s,drag.index):{at};d.at=snap.at;render(false);if(snap.match)status('寸法線の位置に吸着中（Altで解除）');return;}else positions[drag.type==='comment'?'comment':drag.name]=[drag.origin[0]+dx,drag.origin[1]+dy];render(false);});
 for(const event of ['pointerup','pointercancel'])host.addEventListener(event,e=>{if(!drag)return;const finished=drag;suppressClick=!!drag.moved;setTimeout(()=>{suppressClick=false;},0);drag=null;if(host.hasPointerCapture(e.pointerId))host.releasePointerCapture(e.pointerId);if(finished.type==='break'){if(e.type==='pointerup'&&finished.moved){breakRange=finished.next;if(!applyAutomaticLayout())render();}else render(false);return;}if(finished.type==='section'&&finished.moved){clearViewAnnotations(finished.id);generate();}else persist();});
 function restore(s){holeTable=s?.options.holeTable?structuredClone(s.options.holeTable):undefined;breakRange=s?.options.breakRange?.slice();breakAxis=s?.options.breakAxis??'';breakPercent=s?.options.breakPercent??defaultBreakPercent;commentColor=s?.options.commentColor??defaultDrawingCommentColor;commentFont=s?.options.commentFont??'';dimensionColors=structuredClone(s?.options.dimensionColors||{});hiddenViews=structuredClone(s?.options.hiddenViews||{});dimensionReferences=structuredClone(s?.options.dimensionReferences||{});frontFrame=s?.options.frontFrame;autoDimensionViews=structuredClone(s?.options.autoDimensionViews||{});dimensionFontSize=s?.options.dimensionFontSize??standardDimensionFont;setViewSelection(s?.options.viewSelection??defaultDrawingViews);$('drawing-view-priority').value=s?.options.viewPriority??'balanced';setIsoMode(s?.options.isoMode??'full');sections=structuredClone(s?.options.sections||[]);details=structuredClone(s?.options.details||[]);markers=structuredClone(s?.options.markers||[]);action=null;commentSize=s?.options.commentSize??3.5;dimensions=structuredClone(s?.dimensions||[]);positions=structuredClone(s?.options.positions||{});layoutKind=s?.options.layout??'projection';setScale(s?.scale||1);$('drawing-hidden').checked=s?.hidden??true;$('drawing-comment').value=s?.comment||'';for(const key of ['paper','orientation','name','material','date']){const id={paper:'paper-size'}[key]||key;$('drawing-'+id).value=s?.options[key]??({paper:'A4',orientation:'landscape',date:new Date().toLocaleDateString('sv-SE')}[key]||'');}$('drawing-frame').checked=s?.options.frame??true;}
 document.getElementById('drawing-tool').onclick=()=>{
  presets.reload();selection=null;frontFace=getFrontFace();
  features=structuredClone(getFeatures());visible=getVisible();selected=getSelected().filter(id=>visible.includes(id));
  source=drawingSignature(features);
  restore(saved);
  if(saved?.targetMode==='selected'&&saved.targets.every(id=>visible.includes(id)))selected=saved.targets.slice();
  $('drawing-target').value=saved?.targetMode==='visible'||!selected.length?'visible':'selected';
  const nextTargets=$('drawing-target').value==='selected'?selected:visible;
  const targetsChanged=!!saved&&JSON.stringify([...saved.targets].sort())!==JSON.stringify([...nextTargets].sort());
  const refresh=!!saved&&(saved.signature!==source||targetsChanged);
  if(refresh){undo=[];redo=[];markers=[];}
  $('drawing-layout-mode').checked=false;dialog.showModal();viewport.reset();
  generate({refresh,targetsChanged});
 };
 function clearTransient(){
  const d=drag;drag=null;if(d){if(d.type==='dimension'&&dimensions[d.index])dimensions[d.index].at=d.origin;else if(d.type==='section'){const section=sections.find(s=>s.id===d.id);if(section)section.coordinate=d.origin;}else if(d.type!=='break')positions=d.cancelPositions;if(host.hasPointerCapture(d.pointerId))host.releasePointerCapture(d.pointerId);}
  picking=null;action=null;selection=null;extraTarget='';suppressClick=false;$('drawing-layout-mode').checked=false;if(d)render(false);controls();$('drawing-preview').style.cursor='';$('drawing-preview').querySelector('[data-action-preview]')?.remove();
 }
 function cancel(){if(!dialog.open&&!drag&&!picking&&!action&&!selection)return;clearTransient();++revision;busy=false;worker.reset();$('drawing-generate').disabled=false;if(dialog.open)dialog.close();}
 return {cancel,getState:()=>saved?structuredClone(saved):null,loadState:value=>{const parsed=readDrawingState(value);if(dialog.open)dialog.close();saved=parsed;undo=[];redo=[];selection=null;data=null;sheet=null;restore(saved);}};
}
