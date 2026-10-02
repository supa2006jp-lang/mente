export function drawingCrosshair(host,canvas,isActive){
 const marker=document.createElement('div');marker.id='drawing-crosshair';marker.hidden=true;marker.setAttribute('aria-hidden','true');host.append(marker);
 let pointer=null;
 document.addEventListener('pointermove',event=>{pointer=event.target===canvas?{x:event.clientX,y:event.clientY}:null;});
 canvas.addEventListener('pointerleave',()=>{pointer=null;update();});
 function update(){
  const active=isActive()&&!document.querySelector('dialog[open]');host.classList.toggle('drawing-crosshair-active',active);
  marker.hidden=!active||!pointer;if(marker.hidden)return;
  const rect=host.getBoundingClientRect();marker.style.left=(pointer.x-rect.left)+'px';marker.style.top=(pointer.y-rect.top)+'px';
 }
 return {update};
}
