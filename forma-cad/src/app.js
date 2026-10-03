import {edgeTurnFrame,upperEdgeBody,edgeQuarterTurn} from './edge-quarter-turn.js';
import {installRenderRecovery} from './render-recovery.js';
import {zoomAtPointer,fitSelectionBox} from './selection-view.js';
import {scopedFaceGrid,faceGridBounds,faceGridContains} from './face-grid.js';
import {planeViewBounds,viewportGridLayout,fitCameraDepth} from './viewport-grid.js';
import {createBodyDisplay} from './body-display.js';
import {isSectionSplit,sectionBodyStyles} from './section-split.js';
import {taperArcPoint,taperDragAngle,extrusionEndDimensions} from './extrusion-feedback.js';
import {installMiddleClickEnter} from './middle-click-enter.js';
import {oppositeFacePlacement} from './opposite-face-placement.js';
import {createViewCube} from './view-cube.js';
import {coilSplitPlacement} from './coil-split-view.js';
import {coilStopFacePlacement} from './coil-stop-face-view.js';
import {captureProjectPreview,createProjectLoadPreview} from './project-preview.js';
import {installCoilPresets,coilPresetFields} from './coil-presets.js';
import {createCoilSection} from './coil-section.js';
import {createCoilPrintTools} from './coil-print-tools.js';
import {coilOpeningLimit,coilOpeningTransform} from './coil-opening.js';
import {accelerateMeshPicking} from './mesh-picking.js';
import {readDrawingState} from './drawing-state.js';
let drawingController=null;
import {installDrawing} from './drawing-dialog.js';
import {edgeFilletReferences} from './edge-references.js';
import {rangeBodyIds,rangeEdgeHits} from './selection-filter.js';
import {cadFaceGroup,cadFaceKey,cadFaceGeometry,cadFaceSelections,isFaceSelected} from './face-selection.js';
import {referenceImages} from './reference-images.js';
let imageReferences;
import {sectionView} from './section-view.js';
let sectionControl,bodyDisplay;
import {throughDepth,depthToGridPlane} from './extrusion-extent.js';
import {extrusionIntersections} from './extrusion-auto-cut.js';
import {replayHistory} from './history-replay.js';
import {warmKernelOnInteraction} from './kernel-warmup.js';
import {hideShellProfiles} from './shell-profile-visibility.js';
import {dimensionPositions} from './dimension-layout.js';
let loftSections=[],loftHighlight=null,loftMarkers=[];
let revolveRegion=null,revolveEdge=null,revolvePicking="profile",revolvePreview=null,revolveTimer=null,revolveRevision=0;
let activeSketchGroup=null,editingSketchGroup=null,pendingDrawingView=null;
let polygonMode=false;
import {tangentArc} from './tangent-arc.js';
import {extrusionView} from './extrusion-view.js';
import {kernelClient} from './kernel-client.js';
import {patternSketch} from './patterns.js';
import {trimSketch} from './trim-sketch.js';
import {sketchLine,updateSketchLine} from './sketch-line.js';
import {sketchMidpoints} from './sketch-midpoints.js';
let deletingSketch=false;
import {rangeSketchHits,sketchSegments,deleteSketchSelection,offsetSketchSelection} from './sketch-selection.js';
let selectedSketchSegments=new Map(),sketchSelectionHighlight=null;
import {cadGrid} from './cad-grid.js';
import {createExtrusionWheel} from './extrusion-wheel.js';
import {projectedBounds,findPanelSpace} from './panel-placement.js';
import {extrusionDragAxis,extrusionArrowAngle,extrusionDragDistance} from './extrusion-drag.js';
import {holesOnlyProblem} from './holes-only-options.js';
import {regionExtrusions} from './region-extrusions.js';
let selectedRegions=[];
import {installPatternPreview} from './pattern-preview.js';
import {createMoveTool} from './move-tool.js';
let moveTool=null,boxSelection=null,toolCancelRevision=0;
import {draggableDialog,cancelDialogDrags} from './draggable-dialog.js';
import {installBoxSelection,rangeFaceHits} from './box-selection.js';
import {orbitView} from './view-orbit.js';
import {drawingCrosshair} from './drawing-crosshair.js';
import {renderThreadPullOptions,threadPullOptions} from './thread-pull-dialog.js';
import {saveStl} from './save-stl.js';
import {renderThreadDialog,threadDialogSpec} from './thread-dialog.js';
import {cylindricalSelection} from './cylindrical-selection.js';
import {sketchIntersections} from './sketch-intersections.js';
import {bodyEdges} from './body-edges.js';
import {featureCircularEdges} from './circular-edges.js';
import {solidReferencePoints} from './reference-points.js';
import {roundPointMaterial} from './round-point-material.js';
import {offsetSketch} from './sketch-offset.js';
import {basisFor,planarFace,worldPoint} from './frames.js';
import {findRegions,regionFaceGeometry,regionContains,sketchPoints,planeCoordinates} from './regions.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {STLExporter} from 'three/addons/exporters/STLExporter.js';
import {defaults,makeSketchGeometry,makeGeometry,rebuild,validateProject,validateFeature,volume} from './geometry.js';
const $=id=>document.getElementById(id),clone=x=>structuredClone(x);
draggableDialog(document.getElementById('tools-dialog'));
const numeric=['width','height','diameter','depth','wall','x','y','z','angle','taperAngle'];
const settings=['profile','side','plane','operation','target',...numeric];
// Keep exact model distances while showing at most two decimal places.
let preciseDepth=null,depthInputInternal=false;
const depthDisplay=value=>Number.isFinite(Number(value))&&String(value).trim()!==''?String(Number(Number(value).toFixed(2))):'';
function depthValue(){const input=$('depth');if(input.value.trim()==='')return NaN;return preciseDepth&&input.value===preciseDepth.display?preciseDepth.value:Number(input.value);}
function displayDepth(value){const input=$('depth'),display=depthDisplay(value);input.value=display;preciseDepth={value:Number(value),display:input.value};}

const profileNames={point:'点',rect:'長方形',circle:'円',line:'線分',region:'閉じた領域',spline:'フィット点スプライン',polyline:'オフセット輪郭'};
let editingSectionSplitId=null,sectionEditOriginal=null;
let features=[],selected=null,mode='solid',meshes=new Map(),hiddenBodies=new Set(),past=[],future=[],modified=false,sketch=false,firstPoint=null,showEdges=true;
let centerRectangle=false;
let selectedFaces=[],selectingFaces=false,edgeSelectionMode=false;
let selectionMode='auto',selectedBodies=new Set(),bodySelectionHighlight=null,editingPipeId=null,editingEncloseId=null,editingCoilJointId=null,editingEncloseVisibility=[];
let selectedEdges=[],gridPlane='XY',selectedEdge=null,selectedSurface=null,edgeHighlight=null,shiftOrbit=null,sketchPan=null,gridSignature='',modelGridKey='',hoverEdge=null,hoverTime=0,circleDiameterLocked=false;
let patternCenter=null,centerCandidates=[],centerRevision=null,referencePointer=null;
document.addEventListener("pointermove",e=>{referencePointer={x:e.clientX,y:e.clientY};});
document.addEventListener("pointerleave",()=>{referencePointer=null;});
const gridVisibility={XY:true,XZ:true,YZ:true,CUSTOM:true};
let intersectionRevision=null,intersectionPoints=[];
function getIntersectionPoints(){if(intersectionRevision!==features){intersectionRevision=features;intersectionPoints=sketchIntersections(visibleSketchFeatures());}return intersectionPoints;}
let holeActive=false,holePlacement=null,holeHoverFace=null;
let fragmentSelection=null;
let pendingOperation='new',activeFrame=null,selectedFace=null,selectedBody=null,splinePoints=[],splinePreview=null,gridStep=10,lastGridStep=0,pendingKernelCancel=null;
let extrusionManualOperation=false,extrusionDefaultOperation='new',extrusionGridPlane='XY',autoCutRevision=0,autoCutTimer=null;
let stage='model',draftTouched=false,chosenRegion=null,regionPayload=null,pendingExtrude=false,regionList=[],chainStart=null,chainCount=0;
let aligningSketchId=null,aligningSketchVersion=null,hingeAlignButtons=[],hingeAlignCamera='';

let extrusionRemovalTimer=null,extrusionRemovalRevision=0,contactAutoDepth=false,contactDistanceLimit=null;
let preview=null,sketchMarker=null,toastTimer,extrusionDrag=null,taperDrag=null;
let splitPreviewPlane=null,splitPreviewKey='',splitDrag=null,splitStateCache=null,splitStateKey='';
const host=$('canvas-host'),scene=new THREE.Scene();scene.background=new THREE.Color('#ffffff');
let coilSectionSource=null,coilSectionRequest=0,coilPrintTools=null;const coilSection=createCoilSection(host.parentElement,updateCoilSection);
async function updateCoilSection(){
 const source=coilSectionSource,request=++coilSectionRequest;coilSection.pending();if(!source){coilSection.error('形状プレビューができると断面を表示します。');return;}
 try{const closed=['閉じた状態','開閉スライダー'].includes(source.spec.jointPose)&&!source.spec.flipLidToGrid,result=closed?source.result:await kernelClient.run(source.input,{type:'preview',operation:{...source.spec,jointPose:'閉じた状態',jointOpenTurns:0,flipLidToGrid:false}});if(request!==coilSectionRequest||source!==coilSectionSource||!coilSection.active)return;coilSection.update(result.outputs,result.analysis);}catch(e){if(request===coilSectionRequest&&coilSection.active)coilSection.error(e.message);}
}
const sketchGroup=new THREE.Group();scene.add(sketchGroup);const regionGroup=new THREE.Group();scene.add(regionGroup);
const camera=new THREE.OrthographicCamera(-100,100,100,-100,.1,100000);camera.up.set(0,0,1);camera.position.set(140,-180,150);
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(renderer.domElement);}
catch(e){$('fatal').hidden=false;$('fatal').textContent='3D表示を開始できません。ブラウザのハードウェアアクセラレーションを有効にして再読み込みしてください。';throw e;}
renderer.outputColorSpace=THREE.SRGBColorSpace;
const crosshair=drawingCrosshair(host,renderer.domElement,()=>sketch||holeActive);
const middleConfirm=installMiddleClickEnter(pressWheelEnter,event=>!event.target.closest?.('textarea,[contenteditable]')&&(event.target===renderer.domElement||!!event.target.closest?.('#center-markers,form')));
function pressWheelEnter(focus){
 const active=focus?.isConnected&&focus.getClientRects().length?focus:document.body;
 const targeted=active.matches?.('input,select,textarea')||active.closest?.('dialog,[role="menu"],#move-panel');
 const target=targeted?active:document.body;if(!targeted)document.activeElement?.blur();
 const key=new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true});target.dispatchEvent(key);
 if(!key.defaultPrevented){
  if(target.matches?.('button')&&!target.disabled)target.click();
  else if(target.form){const submit=[...target.form.querySelectorAll('button,input')].find(el=>el.type==='submit'&&!el.disabled);if(submit)target.form.requestSubmit(submit);}
 }
 target.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));
}
function confirmVisibleForm(){const form=document.querySelector('dialog[open] form')||(moveTool?.active?$('move-panel'):holeActive?$('hole-panel'):stage==='extrusion'&&!pendingExtrude?$('extrude-distance'):stage==='sketch'&&!sketch?$('editor'):null);if(!form||!form.getClientRects().length)return false;const submit=[...form.querySelectorAll('button,input')].find(el=>el.type==='submit'&&!el.disabled);if(!submit)return false;form.requestSubmit(submit);return true;}
let controls=new OrbitControls(camera,renderer.domElement);controls.zoomToCursor=true;controls.mouseButtons.LEFT=null;controls.mouseButtons.MIDDLE=THREE.MOUSE.PAN;controls.enableDamping=true;controls.dampingFactor=.12;controls.target.set(0,0,12);controls.minDistance=2;controls.maxDistance=50000;controls.minZoom=.002;controls.maxZoom=10000;
scene.add(new THREE.HemisphereLight(0xffffff,0x77756e,1.2));const key=new THREE.DirectionalLight(0xffffff,2.0);key.position.set(-100,-180,240);scene.add(key);const fill=new THREE.DirectionalLight(0xffffff,.3);fill.position.set(-100,40,60);scene.add(fill);
let grid=cadGrid(10,100);grid.rotation.x=Math.PI/2;grid.position.z=-.05;scene.add(grid);
const axisGroup=new THREE.Group();
for(const [end,color] of [[[5000,0,0],0xe94b55],[[0,5000,0],0x42ba54],[[0,0,5000],0x367cdd]]){const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...end).negate(),new THREE.Vector3(...end)]);axisGroup.add(new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:true,opacity:.65})));}scene.add(axisGroup);
const modelGroup=new THREE.Group();scene.add(modelGroup);
const observer=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(w&&h){renderer.setSize(w,h);camera.left=-100*w/h;camera.right=100*w/h;camera.updateProjectionMatrix();}});observer.observe(host);
let viewCube=null;
renderer.setAnimationLoop(()=>{viewCube?.update();updateSelectionUI();if(moveTool?.active)controls.enabled=false;if(controls.enabled)controls.update();host.dataset.cameraTarget=JSON.stringify(controls.target.toArray());updateSketchGrid();updateCameraDepth();host.dataset.cameraState=JSON.stringify([...camera.position.toArray(),...camera.quaternion.toArray(),camera.zoom]);host.dataset.cameraClip=JSON.stringify([camera.near,camera.far]);sectionControl?.update();crosshair.update();updateExtrusionOverlay();updateSplitPreview();updateCoilFilletOverlay();updateCoilSplitOverlay();updateCoilStopFaceOverlay();updateCircleInput();updateSketchDimensions();updateCenterMarkers();updateHingeAlignMarkers();updateEdgeOverlay();if($('tools-dialog').open||$('template-dialog')?.open){updateBodyNames();if(loftMarkers.length)updateLoftMarkers();}else if(!bodyNames.hidden)bodyNames.hidden=true;if(bodyDisplay)bodyDisplay.withDisplay(()=>renderer.render(scene,camera));else renderer.render(scene,camera);});
let sketchNoticeTimer,enteredSketchNumber=null;
function sketchSession(){if(enteredSketchNumber!==null)return features.find(f=>f.kind==='sketch'&&f.groupNumber===enteredSketchNumber)||{groupNumber:enteredSketchNumber};const id=editingSketchGroup||activeSketchGroup;return features.find(f=>f.kind==='sketch'&&f.groupId===id)||features.find(f=>f.kind==='sketch'&&f.id===selected)||null;}
function notifySketch(message){hideExtrusionNotice();clearTimeout(toastTimer);$('toast').style.display='none';const notice=$('sketch-notice');clearTimeout(sketchNoticeTimer);notice.textContent=message;notice.hidden=false;sketchNoticeTimer=setTimeout(()=>{notice.hidden=true;},5000);}
function sketchEntryNumber(f){const ref=features.find(item=>item.kind==='sketch'&&item.groupId===activeSketchGroup),same=ref&&!ref.groupHidden&&basisFor(ref).n.distanceTo(basisFor(f).n)<1e-5&&Math.abs(planeCoordinates(ref).offset-planeCoordinates(f).offset)<1e-5;return same?ref.groupNumber:Math.max(0,...features.map(item=>item.groupNumber||0))+1;}
function notifySketchEntered(number){enteredSketchNumber=number;notifySketch('スケッチ'+number+'の編集に入りました。');}
function notifySketchFinished(session){notifySketch((session?'スケッチ'+session.groupNumber:'スケッチ')+'を終了しました。');}
function notify(s){$('toast').textContent=s;$('toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.display='none',3200);}
let extrusionNoticeTimer,extrusionUndoToken=null;
function hideExtrusionNotice(){clearTimeout(extrusionNoticeTimer);$('extrusion-notice').hidden=true;extrusionUndoToken=null;}
function notifyExtrusion(f,{edited=false,count=1}={}){
 clearTimeout(toastTimer);$('toast').style.display='none';clearTimeout(sketchNoticeTimer);$('sketch-notice').hidden=true;
 $('extrusion-notice-title').textContent=(f.name||'押し出し')+'を'+(edited?'更新しました':'確定しました')+(count>1?'（'+count+'領域）':'');
 const operation=f.holesOnly?'新規（穴だけ）':({new:'新規ボディ',join:'結合',cut:'切り取り'}[f.operation]||'押し出し'),depth=f.throughAll?'貫通':f.gridExtentPlane?f.gridExtentPlane+'グリッドまで':'距離 '+fmt(f.depth)+' mm';
 $('extrusion-notice-detail').textContent=operation+' ／ '+depth+' ／ テーパー '+fmt(f.taperAngle||0)+'°';
 extrusionUndoToken={features,previous:past.at(-1),featureId:f.id};$('extrusion-notice-undo').disabled=!past.length;$('extrusion-notice').hidden=false;clearTimeout(extrusionNoticeTimer);extrusionNoticeTimer=setTimeout(hideExtrusionNotice,9000);
}
$('extrusion-notice-edit').onclick=()=>{
 const token=extrusionUndoToken,f=token&&features===token.features&&features.find(item=>item.id===token.featureId&&item.kind==='extrusion');
 if(!f||stage!=='model'){hideExtrusionNotice();return;}
 hideExtrusionNotice();selectFeature(f.id);$('depth').focus();$('depth').select();notify((f.name||'押し出し')+'の再編集を開始しました。');
};
$('extrusion-notice-close').onclick=hideExtrusionNotice;
$('extrusion-notice-undo').onclick=()=>{const token=extrusionUndoToken;if(!token||features!==token.features||past.at(-1)!==token.previous){hideExtrusionNotice();return;}travel(false);hideExtrusionNotice();notify('押し出しを元に戻しました');};
function disposeObject(o){o.traverse(n=>{n.geometry?.dispose();if(n.material){for(const m of Array.isArray(n.material)?n.material:[n.material]){m.map?.dispose();m.dispose();}}});o.removeFromParent();}
function dropPreview(){$('extrusion-tip-size').textContent='先端寸法：計算中…';kernelClient.cancelQueuedExtrusions();clearTimeout(extrusionRemovalTimer);extrusionRemovalRevision++;delete host.dataset.extrusionRemovedCount;delete host.dataset.extrusionPreviewCount;delete host.dataset.contactPreviewRoles;for(const prefix of ['', 'viewport-'])$(prefix+'contact-legend').hidden=true;host.dataset.previewKind='none';if(preview){disposeObject(preview);preview=null;}}
function scheduleExtrusionRemoval(batch){
 if(!batch.length||batch.some(f=>f.operation!=='cut'))return;const revision=extrusionRemovalRevision,group=preview,input=selected?features.slice(0,features.findIndex(f=>f.id===selected)):features;
 extrusionRemovalTimer=setTimeout(async()=>{try{const results=[];for(const f of batch)results.push(await kernelClient.run(input,{type:'preview',operation:{type:'extrusion',target:f.target,feature:f}}));if(revision!==extrusionRemovalRevision||preview!==group)return;
 const removed=results.flatMap(r=>r.removed||[]);if(!removed.length)return;for(const m of group.children)m.visible=false;for(const o of removed){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(o.vertices,3));g.setIndex(o.triangles);const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xf04438,transparent:true,opacity:.5,depthWrite:false,depthTest:false,side:THREE.DoubleSide}));m.renderOrder=30;group.add(m);}host.dataset.extrusionRemovedCount=String(removed.length);
 }catch{/* Keep the existing cutting-tool preview when no valid intersection is available. */}},350);
}
function scheduleContactPreview(batch){
 const autoDepth=batch[0].untilSolid&&contactAutoDepth,revision=extrusionRemovalRevision,group=preview,input=selected?features.slice(0,features.findIndex(f=>f.id===selected)):features;
 extrusionRemovalTimer=setTimeout(async()=>{
  try{
   const results=[];for(const f of batch){if(revision!==extrusionRemovalRevision||preview!==group)return;results.push(await kernelClient.run(input,{type:'extrusionToolPreview',feature:autoDepth?{...f,depth:Math.sign(f.depth)*10000}:f}));}
   if(revision!==extrusionRemovalRevision||preview!==group)return;
   for(const output of results.flatMap(result=>result.outputs)){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(output.vertices,3));g.setIndex(output.triangles);g.computeVertexNormals();
    const cut=batch[0].operation==='cut',uncontacted=output.role==='uncontacted',m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:uncontacted?0xeda22d:output.role==='contacted'?0x47bdd3:cut?0xe78065:0x47bdd3,transparent:true,opacity:uncontacted?.48:.38,depthWrite:false,roughness:.45,side:THREE.DoubleSide}));m.renderOrder=2;
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g,25),new THREE.LineBasicMaterial({color:uncontacted?0xa7670c:output.role==='contacted'?0x1f849b:cut?0xb15240:0x1f849b,transparent:true,opacity:.75})));
    group.add(m);
   }
   const roles=[...new Set(results.flatMap(result=>result.outputs.map(output=>output.role)).filter(Boolean))];
   host.dataset.contactPreviewRoles=roles.join(',');
   for(const prefix of ['', 'viewport-']){
    $(prefix+'contact-legend').hidden=!roles.length;
    $(prefix+'contact-legend').querySelector('[data-contact-role=uncontacted]').hidden=!roles.includes('uncontacted');
   }
   const distances=results.map(result=>result.contactDepth).filter(Number.isFinite);
   if(distances.length){
    contactDistanceLimit=Math.sign(batch[0].depth)*Math.max(.1,Math.max(...distances));
    if(contactAutoDepth||Math.abs(depthValue())>Math.abs(contactDistanceLimit)){
     displayDepth(contactDistanceLimit);$('viewport-depth').value=depthDisplay(contactDistanceLimit);
    }
   }
   contactAutoDepth=false;
   updateExtrusionTip(batch,results.map(r=>r.outputs.flatMap(o=>o.vertices)));host.dataset.extrusionPreviewCount=String(results.length);$('error').textContent='';$('viewport-depth-error').textContent='';
   $('status').textContent=!batch[0].untilSolid?'テーパーのプレビューを確認して確定してください':Math.abs(depthValue())<Math.abs(contactDistanceLimit)-.01?'途中の距離で止めています。バーや数値で調整できます':(batch[0].contactOnly?'接触する部分だけを表面まで押し出します。バーを戻して途中停止できます':'接触部は表面まで、非接触部も最後の接触位置まで押し出します。バーを戻して途中停止できます');
  }catch(error){if(revision===extrusionRemovalRevision&&preview===group){$('error').textContent=error.message;$('viewport-depth-error').textContent=error.message;$('extrusion-tip-size').textContent='先端寸法：形状を確認してください';}}
 },250);
}
function updateExtrusionTip(batch,vertices){
 const combined=vertices.length===1&&batch.length>1,items=combined?[batch[0]]:batch;const lines=items.map((f,i)=>{const size=extrusionEndDimensions(f,vertices[i],{round:!combined});if(!size)return '先端寸法：取得できません';const label=f.untilSolid?'最遠端':combined?'先端（結合全体）':batch.length>1?'領域'+(i+1)+'の先端':'先端';return label+'：'+(size.diameter!==undefined?'外径 '+fmt(size.diameter)+' mm':'幅 '+fmt(size.width)+' × 奥行き '+fmt(size.height)+' mm');});
 $('extrusion-tip-size').textContent=lines.slice(0,3).join('\n')+(lines.length>3?'\nほか '+(lines.length-3)+' 領域':'');
}
function current(){const f={...defaults,id:selected||crypto.randomUUID(),name:$('name').value.trim()||(stage==='sketch'?'スケッチ':'押し出し'),kind:stage,mode};for(const k of settings) f[k]=k==='depth'?depthValue():numeric.includes(k)?Number($(k).value):$(k).value;for(const k of numeric)if($(k).value.trim()==='')f[k]=NaN;if(activeFrame)f.frame=clone(activeFrame);const source=features.find(x=>x.id===selected);if(source?.kind==='sketch'){f.groupId=source.groupId;f.groupNumber=source.groupNumber;f.groupHidden=source.groupHidden;}if(['spline','polyline'].includes(f.profile)){f.points=clone(splinePoints);f.closed=features.find(x=>x.id===selected)?.closed||false;}if(f.profile==='region')f.region=clone(regionPayload);if(polygonMode&&stage==='sketch'){const count=Number($('polygon-sides').value),radius=f.diameter/2;if(!Number.isInteger(count)||count<3||count>64)throw Error('辺の数は3〜64で指定してください');const o=planeCoordinates(f),angle=f.angle*Math.PI/180;f.profile='polyline';f.closed=true;f.name=count+'角形';f.points=Array.from({length:count},(_,i)=>[o.u+radius*Math.cos(angle+i*Math.PI*2/count),o.v+radius*Math.sin(angle+i*Math.PI*2/count)]);}f.holesOnly=f.operation==='newHoles';if(f.holesOnly)f.operation='new';f.throughAll=f.operation==='cut'&&$('through-all').checked;f.cutAllBodies=f.operation==='cut'&&$('cut-all-bodies').checked;f.gridExtentPlane=stage==='extrusion'&&$('grid-extent').checked?extrusionGridPlane:undefined;f.untilSolid=stage==='extrusion'&&$('until-solid').checked;f.contactOnly=f.untilSolid&&$('contact-only').checked;f.capHoles=stage==='extrusion'&&mode==='solid'&&f.profile==='region'&&$('cap-holes').checked;f.skipHoleWalls=stage==='extrusion'&&mode==='thin'&&f.profile==='region'&&$('skip-hole-walls').checked;if(f.holesOnly)f.capHoles=false;if(stage==='sketch'){f.holesOnly=false;f.depth=defaults.depth;f.taperAngle=0;f.wall=2;f.operation='new';f.mode=f.profile==='line'?'thin':'solid';}return f;}
function availableTargets(){if(!selected)return [...meshes.keys()].map(id=>({id,name:features.find(f=>f.id===id)?.name||'ボディ'}));const list=selected?features.slice(0,features.findIndex(f=>f.id===selected)):features;const bodies=new Map();for(const f of list){const result=f.cadResult||(f.kind==='cadop'?f:null);if(result){for(const id of result.remove)bodies.delete(id);for(const o of result.outputs)if(!bodies.has(o.id))bodies.set(o.id,{id:o.id,name:f.name});}else if(f.operation==='new'&&f.kind!=='sketch'&&f.kind!=='plane'&&f.kind!=='referenceImage')bodies.set(f.id,f);}return [...bodies.values()];}
function updateTargets(preferred){const old=preferred??$('target').value;$('target').replaceChildren();for(const f of availableTargets()){const opt=document.createElement('option');opt.value=f.id;opt.textContent=f.name;$('target').append(opt);}if([...$('target').options].some(o=>o.value===old))$('target').value=old;}
function holesOnlySelectionProblem(){
 return holesOnlyProblem({holesOnly:true,mode,profile:$('profile').value,region:regionPayload},selectedRegions.length?selectedRegions:[regionPayload]);
}
function syncHolesOnlyOptions(){
 const problem=holesOnlySelectionProblem();
 for(const id of ['operation','viewport-operation']){
  const select=$(id),option=select.querySelector('[value="newHoles"]');
  if(option.disabled!==!!problem)option.disabled=!!problem;
  if(option.title!==problem)option.title=problem;
  if(select.title!==problem)select.title=problem;
 }
 return problem;
}
function syncFields({reuseExtrusionPreview=false}={}){if(stage!=='model')bodyDisplay?.stopExploded(true);
 let holesOnlyMessage='';
 if(stage==='extrusion'&&$('operation').value==='newHoles'){
  holesOnlyMessage=holesOnlySelectionProblem();
  if(holesOnlyMessage){$('operation').value='new';$('viewport-operation').value='new';}
 }
 syncHolesOnlyOptions();syncCutOptions();
 const profile=$('profile').value;if(profile==='line'&&stage==='extrusion')mode='thin';$('width-label').firstChild.textContent=profile==='line'?'長さ':'幅';
 $('solid-tool').classList.toggle('active',mode==='solid');$('thin-tool').classList.toggle('active',mode==='thin');
document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.disabled=stage==='extrusion'&&profile==='line'&&b.dataset.mode==='solid';});
 $('thin-fields').hidden=mode!=='thin';$('width-label').hidden=profile==='point'||profile==='circle'||profile==='spline';$('height-label').hidden=profile!=='rect';$('diameter-label').hidden=profile!=='circle';
 $('target-label').hidden=['new','newHoles'].includes($('operation').value);
 if(profile==='line'){$('side').options[0].textContent='左側';$('side').options[1].textContent='右側';$('thin-hint').textContent='直線の左側・右側・中心に壁を作ります。幅は線の長さです。';}
 else{$('side').options[0].textContent='内側';$('side').options[1].textContent='外側';$('thin-hint').textContent='輪郭に沿って壁を作ります。底面は付きません。';}
 $('editor-title').textContent=selected?'工程を編集':'新しい工程';$('apply').textContent=selected?'変更を適用':'作成';$('delete').hidden=!selected;
 const isSketch=stage==='sketch';$('angle').disabled=profile==='spline';document.querySelector('.sketch-placement-fields').hidden=profile==='spline';document.querySelector('.sketch-instruction').textContent=profile==='spline'?'フィット点を順番にクリック → Enterで曲線を確定 → スケッチを終了':'線分はクリックごとにつながります。Escで作図終了 → スケッチを終了 → 領域を選択';
 $('editor').classList.toggle('sketch-stage',isSketch);$('editor').classList.toggle('model-stage',stage==='model');$('editor').classList.toggle('region-extrusion',!isSketch&&$('profile').value==='region');document.body.classList.toggle('sketch-selected',isSketch);$('workspace-mode').textContent=isSketch?'スケッチ':'ソリッド';$('finish-sketch-tool').hidden=!isSketch;
 $('editor-title').textContent=isSketch?'スケッチ':stage==='model'?(chosenRegion?'プロファイル選択':'デザイン'):$('operation').value==='cut'?'穴あけ（切り取り）':selected?'押し出しを編集':'押し出し';
 $('apply').textContent=isSketch?(selected?'変更を適用':'スケッチを終了'):selected?'変更を適用':'OK';$('apply').disabled=stage==='model'||(stage==='extrusion'&&pendingExtrude);
 $('solid-tool').classList.toggle('active',stage==='extrusion'&&mode==='solid'&&$('operation').value!=='cut');$('cut-tool').classList.toggle('active',stage==='extrusion'&&$('operation').value==='cut');$('thin-tool').classList.toggle('active',stage==='extrusion'&&mode==='thin');
 $('view-subtitle').textContent=isSketch?'スケッチ / 線で作図':'デザイン / ソリッド';
 for(const el of document.querySelectorAll('.extrusion-only input,.extrusion-only select'))el.disabled=isSketch||stage==='model';$('region-selection').textContent=chosenRegion?(selectedRegions.length||1)+' 領域を選択 · '+fmt(selectedRegions.length?selectedRegions.reduce((sum,r)=>sum+r.area,0):chosenRegion.area)+' mm²':regionPayload?'保存済みの領域':'閉じた領域をクリックして選択';
 const fixedDepth=$('grid-extent').checked||($('operation').value==='cut'&&$('through-all').checked);$('depth').disabled=stage!=='extrusion'||fixedDepth;$('viewport-depth').disabled=fixedDepth;const keepPreview=holesOnlyMessage&&reuseExtrusionPreview&&preview?.userData.extrusionOperation==='new'&&!preview.userData.holesOnly;if(!keepPreview)updatePreview();refreshGrid();
 if(holesOnlyMessage){$('error').textContent=holesOnlyMessage;$('viewport-depth-error').textContent=holesOnlyMessage;notify(holesOnlyMessage);}
}
function updatePreview(){dropPreview();$('error').textContent='';$('viewport-depth-error').textContent='';try{if(stage==='model'||pendingExtrude)return;const f=current();if(stage==='sketch'){if(!draftTouched)return;
 preview=sketchLine(makeSketchGeometry(f),{color:0x087ca5,depthTest:false,order:5});preview.renderOrder=5;scene.add(preview);host.dataset.previewKind='sketch-line';
 $('status').textContent='線でスケッチ → スケッチを確定 → 押し出し';return;
 }host.dataset.previewKind='extrusion';const batch=!selected&&selectedRegions.length>1?regionExtrusions(f,selectedRegions,$('viewport-combine').value==='join'):[f];preview=new THREE.Group();preview.userData.extrusionOperation=f.operation;preview.userData.holesOnly=f.holesOnly;if(f.untilSolid||f.taperAngle){validateFeature(f);scene.add(preview);scheduleContactPreview(batch);$('status').textContent=f.untilSolid?'ソリッドとの接触位置を計算中…':'テーパー形状を計算中…';return;}const geometries=batch.length>1&&f.operation==='new'&&$('viewport-combine').value==='join'?[...rebuild(batch).values()].map(b=>b.geometry):batch.map(item=>{let f=item;if(f.throughAll){const targets=f.cutAllBodies?[...meshes.values()]:[meshes.get(f.target)].filter(Boolean);if(targets.length){const b=new THREE.Box3();for(const target of targets)b.union(new THREE.Box3().setFromObject(target));f={...f,depth:throughDepth(f,[b.min.toArray(),b.max.toArray()])};}}return makeGeometry(f);});updateExtrusionTip(batch,geometries.map(g=>g.attributes.position.array));for(const g of geometries){const m=new THREE.MeshStandardMaterial({color:f.operation==='cut'?0xe78065:0x47bdd3,transparent:true,opacity:.30,depthWrite:false,roughness:.45,side:THREE.DoubleSide}),mesh=new THREE.Mesh(g,m);mesh.renderOrder=2;mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g,25),new THREE.LineBasicMaterial({color:f.operation==='cut'?0xb15240:0x1f849b,transparent:true,opacity:.7})));preview.add(mesh);}scene.add(preview);scheduleExtrusionRemoval(batch);host.dataset.extrusionPreviewCount=String(batch.length);$('status').textContent=selected?'寸法を変更して「変更を適用」':'プレビューを確認して「作成」';}catch(e){$('error').textContent=e.message;$('viewport-depth-error').textContent=e.message;$('extrusion-tip-size').textContent='先端寸法：形状を確認してください';}}
function fillForm(f){contactAutoDepth=false;contactDistanceLimit=null;$('through-all').checked=!!f.throughAll;$('cut-all-bodies').checked=!!f.cutAllBodies;$('grid-extent').checked=!!f.gridExtentPlane;$('until-solid').checked=!!f.untilSolid;$('contact-only').checked=!!f.contactOnly;extrusionGridPlane=f.gridExtentPlane||gridPlane;extrusionDefaultOperation=f.operation;extrusionManualOperation=!!selected;$('cap-holes').checked=!!f.capHoles;$('skip-hole-walls').checked=!!f.skipHoleWalls;activeFrame=f.frame?clone(f.frame):null;if(['spline','polyline'].includes(f.profile))splinePoints=clone(f.points||[]);draftTouched=false;regionPayload=f.region?clone(f.region):null;mode=f.mode;for(const k of settings)if(k==='depth')displayDepth(f.depth);else if(k!=='target')$(k).value=k==='operation'&&f.holesOnly?'newHoles':k==='taperAngle'?(f[k]??0):f[k];$('name').value=f.name;updateTargets(f.target);syncFields();}
function startFeature(profile='rect',newMode='solid',operation='new'){bodyDisplay?.stopExploded();if(editingSectionSplitId)sectionControl.cancel();centerRectangle=false;const preserveView=stage==='sketch'&&!selectedFace;if(stage!=='sketch'){activeSketchGroup=null;editingSketchGroup=null;}
 const previous=selectedFace?{...current(),plane:'CUSTOM',frame:selectedFace.frame,...Object.fromEntries(['x','y','z'].map((k,i)=>[k,selectedFace.frame.n[i]*selectedFace.offset]))}:(stage==='sketch'?current():{...defaults,plane:gridPlane});const keepPlane=previous.plane,keepOffset=planeCoordinates(previous).offset;
 chosenRegion=null;regionPayload=null;pendingExtrude=false;$('measurement').hidden=true;finishSketch(false);stage=operation==='cut'?'extrusion':'sketch';selected=null;const f={...defaults,frame:previous.frame,plane:keepPlane,x:keepPlane==='YZ'?keepOffset:0,y:keepPlane==='XZ'?keepOffset:0,z:keepPlane==='XY'?keepOffset:0,profile,mode:profile==='line'?'thin':newMode,operation,name:operation==='cut'?'穴あけ':'スケッチ'};if(previous.frame)for(const [i,k] of ['x','y','z'].entries())f[k]=previous.frame.n[i]*keepOffset;pendingDrawingView=preserveView?{basis:basisFor(f),offset:planeCoordinates(f).offset}:null;selectedFace=null;fillForm(f);renderTree();$('properties')?.scrollIntoView();if(stage==='sketch')notifySketchEntered(sketchEntryNumber(f));else enteredSketchNumber=null;
}
function renderBodies(next,{colorFeatures=features}={}){bodyDisplay?.stopExploded(true);const splitStyles=sectionBodyStyles(colorFeatures);fragmentSelection=null;clearBodySelection();clearFaceSelection();
 for(const child of [...modelGroup.children])disposeObject(child);meshes.clear();let triangles=0;
 for(const [id,brush] of next){
  const mesh=new THREE.Mesh(brush.geometry,new THREE.MeshStandardMaterial({color:splitStyles.get(id)?.color??0xa3a197,metalness:0,roughness:.8}));mesh.userData.bodyId=id;accelerateMeshPicking(mesh);mesh.visible=!hiddenBodies.has(id);
  const edges=new THREE.LineSegments(bodyEdges(mesh.geometry,28),new THREE.LineBasicMaterial({color:0x33332f,transparent:true,opacity:.85}));edges.geometry.userData.circularEdges=featureCircularEdges(features,id,edges.geometry);mesh.userData.references=solidReferencePoints(mesh.geometry,edges.geometry);edges.visible=showEdges;mesh.add(edges);modelGroup.add(mesh);meshes.set(id,mesh);triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;
 }
 bodyDisplay?.rebuild();sectionControl?.refresh();imageReferences?.refresh();$('triangles').textContent=`${Math.round(triangles).toLocaleString()} 面`;
}
function renderTree(){const splitStyles=sectionBodyStyles(editingSectionSplitId?features.slice(0,features.findIndex(f=>f.id===editingSectionSplitId)):features);
 $('bodies').replaceChildren();$('features').replaceChildren();$('sketches').replaceChildren();renderSketchGroups();for(const child of [...sketchGroup.children])disposeObject(child);for(const f of features.filter(f=>f.kind==='sketch'&&!f.groupHidden)){const line=f.profile==='point'?new THREE.Points(makeSketchGeometry(f),roundPointMaterial({color:0xa04dcc,size:8,sizeAttenuation:false,depthTest:false})):sketchLine(makeSketchGeometry(f),{color:f.id===selected?0x00799f:0x245d99});line.renderOrder=4;line.userData.featureId=f.id;sketchGroup.add(line);}const hasSectionColor=[...meshes.keys()].some(id=>splitStyles.get(id)?.color!==undefined),colorToggle=$('reset-section-colors');colorToggle.hidden=![...meshes.keys()].some(id=>splitStyles.has(id));colorToggle.textContent=hasSectionColor?'色分け ON':'色分け OFF';colorToggle.setAttribute('aria-pressed',String(hasSectionColor));colorToggle.title=hasSectionColor?'断面分離の色分けを通常のボディ色に戻す':'断面分離の青・オレンジの色分けを表示する';$('reset-section-colors').disabled=stage!=='model'||pendingExtrude||extrusionBusy||!!editingSectionSplitId;$('body-count').textContent=meshes.size;$('feature-count').textContent=features.length;
 for(const [id,mesh] of meshes){const f=features.find(f=>f.id===id),row=document.createElement('div');row.className='tree-row';const eye=document.createElement('button');eye.className='eye';eye.innerHTML=visibilityIcon(!mesh.visible);eye.title=mesh.visible?'ソリッドを非表示':'ソリッドを表示';eye.setAttribute('aria-label',eye.title);eye.setAttribute('aria-pressed',String(mesh.visible));eye.onclick=()=>{const visible=!mesh.visible;bodyDisplay?.restoreIsolation(true);mesh.visible=visible;mesh.visible?hiddenBodies.delete(id):hiddenBodies.add(id);bodyDisplay?.update();sectionControl?.refresh();if(!mesh.visible){clearEdgeSelection();selectedFace=null;selectedSurface=null;selectedBody=null;chosenRegion=null;hoverEdge=null;$('measurement').hidden=true;$('edge-overlay').hidden=true;}renderTree();};const label=document.createElement('button');label.className='row-label';label.textContent=f?.name||'ボディ';label.onclick=e=>chooseBody(id,e.ctrlKey||e.metaKey);row.dataset.bodyId=id;const bodyStyle=splitStyles.get(id);if(bodyStyle){label.textContent+=' · '+bodyStyle.label;if(bodyStyle.color!==undefined){row.dataset.bodyColor='#'+bodyStyle.color.toString(16);row.style.setProperty('--body-color',row.dataset.bodyColor);const swatch=document.createElement('span');swatch.className='body-color-swatch';swatch.setAttribute('aria-hidden','true');const title=document.createElement('span');title.textContent=label.textContent;title.prepend(swatch);label.replaceChildren(title);}}const joint=features.findLast(item=>item.kind==='cadop'&&item.spec?.type==='coilJoint'&&item.outputs?.some(output=>output.id===id));if(joint){label.textContent=id===joint.spec.target?'コイル接合 本体':'コイル接合 蓋';const edit=document.createElement('button');edit.type='button';edit.className='coil-body-edit';edit.dataset.coilJointId=joint.id;edit.textContent='再編集';edit.title='コイル接合の詳細を再編集';edit.setAttribute('aria-label',label.textContent+'を再編集');edit.onclick=()=>selectFeature(joint.id);row.append(label,edit,eye);}else row.append(label,eye);const isolate=document.createElement('button');isolate.type='button';isolate.className='body-isolate';isolate.textContent='単独';isolate.disabled=stage!=='model'||pendingExtrude||extrusionBusy||!!editingSectionSplitId;isolate.title='このボディだけ表示';isolate.setAttribute('aria-label',label.textContent+'だけ表示');isolate.onclick=()=>{if(stage!=='model'||pendingExtrude||extrusionBusy||editingSectionSplitId||document.querySelector('dialog[open]')||moveTool?.active)return;chooseBody(id);bodyDisplay?.isolate([id]);};row.insertBefore(isolate,eye);$('bodies').append(row);}
 const shownSketchGroups=new Set();features.forEach((f,i)=>{if(f.kind==='sketch'){if(shownSketchGroups.has(f.groupId))return;shownSketchGroups.add(f.groupId);}const row=document.createElement('div');row.className='tree-row'+(f.id===selected||f.id===editingSectionSplitId?' selected':'');const icon=document.createElement('span');icon.className='icon';icon.textContent=f.kind==='plane'?'▱':f.kind==='sketch'?'╱':f.operation==='cut'?'⊖':f.mode==='thin'?'▣':'▰';const btn=document.createElement('button');btn.className='row-label';const name=document.createElement('span');name.textContent=f.kind==='sketch'?'スケッチ'+f.groupNumber:`${i+1}. ${f.name}`;const sub=document.createElement('small');sub.textContent=f.kind==='referenceImage'?'下絵 · '+fmt(f.width)+' mm':f.kind==='plane'?'構築平面 · '+fmt(f.offset)+' mm':f.kind==='cadop'?(isSectionSplit(f)?'断面で分離 · クリックで再編集':f.spec?.type==='pipe'?'パイプ · クリックで編集':f.spec?.type==='enclose'?'囲み・蓋 · クリックで編集':f.spec?.type==='coilJoint'?'コイル接合 · クリックで再編集':'CAD形状操作'):f.kind==='sketch'?`${profileNames[f.profile]} · スケッチ`:`${profileNames[f.profile]} · ${f.depth} mm${f.mode==='thin'?' / 壁 '+f.wall+' mm':''}`;btn.append(name,sub);btn.onclick=()=>f.kind==='sketch'?editSketchGroup(f.groupId):selectFeature(f.id);row.append(icon,btn);$('features').append(row);});
 $('undo').disabled=!past.length;$('redo').disabled=!future.length;$('export').disabled=!meshes.size;const printable=features.some(f=>f.kind==='cadop'&&f.spec?.type==='enclose'&&f.spec.hinge&&f.outputs?.slice(0,2).every(o=>meshes.has(o.id)));$('export-enclosure').hidden=!printable;$('dirty').textContent=modified?'•':'';renderRegions();
}
$('reset-section-colors').onclick=()=>{
 if(stage!=='model'||pendingExtrude||extrusionBusy||editingSectionSplitId||$('tools-dialog').open||moveTool?.active){notify('編集中の操作を終了してから色を戻してください。');return;}
 const styles=sectionBodyStyles(features);if(![...meshes.keys()].some(id=>styles.has(id)))return;const colorize=![...meshes.keys()].some(id=>styles.get(id)?.color!==undefined);
 past.push(clone(features));if(past.length>40)past.shift();future=[];hideExtrusionNotice();
 features=features.map(f=>isSectionSplit(f)?{...f,spec:{...f.spec,colorize}}:f);
 const nextStyles=sectionBodyStyles(features);for(const [id,mesh] of meshes)mesh.material.color.setHex(nextStyles.get(id)?.color??0xa3a197);
 modified=true;sectionControl?.refresh();renderTree();notify(colorize?'断面で分離したボディの色分けを表示しました。':'断面で分離したボディの色を通常の色に戻しました。');
};
function selectFeature(id,edgeIndex=0){bodyDisplay?.stopExploded();if(editingSectionSplitId)sectionControl.cancel();hideExtrusionNotice();$('center-pattern').hidden=true;clearEdgeSelection();selectedSurface=null;selectedFace=null;chosenRegion=null;pendingExtrude=false;finishSketch(false);selected=id;const f=features.find(f=>f.id===id);if(!f)return;if(f.kind==='referenceImage'){selected=null;stage='model';syncFields();imageReferences.open(f.id);return;}if(f.kind==='plane'){chooseConstructionPlane(f);return;}if(f.kind==='cadop'){stage='model';selected=null;syncFields();if(isSectionSplit(f)){openSectionSplitEdit(f.id);return;}if(f.spec?.type==='pipe'){openPipeEdit(f.id);return;}if(f.spec?.type==='enclose'){openEncloseEdit(f.id);return;}if(f.spec?.type==='coilJoint'){openCoilJointEdit(f.id);return;}notify(f.name+'：元に戻す、またはボディを選んで次の操作を行えます');return;}stage=f.kind==='sketch'?'sketch':'extrusion';if(f.kind==='sketch'){activeSketchGroup=f.groupId;editingSketchGroup=f.groupId;notifySketchEntered(f.groupNumber);}else enteredSketchNumber=null;fillForm(f);renderTree();showMeasurement(f,edgeIndex);}
function setProject(next,{record=true}={}){closeSolidFaceMenu();next=assignSketchGroups(next);selectedRegions=[];patternCenter=null;if(next.length>150)throw Error('工程数は150までです');selectedFace=null;selectedBody=null;selectedSurface=null;clearEdgeSelection();findRegions(next);const generated=rebuild(next);const added=next.at(-1);if(record&&next.length>features.length&&added?.operation==='cut'&&!added.cadResult){const before=meshes.get(added.target),after=generated.get(added.target);if(before&&after&&volume(before.geometry)-volume(after.geometry)<=Math.max(1e-6,volume(before.geometry)*1e-8))throw Error('切り取り形状がボディと重なっていません。対象ボディ・方向・深さを確認してください');}hideExtrusionNotice();if(record){past.push(clone(features));if(past.length>40)past.shift();future=[];}$('center-pattern').hidden=true;$('measurement').hidden=true;features=clone(next);renderBodies(generated);modified=true;renderTree();}
function applyFeature(){resolveAutoCut();if(stage==='extrusion'&&!selected&&(current().operation!=='new'||current().capHoles||current().holesOnly||current().untilSolid||current().taperAngle))return applyCADExtrusion();if(stage==='extrusion'&&!selected&&selectedRegions.length>1){const batch=regionExtrusions(current(),selectedRegions,$('viewport-combine').value==='join');for(const f of batch)validateFeature(f);setProject([...features,...batch]);selectedRegions=[];chosenRegion=null;regionPayload=null;selected=null;stage='model';draftTouched=false;finishSketch(false);dropPreview();syncFields();renderTree();notifyExtrusion(batch[0],{count:batch.length});return {ids:batch.map(f=>f.id),bodies:meshes.size};}if(selected&&features.slice(features.findIndex(f=>f.id===selected)+1).some(f=>f.kind==='cadop'))throw Error('後続のCAD操作があります。元に戻してから寸法を変更してください');if(stage==='model'||pendingExtrude)throw Error('閉じた領域を選択してください');const f=current();validateFeature(f);if(features.length>=150&&!selected)throw Error('工程数は150までです。');const next=clone(features);if(selected)next[next.findIndex(x=>x.id===selected)]=f;else next.push(f);setProject(next);finishSketch(false);selected=f.id;draftTouched=false;renderTree();$('editor-title').textContent='工程を編集';$('apply').textContent='変更を適用';$('delete').hidden=false;dropPreview();syncFields();dropPreview();$('status').textContent=stage==='sketch'?'スケッチを確定しました。押し出しを選ぶと立体化できます。':'形状を更新しました';if(f.kind==='extrusion'){finishExtrusionCommand();notifyExtrusion(f);}else notify($('status').textContent);return {id:f.id,bodies:meshes.size};}
$('editor').addEventListener('submit',async e=>{e.preventDefault();try{if(selected)await applyHistoryEdit();else if(stage==='sketch')await completeSketch();else await applyFeature();}catch(err){$('error').textContent=err.message;}});
async function applyHistoryEdit(){
 const original=features,index=features.findIndex(f=>f.id===selected);if(index<0)return applyFeature();
 const f=current();validateFeature(f);const next=clone(features);next[index]=f;
 $('apply').disabled=true;$('error').textContent='後続の工程を再計算しています…';
 try{const result=next.slice(index).some(f=>(f.kind==='cadop'&&f.spec)||(f.kind==='extrusion'&&(f.operation!=='new'||f.capHoles||f.holesOnly||f.untilSolid||f.taperAngle||f.cadResult)))?await kernelClient.run(next,{type:'replay',before:original,start:index}):{features:replayHistory(original,next,index)};if(features!==original)throw Error('計算中にモデルが変更されました。もう一度適用してください');setProject(result.features);selected=f.id;finishSketch(false);draftTouched=false;dropPreview();renderTree();syncFields();$('error').textContent='';if(f.kind==='extrusion'){finishExtrusionCommand();notifyExtrusion(f,{edited:true});}else notify('スケッチ・立体・後続工程を更新しました');}finally{$('apply').disabled=stage==='model';}
}
function resolveAutoCut(){
 if(stage!=='extrusion'||selected||pendingExtrude||pendingOperation==='cut'||extrusionManualOperation||$('until-solid').checked)return;
 const feature=current(),source=regionPayload?.cadFace?.bodyId||regionPayload?.bodyId||selectedFace?.bodyId;
 const faceSource=source&&regionPayload?.outer&&meshes.get(source)?.visible;
 let matches;
 try{
  if(faceSource&&feature.depth<0)matches=[{id:source,volume:Infinity}];
  else if(faceSource){
   const others=new Map([...meshes].filter(([id])=>id!==source));
   matches=others.size?extrusionIntersections(feature,others):[];
  }else matches=extrusionIntersections(feature,meshes);
 }catch{return;}
 const preferred=matches.some(item=>item.id===source)?source:matches[0]?.id||source;
 const next=matches.length?'cut':extrusionDefaultOperation;
 if($('operation').value!==next){$('operation').value=next;updateTargets(preferred);}
 if(preferred&&['cut','join'].includes(next)&&$('target').value!==preferred)$('target').value=preferred;
 syncFields();
}
function scheduleAutoCut(){
 clearTimeout(autoCutTimer);
 const revision=++autoCutRevision;
 if(stage!=='extrusion'||selected||pendingExtrude||pendingOperation==='cut'||extrusionManualOperation||$('until-solid').checked)return;
 autoCutTimer=setTimeout(()=>{if(revision===autoCutRevision)resolveAutoCut();},90);
}for(const k of [...settings,'name'])$(k).addEventListener('input',()=>{
 if(k==='operation'&&stage==='extrusion'&&$('operation').value==='newHoles'&&holesOnlySelectionProblem()){extrusionManualOperation=true;syncFields({reuseExtrusionPreview:true});return;}
 draftTouched=true;
 if(k==='depth'){if(!depthInputInternal)preciseDepth=null;contactAutoDepth=false;const value=depthValue();if($('until-solid').checked&&contactDistanceLimit&&Math.sign(value)===Math.sign(contactDistanceLimit)&&Math.abs(value)>Math.abs(contactDistanceLimit))displayDepth(contactDistanceLimit);}else{contactAutoDepth=false;contactDistanceLimit=null;}
 if(sketch&&['plane','x','y','z'].includes(k))finishSketch(false);
 if(k==='depth'&&pendingOperation==='cut'&&$('operation').value==='cut'&&depthValue()>0){
  const target=meshes.get($('target').value),r=regionPayload;
  if(target&&r){const center=new THREE.Box3().setFromObject(target).getCenter(new THREE.Vector3());if(center.dot(basisFor(r).n)<r.offset)displayDepth(-depthValue());}
 }
 if(k==='depth'||k==='taperAngle')scheduleAutoCut();
 if(k==='operation')updateTargets();
 syncFields();
});
for(const id of ['operation','target'])$(id).addEventListener('change',()=>{if(stage==='extrusion')extrusionManualOperation=true;});

document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;syncFields();});
function renderRegions(){
 for(const c of [...regionGroup.children])disposeObject(c);
 try{regionList=findRegions(visibleSketchFeatures());}catch(e){$('error').textContent=e.message;regionList=[];}
 if(chosenRegion)chosenRegion=regionList.find(r=>r.id===chosenRegion.id)||null;
 $('region-count').textContent=regionList.length;
 for(const p of features.filter(f=>f.kind==='plane')){const g=new THREE.PlaneGeometry(120,120),b=basisFor(p),m=new THREE.Matrix4().makeBasis(b.u,b.v,b.n);g.applyMatrix4(m);g.translate(...b.n.clone().multiplyScalar(p.offset).toArray());const plane=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xe4a046,transparent:true,opacity:.055,side:THREE.DoubleSide,depthWrite:false}));plane.userData.constructionPlane=true;plane.userData.planeId=p.id;plane.visible=$('construction-visible').checked;regionGroup.add(plane);}
 for(const r of regionList){const active=chosenRegion?.id===r.id||selectedRegions.some(s=>s.id===r.id);const mesh=new THREE.Mesh(regionFaceGeometry(r),new THREE.MeshBasicMaterial({color:active?0x3868ad:0x2f9ede,transparent:true,opacity:active?.55:.16,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));mesh.userData.region=r;mesh.renderOrder=1;regionGroup.add(mesh);}
}
async function completeSketch(){if(selected&&draftTouched){try{await applyHistoryEdit();}catch(e){$('error').textContent=e.message;return;}}if(sketch&&$('profile').value==='spline'&&splinePoints.length>=2){try{applyFeature();}catch(e){notify(e.message);return;}} 
 if(stage==='sketch'&&draftTouched&&!sketch){try{applyFeature();}catch(e){$('error').textContent=e.message;return;}}
 const session=sketchSession();finishSketch(false);activeSketchGroup=null;editingSketchGroup=null;stage='model';selected=null;draftTouched=false;pendingExtrude=false;dropPreview();syncFields();renderTree();notifySketchFinished(session);enteredSketchNumber=null;$('status').textContent=regionList.length?'スケッチを終了しました。青い領域を選んで押し出します。':'閉じた領域がありません。線をつないで輪郭を閉じてください。';
}
$('start-sketch').onclick=()=>{startFeature('line','thin');$('status').textContent='平面を選択して線分・長方形・円を描きます';};
$('finish-sketch-tool').onclick=completeSketch;
for(const [id,profile] of [['new-point','point'],['new-rect','rect'],['new-circle','circle'],['new-line','line'],['new-spline','spline']])$(id).onclick=()=>{startFeature(profile,profile==='line'?'thin':'solid');$('draw').click();};
$('new-center-rect').onclick=()=>{startFeature('rect','solid');centerRectangle=true;$('draw').click();};
function revealExtrusion(plane){const view=extrusionView(camera,controls.target,basisFor(plane).n);if(!view)return;camera.position.copy(view.position);camera.up.copy(view.up);resetViewControls(controls.target.clone());camera.lookAt(controls.target);camera.updateMatrixWorld(true);$('view-label').textContent='俯瞰';}
function beginExtrusion(nextMode='solid'){bodyDisplay?.stopExploded();if(editingSectionSplitId)sectionControl.cancel();hideExtrusionNotice();activeSketchGroup=null;editingSketchGroup=null;if(selectedFace){chosenRegion=selectedFace;if(pendingOperation!=='cut')pendingOperation='join';selected=null;stage='model';}
 if(stage==='extrusion'&&selected&&pendingOperation==='cut'){selected=null;chosenRegion=null;stage='model';}else if(stage==='extrusion'&&selected){mode=nextMode;syncFields();return;}
 const saved=features.find(f=>f.id===selected);if(pendingOperation==='cut'&&!chosenRegion&&saved?.kind==='sketch')chosenRegion=regionList.find(r=>r.sourceIds.includes(saved.id))||null;finishSketch(false);draftTouched=false;$('measurement').hidden=true;
 if(nextMode==='thin'&&!chosenRegion&&saved?.kind==='sketch'&&saved.profile==='line'){
  revealExtrusion(saved);selected=null;stage='extrusion';mode='thin';pendingExtrude=false;fillForm({...saved,id:crypto.randomUUID(),kind:'extrusion',name:'薄い押し出し',operation:'new'});return;
 }
 if(!chosenRegion){stage='model';selected=null;pendingExtrude=true;mode=nextMode;dropPreview();syncFields();renderRegions();$('status').textContent=nextMode==='thin'?'閉じた領域、または開いた線を選択してください':'青く塗られた閉じた領域をクリックしてください';notify($('status').textContent);return;}
 const r=chosenRegion;revealExtrusion(r);selected=null;stage='extrusion';pendingExtrude=false;mode=nextMode;extrusionManualOperation=false;
 const f={...defaults,profile:'region',region:clone(r),plane:r.plane,frame:r.frame,name:pendingOperation==='cut'?'穴あけ':nextMode==='thin'?'薄い押し出し':'押し出し',depth:pendingOperation==='cut'&&selectedFace?-defaults.depth:defaults.depth,mode:nextMode,operation:pendingOperation,target:selectedFace?.bodyId||'',x:r.plane==='YZ'?r.offset:0,y:r.plane==='XZ'?r.offset:0,z:r.plane==='XY'?r.offset:0};
 if(pendingOperation==='cut'){const target=meshes.get(f.target)||meshes.values().next().value;if(target){f.target=target.userData.bodyId;const center=new THREE.Box3().setFromObject(target).getCenter(new THREE.Vector3()),n=basisFor(r).n;f.depth=center.dot(n)<r.offset?-20:20;}}fillForm(f);renderTree();scheduleAutoCut();
}
function chooseRegion(r,add=false){
 const previous=stage==='extrusion'&&!selected?current():null,previousManual=extrusionManualOperation,previousDefault=extrusionDefaultOperation;
 const shouldExtrude=pendingExtrude||!!previous,nextMode=mode;
 clearFaceSelection();$('center-pattern').hidden=true;selectedFace=null;finishSketch(false);selected=null;
 if(!add)selectedRegions=[];
 const index=selectedRegions.findIndex(s=>s.id===r.id);
 if(index>=0)selectedRegions.splice(index,1);else selectedRegions.push(r);
 chosenRegion=selectedRegions.at(-1)||null;stage='model';if(!shouldExtrude)mode='solid';
 draftTouched=false;dropPreview();syncFields();renderRegions();
 host.dataset.selectedRegionCount=String(selectedRegions.length);
 $('measurement').hidden=!chosenRegion;
 $('measurement-title').textContent=selectedRegions.length+' 領域を選択';
 $('measurement-length').textContent=fmt(selectedRegions.reduce((sum,s)=>sum+s.area,0))+' mm²';
 $('measurement-angle').textContent='Ctrl＋クリックで追加・解除';
 $('status').textContent='領域を選択しました。押し出し（E）で距離を指定';
 if(shouldExtrude){
  beginExtrusion(nextMode);
  if(previous&&chosenRegion){
   displayDepth(previous.depth);$('operation').value=previous.operation;$('target').value=previous.target;
   $('through-all').checked=!!previous.throughAll;$('cut-all-bodies').checked=!!previous.cutAllBodies;
   $('grid-extent').checked=!!previous.gridExtentPlane;$('until-solid').checked=!!previous.untilSolid;$('contact-only').checked=!!previous.contactOnly;extrusionGridPlane=previous.gridExtentPlane||gridPlane;
   extrusionDefaultOperation=previousDefault;extrusionManualOperation=previousManual;
   if(previous.gridExtentPlane)try{displayDepth(depthToGridPlane(current(),extrusionGridPlane));}catch(error){$('grid-extent').checked=false;$('error').textContent=error.message;}
   syncFields();scheduleAutoCut();
  }
 }
}$('solid-tool').onclick=()=>{pendingOperation='new';beginExtrusion('solid');};$('thin-tool').onclick=()=>{pendingOperation='new';beginExtrusion('thin');};$('cut-tool').onclick=startHole;
$('cancel').onclick=()=>{const endingSketch=stage==='sketch',session=endingSketch?sketchSession():null;activeSketchGroup=null;editingSketchGroup=null;selectedFace=null;finishSketch(false);stage='model';pendingExtrude=false;selected=null;chosenRegion=null;draftTouched=false;dropPreview();syncFields();renderTree();$('measurement').hidden=true;if(endingSketch)notifySketchFinished(session);enteredSketchNumber=null;};
$('delete').onclick=()=>{if(!selected)return;if(features.slice(features.findIndex(f=>f.id===selected)+1).some(f=>f.kind==='cadop')){notify('後続のCAD操作を元に戻してから削除してください');return;}const f=features.find(x=>x.id===selected);const depends=features.filter(x=>x.target===selected);if(depends.length&&!confirm(`このボディを使う${depends.length}工程も削除しますか？`))return;try{setProject(features.filter(x=>x.id!==selected&&x.target!==selected));selected=null;dropPreview();updateTargets();renderTree();$('delete').hidden=true;$('apply').textContent='作成';$('editor-title').textContent='新しい工程';notify('工程を削除しました');}catch(e){$('error').textContent=e.message;}};
function travel(isRedo){if(editingSectionSplitId)sectionControl.cancel();hideExtrusionNotice();closeSolidFaceMenu();activeSketchGroup=null;editingSketchGroup=null;enteredSketchNumber=null;patternCenter=null;selectedFace=null;selectedBody=null;chosenRegion=null;stage='model';const from=isRedo?future:past,to=isRedo?past:future;if(!from.length)return;const next=from[from.length-1];try{const generated=rebuild(next);clearEdgeSelection();hoverEdge=null;selectedSurface=null;$('edge-overlay').hidden=true;to.push(clone(features));$('measurement').hidden=true;features=clone(from.pop());renderBodies(generated);selected=null;dropPreview();finishSketch(false);modified=true;renderTree();updateTargets();$('delete').hidden=true;$('apply').textContent='作成';$('editor-title').textContent='新しい工程';}catch(e){notify(e.message);}}
$('undo').onclick=()=>travel(false);$('redo').onclick=()=>travel(true);
let escapePressed=false;
function handleToolEscape(e){
 if(!['Escape','Esc'].includes(e.key)&&e.code!=='Escape')return;
 if(e.isComposing||e.keyCode===229){e.stopImmediatePropagation();return;}
 e.preventDefault();e.stopImmediatePropagation();
 if(e.type==='keydown'){if(e.repeat)return;escapePressed=true;}
 else if(escapePressed){escapePressed=false;return;}
 performToolEscape();
}
function performToolEscape(){
 if($('solid-face-menu')){closeSolidFaceMenu(true);return;}
 if($('sketch-group-menu')){$('sketch-group-menu').remove();return;}
 const endingSketch=stage==='sketch',session=endingSketch?sketchSession():null;cancelAllTools();if(endingSketch)notifySketchFinished(session);
}
window.addEventListener('keydown',handleToolEscape,{capture:true});
window.addEventListener('keyup',handleToolEscape,{capture:true});
window.addEventListener('keydown',e=>{if(!e.ctrlKey&&!e.metaKey&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){if(e.key.toLowerCase()==='l')$('new-line').click();if(e.key.toLowerCase()==='e'){if(!pendingExtrude)pendingOperation='new';beginExtrusion('solid');}}if((e.ctrlKey||e.metaKey)&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){if(e.key.toLowerCase()==='z'){e.preventDefault();travel(e.shiftKey);}if(e.key.toLowerCase()==='y'){e.preventDefault();travel(true);}}});
function viewHeight(){return (camera.top-camera.bottom)/camera.zoom;}
function updateCameraDepth(){const apply=()=>fitCameraDepth(camera,controls.target,[grid,sketchGrid,axisGroup,modelGroup,sketchGroup,regionGroup,preview].filter(Boolean));if(bodyDisplay)bodyDisplay.withDisplay(apply);else apply();}
function visibilityRay(point){const ndc=point.clone().project(camera),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(ndc.x,ndc.y),camera);return ray;}
function fit(){const box=bodyDisplay?bodyDisplay.withDisplay(()=>new THREE.Box3().setFromObject(modelGroup)):new THREE.Box3().setFromObject(modelGroup);box.union(new THREE.Box3().setFromObject(sketchGroup));if(imageReferences)box.union(new THREE.Box3().setFromObject(imageReferences.group));if(box.isEmpty()){controls.target.set(0,0,0);camera.position.set(140,-180,150);camera.zoom=1;}else{const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),direction=camera.position.clone().sub(controls.target).normalize();controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,Math.max(size.length()*2,180));camera.zoom=200/(Math.max(size.length(),20)*1.25/Math.min(host.clientWidth/host.clientHeight,1));}camera.updateProjectionMatrix();controls.update();}

function hasFitSelection(){return [...selectedBodies].some(id=>meshes.get(id)?.visible)||selectedFaces.some(f=>meshes.get(f.bodyId)?.visible)||selectedEdges.length>0||selectedSketchSegments.size>0||!!selectedFace?.outer||!!features.find(f=>f.id===selected&&(f.kind==='sketch'||meshes.get(f.id)?.visible));}
function fitSelection(){
 const collect=()=>{const box=new THREE.Box3(),append=(geometry,matrix)=>{if(!geometry.boundingBox)geometry.computeBoundingBox();const bounds=geometry.boundingBox.clone();if(matrix)bounds.applyMatrix4(matrix);box.union(bounds);};
  if(selectedBodies.size){for(const id of selectedBodies){const mesh=meshes.get(id);if(mesh?.visible){mesh.updateMatrixWorld(true);append(mesh.geometry,mesh.matrixWorld);}}}
  else if(selectedFaces.length){for(const f of selectedFaces){const mesh=meshes.get(f.bodyId);if(mesh?.visible){mesh.updateMatrixWorld(true);append(f.geometry,mesh.matrixWorld);}}}
  else if(selectedEdges.length){for(const edge of selectedEdges)for(const point of (edge.circle||edge.arc)?.points||[edge.a,edge.b])box.expandByPoint(new THREE.Vector3(...point));}
  else if(selectedFace?.outer){for(const point of selectedFace.outer)box.expandByPoint(worldPoint(selectedFace,point).add(bodyDisplay?.offset(selectedFace.bodyId)||new THREE.Vector3()));}
  else{const ids=selectedSketchSegments.size?[...selectedSketchSegments.keys()]:[selected];for(const id of ids){const f=features.find(item=>item.id===id);if(f?.kind==='sketch'){const geometry=makeSketchGeometry(f);append(geometry);geometry.dispose();}else{const mesh=meshes.get(id);if(mesh?.visible){mesh.updateMatrixWorld(true);append(mesh.geometry,mesh.matrixWorld);}}}}return box;};
 const box=bodyDisplay?bodyDisplay.withDisplay(collect):collect(),enabled=controls.enabled,target=fitSelectionBox(camera,box,host.clientWidth,host.clientHeight);if(target)resetViewControls(target,enabled);
}
$('fit-selection').onclick=fitSelection;
function resetViewControls(target,enabled=true){controls.dispose();controls=new OrbitControls(camera,renderer.domElement);controls.zoomToCursor=true;controls.mouseButtons.LEFT=null;controls.mouseButtons.MIDDLE=THREE.MOUSE.PAN;controls.target.copy(target);controls.minDistance=2;controls.maxDistance=50000;controls.minZoom=.002;controls.maxZoom=10000;controls.update();controls.enableDamping=true;controls.dampingFactor=.12;controls.enabled=enabled&&!moveTool?.active;}
function setView(v){if(!(sketch&&$('profile').value==='point'))finishSketch(false);const dist=camera.position.distanceTo(controls.target);let direction;camera.up.set(0,0,1);if(v==='top'){direction=new THREE.Vector3(0,0,1);camera.up.set(0,1,0);}else if(v==='front')direction=new THREE.Vector3(0,-1,0);else if(v==='right')direction=new THREE.Vector3(1,0,0);else direction=new THREE.Vector3(1,-1.3,1).normalize();const target=controls.target.clone();camera.position.copy(target).addScaledVector(direction,dist);resetViewControls(target);$('view-label').textContent={top:'上面',front:'正面',right:'右側面',iso:'平行投影'}[v];}
let cubeOrbit=null;
function setCubeView(direction,label){if(!(sketch&&$('profile').value==='point'))finishSketch(false);const target=controls.target.clone(),distance=camera.position.distanceTo(target);camera.up.set(0,0,1);if(Math.abs(direction.z)>.999)camera.up.set(0,direction.z>0?1:-1,0);camera.position.copy(target).addScaledVector(direction,distance);camera.lookAt(target);resetViewControls(target);$('view-label').textContent=label+'の視点';viewCube.update();}
viewCube=createViewCube(document.querySelector('.view-cube'),{camera,onSelect:setCubeView,onHome:()=>setView('iso'),onDragStart:()=>{cubeOrbit={position:camera.position.clone(),target:controls.target.clone(),up:camera.up.clone(),enabled:controls.enabled};controls.enabled=false;},onDrag:(dx,dy)=>{const view=orbitView(cubeOrbit,dx,dy);camera.position.copy(view.position);camera.up.copy(view.up);camera.lookAt(view.target);camera.updateMatrixWorld(true);$('view-label').textContent='自由回転';},onDragEnd:()=>{resetViewControls(cubeOrbit.target,cubeOrbit.enabled);cubeOrbit=null;}});
document.querySelectorAll('[data-view]').forEach(b=>{if(!b.closest('.view-cube'))b.onclick=()=>setView(b.dataset.view);});$('fit').onclick=fit;$('grid-toggle').onclick=()=>{const plane=grid.userData.plane||'XY';gridVisibility[plane]=!gridVisibility[plane];applyGridVisibility();};$('edges-toggle').onclick=()=>{showEdges=!showEdges;for(const m of meshes.values())m.children[0].visible=showEdges;$('edges-toggle').setAttribute('aria-pressed',showEdges);};
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
function getBasis(){const f=current();if(f.frame)return basisFor(f);if(f.plane==='XZ')return {u:new THREE.Vector3(1,0,0),v:new THREE.Vector3(0,0,-1),n:new THREE.Vector3(0,1,0)};if(f.plane==='YZ')return {u:new THREE.Vector3(0,0,-1),v:new THREE.Vector3(0,1,0),n:new THREE.Vector3(1,0,0)};return {u:new THREE.Vector3(1,0,0),v:new THREE.Vector3(0,1,0),n:new THREE.Vector3(0,0,1)};}
let sketchBasis,sketchOrigin,lastDrawPoint=null,snapMarker=null,sketchGrid=null,sketchGridKey="";
const precise=n=>Number(n.toPrecision(14));
const fmt=n=>Number(n.toFixed(2)).toLocaleString('ja-JP',{maximumFractionDigits:2});
function refreshGrid(){
 const f={plane:gridPlane,x:0,y:0,z:0},basis=basisFor(f),step=Number($('snap-step').value)||10,extent=step*50,visible=gridVisibility[f.plane]!==false;
 const signature=JSON.stringify([f.plane,f.frame,0,step]);if(signature===gridSignature){applyGridVisibility();return;}gridSignature=signature;modelGridKey='';gridStep=step;lastGridStep=step;$('grid-scale').textContent='1目盛り：'+fmt(step)+' mm';host.dataset.gridStep=step;disposeObject(grid);grid=cadGrid(step,100);
 const matrix=new THREE.Matrix4().makeBasis(basis.u,basis.n.clone().negate(),basis.v);grid.applyMatrix4(matrix);
 const origin=new THREE.Vector3(f.x,f.y,f.z);grid.position.copy(basis.n).multiplyScalar(origin.dot(basis.n)-.03);grid.userData.plane=f.plane;host.dataset.gridOffset=String(origin.dot(basis.n));grid.visible=visible;scene.add(grid);applyGridVisibility();
}
$('snap-step').onchange=()=>{refreshGrid();if(sketch&&lastDrawPoint)previewEndpoint(lastDrawPoint);};
$('snap-enabled').onchange=()=>{if(snapMarker)snapMarker.visible=$('snap-enabled').checked;};
$('plane').addEventListener('change',()=>{if($('plane').value!=='CUSTOM'){activeFrame=null;gridPlane=$('plane').value;}refreshGrid();});
function snapToGrid(hit){
 
 const pointer=screenPoint(hit),references=hingeReferences();
 const perimeterSnap=hingeCirclePerimeterPoint(pointer,references);
 if(perimeterSnap){host.dataset.snapKind='circumference';return perimeterSnap;}
 const directRim=hingeSketchUsesVisibleRim();
 let hingeSnap=null,hingeDistance=10,hingeDepth=Infinity;
 for(const ref of references){
  const points=directRim?hingeSketchRimPoints(ref):$('profile').value==='circle'?[]:[hingeSketchPoint(ref)].filter(Boolean);
  for(const p of points){
   const projected=screenPoint(p),distance=Math.hypot(projected.x-pointer.x,projected.y-pointer.y),depth=p.clone().project(camera).z;
   if(distance<hingeDistance-.5||Math.abs(distance-hingeDistance)<=.5&&depth<hingeDepth){hingeSnap=p;hingeDistance=distance;hingeDepth=depth;}
  }
 }
 if(hingeSnap){host.dataset.snapKind='center';return hingeSnap;}
 const tolerance=6;let best=null,dist=tolerance,kind='grid';
 const consider=(p,k)=>{const a=screenPoint(p),b=screenPoint(hit),d=Math.hypot(a.x-b.x,a.y-b.y);if(d<Math.min(dist,k==='midpoint'?2:tolerance)){dist=d;best=p.clone();kind=k;}};
 for(const f of features.filter(f=>f.kind==='sketch'&&!f.groupHidden)){const basis=basisFor(f),o=planeCoordinates(f);if(basis.n.distanceTo(sketchBasis.n)>1e-5||Math.abs(o.offset-sketchOrigin.dot(sketchBasis.n))>1e-5)continue;const r={...f,offset:o.offset},points=sketchPoints(f);if(f.profile!=='circle')for(const p of (f.profile==='spline'?[points[0],points.at(-1)]:points))consider(worldPoint(r,p),'endpoint');if(f.profile==='line'||f.profile==='rect')for(let i=1;i<points.length;i++)consider(worldPoint(r,[(points[i][0]+points[i-1][0])/2,(points[i][1]+points[i-1][1])/2]),'midpoint');if(f.profile==='circle'||f.profile==='rect')consider(new THREE.Vector3(f.x,f.y,f.z),'center');}
 for(const mesh of meshes.values()){if(!mesh.visible)continue;for(const ref of mesh.userData.references||[]){const p=new THREE.Vector3(...ref.point);if(Math.abs(p.dot(sketchBasis.n)-sketchOrigin.dot(sketchBasis.n))<1e-4)consider(p,ref.kind==='midpoint'?'midpoint':'center');}const edge=mesh.children[0]?.geometry?.attributes.position;if(!edge)continue;for(let i=0;i<edge.count;i+=2){const p=new THREE.Vector3().fromBufferAttribute(edge,i),q=new THREE.Vector3().fromBufferAttribute(edge,i+1);if(Math.abs(p.dot(sketchBasis.n)-sketchOrigin.dot(sketchBasis.n))<1e-4&&Math.abs(q.dot(sketchBasis.n)-sketchOrigin.dot(sketchBasis.n))<1e-4){consider(p,'endpoint');consider(q,'endpoint');consider(p.clone().add(q).multiplyScalar(.5),'midpoint');}}}
 for(const p of getIntersectionPoints())if(Math.abs(p.dot(sketchBasis.n)-sketchOrigin.dot(sketchBasis.n))<1e-4)consider(p,'intersection');const spline=$('profile').value==='spline';if(spline)for(const p of splinePoints)consider(sketchBasis.u.clone().multiplyScalar(p[0]).addScaledVector(sketchBasis.v,p[1]).addScaledVector(sketchBasis.n,sketchOrigin.dot(sketchBasis.n)),'endpoint');host.dataset.snapKind=kind;if(best)return best;if(!$('snap-enabled').checked){host.dataset.snapKind='free';return hit.clone();}const gridPoint=sketchBasis.u.clone().multiplyScalar(Math.round(hit.dot(sketchBasis.u)/gridStep)*gridStep).addScaledVector(sketchBasis.v,Math.round(hit.dot(sketchBasis.v)/gridStep)*gridStep).addScaledVector(sketchBasis.n,sketchOrigin.dot(sketchBasis.n));const a=screenPoint(gridPoint),b=screenPoint(hit);if(Math.hypot(a.x-b.x,a.y-b.y)>6){host.dataset.snapKind='free';return hit.clone();}return gridPoint;
}
function showSnap(hit,basis=sketchBasis){
 const kind=host.dataset.snapKind||'grid',labels={endpoint:'□ 端点',midpoint:'△ 中点',center:'⊙ 中心',circumference:'◯ 円周',grid:'＋ 交点',free:'自由位置',intersection:'× 交点'},icons={endpoint:'□',midpoint:'△',center:'⊙',circumference:'◯',grid:'+',free:'○',intersection:'×'};const p=hit.clone().project(camera);$('snap-icon').hidden=kind==='free'||kind==='grid'&&!$('snap-enabled').checked;$('snap-icon').textContent=icons[kind];$('snap-icon').style.left=((p.x+1)/2*host.clientWidth)+'px';$('snap-icon').style.top=((-p.y+1)/2*host.clientHeight)+'px';$('snap-readout').hidden=false;$('snap-readout').textContent=labels[kind]+' '+fmt(hit.dot(basis.u))+' , '+fmt(hit.dot(basis.v))+' mm · グリッド '+gridStep+' mm';
}
function finishSketch(message=true){$('sketch-dimensions').hidden=true;$('center-rectangle-guides').setAttribute('hidden','');$('center-rectangle-origin').setAttribute('hidden','');polygonMode=false;$('polygon-dimensions').hidden=true;clearArcDrag();$('circle-dimensions').hidden=true;if(!sketch)return;if(sketchPan){const id=sketchPan.id;sketchPan=null;if(renderer.domElement.hasPointerCapture(id))renderer.domElement.releasePointerCapture(id);}$('snap-icon').hidden=true;if(splinePreview){disposeObject(splinePreview);splinePreview=null;}delete host.dataset.splinePreviewPoints;sketch=false;firstPoint=null;lastDrawPoint=null;chainStart=null;chainCount=0;controls.enabled=true;$('sketch-banner').hidden=true;$('line-dimensions').hidden=true;$('snap-readout').hidden=true;host.style.cursor='';for(const marker of [sketchMarker,snapMarker])if(marker)disposeObject(marker);sketchMarker=null;snapMarker=null;if(message)notify('スケッチを終了しました');}
function stopLineDrawing(){if(stage!=='sketch'||$('profile').value!=='line')return false;$('cancel').click();$('status').textContent='線分の作図を終了しました。確定済みの線は残ります';return true;}
$('end-sketch').onclick=()=>{if(!stopLineDrawing())finishSketch();};
$('draw').onclick=()=>{const wasSketchStage=stage==='sketch';
 finishSketch(false);$('measurement').hidden=true;
 if(stage!=='sketch'||selected!==null){const existing=current();selected=null;stage='sketch';existing.name='スケッチ';fillForm(existing);renderTree();}
 rectDimensionLocks=[false,false];circleDiameterLocked=false;$('lock-diameter').checked=false;$('circle-dimension-error').textContent='';$('live-diameter').value=$('diameter').value;splinePoints=[];draftTouched=false;syncFields();const f=current(),previousView=pendingDrawingView;pendingDrawingView=null;const basis=basisFor(f),preserveView=wasSketchStage&&previousView&&basis.n.distanceTo(previousView.basis.n)<1e-5&&basis.v.distanceTo(previousView.basis.v)<1e-5&&Math.abs(planeCoordinates(f).offset-previousView.offset)<1e-5;if(![f.x,f.y,f.z].every(Number.isFinite))return;
 if(!preserveView)controls.update();sketch=true;firstPoint=null;lastDrawPoint=null;sketchOrigin=new THREE.Vector3(f.x,f.y,f.z);sketchBasis=getBasis();refreshGrid();
 controls.enabled=false;if(!preserveView){controls.target.copy(sketchOrigin);camera.up.copy(sketchBasis.v);camera.position.copy(sketchOrigin).addScaledVector(sketchBasis.n,180);camera.zoom=200/(360*Math.tan(Math.PI/9));camera.updateProjectionMatrix();resetViewControls(sketchOrigin,false);camera.lookAt(sketchOrigin);camera.updateMatrixWorld(true);}host.dataset.sketchViewAlignment=String(-camera.getWorldDirection(new THREE.Vector3()).dot(sketchBasis.n));const number=sketchEntryNumber(f);if(number!==enteredSketchNumber)notifySketchEntered(number);
 $('sketch-draw-instruction').textContent=f.profile==='rect'&&centerRectangle?'中心、角の順にクリック · 幅・高さは四角全体の寸法 · Enterで確定 / Escで中止':'平面上で始点と終点をクリック · Enterで確定 / Escで中止';
 $('sketch-banner').hidden=false;host.style.cursor='crosshair';$('view-label').textContent=(f.plane==='CUSTOM'?'選択した平面':f.plane)+' スケッチ';
 $('line-dimensions').hidden=f.profile!=='line';$('line-dimensions-hint').textContent='始点をクリックしてください';$('place-line').disabled=true;
 $('lock-length').checked=false;$('lock-angle').checked=false;$('live-length').value=f.width;$('live-angle').value=f.angle;$('dimension-error').textContent='';
 notify(f.profile==='point'?'点を置く位置をクリック · 円・円弧の中心や既存の点に吸着 · Escで終了':f.profile==='spline'?'自由な位置をクリックしてフィット点を配置。交点付近で吸着 · Enterで確定':f.profile==='circle'?'中心、円周の順にクリック':f.profile==='rect'&&centerRectangle?'中心、角の順にクリック。幅・高さで全体の寸法を指定できます':'始点、終点の順にクリック。Enterで確定、Escで中止できます');
};
function planePoint(event){const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=new THREE.Vector3();return raycaster.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(sketchBasis.n,sketchOrigin),hit)?snapToGrid(hit):null;}
function constrainedPoint(hit){if($('profile').value==='circle'&&firstPoint&&circleDiameterLocked){const diameter=polygonMode?Number($('polygon-radius').value)*2:Number($('live-diameter').value);if(!$('live-diameter').value||!Number.isFinite(diameter)||diameter<.1||diameter>10000)throw Error('直径は0.1〜10000 mmで入力してください');const direction=hit.clone().sub(firstPoint);direction.addScaledVector(sketchBasis.n,-direction.dot(sketchBasis.n));if(direction.length()<1e-8)direction.copy(sketchBasis.u);return firstPoint.clone().addScaledVector(direction.normalize(),diameter/2);}
 if($('profile').value==='rect'&&firstPoint){const d=hit.clone().sub(firstPoint),values=[d.dot(sketchBasis.u),d.dot(sketchBasis.v)];for(let i=0;i<2;i++)if(rectDimensionLocks[i]){const input=$('sketch-dim-'+i),value=Number(input.value);if(!input.value||!Number.isFinite(value)||value<.1||value>10000)throw Error('幅・高さは0.1〜10000 mmで入力してください');values[i]=(values[i]<0?-1:1)*value/(centerRectangle?2:1);}return firstPoint.clone().addScaledVector(sketchBasis.u,values[0]).addScaledVector(sketchBasis.v,values[1]);}
 if($('profile').value!=='line'||!firstPoint)return hit;
 const delta=hit.clone().sub(firstPoint);let length=delta.length(),angle=Math.atan2(delta.dot(sketchBasis.v),delta.dot(sketchBasis.u))*180/Math.PI;
 if($('lock-length').checked){length=Number($('live-length').value);if(!$('live-length').value||!Number.isFinite(length)||length<.1||length>10000)throw Error('長さは0.1〜10000mmで入力してください');}
 if($('lock-angle').checked){angle=Number($('live-angle').value);if(!$('live-angle').value||!Number.isFinite(angle)||Math.abs(angle)>360)throw Error('角度は−360〜360°で入力してください');}
 return firstPoint.clone().addScaledVector(sketchBasis.u,length*Math.cos(angle*Math.PI/180)).addScaledVector(sketchBasis.v,length*Math.sin(angle*Math.PI/180));
}
function updateDraw(point){
 draftTouched=true;
 const delta=point.clone().sub(firstPoint),du=delta.dot(sketchBasis.u),dv=delta.dot(sketchBasis.v);let center;
 if($('profile').value==='circle'){center=firstPoint;$('diameter').value=precise(Math.max(.1,Math.hypot(du,dv)*2));$('angle').value=polygonMode?precise(Math.atan2(dv,du)*180/Math.PI):0;if(polygonMode&&!circleDiameterLocked&&document.activeElement!==$('polygon-radius'))$('polygon-radius').value=Number((Math.hypot(du,dv)).toFixed(2));if(!circleDiameterLocked&&document.activeElement!==$('live-diameter'))$('live-diameter').value=Number(Number($('diameter').value).toFixed(2));}
 else{center=$('profile').value==='rect'&&centerRectangle?firstPoint.clone():firstPoint.clone().add(point).multiplyScalar(.5);if($('profile').value==='line'){
  const length=Math.hypot(du,dv),angle=Math.atan2(dv,du)*180/Math.PI;$('width').value=precise(Math.max(.1,length));$('angle').value=precise(angle);
  if(!$('lock-length').checked)$('live-length').value=Number(length.toFixed(2));if(!$('lock-angle').checked)$('live-angle').value=Number(angle.toFixed(2));
 }else{$('width').value=precise(Math.max(.1,Math.abs(du)*(centerRectangle?2:1)));$('height').value=precise(Math.max(.1,Math.abs(dv)*(centerRectangle?2:1)));$('angle').value=0;}}
 for(const k of ['x','y','z'])$(k).value=precise(center[k]);syncFields();
}
function previewEndpoint(hit){try{lastDrawPoint=hit.clone();const p=constrainedPoint(hit);if(firstPoint)updateDraw(p);showSnap(p);if(firstPoint&&$('profile').value==='line'&&($('lock-length').checked||$('lock-angle').checked)){$('snap-readout').textContent='寸法を固定（交点吸着より優先）';if(snapMarker)snapMarker.visible=false;}$('dimension-error').textContent='';$('circle-dimension-error').textContent='';return p;}catch(e){$('dimension-error').textContent=e.message;$('circle-dimension-error').textContent=e.message;return null;}}
function placeEndpoint(hit){
 const p=previewEndpoint(hit);if(!p)return;const delta=p.clone().sub(firstPoint);if(delta.length()<($('profile').value==='circle'?.049999:$('profile').value==='rect'&&centerRectangle?.049999:.1)||($('profile').value==='rect'&&(Math.abs(delta.dot(sketchBasis.u))<(centerRectangle?.05:.1)||Math.abs(delta.dot(sketchBasis.v))<(centerRectangle?.05:.1)))){notify('始点から離れた終点を指定してください');return;}
 const repeatRectangle=$('profile').value==='rect',continuous=$('profile').value==='line'&&$('continuous-line').checked;
 const nextOrigin=sketchOrigin.clone(),nextBasis=sketchBasis,root=chainStart?.clone()||firstPoint.clone(),count=chainCount+1,closed=count>=3&&root.distanceTo(p)<1e-5;
 try{selected=null;applyFeature();if(continuous&&!closed){
  selected=null;stage='sketch';sketch=true;firstPoint=p.clone();lastDrawPoint=null;sketchOrigin=nextOrigin;sketchBasis=nextBasis;chainStart=root;chainCount=count;controls.enabled=false;draftTouched=false;dropPreview();
  $('sketch-banner').hidden=false;$('line-dimensions').hidden=false;$('place-line').disabled=false;$('line-dimensions-hint').textContent='次の終点をクリック · Escで線分を終了';$('lock-length').checked=false;$('lock-angle').checked=false;host.style.cursor='crosshair';
  sketchMarker=new THREE.Points(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()]),roundPointMaterial({color:0x087ba0,size:8,sizeAttenuation:false,depthTest:false}));sketchMarker.position.copy(p);sketchMarker.renderOrder=10;scene.add(sketchMarker);$('status').textContent='線を追加しました。続けて終点をクリック（Escで終了）';
 }else if(repeatRectangle){
  selected=null;stage='sketch';sketch=true;firstPoint=null;lastDrawPoint=null;chainStart=null;chainCount=0;sketchOrigin=nextOrigin;sketchBasis=nextBasis;controls.enabled=false;draftTouched=false;rectDimensionLocks=[false,false];dropPreview();syncFields();renderTree();
  $('sketch-banner').hidden=false;$('sketch-dimensions').hidden=true;$('line-dimensions').hidden=true;$('place-line').disabled=true;host.style.cursor='crosshair';
  if(document.activeElement?.closest('#sketch-dimensions'))document.activeElement.blur();
  notify(centerRectangle?'中心長方形を追加しました。次の中心をクリック · Escで作図終了':'長方形を追加しました。次の始点をクリック · Escで作図終了');
 }else{draftTouched=false;notify(closed?'輪郭が閉じました。スケッチを終了して領域を選択してください':'図形を追加しました');}}
 catch(e){$('dimension-error').textContent=e.message;notify(e.message);}
}
for(const part of ['length','angle']){
 $('live-'+part).addEventListener('input',()=>{$('lock-'+part).checked=true;if(firstPoint)previewEndpoint(lastDrawPoint||firstPoint.clone().addScaledVector(sketchBasis.u,50));});
 $('lock-'+part).addEventListener('change',()=>{if(firstPoint)previewEndpoint(lastDrawPoint||firstPoint.clone().addScaledVector(sketchBasis.u,50));});
}
$('line-dimensions').onsubmit=e=>{e.preventDefault();if(!firstPoint)return;$('lock-length').checked=true;$('lock-angle').checked=true;placeEndpoint(lastDrawPoint||firstPoint.clone().addScaledVector(sketchBasis.u,50));};
renderer.domElement.addEventListener('wheel',e=>{
 if(!moveTool?.active)return;
 e.preventDefault();
 e.stopImmediatePropagation();
 if(e.shiftKey){
  const raw=Math.abs(e.deltaY)>1e-6?e.deltaY:e.deltaX;
  if(!Number.isFinite(raw)||!raw)return;
  const pixels=raw*(e.deltaMode===1?16:e.deltaMode===2?host.clientHeight:1),step=THREE.MathUtils.clamp(pixels,-180,180)*.3;
  const start={position:camera.position.clone(),target:controls.target.clone(),up:camera.up.clone(),origin:false},view=orbitView(start,step,0);
  camera.position.copy(view.position);camera.up.copy(view.up);controls.target.copy(view.target);camera.lookAt(view.target);camera.updateMatrixWorld(true);
  host.dataset.cameraHeight=String(camera.position.z);
  return;
 }
 const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?100:1)*(e.ctrlKey?10:1);
 if(!Number.isFinite(delta)||!delta)return;
 zoomAtPointer(camera,controls.target,renderer.domElement.getBoundingClientRect(),e.clientX,e.clientY,THREE.MathUtils.clamp(camera.zoom*Math.pow(.95,controls.zoomSpeed*delta*.01),controls.minZoom,controls.maxZoom));
},{capture:true,passive:false});
renderer.domElement.addEventListener('wheel',e=>{if(!sketch)return;e.preventDefault();zoomAtPointer(camera,controls.target,renderer.domElement.getBoundingClientRect(),e.clientX,e.clientY,THREE.MathUtils.clamp(camera.zoom*Math.exp(-Math.sign(e.deltaY)*.15),.002,10000));refreshGrid();},{passive:false});
function updateSplinePreview(hit=null){
 const points=splinePoints.map(p=>[...p]);
 if(hit&&points.length){const next=[hit.dot(sketchBasis.u),hit.dot(sketchBasis.v)],last=points.at(-1);if(Math.hypot(next[0]-last[0],next[1]-last[1])>1e-7)points.push(next);}
 host.dataset.splinePreviewPoints=String(points.length);
 if(points.length<2){if(splinePreview){disposeObject(splinePreview);splinePreview=null;}return;}
 const geometry=makeSketchGeometry({...current(),points,closed:false});
 if(splinePreview){updateSketchLine(splinePreview,geometry);}
 else{splinePreview=sketchLine(geometry,{color:0x087ca5,depthTest:false,order:5});splinePreview.renderOrder=5;scene.add(splinePreview);}
}
renderer.domElement.addEventListener('pointermove',e=>{if(holeActive){if(e.buttons){holeHoverFace=null;$('snap-icon').hidden=true;$('snap-readout').hidden=true;return;}hoverHolePoint(e);return;}if(!sketch)return;if(arcDrag){updateArcDrag(e);return;}const hit=planePoint(e);if(hit){if($('profile').value==='spline'){updateSplinePreview(hit);showSnap(hit);return;}if(firstPoint)previewEndpoint(hit);else showSnap(hit);}});
renderer.domElement.addEventListener('pointerleave',()=>{if(sketch||holeActive){$('snap-icon').hidden=true;$('snap-readout').hidden=true;if(holeActive)holeHoverFace=null;if(sketch&&$('profile').value==='spline')updateSplinePreview();}});
let down=null;renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};startArcDrag(e);});
renderer.domElement.addEventListener('pointerup',e=>{
 if(arcDrag){const dragged=arcDrag.moved;if(dragged){commitArcDrag(e);return;}clearArcDrag();}if(deletingSketch){if(e.button===0)eraseSketchAt(e);return;}if(moveTool?.active)return;if(e.button!==0||!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;fragmentSelection=null;
 if($('tools-dialog').open){pickCommandReference(e);return;}if(holeActive){pickHolePoint(e);return;}if(!sketch&&stage==='sketch'&&pickSketchEdge(e))return;if(sketch){const hit=planePoint(e);if(!hit)return;if($('profile').value==='point'){try{const f={...current(),id:crypto.randomUUID(),name:'点',x:hit.x,y:hit.y,z:hit.z};validateFeature(f);setProject([...features,f]);selected=null;draftTouched=false;notify('点を配置しました · 続けてクリック / Escで終了');}catch(err){notify(err.message);}return;}if($('profile').value==='spline'){splinePoints.push([hit.dot(sketchBasis.u),hit.dot(sketchBasis.v)]);updateSplinePreview();draftTouched=false;$('status').textContent=splinePoints.length+' 点を配置 · Enterで確定 / Escで中止';return;}if(!firstPoint){firstPoint=hit;chainStart=hit.clone();chainCount=0;lastDrawPoint=null;sketchMarker=new THREE.Points(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()]),roundPointMaterial({color:0x087ba0,size:8,sizeAttenuation:false,depthTest:false}));sketchMarker.position.copy(hit);sketchMarker.renderOrder=10;scene.add(sketchMarker);$('place-line').disabled=false;$('line-dimensions-hint').textContent='終点をクリック、または長さ・角度を入力';showSnap(hit);}else placeEndpoint(hit);return;}
 const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);
 raycaster.params.Line.threshold=viewHeight()/r.height*7;
 const bodyHit=raycaster.intersectObjects([...meshes.values()].filter(m=>m.visible),false)[0];
 if(!pendingExtrude&&selectionMode!=='auto'){
 if(selectionMode==='body'){if(bodyHit)chooseBody(bodyHit.object.userData.bodyId,e.ctrlKey||e.metaKey);else if(!e.ctrlKey&&!e.metaKey)clearBodySelection();return;}
 if(selectionMode==='edge'){pickBodyEdge(e);return;}
 if(bodyHit){chooseFace(bodyHit,e.ctrlKey||e.metaKey);return;}
 }
 const faceGroup=bodyHit?.object.geometry.userData.faceGroups?.find(f=>bodyHit.faceIndex*3>=f.start&&bodyHit.faceIndex*3<f.start+f.count);
 if(!pendingExtrude&&(e.ctrlKey||e.metaKey)&&pickBodyEdge(e))return;
 if(!pendingExtrude&&!edgeSelectionMode&&faceGroup&&!bodyHit.object.geometry.userData.planarFaces?.includes(faceGroup.faceId)){chooseFace(bodyHit,e.shiftKey||e.ctrlKey||e.metaKey);return;}
 if(!pendingExtrude&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey&&pickBodyEdge(e,bodyHit))return;
 const sketchHit=raycaster.intersectObjects(sketchGroup.children,false)[0];if(sketchHit&&(!pendingExtrude||mode==='thin')&&(!bodyHit||sketchHit.distance<=bodyHit.distance+.05)){const thinPending=pendingExtrude&&mode==='thin';if(!thinPending&&pickSketchEdge(e))return;selectFeature(sketchHit.object.userData.featureId,sketchHit.index||0);if(thinPending)beginExtrusion('thin');return;}const regionHit=raycaster.intersectObjects(regionGroup.children.filter(x=>x.userData.region),false)[0];if(regionHit&&(!bodyHit||regionHit.distance<=bodyHit.distance+.05)){chooseRegion(regionHit.object.userData.region,e.ctrlKey||e.metaKey);return;}
 const planeHit=raycaster.intersectObjects(regionGroup.children.filter(m=>m.userData.planeId&&m.visible),false)[0];if(planeHit&&(!bodyHit||planeHit.distance<bodyHit.distance-.05)){chooseConstructionPlane(features.find(f=>f.id===planeHit.object.userData.planeId));return;}const hit=bodyHit;if(hit){chooseFace(hit,e.shiftKey||e.ctrlKey||e.metaKey);}else if(!selectFaceGrid())$('measurement').hidden=true;
});
function showMeasurement(f,edgeIndex=0){if(f.profile==='point'){$('measurement').hidden=false;$('measurement-title').textContent='スケッチ点';$('measurement-length').textContent=[f.x,f.y,f.z].map(fmt).join(', ')+' mm';$('measurement-angle').textContent='目標点';return;}
 $('measurement').hidden=f.kind!=='sketch';if(f.kind!=='sketch')return;
 if(f.profile==='spline'){const ps=sketchPoints(f);let length=0;for(let i=1;i<ps.length;i++)length+=Math.hypot(ps[i][0]-ps[i-1][0],ps[i][1]-ps[i-1][1]);$('measurement-title').textContent='フィット点スプライン';$('measurement-length').textContent='曲線長 約 '+fmt(length)+' mm';$('measurement-angle').textContent=f.points.length+' フィット点';return;}if(f.profile==='circle'){$('measurement-title').textContent='選択した円';$('measurement-length').textContent='直径 '+fmt(f.diameter)+' mm';$('measurement-angle').textContent='円周 '+fmt(Math.PI*f.diameter)+' mm';}
 else{const edge=f.profile==='line'?0:edgeIndex%4,length=f.profile==='line'||edge%2===0?f.width:f.height,angle=((f.angle+(f.profile==='rect'?edge*90:0)+180)%360+360)%360-180;
 $('measurement-title').textContent=f.profile==='line'?'選択した線':'選択した長方形の辺';$('measurement-length').textContent=fmt(length)+' mm';$('measurement-angle').textContent='角度 '+fmt(angle)+'° · '+f.plane+' 平面';}
}
function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
let projectFileName='design.forma.json';
const projectLoadPreview=createProjectLoadPreview({onChoose:()=>$('file').click(),onOpen:item=>{
 if(item.request!==toolCancelRevision)return;
 try{cancelAllTools();activeSketchGroup=null;editingSketchGroup=null;setProject(item.next);drawingController?.loadState(item.drawingData);selected=null;chosenRegion=null;regionPayload=null;stage='model';pendingExtrude=false;hiddenBodies.clear();for(const m of meshes.values())m.visible=true;dropPreview();finishSketch(false);updateTargets();modified=false;projectFileName=item.file.name;renderTree();$('delete').hidden=true;$('apply').textContent='作成';$('editor-title').textContent='新しい工程';fit();notify('作業データを読み込みました');}catch(e){notify('読み込みできません: '+e.message);}
}});
$('save').onclick=()=>{const entered=window.prompt('保存するファイル名を入力してください（.forma.json は自動で付きます）',projectFileName);if(entered===null)return;let name=entered.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_');if(!name){notify('ファイル名を入力してください');return;}if(!/\.forma\.json$/i.test(name))name=name.replace(/\.json$/i,'')+'.forma.json';let previewImage=null;try{previewImage=captureProjectPreview({renderer,camera,meshes:meshes.values(),sketches:sketchGroup.children});}catch(e){console.warn('モデル画像を保存できませんでした',e);}download(JSON.stringify({format:'forma-cad',version:1,units:'mm',features,drawing:drawingController?.getState()||null,...(previewImage?{preview:previewImage}:{})},null,2),name,'application/json');projectFileName=name;modified=false;renderTree();notify(name+' を保存しました'+(!previewImage&&meshes.size?'（プレビュー画像なし）':''));};
$('load').onclick=()=>$('file').click();let projectReadRevision=0;$('file').onchange=async()=>{const file=$('file').files[0];if(!file)return;const request=toolCancelRevision,read=++projectReadRevision;projectLoadPreview.cancel();try{if(file.size>30_000_000)throw Error('ファイルは30MB以下にしてください。');const text=await file.text();if(request!==toolCancelRevision||read!==projectReadRevision)return;const documentData=JSON.parse(text),next=validateProject(documentData),drawingData=readDrawingState(documentData.drawing);projectLoadPreview.show({file,next,drawingData,preview:documentData.preview,modified,request});}catch(e){if(request===toolCancelRevision&&read===projectReadRevision)notify('読み込みできません: '+e.message);}finally{if(read===projectReadRevision)$('file').value='';}};
$('export').onclick=async()=>{if(!meshes.size||$('export').disabled)return;$('export').disabled=true;try{const message=await saveStl(()=>{const exportGroup=new THREE.Group();for(const m of meshes.values())if(m.visible)exportGroup.add(new THREE.Mesh(m.geometry));if(!exportGroup.children.length)throw Error('表示中のソリッドがありません');exportGroup.updateMatrixWorld(true);return new STLExporter().parse(exportGroup,{binary:true});},download);if(message)notify(message);}catch(error){notify('STL保存に失敗しました：'+error.message);}finally{$('export').disabled=false;}};
function hingeReference(feature){
 const p=feature.spec,hardwareScale=Number.isFinite(p.hardwareScale)?p.hardwareScale:1,source=meshes.get(p?.target);
 if(!p?.hinge)return null;
 const normal={XY:2,XZ:1,YZ:0}[p.enclosureSplit],sideAxis='XYZ'.indexOf(p.hingeEdge?.slice(1)),axisIndex=[0,1,2].find(i=>i!==normal&&i!==sideAxis),side=p.hingeEdge?.[0]==='+'?1:-1;
 if(normal===undefined||sideAxis<0||sideAxis===normal||axisIndex===undefined||!['+','-'].includes(p.hingeEdge?.[0]))return null;
 const frame=feature.analysis?.hingeFrame,finitePoint=point=>Array.isArray(point)&&point.length===3&&point.every(Number.isFinite);
 const exact=frame&&frame.normal===normal&&frame.sideAxis===sideAxis&&frame.axisIndex===axisIndex&&frame.side===side&&finitePoint(frame.point)&&finitePoint(frame.a)&&finitePoint(frame.b)&&Array.isArray(frame.rimPositions)&&frame.rimPositions.length===6&&frame.rimPositions.every(Number.isFinite);
 let point,a,b,rimPositions;
 if(exact){
  point=[...frame.point];a=[...frame.a];b=[...frame.b];rimPositions=[...frame.rimPositions];
 }else{
  if(![p.clearance,p.thickness,p.hingeRadialGap,p.splitOffset,feature.analysis?.boxExtra||0,p.hingeAxialGap].every(Number.isFinite))return null;
  const body=meshes.get(p.id),lid=meshes.get(p.id+'-part2');
  if(!source&&!body&&!lid)return null;
  const padding=p.clearance+(feature.analysis?.boxExtra||0)+p.thickness;
  const pinRadius=Math.max(1,p.thickness*.55)*hardwareScale,radius=pinRadius+p.hingeRadialGap+Math.max(.9,p.thickness*.65)*hardwareScale;
  const bounds=new THREE.Box3().setFromObject(source||body||lid),lo=bounds.min.toArray(),hi=bounds.max.toArray();
  point=[0,0,0];point[axisIndex]=(lo[axisIndex]+hi[axisIndex])/2;
  point[sideAxis]=source?(side===1?hi[sideAxis]+padding:lo[sideAxis]-padding)+side*(radius+p.thickness*.4):(side===1?hi[sideAxis]-radius:lo[sideAxis]+radius);
  point[normal]=p.splitOffset;
  // The body spans the full BOX width; its pin circles give exact cap positions.
  const outerLo=lo[axisIndex]-(source?padding:0),outerHi=hi[axisIndex]+(source?padding:0),margin=Math.min(1,Math.max(.2,(outerHi-outerLo)*.05));
  a=[...point];b=[...point];a[axisIndex]=outerLo+margin;b[axisIndex]=outerHi-margin;
  // Legacy projects have no hingeFrame. Recover the axis from generated pin
  // and sleeve circles, even if a later operation removed the original solid.
  const circles=[p.id,p.id+'-part2'].flatMap(bodyId=>{
   const entries=meshes.get(bodyId)?.children[0]?.geometry?.userData.circularEdges?.values()||[];
   const expected=bodyId===p.id?pinRadius:pinRadius+p.hingeRadialGap;
   return [...new Set(entries)].filter(c=>finitePoint(c.center)&&Number.isFinite(c.radius)&&Math.abs(c.radius-expected)<Math.max(.08,expected*.03)&&Math.abs(c.center[normal]-p.splitOffset)<.2).map(c=>({bodyId,center:c.center}));
  });
  circles.sort((x,y)=>source?Math.abs(x.center[sideAxis]-point[sideAxis])-Math.abs(y.center[sideAxis]-point[sideAxis]):side*(y.center[sideAxis]-x.center[sideAxis]));
  const axisCircle=circles[0];
  if(!source&&!axisCircle)return null;
  if(axisCircle&&(!source||Math.abs(axisCircle.center[sideAxis]-point[sideAxis])<Math.max(2,radius))){
   point[sideAxis]=a[sideAxis]=b[sideAxis]=axisCircle.center[sideAxis];
   point[normal]=a[normal]=b[normal]=axisCircle.center[normal];
   const onAxis=bodyId=>circles.filter(c=>c.bodyId===bodyId&&Math.abs(c.center[sideAxis]-point[sideAxis])<.1&&Math.abs(c.center[normal]-point[normal])<.1).map(c=>c.center[axisIndex]).sort((x,y)=>x-y);
   const bodyCaps=onAxis(p.id),sleeveCaps=onAxis(p.id+'-part2'),caps=bodyCaps.length>=2?bodyCaps:sleeveCaps;
   if(caps.length>=2){
    const left=caps[0],right=caps.at(-1),middle=(left+right)/2;
    const halfLength=right-left+(caps===sleeveCaps?2*p.hingeAxialGap:0);
    if(halfLength>0){a[axisIndex]=middle-halfLength;b[axisIndex]=middle+halfLength;point[axisIndex]=middle;}
   }
  }
  const length=b[axisIndex]-a[axisIndex],end=length*.25;
  rimPositions=[a[axisIndex],a[axisIndex]+end,a[axisIndex]+end+p.hingeAxialGap,b[axisIndex]-end-p.hingeAxialGap,b[axisIndex]-end,b[axisIndex]];
 }
 const direction=[0,0,0];direction[axisIndex]=1;
 const rimPoints=rimPositions.map((position,i)=>{const center=[...point];center[axisIndex]=position;return {point:center,bodyId:i===2||i===3?p.id+'-part2':p.id};});
 const outerDiameter=2*(Math.max(1,p.thickness*.55)*hardwareScale+p.hingeRadialGap+Math.max(.9,p.thickness*.65)*hardwareScale);
 return {point,a,b,direction,normal,sideAxis,axisIndex,side,rimPoints,outerDiameter,outputIds:[p.id,p.id+'-part2'],name:'ヒンジ軸中心'};
}
function hingeReferences(selectedId=null){return features.filter(f=>f.kind==='cadop'&&f.spec?.type==='enclose'&&f.spec.hinge&&[f.spec.id,f.spec.id+'-part2'].some(id=>meshes.get(id)?.visible||id===selectedId)).map(hingeReference).filter(Boolean);}
function hingeSketchPoint(ref){
 const point=new THREE.Vector3(...ref.point),offset=sketchOrigin.dot(sketchBasis.n)-point.dot(sketchBasis.n);
 if(Math.abs(offset)>1e-4){if(Math.abs(new THREE.Vector3(...ref.direction).dot(sketchBasis.n))<.999)return null;point.addScaledVector(sketchBasis.n,offset);}
 return point;
}
function hingeSketchUsesVisibleRim(){
 return sketch&&($('profile').value==='point'||$('profile').value==='circle'&&!firstPoint);
}
function hingeSketchRimPoints(ref){
 const alongNormal=Math.abs(new THREE.Vector3(...ref.direction).dot(sketchBasis.n))>.999;
 const offset=sketchOrigin.dot(sketchBasis.n);
 return ref.rimPoints.filter(r=>meshes.get(r.bodyId)?.visible).map(r=>new THREE.Vector3(...r.point))
  .filter(point=>alongNormal||Math.abs(point.dot(sketchBasis.n)-offset)<1e-4);
}
function hingeCirclePerimeterPoint(pointer,references){
 if(!sketch||$('profile').value!=='circle'||!firstPoint||polygonMode||circleDiameterLocked)return null;
 const ndc=new THREE.Vector2(pointer.x/host.clientWidth*2-1,1-pointer.y/host.clientHeight*2);
 const ray=new THREE.Raycaster();ray.setFromCamera(ndc,camera);
 let best=null,bestDistance=10;
 for(const ref of references){
  const axis=new THREE.Vector3(...ref.direction).normalize();
  if(Math.abs(axis.dot(sketchBasis.n))<.999||Math.abs(ray.ray.direction.dot(axis))<.05)continue;
  for(const rim of ref.rimPoints){
   if(!meshes.get(rim.bodyId)?.visible)continue;
   const center=new THREE.Vector3(...rim.point);
   if(center.distanceTo(firstPoint)>1e-4)continue;
   const onCap=new THREE.Vector3();
   if(!ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(axis,center),onCap))continue;
   const radial=onCap.sub(center);radial.addScaledVector(axis,-radial.dot(axis));
   if(radial.lengthSq()<1e-12)continue;
   const candidate=center.clone().addScaledVector(radial.normalize(),ref.outerDiameter/2);
   const projected=screenPoint(candidate),distance=Math.hypot(projected.x-pointer.x,projected.y-pointer.y);
   if(distance<bestDistance){best=candidate;bestDistance=distance;}
  }
 }
 return best;
}
function printEnclosurePose(feature){
 const reference=hingeReference(feature);
 if(!reference)throw Error('分割平面とヒンジの辺を確認してください');
 const {normal,sideAxis,axisIndex,side,point:hinge}=reference;
 const axis=new THREE.Vector3();axis.setComponent(axisIndex,1);
 const outward=new THREE.Vector3();outward.setComponent(sideAxis,side);
 const unitNormal=new THREE.Vector3();unitNormal.setComponent(normal,1);
 const handed=axis.clone().cross(outward).dot(unitNormal);
 if(!Number.isFinite(feature.spec.hingeAngle)||Math.abs(handed)!==1)throw Error('蓋の角度とヒンジ軸を確認してください');
 return {axis,hinge,turnAngle:-(90-feature.spec.hingeAngle)*handed};
}
function validatePrintMesh(mesh,label){
 const geometry=mesh.geometry,position=geometry.getAttribute('position'),index=geometry.getIndex();
 if(!position||position.itemSize!==3||position.count<3||!index||!index.count||index.count%3)throw Error(label+'のSTL用メッシュが不正です。BOX工程を作り直してください');
 for(let i=0;i<position.count;i++)for(let j=0;j<3;j++)if(!Number.isFinite(position.getComponent(i,j)))throw Error(label+'のSTL用メッシュに不正な座標があります');
 for(let i=0;i<index.count;i++)if(index.getX(i)<0||index.getX(i)>=position.count)throw Error(label+'のSTL用メッシュに不正な面があります');
}
function printEnclosureStl(feature){
 const p=feature.spec,body=meshes.get(p.id),lid=meshes.get(p.id+'-part2');
 if(!body||!lid)throw Error('BOX本体と蓋が必要です');
 const {axis,hinge,turnAngle}=printEnclosurePose(feature);
 validatePrintMesh(body,'BOX本体');validatePrintMesh(lid,'蓋');
 const turn=new THREE.Matrix4().makeTranslation(-hinge[0],-hinge[1],-hinge[2]);
 turn.premultiply(new THREE.Matrix4().makeRotationAxis(axis,turnAngle*Math.PI/180));turn.premultiply(new THREE.Matrix4().makeTranslation(...hinge));
 const geometries=[body.geometry.clone(),lid.geometry.clone()];geometries[1].applyMatrix4(turn);
 const printMatrix=new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(axis,new THREE.Vector3(0,0,1)));
 for(const geometry of geometries)geometry.applyMatrix4(printMatrix);
 let bottom=Infinity;for(const geometry of geometries){geometry.computeBoundingBox();bottom=Math.min(bottom,geometry.boundingBox.min.z);}
 const group=new THREE.Group();for(const geometry of geometries){geometry.translate(0,0,-bottom);geometry.computeVertexNormals();group.add(new THREE.Mesh(geometry));}
 try{group.updateMatrixWorld(true);return new STLExporter().parse(group,{binary:true});}finally{for(const geometry of geometries)geometry.dispose();}
}
$('export-enclosure').onclick=async()=>{
 const candidates=features.filter(f=>f.kind==='cadop'&&f.spec?.type==='enclose'&&f.spec.hinge&&f.outputs?.slice(0,2).every(o=>meshes.has(o.id)));
 const feature=candidates.at(-1);if(!feature)return;
 const button=$('export-enclosure');button.disabled=true;
 try{
  let check;
  const message=await saveStl(async()=>{
   const pose=printEnclosurePose(feature),p=feature.spec;
   check=await kernelClient.run(features,{type:'enclosePrintValidate',bodyId:p.id,lidId:p.id+'-part2',hinge:pose.hinge,axis:pose.axis.toArray(),turnAngle:pose.turnAngle});
   return printEnclosureStl(feature);
  },download);
  if(message)notify('蓋を90°開いた姿勢をCAD形状で検証しました。BOX本体との最小すき間 '+check.clearance.toFixed(2)+' mm。スライサーで張り出しとサポートを確認してください。'+message);
 }catch(error){notify('BOX印刷STLに失敗しました：'+error.message);}
 finally{button.disabled=false;}
};
const sample=()=>[{...defaults,id:'sample-base',name:'ベースプレート',width:80,height:60,depth:4},{...defaults,id:'sample-wall',name:'薄い押し出し',mode:'thin',width:80,height:60,wall:3,depth:26,z:4,operation:'join',target:'sample-base'}];
$('sample').onclick=()=>{if(modified&&!confirm('未保存の変更があります。サンプルを開きますか？'))return;setProject(sample());drawingController?.loadState(null);hiddenBodies.clear();for(const m of meshes.values())m.visible=true;selectFeature('sample-wall');dropPreview();setView('iso');fit();notify('底面＋壁厚3mmのサンプルです');};
$('clear').onclick=()=>{if(features.length&&!confirm('新しいデザインを作成しますか？現在の作業は「戻す」で復元できます。'))return;setProject([]);drawingController?.loadState(null);hiddenBodies.clear();stage='model';selected=null;chosenRegion=null;pendingExtrude=false;draftTouched=false;fillForm({...defaults,name:'スケッチ'});dropPreview();syncFields();fit();};
window.addEventListener('beforeunload',e=>{if(modified){e.preventDefault();e.returnValue='';}});
fillForm({...defaults,name:'スケッチ'});setProject([],{record:false});stage='model';selected=null;syncFields();dropPreview();modified=false;renderTree();fit();$('status').textContent='スケッチを作成し、閉じた領域から立体を作ります';
// A single real action is shared by the visible editor and WebMCP.
const context=document.modelContext;
if(context?.registerTool){try{Promise.resolve(context.registerTool({name:'create_cad_feature',title:'CAD工程を作成',description:'指定寸法で新規ボディの押し出し工程を作成する。単位mm。',inputSchema:{type:'object',properties:{profile:{type:'string',enum:['rect','circle','line']},mode:{type:'string',enum:['solid','thin']},width:{type:'number'},height:{type:'number'},diameter:{type:'number'},depth:{type:'number'},wall:{type:'number'},side:{type:'string',enum:['inside','outside','center']},x:{type:'number'},y:{type:'number'},z:{type:'number'}},required:['profile','mode','depth'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input!=='object')throw Error('設定が必要です');const allowed=['profile','mode','width','height','diameter','depth','wall','side','x','y','z'];for(const k of Object.keys(input))if(!allowed.includes(k))throw Error('未対応の設定: '+k);const f=validateFeature({...defaults,...input,id:crypto.randomUUID(),name:'押し出し',operation:'new'});selected=null;stage='extrusion';fillForm(f);const result=applyFeature();return result;}})).catch(()=>{});}catch{}}



function clearBodySelection(){selectedBodies.clear();if(bodySelectionHighlight){disposeObject(bodySelectionHighlight);bodySelectionHighlight=null;}host.dataset.selectedBodyCount='0';}
function chooseBody(id,add=false,toggle=true){
 const previous=add?new Set(selectedBodies):new Set();if(previous.has(id)&&toggle)previous.delete(id);else previous.add(id);commitBodySelection(previous);
}
function chooseBodyRange(ids,add){const selected=add?new Set(selectedBodies):new Set();for(const id of ids)selected.add(id);commitBodySelection(selected);}
function commitBodySelection(previous){
 clearEdgeSelection();clearFaceSelection();selectedSurface=null;selectedFace=null;chosenRegion=null;fragmentSelection=null;selected=null;stage='model';selectedBodies=previous;selectedBody=[...previous].at(-1)||null;dropPreview();syncFields();
 bodySelectionHighlight=new THREE.Group();for(const key of previous){const original=meshes.get(key);if(!original?.visible)continue;const m=new THREE.Mesh(original.geometry.clone(),new THREE.MeshBasicMaterial({color:0x3868ad,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));m.userData.displayBodyId=key;m.renderOrder=5;bodySelectionHighlight.add(m);}scene.add(bodySelectionHighlight);
 host.dataset.selectedBodyCount=String(previous.size);$('measurement').hidden=!previous.size;$('measurement-title').textContent=previous.size+' ボディを選択';$('measurement-length').textContent=previous.size===1?bodyDisplayName(selectedBody):'ボディ全体';$('measurement-angle').textContent='Ctrl＋クリックで追加・解除 / Deleteで削除';$('status').textContent=previous.size+' ボディを選択';
}
function setSelectionMode(value){if(value==='edge')bodyDisplay?.stopExploded();selectionMode=value;clearEdgeSelection();clearFaceSelection();selectedFace=null;selectedSurface=null;selectedBody=null;chosenRegion=null;fragmentSelection=null;hoverEdge=null;edgeSelectionMode=value==='edge';$('measurement').hidden=true;host.dataset.selectionMode=value;updateCenterMarkers();}
$('selection-mode').onchange=e=>setSelectionMode(e.target.value);
let edgeTurnBusy=false,edgeTurnState=null;
const edgeTurnButton=document.createElement('button');edgeTurnButton.id='edge-quarter-turn';edgeTurnButton.type='button';edgeTurnButton.hidden=true;edgeTurnButton.textContent='上側のソリッドを90°回転';edgeTurnButton.title='選択した直線の辺を軸に、接する上側のソリッドを90°回転します。初回はZがマイナスになりにくい方向、連続操作は同じ方向に回転します。';$('measurement').append(edgeTurnButton);
const edgeReverseTurnButton=document.createElement('button');edgeReverseTurnButton.id='edge-quarter-turn-reverse';edgeReverseTurnButton.type='button';edgeReverseTurnButton.hidden=true;edgeReverseTurnButton.textContent='逆方向へ90°回転';edgeReverseTurnButton.title='同じ辺とソリッドを、通常の回転ボタンとは逆の方向へ90°回転します。続けて押すと同じ逆方向に回転します。';$('measurement').append(edgeReverseTurnButton);
const edgeTurnActions=document.createElement('div');edgeTurnActions.id='edge-turn-actions';edgeTurnActions.hidden=true;edgeTurnActions.append(edgeTurnButton,edgeReverseTurnButton);$('measurement').append(edgeTurnActions);
edgeTurnButton.onclick=()=>rotateUpperEdgeBody(false);
edgeReverseTurnButton.onclick=()=>rotateUpperEdgeBody(true);
async function rotateUpperEdgeBody(reverse=false){
 if(edgeTurnBusy||sketch||stage!=='model'||selectedEdges.length!==1||selectedEdge?.circle||selectedEdge?.arc||moveTool?.active||document.querySelector('dialog[open]'))return;
 const original=features,request=toolCancelRevision,edge=clone(selectedEdge);let cancel=null;
 try{
  const frame=edgeTurnFrame(edge),continuous=edgeTurnState?.features===original&&edgeTurnState.key===frame.key&&edgeTurnState.bodyId===edge.bodyId;
  const mesh=continuous?meshes.get(edgeTurnState.bodyId):upperEdgeBody([...meshes.values()],edge);
  if(!mesh)throw Error('回転するソリッドがありません');
  const direction=continuous?edgeTurnState.angle:edgeQuarterTurn(mesh,edge).angle;
  const placement=edgeQuarterTurn(mesh,edge,reverse?-direction:direction),id=crypto.randomUUID(),spec={type:'move',id,target:mesh.userData.bodyId,...placement.transform,edgeQuarterTurn:{axis:placement.axis,angle:placement.angle}};
  edgeTurnBusy=true;edgeTurnButton.disabled=edgeReverseTurnButton.disabled=true;(reverse?edgeReverseTurnButton:edgeTurnButton).textContent='90°回転しています…';cancel=()=>kernelClient.reset();pendingKernelCancel=cancel;
  const result=await kernelClient.run(original,spec);
  if(features!==original||request!==toolCancelRevision||stage!=='model'||!selectedEdge||selectedEdges.length!==1||selectedEdge.bodyId!==edge.bodyId||edgeTurnFrame(selectedEdge).key!==frame.key)throw Error('操作が変更されました。辺を選び直してください');
  const next=[...original,{kind:'cadop',id,name:reverse?'辺を軸に逆方向へ90°回転':'辺を軸に90°回転',spec,...result}];setProject(next);selected=null;stage='model';syncFields();
  const rotated=meshes.get(spec.target),a=new THREE.Vector3(...placement.axis[0]),b=new THREE.Vector3(...placement.axis[1]);
  chooseEdgeHit({mesh:rotated,a,b,point:a.clone().add(b).multiplyScalar(.5)});
  edgeTurnState={features,key:placement.key,bodyId:spec.target,angle:direction};
  $('measurement-angle').textContent=(reverse?'逆方向へ':'辺を軸に')+'90°回転しました · 同じボタンで続けて回転';
  host.dataset.edgeTurn=JSON.stringify({bodyId:spec.target,angle:placement.angle,minZ:placement.range.min,continuous:!!continuous});
  notify('上側のソリッドを'+(reverse?'逆方向へ':'')+'90°回転しました。同じボタンを続けて押すと同じ方向に回転します');
 }catch(error){notify(error.message);}finally{if(pendingKernelCancel===cancel)pendingKernelCancel=null;edgeTurnBusy=false;edgeTurnButton.disabled=edgeReverseTurnButton.disabled=false;edgeTurnButton.textContent='上側のソリッドを90°回転';edgeReverseTurnButton.textContent='逆方向へ90°回転';}
}
let oppositePlaneBusy=false;
const oppositePlaneButton=document.createElement('button');oppositePlaneButton.id='opposite-face-ground';oppositePlaneButton.type='button';oppositePlaneButton.hidden=true;oppositePlaneButton.textContent='反対面をXYに接地';oppositePlaneButton.title='選択した平面の反対側をXY平面（Z=0）に合わせます。ソリッド全体を回転・移動します。';$('measurement').append(oppositePlaneButton);
oppositePlaneButton.onclick=groundOppositeFace;
async function groundOppositeFace(){closeSolidFaceMenu();if(oppositePlaneBusy)return;const face=selectedFace,mesh=face?.bodyId&&meshes.get(face.bodyId);if(!mesh){notify('ソリッドの平面を1つ選択してください');return;}const original=features;let world;
 try{mesh.updateMatrixWorld(true);world=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);const placement=oppositeFacePlacement(world,face),{oppositeArea,selectedNormal,...transform}=placement,spec={type:'move',id:crypto.randomUUID(),target:face.bodyId,...transform,oppositeFaceGround:true,groundPlane:'XY',selectedNormal};oppositePlaneBusy=true;oppositePlaneButton.disabled=true;oppositePlaneButton.textContent='反対面を配置しています…';pendingKernelCancel=()=>kernelClient.reset();const result=await kernelClient.run(original,spec);if(features!==original)throw Error('モデルが変更されました。平面を選び直してください');pendingKernelCancel=null;setProject([...original,{kind:'cadop',id:spec.id,name:'反対面をXYに接地',spec,...result}]);clearFaceSelection();clearEdgeSelection();selectedFace=null;selectedSurface=null;chosenRegion=null;selected=null;stage='model';syncFields();$('measurement').hidden=true;fit();notify('反対側の面をXY平面（Z=0）に合わせました。戻すで元の位置に戻せます');}
 catch(error){notify(error.message);}finally{world?.dispose();pendingKernelCancel=null;oppositePlaneBusy=false;oppositePlaneButton.disabled=false;oppositePlaneButton.textContent='反対面をXYに接地';}
}

window.addEventListener('keydown',async e=>{if(e.key!=='Delete'||e.repeat||!selectedBodies.size||sketch||document.querySelector('dialog[open]')||e.target.closest('input,textarea,select'))return;e.preventDefault();e.stopImmediatePropagation();const spec={type:'deleteBodies',targets:[...selectedBodies]},original=features;try{const result=await kernelClient.run(original,spec);if(features!==original)return;setProject([...original,{kind:'cadop',id:crypto.randomUUID(),name:'ボディを削除',spec,...result}]);syncFields();notify('選択したボディを削除しました。戻すで復元できます');}catch(err){notify(err.message);}});
function clearFaceSelection(){for(const f of selectedFaces)f.geometry.dispose();selectedFaces=[];host.dataset.selectedFaceCount='0';for(const child of [...regionGroup.children])if(child.userData.multiFace)disposeObject(child);}
function chooseFace(hit,add=false){edgeSelectionMode=false;
 if(pendingExtrude){clearFaceSelection();chooseSingleFace(hit);return;}
 const previous=add?[...selectedFaces]:[];if(!add)clearFaceSelection();
 selectingFaces=true;try{chooseSingleFace(hit);}finally{selectingFaces=false;}
 const g=hit.object.geometry,group=cadFaceGroup(g,hit.faceIndex);
 const highlight=regionGroup.children.find(c=>c.isMesh&&!c.userData.planeId);
 if(!highlight&&!group)return;
 const geometry=group?cadFaceGeometry(g,group):highlight.geometry.clone(),bounds=new THREE.Box3().setFromBufferAttribute(geometry.attributes.position);
 const key=group?cadFaceKey(hit.object.userData.bodyId,group):hit.object.userData.bodyId+':'+JSON.stringify([bounds.min.toArray(),bounds.max.toArray()].flat().map(n=>Math.round(n*1e4)));
 const found=previous.findIndex(f=>f.key===key);
 if(found>=0){previous[found].geometry.dispose();previous.splice(found,1);geometry.dispose();}
 else previous.push({key,bodyId:hit.object.userData.bodyId,point:hit.point.toArray(),normal:hit.face.normal.toArray(),geometry,cadSelections:cadFaceSelections(g,group),plane:selectedFace,surface:{...selectedSurface}});
 selectedFaces=previous;selectedSurface=previous.at(-1)?.surface||null;selectedFace=previous.length===1?selectionFacePlane(previous[0]):null;chosenRegion=selectedFace;
 for(const child of [...regionGroup.children])if(!child.userData.planeId)disposeObject(child);
 for(const f of selectedFaces){const mesh=new THREE.Mesh(f.geometry.clone(),new THREE.MeshBasicMaterial({color:0x3868ad,opacity:1,transparent:false,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));mesh.userData.multiFace=true;mesh.userData.displayBodyId=f.bodyId;mesh.renderOrder=5;regionGroup.add(mesh);}
 host.dataset.selectedFaceCount=String(selectedFaces.length);
 if(selectedFaces.length!==1){selectedFace=null;chosenRegion=null;$('measurement-title').textContent=selectedFaces.length+' 面を選択';$('measurement-length').textContent='複数面に同じプル距離を適用';}
 $('measurement-angle').textContent='Shift＋クリックで追加・解除 / 作成・修正 → プレス／プル';
 if(!selectedFaces.length){selectedSurface=null;$('measurement').hidden=true;}
}

function selectionFacePlane(entry){
 // Resolve curved-face measurements only when one selected face remains.
 if(entry.surfaceSeed){const {geometry,index,bodyId}=entry.surfaceSeed;const curved=cylindricalSelection(features,bodyId,geometry,index,new THREE.Vector3(...entry.point));if(curved){Object.assign(entry.surface,{radius:curved.radius,internal:curved.internal});curved.geometry.dispose();}delete entry.surfaceSeed;}
 if(!entry.plane&&entry.planeSeed){const {geometry,index,bodyId}=entry.planeSeed;try{const face=planarFace(geometry,index);entry.plane={...face,bodyId,cadFace:{bodyId,point:entry.point,normal:face.frame.n}};}catch{}}
 return entry.plane||null;
}
function chooseFaceRange(hits,add){
 if(hits.length===1&&!add){chooseFace(hits[0]);return;}
 const previous=add?[...selectedFaces]:[],keys=new Set(previous.map(f=>f.key));
 selectingFaces=true;try{clearEdgeSelection();}finally{selectingFaces=false;}
 if(!add)clearFaceSelection();
 for(const hit of hits){
  const g=hit.object.geometry,bodyId=hit.object.userData.bodyId,group=cadFaceGroup(g,hit.faceIndex);let geometry,key,plane=null,surface={bodyId,point:hit.point.toArray()};
  if(group){key=cadFaceKey(bodyId,group);if(keys.has(key))continue;geometry=cadFaceGeometry(g,group);}
  else{
   const curved=cylindricalSelection(features,bodyId,g,hit.faceIndex,hit.point);
   if(curved){geometry=curved.geometry;surface.radius=curved.radius;surface.internal=curved.internal;}
   else{try{plane={...planarFace(g,hit.faceIndex),bodyId};geometry=regionFaceGeometry(plane);}catch{continue;}}
   const box=new THREE.Box3().setFromBufferAttribute(geometry.attributes.position);key=bodyId+':'+JSON.stringify([box.min.toArray(),box.max.toArray()].flat().map(n=>Math.round(n*1e4)));if(keys.has(key)){geometry.dispose();continue;}
  }
  keys.add(key);previous.push({key,bodyId,point:hit.point.toArray(),normal:hit.face.normal.toArray(),geometry,cadSelections:cadFaceSelections(g,group),plane,surface,...(group&&g.userData.planarFaces?.includes(group.faceId)?{planeSeed:{geometry:g,index:hit.faceIndex,bodyId}}:group?{surfaceSeed:{geometry:g,index:hit.faceIndex,bodyId}}:{})});
 }
 selectedFaces=previous;selectedSurface=previous.at(-1)?.surface||null;selectedFace=previous.length===1?selectionFacePlane(previous[0]):null;selectedBody=previous.at(-1)?.bodyId||null;chosenRegion=selectedFace;fragmentSelection=null;selected=null;pendingExtrude=false;stage='model';dropPreview();syncFields();
 for(const child of [...regionGroup.children])if(!child.userData.planeId)disposeObject(child);
 for(const f of selectedFaces){const highlight=new THREE.Mesh(f.geometry.clone(),new THREE.MeshBasicMaterial({color:0x3868ad,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));highlight.userData.multiFace=true;highlight.userData.displayBodyId=f.bodyId;highlight.renderOrder=5;regionGroup.add(highlight);}
 host.dataset.selectedFaceCount=String(previous.length);$('measurement').hidden=!previous.length;$('measurement-title').textContent=previous.length+' 面を選択';$('measurement-length').textContent='複数面に同じプル距離を適用';$('measurement-angle').textContent='Shift＋クリックで追加・解除 / 作成・修正 → プレス／プル';
}
function chooseSingleFace(hit){fragmentSelection={bodyId:hit.object.userData.bodyId,point:hit.point.toArray()};$('center-pattern').hidden=true;clearEdgeSelection();selectedSurface={bodyId:hit.object.userData.bodyId,point:hit.point.toArray()};const curved=cylindricalSelection(features,hit.object.userData.bodyId,hit.object.geometry,hit.faceIndex,hit.point);if(curved){selectedSurface.radius=curved.radius;selectedSurface.internal=curved.internal;finishSketch(false);selectedFace=null;selectedBody=hit.object.userData.bodyId;selected=null;chosenRegion=null;pendingExtrude=false;stage='model';dropPreview();syncFields();for(const c of [...regionGroup.children])disposeObject(c);const m=new THREE.Mesh(curved.geometry,new THREE.MeshBasicMaterial({color:0x3868ad,transparent:false,opacity:1,side:THREE.DoubleSide,depthTest:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));m.renderOrder=5;regionGroup.add(m);$('measurement').hidden=false;$('measurement-title').textContent=curved.internal===true?'選択した穴の内壁':curved.internal===false?'選択した円柱の側面':'選択した曲面';$('measurement-length').textContent=curved.radius?'直径 '+fmt(curved.radius*2)+' mm':'ボディの面';$('measurement-angle').textContent='「作成・修正」の「ねじ」でこの面にねじを作成';notify('曲面を選択しました。作成・修正からプレス／プルやねじを実行できます');return;}try{const groups=hit.object.geometry.userData.faceGroups,planar=hit.object.geometry.userData.planarFaces;if(groups&&planar){const group=groups.find(g=>hit.faceIndex*3>=g.start&&hit.faceIndex*3<g.start+g.count);if(group&&!planar.includes(group.faceId))throw Error('曲面には直接作図できません。平面を選択してください');}selectedBody=hit.object.userData.bodyId;const face=planarFace(hit.object.geometry,hit.faceIndex);const bounds=new THREE.Box3().setFromBufferAttribute(hit.object.geometry.attributes.position);if(face.area<bounds.getSize(new THREE.Vector3()).lengthSq()*.00001)throw Error('曲面上には直接スケッチできません。平面を選んでください');const pending=pendingExtrude,desired=mode;finishSketch(false);selectedFace={...face,bodyId:hit.object.userData.bodyId,cadFace:hit.object.geometry.userData.faceGroups?{bodyId:hit.object.userData.bodyId,point:hit.point.toArray(),normal:face.frame.n}:undefined};chosenRegion=selectedFace;selected=null;stage='model';activeFrame=face.frame;dropPreview();syncFields();for(const c of [...regionGroup.children])disposeObject(c);const m=new THREE.Mesh(regionFaceGeometry(face),new THREE.MeshBasicMaterial({color:0x3868ad,transparent:false,opacity:1,side:THREE.DoubleSide,depthTest:false}));regionGroup.add(m);$('measurement').hidden=false;$('measurement-title').textContent='選択したソリッドの平面';$('measurement-length').textContent=fmt(face.area)+' mm²';$('measurement-angle').textContent='スケッチを作成 / 押し出し（E）';$('status').textContent='面を選択しました。スケッチを作成、または押し出し（E）';if(pending)beginExtrusion(desired);}catch(e){selectedFace=null;selectedBody=hit.object.userData.bodyId;selected=null;chosenRegion=null;stage='model';dropPreview();syncFields();$('measurement').hidden=false;$('measurement-title').textContent='選択した曲面';$('measurement-length').textContent='ボディの面';$('measurement-angle').textContent='円柱側面なら「ねじ」を実行できます';notify('面を選択しました。円柱の側面には「ねじ」を使用できます');}}
window.addEventListener('keydown',e=>{
 if(e.key==='Enter'&&sketch&&firstPoint&&lastDrawPoint&&$('profile').value==='rect'&&!e.defaultPrevented&&!e.isComposing&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!document.querySelector('dialog[open]')&&!e.target.closest('input,textarea,select,[contenteditable]')){e.preventDefault();placeEndpoint(lastDrawPoint);return;}
 if(e.key==='Enter'&&sketch&&$('profile').value==='line'&&!e.defaultPrevented&&!e.isComposing&&e.keyCode!==229&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!document.querySelector('dialog[open]')&&!e.target.closest('input:not([type=checkbox]),textarea,select,[contenteditable],#line-dimensions button')){
  e.preventDefault();
  let placed=false;
  if(firstPoint&&chainCount===0&&lastDrawPoint){const count=features.length;placeEndpoint(lastDrawPoint);placed=features.length>count;if(!placed)return;}
  finishSketch(false);draftTouched=false;dropPreview();
  $('status').textContent=placed?'線分を確定しました。スケッチを終了するか別のツールを選択':'線分コマンドを終了しました。スケッチを終了するか別のツールを選択';
  return;
 }
 if(e.key==='Enter'&&sketch&&firstPoint&&lastDrawPoint&&$('profile').value==='circle'&&!['INPUT','SELECT','BUTTON'].includes(document.activeElement.tagName)){e.preventDefault();placeEndpoint(lastDrawPoint);return;}
 if(e.key==='Enter'&&sketch&&$('profile').value==='spline'&&!['INPUT','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();if(splinePoints.length<2){notify('点を2つ以上指定してください');return;}try{applyFeature();}catch(e){notify(e.message);}}
});
window.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.defaultPrevented&&!e.isComposing&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.target.closest('input,textarea,select,button,[contenteditable]')&&confirmVisibleForm())e.preventDefault();});
const commandHelp={coilJoint:'円柱・角柱を、コイルで開閉する本体と蓋に変換します。',enclose:'対象を囲む殻を作ります。BOXは開口面を選ばなければ閉じた直方体です。面を選ぶと同じ向きのBOX面を開けます。ヒンジは「BOXを作る」→「ヒンジを付ける」で追加できます。対象ボディのすぐ下で分割平面と位置を先に指定できます。ヒンジを付けるとき、分割平面が未設定ならXY中央に設定します。BOXを外した場合はモデルの面をクリックして開口を選べます。BOXを作る場合は宝箱風の丸屋根と帯飾りも選べます。',trimSurface:'基準面をクリックし、切り取るボディを指定してください。矢印の方向を削ります。「削る側」で反転できます。平面は延長した面全体、円筒・円錐は選択面の高さの範囲で切り取ります。加工後のプレビューを確認して実行してください。',pipe:'スケッチの線・円弧・円・スプラインを経路にしてパイプを作成します。画面の線をクリックするか一覧で選択し、外径と中実／中空を指定してください。',sphere:'半径と中心位置を指定して、新しい球体ボディを作成します。初期値ではXYグリッドに接する位置に作成します。',revolve:"閉じた領域と直線の軸を選んで立体を作ります。角度・方向・操作を変更するとプレビューが更新されます。",shell:'開口にする面を選択してから実行します。Shift＋クリックで複数面を選択できます。壁厚と内側／外側を指定して中空化します。',fillet:'辺をクリックしてから実行すると、その辺だけを丸めます。面を選択してから開くと、その面の外周の辺が対象です。未選択ならボディの全辺が対象です。',pull:'平面・曲面をクリックし、Shift＋クリックで複数選択できます。負の距離で選択面を引っ込め、正の距離で盛り上げます。例：-0.1 mmでねじ山のかみ合わせに余裕を作ります。',move:'ボディを原点を通る軸で回転し、XYZ方向に移動します。',join:'結合は一体化、切り取りは対象からツールが重なる部分を除去、交差は重なる部分だけを残します。赤色は切り取りで除去／交差で残す範囲です。対象ボディとツールボディを指定してください。ツールは保持することもできます。',split:'ソリッドの平面を先に選択するか、分割面の一覧から構築平面・基準平面を指定します。距離0でその面を使用します。面が対象ボディを横切る必要があります。',sketchOffset:'スケッチの線または閉じた領域を選んで実行します。閉じた輪郭は正で外側、負で内側。開いた線は正で線の進行方向の左側です。',offset:'選択した面、または基準平面から指定距離の作図平面を作ります。',thread:'円柱の側面または穴の内壁を選択します。外側にはねじ山を追加し、穴の内側には内向きのねじ山を作ります。規格ねじの公差・はめあい指定には未対応です。',coil:'円形断面のらせんを作成します。軸はZ方向です。',loft:'異なる平面上の閉じた領域を2つ以上選択します。チェックした一覧の順番で接続します。',circular:'スケッチ・ソリッドの中心（⊙）や辺の中点（△）を選ぶと、その点を回転中心にできます。中点を基準にするときは回転軸をX・Y・Zから指定してください。軸は中心の平面に垂直、またはX・Y・Zから選びます。個数は元ボディを含みます。操作「結合」で元ボディと一体化します。形が離れている場合は「新規ボディ」を選んでください。',rectangular:'ボディまたはスケッチをワールドX・Y方向に複製します。個数は元の図形を含み、数値に合わせてプレビューが変わります。操作「結合」で元ボディと一体化します。形が離れている場合は「新規ボディ」を選んでください。',spline:'平面上を順番にクリックし、Enterで確定します。指定した点を通る滑らかな曲線です。Escで中止。',mirror:'基準平面から指定距離の平面に対して、ボディを反転コピーします。'};
const fieldNames={filletVerticalRadius:'縦角の希望半径 (mm)',filletCapRadius:'端面の希望半径 (mm)',jointAxis:'変換する軸（自動は押し出し方向）',closeAngle:'締め位置の角度補正 (°)',stopFaceSetback:'回転止め面の引き込み (mm)',latchStyle:'固定形状',latchGap:'固定部のすき間 (mm)',latchEngagement:'固定部の掛かり量 (mm)',jointGap:'かみ合わせのすき間・片側 (mm)',jointSeam:'合わせ目のすき間 (mm)',jointSplit:'分割位置・底から (mm、0は自動)',hand:'ねじの向き',jointPose:'表示・保存する姿勢',clearance:'対象とのすき間 (mm)',enclosureSplit:'２分割する平面',splitOffset:'分割平面の位置 (mm)',trimSide:'削る側',path:'経路のスケッチ',diameter:'外径 (mm)',wall:'肉厚 (mm)',bodyBoreWall:'本体内穴の壁厚 (mm、0は連動)',hollow:'断面',operation:'操作',combineMode:'操作',keepTools:'ツールボディ',cutClearance:'切り取りのすき間・片側 (mm)',thickness:'壁厚 (mm)',direction:'方向',center:'回転中心',target:'対象ボディ',other:'結合するボディ',radius:'半径 (mm)',wire:'断面の太さ (mm)',pitch:'ピッチ (mm)',turns:'巻き数',x:'X移動 / 位置 (mm)',y:'Y移動 / 位置 (mm)',z:'Z移動 / 位置 (mm)',angle:'角度 (°)',axis:'回転軸',plane:'基準平面',offset:'オフセット距離 (mm)',count:'個数 / X個数',count2:'Y個数',spacing:'X間隔 (mm)',spacing2:'Y間隔 (mm)',distance:'距離 (mm)'};
let trimWall=null,trimArrow=null;
function clearTrimArrow(){if(trimArrow){disposeObject(trimArrow);trimArrow=null;}delete host.dataset.trimDirection;}
function updateTrimArrow(){
 clearTrimArrow();if($('cad-command').value!=='trimSurface'||!trimWall?.normal)return;
 const n=new THREE.Vector3(...trimWall.normal).normalize();if($('cad-trimSide')?.value==='反転')n.negate();
 const mesh=meshes.get(trimWall.bodyId),size=mesh?new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3()).length():40,length=Math.max(2,size*.16);
 trimArrow=new THREE.ArrowHelper(n,new THREE.Vector3(...trimWall.point),length,0xd45732,length*.25,length*.13);
 for(const part of [trimArrow.line,trimArrow.cone]){part.geometry=part.geometry.clone();part.material.depthTest=false;part.renderOrder=20;}
 scene.add(trimArrow);host.dataset.trimDirection=JSON.stringify(n.toArray());
}
$('tools-dialog').addEventListener('close',clearTrimArrow);
$('cad-command').addEventListener('change',updateTrimArrow);
$('cad-fields').addEventListener('input',updateTrimArrow);
function trimWallStatus(){const el=$('trim-wall-status');if(el)el.textContent=trimWall?'基準面：'+bodyDisplayName(trimWall.bodyId)+'（選択済み）':'基準面：画面の面をクリックしてください';}
const schemas={coilJoint:{target:'body',jointAxis:['自動','X','Y','Z'],closeAngle:0,stopFaceSetback:0,filletVerticalRadius:2,filletCapRadius:2,latchGap:.05,latchEngagement:1.6,latchStyle:['ridge','claw'],wire:2,pitch:4.1,turns:2,wall:4.2,bodyBoreWall:1.5,jointGap:.4,jointSeam:0,jointSplit:0,hand:['右ねじ','左ねじ'],jointPose:['分けて並べる','閉じた状態','1回転開く','開閉スライダー']},enclose:{target:'body',thickness:2,clearance:0,enclosureSplit:['分割しない','XY','XZ','YZ'],splitOffset:0},trimSurface:{target:'body',trimSide:['通常','反転']},pipe:{path:'sketch',diameter:5,hollow:['中実','中空'],wall:1,operation:['新規ボディ','結合','切り取り'],target:'body'},sphere:{radius:10,x:0,y:0,z:10},revolve:{},shell:{target:'body',thickness:2,direction:['内側','外側']},fillet:{target:'body',radius:2},pull:{distance:-.1},move:{target:'body',x:0,y:0,z:0,axis:['X','Y','Z'],angle:0},join:{target:'body',other:'body',combineMode:['結合','切り取り','交差'],keepTools:['削除','保持'],cutClearance:0},split:{target:'body',plane:['SELECTED','XY','XZ','YZ'],offset:0},offset:{plane:['SELECTED','XY','XZ','YZ'],offset:10},sketchOffset:{distance:2},thread:{},coil:{radius:15,pitch:8,turns:3,wire:3,x:0,y:0,z:0},loft:{},circular:{target:'body',center:['SELECTED','ORIGIN'],axis:['NORMAL','Z','X','Y'],count:4,angle:360,operation:['結合','新規ボディ']},rectangular:{target:'body',count:2,count2:2,spacing:80,spacing2:60,operation:['結合','新規ボディ']},spline:{},mirror:{target:'body',plane:['YZ','XZ','XY','FACE','LINE'],offset:0}};
function pipeSketchSources(){const index=features.findIndex(f=>f.id===editingPipeId),items=(index>=0?features.slice(0,index):features).filter(f=>f.kind==='sketch'&&f.profile!=='point');const saved=index>=0?features[index].spec?.pathFeature:null;if(saved&&!items.some(f=>f.id===saved.id))items.push(saved);return items;}
function openPipeEdit(id){
 editingPipeId=id;const f=features.find(f=>f.id===id);$('cad-command').value='pipe';$('cad-command').disabled=true;renderCommand();
 const prefix=features.slice(0,features.indexOf(f)),bodies=rebuild(prefix);$('cad-target').replaceChildren();for(const [id,b] of bodies){$('cad-target').add(new Option(features.find(f=>f.id===id)?.name||'ボディ',id));b.geometry.dispose();}
 for(const [key,value] of Object.entries(f.spec))if($('cad-'+key))$('cad-'+key).value=value;
 $('cad-help').textContent='外径・肉厚・経路を変更できます。経路の形は元のスケッチを編集してください。プレビューはこの工程の時点を表示し、確定時に後続工程も再計算します。';openToolsDialog();scheduleMachiningPreview();
}

function renderJoinClearanceOptions(){
 const input=$('cad-cutClearance');input.min=0;input.max=1000;input.step=.05;
 const note=document.createElement('p');note.id='join-clearance-note';note.textContent='0 mmで通常の切り取り。0.2 mmなら周囲に片側0.2 mmのすき間を作ります。';$('cad-fields').append(note);
 const update=()=>{const cutting=$('cad-combineMode').value==='切り取り';input.closest('label').hidden=!cutting;input.disabled=!cutting;note.hidden=!cutting;$('cad-other').closest('label').firstChild.textContent=cutting?'切り抜くボディ':'結合するボディ';};$('cad-combineMode').addEventListener('change',update);update();
}
function renderCoilJointOptions(){
 coilPrintTools?.destroy();coilPrintTools=null;
 const zero=document.createElement('input');zero.type='hidden';zero.id='cad-closeAngleZero';zero.value='2';$('cad-fields').append(zero);$('cad-hand').addEventListener('input',()=>{if(Number(zero.value)!==0)zero.value=$('cad-hand').value==='右ねじ'?'2':'-2';syncCoilAngleReferenceUI();});
 installCoilPresets($('cad-fields'),{read:()=>Object.fromEntries(coilPresetFields.map(key=>[key,['autoAdjust','alignStop','rimSeat','jointLatch','latchFirm','latchExtraFirm','autoFillet','filletBodyBottom','filletLidTop','filletVertical'].includes(key)?$('cad-'+key).checked:key==='filletRadius'?Number($('cad-filletCapRadius').value):['hand','latchStyle'].includes(key)?$('cad-'+key).value:$('cad-'+key).value.trim()===''?NaN:Number($('cad-'+key).value)])),apply:values=>{for(const [key,value] of Object.entries(values)){if(key==='filletRadius')continue;const input=$('cad-'+key);if(input.type==='checkbox')input.checked=value;else input.value=value;}syncCoilFilletUI();syncCoilLatchUI(true);syncCoilAngleReferenceUI();scheduleMachiningPreview();}});
 const autoFillet=document.createElement('input');autoFillet.type='checkbox';autoFillet.id='cad-autoFillet';const filletLabel=document.createElement('label');filletLabel.className='coil-joint-check';filletLabel.append(autoFillet,' 本体・蓋の外側に自動フィレットを付ける');const verticalRadius=$('cad-filletVerticalRadius'),verticalLabel=verticalRadius.closest('label'),filletHelp=document.createElement('span');filletHelp.className='coil-joint-field-help';filletHelp.textContent='本体の底・蓋の上部・多角形の縦の角を丸めます。合わせ目と内側の穴は対象外です。作成できない半径は縮小します。';verticalLabel.append(filletHelp);verticalLabel.before(filletLabel);for(const [key,statusId] of [['filletVerticalRadius','coil-fillet-vertical-effective'],['filletCapRadius','coil-fillet-cap-effective']]){const input=$('cad-'+key),status=document.createElement('span');input.min=.05;input.max=10;input.step=.05;status.id=statusId;status.className='coil-fillet-effective';status.setAttribute('role','status');status.setAttribute('aria-live','polite');input.closest('label').append(status);}
 const locations=document.createElement('fieldset');locations.id='coil-fillet-locations';locations.innerHTML='<legend>丸める箇所</legend>';for(const [key,text] of [['filletBodyBottom','本体の底'],['filletLidTop','蓋の上部'],['filletVertical','多角形の縦の角']]){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.id='cad-'+key;input.checked=true;label.append(input,' '+text);locations.append(label);}filletLabel.after(locations);autoFillet.addEventListener('input',syncCoilFilletUI);syncCoilFilletUI();
 const sectionButton=document.createElement('button');sectionButton.type='button';sectionButton.id='coil-section-show';sectionButton.textContent='すき間の断面図を表示';sectionButton.onclick=()=>coilSection.open();$('cad-jointSeam').closest('label').after(sectionButton);
 const fieldHelp={jointGap:'コイルの山と受け溝の間の余裕です。大きくすると回しやすくなりますが、がたつきが増えます。小さくするとがたつきは減りますが、印刷誤差で固くなりやすくなります。筒の直径差はこの値の2倍です。',jointSeam:'閉じたときの本体と蓋の間に残る上下のすき間です。大きくすると縁が当たりにくくなりますが、合わせ目が広がります。小さくすると合わせ目が狭くなりますが、印刷誤差で閉じにくくなる場合があります。「縁の面で止める」では0 mmに固定します。'};
 for(const [key,text] of Object.entries(fieldHelp)){const input=$('cad-'+key),help=document.createElement('span');help.id=input.id+'-help';help.className='coil-joint-field-help';help.textContent=text;input.setAttribute('aria-label',fieldNames[key]);input.setAttribute('aria-describedby',help.id);input.closest('label').append(help);}
 const input=document.createElement('input');input.type='checkbox';input.id='cad-autoAdjust';input.checked=true;
 const label=document.createElement('label');label.className='coil-joint-check';label.append(input,' 開閉に必要な寸法を自動調整');const flip=document.createElement('input');flip.type='checkbox';flip.id='cad-flipLidToGrid';const flipLabel=document.createElement('label');flipLabel.className='coil-joint-check';flipLabel.append(flip,' 蓋を逆さにしてXYグリッドに置く');
 const stop=document.createElement('input');stop.type='checkbox';stop.id='cad-alignStop';stop.checked=false;const stopLabel=document.createElement('label');stopLabel.className='coil-joint-check';stopLabel.append(stop,' 締め位置を揃える回転止めを付ける');const alignmentNote=document.createElement('p');alignmentNote.className='coil-joint-note';alignmentNote.textContent='角度補正は、その工程に保存した0°の基準から調整します。新規作成の0°には締め過ぎ2°の補正を含みます。印刷後のずれに合わせて、固定部付きは±10°、固定部なしは±180°で調整してください。回転止めは厚さ1.4 mm以上で作ります。必要に応じて壁厚が増え、内径が小さくなります。';const rim=document.createElement('input');rim.type='checkbox';rim.id='cad-rimSeat';rim.checked=true;const rimLabel=document.createElement('label');rimLabel.className='coil-joint-check';rimLabel.append(rim,' 縁の面で締め位置を止める');const rimNote=document.createElement('p');rimNote.className='coil-joint-note';rimNote.textContent='合わせ目を0 mmにして本体と蓋の縁を接触させます。小さな回転止めは付けません。壁厚は最低1.8 mmです。印刷後の向きのずれは角度補正で調整できます。開く方向の緩みを固定するロックではありません。';rim.addEventListener('input',()=>syncCoilRimSeatUI());
 const latch=document.createElement('input');latch.type='checkbox';latch.id='cad-jointLatch';latch.checked=true;const latchLabel=document.createElement('label');latchLabel.className='coil-joint-check';latchLabel.append(latch,' 接合部の内側に固定を付ける');const latchNote=document.createElement('p');latchNote.className='coil-joint-note';latchNote.id='coil-latch-note';latchNote.textContent='接合部の内側で爪が掛かり、閉じた位置からの逆回転を抑えます。開く方向に回すと斜面で爪がたわみ、外れます。縁で止める設定を使用します。爪付きでも角度補正を±10°で調整できます。本体と蓋の両方を印刷し直してください。保持力・開ける力・耐久性は実物で確認してください。';latch.addEventListener('input',()=>syncCoilLatchUI());$('cad-latchStyle').addEventListener('input',()=>{const style=$('cad-latchStyle'),previous=style.dataset.previousStyle||'ridge',current=style.value;if(previous!==current){const gap=$('cad-latchGap'),height=$('cad-latchEngagement');style.dataset[previous+'Gap']=gap.value;style.dataset[previous+'Height']=height.value;gap.value=style.dataset[current+'Gap']??(current==='ridge'?'.05':'.15');height.value=style.dataset[current+'Height']??(current==='ridge'?'1.6':'1.1');style.dataset.previousStyle=current;}syncCoilLatchUI();});
 const firm=document.createElement('input');firm.type='checkbox';firm.id='cad-latchFirm';firm.checked=true;const firmLabel=document.createElement('label');firmLabel.className='coil-joint-check';firmLabel.append(firm,' 爪の腕と受け側を強化する');const firmNote=document.createElement('p');firmNote.className='coil-joint-note';firmNote.id='coil-firm-note';firmNote.textContent='腕を短く・幅広にして、たわみにくくします。回転止めの上部の当たり面も0.7 mmから1.2 mmへ厚くします。受け溝の奥には最低1.2 mmの壁を残します。多角形では厚い角の付近に爪を配置し、収まらない場合は掛かり量を自動調整します。強化の推奨値は爪のすき間0.2 mm・掛かり量0.9 mmです。開ける力も増えるため、固すぎる場合は掛かり量を少し下げてください。';const stronger=document.createElement('button');stronger.type='button';stronger.id='coil-stronger-latch';stronger.textContent='従来の強化値を適用';stronger.onclick=()=>{latch.checked=true;firm.checked=true;extra.checked=false;$('cad-latchGap').value='.2';$('cad-latchEngagement').value='.9';syncCoilLatchUI();scheduleMachiningPreview();};
 const extra=document.createElement('input');extra.type='checkbox';extra.id='cad-latchExtraFirm';extra.checked=true;const extraLabel=document.createElement('label');extraLabel.className='coil-joint-check';extraLabel.append(extra,' 爪の保持力をさらに強化する');const extraNote=document.createElement('p');extraNote.className='coil-joint-note';extraNote.id='coil-extra-note';extraNote.textContent='強化した腕をさらに0.1 mm厚く、0.5 mm短く、0.4 mm幅広くします。外側には突起を増やしません。推奨値は肉厚3.3 mm・爪の掛かり量1.1 mm・爪と受けのすき間0.15 mmです。肉厚を増やすと収納する内側の空間は小さくなります。開く力も増えます。本体と蓋の両方を再印刷してください。';extra.addEventListener('input',()=>{if(extra.checked)firm.checked=true;syncCoilLatchUI();});firm.addEventListener('input',()=>{if(!firm.checked)extra.checked=false;syncCoilLatchUI();});const extraApply=document.createElement('button');extraApply.type='button';extraApply.id='coil-extra-stronger-latch';extraApply.textContent='追加強化の推奨値を適用';extraApply.onclick=()=>{latch.checked=true;firm.checked=true;extra.checked=true;$('cad-wall').value='3.3';$('cad-latchGap').value='.15';$('cad-latchEngagement').value='1.1';syncCoilLatchUI();scheduleMachiningPreview();};
 $('cad-fields').append(latchLabel,latchNote,firmLabel,firmNote,stronger,extraLabel,extraNote,extraApply);
 for(const [key,text] of Object.entries({latchGap:'大きくすると動かしやすくなりますが、閉じたときの遊びが増えます。小さすぎると印刷誤差で爪がはまらなくなります。',latchEngagement:'大きくすると爪が深く掛かり、開くときの力と必要なたわみ量が増えます。小さくすると開けやすくなりますが、掛かりが弱くなります。自動調整では壁の厚さに収まる掛かり量に調整します。'})){const input=$('cad-'+key),help=document.createElement('span');help.className='coil-joint-field-help';help.id='coil-'+key+'-detail';help.textContent=text;input.closest('label').append(help);input.min=key==='latchGap'?.05:.4;input.max=key==='latchGap'?1:1.6;input.step=.05;}
 $('cad-fields').append(rimLabel,rimNote,stopLabel,alignmentNote);$('cad-closeAngle').min=-180;$('cad-closeAngle').max=180;const stopInset=$('cad-stopFaceSetback');stopInset.min=0;stopInset.max=1;stopInset.step=.05;
 const compensate=document.createElement('button');compensate.type='button';compensate.id='coil-correct-two-degrees';compensate.textContent='締め過ぎをさらに2°補正';compensate.onclick=()=>{const input=$('cad-closeAngle'),hand=$('cad-hand').value==='右ねじ'?1:-1;input.value=Math.max(Number(input.min),Math.min(Number(input.max),(Number(input.value)||0)+hand*2));input.dispatchEvent(new Event('input',{bubbles:true}));};$('cad-closeAngle').closest('label').after(compensate);const angleHelp=document.createElement('span');angleHelp.id='coil-angle-reference-help';angleHelp.className='coil-joint-field-help';$('cad-closeAngle').closest('label').append(angleHelp);syncCoilAngleReferenceUI();
 const slider=document.createElement('fieldset');slider.id='coil-opening-controls';slider.innerHTML='<legend>蓋の開閉</legend><label>開く回転数<input id="cad-opening-range" type="range" min="0" max="10" step="0.01" value="0" disabled></label><label>回転数を入力<input id="cad-jointOpenTurns" type="number" min="0" max="10" step="any" value="0" required disabled></label><p id="coil-opening-value" role="status"></p><p>右へ動かすと蓋が回転して上がります。右端で取り外した状態になります。この姿勢で実行・保存できます。</p>';$('cad-fields').append(slider);
 const result=document.createElement('p');result.id='coil-joint-result';result.setAttribute('role','status');
 const note=document.createElement('p');note.className='coil-joint-note';note.textContent='水色は本体、橙色は蓋です。新規作成時は本体と蓋を自動でXYグリッド上に並べます。再編集では表示姿勢も変更できます。蓋だけを逆さに置くチェックでは、本体の位置を保ち、蓋を横に並べます。すき間は片側の値です。印刷の収縮や表面の粗さに合わせて調整してください。';
 $('cad-fields').append(label,flipLabel,result,note);$('cad-jointPose').addEventListener('input',()=>syncCoilOpeningUI());for(const id of ['cad-opening-range','cad-jointOpenTurns'])$(id).addEventListener('input',e=>{e.stopPropagation();if(e.target.value==='')return;const turns=Math.max(0,Math.min(Number(e.target.max),Number(e.target.value)));if(!Number.isFinite(turns))return;$('cad-opening-range').value=turns;$('cad-jointOpenTurns').value=turns;updateCoilOpeningPreview();});syncCoilOpeningUI();$('cad-wire').closest('label').firstChild.textContent='コイルの太さ・直径 (mm)';$('cad-wall').closest('label').firstChild.textContent='接合部・蓋・底板の厚さ (mm)';$('cad-bodyBoreWall').min=0;$('cad-bodyBoreWall').step=.1;$('cad-jointSplit').min=0;for(const key of ['wall','jointGap','jointSeam'])$('cad-'+key).min=key==='wall'?.1:key==='jointSeam'?.01:.05;organizeCoilJointSettings();syncCoilLatchUI();
}
function organizeCoilJointSettings(){
 const parent=$('cad-fields'),help=document.createElement('details');help.id='coil-settings-help';help.className='coil-settings-fold';help.innerHTML='<summary>詳しい説明</summary>';
 const explanation=(title,node)=>{const h=document.createElement('h4');h.textContent=title;help.append(h,node);};
 const overview=document.createElement('p');overview.textContent='円柱・直方体・凸多角形の角柱が対象です。穴・段差・テーパー・凹形状は対象外です。外形を保ち、接合部と開口は円形で作ります。本体がオス、蓋がメスです。右ねじは上から見て反時計回りに開きます。';explanation('変換できる形状',overview);
 const names={jointAxis:'変換する軸',jointSplit:'分割位置・底から (mm)',wall:'接合部の肉厚 (mm)',bodyBoreWall:'本体内穴の壁厚 (mm、0は連動)',wire:'コイルの太さ (mm)',jointGap:'かみ合わせ・片側 (mm)',jointSeam:'合わせ目 (mm)',closeAngle:'角度補正 (°)',stopFaceSetback:'回転止め面の引き込み (mm)',filletVerticalRadius:'縦角の希望半径 (mm)',filletCapRadius:'端面の希望半径 (mm)'};for(const [key,text] of Object.entries(names))$('cad-'+key).closest('label').firstChild.textContent=text;
 const shortHelp={jointSplit:'0で自動。',wall:'厚くすると山を高くできますが、内穴は狭くなります。',bodyBoreWall:'小さくすると本体の穴だけ広がります。0は肉厚に連動。',jointGap:'大きいほど回しやすく、小さいほど遊びが減ります。',jointSeam:'閉じたときの上下のすき間。縁で止める場合は0 mm。',latchGap:'小さいほど遊びが減ります。',latchEngagement:'大きいほど深く掛かり、開く力も増えます。',filletVerticalRadius:'角柱の縦角に適用。',filletCapRadius:'本体の底・蓋の上部に適用。',closeAngle:'＋は反時計回り、−は時計回り。',stopFaceSetback:'大きいほど山側の止め面を引き込みます。初期値は0 mm。'};
 for(const [key,text] of Object.entries(shortHelp)){const input=$('cad-'+key),label=input.closest('label'),long=label.querySelector('.coil-joint-field-help');if(long)explanation(fieldNames[key],long);const brief=document.createElement('span');brief.className='coil-field-hint';brief.id=input.id+'-hint';brief.textContent=text;input.setAttribute('aria-describedby',[brief.id,label.querySelector('.coil-fillet-effective')?.id].filter(Boolean).join(' '));label.append(brief);}
 const effective=document.createElement('span');effective.id='coil-latch-effective';effective.className='coil-latch-effective';effective.setAttribute('role','status');effective.hidden=true;$('cad-latchEngagement').closest('label').append(effective);
 const titles=['固定方法','腕と受けの強化','追加強化と推奨値','縁で締め止め','角度補正と回転止め','配置・印刷'];[...parent.querySelectorAll('.coil-joint-note')].forEach((node,i)=>explanation(titles[i]||'補足',node));
 const compactLabels={jointLatch:' 内側に固定を付ける',latchFirm:' 腕と受けを強化する',latchExtraFirm:' 保持力をさらに強化する',autoFillet:' 外側の角を丸める',rimSeat:' 縁で締め止め',alignStop:' 回転止めを付ける'};for(const [key,text] of Object.entries(compactLabels))$('cad-'+key).closest('label').lastChild.textContent=text;
 const field=key=>$('cad-'+key).closest('label'),group=(id,title,nodes)=>{const box=document.createElement('fieldset'),legend=document.createElement('legend');box.id=id;box.className='coil-settings-group';legend.textContent=title;box.append(legend,...nodes);parent.append(box);return box;};
 group('coil-basic-settings','基本寸法',['target','jointAxis','jointSplit','wall','bodyBoreWall','wire','turns','pitch','hand','jointGap','autoAdjust'].map(field));
 group('coil-latch-settings','固定方法',['jointLatch','latchStyle','latchEngagement','latchGap','latchFirm','latchExtraFirm'].map(field).concat($('coil-extra-stronger-latch')));
 group('coil-alignment-settings','締め位置',[field('closeAngle'),$('coil-correct-two-degrees'),field('stopFaceSetback'),field('rimSeat'),field('jointSeam'),field('alignStop'),$('coil-section-show')]);
 group('coil-fillet-settings','フィレット',[field('autoFillet'),field('filletVerticalRadius'),field('filletCapRadius'),$('coil-fillet-locations')]);
 const poseGroup=group('coil-pose-settings','配置',[field('jointPose'),field('flipLidToGrid'),$('coil-opening-controls')]);poseGroup.hidden=!editingCoilJointId;if(!editingCoilJointId){const placement=document.createElement('p');placement.id='coil-auto-placement';placement.className='coil-field-hint';placement.textContent='作成時に本体と蓋を自動で並べ、蓋を逆さにしてXYグリッドに置きます。作成後は本体・蓋の「再編集」で詳細や表示姿勢を変更できます。';parent.append(placement);}
 coilPrintTools=createCoilPrintTools(parent,{scene,getOutputs:coilPrintOutputs,exportPiece:exportCoilTestPiece,onState:stats=>{if(stats)host.dataset.coilPrintWarnings=JSON.stringify(stats);else delete host.dataset.coilPrintWarnings;}});
 const preset=document.createElement('details');preset.id='coil-preset-fold';preset.className='coil-settings-fold';preset.innerHTML='<summary>印刷設定プリセット</summary>';const box=$('coil-presets');box.querySelector('legend').textContent='保存・呼び出し';box.querySelector('p:not([id])').textContent='このブラウザーに保存します。呼び出した後は再計算します。';preset.append(box);parent.append(preset);
 const previous=document.createElement('details');previous.id='coil-previous-strength';previous.className='coil-settings-fold';previous.innerHTML='<summary>従来の強化値を使う</summary><p>すき間0.2 mm・掛かり量0.9 mm。追加強化はOFFにします。</p>';previous.append($('coil-stronger-latch'));help.append(previous);
 const result=$('coil-joint-result'),calculation=document.createElement('details');calculation.id='coil-calculation-details';calculation.className='coil-settings-fold';calculation.innerHTML='<summary>計算結果の詳細</summary><p id="coil-calculation-text"></p>';parent.append(result,calculation,help);
}
function syncCoilAngleReferenceUI(){const help=$('coil-angle-reference-help');if(!help)return;const calibrated=Number($('cad-closeAngleZero').value)!==0;help.textContent=(calibrated?'この0°は、従来の締め過ぎ2°補正を含む新しい基準です。':'この工程・プリセットは従来の角度基準です。')+' ＋は蓋を上から見て反時計回り、−は時計回りに追加補正します。固定部付きは±10°で微調整できます。角度だけの変更なら蓋のみを再印刷します。';}
function syncCoilFilletUI(){const active=$('cad-autoFillet')?.checked;for(const key of ['filletVerticalRadius','filletCapRadius','filletBodyBottom','filletLidTop','filletVertical'])if($('cad-'+key))$('cad-'+key).disabled=!active;updateCoilFilletEffectiveUI();updateCoilFilletOverlay();}
function syncCoilRimSeatUI(reset=false){
 const rim=$('cad-rimSeat'),seam=$('cad-jointSeam'),stop=$('cad-alignStop');if(!rim)return;
 if(reset){delete rim.dataset.active;delete rim.dataset.seam;delete rim.dataset.stop;}
 if(rim.checked){
  if(!rim.dataset.active){rim.dataset.seam=Number(seam.value)>=.01?seam.value:'.15';rim.dataset.stop=String(stop.checked);rim.dataset.active='true';}
  seam.value='0';seam.min=0;seam.disabled=true;stop.checked=false;stop.disabled=true;
 }else{
  if(rim.dataset.active){seam.value=rim.dataset.seam;stop.checked=rim.dataset.stop==='true';delete rim.dataset.active;}
  seam.min=.01;seam.disabled=false;stop.disabled=false;
 }
}
function syncCoilLatchUI(reset=false){
 const latch=$('cad-jointLatch'),rim=$('cad-rimSeat'),angle=$('cad-closeAngle');if(!latch)return;
 const style=$('cad-latchStyle'),ridge=style.value==='ridge',setHidden=(el,hidden)=>{if(!el)return;el.hidden=hidden;el.style.display=hidden?'none':'';};
 if(reset){delete latch.dataset.active;delete latch.dataset.rim;for(const key of ['ridgeGap','ridgeHeight','clawGap','clawHeight'])delete style.dataset[key];style.dataset.previousStyle=style.value;}else if(!style.dataset.previousStyle)style.dataset.previousStyle=style.value;
 if(latch.checked){
  if(!latch.dataset.active){latch.dataset.rim=String(rim.checked);latch.dataset.active='true';}
  rim.checked=true;rim.disabled=true;
 }else{
  if(latch.dataset.active){rim.checked=latch.dataset.rim==='true';delete latch.dataset.active;}
  rim.disabled=false;angle.disabled=false;
 }
 angle.disabled=false;angle.min=latch.checked?-10:-180;angle.max=latch.checked?10:180;angle.step='any';
 style.disabled=!latch.checked;setHidden(style.closest('label'),!latch.checked);const stopInset=$('cad-stopFaceSetback');if(stopInset){stopInset.disabled=!latch.checked||!ridge;setHidden(stopInset.closest('label'),!latch.checked||!ridge);}
 style.options[0].textContent='山と溝';style.options[1].textContent='従来の爪';
 for(const key of ['latchGap','latchEngagement'])$('cad-'+key).disabled=!latch.checked;
 for(const key of ['latchFirm','latchExtraFirm']){const control=$('cad-'+key);control.disabled=!latch.checked||ridge;setHidden(control.closest('label'),ridge);}
 const extraButton=$('coil-extra-stronger-latch');setHidden(extraButton,ridge);extraButton.disabled=!latch.checked||ridge;
 setHidden($('coil-previous-strength'),ridge);
 const note=$('coil-latch-note');note.textContent=ridge?'接合部の内側の山と溝をかみ合わせ、閉じた位置からの逆回転を抑えます。すき間と山の高さを調整できます。本体と蓋の両方を再印刷し、保持力と開ける力を実物で確認してください。':'接合部の内側で爪が掛かり、閉じた位置からの逆回転を抑えます。開く方向に回すと斜面で爪がたわみ、外れます。縁で止める設定を使用します。本体と蓋の両方を印刷し直してください。保持力・開ける力・耐久性は実物で確認してください。';
 for(const id of ['coil-firm-note','coil-extra-note']){const el=$(id);setHidden(el,ridge);if(el.previousElementSibling?.tagName==='H4')setHidden(el.previousElementSibling,ridge);}
 for(const [key,clawLabel,ridgeLabel,clawHint,ridgeHint,clawDetail,ridgeDetail] of [
  ['latchGap','爪と受けのすき間 (mm)','山と溝のすき間 (mm)','小さいほど遊びが減ります。','小さいほど遊びが減ります。印刷誤差に注意。','大きくすると動かしやすくなりますが、閉じたときの遊びが増えます。小さすぎると印刷誤差で爪がはまらなくなります。','山と溝の間の余裕です。小さいほど遊びが減りますが、印刷誤差で固くなる場合があります。'],
  ['latchEngagement','爪の掛かり量 (mm)','山の高さ (mm)','大きいほど深く掛かり、開く力も増えます。','大きいほど保持力と開く力が増えます。','大きくすると爪が深く掛かり、開くときの力と必要なたわみ量が増えます。小さくすると開けやすくなりますが、掛かりが弱くなります。自動調整では壁の厚さに収まる掛かり量に調整します。','山を高くすると溝への掛かりが深くなります。開く力も増えるため、印刷後に確かめて調整してください。']
 ]){
  const input=$('cad-'+key),label=input.closest('label'),title=ridge?ridgeLabel:clawLabel;
  label.firstChild.textContent=title;input.setAttribute('aria-label',title);
  const hint=$(input.id+'-hint');if(hint)hint.textContent=ridge?ridgeHint:clawHint;
  const detail=$('coil-'+key+'-detail');if(detail){detail.textContent=ridge?ridgeDetail:clawDetail;if(detail.previousElementSibling?.tagName==='H4')detail.previousElementSibling.textContent=title;}
 }
 updateCoilLatchEffective();syncCoilRimSeatUI(reset);syncCoilOpeningUI();
}
function updateCoilLatchEffective(q){
 const el=$('coil-latch-effective');if(!el)return;
 el.hidden=!$('cad-jointLatch')?.checked||$('cad-latchStyle')?.value!=='ridge';
 if(el.hidden){el.textContent='';delete el.dataset.adjusted;return;}
 if(q===false){el.textContent='モデルの山高さ：計算できません';delete el.dataset.adjusted;return;}
 if(!q){el.textContent='モデルの山高さ：計算中…';delete el.dataset.adjusted;return;}
 const actual=q.latchEngagement,requested=q.requestedLatchEngagement;
 if(!Number.isFinite(actual)){el.textContent='モデルの山高さ：計算できません';delete el.dataset.adjusted;return;}
 const mm=n=>Number(n.toFixed(3)).toLocaleString('ja-JP',{maximumFractionDigits:3});
 const adjusted=Number.isFinite(requested)&&actual<requested-1e-4;
 el.textContent='モデルの山高さ：'+mm(actual)+' mm'+(adjusted?'（指定 '+mm(requested)+' mm、壁厚を残すため自動調整。指定どおりにするには接合部の肉厚を増やしてください）':'（指定どおり）');
 el.dataset.adjusted=String(adjusted);
}
function coilJointExtraSpec(){const rimSeat=$('cad-rimSeat').checked;return {...(!editingCoilJointId?{jointPose:'分けて並べる'}:{}),...($('cad-jointLatch').checked&&$('cad-latchStyle').value==='claw'?{latchVersion:'internal-v1'}:{}),autoFillet:$('cad-autoFillet').checked,filletBodyBottom:$('cad-filletBodyBottom').checked,filletLidTop:$('cad-filletLidTop').checked,filletVertical:$('cad-filletVertical').checked,closeAngleZero:Number($('cad-closeAngleZero').value),jointLatch:$('cad-jointLatch').checked,latchFirm:$('cad-latchFirm').checked,latchExtraFirm:$('cad-latchExtraFirm').checked,autoAdjust:$('cad-autoAdjust').checked,flipLidToGrid:!!editingCoilJointId&&$('cad-flipLidToGrid').checked,jointOpenTurns:editingCoilJointId?Number($('cad-jointOpenTurns').value):0,rimSeat,alignStop:!rimSeat&&$('cad-alignStop').checked,...(rimSeat?{jointSeam:0}:{})};}
function syncCoilOpeningUI(analysis){
 if(!$('coil-opening-controls'))return;if(analysis)coilPreviewAnalysis=analysis;const active=$('cad-jointPose').value==='開閉スライダー',q=coilPreviewAnalysis;$('coil-opening-controls').hidden=!active;$('cad-flipLidToGrid').disabled=active;if(active)$('cad-flipLidToGrid').checked=false;
 for(const id of ['cad-opening-range','cad-jointOpenTurns']){const el=$(id);el.disabled=!q||!active||$('cad-apply').disabled;if(q)el.max=coilOpeningLimit(q);}
 $('coil-opening-controls').querySelector('p:last-child').textContent=$('cad-jointLatch')?.checked?'開く方向に回して固定部が外れた後の回転・上昇を表示します。固定部のたわみは表示しません。':'右へ動かすと蓋が回転して上がります。右端で取り外した状態になります。この姿勢で実行・保存できます。';if(q){const value=Math.min(coilOpeningLimit(q),Math.max(0,Number($('cad-jointOpenTurns').value)||0));$('cad-jointOpenTurns').value=value;$('cad-opening-range').value=value;}
}
function updateCoilOpeningPreview(){
 if(!coilPreviewAnalysis||!machiningPreview||$('cad-jointPose').value!=='開閉スライダー'||$('cad-apply').disabled)return;
 const pose=coilOpeningTransform(coilPreviewAnalysis,$('cad-jointOpenTurns').value);for(const mesh of machiningPreview.children)if(mesh.userData.coilJointLid){mesh.position.copy(pose.position);mesh.quaternion.copy(pose.quaternion);mesh.updateMatrixWorld(true);}
 coilPrintTools?.poseChanged();
 $('coil-opening-value').textContent=fmt(pose.turns)+' 回転 / '+fmt(pose.turns*360)+'° / 上昇 '+fmt(pose.travel)+' mm';host.dataset.coilOpening=JSON.stringify({turns:pose.turns,angle:pose.angle,travel:pose.travel,max:pose.max,position:pose.position.toArray(),quaternion:pose.quaternion.toArray()});setCoilFilletAnchor();
}
function coilJointProgress(progress){if(!$('tools-dialog').open||$('cad-command').value!=='coilJoint')return;$('cad-error').textContent=progress.stage+(progress.total?' '+progress.current+' / '+progress.total:'')+'…';}
function updateCoilFilletEffectiveUI(q,waiting='プレビューで実際の半径を表示'){
 const fillet=q?.fillet||{},active=$('cad-autoFillet')?.checked;
 for(const [kind,id,enabled,actual,requested,reason] of [
  ['縦角','coil-fillet-vertical-effective',$('cad-filletVertical')?.checked&&(!q||!!q.profile),fillet.verticalRadius,q?.requestedVerticalFilletRadius??fillet.requestedVerticalRadius,fillet.verticalReason],
  ['端面','coil-fillet-cap-effective',$('cad-filletBodyBottom')?.checked||$('cad-filletLidTop')?.checked,fillet.capRadius,q?.requestedCapFilletRadius??fillet.requestedCapRadius,fillet.capReason]
 ]){
  const el=$(id);if(!el)continue;
  if(!active){el.textContent='自動フィレットOFF';delete el.dataset.adjusted;continue;}
  if(!enabled){el.textContent=kind==='縦角'&&q&&!q.profile?'円柱では対象外':'この箇所はOFF';delete el.dataset.adjusted;continue;}
  if(!q||!Number.isFinite(actual)){el.textContent=waiting;delete el.dataset.adjusted;continue;}
  const desired=Number.isFinite(requested)?requested:Number($('cad-fillet'+(kind==='縦角'?'Vertical':'Cap')+'Radius').value),adjusted=Number.isFinite(desired)&&actual<desired-1e-4;
  const reasonText=reason?.label||'形状計算の制約';
  el.textContent=actual<.05?'丸められません'+(reason?'（'+reasonText+'）':''):'実際 R'+fmt(actual)+' mm'+(adjusted?'（指定 R'+fmt(desired)+' mm → '+reasonText+'）':'（指定どおり）');
  el.dataset.adjusted=String(adjusted);
 }
}
function coilFilletEffectiveText(q){
 const fillet=q.fillet||{},parts=[];
 if(q.profile&&q.filletVertical)parts.push('縦角 R'+fmt(fillet.verticalRadius??fillet.radius??q.filletVerticalRadius??q.filletRadius??0)+' mm');
 if(q.filletBodyBottom||q.filletLidTop)parts.push('端面 R'+fmt(fillet.capRadius??fillet.radius??q.filletCapRadius??q.filletRadius??0)+' mm');
 return parts.join('、');
}
function coilJointStatus(analysis){
 const q=analysis,el=$('coil-joint-result');if(!el||!q)return;
 updateCoilLatchEffective(q);updateCoilFilletEffectiveUI(q);
 el.textContent=(q.shapeType==='polygon'?'角柱・'+q.profile.length+'辺 / 接合部の外径 ':'外径 ')+fmt(q.radius*2)+' mm / 全高 '+fmt(q.height)+' mm / 分割位置 '+fmt(q.split)+' mm。コイル '+fmt(q.wire)+' mm、'+q.turns+'巻、ピッチ '+fmt(q.pitch)+' mm、接合部 '+fmt(q.wall)+' mm、本体内穴 Ø'+fmt(q.innerRadius*2)+' mm（穴まわり '+fmt(q.bodyBoreWall)+' mm）。'+(q.notes.length?'自動調整：'+q.notes.join(' / ')+'。':'')+(q.jointLatch?(q.latchStyle==='ridge'?'内側の山と溝で逆回転を抑えます。':'内側の爪で逆回転を抑えます。開く方向に回すと爪がたわんで解除されます。'):'')+(q.rimSeat?'縁の面で止めます（合わせ目0 mm、補正 '+fmt(q.closeAngleAdjustment??q.closeAngle)+'°）。':q.alignStop?'締め位置の補正 '+fmt(q.closeAngleAdjustment??q.closeAngle)+'°、回転止め付き（厚さ '+fmt(q.stop.outer-q.stop.inner)+' mm）。':'')+(q.autoFillet?'外側のフィレット（実際の半径：'+coilFilletEffectiveText(q)+'）。':'')+(q.motion.status==='clear'?(q.jointLatch?(q.latchStyle==='ridge'?'山と溝の解除に必要なたわみを仮定し、':'爪が内側へたわむ量を仮定し、'):'開閉の ')+q.motion.checks.length+' 姿勢で形状の干渉を検査済みです。':'形状プレビューです。開閉の干渉検査は「実行」時に行います。');const detail=$('coil-calculation-text');if(detail)detail.textContent=el.textContent;el.textContent=(q.motion.status==='clear'?'開閉の干渉検査済み。':'形状プレビュー（干渉検査は実行時）。')+(q.autoFillet?' 自動フィレット：'+coilFilletEffectiveText(q)+'。':'')+(q.bodyBoreWall!==q.wall?' 本体内穴 Ø'+fmt(q.innerRadius*2)+' mm。':'')+(q.notes.length?' 自動調整：'+q.notes.join(' / '):'');syncCoilOpeningUI(q);updateCoilOpeningPreview();
}
function openCoilJointEdit(id){
 editingCoilJointId=id;const f=features.find(f=>f.id===id);$('cad-command').value='coilJoint';$('cad-command').disabled=true;renderCommand();
 const bodies=rebuild(features.slice(0,features.indexOf(f)));$('cad-target').replaceChildren();for(const [bodyId,b] of bodies){$('cad-target').add(new Option(features.find(item=>item.id===bodyId)?.name||'ボディ',bodyId));b.geometry.dispose();}
 for(const [key,value] of Object.entries(f.spec))if(key in schemas.coilJoint&&$('cad-'+key))$('cad-'+key).value=value;
 $('cad-closeAngleZero').value=f.spec.closeAngleZero??0;syncCoilAngleReferenceUI();$('cad-autoFillet').checked=f.spec.autoFillet===true;for(const key of ['filletVerticalRadius','filletCapRadius'])$('cad-'+key).value=f.spec[key]??f.spec.filletRadius??2;for(const key of ['filletBodyBottom','filletLidTop','filletVertical'])$('cad-'+key).checked=f.spec[key]??true;syncCoilFilletUI();$('cad-jointLatch').checked=f.spec.jointLatch===true;$('cad-latchStyle').value=f.spec.latchStyle==='ridge'?'ridge':'claw';$('cad-latchFirm').checked=f.spec.latchFirm===true;$('cad-latchExtraFirm').checked=f.spec.latchExtraFirm===true;$('cad-latchGap').value=f.spec.latchGap??.3;$('cad-latchEngagement').value=f.spec.latchEngagement??.8;$('cad-rimSeat').checked=f.spec.rimSeat===true;$('cad-alignStop').checked=f.spec.alignStop??f.analysis?.shapeType==='polygon';$('cad-autoAdjust').checked=f.spec.autoAdjust!==false;$('cad-flipLidToGrid').checked=f.spec.flipLidToGrid===true;$('cad-jointOpenTurns').value=f.spec.jointOpenTurns??0;$('cad-opening-range').value=f.spec.jointOpenTurns??0;syncCoilLatchUI(true);syncCoilOpeningUI();
 for(const output of f.outputs||[]){const mesh=meshes.get(output.id);if(mesh){editingEncloseVisibility.push([mesh,mesh.visible]);mesh.visible=false;}}
 $('tools-dialog').querySelector('h2').textContent='コイル接合を再編集';$('cad-help').textContent=commandHelp.coilJoint+' 寸法・山と溝・フィレットなどの詳細を変更できます。「変更を適用」で本体と蓋を再計算します。'+(f.spec.jointLatch&&f.spec.latchStyle!=='ridge'&&f.analysis?.latchVersion!=='internal-v1'?' この工程は旧型の外側の爪です。「変更を適用」で内部の爪に作り直します。本体と蓋の両方を再印刷してください。':'');openToolsDialog();scheduleMachiningPreview();
}

function openEncloseEdit(id){
 editingEncloseId=id;const f=features.find(f=>f.id===id);$('cad-command').value='enclose';$('cad-command').disabled=true;renderCommand();
 const prefix=features.slice(0,features.indexOf(f)),bodies=rebuild(prefix);$('cad-target').replaceChildren();for(const [bodyId,b] of bodies){$('cad-target').add(new Option(features.find(item=>item.id===bodyId)?.name||'ボディ',bodyId));b.geometry.dispose();}
 for(const [key,value] of Object.entries(f.spec))if(key in schemas.enclose&&$('cad-'+key))$('cad-'+key).value=value;
 enclosureFaces=clone(f.spec.faces||[]);$('cad-boxMode').checked=!!f.spec.boxMode;$('cad-chestStyle').checked=f.spec.chestStyle===true;$('cad-hinge').checked=!!f.spec.hinge;$('cad-autoExpandMotion').checked=!!f.spec.autoExpandMotion;$('cad-snapLatch').checked=!!f.spec.snapLatch;
 for(const key of ['hingeRadialGap','hingeAxialGap','hingeAngle','motionGap','latchGap'])if(Number.isFinite(f.spec[key]))$('cad-'+key).value=f.spec[key];
 $('cad-latchEngagement').value=Number.isFinite(f.spec.latchEngagement)?f.spec.latchEngagement:Number((1.15-(Number.isFinite(f.spec.latchGap)?f.spec.latchGap:.45)).toFixed(2));
 $('cad-seamGap').value=Number.isFinite(f.spec.seamGap)?f.spec.seamGap:(Number.isFinite(f.spec.hingeRadialGap)?f.spec.hingeRadialGap:.5);
 $('cad-enclosureSplit').dispatchEvent(new Event('enclose-options-update'));$('cad-hingeEdge').value=f.spec.hingeEdge||$('cad-hingeEdge').options[0]?.value;
 enclosureStatus();$('cad-help').textContent='編集中は作成済みのBOXを一時的に隠します。元ソリッドの面を選んで開口でき、蓋の角度も変更できます。';
 for(const output of f.outputs||[]){const mesh=meshes.get(output.id);if(mesh){editingEncloseVisibility.push([mesh,mesh.visible]);mesh.visible=false;}}
 const source=meshes.get(f.spec.target);if(source&&!source.visible){editingEncloseVisibility.push([source,false]);source.visible=true;}
 renderTree();openToolsDialog();scheduleMachiningPreview();
}
$('tools-dialog').addEventListener('close',()=>{editingPipeId=null;editingEncloseId=null;editingCoilJointId=null;$('cad-command').disabled=false;queueMicrotask(()=>{for(const [mesh,visible] of editingEncloseVisibility)if(mesh.parent)mesh.visible=visible;editingEncloseVisibility=[];renderTree();});});
function renderCommand(){cancelMachiningPreview(true);clearSplitPreview();clearLoftHighlights();const type=$('cad-command').value;$('cad-help').textContent=commandHelp[type];$('cad-error').textContent='';$('tools-dialog').classList.toggle('thread-dialog',type==='thread');$('tools-dialog').classList.toggle('coil-joint-dialog',type==='coilJoint');$('tools-dialog').querySelector('h2').textContent=type==='thread'?'ねじ':'作成・修正';$('cad-apply').textContent=(editingPipeId&&type==='pipe')||(editingEncloseId&&type==='enclose')||(editingCoilJointId&&type==='coilJoint')?'変更を適用':type==='thread'?'OK':'実行';if(type==='thread')$('cad-help').textContent='選択した円筒面に、実際のねじ山を作成します。';$('cad-fields').replaceChildren();if(type==='revolve'){renderRevolve();return;}if(type==='thread'){renderThreadDialog(selectedSurface);return;}for(const [key,value] of Object.entries(schemas[type])){const label=document.createElement('label');label.textContent=type==='enclose'&&key==='thickness'?'囲みの厚み (mm)':type==='trimSurface'&&key==='target'?'切り取るボディ':type==='sphere'&&['x','y','z'].includes(key)?'中心'+key.toUpperCase()+' (mm)':fieldNames[key];let input;if(value==='body'||value==='sketch'||Array.isArray(value)){input=document.createElement('select');const choices=value==='sketch'?pipeSketchSources().map(f=>[f.id,(f.name||'スケッチ')+' / '+f.profile]):value==='body'?[...meshes.keys()].map(id=>[id,bodyDisplayName(id)]):value.map(x=>[x,x==='FACE'?'選択したソリッドの面':x==='LINE'?'選択した直線・辺':x==='SELECTED'?(type==='circular'?'選択した中心':'選択した平面'):x==='ORIGIN'?'原点':x==='NORMAL'?'中心の平面に垂直':x]);if(['offset','split'].includes(type)&&key==='plane')for(const f of features.filter(f=>f.kind==='plane'))choices.push([f.id,f.name+' / '+fmt(f.offset)+' mm']);for(const [val,text] of choices){const opt=new Option(text,val);input.add(opt);}if(value==='body'&&(selectedFace?.bodyId||selectedBody))input.value=selectedFace?.bodyId||selectedBody;if(value==='body'&&['circular','rectangular'].includes(type)){for(const f of features.filter(f=>f.kind==='sketch'))input.add(new Option('スケッチ：'+f.name,f.id));if(features.some(f=>f.id===selected&&f.kind==='sketch'))input.value=selected;label.textContent='対象（ボディ／スケッチ）';}}else{input=document.createElement('input');input.type='number';input.step='any';input.value=value;input.required=true;input.min=['count','count2','turns'].includes(key)?1:['radius','wire','pitch','thickness'].includes(key)?.1:-10000;input.max=['count','count2'].includes(key)?20:key==='turns'?30:10000;}if(['offset','split'].includes(type)&&key==='plane'&&!selectedFace)input.value=['XY','XZ','YZ'].includes($('plane').value)?$('plane').value:'XY';if(type==='circular'&&!patternCenter&&key==='center')input.value='ORIGIN';if(type==='circular'&&(!patternCenter||['midpoint','intersection'].includes(patternCenter.kind))&&key==='axis')input.value='Z';input.id='cad-'+key;label.append(input);$('cad-fields').append(label);}if(['circular','rectangular'].includes(type)){const update=()=>{const sketch=features.some(f=>f.id===$('cad-target').value&&f.kind==='sketch');$('cad-operation').disabled=sketch;$('cad-operation').closest('label').hidden=sketch;};$('cad-target').addEventListener('change',update);update();}if(type==='coil'&&selectedEdge?.circle){const c=selectedEdge.circle;for(const [key,value] of Object.entries({radius:c.radius,x:c.center[0],y:c.center[1],z:c.center[2]})){$('cad-'+key).value=value;$('cad-'+key).disabled=true;}$('cad-help').textContent='選択円周が開始位置（0）です。円筒がある側を＋として作成し、自動で円筒に結合します。線材が0よりマイナス側へ出ないよう、開始位置を調整します。';}if(type==='mirror'){if(selectedFace)$('cad-plane').value='FACE';else if(selectedEdge||selectedSketchSegments.size)$('cad-plane').value='LINE';$('cad-help').textContent='面または直線を先に選択してください。直線は、その線を含みスケッチ平面に垂直な面を基準にします。ソリッドの辺は現在の基準平面を使います。対象ボディはこの欄で指定できます。';}if(type==='join'){const ids=joinSelectedIds();const button=document.createElement('button');button.type='button';button.id='join-selected';button.textContent='選択中の '+ids.length+' ボディに一括実行';button.disabled=ids.length<2;button.onclick=()=>{joinAll=true;$('tools-form').requestSubmit();};$('cad-fields').append(button);renderJoinClearanceOptions();if($('cad-other').value===$('cad-target').value&&$('cad-other').options.length>1)$('cad-other').selectedIndex=1;}if(type==='loft'){loftSections=[];$('cad-help').textContent='つなぐ面を画面で順にクリックしてください。スケッチ領域とソリッドの平面を選べます。同じ面を再クリックすると解除します。';renderLoftSelection();}if(type==='pipe'){const id=[...selectedSketchSegments.keys()][0]||selected;if(id&&$('cad-path').querySelector('option[value="'+id+'"]'))$('cad-path').value=id;}if(type==='trimSurface'){trimWall=selectedSurface?{bodyId:selectedSurface.bodyId,point:[...selectedSurface.point],normal:selectedFaces.at(-1)?.normal||(selectedFace?basisFor(selectedFace).n.toArray():undefined)}:null;const status=document.createElement('p');status.id='trim-wall-status';status.setAttribute('role','status');$('cad-fields').append(status);trimWallStatus();updateTrimArrow();}if(type==='coilJoint')renderCoilJointOptions();if(type==='enclose')renderEncloseOptions();if(type==='pull')renderThreadPullOptions(features,[...meshes.keys()],selectedBody||selectedFace?.bodyId,!selectedFaces.some(f=>f.plane)&&!selectedFace,bodyDisplayName);}
$('advanced-tools').onclick=()=>{editingEncloseId=null;editingPipeId=null;editingCoilJointId=null;$('cad-command').disabled=false;finishSketch(false);renderCommand();openToolsDialog();};$('cad-command').onchange=()=>{renderCommand();const input=$('cad-fields').querySelector('input[type=number]:not(:disabled)');if(input){input.focus();input.select();}};$('tools-close').onclick=()=>{clearTrimArrow();$('tools-dialog').close();};$('cad-cancel').onclick=()=>{clearTrimArrow();$('tools-dialog').close();};
$('tools-form').onsubmit=async e=>{e.preventDefault();const type=$('cad-command').value,spec={type,id:crypto.randomUUID()};for(const [key,value] of Object.entries(schemas[type]))spec[key]=value==='body'||value==='sketch'||Array.isArray(value)?$('cad-'+key).value:Number($('cad-'+key).value);try{if(type==='coilJoint'){
 Object.assign(spec,coilJointExtraSpec());if(editingCoilJointId){
  const original=features,index=features.findIndex(f=>f.id===editingCoilJointId);if(index<0)throw Error('編集する接合部が見つかりません');spec.id=features[index].spec.id||editingCoilJointId;const next=clone(features);next[index]={...next[index],spec};
  cancelMachiningPreview();$('cad-apply').disabled=true;$('cad-error').textContent='接合部と後続工程を再計算しています…';pendingKernelCancel=()=>kernelClient.reset();const result=await kernelClient.run(next,{type:'replay',before:original,start:index},{onProgress:coilJointProgress});if(features!==original)throw Error('モデルが変更されました。もう一度編集してください');pendingKernelCancel=null;setProject(result.features);selected=null;stage='model';syncFields();$('tools-dialog').close();notify('本体と蓋のコイル接合を更新しました');return;
 }
}
 if(type==='enclose'){Object.assign(spec,encloseExtraSpec());spec.faces=clone(enclosureFaces);if(editingEncloseId){const original=features,index=features.findIndex(f=>f.id===editingEncloseId);if(index<0)throw Error('編集する囲みが見つかりません');spec.id=features[index].spec.id||editingEncloseId;const next=clone(features);next[index]={...next[index],spec};cancelMachiningPreview();$('cad-apply').disabled=true;$('cad-error').textContent='囲みと後続工程を再計算しています…';pendingKernelCancel=()=>kernelClient.reset();const result=await kernelClient.run(next,{type:'replay',before:original,start:index});if(features!==original)throw Error('モデルが変更されました。もう一度編集してください');pendingKernelCancel=null;setProject(result.features);selected=null;stage='model';syncFields();$('tools-dialog').close();notify('囲みと後続工程を更新しました');return;}}if(type==='trimSurface'){if(!trimWall)throw Error('基準にする面をクリックしてください');spec.faces=[clone(trimWall)];}if(type==='pipe'){const path=pipeSketchSources().find(f=>f.id===spec.path);if(!path)throw Error('経路にするスケッチを選択してください');spec.pathFeature=clone(path);if(editingPipeId){
 const original=features,index=features.findIndex(f=>f.id===editingPipeId);if(index<0)throw Error('編集するパイプが見つかりません');spec.id=features[index].spec.id||editingPipeId;const next=clone(features);next[index]={...next[index],spec};
 cancelMachiningPreview();$('cad-apply').disabled=true;$('cad-error').textContent='パイプと後続工程を再計算しています…';pendingKernelCancel=()=>kernelClient.reset();
 const result=await kernelClient.run(next,{type:'replay',before:original,start:index});if(features!==original)throw Error('モデルが変更されました。もう一度編集してください');pendingKernelCancel=null;setProject(result.features);selected=null;stage='model';syncFields();$('tools-dialog').close();notify('パイプと後続工程を更新しました');return;
 }}if(type==='revolve')Object.assign(spec,revolveSpec());if(type==='coil'&&selectedEdge?.circle){spec.target=selectedEdge.bodyId;spec.rim={center:[...selectedEdge.circle.center],radius:selectedEdge.circle.radius};}if(type==='shell'){spec.faces=selectedFaces.length?selectedFaces.flatMap(({bodyId,point,normal,cadSelections})=>(cadSelections||[{point,normal}]).map(face=>({bodyId,...face}))):selectedSurface?[{bodyId:selectedSurface.bodyId,point:selectedSurface.point,normal:selectedFace?basisFor(selectedFace).n.toArray():undefined}]:[];if(!spec.faces.length)throw Error('開口にする面を先に選択してください');if(spec.faces.some(f=>f.bodyId!==spec.target))throw Error('同じ対象ボディの開口面を選択してください');}if(type==='join'&&joinAll){joinAll=false;const ids=joinSelectedIds();if(ids.length<2)throw Error('2つ以上のボディを選択してください');if(!ids.includes(spec.target))spec.target=ids[0];spec.others=ids.filter(id=>id!==spec.target);}if(type==='pull')Object.assign(spec,threadPullOptions());if(['count','count2','turns'].some(k=>k in spec&&!Number.isInteger(spec[k])))throw Error('個数・巻き数は整数で指定してください');if((spec.count||1)*(spec.count2||1)>60)throw Error('一度の複製は60個以内にしてください');if(type==='pull'&&!spec.allThreadFaces&&!selectedFaces.length){if(!selectedFace)throw Error('先にソリッドの平面をクリックしてください');$('tools-dialog').close();beginExtrusion('solid');displayDepth(spec.distance);$('operation').value=spec.distance<0?'cut':'join';syncFields();return;}if(type==='split'&&!['XY','XZ','YZ'].includes(spec.plane)){const base=spec.plane==='SELECTED'?selectedFace:features.find(f=>f.kind==='plane'&&f.id===spec.plane);if(!base)throw Error('分割に使用する平面を先に選択してください');const b=basisFor(base);spec.splitFrame={u:b.u.toArray(),v:b.v.toArray(),n:b.n.toArray()};spec.offset+=base.offset;}if(type==='offset'){const base=spec.plane==='SELECTED'?selectedFace:features.find(f=>f.kind==='plane'&&f.id===spec.plane)||{plane:spec.plane,offset:0};if(!base)throw Error('基準にする平面を選択してください');const b=basisFor(base),offset=base.offset+spec.offset;const planeFeature={kind:'plane',id:spec.id,name:'オフセット平面',plane:'CUSTOM',frame:{u:b.u.toArray(),v:b.v.toArray(),n:b.n.toArray()},offset};setProject([...features,planeFeature]);selectedFace=planeFeature;$('tools-dialog').close();startFeature('line','thin');$('draw').click();notify('オフセット平面でスケッチを開始しました');return;}if(type==='spline'){$('tools-dialog').close();startFeature('spline','solid');$('draw').click();return;}if(type==='pull'&&selectedFaces.length)spec.faces=selectedFaces.flatMap(({bodyId,point,normal,cadSelections})=>(cadSelections||[{point,normal}]).map(face=>({bodyId,...face})));if(type==='fillet'){if(selectedEdge){spec.target=selectedEdge.bodyId;spec.edges=edgeFilletReferences(selectedEdges);}else if(selectedFace)spec.face=clone(selectedFace);}if(type==='thread')Object.assign(spec,threadDialogSpec(selectedSurface));if(type==='sketchOffset'){if(selectedSketchSegments.size){const output=offsetSketchSelection(features,selectedSketchSegments,spec.distance);setProject([...features,...output]);selected=null;stage='model';syncFields();$('tools-dialog').close();notify('選択したスケッチをオフセットしました');return;}let source=features.find(f=>f.id===selected&&f.kind==='sketch');if(!source&&chosenRegion){const r=chosenRegion,b=basisFor(r),p=b.n.clone().multiplyScalar(r.offset);source={...defaults,id:'region',kind:'sketch',name:'輪郭',profile:'polyline',plane:r.plane,frame:r.frame,x:p.x,y:p.y,z:p.z,points:r.outer,closed:true};}if(!source)throw Error('スケッチの線または閉じた領域を選択してください');const output=offsetSketch(source,spec.distance);setProject([...features,...output]);selected=null;$('tools-dialog').close();notify('オフセットしたスケッチを追加しました');return;}if(type==='circular'){if(spec.center==='SELECTED'){if(!patternCenter)throw Error('円または長方形の中心マーカーを選択してください');spec.origin=patternCenter.point;spec.centerSource=patternCenter.name;}else spec.origin=[0,0,0];if(spec.axis==='NORMAL'){if(!patternCenter)throw Error('中心の平面を指定するには中心マーカーを選択してください');spec.axisVector=patternCenter.normal;}}if(['circular','rectangular'].includes(type)){const source=features.find(f=>f.id===spec.target&&f.kind==='sketch');if(source){const copies=patternSketch(source,spec);setProject([...features,...copies]);selected=null;stage='model';syncFields();$('tools-dialog').close();notify('スケッチのパターンを作成しました');return;}}if(type==='mirror'&&['FACE','LINE'].includes(spec.plane))Object.assign(spec,selectedMirrorPlane(spec.plane));if(type==='loft')spec.sections=loftSections.map(s=>clone(s.region));cancelMachiningPreview();$('cad-apply').disabled=true;$('cad-error').textContent='形状を計算中… 初回はCADエンジンを読み込みます';pendingKernelCancel=()=>kernelClient.reset();const result=await kernelClient.run(features,spec,type==='coilJoint'?{onProgress:coilJointProgress}:{});pendingKernelCancel=null;const f={kind:'cadop',id:spec.id,name:$('cad-command').selectedOptions[0].textContent,spec,...result};setProject([...(type==='shell'?hideShellProfiles(features,spec.target):features),f]);selectedFace=null;chosenRegion=null;selected=null;stage='model';syncFields();$('tools-dialog').close();fit();notify(f.name+'を作成しました');}catch(err){$('cad-error').textContent=err.message;}finally{pendingKernelCancel=null;$('cad-apply').disabled=false;}};

$('tools-dialog').addEventListener('close',()=>{pendingKernelCancel?.();});

function extrusionAnchor(){const f=current(),normal=basisFor(f).n;let base;if(f.profile==='region'&&f.region){const r=f.region;const box=new THREE.Box2().setFromPoints(r.outer.map(p=>new THREE.Vector2(...p))),c=box.getCenter(new THREE.Vector2());base=worldPoint(r,[c.x,c.y]);}else base=new THREE.Vector3(f.x,f.y,f.z);return {base,normal,depth:depthValue()};}
function screenPoint(p){const q=p.clone().project(camera);return {x:(q.x+1)*host.clientWidth/2,y:(1-q.y)*host.clientHeight/2,z:q.z};}
function clearSplitPreview(){
 if(splitDrag){
  controls.enabled=splitDrag.enabled;
  splitDrag=null;
  const handle=$('split-offset-handle');
  if(handle.hasPointerCapture?.(handle._splitPointerId))handle.releasePointerCapture(handle._splitPointerId);
 }
 if(splitPreviewPlane){disposeObject(splitPreviewPlane);splitPreviewPlane=null;}
 splitPreviewKey='';splitStateCache=null;splitStateKey='';
 for(const id of ['split-guide','split-offset-handle','split-distance'])$(id).hidden=true;
 delete host.dataset.splitPreview;
}
function splitPreviewState(){
 if(!$('tools-dialog').open||$('cad-command').value!=='split')return null;
 const target=$('cad-target')?.value,mesh=meshes.get(target),plane=$('cad-plane')?.value,offsetInput=$('cad-offset');
 if(!mesh||!plane||!offsetInput)return null;
 if(offsetInput.value==='')return splitStateCache;
 const relative=Number(offsetInput.value);
 if(!Number.isFinite(relative))return splitStateCache;
 const source=['XY','XZ','YZ'].includes(plane)?{plane,offset:0}:plane==='SELECTED'?selectedFace:features.find(f=>f.kind==='plane'&&f.id===plane);
 if(!source)return null;
 const stateKey=JSON.stringify([target,mesh.geometry.uuid,plane,relative,source.offset,source.frame]);
 if(splitStateCache&&splitStateKey===stateKey)return splitStateCache;
 const basis=basisFor(source),baseOffset=Number(source.offset)||0,absoluteOffset=baseOffset+relative,box=new THREE.Box3().setFromObject(mesh);
 if(box.isEmpty())return null;
 const u=basis.u,v=basis.v,n=basis.n;
 let minU=Infinity,maxU=-Infinity,minV=Infinity,maxV=-Infinity;
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
  const point=new THREE.Vector3(x,y,z),pu=point.dot(u),pv=point.dot(v);
  minU=Math.min(minU,pu);maxU=Math.max(maxU,pu);minV=Math.min(minV,pv);maxV=Math.max(maxV,pv);
 }
 const padU=Math.max((maxU-minU)*.12,1),padV=Math.max((maxV-minV)*.12,1);
 minU-=padU;maxU+=padU;minV-=padV;maxV+=padV;
 const midU=(minU+maxU)/2,midV=(minV+maxV)/2,planarCenter=u.clone().multiplyScalar(midU).addScaledVector(v,midV);
 const start=planarCenter.clone().addScaledVector(n,baseOffset),end=planarCenter.clone().addScaledVector(n,absoluteOffset);
 splitStateKey=stateKey;splitStateCache={basis,relative,absoluteOffset,minU,maxU,minV,maxV,start,end,key:stateKey};
 return splitStateCache;
}
function makeSplitPreviewPlane(state){
 const {basis,absoluteOffset,minU,maxU,minV,maxV}=state,{u,v,n}=basis;
 const point=(a,b)=>u.clone().multiplyScalar(a).addScaledVector(v,b).addScaledVector(n,absoluteOffset);
 const corners=[point(minU,minV),point(maxU,minV),point(maxU,maxV),point(minU,maxV)];
 const group=new THREE.Group(),geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(corners.flatMap(p=>p.toArray()),3));
 geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();
 const face=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0x11a4ca,transparent:true,opacity:.26,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));
 face.renderOrder=12;group.add(face);
 const outline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(corners),new THREE.LineBasicMaterial({color:0x057da3,depthTest:false,transparent:true,opacity:.95}));
 outline.renderOrder=13;group.add(outline);
 const midU=(minU+maxU)/2,midV=(minV+maxV)/2;
 const cross=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([point(minU,midV),point(maxU,midV),point(midU,minV),point(midU,maxV)]),new THREE.LineBasicMaterial({color:0x067fa6,depthTest:false,transparent:true,opacity:.56}));
 cross.renderOrder=13;group.add(cross);
 return group;
}
function updateSplitPreview(){
 const state=splitPreviewState();
 if(!state){if(splitPreviewPlane||!$('split-offset-handle').hidden)clearSplitPreview();return;}
 if(splitPreviewKey!==state.key){
  if(splitPreviewPlane)disposeObject(splitPreviewPlane);
  splitPreviewPlane=makeSplitPreviewPlane(state);scene.add(splitPreviewPlane);splitPreviewKey=state.key;
 }
 host.dataset.splitPreview='true';
 for(const id of ['split-guide','split-offset-handle','split-distance'])$(id).hidden=false;
 const start=screenPoint(state.start),end=screenPoint(state.end),normalTip=screenPoint(state.end.clone().add(state.basis.n));
 const x=Math.max(20,Math.min(host.clientWidth-20,end.x)),y=Math.max(20,Math.min(host.clientHeight-20,end.y));
 const handle=$('split-offset-handle');handle.style.left=x+'px';handle.style.top=y+'px';
 const dx=normalTip.x-end.x,dy=normalTip.y-end.y,angle=Math.hypot(dx,dy)<.1?0:Math.atan2(dy,dx)*180/Math.PI+90;
 handle.style.transform='translate(-50%,-50%) rotate('+angle+'deg)';
 const panel=$('split-distance'),width=panel.offsetWidth,height=panel.offsetHeight;
 panel.style.left=Math.max(8,Math.min(host.clientWidth-width-8,x+width+46>host.clientWidth?x-width-28:x+28))+'px';
 panel.style.top=Math.max(8,Math.min(host.clientHeight-height-8,y+20))+'px';
 const input=$('split-viewport-offset');if(document.activeElement!==input)input.value=Number(state.relative.toFixed(3));
 const guide=$('split-guide-line');guide.setAttribute('x1',start.x);guide.setAttribute('y1',start.y);guide.setAttribute('x2',end.x);guide.setAttribute('y2',end.y);
}
$('split-viewport-offset').addEventListener('input',()=>{
 const offset=$('cad-offset');if(!offset||$('cad-command').value!=='split')return;
 offset.value=$('split-viewport-offset').value;offset.dispatchEvent(new Event('input',{bubbles:true}));updateSplitPreview();
});
$('cad-fields').addEventListener('input',e=>{
 if(e.target.id==='cad-offset'&&$('cad-command').value==='split'){
  if(document.activeElement!==$('split-viewport-offset'))$('split-viewport-offset').value=e.target.value;
  updateSplitPreview();
 }
});
$('split-offset-handle').addEventListener('pointerdown',e=>{
 if(e.button!==0)return;
 const state=splitPreviewState();if(!state)return;
 e.preventDefault();e.stopPropagation();document.activeElement?.blur();
 const p=screenPoint(state.end),q=screenPoint(state.end.clone().add(state.basis.n));
 let dx=q.x-p.x,dy=q.y-p.y;
 if(Math.hypot(dx,dy)<.1){dx=0;dy=-host.clientHeight/viewHeight();}
 splitDrag={id:e.pointerId,x:e.clientX,y:e.clientY,offset:state.relative,dx,dy,enabled:controls.enabled};
 controls.enabled=false;
 const handle=$('split-offset-handle');handle._splitPointerId=e.pointerId;handle.setPointerCapture(e.pointerId);
});
$('split-offset-handle').addEventListener('pointermove',e=>{
 const drag=splitDrag;if(!drag||drag.id!==e.pointerId)return;
 const delta=((e.clientX-drag.x)*drag.dx+(e.clientY-drag.y)*drag.dy)/(drag.dx*drag.dx+drag.dy*drag.dy);
 const value=Math.round(Math.max(-10000,Math.min(10000,drag.offset+delta))*1000)/1000;
 $('cad-offset').value=String(value);$('split-viewport-offset').value=String(value);
 $('cad-offset').dispatchEvent(new Event('input',{bubbles:true}));updateSplitPreview();
});
function endSplitDrag(e){
 if(!splitDrag||splitDrag.id!==e.pointerId)return;
 controls.enabled=splitDrag.enabled;splitDrag=null;
 const handle=$('split-offset-handle');if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);
}
$('split-offset-handle').addEventListener('pointerup',endSplitDrag);
$('split-offset-handle').addEventListener('pointercancel',endSplitDrag);
$('split-offset-handle').addEventListener('lostpointercapture',endSplitDrag);

let taperControlPosition=null;
function updateTaperControl(anchor,rotation){
 const control=$('taper-control'),handle=$('taper-handle'),viewport=host.parentElement,angle=Number($('taperAngle').value);if(!Number.isFinite(angle)){control.hidden=true;return;}
 const rect=viewport.getBoundingClientRect(),obstacles=[];
 if(!taperDrag){
  for(const el of viewport.querySelectorAll('#snap-controls,.view-cube,#reference-plane-control,.navigation,#measurement,.viewport-title,#extrude-handle,#extrude-distance,#extrude-operation-wheel')){if(el.hidden)continue;const r=el.getBoundingClientRect();if(r.width&&r.height)obstacles.push({left:r.left-rect.left,top:r.top-rect.top,right:r.right-rect.left,bottom:r.bottom-rect.top});}
  taperControlPosition=findPanelSpace({width:host.clientWidth,height:host.clientHeight,panelWidth:140,panelHeight:140,anchor,previous:taperControlPosition,obstacles,gap:6})||{x:Math.max(2,Math.min(host.clientWidth-142,anchor.x+35)),y:Math.max(2,Math.min(host.clientHeight-142,anchor.y-70))};
  control.style.left=taperControlPosition.x+'px';control.style.top=taperControlPosition.y+'px';
 }else rotation=taperDrag.rotation;
 control.dataset.rotation=String(rotation);
 const center={x:70,y:70},point=value=>taperArcPoint(center,48,value,rotation),from=point(-80),to=point(80),zero=point(0),knob=point(angle),arc=(start,end,sweep)=>'M '+start.x+' '+start.y+' A 48 48 0 0 '+sweep+' '+end.x+' '+end.y;
 $('taper-arc-track').setAttribute('d',arc(from,to,1));$('taper-arc-active').setAttribute('d',Math.abs(angle)<.001?'':arc(zero,knob,angle>0?1:0));
 const line=$('taper-arc-zero');for(const [name,value] of Object.entries({x1:70,y1:70,x2:zero.x,y2:zero.y}))line.setAttribute(name,value);
 handle.style.left=knob.x+'px';handle.style.top=knob.y+'px';const text=fmt(angle)+'°';if($('taper-arc-value').textContent!==text)$('taper-arc-value').textContent=text;if(handle.getAttribute('aria-valuenow')!==String(angle))handle.setAttribute('aria-valuenow',String(angle));
}
function setTaperAngle(value){if($('taperAngle').value.trim()!==''&&Number($('taperAngle').value)===value)return;$('viewport-taper-angle').value=String(value);$('viewport-taper-angle').dispatchEvent(new Event('input',{bubbles:true}));}
$('taper-handle').addEventListener('pointerdown',e=>{
 if(e.button!==0||taperDrag||extrusionBusy||$('apply').disabled)return;e.preventDefault();e.stopPropagation();document.activeElement?.blur();const r=$('taper-control').getBoundingClientRect();
 taperDrag={id:e.pointerId,center:{x:r.left+70,y:r.top+70},rotation:Number($('taper-control').dataset.rotation),angle:Number($('taperAngle').value),enabled:controls.enabled};controls.enabled=false;$('taper-handle').setPointerCapture(e.pointerId);
});
$('taper-handle').addEventListener('pointermove',e=>{const d=taperDrag;if(!d||d.id!==e.pointerId)return;setTaperAngle(taperDragAngle({x:e.clientX,y:e.clientY},d.center,d.rotation,Number($('taperAngle').value),{fine:e.shiftKey}));});
function endTaperDrag(e){const d=taperDrag;if(!d||d.id!==e.pointerId)return;controls.enabled=d.enabled;taperDrag=null;if($('taper-handle').hasPointerCapture(e.pointerId))$('taper-handle').releasePointerCapture(e.pointerId);}
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('taper-handle').addEventListener(name,endTaperDrag);
$('taper-handle').addEventListener('keydown',e=>{
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key)||extrusionBusy||$('apply').disabled)return;e.preventDefault();const sign=['ArrowRight','ArrowUp'].includes(e.key)?1:-1,value=e.key==='Home'?0:Math.max(-80,Math.min(80,Number($('taperAngle').value)+sign*(e.shiftKey?.1:1)));setTaperAngle(Number(value.toFixed(1)));
});
let extrusionOverlayPosition=null,extrusionOverlayDocked=false;
function clearExtrusionOverlayPosition(){
 extrusionOverlayPosition=null;extrusionOverlayDocked=false;taperControlPosition=null;
 const viewport=host.parentElement;delete viewport.dataset.extrusionDocked;viewport.style.removeProperty('--extrusion-dock-width');
}
function extrusionOverlayObstacles(){
 const objects=[...meshes.values(),...sketchGroup.children,...regionGroup.children.filter(o=>o.userData.region),...(preview?.children||[])];
 const obstacles=objects.map(o=>projectedBounds(o,camera,host.clientWidth,host.clientHeight)).filter(Boolean),viewport=host.parentElement.getBoundingClientRect();
 for(const element of host.parentElement.querySelectorAll('#snap-controls,.view-cube,#reference-plane-control,.navigation,#measurement,.viewport-title,#extrude-handle')){
  if(element.hidden)continue;const r=element.getBoundingClientRect();if(r.width&&r.height)obstacles.push({left:r.left-viewport.left,top:r.top-viewport.top,right:r.right-viewport.left,bottom:r.bottom-viewport.top});
 }
 return obstacles;
}
function updateExtrusionOverlay(){
 const visible=stage==='extrusion'&&!pendingExtrude&&host.dataset.previewKind==='extrusion';
 for(const id of ['extrude-handle','extrude-distance','extrude-guide','extrude-operation-wheel','taper-control'])$(id).toggleAttribute('hidden',!visible);
 if(!visible){if(extrusionOverlayPosition||extrusionOverlayDocked)clearExtrusionOverlayPosition();return;}
 $('extrude-handle').hidden=$('grid-extent').checked||($('operation').value==='cut'&&$('through-all').checked);syncViewportOperation();
 $('viewport-combine-label').hidden=selectedRegions.length<2||!!selected||$('operation').value!=='new';
 const a=extrusionAnchor();if(!Number.isFinite(a.depth))return;
 const start=screenPoint(a.base),end=screenPoint(a.base.clone().addScaledVector(a.normal,a.depth)),direction=screenPoint(a.base.clone().addScaledVector(a.normal,a.depth+1));
 const x=Math.max(22,Math.min(host.clientWidth-22,end.x)),y=Math.max(22,Math.min(host.clientHeight-22,end.y));
 $('extrude-handle').style.left=x+'px';$('extrude-handle').style.top=y+'px';
 const axis=extrusionDragAxis(end,direction,host.clientHeight/viewHeight()),angle=extrusionArrowAngle(axis,a.depth);
 $('extrude-handle').style.transform='translate(-50%,-50%) rotate('+angle+'deg)';
 const hint=$('extrude-handle').dataset.snapped==='true'?'グリッド '+gridStep+' mm に吸着：'+fmt(a.depth)+' mm':'クリックで確定・ドラッグで距離を変更（'+(a.depth<0?'負':'正')+'方向）';if($('extrude-handle').title!==hint)$('extrude-handle').title=hint;
 const viewport=host.parentElement,panel=$('extrude-distance'),wheel=extrusionWheel.element,wheelHeight=wheel.offsetHeight;
 panel.style.maxHeight=Math.max(120,viewport.clientHeight-wheelHeight-24)+'px';
 const groupWidth=Math.max(panel.offsetWidth,wheel.offsetWidth),groupHeight=panel.offsetHeight+wheelHeight+8;
 if(panel.dataset.panelPosition!=='manual'){
  if(!extrusionOverlayDocked){
   extrusionOverlayPosition=findPanelSpace({width:viewport.clientWidth,height:viewport.clientHeight,panelWidth:groupWidth,panelHeight:groupHeight,anchor:{x,y},previous:extrusionOverlayPosition,obstacles:extrusionOverlayObstacles()});
   if(!extrusionOverlayPosition){extrusionOverlayDocked=true;viewport.dataset.extrusionDocked='true';viewport.style.setProperty('--extrusion-dock-width',(groupWidth+16)+'px');}
  }
  if(extrusionOverlayDocked)extrusionOverlayPosition={x:viewport.clientWidth-groupWidth-8,y:Math.max(8,(viewport.clientHeight-groupHeight)/2)};
  panel.style.left=(extrusionOverlayPosition.x+(groupWidth-panel.offsetWidth)/2)+'px';panel.style.top=(extrusionOverlayPosition.y+wheelHeight+8)+'px';
 }
 wheel.style.left=(panel.offsetLeft+(panel.offsetWidth-wheel.offsetWidth)/2)+'px';wheel.style.top=(panel.offsetTop-wheelHeight-8)+'px';
 updateTaperControl({x,y},angle);
 if(document.activeElement!==$('viewport-taper-angle'))$('viewport-taper-angle').value=$('taperAngle').value;
 if(document.activeElement!==$('viewport-depth'))$('viewport-depth').value=depthDisplay(depthValue());
 const line=$('extrude-guide-line');line.setAttribute('x1',start.x);line.setAttribute('y1',start.y);line.setAttribute('x2',end.x);line.setAttribute('y2',end.y);
}
function setExtrusionDistance(value){const n=Number(value);if($('until-solid').checked&&contactDistanceLimit&&Math.sign(n)===Math.sign(contactDistanceLimit)&&Math.abs(n)>Math.abs(contactDistanceLimit))value=contactDistanceLimit;if(document.activeElement!==$('viewport-depth')||Number(value)!==n)$('viewport-depth').value=depthDisplay(value);displayDepth(value);depthInputInternal=true;try{$('depth').dispatchEvent(new Event('input',{bubbles:true}));}finally{depthInputInternal=false;}$('viewport-depth-error').textContent=$('error').textContent;}
function formatDepthInputs(){const value=$('depth').value.trim()===''?'':depthValue();displayDepth(value);if(document.activeElement!==$('viewport-depth'))$('viewport-depth').value=depthDisplay(value);}
$('depth').addEventListener('blur',formatDepthInputs);
$('viewport-depth').addEventListener('blur',formatDepthInputs);
$('viewport-taper-angle').addEventListener('input',()=>{$('taperAngle').value=$('viewport-taper-angle').value;$('taperAngle').dispatchEvent(new Event('input',{bubbles:true}));});
$('viewport-taper-reset').onclick=()=>{$('viewport-taper-angle').value='0';$('viewport-taper-angle').dispatchEvent(new Event('input',{bubbles:true}));};
$('viewport-depth').addEventListener('input',()=>setExtrusionDistance($('viewport-depth').value));
$('extrude-distance').onsubmit=async e=>{e.preventDefault();try{if(selected)await applyHistoryEdit();else await applyFeature();$('viewport-depth-error').textContent='';}catch(err){$('viewport-depth-error').textContent=err.message;}};
$('viewport-extrude-cancel').onclick=()=>$('cancel').click();
$('extrude-handle').addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();contactAutoDepth=false;document.activeElement?.blur();const a=extrusionAnchor(),end=a.base.clone().addScaledVector(a.normal,a.depth),p=screenPoint(end),q=screenPoint(end.clone().add(a.normal));const {dx,dy}=extrusionDragAxis(p,q,host.clientHeight/viewHeight());extrusionDrag={id:e.pointerId,x:e.clientX,y:e.clientY,depth:a.depth,dx,dy,dragged:false,enabled:controls.enabled};delete $('extrude-handle').dataset.snapped;controls.enabled=false;$('extrude-handle').setPointerCapture(e.pointerId);});
$('extrude-handle').addEventListener('pointermove',e=>{const d=extrusionDrag;if(!d||e.pointerId!==d.id)return;if(!d.dragged){if(Math.hypot(e.clientX-d.x,e.clientY-d.y)<=4)return;d.dragged=true;}const delta=((e.clientX-d.x)*d.dx+(e.clientY-d.y)*d.dy)/(d.dx*d.dx+d.dy*d.dy);const result=extrusionDragDistance(d.depth+delta,{snapEnabled:$('snap-enabled').checked,step:gridStep,pixelsPerMm:Math.hypot(d.dx,d.dy)});if(depthValue()!==result.value)setExtrusionDistance(result.value);$('extrude-handle').dataset.snapped=String(result.snapped&&Math.abs(depthValue()-result.value)<1e-8);});
function confirmExtrusionArrow(){
 if(stage!=='extrusion'||pendingExtrude||extrusionBusy||$('apply').disabled)return;
 confirmVisibleForm();
}
function endExtrusionDrag(e){
 const drag=extrusionDrag;if(!drag||drag.id!==e.pointerId)return;
 const clicked=e.type==='pointerup'&&e.button===0&&!drag.dragged&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<=4;
 controls.enabled=drag.enabled;extrusionDrag=null;delete $('extrude-handle').dataset.snapped;
 if($('extrude-handle').hasPointerCapture(e.pointerId))$('extrude-handle').releasePointerCapture(e.pointerId);
 if(clicked)confirmExtrusionArrow();
}
$('extrude-handle').addEventListener('pointerup',endExtrusionDrag);$('extrude-handle').addEventListener('pointercancel',endExtrusionDrag);$('extrude-handle').addEventListener('lostpointercapture',endExtrusionDrag);
// Pointer releases are handled above; native keyboard/assistive clicks have detail 0.
$('extrude-handle').addEventListener('click',e=>{if(e.detail===0)confirmExtrusionArrow();});

function applyGridVisibility(){const plane=grid.userData.plane||'XY';grid.visible=gridVisibility[plane]!==false;host.dataset.gridVisible=String(grid.visible);$('grid-toggle').setAttribute('aria-pressed',String(grid.visible));$('grid-toggle').textContent='▦ '+(plane==='CUSTOM'?'作図面':plane)+' グリッド';for(const input of document.querySelectorAll('[data-grid-plane]'))input.checked=gridVisibility[input.dataset.gridPlane];}
for(const input of document.querySelectorAll('[data-grid-plane]'))input.onchange=()=>{gridVisibility[input.dataset.gridPlane]=input.checked;applyGridVisibility();};
$('construction-visible').onchange=()=>{for(const child of regionGroup.children)if(child.userData.constructionPlane)child.visible=$('construction-visible').checked;};
$('offset-plane-tool').onclick=()=>{finishSketch(false);$('cad-command').value='offset';renderCommand();openToolsDialog();};

function clearEdgeSelection(){edgeTurnState=null;delete host.dataset.edgeTurn;clearBodySelection();clearSketchSelection();selectedRegions=[];if(!selectingFaces)clearFaceSelection();selectedEdge=null;selectedEdges=[];host.dataset.selectedEdgeCount='0';$('edge-fillet').hidden=true;host.dataset.selectedEdge='false';if(edgeHighlight){disposeObject(edgeHighlight);edgeHighlight=null;}}
function findScreenEdge(event){if(bodyDisplay?.exploded)return null;
 const rect=renderer.domElement.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top,candidates=[];
 for(const mesh of meshes.values()){if(!mesh.visible)continue;const attr=mesh.children[0]?.geometry?.attributes.position;if(!attr)continue;for(let i=0;i<attr.count;i+=2){const a=new THREE.Vector3().fromBufferAttribute(attr,i),b=new THREE.Vector3().fromBufferAttribute(attr,i+1),p=screenPoint(a),q=screenPoint(b);if(p.z<-1||p.z>1||q.z<-1||q.z>1)continue;const dx=q.x-p.x,dy=q.y-p.y,len=dx*dx+dy*dy;if(len<.01)continue;const t=Math.max(0,Math.min(1,((x-p.x)*dx+(y-p.y)*dy)/len)),distance=Math.hypot(x-p.x-dx*t,y-p.y-dy*t);if(distance>10)continue;const da=a.distanceTo(camera.position),db=b.distanceTo(camera.position),wt=t,point=a.clone().lerp(b,wt);candidates.push({mesh,a,b,point,distance,depth:point.clone().project(camera).z,circle:mesh.children[0].geometry.userData.circularEdges?.get(i),arc:mesh.children[0].geometry.userData.arcEdges?.get(i)});}}
 candidates.sort((a,b)=>Math.abs(a.distance-b.distance)>.25?a.distance-b.distance:a.depth-b.depth);const visibleMeshes=[...meshes.values()].filter(m=>m.visible);for(const c of candidates){const ray=visibilityRay(c.point),length=ray.ray.origin.distanceTo(c.point);const hit=ray.intersectObjects(visibleMeshes,false)[0];if(!hit||hit.distance>=length-Math.max(.02,length*.0003))return c;}return null;
}
function pickBodyEdge(event){const hit=findScreenEdge(event);return hit?chooseEdgeHit(hit,event.ctrlKey||event.metaKey):false;}
function chooseEdgeHit(hit,add=false,toggle=true){$('center-pattern').hidden=true;if(!add)clearEdgeSelection();else clearFaceSelection();const {mesh,a,b,point,circle,arc}=hit,edge={bodyId:mesh.userData.bodyId,point:point.toArray(),a:arc?arc.points[0]:a.toArray(),b:arc?arc.points.at(-1):b.toArray(),circle,arc};
const same=(x,y)=>x.bodyId===y.bodyId&&(x.arc||y.arc?!!x.arc&&!!y.arc&&x.arc.key===y.arc.key:(x.circle&&y.circle?new THREE.Vector3(...x.circle.center).distanceTo(new THREE.Vector3(...y.circle.center))<1e-5&&Math.abs(x.circle.radius-y.circle.radius)<1e-5:!x.circle&&!y.circle&&((new THREE.Vector3(...x.a).distanceTo(new THREE.Vector3(...y.a))<1e-5&&new THREE.Vector3(...x.b).distanceTo(new THREE.Vector3(...y.b))<1e-5)||(new THREE.Vector3(...x.a).distanceTo(new THREE.Vector3(...y.b))<1e-5&&new THREE.Vector3(...x.b).distanceTo(new THREE.Vector3(...y.a))<1e-5))));
const index=selectedEdges.findIndex(x=>same(x,edge));if(index>=0){if(!toggle)return true;selectedEdges.splice(index,1);}else selectedEdges.push(edge);selectedEdge=selectedEdges.at(-1)||null;fragmentSelection=selectedEdge;selectedSurface=null;selectedFace=null;selectedBody=selectedEdge?.bodyId||mesh.userData.bodyId;selected=null;chosenRegion=null;stage='model';dropPreview();syncFields();if(edgeHighlight)disposeObject(edgeHighlight);edgeHighlight=new THREE.Group();for(const e of selectedEdges){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(((e.circle||e.arc)?.points||[e.a,e.b]).map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color:0xffa000,depthTest:false}));line.renderOrder=20;edgeHighlight.add(line);}scene.add(edgeHighlight);$('measurement').hidden=!selectedEdge;$('measurement-title').textContent=selectedEdges.length>1?selectedEdges.length+' 辺を選択':selectedEdge?.circle?'選択した円周':selectedEdge?.arc?'選択した円弧':'選択した辺';$('measurement-length').textContent=fmt(selectedEdges.reduce((sum,e)=>sum+((e.circle||e.arc)?.length??new THREE.Vector3(...e.a).distanceTo(new THREE.Vector3(...e.b))),0))+' mm';$('measurement-angle').textContent=(selectedEdges.length===1&&selectedEdge?.circle?'直径 '+fmt(selectedEdge.circle.radius*2)+' mm · ':selectedEdges.length===1&&selectedEdge?.arc?'半径 '+fmt(selectedEdge.arc.radius)+' mm · ':'')+'Ctrl＋クリックで追加・解除 / 選択した辺をまとめてフィレット';$('edge-fillet').hidden=!selectedEdge;host.dataset.selectedEdge=String(!!selectedEdge);host.dataset.selectedEdgeCount=String(selectedEdges.length);return true;
}

function chooseConstructionPlane(f){if(!f)return;clearEdgeSelection();selectedSurface=null;selectedFace={...f,plane:'CUSTOM'};selected=null;chosenRegion=null;stage='model';dropPreview();syncFields();$('measurement').hidden=false;$('measurement-title').textContent='選択した構築平面';$('measurement-length').textContent=f.name;$('measurement-angle').textContent='スケッチを作成 / オフセット平面';}
$('sketch-offset-tool').onclick=()=>{finishSketch(false);$('cad-command').value='sketchOffset';renderCommand();openToolsDialog();};
renderer.domElement.addEventListener('pointerdown',e=>{
 if(!sketch||![1,2].includes(e.button)||sketchPan||shiftOrbit||moveTool?.active||e.button===1&&e.shiftKey)return;
 e.preventDefault();e.stopImmediatePropagation();
 sketchPan={id:e.pointerId,x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);host.style.cursor='grabbing';
},{capture:true});
renderer.domElement.addEventListener('pointermove',e=>{
 if(!sketchPan||e.pointerId!==sketchPan.id)return;
 e.preventDefault();e.stopImmediatePropagation();
 const dx=e.clientX-sketchPan.x,dy=e.clientY-sketchPan.y;sketchPan.x=e.clientX;sketchPan.y=e.clientY;
 if(!dx&&!dy)return;
 camera.updateMatrixWorld(true);
 const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1),scale=viewHeight()/host.clientHeight;
 const movement=right.multiplyScalar(-dx*scale).addScaledVector(up,dy*scale);
 camera.position.add(movement);controls.target.add(movement);camera.updateMatrixWorld(true);
},{capture:true});
function endSketchPan(e){
 if(!sketchPan||e.pointerId!==sketchPan.id)return;
 e.preventDefault();e.stopImmediatePropagation();sketchPan=null;down=null;host.style.cursor=sketch?'crosshair':'';
 if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);
}
for(const type of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(type,endSketchPan,{capture:true});
renderer.domElement.addEventListener('contextmenu',e=>{if(sketch)e.preventDefault();});
renderer.domElement.addEventListener('pointerdown',e=>{if(moveTool?.active)controls.enabled=false;if(!e.shiftKey||![0,1].includes(e.button)||(sketch&&e.button===0&&$('profile').value!=='point'))return;e.preventDefault();e.stopImmediatePropagation();shiftOrbit={id:e.pointerId,button:e.button,origin:e.button===1,x:e.clientX,y:e.clientY,position:camera.position.clone(),target:controls.target.clone(),up:camera.up.clone(),enabled:controls.enabled};controls.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);},{capture:true});
renderer.domElement.addEventListener('pointermove',e=>{if(!shiftOrbit||e.pointerId!==shiftOrbit.id)return;e.preventDefault();e.stopImmediatePropagation();const view=orbitView(shiftOrbit,e.clientX-shiftOrbit.x,e.clientY-shiftOrbit.y);camera.position.copy(view.position);camera.up.copy(view.up);controls.target.copy(view.target);camera.lookAt(view.target);camera.updateMatrixWorld(true);host.dataset.cameraHeight=String(camera.position.z);},{capture:true});
function endShiftOrbit(e){if(!shiftOrbit||e.pointerId!==shiftOrbit.id)return;e.stopImmediatePropagation();const click=shiftOrbit.button===0&&e.type==='pointerup'&&Math.hypot(e.clientX-shiftOrbit.x,e.clientY-shiftOrbit.y)<5;resetViewControls(controls.target.clone(),shiftOrbit.enabled);shiftOrbit=null;down=null;if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);if(click&&!sketch){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects([...meshes.values()].filter(m=>m.visible),false)[0];if(hit){if(selectionMode==='body'&&!$('tools-dialog').open)chooseBody(hit.object.userData.bodyId,true);else if(selectionMode==='edge'&&!$('tools-dialog').open)pickBodyEdge({...e,clientX:e.clientX,clientY:e.clientY,ctrlKey:true});else chooseFace(hit,true);}}}
renderer.domElement.addEventListener('pointerup',endShiftOrbit,{capture:true});renderer.domElement.addEventListener('pointercancel',endShiftOrbit,{capture:true});renderer.domElement.addEventListener('lostpointercapture',endShiftOrbit,{capture:true});

function updateEdgeOverlay(){const edge=selectedEdge?{a:new THREE.Vector3(...selectedEdge.a),b:new THREE.Vector3(...selectedEdge.b),circle:selectedEdge.circle,arc:selectedEdge.arc}:hoverEdge;$('edge-overlay').toggleAttribute('hidden',!edge);if(!edge)return;const points=((edge.circle||edge.arc)?(edge.circle||edge.arc).points.map(p=>new THREE.Vector3(...p)):[edge.a,edge.b]).map(screenPoint),a=points[0],b=points.at(-1),path=points.map((p,i)=>(i?'L':'M')+p.x+','+p.y).join(' ');for(const id of ['edge-overlay-line','edge-overlay-halo']){const line=$(id);line.setAttribute('d',selectedEdges.length>1?selectedEdges.map(e=>((e.circle||e.arc)?.points||[e.a,e.b]).map(p=>screenPoint(new THREE.Vector3(...p))).map((p,i)=>(i?'L':'M')+p.x+','+p.y).join(' ')).join(' '):path);line.setAttribute('stroke-width',id==='edge-overlay-halo'?(selectedEdge?(edge.circle||edge.arc?9:11):8):(selectedEdge?(edge.circle||edge.arc?5:7):4));}$('edge-overlay-line').setAttribute('stroke',selectedEdge?'#ff8c00':'#00a0db');for(const [id,p]of [['edge-end-a',a],['edge-end-b',b]]){$(id).style.display=selectedEdge&&selectedEdges.length===1&&!edge.circle?'':'none';$(id).setAttribute('cx',p.x);$(id).setAttribute('cy',p.y);}}
renderer.domElement.addEventListener('pointermove',e=>{if(sketch||pendingExtrude||extrusionDrag||shiftOrbit||e.buttons||(['body','face'].includes(selectionMode)&&!$('tools-dialog').open)){hoverEdge=null;return;}if(performance.now()-hoverTime<40)return;hoverTime=performance.now();hoverEdge=findScreenEdge(e);host.dataset.hoverEdge=String(!!hoverEdge);host.style.cursor=hoverEdge?'pointer':'';});
renderer.domElement.addEventListener('pointerleave',()=>{hoverEdge=null;});
$('edge-fillet').onclick=()=>{if(!selectedEdge)return;$('cad-command').value='fillet';renderCommand();openToolsDialog();};

function updateCircleInput(){const panel=polygonMode?$('polygon-dimensions'):$('circle-dimensions');$('polygon-dimensions').hidden=!polygonMode||!sketch||!firstPoint;$('circle-dimensions').hidden=polygonMode||!sketch||!firstPoint||$('profile').value!=='circle';panel.hidden=!(sketch&&firstPoint&&$('profile').value==='circle');if(panel.hidden)return;const point=screenPoint(firstPoint);panel.style.left=Math.max(8,Math.min(host.clientWidth-panel.offsetWidth-8,point.x+28))+'px';panel.style.top=Math.max(8,Math.min(host.clientHeight-panel.offsetHeight-8,point.y+24))+'px';}
function previewCircleInput(){if(!firstPoint)return;previewEndpoint(lastDrawPoint||firstPoint.clone().addScaledVector(sketchBasis.u,Number($('live-diameter').value)/2||15));}
installDirectDimensionInput(()=>{
 if($('tools-dialog').open)return $('cad-fields').querySelector('input[type="number"]:not(:disabled)');
 if(stage==='extrusion'&&!pendingExtrude&&!$('extrude-distance').hidden)return $('viewport-depth');
 if(holeActive&&!$('hole-panel').hidden)return $('hole-diameter');
 if(sketch&&firstPoint){if($('profile').value==='circle'){updateCircleInput();return polygonMode?$('polygon-radius'):$('live-diameter');}if(['line','rect'].includes($('profile').value)){updateSketchDimensions();return $('sketch-dim-0');}}
 return null;
});
$('live-diameter').addEventListener('focus',()=>{circleDiameterLocked=true;$('lock-diameter').checked=true;previewCircleInput();});
$('live-diameter').addEventListener('input',()=>{circleDiameterLocked=true;$('lock-diameter').checked=true;previewCircleInput();});
$('lock-diameter').onchange=()=>{circleDiameterLocked=$('lock-diameter').checked;previewCircleInput();};
$('circle-dimensions').onsubmit=e=>{e.preventDefault();if(!firstPoint)return;circleDiameterLocked=true;$('lock-diameter').checked=true;placeEndpoint(lastDrawPoint||firstPoint.clone().addScaledVector(sketchBasis.u,15));};
window.addEventListener('keydown',e=>{if(e.key!=='Tab'||e.ctrlKey||e.altKey||e.metaKey||!sketch||!firstPoint)return;const profile=$('profile').value,ids=polygonMode?['polygon-radius','polygon-sides']:profile==='circle'?['live-diameter']:['line','rect'].includes(profile)?['sketch-dim-0','sketch-dim-1']:[];if(!ids.length)return;e.preventDefault();e.stopPropagation();updateCircleInput();updateSketchDimensions();const i=ids.indexOf(document.activeElement.id),next=i<0?(e.shiftKey?ids.length-1:0):(i+(e.shiftKey?-1:1)+ids.length)%ids.length,input=$(ids[next]);input.focus();input.select();},{capture:true});

function updateCenterMarkers(){if(bodyDisplay?.exploded){for(const c of centerCandidates)c.button.hidden=true;return;}const group=$('center-markers');group.hidden=deletingSketch||(!sketch&&selectionMode!=='auto')||($('tools-dialog').open&&['loft','revolve'].includes($('cad-command').value))||moveTool?.active||pendingExtrude||stage==='extrusion'||edgeSelectionMode||selectedEdges.length>0;group.classList.toggle('sketching',sketch||holeActive);if(group.hidden)return;const centerPlane=sketch?[...sketchBasis.n.toArray(),sketchOrigin.dot(sketchBasis.n)].join(','):'';const centerMode=sketch?$('profile').value+':'+String(!!firstPoint):'';const centerVisible=[...meshes].filter(([,mesh])=>mesh.visible).map(([id])=>id).join(',');if(centerRevision?.features!==features||centerRevision?.sketch!==sketch||centerRevision?.plane!==centerPlane||centerRevision?.visible!==centerVisible||centerRevision?.mode!==centerMode){centerRevision={features,sketch,plane:centerPlane,visible:centerVisible,mode:centerMode};group.replaceChildren();centerCandidates=[];const add=(point,normal,name,kind="center",bodyId=null)=>{if(centerCandidates.some(c=>new THREE.Vector3(...c.point).distanceTo(new THREE.Vector3(...point))<1e-5))return;const c={point,normal,name,kind,bodyId},button=document.createElement('button');button.type='button';button.className='center-marker';button.textContent=kind==='intersection'?'×':kind==='midpoint'?'△':'⊙';button.title=kind==='intersection'?'スケッチの交点を選択':name==='ヒンジ軸中心'?'ヒンジ軸中心を選択':name+(kind==='midpoint'?'の中点を選択':'の中心を選択');button.setAttribute('aria-label',button.title);button.onclick=()=>selectPatternCenter(c);group.append(button);centerCandidates.push({...c,button});};for(const point of getIntersectionPoints())add(point.toArray(),[0,0,1],'スケッチ交点','intersection');for(const ref of hingeReferences()){if(sketch){if(hingeSketchUsesVisibleRim())for(const point of hingeSketchRimPoints(ref))add(point.toArray(),ref.direction,ref.name,'hinge-rim');else{const point=hingeSketchPoint(ref);if(point)add(point.toArray(),ref.direction,ref.name);}}else for(const rim of ref.rimPoints)if(meshes.get(rim.bodyId)?.visible)add(rim.point,ref.direction,ref.name);}for(const [bodyId,mesh] of meshes)for(const r of mesh.userData.references||[])add(r.point,r.normal,r.name,r.kind,bodyId);for(const f of features)if(f.kind==='sketch'&&!f.groupHidden&&['point','circle','rect'].includes(f.profile))add([f.x,f.y,f.z],basisFor(f).n.toArray(),f.profile==='point'?'スケッチ点':f.profile==='circle'?'円':'長方形');for(const f of features.filter(f=>f.kind==='sketch'&&!f.groupHidden)){const r={...f,offset:planeCoordinates(f).offset};for(const p of sketchMidpoints(f))add(worldPoint(r,p).toArray(),basisFor(f).n.toArray(),'スケッチ辺','midpoint');}for(const r of regionList){if(r.outer.length!==4||r.holes.length)continue;const p=r.outer,rect=p.every((a,i)=>{const b=p[(i+1)%4],c=p[(i+2)%4];return Math.abs((b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1]))<1e-5;});if(rect){const center=[p.reduce((s,q)=>s+q[0]/4,0),p.reduce((s,q)=>s+q[1]/4,0)];add(worldPoint(r,center).toArray(),basisFor(r).n.toArray(),'長方形領域');}}}for(const c of centerCandidates){const world=new THREE.Vector3(...c.point),p=screenPoint(world),rect=host.getBoundingClientRect();const nearby=referencePointer&&Math.hypot(referencePointer.x-rect.left-p.x,referencePointer.y-rect.top-p.y)<=28;const onPlane=!sketch||c.kind==='hinge-rim'||Math.abs(world.dot(sketchBasis.n)-sketchOrigin.dot(sketchBasis.n))<1e-4;if(!nearby||!onPlane){c.button.hidden=true;continue;}let occluded=false;if(c.bodyId){const ray=visibilityRay(world);ray.far=ray.ray.origin.distanceTo(world)-.001;occluded=ray.intersectObjects([...meshes.values()].filter(m=>m.visible),false).length>0;}c.button.hidden=occluded||(c.bodyId&&!meshes.get(c.bodyId)?.visible)||p.z<-1||p.z>1||p.x<0||p.x>host.clientWidth||p.y<0||p.y>host.clientHeight;c.button.style.left=p.x+'px';c.button.style.top=p.y+'px';c.button.classList.toggle('selected',!!patternCenter&&patternCenter.point.every((v,i)=>Math.abs(v-c.point[i])<1e-5));}const visible=centerCandidates.filter(c=>!c.button.hidden),hingeOutputs=new Set(features.filter(f=>f.kind==='cadop'&&f.spec?.type==='enclose'&&f.spec.hinge).flatMap(f=>[f.spec.id,f.spec.id+'-part2'])),hingeMarkers=visible.filter(c=>c.name==='ヒンジ軸中心');for(const c of visible)if(c.bodyId&&hingeOutputs.has(c.bodyId)&&hingeMarkers.some(h=>Math.hypot(parseFloat(c.button.style.left)-parseFloat(h.button.style.left),parseFloat(c.button.style.top)-parseFloat(h.button.style.top))<16))c.button.hidden=true;const nearest=visible.filter(c=>!c.button.hidden);nearest.sort((a,b)=>{const rect=host.getBoundingClientRect(),distance=c=>Math.hypot(referencePointer.x-rect.left-parseFloat(c.button.style.left),referencePointer.y-rect.top-parseFloat(c.button.style.top));const delta=distance(a)-distance(b);return Math.abs(delta)>.5?delta:new THREE.Vector3(...a.point).project(camera).z-new THREE.Vector3(...b.point).project(camera).z;});for(const c of nearest.slice(1))c.button.hidden=true;}
function selectPatternCenter(center){if(deletingSketch)return;clearEdgeSelection();finishSketch(false);selected=null;selectedFace=null;selectedSurface=null;chosenRegion=null;patternCenter={point:[...center.point],normal:[...center.normal],name:center.name,kind:center.kind};if(center.bodyId)selectedBody=center.bodyId;const point=new THREE.Vector3(...center.point);chosenRegion=regionList.find(r=>{const b=basisFor(r);return Math.abs(point.dot(b.n)-r.offset)<1e-5&&regionContains(r,[point.dot(b.u),point.dot(b.v)]);})||null;stage='model';dropPreview();syncFields();$('measurement').hidden=false;$('measurement-title').textContent='選択した'+center.name+(center.name==='ヒンジ軸中心'||center.kind==='intersection'?'':center.kind==='midpoint'?'の中点':'の中心');$('measurement-length').textContent=center.point.map(fmt).join(', ')+' mm';$('measurement-angle').textContent='円形状パターンの回転中心';$('center-pattern').hidden=false;notify('中心を選択しました。「この中心で円形状パターン」で対象ボディを指定できます');}
$('center-pattern').onclick=()=>{if(!patternCenter)return;$('cad-command').value='circular';renderCommand();openToolsDialog();};

function gridViewBounds(basis,offset){return planeViewBounds(camera,basis,offset,controls.target);}
function updateModelGrid(){
 const basis=basisFor({plane:gridPlane}),layout=viewportGridLayout(gridViewBounds(basis,0),gridStep),key=JSON.stringify([gridPlane,layout.step,layout.divisions,layout.u,layout.v]);
 if(key!==modelGridKey){modelGridKey=key;disposeObject(grid);grid=cadGrid(layout.step,layout.divisions,true,[layout.u,layout.v]);grid.applyMatrix4(new THREE.Matrix4().makeBasis(basis.u,basis.n.clone().negate(),basis.v));grid.userData.plane=gridPlane;scene.add(grid);}
 grid.position.copy(basis.u).multiplyScalar(layout.u).addScaledVector(basis.v,layout.v).addScaledVector(basis.n,-.03);grid.visible=gridVisibility[gridPlane]!==false;
 host.dataset.gridBounds=JSON.stringify(layout.bounds);host.dataset.gridDisplayStep=String(layout.step);
 const label=layout.step===gridStep?'1目盛り：'+fmt(gridStep)+' mm':'表示1目盛り：'+fmt(layout.step)+' mm（吸着：'+fmt(gridStep)+' mm）';if($('grid-scale').textContent!==label)$('grid-scale').textContent=label;
 return layout;
}
function updateSketchGrid(){
 const face=!sketch&&stage==='model'?(holeActive?holeHoverFace:selectedFace):null,basis=sketch?sketchBasis:face?basisFor(face):null;
 const originPlane=sketch?(Math.abs(basis.n.z)>.999999?'XY':Math.abs(basis.n.y)>.999999?'XZ':Math.abs(basis.n.x)>.999999?'YZ':null):null;
 const originSketch=!!originPlane&&Math.abs(sketchOrigin.dot(basis.n))<1e-5;
 if(originSketch)gridPlane=originPlane;
 const visible=!!basis&&!originSketch&&gridVisibility[sketch?$('plane').value:face?.plane||'CUSTOM']!==false;
 const scopedFace=face?.bodyId&&face.outer?face:null,scope=scopedFace?$('face-grid-scope').value:'unlimited';$('face-grid-scope-row').hidden=!scopedFace;
 // Keep the origin plane alongside the working grid.
 updateModelGrid();
 host.dataset.gridVisible=String(grid.visible);
 const worldNormal=new THREE.Vector3(0,1,0).applyQuaternion(grid.quaternion),normal=basis?.n||worldNormal;
 const planeName=Math.abs(normal.z)>.999999?'XY':Math.abs(normal.y)>.999999?'XZ':Math.abs(normal.x)>.999999?'YZ':'任意平面';
 $('reference-plane').value=gridPlane;
 $('active-plane').textContent=basis?(sketch?'作図中：':holeActive?'穴あけ面：':'選択面：')+planeName:'表示中：'+gridPlane;
 host.dataset.activePlane=planeName;host.dataset.referencePlane=gridPlane;
 axisGroup.children.forEach((axis,i)=>{axis.visible=(grid.visible&&Math.abs(worldNormal.getComponent(i))<1e-6)||(visible&&Math.abs(normal.getComponent(i))<1e-6);});
 host.dataset.visibleAxes=axisGroup.children.map((axis,i)=>axis.visible?'XYZ'[i]:'').join('');
 if(!visible){if(sketchGrid)sketchGrid.visible=false;host.dataset.sketchGridVisible='false';delete host.dataset.sketchGridBounds;delete host.dataset.sketchGridDisplayStep;const label='1目盛り：'+fmt(gridStep)+' mm';if(basis&&!originSketch&&$('grid-scale').textContent!==label)$('grid-scale').textContent=label;return;}
 const offset=sketch?sketchOrigin.dot(basis.n):face.offset+(bodyDisplay?.offset(face.bodyId).dot(basis.n)||0),view=gridViewBounds(basis,offset);
 const scoped=scopedFace&&scope!=='unlimited',layout=scoped?null:viewportGridLayout(view,gridStep),bounds=scoped?faceGridBounds(scopedFace,scope):layout.bounds;
 let displayStep=scoped?gridStep:layout.step;if(scoped)while(Math.max(bounds.u[1]-bounds.u[0],bounds.v[1]-bounds.v[0])/displayStep>180)displayStep*=2;
 const key=JSON.stringify([basis.u.toArray(),basis.v.toArray(),offset,displayStep,scope,!!scopedFace,scoped?scopedFace.id:layout.divisions]);
 if(key!==sketchGridKey){if(sketchGrid)disposeObject(sketchGrid);sketchGridKey=key;sketchGrid=scoped?scopedFaceGrid(scopedFace,scope,gridStep).grid:cadGrid(displayStep,layout.divisions,false);sketchGrid.applyMatrix4(new THREE.Matrix4().makeBasis(basis.u,basis.n.clone().negate(),basis.v));sketchGrid.traverse(o=>{if(o.material){o.material.vertexColors=false;o.material.color.set(scopedFace?0xb678e8:0x9554c9);o.material.transparent=true;o.material.opacity=scopedFace ? .85 : .3;o.material.depthWrite=false;o.material.depthTest=false;}});sketchGrid.renderOrder=3;scene.add(sketchGrid);}
 sketchGrid.position.copy(basis.n).multiplyScalar(offset);if(!scoped)sketchGrid.position.addScaledVector(basis.u,layout.u).addScaledVector(basis.v,layout.v);else{const shift=bodyDisplay?.offset(scopedFace.bodyId)||new THREE.Vector3();sketchGrid.position.addScaledVector(basis.u,shift.dot(basis.u)).addScaledVector(basis.v,shift.dot(basis.v));}
 const displayBounds=scoped?Object.fromEntries(['u','v'].map(axis=>{const delta=(bodyDisplay?.offset(scopedFace.bodyId)||new THREE.Vector3()).dot(basis[axis]);return [axis,bounds[axis].map(value=>value+delta)];})):bounds;
 host.dataset.sketchGridBounds=JSON.stringify(displayBounds);host.dataset.sketchGridDisplayStep=String(displayStep);host.dataset.faceGridScope=scope;
 const label=displayStep===gridStep?'1目盛り：'+fmt(gridStep)+' mm':'表示1目盛り：'+fmt(displayStep)+' mm（吸着：'+fmt(gridStep)+' mm）';if($('grid-scale').textContent!==label)$('grid-scale').textContent=label;
 sketchGrid.visible=true;host.dataset.sketchGridVisible='true';host.dataset.sketchGridOffset=String(offset);
}
function selectFaceGrid(){
 if(!selectedFace||!sketchGrid?.visible||stage!=='model')return false;
 const face=selectedFace,b=basisFor(face),shift=bodyDisplay?.offset(face.bodyId)||new THREE.Vector3(),point=raycaster.ray.intersectPlane(new THREE.Plane(b.n,-face.offset-shift.dot(b.n)),new THREE.Vector3());
 if(!point)return false;point.sub(shift);
 if(face.bodyId&&face.outer&&!faceGridContains(face,[point.dot(b.u),point.dot(b.v)],$('face-grid-scope').value))return false;
 clearFaceSelection(); clearEdgeSelection();selected=null;selectedSurface=null;selectedBody=face.bodyId||selectedBody;chosenRegion=face.outer?face:null;activeFrame=face.frame;syncFields();
 $('measurement').hidden=false;$('measurement-title').textContent='選択した面のグリッド';$('measurement-length').textContent='1目盛り：'+fmt(gridStep)+' mm';$('measurement-angle').textContent='スケッチ / オフセット平面 / 分割'+(face.outer?' / 押し出し':'');$('status').textContent='作業平面を選択しました。上のツールからコマンドを選んでください';host.dataset.selectedFaceGrid='true';return true;
}

function startHole(){
 if(!meshes.size){notify('先にボディを作成してください');return;}
 finishSketch(false);clearEdgeSelection();selected=null;pendingExtrude=false;stage='model';dropPreview();
 holeActive=true;holePlacement=null;holeHoverFace=null;host.dataset.snapKind='free';
 $('snap-icon').hidden=true;$('snap-readout').hidden=true;
 syncFields();$('hole-panel').hidden=false;$('hole-apply').disabled=true;$('hole-error').textContent='';
 $('hole-position').textContent='ソリッドの平面上で中心点をクリック';
 $('status').textContent='穴あけ：中心点を指定 → 直径・深さを入力 → 穴を開ける';
}
function cancelHole(){
 holeActive=false;holePlacement=null;holeHoverFace=null;
 $('snap-icon').hidden=true;$('snap-readout').hidden=true;
 $('hole-panel').hidden=true;dropPreview();
}
const holeFaceCache=new WeakMap();
function cachedHoleFace(hit){
 const geometry=hit.object.geometry,triangle=hit.faceIndex;
 let entry=holeFaceCache.get(geometry);
 if(!entry){entry={triangles:new Map(),faces:[]};holeFaceCache.set(geometry,entry);}
 let face=entry.triangles.get(triangle);
 if(face)return face;
 for(const cached of entry.faces){
  const basis=basisFor(cached);
  if(hit.face.normal.dot(basis.n)<.999999||Math.abs(hit.point.dot(basis.n)-cached.offset)>1e-4)continue;
  if(regionContains(cached,[hit.point.dot(basis.u),hit.point.dot(basis.v)])){face=cached;break;}
 }
 if(!face){face=planarFace(geometry,triangle);entry.faces.push(face);}
 entry.triangles.set(triangle,face);
 return face;
}
function holeSnapCandidate(event){
 const rect=renderer.domElement.getBoundingClientRect();
 pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
 raycaster.setFromCamera(pointer,camera);
 const hit=raycaster.intersectObjects([...meshes.values()].filter(m=>m.visible),false)[0];
 if(!hit)return null;
 const geometry=hit.object.geometry;
 const group=geometry.userData.faceGroups?.find(g=>hit.faceIndex*3>=g.start&&hit.faceIndex*3<g.start+g.count);
 if(group&&geometry.userData.planarFaces&&!geometry.userData.planarFaces.includes(group.faceId))throw Error('平面を選択してください');
 const face=cachedHoleFace(hit),basis=basisFor(face);
 let point=hit.point.clone(),kind='free',nearest=6;
 for(const ref of [...(hit.object.userData.references||[]),...features.filter(f=>f.kind==='sketch'&&f.profile==='point'&&!f.groupHidden).map(f=>({point:[f.x,f.y,f.z],kind:'center'}))]){
  const p=new THREE.Vector3(...ref.point),a=screenPoint(p),b=screenPoint(hit.point),d=Math.hypot(a.x-b.x,a.y-b.y);
  if(Math.abs(p.dot(basis.n)-face.offset)<1e-4&&d<nearest){point=p;nearest=d;kind=ref.kind||'center';}
 }
 for(const p of getIntersectionPoints()){
  const a=screenPoint(p),b=screenPoint(hit.point),d=Math.hypot(a.x-b.x,a.y-b.y);
  if(Math.abs(p.dot(basis.n)-face.offset)<1e-4&&d<nearest){point=p.clone();nearest=d;kind='intersection';}
 }
 if(nearest===6&&$('snap-enabled').checked){
  const uv=[Math.round(point.dot(basis.u)/gridStep)*gridStep,Math.round(point.dot(basis.v)/gridStep)*gridStep];
  const candidate=worldPoint(face,uv),a=screenPoint(candidate),b=screenPoint(hit.point);
  if(regionContains(face,uv)&&Math.hypot(a.x-b.x,a.y-b.y)<=6){point=candidate;kind='grid';}
 }
 return {face,point,bodyId:hit.object.userData.bodyId,kind};
}
function hoverHolePoint(event){
 try{
  const candidate=holeSnapCandidate(event);
  holeHoverFace=candidate?.face||null;
  if(!candidate){$('snap-icon').hidden=true;$('snap-readout').hidden=true;host.dataset.snapKind='free';return;}
  host.dataset.snapKind=candidate.kind;
  showSnap(candidate.point,basisFor(candidate.face));
 }catch{
  holeHoverFace=null;$('snap-icon').hidden=true;$('snap-readout').hidden=true;host.dataset.snapKind='free';
 }
}
function pickHolePoint(event){
 try{
  const candidate=holeSnapCandidate(event);
  if(!candidate){notify('ソリッドの平面上に中心点を指定してください');return;}
  const {face,point,bodyId,kind}=candidate;
  holePlacement={face,point,bodyId};
  holeHoverFace=face;selectedFace={...face,bodyId};
  host.dataset.snapKind=kind;showSnap(point,basisFor(face));
  $('hole-position').textContent='中心：'+point.toArray().map(fmt).join(', ')+' mm';
  updateHolePreview();
 }catch(e){$('hole-error').textContent=e.message;}
}
function holeFeature(){if(!holePlacement)throw Error('中心点を指定してください');const diameter=Number($('hole-diameter').value),depth=Number($('hole-depth').value);if(!Number.isFinite(diameter)||diameter<.1||diameter>10000)throw Error('直径は0.1〜10000 mmで指定してください');if(!$('hole-through').checked&&(!Number.isFinite(depth)||depth<.1||depth>10000))throw Error('深さは0.1〜10000 mmで指定してください');const {face,point,bodyId}=holePlacement;let distance=depth;if($('hole-through').checked){const p=meshes.get(bodyId).geometry.attributes.position,n=basisFor(face).n;let min=Infinity;for(let i=0;i<p.count;i++)min=Math.min(min,new THREE.Vector3().fromBufferAttribute(p,i).dot(n));distance=face.offset-min+.01;}return {...defaults,id:crypto.randomUUID(),name:'穴 Ø'+fmt(diameter),kind:'extrusion',profile:'circle',plane:'CUSTOM',frame:face.frame,x:point.x,y:point.y,z:point.z,diameter,depth:-distance,operation:'cut',target:bodyId,hole:true};}
function updateHolePreview(){dropPreview();$('hole-error').textContent='';try{const f=holeFeature();preview=new THREE.Mesh(makeGeometry(f),new THREE.MeshBasicMaterial({color:0xe78065,transparent:true,opacity:.4,depthWrite:false,side:THREE.DoubleSide}));scene.add(preview);host.dataset.previewKind='hole';$('hole-apply').disabled=false;}catch(e){$('hole-error').textContent=e.message;$('hole-apply').disabled=true;}}
for(const id of ['hole-diameter','hole-depth','hole-through'])$(id).addEventListener('input',()=>{$('hole-depth').disabled=$('hole-through').checked;if(holePlacement)updateHolePreview();});
$('hole-cancel').onclick=cancelHole;$('hole-panel').onsubmit=e=>{e.preventDefault();try{const f=holeFeature();setProject([...features,f]);cancelHole();selected=null;stage='model';syncFields();notify('指定した中心・直径で穴を開けました');}catch(e){$('hole-error').textContent=e.message;}};
document.addEventListener('click',e=>{if(holeActive&&e.target.closest('.toolbar, .command-toolbar')&&!e.target.closest('#cut-tool'))cancelHole();},{capture:true});
import {installDirectDimensionInput} from './direct-dimension-input.js';
boxSelection=installBoxSelection(renderer.domElement,host,{
 enabled:()=>!imageReferences?.picking&&!deletingSketch&&!moveTool?.active&&!sketch&&!holeActive&&!pendingExtrude&&!extrusionDrag&&!$('tools-dialog').open,
 getControls:()=>controls,
 onSelect:rect=>{
  down=null;hoverEdge=null;
  if(selectionMode==='body'){const ids=bodyDisplay?bodyDisplay.withDisplay(()=>rangeBodyIds(features,[...meshes.values()],camera,host.clientWidth,host.clientHeight,rect)):rangeBodyIds(features,[...meshes.values()],camera,host.clientWidth,host.clientHeight,rect);chooseBodyRange(ids,rect.add);return;}
  if(selectionMode==='edge'){const hits=rangeEdgeHits([...meshes.values()],camera,host.clientWidth,host.clientHeight,rect);if(!rect.add)clearEdgeSelection();for(const hit of hits)chooseEdgeHit(hit,true,false);return;}
  const hits=bodyDisplay?bodyDisplay.withDisplay(()=>rangeFaceHits(features,[...meshes.values()],camera,host.clientWidth,host.clientHeight,rect)):rangeFaceHits(features,[...meshes.values()],camera,host.clientWidth,host.clientHeight,rect);if(bodyDisplay?.exploded)for(const hit of hits)hit.point.sub(bodyDisplay.offset(hit.object.userData.bodyId));const sketchHits=rangeSketchHits(visibleSketchFeatures(),camera,host.clientWidth,host.clientHeight,rect);if(selectionMode==='auto'&&sketchHits.size&&(stage==='sketch'||!hits.length)){if(!rect.add){clearEdgeSelection();clearFaceSelection();selectedFace=null;selectedSurface=null;chosenRegion=null;}for(const [id,indices] of sketchHits){if(!selectedSketchSegments.has(id))selectedSketchSegments.set(id,new Set());for(const i of indices)selectedSketchSegments.get(id).add(i);}selected=null;dropPreview();showSketchSelection();return;}if(!rect.add)clearSketchSelection();
  if(!rect.add){clearEdgeSelection();clearFaceSelection();selectedFace=null;selectedSurface=null;chosenRegion=null;$('measurement').hidden=true;}
  chooseFaceRange(hits,rect.add);
  $('status').textContent=selectedFaces.length+' 面を選択 · 作成・修正 → プレス／プル';notify(selectedFaces.length?'範囲内の '+selectedFaces.length+' 面を選択しました':'選択範囲に対象の面がありません');
 }
});
moveTool=createMoveTool({getReferenceLines:()=>[...features.filter(f=>f.kind==='sketch'&&!f.groupHidden&&!f.arc&&!['point','circle','spline'].includes(f.profile)).flatMap(f=>sketchSegments(f).map(s=>({a:s.a.toArray(),b:s.b.toArray()}))),...hingeReferences(moveTool?.selectedBodyId).map(ref=>({a:ref.a,b:ref.b}))],getGridPlane:()=>({normal:basisFor({plane:gridPlane}).n.toArray(),offset:0}),getGridSnap:()=>({enabled:$('snap-enabled').checked&&gridVisibility[gridPlane]!==false,step:gridStep,plane:gridPlane}),scene,camera,canvas:renderer.domElement,host,getReferencePoints:()=>[...features.filter(f=>f.kind==='sketch'&&f.profile==='point'&&!f.groupHidden).map(f=>({point:[f.x,f.y,f.z],name:'スケッチ点',kind:'center'})),...hingeReferences(moveTool?.selectedBodyId).flatMap(ref=>ref.rimPoints.filter(rim=>meshes.get(rim.bodyId)?.visible||rim.bodyId===moveTool?.selectedBodyId).map(rim=>({point:rim.point,name:ref.name,kind:'center',bodyId:rim.bodyId,a:ref.a,b:ref.b})))],getMeshes:()=>[...meshes.values()],getControls:()=>controls,getSelectedEdge:()=>selectedEdge?{...selectedEdge,a:[...selectedEdge.a],b:[...selectedEdge.b]}:null,onStart:()=>{bodyDisplay?.stopExploded();finishSketch(false);cancelHole();clearEdgeSelection();selectedFace=null;selectedSurface=null;chosenRegion=null;pendingExtrude=false;stage='model';dropPreview();syncFields();$('measurement').hidden=true;},onApply:async spec=>{const result=await kernelClient.run(features,spec);setProject([...features,{kind:'cadop',id:crypto.randomUUID(),name:'移動／回転',spec,...result}]);selected=null;stage='model';syncFields();notify('ボディを移動／回転しました');}});
$('move-tool').onclick=()=>moveTool.start();
$('reference-plane').onchange=()=>{const value=$('reference-plane').value;moveTool?.cancel();finishSketch(false);cancelHole();clearEdgeSelection();selectedFace=null;selectedSurface=null;chosenRegion=null;selected=null;activeFrame=null;pendingExtrude=false;stage='model';gridPlane=value;gridVisibility[value]=true;dropPreview();fillForm({...defaults,plane:value,name:'スケッチ'});$('measurement').hidden=true;refreshGrid();notify('基準平面を '+value+' に切り替えました');};
installPatternPreview({scene,host,getMesh:id=>meshes.get(id)||sketchGroup.children.find(o=>o.userData.featureId===id),getSpec:patternSpec});

let joinAll=false;
function joinSelectedIds(){const ids=[...selectedBodies,...selectedFaces.map(f=>f.bodyId),...selectedEdges.map(f=>f.bodyId)];if(!ids.length)ids.push(selectedFace?.bodyId||selectedBody);return [...new Set(ids)].filter(id=>meshes.has(id));}
function openDirectCommand(type){if(editingSectionSplitId)sectionControl.cancel();editingEncloseId=null;editingPipeId=null;editingCoilJointId=null;$('cad-command').disabled=false;finishSketch(false);deletingSketch=false;joinAll=false;$('cad-command').value=type;renderCommand();openToolsDialog();}
$('join-tool').onclick=()=>openDirectCommand('join');$('split-tool').onclick=()=>openDirectCommand('split');
$('delete-line-tool').onclick=()=>{if(selectedSketchSegments.size){deleteSelectedSketches();return;}finishSketch(false);moveTool?.cancel();cancelHole();pendingExtrude=false;dropPreview();deletingSketch=!deletingSketch;$('delete-line-tool').setAttribute('aria-pressed',String(deletingSketch));notify(deletingSketch?'交点や角までの不要な線をクリックして削除 · Escで終了':'線分削除を終了しました');};
function eraseSketchAt(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);raycaster.setFromCamera(pointer,camera);raycaster.params.Line.threshold=viewHeight()/r.height*7;raycaster.params.Points.threshold=viewHeight()/r.height*7;const hit=raycaster.intersectObjects(sketchGroup.children,false)[0];if(!hit)return;const f=features.find(f=>f.id===hit.object.userData.featureId);if(!f)return;setProject(features.flatMap(x=>x.id===f.id?trimSketch(f,features,hit.point):[x]));selected=null;stage='model';syncFields();notify('スケッチの線を削除しました · 続けてクリック / Escで終了');}
document.addEventListener('click',e=>{if(e.target.closest('.toolbar, .command-toolbar')&&!e.target.closest('#delete-line-tool')){deletingSketch=false;closeSolidFaceMenu();$('delete-line-tool').setAttribute('aria-pressed','false');}});
function patternSpec(){const type=$('cad-command').value,p={type};for(const [key,value] of Object.entries(schemas[type]))p[key]=value==='body'||value==='sketch'||Array.isArray(value)?$('cad-'+key).value:Number($('cad-'+key).value);if(type==='circular'){if(p.center==='SELECTED'){if(!patternCenter)throw Error('中心を選択してください');p.origin=patternCenter.point;}else p.origin=[0,0,0];if(p.axis==='NORMAL'){if(!patternCenter)throw Error('中心を選択してください');p.axisVector=patternCenter.normal;}}return p;}
const bodyNames=document.createElement('div');bodyNames.id='join-body-names';bodyNames.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:7;overflow:hidden';host.append(bodyNames);
function updateBodyNames(){const visible=$('tools-dialog').open||$('template-dialog')?.open;bodyNames.hidden=!visible;if(visible){const entries=[...meshes].filter(([,m])=>m.visible);while(bodyNames.children.length>entries.length)bodyNames.lastChild.remove();entries.forEach(([id,m],i)=>{let el=bodyNames.children[i];if(!el){el=document.createElement('span');el.style.cssText='position:absolute;transform:translate(-50%,-50%);background:white;color:#16364d;border:1px solid #226a9a;border-radius:4px;padding:4px 7px;font:600 14px sans-serif;white-space:nowrap';bodyNames.append(el);}el.textContent=bodyDisplayName(id);const active=$('template-dialog')?.open&&$('template-body').value===id;el.style.background=active?'#d9efff':'white';el.style.borderColor=active?'#008bd2':'#226a9a';el.style.boxShadow=active?'0 0 0 2px #008bd244':'none';const p=new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).project(camera);el.hidden=p.z< -1||p.z>1;el.style.left=(p.x+1)*host.clientWidth/2+'px';el.style.top=(1-p.y)*host.clientHeight/2+'px';});}}
function bodyDisplayName(id){const joint=features.findLast(f=>f.kind==='cadop'&&f.spec?.type==='coilJoint'&&f.outputs?.some(o=>o.id===id));return (joint?(id===joint.spec.target?'コイル接合 本体':'コイル接合 蓋'):(features.find(f=>f.id===id)?.name||'ボディ'))+'（'+([...meshes.keys()].indexOf(id)+1)+'）';}

function clearSketchSelection(){selectedSketchSegments.clear();if(sketchSelectionHighlight){disposeObject(sketchSelectionHighlight);sketchSelectionHighlight=null;}host.dataset.selectedSketchCount='0';}
function showSketchSelection(){if(sketchSelectionHighlight)disposeObject(sketchSelectionHighlight);const points=[],selectedPoints=[];let length=0,approximate=false;for(const f of features){const indices=selectedSketchSegments.get(f.id);if(!indices)continue;if(f.profile==='point'){selectedPoints.push(new THREE.Vector3(f.x,f.y,f.z));continue;}const edges=sketchSegments(f);let subtotal=0;for(const edge of edges)if(indices.has(edge.index)){points.push(edge.a,edge.b);subtotal+=edge.a.distanceTo(edge.b);}if(f.profile==='circle'&&indices.size===edges.length)subtotal=Math.PI*f.diameter;else if(f.profile==='spline'||f.arc)approximate=true;length+=subtotal;}sketchSelectionHighlight=sketchLine(new THREE.BufferGeometry().setFromPoints(points),{color:0xf18b13,depthTest:false,order:9,segments:true});sketchSelectionHighlight.renderOrder=9;if(selectedPoints.length){const marks=new THREE.Points(new THREE.BufferGeometry().setFromPoints(selectedPoints),roundPointMaterial({color:0xf18b13,size:13,sizeAttenuation:false,depthTest:false}));marks.renderOrder=10;sketchSelectionHighlight.add(marks);}scene.add(sketchSelectionHighlight);host.dataset.selectedSketchCount=String(points.length/2+selectedPoints.length);$('measurement').hidden=!points.length&&!selectedPoints.length;$('measurement-title').textContent=selectedSketchSegments.size>1?'選択したスケッチの合計長さ':'選択したスケッチの長さ';$('measurement-length').textContent=(approximate?'約 ':'')+fmt(length)+' mm';$('measurement-angle').textContent='線分削除 / 選択した辺をオフセット';if(selectedPoints.length){$('measurement-title').textContent='スケッチの選択';$('measurement-length').textContent=selectedPoints.length+' 点'+(points.length?' / 線 '+fmt(length)+' mm':'');$('measurement-angle').textContent='Deleteキー / 線分削除で削除';}$('status').textContent='スケッチを選択しました · Ctrl＋ドラッグで追加 / Escで解除';}
function deleteSelectedSketches(){finishSketch(false);const next=deleteSketchSelection(features,selectedSketchSegments);setProject(next);selected=null;stage='model';dropPreview();syncFields();notify('選択したスケッチの線・点を削除しました');}
window.addEventListener('keydown',e=>{if(e.key==='Delete'&&selectedSketchSegments.size&&!e.target.matches('input,textarea,select')&&!$('tools-dialog').open){e.preventDefault();deleteSelectedSketches();}});

$('viewport-combine').onchange=()=>{updatePreview();updateExtrusionOverlay();};

$('shell-tool').onclick=()=>openDirectCommand('shell');

import {draggablePanel,cancelPanelDrags} from './draggable-panel.js';
for(const [id,title] of [['extrude-distance','押し出し'],['hole-panel','穴あけ'],['line-dimensions','線分'],['circle-dimensions','円'],['move-panel','移動／回転']])draggablePanel($(id),title,{topMargin:()=>id==='extrude-distance'?extrusionWheel.element.offsetHeight+16:0,resetOnHide:id==='extrude-distance'});

import {installCombinePreview} from './combine-preview.js';
installCombinePreview({scene,host,getMesh:id=>meshes.get(id),getSelectedIds:joinSelectedIds,computeClearancePreview:spec=>kernelClient.run(features,{type:'preview',operation:spec})});

import {fitCommandToolbar} from './command-toolbar.js';
for(const button of document.querySelectorAll('[data-direct-command]'))button.onclick=()=>openDirectCommand(button.dataset.directCommand);
fitCommandToolbar(document.querySelector('.command-toolbar'));

// Preload after the initial screen has rendered, without blocking interaction.
warmKernelOnInteraction(kernelClient);

const extrusionWheel=createExtrusionWheel(host.parentElement,value=>{$('viewport-operation').value=value;$('viewport-operation').dispatchEvent(new Event('change',{bubbles:true}));});
function syncViewportOperation(){
 if($('viewport-operation').value!==$('operation').value)$('viewport-operation').value=$('operation').value;
 const source=$('target'),target=$('viewport-target');
 if(target.innerHTML!==source.innerHTML)target.innerHTML=source.innerHTML;
 if(target.value!==source.value)target.value=source.value;$('viewport-target-label').hidden=['new','newHoles'].includes($('operation').value);
 for(const option of $('viewport-operation').options)if(['join','cut'].includes(option.value)){const disabled=!source.options.length;if(option.disabled!==disabled)option.disabled=disabled;}
 const holesProblem=syncHolesOnlyOptions();
 extrusionWheel.update($('operation').value,{hasTarget:!!source.options.length,busy:extrusionBusy,holesProblem});
}
$('viewport-operation').onchange=()=>{extrusionManualOperation=true;$('operation').value=$('viewport-operation').value;$('operation').dispatchEvent(new Event('input',{bubbles:true}));syncViewportOperation();};
$('viewport-target').onchange=()=>{extrusionManualOperation=true;$('target').value=$('viewport-target').value;$('target').dispatchEvent(new Event('input',{bubbles:true}));};

let rectDimensionLocks=[false,false];
function updateSketchDimensions(){
 const profile=$('profile').value,visible=sketch&&firstPoint&&!arcDrag&&['line','rect'].includes(profile);document.querySelector('#sketch-banner .continuous-label').hidden=profile!=='line';
 $('sketch-dimensions').hidden=!visible;$('center-rectangle-guides').toggleAttribute('hidden',!(visible&&profile==='rect'&&centerRectangle));$('center-rectangle-origin').toggleAttribute('hidden',!(visible&&profile==='rect'&&centerRectangle));if(!visible)return;
 let end;try{end=constrainedPoint(lastDrawPoint||firstPoint.clone().addScaledVector(sketchBasis.u,30).addScaledVector(sketchBasis.v,20));}catch{return;}
 const drawingStart=$('profile').value==='rect'&&centerRectangle?firstPoint.clone().multiplyScalar(2).sub(end):firstPoint;
 const start=screenPoint(drawingStart),finish=screenPoint(end),delta=end.clone().sub(firstPoint),du=delta.dot(sketchBasis.u),dv=delta.dot(sketchBasis.v);
 const rect=profile==='rect',values=rect?[Math.abs(du)*(centerRectangle?2:1),Math.abs(dv)*(centerRectangle?2:1)]:[delta.length(),Math.atan2(dv,du)*180/Math.PI];
 const corner=screenPoint(drawingStart.clone().addScaledVector(sketchBasis.u,du*(rect&&centerRectangle?2:1)));
 const points=rect?[start,corner,finish,screenPoint(drawingStart.clone().addScaledVector(sketchBasis.v,dv*(centerRectangle?2:1))),start]:[start,finish];const sizes=[0,1].map(i=>{const f=$('sketch-dim-'+i).parentElement;return {width:f.offsetWidth,height:f.offsetHeight};});const positions=dimensionPositions(points,sizes,host.clientWidth,host.clientHeight);
 for(let i=0;i<2;i++){const input=$('sketch-dim-'+i),locked=rect?rectDimensionLocks[i]:$(i?'lock-angle':'lock-length').checked;
 $('sketch-dim-label-'+i).textContent=rect?(i?'高さ mm':'幅 mm'):(i?'角度 °':'長さ mm');
 if(document.activeElement!==input&&!locked)input.value=Number(values[i].toFixed(2));
 const field=input.parentElement;const active=document.activeElement;const waiting=active===input||(i===0&&!active?.matches('input,textarea,select'));field.classList.toggle('input-ready',waiting);field.classList.toggle('locked',locked);field.style.left=positions[i][0]+'px';field.style.top=positions[i][1]+'px';}
 if(rect&&centerRectangle){const center=screenPoint(firstPoint),other=points[3];$('center-rectangle-guides').setAttribute('d','M'+start.x+','+start.y+'L'+finish.x+','+finish.y+'M'+corner.x+','+corner.y+'L'+other.x+','+other.y);$('center-rectangle-origin').setAttribute('cx',center.x);$('center-rectangle-origin').setAttribute('cy',center.y);}
 $('sketch-dim-guides').setAttribute('d',rect?'M'+start.x+','+start.y+'L'+corner.x+','+corner.y+'L'+finish.x+','+finish.y:'M'+start.x+','+start.y+'L'+finish.x+','+finish.y);
}
for(let i=0;i<2;i++){const input=$('sketch-dim-'+i);input.addEventListener('input',()=>{if($('profile').value==='rect')rectDimensionLocks[i]=true;else{const target=$(i?'live-angle':'live-length');target.value=input.value;$(i?'lock-angle':'lock-length').checked=true;}if(firstPoint)previewEndpoint(lastDrawPoint||firstPoint.clone().addScaledVector(sketchBasis.u,30).addScaledVector(sketchBasis.v,20));});input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();if(firstPoint)placeEndpoint(lastDrawPoint||firstPoint.clone().addScaledVector(sketchBasis.u,30).addScaledVector(sketchBasis.v,20));}});}

// Keep the line-mode toggle without the duplicate dimensions panel.
$('sketch-banner').append(document.querySelector('#line-dimensions .continuous-label'));

function pickSketchEdge(event){const bounds=renderer.domElement.getBoundingClientRect(),x=event.clientX-bounds.left,y=event.clientY-bounds.top;let best=null,distance=8;for(const f of features.filter(f=>f.kind==='sketch'&&!f.groupHidden))for(const edge of sketchSegments(f)){const a=screenPoint(edge.a),b=screenPoint(edge.b),dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(x-a.x-t*dx,y-a.y-t*dy);if(a.z>=-1&&a.z<=1&&d<distance){distance=d;best={f,edge};}}if(!best)return false;if(!event.ctrlKey&&!event.metaKey){clearEdgeSelection();clearFaceSelection();}const {f,edge}=best,indices=(['circle','spline'].includes(f.profile)||f.arc)?sketchSegments(f).map(e=>e.index):[edge.index];let chosen=selectedSketchSegments.get(f.id)||new Set();const remove=indices.every(i=>chosen.has(i));for(const i of indices)remove?chosen.delete(i):chosen.add(i);if(chosen.size)selectedSketchSegments.set(f.id,chosen);else selectedSketchSegments.delete(f.id);selected=null;selectedFace=null;selectedSurface=null;chosenRegion=null;dropPreview();showSketchSelection();return true;}
function selectedSketchAt(event){
 const bounds=renderer.domElement.getBoundingClientRect(),x=event.clientX-bounds.left,y=event.clientY-bounds.top;
 const candidates=new Map(selectedSketchSegments),selectedFeature=features.find(f=>f.id===selected&&f.kind==='sketch'&&!f.groupHidden);
 if(selectedFeature&&!candidates.has(selectedFeature.id))candidates.set(selectedFeature.id,new Set(sketchSegments(selectedFeature).map(edge=>edge.index)));
 let best=null,distance=12;
 for(const [id,indices] of candidates){
  const f=features.find(item=>item.id===id&&item.kind==='sketch'&&!item.groupHidden);if(!f)continue;
  for(const edge of sketchSegments(f)){if(!indices.has(edge.index))continue;
   const a=screenPoint(edge.a),b=screenPoint(edge.b);if(a.z<-1||a.z>1||b.z<-1||b.z>1)continue;
   const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(x-a.x-t*dx,y-a.y-t*dy);
   if(d<distance){distance=d;best=f;}
  }
 }
 return best;
}
function closeSolidFaceMenu(restoreFocus=false){const menu=$('solid-face-menu');if(!menu)return;const focused=menu.contains(document.activeElement);menu.remove();if(restoreFocus&&focused)renderer.domElement.focus();}
function openSolidFaceMenu(event){
 closeSolidFaceMenu();$('sketch-group-menu')?.remove();
 if(!canResumeSelectedSketch()||stage==='extrusion'||oppositePlaneBusy)return false;
 const r=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2);raycaster.setFromCamera(pointer,camera);
 const hit=raycaster.intersectObjects([...meshes.values()].filter(mesh=>mesh.visible),false)[0];if(!hit)return false;
 clearBodySelection();chooseFace(hit);if(!selectedFace?.bodyId)return false;
 const menu=document.createElement('div');menu.id='solid-face-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','選択したソリッド平面の操作');
 const title=document.createElement('div');title.className='solid-face-menu-title';title.textContent='選択したソリッドの平面';
 const button=document.createElement('button');button.id='context-opposite-face-ground';button.type='button';button.setAttribute('role','menuitem');button.textContent='反対面をXYに接地';button.title=oppositePlaneButton.title;button.onclick=groundOppositeFace;
 menu.append(title,button);document.body.append(menu);const bounds=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(event.clientX,innerWidth-bounds.width-8))+'px';menu.style.top=Math.max(8,Math.min(event.clientY,innerHeight-bounds.height-8))+'px';button.focus();return true;
}
function canResumeSelectedSketch(){return !sketch&&!deletingSketch&&!moveTool?.active&&!holeActive&&!pendingExtrude&&!imageReferences?.picking&&!document.querySelector('dialog[open]');}
function openSketchResumeMenu(event,f){
 $('sketch-group-menu')?.remove();
 const menu=document.createElement('button');menu.id='sketch-group-menu';menu.type='button';menu.textContent='このスケッチグループを続きから描く';
 Object.assign(menu.style,{position:'fixed',left:Math.max(0,Math.min(event.clientX,innerWidth-280))+'px',top:Math.max(0,Math.min(event.clientY,innerHeight-52))+'px',zIndex:1000,background:'white',color:'#173a4f',padding:'10px 16px',border:'1px solid #84aabd',borderRadius:'6px',boxShadow:'0 4px 14px #173a4f33'});
 menu.onclick=()=>{menu.remove();editSketchGroup(f.groupId);$('new-line').click();$('status').textContent='スケッチ'+f.groupNumber+' に線を追加します。新しい始点をクリックしてください';};
 menu.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();menu.remove();}};
 document.body.append(menu);menu.focus();
}
let sketchRightDown=null;
function faceMenuPointerTarget(event){return event.target===renderer.domElement||!!event.target.closest?.('.center-marker');}
document.addEventListener('pointerdown',e=>{if(e.button===2&&faceMenuPointerTarget(e))sketchRightDown={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,menuOpen:!!($('solid-face-menu')||$('sketch-group-menu'))};},{capture:true});
document.addEventListener('pointermove',e=>{if(e.pointerId===sketchRightDown?.id&&Math.hypot(e.clientX-sketchRightDown.x,e.clientY-sketchRightDown.y)>5)sketchRightDown.moved=true;},{capture:true});
document.addEventListener('pointerup',e=>{
 if(e.button!==2||e.pointerId!==sketchRightDown?.id)return;
 const menuOpen=sketchRightDown.menuOpen,moved=sketchRightDown.moved||Math.hypot(e.clientX-sketchRightDown.x,e.clientY-sketchRightDown.y)>5;sketchRightDown=null;if(moved)return;
 e.preventDefault();
 if(canResumeSelectedSketch()){
  const f=selectedSketchAt(e);if(f){closeSolidFaceMenu();openSketchResumeMenu(e,f);return;}
  if(openSolidFaceMenu(e))return;
 }
 if(menuOpen)return; // The pointerdown listener already dismissed the menu, as Escape does.
 // Share the Escape action without changing the keyboard's pressed/keyup state.
 queueMicrotask(performToolEscape);
},{capture:true});
document.addEventListener('contextmenu',e=>{if(faceMenuPointerTarget(e))e.preventDefault();});
for(const type of ['pointercancel','lostpointercapture'])document.addEventListener(type,e=>{if(e.pointerId===sketchRightDown?.id)sketchRightDown=null;});
window.addEventListener('blur',()=>{sketchRightDown=null;});
$('select-sketch-edge').onclick=()=>{finishSketch(false);stage='sketch';selected=null;dropPreview();syncFields();$('status').textContent='スケッチの線や点をクリック · Ctrl＋クリックで複数選択';};

let arcDrag=null,arcPreview=null;
function clearArcDrag(){if(arcPreview){disposeObject(arcPreview);arcPreview=null;}arcDrag=null;delete host.dataset.arcPreview;}
function startArcDrag(e){if(e.button!==0||!sketch||!firstPoint||$('profile').value!=='line')return;const rect=host.getBoundingClientRect(),p=screenPoint(firstPoint);if(Math.hypot(e.clientX-rect.left-p.x,e.clientY-rect.top-p.y)>12)return;let tangent=[1,0];for(const f of [...features].reverse()){if(f.kind!=='sketch'||f.groupHidden)continue;const edges=sketchSegments(f),last=edges.at(-1),first=edges[0];if(last&&last.b.distanceTo(firstPoint)<1e-5){const d=last.b.clone().sub(last.a);tangent=f.arc?.endTangent||[d.dot(sketchBasis.u),d.dot(sketchBasis.v)];break;}if(first&&first.a.distanceTo(firstPoint)<1e-5){const d=first.a.clone().sub(first.b);tangent=[d.dot(sketchBasis.u),d.dot(sketchBasis.v)];break;}}const candidates=[];for(const f of features.filter(f=>f.kind==='sketch'&&!f.groupHidden))for(const edge of sketchSegments(f)){let d;if(edge.a.distanceTo(firstPoint)<1e-5)d=edge.a.clone().sub(edge.b);else if(edge.b.distanceTo(firstPoint)<1e-5)d=edge.b.clone().sub(edge.a);if(d){const t=[d.dot(sketchBasis.u),d.dot(sketchBasis.v)],length=Math.hypot(...t);if(length>1e-7)candidates.push(t.map(v=>v/length));}}arcDrag={start:firstPoint.clone(),tangent,candidates,x:e.clientX,y:e.clientY,moved:false,result:null};renderer.domElement.setPointerCapture(e.pointerId);}
function updateArcDrag(e){if(!arcDrag)return;if(Math.hypot(e.clientX-arcDrag.x,e.clientY-arcDrag.y)<5&&!arcDrag.moved)return;arcDrag.moved=true;const hit=planePoint(e);if(!hit)return;const uv=p=>[p.dot(sketchBasis.u),p.dot(sketchBasis.v)];if(!arcDrag.sideChosen){const d=hit.clone().sub(arcDrag.start);if(arcDrag.candidates.length){const uv=[d.dot(sketchBasis.u),d.dot(sketchBasis.v)];arcDrag.tangent=arcDrag.candidates.reduce((best,t)=>Math.abs(t[0]*uv[0]+t[1]*uv[1])>Math.abs(best[0]*uv[0]+best[1]*uv[1])?t:best,arcDrag.candidates[0]);}const t=sketchBasis.u.clone().multiplyScalar(arcDrag.tangent[0]).addScaledVector(sketchBasis.v,arcDrag.tangent[1]).normalize(),along=d.dot(t);if(Math.abs(along)>viewHeight()/host.clientHeight*5){if(along<0)arcDrag.tangent=arcDrag.tangent.map(v=>-v);arcDrag.sideChosen=true;}}const arc=tangentArc(uv(arcDrag.start),uv(hit),arcDrag.tangent);arcDrag.result=arc;arcDrag.end=hit.clone();dropPreview();if(arcPreview){disposeObject(arcPreview);arcPreview=null;}if(!arc){$('status').textContent='円弧になる方向へドラッグしてください';return;}const offset=sketchOrigin.dot(sketchBasis.n),points=arc.points.map(p=>sketchBasis.u.clone().multiplyScalar(p[0]).addScaledVector(sketchBasis.v,p[1]).addScaledVector(sketchBasis.n,offset));arcPreview=sketchLine(new THREE.BufferGeometry().setFromPoints(points),{color:0x087ca5,depthTest:false,order:10});arcPreview.renderOrder=10;scene.add(arcPreview);host.dataset.arcPreview='true';showSnap(hit);$('status').textContent='接線円弧 · 半径 '+fmt(arc.radius)+' mm · 離して確定 / Escで中止';}
function commitArcDrag(e){updateArcDrag(e);const drag=arcDrag;if(!drag?.result){clearArcDrag();return;}const arc=drag.result,end=drag.end.clone(),f={...current(),id:crypto.randomUUID(),name:'接線円弧',kind:'sketch',profile:'polyline',points:arc.points,closed:false,arc:{endTangent:arc.endTangent},x:sketchOrigin.x,y:sketchOrigin.y,z:sketchOrigin.z};try{setProject([...features,f]);clearArcDrag();firstPoint=end;lastDrawPoint=null;chainCount++;draftTouched=false;dropPreview();$('lock-length').checked=false;$('lock-angle').checked=false;sketchMarker?.position.copy(end);if(!$('continuous-line').checked||(chainCount>=3&&chainStart?.distanceTo(end)<1e-5))finishSketch(false);$('status').textContent='円弧を追加しました · 続けてクリックで線分 / 終点からドラッグで円弧';}catch(error){clearArcDrag();notify(error.message);}}
renderer.domElement.addEventListener('pointercancel',()=>clearArcDrag());

function selectedMirrorPlane(kind){if(kind==='FACE'){if(!selectedFace)throw Error('基準にするソリッドの平面を先に選択してください');const n=basisFor(selectedFace).n;return {mirrorNormal:n.toArray(),mirrorOrigin:n.multiplyScalar(selectedFace.offset).toArray()};}
 let a,b,n;if(selectedEdge){if(selectedEdge.circle||selectedEdge.arc)throw Error('円周・円弧ではなく直線の辺を選択してください');a=new THREE.Vector3(...selectedEdge.a);b=new THREE.Vector3(...selectedEdge.b);n=basisFor({plane:gridPlane}).n;}else{const entries=[...selectedSketchSegments];if(entries.length!==1||entries[0][1].size!==1)throw Error('基準にする直線を1本選択してください');const f=features.find(f=>f.id===entries[0][0]);if(!f||f.arc||['circle','spline'].includes(f.profile))throw Error('基準にする直線を選択してください');const edge=sketchSegments(f).find(e=>entries[0][1].has(e.index));a=edge.a;b=edge.b;n=basisFor(f).n;}
 const normal=b.clone().sub(a).cross(n);if(normal.length()<1e-7)throw Error('辺が基準平面に垂直です。右上の基準平面を切り替えてください');return {mirrorNormal:normal.normalize().toArray(),mirrorOrigin:a.toArray()};}

$('new-polygon').onclick=()=>{startFeature('circle','solid');$('draw').click();polygonMode=true;circleDiameterLocked=false;$('polygon-radius').value=15;notify('中心、頂点の順にクリック · 半径と辺の数を入力 / Tabで切替 / Enterで確定');};
$('polygon-radius').addEventListener('input',()=>{circleDiameterLocked=true;previewCircleInput();});
$('polygon-sides').addEventListener('input',()=>{if(firstPoint)previewCircleInput();});
$('polygon-dimensions').onsubmit=e=>{e.preventDefault();if(firstPoint)placeEndpoint(lastDrawPoint||firstPoint.clone().addScaledVector(sketchBasis.u,Number($('polygon-radius').value)));};

function visibleSketchFeatures(){return features.filter(f=>f.kind!=='sketch'||!f.groupHidden);}
function assignSketchGroups(next){
 let number=Math.max(0,...features.map(f=>f.groupNumber||0),...next.map(f=>f.groupNumber||0));
 let ref=next.find(f=>f.groupId===activeSketchGroup)||features.find(f=>f.groupId===activeSketchGroup);
 return next.map(f=>{
  if(f.kind!=='sketch')return f;
  if(f.groupId)return f;
  const old=features.find(x=>x.id===f.id);
  if(old?.groupId)return {...f,groupId:old.groupId,groupNumber:old.groupNumber,groupHidden:old.groupHidden};
  const same=ref&&!ref.groupHidden&&basisFor(ref).n.distanceTo(basisFor(f).n)<1e-5&&Math.abs(planeCoordinates(ref).offset-planeCoordinates(f).offset)<1e-5;
  const result={...f,groupId:same?ref.groupId:crypto.randomUUID(),groupNumber:same?ref.groupNumber:++number,groupHidden:false};
  ref=result;activeSketchGroup=result.groupId;return result;
 });
}
function renderSketchGroups(){const groups=new Map();for(const f of features.filter(f=>f.kind==='sketch')){if(!groups.has(f.groupId))groups.set(f.groupId,[]);groups.get(f.groupId).push(f);}$('sketch-count').textContent=groups.size;for(const [id,members] of groups){const f=members[0],row=document.createElement('div');row.className='tree-row';row.dataset.sketchGroup=id;const label=document.createElement('button');label.className='row-label';label.textContent='╱ スケッチ'+f.groupNumber;label.onclick=()=>editSketchGroup(id);const eye=document.createElement('button');eye.className='eye';eye.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'+(f.groupHidden?'<path d="m3 3 18 18"/>':'')+'</svg>';eye.setAttribute('aria-pressed',String(!f.groupHidden));eye.title=f.groupHidden?'スケッチを表示':'スケッチを非表示';eye.setAttribute('aria-label',eye.title);eye.onclick=()=>{finishSketch(false);dropPreview();if(!f.groupHidden&&activeSketchGroup===id){activeSketchGroup=null;editingSketchGroup=null;selected=null;stage='model';draftTouched=false;syncFields();}setProject(features.map(x=>x.groupId===id?{...x,groupHidden:!f.groupHidden}:x));};row.append(label,eye);row.oncontextmenu=e=>{e.preventDefault();document.getElementById('sketch-group-menu')?.remove();const menu=document.createElement('button');menu.id='sketch-group-menu';menu.textContent='再編集';Object.assign(menu.style,{position:'fixed',left:Math.min(e.clientX,innerWidth-140)+'px',top:Math.min(e.clientY,innerHeight-50)+'px',zIndex:1000,background:'white',color:'#173a4f',padding:'10px 24px',border:'1px solid #84aabd',borderRadius:'6px'});menu.onclick=()=>{menu.remove();editSketchGroup(id);};document.body.append(menu);};$('sketches').append(row);if(editingSketchGroup===id&&stage==='sketch')for(const [i,member] of members.entries()){const child=document.createElement('button');child.className='row-label sketch-member';child.textContent='　'+(i+1)+'. '+member.name;child.onclick=()=>selectFeature(member.id);$('sketches').append(child);}}}
function editSketchGroup(id){const first=features.find(f=>f.groupId===id);if(!first)return;finishSketch(false);activeSketchGroup=id;editingSketchGroup=id;if(first.groupHidden)setProject(features.map(f=>f.groupId===id?{...f,groupHidden:false}:f));selectFeature(first.id);renderTree();$('status').textContent='スケッチ'+first.groupNumber+' を編集中 · 一覧から線を選んで寸法変更、作図ツールで追加';}
document.addEventListener('pointerdown',e=>{const faceMenu=$('solid-face-menu');if(faceMenu&&!faceMenu.contains(e.target))closeSolidFaceMenu();const menu=$('sketch-group-menu');if(menu&&!menu.contains(e.target))menu.remove();});

function openToolsDialog(){bodyDisplay?.stopExploded();finishSketch(false);deletingSketch=false;cancelHole();pendingExtrude=false;dropPreview();$('tools-dialog').show();}
function pickCommandReference(e){clearMachiningPreview();if($('cad-command').value==='enclose'){pickEncloseFace(e);return;}if($('cad-command').value==='trimSurface'){if($('cad-apply').disabled)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects([...meshes.values()].filter(m=>m.visible),false)[0];if(hit){const target=$('cad-target').value;chooseFace(hit);trimWall={bodyId:hit.object.userData.bodyId,point:hit.point.toArray(),normal:hit.face.normal.toArray()};$('cad-target').value=target;trimWallStatus();updateTrimArrow();$('cad-error').textContent='';scheduleMachiningPreview();}return;}if($('cad-command').value==='pipe'){if(pickSketchEdge(e)){const id=[...selectedSketchSegments.keys()].at(-1);if(id){$('cad-path').value=id;$('cad-path').dispatchEvent(new Event('input',{bubbles:true}));}}return;}if($('cad-command').value==='loft'){pickLoftSection(e);return;}
 if($('cad-command').value==='revolve'){pickRevolveReference(e);return;}
 if($('cad-apply').disabled)return;
 const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);raycaster.setFromCamera(pointer,camera);
 const hit=raycaster.intersectObjects([...meshes.values()].filter(m=>m.visible),false)[0];
 let kind=null;
 if(pickBodyEdge(e))kind='LINE';
 else if(!hit&&pickSketchEdge(e))kind='LINE';
 else if(hit){chooseFace(hit,e.ctrlKey||e.metaKey);kind=selectedFace?'FACE':null;}
 else return;
 const type=$('cad-command').value;
 if(type==='mirror'&&kind){$('cad-plane').value=kind;$('cad-plane').dispatchEvent(new Event('input',{bubbles:true}));}
 if(['split','offset'].includes(type)&&kind==='FACE')$('cad-plane').value='SELECTED';
 if(type!=='mirror'&&$('cad-target')&&selectedBody)$('cad-target').value=selectedBody;
 $('cad-error').textContent='';
 $('cad-fields').dispatchEvent(new Event('input',{bubbles:true}));
}
window.addEventListener('keydown',e=>{if(!$('tools-dialog').open)return;if(!e.target.matches('input,textarea,select')&&['e','l','z','y'].includes(e.key.toLowerCase()))e.stopImmediatePropagation();},{capture:true});

function visibilityIcon(hidden){return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'+(hidden?'<path d="m3 3 18 18"/>':'')+'</svg>';}
function renderRevolve(){
 revolveRegion=chosenRegion?clone(chosenRegion):null;revolveEdge=selectedEdge&&!selectedEdge.circle&&!selectedEdge.arc?{a:selectedEdge.a,b:selectedEdge.b}:null;revolvePicking=revolveRegion?'axis':'profile';
 $('cad-fields').innerHTML='<label>回転の対象<select id="revolve-kind"><option value="profile">領域・面</option><option value="body">ボディ</option></select></label><label id="revolve-body-label" hidden>回転するボディ<select id="revolve-body"></select></label><button type="button" id="revolve-pick-profile">領域を画面で選択</button><label>プロファイル<select id="revolve-profile"><option value="">領域を選択</option></select></label><button type="button" id="revolve-pick-axis">軸を画面で選択</button><label>回転軸<select id="revolve-axis"><option value="SELECTED">選択した直線・辺</option><option>X</option><option>Y</option><option>Z</option></select></label><small id="revolve-axis-status">軸は未選択</small><label>角度 (°)<input id="revolve-angle" type="number" min="0.01" max="360" step="any" value="360" required></label><label>方向<select id="revolve-direction"><option>片側</option><option>逆方向</option><option>対称</option></select></label><label>操作<select id="revolve-operation"><option value="new">新規ボディ</option><option value="join">結合</option><option value="cut">切り取り</option></select></label><label id="revolve-target-label" hidden>対象ボディ<select id="revolve-target"></select></label>';
 const regions=[...regionList];if(revolveRegion&&!regions.some(r=>r.id===revolveRegion.id))regions.push(revolveRegion);
 for(const [i,r] of regions.entries())$('revolve-profile').add(new Option((i+1)+'. '+r.plane+' / '+fmt(r.area)+' mm²',r.id));
 if(revolveRegion)$('revolve-profile').value=revolveRegion.id;
 for(const [id] of meshes){$('revolve-target').add(new Option(bodyDisplayName(id),id));$('revolve-body').add(new Option(bodyDisplayName(id),id));}if(selectedBody)$('revolve-body').value=selectedBody;
 $('revolve-kind').onchange=()=>{const body=$('revolve-kind').value==='body';$('revolve-body-label').hidden=!body;$('revolve-profile').parentElement.hidden=body;$('revolve-pick-profile').textContent=body?'ボディを画面で選択':'領域を画面で選択';$('revolve-operation').replaceChildren(...([['new','新規ボディ'],['join','結合'],['cut','切り取り']]).map(([v,t])=>new Option(t,v)));$('revolve-direction').replaceChildren(...(['片側','逆方向','対称']).map(v=>new Option(v,v)));$('revolve-angle').value='360';if(body&&$('revolve-body').value)$('revolve-target').value=$('revolve-body').value;revolvePicking='profile';$('cad-help').textContent=body?'ボディが回転して通る範囲をソリッドにします。X・Y・Zは原点を通る軸です。':'閉じた領域または平面を回転して立体を作成します';scheduleRevolve();};
 $('revolve-profile').onchange=()=>{revolveRegion=clone(regions.find(r=>r.id===$('revolve-profile').value)||null);scheduleRevolve();};
 $('revolve-pick-profile').onclick=()=>{revolvePicking='profile';$('cad-help').textContent=$('revolve-kind').value==='body'?'回転させるボディをクリックしてください':'回転させる閉じたスケッチ領域、またはソリッドの平面をクリックしてください';};
 $('revolve-pick-axis').onclick=()=>{revolvePicking='axis';$('cad-help').textContent='回転軸にするスケッチの直線、またはソリッドの直線の辺をクリックしてください';};
 if(revolveEdge)$('revolve-axis-status').textContent='直線の軸を選択済み';
}
function revolveSpec(){
 const body=$('revolve-kind').value==='body';if(body&&!$('revolve-body').value)throw Error('回転させるボディを選択してください');if(!body&&!revolveRegion)throw Error('回転させる領域を選択してください');
 const type=$('revolve-axis').value,n=body?new THREE.Vector3():basisFor(revolveRegion).n;let origin,axis;
 if(type==='SELECTED'){if(!revolveEdge)throw Error('回転軸にする直線・辺を選択してください');origin=new THREE.Vector3(...revolveEdge.a);axis=new THREE.Vector3(...revolveEdge.b).sub(origin).normalize();}
 else{origin=body?new THREE.Vector3():n.clone().multiplyScalar(revolveRegion.offset);axis=new THREE.Vector3(...{X:[1,0,0],Y:[0,1,0],Z:[0,0,1]}[type]);}
 return {type:'revolve',sourceBody:body?$('revolve-body').value:undefined,bodySweep:body,region:body?undefined:clone(revolveRegion),origin:origin.toArray(),axisVector:axis.toArray(),angle:Number($('revolve-angle').value),direction:$('revolve-direction').value,operation:$('revolve-operation').value,target:$('revolve-target').value};
}
function pickRevolveReference(e){
 if($('cad-apply').disabled)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);raycaster.setFromCamera(pointer,camera);
 if(revolvePicking==='profile'&&$('revolve-kind').value==='body'){const hit=raycaster.intersectObjects([...meshes.values()].filter(m=>m.visible),false)[0];if(!hit)return;$('revolve-body').value=hit.object.userData.bodyId;revolvePicking='axis';$('cad-help').textContent=bodyDisplayName(hit.object.userData.bodyId)+' を選択しました。回転軸を指定してください';scheduleRevolve();return;}
 if(revolvePicking==='profile'){
 const hit=raycaster.intersectObjects(regionGroup.children.filter(m=>m.userData.region),false)[0];
 if(hit)revolveRegion=clone(hit.object.userData.region);else{const solid=raycaster.intersectObjects([...meshes.values()].filter(m=>m.visible),false)[0];if(!solid)return;try{revolveRegion={...planarFace(solid.object.geometry,solid.faceIndex),bodyId:solid.object.userData.bodyId,id:'solid-profile'};}catch{notify('閉じた領域または平面を選択してください');return;}}
 const select=$('revolve-profile');if(![...select.options].some(o=>o.value===revolveRegion.id))select.add(new Option('選択した平面',revolveRegion.id));select.value=revolveRegion.id;revolvePicking='axis';$('cad-help').textContent='領域を選択しました。軸の直線をクリックするか、X・Y・Zを指定してください';
 }else{
 const edge=findScreenEdge(e);if(edge&&!edge.circle&&!edge.arc)revolveEdge={a:edge.a.toArray(),b:edge.b.toArray()};else{let best=null,distance=8;for(const f of features.filter(f=>f.kind==='sketch'&&!f.groupHidden&&!f.arc&&['line','rect','polyline'].includes(f.profile)))for(const edge of sketchSegments(f)){const a=screenPoint(edge.a),b=screenPoint(edge.b),x=e.clientX-r.left,y=e.clientY-r.top,dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(x-a.x-t*dx,y-a.y-t*dy);if(d<distance){distance=d;best=edge;}}if(!best){notify('直線の辺をクリックしてください');return;}revolveEdge={a:best.a.toArray(),b:best.b.toArray()};}
 $('revolve-axis').value='SELECTED';$('revolve-axis-status').textContent='直線の軸を選択済み';
 }
 scheduleRevolve();
}
function clearRevolvePreview(){if(revolvePreview){disposeObject(revolvePreview);revolvePreview=null;}delete host.dataset.revolvePreview;}
function scheduleRevolve(){
 clearTimeout(revolveTimer);const revision=++revolveRevision;clearRevolvePreview();if(!$('tools-dialog').open||$('cad-command').value!=='revolve')return;
 $('revolve-target-label').hidden=$('revolve-operation').value==='new';
 revolveTimer=setTimeout(async()=>{try{const spec=revolveSpec();$('cad-error').textContent='プレビューを計算中…';const result=await kernelClient.run(spec.sourceBody?features:[], {...spec,id:'revolve-preview',operation:'new'});if(revision!==revolveRevision||!$('tools-dialog').open)return;revolvePreview=new THREE.Group();for(const o of result.outputs){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(o.vertices,3));g.setIndex(o.triangles);g.computeVertexNormals();revolvePreview.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:spec.operation==='cut'?0xe34c40:0x438fcb,transparent:true,opacity:.5,depthWrite:false,side:THREE.DoubleSide})));}const origin=new THREE.Vector3(...spec.origin),axis=new THREE.Vector3(...spec.axisVector).normalize(),points=spec.sourceBody?[new THREE.Box3().setFromObject(meshes.get(spec.sourceBody)).getCenter(new THREE.Vector3())]:spec.region.outer.map(p=>worldPoint(spec.region,p)),extent=Math.max(20,...points.map(p=>p.distanceTo(origin)))*1.3;const axisLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([origin.clone().addScaledVector(axis,-extent),origin.clone().addScaledVector(axis,extent)]),new THREE.LineBasicMaterial({color:0xf18b13,depthTest:false}));axisLine.renderOrder=10;revolvePreview.add(axisLine);scene.add(revolvePreview);host.dataset.revolvePreview=String(spec.angle);$('cad-error').textContent='';}catch(e){if(revision===revolveRevision)$('cad-error').textContent=e.message;}},200);
}
$('cad-fields').addEventListener('input',()=>{if($('cad-command').value==='revolve')scheduleRevolve();});
$('cad-command').addEventListener('change',scheduleRevolve);
$('tools-dialog').addEventListener('close',()=>{++revolveRevision;clearTimeout(revolveTimer);clearRevolvePreview();});
new MutationObserver(scheduleRevolve).observe($('tools-dialog'),{attributes:true,attributeFilter:['open']});
function clearLoftHighlights(){if(loftHighlight){disposeObject(loftHighlight);loftHighlight=null;}for(const marker of loftMarkers)marker.el.remove();loftMarkers=[];}
function renderLoftSelection(){
 clearLoftHighlights();$('cad-fields').replaceChildren();const info=document.createElement('p');info.id='loft-selection-count';info.textContent=loftSections.length+' 面を選択 · クリックした順に接続';$('cad-fields').append(info);loftHighlight=new THREE.Group();const centers=[];
 loftSections.forEach((section,i)=>{const color=i%2?'#e58a24':'#268bd2',row=document.createElement('div');row.className='check-row';const text=document.createElement('span');text.textContent=(i+1)+'. '+section.name;text.style.color=color;const remove=document.createElement('button');remove.type='button';remove.textContent='解除';remove.onclick=()=>{loftSections.splice(i,1);renderLoftSelection();};row.append(text,remove);$('cad-fields').append(row);
 const g=regionFaceGeometry(section.region),mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.65,side:THREE.DoubleSide,depthTest:false}));mesh.renderOrder=8;loftHighlight.add(mesh);g.computeBoundingBox();const point=g.boundingBox.getCenter(new THREE.Vector3());centers.push(point);const el=document.createElement('span');el.textContent='断面 '+(i+1);el.style.cssText='position:absolute;pointer-events:none;z-index:10;background:white;padding:4px 8px;border:2px solid '+color+';color:'+color+';border-radius:5px;font-weight:bold;transform:translate(-50%,-50%)';host.append(el);loftMarkers.push({el,point});
 });if(centers.length>1){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(centers),new THREE.LineDashedMaterial({color:0xe58a24,dashSize:3,gapSize:2,depthTest:false}));line.computeLineDistances();line.renderOrder=9;loftHighlight.add(line);}scene.add(loftHighlight);host.dataset.loftSectionCount=String(loftSections.length);
}
function pickLoftSection(e){
 if($('cad-apply').disabled)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);raycaster.setFromCamera(pointer,camera);
 const sketchHit=raycaster.intersectObjects(regionGroup.children.filter(m=>m.userData.region),false)[0],bodyHit=raycaster.intersectObjects([...meshes.values()].filter(m=>m.visible),false)[0];let section;
 if(sketchHit&&(!bodyHit||sketchHit.distance<bodyHit.distance-.01)){const region=sketchHit.object.userData.region;section={key:region.id,region:clone(region),name:'スケッチ領域 / '+fmt(region.area)+' mm²'};}
 else if(bodyHit){try{const region=planarFace(bodyHit.object.geometry,bodyHit.faceIndex),n=basisFor(region).n;section={key:bodyHit.object.userData.bodyId+':'+[...n.toArray(),region.offset,...region.outer.flat()].map(v=>v.toFixed(4)).join(','),region:{...region,bodyId:bodyHit.object.userData.bodyId},name:bodyDisplayName(bodyHit.object.userData.bodyId)+' の面'};}catch{notify('ロフトには平面を選択してください');return;}}
 else return;
 const index=loftSections.findIndex(s=>s.key===section.key);if(index>=0)loftSections.splice(index,1);else loftSections.push(section);$('cad-error').textContent='';renderLoftSelection();
}
function updateLoftMarkers(){for(const {el,point} of loftMarkers){const p=screenPoint(point);el.hidden=p.z< -1||p.z>1;el.style.left=p.x+'px';el.style.top=p.y+'px';}}
$('tools-dialog').addEventListener('close',clearLoftHighlights);$('cad-command').addEventListener('change',()=>{if($('cad-command').value!=='loft')clearLoftHighlights();});
const templateDialog=document.createElement('dialog');templateDialog.id='template-dialog';templateDialog.innerHTML='<div class="dialog-heading"><h2>部品テンプレート</h2><button type="button" id="template-close">×</button></div><p>選択したソリッド1つを保存します。別の作業ファイルでも読み込めます。</p><label>保存するボディ<select id="template-body"></select></label><label>部品名<input id="template-name" maxlength="100" value="部品"></label><p>底面中央を配置の基準にします。保存されるのは完成した立体形状です。</p><button type="button" id="template-save">このボディを保存</button><hr><button type="button" id="template-load">テンプレートを読み込んで配置</button><input type="file" id="template-file" accept=".json" hidden><p id="template-error" role="alert"></p>';document.body.append(templateDialog);draggableDialog(templateDialog);
$('solid-template-tool').onclick=()=>{moveTool?.cancel();finishSketch(false);$('template-body').replaceChildren();for(const [id] of meshes)$('template-body').add(new Option(bodyDisplayName(id),id));const preferred=selectedBody||selectedFace?.bodyId||selectedEdge?.bodyId;if(preferred&&meshes.has(preferred))$('template-body').value=preferred;$('template-name').value=features.find(f=>f.id===$('template-body').value)?.name||'部品';$('template-save').disabled=!meshes.size;$('template-error').textContent='';templateDialog.show();};
$('template-close').onclick=()=>templateDialog.close();$('template-body').onchange=()=>{$('template-name').value=features.find(f=>f.id===$('template-body').value)?.name||'部品';};
$('template-save').onclick=async()=>{const name=$('template-name').value.trim(),target=$('template-body').value;if(!name||!meshes.has(target)){$('template-error').textContent='部品名とボディを指定してください';return;}$('template-save').disabled=true;$('template-error').textContent='部品を保存中…';try{const result=await kernelClient.run(features,{type:'templateExport',target,id:'part'});const data={format:'forma-solid-template',version:1,units:'mm',name,brep:result.outputs[0].brep};download(JSON.stringify(data),name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_')+'.forma-part.json','application/json');$('template-error').textContent='部品テンプレートを保存しました';}catch(e){$('template-error').textContent=e.message;}finally{$('template-save').disabled=false;}};
$('template-load').onclick=()=>$('template-file').click();$('template-file').onchange=async()=>{const file=$('template-file').files[0];if(!file)return;const request=toolCancelRevision;$('template-load').disabled=true;try{if(file.size>30000000)throw Error('部品ファイルは30MB以下にしてください');const text=await file.text();if(request!==toolCancelRevision)return;const data=JSON.parse(text);if(data.format!=='forma-solid-template'||data.version!==1||data.units!=='mm'||typeof data.name!=='string'||!data.name.trim()||data.name.length>100||typeof data.brep!=='string')throw Error('対応する部品テンプレートではありません');$('template-error').textContent='部品を読み込み中…';const id=crypto.randomUUID(),result=await kernelClient.run([],{type:'templateImport',id,brep:data.brep,occupiedBounds:[...meshes.values()].map(mesh=>{const b=new THREE.Box3().setFromObject(mesh);return {min:b.min.toArray(),max:b.max.toArray()};})});if(request!==toolCancelRevision)return;setProject([...features,{kind:'cadop',id,name:data.name,outputs:result.outputs,remove:[]}]);selected=null;stage='model';syncFields();templateDialog.close();fit();moveTool.place(meshes.get(id));notify('部品を重ならない位置に読み込みました。移動／回転で調整して「確定」してください');}catch(e){if(request===toolCancelRevision)$('template-error').textContent=e.message;}finally{$('template-load').disabled=false;$('template-file').value='';}};

let enclosureFaces=[],enclosurePicking=false;
const enclosureHint=document.createElement('p');enclosureHint.id='enclose-viewport-hint';enclosureHint.hidden=true;enclosureHint.setAttribute('role','status');host.append(enclosureHint);
$('tools-dialog').addEventListener('close',()=>{enclosurePicking=false;enclosureHint.hidden=true;host.dataset.enclosurePicking='false';});
$('cad-command').addEventListener('change',()=>{enclosurePicking=false;enclosureHint.hidden=true;host.dataset.enclosurePicking='false';});
function enclosureStatus(){
 const button=$('enclose-pick');if(!button)return;
 button.textContent=enclosurePicking?'選択を終えてプレビュー':'開口面を選択';button.setAttribute('aria-pressed',String(enclosurePicking));
 const box=$('cad-boxMode')?.checked,sides=[...new Set(enclosureFaces.map(face=>{const n=face.normal||[0,0,1],axis=n.reduce((best,value,i)=>Math.abs(value)>Math.abs(n[best])?i:best,0);return (n[axis]>=0?'+':'-')+'XYZ'[axis];}))];
 $('enclose-face-status').textContent=enclosureFaces.length?enclosureFaces.length+' 面を開口に指定しました'+(box?' → BOXの '+sides.join('・')+' 側を開きます':''):'開口面は未選択です（'+(box?'閉じたBOX':'閉じた囲み')+'になります）';
 $('enclose-face-guide').textContent=enclosurePicking?box?'対象ソリッドの開けたい側の面をクリック。同じ方向のBOX面が開きます。選び終えたら「選択を終えてプレビュー」を押してください。':'3Dモデルの開けたい面をクリック。青く選ばれた面が開口になります。別の面も追加でき、同じ面を再クリックすると解除できます。選び終えたら「選択を終えてプレビュー」を押してください。':box?'開口が必要な場合だけ、対象ソリッドの面を選んでください。選んだ面と同じ向きのBOX面が開きます。':'開口を作る場合は「開口面を選択」を押し、3Dモデルの開けたい面をクリックしてください。';
 enclosureHint.hidden=!enclosurePicking;enclosureHint.textContent='開口面を選択中 · '+enclosureFaces.length+' 面指定 · モデルの面をクリック';host.dataset.enclosurePicking=String(enclosurePicking);
}
function encloseExtraSpec(){
 const boxMode=$('cad-boxMode').checked,hinge=boxMode&&$('cad-enclosureSplit').value!=='分割しない'&&$('cad-hinge').checked;
 return {boxMode,chestStyle:boxMode&&$('cad-chestStyle').checked,hinge,hardwareScale:1.3,latchProfile:'triangle',hingeEdge:$('cad-hingeEdge').value,hingeRadialGap:Number($('cad-hingeRadialGap').value),seamGap:Number($('cad-seamGap').value),hingeAxialGap:Number($('cad-hingeAxialGap').value),hingeAngle:Number($('cad-hingeAngle').value),autoExpandMotion:hinge&&$('cad-autoExpandMotion').checked,motionGap:Number($('cad-motionGap').value),snapLatch:hinge&&$('cad-snapLatch').checked,latchGap:Number($('cad-latchGap').value),latchEngagement:Number($('cad-latchEngagement').value)};
}
function renderEncloseOptions(){
 enclosureFaces=[];enclosurePicking=false;clearFaceSelection();selectedFace=null;selectedSurface=null;chosenRegion=null;
 $('cad-clearance').min=0;
 const controls=document.createElement('div');controls.className='enclose-options';
 controls.innerHTML='<label class="enclose-check"><input type="checkbox" id="cad-boxMode">BOXを作る（直方体の容器）</label><p id="enclose-box-guide">BOXは対象の外接直方体から作ります。開口面を選ばなければ閉じたBOXです。上の分割平面で位置を先に指定できます。未設定のままヒンジを付けるとXY中央に分割されます。</p><label class="enclose-check" id="enclose-chest-option"><input type="checkbox" id="cad-chestStyle">宝箱風にする（丸屋根と帯飾り）</label><p id="enclose-chest-guide">内側の収納寸法を保ち、蓋の外側を丸屋根にします。分割面が未設定ならXY中央に設定し、ヒンジ・爪を有効にします。ヒンジと爪は下で調整できます。</p><div id="enclose-face-controls"><h3>開口面（任意）</h3><p id="enclose-face-guide"></p><div class="enclose-face-actions"><button type="button" id="enclose-pick" aria-pressed="false">開口面を選択</button><button type="button" id="enclose-clear">開口面を解除</button></div><p id="enclose-face-status" role="status"></p></div>';
 $('cad-fields').insertBefore(controls,$('cad-thickness').closest('label'));
 const centerButton=document.createElement('button');centerButton.type='button';centerButton.id='enclose-center';centerButton.textContent='分割位置を対象の中央に';
 const splitSettings=document.createElement('fieldset');splitSettings.id='enclose-split-settings';
 const splitTitle=document.createElement('legend');splitTitle.textContent='分割平面・位置';
 splitSettings.append(splitTitle,$('cad-enclosureSplit').closest('label'),$('cad-splitOffset').closest('label'),centerButton);
 $('cad-target').closest('label').after(splitSettings);
 const hingePanel=document.createElement('div');hingePanel.id='enclose-hinge-options';hingePanel.className='enclose-options';hingePanel.innerHTML='<h3>ヒンジ設定</h3><label class="enclose-check"><input type="checkbox" id="cad-hinge">ヒンジを付ける（一体印刷）</label><p id="enclose-hinge-hint"></p><div id="enclose-hinge-fields"><label>ヒンジを付ける辺<select id="cad-hingeEdge"></select></label><label>軸と穴のすき間 (mm)<input id="cad-hingeRadialGap" type="number" min="0.2" max="3" step="0.05" value="0.5" required></label><label>蓋と本体の合わせ目 (mm)<input id="cad-seamGap" type="number" min="0.1" max="3" step="0.05" value="0.3" required></label><label>軸方向のすき間 (mm)<input id="cad-hingeAxialGap" type="number" min="0.2" max="3" step="0.05" value="0.5" required></label><label>蓋の角度 (°)<input id="cad-hingeAngle" type="number" min="0" max="180" step="1" value="0" required></label><div class="enclose-face-actions"><button type="button" id="enclose-close-lid">閉じる 0°</button><button type="button" id="enclose-print-pose">蓋を90°開く</button></div><label class="enclose-check"><input type="checkbox" id="cad-autoExpandMotion">開閉中の元ソリッドとの干渉を確認しBOXを自動拡大</label><label id="enclose-motion-gap">開閉時の必要すき間 (mm)<input id="cad-motionGap" type="number" min="0.2" max="3" step="0.05" value="0.5" required></label><p id="enclose-motion-result" role="status"></p><label class="enclose-check"><input type="checkbox" id="cad-snapLatch">反対側に角形の爪・受け溝と指掛かりを付ける</label><label id="enclose-latch-gap">爪と溝のすき間 (mm)<input id="cad-latchGap" type="number" min="0.2" max="0.8" step="0.05" value="0.3" required></label><label id="enclose-latch-engagement">爪の基本掛かり量 (mm)<input id="cad-latchEngagement" type="number" min="0.1" max="1.5" step="0.05" value="1.3" required></label><button type="button" id="enclose-stronger-latch">既存BOXに改善値を適用</button><p>爪の推奨値は基本掛かり量1.3 mm、溝とのすき間0.3 mmです。四角い爪先だけ、設定した掛かり量より箱側へ1.0 mm長く作ります。爪は幅広の角形で、腕の自由端は指を掛けやすい丸い形です。腕を箱に近づけ、爪先を受け溝の内側まで伸ばし、受け溝を壁厚が残る範囲で箱側へ深くします。標準の2 mm壁では溝の奥に約0.8 mmの壁が残ります。爪の掛かる上面と受け溝の面を水平に合わせ、腕を少し厚くして変形しにくくします。閉じる途中は腕が外側へたわみます。印刷済みのBOXが掛からない場合は改善値を適用し、変更を確定してSTLを再出力してください。印刷後に閉まり具合と保持力を確認し、きつい場合は掛かり量を少し下げるかすき間を増やしてください。</p><p>印刷用STLは元の対象ソリッドを除外し、蓋を90°開いてヒンジ軸を縦に配置します。芯はBOX本体に固定され、蓋の筒との間には指定のすき間が残ります。張り出しやBOX内の天井はスライサーでサポートの要否を確認してください。</p></div>';
 controls.insertBefore(hingePanel,$('enclose-face-controls'));
 const update=()=>{
  const split=$('cad-enclosureSplit').value,hasSplit=split!=='分割しない',box=$('cad-boxMode').checked;
  $('cad-splitOffset').closest('label').hidden=!hasSplit;$('enclose-center').hidden=!hasSplit;
  $('enclose-box-guide').hidden=!box;$('enclose-chest-option').hidden=!box;$('enclose-chest-guide').hidden=!box;if(!box||!hasSplit)$('cad-chestStyle').checked=false;
  $('enclose-hinge-options').hidden=!box;
  if(!box||!hasSplit)$('cad-hinge').checked=false;
  $('enclose-hinge-fields').hidden=!$('cad-hinge').checked;$('enclose-motion-gap').hidden=!$('cad-autoExpandMotion').checked;$('enclose-latch-gap').hidden=!$('cad-snapLatch').checked;$('enclose-latch-engagement').hidden=!$('cad-snapLatch').checked;$('enclose-stronger-latch').hidden=!$('cad-snapLatch').checked||!editingEncloseId;
  $('enclose-hinge-hint').textContent=hasSplit?'分割面の4辺からヒンジの位置を選べます。蓋は0°で閉じ、90°まで開けられます。':'チェックするとXY平面で対象の中央を自動分割します。分割平面と位置は上の欄で先に指定できます。';
  enclosureStatus();
  const edge=$('cad-hingeEdge'),before=edge.value,axis={XY:['X','Y'],XZ:['X','Z'],YZ:['Y','Z']}[split]||[];
  edge.replaceChildren();for(const coordinate of axis)for(const sign of ['-','+'])edge.add(new Option(sign+coordinate+' 側',sign+coordinate));
  edge.value=axis.some(coordinate=>before.endsWith(coordinate))?before:axis.length?'+'+axis[1]:'';
 };
 const center=()=>{const mesh=meshes.get($('cad-target').value),axis={XY:'z',XZ:'y',YZ:'x'}[$('cad-enclosureSplit').value];if(mesh&&axis){const c=new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());$('cad-splitOffset').value=Number(c[axis].toFixed(5));}scheduleMachiningPreview();};
 $('cad-enclosureSplit').addEventListener('change',()=>{update();center();});
 $('cad-enclosureSplit').addEventListener('enclose-options-update',update);
 $('cad-boxMode').addEventListener('change',()=>{update();scheduleMachiningPreview();});
 $('cad-chestStyle').addEventListener('change',()=>{if($('cad-chestStyle').checked){if($('cad-enclosureSplit').value==='分割しない'){$('cad-enclosureSplit').value='XY';center();}$('cad-hinge').checked=true;$('cad-snapLatch').checked=true;}update();scheduleMachiningPreview();});
 $('cad-hinge').addEventListener('change',()=>{if($('cad-hinge').checked&&$('cad-enclosureSplit').value==='分割しない'){$('cad-enclosureSplit').value='XY';center();}update();scheduleMachiningPreview();});
 for(const id of ['cad-autoExpandMotion','cad-snapLatch'])$(id).addEventListener('change',()=>{update();scheduleMachiningPreview();});
 $('enclose-center').onclick=center;
 $('enclose-stronger-latch').onclick=()=>{$('cad-latchGap').value='0.3';$('cad-latchEngagement').value='1.3';$('cad-latchEngagement').dispatchEvent(new Event('input',{bubbles:true}));};
 for(const [id,angle] of [['enclose-close-lid',0],['enclose-print-pose',90]])$(id).onclick=()=>{$('cad-hingeAngle').value=angle;$('cad-hingeAngle').dispatchEvent(new Event('input',{bubbles:true}));};
 $('enclose-pick').onclick=()=>{enclosurePicking=!enclosurePicking;if(enclosurePicking){cancelMachiningPreview();$('cad-error').textContent='';}enclosureStatus();if(!enclosurePicking)scheduleMachiningPreview();};
 $('enclose-clear').onclick=()=>{enclosureFaces=[];clearFaceSelection();selectedFace=null;selectedSurface=null;chosenRegion=null;enclosureStatus();scheduleMachiningPreview();};
 $('cad-target').addEventListener('change',()=>{enclosureFaces=[];clearFaceSelection();selectedFace=null;selectedSurface=null;chosenRegion=null;enclosureStatus();center();});
 update();enclosureStatus();
}
function pickEncloseFace(e){
 if($('cad-apply').disabled)return;
 if(!enclosurePicking){enclosurePicking=true;enclosureStatus();}
 const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);raycaster.setFromCamera(pointer,camera);
 const hit=raycaster.intersectObjects([...meshes.values()].filter(m=>m.visible),false)[0];
 if(!hit||hit.object.userData.bodyId!==$('cad-target').value){$('cad-error').textContent='対象ボディの開口にする面をクリックしてください';scheduleMachiningPreview();return;}
 chooseFace(hit,true);enclosureFaces=selectedFaces.flatMap(({bodyId,point,normal,cadSelections})=>(cadSelections||[{point,normal}]).map(face=>({bodyId,...face})));$('cad-error').textContent='';enclosureStatus();scheduleMachiningPreview();
}

let coilPreviewAnalysis=null;
let machiningPreview=null,machiningSaved=[],machiningTimer=null,machiningRevision=0,machiningBusy=false,machiningAgain=false;
let coilSplitData=null,coilSplitDrag=null,coilSplitPlane=null,coilSplitPlaneKey='',coilSplitPosition=null;
function endCoilSplitDrag(e,recompute=true){
 if(!coilSplitDrag||(e&&e.pointerId!==coilSplitDrag.id))return;const drag=coilSplitDrag;coilSplitDrag=null;controls.enabled=drag.enabled;const handle=$('coil-split-handle');if(handle.hasPointerCapture(drag.id))handle.releasePointerCapture(drag.id);if(recompute&&$('tools-dialog').open&&$('cad-command').value==='coilJoint')scheduleMachiningPreview(true);
}
function clearCoilSplitOverlay(){endCoilSplitDrag(null,false);coilSplitData=null;coilSplitPosition=null;coilSplitPlaneKey='';if(coilSplitPlane){disposeObject(coilSplitPlane);coilSplitPlane=null;}for(const id of ['coil-split-handle','coil-split-distance'])$(id).hidden=true;delete host.dataset.coilSplit;}
function setCoilSplitPreview(q){coilSplitData={q,pose:$('cad-jointPose').value};if(!coilSplitDrag)coilSplitPosition=null;updateCoilSplitOverlay();}
function updateCoilSplitOverlay(){
 const active=$('tools-dialog').open&&$('cad-command').value==='coilJoint'&&coilSplitData&&!$('cad-apply').disabled,handle=$('coil-split-handle'),panel=$('coil-split-distance');handle.hidden=panel.hidden=!active;if(!active){if(coilSplitData)clearCoilSplitOverlay();return;}
 const {q,pose}=coilSplitData,position=coilSplitPosition??q.split,state=coilSplitPlacement(q,pose,position),key=JSON.stringify([state.radius,state.quaternion.toArray()]);
 if(key!==coilSplitPlaneKey){if(coilSplitPlane)disposeObject(coilSplitPlane);coilSplitPlane=new THREE.Group();const geometry=new THREE.PlaneGeometry(state.radius*2,state.radius*2),face=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0x20bce0,transparent:true,opacity:.10,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));face.renderOrder=12;coilSplitPlane.add(face);const r=state.radius,outline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-r,-r,0),new THREE.Vector3(r,-r,0),new THREE.Vector3(r,r,0),new THREE.Vector3(-r,r,0)]),new THREE.LineBasicMaterial({color:0x0586b2,depthTest:false,transparent:true,opacity:.9}));outline.renderOrder=13;coilSplitPlane.add(outline);coilSplitPlane.quaternion.copy(state.quaternion);scene.add(coilSplitPlane);coilSplitPlaneKey=key;}
 coilSplitPlane.position.copy(state.center);const point=screenPoint(state.handle),tip=screenPoint(state.handle.clone().add(state.axis)),x=Math.max(24,Math.min(host.clientWidth-24,point.x)),y=Math.max(24,Math.min(host.clientHeight-24,point.y)),dx=tip.x-point.x,dy=tip.y-point.y;handle.style.left=x+'px';handle.style.top=y+'px';handle.style.transform='translate(-50%,-50%) rotate('+(Math.hypot(dx,dy)<.1?0:Math.atan2(dy,dx)*180/Math.PI+90)+'deg)';
 const width=panel.offsetWidth,height=panel.offsetHeight;panel.style.left=Math.max(8,Math.min(host.clientWidth-width-8,x-width-28<8?x+28:x-width-28))+'px';panel.style.top=Math.max(8,Math.min(host.clientHeight-height-8,y+28))+'px';const input=$('coil-split-viewport-position');if(document.activeElement!==input)input.value=$('cad-jointSplit').value;
 $('coil-split-effective').textContent=(Number($('cad-jointSplit').value)===0?'自動：':'分割面：')+fmt(position)+' mm';host.dataset.coilSplit=JSON.stringify({position,automatic:Number($('cad-jointSplit').value)===0,center:state.center.toArray(),axis:state.axis.toArray(),min:state.min,max:state.max,dragging:!!coilSplitDrag});
}
$('coil-split-viewport-position').addEventListener('input',e=>{const input=$('cad-jointSplit');if(!input||$('cad-command').value!=='coilJoint'||!e.target.validity.valid||e.target.value==='')return;input.value=e.target.value;input.dispatchEvent(new Event('input',{bubbles:true}));});
$('coil-split-viewport-position').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();e.target.blur();}});
$('coil-split-auto').addEventListener('click',()=>{const input=$('cad-jointSplit');if(!input)return;input.value='0';input.dispatchEvent(new Event('input',{bubbles:true}));});
$('coil-split-handle').addEventListener('pointerdown',e=>{
 if(e.button!==0||!coilSplitData)return;e.preventDefault();e.stopPropagation();document.activeElement?.blur();clearTimeout(machiningTimer);++machiningRevision;machiningAgain=false;const {q,pose}=coilSplitData,state=coilSplitPlacement(q,pose,coilSplitPosition??q.split),a=screenPoint(state.handle),b=screenPoint(state.handle.clone().add(state.axis));let dx=b.x-a.x,dy=b.y-a.y;if(Math.hypot(dx,dy)<.1){dx=0;dy=-host.clientHeight/viewHeight();}coilSplitDrag={id:e.pointerId,x:e.clientX,y:e.clientY,position:coilSplitPosition??q.split,min:state.min,max:state.max,dx,dy,enabled:controls.enabled};controls.enabled=false;e.target.setPointerCapture(e.pointerId);
});
$('coil-split-handle').addEventListener('pointermove',e=>{
 const drag=coilSplitDrag;if(!drag||e.pointerId!==drag.id)return;e.preventDefault();e.stopPropagation();const delta=((e.clientX-drag.x)*drag.dx+(e.clientY-drag.y)*drag.dy)/(drag.dx*drag.dx+drag.dy*drag.dy),value=Math.max(drag.min,Math.min(drag.max,drag.position+delta)),input=$('cad-jointSplit');input.value=Math.max(drag.min,Math.min(drag.max,Number(value.toFixed(3))));input.dispatchEvent(new Event('input',{bubbles:true}));updateCoilSplitOverlay();
});
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('coil-split-handle').addEventListener(name,endCoilSplitDrag);
let coilStopFaceData=null,coilStopFaceDrag=null,coilStopFaceMarker=null,coilStopFaceMarkerKey='';
function endCoilStopFaceDrag(e,recompute=true){
 if(!coilStopFaceDrag||(e&&e.pointerId!==coilStopFaceDrag.id))return;
 const drag=coilStopFaceDrag;coilStopFaceDrag=null;controls.enabled=drag.enabled;
 const handle=$('coil-stop-face-handle');if(handle.hasPointerCapture(drag.id))handle.releasePointerCapture(drag.id);
 if(recompute&&$('tools-dialog').open&&$('cad-command').value==='coilJoint')scheduleMachiningPreview(true);
}
function clearCoilStopFaceOverlay(){
 endCoilStopFaceDrag(null,false);coilStopFaceData=null;coilStopFaceMarkerKey='';
 if(coilStopFaceMarker){disposeObject(coilStopFaceMarker);coilStopFaceMarker=null;}
 for(const id of ['coil-stop-face-handle','coil-stop-face-distance'])$(id).hidden=true;
 delete host.dataset.coilStopFace;
}
function setCoilStopFacePreview(q){
 coilStopFaceData=q.stopFacePreview?{q,pose:$('cad-jointPose').value}:null;
 updateCoilStopFaceOverlay();
}
function updateCoilStopFaceOverlay(){
 const handle=$('coil-stop-face-handle'),panel=$('coil-stop-face-distance'),input=$('cad-stopFaceSetback');
 const active=$('tools-dialog').open&&$('cad-command').value==='coilJoint'&&$('cad-jointLatch')?.checked&&$('cad-latchStyle')?.value==='ridge'&&coilStopFaceData?.q.stopFacePreview&&!$('cad-apply').disabled;
 handle.hidden=panel.hidden=!active;
 if(!active){if(coilStopFaceMarker){disposeObject(coilStopFaceMarker);coilStopFaceMarker=null;coilStopFaceMarkerKey='';}delete host.dataset.coilStopFace;return;}
 const {q,pose}=coilStopFaceData,value=Math.max(0,Math.min(1,Number(input.value)||0)),state=coilStopFacePlacement(q,pose,value);
 if(!state)return;
 const key=JSON.stringify([pose,value,q.split,q.origin,q.axis,q.stopFacePreview]);
 if(key!==coilStopFaceMarkerKey){
  if(coilStopFaceMarker)disposeObject(coilStopFaceMarker);
  coilStopFaceMarker=new THREE.Group();
  const shape=new THREE.BufferGeometry().setFromPoints(state.corners);shape.setIndex([0,1,2,0,2,3]);
  const face=new THREE.Mesh(shape,new THREE.MeshBasicMaterial({color:0x0087bc,transparent:true,opacity:.48,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));face.renderOrder=25;face.frustumCulled=false;
  const edge=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(state.corners),new THREE.LineBasicMaterial({color:0x006d9b,depthTest:false,transparent:true,opacity:.95}));edge.renderOrder=26;edge.frustumCulled=false;
  coilStopFaceMarker.add(face,edge);scene.add(coilStopFaceMarker);coilStopFaceMarkerKey=key;
 }
 const point=screenPoint(state.anchor),tip=screenPoint(state.anchor.clone().add(state.direction)),x=Math.max(24,Math.min(host.clientWidth-24,point.x)),y=Math.max(24,Math.min(host.clientHeight-24,point.y)),dx=tip.x-point.x,dy=tip.y-point.y;
 handle.style.left=x+'px';handle.style.top=y+'px';handle.style.transform='translate(-50%,-50%) rotate('+(Math.hypot(dx,dy)<.1?0:Math.atan2(dy,dx)*180/Math.PI)+'deg)';
 const width=panel.offsetWidth,height=panel.offsetHeight;panel.style.left=Math.max(8,Math.min(host.clientWidth-width-8,x+width+38>host.clientWidth?x-width-28:x+28))+'px';panel.style.top=Math.max(8,Math.min(host.clientHeight-height-8,y-height-26>=8?y-height-26:y+26))+'px';
 const viewportInput=$('coil-stop-face-viewport-setback');if(document.activeElement!==viewportInput)viewportInput.value=input.value;
 host.dataset.coilStopFace=JSON.stringify({setback:value,center:state.anchor.toArray(),direction:state.direction.toArray(),dragging:!!coilStopFaceDrag});
}
$('coil-stop-face-viewport-setback').addEventListener('input',e=>{
 const input=$('cad-stopFaceSetback');if(!input||$('cad-command').value!=='coilJoint'||!e.target.validity.valid||e.target.value==='')return;
 input.value=e.target.value;input.dispatchEvent(new Event('input',{bubbles:true}));updateCoilStopFaceOverlay();
});
$('coil-stop-face-viewport-setback').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();e.target.blur();}});
$('coil-stop-face-handle').addEventListener('pointerdown',e=>{
 if(e.button!==0||!coilStopFaceData)return;e.preventDefault();e.stopPropagation();document.activeElement?.blur();
 clearTimeout(machiningTimer);++machiningRevision;machiningAgain=false;
 const input=$('cad-stopFaceSetback'),{q,pose}=coilStopFaceData,state=coilStopFacePlacement(q,pose,Number(input.value)),a=screenPoint(state.anchor),b=screenPoint(state.anchor.clone().add(state.direction));
 let dx=b.x-a.x,dy=b.y-a.y;if(Math.hypot(dx,dy)<.1){dx=host.clientHeight/viewHeight();dy=0;}
 coilStopFaceDrag={id:e.pointerId,x:e.clientX,y:e.clientY,setback:Number(input.value),dx,dy,enabled:controls.enabled};controls.enabled=false;e.target.setPointerCapture(e.pointerId);
});
$('coil-stop-face-handle').addEventListener('pointermove',e=>{
 const drag=coilStopFaceDrag;if(!drag||e.pointerId!==drag.id)return;e.preventDefault();e.stopPropagation();
 const delta=((e.clientX-drag.x)*drag.dx+(e.clientY-drag.y)*drag.dy)/(drag.dx*drag.dx+drag.dy),value=Math.max(0,Math.min(1,drag.setback+delta)),input=$('cad-stopFaceSetback');
 input.value=Number((Math.round(value/.05)*.05).toFixed(2));input.dispatchEvent(new Event('input',{bubbles:true}));updateCoilStopFaceOverlay();
});
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('coil-stop-face-handle').addEventListener(name,endCoilStopFaceDrag);
let coilFilletAnchor=null,coilFilletDrag=null;
function endCoilFilletDrag(e){
 if(!coilFilletDrag||(e&&e.pointerId!==coilFilletDrag.id))return;
 const drag=coilFilletDrag;coilFilletDrag=null;controls.enabled=drag.enabled;
 const handle=$('coil-fillet-handle');if(handle.hasPointerCapture(drag.id))handle.releasePointerCapture(drag.id);
}
function clearCoilFilletOverlay(){endCoilFilletDrag();coilFilletAnchor=null;for(const id of ['coil-fillet-handle','coil-fillet-distance'])$(id).hidden=true;delete host.dataset.coilFillet;}
function setCoilFilletAnchor(){
 if(coilFilletDrag)return;
 const lid=!$('cad-filletBodyBottom')?.checked&&$('cad-filletLidTop')?.checked;
 const mesh=machiningPreview?.children.find(m=>m.userData.coilJointLid===lid);if(!mesh)return;
 mesh.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(mesh);
 coilFilletAnchor=new THREE.Vector3(box.max.x,box.min.y,lid&&!$('cad-flipLidToGrid')?.checked?box.max.z:box.min.z);updateCoilFilletOverlay();
}
function updateCoilFilletOverlay(){
 const cap=$('cad-filletBodyBottom')?.checked||$('cad-filletLidTop')?.checked,vertical=$('cad-filletVertical')?.checked&&(!coilPreviewAnalysis||!!coilPreviewAnalysis.profile);
 const active=$('tools-dialog').open&&$('cad-command').value==='coilJoint'&&$('cad-autoFillet')?.checked&&(cap||vertical)&&coilFilletAnchor&&!$('cad-apply').disabled;
 const handle=$('coil-fillet-handle'),panel=$('coil-fillet-distance');handle.hidden=panel.hidden=!active;
 if(!active){endCoilFilletDrag();delete host.dataset.coilFillet;return;}
 const point=screenPoint(coilFilletAnchor),x=Math.max(24,Math.min(host.clientWidth-24,point.x)),y=Math.max(24,Math.min(host.clientHeight-24,point.y));
 handle.style.left=x+'px';handle.style.top=y+'px';const width=panel.offsetWidth,height=panel.offsetHeight;
 panel.style.left=Math.max(8,Math.min(host.clientWidth-width-8,x+width+40>host.clientWidth?x-width-26:x+26))+'px';panel.style.top=Math.max(8,Math.min(host.clientHeight-height-8,y+25))+'px';
 const target=$('coil-fillet-target');
 target.querySelector('[value=cap]').disabled=!cap;target.querySelector('[value=vertical]').disabled=!vertical;
 if(target.selectedOptions[0]?.disabled)target.value=cap?'cap':'vertical';
 const key=target.value==='vertical'?'filletVerticalRadius':'filletCapRadius',input=$('coil-fillet-viewport-radius'),name=target.value==='vertical'?'縦角':'端面';
 if(document.activeElement!==input)input.value=$('cad-'+key).value;
 input.setAttribute('aria-label','画面上の'+name+'の希望半径');
 handle.title=name+'の半径を左右にドラッグして調整';handle.setAttribute('aria-label',name+'の半径をドラッグ');
 $('coil-fillet-effective').textContent=$(target.value==='vertical'?'coil-fillet-vertical-effective':'coil-fillet-cap-effective')?.textContent||'プレビューで実際の半径を表示';host.dataset.coilFillet='true';
}
$('coil-fillet-target').addEventListener('change',updateCoilFilletOverlay);
$('coil-fillet-viewport-radius').addEventListener('input',e=>{const radius=$($('coil-fillet-target').value==='vertical'?'cad-filletVerticalRadius':'cad-filletCapRadius');if(!radius||!e.target.validity.valid||e.target.value==='')return;radius.value=e.target.value;radius.dispatchEvent(new Event('input',{bubbles:true}));});
$('coil-fillet-viewport-radius').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();e.target.blur();}});
$('coil-fillet-handle').addEventListener('pointerdown',e=>{
 if(e.button!==0||!coilFilletAnchor)return;e.preventDefault();e.stopPropagation();document.activeElement?.blur();
 const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),a=screenPoint(coilFilletAnchor),b=screenPoint(coilFilletAnchor.clone().add(right));let dx=b.x-a.x,dy=b.y-a.y;if(Math.hypot(dx,dy)<.1){dx=host.clientHeight/viewHeight();dy=0;}
 coilFilletDrag={id:e.pointerId,x:e.clientX,y:e.clientY,radius:Number($('cad-'+($('coil-fillet-target').value==='vertical'?'filletVerticalRadius':'filletCapRadius')).value),key:$('coil-fillet-target').value==='vertical'?'filletVerticalRadius':'filletCapRadius',dx,dy,enabled:controls.enabled};controls.enabled=false;e.target.setPointerCapture(e.pointerId);
});
$('coil-fillet-handle').addEventListener('pointermove',e=>{
 const drag=coilFilletDrag;if(!drag||e.pointerId!==drag.id)return;e.preventDefault();e.stopPropagation();const delta=((e.clientX-drag.x)*drag.dx+(e.clientY-drag.y)*drag.dy)/(drag.dx*drag.dx+drag.dy*drag.dy),value=Math.max(.05,Math.min(10,drag.radius+delta)),input=$('cad-'+drag.key);input.value=Number((Math.round(value/.05)*.05).toFixed(2));input.dispatchEvent(new Event('input',{bubbles:true}));
});
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('coil-fillet-handle').addEventListener(name,endCoilFilletDrag);
function coilPrintOutputs(){
 if(!machiningPreview||!coilSectionSource)return [];
 return machiningPreview.children.filter(m=>m.isMesh&&m.geometry?.attributes.position).map((mesh,i)=>{
  mesh.updateMatrixWorld(true);const vertices=[],p=mesh.geometry.attributes.position,point=new THREE.Vector3();for(let j=0;j<p.count;j++){point.fromBufferAttribute(p,j).applyMatrix4(mesh.matrixWorld);vertices.push(...point.toArray());}
  return {id:coilSectionSource.result.outputs[i]?.id||'coil-preview-'+i,vertices,triangles:Array.from(mesh.geometry.index.array)};
 });
}
async function exportCoilTestPiece(source,onProgress){
 let piece;const revision=machiningRevision,ensureCurrent=()=>{if(revision!==machiningRevision||source!==coilSectionSource||!$('tools-dialog').open)throw Error('設定が変更されたため出力を中止しました。更新後にもう一度出力してください。');};
 const message=await saveStl(async()=>{
  ensureCurrent();piece=await kernelClient.run(source.input,{type:'preview',operation:{...source.spec,type:'coilTestPiece'}},{onProgress});
  ensureCurrent();
  const group=new THREE.Group();try{for(const part of piece.outputs){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.vertices,3));geometry.setIndex(part.triangles);group.add(new THREE.Mesh(geometry));}return new STLExporter().parse(group,{binary:true});}finally{group.traverse(mesh=>{mesh.geometry?.dispose();mesh.material?.dispose();});}
 },download,{suggestedName:'coil-test.stl'});
 if(!message)return null;
 const q=piece.analysis.testPiece;host.dataset.coilTestPiece=JSON.stringify(q);
 return '試し刷りSTLを保存しました。本体 '+fmt(q.bodyHeight)+' mm / 蓋 '+fmt(q.lidHeight)+' mm。'+(q.savedPercent>1?'体積を約 '+Math.round(q.savedPercent)+'%削減。':'収納部分はすでに短い寸法です。');
}
function clearMachiningPreview(keepFilletOverlay=false){
 coilPrintTools?.clear();delete host.dataset.coilTestPiece;
 if(!keepFilletOverlay){clearCoilFilletOverlay();clearCoilSplitOverlay();clearCoilStopFaceOverlay();}
 coilSectionSource=null;++coilSectionRequest;if(coilSection.active)coilSection.pending();
 coilPreviewAnalysis=null;delete host.dataset.coilOpening;for(const id of ['cad-opening-range','cad-jointOpenTurns'])if($(id))$(id).disabled=true;
 if(machiningPreview){disposeObject(machiningPreview);machiningPreview=null;}
 for(const [object,visible] of machiningSaved)object.visible=visible;machiningSaved=[];delete host.dataset.machiningPreview;delete host.dataset.removedPreviewCount;
}
function cancelMachiningPreview(stopKernel=false){coilSection.close();if(stopKernel)kernelClient.cancelPreviews();++machiningRevision;clearTimeout(machiningTimer);machiningAgain=false;clearMachiningPreview();}
function machiningSpec(){
 const type=$('cad-command').value,spec={type,id:'machining-preview'};
 for(const [key,value] of Object.entries(schemas[type]))spec[key]=value==='body'||value==='sketch'||Array.isArray(value)?$('cad-'+key).value:Number($('cad-'+key).value);
 if(type==='coilJoint'){Object.assign(spec,coilJointExtraSpec());if(editingCoilJointId)spec.id=features.find(f=>f.id===editingCoilJointId).spec.id||editingCoilJointId;return spec;}
 if(type==='enclose'){Object.assign(spec,encloseExtraSpec());spec.faces=clone(enclosureFaces);if(editingEncloseId)spec.id=features.find(f=>f.id===editingEncloseId).spec.id||editingEncloseId;return spec;}
 if(type==='pipe'){const path=pipeSketchSources().find(f=>f.id===spec.path);if(!path)throw Error('経路を選択してください');spec.pathFeature=clone(path);if(editingPipeId)spec.id=features.find(f=>f.id===editingPipeId).spec.id||editingPipeId;}else if(type==='trimSurface'){if(!trimWall)throw Error('基準面をクリックするとプレビューします');spec.faces=[clone(trimWall)];}
 else if(type==='shell'){
  spec.faces=selectedFaces.length?selectedFaces.flatMap(({bodyId,point,normal,cadSelections})=>(cadSelections||[{point,normal}]).map(face=>({bodyId,...face}))):selectedSurface?[{bodyId:selectedSurface.bodyId,point:selectedSurface.point,normal:selectedFace?basisFor(selectedFace).n.toArray():undefined}]:[];
  if(!spec.faces.length)throw Error('開口にする面を画面で選択するとプレビューします');
  if(spec.faces.some(f=>f.bodyId!==spec.target))throw Error('対象ボディと同じボディの開口面を選択してください');
 }else if(selectedEdge){spec.target=selectedEdge.bodyId;spec.edges=edgeFilletReferences(selectedEdges);}else if(selectedFace)spec.face=clone(selectedFace);
 return spec;
}
function scheduleMachiningPreview(event){
 coilPrintTools?.clear();
 const splitInput=event?.target?.id==='cad-jointSplit';if(splitInput)coilSplitPosition=Number(event.target.value)>0?Number(event.target.value):null;
 const keep=event===true||splitInput||event?.target?.id?.match(/^cad-(autoFillet|filletVerticalRadius|filletCapRadius|filletBodyBottom|filletLidTop|filletVertical|stopFaceSetback)$/);
 clearTimeout(machiningTimer);++machiningRevision;if(!keep)clearMachiningPreview();if($('enclose-motion-result'))$('enclose-motion-result').textContent='';if($('coil-joint-result'))$('coil-joint-result').textContent='';if($('coil-calculation-text'))$('coil-calculation-text').textContent='';if($('cad-command').value==='coilJoint'){updateCoilLatchEffective();updateCoilFilletEffectiveUI(null,'計算中…');}
 if(!$('tools-dialog').open||!['coilJoint','enclose','shell','fillet','trimSurface','pipe'].includes($('cad-command').value)||$('cad-apply').disabled)return;
 if($('cad-command').value==='enclose'&&enclosurePicking)return;
 if(coilSplitDrag||coilStopFaceDrag)return; machiningTimer=setTimeout(computeMachiningPreview,280);
}
async function computeMachiningPreview(){
 if(coilSplitDrag||coilStopFaceDrag)return;
 if(machiningBusy){machiningAgain=true;return;}
 const revision=machiningRevision,original=features;machiningBusy=true;
 try{
  const spec=machiningSpec();$('cad-error').textContent=spec.type==='coilJoint'?'コイル接合の形状を計算中… 開閉の干渉検査は実行時に行います':'加工後のプレビューを計算中…';const editingId=editingPipeId||editingEncloseId||editingCoilJointId,input=editingId?features.slice(0,features.findIndex(f=>f.id===editingId)):features;const result=await kernelClient.run(input,{type:'preview',operation:spec},{onProgress:progress=>{if(spec.type==='coilJoint'&&revision===machiningRevision&&features===original&&!$('cad-apply').disabled)coilJointProgress(progress);}});
  if(revision!==machiningRevision||features!==original||!$('tools-dialog').open||$('cad-apply').disabled)return;
  clearMachiningPreview(spec.type==='coilJoint');machiningPreview=new THREE.Group();for(const o of result.outputs){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(o.vertices,3));g.setIndex(o.triangles);g.computeVertexNormals();const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:(spec.type==='enclose'&&o.id.endsWith('-part2'))||(spec.type==='coilJoint'&&o.id.endsWith('-lid'))?0xe4a34d:0x64aec5,roughness:.8,side:THREE.DoubleSide,transparent:['enclose','coilJoint'].includes(spec.type),opacity:['enclose','coilJoint'].includes(spec.type)?.42:1,depthWrite:!['enclose','coilJoint'].includes(spec.type)}));mesh.userData.coilJointLid=spec.type==='coilJoint'&&o.id.endsWith('-lid');machiningPreview.add(mesh);const m=meshes.get(o.id);if(m){machiningSaved.push([m.material,m.material.visible]);m.material.visible=false;for(const c of m.children){machiningSaved.push([c,c.visible]);c.visible=false;}}}
  for(const o of result.removed||[]){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(o.vertices,3));g.setIndex(o.triangles);const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xf04438,transparent:true,opacity:.5,depthWrite:false,depthTest:false,side:THREE.DoubleSide}));m.renderOrder=30;machiningPreview.add(m);}host.dataset.removedPreviewCount=String(result.removed?.length||0);
  for(const group of [spec.type==='enclose'?null:regionGroup,sketchGroup,bodySelectionHighlight].filter(Boolean)){machiningSaved.push([group,group.visible]);group.visible=false;}
  scene.add(machiningPreview);host.dataset.machiningPreview=spec.type;
  if(spec.type==='coilJoint'){coilSectionSource={result,spec,input};coilJointStatus(result.analysis);setCoilFilletAnchor();setCoilSplitPreview(result.analysis);setCoilStopFacePreview(result.analysis);if(coilSection.active)updateCoilSection();coilPrintTools?.setSource(coilSectionSource);}
  if(spec.type==='enclose'&&$('enclose-motion-result')){
   const notes=[],analysis=result.analysis||{},latch=analysis.latchMotion;
   if(spec.autoExpandMotion)notes.push('0〜'+analysis.checkedAngle+'°を確認：BOXを各方向に '+analysis.boxExtra.toFixed(1)+' mm拡大。元ソリッドとの測定最小すき間 '+analysis.minSampleGap.toFixed(2)+' mm。');
   if(latch){
    const range=latch.contactRange?.map(angle=>angle.toFixed(1)).join('〜');
    if(latch.status==='clear')notes.push('爪の開閉検査：0〜'+latch.checkedAngle+'°のサンプルでは爪先のたわみは不要です。掛かりが弱い場合は掛かり量を増やしてください。');
    else if(latch.status==='flex-required')notes.push('爪の開閉検査：'+(range?range+'°で接触。':'')+'形状上の目安では爪先を最大約 '+latch.maxRequiredDeflection.toFixed(2)+' mm 外へたわませる必要があります。材料による実際の可否は印刷後に確認してください。');
    else notes.push('爪の開閉検査：'+(latch.unexpectedContactAngle!=null?latch.unexpectedContactAngle.toFixed(1)+'°で爪以外の干渉があります。':'爪先に大きなたわみが必要です。')+'ヒンジ辺や爪の設定を調整してください。');
   }
   $('enclose-motion-result').textContent=notes.join(' ');
  }
  $('cad-error').textContent=(spec.type==='coilJoint'?'半透明：水色の本体／橙色の蓋。':spec.type==='enclose'?'半透明：新規作成する囲み'+(spec.enclosureSplit!=='分割しない'?'（水色／橙色の２ボディ）':'')+'。':result.removed?.length?'水色：加工後 / 赤：削られる部分。':'加工後のプレビューです。')+'「'+$('cad-apply').textContent+'」で確定します';
 }catch(e){if(revision===machiningRevision){$('cad-error').textContent=e.message;if($('cad-command').value==='coilJoint'){updateCoilLatchEffective(false);updateCoilFilletEffectiveUI(null,'プレビューを計算できません');}}}
 finally{machiningBusy=false;if(machiningAgain){machiningAgain=false;scheduleMachiningPreview(true);}}
}
$('cad-fields').addEventListener('input',scheduleMachiningPreview);
$('tools-dialog').addEventListener('close',clearSplitPreview);
$('cad-command').addEventListener('change',scheduleMachiningPreview);
$('tools-dialog').addEventListener('close',()=>cancelMachiningPreview(true));
new MutationObserver(()=>{$('tools-dialog').open?scheduleMachiningPreview():cancelMachiningPreview(true);}).observe($('tools-dialog'),{attributes:true,attributeFilter:['open']});

$('step-import').onclick=()=>$('step-file').click();
$('step-file').onchange=async()=>{
 const file=$('step-file').files[0];if(!file)return;const button=$('step-import'),original=features,request=toolCancelRevision;
 button.disabled=true;button.textContent='STEP読込中…';
 try{
  if(file.size>30000000)throw Error('STEPファイルは30 MB以下にしてください');
  if(!/\.(step|stp)$/i.test(file.name))throw Error('.step または .stp ファイルを選択してください');
  $('status').textContent='STEPを読み込み中… ファイル内の単位をmmへ変換します';
  const data=await file.arrayBuffer();if(request!==toolCancelRevision)return;
  const result=await kernelClient.run([],{type:'stepImport',id:crypto.randomUUID(),data,maxBodies:150-features.length});
  if(request!==toolCancelRevision)return;
  if(features!==original)throw Error('読み込み中にモデルが変更されました。STEPをもう一度読み込んでください');
  const name=file.name.replace(/\.(step|stp)$/i,'').slice(0,80),imported=result.outputs.map((o,i)=>({kind:'cadop',id:o.id,name:name+(result.outputs.length>1?'（'+(i+1)+'）':''),outputs:[o],remove:[]}));
  setProject([...features,...imported]);finishSketch(false);selected=null;chosenRegion=null;stage='model';dropPreview();syncFields();fit();
  $('status').textContent=result.outputs.length+' 個のSTEPボディを追加しました。元の配置を保持しています';notify($('status').textContent);
 }catch(e){if(request===toolCancelRevision){$('status').textContent=e.message;notify(e.message);}}
 finally{button.disabled=false;button.textContent='STEP読込';$('step-file').value='';}
};

let extrusionBusy=false;
async function applyCADExtrusion(){
 if(extrusionBusy)return;const original=features,f=current();
 const batch=selectedRegions.length>1?regionExtrusions(f,selectedRegions,$('viewport-combine').value==='join'):[f];for(const item of batch)validateFeature(item);if(features.length+batch.length>150)throw Error('工程数は150までです');
 extrusionBusy=true;$('apply').disabled=true;const submit=$('extrude-distance').querySelector('[type=submit]');if(submit)submit.disabled=true;
 $('status').textContent='CAD形状で加工を計算中…';$('viewport-depth-error').textContent='計算中…';
 try{const result=await kernelClient.run(features,{type:'extrusionBatch',features:batch});if(features!==original)throw Error('計算中にモデルが変更されました。もう一度実行してください');setProject([...features,...result.features]);finishSketch(false);selected=f.id;draftTouched=false;selectedRegions=[];dropPreview();syncFields();renderTree();$('viewport-depth-error').textContent='';finishExtrusionCommand();$('status').textContent='押し出し加工を確定しました';notifyExtrusion(f,{count:batch.length});}
 catch(error){$('status').textContent='押し出し加工に失敗しました';$('viewport-depth-error').textContent=error.message||'形状を確認してください';throw error;}
 finally{extrusionBusy=false;$('apply').disabled=stage==='model';if(submit)submit.disabled=false;}
}

// Delete the connected CAD solid containing the selected face or edge.
let fragmentDeleteBusy=false;
window.addEventListener('keydown',async e=>{
 if(e.key!=='Delete'||e.repeat||e.ctrlKey||e.metaKey||e.altKey||stage!=='model'||sketch||moveTool?.active||document.querySelector('dialog[open]')||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
 const selection=fragmentSelection;
 if(!selection?.bodyId||!selection.point||!meshes.get(selection.bodyId)?.visible)return;
 e.preventDefault();if(fragmentDeleteBusy)return;fragmentDeleteBusy=true;
 const original=features,spec={type:'deleteFragment',target:selection.bodyId,surfacePoint:Array.isArray(selection.point)?[...selection.point]:selection.point.toArray()},id=crypto.randomUUID();
 try{notify('選択した破片を削除中…');const result=await kernelClient.run(original,spec);if(features!==original)return;setProject([...original,{kind:'cadop',id,name:'破片を削除',spec,...result}]);selected=null;chosenRegion=null;dropPreview();syncFields();renderRegions();notify('選択した破片を削除しました。戻すで復元できます');}
 catch(error){notify(error.message||'破片を削除できませんでした');}finally{fragmentDeleteBusy=false;}
});

function suggestContactLimit(){
 const f=current(),basis=basisFor(f.region||f),normal=basis.n,sign=Math.sign(f.depth)||1;
 const g=makeGeometry({...f,depth:sign*.1});
 let profile;
 try{profile=new THREE.Box3().setFromBufferAttribute(g.attributes.position);}finally{g.dispose();}
 const corners=box=>{const result=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])result.push(new THREE.Vector3(x,y,z));return result;};
 const span=(points,axis)=>[Math.min(...points.map(p=>p.dot(axis))),Math.max(...points.map(p=>p.dot(axis)))];
 const base=f.region?f.region.offset:new THREE.Vector3(f.x,f.y,f.z).dot(normal);
 const source=f.region?.cadFace?.bodyId||f.region?.bodyId;
 const pp=corners(profile),pu=span(pp,basis.u),pv=span(pp,basis.v);
 let far=-Infinity;
 for(const [id,mesh] of meshes){if(id===source||f.operation==='cut'&&id===f.target)continue;const q=corners(new THREE.Box3().setFromObject(mesh)),u=span(q,basis.u),v=span(q,basis.v);
  if(u[1]<pu[0]+1e-5||u[0]>pu[1]-1e-5||v[1]<pv[0]+1e-5||v[0]>pv[1]-1e-5)continue;
  const distance=Math.max(...q.map(point=>sign*(point.dot(normal)-base)));
  if(distance>.1)far=Math.max(far,distance);
 }
 if(!Number.isFinite(far))throw Error('押し出し方向に重なる別のソリッドがありません。先にソリッドを配置してください。');
 displayDepth(sign*Math.min(10000,Math.max(Math.abs(f.depth),far+.1)));
}
function syncCutOptions(){
 const cut=$('operation').value==='cut';
 const showSkipHoleWalls=stage==='extrusion'&&mode==='thin'&&$('profile').value==='region'&&
  (Boolean(regionPayload?.holes?.length)||selectedRegions.some(region=>region.holes?.length));
 for(const prefix of ['', 'viewport-']){
  $(prefix+'cut-options').hidden=false;
  $(prefix+'through-all').closest('label').hidden=!cut;
  $(prefix+'cut-all-bodies').closest('label').hidden=!cut;
  $(prefix+'through-all').checked=$('through-all').checked;
  $(prefix+'cut-all-bodies').checked=$('cut-all-bodies').checked;$(prefix+'cut-all-bodies').disabled=$('until-solid').checked;
  $(prefix+'grid-extent').checked=$('grid-extent').checked;$(prefix+'until-solid').checked=$('until-solid').checked;
  $(prefix+'contact-reset').hidden=stage!=='extrusion'||!$('until-solid').checked;
  $(prefix+'contact-only').checked=$('contact-only').checked;$(prefix+'contact-only').closest('label').hidden=!$('until-solid').checked;
  $(prefix+'grid-extent-plane').textContent=$('grid-extent').checked?extrusionGridPlane:gridPlane;
  $(prefix+'cap-holes').checked=$('cap-holes').checked;
  $(prefix+'cap-holes').disabled=mode!=='solid'||$('profile').value!=='region'||$('operation').value==='newHoles';
  $(prefix+'skip-hole-walls').checked=$('skip-hole-walls').checked;
  $(prefix+'skip-hole-walls').closest('label').hidden=!showSkipHoleWalls;
  $(prefix+'through-direction-label').hidden=!cut||!$('through-all').checked;
  $(prefix+'through-direction').value=depthValue()<0?'-1':'1';
 }
 $('extrude-distance').querySelector('label[for=viewport-depth]').textContent='距離';$('depth').closest('label').firstChild.data='距離 ';
}
for(const prefix of ['', 'viewport-'])$(prefix+'contact-reset').addEventListener('click',()=>{
 if(stage!=='extrusion'||!$('until-solid').checked)return;
 try{
  if(contactDistanceLimit&&Math.sign(depthValue())===Math.sign(contactDistanceLimit))displayDepth(contactDistanceLimit);
  else suggestContactLimit();
  contactAutoDepth=true;syncFields();
 }catch(error){$('error').textContent=error.message;$('viewport-depth-error').textContent=error.message;}
});
for(const prefix of ['', 'viewport-'])for(const field of ['through-all','cut-all-bodies','cap-holes','skip-hole-walls','through-direction','grid-extent','until-solid','contact-only'])$(prefix+field).addEventListener('change',()=>{
 if(field==='through-direction')displayDepth(Number($(prefix+field).value)*Math.max(.1,Math.abs(depthValue())));
 else if(field==='grid-extent'){
  const checked=$(prefix+field).checked;
  if(checked){
   extrusionGridPlane=gridPlane;
   try{displayDepth(depthToGridPlane(current(),extrusionGridPlane));$('through-all').checked=false;$('until-solid').checked=false;$('error').textContent='';}
   catch(error){$(prefix+field).checked=false;$('grid-extent').checked=false;$('error').textContent=error.message;notify(error.message);}
  }
  $('grid-extent').checked=$(prefix+field).checked;
  if($('grid-extent').checked)scheduleAutoCut();
 }
 else if(field==='until-solid'){
  $('until-solid').checked=$(prefix+field).checked;contactDistanceLimit=null;contactAutoDepth=false;
  if($('until-solid').checked){$('grid-extent').checked=false;$('through-all').checked=false;$('cut-all-bodies').checked=false;if(!extrusionManualOperation&&pendingOperation!=='cut'){$('operation').value=extrusionDefaultOperation;const source=regionPayload?.cadFace?.bodyId||regionPayload?.bodyId;if(source&&extrusionDefaultOperation==='join')updateTargets(source);}
   try{suggestContactLimit();contactAutoDepth=true;$('error').textContent='';}catch(error){$('until-solid').checked=false;$('error').textContent=error.message;notify(error.message);}
  }
 }
 else{$(field).checked=$(prefix+field).checked;if(field==='through-all'&&$('through-all').checked){$('grid-extent').checked=false;$('until-solid').checked=false;}if(field==='cut-all-bodies'&&$('cut-all-bodies').checked)$('until-solid').checked=false;}
 syncFields();if(field==='until-solid'&&!$('until-solid').checked)scheduleAutoCut();
});
function openSectionSplitEdit(id){
 const index=features.findIndex(f=>f.id===id&&isSectionSplit(f));if(index<0)return;
 try{cancelAllTools();const prefix=features.slice(0,index),bodies=rebuild(prefix);editingSectionSplitId=id;sectionEditOriginal=features;
  renderBodies(bodies,{colorFeatures:prefix});const f=features[index],target=meshes.get(f.spec.target);if(!target)throw Error('分離前の対象ボディがありません。');target.visible=true;sectionControl.edit(f.spec);renderTree();notify('断面で分離の再編集を開始しました。');
 }catch(error){sectionControl.cancel();editingSectionSplitId=null;sectionEditOriginal=null;renderBodies(rebuild(features));renderTree();notify(error.message);}
}
bodyDisplay=createBodyDisplay({meshes,scene,host,hiddenBodies,getFeatures:()=>features,getSelected:()=>selectedBodies.size?[...selectedBodies]:selectedFaces.length?[...new Set(selectedFaces.map(f=>f.bodyId))]:[selectedBody||selectedSurface?.bodyId||selectedEdge?.bodyId].filter(Boolean),canChange:()=>stage==='model'&&!pendingExtrude&&!extrusionBusy&&!editingSectionSplitId&&!moveTool?.active&&$('section-panel')?.hidden!==false&&!document.querySelector('dialog[open]'),onChange:()=>{sectionControl?.refresh();renderTree();}});
sectionControl=sectionView({renderer,scene,meshes,raycaster,host,camera,getControls:()=>controls,getSelectedBody:()=>selectedBody||selectedFace?.bodyId||selectedEdge?.bodyId,getBodyName:bodyDisplayName,canSplit:()=>stage==='model'&&!pendingExtrude&&!extrusionBusy&&!$('tools-dialog').open&&!moveTool?.active&&(!editingSectionSplitId||features===sectionEditOriginal),onClose:({applied})=>{
 if(!editingSectionSplitId)return;editingSectionSplitId=null;sectionEditOriginal=null;
 if(!applied){selected=null;selectedFace=null;selectedSurface=null;chosenRegion=null;stage='model';renderBodies(rebuild(features));syncFields();}renderTree();
},onSplit:async input=>{
 const original=features,revision=toolCancelRevision,index=editingSectionSplitId?features.findIndex(f=>f.id===editingSectionSplitId):-1;
 if(editingSectionSplitId&&(index<0||original!==sectionEditOriginal))throw Error('モデルが変更されたため、履歴から編集を開き直してください。');
 const spec={...input,...(index>=0&&features[index].spec.colorize===false?{colorize:false}:{}),id:index>=0?(features[index].spec.id||features[index].id):crypto.randomUUID()},next=clone(original);
 let result;if(index>=0){next[index]={...next[index],spec};result=await kernelClient.run(next,{type:'replay',before:original,start:index});}
 else{result=await kernelClient.run(original,spec);if(result.outputs.length!==(spec.keep==='both'?2:1))throw Error('この断面位置ではボディを分離できません。');next.push({kind:'cadop',id:spec.id,name:'断面で分離',spec,...result});}
 if(features!==original||revision!==toolCancelRevision||stage!=='model'||pendingExtrude||extrusionBusy||$('tools-dialog').open||moveTool?.active)throw Error('別の編集や操作が開始されたため分離を中止しました。');
 setProject(index>=0?result.features:next);selected=null;stage='model';dropPreview();syncFields();renderTree();
 notify(spec.plane+'断面 '+fmt(spec.offset)+' mmで'+(index>=0?'分離を更新しました。':'ボディを分離しました。'));
}});
$('section-toggle').addEventListener('click',()=>bodyDisplay?.stopExploded(),{capture:true});
$('move-tool').addEventListener('click',()=>{bodyDisplay?.stopExploded();if(editingSectionSplitId)sectionControl.cancel();},{capture:true});

// Cancel transient tools in one place so capture listeners cannot leave another selection active.
function cancelAllTools(){bodyDisplay?.reset();
 ++toolCancelRevision;middleConfirm.cancel();projectLoadPreview.cancel();kernelClient.reset();
 boxSelection?.cancel();cancelPanelDrags();cancelDialogDrags();moveTool?.cancel(true);imageReferences?.cancel();sectionControl?.cancel();drawingController?.cancel();
 if(extrusionDrag)endExtrusionDrag({pointerId:extrusionDrag.id});if(taperDrag)endTaperDrag({pointerId:taperDrag.id});
 if(shiftOrbit){const id=shiftOrbit.id;shiftOrbit=null;if(renderer.domElement.hasPointerCapture(id))renderer.domElement.releasePointerCapture(id);}
 if(sketchPan){const id=sketchPan.id;sketchPan=null;if(renderer.domElement.hasPointerCapture(id))renderer.domElement.releasePointerCapture(id);}
 down=null;sketchRightDown=null;finishSketch(false);cancelHole();stopHingeSketchAlignment();
 for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
 cancelMachiningPreview(true);clearSplitPreview();++revolveRevision;clearTimeout(revolveTimer);clearRevolvePreview();clearLoftHighlights();clearTrimArrow();
 loftSections=[];revolveRegion=null;revolveEdge=null;revolvePicking='profile';trimWall=null;enclosureFaces=[];enclosurePicking=false;enclosureHint.hidden=true;host.dataset.enclosurePicking='false';joinAll=false;
 activeSketchGroup=null;editingSketchGroup=null;enteredSketchNumber=null;pendingDrawingView=null;splinePoints=[];activeFrame=null;patternCenter=null;referencePointer=null;centerRevision=null;
 selectingFaces=false;deletingSketch=false;edgeSelectionMode=false;stage='model';selected=null;pendingExtrude=false;draftTouched=false;regionPayload=null;selectedRegions=[];contactAutoDepth=false;contactDistanceLimit=null;
 rectDimensionLocks=[false,false];circleDiameterLocked=false;clearEdgeSelection();selectedFace=null;selectedSurface=null;selectedBody=null;chosenRegion=null;fragmentSelection=null;hoverEdge=null;
 selectionMode='auto';$('selection-mode').value='auto';host.dataset.selectionMode='auto';host.dataset.hoverEdge='false';
 $('delete-line-tool').setAttribute('aria-pressed','false');document.getElementById('sketch-group-menu')?.remove();
 dropPreview();controls.enabled=true;host.style.cursor='';syncFields();renderTree();renderRegions();updateSelectionUI();
 for(const id of ['extrude-distance','extrude-guide','extrude-handle','extrude-operation-wheel','taper-control','measurement','center-pattern','snap-icon','snap-readout','edge-overlay','body-names','center-markers'])if($(id))$(id).hidden=true;
 $('status').textContent='ツールと選択を解除しました';
}

function finishExtrusionCommand(){
 finishSketch(false);stage='model';selected=null;selectedFace=null;selectedSurface=null;selectedBody=null;chosenRegion=null;regionPayload=null;selectedRegions=[];pendingExtrude=false;draftTouched=false;fragmentSelection=null;clearEdgeSelection();dropPreview();syncFields();renderTree();renderRegions();for(const id of ['extrude-distance','extrude-guide','extrude-handle','extrude-operation-wheel','taper-control','measurement'])$(id).hidden=true;
}

function stopHingeSketchAlignment(){
 aligningSketchId=null;aligningSketchVersion=null;hingeAlignButtons=[];hingeAlignCamera='';
 $('hinge-align-markers').replaceChildren();$('hinge-align-markers').hidden=true;
 const f=features.find(item=>item.id===selected);
 $('align-hinge-sketch').textContent=f?.profile==='circle'?'ヒンジ端面の円周に合わせる':'ヒンジ端面の中心に合わせる';$('align-hinge-sketch').setAttribute('aria-pressed','false');
}
function updateHingeAlignMarkers(){
 const selectedSketch=features.find(f=>f.id===selected&&f.kind==='sketch'&&['circle','point'].includes(f.profile));
 const available=!!selectedSketch&&features.some(f=>f.kind==='cadop'&&f.spec?.type==='enclose'&&f.spec.hinge&&[f.spec.id,f.spec.id+'-part2'].some(id=>meshes.get(id)?.visible));
 $('align-hinge-sketch').hidden=!available;
 if(!aligningSketchId){$('align-hinge-sketch').textContent=selectedSketch?.profile==='circle'?'ヒンジ端面の円周に合わせる':'ヒンジ端面の中心に合わせる';return;}
 if(!available||selectedSketch.id!==aligningSketchId||features!==aligningSketchVersion){stopHingeSketchAlignment();return;}
 const visible=[...meshes.values()].filter(mesh=>mesh.visible),cameraState=host.dataset.cameraState+':'+visible.map(mesh=>mesh.userData.bodyId).join(',');
 if(cameraState===hingeAlignCamera)return;hingeAlignCamera=cameraState;
 for(const {button,point,bodyId} of hingeAlignButtons){
  const world=new THREE.Vector3(...point),screen=screenPoint(world),mesh=meshes.get(bodyId);
  let hidden=!mesh?.visible||screen.z<-1||screen.z>1||screen.x<0||screen.x>host.clientWidth||screen.y<0||screen.y>host.clientHeight;
  if(!hidden){const ray=visibilityRay(world);ray.far=ray.ray.origin.distanceTo(world)-.02;hidden=ray.far>0&&ray.intersectObjects(visible,false).length>0;}
  button.hidden=hidden;button.style.left=screen.x+'px';button.style.top=screen.y+'px';
 }
}
$('align-hinge-sketch').onclick=()=>{
 if(aligningSketchId){stopHingeSketchAlignment();return;}
 const f=features.find(x=>x.id===selected&&x.kind==='sketch'&&['circle','point'].includes(x.profile));
 if(!f)return;finishSketch(false);
 const refs=hingeReferences(),rims=refs.flatMap(ref=>ref.rimPoints.filter(rim=>meshes.get(rim.bodyId)?.visible).map(rim=>({...rim,outerDiameter:ref.outerDiameter,plane:['YZ','XZ','XY'][ref.axisIndex]})));
 if(!rims.length){notify('表示中のヒンジ端面がありません');return;}
 aligningSketchId=f.id;aligningSketchVersion=features;hingeAlignCamera='';
 const layer=$('hinge-align-markers');layer.replaceChildren();layer.hidden=false;hingeAlignButtons=[];
 for(const rim of rims){
  if(hingeAlignButtons.some(item=>new THREE.Vector3(...item.point).distanceTo(new THREE.Vector3(...rim.point))<1e-5))continue;
  const button=document.createElement('button');button.type='button';button.className='hinge-align-point';button.textContent='⊙';button.title=f.profile==='circle'?'このヒンジ端面の外周に円を合わせる':'このヒンジ端面の中心に合わせる';button.setAttribute('aria-label',button.title);button.dataset.point=JSON.stringify(rim.point);
  button.onclick=async()=>{
   if(selected!==aligningSketchId)return;stopHingeSketchAlignment();
   for(const [i,key] of ['x','y','z'].entries())$(key).value=precise(rim.point[i]);
   if(f.profile==='circle'){
    $('diameter').value=precise(rim.outerDiameter);
    $('plane').value=rim.plane;activeFrame=null;$('plane').dispatchEvent(new Event('change',{bubbles:true}));
   }
   draftTouched=true;syncFields();
   try{await applyHistoryEdit();notify(f.profile==='circle'?'スケッチ円の中心と円周をヒンジ端面の外周に合わせました':'スケッチ点をヒンジ端面の中心に合わせました');}
   catch(error){$('error').textContent=error.message;notify(error.message);}
  };
  layer.append(button);hingeAlignButtons.push({button,point:rim.point,bodyId:rim.bodyId});
 }
 $('align-hinge-sketch').textContent='選択を中止';$('align-hinge-sketch').setAttribute('aria-pressed','true');
 notify(f.profile==='circle'?'表示された⊙をクリックして、円の中心と円周を端面の外周に合わせます':'表示された⊙をクリックして、点を端面の中心に合わせます');updateHingeAlignMarkers();
};
imageReferences=referenceImages({onSvg:()=>{stage='model';selected=null;syncFields();fit();},scene,camera,canvas:renderer.domElement,host,getFeatures:()=>features,setFeatures:next=>{setProject(next);updateTargets();},getPlane:()=>{const f=selectedFace||{plane:$('plane').value,frame:activeFrame,offset:planeCoordinates(current()).offset},b=basisFor(f);return {plane:f.plane,frame:{u:b.u.toArray(),v:b.v.toArray(),n:b.n.toArray()},offset:f.offset||0};},prepare:()=>{moveTool?.cancel();finishSketch(false);stage='model';dropPreview();syncFields();},viewPlane:f=>{const b=basisFor(f),origin=b.u.clone().multiplyScalar(f.center[0]).addScaledVector(b.v,f.center[1]).addScaledVector(b.n,f.offset);camera.up.copy(b.v);camera.position.copy(origin).addScaledVector(b.n,180);resetViewControls(origin);camera.zoom=200/(Math.max(f.width/(host.clientWidth/host.clientHeight),f.height)*1.3);camera.lookAt(origin);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);},startSketch:f=>{chooseConstructionPlane({...f,kind:'plane'});$('new-line').click();},notify});imageReferences.refresh();

function updateSelectionUI(){bodyDisplay?.update();$('fit-selection').disabled=!hasFitSelection();
 edgeReverseTurnButton.hidden=edgeTurnButton.hidden=!edgeTurnBusy&&!(selectedEdges.length===1&&selectedEdge&&!selectedEdge.circle&&!selectedEdge.arc&&meshes.has(selectedEdge.bodyId)&&stage==='model'&&!sketch&&!pendingExtrude&&!moveTool?.active&&!document.querySelector('dialog[open]'));edgeReverseTurnButton.disabled=edgeTurnButton.disabled=edgeTurnBusy||extrusionBusy;edgeTurnActions.hidden=edgeTurnButton.hidden;
 oppositePlaneButton.hidden=!oppositePlaneBusy&&!(selectedFace?.bodyId&&meshes.has(selectedFace.bodyId)&&selectedFaces.length<=1&&!sketch&&!pendingExtrude&&!moveTool?.active&&!document.querySelector('dialog[open]'));
 const parts=[];if(selectedBodies.size)parts.push('ボディ '+selectedBodies.size+' 個');if(selectedFaces.length)parts.push('面 '+selectedFaces.length+' 枚');if(selectedEdges.length)parts.push('辺 '+selectedEdges.length+' 本');
 let lines=0,points=0;for(const [id,indices] of selectedSketchSegments){const f=features.find(f=>f.id===id);if(!f)continue;if(f.profile==='point')points++;else lines+=['circle','spline'].includes(f.profile)||f.arc?Number(indices.size>0):indices.size;}
 if(lines)parts.push('スケッチ線 '+lines+' 本');if(points)parts.push('スケッチ点 '+points+' 個');if(selectedRegions.length)parts.push('領域 '+selectedRegions.length+' 個');else if(chosenRegion)parts.push('領域 1 個');
 const text=parts.join(' / ')||'選択なし',label=$('selection-summary');if(label.textContent!==text)label.textContent=text;
 const active=sketch?(polygonMode?'new-polygon':({'point':'new-point','rect':centerRectangle?'new-center-rect':'new-rect','circle':'new-circle','line':'new-line','spline':'new-spline'}[$('profile').value])):!deletingSketch&&stage==='sketch'?'select-sketch-edge':null;
 for(const id of ['new-point','new-rect','new-center-rect','new-circle','new-line','new-spline','new-polygon','select-sketch-edge']){const b=$(id),pressed=String(id===active);if(b.getAttribute('aria-pressed')!==pressed){b.setAttribute('aria-pressed',pressed);b.classList.toggle('active',id===active);}}
}
renderer.domElement.addEventListener('dblclick',e=>{
 if(e.button!==0||e.shiftKey||e.ctrlKey||e.metaKey||sketch||deletingSketch||holeActive||moveTool?.active||pendingExtrude||stage==='extrusion'||document.querySelector('dialog[open]'))return;
 const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects([...meshes.values()].filter(m=>m.visible),false)[0];if(!hit)return;e.preventDefault();chooseBody(hit.object.userData.bodyId);
});

drawingController=installDrawing({onChange:()=>{modified=true;renderTree();},getFeatures:()=>features,getVisible:()=>[...meshes].filter(([id,m])=>m.visible).map(([id])=>id),getSelected:()=>[...new Set([...selectedBodies,...selectedFaces.map(f=>f.bodyId),...selectedEdges.map(e=>e.bodyId)])],download});

// OS screen capture can interrupt pointer-up events without ending a CAD command.
function cancelCaptureInteraction(){
 middleConfirm.cancel();boxSelection?.cancel();cancelPanelDrags();cancelDialogDrags();
 const cancelEvent=id=>({pointerId:id,type:'pointercancel',preventDefault(){},stopImmediatePropagation(){}});
 if(shiftOrbit)endShiftOrbit(cancelEvent(shiftOrbit.id));
 if(sketchPan)endSketchPan(cancelEvent(sketchPan.id));
 if(extrusionDrag)endExtrusionDrag(cancelEvent(extrusionDrag.id));
 if(taperDrag)endTaperDrag(cancelEvent(taperDrag.id));
 if(splitDrag)endSplitDrag(cancelEvent(splitDrag.id));
 endCoilSplitDrag(null,false);endCoilStopFaceDrag(null,false);endCoilFilletDrag();
 if(arcDrag)clearArcDrag();
 down=null;sketchRightDown=null;escapePressed=false;hoverEdge=null;referencePointer=null;
 resetViewControls(controls.target.clone(),controls.enabled);host.style.cursor=sketch?'crosshair':'';
}
const redrawButton=document.createElement('button');redrawButton.id='redraw-view';redrawButton.type='button';redrawButton.textContent='↻ 再描画';redrawButton.title='画面の表示が崩れたときに再描画します';$('edges-toggle').after(redrawButton);
installRenderRecovery({renderer,scene,host,button:redrawButton,cancelInput:cancelCaptureInteraction,refreshGrids:()=>{modelGridKey='';sketchGridKey='';updateSketchGrid();}});
