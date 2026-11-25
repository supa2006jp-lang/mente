import {drawingScaleLabel,parseDrawingScale,stepDrawingScale} from './drawing-view-preferences.js';

export function installDrawingInlineScales({makeInput,syncInput,changeScale,viewLabel}){
 const element=document.createElement('div'),editor=document.createElement('div');
 element.className='drawing-inline-scales';
 editor.className='drawing-inline-scale-editor';editor.hidden=true;editor.setAttribute('role','group');
 const badges=new Map();
 let active=null,svg=null,views={},viewTitles={},viewLocks={};
 const scale=()=>views[active]?.scale;
 const input=makeInput(apply,{optional:false,effectiveScale:scale});
 input.dataset.inlineScaleInput='true';
 const minus=stepButton('−',-1,'縮尺を小さく'),plus=stepButton('＋',1,'縮尺を大きく');
 const dismiss=document.createElement('button');
 dismiss.type='button';dismiss.textContent='×';dismiss.setAttribute('aria-label','縮尺入力を閉じる');
 dismiss.onclick=()=>close(true);
 editor.append(minus,input,plus,dismiss);element.append(editor);

 function stepButton(text,direction,label){
  const button=document.createElement('button');
  button.type='button';button.textContent=text;button.dataset.inlineScaleStep=String(direction);
  button.setAttribute('aria-label',label);button.title=label;
  button.onpointerdown=event=>{if(event.button===0&&document.activeElement===input)event.preventDefault();};
  button.onclick=()=>{
   const value=parseDrawingScale(input.value)??scale();
   if(value!==undefined)apply(stepDrawingScale(value,direction));
  };
  return button;
 }
 function syncEditor(force=false){
  const value=scale();
  if(value===undefined)return;
  syncInput(input,value,force);
  minus.disabled=input.disabled||stepDrawingScale(value,-1)>=value;
  plus.disabled=input.disabled||stepDrawingScale(value,1)<=value;
 }
 function apply(value){
  if(active===null)return;
  changeScale(active,value);
  syncEditor(true);
 }
 function open(name){
  if(viewLocks[name])return;
  active=name;
  const label=viewLabel(name)+' の縮尺';
  editor.setAttribute('aria-label',label);input.setAttribute('aria-label',label+'を入力');
  editor.hidden=false;syncEditor(true);position();
  input.focus({preventScroll:true});input.select();
 }
 function close(returnFocus=false){
  if(active===null)return false;
  const name=active;
  // Discard an uncommitted value when dismissing the field with Escape.
  syncEditor(true);
  active=null;editor.hidden=true;position();
  if(returnFocus)badges.get(name)?.focus({preventScroll:true});
  return true;
 }
 function position(){
  const matrix=svg?.isConnected&&svg.getScreenCTM();
  if(!matrix)return;
  const {left,top,width,height}=element.getBoundingClientRect();
  if(!width||!height)return;
  const gap=1.8*Math.hypot(matrix.a,matrix.b)+4;
  const inset=4,clamp=(value,limit)=>Math.max(inset,Math.min(value,limit-inset));
  const titles=Object.values(viewTitles).map(box=>{
   const a=new DOMPoint(box.x,box.y).matrixTransform(matrix);
   const b=new DOMPoint(box.x+box.width,box.y+box.height).matrixTransform(matrix);
   return {left:a.x-left,top:a.y-top,right:b.x-left,bottom:b.y-top};
  });
  function place(control,view,keepVisible){
   const corner=new DOMPoint(view.x+view.width,view.y+view.height).matrixTransform(matrix);
   const x=corner.x-left,y=corner.y-top;
   control.hidden=!keepVisible&&(x<0||x>width||y<0||y>height);
   if(control.hidden)return;
   const w=control.offsetWidth,h=control.offsetHeight;
   const right=x+gap+w<=width-inset,below=y+gap+h<=height-inset;
   const choices=[
    ...(right?[[x+gap,y-h/2]]:[]),
    ...(below?[[x-w,y+gap]]:[]),
    [x-w,y-gap-h],[x-gap-w,y-h/2],
   ].map(([x,y])=>[clamp(x,width-w),clamp(y,height-h)]);
   const [controlX,controlY]=choices.find(([x,y])=>!titles.some(t=>
    x<t.right+1&&x+w>t.left-1&&y<t.bottom+1&&y+h>t.top-1))??choices[0];
   control.style.left=controlX+'px';control.style.top=controlY+'px';
  }
  for(const [name,badge] of badges){
   if(name===active)badge.hidden=true;
   else place(badge,views[name],false);
  }
  if(active!==null)place(editor,views[active],true);
 }
 function sync(nextSVG,nextViews,nextTitles={},nextLocks={}){
  svg=nextSVG;views=nextViews;viewTitles=nextTitles;viewLocks=nextLocks;
  if(active!==null&&(!Object.hasOwn(views,active)||viewLocks[active]))close();
  for(const [name,badge] of badges){
   if(!Object.hasOwn(views,name)){badge.remove();badges.delete(name);}
  }
  for(const [name,view] of Object.entries(views)){
   let badge=badges.get(name);
   if(!badge){
    badge=document.createElement('button');badge.type='button';badge.className='drawing-inline-scale-badge';
    badge.dataset.inlineViewScale=name;badge.onclick=()=>open(name);
    badges.set(name,badge);element.insertBefore(badge,editor);
   }
   const fixed=!!viewLocks[name];
   badge.disabled=fixed;
   badge.textContent=(fixed?'固定 ':'')+drawingScaleLabel(view.scale);
   badge.title=viewLabel(name)+(fixed?' の位置と縮尺を固定中':' の縮尺を編集');
   badge.setAttribute('aria-label',badge.title+'（'+badge.textContent+'）');
  }
  syncEditor();position();
 }
 return {element,sync,position,close};
}
