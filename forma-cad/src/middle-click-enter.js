// A middle click confirms; a drag remains available to the existing camera controls.
export function installMiddleClickEnter(confirm,isTarget){
 let press=null;
 const cancel=()=>{press=null;};
 document.addEventListener('pointerdown',event=>{
  if(event.button!==1||event.shiftKey||event.ctrlKey||event.metaKey||event.altKey||!isTarget(event))return;
  event.preventDefault();press={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false,focus:document.activeElement};
 },{capture:true});
 document.addEventListener('pointermove',event=>{if(press&&event.pointerId===press.id&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>5)press.moved=true;},{capture:true});
 document.addEventListener('pointerup',event=>{
  if(!press||event.pointerId!==press.id||event.button!==1)return;
  const finished=press;press=null;
  if(finished.moved||event.shiftKey||event.ctrlKey||event.metaKey||event.altKey||Math.hypot(event.clientX-finished.x,event.clientY-finished.y)>5)return;
  event.preventDefault();queueMicrotask(()=>confirm(finished.focus));
 },{capture:true});
 for(const type of ['pointercancel','lostpointercapture'])document.addEventListener(type,event=>{if(event.pointerId===press?.id)cancel();},{capture:true});
 window.addEventListener('blur',cancel);
 window.addEventListener('keydown',event=>{if(event.key==='Escape')cancel();},{capture:true});
 document.addEventListener('auxclick',event=>{if(event.button===1&&isTarget(event))event.preventDefault();},{capture:true});
 return {cancel};
}
