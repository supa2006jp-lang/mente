import * as THREE from 'three';

export function createSupportCoverageView({anchor,host,canvas,camera,scene,bodyName,onSave,onReset}){
 const panel=document.createElement('details');panel.dataset.id='support-coverage';
 panel.innerHTML='<summary>支えの範囲・下面ごとの設定</summary><label><input type="checkbox" data-coverage="show">3MFの支えの範囲を色分け</label><small><b style="color:#08775a">緑：リブで支える範囲</b> ／ <b style="color:#155ca6">青：自動サポートに任せる範囲</b> ／ <b style="color:#a02b68">紫：指定した除外範囲</b> ／ <b style="color:#a64900">橙：輪郭からリブまで距離がある箇所</b></small><label>設定する下面<select data-coverage="face"></select></label><div data-coverage="warning" hidden></div><div data-coverage="zones" hidden></div><div data-coverage="edit" hidden></div><button type="button" data-coverage="reset">このボディの個別設定をすべて解除</button>';
 const get=key=>panel.querySelector('[data-coverage="'+key+'"]');
 const labels=document.createElement('div');
 labels.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden';
 host.append(labels);anchor.before(panel);
 const display=get('show'),select=get('face'),edit=get('edit'),reset=get('reset'),warning=get('warning'),zones=get('zones'),projected=new THREE.Vector3();
 const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,0,1)),corner=new THREE.Vector3(),cursor=new THREE.Vector3();
 const contourLines=new Map();
 let group=null,areas=null,rows=[],markers=[],muted=false,target=null,busy=false,focused=null,draw=null,outline=null;
 const fields=[['wallPitch','薄壁の間隔 (mm)',2,15,'any'],['roofLayers','上面の薄皮 (層)',1,6,1],['bottomSkinLayers','底面の薄皮 (層)',1,6,1]];
 function visibility(){
  if(group){group.visible=!muted;areas.visible=display.checked;for(const [index,lines] of contourLines)
   for(const line of lines)line.visible=display.checked||rows[index].showBoundaryWarnings===true;}
  labels.hidden=!display.checked||muted||!!draw;
 }
 function clear(){
  stopDrawing();
  if(group){group.removeFromParent();group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
  group=areas=null;rows=[];markers=[];contourLines.clear();labels.replaceChildren();select.replaceChildren(new Option('下面を選択',''));edit.hidden=warning.hidden=zones.hidden=true;edit.replaceChildren();warning.replaceChildren();zones.replaceChildren();
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
  zones.replaceChildren();zones.hidden=!row?.editable||!!row.suppressed;
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
   const {noSupport,edgeAssist}=row.override;
   onSave(row,{...values,noSupport,edgeAssist});
  };
  const remove=document.createElement('button');remove.type='button';remove.textContent='共通設定に戻す';remove.disabled=busy;
  remove.onclick=()=>{if(!busy){const {noSupport,edgeAssist}=row.override;onSave(row,{noSupport,edgeAssist});}};
  edit.append(save,remove);
 }
 function stopDrawing(){
  draw=null;
  if(outline){outline.removeFromParent();outline.geometry.dispose();outline.material.dispose();outline=null;}
  visibility();
 }
 function renderZones(row){
  const ranges=row.override.noSupport||[],button=document.createElement('button'),note=document.createElement('small');
  button.type='button';button.textContent='除外範囲を画面で囲む';button.disabled=busy||ranges.length>=8;
  note.textContent='この下面でリブ・薄皮・3MFの自動サポートを省きます。';
  button.onclick=()=>{
   if(busy)return;
   if(draw){focus(rows.indexOf(row));return;}
   draw={row,button,note,started:false};
   display.checked=true;visibility();
   button.textContent='範囲指定をやめる';note.textContent='画面で範囲の始点と対角点をクリックしてください。';
  };
  zones.append(button,note);
  for(const [i,range] of ranges.entries()){
   const remove=document.createElement('button');remove.type='button';
   remove.textContent='除外 '+(i+1)+' を解除（'+(range[2]-range[0]).toFixed(1)+' × '+(range[3]-range[1]).toFixed(1)+' mm）';
   remove.onclick=()=>{if(!busy)onSave(row,{...row.override,noSupport:ranges.filter((_,index)=>i!==index)});};
   zones.append(remove);
  }
 }
 function project(event){
  const rect=canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);
  plane.constant=-draw.row.selection.point[2];
  return Math.abs(ray.ray.direction.z)>.02&&ray.ray.intersectPlane(plane,cursor);
 }
 canvas.addEventListener('pointermove',event=>{
  if(!draw?.started||!project(event))return;
  const {x,y,z}=corner,points=[[x,y,z],[cursor.x,y,z],[cursor.x,cursor.y,z],[x,cursor.y,z]];
  if(!outline){
   outline=new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3)),
    new THREE.LineBasicMaterial({color:0xd33791,depthTest:false,depthWrite:false}));
   outline.renderOrder=24;outline.frustumCulled=false;scene.add(outline);
  }
  const position=outline.geometry.attributes.position;
  points.forEach((point,i)=>position.setXYZ(i,...point));position.needsUpdate=true;
 });
 function pick(event){
  if(!draw)return false;
  if(!project(event)){draw.note.textContent='下面が見えるように視点を回転してください。';return true;}
  if(!draw.started){corner.copy(cursor);draw.started=true;draw.note.textContent='対角点をクリックしてください。';return true;}
  const zone=[Math.min(corner.x,cursor.x),Math.min(corner.y,cursor.y),Math.max(corner.x,cursor.x),Math.max(corner.y,cursor.y)].map(value=>Number(value.toFixed(4)));
  const {row,note}=draw;
  if(zone[2]-zone[0]<.1||zone[3]-zone[1]<.1){note.textContent='縦横0.1 mm以上の範囲を指定してください。';return true;}
  if(!intersectsFace(zone,row.face)){note.textContent='選んだ下面と重なる範囲を指定してください。';return true;}
  focus(rows.indexOf(row));onSave(row,{...row.override,noSupport:[...(row.override.noSupport||[]),zone]});return true;
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
   const title=bodyName(row.selection.bodyId)+' ／ 下面 '+(index+1);
   const add=(mesh,color,layer)=>{
    if(!mesh)return;
    const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(mesh.vertices,3)).setIndex(mesh.triangles);
    const material=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.8,depthTest:false,depthWrite:false});
    const part=new THREE.Mesh(geometry,material);part.renderOrder=19+layer;areas.add(part);
   };
   add(row.face,row.suppressed?0x818995:row.supported===true?0x15a97d:0x347fd0,0);
   if(!row.suppressed&&row.supported!==true)add(row.supported,0x15a97d,1);
   add(row.caution,0xffbb2f,2);
   for(const area of row.manualExcluded||[])add(area,0xcc4e9a,2);
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
  if(index>=0)focus(index);
  visibility();sync();
 }
 display.onchange=visibility;
 select.onchange=()=>focus(select.value===''?-1:Number(select.value));
 reset.onclick=()=>{if(!busy&&target)onReset(target);};
 clear();
 return {show,clear,sync,pick,resetDisplay(){focused=null;display.checked=false;panel.open=false;visibility();},
  controls({available,blocked,masked,activeTarget,hasOverrides}){
   panel.hidden=!available;busy=blocked;muted=masked||!available;target=activeTarget;
   display.disabled=busy||!rows.length;select.disabled=busy||select.options.length<2;reset.disabled=busy||!hasOverrides;
   if(draw&&(busy||muted))focus(rows.indexOf(draw.row));
   for(const control of [...edit.querySelectorAll('input,button'),...zones.querySelectorAll('button'),...warning.querySelectorAll('button,select')])
    control.disabled=busy||control===zones.firstChild&&(rows[Number(select.value)]?.override.noSupport?.length||0)>=8;
   for(const {marker} of markers)marker.disabled=busy;
   visibility();
  }};
}
