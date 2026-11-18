import * as THREE from 'three';
import {basisFor} from './frames.js';
import {findPanelSpace} from './panel-placement.js';
import {offsetDragNormal,offsetDragValue} from './offset-extrusion-guides.js';
import {snapOffsetDrag} from './offset-extrusion-snap.js';

const ns='http://www.w3.org/2000/svg',node=(tag,attrs={})=>{const element=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))element.setAttribute(key,value);return element;};
function closestSegment(points,x,y){let best=-1,distance=Infinity;
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(x-a.x-t*dx,y-a.y-t*dy);if(d<distance){best=i;distance=d;}}
 return best;
}

export function createOffsetExtrusionGuideView({dialog,canvas,camera,host,getData,getValue,getStep=()=>.1,onChange}){
 const svg=node('svg',{'aria-hidden':'true',id:'offset-extrusion-guides'});svg.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;overflow:visible;pointer-events:none;z-index:1';
 const defs=node('defs'),clip=node('clipPath',{id:'offset-extrusion-guide-clip'}),clipRect=node('rect');clip.append(clipRect);defs.append(clip);svg.append(defs);
 const hits=node('g',{'clip-path':'url(#offset-extrusion-guide-clip)'}),labels=node('g',{'pointer-events':'none'});svg.append(hits,labels);dialog.append(svg);
 const form=dialog.querySelector('form');form.style.position='relative';form.style.zIndex='2';
 let gesture=null,screenRings=[],lastData=null,lastKey='';const ray=new THREE.Raycaster();
 function onPlane(event,region){const rect=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);const normal=basisFor(region).n;return ray.ray.intersectPlane(new THREE.Plane(normal,-region.offset),new THREE.Vector3());}
 function finish(event,cancel=false){
  if(!gesture||event&&event.pointerId!==gesture.id)return;const old=gesture;gesture=null;delete host.dataset.offsetExtrusionDragging;svg.style.cursor='';
  if(svg.hasPointerCapture(old.id))svg.releasePointerCapture(old.id);
  if(cancel)onChange(old.initial);
 }
 svg.addEventListener('pointerdown',event=>{
  if(event.button!==0||gesture)return;const index=Number(event.target.dataset.guide),guide=getData()?.guides[index],points=screenRings[index];if(!guide||!points)return;
  const point=onPlane(event,guide.region),segment=closestSegment(points,event.clientX,event.clientY),normal=offsetDragNormal(guide,segment);if(!point||!normal)return;
  event.preventDefault();event.stopPropagation();const value=getValue();gesture={id:event.pointerId,region:guide.region,normal,point,value,applied:value,initial:value};svg.setPointerCapture(event.pointerId);svg.style.cursor='grabbing';host.dataset.offsetExtrusionDragging='true';
 });
 svg.addEventListener('pointermove',event=>{
  if(!gesture||event.pointerId!==gesture.id)return;event.preventDefault();event.stopPropagation();const point=onPlane(event,gesture.region);if(!point)return;
  gesture.value=offsetDragValue(gesture.value,point.clone().sub(gesture.point).dot(gesture.normal),event.shiftKey);gesture.point=point;
  const value=snapOffsetDrag(gesture.value,getStep(),event.shiftKey);if(value!==gesture.applied){gesture.applied=value;onChange(value);}
 });
 svg.addEventListener('pointerup',event=>{if(gesture){event.preventDefault();event.stopPropagation();finish(event);}});
 svg.addEventListener('pointercancel',event=>finish(event,true));svg.addEventListener('lostpointercapture',event=>finish(event,true));
 function clear(){finish(null);hits.replaceChildren();labels.replaceChildren();screenRings=[];lastData=null;lastKey='';}
 function update(){
  const data=getData();if(!dialog.open||!data){if(lastData){hits.replaceChildren();labels.replaceChildren();lastData=null;lastKey='';}return;}
  const rect=canvas.getBoundingClientRect(),panel=dialog.getBoundingClientRect(),key=[rect.left,rect.top,rect.width,rect.height,panel.left,panel.top,panel.width,panel.height,...camera.matrixWorld.elements,...camera.projectionMatrix.elements].join(',');
  if(data===lastData&&key===lastKey)return;lastData=data;lastKey=key;hits.replaceChildren();labels.replaceChildren();screenRings=[];
  for(const [key,value] of Object.entries({x:rect.left,y:rect.top,width:rect.width,height:rect.height}))clipRect.setAttribute(key,value);
  const project=point=>{const p=new THREE.Vector3(...point).project(camera);return {x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2,z:p.z};};
  for(const [index,guide] of data.guides.entries()){
   const points=guide.world.map(project);screenRings.push(points);if(points.every(p=>p.z< -1||p.z>1))continue;
   const path=node('path',{d:points.map((p,i)=>(i?'L':'M')+p.x+','+p.y).join(' ')+'Z',fill:'none',stroke:'transparent','stroke-width':16,'data-guide':index,'pointer-events':'stroke'});path.style.cssText='cursor:grab;touch-action:none';path.append(node('title'));path.firstChild.textContent='ドラッグで指定した刻みに吸着（▼で変更／Shiftは1/10刻み）';hits.append(path);
  }
  const obstacles=[{left:panel.left-rect.left,top:panel.top-rect.top,right:panel.right-rect.left,bottom:panel.bottom-rect.top}];
  for(const dimensions of data.dimensions){
   const points=screenRings[dimensions.guideIndex];if(!points?.length||points.every(p=>p.z< -1||p.z>1))continue;
   const box={left:Math.min(...points.map(p=>p.x))-rect.left,right:Math.max(...points.map(p=>p.x))-rect.left,top:Math.min(...points.map(p=>p.y))-rect.top,bottom:Math.max(...points.map(p=>p.y))-rect.top};
   const group=node('g',{'class':'offset-extrusion-dimensions'}),text=node('text',{'font-family':'sans-serif','font-size':12,fill:'#74400a',x:7,y:16});text.textContent=dimensions.text;
   group.append(text);labels.append(group);const width=Math.ceil(text.getComputedTextLength())+14,height=23,anchor={x:(box.left+box.right)/2,y:box.top-17};
   const spot=findPanelSpace({width:rect.width,height:rect.height,panelWidth:width,panelHeight:height,anchor,obstacles:[...obstacles,box],margin:6,gap:7})||{x:Math.max(6,Math.min(rect.width-width-6,anchor.x-width/2)),y:Math.max(6,Math.min(rect.height-height-6,box.top-height-7))};
   group.setAttribute('transform','translate('+(rect.left+spot.x)+','+(rect.top+spot.y)+')');group.prepend(node('rect',{width,height,rx:4,fill:'#fffdf4',stroke:'#f59b3b','stroke-width':1}));
   obstacles.push({left:spot.x,top:spot.y,right:spot.x+width,bottom:spot.y+height});
  }
 }
 return {update,clear,cancelDrag(){if(!gesture)return false;finish(null,true);return true;}};
}
