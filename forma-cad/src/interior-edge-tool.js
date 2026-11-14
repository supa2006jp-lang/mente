import {KernelClient} from './kernel-client.js';
import * as THREE from 'three';
import {compactKernelData} from './kernel-transfer.js';

export function createInteriorEdgeTool({container,getFeatures,getSelectionKey,onSelect,onPreview,notify}){
 const kernel=new KernelClient();
 const inside={type:'interiorEdges',label:'内側の辺をまとめて選択',name:'内側の辺',
  progress:'入れ物の内側を調べています…',empty:'上面が開いた底付きの空間に、選択できる角のある辺が見つかりません。'};
 const outside={type:'exteriorVerticalEdges',label:'外側の辺をまとめて選択',name:'外側の辺',
  progress:'外周の辺を調べています…',empty:'指定した方向に選択できる外側の辺が見つかりません。'};
 const makeButton=(id,label)=>{
  const button=document.createElement('button');
  button.id=id;button.type='button';button.textContent=label;
  button.style.cssText='pointer-events:auto;margin-top:7px;background:#ddf3f7;color:#17475a;border-color:#79b1c8';
  return button;
 };
 const insideButton=makeButton('select-interior-edges',inside.label);
 insideButton.title='上面（＋Z）が開いた入れ物の、底の角・縦の角などを選択します。外周と開口のふちは含みません。';
 insideButton.style.width='100%';
 const outsideGroup=document.createElement('div'),axisLabel=document.createElement('label');
 axisLabel.textContent='方向 ';
 axisLabel.style.cssText='white-space:nowrap;pointer-events:auto';
 const axisInput=document.createElement('select');
 axisInput.id='exterior-edge-axis';axisInput.setAttribute('aria-label','外側の辺の方向');
 for(const axis of ['X','Y','Z'])axisInput.add(new Option(axis,axis));
 axisInput.value='Z';axisLabel.append(axisInput);
 const outsideButton=makeButton('select-exterior-vertical-edges',outside.label);
 outsideButton.style.flex='1';
 outsideButton.title='指定した軸に平行な外側の辺を選択します。カーソルを合わせると対象を表示します。';
 outsideGroup.style.cssText='display:none;align-items:baseline;gap:6px;flex-wrap:wrap';

 const status=document.createElement('small');
 status.id='interior-edge-selection-status';status.setAttribute('role','status');
 status.style.cssText='font-size:12px;line-height:1.6;margin-top:5px;min-height:3.2em';
 outsideGroup.append(axisLabel,outsideButton);container.append(insideButton,outsideGroup,status);
 insideButton.hidden=outsideGroup.hidden=status.hidden=true;
 let ids=[],features=null,key=null,active=null,cached=null,hovered=false,focused=false,axisPreview=false,previewVisible=false,previewStatus=false,previewTimer;
 const previewRequested=()=>hovered||focused||axisPreview;
 function setPreview(edges){
  if(!edges.length&&!previewVisible)return;
  previewVisible=edges.length>0;
  onPreview(edges);
 }
 function setStatus(message,temporary=false){status.textContent=message;previewStatus=temporary;}
 function syncButtons(){
  const axis=axisInput.value;
  const insideBusy=active?.mode===inside;
  const outsideBusy=active?.mode===outside&&active.commit;
  insideButton.textContent=insideBusy?'内側の辺の検査を中止':inside.label;
  outsideButton.textContent=outsideBusy?'外側の辺の検査を中止':axis==='Z'?'外側の縦辺（Z）をまとめて選択':'外側の辺（'+axis+'）をまとめて選択';
  insideButton.disabled=!!outsideBusy;
  outsideButton.disabled=axisInput.disabled=insideBusy;
 }
 function stop(){
  clearTimeout(previewTimer);
  if(active){active=null;kernel.reset();}
  setPreview([]);
  syncButtons();
 }
 function apply(mode,result){
  const edges=result.edges;
  setPreview([]);
  if(!edges?.length){setStatus(mode.empty+'元の選択は残しています。');return;}
  onSelect(edges,result.analysis[mode.type],mode.type);
  features=getFeatures();key=getSelectionKey();
  setStatus(edges.length+' 辺を選択しました');
  notify(mode.name+'を '+edges.length+' 本選択しました。フィレット・面取りに使用できます');
 }
 function showPreview(result){
  const edges=result.edges||[];
  setPreview(edges);
  setStatus(edges.length?'選択候補 '+edges.length+' 本（青緑）':outside.empty,true);
 }
 async function request(mode,commit){
  clearTimeout(previewTimer);
  if(!ids.length||outsideGroup.hidden)return;
  const axis=axisInput.value;
  if(active){
   if(active.mode===mode&&!active.commit&&commit){
    active.commit=true;setPreview([]);setStatus(mode.progress);syncButtons();return;
   }
   const cancel=active.mode===mode&&active.commit&&commit;
   stop();
   if(cancel){setStatus('選択の検査を中止しました');return;}
  }
  if(mode===outside&&cached?.axis===axis){
   if(commit)apply(mode,cached.result);
   else showPreview(cached.result);
   return;
  }
  const request={mode,commit},model=features,selection=key;
  active=request;
  syncButtons();
  setStatus(mode.progress,!commit);
  const spec={type:mode.type,targets:[...ids],...(mode===outside?{axis}:{})};
  const isCurrent=()=>active===request&&getFeatures()===model&&getSelectionKey()===selection;
  try{
   const result=await kernel.run(compactKernelData(model),spec,{onProgress:progress=>{
    if(isCurrent()&&request.commit&&progress.stage)setStatus(progress.stage);
   }});
   if(!isCurrent())return;
   active=null;syncButtons();
   if(mode===outside)cached={axis,result};
   if(request.commit)apply(mode,result);
   else if(previewRequested())showPreview(result);
  }catch(error){if(isCurrent()&&(request.commit||previewRequested()))setStatus(error.message,!request.commit);}
  finally{if(active===request){active=null;syncButtons();}}
 }
 function schedulePreview(){
  clearTimeout(previewTimer);
  if(!previewRequested()||active||outsideGroup.hidden)return;
  if(cached?.axis===axisInput.value)showPreview(cached.result);
  else previewTimer=setTimeout(()=>request(outside,false),120);
 }
 function clearHover(){
  if(previewRequested())return;
  clearTimeout(previewTimer);
  setPreview([]);
  if(previewStatus)setStatus('');
 }
 insideButton.onclick=()=>request(inside,true);
 outsideButton.onclick=()=>{
  hovered=focused=axisPreview=false;
  request(outside,true);
 };
 outsideButton.onpointerenter=()=>{hovered=true;schedulePreview();};
 outsideButton.onpointerleave=()=>{hovered=false;clearHover();};
 outsideButton.onfocus=()=>{focused=outsideButton.matches(':focus-visible');schedulePreview();};
 outsideButton.onblur=()=>{focused=false;clearHover();};
 axisInput.onblur=()=>{axisPreview=false;clearHover();};
 axisInput.onchange=()=>{
  stop();cached=null;setStatus('');
  axisPreview=true;
  schedulePreview();
 };
 syncButtons();
 return {update(next,enabled){
  const model=getFeatures(),selection=getSelectionKey(),visible=!!(enabled&&next.length);
  if(model!==features||selection!==key||next.length!==ids.length||next.some((id,i)=>id!==ids[i])||visible===outsideGroup.hidden){
   const cancelled=active?.commit;
   stop();cached=null;hovered=focused=axisPreview=false;
   if(cancelled)setStatus('選択が変わったため検査を中止しました');
   else if(model!==features||selection!==key||!visible)setStatus('');
   features=model;key=selection;ids=[...next];
  }
  if(outsideGroup.hidden===visible)outsideGroup.style.display=visible?'flex':'none';
  status.style.display=visible?'block':'none';
  insideButton.hidden=outsideGroup.hidden=status.hidden=!visible;
 },cancel(){stop();hovered=focused=false;setStatus('');},get busy(){return !!active;}};
}

// A native curved edge and a clicked display chord have different IDs. Keep
// Ctrl-click removal available without expanding the selected curve to a whole
// body or adding it a second time.
export function matchesInteriorEdge(a,b){
 if(!a.nativeReference||a.bodyId!==b.bodyId)return false;
 const points=(a.curve||a.arc||a.circle)?.points||[a.a,a.b],p=b.point;
 let best=Infinity;for(let i=1;i<points.length;i++){const x=points[i-1],y=points[i],d=y.map((v,k)=>v-x[k]),n=d.reduce((s,v)=>s+v*v,0),t=Math.max(0,Math.min(1,n?d.reduce((s,v,k)=>s+(p[k]-x[k])*v,0)/n:0));best=Math.min(best,Math.hypot(...p.map((v,k)=>v-x[k]-t*d[k])));}
 return best<.025;
}

export function pickedInteriorEdge(edges,camera,rect,x,y){
 const cursor=new THREE.Vector2(x-rect.left,y-rect.top);let nearest=null,best=8;
 for(const edge of edges){if(!edge.nativeReference)continue;const points=(edge.curve||edge.arc||edge.circle)?.points||[edge.a,edge.b];
  for(let i=1;i<points.length;i++){const a=new THREE.Vector3(...points[i-1]).project(camera),b=new THREE.Vector3(...points[i]).project(camera);if(Math.min(a.z,b.z)>1||Math.max(a.z,b.z)<-1)continue;const p=new THREE.Vector2((a.x+1)*rect.width/2,(1-a.y)*rect.height/2),q=new THREE.Vector2((b.x+1)*rect.width/2,(1-b.y)*rect.height/2),d=q.clone().sub(p),t=Math.max(0,Math.min(1,d.lengthSq()?cursor.clone().sub(p).dot(d)/d.lengthSq():0)),distance=p.addScaledVector(d,t).distanceTo(cursor);if(distance<best){best=distance;nearest=edge;}}
 }
 return nearest;
}
