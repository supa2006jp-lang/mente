import * as THREE from 'three';
import {clipTriangle} from './box-selection.js';
import {bridgeRibSuggestion,supportMeshTriangles} from './print-support-bridges.js';

export function createSupportCoverageView({anchor,host,canvas,camera,scene,bodyName,onSave,onReset}){
 const panel=document.createElement('details');panel.dataset.id='support-coverage';
 panel.innerHTML='<summary>支えの範囲・下面ごとの設定</summary><label><input type="checkbox" data-coverage="show">3MFの支えの範囲を色分け</label><small><b style="color:#08775a">緑：リブで支える範囲</b> ／ <b style="color:#155ca6">青：自動サポートに任せる範囲</b> ／ <b style="color:#a02b68">紫：指定した除外範囲</b> ／ <b style="color:#a64900">橙：輪郭からリブまで距離がある箇所</b></small><label>設定する下面<select data-coverage="face"></select></label><div data-coverage="warning" hidden></div><div data-coverage="zones" hidden></div><div data-coverage="edit" hidden></div><button type="button" data-coverage="reset">このボディの個別設定をすべて解除</button>';
 const get=key=>panel.querySelector('[data-coverage="'+key+'"]');
 const labels=document.createElement('div');
 labels.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden';
 const placement=document.createElement('div');
 placement.className='support-zone-placement';
 placement.innerHTML='<span role="status"></span><div><button type="button" data-zone-action="cancel">やめる</button><button type="button" data-zone-action="confirm">この範囲を確定</button></div>';
 const placementStatus=placement.querySelector('span'),cancel=placement.querySelector('[data-zone-action="cancel"]'),confirm=placement.querySelector('[data-zone-action="confirm"]');
 const proposalChoices=document.createElement('div');
 placementStatus.after(proposalChoices);
 host.append(labels,placement);anchor.before(panel);
 const display=get('show'),select=get('face'),edit=get('edit'),reset=get('reset'),warning=get('warning'),zones=get('zones'),projected=new THREE.Vector3();
 const bridgeLabel=document.createElement('label'),bridgeToggle=document.createElement('input'),bridgeSummary=document.createElement('small');
 bridgeToggle.type='checkbox';bridgeToggle.dataset.coverage='bridges';
 bridgeLabel.append(bridgeToggle,'天井の橋渡し幅を色分け');
 display.closest('label').after(bridgeLabel,bridgeSummary);
 bridgeToggle.onchange=()=>{if(!bridgeToggle.checked&&draw?.mode==='proposal')stopDrawing();showBridgeSummary();visibility();};
 const bridgeMeshes=[],comparisonMeshes=[];
 let comparisonBefore=false;
 const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,0,1)),corner=new THREE.Vector3(),cursor=new THREE.Vector3();
 const contourLines=new Map();
 let group=null,areas=null,rows=[],markers=[],faceMeshes=[],muted=false,target=null,busy=false,focused=null,draw=null,outline=null;
 let pointSize=[2,2],localLength=12;
 const fields=[['wallPitch','薄壁の間隔 (mm)',2,15,'any'],['roofLayers','上面の薄皮 (層)',1,6,1],['bottomSkinLayers','底面の薄皮 (層)',1,6,1]];
 function visibility(){
  const placing=draw&&draw.mode!=='proposal';
  if(group){group.visible=!muted;areas.visible=display.checked||!!placing;
   for(const area of areas.children)area.visible=!draw?.activeRow||area.userData.coverageRow===draw.activeRow;
   for(const [index,lines] of contourLines)for(const line of lines)
    line.visible=!draw&&(display.checked||rows[index].showBoundaryWarnings===true);
  }
  labels.hidden=!display.checked||muted||!!draw;
  for(const mesh of bridgeMeshes)mesh.visible=!comparisonBefore&&bridgeToggle.checked&&!placing&&(!focused||mesh.userData.row.selection===focused);
  for(const mesh of comparisonMeshes)mesh.visible=comparisonBefore&&!placing;
  placement.hidden=!draw;
 }
 function clear(){
  stopDrawing();
  if(group){group.removeFromParent();group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
  group=areas=null;rows=[];markers=[];faceMeshes=[];bridgeMeshes.length=comparisonMeshes.length=0;comparisonBefore=false;contourLines.clear();labels.replaceChildren();select.replaceChildren(new Option('自動判定（画面で指定）',''));edit.hidden=warning.hidden=zones.hidden=true;edit.replaceChildren();warning.replaceChildren();zones.replaceChildren();showBridgeSummary();
 }
 function showBridgeSummary(){
  const spans=rows.filter(row=>!focused||row.selection===focused).map(row=>row.bridges).filter(Boolean);
  bridgeSummary.hidden=!bridgeToggle.checked||!spans.length;
  const mm=value=>Number(value.toFixed(1))+' mm';
  const max=Math.max(0,...spans.map(s=>s.max)),edge=Math.max(0,...spans.map(s=>s.unbraced));
  bridgeSummary.textContent='両側に支えがある幅の最大 '+mm(max)+' ／ 片側または両側に支えがない幅の最大 '+mm(edge)+'。黄は8 mm以下、橙は8 mm超、紫は片側または両側に支えなし。幅は目安です。橙・紫をクリックすると補強案を確認できます。';
 }
 function addBridgeMesh(row,destination=bridgeMeshes){
  if(!row.bridges?.bands.length)return;
  const triangles=supportMeshTriangles(row.face).map(triangle=>triangle.map(([x,y])=>({x,y})));
  const {axis,bands}=row.bridges,z=row.selection.point[2];
  const colors={bridge:0xe4bb39,wide:0xe66c23,edge:0xa24cd5};
  const groups={bridge:[],wide:[],edge:[]};
  const slices=new Map(),across=axis===0?'y':'x';
  for(const {start,end,from,to,risk} of bands){
   const rect=axis===0?{left:start,right:end,top:from,bottom:to}:{left:from,right:to,top:start,bottom:end};
   const vertices=groups[risk];
   if(!slices.has(from))slices.set(from,triangles.filter(t=>!t.every(p=>p[across]<from)&&!t.every(p=>p[across]>to)));
   for(const t of slices.get(from)){
    if(t.every(p=>p.x<rect.left)||t.every(p=>p.x>rect.right)||t.every(p=>p.y<rect.top)||t.every(p=>p.y>rect.bottom))continue;
    const clipped=clipTriangle(t,rect);
    for(let i=1;i+1<clipped.length;i++)for(const {x,y} of [clipped[0],clipped[i],clipped[i+1]])vertices.push(x,y,z);
   }
  }
  for(const [risk,vertices] of Object.entries(groups))if(vertices.length){
   const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
   const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:colors[risk],side:THREE.DoubleSide,transparent:true,opacity:.65,depthTest:false,depthWrite:false}));
   mesh.userData.row=row;mesh.userData.risk=risk;mesh.renderOrder=24;group.add(mesh);destination.push(mesh);
  }
 }
 function sync(){
  if(labels.hidden)return;
  for(const {marker,point} of markers){
   projected.copy(point).project(camera);
   const {x,y,z}=projected;
   marker.hidden=z<-1||z>1||Math.abs(x)>1||Math.abs(y)>1;
   if(!marker.hidden){marker.style.left=(x+1)*50+'%';marker.style.top=(1-y)*50+'%';}
  }
 }
 function focus(index){
  stopDrawing();
  select.value=index<0?'':String(index);
  for(const {marker} of markers){
   const selected=Number(marker.dataset.supportCoverageMarker)===index+1;
   marker.setAttribute('aria-pressed',selected);
   marker.style.background=selected?'#ad5608':'#164d64';
  }
  const row=rows[index];
  focused=row?.selection??null;
  showBridgeSummary();
  const warnings=row?.boundaryWarnings||[];
  warning.hidden=!warnings.length;warning.replaceChildren();
  for(const lines of contourLines.values())for(const line of lines){
   line.material.color.setHex(0xff7900);line.material.opacity=.85;
  }
  if(warnings.length){
   const mm=value=>Number(value.toFixed(1))+' mm';
   const summary=document.createElement('small');
   summary.textContent='輪郭の注意 '+warnings.length+'区間 ／ リブまで最大 '+mm(Math.max(...warnings.map(item=>item.maxGap)));
   const intervals=document.createElement('select');
   intervals.setAttribute('aria-label','注意区間を確認');
   intervals.add(new Option('注意区間を選択',''));
   for(const [i,item] of warnings.entries())intervals.add(new Option('区間 '+(i+1)+' ／ 長さ '+mm(item.length)+' ／ リブまで最大 '+mm(item.maxGap),String(i)));
   intervals.onchange=()=>{
    display.checked=true;visibility();sync();
    for(const [id,lines] of contourLines)for(const [i,line] of lines.entries()){
     const active=id===index&&String(i)===intervals.value;
     line.material.color.setHex(active?0xe54d00:0xff7900);
     line.material.opacity=intervals.value===''||active?1:.45;
    }
   };
   warning.append(summary,intervals);
  }
  if(row?.editable&&!row.suppressed&&(warnings.length||row.override.edgeAssist)){
   const suggest=document.createElement('button');suggest.type='button';suggest.textContent=row.override.edgeAssist?'端の配置案を元に戻す':'端を支える配置を試す';
   suggest.onclick=()=>{if(!busy)onSave(row,{...row.override,edgeAssist:!row.override.edgeAssist});};
   warning.hidden=false;warning.append(suggest);
  }
  zones.replaceChildren();zones.hidden=row?!row.editable:!faceMeshes.length;
  if(!zones.hidden)renderZones(row);
  edit.replaceChildren();edit.hidden=!row?.editable;
  if(!row?.editable)return;
  const inputs=fields.map(([key,name,min,max,step])=>{
   const label=document.createElement('label'),input=document.createElement('input');
   Object.assign(input,{type:'number',min,max,step,value:row.override[key]??'',placeholder:String(row.settings[key]),disabled:busy});
   label.append(name,input);edit.append(label);return [key,input];
  });
  const note=document.createElement('small');note.textContent='空欄は共通設定を使います。薄皮の層数は、対応する薄皮がオンのときに反映します。';edit.append(note);
  const save=document.createElement('button');save.type='button';save.textContent='この下面に適用';save.disabled=busy;
  save.onclick=()=>{
   if(busy||inputs.some(([,input])=>!input.reportValidity()))return;
   const values=Object.fromEntries(inputs.filter(([,input])=>input.value!=='').map(([key,input])=>[key,input.valueAsNumber]));
   const {noSupport,allowAutoSupport,edgeAssist,localRibs}=row.override;
   onSave(row,{...values,noSupport,allowAutoSupport,edgeAssist,localRibs});
  };
  const remove=document.createElement('button');remove.type='button';remove.textContent='共通設定に戻す';remove.disabled=busy;
  remove.onclick=()=>{if(!busy){const {noSupport,allowAutoSupport,edgeAssist,localRibs}=row.override;onSave(row,{noSupport,allowAutoSupport,edgeAssist,localRibs});}};
  edit.append(save,remove);
 }
 function stopDrawing(){
  draw=null;
  proposalChoices.replaceChildren();
  delete host.dataset.supportZonePicking;
  if(outline){outline.removeFromParent();outline.geometry.dispose();outline.material.dispose();outline=null;}
  visibility();
 }
 function showPlacement(message){
  if(placementStatus.textContent!==message)placementStatus.textContent=message;
  confirm.disabled=!draw?.zone;
  confirm.textContent=draw?.mode==='proposal'?'補強案を追加':draw?.mode==='rib'?'この位置に追加':'この範囲を確定';
 }
 cancel.onclick=()=>{if(draw)focus(rows.indexOf(draw.row));};
 function confirmPlacement(){
  if(!draw)return false;
  const {activeRow:row,zone,mode,length,rib,comparisonBands}=draw;
  if(!zone)return true;
  focus(draw.row?rows.indexOf(row):-1);
  if(mode==='proposal'){
   onSave(row,{...row.override,localRibs:[...(row.override.localRibs||[]),rib]},'短いリブの補強案を追加しました',comparisonBands);
  }else if(mode==='rib'){
   const at=[(zone[0]+zone[2])/2,(zone[1]+zone[3])/2].map(value=>Number(value.toFixed(4)));
   onSave(row,{...row.override,localRibs:[...(row.override.localRibs||[]),{at,length}]},'短いリブを追加しました');
  }else onSave(row,{...row.override,noSupport:[...(row.override.noSupport||[]),zone]},'除外範囲を確定しました');
  return true;
 }
 confirm.onclick=confirmPlacement;
 function canPlace(row,mode=draw?.mode){
  const field=mode==='rib'?'localRibs':'noSupport';
  return row?row.editable&&(mode==='rib'||!row.suppressed)&&(row.override[field]?.length||0)<8:
   faceMeshes.some(mesh=>canPlace(mesh.userData.coverageRow,mode));
 }
 function renderZones(row){
  const boxButton=document.createElement('button'),pointButton=document.createElement('button'),note=document.createElement('small');
  const sizeFields=['除外範囲の横幅 (mm)','除外範囲の奥行き (mm)'].map((name,axis)=>{
   const label=document.createElement('label'),input=document.createElement('input');
   Object.assign(input,{type:'number',min:.1,step:'any',required:true,value:pointSize[axis]});
   input.setAttribute('form','');
   input.dataset.supportZoneSize=String(axis);
   input.oninput=()=>{if(input.validity.valid)pointSize[axis]=input.valueAsNumber;};
   label.append(name,input);
   return {label,input};
  });
  boxButton.type=pointButton.type='button';
  boxButton.textContent='除外範囲を画面で囲む';
  pointButton.textContent='クリックした箇所を除外';
  note.textContent='指定範囲のリブと薄皮を省きます。3MFの自動サポートは除外範囲ごとに切り替えられます。';
  const start=(mode,button)=>{
   if(busy||!canPlace(row))return;
   if(draw){focus(rows.indexOf(row));return;}
   if(mode==='point'&&sizeFields.some(({input})=>!input.reportValidity()))return;
   draw={row,activeRow:row,mode,size:[...pointSize],startRay:null,zone:null};
   host.dataset.supportZonePicking=mode;
   display.checked=true;visibility();
   for(const control of [boxButton,pointButton,...sizeFields.map(({input})=>input)])control.disabled=control!==button;
   button.textContent='範囲指定をやめる';
   note.textContent='画面で範囲を指定し、「この範囲を確定」を押します。';
   showPlacement(mode==='point'?'除外したい箇所の中心をクリック':'除外範囲の最初の角をクリック');
  };
  boxButton.onclick=()=>start('box',boxButton);
  pointButton.onclick=()=>start('point',pointButton);
  for(const control of [boxButton,pointButton,...sizeFields.map(({input})=>input)]){
   control.dataset.supportZonePlacement='';
   control.disabled=busy||!canPlace(row);
  }
  zones.append(boxButton,...sizeFields.map(({label})=>label),pointButton,note);
  const lengthLabel=document.createElement('label'),lengthInput=document.createElement('input'),addRib=document.createElement('button');
  Object.assign(lengthInput,{type:'number',min:2,max:40,step:'any',required:true,value:localLength});
  lengthInput.setAttribute('form','');
  lengthInput.oninput=()=>{if(lengthInput.validity.valid)localLength=lengthInput.valueAsNumber;};
  lengthLabel.append('短いリブの長さ (mm)',lengthInput);
  addRib.type='button';addRib.textContent='短いリブを画面で追加';
  addRib.dataset.supportLocalRib='';lengthInput.dataset.supportLocalRib='';
  addRib.disabled=lengthInput.disabled=busy||!canPlace(row,'rib');
  addRib.onclick=()=>{
   if(draw){focus(rows.indexOf(row));return;}
   if(busy||!lengthInput.reportValidity()||!canPlace(row,'rib'))return;
   draw={row,activeRow:row,mode:'rib',length:localLength,zone:null};
   host.dataset.supportZonePicking='rib';addRib.textContent='リブの指定をやめる';
   visibility();showPlacement('補強したい箇所の中心をクリック');
  };
  zones.append(lengthLabel,addRib);
  for(const entry of row?[row]:rows){
   for(const [i,rib] of (entry.override.localRibs||[]).entries()){
    const remove=document.createElement('button');remove.type='button';remove.disabled=busy;
    remove.textContent=faceLabel(entry)+' ／ 短いリブ '+(i+1)+' を削除（'+rib.length+' mm）';
    remove.onclick=()=>onSave(entry,{...entry.override,localRibs:entry.override.localRibs.filter((_,index)=>index!==i)});
    zones.append(remove);
   }
   if(entry.localRibsSkipped){
    const skipped=document.createElement('small');
    skipped.textContent=faceLabel(entry)+' ／ '+entry.localRibsSkipped+' 本を配置できませんでした。外周、既存のリブ、除外範囲との位置関係を確認してください。';zones.append(skipped);
   }
   const exclusions=entry.override.noSupport||[];
   const allowed=entry.override.allowAutoSupport||[];
   for(const [i,range] of exclusions.entries()){
    const remove=document.createElement('button');remove.type='button';
    remove.textContent='除外 '+(i+1)+' を解除（'+(range[2]-range[0]).toFixed(1)+' × '+(range[3]-range[1]).toFixed(1)+' mm）'+(row?'':' ／ '+faceLabel(entry));
    remove.onclick=()=>{if(!busy)onSave(entry,{...entry.override,noSupport:exclusions.filter((_,index)=>i!==index),
     allowAutoSupport:allowed.filter(index=>index!==i).map(index=>index>i?index-1:index)});};
    const mode=document.createElement('select');
    mode.add(new Option('自動サポートも禁止','block'));mode.add(new Option('自動サポートに任せる','allow'));
    mode.value=allowed.includes(i)?'allow':'block';
    mode.setAttribute('aria-label',faceLabel(entry)+' ／ 除外 '+(i+1)+' の3MF自動サポート');
    mode.onchange=()=>{
     if(busy)return;
     const next=allowed.filter(index=>index!==i);
     if(mode.value==='allow')next.push(i);
     onSave(entry,{...entry.override,allowAutoSupport:next});
    };
    const width=document.createElement('small');
    width.textContent='除外範囲 '+(range[2]-range[0]).toFixed(1)+' × '+(range[3]-range[1]).toFixed(1)+' mm';
    zones.append(remove,mode,width);
   }
  }
 }
 function pointRay(event){
  const rect=canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);
  return Math.abs(ray.ray.direction.z)>.02;
 }
 function projectZone(row){
  plane.constant=-row.selection.point[2];
  if(!ray.ray.intersectPlane(plane,cursor))return null;
  const distance=cursor.distanceToSquared(ray.ray.origin);
  const {x,y}=cursor;
  let zone;
  if(draw.mode==='point'||draw.mode==='rib'){
   const axis=row.bridges?.axis??row.ribAxis;
   const [width,depth]=draw.mode==='point'?draw.size:axis===0?[row.wallThickness,draw.length]:[draw.length,row.wallThickness];
   zone=[x-width/2,y-depth/2,x+width/2,y+depth/2];
  }else{
   if(!draw.startRay?.intersectPlane(plane,corner))return null;
   zone=[Math.min(corner.x,x),Math.min(corner.y,y),Math.max(corner.x,x),Math.max(corner.y,y)];
  }
  return {row,distance,zone:zone.map(value=>Number(value.toFixed(4)))};
 }
 const faceLabel=row=>'下面 '+(rows.indexOf(row)+1)+'（高さ '+Number(row.selection.point[2].toFixed(2))+' mm）';
 function placementAtPointer(){
  if(draw.mode==='box'&&!draw.startRay)return null;
  if(draw.row)return projectZone(draw.row);
  const candidates=faceMeshes.filter(mesh=>canPlace(mesh.userData.coverageRow,draw?.mode));
  const underPointer=ray.intersectObjects(candidates,false)[0]?.object.userData.coverageRow;
  const direct=underPointer&&projectZone(underPointer);
  if(direct&&intersectsFace(direct.zone,direct.row.face))return direct;
  let closest=null;
  for(const mesh of candidates){
   const candidate=projectZone(mesh.userData.coverageRow);
   if(!candidate||closest&&closest.distance<=candidate.distance)continue;
   const [x0,y0,x1,y1]=candidate.zone,{min,max}=mesh.geometry.boundingBox;
   if(x1<=min.x||x0>=max.x||y1<=min.y||y0>=max.y)continue;
   if(intersectsFace(candidate.zone,candidate.row.face))closest=candidate;
  }
  return closest;
 }
 function showOutline({row,zone:[x0,y0,x1,y1]},color){
  if(draw.activeRow!==row){draw.activeRow=row;visibility();}
  const z=row.selection.point[2];
  const points=[[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z]];
  if(!outline){
   outline=new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3)),
    new THREE.LineBasicMaterial({color:0xd33791,depthTest:false,depthWrite:false}));
   outline.renderOrder=24;outline.frustumCulled=false;scene.add(outline);
  }
  outline.material.color.setHex(color);
  outline.visible=true;
  const position=outline.geometry.attributes.position;
  points.forEach((point,i)=>position.setXYZ(i,...point));position.needsUpdate=true;
 }
 canvas.addEventListener('pointermove',event=>{
  if(!draw||draw.zone||draw.mode==='proposal')return;
  const candidate=pointRay(event)?placementAtPointer():null;
  if(!candidate){
   if(outline)outline.visible=false;
   return;
  }
  showOutline(candidate,0xd33791);
  if(!draw.row)showPlacement(faceLabel(candidate.row)+' ／ '+(draw.mode==='box'?'反対側の角をクリック':'中心をクリック'));
 });
 canvas.addEventListener('pointerleave',()=>{if(outline&&!draw?.zone)outline.visible=false;});
 function pickBridge(event){
  if(comparisonBefore)return true;
  if(busy||muted||!bridgeToggle.checked||!pointRay(event))return false;
  const hit=ray.intersectObjects(bridgeMeshes.filter(mesh=>mesh.visible),false)[0];
  if(!hit)return false;
  const {row,risk}=hit.object.userData;
  if(risk==='bridge'){if(draw)stopDrawing();return true;}
  const suggestion=bridgeRibSuggestion(row,hit.point.toArray(),risk);
  if(!suggestion)return true;
  stopDrawing();
  draw={row:focused?row:null,activeRow:row,mode:'proposal',zone:null};
  host.dataset.supportZonePicking='proposal';visibility();
  const mm=value=>Number(value.toFixed(1))+' mm';
  if(!canPlace(row,'rib')||!suggestion.rib){
   showPlacement(row.editable&&(row.override.localRibs?.length||0)>=8?'この下面に追加できる短いリブは8本までです。':'この区間に収まる短いリブを提案できませんでした。');
   return true;
  }
  const {band,after,combined}=suggestion;
  const kind=band.both?'橋渡し幅':'支えがない幅';
  function choose(plan){
   Object.assign(draw,{rib:plan.rib,zone:plan.zone,comparisonBands:plan.comparisonBands||[band]});
   showOutline({row,zone:plan.zone},0x087b60);
   const widest=Math.max(...draw.comparisonBands.map(item=>item.width));
   const [x,y]=plan.rib.at;
   showPlacement(faceLabel(row)+' ／ 短いリブ '+mm(plan.rib.length)+' ／ この区間の'+kind+' 約 '+mm(band.width)+' → 約 '+mm(after)+'（目安）'+
    (plan.sections>1?' ／ 2区間の最大幅 約 '+mm(widest)+' → 約 '+mm(plan.maxAfter):'')+' ／ 中心 X '+mm(x)+'・Y '+mm(y));
   for(const button of proposalChoices.children)button.setAttribute('aria-pressed',String(button.dataset.plan===String(plan.sections)));
  }
  if(combined)for(const [label,plan] of [['この区間だけ',suggestion],['1本で2区間を支える',combined]]){
   const button=document.createElement('button');button.type='button';button.dataset.plan=String(plan.sections);button.textContent=label+'（'+mm(plan.rib.length)+'）';
   button.onclick=()=>choose(plan);proposalChoices.append(button);
  }
  choose(suggestion);
  confirm.focus({preventScroll:true});
  return true;
 }
 function pick(event){
  if(!draw||draw.mode==='proposal')return pickBridge(event);
  if(!pointRay(event)){showPlacement('下面が見えるよう、少し斜めに回転してください');return true;}
  if(draw.mode==='box'&&(!draw.startRay||draw.zone)){
   draw.startRay=ray.ray.clone();draw.zone=null;
   if(outline)outline.visible=false;
   showPlacement('反対側の角をクリック');return true;
  }
  draw.zone=null;
  const candidate=placementAtPointer();
  if(!candidate){showPlacement('対象の下面と重なる位置をクリック');return true;}
  const {row,zone}=candidate;
  if(zone[2]-zone[0]<.1-1e-9||zone[3]-zone[1]<.1-1e-9){showPlacement('縦横0.1 mm以上になる位置をクリック');return true;}
  if(draw.row&&!intersectsFace(zone,row.face)){
   showOutline(candidate,0xc05213);
   showPlacement('選んだ下面と重なる位置をクリック');return true;
  }
  if(draw.mode==='rib'){
   const x=(zone[0]+zone[2])/2,y=(zone[1]+zone[3])/2;
   if(!intersectsFace([x-.001,y-.001,x+.001,y+.001],row.face)){
    showPlacement('短いリブの中心を下面の内側に置いてください');return true;
   }
  }
  draw.zone=zone;
  showOutline(candidate,0x8628b7);
  showPlacement(faceLabel(row)+(draw.mode==='rib'?' に短いリブを追加':' を除外 ／ この範囲を確定'));
  confirm.focus({preventScroll:true});
  return true;
 }
 function intersectsFace(zone,{vertices,triangles}){
  const planes=[[0,zone[0],1],[1,zone[1],1],[0,zone[2],-1],[1,zone[3],-1]];
  for(let i=0;i<triangles.length;i+=3){
   let polygon=triangles.slice(i,i+3).map(index=>vertices.slice(index*3,index*3+2));
   for(const [axis,bound,direction] of planes){
    const clipped=[];
    for(const [j,a] of polygon.entries()){
     const b=polygon[(j+1)%polygon.length],first=direction*(a[axis]-bound),second=direction*(b[axis]-bound);
     if(first>=0)clipped.push(a);
     if((first<0)!==(second<0))clipped.push(a.map((value,k)=>value+(b[k]-value)*first/(first-second)));
    }
    polygon=clipped;
    if(polygon.length<3)break;
   }
   const area=polygon.reduce((sum,a,j)=>{const b=polygon[(j+1)%polygon.length];return sum+a[0]*b[1]-a[1]*b[0];},0);
   if(Math.abs(area)>1e-8)return true;
  }
  return false;
 }
 function show(items){
  clear();rows=items;
  if(!rows.length)return;
  group=new THREE.Group();areas=new THREE.Group();group.add(areas);scene.add(group);
  for(const [index,row] of rows.entries()){
   const title=bodyName(row.selection.bodyId)+' ／ '+faceLabel(row);
   const add=(mesh,color,layer)=>{
    if(!mesh)return;
    const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(mesh.vertices,3)).setIndex(mesh.triangles);
    const material=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.8,depthTest:false,depthWrite:false});
    const part=new THREE.Mesh(geometry,material);part.renderOrder=19+layer;part.userData.coverageRow=row;areas.add(part);return part;
   };
   const faceMesh=add(row.face,row.suppressed?0x818995:row.supported===true?0x15a97d:0x347fd0,0);
   if(faceMesh&&row.editable){faceMesh.geometry.computeBoundingBox();faceMeshes.push(faceMesh);}
   if(!row.suppressed&&row.supported!==true)add(row.supported,0x15a97d,1);
   add(row.caution,0xffbb2f,2);
   for(const area of row.manualExcluded||[])add(area,0xcc4e9a,2);
   addBridgeMesh(row);
   const lines=(row.boundaryWarnings||[]).map(item=>{
    const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(item.segments,3));
    const line=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xff7900,depthTest:false,depthWrite:false,transparent:true,opacity:.85}));
    line.renderOrder=22;group.add(line);return line;
   });
   contourLines.set(index,lines);
   if(!row.editable)continue;
   select.add(new Option(title+(row.suppressed?'（外側の小片を省略）':Object.keys(row.override).length?'（個別設定）':''),String(index)));
   const marker=document.createElement('button');marker.type='button';marker.textContent=String(index+1);
   marker.dataset.supportCoverageMarker=String(index+1);marker.title=title;
   marker.style.cssText='position:absolute;transform:translate(-50%,-50%);pointer-events:auto;padding:3px 7px;border:2px solid white;border-radius:6px;background:#164d64;color:white';
   marker.onclick=()=>{if(!busy){panel.open=true;focus(index);}};
   labels.append(marker);markers.push({marker,point:new THREE.Vector3(...row.selection.point)});
  }
  const index=focused?rows.findIndex(row=>row.selection.bodyId===focused.bodyId&&row.selection.point.every((v,i)=>v===focused.point[i])):-1;
  focus(index);
  visibility();sync();
 }
 display.onchange=visibility;
 select.onchange=()=>focus(select.value===''?-1:Number(select.value));
 reset.onclick=()=>{if(!busy&&target)onReset(target);};
 clear();
 return {show,clear,sync,pick,
  compareWith(row,showBefore){
   if(row&&group&&!comparisonMeshes.length)addBridgeMesh(row,comparisonMeshes);
   comparisonBefore=showBefore;visibility();
  },
  resetDisplay(){focused=null;display.checked=false;bridgeToggle.checked=false;panel.open=false;visibility();},
  controls({available,blocked,masked,activeTarget,hasOverrides}){
   panel.hidden=!available;busy=blocked;muted=masked||!available;target=activeTarget;
   display.disabled=busy||!rows.length;select.disabled=busy||select.options.length<2;reset.disabled=busy||!hasOverrides;
   bridgeToggle.disabled=busy||!bridgeMeshes.length;
   if(draw&&(busy||muted))focus(rows.indexOf(draw.row));
   for(const control of [...edit.querySelectorAll('input,button'),...warning.querySelectorAll('button,select')])
    control.disabled=busy;
   const row=select.value===''?null:rows[Number(select.value)];
   const canDraw=canPlace(row);
   if(!draw)for(const control of zones.querySelectorAll('input,button,select'))
    control.disabled=busy||control.hasAttribute('data-support-zone-placement')&&!canDraw||control.hasAttribute('data-support-local-rib')&&!canPlace(row,'rib');
   for(const {marker} of markers)marker.disabled=busy;
   visibility();
  }};
}
