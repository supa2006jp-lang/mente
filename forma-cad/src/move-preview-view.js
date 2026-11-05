import * as THREE from 'three';
import {fitSelectionBox} from './selection-view.js';

// Fit the pending geometry into the largest clear rectangle beside the panel.
export function fitMovePreviewBox(camera,box,viewport,panel){
 if(box.isEmpty()||viewport.width<=0||viewport.height<=0)return null;
 let area={left:0,top:0,width:viewport.width,height:viewport.height};
 const left=Math.max(0,panel.left-viewport.left-12),right=Math.min(viewport.width,panel.right-viewport.left+12);
 const top=Math.max(0,panel.top-viewport.top-12),bottom=Math.min(viewport.height,panel.bottom-viewport.top+12);
 if(right>0&&left<viewport.width&&bottom>0&&top<viewport.height){
  const candidates=[{left:0,top:0,width:left,height:viewport.height},{left:right,top:0,width:viewport.width-right,height:viewport.height},
   {left:0,top:0,width:viewport.width,height:top},{left:0,top:bottom,width:viewport.width,height:viewport.height-bottom}];
  const largest=candidates.sort((a,b)=>b.width*b.height-a.width*a.height)[0];
  if(largest.width>=80&&largest.height>=80)area=largest;
 }
 const target=fitSelectionBox(camera,box,area.width,area.height);
 camera.zoom*=area.height/viewport.height;camera.updateProjectionMatrix();
 const x=(viewport.width/2-area.left-area.width/2)*(camera.right-camera.left)/camera.zoom/viewport.width;
 const y=(area.top+area.height/2-viewport.height/2)*(camera.top-camera.bottom)/camera.zoom/viewport.height;
 const shift=new THREE.Vector3(x,y,0).applyQuaternion(camera.quaternion);
 camera.position.add(shift);target.add(shift);camera.updateMatrixWorld(true);return target;
}

export function createMoveDistanceFeedback({camera,canvas,host}){
 const badge=document.createElement('div');badge.id='move-distance-readout';badge.hidden=true;
 badge.style.cssText='position:absolute;z-index:10;pointer-events:none;white-space:nowrap;padding:5px 8px;border:1px solid #1679bf;border-radius:5px;font:600 13px sans-serif;color:#204d66;background:#f6fbff;box-shadow:0 2px 7px #1233';host.append(badge);
 let anchor=null,frame=null;const point=new THREE.Vector3();
 function position(){
  frame=null;if(!anchor)return;
  const rect=canvas.getBoundingClientRect(),base=host.getBoundingClientRect(),p=point.copy(anchor).project(camera);
  badge.style.left=rect.left-base.left+Math.max(4,Math.min(rect.width-badge.offsetWidth-4,(p.x+1)*rect.width/2+24))+'px';
  badge.style.top=rect.top-base.top+Math.max(4,Math.min(rect.height-badge.offsetHeight-4,(1-p.y)*rect.height/2+24))+'px';
  frame=requestAnimationFrame(position);
 }
 return {
  show(delta,axis,center,snapped=false){
   badge.textContent=['X','Y','Z'].filter(a=>axis?.includes(a)).map((a)=>{
    const value=Number(delta[a.toLowerCase()].toFixed(2));return a+(value<0?'−':'＋')+Math.abs(value)+' mm';
   }).join(' ／ ')+(snapped?' ✓ 吸着':'');
   badge.style.backgroundColor=snapped?'#d8f9ec':'#f6fbff';badge.style.borderColor=snapped?'#008b60':'#1679bf';
   badge.hidden=false;anchor=center.clone();if(frame===null)position();
  },
  hide(){anchor=null;badge.hidden=true;if(frame!==null)cancelAnimationFrame(frame);frame=null;}
 };
}
