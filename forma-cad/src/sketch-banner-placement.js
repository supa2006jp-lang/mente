import {findPanelSpace,projectedBounds} from './panel-placement.js';
import {draggablePanel} from './draggable-panel.js';

const cameraSettleMs=160;
const positionStorageKey='forma-sketch-banner-position';

function readPosition(){
 try{
  const position=JSON.parse(localStorage.getItem(positionStorageKey));
  if(Number.isFinite(position?.x)&&Number.isFinite(position?.y))return {x:position.x,y:position.y};
 }catch{}
 return null;
}

function savePosition(position){
 try{
  if(position)localStorage.setItem(positionStorageKey,JSON.stringify(position));
  else localStorage.removeItem(positionStorageKey);
 }catch{}
}

const visibleBounds=controls=>controls.filter(control=>control.getClientRects().length).map(control=>control.getBoundingClientRect());
const intersects=(point,width,height,rect,gap)=>point.x+width+gap>rect.left&&point.x-gap<rect.right&&
 point.y+height+gap>rect.top&&point.y-gap<rect.bottom;

export function createSketchBannerPlacement({banner,host,camera,header,right,bottom,dimensions}){
 const viewport=host.parentElement;
 let previous=null,lastCamera,lastCameraMove=null,wasPanning=false;
 let visibleDimensions=0,lastDimensionMove=null;
 const grip=document.createElement('span'),fixed=document.createElement('button');
 const reset=document.createElement('button');
 grip.id='sketch-banner-grip';
 grip.setAttribute('aria-hidden','true');
 fixed.id='sketch-banner-fixed';
 fixed.type='button';
 fixed.textContent='位置を固定';
 reset.id='sketch-banner-position-reset';
 reset.type='button';
 reset.textContent='初期位置に戻す';
 banner.prepend(grip);
 banner.insertBefore(fixed,banner.querySelector('#sketch-pinned-settings'));
 fixed.after(reset);

 function setFixed(value){
  fixed.setAttribute('aria-pressed',String(value));
  fixed.title=value?'固定を解除して自動配置に戻す':'作図ボックスを今の位置に固定する';
  reset.hidden=!value;
  previous=null;
  lastCameraMove=null;
  move();
 }
 const drag=draggablePanel(banner,'作図ボックス',{
  handle:grip,resizeTarget:viewport,initialPosition:readPosition(),onPositionChange:setFixed,onPositionCommit:savePosition,
 });
 function restoreDefault(){drag.reset();savePosition(null);}
 fixed.onclick=()=>banner.dataset.panelPosition==='manual'?restoreDefault():drag.fix();
 reset.onclick=()=>{restoreDefault();fixed.focus();};
 setFixed(false);
 host.addEventListener('pointermove',()=>{
  if(visibleDimensions)lastDimensionMove=performance.now();
 });
 function positionHeader(){
  const viewportBounds=viewport.getBoundingClientRect(),rightBounds=visibleBounds(right);
  const leftOfRight=Math.min(viewportBounds.right,...rightBounds.map(box=>box.left));
  const fullWidth=leftOfRight-viewportBounds.left<500;
  const headerBounds=visibleBounds(header);
  if(fullWidth)headerBounds.push(...rightBounds);
  const top=Math.max(viewportBounds.top,...headerBounds.map(box=>box.bottom));
  banner.style.setProperty('--sketch-banner-top',Math.ceil(top-viewportBounds.top+8)+'px');
  banner.style.setProperty('--sketch-banner-right',fullWidth?'12px':Math.ceil(viewportBounds.right-leftOfRight+8)+'px');
 }
 function move(x=0,y=0){
  const value=x||y?`${x}px ${y}px`:'';
  if(banner.style.translate!==value)banner.style.translate=value;
 }
 const observer=new ResizeObserver(positionHeader);
 for(const item of [viewport,banner,...header,...right,...bottom])observer.observe(item);
 window.addEventListener('resize',positionHeader);
 positionHeader();
 return {update(getDrawing,panning){
  if(banner.hidden||!getDrawing||banner.dataset.panelPosition==='manual'){
   if(previous)move();
   previous=null;
   lastCamera=undefined;
   lastCameraMove=null;
   lastDimensionMove=null;
   visibleDimensions=0;
   wasPanning=false;
   return;
  }
  const now=performance.now(),released=wasPanning&&!panning;
  const cameraState=host.dataset.cameraState;
  if(lastCamera!==undefined&&cameraState!==lastCamera)lastCameraMove=now;
  lastCamera=cameraState;
  wasPanning=panning;
  const dimensionMask=dimensions.reduce((mask,{panel},i)=>panel.hidden?mask:mask|(1<<i),0);
  if(dimensionMask!==visibleDimensions){
   visibleDimensions=dimensionMask;
   lastDimensionMove=dimensionMask?now:null;
  }
  const viewSettled=lastCameraMove!==null&&(released||now-lastCameraMove>=cameraSettleMs);
  const dimensionsSettled=lastDimensionMove!==null&&now-lastDimensionMove>=cameraSettleMs;
  if(panning||(!viewSettled&&(lastCameraMove!==null||!dimensionsSettled)))return;
  lastCameraMove=null;
  lastDimensionMove=null;
  if(banner.matches(':hover,:has(:focus-visible)'))return;
  const width=host.clientWidth,height=host.clientHeight,panelWidth=banner.offsetWidth,panelHeight=banner.offsetHeight;
  if(!width||!height||!panelWidth||!panelHeight)return;
  const base={x:banner.offsetLeft,y:banner.offsetTop};
  const bounds=viewport.getBoundingClientRect();
  const relativeBounds=elements=>visibleBounds(elements).map(box=>({
   left:box.left-bounds.left,top:box.top-bounds.top,right:box.right-bounds.left,bottom:box.bottom-bounds.top,
  }));
  const fields=relativeBounds(dimensions.filter(({panel})=>!panel.hidden).flatMap(({elements})=>elements));
  const gap=8;
  const fieldOverlap=fields.some(rect=>intersects(previous||base,panelWidth,panelHeight,rect,gap));
  if(!viewSettled&&!fieldOverlap)return;
  const {points,objects}=getDrawing();
  const drawing=objects.map(object=>projectedBounds(object,camera,width,height)).filter(Boolean);
  for(const point of points){
   const p=point.clone().project(camera),x=(p.x+1)*width/2,y=(1-p.y)*height/2;
   if(p.z>=-1&&p.z<=1&&x>=0&&x<=width&&y>=0&&y<=height)drawing.push({left:x,top:y,right:x,bottom:y});
  }
  const obstacles=[...fields,...drawing];
  if(viewSettled&&!obstacles.some(rect=>intersects(base,panelWidth,panelHeight,rect,previous?20:gap))){
   previous=null;move();return;
  }
  const controls=relativeBounds([...header,...right,...bottom]);
  const space={width,height,panelWidth,panelHeight,anchor:{x:base.x+panelWidth/2,y:base.y+panelHeight/2},previous,margin:8,gap};
  let placement=findPanelSpace({...space,obstacles:[...controls,...obstacles]});
  if(!placement&&fieldOverlap)placement=findPanelSpace({...space,obstacles:[...controls,...fields]});
  if(placement){previous=placement;move(previous.x-base.x,previous.y-base.y);}
 }};
}
