import * as THREE from 'three';

export const splitAxes={XY:{axis:'z',u:[1,0,0],v:[0,1,0],n:[0,0,1]},XZ:{axis:'y',u:[1,0,0],v:[0,0,-1],n:[0,1,0]},YZ:{axis:'x',u:[0,0,-1],v:[0,1,0],n:[1,0,0]}};
export function splitDepths(box,plane,offset){const axis=splitAxes[plane].axis;return [offset-box.min[axis],box.max[axis]-offset];}

// The original solid and this transform stay fixed throughout an adjustment
// session, including when the print layout is rebuilt after a drag.
export function createBossSplitDrag({scene,host,camera,getControls,onStart,onMove,onCommit,onCancel}){
 const layer=document.createElement('div');layer.id='boss-split-overlay';Object.assign(layer.style,{position:'absolute',inset:'0',pointerEvents:'none',zIndex:'83'});host.append(layer);
 const button=document.createElement('button');button.type='button';button.id='boss-split-handle';button.textContent='↕ 分割面';button.setAttribute('aria-label','分割面を移動');button.title='ドラッグで分割位置を移動。矢印キーで1 mm、Shift＋矢印で0.1 mm。Escで移動を取り消し';Object.assign(button.style,{position:'absolute',pointerEvents:'auto',transform:'translate(-50%,-50%)',background:'#783cb0',color:'white',border:'2px solid white',borderRadius:'8px',padding:'8px 12px',cursor:'ns-resize',touchAction:'none',boxShadow:'0 2px 8px #0006',whiteSpace:'nowrap'});layer.append(button);
 let group=null,config=null,offset=0,drag=null,raf=0,planeMesh,outline,halves=[],anchor,normal;
 function project(point){const p=point.clone().project(camera);return {x:(p.x+1)*host.clientWidth/2,y:(1-p.y)*host.clientHeight/2,z:p.z};}
 function frame(){if(!group)return;camera.updateMatrixWorld();const p=project(anchor);button.hidden=p.z< -1||p.z>1;button.style.left=Math.max(65,Math.min(host.clientWidth-65,p.x))+'px';button.style.top=Math.max(25,Math.min(host.clientHeight-25,p.y))+'px';raf=requestAnimationFrame(frame);}
 function setOffset(value){if(!config||!Number.isFinite(value))return;offset=value;const basis=splitAxes[config.plane],n=new THREE.Vector3(...basis.n),center=config.box.getCenter(new THREE.Vector3());center[basis.axis]=offset;anchor=center.clone().applyMatrix4(config.transform);normal=n.clone().transformDirection(config.transform);
  planeMesh.position.copy(center);outline.position.copy(center);for(let i=0;i<2;i++)halves[i].material.clippingPlanes=[new THREE.Plane().setFromNormalAndCoplanarPoint(normal.clone().multiplyScalar(i?1:-1),anchor)];button.dataset.offset=String(offset);
 }
 function clamp(value){const {box,plane}=config,axis=splitAxes[plane].axis;return Number(Math.max(box.min[axis]+.1,Math.min(box.max[axis]-.1,Math.round(value*10)/10)).toFixed(4));}
 function restore(){if(!drag)return false;const old=drag;drag=null;getControls().enabled=old.enabled;setOffset(old.offset);onCancel(old.offset);if(button.hasPointerCapture(old.id))button.releasePointerCapture(old.id);return true;}
 function finish(e){if(!drag||drag.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();if(e.type!=='pointerup'){restore();return;}const old=drag;drag=null;getControls().enabled=old.enabled;if(button.hasPointerCapture(old.id))button.releasePointerCapture(old.id);onCommit(offset);}
 button.addEventListener('pointerdown',e=>{if(e.button!==0||e.shiftKey||!config)return;e.preventDefault();e.stopPropagation();document.activeElement?.blur();camera.updateMatrixWorld();const a=project(anchor),b=project(anchor.clone().add(normal));let dx=b.x-a.x,dy=b.y-a.y;
  // A face-on plane has no projected normal. Vertical dragging still gives a
  // predictable distance without rotating the camera to expose the normal.
  if(Math.hypot(dx,dy)<.5){dx=0;dy=-host.clientHeight*camera.zoom/(camera.top-camera.bottom);}
  drag={id:e.pointerId,x:e.clientX,y:e.clientY,dx,dy,offset,enabled:getControls().enabled};getControls().enabled=false;onStart();button.setPointerCapture(e.pointerId);
 });
 button.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();const d=((e.clientX-drag.x)*drag.dx+(e.clientY-drag.y)*drag.dy)/(drag.dx*drag.dx+drag.dy*drag.dy);setOffset(clamp(drag.offset+d));onMove(offset);});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,finish);
 button.addEventListener('keydown',e=>{const sign={ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1}[e.key];if(!sign||!config||drag)return;e.preventDefault();e.stopPropagation();onStart();setOffset(clamp(offset+sign*(e.shiftKey?.1:1)));onMove(offset);onCommit(offset);});
 function hide(){restore();cancelAnimationFrame(raf);if(group){scene.remove(group);group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}group=null;config=null;halves=[];layer.hidden=true;}
 function show(value){hide();config=value;group=new THREE.Group();group.matrixAutoUpdate=false;group.matrix.copy(config.transform);const basis=splitAxes[config.plane],size=config.box.getSize(new THREE.Vector3()),u=new THREE.Vector3(...basis.u),v=new THREE.Vector3(...basis.v),n=new THREE.Vector3(...basis.n),width=size.dot(u.clone().set(Math.abs(u.x),Math.abs(u.y),Math.abs(u.z)))+4,height=size.dot(v.clone().set(Math.abs(v.x),Math.abs(v.y),Math.abs(v.z)))+4;
  for(let i=0;i<2;i++){const mesh=new THREE.Mesh(config.geometry.clone(),new THREE.MeshStandardMaterial({color:i?0xe4aa55:0x6cafd2,roughness:.8,side:THREE.DoubleSide}));group.add(mesh);halves.push(mesh);}
  const rotation=new THREE.Matrix4().makeBasis(u,v,n),geo=new THREE.PlaneGeometry(width,height);planeMesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xa764d6,transparent:true,opacity:.32,side:THREE.DoubleSide,depthWrite:false}));planeMesh.setRotationFromMatrix(rotation);group.add(planeMesh);
  outline=new THREE.LineSegments(new THREE.EdgesGeometry(geo),new THREE.LineBasicMaterial({color:0x863bb9}));outline.setRotationFromMatrix(rotation);group.add(outline);scene.add(group);layer.hidden=false;button.disabled=false;setOffset(config.offset);frame();return new THREE.Box3().setFromObject(group);
 }
 hide();return {show,hide,setOffset,cancel:restore,setEnabled(value){button.disabled=!value;},get active(){return !!group;}};
}
