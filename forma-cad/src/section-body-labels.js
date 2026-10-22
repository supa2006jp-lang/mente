import {cadPosition} from './cad-coordinates.js';
import * as THREE from 'three';
import {findPanelSpace} from './panel-placement.js';

// A triangle centroid lies in the material, unlike a face's bounding-box centre
// which can be inside a screw hole or between disconnected pieces.
export function sectionBodyAnchor(geometry,matrix){
 const p=cadPosition(geometry),ix=geometry.index,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let best=0,point=null;
 for(let i=0;i<(ix?.count??p.count);i+=3){a.fromBufferAttribute(p,ix?ix.getX(i):i);b.fromBufferAttribute(p,ix?ix.getX(i+1):i+1);c.fromBufferAttribute(p,ix?ix.getX(i+2):i+2);const area=b.clone().sub(a).cross(c.clone().sub(a)).lengthSq();if(area>best){best=area;point=a.clone().add(b).add(c).multiplyScalar(1/3);}}
 return point?.applyMatrix4(matrix)||null;
}
export function sectionRetainedAnchor(mesh,plane){
 if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;
 let best=-Infinity,point=null;
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld),d=plane.distanceToPoint(p);if(d>best){best=d;point=p;}}
 return best>=-1e-6?point:null;
}
export function sectionBodyLabels({host,camera,legend}){
 const layer=document.createElement('div');layer.id='section-body-labels';layer.hidden=true;host.append(layer);
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');layer.append(svg);
 const style=document.createElement('style');style.textContent='#section-body-labels{position:absolute;inset:0;pointer-events:none;z-index:8;overflow:hidden}#section-body-labels>svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.section-body-label{position:absolute;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:#fffffff2;border:1px solid var(--body-color);border-left:6px solid var(--body-color);border-radius:5px;padding:4px 8px;color:#20394b;font-size:12px;font-weight:600;box-shadow:0 2px 6px #17334120}#section-body-legend{display:grid;gap:5px;margin:0 0 12px;font-size:12px;color:#294b60}#section-body-legend>div{display:flex;align-items:center;gap:7px;overflow-wrap:anywhere}#section-body-legend i{display:inline-block;flex:none;width:12px;height:12px;border:1px solid #344b5a50;border-radius:3px}';document.head.append(style);
 let nodes=[],signature='';
 function set(entries){
  nodes.forEach(({label,line})=>{label.remove();line.remove();});nodes=[];legend.replaceChildren();signature='';layer.hidden=!entries.length;legend.hidden=!entries.length;
  host.dataset.sectionBodies=JSON.stringify(entries.map(({id,name,color})=>({id,name,color})));
  for(const entry of entries){
   const color='#'+entry.color.toString(16).padStart(6,'0'),row=document.createElement('div'),swatch=document.createElement('i'),name=document.createElement('span');swatch.style.background=color;swatch.setAttribute('aria-hidden','true');name.textContent=entry.name;row.append(swatch,name);legend.append(row);
   const label=document.createElement('span'),line=document.createElementNS(ns,'line');label.className='section-body-label';label.dataset.bodyId=entry.id;label.textContent=entry.name;label.title=entry.name;label.style.setProperty('--body-color',color);line.setAttribute('stroke',color);line.setAttribute('stroke-width','1.5');svg.append(line);layer.append(label);nodes.push({...entry,label,line});
  }
  update();
 }
 function update(){
  if(layer.hidden)return;
  const width=host.clientWidth,height=host.clientHeight,r=host.getBoundingClientRect(),obstacles=[];
  for(const element of host.parentElement.querySelectorAll('#section-panel,#measurement,#snap-controls,.navigation,#reference-plane-control,.view-cube,.viewport-title')){if(element.hidden)continue;const b=element.getBoundingClientRect();if(b.width&&b.height)obstacles.push({left:b.left-r.left,top:b.top-r.top,right:b.right-r.left,bottom:b.bottom-r.top});}
  const points=nodes.map(node=>node.point?.clone().project(camera)),key=JSON.stringify([width,height,camera.matrixWorld.elements,camera.projectionMatrix.elements,obstacles]);if(key===signature)return;signature=key;
  for(const [i,node] of nodes.entries()){
   const p=points[i],visible=p&&p.z>=-1&&p.z<=1&&Math.abs(p.x)<=1&&Math.abs(p.y)<=1;
   node.label.hidden=!visible;node.line.style.display=visible?'':'none';if(!visible)continue;
   const anchor={x:(p.x+1)*width/2,y:(1-p.y)*height/2},w=node.label.offsetWidth,h=node.label.offsetHeight,position=findPanelSpace({width,height,panelWidth:w,panelHeight:h,obstacles,anchor,margin:6,gap:5});
   node.label.hidden=!position;node.line.style.display=position?'':'none';if(!position)continue;
   node.label.style.left=position.x+'px';node.label.style.top=position.y+'px';obstacles.push({left:position.x,top:position.y,right:position.x+w,bottom:position.y+h});
   for(const [key,value] of Object.entries({x1:anchor.x,y1:anchor.y,x2:Math.max(position.x,Math.min(position.x+w,anchor.x)),y2:Math.max(position.y,Math.min(position.y+h,anchor.y))}))node.line.setAttribute(key,String(value));
  }
 }
 return {set,update};
}
