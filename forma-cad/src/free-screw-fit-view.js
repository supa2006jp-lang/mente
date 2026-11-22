import {draggablePanel} from './draggable-panel.js';
import {createFreeScrewFitMotion} from './free-screw-fit-motion.js';

const ns='http://www.w3.org/2000/svg';
const format=value=>Number(value.toFixed(3));
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
 <div class="screw-section-motion" hidden>
 <label for="free-screw-fit-advance">ナットの回転</label><span id="free-screw-fit-travel"></span>
 <input id="free-screw-fit-advance" type="range" min="0" step="any">
 <div class="screw-section-endpoints"><span>先端</span><span>座面</span></div>
 </div>
 <p id="free-screw-fit-status" role="status"></p>
 <svg role="img" aria-label="ねじとナットの組み合わせ断面"></svg>
 <p class="screw-section-legend"><span>ねじ</span><span>ナット</span><span>断面内の重なり</span></p>`;
 host.append(panel);
 draggablePanel(panel,'ねじとナットの断面');
 const svg=panel.querySelector('svg'),status=panel.querySelector('#free-screw-fit-status');
 const slider=panel.querySelector('#free-screw-fit-advance'),travel=panel.querySelector('#free-screw-fit-travel');
 const motionControls=panel.querySelector('.screw-section-motion');
 const controls=[...panel.querySelectorAll('[data-screw-focus]')];
 let data=null,motion=null,focus='engagement',settings=null,frame=0;
 let nutRadius=0,horizontalBounds=[],screwPath='';

 function draw(){
  const all=focus==='all';
  const [xmin,xmax]=all?horizontalBounds:[-nutRadius,nutRadius];
  const zmin=all?(settings.headDown?0:-settings.nut.height):data.nutBottom;
  const zmax=all?settings.length+settings.headHeight+(settings.headDown?settings.nut.height:0):data.nutTop;
  const margin=Math.max(settings.pitch*.45,(xmax-xmin)*.06);
  svg.setAttribute('viewBox',[xmin-margin,-zmax-margin,xmax-xmin+2*margin,zmax-zmin+2*margin].join(' '));
  svg.replaceChildren();
  for(const [part,fill,stroke] of [['screw','#83c7d9','#246580'],['nut','#edbd7e','#9b551d'],['overlap','#da4345','#a2262e']]){
   if(part==='overlap'&&data.overlapArea<.0005)continue;
   svg.append(svgNode('path',{d:part==='screw'?screwPath:outlines(data[part]),fill,stroke,'fill-rule':'evenodd',
    'stroke-width':.8,'vector-effect':'non-scaling-stroke','data-screw-section':part}));
  }
  svg.removeAttribute('hidden');
  status.textContent='この断面の重なり '+format(data.overlapArea)+' mm²';
  for(const button of controls)button.setAttribute('aria-pressed',String(button.dataset.screwFocus===focus));
 }
 function updateTravel(advance){
  travel.textContent=format(advance/settings.pitch)+' 回転・先端から '+format(advance)+' mm';
  slider.setAttribute('aria-valuetext',travel.textContent);
 }
 slider.oninput=()=>{
  cancelAnimationFrame(frame);
  frame=requestAnimationFrame(()=>{
   frame=0;
   const advance=slider.valueAsNumber;
   updateTravel(advance);
   try{data=motion.at(advance);draw();}
   catch(error){data=null;svg.setAttribute('hidden','');status.textContent=error.message;}
  });
 };
 for(const button of controls)button.onclick=()=>{if(data){focus=button.dataset.screwFocus;draw();}};
 function reset(){
  cancelAnimationFrame(frame);frame=0;
  motion?.dispose();motion=null;data=null;settings=null;screwPath='';
  motionControls.hidden=true;slider.disabled=true;svg.replaceChildren();svg.setAttribute('hidden','');
  controls.forEach(button=>button.disabled=true);
 }
 function close(){reset();panel.hidden=true;}
 panel.querySelector('#free-screw-fit-close').onclick=close;
 return {
  get active(){return !panel.hidden;},
  close,
  pending(message){
   reset();status.textContent=message;panel.hidden=false;
  },
  show(result,spec){
   reset();
   data=result;settings=spec;motion=createFreeScrewFitMotion(result,spec);focus='engagement';
   nutRadius=result.nutRadius;horizontalBounds=[-nutRadius,nutRadius];
   for(const ring of result.screw)for(const [x] of ring){
    horizontalBounds[0]=Math.min(horizontalBounds[0],x);
    horizontalBounds[1]=Math.max(horizontalBounds[1],x);
   }
   screwPath=outlines(result.screw);
   slider.max=String(settings.length);slider.value=String(result.advance);updateTravel(result.advance);
   panel.hidden=false;motionControls.hidden=false;slider.disabled=false;
   controls.forEach(button=>button.disabled=false);
   draw();
  }
 };
}
