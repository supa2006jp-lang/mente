import * as THREE from 'three';
import {sectionBodyColor} from './section-body-colors.js';
import {findPanelSpace,projectedBounds} from './panel-placement.js';

export function extrusionJoinBodies(plan,bodyName,destinations={}){
 const sources=new Set(plan.entries.map(e=>e.sourceId).filter(Boolean));
 const targets=new Set(plan.entries.map(e=>destinations[e.index]||e.destinationId).filter(Boolean));
 const connected=new Set(plan.entries.flatMap(e=>e.sourceContactIds||[]));
 return plan.bodyIds.map((id,index)=>({id,name:bodyName(id),number:index+1,color:'#'+sectionBodyColor(index).toString(16).padStart(6,'0'),role:[sources.has(id)?'押し出し元':'',targets.has(id)?'押し出し先':''].filter(Boolean).join('・')||(connected.has(id)?'押し出し元につながるボディ':'途中・側面の接触')}));
}

// Temporary display materials only. Keep the exact originals, including shared
// materials and vertex colours, for cancellation, confirmation and saved output.
export function joinDisplayMaterials(){
 const saved=new Map();
 return {paint(object,color,{bodyId=null,sweep=false}={}){
  if(!object.material||saved.has(object))return;
  const original=object.material,materials=(Array.isArray(original)?original:[original]).map(material=>{const copy=material.clone();copy.color?.set(color);if(copy.vertexColors){copy.vertexColors=false;copy.needsUpdate=true;}if(!sweep){copy.transparent=false;copy.opacity=1;}return copy;});object.material=Array.isArray(original)?materials:materials[0];saved.set(object,{original,materials,color,bodyId});
 },focus(id){for(const entry of saved.values())for(const material of entry.materials)if(material.emissive){const selected=!!id&&entry.bodyId===id;material.emissive.set(selected?entry.color:0x000000);material.emissiveIntensity=selected?.5:0;}},restore(){for(const [object,{original,materials}]of saved){object.material=original;materials.forEach(material=>material.dispose());}saved.clear();}};
}

export function inspectExtrusionJoin({host,camera,meshes,panel,entries,preview,overlays=[],fitView}){
 const appearance=joinDisplayMaterials(),visibility=[],layer=document.createElement('div'),ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),nodes=[];
 layer.id='extrusion-join-labels';layer.append(svg);host.append(layer);
 const snapshot=object=>{if(object){visibility.push([object,object.visible]);object.visible=false;}};
 overlays.forEach(snapshot);
 const objects=[];
 for(const entry of entries){const mesh=meshes.get(entry.id);if(!mesh?.visible)continue;mesh.traverse(object=>appearance.paint(object,entry.color,{bodyId:entry.id}));objects.push(mesh);addLabel(entry,mesh);}
 if(preview){preview.traverse(object=>{if(object.isMesh&&!object.userData.barrierClearance)appearance.paint(object,'#20bfc6',{sweep:true});});objects.push(preview);addLabel({id:'__sweep__',number:'＋',name:'今回の押し出し',role:'追加する部分',color:'#20bfc6'},preview);}
 function addLabel(entry,object){const label=document.createElement('span'),line=document.createElementNS(ns,'line');label.className='extrusion-join-label';label.dataset.bodyId=entry.id;label.style.setProperty('--join-color',entry.color);label.title=entry.name;label.textContent=entry.number+' '+entry.name+' · '+entry.role;line.setAttribute('stroke',entry.color);line.setAttribute('stroke-width','1.5');svg.append(line);layer.append(label);nodes.push({entry,object,label,line});}
 let focused=null,signature='',closed=false;
 function focus(id){focused=id;signature='';appearance.focus(id);host.dataset.extrusionJoinFocused=id||'';update();}
 function update(){
  if(closed)return;
  const width=host.clientWidth,height=host.clientHeight,r=host.getBoundingClientRect(),key=JSON.stringify([width,height,camera.matrixWorld.elements,camera.projectionMatrix.elements,focused]);if(signature===key)return;signature=key;
  const blockers=[...host.parentElement.querySelectorAll('#snap-controls,.navigation,#reference-plane-control,.view-cube,.viewport-title')].filter(el=>!el.hidden&&getComputedStyle(el).display!=='none').map(el=>{const b=el.getBoundingClientRect();return {left:b.left-r.left,top:b.top-r.top,right:b.right-r.left,bottom:b.bottom-r.top};});
  const solids=objects.map(object=>projectedBounds(object,camera,width,height)).filter(Boolean);
  for(const node of nodes){
   const box=new THREE.Box3().setFromObject(node.object),p=box.getCenter(new THREE.Vector3()).project(camera),visible=!box.isEmpty()&&p.z>=-1&&p.z<=1&&Math.abs(p.x)<1.1&&Math.abs(p.y)<1.1;node.label.hidden=!visible;node.line.style.display=visible?'':'none';if(!visible)continue;
   const anchor={x:(p.x+1)*width/2,y:(1-p.y)*height/2},w=Math.min(node.label.offsetWidth,width-16),h=node.label.offsetHeight,options={width,height,panelWidth:w,panelHeight:h,anchor,margin:8,gap:6};
   const position=findPanelSpace({...options,obstacles:[...blockers,...solids]})||findPanelSpace({...options,obstacles:blockers});node.label.hidden=!position;node.line.style.display=position?'':'none';if(!position)continue;
   node.label.dataset.focused=String(focused===node.entry.id);node.label.style.left=position.x+'px';node.label.style.top=position.y+'px';blockers.push({left:position.x,top:position.y,right:position.x+w,bottom:position.y+h});
   for(const [key,value]of Object.entries({x1:anchor.x,y1:anchor.y,x2:Math.max(position.x,Math.min(position.x+w,anchor.x)),y2:Math.max(position.y,Math.min(position.y+h,anchor.y))}))node.line.setAttribute(key,String(value));
  }
 }
 const resize=new ResizeObserver(()=>{fitView?.(objects);signature='';update();});resize.observe(host);
 fitView?.(objects);update();host.dataset.extrusionJoinBodies=JSON.stringify(entries);
 let frame;const tick=()=>{if(closed)return;update();frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
 return {update,focus,setEntries(next){for(const node of nodes){const entry=next.find(e=>e.id===node.entry.id);if(entry){node.entry=entry;node.label.textContent=entry.number+' '+entry.name+' · '+entry.role;}}host.dataset.extrusionJoinBodies=JSON.stringify(next);signature='';update();},close(){if(closed)return;closed=true;cancelAnimationFrame(frame);resize.disconnect();appearance.restore();for(const [object,visible]of visibility)object.visible=visible;layer.remove();delete host.dataset.extrusionJoinBodies;delete host.dataset.extrusionJoinFocused;}};
}
