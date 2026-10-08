import * as THREE from 'three';
// A separate overlay keeps the chosen point visible without changing hover snapping.
export function createSelectedPointMarker({host,canvas,camera}){
 const marker=document.createElement('div');marker.id='selected-point-marker';marker.hidden=true;marker.setAttribute('aria-label','選択した中心・中点');
 const dot=document.createElement('span'),label=document.createElement('small');dot.className='selected-point-dot';marker.append(dot,label);host.parentElement.append(marker);
 const style=document.createElement('style');style.textContent='#selected-point-actions{display:grid;gap:5px;pointer-events:auto}#selected-point-actions[hidden]{display:none}#selected-point-actions button{color:#234457;background:#e7f7ff;border:1px solid #7fb6d4;border-radius:5px;padding:7px 10px;font-size:12px}#selected-point-actions button:hover,#selected-point-actions button:focus-visible{background:#d0efff;outline:2px solid #087ca5}#selected-point-marker{position:absolute;z-index:16;pointer-events:none;transform:translate(-50%,-50%);color:#5e2e9b}#selected-point-marker[hidden]{display:none}#selected-point-marker .selected-point-dot{display:block;width:18px;height:18px;border-radius:50%;background:#9250dc;border:3px solid white;outline:2px solid #7034b2;box-shadow:0 2px 6px #0005}#selected-point-marker small{position:absolute;left:26px;top:0;white-space:nowrap;background:#fff9;padding:2px 5px;border-radius:3px;font-weight:bold}';document.head.append(style);
 return {update(reference,visible=true){
  marker.hidden=true;if(!reference||!visible){delete host.dataset.selectedPoint;return;}
  host.dataset.selectedPoint=JSON.stringify({point:reference.point,bodyId:reference.bodyId||null,kind:reference.kind});
  const p=new THREE.Vector3(...reference.point).project(camera),r=canvas.getBoundingClientRect(),parent=host.parentElement.getBoundingClientRect();
  if(p.z< -1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1)return;
  const x=(p.x+1)*r.width/2,y=(1-p.y)*r.height/2;
  marker.style.left=r.left-parent.left+x+'px';marker.style.top=r.top-parent.top+y+'px';
  label.textContent='選択した'+(reference.kind==='midpoint'?'中点':reference.kind==='intersection'?'交点':'中心');
  label.style.left=x>r.width-120?'auto':'26px';label.style.right=x>r.width-120?'26px':'auto';marker.hidden=false;
 }};
}
