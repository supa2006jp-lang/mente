import {circles,viewPoints,insideView,withDetails,snapDimension} from './drawing-annotations.js';
import {assignDrawingPDFPageItem,drawingPDFHasMultiplePages,drawingPDFPageAssignments,drawingPDFPageItems,drawingPDFPages,
 fitDrawingPDFPage,maxDrawingPDFPages,remapDrawingPDFPages} from './drawing-pdf-pages.js';
import {installDrawingPDFPreview} from './drawing-pdf-preview.js';
import {drawingOverflowOutline,drawingPDFIssues,drawingSheetOverflow,drawingViewOverlaps,markDrawingViewOverlap} from './drawing-sheet-check.js';
import {drawingBoxPlacementIssue} from './drawing-paper-bounds.js';
import {pruneDetailDimensionPlacements} from './drawing-detail-dimensions.js';
import {maxDrawingLeaders,maxDrawingLeaderText} from './drawing-leaders.js';
import {prepareDrawingComment,prepareJapanesePDF} from './drawing-pdf-text.js';
import {defaultDrawingCommentColor,drawingCommentFamily,hasDrawingCommentFont,loadDrawingCommentFont,minCommentWidth,maxCommentWidth,validCommentWidth} from './drawing-comments.js';
import {TEXT_FONTS} from './text-fonts.js';
import {canOverrideDrawingDimensionValue,defaultDrawingDimensionColor,drawingDimensionColor,drawingDimensionGeometry,dimensionSVG,dimensionLabel,dimensionValue,isCircularDimensionKind,pathEndpoints,validDimensionColor,validDrawingDimensionDisplayValue} from './drawing-dimensions.js';
import {drawingDimensionBetween,drawingDimensionEndpoint,isLinearDimensionKind,replaceDrawingDimensionEndpoint} from './drawing-linear-dimensions.js';
import {canSaveDrawingMaterial,createDrawingMaterialsStore,drawingMaterialKey,standardDrawingMaterials} from './drawing-materials.js';
import {drawingCurves,angleDimension} from './drawing-curves.js';
import {drawingSignature,readDrawingState} from './drawing-state.js';
import {KernelClient} from './kernel-client.js';
import {installDrawingPresets} from './drawing-presets.js';
import {drawingBackgroundColor,drawingSheet} from './drawing-sheet.js';
import {defaultDrawingViews,drawingProjectionNames,drawingProjections,drawingScaleLabel,drawingViewScale,drawingViewScaleOverride,drawingViewVisible,linkedDrawingFollowers,linkedDrawingViews,projectionDragAxis,
 minDrawingScale,maxDrawingScale,drawingScaleStep,parseDrawingScale,snapDrawingResizeScale,stepDrawingScale,validDrawingDetailFactor} from './drawing-view-preferences.js';
import {optimizeDrawingLayout,drawingViewFrames,rescaleDrawingAnnotations} from './drawing-auto-layout.js';
import {drawingViewport} from './drawing-viewport.js';
import {installDrawingWorkspace} from './drawing-workspace.js';
import {installDrawingInlineScales} from './drawing-inline-scales.js';
import {drawingPrintPalettes,drawingPrintSVG,validDrawingPrintPalette} from './drawing-print-palette.js';
import {snapDrawingDragAxis,snapDrawingPlacement} from './drawing-placement-guides.js';
import {alignDrawingItems,drawingAlignmentActions} from './drawing-alignment.js';
import {drawingDimensionVisible,drawingModelPoint,drawingPaperPoint,drawingPointOmitted,moveDrawingBreakEdge} from './drawing-break.js';
import {addDrawingHoleHitAreas,maxDrawingTableHoles} from './drawing-hole-table.js';
import {associateDrawingHoleSources,drawingHoleCandidates,drawingHoleCenterReference,holeAnchor,holeReferenceInventory,lastHoleNumber,reconcileHoleTable,resolveDrawingHoleCenter,unlistedDrawingHoles} from './drawing-hole-references.js';
import {drawingThreadLeader,reconcileDrawingThreadLeaders} from './drawing-thread-annotations.js';
import {drawingThreadDimensionTarget,restoreAdjustedThreadDimensions} from './drawing-thread-dimensions.js';
import {followSectionEdit} from './drawing-section-references.js';
import {autoDimensionKeys,autoDimensionViewTypes,autoDrawingDimensions,drawingDiameterCandidateVisible,drawingDiameterDraftPosition,hideDuplicateOverallDimensions,overallDrawingDimensions,reconcileAutomaticOverallDimensions,unmeasuredDrawingHoles} from './drawing-auto-dimensions.js';
import {arrangeDrawingDimensions,dimensionPlacement,drawingDimensionConflicts,keepDrawingDimensionClear,reflowResizedDrawingDimensions} from './drawing-dimension-layout.js';
import {drawingLineworkTest} from './drawing-linework.js';
import {drawingFrontFrame,sameDrawingFront} from './drawing-front.js';
import {followDrawingFrontChange,planDrawingFrontChange,remapDrawingViewSettings} from './drawing-front-references.js';
import {captureDrawingReferences,reconcileDrawingDimensions,reconcileDrawingHolePoints} from './drawing-dimension-references.js';
import {drawingDimensionCenterGuides,drawingDimensionPointFits,maxDrawingDimensionPoints,sameDrawingCenter,snapDrawingDimensionPoint} from './drawing-dimension-points.js';
import {groupDrawingDimensions} from './drawing-dimension-groups.js';
import {installDrawingDimensionList} from './drawing-dimension-list.js';
const scales=[2,1,.5,.2,.1,.05,.02,.01];
const sameTargets=(left,right)=>left.length===right.length&&left.every(id=>right.includes(id));
const standardDimensionFont=3.2;
const dimensionPickTargets={
 horizontal:'同じ図で横の距離を測る左右の寸法点をクリックします。',
 vertical:'同じ図で縦の距離を測る上下の寸法点をクリックします。',
 aligned:'同じ図で長さを測る両端の寸法点をクリックします。',
 diameter:'直径を測る円・円弧の線をクリックします。',
 radius:'半径を測る円・円弧の線をクリックします。',
 thread:'ねじ・ねじ穴の円形の外周をクリックします。',
 angle:'同じ図で角度をつくる２本の直線をクリックします。',
};
const colorFields=[['lineColor','line','寸法線の色'],['textColor','text','数字・注記の色']];
const drawingColorPreferenceKey='forma-cad-drawing-colors-v1';
const drawingColorPreferenceChecks={
 lineColor:validDimensionColor,textColor:validDimensionColor,commentColor:validDimensionColor,
 paperBackground:validDimensionColor,viewBackground:validDimensionColor,printPalette:validDrawingPrintPalette,
};
function readDrawingColorPreferences(){
 try{
  const colors=JSON.parse(localStorage.getItem(drawingColorPreferenceKey));
  return Object.fromEntries(Object.entries(drawingColorPreferenceChecks)
   .filter(([key,valid])=>valid(colors?.[key])).map(([key])=>[key,colors[key].toLowerCase()]));
 }catch{return {};}
}
function rememberDrawingColors(changes){
 try{localStorage.setItem(drawingColorPreferenceKey,JSON.stringify({...readDrawingColorPreferences(),...changes}));}catch{}
}
const colorInputs=(scope)=>colorFields.map(([,id,label])=>'<label>'+label+
 '<input type="color" id="drawing-'+scope+'-'+id+'-color"></label>').join('');
export function installDrawing({getFeatures,getVisible,getSelected,getFrontFace=()=>null,download,exportPDF,exportPrintSet,canExportPrintSet=()=>false,onChange=()=>{}}){
 const pdfPreview=installDrawingPDFPreview({download:exportDrawingPDF,onIssue:focusPDFIssue,onEdit:editPDFPage,
  onMove:movePDFPageItem,onPageOrder:changePDFPageOrder,onFit:fitPDFPreviewPage,viewLabel:pdfViewLabel});
 const worker=new KernelClient(),dialog=document.createElement('dialog');dialog.id='drawing-dialog';dialog.innerHTML=`<div class="drawing-heading"><h2>三面図</h2><button type="button" id="drawing-close" aria-label="閉じる">×</button></div>
 <div class="drawing-controls"><label>対象<select id="drawing-target"><option value="visible">表示中の全ボディ</option><option value="selected">選択したボディ</option></select></label><label>縮尺<select id="drawing-scale">${scales.map(s=>'<option value="'+s+'"'+(s===1?' selected':'')+'>'+(s>=1?s+':1':'1:'+1/s)+'</option>').join('')}</select></label><label><input type="checkbox" id="drawing-hidden" checked>隠れ線（共通）</label><button id="drawing-generate">三面図を再計算</button></div>
 <div class="drawing-controls drawing-paper-controls"><label>用紙<select id="drawing-paper-size"><option value="auto">自動サイズ</option><option value="A4" selected>A4</option><option value="A3">A3</option></select></label><label>向き<select id="drawing-orientation"><option value="landscape">横</option><option value="portrait">縦</option></select></label><label><input id="drawing-frame" type="checkbox" checked>図枠</label>
 <label><input id="drawing-layout-label" type="checkbox" checked>FORMA CAD 表記</label>
 <button id="drawing-fit">用紙に収める</button><button id="drawing-auto-layout" title="用紙内で図を大きく配置し、残った余白で図の間隔を広げます">大きく自動配置</button><button id="drawing-arrange">配置をリセット</button><label><input id="drawing-projection-lock" type="checkbox">第三角法の配置をロック</label><label title="TOPとFRONTは左右、FRONTとRIGHTは上下の移動が連動します"><input id="drawing-link-projections" type="checkbox">TOP・FRONT・RIGHTを連動</label><label title="TOP・FRONT・RIGHTのどれかを拡縮すると、3面が同じ縮尺になります"><input id="drawing-link-scales" type="checkbox">縮尺も連動</label><label><input id="drawing-layout-mode" type="checkbox" checked title="寸法は斜めにもドラッグできます。Shiftを押すと寸法線に沿ったずれを抑えます。">配置をドラッグ</label></div>
 <div class="drawing-controls drawing-view-options" role="group" aria-label="図面に載せるビュー"><strong>載せるビュー</strong>${drawingProjectionNames.map(view=>{const {label,title}=drawingProjections[view];return '<label><input type="checkbox" value="'+view+'">'+label+' <span>'+title+'</span></label>';}).join('')}<label><input id="drawing-view-iso" type="checkbox" value="iso" checked>ISO <span>俯瞰図</span></label></div>
 <div class="drawing-controls"><label>図の優先<select id="drawing-view-priority"><option value="balanced">共通縮尺</option><option value="front">正面図を優先（1.4倍）</option></select></label><label>俯瞰図<select id="drawing-iso-mode"><option value="full">通常</option><option value="small">小さく（半分）</option><option value="hidden">非表示</option></select></label><small>異なる縮尺は各図に表示します。</small></div>
 <div class="drawing-controls"><label>部品名<input id="drawing-name" maxlength="80"></label><label>改訂番号<input id="drawing-revision" maxlength="20" size="8" placeholder="例 02"></label><label>材質<input id="drawing-material" maxlength="80" placeholder="手入力"></label><select id="drawing-material-preset" aria-label="材質の候補"><option value="" disabled>候補から選択</option>${standardDrawingMaterials.map(([group,items])=>'<optgroup label="'+group+'">'+items.map(item=>'<option>'+item+'</option>').join('')+'</optgroup>').join('')}<optgroup id="drawing-material-saved" label="登録した材質" hidden></optgroup></select><span class="drawing-material-actions"><button type="button" id="drawing-material-save" aria-label="入力した材質を候補に登録">登録</button><button type="button" id="drawing-material-remove" aria-label="登録した材質を候補から削除" hidden>削除</button></span><label>作成日<input id="drawing-date" type="date"></label><small id="drawing-material-status" role="status"></small></div>
 <p id="drawing-layout-help">通常配置は第三角法です。「大きく自動配置」は図の位置関係を自由に組み替え、共通縮尺で用紙を広く使います。寸法・コメント・配置は保存されます。</p>
 <div class="drawing-controls">
  <label>寸法<select id="drawing-dimension-kind" aria-describedby="drawing-dimension-hint"><option value="horizontal">水平（横の距離）</option><option value="vertical">垂直（縦の距離）</option><option value="aligned" selected>２点間（直線距離）</option><option value="diameter">直径 Ø</option><option value="radius">半径 R</option><option value="thread">ねじ（M）</option><option value="angle">角度</option></select></label>
  <small id="drawing-dimension-hint"></small>
  <button id="drawing-dimension-add">寸法線を追加</button><button id="drawing-dimension-overall">全体寸法を追加</button><button id="drawing-dimension-undo">最後の寸法を削除</button><button id="drawing-dimension-clear">寸法を全削除</button><button id="drawing-dimension-cancel" hidden>寸法追加を中止</button>
 </div>
 <div class="drawing-controls"><button id="drawing-center-add">中心マーク</button><button id="drawing-center-line">中心線（２点）</button><button id="drawing-centers-all">円の中心を一括表示</button><label>切断線<select id="drawing-section-orientation"><option value="vertical">縦</option><option value="horizontal">横</option></select></label><button id="drawing-section-add">断面図を追加</button><label>詳細図の新規倍率 (倍)<input id="drawing-detail-factor" type="number" min="1" max="${maxDrawingScale}" step="${drawingScaleStep}" value="2"></label><button id="drawing-detail-add">拡大詳細図を追加</button><label><input id="drawing-snap" type="checkbox" checked>配置・寸法線の吸着（Altで解除）</label></div>
 <div id="drawing-extra-editor" class="drawing-controls" hidden><label>断面・詳細図<select id="drawing-extra-target"></select></label><button id="drawing-section-reverse">見る方向を反転</button><label id="drawing-section-position-label">切断位置 (mm)<input id="drawing-section-position" type="number" step="0.1"></label><label id="drawing-detail-factor-label" hidden>選択した詳細図の倍率 (倍)<input id="drawing-detail-factor-edit" type="number" min="1" max="${maxDrawingScale}" step="${drawingScaleStep}"></label><button id="drawing-extra-delete">この図を削除</button><span>切断線は直接ドラッグ、図の配置は「配置をドラッグ」で変更できます</span></div>
 <div class="drawing-controls"><button id="drawing-undo" disabled>元に戻す</button><button id="drawing-redo" disabled>やり直す</button><span>寸法・コメントをクリックして編集（Ctrl+Z / Ctrl+Y）</span></div><div id="drawing-editor" hidden class="drawing-controls"><strong id="drawing-editor-title"></strong><label id="drawing-precision-label">小数点以下<select id="drawing-precision"><option value="auto">自動（最大３桁）</option>${[0,1,2,3,4,5,6].map(n=>`<option value="${n}">${n}桁</option>`).join('')}</select></label><label id="drawing-font-label">文字サイズ (mm)<input id="drawing-font" type="number" min="1.5" max="10" step="0.1"></label><button id="drawing-edit-comment">本文を編集</button><button id="drawing-delete-selection">選択項目を削除</button><button id="drawing-deselect">編集を終了</button></div><label class="drawing-comment-label">コメント<textarea id="drawing-comment" rows="2" maxlength="2000" placeholder="材質・加工の注意事項など（改行できます）"></textarea></label><p id="drawing-status" role="status"></p><div id="drawing-preview"></div><div class="drawing-actions"><span id="drawing-paper"></span><button id="drawing-svg" disabled>SVG保存</button><button id="drawing-pdf" disabled>PDF保存</button></div>`;
 document.body.append(dialog);const $=id=>dialog.querySelector('#'+id);let saved=null,data=null,sheet=null,revision=0,features=[],visible=[],selected=[],dimensions=[],positions={},picking=null,source='',targets=[],overflow=false,drag=null,selection=null,commentSize=3.5,undo=[],redo=[],replaying=false,suppressClick=false,sections=[],details=[],markers=[],extraTarget='',action=null,busy=false,layoutKind='projection';
 const viewportHost=$('drawing-preview');viewportHost.tabIndex=0;viewportHost.setAttribute('aria-label','図面。ホイールで拡大、ホイール押し込みまたはSpace＋ドラッグで移動');
 const dimensionKindInput=$('drawing-dimension-kind'),dimensionHint=$('drawing-dimension-hint');
 const pickGeometryCache=new WeakMap();
 const holeCenterCache=new WeakMap();
 const snapLabel=document.createElement('span');snapLabel.id='drawing-snap-label';snapLabel.hidden=true;
 let dimensionHover=null;
 let dimensionPoints=[];
 $('drawing-dimension-add').insertAdjacentHTML('afterend',
  '<button id="drawing-dimension-point-add" type="button" aria-pressed="false" title="紫の十字から穴・ねじ穴・長穴の中心に寸法点を置けます">寸法点を追加</button>');
 $('drawing-comment').closest('label').insertAdjacentHTML('afterend',
  '<div class="drawing-controls drawing-comment-style" role="group" aria-label="コメントの書式">'+
  '<label>コメントの文字色<input id="drawing-comment-color" type="color"></label>'+
  '<label>コメントのフォント<select id="drawing-comment-font"><option value="">標準</option>'+
  TEXT_FONTS.map(({id,label})=>'<option value="'+id+'">'+label+'</option>').join('')+'</select></label>'+
  '<label>コメントの文字サイズ (mm)<input id="drawing-comment-size" type="number" min="1.5" max="10" step="0.1"></label>'+
  '<small id="drawing-comment-font-status" role="status"></small></div>');
 dialog.querySelector('.drawing-view-options').insertAdjacentHTML('afterend','<details id="drawing-hidden-views"><summary>ビュー別の隠れ線</summary><div class="drawing-controls"></div></details>');
 $('drawing-pdf').insertAdjacentHTML('beforebegin','<button id="drawing-pdf-preview-open" type="button">PDFをプレビュー</button>');
 $('drawing-pdf').insertAdjacentHTML('afterend','<button id="drawing-print-set" type="button" hidden>PDF＋3MFをまとめて出力</button>');
 $('drawing-pdf').insertAdjacentHTML('beforebegin','<label class="drawing-pdf-layout">印刷配色<select id="drawing-print-palette">'+drawingPrintPalettes.map(([id,label])=>'<option value="'+id+'">'+label+'</option>').join('')+'</select></label><label class="drawing-pdf-layout">PDFのページ構成<select id="drawing-pdf-layout"><option value="">1ページ</option><option value="multi">全体図と補助図を分ける</option><option value="manual">ページを指定</option></select></label>');
 $('drawing-pdf').insertAdjacentHTML('beforebegin','<label id="drawing-pdf-placement-label" hidden>PDFの配置<select id="drawing-pdf-placement"><option value="keep">編集した配置と縮尺を保持</option><option value="auto">ページごとに自動配置</option></select></label>');
 $('drawing-view-priority').closest('.drawing-controls').insertAdjacentHTML('afterend',
  '<div class="drawing-controls"><label>長さの省略表示<select id="drawing-break-axis" title="正投影図の中央を省略します。俯瞰図は全体を表示します。">'+
  '<option value="">なし</option><option value="longest">自動（最長軸）</option><option value="x">X方向</option><option value="y">Y方向</option><option value="z">Z方向</option>'+
  '</select></label><label id="drawing-break-percent-label" hidden>中央の省略割合 (%)<input type="number" id="drawing-break-percent" min="20" max="90" step="1" value="70"></label>'+
  '<button id="drawing-break-center" hidden>中央に戻す</button><small id="drawing-break-help" hidden>図の省略線をドラッグして範囲を調整</small></div>');
 $('drawing-font-label').insertAdjacentHTML('afterend',
  '<label id="drawing-comment-width-label" hidden>折り返し幅 (mm)<input id="drawing-comment-width" type="number" min="'+minCommentWidth+'" max="'+maxCommentWidth+'" step="0.1" placeholder="自動" title="図上のコメント右端をドラッグしても変更できます"></label>'+
  '<button id="drawing-comment-width-auto" type="button" hidden>自動幅に戻す</button>'+
  '<label id="drawing-dimension-tolerance-label" hidden>± 公差<input id="drawing-dimension-tolerance" type="number" min="0" max="1000000" step="any" placeholder="例 0.1"></label>'+
  '<label id="drawing-dimension-note-label" hidden>加工指示<input id="drawing-dimension-note" maxlength="60" placeholder="例 貫通、深さ 5 mm"></label>'+
  '<label id="drawing-leader-edit-label" hidden>注記本文<textarea id="drawing-leader-edit" rows="2" maxlength="'+maxDrawingLeaderText+'"></textarea></label>'+
  '<label id="drawing-dimension-pin-label" hidden><input id="drawing-dimension-pin" type="checkbox">寸法の位置を固定</label>'+
  '<div id="drawing-item-colors" class="drawing-color-controls" hidden role="group" aria-label="選択した寸法の色">'+
   colorInputs('item')+'<button id="drawing-item-colors-reset" type="button">図面の色に戻す</button></div>'+
  '<button id="drawing-dimension-relink" hidden>参照点を選び直す</button>'+
  '<button id="drawing-annotation-relink" type="button" hidden>位置を選び直す</button>'+
  '<button id="drawing-dimension-replace-a" type="button" hidden>１点目を付け替え</button>'+
  '<button id="drawing-dimension-replace-b" type="button" hidden>２点目を付け替え</button>');
 $('drawing-precision-label').insertAdjacentHTML('afterend',
  '<label id="drawing-dimension-value-label" hidden>表示寸法値 (mm)<input id="drawing-dimension-value" type="number" min="0" step="any" inputmode="decimal" title="図面に記載する数値を変更します"></label>'+
  '<small id="drawing-dimension-measured-value" hidden></small>'+
  '<button id="drawing-dimension-value-reset" type="button" hidden>実測値に戻す</button>');
 const dimensionValueInput=$('drawing-dimension-value');
 $('drawing-extra-delete').insertAdjacentHTML('beforebegin','<button id="drawing-extra-relink" type="button" hidden>位置を選び直す</button>');
 $('drawing-generate').insertAdjacentHTML('afterend','<button id="drawing-front-face" title="CADで平面を1つ選択して三面図を開くと、その面が正面になります">選択した面を正面に</button><button id="drawing-front-reset" hidden>標準の向きに戻す</button><small id="drawing-front-status"></small>');
 const viewportBar=document.createElement('div');viewportBar.className='drawing-controls drawing-viewport-controls';viewportBar.innerHTML='<span>画面表示</span><button id="drawing-zoom-out" aria-label="図面を縮小">−</button><output id="drawing-zoom-percent" aria-live="polite">100%</output><button id="drawing-zoom-in" aria-label="図面を拡大">＋</button><button id="drawing-zoom-fit">用紙全体</button><button id="drawing-expand" aria-pressed="false">作業領域を最大化</button><small>ホイール：拡大・縮小 ／ ホイール押し込み・Space＋ドラッグ：移動</small>';viewportHost.before(viewportBar);
 const scaleRows=document.createElement('details');scaleRows.id='drawing-view-scales';
 scaleRows.innerHTML='<summary>ビュー別の縮尺</summary><div class="drawing-controls"></div><small>縮尺は 1:2.5 や 0.4 のように入力できます。</small>';
 $('drawing-view-priority').closest('.drawing-controls').after(scaleRows);
 $('drawing-comment').closest('label').insertAdjacentHTML('beforebegin','<div class="drawing-controls"><label>編集するコメント<select id="drawing-comment-target"><option value="comment">共通コメント</option></select></label><button id="drawing-comment-add" type="button">コメントを追加</button><button id="drawing-comment-remove" type="button" hidden>このコメントを削除</button></div>');
 const alignmentPanel=document.createElement('details');alignmentPanel.id='drawing-alignment';
 alignmentPanel.innerHTML='<summary>図・コメントの整列</summary><div id="drawing-alignment-items" class="drawing-controls"></div><div class="drawing-controls">'+
  drawingAlignmentActions.map(([id,label])=>'<button type="button" data-align-action="'+id+'">'+label+'</button>').join('')+
  '<button type="button" id="drawing-alignment-clear">選択を解除</button></div><small>図やコメントをCtrl＋クリックして複数選択できます。</small>';
 scaleRows.after(alignmentPanel);
 const pagePanel=document.createElement('details');pagePanel.id='drawing-page-assignments';
 pagePanel.innerHTML='<summary>PDFのページ割り当て</summary><label>ページ数<input id="drawing-page-count" type="number" min="1" max="'+maxDrawingPDFPages+'" step="1" value="2"></label><div id="drawing-page-items" class="drawing-controls"></div><small>各項目の掲載ページを指定します。画面上部の「編集するページ」で配置を調整できます。</small>';
 $('drawing-pdf-layout').closest('label').after(pagePanel);
 const pageScalePanel=document.createElement('details');
 pageScalePanel.id='drawing-page-scales';pageScalePanel.hidden=true;
 pageScalePanel.innerHTML='<summary>PDFのページごとの縮尺</summary><div class="drawing-controls"></div><small>1:2.5 や 0.4 のように入力します。空欄のページは共通の設定に従います。</small>';
 pagePanel.after(pageScalePanel);
 const scaleLabel=document.createElement('label'),scaleText=scaleInput(changeCommonScale,{optional:false});
 scaleText.id='drawing-scale-manual';scaleLabel.append('縮尺を手入力',scaleText);
 $('drawing-scale').closest('label').after(scaleLabel);
 const pdfPagesNote=document.createElement('p');
 pdfPagesNote.id='drawing-pdf-pages-note';pdfPagesNote.hidden=true;
 pdfPagesNote.setAttribute('role','status');viewportBar.append(pdfPagesNote);
 viewportBar.insertAdjacentHTML('beforeend','<label id="drawing-page-edit-label" hidden>編集するページ<select id="drawing-page-edit"></select></label><button type="button" id="drawing-page-reset" hidden>このページの配置をリセット</button>');
 const overflowList=document.createElement('div');overflowList.id='drawing-overflow-list';
 viewportBar.querySelector('small').insertAdjacentHTML('beforebegin',
  '<label>用紙内の背景色<input id="drawing-preview-background" type="color" title="用紙内の部品まわりを着色します。SVG・PDFにも反映します"></label>'+
  '<button id="drawing-preview-background-reset" type="button" aria-label="用紙内の背景色を白に戻す">標準色</button>'+
  '<label>各図の背景色<input id="drawing-view-background" type="color" title="見出し・寸法を含む各図の周辺だけを着色。用紙の残りは白で、SVG・PDFにも反映します"></label>'+
  '<button id="drawing-view-background-reset" type="button" aria-label="各図の背景色を解除">解除</button>');
 overflowList.className='drawing-controls';overflowList.hidden=true;
 overflowList.setAttribute('role','group');overflowList.setAttribute('aria-label','用紙からはみ出した項目');
 viewportBar.append(overflowList);
 const reviewList=document.createElement('div');reviewList.id='drawing-review-list';
 reviewList.className='drawing-controls';reviewList.hidden=true;
 reviewList.setAttribute('role','group');reviewList.setAttribute('aria-label','参照先を確認する項目');
 viewportBar.append(reviewList);
 const conflictList=document.createElement('details');
 conflictList.id='drawing-conflicts';conflictList.hidden=true;
 conflictList.innerHTML='<summary></summary><div id="drawing-conflict-rows"></div>';
 viewportBar.append(conflictList);
 $('drawing-undo').closest('.drawing-controls').classList.add('drawing-history-controls');
 $('drawing-dimension-add').closest('.drawing-controls').classList.add('drawing-dimension-controls');$('drawing-dimension-overall').insertAdjacentHTML('afterend','<button id="drawing-dimension-auto" class="accent" type="button" title="図の配置と縮尺を保ったまま、外形・円形部・俯瞰図の寸法を追加します">寸法を自動入力</button>');
 $('drawing-dimension-auto').insertAdjacentHTML('afterend','<button id="drawing-dimension-arrange" title="既存の寸法を重なりにくい位置へ移動します">寸法を自動配置</button>');
 $('drawing-dimension-arrange').insertAdjacentHTML('afterend','<button type="button" id="drawing-dimension-group" title="同じ図・実寸法・書式のRや穴径を数量付きの表記にまとめます">同じR・穴径をまとめる</button>');
 $('drawing-dimension-arrange').insertAdjacentHTML('afterend',
  '<button id="drawing-hole-start" title="図で基準点をクリックし、表に載せる円を選びます">穴位置表を作成</button>'+
  '<button id="drawing-hole-all" hidden>候補をすべて選択</button><button id="drawing-hole-add" hidden>穴位置表を確定</button>'+
  '<button id="drawing-hole-delete" hidden>穴位置表を削除</button><span id="drawing-hole-review" hidden>'+
  '<label>要確認の穴<select id="drawing-hole-row"></select></label> <button type="button" id="drawing-hole-relink">図上で穴を再指定</button> '+
  '<button type="button" id="drawing-hole-remove-row">この行を削除</button></span>');
 $('drawing-hole-review').insertAdjacentHTML('afterend','<button id="drawing-leader-start">矢印付き注記を追加</button>'+
  '<button id="drawing-thread-leader-start" title="ねじ穴の入口が見える図で、ねじ設定を引用します">ねじ注記を追加</button>'+
  '<label id="drawing-leader-input-label" hidden>注記本文<textarea id="drawing-leader-input" rows="2" maxlength="'+maxDrawingLeaderText+'" placeholder="例 この面を下にして印刷"></textarea></label>');
 $('drawing-dimension-add').closest('.drawing-controls').insertAdjacentHTML('afterend',
  '<div class="drawing-controls drawing-dimension-controls"><label>寸法の文字サイズ (mm)<input id="drawing-dimension-font" type="number" min="1.5" max="10" step="0.1" title="図面上の現在の寸法と、これから追加する寸法に適用します"></label>'+
  '<div class="drawing-color-controls" role="group" aria-label="図面全体の寸法色"><span>図面の標準色</span>'+colorInputs('default')+
   '<button id="drawing-default-colors-reset" type="button">既定色に戻す</button></div>'+
  '<details id="drawing-auto-dimension-views"><summary>ビュー別の自動寸法</summary>'+
  [...drawingProjectionNames,'iso'].map(view=>'<fieldset data-auto-dimension-view="'+view+'"><legend>'+(drawingProjections[view]?.label??'俯瞰図 (ISO)')+'</legend>'+
   Object.entries(autoDimensionViewTypes(view)).map(([key,label])=>'<label><input type="checkbox" value="'+key+'">'+label+'</label>').join('')+
  '</fieldset>').join('')+'</details></div>');
 $('drawing-auto-dimension-views').before(Object.assign(document.createElement('div'),{id:'drawing-auto-dimension-types',className:'drawing-controls',innerHTML:'<strong>自動入力する種類</strong>'+[['outline','外形寸法'],['diameter','円・穴径'],['radius','R寸法'],['spacing','中心位置・間隔']].map(([key,label])=>'<label><input type="checkbox" data-auto-type="'+key+'" checked>'+label+'</label>').join('')+'<label><input type="checkbox" id="drawing-auto-group" checked>同じR・穴径をまとめる</label><small>これから自動追加する寸法に適用します。図ごとの設定は「ビュー別の自動寸法」から変更できます。</small>'}));
 $('drawing-auto-group').closest('label').insertAdjacentHTML('afterend','<label><input type="checkbox" id="drawing-auto-unique-overall">外形寸法を幅・奥行き・高さに各1つ</label>');
 const omittedHolePanel=document.createElement('details');
 omittedHolePanel.id='drawing-omitted-holes';omittedHolePanel.hidden=true;
 omittedHolePanel.innerHTML='<summary>省略した穴径・円</summary><div class="drawing-controls">'+
  '<label>穴を選択<select id="drawing-omitted-hole"></select></label>'+
  '<button type="button" id="drawing-omitted-hole-add">選んだ穴の寸法を追加</button></div>';
 $('drawing-dimension-auto').closest('.drawing-dimension-controls').after(omittedHolePanel);
 const omittedHoleInput=$('drawing-omitted-hole'),omittedHoleAdd=$('drawing-omitted-hole-add');
 let omittedHoleReport=null,visibleOmittedHoles=[],selectedOmittedHole=null;
 const inlineScales=installDrawingInlineScales({makeInput:scaleInput,syncInput:syncScaleInput,changeScale:changeInlineViewScale,viewLabel:pdfViewLabel});
 const viewport=drawingViewport({dialog,host:viewportHost,minus:$('drawing-zoom-out'),plus:$('drawing-zoom-in'),fit:$('drawing-zoom-fit'),percent:$('drawing-zoom-percent'),expand:$('drawing-expand'),canNavigate:()=>!drag&&!busy,onViewChange:()=>{
  clearDimensionHover();inlineScales.position();
 }});
 const isoCheck=$('drawing-view-iso'),isoModeInput=$('drawing-iso-mode');
 const viewChecks=[...dialog.querySelectorAll('.drawing-view-options input:not(#drawing-view-iso)')];
 let viewSelection=[...defaultDrawingViews],lastVisibleIsoMode='full';
 let frontFace=null,frontFrame,autoDimensionViews={},autoDimensionTypesEnabled=[...autoDimensionKeys],groupRepeatedDimensions=true,dimensionList,dimensionFontSize=standardDimensionFont;
 let uniqueOverallDimensions=false;
 let hiddenViews={},dimensionReferences={},dimensionColors={};
 let commentColor=defaultDrawingCommentColor,commentFont='',requestedCommentFonts='';
 const defaultBreakPercent=70;
 let breakAxis='',breakPercent=defaultBreakPercent,breakRange,holeTable;
 let projectionLocked=true,linkedProjections=false,linkedProjectionScales=false;
 const projectionLockActive=()=>layoutKind==='projection'&&projectionLocked&&!linkedProjections;
 let leaders=[],pdfLayout='',pdfPlacement='keep',pdfExporting=false,printPalette='screen';
 let mainComment='',comments=[],commentWidths={},activeComment='comment',viewScales={},autoIsoScale;
 let inspectedHole=null;
 let pageAssignments={pageCount:2,views:{},comments:{}},selectedPlacements=new Set();
 let overviewSheet=null,editingPage=-1,editPageCount=0,pdfPositions={},pdfPageScales={},pdfViewScales={};
 const pagePositionMap=()=>editingPage>=0?pdfPositions:positions;
 function setPagePositionMap(value){if(editingPage>=0)pdfPositions=value;else positions=value;}
 function displayedPositions(page){
  return Object.fromEntries([
   ...Object.entries(page.layout).map(([id,view])=>[id,[view.x,view.y]]),
   ...page.notes.map(note=>[note.id,[note.x,note.y]]),
   ...(page.holeBox?[['holeTable',[page.holeBox.x,page.holeBox.y]]]:[]),
  ]);
 }
 function onSheetDimensions(){
  if(!sheet?.dimensionIndices)return dimensions;
  const placed=dimensions.map(d=>({...d,hidden:true}));
  sheet.dimensionIndices.forEach((index,i)=>{placed[index]=sheet.dimensions[i];});
  return placed;
 }
 const dimensionPosition=({at,alongOffset})=>({at,...(alongOffset===undefined?{}:{alongOffset})});
 function storeDimensionPlacement(index,placed){
  if(editingPage<0){dimensions[index]=placed;return;}
  dimensions[index]={...dimensions[index],pdfPlacement:dimensionPosition(placed)};
 }
 const backgroundControls={paperBackground:'drawing-preview-background',viewBackground:'drawing-view-background'};
 let backgrounds={paperBackground:'#ffffff',viewBackground:'#ffffff'};
 const materialStore=createDrawingMaterialsStore();
 let materialRows=[],materialLoadError=false;
 const hiddenRows=$('drawing-hidden-views').querySelector('.drawing-controls');
 const dimensionViewRows=[...$('drawing-auto-dimension-views').querySelectorAll('fieldset')];
 for(const row of dimensionViewRows)row.onchange=()=>{
  const view=row.dataset.autoDimensionView;
  const enabled=[...row.querySelectorAll('input:checked')].map(input=>input.value);
  if(enabled.length===row.querySelectorAll('input').length)delete autoDimensionViews[view];
  else autoDimensionViews[view]=enabled;
  persist();
 };
 const applyDimensionFont=d=>dimensionFontSize===standardDimensionFont?d:{...d,fontSize:dimensionFontSize};
 const typeInputs=[...$('drawing-auto-dimension-types').querySelectorAll('[data-auto-type]')],typeKeys=key=>key==='outline'?['horizontal','vertical']:[key];
 for(const input of typeInputs)input.onchange=()=>{const keys=typeKeys(input.dataset.autoType);autoDimensionTypesEnabled=autoDimensionKeys.filter(key=>keys.includes(key)?input.checked:autoDimensionTypesEnabled.includes(key));persist();};
 $('drawing-auto-group').onchange=()=>{groupRepeatedDimensions=$('drawing-auto-group').checked;persist();};
 $('drawing-auto-unique-overall').onchange=()=>{uniqueOverallDimensions=$('drawing-auto-unique-overall').checked;persist();};
 function setViewSelection(views){viewSelection=[...views];for(const input of viewChecks)input.checked=views.includes(input.value);}
 function setIsoMode(mode){
  isoModeInput.value=mode;
  isoCheck.checked=mode!=='hidden';
  if(isoCheck.checked)lastVisibleIsoMode=mode;
 }
 const viewData=name=>withDetails(data,details).views[name],names=()=>Object.keys(sheet?.layout||{}).filter(k=>k!=='iso');
 function dimensionViews(kind){
  const views=names();
  if(kind==='aligned'&&sheet?.layout.iso&&data?.views.iso?.dimensionVertices?.length>1)views.push('iso');
  return views;
 }
 const status=t=>{if(!drag?.moved)$('drawing-status').textContent=t;},options=()=>({viewSelection,viewPriority:$('drawing-view-priority').value,isoMode:$('drawing-iso-mode').value,layout:layoutKind,paper:$('drawing-paper-size').value,orientation:$('drawing-orientation').value,frame:$('drawing-frame').checked,name:$('drawing-name').value,...($('drawing-revision').value?{revision:$('drawing-revision').value}:{}),material:$('drawing-material').value,date:$('drawing-date').value,commentSize,positions,sections,details,markers,
  ...($('drawing-layout-label').checked?{}:{showLayoutLabel:false}),
  ...(layoutKind==='projection'?{projectionLocked}:{}),
  ...(linkedProjections?{linkedProjections}:{}),
  ...(linkedProjectionScales?{linkedProjectionScales}:{}),
  ...(autoIsoScale===undefined?{}:{autoIsoScale}),
  ...(frontFrame?{frontFrame}:{}),
  ...(Object.keys(autoDimensionViews).length?{autoDimensionViews}:{}),
  ...(autoDimensionTypesEnabled.length===autoDimensionKeys.length?{}:{autoDimensionTypes:autoDimensionTypesEnabled}),
  ...(groupRepeatedDimensions?{}:{groupRepeatedDimensions:false}),
  ...(uniqueOverallDimensions?{uniqueOverallDimensions:true}:{}),
  ...(dimensionFontSize===standardDimensionFont?{}:{dimensionFontSize}),
  ...(Object.keys(hiddenViews).length?{hiddenViews}:{}),
  ...(Object.keys(dimensionReferences).length?{dimensionReferences}:{}),
  ...(Object.keys(dimensionColors).length?{dimensionColors}:{}),
  ...(commentColor===defaultDrawingCommentColor?{}:{commentColor}),
  ...(commentFont?{commentFont}:{}),
  ...(Object.keys(commentWidths).length?{commentWidths}:{}),
  ...(breakAxis?{breakAxis}:{}),
  ...(breakPercent===defaultBreakPercent?{}:{breakPercent}),
  ...(breakAxis&&breakRange?{breakRange}:{}),
  ...(holeTable?{holeTable}:{}),
  ...(leaders.length?{leaders}:{}),
  ...(pdfLayout?{pdfLayout}:{}),
  ...(pdfPlacement==='auto'?{pdfPlacement}:{}),
  ...(Object.keys(pdfPositions).length?{pdfPositions:currentPDFPositions()}:{}),
  ...(Object.keys(pdfPageScales).length?{pdfPageScales}:{}),
  ...(Object.keys(pdfViewScales).length?{pdfViewScales:currentPDFViewScales()}:{}),
  ...(printPalette==='screen'?{}:{printPalette}),
  ...(comments.length?{comments}:{}),
  ...(Object.keys(viewScales).length?{viewScales}:{}),
  ...(pdfLayout==='manual'||Object.keys(pageAssignments.views).length||Object.keys(pageAssignments.comments).length||pageAssignments.holeTable!==undefined||pageAssignments.pageCount!==2?{pageAssignments:currentPageAssignments()}:{}),
  ...Object.fromEntries(Object.entries(backgrounds).filter(([,color])=>color!=='#ffffff')),
 });
 function requestedViews(o){
  const sources=o.details.filter(detail=>!detail.review).map(detail=>detail.view).filter(view=>drawingProjectionNames.includes(view));
  if(o.holeTable)sources.push(o.holeTable.view);
  for(const note of o.leaders??[])if(note.threadRef&&drawingProjectionNames.includes(note.view))sources.push(note.view);
  return [...new Set([...o.viewSelection,...sources,...(drawingViewVisible('iso',o)?['iso']:[])])];
 }
 function requireVisibleView(o){
  if(!o.viewSelection.length&&!drawingViewVisible('iso',o))throw Error('図面に載せるビューを1つ以上選んでください');
 }
 async function loadMissingViews(next){
  const silhouettes=!!drawingBackgroundColor(next);
  const missing=requestedViews(next).filter(view=>!data.views[view]||(silhouettes&&data.views[view].silhouette===undefined));
  const missingSections=silhouettes?sections.filter(({id})=>data.views[id]&&data.views[id].silhouette===undefined):[];
  if(!missing.length&&!missingSections.length)return true;
  const token=++revision,previous=data;
  busy=true;controls();$('drawing-generate').disabled=$('drawing-svg').disabled=$('drawing-pdf').disabled=true;
  status(silhouettes?'図面の輪郭と背景を計算しています…':'追加するビューを計算しています…');
  try{
   const result=await worker.request({features,spec:{type:'orthographic',targets,views:missing,sections:missingSections,frontFrame:next.frontFrame,silhouettes}},300000);
   if(token!==revision||!dialog.open||data!==previous)return false;
   if(missingSections.some(({id})=>!result.views[id]))throw Error('断面図の背景を計算できませんでした');
   data={...previous,views:{...previous.views,...result.views}};
   return true;
  }finally{
   if(token===revision){worker.reset();busy=false;$('drawing-generate').disabled=false;controls();}
  }
 }
 const presets=installDrawingPresets($('drawing-layout-help'),{read:()=>({...options(),...backgrounds,dimensionFontSize,commentSize,commentFont,commentColor,dimensionColors,printPalette,uniqueOverallDimensions,showLayoutLabel:$('drawing-layout-label').checked,hidden:$('drawing-hidden').checked}),apply:applyPreset,canUse:()=>!!data&&!busy});
 async function applyPreset(values){
  if(!data||busy)throw Error('図面の計算が終わってから呼び出してください');
  const old=options(),scale=Number($('drawing-scale').value),next={...old,...values,autoIsoScale:undefined};
  try{
   requireVisibleView(next);
   if(!await loadMissingViews(next))return;
   const formatted=values.dimensionFontSize===undefined?dimensions:dimensionsWithFont(values.dimensionFontSize);
   const resized=rescaleDrawingAnnotations(formatted,drawingViewFrames(data,next,scale),scale,scale,drawingViewFrames(data,old,scale));
   const result=optimizeDrawingLayout(data,{scale,dimensions:resized,comment:mainComment,options:next});
   for(const [id,key]of [['paper-size','paper'],['orientation','orientation'],['view-priority','viewPriority']])$('drawing-'+id).value=key==='paper'?result.paper:values[key];
   setIsoMode(values.isoMode);
   dimensionFontSize=values.dimensionFontSize??dimensionFontSize;
   uniqueOverallDimensions=values.uniqueOverallDimensions??uniqueOverallDimensions;
   commentSize=values.commentSize??commentSize;commentFont=values.commentFont??commentFont;
   commentColor=values.commentColor??commentColor;dimensionColors=values.dimensionColors??dimensionColors;
   for(const key of Object.keys(backgroundControls))if(values[key]!==undefined)backgrounds[key]=values[key].toLowerCase();
   printPalette=values.printPalette??printPalette;
   $('drawing-frame').checked=values.frame;$('drawing-hidden').checked=values.hidden;
   if(values.showLayoutLabel!==undefined)$('drawing-layout-label').checked=values.showLayoutLabel;
   positions=result.positions;dimensions=result.dimensions;autoIsoScale=result.autoIsoScale;layoutKind='compact';setScale(result.scale);picking=null;action=null;selection=null;render();
   const colors=Object.fromEntries(['commentColor','paperBackground','viewBackground','printPalette']
    .filter(key=>values[key]!==undefined).map(key=>[key,values[key]]));
   if(values.dimensionColors!==undefined)for(const [key] of colorFields)colors[key]=drawingDimensionColor(key,null,dimensionColors);
   if(Object.keys(colors).length)rememberDrawingColors(colors);
  }catch(error){if(dialog.open)render(false);throw error;}
 }
 function setScale(value){
  const select=$('drawing-scale'),text=String(value);
  if(![...select.options].some(option=>option.value===text)){
   select.querySelector('[data-custom-scale]')?.remove();
   const option=new Option(drawingScaleLabel(value),text);option.dataset.customScale='true';select.add(option);
  }
  select.value=text;
 }
 function scaleInput(onChange,{optional=true,effectiveScale=()=>Number($('drawing-scale').value)}={}){
  const input=document.createElement('input');input.type='text';input.inputMode='decimal';input.maxLength=32;
  input.spellcheck=false;input.placeholder='例 1:2.5';
  input.title='↑・↓キーで縮尺を'+drawingScaleStep+'刻みで変更できます。1:2.5 のような比率も入力できます。';
  input.oninput=()=>input.setCustomValidity('');
  input.onkeydown=event=>{
   if(event.isComposing)return;
   if(event.key==='Enter'){event.preventDefault();input.blur();return;}
   if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;
   event.preventDefault();
   const text=input.value.trim(),scale=text?parseDrawingScale(text):effectiveScale();
   if(!scale)return;
   const next=stepDrawingScale(scale,event.key==='ArrowUp'?1:-1);
   if(next===scale)return;
   input.value=String(next);input.setCustomValidity('');
   onChange(next);
  };
  input.onchange=()=>{
   input.setCustomValidity('');
   const text=input.value.trim(),value=optional&&!text?undefined:parseDrawingScale(text);
   if(value===null){input.setCustomValidity('1:2.5 や 0.4 のように、1:10000～1000:1 の縮尺を入力してください');input.reportValidity();return;}
   onChange(value);
  };
  return input;
 }
 function syncScaleInput(input,value,force=false){
  const label=value===undefined?'':drawingScaleLabel(value);
  const text=value===undefined||parseDrawingScale(label)===value?label:String(value);
  if((force||document.activeElement!==input)&&input.value!==text){input.value=text;input.setCustomValidity('');}
  input.disabled=!sheet||busy||!!drag;
 }
 function changeCommonScale(value){
  if(!data||busy||drag)return;
  const previous=saved?.scale??1,o=options(),previousDimensions=dimensions;
  if(value!==previous)dimensions=rescaleDrawingAnnotations(dimensions,drawingViewFrames(data,o,value),previous,value,drawingViewFrames(data,o,previous));
  setScale(value);picking=null;action=null;
  render(true,{reflowDimensions:true});
  if(!sheet){
   const problem=$('drawing-status').textContent;
   dimensions=previousDimensions;setScale(previous);render(false);status(problem);
  }
 }
 function currentPageAssignments(){
  const count=pageAssignments.pageCount,clamp=value=>Math.min(count,value);
  const viewIds=new Set([...drawingProjectionNames,'iso',...sections.map(item=>item.id),...details.map(item=>item.id)]);
  const noteIds=new Set(['comment',...comments.map(note=>note.id)]);
  return {pageCount:count,
   views:Object.fromEntries(Object.entries(pageAssignments.views).filter(([id])=>viewIds.has(id)).map(([id,value])=>[id,clamp(value)])),
   comments:Object.fromEntries(Object.entries(pageAssignments.comments).filter(([id])=>noteIds.has(id)).map(([id,value])=>[id,clamp(value)])),
   ...(pageAssignments.holeTable===undefined?{}:{holeTable:clamp(pageAssignments.holeTable)})};
 }
 function currentPDFPositions(){
  const ids=new Set([...drawingProjectionNames,'iso','comment','holeTable',...[...sections,...details,...comments].map(item=>item.id)]);
  return Object.fromEntries(Object.entries(pdfPositions).filter(([id])=>ids.has(id)));
 }
 function currentPDFViewScales(){
  const ids=new Set([...drawingProjectionNames,'iso',...sections.map(item=>item.id),...details.map(item=>item.id)]);
  return Object.fromEntries(Object.entries(pdfViewScales).filter(([id])=>ids.has(id)));
 }
 function makePDFPages(settings=options(),sourceSheet=overviewSheet,sourceDimensions=dimensions){
  return settings.pdfLayout?drawingPDFPages(data,Number($('drawing-scale').value),$('drawing-hidden').checked,sourceDimensions,mainComment,settings,sourceSheet,drag?.pdfLayouts):[sourceSheet];
 }
 function syncPageEditor(){
  const select=$('drawing-page-edit'),count=sheet?editPageCount:0;
  $('drawing-page-edit-label').hidden=count<2;
  if(Number(select.dataset.count)!==count){
   select.replaceChildren(new Option('図面全体','-1'),...Array.from({length:count},(_,i)=>new Option((i+1)+' ページ',String(i))));
   select.dataset.count=String(count);
  }
  select.value=String(editingPage);select.disabled=busy||!!drag;
  $('drawing-page-reset').hidden=editingPage<0||!sheet;
  $('drawing-page-reset').disabled=busy||!!drag;
 }
 function editPDFPage(index){
  if(!sheet||busy||drag)return;
  inlineScales.close();
  editingPage=index;picking=null;action=null;selection=null;inspectedHole=null;selectedPlacements.clear();
  render(false);viewport.reset();
 }
 $('drawing-page-edit').onchange=()=>editPDFPage(Number($('drawing-page-edit').value));
 $('drawing-page-reset').onclick=()=>{
  if(!sheet||busy||drag||editingPage<0)return;
  for(const id of Object.keys(sheet.layout))delete pdfViewScales[id];
  for(const id of [...Object.keys(sheet.layout),...sheet.notes.map(note=>note.id),...(sheet.holeBox?['holeTable']:[])])delete pdfPositions[id];
  for(const index of sheet.dimensionIndices)delete dimensions[index].pdfPlacement;
  details=details.map(detail=>sheet.layout[detail.id]?withoutDetailPDFPlacements(detail):detail);
  render();
 };
 function withoutDetailPDFPlacements(detail){
  if(!detail.dimensionPlacements)return detail;
  const retained=Object.entries(detail.dimensionPlacements)
   .flatMap(([key,{overview}])=>overview?[[key,{overview}]]:[]);
  return {...detail,dimensionPlacements:Object.fromEntries(retained)};
 }
 $('drawing-page-reset').title='このページで変更した図・寸法線・コメントの位置と、ビュー別の縮尺を戻します';
 function syncPageScales(){
  const count=sheet&&editPageCount>1?editPageCount:0,host=pageScalePanel.querySelector('div');
  pageScalePanel.hidden=!count;
  if(Number(host.dataset.count)!==count){
   host.dataset.count=String(count);host.replaceChildren();
   for(let page=1;page<=count;page++){
    const label=document.createElement('label'),input=scaleInput(value=>{
     if(!sheet||busy||drag)return;
     if(value===undefined)delete pdfPageScales[page];else pdfPageScales[page]=value;
     editPDFPage(page-1);persist();
    },{effectiveScale:()=>{
     const common=Number($('drawing-scale').value);
     if(editingPage===page-1&&sheet?.pageScale)return sheet.pageScale;
     if(pdfPlacement!=='auto')return common;
     try{return makePDFPages()[page-1]?.pageScale??common;}catch{return common;}
    }});
    input.dataset.pdfPageScale=String(page);input.setAttribute('aria-label',page+' ページの縮尺');
    label.append(page+' ページ',input);host.append(label);
   }
  }
  for(const input of host.querySelectorAll('input')){
   input.placeholder=pdfPlacement==='auto'?'自動':'共通 '+drawingScaleLabel(Number($('drawing-scale').value));
   syncScaleInput(input,pdfPageScales[input.dataset.pdfPageScale]);
  }
 }
 function syncPageAssignments(){
  pagePanel.hidden=pdfLayout!=='manual';
  const count=$('drawing-page-count');
  if(document.activeElement!==count)count.value=pageAssignments.pageCount;
  count.disabled=!sheet||busy;
  if(pagePanel.hidden)return;
  const rows=[
   ...Object.keys((overviewSheet??sheet)?.layout||{}).map(id=>({id,kind:'views',label:viewLabel(id)})),
   ...(mainComment.trim()?[{id:'comment',kind:'comments',label:'共通コメント'}]:[]),
   ...comments.filter(note=>note.text.trim()).map(note=>({id:note.id,kind:'comments',label:'コメント '+(comments.indexOf(note)+2)})),
   ...(holeTable?[{id:'holeTable',kind:'table',label:'穴位置表'}]:[]),
  ];
  const host=$('drawing-page-items'),signature=JSON.stringify([pageAssignments.pageCount,rows]);
  if(host.dataset.signature!==signature){
   host.replaceChildren();host.dataset.signature=signature;
   for(const row of rows){
    const label=document.createElement('label'),select=document.createElement('select');
    label.append(row.label,select);select.dataset.pageItem=row.id;select.dataset.pageKind=row.kind;
    for(let number=1;number<=pageAssignments.pageCount;number++)select.add(new Option(number+' ページ',String(number)));
    select.onchange=()=>{
     if(busy)return;
     assignDrawingPDFPageItem(pageAssignments,row,Number(select.value));
     render();
    };
    host.append(label);
   }
  }
  const assignment=currentPageAssignments();
  for(const select of host.querySelectorAll('select')){
   const {pageKind:kind,pageItem:id}=select.dataset;
   const page=kind==='table'?assignment.holeTable:assignment[kind][id];
   select.value=String(page??Math.min(assignment.pageCount,kind==='views'&&(id.startsWith('section-')||id.startsWith('detail-'))?2:1));
   select.disabled=!sheet||busy;
  }
 }
 $('drawing-page-count').onchange=()=>{
  const count=$('drawing-page-count').valueAsNumber;
  if(busy||!Number.isInteger(count)||count<1||count>maxDrawingPDFPages){$('drawing-page-count').value=pageAssignments.pageCount;return;}
  pageAssignments={...pageAssignments,pageCount:count};
  pageAssignments=currentPageAssignments();render();
 };
 function placementItems(){
  if(!sheet)return [];
  const items=Object.entries(sheet.layout).map(([id,view])=>{
   const boxes=[view];
   for(const d of dimensions)if(d.view===id){
    const p=dimensionPlacement(d,sheet);
    if(p)boxes.push(p.box,...p.main,...p.extensions,...p.arrowBoxes);
   }
   const x=Math.min(...boxes.map(box=>box.x)),y=Math.min(...boxes.map(box=>box.y));
   return {id,label:viewLabel(id),origin:[view.x,view.y],box:{x,y,width:Math.max(...boxes.map(box=>box.x+box.width))-x,height:Math.max(...boxes.map(box=>box.y+box.height))-y}};
  });
  for(const note of sheet.notes){
   const element=viewportHost.querySelector('[data-comment="'+(note.id==='comment'?'true':note.id)+'"]');
   const box=element?.getBBox();
   if(box)items.push({id:note.id,label:note.id==='comment'?'共通コメント':'コメント '+(comments.findIndex(item=>item.id===note.id)+2),origin:[note.x,note.y],
    box:{x:box.x,y:box.y,width:box.width,height:box.height}});
  }
  return items;
 }
 function syncAlignment(){
  const items=placementItems(),ids=new Set(items.map(item=>item.id)),container=$('drawing-alignment-items');
  selectedPlacements=new Set([...selectedPlacements].filter(id=>ids.has(id)));
  const signature=items.map(item=>item.id).join(',');
  if(container.dataset.items!==signature){
   container.replaceChildren();container.dataset.items=signature;
   for(const item of items){
    const label=document.createElement('label'),checkbox=document.createElement('input');
    checkbox.type='checkbox';checkbox.dataset.placementId=item.id;
    checkbox.onchange=()=>{if(checkbox.checked)selectedPlacements.add(item.id);else selectedPlacements.delete(item.id);syncAlignment();};
    label.append(checkbox,item.label);container.append(label);
   }
  }
  for(const input of container.querySelectorAll('input')){
   input.checked=selectedPlacements.has(input.dataset.placementId);input.disabled=busy||!!picking||!!action;
  }
  for(const button of alignmentPanel.querySelectorAll('[data-align-action]')){
   button.disabled=busy||!!picking||!!action||selectedPlacements.size<(button.dataset.alignAction.startsWith('space-')?3:2);
  }
  $('drawing-alignment-clear').disabled=busy||!selectedPlacements.size;
  const svg=viewportHost.querySelector('svg');
  for(const rect of svg?.querySelectorAll('[data-alignment-selected]')||[])rect.remove();
  for(const item of items.filter(item=>selectedPlacements.has(item.id))){
   const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');
   for(const [key,value] of Object.entries({...item.box,'data-alignment-selected':item.id,fill:'none',stroke:'#0088a3','stroke-width':'.4',
    'stroke-dasharray':'2 1','pointer-events':'none'}))rect.setAttribute(key,value);
   svg.append(rect);
  }
 }
 for(const button of alignmentPanel.querySelectorAll('[data-align-action]'))button.onclick=()=>{
  if(button.disabled||!sheet)return;
  const items=placementItems().filter(item=>selectedPlacements.has(item.id));
  try{
   const moves=alignDrawingItems(items,button.dataset.alignAction),next={...pagePositionMap()};
   if(editingPage<0&&projectionLockActive()&&moves.some(m=>drawingProjectionNames.includes(m.id)&&(Math.abs(m.dx)>1e-6||Math.abs(m.dy)>1e-6)))throw Error('投影図を自由に整列するには「第三角法の配置をロック」を解除してください');
   for(const move of moves){
    const item=items.find(item=>item.id===move.id),box={...item.box,x:item.box.x+move.dx,y:item.box.y+move.dy};
    if(drawingBoxPlacementIssue(box,sheet))throw Error('図枠の内側で、表題欄を避けて整列してください');
    next[item.id]=[item.origin[0]+move.dx,item.origin[1]+move.dy];
   }
   setPagePositionMap(next);selection=null;render();status(items.length+' 項目を整列しました。元に戻すで取り消せます');
  }catch(error){status(error.message);}
 };
 $('drawing-alignment-clear').onclick=()=>{selectedPlacements.clear();syncAlignment();};
 function syncViewScales(){
  const container=scaleRows.querySelector('div'),names=Object.keys(sheet?.layout||{});
  if(names.join(',')!==container.dataset.names){
   container.replaceChildren();container.dataset.names=names.join(',');
   for(const name of names){
    const row=document.createElement('div'),label=document.createElement('label'),select=document.createElement('select');
    select.dataset.viewScale=name;label.append(viewLabel(name),select);
    for(const [value,text] of [['','共通縮尺'],['0.1','1:10'],['0.2','1:5'],['0.5','1:2'],['1','1:1'],['2','2:1'],['4','4:1']])select.add(new Option(text,value));
    select.onchange=()=>changeViewScale(name,select.value?Number(select.value):undefined);
    const input=scaleInput(value=>changeViewScale(name,value),{effectiveScale:()=>sheet?.layout[name]?.scale});
    input.dataset.viewScaleInput=name;input.setAttribute('aria-label',viewLabel(name)+' の縮尺を手入力');
    row.className='drawing-view-scale-row';row.append(label,input);container.append(row);
   }
  }
  const scaleOptions={linkedProjectionScales,viewScales:editingPage>=0?
   Object.fromEntries(names.map(name=>[name,pdfViewScales[name]])):viewScales};
  for(const select of container.querySelectorAll('select')){
   const name=select.dataset.viewScale,value=drawingViewScaleOverride(name,scaleOptions),text=value===undefined?'':String(value);
   select.querySelector('[data-custom-scale]')?.remove();
   if(text&&![...select.options].some(option=>option.value===text)){
    const option=new Option(drawingScaleLabel(value),text);option.dataset.customScale='';select.add(option);
   }
   const fitted=drawingViewScale(name,Number($('drawing-scale').value),{isoMode:isoModeInput.value,autoIsoScale});
   select.options[0].textContent=editingPage>=0?'図面の設定を使う':
    name==='iso'&&autoIsoScale!==undefined?'自動縮尺 '+drawingScaleLabel(fitted):'共通縮尺';
   select.value=text;select.disabled=busy;
   syncScaleInput(select.parentElement.nextElementSibling,value);
  }
 }
 function viewScaleTargets(name,page){
  if(!linkedProjectionScales||!linkedDrawingViews.includes(name))return [name];
  return page?linkedDrawingViews.filter(id=>sheet.layout[id]):linkedDrawingViews;
 }
 function withViewScale(scales,names,value){
  const next={...scales};
  for(const name of names){
   if(value===undefined)delete next[name];
   else next[name]=value;
  }
  return next;
 }
 function updateOverviewViewScales(next,linked=linkedProjectionScales){
  const scale=Number($('drawing-scale').value),previous=options(),previousDimensions=dimensions;
  const updated={...previous,viewScales:next,linkedProjectionScales:linked};
  dimensions=rescaleDrawingAnnotations(dimensions,drawingViewFrames(data,updated,scale),scale,scale,drawingViewFrames(data,previous,scale));
  viewScales=next;linkedProjectionScales=linked;
  render(true,{reflowDimensions:true});
  if(!sheet){
   const problem=$('drawing-status').textContent;
   viewScales=previous.viewScales??{};linkedProjectionScales=!!previous.linkedProjectionScales;dimensions=previousDimensions;
   render(false);status(problem);
  }
 }
 function changeViewScale(name,value){
  if(!sheet||busy||drag)return;
  const targets=viewScaleTargets(name,editingPage>=0);
  if(editingPage>=0){
   pdfViewScales=withViewScale(pdfViewScales,targets,value);
   if(value!==undefined&&pdfPlacement==='auto')pdfPageScales[editingPage+1]??=sheet.pageScale;
   render();return;
  }
  updateOverviewViewScales(withViewScale(viewScales,targets,value));
 }
 $('drawing-link-scales').onchange=()=>{
  if(!sheet||busy||drag)return;
  const enable=$('drawing-link-scales').checked;
  const reference=linkedDrawingViews.find(name=>overviewSheet.layout[name])??'front';
  const previous=options(),scale=Number($('drawing-scale').value);
  let shared=drawingViewScaleOverride(reference,previous);
  if(enable&&shared===undefined){
   const initial=overviewSheet.layout[reference]?.scale;
   const inherited=drawingViewScale(reference,scale,{...previous,viewScales:{},linkedProjectionScales:true});
   if(initial!==undefined&&initial<=maxDrawingScale&&initial!==inherited)shared=initial;
  }
  const next=withViewScale(viewScales,linkedDrawingViews,shared);
  if(!enable&&shared===undefined){
   const fitted=drawingViewScale(reference,scale,previous);
   const separate={...previous,viewScales:next,linkedProjectionScales:false};
   if(fitted<=maxDrawingScale)for(const name of linkedDrawingViews){
    if(drawingViewScale(name,scale,separate)!==fitted)next[name]=fitted;
   }
  }
  updateOverviewViewScales(next,enable);
 };
 function currentCommentStyle(){
  return comments.find(note=>note.id===activeComment)??{size:commentSize,font:commentFont,color:commentColor};
 }
 function setCurrentCommentStyle(key,value){
  const note=comments.find(note=>note.id===activeComment);
  if(note)note[key]=value;
  else if(key==='size')commentSize=value;
  else if(key==='font')commentFont=value;
  else if(key==='color')commentColor=value;
 }
 function syncCommentTargets(){
  const select=$('drawing-comment-target');
  const ids=['comment',...comments.map(note=>note.id)];
  if(!ids.includes(activeComment))activeComment='comment';
  if(ids.join(',')!==select.dataset.ids){
   select.replaceChildren(new Option('共通コメント','comment'),...comments.map((note,i)=>new Option('コメント '+(i+2),note.id)));
   select.dataset.ids=ids.join(',');
  }
  select.value=activeComment;select.disabled=busy;
  if(document.activeElement!==$('drawing-comment'))$('drawing-comment').value=comments.find(note=>note.id===activeComment)?.text??mainComment;
  const autoAuxiliary=editingPage>0&&pdfLayout==='multi';
  $('drawing-comment-add').disabled=busy||!sheet||comments.length>=16||autoAuxiliary;
  $('drawing-comment-add').title=autoAuxiliary?'このページにコメントを追加するには「PDFのページ構成」で手動割り当てを選んでください':'';
  $('drawing-comment-remove').hidden=activeComment==='comment';
  $('drawing-comment-remove').disabled=busy;
 }
 function selectDrawingComment(id){
  activeComment=id;
  syncCommentTargets();syncCommentStyle(!!sheet&&!busy);
 }
 function removeDrawingComment(id){
  delete commentWidths[id];
  if(id==='comment')mainComment='';
  else {comments=comments.filter(note=>note.id!==id);delete positions[id];}
  activeComment='comment';syncCommentTargets();
 }
 $('drawing-comment-target').onchange=()=>{selection=null;selectDrawingComment($('drawing-comment-target').value);editor();};
 $('drawing-comment-add').onclick=()=>{
  if(!sheet||busy||comments.length>=16)return;
  const id='comment-'+crypto.randomUUID(),style=currentCommentStyle();
  comments.push({id,text:'',size:style.size,font:style.font,color:style.color});
  if(editingPage>=0&&pdfLayout==='manual')pageAssignments.comments[id]=editingPage+1;
  pagePositionMap()[id]=[15,Math.min(sheet.contentBottom-15,30+comments.length*12)];
  selectDrawingComment(id);render();$('drawing-comment').focus();
 };
 $('drawing-comment-remove').onclick=()=>{if(busy)return;removeDrawingComment(activeComment);selection=null;render();};
 function applyAutomaticLayout(){if(!data)return false;try{const result=optimizeDrawingLayout(data,{scale:Number($('drawing-scale').value),dimensions,comment:mainComment,options:options(),isoOnRight:true,spreadViews:true,preferProjectionOrder:true});positions=result.positions;dimensions=result.dimensions;autoIsoScale=result.autoIsoScale;layoutKind='compact';setScale(result.scale);$('drawing-paper-size').value=result.paper;picking=null;action=null;selection=null;render(true,{reflowDimensions:true});if(!overflow)status('用紙内で図を大きく自動配置しました。縮尺 '+drawingScaleLabel(result.scale)+'。元に戻すで取消できます');return true;}catch(error){status('自動配置できません：'+error.message);return false;}}
 function persist(){
  if(!data)return;
  details=pruneDetailDimensionPlacements(details,dimensions);
  dimensionReferences=captureDrawingReferences(withDetails(data,details),dimensions,dimensionReferences);
  const next={version:1,signature:source,targetMode:$('drawing-target').value,targets,scale:Number($('drawing-scale').value),hidden:$('drawing-hidden').checked,comment:mainComment,dimensions:structuredClone(dimensions),options:structuredClone(options()),
   ...(dimensionPoints.length?{dimensionPoints:structuredClone(dimensionPoints)}:{})};
  if(JSON.stringify(next)!==JSON.stringify(saved)){
   if(saved&&!replaying&&saved.signature===source){undo.push(structuredClone(saved));if(undo.length>100)undo.shift();redo=[];}
   saved=next;onChange();historyControls();
  }
 }
 function historyControls(){$('drawing-undo').disabled=!data||busy||!undo.length;$('drawing-redo').disabled=!data||busy||!redo.length;}
 function setCommentWidth(note,width){
  if(width===undefined)delete commentWidths[note.id];else commentWidths[note.id]=width;
  pagePositionMap()[note.id]=[note.x,note.y];
 }
 function commentWidthLimit(note){
  const right=$('drawing-paper-size').value==='auto'?maxCommentWidth-15:sheet.width-5;
  return Math.max(minCommentWidth,Math.min(maxCommentWidth,Math.floor((right-note.x)*10)/10));
 }
 function editCommentWidth(width){
  if(selection?.type!=='comment'||busy)return;
  const note=sheet?.notes.find(item=>item.id===selection.id);
  if(note&&width!==undefined&&(!validCommentWidth(width)||width>commentWidthLimit(note))){
   status('折り返し幅は '+minCommentWidth+' ～ '+commentWidthLimit(note)+' mmで指定してください');
  }else if(note&&width!==note.wrapWidth){
   setCommentWidth(note,width);render();
  }
  $('drawing-comment-width').value=note?(commentWidths[note.id]??''):'';
 }
 $('drawing-comment-width').onchange=e=>editCommentWidth(e.target.value===''?undefined:e.target.valueAsNumber);
 $('drawing-comment-width-auto').onclick=()=>editCommentWidth(undefined);
 function drawCommentWidthHandle(){
  const svg=viewportHost.querySelector('svg');
  svg?.querySelector('[data-comment-resize]')?.remove();
  if(!svg||busy||selection?.type!=='comment'||picking||action)return;
  const note=sheet?.notes.find(item=>item.id===selection.id);
  if(!note)return;
  const x=note.x+(note.wrapWidth??note.width),y=note.y+Math.min(note.height/2,note.lineHeight);
  const unit=1/(svg.getScreenCTM()?.a||1),ns='http://www.w3.org/2000/svg';
  const grip=document.createElementNS(ns,'g');grip.dataset.commentResize=note.id;
  const add=(tag,attrs)=>{
   const el=document.createElementNS(ns,tag);
   for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);
   grip.append(el);return el;
  };
  add('title',{}).textContent='右端をドラッグして折り返し幅を変更';
  add('path',{d:'M '+x+' '+note.y+' v '+note.height,fill:'none',stroke:'#00748c','stroke-width':1.5*unit,'stroke-dasharray':3*unit+' '+2*unit});
  add('rect',{x:x-4*unit,y:y-6*unit,width:8*unit,height:12*unit,rx:2*unit,fill:'#00748c',stroke:'white','stroke-width':unit});
  add('rect',{x:x-8*unit,y:Math.min(note.y,y-10*unit),width:16*unit,height:Math.max(note.y+note.height,y+10*unit)-Math.min(note.y,y-10*unit),fill:'transparent'});
  svg.append(grip);
 }
 function editor(){
  for(const node of viewportHost.querySelectorAll('[data-hidden-dimension-preview]'))node.remove();
  drawCommentWidthHandle();
  for(const el of viewportHost.querySelectorAll('[data-edit-selected]'))el.removeAttribute('data-edit-selected');
  dimensionList?.highlight();
  const marker=selection?.type==='marker',comment=selection?.type==='comment',point=selection?.type==='dimensionPoint';
  $('drawing-comment-width-label').hidden=$('drawing-comment-width-auto').hidden=!comment;
  const wrapWidth=comment?commentWidths[selection.id]:undefined;
  const selectedNote=comment&&sheet?.notes.find(note=>note.id===selection.id);
  if(selectedNote)$('drawing-comment-width').max=commentWidthLimit(selectedNote);
  $('drawing-comment-width-auto').disabled=busy||wrapWidth===undefined;
  if(document.activeElement!==$('drawing-comment-width'))$('drawing-comment-width').value=wrapWidth??'';
  const d=selection?.type==='dimension'?dimensions[selection.index]:null;
  const leader=selection?.type==='leader'?leaders.find(note=>note.id===selection.id):null;
  if(selection?.type==='dimension'&&!d)selection=null;
  $('drawing-editor').hidden=!selection;
  if(!selection)return;
  const active=viewportHost.querySelector(leader?'[data-leader="'+selection.id+'"]':marker?'[data-marker="'+selection.id+'"]':
   point?'[data-dimension-point="'+selection.id+'"]':comment?'[data-comment="'+(selection.id==='comment'||!selection.id?'true':selection.id)+'"]':'[data-dimension="'+selection.index+'"]');
  active?.setAttribute('data-edit-selected','true');
  $('drawing-editor-title').tabIndex=-1;
  $('drawing-editor-title').textContent=point?'手動の寸法点':leader?.threadRef?'モデルに連動するねじ注記':leader?'矢印付き注記を編集':marker?'中心線・中心マーク':comment?'コメントを編集':d?.review?'寸法の参照先を要確認':'寸法を編集';
  $('drawing-precision-label').hidden=!d;
  const editValue=canOverrideDrawingDimensionValue(d)&&!d.review;
  const measured=editValue?Number(dimensionValue(d).toFixed(6)):null;
  const overridden=editValue&&d.displayValue!==undefined;
  $('drawing-dimension-value-label').hidden=!editValue;
  dimensionValueInput.disabled=busy;
  dimensionValueInput.value=editValue?d.displayValue??measured:'';
  $('drawing-dimension-measured-value').hidden=$('drawing-dimension-value-reset').hidden=!overridden;
  $('drawing-dimension-measured-value').textContent=overridden?'実測 '+measured+' mm':'';
  $('drawing-dimension-value-reset').disabled=busy;
  $('drawing-font-label').hidden=!d&&!comment;$('drawing-edit-comment').hidden=!comment;
  $('drawing-leader-edit-label').hidden=!leader;
  $('drawing-leader-edit').value=leader?.text??'';
  $('drawing-leader-edit').readOnly=!!leader?.threadRef;
  $('drawing-font').value=comment?currentCommentStyle().size:d?.fontSize??standardDimensionFont;
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
  const relinkView=!!d?.unplaced&&d.view!=='iso'?dimensionViews(d.kind).length:!!sheet?.layout[d?.view];
  relink.hidden=!d?.review;relink.disabled=busy||!relinkView;
  relink.title=relinkView?'現在の図形で寸法の参照点を指定します':'先に対象のビューを表示してください';
  $('drawing-annotation-relink').hidden=!selectedReviewAnnotation();
  $('drawing-annotation-relink').disabled=busy||!names().length;
  for(const end of ['a','b']){
   const button=$('drawing-dimension-replace-'+end);
   button.hidden=!d||!!d.review||!isLinearDimensionKind(d.kind);
   button.disabled=busy||!active;
  }
 }
 async function travel(from,to){
  if(!data||!from.length||busy)return;
  persist();
  const previous=structuredClone(saved),previousData=data,previousSelected=selected,next=from.pop();
  to.push(previous);replaying=true;selection=null;picking=null;
  restore(next);$('drawing-target').value=next.targetMode;
  if(next.targetMode==='selected')selected=next.targets.slice();
  const changed=!sameTargets(targets,next.targets)||
   JSON.stringify(previous.options.sections)!==JSON.stringify(sections)||
   !sameDrawingFront(previous.options.frontFrame,frontFrame)||requestedViews(options()).some(key=>!data.views[key])||
   !!drawingBackgroundColor(backgrounds)&&Object.values(data.views).some(view=>view.silhouette===undefined);
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
 $('drawing-delete-selection').onclick=()=>{
  if(selection?.type==='dimension')dimensions.splice(selection.index,1);
  else if(selection?.type==='dimensionPoint')dimensionPoints=dimensionPoints.filter(point=>point.id!==selection.id);
  else if(selection?.type==='comment')removeDrawingComment(selection.id??'comment');
  else if(selection?.type==='marker')markers=markers.filter(m=>m.id!==selection.id);
  else if(selection?.type==='leader')leaders=leaders.filter(note=>note.id!==selection.id);
  selection=null;cancelPick();
 };
 $('drawing-edit-comment').onclick=()=>{selectDrawingComment(selection?.id??'comment');$('drawing-comment').focus();};
 $('drawing-leader-edit').onchange=()=>{
  const note=selection?.type==='leader'&&leaders.find(item=>item.id===selection.id);
  if(!note||note.threadRef||busy)return;
  const text=$('drawing-leader-edit').value.trim();
  if(!text){editor();return;}
  note.text=text;render();
 };
 $('drawing-leader-start').onclick=()=>{
  if(leaders.length>=maxDrawingLeaders)return;
  $('drawing-leader-input').value='';
  beginAction('leader');
 };
 $('drawing-thread-leader-start').onclick=()=>beginAction('leader',{thread:true});
 $('drawing-print-palette').onchange=()=>{
  if(!sheet||busy)return;
  printPalette=$('drawing-print-palette').value;
  rememberDrawingColors({printPalette});render();
 };
 $('drawing-pdf-layout').onchange=()=>{
  if(!sheet||busy)return;
  pdfLayout=$('drawing-pdf-layout').value;
  if(pdfLayout==='manual')pagePanel.open=true;
  if(pdfLayout)pageScalePanel.open=true;
  render();
 };
 $('drawing-pdf-placement').onchange=()=>{
  if(!sheet||busy)return;
  pdfPlacement=$('drawing-pdf-placement').value;
  render();
 };
 async function changeBackground(key,color){
  if(!sheet||busy||!validDimensionColor(color))return;
  color=color.toLowerCase();
  if(color===backgrounds[key])return;
  const next={...backgrounds,[key]:color};
  try{
   if(drawingBackgroundColor(next)&&!await loadMissingViews({...options(),...next}))return;
   backgrounds=next;
   rememberDrawingColors({[key]:color});
   render();
  }catch(e){if(dialog.open){render(false);status(e.message);}}
 }
 for(const [key,id] of Object.entries(backgroundControls)){
  $(id).onchange=()=>changeBackground(key,$(id).value);
  $(id+'-reset').onclick=()=>changeBackground(key,'#ffffff');
 }
 function syncPreviewBackground(){
  const ready=!!sheet&&!busy;
  for(const [key,id] of Object.entries(backgroundControls)){
   $(id).value=backgrounds[key];
   $(id).disabled=!ready;
   $(id+'-reset').disabled=!ready||backgrounds[key]==='#ffffff';
  }
 }
 $('drawing-comment-color').onchange=()=>{
  const color=$('drawing-comment-color').value;
  if(!data||busy||!validDimensionColor(color))return;
  setCurrentCommentStyle('color',color);
  if(activeComment==='comment')rememberDrawingColors({commentColor:color});
  render();
 };
 $('drawing-comment-font').onchange=()=>{
  const font=$('drawing-comment-font').value;
  if(!data||busy||font&&!hasDrawingCommentFont(font))return;
  setCurrentCommentStyle('font',font);render();
 };
 function changeAnnotationSize(input,dimension){
  if(!sheet||busy)return;
  const value=input.valueAsNumber;
  if(!Number.isFinite(value)||value<1.5||value>10){input.value=dimension?(dimension.fontSize??standardDimensionFont):currentCommentStyle().size;return;}
  if(dimension){
   dimension.fontSize=value;
   renderResizedDimensions();
  }else{
   setCurrentCommentStyle('size',value);
   render();
  }
 }
 $('drawing-comment-size').onchange=()=>changeAnnotationSize($('drawing-comment-size'));
 $('drawing-font').onchange=()=>{
  if(selection?.type==='comment')changeAnnotationSize($('drawing-font'));
  else if(selection?.type==='dimension'&&dimensions[selection.index])changeAnnotationSize($('drawing-font'),dimensions[selection.index]);
 };
 $('drawing-precision').onchange=()=>{if(selection?.type!=='dimension')return;const d=dimensions[selection.index];if($('drawing-precision').value==='auto')delete d.precision;else d.precision=Number($('drawing-precision').value);render();};
 dimensionValueInput.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();dimensionValueInput.blur();}};
 dimensionValueInput.onchange=()=>{
  const d=selection?.type==='dimension'&&dimensions[selection.index];
  if(busy||!canOverrideDrawingDimensionValue(d)||d.review)return;
  const {value,valueAsNumber,validity}=dimensionValueInput;
  if(validity.badInput||value!==''&&!validDrawingDimensionDisplayValue(valueAsNumber)){
   editor();status('表示寸法値には0より大きい数値を入力してください');return;
  }
  if(value===''||valueAsNumber===dimensionValue(d))delete d.displayValue;
  else d.displayValue=valueAsNumber;
  render();
 };
 $('drawing-dimension-value-reset').onclick=()=>{
  const d=selection?.type==='dimension'&&dimensions[selection.index];
  if(!d||busy||d.displayValue===undefined)return;
  delete d.displayValue;render();
 };
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
   rememberDrawingColors({[key]:whole.value});
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
 $('drawing-default-colors-reset').onclick=()=>{
  if(!sheet||busy)return;
  dimensionColors={};
  rememberDrawingColors(Object.fromEntries(colorFields.map(([key])=>[key,defaultDrawingDimensionColor])));
  render();
 };
 $('drawing-item-colors-reset').onclick=()=>{
  const d=selection?.type==='dimension'&&dimensions[selection.index];
  if(!d||busy)return;
  for(const [key] of colorFields)delete d[key];
  render();
 };
 $('drawing-dimension-relink').onclick=()=>{
  const index=selection?.index,d=dimensions[index];
  if(!d?.review||!sheet||busy)return;
  dimensionKindInput.value=d.kind;
  const view=d.unplaced&&d.view!=='iso'?undefined:d.view;
  startDimension(d.kind,{...(view?{view}:{}),replace:index});
  viewportHost.scrollIntoView({block:'nearest'});
 };
 $('drawing-annotation-relink').onclick=()=>{
  const selected=selectedReviewAnnotation();
  if(selected)beginReviewAction(selected.kind,selected.item);
 };
 for(const end of ['a','b'])$('drawing-dimension-replace-'+end).onclick=()=>{
  const index=selection?.type==='dimension'?selection.index:undefined,d=dimensions[index];
  if(!d||d.review||!sheet?.layout[d.view]||busy||!isLinearDimensionKind(d.kind))return;
  startDimension(d.kind,{view:d.view,replace:index,endpoint:end});
  viewportHost.scrollIntoView({block:'nearest'});
 };
 dialog.addEventListener('keydown',e=>{
  e.stopPropagation();
  if(activateHoleKey(e)||e.target.matches('input,textarea,select,[contenteditable="true"]'))return;
  const key=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey)&&['z','y'].includes(key)){
   e.preventDefault();
   $(key==='y'||e.shiftKey?'drawing-redo':'drawing-undo').click();
  }else if((e.key==='Delete'||e.key==='Backspace')&&selection){
   e.preventDefault();$('drawing-delete-selection').click();
  }
 });
 function controls(){
  const ready=!!sheet&&!busy,editable=ready&&names().length>0;
  syncDimensionHint();
  syncPreviewBackground();syncCommentTargets();syncViewScales();syncPageAssignments();syncPageEditor();syncPageScales();
  syncScaleInput(scaleText,Number($('drawing-scale').value));
  syncDrawingMaterials();
  $('drawing-layout-label').disabled=!ready;
  for(const button of conflictList.querySelectorAll('button')){
   button.disabled=busy||button.hasAttribute('data-conflict-locked');
  }
  $('drawing-leader-start').disabled=!editable||leaders.length>=maxDrawingLeaders;
  $('drawing-thread-leader-start').disabled=!editable||leaders.length>=maxDrawingLeaders||!drawingProjectionNames.some(view=>threadHoles(view).length);
  $('drawing-leader-input-label').hidden=action?.kind!=='leader'||!!action.thread;
  $('drawing-pdf-layout').disabled=!ready;
  $('drawing-pdf-layout').value=pdfLayout;
  $('drawing-pdf-placement-label').hidden=!pdfLayout;
  $('drawing-pdf-placement').disabled=!ready;
  $('drawing-pdf-placement').value=pdfPlacement;
  const splitPDF=!!sheet&&editPageCount>1;
  const pdfNote=splitPDF?(editingPage>=0?'PDFの '+(editingPage+1)+' ページ目を編集中です。ページ内の図・寸法・コメントの配置はPDFに反映されます。':'PDFは '+editPageCount+' ページに分かれます。「編集するページ」で実際のページに切り替えられます。'):'';
  pdfPagesNote.hidden=!splitPDF;
  if(pdfPagesNote.textContent!==pdfNote)pdfPagesNote.textContent=pdfNote;
  $('drawing-print-palette').value=printPalette;$('drawing-print-palette').disabled=!ready;
  $('drawing-pdf').disabled=blockPDFExport();
  $('drawing-pdf-preview-open').disabled=blockPDFPreview();
  $('drawing-print-set').hidden=!exportPrintSet||!canExportPrintSet();
  $('drawing-print-set').disabled=blockPDFPreview();
  $('drawing-break-axis').value=breakAxis;
  $('drawing-break-axis').disabled=!ready;
  $('drawing-break-percent').value=breakPercent;
  $('drawing-break-percent').disabled=!ready;
  $('drawing-break-percent-label').hidden=!breakAxis;
  $('drawing-break-center').hidden=!breakAxis||!breakRange;
  $('drawing-break-center').disabled=!ready;
  $('drawing-break-help').hidden=!breakAxis;
  $('drawing-break-help').textContent=breakRange?'省略範囲 '+breakRange.map(n=>Number((100*n).toFixed(1))+'%').join(' ～ '):'図の省略線をドラッグして範囲を調整';
  const choosingHoles=action?.kind==='holes'&&!!action.candidates&&action.rowIndex===undefined;
  const holeStart=$('drawing-hole-start');
  holeStart.textContent=holeTable?.originReview?'穴位置表の基準点を選び直す':holeTable?'この表に穴を追加':'穴位置表を作成';
  holeStart.title=holeTable&&!holeTable.originReview?'同じ基準点と穴番号を保ち、表に載せる穴を追加します':'図で基準点をクリックし、表に載せる円を選びます';
  holeStart.disabled=!ready||!viewSelection.length||!!holeTable&&!holeTable.originReview&&(!sheet?.layout[holeTable.view]||!holeCapacity());
  $('drawing-hole-all').hidden=$('drawing-hole-add').hidden=!choosingHoles;
  $('drawing-hole-all').disabled=!ready||!choosingHoles||action.candidates.length>holeCapacity();
  $('drawing-hole-add').textContent=action?.append?'選んだ穴を追加':'穴位置表を確定';
  $('drawing-hole-add').disabled=!ready||!choosingHoles||!action.selected.size;
  $('drawing-hole-delete').hidden=!holeTable||action?.kind==='holes';
  $('drawing-hole-delete').disabled=!ready;
  const pending=holeTable?.holes.map((h,i)=>h.review?i:-1).filter(i=>i>=0)??[];
  const rowSelect=$('drawing-hole-row'),selectedRow=rowSelect.value;
  const rowKey=pending.map(i=>i+'-'+holeTable.holes[i].number).join(',');
  if(rowSelect.dataset.rows!==rowKey){
   rowSelect.replaceChildren(...pending.map(i=>new Option('H'+holeTable.holes[i].number,String(i))));
   rowSelect.dataset.rows=rowKey;
   if([...rowSelect.options].some(o=>o.value===selectedRow))rowSelect.value=selectedRow;
  }
  $('drawing-hole-review').hidden=!pending.length||!!holeTable?.originReview;
  $('drawing-hole-relink').disabled=!ready||!sheet?.layout[holeTable?.view]||!!action||!!holeTable?.originReview;
  $('drawing-hole-remove-row').disabled=!ready||!!action;
  $('drawing-projection-lock').checked=projectionLockActive();
  $('drawing-projection-lock').disabled=!ready||editingPage>=0;
  $('drawing-link-projections').checked=linkedProjections;
  $('drawing-link-projections').disabled=!ready;
  $('drawing-link-scales').checked=linkedProjectionScales;
  $('drawing-link-scales').disabled=!ready;
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
  if(document.activeElement!==$('drawing-dimension-font'))$('drawing-dimension-font').value=dimensionFontSize;
  $('drawing-default-colors-reset').disabled=!ready||!Object.keys(dimensionColors).length;
  for(const [key,id] of colorFields){
   const input=$('drawing-default-'+id+'-color');
   input.value=drawingDimensionColor(key,null,dimensionColors);input.disabled=!ready;
  }
  for(const row of dimensionViewRows){
   const view=row.dataset.autoDimensionView;
   row.hidden=view==='iso'?!isoCheck.checked:!viewSelection.includes(view);
   row.disabled=!ready;
   for(const input of row.querySelectorAll('input'))input.checked=autoDimensionViews[view]?.includes(input.value)??true;
  }
  for(const input of [...viewChecks,isoCheck])input.disabled=!ready;
  for(const id of ['drawing-view-priority','drawing-iso-mode','drawing-fit','drawing-arrange','drawing-auto-layout'])$(id).disabled=!ready;
  for(const id of ['drawing-dimension-overall','drawing-section-add'])$(id).disabled=!ready||!viewSelection.length;
  $('drawing-dimension-auto').disabled=!ready||!dimensionViews('aligned').length;
  for(const input of typeInputs){input.checked=typeKeys(input.dataset.autoType).every(key=>autoDimensionTypesEnabled.includes(key));input.disabled=!ready;}
  $('drawing-auto-group').checked=groupRepeatedDimensions;$('drawing-auto-group').disabled=!ready;
  $('drawing-auto-unique-overall').checked=uniqueOverallDimensions;$('drawing-auto-unique-overall').disabled=!ready;
  $('drawing-dimension-group').disabled=!editable||!dimensions.some(d=>!d.review&&['radius','diameter'].includes(d.kind));
  dimensionList?.sync();
  for(const id of ['drawing-dimension-point-add','drawing-center-add','drawing-center-line','drawing-centers-all','drawing-detail-add'])$(id).disabled=!editable;
  $('drawing-target').disabled=busy;
  $('drawing-target').querySelector('[value="selected"]').disabled=!selected.length;
  historyControls();editor();extraControls();syncHiddenViews();syncInspectedHole();
  syncOmittedHoles();
  $('drawing-dimension-arrange').disabled=!ready||!dimensions.some(d=>sheet.layout[d.view]);
  $('drawing-dimension-undo').disabled=$('drawing-dimension-clear').disabled=!ready||!dimensions.length;
  $('drawing-dimension-cancel').hidden=!picking&&!action;
  const addingPoint=action?.kind==='dimensionPoint';
  $('drawing-dimension-point-add').setAttribute('aria-pressed',String(addingPoint));
  $('drawing-dimension-cancel').textContent=addingPoint?'寸法点の追加を終了':'寸法追加を中止';
  drawViewResizeHandles();
 }
 function clickLeader(e){
  if(action.thread){
   if(!action.hole){
    const view=hitView(e,true),hole=nearestHole(e,view,threadHoles(view),entry=>entry);
    if(!hole)throw Error('ねじを設定した穴の輪郭または中心付近をクリックしてください');
    const {anchor}=drawingThreadLeader(view,hole,local(view,paperPoint(e)));
    Object.assign(action,{view,hole,anchor});
    status('ねじ注記の文字を置く位置をクリックしてください');
    return;
   }
   leaders=placeAnnotation(leaders,'leader',drawingThreadLeader(action.view,action.hole,local(action.view,paperPoint(e))));
   cancelPick();return;
  }
  if(!action.anchor){
   const hit=nearest(e,'point')||nearest(e,'line');
   const view=hit?.name||hitView(e,false,true);
   if(!view)throw Error('図の中で矢印が指す箇所をクリックしてください');
   const anchor=hit?.point??local(view,paperPoint(e));
   if(!insideView(viewData(view),anchor)||drawingPointOmitted(sheet.layout[view],anchor))throw Error('表示されている図形を指定してください');
   Object.assign(action,{view,anchor});
   status('注記本文を入力し、図面上で文字を置く位置をクリックしてください');
   return;
  }
  const text=$('drawing-leader-input').value.trim();
  if(!text){$('drawing-leader-input').focus();throw Error('注記本文を入力してください');}
  const at=local(action.view,paperPoint(e));
  leaders=placeAnnotation(leaders,'leader',{view:action.view,anchor:action.anchor,at,text});
  cancelPick();
 }
 function beginBreakDrag(e,edge){
  const name=edge.closest('[data-view]')?.dataset.view,cut=sheet.layout[name]?.break;
  if(cut)startPaperDrag(e,{type:'break',view:name,cut,edge:Number(edge.dataset.breakEdge)},true);
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
 const tableCandidates=view=>drawingHoleCandidates(data.views[view],view,features,targets,frontFrame);
 const holeSourceView=name=>details.find(detail=>detail.id===name)?.view??name;
 function centerHoles(name){
  const source=holeSourceView(name),view=data?.views[source];
  if(!view?.holeMachining?.length)return [];
  if(!holeCenterCache.has(view)){
   const guides=drawingDimensionCenterGuides(view,true).filter(guide=>guide.machining);
   const holes=view.holeMachining.filter(hole=>guides.some(guide=>sameDrawingCenter(guide.point,hole.center)))
    .map(machining=>({center:machining.center,radius:machining.radius,machining}));
   holeCenterCache.set(view,associateDrawingHoleSources(holes,source,features,targets,frontFrame));
  }
  return holeCenterCache.get(view);
 }
 function referenceForCenter(name,guide){
  if(!guide?.machining)return undefined;
  const holes=centerHoles(name).filter(hole=>sameDrawingCenter(hole.center,guide.point));
  return holes.length===1?drawingHoleCenterReference(holes[0]):undefined;
 }
 function followHoleCenter(name,ref){
  const view=viewData(name),point=view&&resolveDrawingHoleCenter(centerHoles(name),ref);
  return point&&drawingDimensionPointFits(view,point)?point:null;
 }
 function threadHoles(view){
  const layout=sheet?.layout[view];
  if(!layout)return [];
  return (data?.views[view]?.holeMachining??[]).filter(row=>row.thread&&
   drawingDimensionVisible({...row,radius:row.counterbore?.radius??row.radius},layout));
 }
 function nearestHole(e,view,candidates,machining){
  if(!candidates.length)return null;
  const scale=sheet.layout[view].scale,p=paperPoint(e),matrix=viewportHost.querySelector('svg').getScreenCTM();
  let nearest=null,best=10/Math.hypot(matrix.a,matrix.b),bestRank=0;
  for(const hole of candidates){
   const info=machining(hole),rank=info?.thread?2:info?1:0;
   const q=map(view,hole.center),r=Math.hypot(p[0]-q[0],p[1]-q[1]),outer=info?.counterbore?.radius??hole.radius;
   const distance=Math.min(r,Math.abs(r-hole.radius*scale),Math.abs(r-outer*scale));
   const sameCenterHit=nearest&&sameDrawingCenter(nearest.center,hole.center)&&Math.abs(distance-best)<1e-4;
   if(sameCenterHit&&rank!==bestRank?rank>bestRank:distance<best){best=distance;nearest=hole;bestRank=rank;}
  }
  return nearest;
 }
 function holeCapacity(){
  return Math.min(maxDrawingTableHoles-(holeTable?.holes.length??0),Number.MAX_SAFE_INTEGER-lastHoleNumber(holeTable));
 }
 const holeTargets='[data-hole-row],[data-hole-marker],[data-hole-hit]';
 const holeId=el=>el.dataset.holeRow??el.dataset.holeMarker??el.dataset.holeHit;
 function syncInspectedHole(){
  const enabled=!!sheet&&!busy&&!action&&!picking;
  viewportHost.toggleAttribute('data-hole-inspection',enabled);
  if(inspectedHole&&!viewportHost.querySelector('[data-hole-row="'+inspectedHole+'"]'))inspectedHole=null;
  for(const el of viewportHost.querySelectorAll(holeTargets)){
   const id=holeId(el),selected=enabled&&id===inspectedHole;
   el.toggleAttribute('data-hole-selected',selected);
   if(el.hasAttribute('data-hole-hit'))continue;
   if(enabled){
    el.setAttribute('tabindex','0');el.setAttribute('role','button');
    el.setAttribute('aria-label',id+(el.hasAttribute('data-hole-row')?' の表の行':' の穴'));
    el.setAttribute('aria-pressed',String(selected));
   }else for(const attr of ['tabindex','role','aria-label','aria-pressed'])el.removeAttribute(attr);
  }
 }
 function inspectHole(el){
  inspectedHole=holeId(el);selection=null;editor();syncInspectedHole();
  const review=holeTable?.holes.findIndex((h,i)=>h.review&&'H'+(h.number??i+1)===inspectedHole);
  if(review>=0)$('drawing-hole-row').value=String(review);
  status(inspectedHole+(review>=0?' の参照先は要確認です':' を選択'));
 }
 function clickHoleTable(e){
  const state=action;
  if(!state.candidates){
   const view=hitView(e,true);
   if(!view)throw Error('正投影図で基準点を選んでください');
   const hit=nearest(e,'point'),point=hit?.name===view?hit.point:local(view,paperPoint(e)),v=sheet.layout[view];
   if(drawingPointOmitted(v,point))throw Error('省略範囲の外で基準点を指定してください');
   const candidates=tableCandidates(view).filter(hole=>drawingDimensionVisible(hole,v));
   if(!candidates.length)throw Error('この図に選べる円がありません');
   if(state.resetOrigin){
    const {originReview,...table}=holeTable;
    holeTable=reconcileHoleTable({...table,view,origin:point},candidates,viewData(view).viewBox,{targetsChanged:true});
    cancelPick();status('穴位置表の基準点を設定しました');return;
   }
   Object.assign(state,{view,origin:point,candidates,selected:new Set()});
  }else{
   const hit=nearestHole(e,state.view,state.candidates,hole=>hole.machining),closest=state.candidates.indexOf(hit);
   if(closest<0)throw Error('円の輪郭または中心付近をクリックしてください');
   if(state.rowIndex!==undefined){
    const index=state.rowIndex;
    if(holeTable.holes.some((h,i)=>i!==index&&!h.review&&Math.hypot(h.center[0]-hit.center[0],h.center[1]-hit.center[1])<1e-4&&Math.abs(h.radius-hit.radius)<1e-4))throw Error('この穴には既に穴番号があります');
    holeTable.holes[index]={number:holeTable.holes[index].number,...holeAnchor(hit)};
    action=null;render();return;
   }
   if(state.selected.has(closest))state.selected.delete(closest);
   else{
    if(state.selected.size>=holeCapacity())throw Error('追加できる穴は '+holeCapacity()+' 件までです');
    state.selected.add(closest);
   }
  }
  updateHoleSelection();
 }
 function updateHoleSelection(){
  render(false);
  status('円をクリックして選択・解除し、「'+$('drawing-hole-add').textContent+'」を押してください（'+action.selected.size+' 件選択）');
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
   const radii=hole.machining?.counterbore?[hole.radius,hole.machining.counterbore.radius]:[hole.radius];
   for(const radius of radii)add('circle',{cx,cy,r:radius*v.scale,fill:selected?'#008a9e25':'none',stroke:selected?'#008a9e':'#4384a0',
    'stroke-width':selected?.5:.3,'stroke-dasharray':selected?'none':'1 1'});
  });
  svg.append(group);
 }
 function syncCommentStyle(ready){
  const current=currentCommentStyle();
  $('drawing-comment-color').value=current.color;
  $('drawing-comment-font').value=current.font;
  if(document.activeElement!==$('drawing-comment-size'))$('drawing-comment-size').value=current.size;
  $('drawing-comment-color').disabled=$('drawing-comment-font').disabled=$('drawing-comment-size').disabled=!ready;
  $('drawing-comment').style.fontFamily=drawingCommentFamily(current.font);
  const fonts=[...new Set([current.font,commentFont,...comments.filter(note=>note.text.trim()).map(note=>note.font)].filter(Boolean))].sort();
  const request=fonts.join(','),label=$('drawing-comment-font-status');
  if(request===requestedCommentFonts)return;
  requestedCommentFonts=request;
  label.textContent=fonts.length?'フォントを読み込んでいます…':'';
  if(!fonts.length)return;
  Promise.all(fonts.map(loadDrawingCommentFont)).then(()=>{
   if(request!==requestedCommentFonts)return;
   label.textContent='';
   if(dialog.open&&sheet)render(false);
  }).catch(()=>{
   if(request===requestedCommentFonts)label.textContent='フォントを読み込めませんでした。選び直して再試行してください。';
  });
 }
 function viewLabel(name){
  const node=viewportHost.querySelector('[data-view="'+name+'"] > text');
  return drawingProjections[name]?.label||(name==='iso'?'ISO':node?.textContent??(name.startsWith('section-')?'断面図':'詳細図'));
 }
 function pdfViewLabel(name){
  const section=sections.findIndex(item=>item.id===name),detail=details.findIndex(item=>item.id===name);
  if(section>=0){const letter=String.fromCharCode(65+section);return '断面 '+letter+'–'+letter;}
  if(detail>=0)return '詳細 D'+(detail+1);
  return viewLabel(name);
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
 function selectedReviewAnnotation(){
  const items={leader:leaders,marker:markers,dimensionPoint:dimensionPoints}[selection?.type];
  const item=items?.find(value=>value.id===selection.id&&value.review);
  return item?{item,kind:selection.type==='marker'?item.kind:selection.type}:null;
 }
 function referenceReviewItems(){
  const entries=[];
  dimensions.forEach((d,index)=>{
   if(d.review)entries.push({kind:'dimension',index,view:d.view,label:viewLabel(d.view)+' 寸法 '+(index+1)});
  });
  for(const [kind,items,label] of [
   ['section',sections,item=>viewLabel(item.id)],['detail',details,item=>viewLabel(item.id)],
   ['leader',leaders,item=>'注記 '+item.text.split('\n')[0].slice(0,32)],
   ['marker',markers,item=>item.kind==='center'?'中心マーク':'中心線'],
   ['dimensionPoint',dimensionPoints,()=> '手動の寸法点'],
  ]){
   for(const item of items)if(item.review)entries.push({kind,id:item.id,view:item.view,label:viewLabel(item.view)+' '+label(item)});
  }
  if(holeTable?.originReview)entries.push({kind:'holeTable',view:holeTable.view,label:'穴位置表の基準点'});
  else holeTable?.holes.forEach((hole,index)=>{
   if(hole.review)entries.push({kind:'hole',index,view:holeTable.view,label:'穴位置表 H'+(hole.number??index+1)});
  });
  return entries;
 }
 function focusReferenceReview(entry){
  if(busy||!sheet)return;
  if(editingPage>=0)editPDFPage(-1);
  picking=null;action=null;selection=null;
  const {kind,id,index}=entry;
  if(kind==='holeTable'){
   beginAction('holes',{resetOrigin:true});return;
  }
  if(kind==='hole'){
   workspace.reveal($('drawing-hole-review'));
   $('drawing-hole-row').value=String(index);
   $('drawing-hole-relink').click();return;
  }
  if(kind==='section'||kind==='detail'){
   extraTarget=id;extraControls();workspace.reveal($('drawing-extra-editor'));
   $('drawing-extra-relink').focus({preventScroll:true});return;
  }
  selection=kind==='dimension'?{type:kind,index}:{type:kind,id};
  editor();workspace.reveal($('drawing-editor'));$('drawing-editor-title').focus({preventScroll:true});
 }
 function renderReviewList(){
  const entries=referenceReviewItems();
  reviewList.hidden=!entries.length;reviewList.replaceChildren();
  if(!entries.length)return;
  const label=document.createElement('strong');label.textContent='参照先を要確認 '+entries.length+' 件';
  reviewList.append(label);
  for(const entry of entries){
   const button=document.createElement('button');button.type='button';button.textContent=entry.label;
   button.dataset.referenceReview=entry.kind;button.dataset.referenceId=String(entry.id??entry.index??'');
   button.onclick=()=>focusReferenceReview(entry);
   reviewList.append(button);
  }
 }
 function focusDrawingConflict(index,box){
  if(busy||drag||!sheet)return;
  picking=null;action=null;selection={type:'dimension',index};editor();
  syncDimensionHint();
  const svg=viewportHost.querySelector('svg');
  svg.querySelector('[data-focused-conflict]')?.remove();
  const outline=document.createElementNS('http://www.w3.org/2000/svg','rect');
  for(const [key,value] of Object.entries({x:box.x-1,y:box.y-1,width:box.width+2,height:box.height+2,
   'data-focused-conflict':'true',fill:'none',stroke:'#b45116','stroke-width':'.55','pointer-events':'none'}))outline.setAttribute(key,value);
  svg.append(outline);
  viewport.focus(box);viewportHost.scrollIntoView({block:'nearest'});viewportHost.focus({preventScroll:true});
 }
 function repositionConflictingDimension(index){
  const placed=onSheetDimensions(),d=placed[index];
  if(!sheet||busy||drag||!d||d.pinned||d.review)return;
  const result=arrangeDrawingDimensions([d],sheet,placed.filter((_,i)=>i!==index),{preferNearby:true,requireClear:true});
  if(result.unresolved.length){status('この寸法を重なりなく置ける場所が見つかりませんでした');return;}
  storeDimensionPlacement(index,result.dimensions[0]);
  picking=null;action=null;selection={type:'dimension',index};
  render();if(!sheet)return;
  focusDrawingConflict(index,dimensionPlacement(onSheetDimensions()[index],sheet).box);
  status('寸法 '+(index+1)+' だけを再配置しました。元に戻すで取り消せます');
 }
 function focusDrawingViewOverlap(issue){
  if(busy||drag||!sheet)return;
  picking=null;action=null;selection=null;
  $('drawing-layout-mode').checked=true;
  render(false);
  if(!sheet)return;
  conflictList.open=true;
  markDrawingViewOverlap(viewportHost.querySelector('svg'),issue.regions,true);
  viewport.focus(issue.box);viewportHost.scrollIntoView({block:'nearest'});viewportHost.focus({preventScroll:true});
  status(issue.views.map(pdfViewLabel).join(' と ')+' の重なりを調整できます');
 }
 function renderDrawingConflicts(){
  if(!sheet)return;
  const svg=viewportHost.querySelector('svg'),viewIssues=drawingViewOverlaps(sheet);
  for(const issue of viewIssues)markDrawingViewOverlap(svg,issue.regions);
  if(drag)return;
  const issues=drawingDimensionConflicts(onSheetDimensions(),sheet);
  const rows=$('drawing-conflict-rows');
  rows.replaceChildren();
  const counts=[];
  if(viewIssues.length)counts.push('図の重なり '+viewIssues.length+' 件');
  if(issues.length)counts.push('寸法の重なり '+issues.length+' 件');
  conflictList.hidden=!counts.length;
  conflictList.firstElementChild.textContent=counts.join(' ／ ');
  for(const issue of viewIssues){
   const row=document.createElement('div'),focus=document.createElement('button');
   row.dataset.viewConflict=issue.views.join(' ');
   focus.type='button';focus.disabled=busy;
   focus.textContent=issue.views.map(pdfViewLabel).join(' と ')+' の重なり';
   focus.onclick=()=>focusDrawingViewOverlap(issue);
   row.append(focus);rows.append(row);
  }
  for(const node of svg.querySelectorAll('[data-overlap]'))node.removeAttribute('data-overlap');
  for(const {index,reason,box} of issues){
   const d=dimensions[index],row=document.createElement('div'),focus=document.createElement('button'),fix=document.createElement('button');
   row.dataset.dimensionConflict=index;
   focus.textContent=viewLabel(d.view)+' · 寸法 '+(index+1)+' ('+dimensionLabel(d)+') · '+reason;
   focus.onclick=()=>focusDrawingConflict(index,box);
   fix.textContent='この寸法だけ再配置';
   fix.onclick=()=>repositionConflictingDimension(index);
   if(d.pinned||d.review){
    fix.setAttribute('data-conflict-locked','');
    fix.title=d.pinned?'寸法の位置の固定を解除してください':'参照先を確認してください';
   }
   focus.type=fix.type='button';
   focus.disabled=busy;fix.disabled=busy||d.pinned||d.review;
   row.append(focus,fix);rows.append(row);
   svg.querySelector('[data-dimension="'+index+'"] text')?.setAttribute('data-overlap','true');
  }
 }
 function renderOverflow(){
  const svg=viewportHost.querySelector('svg');
  const issues=drawingSheetOverflow(svg,sheet);
  const adjusting=$('drawing-layout-mode').checked;
  let titleBlockOverlap='';
  // Updating the toolbar above the paper during a gesture shifts its screen origin.
  const list=drag?.moved?null:document.createDocumentFragment();
  for(const {element:el,box,reason} of issues){
   const {view,dimension,detailDimension,comment,marker,section,detail,holeTable:table,holeLabels,leader}=el.dataset;
   const overlapsTitleBlock=reason==='titleBlock';
   const name=view?el.querySelector(':scope > text').textContent:dimension!==undefined?'寸法 '+(Number(dimension)+1):
    detailDimension?viewLabel(detailDimension)+'の寸法':
    comment?'コメント':leader?'矢印付き注記':table?'穴位置表':holeLabels?'穴の番号・基準点':marker?'中心表示 '+(markers.findIndex(m=>m.id===marker)+1):
    section?'切断線 '+String.fromCharCode(65+sections.findIndex(s=>s.id===section)):'詳細範囲 D'+(details.findIndex(d=>d.id===detail)+1);
   if(overlapsTitleBlock)titleBlockOverlap||=name;
   const adjust=()=>{
    if(busy||drag)return;
    $('drawing-layout-mode').checked=true;
    picking=null;action=null;selection=null;
    render(false);
    viewport.focus(box);viewportHost.scrollIntoView({block:'nearest'});viewportHost.focus({preventScroll:true});
    status(name+'の位置を調整できます。'+(detailDimension?'詳細図の寸法線をドラッグしてください':
     marker||detail||holeLabels?'元の図をドラッグしてください':'赤枠の内側の項目をドラッグしてください'));
   };
   if(list){
    const button=document.createElement('button');
    button.type='button';button.textContent=overlapsTitleBlock?name+'（表題欄と重なり）':name;button.onclick=adjust;
    button.setAttribute('aria-label',overlapsTitleBlock?name+'と表題欄の重なりを調整':name+'のはみ出しを調整');
    list.append(button);
   }
   el.setAttribute('data-drawing-overflow','true');
   const outline=drawingOverflowOutline(svg,box);
   outline.setAttribute('pointer-events',adjusting||picking||action?'none':'stroke');
   outline.onclick=e=>{e.stopPropagation();adjust();};
  }
  overflow=issues.length>0;
  if(list&&overflow){
   const label=document.createElement('strong');
   label.textContent=(titleBlockOverlap?'配置を確認 ':'はみ出し ')+issues.length+' 件';list.prepend(label);
  }
  if(list){overflowList.replaceChildren(list);overflowList.hidden=!overflow;}
  return titleBlockOverlap;
 }
 function render(commit=true,{reflowDimensions=false}={}){
 if(!data)return;
 if(commit&&layoutKind==='compact'&&Object.keys(withDetails(data,details).views).some(key=>drawingViewVisible(key,options())&&!positions[key])){
  if(applyAutomaticLayout())return;
  layoutKind='projection';positions={};
 }
 try{
  const makeSheet=()=>drawingSheet(data,Number($('drawing-scale').value),$('drawing-hidden').checked,dimensions,mainComment,options());
  overviewSheet=makeSheet();
  if(reflowDimensions){
   const adjusted=reflowResizedDrawingDimensions(dimensions,overviewSheet);
   if(adjusted.moved){dimensions=adjusted.dimensions;overviewSheet=makeSheet();}
  }
  sheet=overviewSheet;
  let pageError='';
  const split=drawingPDFHasMultiplePages(Object.keys(overviewSheet.layout),{pdfLayout,pageAssignments,holeTable});
  editPageCount=split?(pdfLayout==='manual'?pageAssignments.pageCount:2):1;
  if(split&&(editingPage>=0||pdfLayout!=='manual')){
   try{
    const pages=makePDFPages();
    editPageCount=pages.length;
    if(editingPage>=0)sheet=pages[Math.min(editingPage,editPageCount-1)];
   }catch(error){editingPage=-1;pageError=error.message;}
  }
  if(editPageCount<2)editingPage=-1;
  else editingPage=Math.min(editingPage,editPageCount-1);
  viewportHost.innerHTML=drawingPrintSVG(sheet.svg,printPalette);
  if(sheet.dimensionIndices)for(const node of viewportHost.querySelectorAll('[data-dimension]')){
   node.dataset.dimension=sheet.dimensionIndices[Number(node.dataset.dimension)];
  }
  if(drag?.moved)viewportHost.querySelector('svg').setAttribute('viewBox',drag.viewBox);
  else viewport.setSheet(sheet);
  markPoints();
  $('drawing-layout-help').textContent=linkedProjections?'TOPとFRONTは左右、FRONTとRIGHTは上下の移動が連動します。図の右下の角をドラッグすると拡縮します。':editingPage>=0?'図をドラッグすると移動し、図の右下の角をドラッグすると拡縮します。':layoutKind==='compact'?'右下の角をドラッグして各図の大きさを調整できます。縮尺は図面に表示します。':projectionLockActive()?'第三角法の配置をロック中。上面図は上下、右側面図は左右に動かせます。図の角をドラッグすると投影図が同じ比率で拡縮します。':'配置ロックを解除中。投影図を自由に動かせます。図の右下の角で拡縮できます。';
 const titleBlockOverlap=renderOverflow();if(!drag?.moved)renderReviewList();drawHoleSelection();
 addDrawingHoleHitAreas(viewportHost.querySelector('svg'),sheet);
 $('drawing-svg').disabled=overflow||Object.keys(data.sectionErrors||{}).length>0;$('drawing-pdf').disabled=blockPDFExport();$('drawing-paper').textContent='用紙 '+sheet.width.toFixed(1)+' × '+sheet.height.toFixed(1)+' mm';status(titleBlockOverlap?titleBlockOverlap+'が表題欄と重なっています。図枠内の空いている場所へ移動してください':overflow?'用紙の外にはみ出しています。縮尺を小さくするか、配置・用紙サイズを変更してください':data.bodyCount+' ボディ · 寸法 '+dimensions.filter(d=>sheet.layout[d.view]&&drawingDimensionVisible(d,sheet.layout[d.view])).length+' 個 · 作業ファイルを保存すると再編集できます');
 if(pageError)status('PDFのページを表示できません。'+pageError);
 if(drag?.moved){drawCommentWidthHandle();syncInspectedHole();drawViewResizeHandles();}else controls();
 if($('drawing-layout-mode').checked&&!picking&&!action){
  for(const g of viewportHost.querySelectorAll('[data-view]')){
   const v=sheet.layout[g.dataset.view],rect=document.createElementNS('http://www.w3.org/2000/svg','rect');
   const attrs={x:v.x,y:v.y-7,width:v.width,height:v.height+7,fill:'transparent','pointer-events':'all'};
   for(const [key,value] of Object.entries(attrs))rect.setAttribute(key,value);
   g.prepend(rect);
  }
  for(const group of viewportHost.querySelectorAll('[data-detail-dimension]'))group.removeAttribute('pointer-events');
  viewportHost.style.cursor='move';
 }else viewportHost.style.cursor=picking||action?'crosshair':'';
 renderDrawingConflicts();syncAlignment();for(const path of viewportHost.querySelectorAll('[data-break-edge]')){const hit=path.cloneNode();hit.setAttribute('stroke','transparent');hit.setAttribute('stroke-width','4');hit.setAttribute('pointer-events',picking||action?'none':'stroke');path.before(hit);}if(Object.keys(data.sectionErrors||{}).length)status('断面図：'+Object.values(data.sectionErrors).join(' / ')+'（位置を直すか、この断面図を削除してください）');for(const g of $('drawing-preview').querySelectorAll('[data-section],[data-marker]')){const path=g.querySelector('path');if(!path)continue;const hit=path.cloneNode();hit.setAttribute('stroke','transparent');hit.setAttribute('stroke-width','3');hit.removeAttribute('stroke-dasharray');g.prepend(hit);}if(commit)persist();
 }catch(error){
  sheet=null;inlineScales.sync(null,{});viewportHost.replaceChildren();
  $('drawing-svg').disabled=$('drawing-pdf').disabled=$('drawing-pdf-preview-open').disabled=true;
  overflowList.hidden=reviewList.hidden=conflictList.hidden=true;status(error.message);
 }}
 async function generate({refresh=false,targetsChanged=false,recordEdit=false}={}){
  busy=true;const token=++revision;worker.reset();data=null;sheet=null;overviewSheet=null;picking=null;action=null;selection=null;
  $('drawing-preview').replaceChildren();overflowList.hidden=reviewList.hidden=conflictList.hidden=true;$('drawing-svg').disabled=$('drawing-pdf').disabled=true;controls();
  targets=($('drawing-target').value==='selected'?selected:visible).slice();
  if(!targets.length){busy=false;controls();status('対象ボディがありません。閉じてボディを選択してください');return;}
  $('drawing-generate').disabled=true;status('輪郭と隠れ線を計算しています…');
  try{
   const views=requestedViews(options());
   if(refresh&&!targetsChanged){
    for(const {view} of dimensions)if((view==='iso'||drawingProjectionNames.includes(view))&&!views.includes(view))views.push(view);
   }
   if(refresh)for(const item of dimensionPoints){
    const view=holeSourceView(item.view);
    if(item.holeRef&&drawingProjectionNames.includes(view)&&!views.includes(view))views.push(view);
   }
   const result=await worker.request({features,spec:{type:'orthographic',targets,sections,views,frontFrame,silhouettes:!!drawingBackgroundColor(backgrounds)}},300000);
   if(token!==revision)return;
   data=result;
   if(holeTable&&!holeTable.originReview){
    const geometry=data.views[holeTable.view];
    holeTable=reconcileHoleTable(holeTable,tableCandidates(holeTable.view),geometry?.viewBox,{targetsChanged});
   }
   leaders=reconcileDrawingThreadLeaders(leaders,data.views);
   if(refresh){
    if(targetsChanged){
     markers=markers.filter(item=>item.review);
     leaders=leaders.filter(item=>item.review||item.threadRef);
     dimensionPoints=dimensionPoints.filter(item=>item.review||item.holeRef);
    }
    dimensionPoints=reconcileDrawingHolePoints(dimensionPoints,followHoleCenter);
    dimensions=reconcileDrawingDimensions(withDetails(data,details),dimensions,dimensionReferences,{targetsChanged,resolveHoleCenter:followHoleCenter});
   }
   dimensions=restoreAdjustedThreadDimensions(withDetails(data,details).views,dimensions);
   const scale=Number($('drawing-scale').value),settings=options();
   const overall=reconcileAutomaticOverallDimensions(data,dimensions,view=>drawingViewScale(view,scale,settings));
   dimensions=overall.dimensions;
   if(refresh){
    const needsReview=dimensions.filter(d=>d.review).length;
    const wasReplaying=replaying;replaying=wasReplaying||!recordEdit;
    try{render(true,{reflowDimensions:overall.rebuilt>0});}finally{replaying=wasReplaying;}
    if(sheet&&!overflow)status('図面を更新しました。引き継いだ寸法 '+(dimensions.length-needsReview)+' 件'+(needsReview?' ／ 要確認 '+needsReview+' 件':''));
   }else if(saved||!applyAutomaticLayout()){
    render(true,{reflowDimensions:overall.rebuilt>0});
    if(sheet&&!overflow&&(overall.removed||overall.rebuilt))status('現在の形状に合わせて自動外形寸法を整理しました。更新 '+overall.rebuilt+' 件 ／ 古い重複 '+overall.removed+' 件');
   }
   const failures=Object.values(result.sectionErrors||{}).filter(Boolean);
   if(failures.length)status('断面図：'+failures.join(' / '));
   return !!sheet;
  }catch(e){if(token===revision)status(e.message);}
  finally{if(token===revision){worker.reset();$('drawing-generate').disabled=false;busy=false;controls();}}
 }
 async function changeFrontFrame(next){
  if(!data||busy||drag||sameDrawingFront(frontFrame,next))return;
  persist();
  const previous=saved,oldData=data;
  const state={dimensions,dimensionPoints,sections,details,leaders,markers,holeTable,viewSelection};
  const plan=planDrawingFrontChange(frontFrame,next,state);
  const nextTable=holeTable&&!holeTable.originReview?{...holeTable,view:plan.moves.get(holeTable.view)?.view??holeTable.view}:holeTable;
  const views=requestedViews({...options(),viewSelection:plan.viewSelection,details:plan.details,holeTable:nextTable});
  if(dimensions.some(d=>d.view==='iso'&&!d.review)&&!views.includes('iso'))views.push('iso');
  const token=++revision;
  busy=true;controls();
  $('drawing-generate').disabled=$('drawing-svg').disabled=$('drawing-pdf').disabled=true;
  status('正面を変更し、寸法と注記の参照先を確認しています…');
  try{
   const result=await worker.request({features,spec:{type:'orthographic',targets,views,sections:plan.sections,
    frontFrame:next,silhouettes:!!drawingBackgroundColor(backgrounds)}},300000);
   if(token!==revision||!dialog.open)return;
   ({dimensions,dimensionPoints,sections,details,markers,leaders,holeTable}=followDrawingFrontChange(state,plan,result,
    view=>drawingHoleCandidates(result.views[view],view,features,targets,next)));
   leaders=reconcileDrawingThreadLeaders(leaders,result.views);
   frontFrame=next;data={...result,sectionErrors:{}};dimensionReferences={};
   const remap=settings=>remapDrawingViewSettings(settings,plan.moves);
   hiddenViews=remap(hiddenViews);viewScales=remap(viewScales);positions=remap(positions);
   pdfPositions=remap(pdfPositions);pdfViewScales=remap(pdfViewScales);
   pageAssignments={...pageAssignments,views:remap(pageAssignments.views)};
   setViewSelection(plan.viewSelection);
   picking=null;action=null;selection=null;inspectedHole=null;selectedPlacements.clear();
   busy=false;
   if(!applyAutomaticLayout()){positions={};layoutKind='projection';render();}
   if(!sheet)throw Error($('drawing-status').textContent);
   const pending=referenceReviewItems().length;
   if(!overflow)status('正面方向を変更しました'+(pending?'。参照先を要確認 '+pending+' 件':''));
  }catch(error){
   if(token!==revision||!dialog.open)return;
   busy=false;
   data=oldData;restore(previous);render(false);
   status(error.message||'向きを変更できませんでした');
  }finally{
   if(token===revision){worker.reset();busy=false;$('drawing-generate').disabled=false;controls();}
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
 $('drawing-hole-start').onclick=()=>{
  if(!holeTable){beginAction('holes');return;}
  if(holeTable.originReview){focusReferenceReview({kind:'holeTable'});return;}
  const {view,origin}=holeTable,layout=sheet?.layout[view];
  if(!layout||busy||!holeCapacity())return;
  const candidates=unlistedDrawingHoles(holeTable,tableCandidates(view)).filter(hole=>drawingDimensionVisible(hole,layout));
  if(!candidates.length){status('この図に追加できる穴はありません');return;}
  picking=null;selection=null;
  action={kind:'holes',append:true,view,origin,candidates,selected:new Set()};
  updateHoleSelection();
 };
 $('drawing-hole-all').onclick=()=>{
  if(action?.kind!=='holes'||!action.candidates||action.candidates.length>holeCapacity())return;
  action.selected=new Set(action.candidates.keys());updateHoleSelection();
 };
 $('drawing-hole-add').onclick=()=>{
  if(action?.kind!=='holes'||!action.selected?.size||action.selected.size>holeCapacity())return;
  const previous=action.append?holeTable:undefined;
  let number=lastHoleNumber(previous);
  const added=action.candidates.filter((_,i)=>action.selected.has(i)).map(hole=>({number:++number,...holeAnchor(hole)}));
  inspectedHole=null;
  holeTable={view:action.view,origin:action.origin,holes:[...(previous?.holes??[]),...added],lastNumber:number,
   references:holeReferenceInventory(tableCandidates(action.view))};
  action=null;
  if(previous||!applyAutomaticLayout())render();
 };
 $('drawing-hole-delete').onclick=()=>{
  if(!holeTable||busy)return;
  holeTable=undefined;delete positions.holeTable;render();
 };
 $('drawing-hole-relink').onclick=()=>{
  if(!holeTable||holeTable.originReview||busy||action)return;
  const index=Number($('drawing-hole-row').value),view=holeTable.view,layout=sheet?.layout[view];
  if(!holeTable.holes[index]?.review||!layout)return;
  const candidates=tableCandidates(view).filter(h=>drawingDimensionVisible(h,layout));
  if(!candidates.length){status('この図に再指定できる穴がありません');return;}
  picking=null;selection=null;action={kind:'holes',view,origin:holeTable.origin,candidates,selected:new Set(),rowIndex:index};
  render(false);status(viewLabel(view)+' で H'+holeTable.holes[index].number+' の円をクリックしてください');
 };
 $('drawing-hole-remove-row').onclick=()=>{
  const index=Number($('drawing-hole-row').value);
  if(!holeTable?.holes[index]?.review||busy||action)return;
  holeTable.lastNumber=lastHoleNumber(holeTable);
  holeTable.holes.splice(index,1);
  if(!holeTable.holes.length){holeTable=undefined;delete positions.holeTable;}
  render();
 };
 function dimensionsWithFont(size){
  return dimensions.map(d=>{
   const {fontSize,...updated}=d;
   return size===standardDimensionFont?updated:{...updated,fontSize:size};
  });
 }
 function renderResizedDimensions(){
  const adjusted=reflowResizedDrawingDimensions(dimensions,sheet);
  dimensions=adjusted.dimensions;
  render();
  if(adjusted.moved&&sheet&&!overflow)status($('drawing-status').textContent+' · 自動寸法 '+adjusted.moved+' 件の位置を調整しました');
 }
 $('drawing-dimension-font').onchange=()=>{
  const value=$('drawing-dimension-font').valueAsNumber;
  if(!sheet||busy||!Number.isFinite(value)||value<1.5||value>10){$('drawing-dimension-font').value=dimensionFontSize;return;}
  dimensionFontSize=value;
  dimensions=dimensionsWithFont(value);
  picking=null;action=null;renderResizedDimensions();
 };
 $('drawing-comment').oninput=()=>{
  const note=comments.find(item=>item.id===activeComment);
  if(note)note.text=$('drawing-comment').value;else mainComment=$('drawing-comment').value;
  picking=null;render(false);
 };
 $('drawing-comment').onchange=()=>persist();
 const cancelPick=()=>{if(selection?.type==='dimensionPoint')selection=null;picking=null;action=null;render();controls();};
 function syncDrawingMaterials(){
  const preset=$('drawing-material-preset'),value=$('drawing-material').value;
  const key=drawingMaterialKey(value),custom=materialRows.find(item=>drawingMaterialKey(item)===key);
  preset.value=[...preset.options].find(option=>drawingMaterialKey(option.value)===key)?.value??'';
  preset.disabled=busy;
  $('drawing-material-save').disabled=busy||materialLoadError||!!custom||!canSaveDrawingMaterial(value);
  $('drawing-material-remove').hidden=!custom;
  $('drawing-material-remove').disabled=busy||materialLoadError;
 }
 function updateDrawingMaterialOptions(){
  const group=$('drawing-material-saved');
  group.replaceChildren(...materialRows.map(item=>new Option(item,item)));
  group.hidden=!materialRows.length;
  syncDrawingMaterials();
 }
 function reloadDrawingMaterials(){
  const status=$('drawing-material-status');
  try{materialRows=materialStore.load();materialLoadError=false;status.textContent='';}
  catch(error){materialRows=[];materialLoadError=true;status.textContent=error.message;}
  updateDrawingMaterialOptions();
 }
 function writeDrawingMaterial(remove){
  const button=$(remove?'drawing-material-remove':'drawing-material-save');
  if(button.disabled)return;
  const value=$('drawing-material').value,status=$('drawing-material-status');
  try{
   materialRows=remove?materialStore.remove(value):materialStore.save(value);
   updateDrawingMaterialOptions();
   status.textContent=remove?'候補から削除しました':'「'+value.trim()+'」をこのブラウザーに登録しました';
  }catch(error){status.textContent=error.message||'材質の候補を保存できませんでした';}
 }
 $('drawing-material-save').onclick=()=>writeDrawingMaterial(false);
 $('drawing-material-remove').onclick=()=>writeDrawingMaterial(true);
 $('drawing-material-preset').onchange=()=>{
  const material=$('drawing-material-preset').value;
  if(!material||busy)return;
  $('drawing-material').value=material;
  $('drawing-material-status').textContent='';
  picking=null;render();
 };
 $('drawing-generate').onclick=()=>generate();
 $('drawing-target').onchange=async()=>{
  const input=$('drawing-target'),nextTargets=input.value==='selected'?selected:visible;
  if(!nextTargets.length||busy){
   input.value=saved?.targetMode??'visible';
   if(!nextTargets.length)status('ボディが選択されていないため、現在の図面を維持しました');
   return;
  }
  if(!data||!saved){await generate();return;}
  if(sameTargets(targets,nextTargets)){persist();return;}
  const previous=saved,previousData=data;
  action=null;inspectedHole=null;
  const pending=generate({refresh:true,targetsChanged:true,recordEdit:true}),token=revision;
  if(!await pending&&token===revision&&dialog.open){
   const message=$('drawing-status').textContent;
   restore(previous);saved=previous;data=previousData;targets=previous.targets.slice();
   input.value=previous.targetMode;render(false);status(message);
  }
 };
 $('drawing-close').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{viewport.cancel();clearTransient();persist();revision++;busy=false;worker.reset();$('drawing-generate').disabled=false;});
 $('drawing-scale').onchange=()=>changeCommonScale(Number($('drawing-scale').value));
 $('drawing-layout-label').onchange=()=>render();
 for(const id of ['drawing-hidden','drawing-paper-size','drawing-orientation','drawing-frame','drawing-date'])$(id).onchange=()=>{if(layoutKind==='compact'&&['drawing-paper-size','drawing-orientation','drawing-frame'].includes(id))applyAutomaticLayout();else cancelPick();};for(const id of ['drawing-name','drawing-revision','drawing-material']){$(id).oninput=()=>{picking=null;render(false);};$(id).onchange=()=>persist();}
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
  dimensions=rescaleDrawingAnnotations(dimensions,drawingViewFrames(data,options(),scale),scale,scale,drawingViewFrames(data,previous,scale));
  if(!applyAutomaticLayout()){dimensions=previousDimensions;$('drawing-view-priority').value=previous.viewPriority;}
 };
 $('drawing-layout-mode').onchange=cancelPick;$('drawing-auto-layout').onclick=()=>{if(!busy)applyAutomaticLayout();};$('drawing-arrange').onclick=()=>{layoutKind='projection';projectionLocked=!linkedProjections;positions={};cancelPick();};$('drawing-fit').onclick=()=>{layoutKind='projection';projectionLocked=!linkedProjections;positions={};picking=null;for(const scale of scales){setScale(scale);render(false);if(sheet&&!overflow)break;}persist();};
 $('drawing-svg').onclick=async()=>{
  if(!sheet||overflow||Object.keys(data.sectionErrors||{}).length)return;
  const pending=referenceReviewItems().filter(entry=>entry.kind==='dimension'?dimensions[entry.index].unplaced:entry.kind!=='hole');
  if(pending.length&&!window.confirm('参照先を要確認の項目が '+pending.length+' 件あります。現在の図面をSVGで保存しますか？'))return;
  const snapshot=sheet;
  const fonts=[...new Set(snapshot.notes.map(note=>note.font))];
  if(!fonts.some(Boolean)){download(snapshot.svg,snapshot.fileStem+'.svg','image/svg+xml');return;}
  $('drawing-svg').disabled=true;
  try{
   await Promise.all(fonts.map(loadDrawingCommentFont));
   const svg=new DOMParser().parseFromString(snapshot.svg,'image/svg+xml').documentElement;
   prepareDrawingComment(svg);
   download(new XMLSerializer().serializeToString(svg),snapshot.fileStem+'.svg','image/svg+xml');
  }catch(error){status('SVG保存に失敗しました：'+error.message);}
  finally{$('drawing-svg').disabled=busy||!sheet||overflow||Object.keys(data?.sectionErrors||{}).length>0;}
 };
 function blockPDFPreview(){
  return !sheet||busy||pdfExporting||Object.keys(data?.sectionErrors||{}).length>0;
 }
 function blockPDFExport(){
  return blockPDFPreview()||(!pdfLayout&&overflow);
 }
 function preparePDF(pages=makePDFPages()){
  const issues=drawingPDFIssues(pages,{checkBounds:true,labelView:pdfViewLabel});
  for(const review of referenceReviewItems()){
   if(review.kind==='dimension'&&!dimensions[review.index].unplaced)continue;
   if(review.kind==='hole'&&issues.some(issue=>issue.hole==='H'+(holeTable.holes[review.index].number??review.index+1)))continue;
   const pageIndex=Math.max(0,pages.findIndex(page=>page.layout[review.view]));
   issues.push({kind:'reference',pageIndex,label:review.label+'（参照先を要確認）',review});
  }
  return {pages,issues};
 }
 function movePDFPageItem(item,index,pages){
  const assignment=pdfLayout==='manual'?currentPageAssignments():drawingPDFPageAssignments(pages);
  assignDrawingPDFPageItem(assignment,item,index+1);
  const next=preparePDF(makePDFPages({...options(),pdfLayout:'manual',pageAssignments:assignment}));
  pdfLayout='manual';pageAssignments=assignment;
  render(false);persist();
  return {...next,notice:(index+1)+' ページへ移動しました'};
 }
 function changePDFPageOrder(kind,from,to,pages){
  if(!sheet||busy||drag)throw Error('図面の処理が終わってからページを編集してください。');
  const order=pages.map((_,index)=>index);
  let index=from,notice;
  if(kind==='add'){
   if(order.length>=maxDrawingPDFPages)throw Error('ページは '+maxDrawingPDFPages+' 枚までです。');
   index=order.length;order.push(null);notice=(index+1)+' ページ目を追加しました';
  }else if(kind==='remove'){
   if(order.length<2||drawingPDFPageItems(pages[from]).length)throw Error('空白ページを選択してください。');
   order.splice(from,1);index=Math.min(from,order.length-1);notice=(from+1)+' ページ目を削除しました';
  }else{
   order.splice(from,1);order.splice(to,0,from);index=to;
   notice=(from+1)+' ページ目を '+(to+1)+' ページ目へ移動しました';
  }
  const savedAssignments=pdfLayout==='manual'?currentPageAssignments():undefined;
  const fromSingle=!pdfLayout,placement=fromSingle?'keep':pdfPlacement;
  const {assignments,scales}=remapDrawingPDFPages(pages,order,savedAssignments,fromSingle?{}:pdfPageScales);
  // A new page layout starts with the single page as currently shown.
  const sourceDimensions=fromSingle?dimensions.map(({pdfPlacement,...dimension})=>dimension):dimensions;
  const sourceDetails=fromSingle?details.map(withoutDetailPDFPlacements):details;
  const next=preparePDF(makePDFPages({...options(),pdfLayout:'manual',pdfPlacement:placement,details:sourceDetails,
   pageAssignments:assignments,pdfPageScales:scales,...(fromSingle?{pdfPositions:{},pdfViewScales:{}}:{})},
   overviewSheet,sourceDimensions));
  if(fromSingle){pdfPositions={};pdfViewScales={};dimensions=sourceDimensions;details=sourceDetails;}
  pdfLayout='manual';pdfPlacement=placement;pageAssignments=assignments;pdfPageScales=scales;
  if(editingPage>=0){
   const remapped=order.indexOf(editingPage);
   editingPage=remapped<0?index:remapped;
   if(remapped<0){picking=null;action=null;selection=null;inspectedHole=null;selectedPlacements.clear();}
  }
  inlineScales.close();
  render(false);persist();
  return {...next,index,notice};
 }
 function fitPDFPreviewPage(index,pages){
  const scale=Number($('drawing-scale').value),settings=options(),page=pages[index];
  const fit=fitDrawingPDFPage(data,page,{scale,dimensions,options:settings});
  const failure='縮尺を保ったまま収まりません。縮尺を小さくするか用紙を大きくしてください。';
  if(!fit)throw Error(failure);

  const nextPositions={...(pdfLayout?pdfPositions:positions),...fit.positions};
  const nextScales=pdfPlacement==='auto'?{...pdfPageScales,[index+1]:page.pageScale}:pdfPageScales;
  let next;
  if(pdfLayout){
   next=preparePDF(makePDFPages({...settings,pdfPositions:nextPositions,pdfPageScales:nextScales}));
   if(next.pages.length!==pages.length||next.pages.some((p,i)=>i!==index&&p.svg!==pages[i].svg)){
    throw Error('ほかのページの配置に影響します。このページを開いて位置を調整してください。');
   }
  }else{
   next=preparePDF([drawingSheet(data,scale,$('drawing-hidden').checked,dimensions,mainComment,
    {...settings,layout:'compact',positions:nextPositions})]);
  }
  if(next.issues.some(issue=>issue.pageIndex===index&&issue.kind==='layout'))throw Error(failure);
  if(pdfLayout){pdfPositions=nextPositions;pdfPageScales=nextScales;}
  else {positions=nextPositions;layoutKind='compact';}
  render(false);persist();
  return {...next,notice:(index+1)+' ページを同じ縮尺で配置し直しました'};
 }
 function focusPDFIssue(issue){
  if(!sheet||busy)return;
  if(issue.review){focusReferenceReview(issue.review);return;}
  if(editPageCount>1&&Number.isInteger(issue.pageIndex))editPDFPage(issue.pageIndex);
  if(issue.kind==='view-overlap')focusDrawingViewOverlap(issue);
  else if(issue.dimension!==undefined){
   const d=onSheetDimensions()[issue.dimension],placement=d&&dimensionPlacement(d,sheet);
   if(!placement)return;
   workspace.reveal($('drawing-editor'));
   focusDrawingConflict(issue.dimension,placement.box);
   status(issue.label);
  }else if(issue.hole){
   const row=viewportHost.querySelector('[data-hole-row="'+issue.hole+'"]');
   if(!row){status('穴位置表のあるビューを表示して参照先を選び直してください');return;}
   workspace.reveal($('drawing-hole-row'));
   inspectHole(row);viewport.focus(sheet.holeBox);
  }
 }
 async function drawingPDFData(pages,palette){
  await Promise.all([...new Set(pages.flatMap(page=>(page.notes??[page.note]).filter(Boolean).map(note=>note.font)))].map(loadDrawingCommentFont));
  const {jsPDF}=await import('jspdf');await import('svg2pdf.js');
  const orientation=page=>page.width>=page.height?'landscape':'portrait';
  const first=pages[0],pdf=new jsPDF({orientation:orientation(first),unit:'mm',format:[first.width,first.height]});
  for(const [index,page] of pages.entries()){
   if(index)pdf.addPage([page.width,page.height],orientation(page));
   const svg=new DOMParser().parseFromString(drawingPrintSVG(page.svg,palette),'image/svg+xml').documentElement;
   prepareJapanesePDF(svg);
   await pdf.svg(svg,{x:0,y:0,width:page.width,height:page.height});
  }
  return pdf.output('arraybuffer');
 }
 async function exportDrawingPDF(pages,palette){
  download(await drawingPDFData(pages,palette),pages[0].fileStem+'.pdf','application/pdf');
 }
 function drawingPDFRows(pages){
  return pages.map((page,index)=>{
   const dimensionCount=page.dimensions.filter(d=>page.layout[d.view]&&drawingDimensionVisible(d,page.layout[d.view])).length;
   const items=[...Object.keys(page.layout).map(viewLabel),
    ...(dimensionCount?['寸法 '+dimensionCount+' 件']:[]),
    ...((page.leaderLabels?.length??0)?['注記 '+page.leaderLabels.length+' 件']:[]),
    ...(page.notes.length?['コメント '+page.notes.length+' 件']:[]),...(page.holeBox?['穴位置表']:[])];
   return {label:(index+1)+' ページ',detail:items.join('、')||'空白ページ'};
  });
 }
 function reviewPrintSet(){
  if(!exportPrintSet||!canExportPrintSet()||blockPDFPreview())return;
  try{
   const {pages,issues}=preparePDF(),palette=printPalette,documentFeatures=getFeatures();
   const snapshot=saved,projection=data;
   exportPrintSet({targets:targets.slice(),rows:drawingPDFRows(pages),issues,
    name:$('drawing-name').value.trim(),isCurrent:()=>dialog.open&&saved===snapshot&&projection===data&&getFeatures()===documentFeatures&&!busy,
    createPDF:()=>drawingPDFData(pages,palette),openPDFReview:()=>pdfPreview.open(pages,palette,issues),status});
  }catch(error){status('出力セットを準備できませんでした。'+error.message);}
 }
 $('drawing-print-set').onclick=reviewPrintSet;
 $('drawing-pdf-preview-open').onclick=async()=>{
  if(blockPDFPreview())return;
  try{
   const {pages,issues}=preparePDF();
   await pdfPreview.open(pages,printPalette,issues);
  }
  catch(error){status('プレビューに失敗しました。'+error.message);}
 };
 async function savePreparedPDF(pages,issues){
  if(blockPDFExport())return;
  pdfExporting=true;$('drawing-pdf').disabled=true;
  try{
   if(issues.length)await pdfPreview.open(pages,printPalette,issues);
   else await exportDrawingPDF(pages,printPalette);
  }
  catch(error){status('PDF保存に失敗しました：'+error.message);}
  finally{pdfExporting=false;$('drawing-pdf').disabled=blockPDFExport();}
 }
 $('drawing-pdf').onclick=()=>{
  if(blockPDFExport())return;
  try{
   const {pages,issues}=preparePDF();
   const run=()=>savePreparedPDF(pages,issues);
   const rows=drawingPDFRows(pages);
   if(exportPDF)exportPDF({label:'全 '+pages.length+' ページ',rows,
    detail:issues.length?'出力前チェックで '+issues.length+' 件を確認できます。':'',
    action:issues.length?'出力前チェックを開く':'PDFを保存する',run});
   else run();
  }catch(error){status('PDF保存に失敗しました。'+error.message);}
 };

 function clearViewAnnotations(id){leaders=leaders.filter(note=>note.view!==id);dimensions=dimensions.filter(d=>d.view!==id);dimensionPoints=dimensionPoints.filter(point=>point.view!==id);markers=markers.filter(m=>m.view!==id);for(const d of details.filter(d=>d.view===id)){clearViewAnnotations(d.id);delete positions[d.id];delete viewScales[d.id];}details=details.filter(d=>d.view!==id);pruneHiddenViews();}
 function extraControls(){
  const list=[...sections.map((s,i)=>({id:s.id,label:'断面 '+String.fromCharCode(65+i)+'–'+String.fromCharCode(65+i)+(s.review?'（要確認）':'')})),
   ...details.map((d,i)=>({id:d.id,label:'詳細 D'+(i+1)+(d.review?'（要確認）':'')}))];
  if(!list.some(e=>e.id===extraTarget))extraTarget=list[0]?.id||'';
  $('drawing-extra-editor').hidden=!list.length;
  $('drawing-extra-target').replaceChildren(...list.map(item=>new Option(item.label,item.id)));
  $('drawing-extra-target').value=extraTarget;
  const section=sections.find(s=>s.id===extraTarget),detail=details.find(d=>d.id===extraTarget);
  const sectionPosition=$('drawing-section-position'),detailFactor=$('drawing-detail-factor-edit');
  $('drawing-section-reverse').hidden=$('drawing-section-position-label').hidden=!section;
  $('drawing-detail-factor-label').hidden=!detail;
  if(section&&document.activeElement!==sectionPosition)sectionPosition.value=Number(section.coordinate.toFixed(4));
  if(detail&&document.activeElement!==detailFactor)detailFactor.value=detail.factor;
  const pending=!!(section??detail)?.review;
  $('drawing-extra-relink').hidden=!pending;
  $('drawing-extra-relink').disabled=busy;
  $('drawing-extra-delete').disabled=busy;
  $('drawing-section-reverse').disabled=sectionPosition.disabled=detailFactor.disabled=busy||pending;
 }
 $('drawing-extra-target').onchange=()=>{extraTarget=$('drawing-extra-target').value;extraControls();};
 $('drawing-extra-relink').onclick=()=>{
  const section=sections.find(s=>s.id===extraTarget&&s.review);
  const detail=details.find(d=>d.id===extraTarget&&d.review);
  if(section||detail)beginReviewAction(section?'section':'detail',section??detail);
 };
 $('drawing-extra-delete').onclick=()=>{if(busy)return;clearViewAnnotations(extraTarget);sections=sections.filter(s=>s.id!==extraTarget);details=details.filter(d=>d.id!==extraTarget);pruneHiddenViews();delete positions[extraTarget];delete viewScales[extraTarget];if(data.views[extraTarget])delete data.views[extraTarget];if(data.sectionErrors)delete data.sectionErrors[extraTarget];cancelPick();};
 async function editSection(section,changes){
  if(!data||busy||!section)return;
  const oldData=data,next={...section,...changes};
  if(!section.review&&next.coordinate===section.coordinate&&next.reverse===section.reverse)return;
  const token=++revision;
  busy=true;picking=null;action=null;selection=null;controls();
  $('drawing-svg').disabled=$('drawing-generate').disabled=true;
  status('断面と寸法の参照先を更新しています…');
  try{
   const result=await worker.request({features,spec:{type:'orthographic',targets,views:[],sections:[next],frontFrame,
    silhouettes:!!drawingBackgroundColor(backgrounds)}},300000);
   if(token!==revision||!dialog.open)return;
   if(!result.views[next.id])throw Error(result.sectionErrors?.[next.id]||'断面を計算できません');
   const updated={...oldData,views:{...oldData.views,[next.id]:result.views[next.id]},sectionErrors:{...oldData.sectionErrors}};
   delete updated.sectionErrors[next.id];
   if(!section.review){
    ({dimensions,details,markers,leaders,dimensionPoints}=followSectionEdit(oldData,updated,section,next,{dimensions,details,markers,leaders,dimensionPoints}));
   }
   sections=sections.map(item=>item.id===section.id?next:item);data=updated;render();
  }catch(error){
   if(token!==revision||!dialog.open)return;
   $('drawing-section-position').value=section.coordinate;
   render(false);status('断面を変更できません。'+error.message);
  }finally{
   if(token===revision){worker.reset();busy=false;$('drawing-generate').disabled=false;controls();}
  }
 }
 $('drawing-section-reverse').onclick=()=>{
  const section=sections.find(s=>s.id===extraTarget);
  if(section)editSection(section,{reverse:!section.reverse});
 };
 $('drawing-section-position').onchange=()=>{
  const section=sections.find(s=>s.id===extraTarget),input=$('drawing-section-position'),value=input.valueAsNumber;
  if(!section)return;
  if(!Number.isFinite(value)||Math.abs(value)>1e6){input.value=section.coordinate;return;}
  editSection(section,{coordinate:value});
 };
 const detailFactorError='詳細図の倍率は 1 ～ '+maxDrawingScale+' 倍の数値で指定してください';
 $('drawing-detail-factor-edit').addEventListener('keydown',event=>{
  if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur();}
 });
 $('drawing-detail-factor-edit').onchange=()=>{
  const detail=details.find(d=>d.id===extraTarget),input=$('drawing-detail-factor-edit');
  if(busy||drag||!sheet||!detail)return;
  const factor=input.valueAsNumber;
  if(!validDrawingDetailFactor(factor)){input.value=detail.factor;status(detailFactorError);return;}
  const id=detail.id;
  if(factor===detail.factor&&viewScales[id]===undefined&&pdfViewScales[id]===undefined)return;
  const before={details,dimensions,viewScales:{...viewScales},pdfViewScales:{...pdfViewScales}};
  const scale=Number($('drawing-scale').value),previousFrames=drawingViewFrames(data,options(),scale);
  details=details.map(item=>item.id===id?{...item,factor}:item);
  delete viewScales[id];delete pdfViewScales[id];
  const frames=drawingViewFrames(data,options(),scale);
  dimensions=dimensions.map(d=>d.view===id?rescaleDrawingAnnotations([d],frames,scale,scale,previousFrames)[0]:d);
  render();
  if(!sheet){
   const error=$('drawing-status').textContent;
   ({details,dimensions,viewScales,pdfViewScales}=before);
   input.value=detail.factor;
   render(false);status(error);
  }
 };
 const beginAction=(kind,parameters={})=>{if(!data||busy)return;picking=null;selection=null;action={kind,...parameters};render();status({
  center:'円・円弧をクリックすると中心マークを追加します',line:'中心線を通す点を２点選択してください',
  section:'正投影図に切断線を置いてください。円の中心・端点に吸着します',
  detail:'拡大したい部分の中心をクリックし、次に範囲の半径を指定してください',
  holes:'正投影図で穴位置表の基準点をクリックしてください。右が＋X、上が＋Yです',
  leader:parameters.thread?'ねじを設定した穴の円または中心をクリックしてください':'図の中で矢印が指す箇所をクリックしてください',
  dimensionPoint:'図をクリックして寸法点を追加します。紫の十字は穴・ねじ穴・長穴の中心です。Altを押すと吸着を解除できます'
 }[kind]);};
 function beginReviewAction(kind,item){
  if(!item.review||busy)return;
  if(editingPage>=0)editPDFPage(-1);
  if(!names().length){status('参照先を選べる図を表示してください');return;}
  if(kind==='section')$('drawing-section-orientation').value=item.orientation;
  if(kind==='leader')$('drawing-leader-input').value=item.text;
  beginAction(kind,{replace:item,...(kind==='leader'&&item.threadRef?{thread:true}:{})});
  viewportHost.scrollIntoView({block:'nearest'});
 }
 function placeAnnotation(items,prefix,fields){
  const previous=action?.replace;
  if(!previous)return [...items,{id:prefix+'-'+crypto.randomUUID(),...fields}];
  const replacement={id:previous.id,...fields};
  return items.map(item=>item.id===previous.id?replacement:item);
 }
 $('drawing-center-add').onclick=()=>beginAction('center');$('drawing-center-line').onclick=()=>beginAction('line');$('drawing-section-add').onclick=()=>beginAction('section');
 $('drawing-detail-add').onclick=()=>{
  const input=$('drawing-detail-factor');
  if(!validDrawingDetailFactor(input.valueAsNumber)){status(detailFactorError);input.focus();return;}
  beginAction('detail');
 };
 $('drawing-dimension-point-add').onclick=()=>action?.kind==='dimensionPoint'?cancelPick():beginAction('dimensionPoint');
 $('drawing-centers-all').onclick=()=>{for(const view of names()){for(const c of circles(viewData(view))){if(!insideView(viewData(view),c.center)||markers.some(m=>!m.review&&m.kind==='center'&&m.view===view&&Math.hypot(m.center[0]-c.center[0],m.center[1]-c.center[1])<1e-5))continue;if(markers.length>=200)break;markers.push({id:'marker-'+crypto.randomUUID(),kind:'center',view,center:c.center,radius:c.radius});}}cancelPick();};
 function hitView(e,onlyBase=false,includeDetails=false){const p=paperPoint(e),keys=onlyBase?drawingProjectionNames:names().filter(n=>includeDetails||!n.startsWith('detail-'));return keys.find(name=>{const v=sheet.layout[name];return v&&p[0]>=v.x-2&&p[0]<=v.x+v.width+2&&p[1]>=v.y-2&&p[1]<=v.y+v.height+2;});}
 function snapCut(view,axis,value,disable=false){if(disable)return value;let best=1.5/sheet.layout[view].scale,result=value;for(const p of viewPoints(viewData(view))){if(drawingPointOmitted(sheet.layout[view],p))continue;if(Math.abs(p[axis]-value)<best){best=Math.abs(p[axis]-value);result=p[axis];}}return result;}
 const showsHiddenLines=name=>hiddenViews[name]??$('drawing-hidden').checked;
 function manualPointAt(e){
  const matrix=viewportHost.querySelector('svg')?.getScreenCTM();
  if(!matrix)return null;
  const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
  const nearPaper=8/Math.hypot(matrix.a,matrix.b),snap=$('drawing-snap').checked&&!e.altKey;
  const available=names(),preferred=e.target.closest('[data-view]')?.dataset.view;
  const ordered=available.includes(preferred)?[preferred,...available.filter(name=>name!==preferred)]:available;
  for(const name of ordered){
   const v=sheet.layout[name],view=viewData(name),raw=local(name,[p.x,p.y]),radius=nearPaper/v.scale;
   if(!drawingDimensionPointFits(view,raw,snap?radius:0)||drawingPointOmitted(v,raw))continue;
   const hit=snap?snapDrawingDimensionPoint(view,raw,radius,{
    hidden:showsHiddenLines(name),accept:value=>!drawingPointOmitted(v,value),
    guide:action?.guide?.view===name?action.guide.point:undefined
   }):{point:raw,label:'自由点'};
   if(drawingDimensionPointFits(view,hit.point)&&hit.point.every(value=>Math.abs(value)<=1e6))return {name,...hit};
  }
  return null;
 }
 function placeDimensionPoint(e){
  const existing=e.target.closest('[data-dimension-point]');
  const hit=existing?null:manualPointAt(e);
  const selectedPoint=existing?dimensionPoints.find(item=>item.id===existing.dataset.dimensionPoint):
   hit&&dimensionPoints.find(item=>!item.review&&item.view===hit.name&&Math.hypot(item.point[0]-hit.point[0],item.point[1]-hit.point[1])<1e-5);
  if(action.replace){
   const point=selectedPoint?.point??hit?.point,view=selectedPoint?.view??hit?.name;
   if(!point)throw Error('寸法点を置く図の内側をクリックしてください');
   const holeRef=selectedPoint?.holeRef??referenceForCenter(view,hit);
   dimensionPoints=placeAnnotation(dimensionPoints,'dimension-point',{point,view,...(holeRef?{holeRef}:{})});
   cancelPick();return;
  }
  if(selectedPoint){
   action.guide=selectedPoint;selection={type:'dimensionPoint',id:selectedPoint.id};
   render(false);workspace.reveal($('drawing-editor'));
   status('選んだ点からガイドを表示しています。必要なら「選択項目を削除」で点を消せます');return;
  }
  if(!hit)throw Error('寸法点を置く図の内側をクリックしてください');
  if(dimensionPoints.length>=maxDrawingDimensionPoints)throw Error('寸法点は'+maxDrawingDimensionPoints+'個までです');
  const holeRef=referenceForCenter(hit.name,hit);
  const added={id:'dimension-point-'+crypto.randomUUID(),view:hit.name,point:hit.point,...(holeRef?{holeRef}:{})};
  dimensionPoints.push(added);action.guide=added;
  selection=null;render();
  status('縦横のガイドに沿って次の点を置けます。Altを押すと吸着を解除できます');
 }
 function actionClick(e){
  try{
   const state=action;
   if(state.kind==='dimensionPoint'){placeDimensionPoint(e);return;}
   if(state.kind==='leader'){clickLeader(e);return;}
   if(state.kind==='holes'){clickHoleTable(e);return;}
   if(state.kind==='center'){
    if(!state.replace&&markers.length>=200)throw Error('中心表示は200個までです');
    const hit=nearest(e,'arc');if(!hit)throw Error('円・円弧をクリックしてください');
    const duplicate=markers.some(m=>!m.review&&m.kind==='center'&&m.view===hit.name&&Math.hypot(m.center[0]-hit.arc.center[0],m.center[1]-hit.arc.center[1])<1e-5);
    if(duplicate&&state.replace)throw Error('すでに中心マークがあります。別の円を選んでください');
    if(!duplicate)markers=placeAnnotation(markers,'marker',{kind:'center',view:hit.name,center:hit.arc.center,radius:hit.arc.radius});
    cancelPick();return;
   }
   if(state.kind==='line'){
    if(!state.replace&&markers.length>=200)throw Error('中心表示は200個までです');
    const hit=nearest(e,'point');
    if(!hit)throw Error('輪郭の端点・円の中心・手動で置いた点をクリックしてください');
    if(!state.a){
     state.a=hit.point;state.view=hit.name;render();status('同じ図の２点目を選択してください');return;
    }
    if(hit.name!==state.view)throw Error('同じ図の点を選んでください');
    if(Math.hypot(hit.point[0]-state.a[0],hit.point[1]-state.a[1])<1e-6)throw Error('別の点を選んでください');
    markers=placeAnnotation(markers,'marker',{kind:'line',view:state.view,a:state.a,b:hit.point});
    cancelPick();return;
   }
   if(state.kind==='section'){
    if(!state.replace&&sections.length>=8)throw Error('断面図は８個までです');
    const view=hitView(e,true);if(!view)throw Error('正投影図の内側をクリックしてください');
    const p=local(view,paperPoint(e));if(drawingPointOmitted(sheet.layout[view],p))throw Error('省略範囲の外に切断線を置いてください');
    const orientation=$('drawing-section-orientation').value,axis=orientation==='vertical'?0:1;
    const next={view,orientation,coordinate:snapCut(view,axis,p[axis],e.altKey),reverse:state.replace?.reverse??false};
    if(state.replace){editSection(state.replace,{...next,review:undefined});return;}
    const id='section-'+crypto.randomUUID();
    sections.push({id,...next});extraTarget=id;action=null;generate();return;
   }
   if(state.kind==='detail'){
    if(!state.replace&&details.length>=8)throw Error('詳細図は８個までです');
    const factor=state.replace?.factor??$('drawing-detail-factor').valueAsNumber;
    if(!validDrawingDetailFactor(factor))throw Error(detailFactorError);
    if(!state.center){
     const view=hitView(e);
     if(!view)throw Error('拡大元の図の内側をクリックしてください');
     const center=local(view,paperPoint(e));
     if(drawingPointOmitted(sheet.layout[view],center))throw Error('省略範囲の外で中心を選んでください');
     state.center=center;state.view=view;
     status('範囲の外周をクリックしてください');return;
    }
    const p=local(state.view,paperPoint(e)),radius=Math.hypot(p[0]-state.center[0],p[1]-state.center[1]);
    if(radius*sheet.layout[state.view].scale<1)throw Error('範囲を少し大きくしてください');
    details=placeAnnotation(details,'detail',{view:state.view,center:state.center,radius,factor});
    extraTarget=state.replace?.id??details.at(-1).id;cancelPick();
   }
  }catch(error){status(error.message);}
 }
 function actionPreview(e){const svg=$('drawing-preview').querySelector('svg');svg.querySelector('[data-action-preview]')?.remove();if(!action)return;let attrs;
 if(action.kind==='dimensionPoint'){
  const existing=e.target.closest('[data-dimension-point]');
  if(existing){
   const name=existing.dataset.snapView,point=JSON.parse(existing.dataset.snapPoint);
   const center=drawingDimensionCenterGuides(viewData(name),showsHiddenLines(name)).find(guide=>sameDrawingCenter(point,guide.point));
   showDimensionSnapLabel(e,center?.label??'手動の寸法点');
   return;
  }
  const hit=manualPointAt(e),matrix=svg.getScreenCTM();
  showDimensionSnapLabel(e,hit?.label);
  if(hit&&matrix)drawPointMarker(svg,hit.name,hit.point,{
   r:5/Math.hypot(matrix.a,matrix.b),fill:'none',stroke:'#c46a15','stroke-width':1.5,
   'vector-effect':'non-scaling-stroke','pointer-events':'none','data-action-preview':'true'
  });
  return;
 }
 if(action.kind==='leader'&&action.anchor){const a=map(action.view,action.anchor),p=paperPoint(e);attrs={x1:a[0],y1:a[1],x2:p[0],y2:p[1]};}else if(action.kind==='detail'&&action.center){const c=map(action.view,action.center),p=paperPoint(e);attrs={cx:c[0],cy:c[1],r:Math.hypot(p[0]-c[0],p[1]-c[1])};}else if(action.kind==='section'){const name=hitView(e,true);if(!name)return;const v=sheet.layout[name],axis=$('drawing-section-orientation').value==='vertical'?0:1,p=local(name,paperPoint(e)),coord=snapCut(name,axis,p[axis],e.altKey),q=map(name,axis===0?[coord,v.by]:[v.bx,coord]);attrs=axis===0?{x1:q[0],x2:q[0],y1:v.y,y2:v.y+v.height}:{x1:v.x,x2:v.x+v.width,y1:q[1],y2:q[1]};}else return;const node=document.createElementNS('http://www.w3.org/2000/svg',attrs.r!==undefined?'circle':'line');for(const [key,val] of Object.entries({...attrs,'data-action-preview':'true',fill:'none',stroke:'#0095b6','stroke-width':.4,'stroke-dasharray':'2 1','pointer-events':'none'}))node.setAttribute(key,val);svg.append(node);}

 function map(name,p){return drawingPaperPoint(sheet.layout[name],p);}
 function local(name,p){return drawingModelPoint(sheet.layout[name],p);}
 function paperPoint(e){
  const inverse=drag?.inverse??viewportHost.querySelector('svg')?.getScreenCTM()?.inverse();
  if(!inverse)return null;
  const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(inverse);return [p.x,p.y];
 }
 function drawPointMarker(svg,name,p,attributes){
  const [cx,cy]=map(name,p),circle=document.createElementNS('http://www.w3.org/2000/svg','circle');
  for(const [key,value] of Object.entries({cx,cy,r:1,...attributes}))circle.setAttribute(key,value);
  svg.append(circle);
 }
 function drawDimensionCenterGuide(svg,name,point){
  const [x,y]=map(name,point),guide=document.createElementNS(svg.namespaceURI,'g');
  guide.setAttribute('transform','translate('+x+' '+y+')');
  guide.setAttribute('data-dimension-center-guide',name);
  guide.setAttribute('data-center-point',JSON.stringify(point));
  guide.setAttribute('pointer-events','none');
  guide.setAttribute('aria-hidden','true');
  const cross='M -5 0 H 5 M 0 -5 V 5';
  guide.innerHTML='<g fill="none" stroke-linecap="round">'+
   '<path d="'+cross+'" stroke="white" stroke-width="4" vector-effect="non-scaling-stroke"/>'+
   '<path d="'+cross+'" stroke="#7037a4" stroke-width="1.8" vector-effect="non-scaling-stroke"/></g>';
  svg.append(guide);
 }
 function drawDimensionPointGuides(svg,{view:name,point}){
  const v=sheet.layout[name],view=v&&viewData(name);
  if(!view||!drawingDimensionPointFits(view,point)||drawingPointOmitted(v,point))return;
  const at=map(name,point),center=view.clip&&map(name,view.clip.center);
  const low=[v.x,v.y],high=[v.x+v.width,v.y+v.height];
  for(const [axis,direction] of [[0,'vertical'],[1,'horizontal']]){
   const span=1-axis,a=[...at],b=[...at];
   a[span]=low[span];b[span]=high[span];
   if(center){
    const chord=Math.sqrt(Math.max(0,(view.clip.radius*v.scale)**2-(at[axis]-center[axis])**2));
    a[span]=center[span]-chord;b[span]=center[span]+chord;
   }
   const line=document.createElementNS('http://www.w3.org/2000/svg','line');
   for(const [key,value] of Object.entries({x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:'#117b99',
    'stroke-width':1.25,'stroke-dasharray':'4 4','vector-effect':'non-scaling-stroke',
    'pointer-events':'none','data-dimension-point-guide':direction}))line.setAttribute(key,value);
   svg.append(line);
  }
 }
 function markPoints(){
  const pointMode=action?.kind==='dimensionPoint';
  if(!pointMode&&action?.kind!=='line'&&(!picking||isCircularDimensionKind(picking.kind)||picking.kind==='angle'))return;
  const svg=viewportHost.querySelector('svg');
  if(pointMode&&action.guide)drawDimensionPointGuides(svg,action.guide);
  for(const name of picking?dimensionViews(picking.kind):names()){
   if(picking?.view&&picking.view!==name)continue;
   const view=viewData(name),v=sheet.layout[name];
   const centers=name!=='iso'&&(pointMode||picking)?
    drawingDimensionCenterGuides(view,showsHiddenLines(name)).filter(guide=>!drawingPointOmitted(v,guide.point)):[];
   const points=name==='iso'?view.dimensionVertices.map(vertex=>vertex.point):viewPoints(view);
   for(const p of points){
    if(drawingPointOmitted(v,p)||centers.some(center=>sameDrawingCenter(p,center.point)))continue;
    drawPointMarker(svg,name,p,{fill:name==='iso'&&picking?.a===p?'#c46a15':'#008caf','data-snap-view':name,'data-snap-point':JSON.stringify(p)});
   }
   for(const center of centers)drawDimensionCenterGuide(svg,name,center.point);
   for(const item of dimensionPoints){
    const {id,point}=item;
    if(item.review||item.view!==name||!drawingDimensionPointFits(view,point)||drawingPointOmitted(v,point))continue;
    drawPointMarker(svg,name,point,{
     fill:'#c46a15',stroke:'#fff','stroke-width':1,'vector-effect':'non-scaling-stroke',
     'data-snap-view':name,'data-snap-point':JSON.stringify(point),'data-dimension-point':id
    });
   }
  }
  if(picking?.endpoint&&sheet.layout[picking.view]){
   const point=dimensions[picking.replace]?.[picking.endpoint];
   if(point)drawPointMarker(svg,picking.view,point,{'data-dimension-picked':'true','pointer-events':'none'});
  }
  viewport.markers();
 }
 function syncDimensionHint(){
  if(busy||!picking||picking.ready)clearDimensionHover();
  const kind=picking?.kind??dimensionKindInput.value;
  const iso=!!sheet?.layout.iso,isoAvailable=dimensionViews('aligned').includes('iso');
  $('drawing-dimension-add').disabled=!sheet||busy||!dimensionViews(dimensionKindInput.value).length;
  let text=dimensionPickTargets[kind];
  if(!picking)text='「寸法線を追加」を押し、'+text;
  else if(picking.ready)text='寸法を置く位置をクリックします。';
  else if(picking.endpoint)text='オレンジの輪で示した端点の付け替え先を、同じ図でクリックします。';
  else if(picking.firstLine)text='同じ図で２本目の直線をクリックします。';
  else if(picking.a)text=picking.view==='iso'?'俯瞰図で２つ目の頂点をクリックします。':'同じ図で２点目の寸法点をクリックします。';
  if(picking&&!picking.ready&&isLinearDimensionKind(kind)&&picking.view!=='iso'&&names().length)
   text+=' 紫の十字から穴の中心を選べます。';
  if(!picking?.ready&&!picking?.view&&iso){
   if(kind!=='aligned')text+=' 俯瞰図の寸法は「２点間（直線距離）」で追加します。';
   else if(isoAvailable)text+=' 俯瞰図では頂点間の実寸を測れます。';
   else if(!names().length)text='俯瞰図に測れる頂点が２つ以上ある形状を表示してください。';
  }
  if(dimensionHint.textContent!==text)dimensionHint.textContent=text;
 }
 dimensionKindInput.onchange=()=>{
  if(picking&&picking.kind!==dimensionKindInput.value)cancelPick();
  else syncDimensionHint();
 };
 syncDimensionHint();
 function startDimension(kind,reference={}){
  if(!sheet||busy)return;
  const views=dimensionViews(kind);
  if(!views.length||reference.view&&!views.includes(reference.view)){
   status('寸法点を選べる図を表示してください');return;
  }
  action=null;selection=null;picking={kind,...reference};render();
  if(reference.endpoint){status(dimensionHint.textContent);return;}
  status(kind==='thread'?'ねじの外周をクリックし、M表記を置く位置をクリックしてください':
   isCircularDimensionKind(kind)?'円または円弧をクリックし、寸法を置く位置をクリックしてください':
   kind==='angle'?'同じ図の直線を２本選び、角度寸法を置く位置をクリックしてください':
   '同じ図の寸法点を２点選び、寸法線を置く位置をクリックしてください');
 }
 $('drawing-dimension-add').onclick=()=>startDimension(dimensionKindInput.value);
 $('drawing-dimension-cancel').onclick=cancelPick;
 dialog.addEventListener('cancel',event=>{
  if(inlineScales.close(true)){event.preventDefault();return;}
  if(drag){event.preventDefault();finishPaperDrag(false);}
  else if(picking||action){event.preventDefault();cancelPick();}
  else if(inspectedHole){event.preventDefault();inspectedHole=null;syncInspectedHole();}
 });
 $('drawing-dimension-undo').onclick=()=>{dimensions.pop();selection=null;cancelPick();};$('drawing-dimension-clear').onclick=()=>{dimensions=[];selection=null;cancelPick();};
 $('drawing-dimension-overall').onclick=()=>{if(!data||!sheet||busy)return;for(const d of overallDrawingDimensions(data,Number($('drawing-scale').value),sheet,{uniqueAxes:true}))if(dimensions.length<500&&!dimensions.some(e=>!e.review&&e.overall===d.overall))dimensions.push(applyDimensionFont(d));cancelPick();};
 function addedPageDimensions(added,scale){
  const pageScale=sheet.pageScale,settings=options();
  const viewScales=Object.fromEntries(Object.entries(sheet.layout).map(([id,view])=>[id,view.scale]));
  const currentFrames=drawingViewFrames(data,{...settings,pageViews:Object.keys(viewScales),viewScales},pageScale);
  const normalized=rescaleDrawingAnnotations(added,drawingViewFrames(data,settings,scale),pageScale,scale,currentFrames);
  return normalized.map((d,i)=>({...d,pdfPlacement:dimensionPosition(added[i])}));
 }
 function preserveActivePDFPlacement(){
  if(editingPage<0||pdfPlacement!=='auto')return;
  pdfPositions={...pdfPositions,...displayedPositions(sheet)};
  pdfPageScales={...pdfPageScales,[editingPage+1]:sheet.pageScale};
 }
 function syncOmittedHoles(){
  if(omittedHoleReport?.data!==data)omittedHoleReport=null;
  const report=omittedHoleReport;
  let visible=[];
  if(report&&sheet&&dialog.open){
   const shapes=withDetails(data,details).views,detailSources=new Map(details.map(d=>[d.id,d.view]));
   const candidates=report.items.filter(({dimension:d})=>report.detailSources.get(d.view)===detailSources.get(d.view)&&
    drawingDiameterCandidateVisible(d,shapes[d.view],sheet.layout[d.view]));
   visible=unmeasuredDrawingHoles(candidates,[...dimensions,...sheet.inheritedDimensions]);
  }
  omittedHolePanel.hidden=!visible.length;
  omittedHolePanel.firstElementChild.textContent='省略した穴径・円（'+visible.length+' 件）';
  if(visible.length!==visibleOmittedHoles.length||visible.some((item,i)=>item!==visibleOmittedHoles[i])){
   const choices=document.createDocumentFragment();
   choices.append(new Option('候補を選択',''));
   for(const [index,{dimension:d,reason}] of visible.entries()){
    const position=d.center.map(n=>Number(n.toFixed(2))).join(', ');
    const reasonText=reason==='small'?'小さい円':'件数上限';
    choices.append(new Option(pdfViewLabel(d.view)+' · '+dimensionLabel(d)+' · ('+position+') · '+reasonText,String(index)));
   }
   omittedHoleInput.replaceChildren(choices);
   visibleOmittedHoles=visible;
  }
  const index=visible.indexOf(selectedOmittedHole),enabled=!!sheet&&!busy&&!drag&&!picking&&!action;
  if(index<0)selectedOmittedHole=null;
  omittedHoleInput.value=index<0?'':String(index);
  omittedHoleInput.disabled=!enabled||!visible.length;
  omittedHoleAdd.disabled=!enabled||index<0||dimensions.length>=500;
  omittedHoleAdd.title=dimensions.length>=500?'寸法は500個まで追加できます':'';
  const svg=viewportHost.querySelector('svg');
  svg?.querySelector('[data-omitted-hole-highlight]')?.remove();
  if(!svg||!omittedHolePanel.open||!enabled||!selectedOmittedHole)return;
  const d=selectedOmittedHole.dimension,[cx,cy]=map(d.view,d.center),r=Math.max(1.6,d.radius*sheet.layout[d.view].scale);
  const circle=document.createElementNS(svg.namespaceURI,'circle');
  for(const [key,value] of Object.entries({cx,cy,r,'data-omitted-hole-highlight':'true',fill:'none',
   stroke:'#b45116','stroke-width':2.5,'vector-effect':'non-scaling-stroke','pointer-events':'none'}))circle.setAttribute(key,value);
  svg.append(circle);
  return {x:cx-r,y:cy-r,width:2*r,height:2*r};
 }
 omittedHolePanel.ontoggle=syncOmittedHoles;
 omittedHoleInput.onchange=()=>{
  const value=omittedHoleInput.value;
  selectedOmittedHole=value===''?null:visibleOmittedHoles[Number(value)];
  const box=syncOmittedHoles();
  if(box){viewport.focus(box);viewportHost.scrollIntoView({block:'nearest'});}
 };
 omittedHoleAdd.onclick=()=>{
  syncOmittedHoles();
  if(omittedHoleAdd.disabled)return;
  const d=selectedOmittedHole.dimension;
  const draft=applyDimensionFont({...d,automatic:true,at:drawingDiameterDraftPosition(d,sheet.layout[d.view])});
  const placed=arrangeDrawingDimensions([draft],sheet,[...onSheetDimensions(),...sheet.inheritedDimensions],{preferNearby:true,keepOnPaper:true});
  const added=editingPage<0?placed.dimensions:addedPageDimensions(placed.dimensions,Number($('drawing-scale').value));
  preserveActivePDFPlacement();
  dimensions=[...dimensions,...added];selectedOmittedHole=null;
  render();
  if(sheet)status('穴径寸法 '+dimensionLabel(d)+' を追加しました。'+(placed.unresolved.length?'位置を調整してください。':''));
 };
 $('drawing-dimension-auto').onclick=()=>{
  if(!data||!sheet||busy)return;
  picking=null;action=null;selection=null;
  const unique=uniqueOverallDimensions&&typeKeys('outline').some(key=>autoDimensionTypesEnabled.includes(key));
  const current=unique?hideDuplicateOverallDimensions(dimensions,sheet):{dimensions,hidden:0};
  const scale=Number($('drawing-scale').value);
  const placed=sheet.dimensionIndices?.map((index,i)=>({...sheet.dimensions[i],hidden:current.dimensions[index].hidden}))??current.dimensions;
  const result=autoDrawingDimensions(data,scale,current.dimensions,sheet,{
   views:autoDimensionViews,types:autoDimensionTypesEnabled,groupRepeated:groupRepeatedDimensions,uniqueAxes:unique,
   fontSize:dimensionFontSize===standardDimensionFont?undefined:dimensionFontSize,details,placed});
  let added=result.dimensions;
  if(editingPage>=0&&added.length)added=addedPageDimensions(added,scale);
  if(added.length||result.updated||current.hidden)preserveActivePDFPlacement();
  const firstAdded=result.existing.length;
  dimensions=[...result.existing,...added];
  omittedHoleReport={data,items:result.omitted,detailSources:new Map(details.map(d=>[d.id,d.view]))};
  selectedOmittedHole=null;omittedHolePanel.open=!!result.omitted.length;
  render();
  if(!sheet)return;
  const messages=[];
  if(result.dimensions.length)messages.push('寸法を '+result.dimensions.length+' 個、自動追加しました。');
  if(result.updated)messages.push('ねじ穴の寸法表記を '+result.updated+' 件更新しました。');
  if(current.hidden)messages.push('重複する自動外形寸法を '+current.hidden+' 個、非表示にしました。');
  if(!messages.length)messages.push('追加できる寸法はありません。');
  if(visibleOmittedHoles.length)messages.push('省略した穴径・円 '+visibleOmittedHoles.length+' 件は一覧から追加できます。');
  else if(result.skipped)messages.push('小さい円形部・過密な部分は省略しました。');
  if(result.layoutWarnings)messages.push(result.layoutWarnings+' 個の寸法は配置の調整が必要です。');
  const clipped=[...viewportHost.querySelectorAll('[data-dimension][data-drawing-overflow]')].filter(node=>Number(node.dataset.dimension)>=firstAdded).length;
  if(clipped)messages.push('用紙をはみ出した寸法 '+clipped+' 個は赤枠から調整できます。');
  status(messages.join(' '));
 };
 $('drawing-dimension-group').onclick=()=>{if(!sheet||busy)return;const grouped=groupDrawingDimensions(dimensions),removed=dimensions.length-grouped.length;if(!removed){status('まとめられる同じR・穴径はありません。同じ図・実寸法・書式の寸法だけをまとめます');return;}dimensions=grouped;selection=null;picking=null;action=null;render(true,{reflowDimensions:true});status('同じR・穴径をまとめ、寸法表示を '+removed+' 件減らしました。元に戻すで取り消せます');};
 $('drawing-dimension-arrange').onclick=()=>{
  if(!data||!sheet||busy||!dimensions.length)return;
  picking=null;action=null;selection=null;
  const layout=arrangeDrawingDimensions(onSheetDimensions(),sheet);
  if(editingPage<0)dimensions=layout.dimensions;
  else for(const index of sheet.dimensionIndices)storeDimensionPlacement(index,layout.dimensions[index]);
  render();
  if(!overflow)status('寸法を自動配置しました。元に戻すで配置を戻せます。'+(layout.unresolved.length?' '+layout.unresolved.length+' 個は重なりを解消できませんでした。縮尺・用紙サイズを調整してください。':''));
 };
 function nearest(e,kind){
  const svg=viewportHost.querySelector('svg'),matrix=svg?.getScreenCTM();
  if(!matrix)return null;
  let viewCache=pickGeometryCache.get(svg);
  if(!viewCache){viewCache=new Map();pickGeometryCache.set(svg,viewCache);}
  const screen=(name,p)=>new DOMPoint(...map(name,p)).matrixTransform(matrix);
  const cursor=kind==='arc'?new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse()):null;
  const pixelsPerMillimeter=Math.hypot(matrix.a,matrix.b);
  let best=null,distance=12;
  for(const name of picking?dimensionViews(picking.kind):names()){
   if(picking?.view&&picking.view!==name)continue;
   let geometry=viewCache.get(name);
   if(!geometry){geometry={view:viewData(name)};viewCache.set(name,geometry);}
   const {view}=geometry,v=sheet.layout[name];
   const test=(point,item)=>{
    if(!insideView(view,point)||drawingPointOmitted(v,point))return;
    const q=screen(name,point),d=Math.hypot(q.x-e.clientX,q.y-e.clientY);
    if(d<distance){best={name,point,...item};distance=d;}
   };
   if(kind==='point'){
    if(name==='iso'){
     for(const vertex of view.dimensionVertices)test(vertex.point,{model:vertex.model});
     continue;
    }
    const centers=picking?(geometry.centers??=drawingDimensionCenterGuides(view,showsHiddenLines(name))
     .filter(guide=>!drawingPointOmitted(v,guide.point))):[];
    if(picking||action?.kind==='line')for(const item of dimensionPoints){
     if(!item.review&&item.view===name&&drawingDimensionPointFits(view,item.point)){
      const guide=centers.find(center=>sameDrawingCenter(item.point,center.point));
      test(item.point,{manual:item.id,holeRef:item.holeRef,label:guide?.label??'手動の寸法点'});
     }
    }
    for(const center of centers)test(center.point,{centerGuide:center,label:center.label});
    const points=geometry.points??=viewPoints(view).filter(point=>!centers.some(center=>sameDrawingCenter(point,center.point)));
    for(const point of points)test(point,{});
    continue;
   }
   const curves=geometry.curves??=drawingCurves(view.visible);
   if(kind==='line'){
    for(const line of curves.lines){
     const a=screen(name,line.a),b=screen(name,line.b),dx=b.x-a.x,dy=b.y-a.y;
     const t=Math.max(0,Math.min(1,((e.clientX-a.x)*dx+(e.clientY-a.y)*dy)/(dx*dx+dy*dy||1)));
     test([line.a[0]+t*(line.b[0]-line.a[0]),line.a[1]+t*(line.b[1]-line.a[1])],{line});
    }
   }else{
    if(picking?.kind==='thread'){
     const mouse=local(name,[cursor.x,cursor.y]);
     for(const shaft of view.threadShafts??[]){
      if(!drawingDimensionVisible(shaft,v))continue;
      const offset=mouse.map((value,i)=>value-shaft.center[i]),length=Math.hypot(...offset);
      if(length>1e-7)test(shaft.center.map((value,i)=>value+offset[i]*shaft.radius/length),{threadShaft:shaft});
     }
    }
    const modelCursor=[v.bx+(cursor.x-v.x)/v.scale,v.by+(cursor.y-v.y)/v.scale],cursors=[modelCursor];
    if(v.break){
     const shifted=[...modelCursor];
     shifted[v.break.direction]+=v.break.removed;
     cursors.push(shifted);
    }
    const pixelsPerUnit=pixelsPerMillimeter*v.scale;
    for(const arc of curves.arcs){
     // Each displayed part of a shortened view is just translated, so distant circles can be skipped.
     if(!cursors.some(([x,y])=>Math.abs(Math.hypot(x-arc.center[0],y-arc.center[1])-arc.radius)*pixelsPerUnit<distance))continue;
     const start=Math.atan2(arc.a[1]-arc.center[1],arc.a[0]-arc.center[0]),end=Math.atan2(arc.b[1]-arc.center[1],arc.b[0]-arc.center[0]);
     let delta=end-start;
     if(arc.sweep){while(delta<=0)delta+=2*Math.PI;}else while(delta>=0)delta-=2*Math.PI;
     for(let i=0;i<=160;i++){
      const t=start+delta*i/160;
      test([arc.center[0]+arc.radius*Math.cos(t),arc.center[1]+arc.radius*Math.sin(t)],{arc});
     }
    }
   }
  }
  return best;
 }
 function dimensionTargetAt(e){
  const kind=picking.kind,targetKind=kind==='angle'?'line':isCircularDimensionKind(kind)?'arc':'point';
  const hit=nearest(e,targetKind);
  if(!hit)return {error:{
   line:'直線に近い位置をクリックしてください',
   arc:kind==='thread'?'ねじの円形の外周をクリックしてください':'円・円弧に近い位置をクリックしてください（楕円は対象外）',
   point:picking.view==='iso'||!names().length?'俯瞰図の頂点をクリックしてください':
    '寸法点をクリックしてください。必要な点がなければ「寸法点を追加」を使えます'
  }[targetKind]};
  if(kind==='thread'){
   const threadDimension=drawingThreadDimensionTarget(viewData(hit.name),hit);
   return {...hit,threadDimension,label:dimensionLabel({kind,...threadDimension})};
  }
  if(hit.centerGuide)hit.holeRef=referenceForCenter(hit.name,hit.centerGuide);
  if(picking.firstLine){
   try{return {...hit,angle:angleDimension(picking.firstLine,hit.line)};}
   catch(error){return {error:error.message};}
  }
  const zero={error:'寸法が０になります。別の点を選択してください'};
  if(picking.endpoint){
   const d=dimensions[picking.replace],edited=d&&replaceDrawingDimensionEndpoint(d,picking.endpoint,hit);
   return edited?{...hit,edited}:zero;
  }
  if(picking.a&&!drawingDimensionBetween(kind,hit.name,drawingDimensionEndpoint(picking,'a'),hit))return zero;
  return hit;
 }
 function clearDimensionHover(){
  snapLabel.hidden=true;
  if(!dimensionHover)return;
  for(const node of dimensionHover.nodes){
   if(node.localName==='circle'||node.hasAttribute('data-dimension-center-guide'))node.removeAttribute('data-dimension-hover');
   else node.remove();
  }
  dimensionHover=null;
 }
 function showDimensionSnapLabel(event,text){
  snapLabel.hidden=!text;
  if(!text)return;
  if(snapLabel.textContent!==text)snapLabel.textContent=text;
  const frame=viewportHost.getBoundingClientRect(),width=snapLabel.offsetWidth,height=snapLabel.offsetHeight;
  const right=Math.min(frame.right,window.innerWidth),bottom=Math.min(frame.bottom,window.innerHeight);
  const x=Math.max(4,frame.left+4,Math.min(event.clientX+12,right-width-4));
  const below=event.clientY+12,y=below+height+4<=bottom?below:Math.max(frame.top+4,event.clientY-height-10);
  snapLabel.style.left=x+'px';snapLabel.style.top=y+'px';
 }
 function previewDimensionTarget(e){
  const hit=dimensionTargetAt(e);
  if(hit.error){clearDimensionHover();return;}
  const target=hit.line??hit.arc??hit.threadShaft??hit.point;
  const same=dimensionHover?.target===target&&dimensionHover.view===hit.name;
  if(!same)clearDimensionHover();
  showDimensionSnapLabel(e,hit.label??(hit.arc?'円周':hit.line?'輪郭線':hit.model?'頂点':'寸法点'));
  if(same)return;
  const svg=viewportHost.querySelector('svg'),viewName=CSS.escape(hit.name);
  if(!hit.line&&!hit.arc&&!hit.threadShaft){
   const selector=hit.manual?'[data-dimension-point="'+CSS.escape(hit.manual)+'"]':hit.centerGuide?
    '[data-dimension-center-guide="'+viewName+'"][data-center-point="'+JSON.stringify(hit.point)+'"]':
    '[data-snap-view="'+viewName+'"][data-snap-point="'+JSON.stringify(hit.point)+'"]';
   const marker=svg.querySelector(selector);
   if(!marker)return;
   marker.setAttribute('data-dimension-hover',hit.centerGuide?'center':'point');
   dimensionHover={target,view:hit.name,nodes:[marker]};
   return;
  }
  const view=svg.querySelector('[data-view="'+viewName+'"] > g[transform]');
  if(!view)return;
  const clips=[...view.querySelectorAll('g[clip-path]')],groups=clips.length?clips:[view];
  const path=document.createElementNS(svg.namespaceURI,'path');
  if(hit.threadShaft){
   const [x,y]=target.center,r=target.radius,from=(x-r)+' '+y,to=(x+r)+' '+y,arc=' A '+r+' '+r+' 0 0 1 ';
   path.setAttribute('d','M '+from+arc+to+arc+from);
  }else{
   const {a,b}=target;
   path.setAttribute('d','M '+a.join(' ')+(hit.arc?' A '+target.radius+' '+target.radius+' 0 '+Number(target.large)+' '+Number(target.sweep)+' ':' L ')+b.join(' '));
  }
  path.setAttribute('data-dimension-hover',hit.arc||hit.threadShaft?'arc':'line');
  const nodes=groups.map(group=>group.appendChild(path.cloneNode()));
  dimensionHover={target,view:hit.name,nodes};
 }
 const noClearDimensionPosition='付近に図形の線を隠さずに寸法を置ける場所がありません。位置を変えてください';
 function acceptDimensionEndpoint(edited){
  const index=picking.replace,unchanged=edited===dimensions[index];
  if(!unchanged){
   const placed=onSheetDimensions()[index];
   preserveActivePDFPlacement();
   dimensions[index]=edited;
   if(editingPage>=0)storeDimensionPlacement(index,placed);
  }
  selection={type:'dimension',index};
  cancelPick();
  status(unchanged?'同じ端点です':'寸法の端点を付け替えました');
 }
 function placePickedDrawingDimension(e){
  const {ready,firstLine,replace,...draft}=picking;
  if(dimensions.length>=500&&replace===undefined)throw Error('寸法は500個まで追加できます');
  const at=local(draft.view,paperPoint(e)),d=applyDimensionFont({...draft,at}),old=dimensions[replace];
  if(old)for(const key of ['precision','displayValue','fontSize','note','tolerance','lineColor','textColor','pinned','alongOffset']){
   if(old[key]!==undefined)d[key]=old[key];
  }
  const scale=sheet.layout[d.view].scale;
  const snap=$('drawing-snap').checked&&!e.altKey?snapDimension(d,at,onSheetDimensions(),scale,replace):{at};
  const hitsLinework=drawingLineworkTest(viewportHost.querySelector('svg'),sheet);
  const placed=keepDrawingDimensionClear(d,sheet,hitsLinework,snap.at);
  if(!placed)throw Error(noClearDimensionPosition);
  const index=replace??dimensions.length;
  const replacement=old?.hidden?{...placed,hidden:true}:placed;
  dimensions[index]=replacement;
  storeDimensionPlacement(index,replacement);
  if(replace!==undefined)selection={type:'dimension',index:replace};
  cancelPick();
  if(placed.at!==snap.at)status('図形の線を隠さない近くの位置に寸法を配置しました');
 }
 function dimensionHit(event,selector){
  const direct=event.target.closest(selector);
  if(direct||!event.target.closest('[data-view]'))return direct;
  // Model linework is drawn over dimensions. Keep the covered dimensions editable.
  for(const element of document.elementsFromPoint(event.clientX,event.clientY)){
   const dimension=element.closest(selector);
   if(dimension&&viewportHost.contains(dimension))return dimension;
  }
  return null;
 }
 $('drawing-preview').onclick=e=>{if(!sheet||drag||busy)return;if(action){actionClick(e);return;}if(!picking){const note=e.target.closest('[data-leader]');if(note){selection={type:'leader',id:note.dataset.leader};editor();return;}const marker=e.target.closest('[data-marker]');if(marker){selection={type:'marker',id:marker.dataset.marker};editor();return;}const extra=e.target.closest('[data-section],[data-detail]');if(extra){extraTarget=extra.dataset.section||extra.dataset.detail;extraControls();return;}const el=dimensionHit(e,'[data-dimension]')??e.target.closest('[data-comment]');selection=el?.hasAttribute('data-dimension')?{type:'dimension',index:Number(el.dataset.dimension)}:el?{type:'comment',id:el.dataset.comment==='true'?'comment':el.dataset.comment}:null;if(selection?.type==='comment')selectDrawingComment(selection.id);editor();return;}try{if(picking.ready){placePickedDrawingDimension(e);return;}
 const hit=dimensionTargetAt(e);
 if(hit.error)throw Error(hit.error);
 clearDimensionHover();
 if(picking.endpoint){acceptDimensionEndpoint(hit.edited);return;}
 if(hit.threadDimension){picking={...picking,...hit.threadDimension,view:hit.name,ready:true};}
 else if(hit.arc){picking={...picking,view:hit.name,center:hit.arc.center,radius:hit.arc.radius,ready:true};}
 else if(hit.line){
  if(!hit.angle){picking.view=hit.name;picking.firstLine=hit.line;syncDimensionHint();status('２本目の直線を選択してください');return;}
  Object.assign(picking,hit.angle,{ready:true});
 }
 else{
  if(!picking.a){
   picking.view=hit.name;picking.a=hit.point;
   if(hit.model)picking.modelA=hit.model;
   if(hit.manual)picking.manualEndpoints=['a'];
   if(hit.holeRef)picking.holeRefs={a:hit.holeRef};
   render();status('２点目を選択してください');return;
  }
  picking.b=hit.point;
  if(hit.model)picking.modelB=hit.model;
  if(hit.manual)(picking.manualEndpoints??=[]).push('b');
  if(hit.holeRef)(picking.holeRefs??={}).b=hit.holeRef;
  picking.ready=true;
 }
 syncDimensionHint();status(picking.kind==='thread'?'ねじ寸法 '+dimensionLabel(picking)+'。配置位置をクリックしてください':
  '寸法 '+Number(dimensionValue(picking).toFixed(3))+(picking.kind==='angle'?'°':' mm')+'：配置位置をクリックしてください');}catch(err){status(err.message);}};
 function beginDimensionDrag(event,index,inherited){
  const d=inherited?sheet.inheritedDimensions[index]:onSheetDimensions()[index];
  if(!d)return;
  if(!inherited&&d.pinned){status('この寸法は固定されています。寸法をクリックして解除できます');return;}
  const geometry=drawingDimensionGeometry(d,sheet.layout[d.view]);
  const detail=inherited?details.find(item=>item.id===d.view):null;
  if(inherited&&!detail)return;
  startPaperDrag(event,{type:'dimension',index,original:detail??dimensions[index],detailId:detail?.id,
   detailKey:d.detailDimensionKey,origin:[...d.at],alongOffset:d.alongOffset,anchor:geometry?.at,direction:geometry?.direction});
 }
 function restoreDraggedDimension(state){
  if(state.detailId)details=details.map(item=>item.id===state.detailId?state.original:item);
  else if(dimensions[state.index])dimensions[state.index]=state.original;
 }
 function currentDraggedDimension(state,placedDimensions=onSheetDimensions()){
  return state.detailId?sheet.inheritedDimensions.find(d=>d.view===state.detailId&&d.detailDimensionKey===state.detailKey):
   placedDimensions[state.index];
 }
 function storeDraggedDimension(state,placed){
  if(!state.detailId){storeDimensionPlacement(state.index,placed);return;}
  const mode=editingPage>=0?'pdf':'overview',key=state.detailKey;
  details=details.map(detail=>{
   if(detail.id!==state.detailId)return detail;
   const placements=detail.dimensionPlacements;
   return {...detail,dimensionPlacements:{...placements,[key]:{...placements?.[key],[mode]:dimensionPosition(placed)}}};
  });
 }
 function moveDrawingDimension(state,dx,dy,event){
  const placedDimensions=onSheetDimensions(),current=currentDraggedDimension(state,placedDimensions);
  if(!current)return;
  const d={...current},view=sheet.layout[d.view];
  const {scale}=view,start=map(d.view,state.origin),snapEnabled=$('drawing-snap').checked&&!event.altKey;
  const direction=snapEnabled&&!event.shiftKey&&state.anchor&&d.kind!=='angle'
   ?snapDrawingDragAxis([dx,dy],state.pixelsPerAxis,state.snapAxis):{delta:[dx,dy],axis:null};
  const {axis}=direction;
  [dx,dy]=direction.delta;state.snapAxis=axis;
  if(state.direction){
   const [x,y]=state.direction,parallel=dx*x+dy*y;
   const offset=(state.alongOffset??0)+(!event.shiftKey&&(axis!==null||Math.abs(parallel)>.35)?parallel/scale:0);
   if(Math.abs(offset)>1e-8)d.alongOffset=Math.max(-1e6,Math.min(1e6,offset));
   else delete d.alongOffset;
   dx-=parallel*x;dy-=parallel*y;
  }
  d.at=local(d.view,[start[0]+dx,start[1]+dy]);
  const neighbors=snapEnabled?[...placedDimensions,...sheet.inheritedDimensions]:[];
  let snap=snapEnabled?snapDimension(d,d.at,neighbors,scale,neighbors.indexOf(current)):{at:d.at};
  if(axis!==null&&snap.match&&Math.abs(d.at[axis]-snap.at[axis])*scale>1e-6)snap={at:d.at};
  state.hitsLinework??=drawingLineworkTest(viewportHost.querySelector('svg'),sheet);
  const placed=keepDrawingDimensionClear(d,sheet,state.hitsLinework,snap.at);
  if(!placed){
   viewportHost.querySelector('[data-dimension-drag-guide]')?.remove();
   status(noClearDimensionPosition);return;
  }
  storeDraggedDimension(state,placed);
  render(false);
  const finalView=sheet?.layout[d.view];
  const updated=axis!==null&&finalView&&currentDraggedDimension(state);
  const geometry=updated&&drawingDimensionGeometry(updated,finalView);
  const onGuide=geometry&&Math.abs(geometry.at[axis]-state.anchor[axis])<1e-6;
  if(onGuide)drawPaperGuide(axis,state.anchor[axis],'data-dimension-drag-guide');
  if(placed.at!==snap.at)status('図形の線を隠さない近くの位置に調整中');
  else if(onGuide)status((axis===0?'垂直':'真横')+'方向に吸着中（Altで解除）');
  else if(snap.match)status('寸法線の位置に吸着中（Altで解除）');
  else status('寸法線を移動中');
 }
 function beginCommentDrag(value){
  const name=value==='true'?'comment':value,note=sheet.notes.find(note=>note.id===name);
  return {type:'comment',name,origin:[note.x,note.y]};
 }
 function drawViewResizeHandles(){
  const svg=viewportHost.querySelector('svg');
  svg?.querySelectorAll('[data-view-resize]').forEach(handle=>handle.remove());
  if(!svg||!sheet||!$('drawing-layout-mode').checked||picking||action||busy||drag&&drag.type!=='viewResize'){
   inlineScales.sync(null,{});return;
  }
  const ns='http://www.w3.org/2000/svg';
  for(const [name,view] of Object.entries(sheet.layout)){
   const x=view.x+view.width,y=view.y+view.height,size=3.6;
   const handle=document.createElementNS(ns,'rect'),title=document.createElementNS(ns,'title');
   title.textContent=viewLabel(name)+'の右下の角をドラッグして縮尺を変更';
   for(const [key,value] of Object.entries({'data-view-resize':name,x:x-size/2,y:y-size/2,width:size,height:size,rx:.55,
    fill:'#0787a3',stroke:'#ffffff','stroke-width':'1.4','vector-effect':'non-scaling-stroke','pointer-events':'all'}))handle.setAttribute(key,value);
   handle.append(title);svg.append(handle);
  }
  inlineScales.sync(drag?null:svg,drag?{}:sheet.layout);
 }
 function drawingViewResizeState(name){
  const view=sheet.layout[name],page=editingPage+1,scale=Number($('drawing-scale').value),before=options();
  const inLinkedGroup=linkedProjectionScales&&linkedDrawingViews.includes(name);
  const locked=!page&&!inLinkedGroup&&projectionLockActive()&&drawingProjectionNames.includes(name);
  const fixed=locked?[scale,...drawingProjectionNames.map(id=>viewScales[id]).filter(value=>value!==undefined)]:[view.scale];
  const pagePositions=page?displayedPositions(sheet):null;
  return {type:'viewResize',name,view,page,scale,locked,pagePositions,pageScale:sheet.pageScale,targets:viewScaleTargets(name,!!page),
   minimum:Math.max(...fixed.map(value=>minDrawingScale/value)),maximum:Math.min(...fixed.map(value=>maxDrawingScale/value)),
   previousDimensions:dimensions,previousPdfScales:pdfPageScales,previousPdfViews:pdfViewScales,
   previousViewScales:viewScales,frames:page?null:drawingViewFrames(data,before,scale)};
 }
 function beginViewResize(event,name){
  startPaperDrag(event,drawingViewResizeState(name),true);
 }
 function resizeDrawingView(state,dx,dy){
  const {view,locked,scale}=state;
  const width=view.width,height=view.height;
  const stretch=1+(dx*width+dy*height)/Math.max(1e-8,width*width+height*height);
  const initialScale=locked?scale:view.scale;
  const next=snapDrawingResizeScale(initialScale,initialScale*stretch,initialScale*state.minimum,initialScale*state.maximum);
  if(next===(state.lastScale??initialScale))return;
  state.lastScale=next;
  applyViewResizeScale(state,next);
  render(false);
  state.resized=!!sheet&&next!==initialScale;
  if(!sheet){restorePaperDrag(state);render(false);}
 }
 function applyViewResizeScale(state,next,exactViewScale){
  const {name,view,page,locked,scale,targets}=state,initialScale=locked?scale:view.scale;
  const ratio=next/initialScale;
  const adjusted=value=>Math.max(minDrawingScale,Math.min(maxDrawingScale,Number((value*ratio).toPrecision(9))));
  if(next===initialScale)restorePaperDrag(state);
  else if(page){
   pdfViewScales=withViewScale(state.previousPdfViews,targets,next);
   if(pdfPlacement==='auto')pdfPageScales={...state.previousPdfScales,[page]:state.pageScale};
   pdfPositions={...state.cancelPositions,...state.pagePositions};
  }else{
   const nextScale=locked?next:scale;
   if(locked){
    viewScales={...state.previousViewScales};
    for(const id of drawingProjectionNames)if(viewScales[id]!==undefined)viewScales[id]=id===name&&exactViewScale!==undefined?exactViewScale:adjusted(viewScales[id]);
    setScale(nextScale);
   }else{
    viewScales=withViewScale(state.previousViewScales,targets,next);
    positions[name]=[view.x,view.y];
   }
   const nextFrames=drawingViewFrames(data,options(),nextScale);
   dimensions=rescaleDrawingAnnotations(state.previousDimensions,nextFrames,scale,nextScale,state.frames);
  }
 }
 function changeInlineViewScale(name,value){
  if(!sheet?.layout[name]||busy||drag||value===sheet.layout[name].scale)return;
  const state=drawingViewResizeState(name),ratio=value/state.view.scale;
  if(ratio<state.minimum*(1-1e-10)||ratio>state.maximum*(1+1e-10)){
   status('連動する図を含め、指定の縮尺は設定範囲を超えています。');return;
  }
  const previousPage=editingPage;
  state.cancelPositions=structuredClone(pagePositionMap());
  const next=state.locked?Math.max(minDrawingScale,Math.min(maxDrawingScale,state.scale*ratio)):value;
  applyViewResizeScale(state,next,value);
  render(false,{reflowDimensions:!state.page});
  if(!sheet||editingPage!==previousPage){
   const problem=$('drawing-status').textContent;
   editingPage=previousPage;restorePaperDrag(state);render(false);status(problem);return;
  }
  persist();
 }
 function drawingDragBox(state){
  if(state.type==='comment')return viewportHost.querySelector('[data-comment="'+(state.name==='comment'?'true':state.name)+'"]').getBBox();
  if(state.type==='holeTable')return sheet.holeBox;
  return state.type==='view'?sheet.layout[state.name]:null;
 }
 function drawPaperGuide(axis,position,attribute='data-placement-guide'){
  const svg=viewportHost.querySelector('svg');
  if(!svg||!sheet)return;
  const line=document.createElementNS(svg.namespaceURI,'line');
  const ends=axis?{x1:0,x2:sheet.width,y1:position,y2:position}:{x1:position,x2:position,y1:0,y2:sheet.height};
  for(const [key,value] of Object.entries({...ends,[attribute]:axis,'pointer-events':'none',stroke:'#0088a3',
   'stroke-width':'.35','stroke-dasharray':'2 1'}))line.setAttribute(key,value);
  svg.append(line);
 }
 function showLinkedProjectionGuides(state){
  if(!state.followers?.length||!sheet?.layout.front)return;
  const {front,top,right}=sheet.layout;
  if(top)drawPaperGuide(0,front.x+front.width/2,'data-projection-guide');
  if(right)drawPaperGuide(1,front.y+front.height/2,'data-projection-guide');
 }
 function moveDrawingPlacement(state,dx,dy,event){
  if(Math.abs(dx)<1e-6&&Math.abs(dy)<1e-6){setPagePositionMap(structuredClone(state.cancelPositions));render(false);showLinkedProjectionGuides(state);return;}
  const placements=pagePositionMap();
  const locked=editingPage<0&&state.type==='view'&&projectionLockActive()&&drawingProjectionNames.includes(state.name);
  const axis=locked?projectionDragAxis(state.name):null;
  const {delta,guides}=state.guideBox&&$('drawing-snap').checked&&!event.altKey?
   snapDrawingPlacement([dx,dy],state.guideBox,sheet,{view:state.type==='view'?state.name:undefined,
    movingViews:locked&&state.name==='front'?drawingProjectionNames:state.followers?.map(({name})=>name)}):
   {delta:[dx,dy],guides:[]};
  if(axis!==null)delta[1-axis]=0;
  if(Math.abs(dx)<1e-6)delta[0]=0;
  if(Math.abs(dy)<1e-6)delta[1]=0;
  if(locked&&state.name==='front'){
   if(!state.groupOrigins){
    state.groupOrigins={};
    for(const name of drawingProjectionNames){
     const v=sheet.layout[name];
     if(v)state.groupOrigins[name]=[v.x,v.y];
     else if(positions[name])state.groupOrigins[name]=positions[name].slice();
    }
   }
   for(const [name,origin] of Object.entries(state.groupOrigins))positions[name]=origin.map((v,i)=>v+delta[i]);
  }
  for(const {name,axis,origin} of state.followers??[]){
   placements[name]=origin.map((value,i)=>value+(i===axis?delta[i]:0));
  }
  placements[state.name]=state.origin.map((value,i)=>value+delta[i]);
  render(false);
  if(locked){
   for(const name of drawingProjectionNames){
    const v=sheet.layout[name];
    if(v&&positions[name])positions[name]=[v.x,v.y];
   }
  }
  for(const {axis:guideAxis,position} of guides){
   if(axis!==null&&guideAxis!==axis||Math.abs(guideAxis?dy:dx)<1e-6)continue;
   drawPaperGuide(guideAxis,position);
  }
  showLinkedProjectionGuides(state);
 }
 const host=$('drawing-preview');
 function retainViewPositions(layout,target,names){
  for(const name of names){const view=layout[name];if(view)target[name]=[view.x,view.y];}
 }
 function linkedPlacementNeedsLayout(previous){
  const moved=new Set(linkedDrawingViews.filter(name=>{
   const before=previous.layout[name],after=sheet.layout[name];
   return before&&after&&Math.hypot(before.x-after.x,before.y-after.y)>.01;
  }));
  if(!moved.size)return false;
  if(overflow)return true;
  const items=placementItems();
  if(sheet.holeBox)items.push({id:'holeTable',box:sheet.holeBox});
  const overlap=(a,b)=>a.x+a.width>b.x+.5&&b.x+b.width>a.x+.5&&a.y+a.height>b.y+.5&&b.y+b.height>a.y+.5;
  return items.some(item=>moved.has(item.id)&&items.some(other=>other!==item&&overlap(item.box,other.box)));
 }
 $('drawing-link-projections').onchange=()=>{
  if(!sheet||busy||drag)return;
  const previous=sheet,enable=$('drawing-link-projections').checked;
  retainViewPositions(overviewSheet.layout,positions,projectionLockActive()?drawingProjectionNames:linkedDrawingViews);
  if(editingPage>=0)retainViewPositions(sheet.layout,pdfPositions,linkedDrawingViews);
  linkedProjections=enable;
  if(enable)projectionLocked=false;
  picking=null;action=null;selection=null;
  render(false);
  if(!sheet)return;
  if(enable){
   if(editingPage<0&&linkedPlacementNeedsLayout(previous)&&applyAutomaticLayout())return;
   retainViewPositions(overviewSheet.layout,positions,linkedDrawingViews);
   if(editingPage>=0)retainViewPositions(sheet.layout,pdfPositions,linkedDrawingViews);
  }
  persist();
 };
 $('drawing-projection-lock').onchange=()=>{
  if(!sheet||busy)return;
  const compact=layoutKind==='compact';
  if(!compact){
   for(const name of drawingProjectionNames){
    const v=sheet.layout[name];if(v)positions[name]=[v.x,v.y];
   }
  }else{
   positions=Object.fromEntries(Object.entries(positions).filter(([key])=>!drawingProjectionNames.includes(key)&&key!=='iso'));
  }
  projectionLocked=$('drawing-projection-lock').checked;layoutKind='projection';
  if(projectionLocked)linkedProjections=false;
  if(compact){
   const current=Number($('drawing-scale').value);
   render(false);
   for(const scale of scales.filter(scale=>scale<current)){
    if(!overflow)break;
    setScale(scale);render(false);
   }
  }
  cancelPick();
 };
 function placementTarget(event){
  const note=event.target.closest('[data-comment]'),view=event.target.closest('[data-view]');
  return note?(note.dataset.comment==='true'?'comment':note.dataset.comment):view?.dataset.view??event.target.closest('[data-hole-labels]')?.dataset.holeLabels;
 }
 const selectingPlacement=e=>(e.ctrlKey||e.metaKey)&&!picking&&!action&&!busy&&sheet&&placementTarget(e);
 host.addEventListener('pointerdown',e=>{
  if(e.button!==0||drag)return;
  suppressClick=false;
  if(selectingPlacement(e))e.stopImmediatePropagation();
 },true);
 host.addEventListener('click',e=>{
  if(suppressClick){suppressClick=false;e.preventDefault();e.stopImmediatePropagation();return;}
  const id=selectingPlacement(e);if(!id)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(selectedPlacements.has(id))selectedPlacements.delete(id);else selectedPlacements.add(id);
  alignmentPanel.open=true;syncAlignment();
 },true);
 function startPaperDrag(event,state,capture=false){
  const svg=host.querySelector('svg'),matrix=svg?.getScreenCTM();
  if(!matrix)return;
  event.preventDefault();
  drag={...state,start:paperPoint(event),inverse:matrix.inverse(),viewBox:svg.getAttribute('viewBox'),
   pixelsPerAxis:[Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d)],
   pointerId:event.pointerId,cancelPositions:structuredClone(pagePositionMap())};
  if(linkedProjections&&state.type==='view')drag.followers=linkedDrawingFollowers(state.name,sheet.layout).map(([name,axis])=>{
   const {x,y}=sheet.layout[name];
   return {name,axis,origin:[x,y]};
  });
  if(editingPage>=0&&pdfPlacement==='auto'&&['view','viewResize','dimension','comment','holeTable'].includes(state.type))drag.pdfLayouts=new Map();
  drag.guideBox=drawingDragBox(drag);
  if(capture)host.setPointerCapture(event.pointerId);
 }
 function restorePaperDrag(state){
  setPagePositionMap(structuredClone(state.cancelPositions));
  if(state.type==='viewResize'){
   setScale(state.scale);dimensions=state.previousDimensions;viewScales=state.previousViewScales;
   pdfPageScales=state.previousPdfScales;pdfViewScales=state.previousPdfViews;
  }else if(state.type==='commentWidth'){
   if(state.previousWidth===undefined)delete commentWidths[state.note.id];
   else commentWidths[state.note.id]=state.previousWidth;
  }else if(state.type==='dimension')restoreDraggedDimension(state);
  else if(state.type==='section'){const section=sections.find(s=>s.id===state.id);if(section)section.coordinate=state.origin;}
  else if(state.type==='leader'){const note=leaders.find(n=>n.id===state.id);if(note)note.at=state.origin;}
 }
 host.addEventListener('click',e=>{
  if(!sheet||drag||busy||picking||action||suppressClick)return;
  const item=e.target.closest(holeTargets);
  if(item){e.stopImmediatePropagation();inspectHole(item);}
  else if(inspectedHole){inspectedHole=null;syncInspectedHole();status('穴の選択を解除しました');}
 },true);
 function activateHoleKey(e){
  const item=e.target.closest('[data-hole-row],[data-hole-marker]');
  if(!item||busy||picking||action||drag||!['Enter',' '].includes(e.key))return false;
  e.preventDefault();inspectHole(item);return true;
 }
 host.addEventListener('pointerdown',e=>{
  if(drag||picking||action||busy||e.button!==0||!sheet)return;
  const resize=e.target.closest('[data-view-resize]');
  if(resize){beginViewResize(e,resize.dataset.viewResize);return;}
  const grip=e.target.closest('[data-comment-resize]');
  if(grip){
   const note=sheet.notes.find(item=>item.id===grip.dataset.commentResize);
   if(note)startPaperDrag(e,{type:'commentWidth',note,previousWidth:note.wrapWidth,initialWidth:note.wrapWidth??note.width},true);
   return;
  }
  const edge=e.target.closest('[data-break-edge]');
  if(edge){beginBreakDrag(e,edge);return;}
  const cut=e.target.closest('[data-section]');
  if(cut){
   extraTarget=cut.dataset.section;
   const section=sections.find(s=>s.id===extraTarget);
   startPaperDrag(e,{type:'section',id:section.id,origin:section.coordinate},true);extraControls();return;
  }
  if(!$('drawing-layout-mode').checked)return;
  const dimension=dimensionHit(e,'[data-dimension],[data-detail-dimension-index]'),comment=e.target.closest('[data-comment]'),
   table=e.target.closest('[data-hole-table]'),leader=e.target.closest('[data-leader]');
  const view=e.target.closest('[data-view]')?.dataset.view??e.target.closest('[data-hole-labels]')?.dataset.holeLabels;
  if(leader){
   const note=leaders.find(item=>item.id===leader.dataset.leader);
   if(note)startPaperDrag(e,{type:'leader',id:note.id,origin:[...note.at]});
  }else if(dimension){
   const index=dimension.dataset.detailDimensionIndex;
   beginDimensionDrag(e,Number(index??dimension.dataset.dimension),index!==undefined);
  }else if(comment)startPaperDrag(e,beginCommentDrag(comment.dataset.comment));
  else if(table)startPaperDrag(e,{type:'holeTable',name:'holeTable',origin:[sheet.holeBox.x,sheet.holeBox.y]});
  else if(view)startPaperDrag(e,{type:'view',name:view,origin:[sheet.layout[view].x,sheet.layout[view].y]});
 });
 function movePaperDrag(e){
  if(!sheet||!drag||e.pointerId!==drag.pointerId)return;
  const p=paperPoint(e),dx=p[0]-drag.start[0],dy=p[1]-drag.start[1];
  if(drag.type==='break'){previewBreakDrag(p,dx,dy);return;}
  if(!drag.moved){
   if((drag.type==='commentWidth'?Math.abs(dx):Math.hypot(dx,dy))<=.3)return;
   drag.moved=true;host.setPointerCapture(e.pointerId);
  }
  if(drag.type==='viewResize')resizeDrawingView(drag,dx,dy);
  else if(drag.type==='commentWidth'){
   if(Math.abs(dx)<1e-6)restorePaperDrag(drag);
   else{
    const width=Math.max(minCommentWidth,Math.min(commentWidthLimit(drag.note),Math.round((drag.initialWidth+dx)*10)/10));
    setCommentWidth(drag.note,width);
   }
   $('drawing-comment-width').value=commentWidths[drag.note.id]??'';
   render(false);
  }else if(drag.type==='section'){
   const section=sections.find(s=>s.id===drag.id),pos=local(section.view,p),axis=section.orientation==='vertical'?0:1;
   section.coordinate=snapCut(section.view,axis,pos[axis],e.altKey);render(false);
  }else if(drag.type==='leader'){
   const note=leaders.find(item=>item.id===drag.id),start=map(note.view,drag.origin);
   note.at=local(note.view,[start[0]+dx,start[1]+dy]);render(false);
  }else if(drag.type==='dimension')moveDrawingDimension(drag,dx,dy,e);
  else moveDrawingPlacement(drag,dx,dy,e);
 }
 host.addEventListener('pointermove',e=>{
  if(drag)movePaperDrag(e);else if(sheet&&action)actionPreview(e);
  else if(sheet&&picking&&!picking.ready&&!busy&&e.pointerType!=='touch')previewDimensionTarget(e);
 });
 host.addEventListener('pointerleave',e=>{
  if(drag?.pointerId===e.pointerId&&!host.hasPointerCapture(e.pointerId))drag=null;
  if(action?.kind==='dimensionPoint')viewportHost.querySelector('[data-action-preview]')?.remove();
  clearDimensionHover();
 });
 host.addEventListener('pointercancel',clearDimensionHover);
 function finishPaperDrag(commit){
  const finished=drag;drag=null;
  suppressClick=!!finished.moved||finished.type==='commentWidth';
  if(host.hasPointerCapture(finished.pointerId))host.releasePointerCapture(finished.pointerId);
  if(!finished.moved)return;
  if(!commit){restorePaperDrag(finished);render(false);return;}
  if(finished.followers?.length&&sheet)retainViewPositions(sheet.layout,pagePositionMap(),linkedDrawingViews);
  if(finished.type==='break'){
   breakRange=finished.next;if(!applyAutomaticLayout())render();
  }else if(finished.type==='section'){
   const section=sections.find(s=>s.id===finished.id),coordinate=section.coordinate;
   section.coordinate=finished.origin;
   if(coordinate!==finished.origin)editSection(section,{coordinate});else render(false);
  }else if(finished.type==='viewResize'&&!finished.resized)render(false);
  else render(true,{reflowDimensions:finished.type==='viewResize'&&!finished.page});
 }
 for(const type of ['pointerup','pointercancel','lostpointercapture'])host.addEventListener(type,e=>{
  if(e.pointerId!==drag?.pointerId)return;
  finishPaperDrag(type==='pointerup');
 });
 function restore(s){
  $('drawing-layout-label').checked=s?.options.showLayoutLabel??true;
  pdfPositions=structuredClone(s?.options.pdfPositions??{});
  pdfPageScales=structuredClone(s?.options.pdfPageScales??{});
  pdfViewScales=structuredClone(s?.options.pdfViewScales??{});
  dimensionPoints=structuredClone(s?.dimensionPoints??[]);
  autoDimensionTypesEnabled=[...(s?.options.autoDimensionTypes??autoDimensionKeys)];groupRepeatedDimensions=s?.options.groupRepeatedDimensions??true;dimensionList?.clear();
  uniqueOverallDimensions=s?.options.uniqueOverallDimensions??false;pdfPlacement=s?.options.pdfPlacement??'keep';
  linkedProjections=s?.options.linkedProjections??false;
  linkedProjectionScales=s?.options.linkedProjectionScales??false;
  autoIsoScale=s?.options.autoIsoScale;
  commentWidths=structuredClone(s?.options.commentWidths??{});inspectedHole=null;
  const lastColors=s?{}:readDrawingColorPreferences();
  backgrounds=Object.fromEntries(Object.keys(backgroundControls).map(key=>[key,s?.options[key]?.toLowerCase()??lastColors[key]??'#ffffff']));
  printPalette=s?.options.printPalette??lastColors.printPalette??'screen';
  commentColor=s?.options.commentColor??lastColors.commentColor??defaultDrawingCommentColor;
  const lastDimensions=Object.fromEntries(colorFields.map(([key])=>[key,lastColors[key]])
   .filter(([,color])=>color&&color!==defaultDrawingDimensionColor));
  dimensionColors=structuredClone(s?.options.dimensionColors??lastDimensions);
  leaders=structuredClone(s?.options.leaders||[]);pdfLayout=s?.options.pdfLayout??'';pageAssignments=structuredClone(s?.options.pageAssignments??{pageCount:2,views:{},comments:{}});selectedPlacements.clear();holeTable=s?.options.holeTable?structuredClone(s.options.holeTable):undefined;breakRange=s?.options.breakRange?.slice();breakAxis=s?.options.breakAxis??'';breakPercent=s?.options.breakPercent??defaultBreakPercent;commentFont=s?.options.commentFont??'';hiddenViews=structuredClone(s?.options.hiddenViews||{});dimensionReferences=structuredClone(s?.options.dimensionReferences||{});frontFrame=s?.options.frontFrame;autoDimensionViews=structuredClone(s?.options.autoDimensionViews||{});dimensionFontSize=s?.options.dimensionFontSize??standardDimensionFont;setViewSelection(s?.options.viewSelection??defaultDrawingViews);$('drawing-view-priority').value=s?.options.viewPriority??'balanced';setIsoMode(s?.options.isoMode??'full');sections=structuredClone(s?.options.sections||[]);details=structuredClone(s?.options.details||[]);markers=structuredClone(s?.options.markers||[]);action=null;comments=structuredClone(s?.options.comments||[]);activeComment='comment';mainComment=s?.comment||'';viewScales=structuredClone(s?.options.viewScales||{});commentSize=s?.options.commentSize??3.5;dimensions=structuredClone(s?.dimensions||[]);positions=structuredClone(s?.options.positions||{});layoutKind=s?.options.layout??'projection';projectionLocked=s?.options.projectionLocked??!drawingProjectionNames.some(name=>positions[name]);setScale(s?.scale||1);$('drawing-hidden').checked=s?.hidden??true;$('drawing-comment').value=s?.comment||'';for(const key of ['paper','orientation','name','revision','material','date']){const id={paper:'paper-size'}[key]||key;$('drawing-'+id).value=s?.options[key]??({paper:'A4',orientation:'landscape',date:new Date().toLocaleDateString('sv-SE')}[key]||'');}$('drawing-frame').checked=s?.options.frame??true;}
 dimensionList=installDrawingDimensionList(viewportBar,{
  read:()=>({dimensions,colors:dimensionColors,ready:!!data&&!!sheet&&!busy}),notify:status,
  onChange(next,{reflow=false}={}){if(!sheet||busy)return;dimensions=next;selection=null;picking=null;action=null;render(true,{reflowDimensions:reflow});},
  onFocus(index){if(!sheet||busy)return;const d=dimensions[index];if(!d)return;picking=null;action=null;selection={type:'dimension',index};editor();syncDimensionHint();
   const view=sheet.layout[d.view],placement=view&&dimensionPlacement({...d,hidden:false},sheet);
   if(placement){viewport.focus(placement.box);viewportHost.scrollIntoView({block:'nearest'});if(d.hidden){const svg=viewportHost.querySelector('svg');svg.insertAdjacentHTML('beforeend','<g data-hidden-dimension-preview="true" pointer-events="none" opacity=".55">'+dimensionSVG({...d,hidden:false},view,view.scale,index,dimensionColors)+'</g>');svg.querySelector('[data-hidden-dimension-preview] [data-dimension]')?.setAttribute('data-edit-selected','true');}}
   status(d.hidden?'非表示の寸法 '+(index+1)+' を薄く仮表示しています。SVG・PDFには出ません':placement?'寸法 '+(index+1)+'（'+dimensionLabel(d)+'）を選択しました':'この寸法のビューを表示すると図中で確認できます');}
 });
 const workspace=installDrawingWorkspace(dialog,inlineScales.element);
 dialog.append(snapLabel);
 dialog.addEventListener('click',event=>{
  if(!inlineScales.element.contains(event.target))inlineScales.close();
 });
 viewportHost.addEventListener('click',()=>{
  if(selection&&!action&&!picking)workspace.reveal($('drawing-editor'));
 });
 async function openDrawing(){
  if(dialog.open)return !!sheet;
  editingPage=-1;
  presets.reload();selection=null;frontFace=getFrontFace();
  features=structuredClone(getFeatures());visible=getVisible();selected=getSelected().filter(id=>visible.includes(id));
  source=drawingSignature(features);
  restore(saved);
  if(saved?.targetMode==='selected'&&saved.targets.every(id=>visible.includes(id)))selected=saved.targets.slice();
  $('drawing-target').value=saved?.targetMode==='visible'||!selected.length?'visible':'selected';
  const nextTargets=$('drawing-target').value==='selected'?selected:visible;
  const targetsChanged=!!saved&&!sameTargets(saved.targets,nextTargets);
  const refresh=!!saved&&(saved.signature!==source||targetsChanged);
  if(refresh){undo=[];redo=[];markers=markers.filter(item=>item.review);}
  $('drawing-layout-mode').checked=true;workspace.open();dialog.showModal();reloadDrawingMaterials();viewport.reset();
  return generate({refresh,targetsChanged});
 }
 document.getElementById('drawing-tool').onclick=()=>openDrawing();
 function clearTransient(){
  const d=drag;drag=null;inspectedHole=null;
  inlineScales.sync(null,{});
  clearDimensionHover();
  if(d){restorePaperDrag(d);if(host.hasPointerCapture(d.pointerId))host.releasePointerCapture(d.pointerId);}
  picking=null;action=null;selection=null;extraTarget='';suppressClick=false;$('drawing-layout-mode').checked=false;if(d)render(false);controls();$('drawing-preview').style.cursor='';$('drawing-preview').querySelector('[data-action-preview]')?.remove();
 }
 function cancel(){pdfPreview.close();if(!dialog.open&&!drag&&!picking&&!action&&!selection)return;clearTransient();++revision;busy=false;worker.reset();$('drawing-generate').disabled=false;if(dialog.open)dialog.close();}
 return {cancel,escape:()=>dialog.open&&inlineScales.close(true),openForPDF:openDrawing,
  async openForPrintSet(){if(await openDrawing())reviewPrintSet();},
  getState:()=>saved?structuredClone(saved):null,loadState:value=>{const parsed=readDrawingState(value);if(dialog.open)dialog.close();saved=parsed;undo=[];redo=[];selection=null;data=null;sheet=null;overviewSheet=null;restore(saved);}};
}
