// Screen navigation only. The drawingSheet SVG used for export stays unchanged.
export function drawingViewport({dialog,host,minus,plus,fit,percent,expand,canNavigate=()=>true}){
 let sheet=null,zoom=1,center=[0,0],space=false,pan=null,suppress=false;
 const svg=()=>host.querySelector('svg');
 function markers(){const node=svg(),m=node?.getScreenCTM();if(!m)return;const radius=3.5/Math.hypot(m.a,m.b);for(const p of node.querySelectorAll('[data-snap-point]'))p.setAttribute('r',radius);}
 function apply(){const node=svg();if(node&&sheet){const w=sheet.width/zoom,h=sheet.height/zoom;node.setAttribute('viewBox',`${center[0]-w/2} ${center[1]-h/2} ${w} ${h}`);const background=node.firstElementChild;if(background?.tagName==='rect'){background.setAttribute('width',sheet.width);background.setAttribute('height',sheet.height);}markers();}percent.textContent=Math.round(zoom*100)+'%';minus.disabled=!sheet||zoom<=1;plus.disabled=!sheet||zoom>=16;fit.disabled=!sheet;}
 function point(e){const m=svg()?.getScreenCTM();return m?new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse()):null;}
 function change(value,anchor=null){if(!sheet||!canNavigate()||pan)return;const next=Math.max(1,Math.min(16,value)),ratio=next/zoom;if(anchor)center=[anchor.x+(center[0]-anchor.x)/ratio,anchor.y+(center[1]-anchor.y)/ratio];zoom=next;if(zoom===1)center=[sheet.width/2,sheet.height/2];apply();}
 minus.onclick=()=>change(zoom/1.5);plus.onclick=()=>change(zoom*1.5);fit.onclick=()=>change(1);
 host.addEventListener('wheel',e=>{if(!sheet||!canNavigate())return;e.preventDefault();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?host.clientHeight:1);change(zoom*Math.exp(-Math.max(-200,Math.min(200,delta))*.0025),point(e));},{passive:false});
 const expanded=value=>{dialog.classList.toggle('drawing-expanded',value);expand.textContent=value?'通常の表示に戻す':'作業領域を最大化';expand.setAttribute('aria-pressed',String(value));requestAnimationFrame(markers);};
 expand.onclick=()=>expanded(!dialog.classList.contains('drawing-expanded'));
 dialog.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.target.matches('input,textarea,select,button,[contenteditable=true]')){space=true;e.preventDefault();}},true);
 dialog.addEventListener('keyup',e=>{if(e.code==='Space')space=false;});
 function end(e){if(!pan||e&&e.pointerId!==pan.id)return;const id=pan.id;pan=null;host.classList.remove('drawing-panning');if(host.hasPointerCapture(id))host.releasePointerCapture(id);}
 host.addEventListener('pointerdown',e=>{if(!pan)suppress=false;if(!sheet||!canNavigate()||!(e.button===1||e.button===0&&space))return;e.preventDefault();e.stopImmediatePropagation();const matrix=svg()?.getScreenCTM();if(!matrix)return;pan={id:e.pointerId,x:e.clientX,y:e.clientY,center:[...center],inverse:matrix.inverse()};suppress=e.button===0;host.setPointerCapture(e.pointerId);host.classList.add('drawing-panning');},true);
 host.addEventListener('pointermove',e=>{if(!pan||e.pointerId!==pan.id)return;e.preventDefault();e.stopImmediatePropagation();const start=new DOMPoint(pan.x,pan.y).matrixTransform(pan.inverse),p=new DOMPoint(e.clientX,e.clientY).matrixTransform(pan.inverse);center=[pan.center[0]-(p.x-start.x),pan.center[1]-(p.y-start.y)];apply();},true);
 for(const type of ['pointerup','pointercancel'])host.addEventListener(type,e=>{if(!pan)return;e.preventDefault();e.stopImmediatePropagation();end(e);setTimeout(()=>suppress=false,0);},true);
 host.addEventListener('click',e=>{if(!suppress)return;e.preventDefault();e.stopImmediatePropagation();suppress=false;},true);
 host.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault();});
 window.addEventListener('blur',()=>{space=false;end();suppress=false;});
 new ResizeObserver(markers).observe(host);
 return {markers,setSheet(next){if(!sheet||sheet.width!==next.width||sheet.height!==next.height){zoom=1;center=[next.width/2,next.height/2];}sheet=next;apply();},reset(){zoom=1;if(sheet)center=[sheet.width/2,sheet.height/2];apply();},cancel(){space=false;end();suppress=false;expanded(false);}};
}
