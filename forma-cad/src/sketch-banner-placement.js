import {findPanelSpace,projectedBounds} from './panel-placement.js';

const visibleBounds=controls=>controls.filter(control=>control.getClientRects().length).map(control=>control.getBoundingClientRect());
const intersects=(point,width,height,rect,gap)=>point.x+width+gap>rect.left&&point.x-gap<rect.right&&
 point.y+height+gap>rect.top&&point.y-gap<rect.bottom;

export function createSketchBannerPlacement({banner,host,camera,header,right,bottom}){
 const viewport=host.parentElement;
 let previous=null,lastCamera;
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
 return {update(getDrawing){
  if(banner.hidden||!getDrawing){
   if(previous)move();
   previous=null;lastCamera=undefined;
   return;
  }
  const cameraState=host.dataset.cameraState;
  const cameraMoved=lastCamera!==undefined&&cameraState!==lastCamera;
  lastCamera=cameraState;
  // Cursor motion changes the preview continuously, including when approaching the toolbar.
  if(!cameraMoved)return;
  if(banner.matches(':hover,:has(:focus-visible)'))return;
  const {points,objects}=getDrawing();
  const width=host.clientWidth,height=host.clientHeight,panelWidth=banner.offsetWidth,panelHeight=banner.offsetHeight;
  if(!width||!height||!panelWidth||!panelHeight)return;
  const base={x:banner.offsetLeft,y:banner.offsetTop};
  const drawing=objects.map(object=>projectedBounds(object,camera,width,height)).filter(Boolean);
  for(const point of points){
   const p=point.clone().project(camera),x=(p.x+1)*width/2,y=(1-p.y)*height/2;
   if(p.z>=-1&&p.z<=1&&x>=0&&x<=width&&y>=0&&y<=height)drawing.push({left:x,top:y,right:x,bottom:y});
  }
  const gap=8;
  if(!drawing.some(rect=>intersects(base,panelWidth,panelHeight,rect,previous?20:gap))){
   previous=null;move();return;
  }
  const bounds=viewport.getBoundingClientRect();
  const controls=visibleBounds([...header,...right,...bottom]).map(box=>({
   left:box.left-bounds.left,top:box.top-bounds.top,right:box.right-bounds.left,bottom:box.bottom-bounds.top,
  }));
  previous=findPanelSpace({width,height,panelWidth,panelHeight,obstacles:[...controls,...drawing],
   anchor:{x:base.x+panelWidth/2,y:base.y+panelHeight/2},previous,margin:8,gap});
  if(previous)move(previous.x-base.x,previous.y-base.y);else move();
 }};
}
