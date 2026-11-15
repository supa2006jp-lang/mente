import {KernelClient} from './kernel-client.js';
import * as THREE from 'three';
import {compactKernelData} from './kernel-transfer.js';

export function createInteriorEdgeTool({container,getFeatures,getSelectionKey,getSelectedEdge,getSelectedFaces,isBodyVisible,onSelect,onPreview,onFillet,notify}){
 const kernel=new KernelClient();
 const inside={type:'interiorEdges',label:'内側の辺をまとめて選択',name:'内側の辺',
  progress:'入れ物の内側を調べています…',empty:'開口のある入れ物に、選択できる内側の辺が見つかりません。'};
 const outside={type:'exteriorVerticalEdges',label:'外側の辺をまとめて選択',name:'外側の辺',
  progress:'外周の辺を調べています…',empty:'指定した方向に選択できる外側の辺が見つかりません。'};
 const makeButton=(id,label)=>{
  const button=document.createElement('button');
  button.id=id;button.type='button';button.textContent=label;
  button.style.cssText='pointer-events:auto;margin-top:7px;background:#ddf3f7;color:#17475a;border-color:#79b1c8';
  return button;
 };
 const insideButton=makeButton('select-interior-edges',inside.label);
 insideButton.title='カーソルを合わせると候補を表示します。内壁・底面を Ctrl＋クリックすると、複数の区画を対象にできます。';
 const insideGroup=document.createElement('div');
 insideGroup.style.cssText='display:none;align-items:baseline;gap:6px;flex-wrap:wrap;pointer-events:auto';
 const scopeInput=document.createElement('select'),cornerInput=document.createElement('select');
 scopeInput.id='interior-edge-scope';scopeInput.setAttribute('aria-label','内側の辺を選ぶ区画');
 scopeInput.title='内壁・底面を Ctrl＋クリックすると、区画を追加・解除できます。';
 scopeInput.add(new Option('選んだ区画','selected'));
 scopeInput.add(new Option('全区画','all'));
 cornerInput.id='interior-edge-corner';cornerInput.setAttribute('aria-label','内側の角の種類');
 for(const [value,label] of [['all','すべての角'],['back','奥の角だけ'],['side','側壁同士の角だけ']])cornerInput.add(new Option(label,value));
 const adjustButton=makeButton('adjust-interior-edges','候補を調整');
 adjustButton.setAttribute('aria-pressed','false');
 adjustButton.title='プレビューを固定し、辺をクリックして除外・復元します。';
 const undoExclusion=makeButton('undo-interior-exclusion','最後の除外を戻す');
 const restoreExclusions=makeButton('restore-interior-exclusions','すべて戻す');
 const candidateFillet=makeButton('fillet-interior-candidates','この候補でフィレット');
 candidateFillet.title='残っている辺を選択してフィレットの半径入力を開きます。';
 const normalActions=document.createElement('div');
 normalActions.className='interior-edge-actions';
 normalActions.append(insideButton,adjustButton);
 insideGroup.append(scopeInput,cornerInput,normalActions);
 const adjustmentBar=document.createElement('div');
 adjustmentBar.id='interior-edge-adjustment';
 adjustmentBar.hidden=true;
 const adjustmentActions=document.createElement('div');
 adjustmentActions.className='interior-edge-actions';
 adjustmentBar.append(adjustmentActions);
 adjustmentActions.append(candidateFillet);
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
 status.style.cssText='font-size:12px;line-height:1.45;min-height:2.9em';
 outsideGroup.append(axisLabel,outsideButton);container.prepend(adjustmentBar);container.append(status,insideGroup,outsideGroup);
 insideGroup.hidden=outsideGroup.hidden=status.hidden=true;
 const cache=new Map();
 let ids=[],features=null,key=null,active=null,hovered=null,focused=null,settingPreview=null,previewVisible=false,previewStatus=false,previewTimer;
 let selectedScope=true,retainedEdges=[],applyingInside=false,adjusting=false,editableEdges=[];
 const excluded=new Set();
 const hasSelectionSeed=()=>retainedEdges.length||getSelectedEdge()||getSelectedFaces().length;
 const previewMode=()=>adjusting?inside:hovered||focused||settingPreview;
 function setPreview(edges,mode,omitted=[],faces=[]){
  if(!edges.length&&!omitted.length&&!faces.length&&!previewVisible)return;
  previewVisible=edges.length+omitted.length+faces.length>0;
  onPreview(edges,mode?.type,omitted,faces);
 }
 function setStatus(message,temporary=false){status.textContent=message;previewStatus=temporary;}
 function syncButtons(){
  const axis=axisInput.value;
  const insideBusy=active?.mode===inside&&active.commit;
  const outsideBusy=active?.mode===outside&&active.commit;
  insideButton.textContent=insideBusy?'内側の辺の検査を中止':adjusting?'残りの辺を選択':inside.label;
  outsideButton.textContent=outsideBusy?'外側の辺の検査を中止':axis==='Z'?'外側の縦辺（Z）をまとめて選択':'外側の辺（'+axis+'）をまとめて選択';
  insideButton.disabled=!!outsideBusy;
  scopeInput.disabled=!!(insideBusy||outsideBusy||!hasSelectionSeed());
  cornerInput.disabled=!!(insideBusy||outsideBusy);
  outsideButton.disabled=axisInput.disabled=!!(insideBusy||adjusting);
  adjustButton.disabled=!!(insideBusy||outsideBusy);
  adjustButton.textContent=adjusting?'調整を解除':'候補を調整';
  adjustButton.setAttribute('aria-pressed',String(adjusting));
  undoExclusion.hidden=restoreExclusions.hidden=!adjusting;
  undoExclusion.disabled=restoreExclusions.disabled=!excluded.size||!!(insideBusy||outsideBusy);
  candidateFillet.disabled=!adjusting||!!active||!editableEdges.some(edge=>!excluded.has(edge.key));
  if(adjusting===adjustmentBar.hidden){
   adjustmentBar.hidden=!adjusting;
   if(adjusting){adjustmentBar.prepend(status);adjustmentActions.append(insideButton,candidateFillet,adjustButton,undoExclusion,restoreExclusions);container.scrollTop=0;}
   else{insideGroup.before(status);normalActions.append(insideButton,adjustButton);}
  }
 }
 function stop(){
  clearTimeout(previewTimer);
  if(active){active=null;kernel.reset();}
  setPreview([]);
  syncButtons();
 }
 function candidates(mode,result){
  if(mode===outside)return {edges:result.edges};
  let edges=result.edges;
  if(!edges.length)return {edges};
  const compartmentKey=edge=>JSON.stringify([edge.bodyId,edge.compartment]);
  const compartments=new Map(edges.map(edge=>[compartmentKey(edge),edge]));
  const anchors=new Map();
  let note='';
  if(scopeInput.value==='selected'){
   const seed=getSelectedEdge();
   if(retainedEdges.length||seed){
    for(const reference of retainedEdges.length?retainedEdges:[seed]){
     const edge=closestInteriorEdge(edges,reference);
     if(edge)anchors.set(compartmentKey(edge),edge);
    }
    if(!anchors.size)return {edges:[],message:'選んだ辺から区画を特定できません。内壁・底面を選ぶか、「全区画」に切り替えてください。'};
   }else{
    const faces=result.analysis.interiorEdges.faceSelections;
    const ignored=faces.filter(face=>!face.compartment);
    for(const face of faces){
     if(!face.compartment)continue;
     const key=compartmentKey(face);
     if(compartments.has(key))anchors.set(key,compartments.get(key));
    }
    const rimOnly=ignored.length>0&&ignored.every(face=>face.reason==='rim');
    if(!anchors.size){
     const [key,only]=compartments.entries().next().value;
     const reason=rimOnly?'開口の縁を選んでいます。':'選んだ面から区画を特定できません。';
     if(compartments.size!==1||faces.length!==1||faces[0].bodyId!==only.bodyId){
      return {edges:[],message:reason+'内壁・底面を選ぶか、「全区画」に切り替えてください。'};
     }
     anchors.set(key,only);
     note=reason+'このボディの唯一の区画を対象にします。';
    }else if(ignored.length)note='区画を特定できなかった '+ignored.length+' 面を除きました。';
   }
   edges=edges.filter(edge=>anchors.has(compartmentKey(edge)));
  }
  const faces=anchors.size?result.compartmentFaces?.filter(face=>anchors.has(compartmentKey(face))):[];
  const corner=cornerInput.value;
  if(corner!=='all')edges=edges.filter(edge=>edge.corner===corner);
  const omitted=edges.filter(edge=>excluded.has(edge.key));
  const message=!edges.length?(corner==='back'?'奥の角':'側壁同士の角')+'が対象の区画に見つかりません。「すべての角」に切り替えられます。':
   omitted.length===edges.length?'候補の辺がすべて除外されています。「最後の除外を戻す」か「すべて戻す」で復元できます。':'';
  return {edges:edges.filter(edge=>!excluded.has(edge.key)),omitted,faces,anchors:[...anchors.values()],compartmentCount:anchors.size||compartments.size,message,note};
 }
 function apply(mode,result,openFillet=false){
  const {edges,anchors,message,note,compartmentCount}=candidates(mode,result);
  if(adjusting&&!edges.length){showPreview(mode,result);return;}
  setPreview([]);
  if(!edges.length){setStatus(message||mode.empty);return;}
  const analysis=mode===inside?{...result.analysis[mode.type],edgeCount:edges.length,bodyIds:[...new Set(edges.map(edge=>edge.bodyId))],scope:scopeInput.value,corner:cornerInput.value,compartmentCount}:result.analysis[mode.type];
  if(mode===inside){
   if(anchors.length)retainedEdges=anchors.map(edge=>({bodyId:edge.bodyId,point:edge.reference.point,nativeReference:edge.reference}));
   resetAdjustment();
   applyingInside=true;
  }
  try{onSelect(edges,analysis,mode.type);}
  finally{applyingInside=false;syncButtons();}
  features=getFeatures();key=getSelectionKey();
  setStatus([edges.length+' 辺を選択しました',note].filter(Boolean).join('。'));
  if(!openFillet||!onFillet())notify(mode.name+'を '+edges.length+' 本選択しました。フィレット・面取りに使用できます');
 }
 function showPreview(mode,result){
  const {edges,message,note,omitted=[],faces=[],compartmentCount}=candidates(mode,result);
  editableEdges=adjusting?[...edges,...omitted]:[];
  setPreview(edges,mode,omitted,faces);
  const count='選択候補 '+edges.length+' 本（青緑）'+(compartmentCount>1?' ／ '+compartmentCount+' 区画':'');
  const text=adjusting&&(edges.length||omitted.length)?count+' ／ 除外 '+omitted.length+' 本。'+(message||'辺をクリックで切り替え。'):
   edges.length?count:message||mode.empty;
  setStatus(note?text+' '+note:text,true);
  syncButtons();
 }
 function resetAdjustment(){adjusting=false;editableEdges=[];excluded.clear();}
 async function request(mode,commit){
  clearTimeout(previewTimer);
  if(!ids.length||outsideGroup.hidden)return;
  const axis=axisInput.value,cacheKey=mode===outside?axis:inside.type;
  if(active){
   if(active.mode===mode&&!active.commit&&commit){
    active.commit=true;setPreview([]);setStatus(mode.progress);syncButtons();return;
   }
   const cancel=active.mode===mode&&active.commit&&commit;
   stop();
   if(cancel){setStatus('選択の検査を中止しました');return;}
  }
  if(cache.has(cacheKey)){
   if(commit)apply(mode,cache.get(cacheKey));
   else showPreview(mode,cache.get(cacheKey));
   return;
  }
  const request={mode,commit},model=features,selection=key;
  active=request;
  syncButtons();
  setStatus(mode.progress,!commit);
  const faceSeeds=mode===inside&&!retainedEdges.length&&!getSelectedEdge()?getSelectedFaces():[];
  const spec={type:mode.type,targets:[...ids],...(mode===outside?{axis}:{faceSeeds,includeCompartmentFaces:true})};
  const isCurrent=()=>active===request&&getFeatures()===model&&getSelectionKey()===selection;
  try{
   const result=await kernel.run(compactKernelData(model),spec,{onProgress:progress=>{
    if(isCurrent()&&request.commit&&progress.stage)setStatus(progress.stage);
   }});
   if(!isCurrent())return;
   active=null;syncButtons();
   cache.set(cacheKey,result);
   if(request.commit)apply(mode,result);
   else if(previewMode()===mode)showPreview(mode,result);
  }catch(error){if(isCurrent()&&(request.commit||previewMode()===mode))setStatus(error.message,!request.commit);}
  finally{if(active===request){active=null;syncButtons();}}
 }
 function schedulePreview(){
  clearTimeout(previewTimer);
  const mode=previewMode();
  if(!mode||active?.commit||outsideGroup.hidden)return;
  if(active?.mode===mode)return;
  setPreview([]);
  const cacheKey=mode===outside?axisInput.value:inside.type;
  if(cache.has(cacheKey))showPreview(mode,cache.get(cacheKey));
  else previewTimer=setTimeout(()=>request(mode,false),120);
 }
 function clearHover(){
  if(previewMode()){schedulePreview();return;}
  clearTimeout(previewTimer);
  setPreview([]);
  if(previewStatus)setStatus('');
 }
 adjustButton.onclick=()=>{
  if(adjusting){resetAdjustment();stop();setStatus('');return;}
  adjusting=true;hovered=focused=settingPreview=null;
  syncButtons();schedulePreview();
 };
 undoExclusion.onclick=()=>{
  excluded.delete([...excluded].at(-1));
  showPreview(inside,cache.get(inside.type));
 };
 restoreExclusions.onclick=()=>{
  excluded.clear();
  showPreview(inside,cache.get(inside.type));
 };
 candidateFillet.onclick=()=>{
  const result=cache.get(inside.type);
  if(result&&adjusting&&getFeatures()===features&&getSelectionKey()===key)apply(inside,result,true);
 };
 for(const [button,mode] of [[insideButton,inside],[outsideButton,outside]]){
  button.onclick=()=>{hovered=focused=settingPreview=null;request(mode,true);};
  button.onpointerenter=()=>{hovered=mode;schedulePreview();};
  button.onpointerleave=()=>{if(hovered===mode)hovered=null;clearHover();};
  button.onfocus=()=>{if(button.matches(':focus-visible')){focused=mode;schedulePreview();}};
  button.onblur=()=>{if(focused===mode)focused=null;clearHover();};
 }
 for(const [input,mode] of [[scopeInput,inside],[cornerInput,inside],[axisInput,outside]]){
  input.onblur=()=>{if(settingPreview===mode)settingPreview=null;clearHover();};
  input.onchange=()=>{
   if(input===scopeInput)selectedScope=input.value==='selected';
   if(mode===outside)stop();
   settingPreview=mode;
   schedulePreview();
  };
 }
 syncButtons();
 return {update(next,enabled){
  const model=getFeatures(),selection=getSelectionKey(),visible=!!(enabled&&next.length);
  if(!applyingInside&&(model!==features||selection!==key))retainedEdges=[];
  retainedEdges=retainedEdges.filter(edge=>isBodyVisible(edge.bodyId));
  next=[...new Set([...next,...retainedEdges.map(edge=>edge.bodyId)])];
  if(model!==features||selection!==key||next.length!==ids.length||next.some((id,i)=>id!==ids[i])||visible===outsideGroup.hidden){
   const cancelled=active?.commit;
   resetAdjustment();
   stop();cache.clear();hovered=focused=settingPreview=null;
   if(cancelled)setStatus('選択が変わったため検査を中止しました');
   else if(model!==features||selection!==key||!visible)setStatus('');
   features=model;key=selection;ids=[...next];
   scopeInput.value=hasSelectionSeed()&&selectedScope?'selected':'all';
   syncButtons();
  }
  if(outsideGroup.hidden===visible)insideGroup.style.display=outsideGroup.style.display=visible?'flex':'none';
  status.style.display=visible?'block':'none';
  insideGroup.hidden=outsideGroup.hidden=status.hidden=!visible;
 },pickAdjustment(camera,rect,x,y){
  if(!adjusting)return false;
  const edge=pickedInteriorEdge(editableEdges,camera,rect,x,y);
  if(edge){
   if(excluded.has(edge.key))excluded.delete(edge.key);
   else excluded.add(edge.key);
   showPreview(inside,cache.get(inside.type));
  }
  return true;
 },cancel(){resetAdjustment();stop();hovered=focused=settingPreview=null;setStatus('');},get busy(){return !!active||adjusting;}};
}

function closestInteriorEdge(edges,seed){
 let nearest=null,best=.12;
 for(const edge of edges){
  if(edge.bodyId!==seed.bodyId)continue;
  if(seed.nativeReference&&edge.reference.point.every((value,i)=>Math.abs(value-seed.nativeReference.point[i])<1e-6))return edge;
  const distance=pointToEdge(seed.point,edge.points);
  if(distance<best){nearest=edge;best=distance;}
 }
 return nearest;
}

// A native curved edge and a clicked display chord have different IDs. Keep
// Ctrl-click removal available without expanding the selected curve to a whole
// body or adding it a second time.
export function matchesInteriorEdge(a,b){
 if(!a.nativeReference||a.bodyId!==b.bodyId)return false;
 const points=(a.curve||a.arc||a.circle)?.points||[a.a,a.b];
 return pointToEdge(b.point,points)<.025;
}
function pointToEdge(p,points){
 let best=Infinity;for(let i=1;i<points.length;i++){const x=points[i-1],y=points[i],d=y.map((v,k)=>v-x[k]),n=d.reduce((s,v)=>s+v*v,0),t=Math.max(0,Math.min(1,n?d.reduce((s,v,k)=>s+(p[k]-x[k])*v,0)/n:0));best=Math.min(best,Math.hypot(...p.map((v,k)=>v-x[k]-t*d[k])));}
 return best;
}

export function pickedInteriorEdge(edges,camera,rect,x,y){
 const cursor=new THREE.Vector2(x-rect.left,y-rect.top);let nearest=null,best=8;
 for(const edge of edges){if(!edge.nativeReference&&!edge.reference)continue;const points=edge.points||(edge.curve||edge.arc||edge.circle)?.points||[edge.a,edge.b];
  for(let i=1;i<points.length;i++){const a=new THREE.Vector3(...points[i-1]).project(camera),b=new THREE.Vector3(...points[i]).project(camera);if(Math.min(a.z,b.z)>1||Math.max(a.z,b.z)<-1)continue;const p=new THREE.Vector2((a.x+1)*rect.width/2,(1-a.y)*rect.height/2),q=new THREE.Vector2((b.x+1)*rect.width/2,(1-b.y)*rect.height/2),d=q.clone().sub(p),t=Math.max(0,Math.min(1,d.lengthSq()?cursor.clone().sub(p).dot(d)/d.lengthSq():0)),distance=p.addScaledVector(d,t).distanceTo(cursor);if(distance<best){best=distance;nearest=edge;}}
 }
 return nearest;
}
