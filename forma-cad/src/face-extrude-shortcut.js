import * as THREE from 'three';

// The shortcut only projects the selection; opening it uses the normal extrusion command.
export function createFaceExtrudeShortcut({host,canvas,camera,getSelection,onExtrude}){
 const button=document.createElement('button');
 button.id='face-extrude-shortcut';button.type='button';button.hidden=true;
 button.innerHTML='<svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true"><path d="M4 16l8-4 8 4-8 4zM4 16v4l8 3 8-3v-4M12 13V2m-4 4 4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>';
 const style=document.createElement('style');
 style.textContent='#face-extrude-shortcut{position:absolute;z-index:18;display:grid;place-items:center;width:34px;height:34px;padding:3px;border:2px solid white;border-radius:8px;background:#087fa1;color:white;box-shadow:0 2px 7px #0005;cursor:pointer;touch-action:none}#face-extrude-shortcut[hidden]{display:none}#face-extrude-shortcut:hover{background:#056584}#face-extrude-shortcut:focus-visible{outline:3px solid #f0ad36;outline-offset:2px}';
 document.head.append(style);host.parentElement.append(button);
 for(const name of ['pointerdown','pointerup','dblclick','contextmenu'])button.addEventListener(name,event=>{event.stopPropagation();if(name==='contextmenu')event.preventDefault();});
 button.onclick=event=>{event.stopPropagation();if(!getSelection())return;button.hidden=true;onExtrude();};
 const projected=new THREE.Vector3();
 return {update(){
  const selection=getSelection();
  if(!selection){button.hidden=true;return;}
  projected.fromArray(selection.point).project(camera);
  if(!Number.isFinite(projected.x)||projected.z< -1||projected.z>1||Math.abs(projected.x)>1||Math.abs(projected.y)>1){button.hidden=true;return;}
  const rect=canvas.getBoundingClientRect(),parent=host.parentElement.getBoundingClientRect();
  const x=(projected.x+1)*rect.width/2,y=(1-projected.y)*rect.height/2,size=34;
  // Keep it close to the picked point, inside the canvas and clear of floating controls.
  const obstacles=[...host.parentElement.querySelectorAll('#measurement,#selection-candidates,.view-cube,#reference-plane-control,#snap-controls')].filter(node=>!node.hidden&&node.getClientRects().length).map(node=>node.getBoundingClientRect());
  const spots=[[x+22,y-size-16],[x-size-22,y-size-16],[x+22,y+16],[x-size-22,y+16]].map(([left,top])=>({left:Math.max(5,Math.min(left,rect.width-size-5)),top:Math.max(5,Math.min(top,rect.height-size-5))}));
  const spot=spots.find(({left,top})=>!obstacles.some(r=>rect.left+left<r.right+4&&rect.left+left+size>r.left-4&&rect.top+top<r.bottom+4&&rect.top+top+size>r.top-4));
  if(!spot||rect.width<size+10||rect.height<size+10){button.hidden=true;return;}
  button.style.left=rect.left-parent.left+spot.left+'px';button.style.top=rect.top-parent.top+spot.top+'px';
  const label=selection.count>1?'選択した'+selection.count+'面をまとめて押し出す':'選択した面を押し出す';
  button.title=label;button.setAttribute('aria-label',label);button.dataset.count=String(selection.count);button.hidden=false;
 }};
}
