import {findPanelSpace} from './panel-placement.js';
const operations=[['new','新規','新規ボディ'],['newHoles','穴だけ','新規（穴だけ）'],['join','結合','結合'],['cut','切り取り','切り取り']];
export function createExtrusionWheel(viewport,onChoose,{compact=false}={}){
 const element=document.createElement('div');element.id=compact?'extrude-tip-operation-wheel':'extrude-operation-wheel';element.className='extrude-operation-wheel';element.hidden=true;element.setAttribute('role','group');element.setAttribute('aria-label',compact?'押し出し矢印の操作を切り替え':'押し出し操作を切り替え');
 const buttons=new Map();
 for(const [value,label,name] of operations){const button=document.createElement('button');button.type='button';button.dataset.extrudeOperation=value;button.textContent=label;button.setAttribute('aria-label','押し出し操作：'+name);button.title=name;button.onclick=()=>onChoose(value);element.append(button);buttons.set(value,button);}
 const center=document.createElement('span');center.className='extrude-wheel-center';center.textContent='操作';center.setAttribute('aria-hidden','true');element.append(center);viewport.append(element);
 return {element,update(operation,{hasTarget,holesProblem='',busy=false}){for(const [value,,name] of operations){const button=buttons.get(value),disabled=busy||(['join','cut'].includes(value)&&!hasTarget)||(value==='newHoles'&&!!holesProblem);button.disabled=disabled;button.setAttribute('aria-pressed',String(operation===value));button.title=value==='newHoles'&&holesProblem?holesProblem:['join','cut'].includes(value)&&!hasTarget?'先に対象ボディを作成してください':name;}}};
}

// Prefer the arrow tip, then a free nearby side; controls and the arrow remain
// clickable when the tip approaches a viewport edge or a floating panel.
export function extrusionTipWheelPosition({width,height,x,y,angle,size=104,obstacles=[]}){
 const margin=8,gap=6,half=size/2;if(width<size+margin*2||height<size+margin*2)return null;
 const blockers=[...obstacles,{left:x-30,right:x+30,top:y-30,bottom:y+30}],distance=half+40;
 for(const turn of [0,45,-45,90,-90,135,-135,180]){
  const radians=(angle+turn)*Math.PI/180,left=Math.max(margin,Math.min(width-size-margin,x+Math.sin(radians)*distance-half)),top=Math.max(margin,Math.min(height-size-margin,y-Math.cos(radians)*distance-half));
  if(!blockers.some(r=>left<r.right+gap&&left+size>r.left-gap&&top<r.bottom+gap&&top+size>r.top-gap))return {x:left,y:top};
 }
 return findPanelSpace({width,height,panelWidth:size,panelHeight:size,anchor:{x,y},margin,gap,obstacles:blockers});
}
