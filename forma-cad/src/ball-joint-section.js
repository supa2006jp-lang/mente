import * as THREE from 'three';
import {sectionSegments} from './section-view.js';
import {sectionFillStrips} from './coil-section.js';
import {ballJointSettings} from './ball-joint-settings.js';
import {draggablePanel} from './draggable-panel.js';

// Restore the kernel's exact CAD placement, including print-bed rotation and translation.
// A screw advance must rotate as well as translate; otherwise the thread section is wrong.
export function createBallClampSectionModel(result){
 const q=result.analysis,s=ballJointSettings(q,q.settings),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),angle=Math.PI/s.slotCount,sectionRotation=new THREE.Matrix4().makeRotationZ(-angle);
 const geometries=result.outputs.map((output,index)=>{
  const inverse=new THREE.Matrix4().fromArray(q.placements[index]).invert(),vertices=[];
  for(let i=0;i<output.vertices.length;i+=3)vertices.push(...new THREE.Vector3(...output.vertices.slice(i,i+3)).applyMatrix4(inverse).toArray());
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(output.triangles);return g;
 });
 const stopTravel=s.socketTop-s.nutTop;
 function slicePart(index,advance){
  const transform=sectionRotation.clone();if(index===2)transform.multiply(new THREE.Matrix4().makeTranslation(0,0,advance)).multiply(new THREE.Matrix4().makeRotationZ(advance/s.threadPitch*2*Math.PI));
  const g=geometries[index].clone().applyMatrix4(transform);
  try{const segments=sectionSegments(g,plane);return {segments,fill:sectionFillStrips(segments)};}finally{g.dispose();}
 }
 const stationary=[slicePart(0,0),slicePart(1,0)];
 return {s,stopTravel,slice(value=0){const advance=Math.min(stopTravel,Math.max(0,Number.isFinite(value)?value:0)),rotation=advance/s.threadPitch*360;return {s,stopTravel,advance,rotation,remaining:stopTravel-advance,phase:advance>=stopTravel-1e-7?'stop':advance>=s.clampingTravel-1e-7?'ball':advance>=s.contactTravel-1e-7?'seat':'free',parts:[...stationary,slicePart(2,advance)]};},dispose(){geometries.forEach(g=>g.dispose());}};
}
const ns='http://www.w3.org/2000/svg',node=(tag,attrs={},text)=>{const el=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;},fmt=v=>v.toFixed(2);
export function createBallClampSection(parent){
 const panel=document.createElement('section');panel.id='ball-clamp-section-panel';panel.hidden=true;
 panel.innerHTML='<button id="ball-clamp-close" type="button" aria-label="締め付け断面を閉じる">×</button><p>水色：球側 ／ 橙色：受け側 ／ 紫：ナット。実形状を組み立て位置に戻し、ねじピッチに合わせてナットを回転・前進させた断面です。</p><label>ナットの前進量 <output id="ball-clamp-value"></output><input id="ball-clamp-travel" type="range" min="0" max="1" step="0.001" value="0" aria-label="ナットの前進量"></label><div class="ball-clamp-actions"><button type="button" data-ball-clamp-at="initial">初期位置</button><button type="button" data-ball-clamp-at="seat">受けに接触</button><button type="button" data-ball-clamp-at="ball">球に当たる目安</button><button type="button" data-ball-clamp-at="end">締め代の終端</button><button type="button" data-ball-clamp-at="stop">底付き位置</button></div><div class="ball-clamp-actions"><button type="button" data-ball-clamp-focus="joint">接合部全体</button><button type="button" data-ball-clamp-focus="seat">締め付け面を拡大</button><button type="button" data-ball-clamp-focus="stop">底付き面を拡大</button></div><p id="ball-clamp-status" role="status" aria-live="polite"></p><svg viewBox="0 0 680 420" role="img" aria-label="ボールジョイントの締め付け状態の実形状断面"></svg><p id="ball-clamp-metrics"></p><p>接触後も受けは変形させず表示します。斜面の重なりは締め込みによる押し込み量です。球への接触はすき間と斜面から求めた目安で、材料のたわみ・摩擦・保持力は計算しません。この操作はプレビュー専用で、保存・出力する形状や配置は変わりません。</p>';
 const style=document.createElement('style');style.textContent='#ball-clamp-section-panel{position:absolute;left:var(--panel-left,12px);top:var(--panel-top,90px);z-index:105;width:min(680px,calc(100% - 24px));max-height:calc(100% - 110px);overflow:auto;padding:14px;border:1px solid #7896aa;border-radius:10px;background:#f5fafdf5;color:#234457;box-shadow:0 8px 25px #0003}#ball-clamp-section-panel[hidden]{display:none}#ball-clamp-section-panel p,#ball-clamp-section-panel label{color:#234457;font-size:13px;line-height:1.6;margin:8px 0}#ball-clamp-section-panel .panel-drag-handle{padding-right:32px;font-weight:bold;cursor:grab}#ball-clamp-close{position:absolute;right:10px;top:8px}#ball-clamp-section-panel button{padding:7px;background:#edf4f8;color:#234457;border:1px solid #9ab6c7;border-radius:5px}#ball-clamp-section-panel button[aria-pressed=true]{background:#c5ebf2;border-color:#1687a3}#ball-clamp-section-panel svg{display:block;width:100%;max-height:42vh;background:white;border-radius:5px}#ball-clamp-section-panel input{display:block;width:100%;accent-color:#8962af}#ball-clamp-value{font-weight:bold;color:#234457}.ball-clamp-actions{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}';document.head.append(style);parent.append(panel);draggablePanel(panel,'ナットの締め付け断面');
 let model=null,advance=0,focus='joint';const svg=panel.querySelector('svg'),range=panel.querySelector('input'),value=panel.querySelector('output'),status=panel.querySelector('#ball-clamp-status'),metrics=panel.querySelector('#ball-clamp-metrics');
 function controls(enabled){for(const el of panel.querySelectorAll('input,button'))if(el.id!=='ball-clamp-close')el.disabled=!enabled;}
 function draw(){
  if(!model||panel.hidden)return;const d=model.slice(advance),{s,parts}=d;advance=d.advance;range.value=advance;value.textContent=fmt(advance)+' mm ／ '+fmt(d.rotation)+'°';
  let bounds=[-s.nutRadius-1,s.mouth-2,s.nutRadius+1,s.socketTop+1];
  if(focus==='seat')bounds=[s.mouthRadius-.8,s.mouth-1,s.nutRadius+.5,s.coneEnd+model.stopTravel+1];
  if(focus==='stop')bounds=[s.core-1,s.nutTop-1.5,s.nutRadius+1,s.socketTop+1];
  const scale=Math.min(600/(bounds[2]-bounds[0]),340/(bounds[3]-bounds[1])),cx=(bounds[0]+bounds[2])/2,cz=(bounds[1]+bounds[3])/2,map=p=>[340+(p[0]-cx)*scale,210-(p[1]-cz)*scale];
  svg.replaceChildren();const defs=node('defs'),clip=node('clipPath',{id:'ball-clamp-clip'});clip.append(node('rect',{x:12,y:16,width:656,height:388}));defs.append(clip);svg.append(defs);const drawing=node('g',{'clip-path':'url(#ball-clamp-clip)'});svg.append(drawing);
  for(const [index,part]of parts.entries()){
   let path='';for(let i=0;i<part.fill.length;i+=3)path+='M'+map(part.fill[i]).join(',')+'L'+map(part.fill[i+1]).join(',')+'L'+map(part.fill[i+2]).join(',')+'Z';drawing.append(node('path',{'data-ball-clamp-part':index,d:path,fill:['#6cafd2','#e4aa55','#b586df'][index],'fill-opacity':'.65','shape-rendering':'crispEdges'}));
   path='';for(let i=0;i<part.segments.length;i+=6)path+='M'+map([part.segments[i],part.segments[i+2]]).join(',')+'L'+map([part.segments[i+3],part.segments[i+5]]).join(',');drawing.append(node('path',{d:path,fill:'none',stroke:['#146782','#99550c','#69448b'][index],'stroke-width':1.3}));
  }
  // The socket shoulder is the physical axial stop; the usable travel stops 0.15 mm before it.
  for(const [z,color,dash]of [[s.socketTop,'#c43b36','6 4'],[s.nutTop+advance,'#69448b','3 3']]){const a=map([s.core,z]),b=map([s.nutRadius+.6,z]);drawing.append(node('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:color,'stroke-width':2,'stroke-dasharray':dash}));}
  if(advance>=s.contactTravel-1e-7){const bottom=Math.max(s.mouth+advance,s.mouth),top=Math.min(s.coneEnd+advance,s.coneEnd);for(const sign of [-1,1]){const a=map([sign*(s.core-s.coneDepth+(bottom-s.mouth)*s.coneDepth/s.coneHeight),bottom]),b=map([sign*s.core,top]);if(top>bottom)drawing.append(node('line',{'data-ball-clamp-contact':'seat',x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:'#d73535','stroke-width':4,'stroke-linecap':'round'}));}}
  const labels={free:'締め付け面はまだ接触していません',seat:'締め付け面が受けに接触しています',ball:'球に当たる目安に達しています',stop:'ナットが受けの土台に底付きする位置です'};status.textContent=labels[d.phase]+(Math.abs(advance-s.availableTravel)<1e-6?'（設定した締め代の終端）':'');
  metrics.textContent='受けに接触 '+fmt(s.contactTravel)+' mm ／ 球に当たる目安 '+fmt(s.clampingTravel)+' mm ／ 締め代の終端 '+fmt(s.availableTravel)+' mm ／ 底付き '+fmt(model.stopTravel)+' mm。現在の底付きまで '+fmt(d.remaining)+' mm。赤破線：受けの底付き面 ／ 紫破線：ナットの端面。';
  panel.dataset.state=JSON.stringify({advance,rotation:d.rotation,remaining:d.remaining,phase:d.phase,contactTravel:s.contactTravel,clampingTravel:s.clampingTravel,availableTravel:s.availableTravel,stopTravel:model.stopTravel});panel.dataset.sectionReady='true';
  for(const b of panel.querySelectorAll('[data-ball-clamp-focus]'))b.setAttribute('aria-pressed',String(b.dataset.ballClampFocus===focus));
 }
 range.oninput=()=>{advance=Number(range.value);draw();};
 for(const b of panel.querySelectorAll('[data-ball-clamp-at]'))b.onclick=()=>{if(!model)return;advance={initial:0,seat:model.s.contactTravel,ball:model.s.clampingTravel,end:model.s.availableTravel,stop:model.stopTravel}[b.dataset.ballClampAt];draw();};
 for(const b of panel.querySelectorAll('[data-ball-clamp-focus]'))b.onclick=()=>{focus=b.dataset.ballClampFocus;draw();};
 function clear(){model?.dispose();model=null;svg.replaceChildren();metrics.textContent='';value.textContent='';delete panel.dataset.state;delete panel.dataset.sectionReady;controls(false);}
 function close(){panel.hidden=true;}
 panel.querySelector('#ball-clamp-close').onclick=close;controls(false);
 return {open(){panel.hidden=false;draw();},close,reset(){close();clear();advance=0;focus='joint';},pending(){clear();status.textContent='形状を計算して断面を更新しています…';},error(message){clear();status.textContent=message;},update(result){clear();model=createBallClampSectionModel(result);range.max=String(model.stopTravel);controls(true);draw();}};
}
