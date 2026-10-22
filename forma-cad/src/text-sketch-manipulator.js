import * as THREE from 'three';
import {textLocalCenter,textMoveToSurface,textPlacementMatrix} from './text-surface-placement.js';
import {snapTextToFace} from './text-face-layout.js';

export function textBoxCorners(layout){
 const {min,max}=layout.localBounds,a=layout.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 return [[min[0],min[1]],[max[0],min[1]],[max[0],max[1]],[min[0],max[1]]].map(([x,y])=>[layout.u+x*c-y*s,layout.v+x*s+y*c]);
}
export function textDragMove(layout,delta,{enabled=false,step=0,shift=false}={}){
 const snap=x=>enabled&&!shift&&step>0?(Math.round(x/step)*step||0):x;
 return {u:snap(layout.u+delta[0]),v:snap(layout.v+delta[1]),height:layout.height,spacing:layout.spacing,scale:1};
}
export function textDragScale(layout,corner,delta,{shift=false}={}){
 const corners=textBoxCorners(layout),fixed=corners[(corner+2)%4],moving=corners[corner],diagonal=moving.map((n,i)=>n-fixed[i]),length=diagonal[0]**2+diagonal[1]**2;
 if(!(length>1e-12))throw Error('文字のサイズを取得できません');
 const raw=1+(delta[0]*diagonal[0]+delta[1]*diagonal[1])*(shift?.1:1)/length,max=Math.min(500/layout.height,layout.spacing>0?100/layout.spacing:Infinity),scale=Math.max(1/layout.height,Math.min(max,raw));
 return {u:fixed[0]+(layout.u-fixed[0])*scale,v:fixed[1]+(layout.v-fixed[1])*scale,height:layout.height*scale,spacing:layout.spacing*scale,scale,fixed};
}
export function textDragRotate(layout,start,point,{shift=false}={}){
 const local=textLocalCenter(layout),center=[layout.u+local[0],layout.v+local[1]],a=start.map((x,i)=>x-center[i]),b=point.map((x,i)=>x-center[i]);if(Math.hypot(...a)<1e-8||Math.hypot(...b)<1e-8)return {...layout,scale:1};
 let angle=layout.angle+Math.atan2(a[0]*b[1]-a[1]*b[0],a[0]*b[0]+a[1]*b[1])*180/Math.PI;if(!shift)angle=Math.round(angle/15)*15;angle=((angle+180)%360+360)%360-180;const next=textLocalCenter({...layout,angle});return {u:center[0]-next[0],v:center[1]-next[1],height:layout.height,spacing:layout.spacing,angle,scale:1};
}

export function createTextSketchManipulator({camera,canvas,host,getState,getSnap,getControls,getSurface=()=>null,getFaceOptions=()=>({enabled:false}),onStart,onTransform,onEnd}){
 const parent=host.parentElement,svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),outline=document.createElementNS(svg.namespaceURI,'polygon');svg.id='text-sketch-bounds';svg.setAttribute('aria-hidden','true');svg.append(outline);parent.append(svg);
 const move=document.createElement('button');move.id='text-sketch-drag';move.type='button';move.textContent='↔ 移動';move.title='ドラッグして文字を移動';move.setAttribute('aria-label','文字をドラッグして移動');parent.append(move);
 const corners=Array.from({length:4},(_,i)=>{const b=document.createElement('button');b.id='text-sketch-corner-'+i;b.type='button';b.dataset.corner=i;b.title='ドラッグして比率を保って拡大縮小（Shiftで微調整）';b.setAttribute('aria-label','文字の角'+(i+1)+'をドラッグして拡大縮小');parent.append(b);return b;});
 const rotate=document.createElement('button');rotate.id='text-sketch-rotate';rotate.type='button';rotate.title='ドラッグして文字を回転（15°刻み・Shiftで自由回転）';rotate.setAttribute('aria-label','文字をドラッグして回転');parent.append(rotate);
 const rotationStyle=document.createElement('style');rotationStyle.textContent='#text-sketch-rotate{position:absolute;z-index:65;transform:translate(-50%,-50%);padding:5px 8px;border:1px solid #b77b17;border-radius:20px;background:#fff5d5d9;color:#805408;font-size:12px;cursor:grab;touch-action:none}#text-sketch-rotate[hidden]{display:none}#text-sketch-rotate[data-snapped=true]{background:#caffdfd9;border-color:#07865f;color:#065f46}';document.head.append(rotationStyle);
 const style=document.createElement('style');style.textContent='#text-sketch-bounds{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:60;overflow:visible}#text-sketch-bounds polygon{fill:none;stroke:#087e9e;stroke-width:1.2;stroke-dasharray:5 4}#text-sketch-drag,.text-sketch-corner{position:absolute;z-index:65;transform:translate(-50%,-50%);touch-action:none}#text-sketch-drag{padding:4px 9px;font-size:12px;background:#087e9e30;color:#06485e;border:1px solid #087e9e;border-radius:6px;cursor:grab;text-shadow:0 1px 2px white}#text-sketch-drag:active{cursor:grabbing}#text-sketch-drag[data-snapped=true]{background:#07865f33;color:#065f46;border-color:#07865f}.text-sketch-corner{width:16px;height:16px;min-width:0;padding:0;border:2px solid #087e9e;border-radius:4px;background:#ffffffc9;box-shadow:0 1px 4px #1233}.text-sketch-corner:nth-of-type(odd){cursor:nwse-resize}.text-sketch-corner:nth-of-type(even){cursor:nesw-resize}#text-sketch-drag:focus-visible,.text-sketch-corner:focus-visible{outline:3px solid #f0ad36;outline-offset:2px}#text-sketch-bounds[hidden],#text-sketch-drag[hidden],.text-sketch-corner[hidden]{display:none}';document.head.append(style);corners.forEach(b=>b.className='text-sketch-corner');
 const ray=new THREE.Raycaster();let drag=null;
 // SVGElement has no reflected `hidden` property; use the attribute so CSS hides it.
 function hide(){svg.setAttribute('hidden','');outline.setAttribute('points','');move.hidden=rotate.hidden=true;corners.forEach(b=>b.hidden=true);}
 function world(placement,p){return new THREE.Vector3(...placement.frame.u).multiplyScalar(p[0]).addScaledVector(new THREE.Vector3(...placement.frame.v),p[1]).addScaledVector(new THREE.Vector3(...placement.frame.n),placement.offset);}
 function pointAt(event,state){const r=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2),camera);const hit=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(...state.placement.frame.n),-state.placement.offset),new THREE.Vector3());return hit?[hit.dot(new THREE.Vector3(...state.placement.frame.u)),hit.dot(new THREE.Vector3(...state.placement.frame.v))]:null;}
 function displayLayout(){if(!drag)return getState()?.layout;const original=drag.state.layout,n=drag.values;return {...original,...n,localContours:n.scale===1?original.localContours:original.localContours?.map(r=>({...r,points:r.points.map(p=>p.map(x=>x*n.scale))})),localBounds:{min:original.localBounds.min.map(x=>x*n.scale),max:original.localBounds.max.map(x=>x*n.scale)}};}
 function update(){
  const state=drag?{...drag.state,placement:drag.placement}:getState(),layout=displayLayout();if(!state||!layout){hide();return;}
  const cr=canvas.getBoundingClientRect(),pr=parent.getBoundingClientRect(),project=p=>{const q=world(state.placement,p).project(camera);return {x:cr.left-pr.left+(q.x+1)*cr.width/2,y:cr.top-pr.top+(1-q.y)*cr.height/2,z:q.z};},points=textBoxCorners(layout).map(project);
  if(points.every(p=>p.z< -1||p.z>1)){hide();return;}svg.removeAttribute('hidden');outline.setAttribute('points',points.map(p=>p.x+','+p.y).join(' '));
  for(let i=0;i<4;i++){const p=points[i],b=corners[i];b.hidden=p.x<cr.left-pr.left+5||p.x>cr.right-pr.left-5||p.y<cr.top-pr.top+5||p.y>cr.bottom-pr.top-5;b.style.left=p.x+'px';b.style.top=p.y+'px';b.disabled=state.disabled&&!drag;}
  // Keep rotation above the screen bounds and translation below, on every workplane.
  const rx=(Math.min(...points.map(p=>p.x))+Math.max(...points.map(p=>p.x)))/2,ry=Math.min(...points.map(p=>p.y))-34;rotate.hidden=rx<cr.left-pr.left+25||rx>cr.right-pr.left-25||ry<cr.top-pr.top+15||ry>cr.bottom-pr.top-15;rotate.style.left=rx+'px';rotate.style.top=ry+'px';rotate.textContent='↻ '+Number(layout.angle.toFixed(1))+'°';rotate.disabled=state.disabled&&!drag;
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);move.hidden=false;move.style.left=Math.max(cr.left-pr.left+45,Math.min(cr.right-pr.left-45,(Math.min(...xs)+Math.max(...xs))/2))+'px';move.style.top=Math.max(cr.top-pr.top+18,Math.min(cr.bottom-pr.top-18,Math.max(...ys)+25))+'px';move.disabled=state.disabled&&!drag;
 }
 function stop(cancelled=false){
  if(!drag)return;const d=drag;drag=null;getControls().enabled=d.controls;if(d.owner.hasPointerCapture(d.id))d.owner.releasePointerCapture(d.id);delete host.dataset.textSketchGesture;move.dataset.snapped=rotate.dataset.snapped='false';delete move.dataset.surface;onEnd({cancelled,kind:d.corner==='rotate'?'rotate':d.corner===null?'move':'resize',initial:d.state.layout,placement:cancelled?d.state.placement:d.placement,values:cancelled?{u:d.state.layout.u,v:d.state.layout.v,height:d.state.layout.height,spacing:d.state.layout.spacing,angle:d.state.layout.angle}:d.values,moved:d.moved});update();
 }
 function down(event,owner,corner=null){
  const state=getState();if(!state||state.disabled||event.button!==0||drag)return;const start=pointAt(event,state);if(!start)return;
  if(owner===canvas){state.preview.updateMatrixWorld(true);if(!ray.intersectObject(state.preview,true).length)return;}
  event.preventDefault();event.stopImmediatePropagation();document.activeElement?.blur();drag={state,placement:state.placement,start,owner,id:event.pointerId,corner,x:event.clientX,y:event.clientY,controls:getControls().enabled,moved:false,values:{u:state.layout.u,v:state.layout.v,height:state.layout.height,spacing:state.layout.spacing,angle:state.layout.angle,scale:1}};getControls().enabled=false;owner.setPointerCapture(event.pointerId);onStart();host.dataset.textSketchGesture=corner==='rotate'?'rotate':corner===null?'move':'resize';
 }
 function pointerMove(event){
  if(!drag||event.pointerId!==drag.id)return;event.preventDefault();event.stopImmediatePropagation();if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<3)return;const point=pointAt(event,drag.state);if(!point)return;const delta=point.map((x,i)=>x-drag.start[i]),snap={...getSnap(),shift:event.shiftKey};let values=drag.corner==='rotate'?textDragRotate(drag.state.layout,drag.start,point,{shift:event.shiftKey}):drag.corner===null?textDragMove(drag.state.layout,delta,snap):textDragScale(drag.state.layout,drag.corner,delta,{shift:event.shiftKey}),placement=drag.state.placement,surface=null;
  let unsnapped=null;if(drag.corner===null){const center=textLocalCenter(drag.state.layout),free=textDragMove(drag.state.layout,delta),projected=world(placement,[free.u+center[0],free.v+center[1]]).project(camera),rect=canvas.getBoundingClientRect();surface=getSurface({clientX:rect.left+(projected.x+1)*rect.width/2,clientY:rect.top+(1-projected.y)*rect.height/2,frame:placement.frame});unsnapped=free;if(surface){placement=surface.placement;unsnapped=textMoveToSurface(drag.state.layout,surface);values=textMoveToSurface(drag.state.layout,surface,snap);}}
  let guides=[];if(drag.corner===null&&placement.face){const faceOptions=getFaceOptions(),matched=snapTextToFace({...drag.state.layout,...unsnapped},placement.face,{...faceOptions,enabled:faceOptions.enabled&&!event.shiftKey});guides=matched.guides;for(const guide of guides){const key=guide.axis===0?'u':'v';values[key]=matched[key];}}
  if(![values.u,values.v].every(n=>Number.isFinite(n)&&Math.abs(n)<=10000))return;drag.values=values;drag.placement=placement;drag.moved=true;
  const matrix=textPlacementMatrix(drag.state.layout,drag.state.placement,values,placement);
  move.dataset.snapped=String(drag.corner===null&&(guides.length||getSnap().enabled)&&!event.shiftKey);move.dataset.surface=String(!!surface);rotate.dataset.snapped=String(drag.corner==='rotate'&&!event.shiftKey);onTransform({values,matrix,layout:displayLayout(),placement,guides,kind:drag.corner==='rotate'?'rotate':drag.corner===null?'move':'resize'});update();
 }
 move.addEventListener('pointerdown',e=>down(e,move));rotate.addEventListener('pointerdown',e=>down(e,rotate,'rotate'));corners.forEach((b,i)=>b.addEventListener('pointerdown',e=>down(e,b,i)));
 // Own text gestures before the canvas's Shift-orbit and selection handlers.
 document.addEventListener('pointerdown',e=>{if(e.target===canvas)down(e,canvas);},true);
 document.addEventListener('pointermove',e=>{if(drag?.owner===canvas)pointerMove(e);},true);
 for(const type of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,e=>{if(drag?.owner!==canvas||e.pointerId!==drag.id)return;e.preventDefault();e.stopImmediatePropagation();stop(type!=='pointerup');},true);
 for(const element of [move,rotate,...corners]){element.addEventListener('pointermove',pointerMove,true);for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,e=>{if(!drag||e.pointerId!==drag.id)return;e.preventDefault();e.stopImmediatePropagation();stop(type!=='pointerup');},true);}
 for(const b of [move,rotate,...corners])b.onclick=e=>{e.preventDefault();e.stopPropagation();};
 window.addEventListener('blur',()=>stop(true));
 hide();return {update,cancel(){if(drag)stop(true);hide();},get active(){return !!drag;}};
}
