import * as THREE from 'three';
import {accelerateMeshPicking} from './mesh-picking.js';

// The visible paths are also the hit targets, so highlighting and picking agree.
export function moveAxisCandidates({meshes,occluders,lines=[],points=[],camera,width,height}){
 const ray=new THREE.Raycaster(),out=[],keys=new Set(),screenLines=new Map();ray.firstHitOnly=true;
 camera.updateMatrixWorld(true);for(const mesh of new Set([...meshes,...occluders])){mesh.updateMatrixWorld(true);accelerateMeshPicking(mesh);}
 const project=point=>{const p=point.clone().project(camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2,z:p.z};};
 const onScreen=p=>p.z>=-1&&p.z<=1&&p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height;
 const visible=(world,p=project(world))=>{if(!onScreen(p))return false;ray.setFromCamera(new THREE.Vector2(p.x/width*2-1,1-p.y/height*2),camera);ray.far=Math.max(0,ray.ray.origin.distanceTo(world)-.02);return !ray.intersectObjects(occluders,false).length;};
 function addLine(a,b,source,name){
  const key=[a,b].map(p=>p.toArray().map(v=>v.toFixed(4)).join(',')).sort().join('|');if(keys.has(key)||a.distanceToSquared(b)<1e-12)return;keys.add(key);
  const pa=project(a),pb=project(b),length=Math.hypot(pa.x-pb.x,pa.y-pb.y);
  if(pa.z< -1||pa.z>1||pb.z< -1||pb.z>1||length<3||Math.max(pa.x,pb.x)<0||Math.min(pa.x,pb.x)>width||Math.max(pa.y,pb.y)<0||Math.min(pa.y,pb.y)>height)return;
  const segments=[],steps=Math.max(4,Math.min(32,Math.ceil(length/12)));
  for(let i=0;i<steps;i++){const middle=a.clone().lerp(b,(i+.5)/steps);if(!visible(middle))continue;segments.push({a:project(a.clone().lerp(b,i/steps)),b:project(a.clone().lerp(b,(i+1)/steps))});}
  if(!segments.length)return;
  const direction=b.clone().sub(a).normalize(),axis=['X','Y','Z'].find((_,i)=>Math.abs(direction.getComponent(i))>.999);
  const screenKey=[pa,pb].map(p=>p.x.toFixed(2)+','+p.y.toFixed(2)).sort().join('|'),depth=(pa.z+pb.z)/2,previous=screenLines.get(screenKey);
  // At a silhouette the ray may graze a triangle. Coincident screen edges
  // still belong to the front-most axis, rather than the hidden rear edge.
  if(previous&&previous.depth<=depth)return;
  const index=previous?.index??out.length,candidate={kind:'line',a,b,source,segments,label:'回転軸候補：'+(name||(axis?axis+'方向の辺':'斜めの辺'))+' '+(index+1)};
  out[index]=candidate;screenLines.set(screenKey,{index,depth});
 }
 for(const mesh of meshes){
  const edges=mesh.children[0],g=edges?.geometry,p=g?.attributes.position;if(!p)continue;
  for(let i=0;i<p.count;i+=2){if(g.userData.circularEdges?.has(i)||g.userData.arcEdges?.has(i))continue;addLine(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(edges.matrixWorld),new THREE.Vector3().fromBufferAttribute(p,i+1).applyMatrix4(edges.matrixWorld),'edge');}
 }
 for(const line of lines)addLine(new THREE.Vector3(...line.a),new THREE.Vector3(...line.b),'reference',line.name||'スケッチの直線');
 const placed=[];
 for(const ref of [...points].sort((a,b)=>project(new THREE.Vector3(...a.point)).z-project(new THREE.Vector3(...b.point)).z)){
  const point=new THREE.Vector3(...ref.point),screen=project(point);if(!visible(point,screen)||placed.some(p=>Math.hypot(p.x-screen.x,p.y-screen.y)<12))continue;placed.push(screen);
  out.push({kind:'point',point,screen,ref,label:(ref.a&&ref.b?'回転軸候補：':'回転中心候補：')+(ref.name||'点')});
 }
 return out;
}

export function nearestMoveAxis(candidates,x,y){
 let point=null,distance=12;for(const c of candidates)if(c.kind==='point'){const d=Math.hypot(c.screen.x-x,c.screen.y-y);if(d<distance){point=c;distance=d;}}if(point)return point;
 let line=null;distance=10;
 for(const c of candidates)if(c.kind==='line')for(const {a,b} of c.segments){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(x-a.x-t*dx,y-a.y-t*dy);if(d<distance){distance=d;line=c;}}
 return line;
}

export function createMoveAxisPicker({host,canvas,camera,getSources,getRevision=()=>'',onPick,onUpdate=()=>{}}){
 const ns='http://www.w3.org/2000/svg',layer=document.createElementNS(ns,'svg');layer.id='move-axis-candidates';layer.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:8;display:none';host.append(layer);
 let active=false,frame=null,signature='',candidates=[],hover=null;const visuals=new Map();
 const create=(type,attrs,parent=layer)=>{const el=document.createElementNS(ns,type);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,value);parent.append(el);return el;};
 function highlight(candidate){if(hover===candidate)return;hover=candidate;for(const [c,el]of visuals){el.setAttribute('stroke',c===candidate?'#ff7900':'#c27b00');el.setAttribute('stroke-width',c===candidate?'4':'2.5');if(c.kind==='point')el.setAttribute('fill',c===candidate?'#ffdb81':'white');}host.dataset.moveAxisHover=candidate?.label||'';}
 function bind(el,c){el.setAttribute('role','button');el.setAttribute('tabindex','0');el.setAttribute('aria-label',c.label);el.style.pointerEvents='all';el.style.cursor='pointer';el.style.outline='none';create('title',{},el).textContent=c.label;
  el.onpointerenter=()=>highlight(c);el.onpointerleave=()=>highlight(null);el.onfocus=()=>highlight(c);el.onblur=()=>highlight(null);
  el.onpointerdown=e=>{e.preventDefault();e.stopPropagation();onPick(c);};el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onPick(c);}};
 }
 function render(){
  const rect=canvas.getBoundingClientRect(),base=host.getBoundingClientRect();layer.setAttribute('viewBox','0 0 '+base.width+' '+base.height);layer.replaceChildren();visuals.clear();hover=null;
  candidates=moveAxisCandidates({...getSources(),camera,width:rect.width,height:rect.height});
  const group=create('g',{transform:'translate('+(rect.left-base.left)+' '+(rect.top-base.top)+')'});
  for(const c of candidates){
   if(c.kind==='line'){
    const d=c.segments.map(({a,b})=>'M'+a.x+' '+a.y+'L'+b.x+' '+b.y).join('');
    create('path',{d,fill:'none',stroke:'white','stroke-width':5,'pointer-events':'none'},group);
    visuals.set(c,create('path',{d,fill:'none',stroke:'#c27b00','stroke-width':2.5,'pointer-events':'none'},group));
    bind(create('path',{d,fill:'none',stroke:'transparent','stroke-width':18},group),c);
   }else{
    const {x:cx,y:cy}=c.screen;create('circle',{cx,cy,r:8,fill:'white','pointer-events':'none'},group);
    visuals.set(c,create('circle',{cx,cy,r:6,fill:'white',stroke:'#c27b00','stroke-width':2.5,'pointer-events':'none'},group));
    bind(create('circle',{cx,cy,r:12,fill:'transparent'},group),c);
   }
  }
  host.dataset.moveAxisCandidateCount=String(candidates.length);onUpdate(candidates);
 }
 function tick(){if(!active)return;camera.updateMatrixWorld(true);const r=canvas.getBoundingClientRect(),next=[r.left,r.top,r.width,r.height,...camera.matrixWorld.elements,...camera.projectionMatrix.elements,getRevision()].join(',');if(next!==signature){signature=next;render();}frame=requestAnimationFrame(tick);}
 const pointer=e=>{if(active){const r=canvas.getBoundingClientRect();highlight(nearestMoveAxis(candidates,e.clientX-r.left,e.clientY-r.top));}};canvas.addEventListener('pointermove',pointer);canvas.addEventListener('pointerleave',()=>highlight(null));
 function close(){active=false;if(frame!==null)cancelAnimationFrame(frame);frame=null;layer.style.display='none';layer.replaceChildren();visuals.clear();candidates=[];hover=null;delete host.dataset.moveAxisCandidateCount;delete host.dataset.moveAxisHover;}
 return {open(){close();active=true;layer.style.display='block';signature='';tick();},close,pick(event){const r=canvas.getBoundingClientRect();return nearestMoveAxis(candidates,event.clientX-r.left,event.clientY-r.top);}};
}
