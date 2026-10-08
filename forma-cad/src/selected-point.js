import * as THREE from 'three';
// A separate overlay keeps the chosen point visible without changing hover snapping.
export function pointReferenceLabel(reference,getBodyName=id=>id){
 if(!reference)return '';
 let location=reference.kind==='midpoint'?'辺の中点':reference.kind==='intersection'?'交点':reference.name==='ヒンジ軸中心'?'ヒンジ軸中心':(reference.name||'図形')+'の中心';
 if(reference.kind==='center'&&reference.name==='ソリッド面'){
  const [x,y,z]=reference.normal||[0,0,1],face=reference.faceName||(z>.999?'上面':z<-.999?'底面':Math.abs(x)>.999?'側面（X'+(x>0?'＋':'−')+'）':Math.abs(y)>.999?'側面（Y'+(y>0?'＋':'−')+'）':'斜面');location=face+'の中心';
 }
 return (reference.bodyId?getBodyName(reference.bodyId)+' · ':'')+location;
}
export function createSelectedPointMarker({host,canvas,camera,getBodyName,onActivate}){
 const marker=document.createElement('button');marker.type='button';marker.id='selected-point-marker';marker.onclick=()=>onActivate?.();marker.hidden=true;marker.setAttribute('aria-label','選択した中心・中点');
 const dot=document.createElement('span'),label=document.createElement('small');dot.className='selected-point-dot';marker.append(dot,label);host.parentElement.append(marker);
 const style=document.createElement('style');style.textContent='#selected-point-actions{display:grid;gap:5px;pointer-events:auto}#selected-point-actions[hidden]{display:none}#selected-point-actions button{color:#234457;background:#e7f7ff;border:1px solid #7fb6d4;border-radius:5px;padding:7px 10px;font-size:12px}#selected-point-actions button:hover,#selected-point-actions button:focus-visible{background:#d0efff;outline:2px solid #087ca5}#selected-point-marker{position:absolute;z-index:16;pointer-events:auto;transform:translate(-50%,-50%);color:#5e2e9b;padding:0;border:0;background:none;width:18px;height:18px;cursor:pointer}#selected-point-marker[hidden]{display:none}#selected-point-marker:focus-visible{outline:3px solid #7034b2;outline-offset:4px}#selected-point-marker .selected-point-dot{display:block;width:18px;height:18px;border-radius:50%;background:#9250dc;border:3px solid white;outline:2px solid #7034b2;box-shadow:0 2px 6px #0005}#selected-point-marker small{position:absolute;left:26px;top:0;white-space:nowrap;max-width:220px;overflow:hidden;text-overflow:ellipsis;pointer-events:none;background:#fff9;padding:2px 5px;border-radius:3px;font-weight:bold}';document.head.append(style);
 return {update(reference,visible=true){
  if(!reference||!visible){marker.hidden=true;delete host.dataset.selectedPoint;return;}
  host.dataset.selectedPoint=JSON.stringify({point:reference.point,bodyId:reference.bodyId||null,kind:reference.kind});
  const p=new THREE.Vector3(...reference.point).project(camera),r=canvas.getBoundingClientRect(),parent=host.parentElement.getBoundingClientRect();
  if(p.z< -1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1){marker.hidden=true;return;}
  const x=(p.x+1)*r.width/2,y=(1-p.y)*r.height/2;
  marker.style.left=r.left-parent.left+x+'px';marker.style.top=r.top-parent.top+y+'px';
  label.textContent=pointReferenceLabel(reference,getBodyName);marker.title=label.textContent+' — クリックして操作を再開';marker.setAttribute('aria-label',marker.title);
  marker.hidden=false;const onLeft=x+Math.min(220,label.scrollWidth)+26>r.width;label.style.left=onLeft?'auto':'26px';label.style.right=onLeft?'26px':'auto';
 }};
}
