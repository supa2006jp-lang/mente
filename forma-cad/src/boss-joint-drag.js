import * as THREE from 'three';
import {moveBossJoint,bossJointPoint,bossJointTransform} from './boss-joint-layout.js';

export function createBossJointDrag({host,camera,getControls,getSymmetric,onStart,onMove,onCommit,onCancel}){
 const layer=document.createElement('div');layer.id='boss-joint-handles';Object.assign(layer.style,{position:'absolute',inset:'0',pointerEvents:'none',zIndex:'82'});host.append(layer);
 let analysis=null,buttons=[],drag=null,raf=0;const raycaster=new THREE.Raycaster();
 function project(point){const p=point.project(camera);return {x:(p.x+1)*host.clientWidth/2,y:(1-p.y)*host.clientHeight/2,z:p.z};}
 function pointerUV(e,part){const rect=host.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);
  const transform=bossJointTransform(analysis,part),normal=new THREE.Vector3(...analysis.frame.n).transformDirection(transform),origin=bossJointPoint(analysis,[0,0],part),point=raycaster.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(normal,origin),new THREE.Vector3());
  if(!point)return null;point.applyMatrix4(transform.invert());return [point.dot(new THREE.Vector3(...analysis.frame.u)),point.dot(new THREE.Vector3(...analysis.frame.v))];
 }
 function updateFrame(){if(!analysis)return;camera.updateMatrixWorld();for(const b of buttons){const i=Number(b.dataset.jointIndex),part=Number(b.dataset.part),point=bossJointPoint(analysis,analysis.positions[i].uv,part),screen=project(point),normal=new THREE.Vector3(...analysis.frame.n).transformDirection(bossJointTransform(analysis,part)),visible=Math.abs(camera.getWorldDirection(new THREE.Vector3()).dot(normal))>.08&&screen.z>=-1&&screen.z<=1;b.hidden=!visible;if(visible){b.style.left=screen.x+'px';b.style.top=screen.y+'px';}b.dataset.u=String(analysis.positions[i].uv[0]);b.dataset.v=String(analysis.positions[i].uv[1]);b.style.background=analysis.positions[i].nearWall?'#ac6400':part?'#9c630b':'#067ba2';}raf=requestAnimationFrame(updateFrame);}
 function drawOnce(){cancelAnimationFrame(raf);updateFrame();}
 function restore(){if(!drag)return;const old=drag;drag=null;getControls().enabled=old.enabled;analysis=old.analysis;onCancel(old.analysis.positions.map(q=>[...q.uv]));if(old.button.hasPointerCapture(old.id))old.button.releasePointerCapture(old.id);drawOnce();}
 function finish(e){if(!drag||drag.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();if(e.type!=='pointerup'){restore();return;}const old=drag;drag=null;getControls().enabled=old.enabled;if(old.button.hasPointerCapture(old.id))old.button.releasePointerCapture(old.id);onCommit();}
 function hide(){restore();analysis=null;cancelAnimationFrame(raf);buttons=[];layer.replaceChildren();}
 function update(value){hide();analysis=structuredClone(value);const parts=analysis.placements?[0,1]:[0];
  for(const part of parts)for(let i=0;i<analysis.positions.length;i++){
   const b=document.createElement('button');b.type='button';b.className='boss-joint-drag';b.textContent=String(i+1);b.dataset.jointIndex=i;b.dataset.part=part;b.setAttribute('aria-label',(part?'棒':'ボス')+(i+1)+'の接合位置を移動');b.title='ドラッグで接合位置を移動／矢印キーで1 mm、Shift＋矢印で0.1 mm';Object.assign(b.style,{position:'absolute',pointerEvents:'auto',transform:'translate(-50%,-50%)',minWidth:'30px',height:'30px',padding:'0 5px',border:'2px solid white',borderRadius:'50%',color:'white',cursor:'move',touchAction:'none',boxShadow:'0 2px 7px #0006',fontWeight:'700'});
   b.addEventListener('pointerdown',e=>{if(e.button!==0||e.shiftKey||!analysis)return;const uv=pointerUV(e,part);if(!uv)return;e.preventDefault();e.stopPropagation();document.activeElement?.blur();drag={id:e.pointerId,button:b,index:i,part,at:uv,analysis:structuredClone(analysis),enabled:getControls().enabled};getControls().enabled=false;onStart();b.setPointerCapture(e.pointerId);});
   b.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();const uv=pointerUV(e,part);if(!uv)return;const start=drag.analysis.positions[i].uv,next=moveBossJoint(drag.analysis,i,uv.map((v,j)=>start[j]+v-drag.at[j]),getSymmetric());analysis.positions.forEach((q,j)=>q.uv=next[j]);onMove(next);drawOnce();});
   for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,finish);
   b.addEventListener('keydown',e=>{const dir={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowDown:[0,-1],ArrowUp:[0,1]}[e.key];if(!dir||drag||!analysis)return;e.preventDefault();e.stopPropagation();onStart();const step=e.shiftKey?.1:1,next=moveBossJoint(analysis,i,analysis.positions[i].uv.map((v,j)=>v+dir[j]*step),getSymmetric(),.1);analysis.positions.forEach((q,j)=>q.uv=next[j]);onMove(next);drawOnce();onCommit();});buttons.push(b);layer.append(b);
  }drawOnce();
 }
 hide();return {update,hide,cancel(){if(!drag)return false;restore();return true;},setEnabled(value){for(const b of buttons)b.disabled=!value;},get dragging(){return !!drag;}};
}
