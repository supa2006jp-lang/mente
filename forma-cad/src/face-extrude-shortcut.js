import * as THREE from 'three';
import {findPanelSpace} from './panel-placement.js';

// The shortcut only projects the selection; opening it uses the normal extrusion command.
export function createFaceExtrudeShortcut(options){
 const {host,canvas,camera,getSelection,getSelections,onExtrude,onDragStart,onDragMove,onDragEnd,id='face-extrude-shortcut'}=options;
 if(getSelections){
  let selections=[];const shortcuts=[];
  return {cancel(){for(const shortcut of shortcuts)shortcut.cancel();},update(){
   selections=getSelections();
   while(shortcuts.length<selections.length){const index=shortcuts.length;shortcuts.push(createFaceExtrudeShortcut({...options,getSelections:null,getSelection:()=>selections[index]||null,id:index?'face-extrude-shortcut-'+(index+1):'face-extrude-shortcut'}));}
   const occupied=[];for(const shortcut of shortcuts)shortcut.update(occupied);
  }};
 }

 const button=document.createElement('button');
 button.id=id;button.className='face-extrude-shortcut';button.type='button';button.hidden=true;
 button.innerHTML='<svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true"><path d="M4 16l8-4 8 4-8 4zM4 16v4l8 3 8-3v-4M12 13V2m-4 4 4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>';
 if(!document.getElementById('face-extrude-shortcut-style')){const style=document.createElement('style');style.id='face-extrude-shortcut-style';
 style.textContent='.face-extrude-shortcut{position:absolute;z-index:18;display:grid;place-items:center;width:34px;height:34px;padding:3px;border:2px solid white;border-radius:8px;background:#087fa1;color:white;box-shadow:0 2px 7px #0005;cursor:pointer;touch-action:none}.face-extrude-shortcut[hidden]{display:none}.face-extrude-shortcut:hover{background:#056584}.face-extrude-shortcut:focus-visible{outline:3px solid #f0ad36;outline-offset:2px}';
 document.head.append(style);}host.parentElement.append(button);
 let gesture=null,suppressClick=false;
 function finish(event){
  if(!gesture||event.pointerId!==gesture.id)return;
  const previous=gesture;gesture=null;button.style.opacity='';delete button.dataset.dragging;
  if(previous.started){suppressClick=true;onDragEnd?.(event);button.hidden=true;}
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
 button.onclick=event=>{event.stopPropagation();if(event.detail!==0&&suppressClick){suppressClick=false;return;}const selection=getSelection();if(!selection)return;button.hidden=true;onExtrude(selection);};
 function cancel(){if(gesture)finish({pointerId:gesture.id,type:'pointercancel'});}
 window.addEventListener('blur',cancel);
 const projected=new THREE.Vector3();
 return {cancel,update(occupied=[]){
  // Keep the captured element alive until release. The normal extrusion arrow
  // supplies the visible feedback while the shortcut itself stays transparent.
  if(gesture?.started)return;
  const selection=getSelection();
  if(gesture&&selection!==gesture.selection)cancel();
  if(!selection){button.hidden=true;return;}
  projected.fromArray(selection.point).project(camera);
  if(!Number.isFinite(projected.x)||projected.z< -1||projected.z>1||Math.abs(projected.x)>1||Math.abs(projected.y)>1){button.hidden=true;return;}
  const rect=canvas.getBoundingClientRect(),parent=host.parentElement.getBoundingClientRect();
  const x=(projected.x+1)*rect.width/2,y=(1-projected.y)*rect.height/2,size=34;
  // Keep it close to the picked point, inside the canvas and clear of floating controls.
  const obstacles=[...host.parentElement.querySelectorAll('#measurement,#selection-candidates,.view-cube,#reference-plane-control,#snap-controls')].filter(node=>!node.hidden&&node.getClientRects().length).map(node=>node.getBoundingClientRect()).concat(occupied);
  const spots=[[x+22,y-size-16],[x-size-22,y-size-16],[x+22,y+16],[x-size-22,y+16]].map(([left,top])=>({left:Math.max(5,Math.min(left,rect.width-size-5)),top:Math.max(5,Math.min(top,rect.height-size-5))}));
  let spot=spots.find(({left,top})=>!obstacles.some(r=>rect.left+left<r.right+4&&rect.left+left+size>r.left-4&&rect.top+top<r.bottom+4&&rect.top+top+size>r.top-4));
  if(!spot)spot=findPanelSpace({width:rect.width,height:rect.height,panelWidth:size,panelHeight:size,anchor:{x,y},margin:5,gap:4,obstacles:obstacles.map(r=>({left:r.left-rect.left,top:r.top-rect.top,right:r.right-rect.left,bottom:r.bottom-rect.top}))});if(spot&&spot.x!=null)spot={left:spot.x,top:spot.y};
  if(!spot||rect.width<size+10||rect.height<size+10){button.hidden=true;return;}
  button.style.left=rect.left-parent.left+spot.left+'px';button.style.top=rect.top-parent.top+spot.top+'px';
  const label=selection.label||(selection.count>1?'選択した'+selection.count+'面をまとめて押し出す':'選択した面を押し出す');
  button.title=label+' — クリックで開始／ドラッグで距離を調整';button.setAttribute('aria-label',label);button.dataset.count=String(selection.count);if(selection.sketchRegion)button.dataset.regionId=selection.sketchRegion.id;else delete button.dataset.regionId;button.hidden=false;occupied.push({left:rect.left+spot.left,top:rect.top+spot.top,right:rect.left+spot.left+size,bottom:rect.top+spot.top+size});
 }};
}
