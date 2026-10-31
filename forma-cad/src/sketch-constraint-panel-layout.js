import {contactCurves} from './sketch-contact-curves.js';
import {findPanelSpace,projectedBounds} from './panel-placement.js';

export function constraintPanelObstacles({features,ids,camera,rect,objects=[],preview}){
 const obstacles=[],selected=[];
 const add=points=>{const ps=points.map(p=>p.clone().project(camera)).filter(p=>p.z>=-1&&p.z<=1);if(!ps.length)return null;const xs=ps.map(p=>rect.left+(p.x+1)*rect.width/2),ys=ps.map(p=>rect.top+(1-p.y)*rect.height/2),box={x:Math.min(...xs)-8,y:Math.min(...ys)-8,width:Math.max(...xs)-Math.min(...xs)+16,height:Math.max(...ys)-Math.min(...ys)+16};if(box.x>rect.right||box.y>rect.bottom||box.x+box.width<rect.left||box.y+box.height<rect.top)return null;obstacles.push(box);return box;};
 for(const f of features.filter(f=>ids.has(f.id)&&!f.groupHidden))for(const c of contactCurves(f,{whole:true})){const steps=c.linear?c.steps:Math.max(128,c.steps),box=add(Array.from({length:steps+1},(_,i)=>c.point(i/steps)));if(box)selected.push(box);}
 for(const object of objects){const b=projectedBounds(object,camera,rect.width,rect.height);if(b)obstacles.push({x:rect.left+b.left-8,y:rect.top+b.top-8,width:b.right-b.left+16,height:b.bottom-b.top+16});}
 for(const ps of [...(preview?.ghosts||[]),...(preview?.duplicates||[]),...(preview?.referencePaths||[])]){const box=add(ps);if(box)selected.push(box);}if(preview?.target){const box=add([preview.source,preview.target]);if(box)selected.push(box);}for(const motion of preview?.movements||[])add([motion.from,motion.to]);
 // Leave the space between the reference and moving figure clear as well.
 if(selected.length){const x=Math.min(...selected.map(b=>b.x)),y=Math.min(...selected.map(b=>b.y));obstacles.push({x,y,width:Math.max(...selected.map(b=>b.x+b.width))-x,height:Math.max(...selected.map(b=>b.y+b.height))-y});}
 return obstacles;
}
export function placeConstraintPanel({bounds,width,height,anchor,obstacles,previous}){
 const position=findPanelSpace({width:bounds.width,height:bounds.height,panelWidth:width,panelHeight:height,anchor:{x:anchor.x-bounds.x,y:anchor.y-bounds.y},previous:previous?{x:previous.x-bounds.x,y:previous.y-bounds.y}:null,margin:0,gap:12,obstacles:obstacles.map(b=>({left:b.x-bounds.x,top:b.y-bounds.y,right:b.x+b.width-bounds.x,bottom:b.y+b.height-bounds.y}))});return position?{x:position.x+bounds.x,y:position.y+bounds.y}:null;
}

// A hidden tool must not release the strip currently used by another tool.
const dockOwners=new WeakMap();
// Reserve a separate strip when zoom leaves no empty place in the canvas.
export function createConstraintPanelDock(canvas,panel){
 const viewport=canvas.parentElement?.parentElement,background=document.createElement('div');background.hidden=true;background.style.cssText='position:absolute;background:#f4f8fb;border:1px solid #c2d3df;z-index:7;pointer-events:none';viewport?.append(background);
 const style=document.createElement('style');style.textContent='.viewport[data-constraint-dock=right] #canvas-host{right:var(--constraint-dock-width)}.viewport[data-constraint-dock=right] .view-cube.fusion-view-cube{right:calc(var(--constraint-dock-width) + 12px)}.viewport[data-constraint-dock=right] #reference-plane-control{right:calc(var(--constraint-dock-width) + 16px)}.viewport[data-constraint-dock=right] .navigation{left:calc((100% - var(--constraint-dock-width))/2)}.viewport[data-constraint-dock=right] #snap-controls{max-width:calc(100% - var(--constraint-dock-width) - 40px);flex-wrap:wrap}.viewport[data-constraint-dock=bottom] #canvas-host{bottom:var(--constraint-dock-height)}.viewport[data-constraint-dock=bottom] .navigation{bottom:calc(var(--constraint-dock-height) + 48px)}.viewport[data-constraint-dock=bottom] .view-help{bottom:calc(var(--constraint-dock-height) + 8px)}';document.head.append(style);let side=null;
 function clear(){side=null;background.hidden=true;if(viewport&&dockOwners.get(viewport)===clear){dockOwners.delete(viewport);delete viewport.dataset.constraintDock;viewport.style.removeProperty('--constraint-dock-width');viewport.style.removeProperty('--constraint-dock-height');}delete panel.dataset.panelLayout;}
 function place(){if(!viewport)return null;const previous=dockOwners.get(viewport);if(previous&&previous!==clear)previous();dockOwners.set(viewport,clear);const r=viewport.getBoundingClientRect();if(!side)side=r.width>=660?'right':'bottom';panel.style.width=Math.min(330,r.width-16)+'px';panel.style.maxHeight=Math.max(64,side==='right'?r.height-16:r.height*.45)+'px';panel.style.overflowY='auto';const width=panel.offsetWidth,height=panel.offsetHeight;viewport.dataset.constraintDock=side;background.hidden=false;panel.dataset.panelLayout=side;
  if(side==='right'){const reserve=width+16;viewport.style.setProperty('--constraint-dock-width',reserve+'px');Object.assign(background.style,{top:'0px',bottom:'0px',right:'0px',left:'auto',width:reserve+'px',height:'auto'});return {x:r.right-width-8,y:r.top+Math.max(8,(r.height-height)/2)};}
  const reserve=height+16;viewport.style.setProperty('--constraint-dock-height',reserve+'px');Object.assign(background.style,{top:'auto',bottom:'0px',left:'0px',right:'0px',height:reserve+'px',width:'auto'});return {x:r.left+(r.width-width)/2,y:r.bottom-height-8};
 }
 return {clear,place,get active(){return !!side;}};
}
