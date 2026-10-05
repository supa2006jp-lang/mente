import * as THREE from 'three';
import {sectionSegments} from './section-view.js';
import {sectionFillStrips} from './coil-section.js';
import {draggablePanel} from './draggable-panel.js';
export function unposeSnapPoint(point,index,analysis,pose){
 if(pose!=='print')return [...point];
 if(index===0)return [point[0],point[1],point[2]+analysis.lowerMin];
 const {pivot,translation}=analysis.lidPose;
 return [point[0]-translation[0],2*pivot[1]-point[1]+translation[1],2*pivot[2]-point[2]+translation[2]];
}
export function poseSnapPoint(point,index,analysis,pose){
 if(pose!=='print')return [...point];
 if(index===0)return [point[0],point[1],point[2]-analysis.lowerMin];
 const {pivot,translation}=analysis.lidPose;
 return [point[0]+translation[0],2*pivot[1]-point[1]+translation[1],2*pivot[2]-point[2]+translation[2]];
}
export function unposeSnapNormal(normal,pose){return pose==='print'?[normal[0],-normal[1],-normal[2]]:[...normal];}
export function snapLidSectionData(result,spec){
 const q=result.analysis,side=q.opening?.sides[0]||q.sectionSides.reduce((a,b)=>(b.length??Infinity)<(a.length??Infinity)?b:a),{center,normal}=side,tangent=[normal[1],-normal[0]],parts=[];
 for(const [index,output]of result.outputs.entries()){
  const vertices=[];
  for(let i=0;i<output.vertices.length;i+=3){const p=unposeSnapPoint(output.vertices.slice(i,i+3),index,q,spec.pose),x=p[0]-center[0],y=p[1]-center[1];vertices.push(x*normal[0]+y*normal[1],x*tangent[0]+y*tangent[1],p[2]-q.seam);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(output.triangles);
  try{const segments=sectionSegments(geometry,new THREE.Plane(new THREE.Vector3(0,1,0),0));parts.push({lid:index===1,segments,fill:sectionFillStrips(segments)});}finally{geometry.dispose();}
 }
 const peak=spec.insertion/2;
 return {parts,side,q,spec,gap:{a:[-spec.lidWall-spec.clearance+spec.ridge,peak],b:[-spec.lidWall+spec.ridge,peak],value:spec.clearance},ridge:{a:[-spec.lidWall-spec.clearance,peak],b:[-spec.lidWall-spec.clearance+spec.ridge,peak],value:spec.ridge}};
}
const ns='http://www.w3.org/2000/svg',fmt=v=>v.toFixed(2),node=(tag,attrs={},text)=>{const el=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;};
export function createSnapLidSection(parent){
 const panel=document.createElement('section');panel.id='snap-lid-section-panel';panel.hidden=true;
 panel.innerHTML='<button type="button" class="snap-section-close" aria-label="断面図を閉じる">×</button><p>組み付け位置の実際の形状です。水色：本体 ／ 橙色：蓋。選んだ側面の中央を切った断面です。</p><div class="snap-section-actions"><button type="button" data-snap-focus="joint">山と溝を拡大</button><button type="button" data-snap-focus="opening">爪掛けを拡大</button><button type="button" data-snap-focus="all">全体</button></div><p class="snap-section-status" role="status" aria-live="polite"></p><svg viewBox="0 0 640 380" role="img" aria-label="被せ蓋の拡大断面と寸法"></svg><div class="snap-section-metrics"></div>';
 const style=document.createElement('style');style.textContent='#snap-lid-section-panel{position:absolute;left:var(--panel-left,12px);top:var(--panel-top,90px);z-index:105;width:min(640px,calc(100% - 24px));max-height:calc(100% - 100px);overflow:auto;padding:14px;border:1px solid #7896aa;border-radius:10px;background:#f5fafded;color:#234457;box-shadow:0 8px 25px #0003}#snap-lid-section-panel[hidden]{display:none}#snap-lid-section-panel .panel-drag-handle{padding-right:32px;font-weight:bold;cursor:grab}#snap-lid-section-panel p{font-size:13px;line-height:1.5;margin:8px 0}#snap-lid-section-panel svg{display:block;width:100%;max-height:45vh;background:white;border-radius:5px}#snap-lid-section-panel button{padding:7px;background:#edf4f8;color:#234457;border:1px solid #9ab6c7;border-radius:5px}#snap-lid-section-panel button[aria-pressed=true]{background:#c5ebf2;border-color:#1687a3}#snap-lid-section-panel .snap-section-close{position:absolute;right:10px;top:8px}.snap-section-actions{display:flex;flex-wrap:wrap;gap:6px}.snap-section-metrics{font-size:13px;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-top:10px}.snap-section-metrics b{display:block;font-size:16px}';document.head.append(style);parent.append(panel);draggablePanel(panel,'被せ蓋の拡大断面');
 let data=null,focus='joint';const svg=panel.querySelector('svg'),status=panel.querySelector('.snap-section-status'),metrics=panel.querySelector('.snap-section-metrics');
 function draw(){
  if(!data)return;const {parts,q,spec,gap,ridge}=data,W=640,H=380;svg.replaceChildren();
  let bounds=[-spec.bodyWall-2,-1.5,2,spec.insertion+2];
  if(focus==='opening'&&q.opening)bounds=[-spec.bodyWall-2,q.opening.lip-1,2,q.opening.lip+q.opening.height+1.5];
  if(focus==='all'){const points=parts.flatMap(p=>{const a=[];for(let i=0;i<p.segments.length;i+=3)a.push([p.segments[i],p.segments[i+2]]);return a;});if(points.length)bounds=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];}
  const scale=Math.min((W-130)/Math.max(.01,bounds[2]-bounds[0]),(H-90)/Math.max(.01,bounds[3]-bounds[1])),cx=(bounds[0]+bounds[2])/2,cz=(bounds[1]+bounds[3])/2,map=p=>[W/2+(p[0]-cx)*scale,H/2-(p[1]-cz)*scale];
  svg.append(node('title',{},'山 '+fmt(spec.ridge)+' mm、山と溝のすき間 '+fmt(spec.clearance)+' mm'));
  const defs=node('defs'),clip=node('clipPath',{id:'snap-section-clip'});clip.append(node('rect',{x:8,y:35,width:W-16,height:H-43}));defs.append(clip);svg.append(defs);const drawing=node('g',{'clip-path':'url(#snap-section-clip)'});svg.append(drawing);
  for(const part of parts){let d='';for(let i=0;i<part.fill.length;i+=3)d+='M'+map(part.fill[i]).join(',')+'L'+map(part.fill[i+1]).join(',')+'L'+map(part.fill[i+2]).join(',')+'Z';drawing.append(node('path',{d,fill:part.lid?'#edb35d':'#76c0dc','fill-opacity':'.7'}));d='';for(let i=0;i<part.segments.length;i+=6)d+='M'+map([part.segments[i],part.segments[i+2]]).join(',')+'L'+map([part.segments[i+3],part.segments[i+5]]).join(',');drawing.append(node('path',{d,fill:'none',stroke:part.lid?'#99550c':'#087698','stroke-width':1.3}));}
  function dimension(d,label,y,color){const a=map(d.a),b=map(d.b),line=(p,r)=>svg.append(node('line',{x1:p[0],y1:p[1],x2:r[0],y2:r[1],stroke:color,'stroke-width':1.8}));line(a,b);for(const p of [a,b])line([p[0],p[1]-5],[p[0],p[1]+5]);line([(a[0]+b[0])/2,(a[1]+b[1])/2],[W-195,y+8]);svg.append(node('rect',{x:W-190,y:y-15,width:180,height:28,fill:'#ffffffee',rx:4}));svg.append(node('text',{x:W-22,y,'text-anchor':'end',fill:color,'font-size':15,'font-weight':'600'},label+' '+fmt(d.value)+' mm'));}
  if(focus==='joint'){dimension(gap,'すき間',58,'#075b76');dimension(ridge,'山高さ',91,'#985310');}
  if(focus==='opening'&&q.opening)dimension({a:[-q.opening.depth,q.opening.lip+q.opening.height],b:[0,q.opening.lip+q.opening.height],value:q.opening.depth},'爪掛け深さ',58,'#985310');
  const entries=[['山と溝のすき間',spec.clearance],['山高さ',spec.ridge],['差し込み部の肉厚',q.neckWall]];if(q.opening)entries.push(['爪掛け 幅 / 高さ / 深さ',[q.opening.width,q.opening.height,q.opening.depth]],['固定溝裏の最小肉厚',q.opening.remainingWall]);metrics.replaceChildren(...entries.map(([label,value])=>{const el=document.createElement('div');el.textContent=label;const b=document.createElement('b');b.textContent=(Array.isArray(value)?value.map(fmt).join(' / '):fmt(value))+' mm';el.append(b);return el;}));
  status.textContent='外側 → 右 ／ 内側 → 左。寸法は計算後の値です。';panel.dataset.focus=focus;panel.dataset.clearance=spec.clearance;panel.dataset.openingCount=q.opening?.count??0;for(const button of panel.querySelectorAll('[data-snap-focus]')){button.setAttribute('aria-pressed',String(button.dataset.snapFocus===focus));if(button.dataset.snapFocus==='opening')button.disabled=!q.opening;}
 }
 panel.querySelector('.snap-section-close').onclick=()=>panel.hidden=true;for(const button of panel.querySelectorAll('[data-snap-focus]'))button.onclick=()=>{focus=button.dataset.snapFocus;draw();};
 return {open(){panel.hidden=false;draw();},close(){panel.hidden=true;data=null;svg.replaceChildren();metrics.replaceChildren();},pending(){data=null;delete panel.dataset.clearance;delete panel.dataset.openingCount;svg.replaceChildren();metrics.replaceChildren();status.textContent='形状を計算して断面を更新しています…';},error(message){this.pending();status.textContent=message;},update(result,spec){data=snapLidSectionData(result,spec);draw();}};
}
