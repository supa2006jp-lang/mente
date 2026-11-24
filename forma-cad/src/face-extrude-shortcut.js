import * as THREE from 'three';
import {findPanelSpace} from './panel-placement.js';
import {createSketchExtrudeProjection,placeSketchExtrudeShortcut} from './sketch-extrude-placement.js';

// The shortcut only projects the selection; opening it uses the normal extrusion command.
export function createFaceExtrudeShortcut(options){
 const {host,canvas,camera,getSelection,getSelections,onExtrude,onWholeSketch,onUnextruded,onOffset,onDragStart,onDragMove,onDragEnd,id='face-extrude-shortcut'}=options;
 const projectSketch=options.projectSketch??createSketchExtrudeProjection(camera,options.getSketchObjects);
 if(getSelections){
  let selections=[];const shortcuts=[];
  return {cancel(){for(const shortcut of shortcuts)shortcut.cancel();},update(){
   selections=getSelections();
   while(shortcuts.length<selections.length){const index=shortcuts.length;shortcuts.push(createFaceExtrudeShortcut({...options,projectSketch,getSelections:null,getSelection:()=>selections[index]||null,id:index?'face-extrude-shortcut-'+(index+1):'face-extrude-shortcut'}));}
   const occupied=[];for(const shortcut of shortcuts)shortcut.update(occupied);
  }};
 }

 const button=document.createElement('button');
 button.id=id;button.className='face-extrude-shortcut';button.type='button';button.hidden=true;
 function companion(suffix,action,label,title,accessibleLabel){
  if(!action)return null;
  const element=document.createElement('button');
  element.id=id+'-'+suffix;element.className='face-extrude-companion face-'+suffix+'-shortcut';element.type='button';element.hidden=true;
  element.textContent=label;element.title=title;element.setAttribute('aria-label',accessibleLabel);
  for(const name of ['pointerdown','pointerup','dblclick','contextmenu'])element.addEventListener(name,event=>{event.stopPropagation();if(name==='contextmenu')event.preventDefault();});
  element.onclick=event=>{event.stopPropagation();const selection=getSelection();if(!selection)return;hide();action(selection);};
  return element;
 }
 const whole=companion('whole-sketch',onWholeSketch,'スケッチ全体','ソリッドと重なる部分も含めて元の輪郭全体を押し出します','スケッチ全体を押し出す');
 const remaining=companion('unextruded',onUnextruded,'未押出のみ','既存ソリッドと重なる部分を除き、スケッチの残りだけを押し出します','未押出のみ：スケッチの未押し出し部分だけを押し出す');
 const offset=companion('offset',onOffset,'OS押出','輪郭を指定したmmだけ狭く・広くして押し出す','OS押出：輪郭をオフセットして押し出す');
 const companions=[whole,remaining,offset].filter(Boolean);
 button.innerHTML='<svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true"><path d="M4 16l8-4 8 4-8 4zM4 16v4l8 3 8-3v-4M12 13V2m-4 4 4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>';
 // Sketch constraint strokes use layer 105. The selection picker opens at 110.
 if(!document.getElementById('face-extrude-shortcut-style')){const style=document.createElement('style');style.id='face-extrude-shortcut-style';
 style.textContent=`
 .face-extrude-shortcut,.face-extrude-companion{position:absolute;z-index:106;display:grid;place-items:center;box-sizing:border-box;width:34px;height:34px;padding:3px;border:2px solid white;border-radius:8px;background:#087fa1;color:white;box-shadow:0 2px 7px #0005;cursor:pointer;touch-action:none}
 .face-extrude-companion{font-size:11px;white-space:nowrap}
 .face-extrude-shortcut[hidden],.face-extrude-companion[hidden]{display:none}
 .face-extrude-shortcut:hover{background:#056584}
 .face-whole-sketch-shortcut{width:88px;background:#265995}.face-whole-sketch-shortcut:hover{background:#1a4478}
 .face-unextruded-shortcut{width:78px;background:#226d58}.face-unextruded-shortcut:hover{background:#15513f}
 .face-offset-shortcut{width:64px;background:#68518f}.face-offset-shortcut:hover{background:#4d376e}
 .face-extrude-shortcut:focus-visible,.face-extrude-companion:focus-visible{outline:3px solid #f0ad36;outline-offset:2px}`;
 document.head.append(style);}host.parentElement.append(button,...companions);
 function hide(){button.hidden=true;for(const element of companions)element.hidden=true;}
 let gesture=null,suppressClick=false;
 function finish(event){
  if(!gesture||event.pointerId!==gesture.id)return;
  const previous=gesture;gesture=null;button.style.opacity='';delete button.dataset.dragging;
  if(previous.started){suppressClick=true;onDragEnd?.(event);hide();}
  else if(event.type!=='pointerup')suppressClick=true;
  if(button.hasPointerCapture(event.pointerId))button.releasePointerCapture(event.pointerId);
 }
 button.addEventListener('pointerdown',event=>{
  event.stopPropagation();if(event.button!==0||!getSelection()||gesture)return;
  event.preventDefault();suppressClick=false;gesture={id:event.pointerId,x:event.clientX,y:event.clientY,selection:getSelection(),started:false};button.setPointerCapture(event.pointerId);
 });
 button.addEventListener('pointermove',event=>{
  if(!gesture||event.pointerId!==gesture.id)return;event.preventDefault();event.stopPropagation();
  if(!gesture.started){
   if(Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)<=4)return;
   if(getSelection()!==gesture.selection||!onDragStart?.(event,button,{x:gesture.x,y:gesture.y},gesture.selection)){finish({...event,pointerId:event.pointerId,type:'pointercancel'});return;}
   gesture.started=true;button.dataset.dragging='true';button.style.opacity='0';
  }
  onDragMove?.(event);
 });
 for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,event=>{event.stopPropagation();finish(event);});
 for(const name of ['dblclick','contextmenu'])button.addEventListener(name,event=>{event.stopPropagation();if(name==='contextmenu')event.preventDefault();});
 button.onclick=event=>{event.stopPropagation();if(event.detail!==0&&suppressClick){suppressClick=false;return;}const selection=getSelection();if(!selection)return;hide();onExtrude(selection);};
 function cancel(){if(gesture)finish({pointerId:gesture.id,type:'pointercancel'});}
 window.addEventListener('blur',cancel);
 const projected=new THREE.Vector3();
 let sketchPlacement=null;
 return {cancel,update(occupied=[]){
  // Keep the captured element alive until release. The normal extrusion arrow
  // supplies the visible feedback while the shortcut itself stays transparent.
  if(gesture?.started){for(const element of companions)element.hidden=true;return;}
  const selection=getSelection();
  if(gesture&&selection!==gesture.selection)cancel();
  if(!selection){hide();return;}
  const regions=selection.sketchRegion?[selection.sketchRegion]:selection.sketchRegions??[];
  const showWhole=!!whole&&(selection.sketchHasPartitions||regions.some(region=>region.overlapSource));
  const paired=!!remaining&&regions.length>0;
  projected.fromArray(selection.point).project(camera);
  if(!Number.isFinite(projected.x)||!Number.isFinite(projected.y)||projected.z< -1||projected.z>1||
   !regions.length&&(Math.abs(projected.x)>1||Math.abs(projected.y)>1)){hide();return;}
  const rect=canvas.getBoundingClientRect(),parent=host.parentElement.getBoundingClientRect();
  const x=(projected.x+1)*rect.width/2,y=(1-projected.y)*rect.height/2,size=34,gap=6;
  const buttons=[[button,size],...(showWhole?[[whole,88]]:[]),...(paired?[[remaining,78]]:[]),...(offset?[[offset,64]]:[])];
  const rowWidth=buttons.reduce((sum,[,width])=>sum+width+gap,-gap);
  const stackWidth=Math.max(...buttons.map(([,width])=>width)),stackHeight=buttons.length*(size+gap)-gap;
  const controls=[...host.parentElement.querySelectorAll('#measurement,#selection-candidates,.view-cube,#reference-plane-control,#snap-controls')];
  if(regions.length)controls.push(...host.parentElement.querySelectorAll('#sketch-banner,.navigation,.sketch-dim-field,#circle-dimensions,#polygon-dimensions'),document.getElementById('sketch-constraint-quick'));
  const obstacles=controls.filter(node=>node&&!node.hidden&&node.getClientRects().length).map(node=>node.getBoundingClientRect())
   .concat(occupied).map(r=>({left:r.left-rect.left,top:r.top-rect.top,right:r.right-rect.left,bottom:r.bottom-rect.top}));
  const space={width:rect.width,height:rect.height,panelWidth:rowWidth,panelHeight:size,anchor:{x,y},obstacles};
  let spot,stacked=false;
  if(regions.length){
   const projection=projectSketch(rect.width,rect.height);
   const obstacleKey=obstacles.map(r=>[r.left,r.top,r.right,r.bottom].join(',')).join('/');
   if(sketchPlacement?.selection!==selection||sketchPlacement.projection!==projection||sketchPlacement.obstacleKey!==obstacleKey){
    const input={...space,outlines:regions.map(region=>projection.outline(region.overlapSource||region)),strokes:projection.strokes};
    spot=placeSketchExtrudeShortcut(input);
    if(!spot&&buttons.length>1){
     spot=placeSketchExtrudeShortcut({...input,panelWidth:stackWidth,panelHeight:stackHeight});
     stacked=!!spot;
    }
    sketchPlacement={selection,projection,obstacleKey,spot,stacked};
   }else ({spot,stacked}=sketchPlacement);
  }else{
   const spots=[[x+22,y-size-16],[x-rowWidth-22,y-size-16],[x+22,y+16],[x-rowWidth-22,y+16]]
    .map(([x,y])=>({x:Math.max(5,Math.min(x,rect.width-rowWidth-5)),y:Math.max(5,Math.min(y,rect.height-size-5))}));
   if(rect.width>=rowWidth+10&&rect.height>=size+10){
    spot=spots.find(({x,y})=>!obstacles.some(r=>x<r.right+4&&x+rowWidth>r.left-4&&y<r.bottom+4&&y+size>r.top-4))
     ??findPanelSpace({...space,margin:5,gap:4});
   }
  }
  if(!spot){hide();return;}
  const left=rect.left-parent.left+spot.x,top=rect.top-parent.top+spot.y;
  let step=0;
  for(const [element,width] of buttons){
   element.style.left=(left+(stacked?(stackWidth-width)/2:step))+'px';
   element.style.top=(top+(stacked?step:0))+'px';
   step+=(stacked?size:width)+gap;
  }
  if(whole)whole.hidden=!showWhole;if(remaining)remaining.hidden=!paired;if(offset)offset.hidden=false;
  const label=selection.label||(selection.count>1?'選択した'+selection.count+'面をまとめて押し出す':'選択した面を押し出す');
  button.title=label+' — クリックで開始／ドラッグで距離を調整';button.setAttribute('aria-label',label);button.dataset.count=String(selection.count);if(selection.sketchRegion)button.dataset.regionId=selection.sketchRegion.id;else delete button.dataset.regionId;button.hidden=false;
  occupied.push({left:rect.left+spot.x,top:rect.top+spot.y,
   right:rect.left+spot.x+(stacked?stackWidth:rowWidth),bottom:rect.top+spot.y+(stacked?stackHeight:size)});
 }};
}
