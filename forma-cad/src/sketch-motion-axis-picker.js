import {motionRailChoices} from './sketch-motion-controls.js';
import {constraintControlPoints} from './sketch-constraints.js';
import {worldPoint} from './frames.js';
import {planeCoordinates} from './regions.js';

export function motionRailScreenPoints(features,edge,camera,rect){
 const f=features.find(f=>f.id===edge.featureId),points=constraintControlPoints(f);return edge.vertices.map(i=>{const p=worldPoint({...f,offset:planeCoordinates(f).offset},points[i]).project(camera);return {x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2,z:p.z};});
}
export function nearestMotionRail(features,points,camera,rect,screen,tolerance=10,choices=motionRailChoices(features,points)){
 let best=null,distance=tolerance;for(const edge of choices){const [a,b]=motionRailScreenPoints(features,edge,camera,rect);if(Math.abs(a.z)>1||Math.abs(b.z)>1)continue;const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;if(length<1)continue;const t=Math.max(0,Math.min(1,((screen.x-a.x)*dx+(screen.y-a.y)*dy)/length)),d=Math.hypot(screen.x-a.x-t*dx,screen.y-a.y-t*dy);if(d<distance){distance=d;best={featureId:edge.featureId,index:edge.index};}}return best;
}
export function createSketchMotionAxisPicker({camera,canvas,getFeatures,canUse,onChoose,onChange,onHover,onCancel,getChoices=motionRailChoices,id='sketch-motion-axis-picker'}){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.id=id;svg.style.cssText='display:none;position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:104';document.body.append(svg);let state=null,screen=null,down=null,ignoreClickUntil=0;
 const same=(a,b)=>a?.featureId===b?.featureId&&a?.index===b?.index,element=(tag,attrs)=>{const el=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,value);return el;},surface=e=>e.target===canvas||!!e.target.closest?.('#sketch-constraint-markers'),inside=e=>{const r=canvas.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;};
 function stop(){if(!state)return false;state=null;down=null;screen=null;svg.style.display='none';svg.replaceChildren();delete canvas.parentElement.dataset.motionAxisPicking;canvas.style.removeProperty('cursor');onChange?.();return true;}
 function update(){if(!state)return;if(!canUse()||getFeatures()!==state.original){stop();return;}const r=canvas.getBoundingClientRect();const prior=state.hover;state.hover=screen?nearestMotionRail(state.original,state.points,camera,r,screen,10,getChoices(state.original,state.points)):null;svg.style.display='';svg.replaceChildren();const clipId=id+'-clip',defs=element('defs',{}),clip=element('clipPath',{id:clipId});clip.append(element('rect',{x:r.left,y:r.top,width:r.width,height:r.height}));defs.append(clip);svg.append(defs);const group=element('g',{'clip-path':'url(#'+clipId+')'});svg.append(group);
  for(const edge of getChoices(state.original,state.points)){const [a,b]=motionRailScreenPoints(state.original,edge,camera,r);if(Math.abs(a.z)>1||Math.abs(b.z)>1)continue;const active=same(edge,state.hover);group.append(element('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:active?'#00a991':'#a22cbe','stroke-width':active?7:3,'stroke-dasharray':active?'':'7 5',opacity:active?1:.65,'data-motion-rail':JSON.stringify({featureId:edge.featureId,index:edge.index}),'data-hover':String(active)}));}svg.dataset.hover=JSON.stringify(state.hover);svg.dataset.type=state.type;if(!same(prior,state.hover))onHover?.(state.hover);
 }
 document.addEventListener('pointermove',e=>{if(!state||!surface(e))return;screen={x:e.clientX,y:e.clientY};update();},true);
 document.addEventListener('pointerdown',e=>{if(!state||e.button!==0||!surface(e)||!inside(e))return;e.preventDefault();e.stopImmediatePropagation();screen={x:e.clientX,y:e.clientY};down={id:e.pointerId,x:e.clientX,y:e.clientY};update();},true);
 document.addEventListener('pointerup',e=>{if(!state||e.button!==0||!surface(e)||!inside(e))return;e.preventDefault();e.stopImmediatePropagation();ignoreClickUntil=performance.now()+500;const click=down?.id===e.pointerId&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<5;down=null;screen={x:e.clientX,y:e.clientY};update();if(click&&state?.hover){const current=state,ref={...current.hover};stop();onChoose(ref,current.type);}},true);
 document.addEventListener('click',e=>{if(surface(e)&&(state||performance.now()<ignoreClickUntil)){e.preventDefault();e.stopImmediatePropagation();}},true);
 document.addEventListener('pointercancel',()=>{down=null;},true);window.addEventListener('blur',()=>{if(stop())onCancel?.();});
 return {start(type,points){stop();state={type,points:structuredClone(points),original:getFeatures(),hover:null};canvas.parentElement.dataset.motionAxisPicking=type;canvas.style.cursor='crosshair';update();onChange?.();},stop,update,get active(){return !!state;},get type(){return state?.type;}};
}
