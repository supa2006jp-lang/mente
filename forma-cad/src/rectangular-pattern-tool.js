import * as THREE from 'three';
import {betweenPattern,betweenPatternLayout,rectangularOffsets,patternDragValue} from './rectangular-pattern.js';
import {meshPatternExtent} from './pattern-bounds.js';
import {snapMirrorGridPoint} from './mirror-grid-axis.js';

export function createRectangularPatternTool({host,canvas,camera,controls,getSource,getFrame,getReferences,getSnap,fitPreview}){
 const $=id=>document.getElementById(id),fields=$('cad-fields'),dialog=$('tools-dialog');
 const active=()=>dialog.open&&$('cad-command').value==='rectangular';
 const overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');overlay.id='rect-pattern-overlay';overlay.setAttribute('aria-hidden','true');host.append(overlay);
 const handles={};let picking=null,refs=[],drag=null,key='',panel=null;
 const style=document.createElement('style');style.textContent='#rect-pattern-overlay{position:absolute;inset:0;width:100%;height:100%;z-index:13;pointer-events:none}#rect-pattern-overlay[hidden],.rect-pattern-handle[hidden],#rect-pattern-options [hidden]{display:none!important}.rect-pattern-handle{position:absolute;transform:translate(-50%,-50%);z-index:18;touch-action:none;pointer-events:auto;color:white;border:2px solid white;border-radius:7px;padding:5px 9px;box-shadow:0 1px 6px #0006;cursor:grab;font-size:12px;white-space:nowrap}.rect-pattern-handle:active{cursor:grabbing}#rect-pattern-options{display:grid;gap:8px;border-top:1px solid #7293a7;padding-top:10px}#rect-pattern-options p{margin:3px 0;font-size:12px;line-height:1.5}#rect-pattern-options .pattern-point-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}#rect-pattern-options .pattern-point-row label{min-width:0;font-size:12px}#rect-pattern-options input{width:100%;min-width:0}#rect-pattern-options button{padding:8px}';document.head.append(style);
 const activeMode=()=>$('cad-distribution')?.value||'spacing';
 const values=()=>({type:'rectangular',count:Number($('cad-count')?.value),count2:activeMode()==='between'?1:Number($('cad-count2')?.value),spacing:Number($('cad-spacing')?.value),spacing2:Number($('cad-spacing2')?.value)});
 const readPoint=name=>['x','y','z'].map(axis=>{const el=$('rect-pattern-'+name+'-'+axis);return el?.value.trim()?Number(el.value):NaN;});
 function spec(){
  if(activeMode()!=='between')return {distribution:'spacing'};
  const source=getSource();if(!source?.solid)throw Error('2点間の配置はソリッドを対象にしてください');
  const extra={distribution:'between',betweenAlignment:$('cad-between-alignment').value,count2:1,startPoint:readPoint('a'),endPoint:readPoint('b'),patternAnchor:source.center.toArray()};
  if(extra.betweenAlignment==='inside')extra.patternExtent=meshPatternExtent(source.object,extra.startPoint,extra.endPoint,extra.patternAnchor);
  rectangularOffsets({...values(),...extra});return extra;
 }
 function emit(){sync();fields.dispatchEvent(new Event('input',{bubbles:true}));key='';update();}
 function pointText(p){return p.map(v=>Number(v.toFixed(2))).join(', ')+' mm';}
 function sync(){
  if(!panel?.isConnected)return;
  const between=activeMode()==='between',source=getSource();$('cad-distribution').querySelector('option[value="between"]').disabled=!source?.solid;
  for(const id of ['count2','spacing','spacing2']){const input=$('cad-'+id);input.closest('label').hidden=between;input.disabled=between;}
  $('cad-count').min=between?2:1;$('cad-count').max=between?60:20;$('cad-count').closest('label').firstChild.textContent=between?'個数（原型を含む）':'個数';
  panel.querySelector('[data-between]').hidden=!between;$('cad-between-alignment').disabled=!between;for(const input of panel.querySelectorAll('input[id^="rect-pattern-"]'))input.disabled=!between;
  const status=$('rect-pattern-status');
  try{if(between){const p={...values(),...spec()},layout=betweenPatternLayout(p);status.textContent=(picking?(picking==='a'?'始点A':'終点B')+'をクリックしてください。':'')+(p.betweenAlignment==='inside'?'2点の内側に '+p.count+' 個 ／ すきま '+layout.gap.toFixed(2)+' mm（両端の余白も同じ）。原型も移動します。':'両端を含む '+p.count+' 個 ／ 間隔 '+layout.spacing.toFixed(2)+' mm。原型の中心をAへ移動します。');}else status.textContent='X・Yの矢印をドラッグして間隔を調整できます。Shiftで微調整。';$('cad-error').textContent='';}
  catch(error){status.textContent=error.message;}
  for(const name of ['a','b'])$('rect-pattern-pick-'+name).textContent=(picking===name?'選択中：':'')+(name==='a'?'始点Aを選択':'終点Bを選択');
 }
 function setPoint(name,point){for(const [i,axis] of ['x','y','z'].entries())$('rect-pattern-'+name+'-'+axis).value=String(Number(point[i].toFixed(6)));}
 function beginPick(name){picking=name;refs=getReferences();key='';sync();update();}
 function acceptPoint(point){
  if(!active()||!picking)return false;const array=Array.isArray(point)?point:point.toArray();if(!array.every(Number.isFinite))return false;
  const previous=picking;setPoint(previous,array);picking=previous==='a'?'b':null;emit();return true;
 }
 function project(point){const p=point.clone().project(camera);return {x:(p.x+1)*host.clientWidth/2,y:(1-p.y)*host.clientHeight/2,z:p.z};}
 function rayAt(e){const r=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);return ray.ray;}
 function eventPoint(e,planePoint=null,raw=false){
  const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
  if(!planePoint){let nearest=null,distance=10;for(const ref of refs){const point=new THREE.Vector3(...ref.point),p=project(point),d=Math.hypot(p.x-x,p.y-y);if(p.z>=-1&&p.z<=1&&d<distance){nearest=point;distance=d;}}if(nearest)return nearest;}
  const frame=getFrame(),offset=planePoint?planePoint.dot(frame.basis.n):frame.offset,hit=rayAt(e).intersectPlane(new THREE.Plane(frame.basis.n,-offset),new THREE.Vector3());if(!hit)return null;
  if(raw)return hit;const snap=getSnap();return snapMirrorGridPoint(hit,{basis:frame.basis,offset},snap.step,project,snap.enabled&&!e.shiftKey);
 }
 function stop(){if(!drag)return;const state=drag;drag=null;controls.enabled=state.enabled;const handle=handles[state.name];if(handle.hasPointerCapture(state.id))handle.releasePointerCapture(state.id);delete host.dataset.patternDragging;key='';}
 for(const name of ['x','y','a','b']){
  const handle=document.createElement('button');handle.type='button';handle.id='rect-pattern-handle-'+name;handle.className='rect-pattern-handle';handle.hidden=true;handle.style.background={x:'#bd3a32',y:'#188344',a:'#19855d',b:'#b16b0b'}[name];handle.setAttribute('aria-label',({x:'X方向の間隔をドラッグ',y:'Y方向の間隔をドラッグ',a:'始点Aをドラッグ',b:'終点Bをドラッグ'})[name]);host.append(handle);handles[name]=handle;
  handle.addEventListener('pointerdown',e=>{if(e.button!==0||!active())return;e.preventDefault();e.stopPropagation();const source=getSource();if(!source)return;document.activeElement?.blur();const p=values(),axis=name==='x'?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0),steps=name==='x'?p.count-1:p.count2-1,center=source.center,at=project(center),unit=project(center.clone().add(axis));drag={id:e.pointerId,name,x:e.clientX,y:e.clientY,raw:name==='x'?p.spacing:p.spacing2,axis:{dx:unit.x-at.x,dy:unit.y-at.y},steps,point:['a','b'].includes(name)?new THREE.Vector3(...readPoint(name)):null,enabled:controls.enabled};if(drag.point){drag.grab=eventPoint(e,drag.point,true);picking=null;}controls.enabled=false;handle.setPointerCapture(e.pointerId);host.dataset.patternDragging=name;});
  handle.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();if(drag.point){const hit=eventPoint(e,drag.point,true);if(hit&&drag.grab){let point=drag.point.clone().add(hit.sub(drag.grab).multiplyScalar(e.shiftKey?.1:1));const frame=getFrame(),snap=getSnap();point=snapMirrorGridPoint(point,{basis:frame.basis,offset:point.dot(frame.basis.n)},snap.step,project,snap.enabled&&!e.shiftKey);setPoint(name,point.toArray());}}
   else{const {dx,dy}=drag.axis,length=dx*dx+dy*dy;if(length<.01||drag.steps<1)return;drag.raw+=((e.clientX-drag.x)*dx+(e.clientY-drag.y)*dy)/length/drag.steps*(e.shiftKey?.1:1);const snap=getSnap();$('cad-'+(name==='x'?'spacing':'spacing2')).value=patternDragValue(drag.raw,{...snap,snap:snap.enabled,pixelsPerMm:Math.sqrt(length)*drag.steps,fine:e.shiftKey});drag.x=e.clientX;drag.y=e.clientY;}emit();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(type,e=>{e.preventDefault();e.stopPropagation();stop();});
  handle.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();});
 }
 function render(){
  picking=null;refs=[];stop();key='';panel=document.createElement('section');panel.id='rect-pattern-options';
  panel.innerHTML='<label>配置方法<select id="cad-distribution"><option value="spacing">間隔を指定（矩形）</option><option value="between">2点間に等間隔（原型も移動）</option></select></label><div data-between hidden><label>2点間の基準<select id="cad-between-alignment"><option value="center">中心を両端に配置（従来）</option><option value="inside">内側に収める・すきまを均等</option></select></label><button type="button" id="rect-pattern-pick-a">始点Aを選択</button><div class="pattern-point-row" data-a></div><button type="button" id="rect-pattern-pick-b">終点Bを選択</button><div class="pattern-point-row" data-b></div><p>ボディの中心・頂点・辺の中点、または基準平面上のグリッドを選べます。「内側」は配置方向の幅を考慮し、両端の余白とボディ同士のすきまを均等にします。向きは変わりません。</p></div><p id="rect-pattern-status" role="status"></p><button type="button" id="rect-pattern-fit">プレビュー全体を表示</button>';
  fields.prepend(panel);for(const name of ['target','count','count2','spacing','spacing2','operation'])panel.insertBefore($('cad-'+name).closest('label'),panel.querySelector('[data-between]'));
  for(const name of ['a','b'])for(const axis of ['x','y','z']){const label=document.createElement('label');label.textContent=name.toUpperCase()+' '+axis.toUpperCase();const input=document.createElement('input');Object.assign(input,{id:'rect-pattern-'+name+'-'+axis,type:'number',step:'any',min:'-25000',max:'25000',value:'0',required:true});label.append(input);panel.querySelector('[data-'+name+']').append(label);}
  const source=getSource(),center=source?.center.toArray()||[0,0,0];setPoint('a',center);setPoint('b',center.map((v,i)=>v+(i===0?Math.max(1,Number($('cad-count').value)-1)*Number($('cad-spacing').value):0)));
  $('cad-distribution').addEventListener('change',()=>{picking=null;if(activeMode()==='between'){if(Number($('cad-count').value)<2)$('cad-count').value=2;$('cad-operation').value='新規ボディ';beginPick('a');}else{if(Number($('cad-count').value)>20)$('cad-count').value=20;refs=[];}emit();});
  for(const name of ['a','b'])$('rect-pattern-pick-'+name).onclick=()=>beginPick(name);
  $('rect-pattern-fit').onclick=()=>{try{const source=getSource();if(!source)return;const p={...values(),...spec()},offsets=rectangularOffsets(p,source.center.toArray()),box=new THREE.Box3();for(const offset of offsets)box.union(source.box.clone().translate(new THREE.Vector3(...offset)));fitPreview(box);key='';update();}catch(error){$('cad-error').textContent=error.message;}};
  sync();
 }
 function svg(tag,attrs){const el=document.createElementNS(overlay.namespaceURI,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);overlay.append(el);return el;}
 function update(){
  const enabled=active();overlay.toggleAttribute('hidden',!enabled);for(const handle of Object.values(handles))handle.hidden=true;if(!enabled){stop();return;}
  const source=getSource();if(!source)return;const p={...values(),...((activeMode()==='between')?{distribution:'between',startPoint:readPoint('a'),endPoint:readPoint('b')}: {})};
  const signature=JSON.stringify([p,$('cad-between-alignment')?.value,source.center.toArray(),camera.matrixWorld.elements,camera.zoom,host.clientWidth,host.clientHeight,picking]);if(key===signature){for(const handle of Object.values(handles))handle.hidden=handle.dataset.shown!=='true';return;}key=signature;overlay.replaceChildren();for(const handle of Object.values(handles))handle.dataset.shown='false';
  const positions=betweenPattern(p)?{a:new THREE.Vector3(...p.startPoint),b:new THREE.Vector3(...p.endPoint)}:{...(p.count>1?{x:source.center.clone().add(new THREE.Vector3((p.count-1)*p.spacing,0,0))}:{}),...(p.count2>1?{y:source.center.clone().add(new THREE.Vector3(0,(p.count2-1)*p.spacing2,0))}:{})};
  for(const [name,point]of Object.entries(positions)){
   if(!point.toArray().every(Number.isFinite))continue;const screen=project(point);if(screen.z< -1||screen.z>1)continue;const handle=handles[name];handle.hidden=false;handle.dataset.shown='true';let x=Math.max(22,Math.min(host.clientWidth-22,screen.x)),y=Math.max(28,Math.min(host.clientHeight-30,screen.y));
   const bounds=host.getBoundingClientRect(),dialogRect=dialog.getBoundingClientRect();if(x+bounds.left>dialogRect.left-45&&x+bounds.left<dialogRect.right+45&&y+bounds.top>dialogRect.top-25&&y+bounds.top<dialogRect.bottom+25)x=Math.max(25,dialogRect.left-bounds.left-70);
   handle.style.left=x+'px';handle.style.top=y+'px';handle.textContent=['a','b'].includes(name)?name.toUpperCase():name.toUpperCase()+' '+(name==='x'?p.spacing:p.spacing2).toFixed(2)+' mm';
   const start=project(betweenPattern(p)?new THREE.Vector3(...p.startPoint):source.center);svg('line',{x1:start.x,y1:start.y,x2:screen.x,y2:screen.y,stroke:'#147fbe','stroke-width':2,'stroke-dasharray':'6 4'});svg('circle',{cx:screen.x,cy:screen.y,r:5,fill:'#e8ac37',stroke:'white','stroke-width':2});
  }
  host.dataset.rectangularPattern=JSON.stringify({mode:activeMode(),a:p.startPoint,b:p.endPoint,count:p.count,spacing:p.spacing,spacing2:p.spacing2,picking});
 }
 fields.addEventListener('input',e=>{if(active()&&e.target!==fields){if(/^rect-pattern-[ab]-[xyz]$/.test(e.target.id)){picking=null;refs=[];}sync();key='';}},true);
 fields.addEventListener('change',e=>{if(!active())return;if(e.target.id==='cad-target'&&!getSource()?.solid&&activeMode()==='between')$('cad-distribution').value='spacing';sync();key='';},true);
 canvas.addEventListener('pointerleave',()=>{key='';update();});
 canvas.addEventListener('pointermove',e=>{if(!active()||!picking||e.buttons)return;const point=eventPoint(e);if(!point)return;key='';update();const p=project(point);svg('circle',{cx:p.x,cy:p.y,r:8,fill:'#33b4d3',stroke:'white','stroke-width':2});});
 dialog.addEventListener('close',()=>{picking=null;refs=[];stop();overlay.setAttribute('hidden','');for(const h of Object.values(handles))h.hidden=true;delete host.dataset.rectangularPattern;});
 return {render,spec,update,pick(e){if(!active()||!picking)return false;const point=eventPoint(e);if(point)acceptPoint(point);else $('cad-error').textContent='基準平面を選べる向きからクリックしてください';return true;},acceptPoint,get picking(){return active()&&!!picking;}};
}
