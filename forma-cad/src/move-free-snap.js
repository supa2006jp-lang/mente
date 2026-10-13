import * as THREE from 'three';
import {constrainMoveDelta} from './move-cursor.js';
import {moveBodyPointReferences} from './move-reference-points.js';

// Cache the geometric references in mesh-local coordinates, not a changing pose.
export function snapshotMoveReferences(meshes){
 return meshes.map(mesh=>{
  mesh.updateMatrixWorld(true);const inverse=mesh.matrixWorld.clone().invert();
  return {mesh,refs:moveBodyPointReferences(mesh).map((ref,i)=>({...ref,key:mesh.uuid+':'+i,local:new THREE.Vector3(...ref.point).applyMatrix4(inverse)}))};
 });
}
export function transformedMoveReferences(snapshot){
 return snapshot.flatMap(({mesh,refs})=>{mesh.updateMatrixWorld(true);return refs.map(({local,...ref})=>({...ref,point:local.clone().applyMatrix4(mesh.matrixWorld).toArray()}));});
}

const screenPoint=(point,camera,width,height)=>{const p=point.clone().project(camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2,z:p.z};};
function worldTolerance(point,camera,width,height,pixels){
 const p=point.clone().project(camera),a=p.clone().unproject(camera);
 return Math.min(10,Math.max(a.distanceTo(p.clone().add(new THREE.Vector3(2*pixels/width,0,0)).unproject(camera)),a.distanceTo(p.clone().add(new THREE.Vector3(0,2*pixels/height,0)).unproject(camera))));
}

// A mirrored copy's reflection plane follows its total displacement. Solve the
// final displacement before snapping, so the applied copy still hits the point.
export function freeSnapPosition({source,target,position,pivot,direction='free',planeNormal=null,mirrored=false}){
 let correction=target.clone().sub(source);
 if(mirrored){
  const displacement=position.clone().sub(pivot),offset=source.clone().sub(position);
  if(displacement.lengthSq()>1e-14){const normal=displacement.clone().normalize();offset.addScaledVector(normal,-2*offset.dot(normal));}
  const b=target.clone().sub(pivot).sub(offset),squared=b.lengthSq();
  if(squared<1e-14)return correction.lengthSq()<1e-14?position.clone():null;
  const desired=b.multiplyScalar(1+2*b.dot(offset)/squared);
  if(desired.lengthSq()<1e-14)return null;
  correction=pivot.clone().add(desired).sub(position);
 }
 const constrained=constrainMoveDelta(correction,direction,planeNormal);
 if(constrained.distanceToSquared(correction)>1e-12)return null;
 return position.clone().add(constrained);
}

export function findFreeMoveSnap({sources,targets,position,pivot,direction='free',planeNormal=null,mirrored=false,camera,width,height,grid,gridSource,previous=null}){
 if(width<=0||height<=0)return null;camera.updateMatrixWorld(true);
 let best=null,score=Infinity;const buckets=new Map();
 for(const target of targets){const screen=screenPoint(target.point,camera,width,height),key=Math.floor(screen.x/16)+','+Math.floor(screen.y/16);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push({target,screen});}
 for(const source of sources){
  const a=screenPoint(source.point,camera,width,height),column=Math.floor(a.x/16),row=Math.floor(a.y/16),nearby=[];
  for(let x=column-1;x<=column+1;x++)for(let y=row-1;y<=row+1;y++)nearby.push(...(buckets.get(x+','+y)||[]));
  if(!nearby.length)continue;
  const regularTolerance=worldTolerance(source.point,camera,width,height,9),heldTolerance=previous?.sourceKey===source.ref.key?worldTolerance(source.point,camera,width,height,12):regularTolerance;
  for(const {target,screen:b} of nearby){
   const held=previous?.type==='point'&&previous.sourceKey===source.ref.key&&previous.targetKey===target.ref.key,pixels=held?12:9,distance=Math.hypot(a.x-b.x,a.y-b.y),tolerance=held?heldTolerance:regularTolerance;
   if(distance>pixels||source.point.distanceTo(target.point)>tolerance)continue;
   const next=freeSnapPosition({source:source.point,target:target.point,position,pivot,direction,planeNormal,mirrored});
   if(!next||next.distanceTo(position)>tolerance)continue;
   const rating=distance-(held?2:0);
   if(rating<score){score=rating;best={type:'point',position:next,point:target.point.clone(),source:source.ref.name||'点',target:target.ref.name||'点',sourceKey:source.ref.key,targetKey:target.ref.key};}
  }
 }
 if(best)return best;
 if(!grid?.enabled||!Number.isFinite(grid.step)||grid.step<=0||!gridSource)return null;
 const eligible={XY:'xy',XZ:'xz',YZ:'yz'}[grid.plane]||'xy',point=gridSource.point.clone(),axes=[],tolerance=worldTolerance(point,camera,width,height,6),projected=screenPoint(point,camera,width,height);
 for(const axis of ['x','y','z']){
  if(!eligible.includes(axis)||(direction!=='free'&&!direction.toLowerCase().includes(axis)))continue;
  const nearest=Math.round(point[axis]/grid.step)*grid.step,change=nearest-point[axis],oneStep=point.clone();oneStep[axis]+=grid.step;
  const stepScreen=screenPoint(oneStep,camera,width,height),stepPixels=Math.hypot(stepScreen.x-projected.x,stepScreen.y-projected.y);
  if(stepPixels<16||Math.abs(change)>grid.step*.18||Math.abs(change)>tolerance||Math.abs(change)*stepPixels/grid.step>6)continue;
  point[axis]=nearest;axes.push(axis);
 }
 if(!axes.length)return null;
 const next=freeSnapPosition({source:gridSource.point,target:point,position,pivot,direction,planeNormal,mirrored});
 if(!next)return null;
 return {type:'grid',position:next,point,source:gridSource.name||'移動中心',target:'グリッド '+axes.map(axis=>axis.toUpperCase()+'='+Number(point[axis].toFixed(5))).join(' / ')+' mm',axes};
}

export function createFreeMoveSnapMarker({host,canvas,camera}){
 const ns='http://www.w3.org/2000/svg',layer=document.createElementNS(ns,'svg');layer.id='move-free-snap-marker';layer.setAttribute('role','img');layer.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:9;display:none';host.append(layer);
 let current=null,frame=null,signature='';
 const create=(type,attributes,parent)=>{const el=document.createElementNS(ns,type);for(const [key,value]of Object.entries(attributes))el.setAttribute(key,value);parent.append(el);return el;};
 function draw(){
  const rect=canvas.getBoundingClientRect(),base=host.getBoundingClientRect(),p=screenPoint(current.point,camera,rect.width,rect.height);layer.setAttribute('viewBox','0 0 '+base.width+' '+base.height);layer.replaceChildren();
  const group=create('g',{transform:'translate('+(rect.left-base.left)+' '+(rect.top-base.top)+')'},layer),label=current.target+'に吸着',width=Math.min(rect.width-8,Math.max(110,label.length*12+16)),x=Math.max(4,Math.min(rect.width-width-4,p.x-width/2)),y=Math.max(4,Math.min(rect.height-30,p.y-42));
  create('circle',{cx:p.x,cy:p.y,r:11,fill:'#edfff5',stroke:'white','stroke-width':6},group);create('circle',{cx:p.x,cy:p.y,r:11,fill:'none',stroke:'#00885c','stroke-width':2.5},group);
  create('path',{d:'M'+(p.x-5)+' '+p.y+'h10M'+p.x+' '+(p.y-5)+'v10',stroke:'#00885c','stroke-width':2},group);
  create('rect',{x,y,width,height:26,rx:5,fill:'white',stroke:'#00885c','stroke-width':1.5},group);create('text',{x:x+width/2,y:y+17,'text-anchor':'middle',fill:'#006847','font-size':12,'font-family':'sans-serif'},group).textContent=label;
  layer.setAttribute('aria-label',current.source+' → '+label);
 }
 function tick(){if(!current)return;camera.updateMatrixWorld(true);const rect=canvas.getBoundingClientRect(),next=[rect.left,rect.top,rect.width,rect.height,...camera.matrixWorld.elements,...camera.projectionMatrix.elements,...current.point.toArray()].join(',');if(next!==signature){signature=next;draw();}frame=requestAnimationFrame(tick);}
 function close(){current=null;if(frame!==null)cancelAnimationFrame(frame);frame=null;layer.style.display='none';layer.replaceChildren();delete host.dataset.moveFreeSnap;}
 return {show(snap){close();current=snap;signature='';host.dataset.moveFreeSnap=JSON.stringify({type:snap.type,source:snap.source,target:snap.target,point:snap.point.toArray(),position:snap.position.toArray()});layer.style.display='block';tick();},close};
}
