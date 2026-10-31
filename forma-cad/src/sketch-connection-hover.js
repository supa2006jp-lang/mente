import * as THREE from 'three';
import {sketchConnectionGraph,connectedSketchIds} from './sketch-connections.js';
import {makeSketchGeometry} from './geometry.js';
import {sketchLine} from './sketch-line.js';
import {basisFor} from './frames.js';

export function disposeSketchOverlay(group){group.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});group.clear();}
export function connectionStroke(feature,{ghost=false}={}){
 const line=sketchLine(makeSketchGeometry(feature),{color:ghost?0xc46906:0x10b981,order:10,planeNormal:basisFor(feature).n});line.raycast=()=>{};
 const strokes=line.children.filter(c=>c.userData.sketchStroke);strokes.forEach((c,i)=>{c.material.color.setHex(ghost?0xc46906:0x10b981);c.material.linewidth=i?5:12;c.material.opacity=ghost?.35:i?1:.22;});return line;
}
export function createSketchConnectionHover({scene,host,camera,canvas,getOccluders=()=>[]}){
 const group=new THREE.Group();group.name='sketch-connection-hover';scene.add(group);
 const tip=document.createElement('small');tip.id='sketch-connection-hover-tip';tip.hidden=true;tip.style.cssText='position:fixed;pointer-events:none;z-index:30;background:#edfff7;border:1px solid #10b981;border-radius:6px;padding:5px 9px;color:#075d44;max-width:260px';host.append(tip);
 let features=[],nodes=[],graph=new Map(),pointer=null,chosen=null,lastView='';const ray=new THREE.Raycaster();
 function clear(){if(chosen)disposeSketchOverlay(group);chosen=null;lastView='';tip.hidden=true;delete host.dataset.sketchConnectionHover;}
 const move=e=>{pointer=e.buttons?null:{x:e.clientX,y:e.clientY};};const leave=()=>{pointer=null;clear();};canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerleave',leave);canvas.addEventListener('pointerdown',leave);
 function update(active){
  if(!active||!pointer){clear();return;}const r=canvas.getBoundingClientRect(),view=[pointer.x,pointer.y,r.left,r.top,r.width,r.height,...camera.matrixWorld.elements,...camera.projectionMatrix.elements].join(',');if(view===lastView)return;let best=null,distance=121;
  for(const node of nodes){if(!node.connected)continue;const p=node.point.clone().project(camera);if(p.z< -1||p.z>1)continue;const x=r.left+(p.x+1)*r.width/2,y=r.top+(1-p.y)*r.height/2,d=(x-pointer.x)**2+(y-pointer.y)**2;if(d<distance){best={node,x,y};distance=d;}}
  if(!best){clear();lastView=view;return;}const p=best.node.point.clone().project(camera);ray.setFromCamera(new THREE.Vector2(p.x,p.y),camera);const hits=ray.intersectObjects(getOccluders().filter(o=>o.visible),true),along=best.node.point.clone().sub(ray.ray.origin).dot(ray.ray.direction);if(hits.some(h=>h.distance<along-1e-4)){clear();lastView=view;return;}
  if(chosen!==best.node){clear();chosen=best.node;const ids=connectedSketchIds(graph,chosen),selected=features.filter(f=>ids.includes(f.id));for(const f of selected)group.add(connectionStroke(f));tip.textContent=`接続 ${ids.length}要素：${selected.slice(0,3).map(f=>f.name||'線').join('・')}${ids.length>3?'…':''}`;host.dataset.sketchConnectionHover=JSON.stringify({ids,point:chosen.point.toArray()});}
  lastView=view;tip.hidden=false;tip.style.left=Math.max(r.left+6,Math.min(best.x+16,r.right-tip.offsetWidth-6))+'px';tip.style.top=Math.max(r.top+6,Math.min(best.y+16,r.bottom-tip.offsetHeight-6))+'px';
 }
 return {setData(next,nextNodes){clear();features=next;nodes=nextNodes;graph=sketchConnectionGraph(nodes);},update,clear,dispose(){clear();group.removeFromParent();tip.remove();canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('pointerdown',leave);}};
}
