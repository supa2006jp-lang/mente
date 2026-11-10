import * as THREE from 'three';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {LineSegments2} from 'three/addons/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js';
import {draggableDialog} from './draggable-dialog.js';
import {KernelClient} from './kernel-client.js';
import {STL_IMPORT_MAX_BYTES} from './stl-import-mesh.js';
import {stlIssueLabels} from './stl-inspection-view.js';

const labels = {
 boundary:'開いた辺',nonmanifold:'3面以上が共有する辺',orientation:'面の向きが不一致の辺',
 duplicate:'重複した面',degenerate:'面積がゼロの面',vertex:'面のつながりが分かれた頂点',intersection:'交差した面'
};
const fixLabels = {hole:'欠けた面を塞ぐ',orientation:'面の向きをそろえる',duplicate:'重複面を除く',degenerate:'面積ゼロの面を除く'};
const mm = value => value.toLocaleString('ja-JP',{maximumFractionDigits:4});

const circleLabels = {hole:'丸穴',cylinder:'円柱',blind:'止まり穴',counterbore:'座ぐり穴',stepped:'段付き円柱','stepped-hole':'段付き穴'};
const differenceColors = [0x286bb5,0x10a7a0,0xecb728,0xe1443d];
const circleTitle = circle => {
 const sizes = circle.steps?.map(step=>'Ø'+mm(step.radius*2)+' × '+mm(step.depth)+' mm（開始 '+mm(step.start)+' mm）').join(' ／ ')
  || 'Ø'+mm(circle.radius*2)+' mm';
 return circleLabels[circle.kind]+' '+sizes+' ／ 最大ずれの目安 '+mm(circle.deviation)+' mm';
};

function coloredSurface(mesh,values) {
 const positions = new Float32Array(mesh.triangles.length*3), colors = new Float32Array(positions.length);
 const palette = differenceColors.map(color=>new THREE.Color(color));
 for (let i=0;i<mesh.triangles.length;i+=3) {
  const value = values[i/3], color = palette[value<=.01?0:value<=.05?1:value<=.2?2:3];
  for (let j=0;j<3;j++) {
   const source = mesh.triangles[i+j]*3, target = (i+j)*3;
   for (let k=0;k<3;k++) positions[target+k]=mesh.vertices[source+k];
   color.toArray(colors,target);
  }
 }
 const geometry = new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
 return new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1}));
}

function surface({vertices,triangles},color,opacity) {
 const geometry = new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setIndex(triangles);
 geometry.computeVertexNormals();
 const material = new THREE.MeshStandardMaterial({color,opacity,transparent:opacity < 1,side:THREE.DoubleSide,flatShading:true,depthWrite:opacity === 1,polygonOffset:true,polygonOffsetFactor:-1});
 return new THREE.Mesh(geometry,material);
}

function lines(segments,color) {
 const geometry = new LineSegmentsGeometry().setPositions(segments);
 const material = new LineMaterial({color,linewidth:3,depthTest:false,depthWrite:false});
 const object = new LineSegments2(geometry,material);
 object.renderOrder = 125;
 return object;
}

function clearGroup(group) {
 for (const object of [...group.children]) {
  object.removeFromParent();
  object.geometry.dispose();
  object.material.dispose();
 }
}

function checkboxRow(title,checked,onToggle,focus) {
 const row = document.createElement('div'), label = document.createElement('label'), box = document.createElement('input');
 box.type = 'checkbox'; box.checked = checked; box.onchange = () => onToggle(box.checked);
 label.append(box,document.createTextNode(title)); row.append(label);
 if (focus) {
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = 'ここを見る'; button.setAttribute('aria-label',title+'の箇所を見る'); button.onclick = focus;
  row.append(button);
 }
 return {row,box};
}

export function createStlImportDialog({anchor,scene,fitPreview,getFeatures,canOpen,apply,notify}) {
 const button = document.createElement('button'), input = document.createElement('input');
 button.id = 'stl-import'; button.type = 'button'; button.textContent = 'STL読込';
 button.title = 'STLを検査して編集可能なソリッドに変換';
 input.id = 'stl-import-file'; input.type = 'file'; input.accept = '.stl,model/stl'; input.hidden = true;
 anchor.after(button,input);

 const dialog = document.createElement('dialog');
 dialog.id = 'stl-import-dialog';
 dialog.setAttribute('aria-labelledby','stl-import-title');
 dialog.innerHTML = `
  <div class="dialog-heading"><h2 id="stl-import-title">STLをソリッドに変換</h2><button type="button" data-close aria-label="閉じる">×</button></div>
  <p data-name></p>
  <p class="hint">座標はmmとして読み込みます。変換する部品を選び、必要な修正や円形の復元を確認してください。</p>
  <p data-status role="status" aria-live="polite"></p>
  <fieldset data-settings hidden>
   <legend>変換する部品</legend>
   <div class="workspace-actions"><button type="button" data-select>変換できる部品を選択</button><button type="button" data-deselect>選択を外す</button></div>
   <div data-parts></div>
   <div data-detail></div>
  </fieldset>
  <section data-review hidden aria-label="変換結果の検査">
   <strong>変換結果の検査</strong>
   <p data-review-summary></p>
   <div class="workspace-actions">
    <button type="button" data-heat aria-pressed="false" hidden>差を色で表示</button>
    <button type="button" data-maximum hidden>最大ずれを見る</button>
   </div>
   <div data-scale hidden>
    <div class="stl-difference-scale">
     <span style="--swatch:#286bb5">0.01以下</span><span style="--swatch:#10a7a0">〜0.05</span>
     <span style="--swatch:#ecb728">〜0.2</span><span style="--swatch:#e1443d">0.2超</span><span>mm</span>
    </div>
    <p>三角形ごとの測定点で最も大きいずれを色分けします。元の形状と変換後を切り替えると、両方向から確認できます。</p>
   </div>
   <div data-review-rows></div>
  </section>
  <div class="workspace-actions">
   <button type="button" data-fit disabled>全体を見る</button>
   <button type="button" data-compare hidden>元の形状を見る</button>
   <button type="button" data-preview disabled>変換プレビュー</button>
  </div>
  <div class="editor-actions">
   <button type="button" data-cancel>キャンセル</button>
   <button type="button" data-add class="accent" disabled>ソリッドを追加</button>
  </div>`;
 const style = document.createElement('style');
 style.textContent = `
  #stl-import-dialog{position:fixed;inset:auto min(24px,3vw) min(112px,12vh) auto;margin:0;z-index:210;
   width:min(440px,calc(100vw - 28px));max-height:80vh;overflow:auto;padding:16px;background:#f4fafc;color:#183c52;
   border:1px solid #85afc4;border-radius:10px;box-shadow:0 8px 24px #162d4433}
  #stl-import-dialog h2{margin:0;font-size:17px}
  #stl-import-dialog p{margin:7px 0;font-size:13px;line-height:1.5;overflow-wrap:anywhere}
  #stl-import-dialog [data-name]{font-weight:700}
  #stl-import-dialog [data-issues]{color:#ad3626}
  #stl-import-dialog [data-review]{border:1px solid #adc9da;border-radius:7px;padding:8px;margin:8px 0}
  #stl-import-dialog [data-review-rows]{max-height:155px;overflow:auto}
  #stl-import-dialog [data-review-rows] button{margin:2px 0 5px}
  #stl-import-dialog .stl-difference-scale{display:flex;gap:7px;flex-wrap:wrap;font-size:12px;margin-top:5px}
  #stl-import-dialog .stl-difference-scale span[style]{border-bottom:4px solid var(--swatch)}
  #stl-import-dialog fieldset{min-width:0;border:1px solid #adc9da;border-radius:7px;padding:8px;margin:8px 0}
  #stl-import-dialog [data-parts],#stl-import-dialog .stl-options{max-height:160px;overflow:auto}
  #stl-import-dialog [data-parts]>div,#stl-import-dialog .stl-options>div{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:3px 0}
  #stl-import-dialog [data-parts]>div[data-focused]{background:#ddf0f8}
  #stl-import-dialog [data-detail]{border-top:1px solid #cadbe5;margin-top:8px;padding-top:5px}
  #stl-import-dialog label{display:flex;align-items:center;gap:6px}
  #stl-import-dialog input[type=number]{width:72px;padding:4px;margin-left:auto}
  #stl-import-dialog summary{cursor:pointer;font-size:13px;font-weight:700;margin:6px 0}
  #stl-import-dialog .dialog-heading{display:flex;align-items:center;justify-content:space-between;cursor:grab;touch-action:none}
  #stl-import-dialog .editor-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:9px;flex-wrap:wrap}
  #stl-import-dialog button:not(.accent){color:#17475f;background:#e3f2f8;border:1px solid #99bbcd;padding:5px 8px}
  #stl-import-dialog button[hidden]{display:none}
 `;
 document.head.append(style);
 document.body.append(dialog);
 draggableDialog(dialog);

 const get = key => dialog.querySelector('[data-'+key+']');
 const kernel = new KernelClient();
 const sourceGroup = new THREE.Group(), markGroup = new THREE.Group(), outputGroup = new THREE.Group(), heatGroup = new THREE.Group();
 scene.add(sourceGroup,markGroup,outputGroup,heatGroup);
 let token = 0, session = '', parts = [], active = null, marker = null, outputs = null, compare = false;
 let original = null, name = '', busy = false, maxTriangles = 0;
 let reviews = [], heat = false, heatKey = '', reviewMarker = null;
 const activeReview = () => reviews.find(review=>review.part===active?.id);

 function reset() {
  token++;
  kernel.reset();
  for (const group of [sourceGroup,markGroup,outputGroup,heatGroup]) clearGroup(group);
  parts = []; active = marker = outputs = original = null;
  busy = compare = heat = false;
  reviews = []; heatKey = ''; reviewMarker = null;
  button.disabled = false;
 }
 function close() {
  if (dialog.open) dialog.close();
  reset();
 }
 function fitObject(object) {
  const bounds = new THREE.Box3().setFromObject(object);
  if (!bounds.isEmpty()) fitPreview(bounds);
 }
 function clearResult() {
  outputs = null; reviews = []; compare = heat = false;
  heatKey = ''; reviewMarker = null;
  clearGroup(outputGroup); clearGroup(heatGroup);
  renderReview();
 }
 const boundingBox = bounds => new THREE.Box3(...bounds.map(point=>new THREE.Vector3(...point)));
 function markerBounds(item) {
  if (item.bounds) return boundingBox(item.bounds);
  if (item.location) {
   const point = new THREE.Vector3(...item.location);
   return new THREE.Box3(point.clone(),point.clone()).expandByScalar(Math.max(1,item.maximum*2));
  }
  if (item.segments?.length) {
   const bounds = new THREE.Box3(), point = new THREE.Vector3();
   for (let i=0;i<item.segments.length;i+=3) bounds.expandByPoint(point.fromArray(item.segments,i));
   return bounds;
  }
  const body = outputGroup.children.find(object=>object.userData.stlOutput===item.id);
  return body && new THREE.Box3().setFromObject(body);
 }
 function drawReviewMarker() {
  if (reviewMarker.location) {
   const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...reviewMarker.location)]);
   const material = new THREE.PointsMaterial({color:0xf22670,size:12,sizeAttenuation:false,depthTest:false,depthWrite:false});
   const point = new THREE.Points(geometry,material); point.renderOrder=126;
   markGroup.add(point);
  } else if (reviewMarker.segments?.length) markGroup.add(lines(reviewMarker.segments,0xea3c2b));
  else {
   const bounds = markerBounds(reviewMarker);
   if (!bounds) return;
   const helper = new THREE.Box3Helper(bounds,reviewMarker.disconnected||reviewMarker.bounds?0xe89300:0xea3c2b);
   helper.material.depthTest=false; helper.renderOrder=126;
   markGroup.add(helper);
  }
 }
 function focusReviewMarker(item,problem) {
  if (problem) {compare = false; heat = false;}
  reviewMarker = item;
  renderReview(); update(); draw();
  const bounds = markerBounds(item);
  if (bounds && !bounds.isEmpty()) fitPreview(bounds);
 }
 function renderReview() {
  const rows = get('review-rows'), difference = activeReview()?.difference;
  rows.replaceChildren();
  const checked = reviews.filter(review=>review.print.ok).length;
  get('review-summary').textContent = reviews.length
   ? 'STL出力の検査 ／ '+checked+' / '+reviews.length+'部品で閉じたメッシュを確認'
   : '';
  get('heat').hidden = !difference;
  get('heat').textContent = heat ? '色分けを終了' : '差を色で表示';
  get('maximum').hidden = !heat || !(compare?difference?.before.location:difference?.after.location);
  if (difference) {
   const text = document.createElement('p');
   text.textContent = '部品 '+active.id+' ／ 測定点での最大ずれ '+mm(compare?difference.before.maximum:difference.after.maximum)+' mm（'+(compare?'元のSTL':'変換後')+'）';
   rows.append(text);
  }
  function issue(text,item) {
   const line = document.createElement('p'), button = document.createElement('button');
   line.textContent = text; line.dataset.issues = '';
   button.type = 'button'; button.textContent = '箇所を強調';
   button.setAttribute('aria-label',text+'を強調');
   button.onclick = () => focusReviewMarker(item,true);
   rows.append(line,button);
  }
  for (const review of reviews) {
   const label = '部品 '+review.part+' ／ ';
   const print = review.print;
   for (const problem of print.problems) {
    const description = problem.issues.map(item=>(stlIssueLabels[item.code]||item.code)+(item.count?' '+item.count+'件':'')).join(' ／ ');
    issue(label+description,problem);
   }
   for (const piece of print.pieces) {
    const dimensions = piece.bounds[1].map((max,i)=>mm(max-piece.bounds[0][i])).join(' × ');
    issue(label+(piece.disconnected?'同じボディ内に離れた塊':'小さな別部品')+'（'+dimensions+' mm）',piece);
   }
  }
 }
 function focusMarker(item) {
  marker = item;
  if (active) active.showReduction = false;
  if (outputs) compare = true;
  heat = false; reviewMarker = null;
  renderReview(); update(); draw();
  if (!item.segments.length) return;
  const bounds = new THREE.Box3(), point = new THREE.Vector3();
  for (let i=0; i<item.segments.length; i+=3) bounds.expandByPoint(point.fromArray(item.segments,i));
  fitPreview(bounds);
 }
 function draw() {
  clearGroup(markGroup);
  const difference = activeReview()?.difference;
  heatGroup.visible = !!(outputs && heat && difference);
  outputGroup.visible = !!outputs && !compare && !heatGroup.visible;
  sourceGroup.visible = !outputGroup.visible && !heatGroup.visible;
  get('compare').textContent = compare ? '変換後の形状を見る' : '元の形状を見る';
  for (const part of parts) {
   if (part.object) {
    part.object.material.opacity = part === active ? .68 : part.selected ? .40 : .15;
    part.object.material.color.set(part === active ? 0x168bad : part.selected ? 0x38a2b9 : 0x78929c);
    part.object.visible = !(part === active && part.showReduction && part.reduction && !outputs);
   }
  }
  if (heatGroup.visible) {
   const key = active.id+':'+compare;
   if (heatKey!==key) {
    clearGroup(heatGroup);
    heatGroup.add(compare?coloredSurface(active.mesh,difference.before.values):coloredSurface(difference.mesh,difference.after.values));
    heatKey=key;
   }
  }
  if (reviewMarker) drawReviewMarker();
  if (!active || outputGroup.visible || heatGroup.visible) return;
  if (active.showReduction && active.reduction && !outputs) {
   markGroup.add(surface(active.reduction.mesh,0x32a780,.83));
   return;
  }
  if (active.segments.length) markGroup.add(lines(active.segments,0xf04431));
  for (const circle of active.circles) {
   if (circle === marker || active.useCircles.has(circle.id)) markGroup.add(lines(circle.segments,0x733fe0));
  }
  if (marker && !active.circles.includes(marker)) {
   if (marker.segments.length) markGroup.add(lines(marker.segments,0xe5a000));
   if (marker.caps?.length) markGroup.add(surface({vertices:active.mesh.vertices,triangles:marker.caps},0x15b47d,1));
  }
 }
 function blockReason(part) {
  if (part.message) return part.message;
  if (part.repairs.some(item => !part.useRepairs.has(item.id))) return '修正候補の採用が必要';
  if (part.useCircles.size) return '';
  if ((part.useReduction ? part.reduction.after : part.triangles) > maxTriangles) return '簡略化が必要';
  return '';
 }
 function update() {
  get('settings').disabled = busy;
  const selected = parts.filter(part => part.selected);
  get('fit').disabled = !parts.length;
  get('preview').disabled = busy || !selected.length || selected.some(part => blockReason(part));
  get('add').disabled = busy || !outputs;
  get('compare').hidden = !outputs;
  get('review').hidden = !outputs;
  get('heat').setAttribute('aria-pressed',String(heat));
  get('scale').hidden = !heat || !activeReview()?.difference;
  for (const part of parts) {
   part.row?.toggleAttribute('data-focused',part === active);
   if (part.box) part.box.checked = part.selected;
  }
 }
 function selectionStatus() {
  const selected = parts.filter(part => part.selected);
  const blocked = selected.find(part => blockReason(part));
  get('status').textContent = blocked ? '部品 '+blocked.id+' ／ '+blockReason(blocked)
   : selected.length ? selected.length+'部品を選択中。変換プレビューで確認できます。'
   : '変換する部品を選んでください。';
 }
 function changed() {
  clearResult();
  selectionStatus();
  update(); draw();
 }
 function choosePart(part,zoom) {
  active = part; marker = null; reviewMarker = null;
  if (!activeReview()?.difference) heat = false;
  renderDetail(); renderReview();
  update(); draw();
  if (zoom && part.object) fitObject(part.object);
 }
 function addDetail(text,{issue=false}={}) {
  const p = document.createElement('p');
  p.textContent = text;
  if (issue) p.dataset.issues = '';
  get('detail').append(p);
 }
 function optionList(title) {
  const details = document.createElement('details'), heading = document.createElement('summary'), list = document.createElement('div');
  details.open = true; heading.textContent = title; list.className = 'stl-options';
  details.append(heading,list); get('detail').append(details);
  return list;
 }
 function renderDetail() {
  const detail = get('detail');
  detail.replaceChildren();
  const part = active;
  if (!part) return;
  const problems = Object.entries(part.counts).filter(([,count]) => count).map(([type,count]) => labels[type]+' '+count.toLocaleString()+'件');
  if (problems.length) addDetail(problems.join(' ／ ')+'。赤は問題箇所。'+(part.segmentsTruncated?'一部を表示しています。':''),{issue:true});
  if (part.message) addDetail(part.message,{issue:true});
  if (part.repairs.length || part.unfilled.length) {
   const list = optionList('修正候補 ／ 部品 '+part.id);
   if (part.repairs.length > 1) {
    const all = document.createElement('button');
    all.type = 'button'; all.textContent = 'この部品の修正をすべて採用';
    all.onclick = () => {part.useRepairs = new Set(part.repairs.map(item => item.id)); renderDetail(); changed();};
    list.before(all);
   }
   for (const fix of part.repairs) {
    const {row} = checkboxRow(fixLabels[fix.type]+'（'+fix.count+'面）',part.useRepairs.has(fix.id),checked => {
     if (checked) part.useRepairs.add(fix.id); else part.useRepairs.delete(fix.id);
     marker = fix; active.showReduction = false; changed(); updateReductionActions();
    },() => focusMarker(fix));
    list.append(row);
   }
   for (const hole of part.unfilled) {
    const {row,box} = checkboxRow('自動で塞げない開口（'+hole.count+'辺）',false,() => {},() => focusMarker(hole));
    box.disabled = true; list.append(row);
   }
  }
  if (part.circles.length) {
   const list = optionList('円柱・丸穴の復元（紫）');
   for (const circle of part.circles) {
    const {row,box} = checkboxRow(circleTitle(circle),part.useCircles.has(circle.id),checked => {
     if (checked) part.useCircles.add(circle.id); else part.useCircles.delete(circle.id);
     marker = circle; part.showReduction = false; changed(); updateReductionActions();
    },() => focusMarker(circle));
    box.disabled = part.useReduction; list.append(row);
   }
  }
  if (part.message || part.triangles < 8) return;
  const simplify = document.createElement('details'), heading = document.createElement('summary');
  heading.textContent = '三角形の簡略化'; simplify.open = part.triangles > maxTriangles || !!part.reduction;
  simplify.append(heading); detail.append(simplify);
  const field = (label,value,min,max,step,save) => {
   const row = document.createElement('label'), number = document.createElement('input');
   row.append(document.createTextNode(label),number); simplify.append(row);
   Object.assign(number,{type:'number',value,min,max,step,required:true});
   number.oninput = () => {
    save(number.value);
    part.reduction = null; part.useReduction = part.showReduction = false;
    adoptRow?.remove(); reductionText?.remove();
    changed(); updateReductionActions();
   };
   return number;
  };
  let adoptRow, reductionText;
  const percentage = field('残す割合の目標 (%)',part.percentage,5,95,1,value => {part.percentage = value;});
  const tolerance = field('測定点で許容するずれ (mm)',part.tolerance,.001,5,.001,value => {part.tolerance = value;});
  const trial = document.createElement('button');
  trial.type = 'button'; trial.textContent = '簡略化を試す'; trial.dataset.simplify = '';
  simplify.append(trial);
  trial.onclick = () => run({type:'stlImportSimplify',part:part.id,percentage:percentage.valueAsNumber,maxDeviation:tolerance.valueAsNumber},data => {
   part.reduction = data; part.showReduction = true; part.useReduction = false;
   marker = null; renderDetail(); changed();
   get('status').textContent = '簡略化の候補を表示しています。採用する場合はチェックしてください。';
  },'簡略化を計算しています…');
  if (part.reduction) {
   const {before,after,deviation} = part.reduction;
   reductionText = document.createElement('p');
   reductionText.textContent = before.toLocaleString()+' → '+after.toLocaleString()+'三角形 ／ 測定点の最大ずれ '+mm(deviation)+' mm';
   simplify.append(reductionText);
   const {row} = checkboxRow('簡略化した形を採用',part.useReduction,checked => {
    part.useReduction = checked; part.showReduction = checked;
    renderDetail(); changed();
   },() => {part.showReduction = !part.showReduction; draw();});
   adoptRow = row; simplify.append(row);
  }
  updateReductionActions();
 }
 function updateReductionActions() {
  const trial = get('simplify');
  if (!trial) return;
  trial.disabled = active.useCircles.size > 0 || active.repairs.some(fix => !active.useRepairs.has(fix.id)) ||
   [...trial.parentElement.querySelectorAll('input[type=number]')].some(input => !input.checkValidity());
  const adopt = trial.parentElement.querySelector('input[type=checkbox]');
  if (adopt) adopt.disabled = active.useCircles.size > 0;
 }
 function present(data) {
  maxTriangles = data.maxTriangles;
  const list = get('parts');
  list.replaceChildren();
  parts = data.parts.map(part => {
   const entry = {...part,selected:!part.message && part.triangles <= maxTriangles,
    useRepairs:new Set(),useCircles:new Set(),useReduction:false,showReduction:false,
    percentage:Math.max(5,Math.min(50,Math.floor(maxTriangles/part.triangles*100))),tolerance:.05};
   if (part.mesh.triangles.length) {
    entry.object = surface(part.mesh,0x1e93b5,.40);
    sourceGroup.add(entry.object);
   }
   const title = '部品 '+part.id+' ／ '+part.triangles.toLocaleString()+'三角形'+(part.message?' ／ 要修復':'');
   const {row,box} = checkboxRow(title,entry.selected,checked => {entry.selected = checked; changed();},() => choosePart(entry,true));
   box.disabled = !!part.message; entry.row = row; entry.box = box; list.append(row);
   return entry;
  });
  get('settings').hidden = false;
  choosePart(parts.find(part => part.selected) || parts[0],false);
  changed(); fitObject(sourceGroup);
 }
 async function run(spec,onResult,message) {
  if (busy) return;
  const request = token, current = () => request === token && dialog.open && original === getFeatures();
  busy = true;
  get('status').textContent = message;
  update();
  try {
   const result = await kernel.run([], {...spec,session,id:spec.id || crypto.randomUUID()},{
    foreground:true,onProgress:p => {
     if (current()) get('status').textContent = p.stage+(p.total ? ' '+p.current+' / '+p.total : '');
    }
   });
   if (current()) onResult(result);
  } catch (error) {
   if (current()) get('status').textContent = error.message;
  } finally {
   if (request === token) {busy = false; update();}
  }
 }
 dialog.addEventListener('close',() => {if (!dialog.open && original) reset();});
 dialog.addEventListener('cancel',event => {event.preventDefault(); close();});
 get('close').onclick = get('cancel').onclick = close;
 get('fit').onclick = () => fitObject(heatGroup.visible?heatGroup:outputGroup.visible?outputGroup:sourceGroup);
 get('compare').onclick = () => {compare = !compare; reviewMarker = null; renderReview(); draw();};
 get('heat').onclick = () => {
  heat = !heat; reviewMarker = null;
  renderReview(); update(); draw();
 };
 get('maximum').onclick = () => {
  const difference = activeReview()?.difference;
  const sample = compare?difference?.before:difference?.after;
  if (sample?.location) focusReviewMarker(sample,false);
 };
 get('select').onclick = () => {for (const part of parts) part.selected = !blockReason(part); changed();};
 get('deselect').onclick = () => {for (const part of parts) part.selected = false; changed();};
 get('preview').onclick = () => {
  clearResult(); draw();
  run({type:'stlImport',review:true,maxBodies:150-original.length,parts:parts.filter(part => part.selected).map(part => ({
   part:part.id,repairs:[...part.useRepairs],circles:[...part.useCircles],
   simplification:part.useReduction ? part.reduction.id : null
  }))},result => {
   outputs = result.outputs; reviews = result.reviews;
   for (const body of outputs) {
    const object = surface(body,0x229976,1);
    object.userData.stlOutput = body.id;
    outputGroup.add(object);
   }
   if (!activeReview()) choosePart(parts.find(part=>part.id===reviews[0].part),false);
   const warnings = reviews.filter(review=>!review.print.ok||review.print.pieces.length).length;
   get('status').textContent = outputs.length+'個のソリッドに変換しました。'+(warnings?'STL出力の検査結果を確認してください。':'STL出力の検査を完了しました。');
   renderReview();
   draw(); fitObject(outputGroup);
  },'変換を準備しています…');
 };
 get('add').onclick = () => {
  if (!outputs || busy || original !== getFeatures()) return;
  try {apply(name,outputs); close();}
  catch (error) {get('status').textContent = error.message;}
 };
 button.onclick = () => {if (canOpen()) input.click();};
 input.onchange = async () => {
  const file = input.files[0];
  input.value = '';
  if (!file || !canOpen()) return;
  original = getFeatures();
  const request = ++token;
  session = crypto.randomUUID();
  name = file.name.replace(/\.stl$/i,'').slice(0,80) || 'STL';
  button.disabled = true;
  get('name').textContent = file.name;
  get('status').textContent = 'ファイルを読み込んでいます…';
  get('settings').hidden = true;
  update();
  dialog.show();
  try {
   if (!/\.stl$/i.test(file.name)) throw Error('.stlファイルを選択してください');
   if (file.size > STL_IMPORT_MAX_BYTES) throw Error('32 MB以下のSTLファイルを指定してください');
   const data = await file.arrayBuffer();
   if (request === token && dialog.open && original === getFeatures()) {
    await run({type:'stlImportInspect',id:session,data},present,'STLの部品を検査しています…');
   }
  } catch (error) {
   if (request === token && dialog.open) get('status').textContent = error.message;
  }
 };
 return {close,sync() {if (dialog.open && original !== getFeatures()) close();}};
}
