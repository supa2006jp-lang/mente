import * as THREE from 'three';
import {rebuild} from './geometry.js';
import {cadPosition} from './cad-coordinates.js';
export function installSupportRemoval({anchor,host,scene,meshes,kernel,getState,bodyName,onChange}){
 const element=document.createElement('details');element.dataset.id='removal-check';element.innerHTML='<summary>取り外し方向を確認</summary><label>確認するボディ<select data-removal="body"></select></label><button type="button" data-removal="auto">抜ける方向を自動で探す</button><div data-removal="results"></div><label>抜く方向<select data-removal="direction"><option value="0:-1">X−</option><option value="0:1">X＋</option><option value="1:-1">Y−</option><option value="1:1">Y＋</option><option value="2:-1">Z−</option><option value="2:1">Z＋</option></select></label><button type="button" data-removal="check">この方向を調べる</button><button type="button" data-removal="reset" disabled>元のプレビューに戻す</button><p data-removal="status" role="status">方向を選んで確認してください。</p><div data-removal="motion" hidden><label>移動のプレビュー<input type="range" min="0" max="1" step="any" value="0" data-removal="distance"></label><span data-removal="distance-label"></span><button type="button" data-removal="play">再生</button></div><small>表示メッシュで、サポート全体を変形させず直線に抜く場合を調べます。本体に当たるボディは赤色です。根元の接触は切り離した想定で、たわみ・切断後の分解・工具の入る空間は評価しません。モデルや出力形状は動かしません。</small>';anchor.before(element);const q=id=>element.querySelector('[data-removal="'+id+'"]');
 let serial=0,running=false,report=null,group=null,ghost=null,hidden=[],parent=null,labels=[],playing=false,started=0,startDistance=0,disabled=false;
 const active=()=>running||!!report,checks=new Map();
 let bodyKey='';
 const directionNames=['X−','X＋','Y−','Y＋','Z−','Z＋'];
 const directionLabel=({axis,sign})=>directionNames[axis*2+(sign>0?1:0)];
 const entries=()=>getState()?.entries||[];
 function updateBodies(){
  const items=entries(),key=JSON.stringify(items.map(({output})=>output.id));
  if(bodyKey===key)return;
  const previous=q('body').value;bodyKey=key;
  q('body').replaceChildren(...items.map(({output,target})=>new Option(bodyName(target),output.id)));
  if(items.some(({output})=>output.id===previous))q('body').value=previous;
 }
 function mesh(data,color,opacity=1){const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(data.vertices,3)).setIndex(data.triangles);geometry.computeVertexNormals();return new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.65,transparent:opacity<1,opacity,depthWrite:opacity===1,side:THREE.DoubleSide}));}
 function restore(){playing=false;if(group){group.removeFromParent();group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}group=null;ghost=null;if(parent)parent.visible=true;parent=null;for(const [m,visible]of hidden)m.visible=visible;hidden=[];for(const [label,wasHidden]of labels)label.hidden=wasHidden;labels=[];delete host.dataset.supportRemoval;}
 function clearMotion(){
  report=null;restore();q('motion').hidden=true;q('distance').value=0;q('status').textContent='方向を選んで確認してください。';q('status').style.color='';
 }
 function reset(){
  serial++;if(running)kernel.reset();running=false;checks.clear();q('results').replaceChildren();clearMotion();sync(disabled);
 }
 function move(){if(!ghost||!report)return;const distance=Number(q('distance').value);ghost.position.set(0,0,0);ghost.position.setComponent(report.axis,report.sign*distance);q('distance-label').textContent=distance.toFixed(2)+' mm';host.dataset.supportRemoval=JSON.stringify({...report,previewDistance:distance,playing});}
 function sync(value=disabled){disabled=value;updateBodies();
  q('check').disabled=q('auto').disabled=disabled||running||!q('body').value;
  q('body').disabled=disabled||running||q('body').options.length<2;
  q('direction').disabled=disabled||running;
  for(const button of q('results').querySelectorAll('button'))button.disabled=disabled||running;q('reset').disabled=!active();q('distance').disabled=disabled||running||!report;q('play').disabled=q('distance').disabled||Number(q('distance').max)<=0;q('play').textContent=playing?'一時停止':'再生';
  if(playing&&report){const limit=Number(q('distance').max),value=Math.min(limit,startDistance+(performance.now()-started)/3500*Math.max(limit,1));q('distance').value=value;if(value>=limit)playing=false;move();}
 }
 q('direction').onchange=()=>{clearMotion();onChange();};q('reset').onclick=()=>{reset();onChange();};q('distance').oninput=()=>{playing=false;move();sync();};q('play').onclick=()=>{if(!report)return;playing=!playing;if(playing){if(Number(q('distance').value)>=Number(q('distance').max))q('distance').value=0;startDistance=Number(q('distance').value);started=performance.now();}move();sync();};
 function showMotion(result,entry,obstacles,state){
  clearMotion();report=result;
  group=new THREE.Group();scene.add(group);parent=state.preview;if(parent)parent.visible=false;
  labels=[...host.querySelectorAll('[data-support-rib-labels],[data-support-roof-labels]')].map(label=>[label,label.hidden]);
  for(const [label] of labels)label.hidden=true;
  const collisions=new Set(report.contacts.map(c=>c.id));
  for(const obstacle of obstacles){
   const live=meshes.get(obstacle.id);
   if(live){hidden.push([live,live.visible]);live.visible=false;}
   group.add(mesh(obstacle,collisions.has(obstacle.id)?0xd93b40:0x6caec0,.3));
  }
  const original=mesh(entry.output,0x8e9298,.12);group.add(original);
  ghost=mesh(entry.output,0xe4a755,.85);group.add(ghost);
  const limit=report.firstContact??report.travel;
  if(report.state==='clear'){
   const box=new THREE.Box3().setFromObject(original),direction=new THREE.Vector3().setComponent(report.axis,report.sign);
   const arrow=new THREE.ArrowHelper(direction,box.getCenter(new THREE.Vector3()),Math.max(4,limit),0x15966c);
   arrow.line.geometry=arrow.line.geometry.clone();arrow.cone.geometry=arrow.cone.geometry.clone();
   group.add(arrow);
  }
  q('distance').max=limit;q('distance').value=limit;q('motion').hidden=false;
  q('status').textContent=directionLabel(report)+' ／ '+(report.state==='blocked'
   ?'直線では取り外せません。'+report.contacts.map(c=>bodyName(c.id)+' '+c.distance.toFixed(2)+' mm先で接触').join(' ／ ')
   :'直線移動で干渉が見つかりませんでした。');
  q('status').style.color=report.state==='blocked'?'#b43b24':'#14704f';move();
 }
 function showDirections(){
  q('results').replaceChildren();
  const checked=checks.get(q('body').value);
  if(!checked)return;
  const summary=document.createElement('p');
  summary.textContent=checked.error?'未確認 '+checked.error:'干渉なし '+checked.directions.filter(item=>item.state==='clear').length+'方向 ／ 緑の矢印を押して確認';
  q('results').append(summary);
  if(checked.error)return;
  for(const result of checked.directions){
   const button=document.createElement('button');
   button.type='button';button.textContent=directionLabel(result)+(result.state==='clear'?' ↗':result.state==='blocked'?' ×':' ？');
   button.title=result.message|| (result.state==='clear'?'直線で抜ける方向を表示':'最初に当たる位置を表示');
   if(result.state==='clear'){button.style.color='#126649';button.style.background='#d8f4e7';}
   button.onclick=()=>{
    if(disabled||running)return;
    if(result.state==='unknown'){clearMotion();q('status').textContent=directionLabel(result)+' ／ '+result.message;}
    else showMotion(result,checked.entry,checked.obstacles,getState());
    onChange();
   };
   q('results').append(button);
  }
 }
 q('body').onchange=()=>{clearMotion();showDirections();onChange();};
 function modelObstacles(history,items){
  const objects=rebuild(history);
  const precise=new Map(items.flatMap(entry=>entry.result.supportPackage?.bodies||[]).map(body=>[body.id,body]));
  try{
   return [...objects].map(([id,item])=>{
    if(precise.has(id))return precise.get(id);
    const position=cadPosition(item.geometry),vertices=[];
    for(let i=0;i<position.count;i++)vertices.push(position.getX(i),position.getY(i),position.getZ(i));
    const index=item.geometry.index;
    return {id,vertices,triangles:index?Array.from(index.array):Array.from({length:position.count},(_,i)=>i)};
   });
  }finally{objects.forEach(item=>item.geometry.dispose());}
 }
 async function check(allDirections){
  const state=getState(),items=state?.entries||[],selected=items.find(entry=>entry.output.id===q('body').value);
  if(disabled||running||!selected)return;
  clearMotion();if(allDirections){checks.clear();q('results').replaceChildren();}
  const request=++serial;running=true;onChange();
  const current=()=>request===serial&&getState()?.entries.some(entry=>entry.output===selected.output);
  try{
   const models=modelObstacles(state.history,items);
   for(const entry of allDirections?items:[selected]){
    q('status').textContent='干渉を確認中 '+bodyName(entry.target);
    const obstacles=[...models,...items.filter(item=>item!==entry).map(item=>item.output)];
    const [axis,sign]=q('direction').value.split(':').map(Number);
    try{
     const result=await kernel.run([],{type:'printSupportRemoval',moving:entry.output,obstacles,axis,sign,allDirections});
     if(!current())return;
     if(allDirections)checks.set(entry.output.id,{entry,obstacles,directions:result.directions});
     else showMotion(result,entry,obstacles,state);
    }catch(error){
     if(!current())return;
     if(!allDirections||error.code==='cancelled')throw error;
     checks.set(entry.output.id,{error:error.message});
    }
   }
   if(allDirections){q('status').textContent='方向を押すと取り外しをプレビューします。';showDirections();}
  }catch(error){
   if(current()){clearMotion();q('status').textContent='未確認 '+error.message;}
  }finally{if(request===serial){running=false;onChange();}}
 }
 q('check').onclick=()=>check(false);
 q('auto').onclick=()=>check(true);
 return {element,sync,reset,get active(){return active();}};
}
