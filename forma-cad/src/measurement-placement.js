import {findPanelSpace,projectedBounds} from './panel-placement.js';

export function createMeasurementPlacement({panel,host,camera,getTargets,canMove}){
 const viewport=host.parentElement;
 const floatingControls=[...viewport.querySelectorAll('#snap-controls,.view-cube,#reference-plane-control,.navigation')];
 let dirty=true,previous=null,lastTargets=[],lastCamera='';
 const observer=new ResizeObserver(()=>{dirty=true;});
 for(const element of [panel,host,...floatingControls])observer.observe(element);

 function move(offsetX=0,offsetY=0){
  const value=offsetX||offsetY?`${offsetX}px ${offsetY}px`:'';
  if(panel.style.translate!==value)panel.style.translate=value;
 }
 const overlaps=(point,width,height,rect,gap)=>point.x+width+gap>rect.left&&point.x-gap<rect.right&&
  point.y+height+gap>rect.top&&point.y-gap<rect.bottom;

 return {update(){
  if(panel.hidden||!canMove()){
   move();previous=null;lastTargets=[];dirty=true;
   return;
  }
  const targets=getTargets();
  const changed=targets.length!==lastTargets.length||targets.some((target,i)=>target!==lastTargets[i]);
  if(!targets.length){
   if(changed){move();previous=null;lastTargets=[];dirty=true;}
   return;
  }
  const cameraState=host.dataset.cameraState;
  if(!dirty&&!changed&&cameraState===lastCamera)return;
  if(!changed&&panel.matches(':hover,:has(:focus-visible)'))return;
  dirty=false;lastCamera=cameraState;lastTargets=[...targets];
  if(changed)previous=null;

  const width=host.clientWidth,height=host.clientHeight,panelWidth=panel.offsetWidth,panelHeight=panel.offsetHeight;
  if(!width||!height||!panelWidth||!panelHeight)return;
  const base={x:panel.offsetLeft,y:panel.offsetTop};
  const margin=10,gap=10;
  camera.updateMatrixWorld();
  let model=targets.map(target=>projectedBounds(target,camera,width,height)).filter(Boolean);
  if(model.length>8)model=[model.reduce((bounds,b)=>({
   left:Math.min(bounds.left,b.left),top:Math.min(bounds.top,b.top),
   right:Math.max(bounds.right,b.right),bottom:Math.max(bounds.bottom,b.bottom),
  }))];
  if(!model.some(rect=>overlaps(base,panelWidth,panelHeight,rect,gap))&&!previous){move();return;}
  const screen=viewport.getBoundingClientRect();
  const controls=floatingControls.filter(element=>!element.hidden&&element.getClientRects().length).map(element=>{
   const r=element.getBoundingClientRect();
   return {left:r.left-screen.left,top:r.top-screen.top,right:r.right-screen.left,bottom:r.bottom-screen.top};
  });
  const spot=findPanelSpace({
   width,height:Math.min(height,base.y+panelHeight+margin),
   panelWidth,panelHeight,margin,gap,previous,
   obstacles:[...model,...controls],
   anchor:{x:base.x+panelWidth/2,y:base.y+panelHeight/2},
  });
  previous=spot;
  move(spot?spot.x-base.x:0,spot?spot.y-base.y:0);
 }};
}
