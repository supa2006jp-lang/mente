import {draggablePanel} from './draggable-panel.js';

const ns='http://www.w3.org/2000/svg';
function svgNode(name,attributes){
 const node=document.createElementNS(ns,name);
 for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);
 return node;
}
function outlines(rings){
 return rings.map(points=>'M '+points.map(([x,z])=>x+' '+(-z)).join(' L ')+' Z').join(' ');
}

export function createFreeScrewFitView(host){
 const panel=document.createElement('section');
 panel.id='free-screw-fit-panel';panel.hidden=true;
 panel.innerHTML=`<button type="button" id="free-screw-fit-close" aria-label="断面を閉じる">×</button>
 <div class="screw-section-controls">
 <button type="button" data-screw-focus="engagement">かみ合いを拡大</button>
 <button type="button" data-screw-focus="all">全体</button>
 </div>
 <p id="free-screw-fit-status" role="status"></p>
 <svg role="img" aria-label="ねじとナットの組み合わせ断面"></svg>
 <p class="screw-section-legend"><span>ねじ</span><span>ナット</span><span>断面内の重なり</span></p>`;
 host.append(panel);
 draggablePanel(panel,'ねじとナットの断面');
 const svg=panel.querySelector('svg'),status=panel.querySelector('#free-screw-fit-status');
 const controls=[...panel.querySelectorAll('[data-screw-focus]')];
 let data=null,focus='engagement',pitch=1;

 function draw(){
  const all=focus==='all',rings=all?[...data.screw,...data.nut]:data.nut;
  let xmin=Infinity,xmax=-Infinity,zmin=Infinity,zmax=-Infinity;
  for(const ring of rings)for(const [x,z] of ring){
   xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);
   zmin=Math.min(zmin,z);zmax=Math.max(zmax,z);
  }
  const margin=Math.max(pitch*.45,(xmax-xmin)*.06);
  svg.setAttribute('viewBox',[xmin-margin,-zmax-margin,xmax-xmin+2*margin,zmax-zmin+2*margin].join(' '));
  svg.replaceChildren();
  for(const [part,fill,stroke] of [['screw','#83c7d9','#246580'],['nut','#edbd7e','#9b551d'],['overlap','#da4345','#a2262e']]){
   if(part==='overlap'&&data.overlapArea<.0005)continue;
   svg.append(svgNode('path',{d:outlines(data[part]),fill,stroke,'fill-rule':'evenodd',
    'stroke-width':.8,'vector-effect':'non-scaling-stroke','data-screw-section':part}));
  }
  for(const button of controls)button.setAttribute('aria-pressed',String(button.dataset.screwFocus===focus));
 }
 for(const button of controls)button.onclick=()=>{if(data){focus=button.dataset.screwFocus;draw();}};
 function close(){panel.hidden=true;data=null;svg.replaceChildren();}
 panel.querySelector('#free-screw-fit-close').onclick=close;
 return {
  get active(){return !panel.hidden;},
  close,
  pending(message){
   panel.hidden=false;data=null;svg.replaceChildren();svg.hidden=true;
   controls.forEach(button=>button.disabled=true);
   status.textContent=message;
  },
  show(result,settings){
   data=result;pitch=settings.pitch;focus='engagement';
   panel.hidden=false;svg.hidden=false;
   controls.forEach(button=>button.disabled=false);
   status.textContent='この断面の重なり '+Number(data.overlapArea.toFixed(3))+' mm²';
   draw();
  }
 };
}
