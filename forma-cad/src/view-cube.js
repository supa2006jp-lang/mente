import * as THREE from 'three';

const ns='http://www.w3.org/2000/svg';
const faces=[
 {key:'top',label:'上',normal:[0,0,1],u:[1,0,0],v:[0,1,0]},
 {key:'bottom',label:'下',normal:[0,0,-1],u:[1,0,0],v:[0,-1,0]},
 {key:'front',label:'前',normal:[0,-1,0],u:[1,0,0],v:[0,0,1]},
 {key:'back',label:'後',normal:[0,1,0],u:[-1,0,0],v:[0,0,1]},
 {key:'right',label:'右',normal:[1,0,0],u:[0,1,0],v:[0,0,1]},
 {key:'left',label:'左',normal:[-1,0,0],u:[0,-1,0],v:[0,0,1]}
];
const vector=a=>new THREE.Vector3(...a);
const el=(tag,attrs={},text)=>{const node=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);if(text)node.textContent=text;return node;};
export function createViewCube(container,{camera,onSelect,onHome,onDragStart,onDrag,onDragEnd}){
 container.replaceChildren();container.classList.add('fusion-view-cube');container.setAttribute('aria-label','視点キューブ');
 const home=document.createElement('button');home.type='button';home.className='view-cube-home';home.dataset.view='iso';home.title='ホーム：標準の立体視点';home.setAttribute('aria-label',home.title);home.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m3 11 9-8 9 8M5 9v12h14V9M9 21v-7h6v7"/></svg>';home.onclick=onHome;
 const svg=el('svg',{viewBox:'0 0 160 160',class:'view-cube-svg','aria-label':'面・辺・角をクリックして視点を変更。ドラッグで回転。'}),axisLayer=el('g',{'aria-hidden':'true'}),faceLayer=el('g'),edgeLayer=el('g'),cornerLayer=el('g');svg.append(axisLayer,faceLayer,edgeLayer,cornerLayer);container.append(home,svg);
 const hint=document.createElement('span');hint.className='view-cube-hint';hint.textContent='面・辺・角をクリック / ドラッグで回転';container.append(hint);
 const targets=[];
 function target(node,direction,label,kind){node.dataset.cubeDirection=direction.join(',');node.dataset.cubeKind=kind;node.setAttribute('role','button');node.setAttribute('aria-label',label+'の視点');node.setAttribute('tabindex','0');node.append(el('title',{},label+'の視点'));node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(vector(direction).normalize(),label);}});targets.push({node,direction,label,kind});return node;}
 const faceNodes=faces.map(face=>{const group=target(el('g',{class:'cube-face'}),face.normal,face.label+'面','face');group.dataset.view=face.key;const polygon=el('polygon'),text=el('text',{'text-anchor':'middle','dominant-baseline':'central','font-size':'21'},face.label);group.append(polygon,text);faceLayer.append(group);return {...face,node:group,polygon,text};});
 const vertices=[];for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])vertices.push([x,y,z]);
 const labelFor=d=>faces.filter(face=>face.normal.some((value,i)=>value&&value===d[i])).map(face=>face.label).join('・');
 const edges=[];
 for(let i=0;i<vertices.length;i++)for(let j=i+1;j<vertices.length;j++)if(vertices[i].filter((v,k)=>v!==vertices[j][k]).length===1){const direction=vertices[i].map((v,k)=>(v+vertices[j][k])/2),node=target(el('g',{class:'cube-edge'}),direction,labelFor(direction)+'の辺','edge'),line=el('line');node.append(line);edgeLayer.append(node);edges.push({a:vertices[i],b:vertices[j],direction,node,line});}
 const corners=vertices.map(direction=>{const node=target(el('g',{class:'cube-corner'}),direction,labelFor(direction)+'の角','corner'),circle=el('circle',{r:6});node.append(circle);cornerLayer.append(node);return {direction,node,circle};});
 const axes=[['X',[1,0,0],'#e6535e'],['Y',[0,1,0],'#29985c'],['Z',[0,0,1],'#5277df']].map(([label,direction,color])=>{const line=el('line',{stroke:color,'stroke-width':1.4}),text=el('text',{fill:color,'font-size':13,'font-weight':600,'text-anchor':'middle','dominant-baseline':'central'},label);axisLayer.append(line,text);return {direction,line,text};});
 let last='',drag=null;
 const project=(a,inverse)=>{const p=vector(a).applyQuaternion(inverse);return {x:80+p.x*27,y:79-p.y*27,z:p.z};};
 const setVisibility=(node,visible)=>{node.style.display=visible?'':'none';node.setAttribute('tabindex',visible?'0':'-1');node.setAttribute('aria-hidden',String(!visible));};
 function update(){const signature=camera.quaternion.toArray().map(n=>n.toFixed(5)).join(',');if(signature===last)return;last=signature;container.dataset.orientation=signature;const inverse=camera.quaternion.clone().invert(),visible=new Set();
  for(const face of faceNodes){const facing=vector(face.normal).applyQuaternion(inverse).z>.02;setVisibility(face.node,facing);if(!facing)continue;visible.add(face.key);const n=vector(face.normal),u=vector(face.u),v=vector(face.v),points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>project(n.clone().addScaledVector(u,a).addScaledVector(v,b).toArray(),inverse));face.polygon.setAttribute('points',points.map(p=>p.x.toFixed(2)+','+p.y.toFixed(2)).join(' '));const center=project(face.normal,inverse),pu=project(n.clone().add(u).toArray(),inverse),pv=project(n.clone().add(v).toArray(),inverse);face.text.setAttribute('transform',`matrix(${(pu.x-center.x)/27} ${(pu.y-center.y)/27} ${(center.x-pv.x)/27} ${(center.y-pv.y)/27} ${center.x} ${center.y})`);const lighting=vector(face.normal).applyQuaternion(inverse).dot(new THREE.Vector3(-.25,.45,.85).normalize());face.polygon.setAttribute('fill',new THREE.Color().setScalar(.82+Math.max(0,lighting)*.15).getStyle());}
  const exposed=d=>faces.some(face=>visible.has(face.key)&&face.normal.some((v,i)=>v&&v===d[i]));
  for(const edge of edges){setVisibility(edge.node,exposed(edge.direction));const a=project(edge.a,inverse),b=project(edge.b,inverse);for(const [key,value] of Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y}))edge.line.setAttribute(key,value);}
  for(const corner of corners){setVisibility(corner.node,exposed(corner.direction));const p=project(corner.direction,inverse);corner.circle.setAttribute('cx',p.x);corner.circle.setAttribute('cy',p.y);}
  for(const axis of axes){const start=project(axis.direction.map(n=>n*1.15),inverse),end=project(axis.direction.map(n=>n*1.95),inverse),text=project(axis.direction.map(n=>n*2.2),inverse);for(const [key,value] of Object.entries({x1:start.x,y1:start.y,x2:end.x,y2:end.y}))axis.line.setAttribute(key,value);axis.text.setAttribute('x',text.x);axis.text.setAttribute('y',text.y);}
 }
 svg.addEventListener('pointerdown',e=>{if(e.button!==0||drag)return;e.preventDefault();e.stopPropagation();drag={id:e.pointerId,x:e.clientX,y:e.clientY,target:e.target.closest('[data-cube-direction]'),moved:false};svg.setPointerCapture(e.pointerId);});
 svg.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)>4){drag.moved=true;container.classList.add('is-dragging');onDragStart();}if(drag.moved){onDrag(dx,dy);update();}});
 function end(e){if(!drag||e.pointerId!==drag.id)return;const state=drag;drag=null;container.classList.remove('is-dragging');if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);if(state.moved)onDragEnd();else if(e.type==='pointerup'&&state.target){const entry=targets.find(t=>t.node===state.target);onSelect(vector(entry.direction).normalize(),entry.label);}update();}
 for(const event of ['pointerup','pointercancel','lostpointercapture'])svg.addEventListener(event,end);
 svg.addEventListener('contextmenu',e=>e.preventDefault());update();return {update};
}
