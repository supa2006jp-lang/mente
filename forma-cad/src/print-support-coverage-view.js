import * as THREE from 'three';

export function createSupportCoverageView({anchor,host,camera,scene,bodyName,onSave,onReset}){
 const panel=document.createElement('details');panel.dataset.id='support-coverage';
 panel.innerHTML='<summary>支えの範囲・下面ごとの設定</summary><label><input type="checkbox" data-coverage="show">3MFの支えの範囲を色分け</label><small><b style="color:#08775a">緑：リブで支える指定範囲</b> ／ <b style="color:#155ca6">青：自動サポートに任せる範囲</b> ／ <b style="color:#966000">黄：外周からリブまで距離がある箇所（目安）</b></small><label>設定する下面<select data-coverage="face"></select></label><div data-coverage="edit" hidden></div><button type="button" data-coverage="reset">このボディの個別設定をすべて解除</button>';
 const get=key=>panel.querySelector('[data-coverage="'+key+'"]');
 const labels=document.createElement('div');
 labels.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden';
 host.append(labels);anchor.before(panel);
 const display=get('show'),select=get('face'),edit=get('edit'),reset=get('reset'),projected=new THREE.Vector3();
 let group=null,rows=[],markers=[],muted=false,target=null,busy=false;
 const fields=[['wallPitch','薄壁の間隔 (mm)',2,15,'any'],['roofLayers','上面の薄皮 (層)',1,6,1],['bottomSkinLayers','底面の薄皮 (層)',1,6,1]];
 function visibility(){
  if(group)group.visible=display.checked&&!muted;
  labels.hidden=!display.checked||muted;
 }
 function clear(){
  if(group){group.removeFromParent();group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
  group=null;rows=[];markers=[];labels.replaceChildren();select.replaceChildren(new Option('下面を選択',''));edit.hidden=true;edit.replaceChildren();
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
  select.value=index<0?'':String(index);
  for(const {marker} of markers){
   const selected=Number(marker.dataset.supportCoverageMarker)===index+1;
   marker.setAttribute('aria-pressed',selected);
   marker.style.background=selected?'#ad5608':'#164d64';
  }
  const row=rows[index];
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
   onSave(row,values);
  };
  const remove=document.createElement('button');remove.type='button';remove.textContent='共通設定に戻す';remove.disabled=busy;
  remove.onclick=()=>{if(!busy)onSave(row,{});};
  edit.append(save,remove);
 }
 function show(items){
  clear();rows=items;
  if(!rows.length)return;
  group=new THREE.Group();scene.add(group);
  for(const [index,row] of rows.entries()){
   const title=bodyName(row.selection.bodyId)+' ／ 下面 '+(index+1);
   const add=(mesh,color,layer)=>{
    if(!mesh)return;
    const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(mesh.vertices,3)).setIndex(mesh.triangles);
    const material=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.8,depthTest:false,depthWrite:false});
    const part=new THREE.Mesh(geometry,material);part.renderOrder=19+layer;group.add(part);
   };
   add(row.face,row.supported===true?0x15a97d:0x347fd0,0);
   if(row.supported!==true)add(row.supported,0x15a97d,1);
   add(row.caution,0xffbb2f,2);
   if(!row.editable)continue;
   select.add(new Option(title+(Object.keys(row.override).length?'（個別設定）':''),String(index)));
   const marker=document.createElement('button');marker.type='button';marker.textContent=String(index+1);
   marker.dataset.supportCoverageMarker=String(index+1);marker.title=title;
   marker.style.cssText='position:absolute;transform:translate(-50%,-50%);pointer-events:auto;padding:3px 7px;border:2px solid white;border-radius:6px;background:#164d64;color:white';
   marker.onclick=()=>{if(!busy){panel.open=true;focus(index);}};
   labels.append(marker);markers.push({marker,point:new THREE.Vector3(...row.selection.point)});
  }
  visibility();sync();
 }
 display.onchange=visibility;
 select.onchange=()=>focus(select.value===''?-1:Number(select.value));
 reset.onclick=()=>{if(!busy&&target)onReset(target);};
 clear();
 return {show,clear,sync,resetDisplay(){display.checked=false;panel.open=false;visibility();},
  controls({available,blocked,masked,activeTarget,hasOverrides}){
   panel.hidden=!available;busy=blocked;muted=masked||!available;target=activeTarget;
   display.disabled=busy||!rows.length;select.disabled=busy||select.options.length<2;reset.disabled=busy||!hasOverrides;
   for(const control of edit.querySelectorAll('input,button'))control.disabled=busy;
   for(const {marker} of markers)marker.disabled=busy;
   visibility();
  }};
}
