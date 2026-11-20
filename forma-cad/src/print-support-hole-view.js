import * as THREE from 'three';
import {maxSupportHoleProtections,sameSupportHole,supportHoleProtectionLimits,validateSupportHoleProtections} from './print-support-hole-protection.js';

const displayNumber=n=>Number(n.toFixed(2));
const up=new THREE.Vector3(0,1,0),forward=new THREE.Vector3(0,0,1);
const fields={depth:'穴の奥へ',outside:'入口から外へ',margin:'穴の縁からの余白'};

export function createSupportHoleView({anchor,scene,host,canvas,camera,bodyName,onStart,onFinish}){
 const panel=document.createElement('details');
 panel.dataset.id='hole-protection';
 panel.innerHTML='<summary>丸穴・ねじ穴を保護</summary><small>選んだ穴の周りにリブ・薄皮を置かず、3MFの自動サポートも除外します。</small>'+
  '<label data-hole-body hidden>穴を選ぶボディ<select data-id="hole-body"></select></label>'+
  '<div class="editor-actions"><button type="button" class="accent" data-id="hole-pick">穴を選ぶ</button>'+
  '<button type="button" data-id="hole-stop" hidden>選択を終了</button></div>'+
  '<small data-id="hole-status" role="status"></small><div data-id="hole-list"></div>'+
  '<label data-hole-display hidden><input type="checkbox" data-id="hole-display">保護範囲を表示</label>'+
  '<div data-id="hole-editor" hidden><small data-id="hole-opening"></small><div class="support-fields">'+
  Object.entries(fields).map(([key,label])=>{
   const [min,max]=supportHoleProtectionLimits[key];
   return '<label>'+label+' (mm)<input type="number" data-id="hole-'+key+'" min="'+min+'" max="'+max+'" step="any" required disabled></label>';
  }).join('')+'</div><button type="button" class="accent" data-id="hole-add">保護範囲を適用</button></div>';
 anchor.after(panel);
 const $=id=>panel.querySelector('[data-id="hole-'+id+'"]'),summary=panel.querySelector('summary');
 const inputs=Object.keys(fields).map(key=>[key,$(key)]);
 const ray=new THREE.Raycaster();
 const circles=new THREE.Group(),volumes=new THREE.Group();
 scene.add(circles,volumes);
 const saved=new Map();
 let target='',targets=[],picking=false,blocked=false,disabled=false,entries=[],hovered=null,index=-1,draft=null,lastVolume='',resolvedByTarget=()=>null;
 const selections=bodyId=>saved.get(bodyId)||[];
 const currentRanges=()=>resolvedByTarget(target)||selections(target);

 function clearGroup(group){
  for(const child of [...group.children]){
   child.removeFromParent();child.geometry.dispose();child.material.dispose();
  }
 }
 function showVolumes(){
  const chosen=draft&&readDraft();
  const ranges=picking?(chosen?[chosen]:[]):!disabled&&$('display').checked?
   currentRanges():[];
  const key=JSON.stringify(ranges);
  if(key===lastVolume)return;
  lastVolume=key;clearGroup(volumes);
  for(const {center,axis,radius,depth,outside,margin} of ranges){
   const size=radius+margin,direction=new THREE.Vector3(...axis),origin=new THREE.Vector3(...center),length=depth+outside;
   const geometry=new THREE.CylinderGeometry(size,size,length,72);
   const material=new THREE.MeshBasicMaterial({color:0x6452d1,opacity:.23,transparent:true,depthWrite:false,side:THREE.DoubleSide});
   const mesh=new THREE.Mesh(geometry,material);
   mesh.position.copy(origin).addScaledVector(direction,(outside-depth)/2);
   mesh.quaternion.setFromUnitVectors(up,direction);mesh.renderOrder=12;volumes.add(mesh);
   const ringGeometry=new THREE.RingGeometry(Math.max(size-.12,size*.78),size,72);
   const ring=new THREE.Mesh(ringGeometry,new THREE.MeshBasicMaterial({color:0x6851cf,side:THREE.DoubleSide,depthWrite:false}));
   ring.quaternion.setFromUnitVectors(forward,direction);
   ring.position.copy(origin).addScaledVector(direction,.045);ring.renderOrder=13;volumes.add(ring);
  }
  if(ranges.length)host.dataset.supportHoleProtection=key;
  else delete host.dataset.supportHoleProtection;
 }
 function readDraft(){
  const dimensions=Object.fromEntries(inputs.map(([key,input])=>[key,input.valueAsNumber]));
  if(inputs.some(([key,input])=>!Number.isFinite(input.valueAsNumber)||
   input.valueAsNumber<supportHoleProtectionLimits[key][0]||input.valueAsNumber>supportHoleProtectionLimits[key][1]))return null;
  return {...draft,...dimensions};
 }
 function refresh(){
  const list=selections(target);
  summary.textContent='丸穴・ねじ穴を保護'+(list.length?'（'+list.length+'件）':'');
  $('editor').hidden=!picking||!draft;
  $('pick').hidden=picking;
  $('pick').disabled=blocked||list.length>=maxSupportHoleProtections;
  $('stop').hidden=!picking;
  panel.querySelector('[data-hole-display]').hidden=picking||!list.length;
  $('add').disabled=blocked;
  inputs.forEach(([,input])=>{input.disabled=!picking||!draft||blocked;});
  $('list').hidden=picking;
  $('list').replaceChildren(...list.map((hole,i)=>{
   const row=document.createElement('div');
   const description=document.createElement('small');
   description.textContent=(i+1)+'. 穴径 '+displayNumber(2*(currentRanges()[i]?.radius||hole.radius))+' mm ／ 奥 '+displayNumber(hole.depth)+
    '・外 '+displayNumber(hole.outside)+'・余白 '+displayNumber(hole.margin)+' mm';
   const edit=document.createElement('button'),remove=document.createElement('button');
   edit.type=remove.type='button';edit.textContent='範囲を編集';remove.textContent='解除';
   edit.dataset.holeEdit=remove.dataset.holeRemove=i;
   edit.disabled=remove.disabled=blocked;
   edit.onclick=()=>onStart(target,i);
   remove.onclick=()=>{saved.set(target,list.filter((_,j)=>i!==j));onFinish(true);};
   row.style.margin='8px 0';row.append(description,edit,' ',remove);return row;
  }));
  showVolumes();
 }
 function choose(hole,indexToEdit){
  const list=selections(target);
  index=indexToEdit??list.findIndex(other=>sameSupportHole(hole,other));
  draft=index>=0?{...list[index],center:hole.center,axis:hole.axis,radius:hole.radius}:
   {...hole,outside:3,margin:.5};
  for(const [key,input] of inputs)input.value=draft[key];
  $('opening').textContent='選んだ穴の直径 '+displayNumber(hole.radius*2)+' mm';
  $('status').textContent='紫色が保護範囲です。穴の軸に沿った長さを調整できます。';
  refresh();
 }
 function open(bodyId,editIndex,opening){
  target=bodyId;picking=true;panel.open=true;index=-1;draft=null;
  $('status').textContent='円形の穴の入口を調べています…';
  if(editIndex!==undefined)choose(opening||selections(target)[editIndex],editIndex);
  else refresh();
 }
 function showOpenings(openings){
  clearGroup(circles);hovered=null;
  entries=openings.map(hole=>{
   const axis=new THREE.Vector3(...hole.axis),center=new THREE.Vector3(...hole.center);
   const points=Array.from({length:72},(_,i)=>{
    const angle=i*2*Math.PI/72;
    return new THREE.Vector3(Math.cos(angle)*hole.radius,Math.sin(angle)*hole.radius,0);
   });
   const ring=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({color:0x078d9b,depthWrite:false}));
   ring.quaternion.setFromUnitVectors(forward,axis);
   ring.position.copy(center).addScaledVector(axis,.035);ring.renderOrder=11;circles.add(ring);
   return {hole,axis,center,ring};
  });
  $('status').textContent=entries.length?'穴の入口または縁をクリックしてください。Shift＋ドラッグで回転できます。':'このボディに円形の穴の入口が見つかりませんでした。';
 }
 function hit(event,objects){
  if(!entries.length)return null;
  const rect=canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);
  const surface=ray.intersectObjects(objects,false)[0]?.distance??Infinity;
  let best=null,closest=Infinity;
  const offset=new THREE.Vector3();
  for(const entry of entries){
   const facing=ray.ray.direction.dot(entry.axis);
   if(facing>=-.001)continue;
   const t=offset.copy(entry.center).sub(ray.ray.origin).dot(entry.axis)/facing;
   if(t<0||t>=closest||t>surface+.085/-facing)continue;
   const distance=ray.ray.at(t,offset).distanceTo(entry.center),radius=entry.hole.radius;
   if(distance>radius+Math.min(.3,radius*.18))continue;
   best=entry;closest=t;
  }
  return best;
 }
 function hover(event,objects){
  const next=event?hit(event,objects):null;
  if(next===hovered)return;
  hovered?.ring.material.color.setHex(0x078d9b);
  hovered=next;
  hovered?.ring.material.color.setHex(0x25ddeb);
 }
 function end(){
  picking=false;draft=null;index=-1;entries=[];hovered=null;clearGroup(circles);
  $('status').textContent='';refresh();
 }
 $('pick').onclick=()=>onStart(target);
 $('stop').onclick=()=>onFinish(false);
 $('display').onchange=showVolumes;
 $('body').onchange=()=>{target=$('body').value;$('status').textContent='';refresh();};
 for(const [,input] of inputs)input.oninput=showVolumes;
 $('add').onclick=()=>{
  if(!draft||inputs.some(([,input])=>!input.reportValidity()))return;
  const list=[...selections(target)],hole=readDraft();
  if(!hole)return;
  if(index<0)list.push(hole);else list[index]=hole;
  try{saved.set(target,validateSupportHoleProtections(list));}
  catch(error){$('status').textContent=error.message;return;}
  onFinish(true);
 };
 return {
  open,showOpenings,hover,end,selections,message(value){$('status').textContent=value;},
  pick(event,objects){
   const entry=hit(event,objects);
   if(entry){choose(entry.hole);return true;}
   if(entries.length)$('status').textContent='見えている円形の入口か縁をクリックしてください。';
   return false;
  },
  sync({enabled,locked,batchTargets,activeTarget,resolve}){
   disabled=!enabled;blocked=locked;panel.hidden=disabled;resolvedByTarget=resolve;
   if(batchTargets.length!==targets.length||batchTargets.some((bodyId,i)=>bodyId!==targets[i])){
    targets=batchTargets;
    $('body').replaceChildren(...targets.map(bodyId=>new Option(bodyName(bodyId),bodyId)));
   }
   if(!picking)target=targets.includes(target)?target:targets[0]||activeTarget;
   $('body').value=target;$('body').disabled=blocked||picking;
   panel.querySelector('[data-hole-body]').hidden=!targets.length;
   refresh();
  },
  reset(bodyId,holes=[]){
   saved.clear();saved.set(bodyId,structuredClone(holes));target=bodyId;targets=[];resolvedByTarget=()=>null;disabled=!bodyId;
   $('display').checked=false;panel.open=!!holes.length;end();
  }
 };
}
