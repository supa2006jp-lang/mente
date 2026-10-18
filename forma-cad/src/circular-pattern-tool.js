import * as THREE from 'three';
import {cavityPattern} from './circular-pattern-options.js';

export function createCircularPatternTool({scene,host,canvas,camera,kernel,getFeatures,getBodies,getSpec,getSource}){
 const $=id=>document.getElementById(id),fields=$('cad-fields'),dialog=$('tools-dialog');
 const active=()=>dialog.open&&$('cad-command').value==='circular';
 const spacingGroup=new THREE.Group();scene.add(spacingGroup);
 const group=new THREE.Group(),overlay=document.createElement('div');overlay.id='circular-instance-markers';scene.add(group);host.append(overlay);
 const style=document.createElement('style');style.textContent='.circular-hole-picking #center-markers{visibility:hidden}'+'#circular-pattern-options{border-top:1px solid #7293a7;padding-top:8px;display:grid;gap:8px}#circular-pattern-options [hidden],#circular-instance-markers[hidden]{display:none!important}#circular-pattern-options p{font-size:12px;margin:3px 0}#circular-pattern-options .circular-list{max-height:155px;overflow:auto;display:grid;gap:5px}#circular-pattern-options .circular-check{display:flex;flex-direction:row;justify-content:flex-start;text-align:left;margin:0;align-items:center;gap:7px;font-size:12px;padding:5px;border-radius:5px}#circular-pattern-options .circular-check:hover{background:#41718c44}#circular-pattern-options input[type=checkbox]{width:auto;flex:none}#circular-pattern-options .circular-positions{display:flex;flex-wrap:wrap;gap:5px}#circular-pattern-options button{font-size:12px;padding:6px}#circular-pattern-options button[aria-pressed=false]{opacity:.6}#circular-instance-markers{position:absolute;inset:0;pointer-events:none;z-index:16}#circular-instance-markers button{position:absolute;transform:translate(-50%,-50%);pointer-events:auto;border:2px solid white;border-radius:20px;font-size:12px;padding:4px 7px;background:#0d7e9d;color:white;box-shadow:0 1px 4px #0006}#circular-instance-markers button[aria-pressed=false]{background:#6d7380;text-decoration:line-through}';document.head.append(style);
 let panel=null,catalog=[],catalogKey='',revision=null,loading=false,loadError='',ticket=0,holeMode='all',targetMode='all',selected=new Set(),targets=new Set(),suppressed=new Set(),picking=false,hover=null,signature='',positionSignature='',pendingKeys=null,restoreTarget=null,spacingKey='',spacingTicket=0;
 const clearGeometry=()=>{for(const child of [...group.children]){group.remove(child);child.geometry.dispose();child.material.dispose();}};
 function emit(){invalidateSpacing();signature='';fields.dispatchEvent(new Event('input',{bubbles:true}));update();}
 function render(){
  ++ticket;clearSpacing();pendingKeys=null;restoreTarget=null;clearGeometry();overlay.replaceChildren();catalog=[];catalogKey='';revision=null;loading=false;loadError='';holeMode='all';targetMode='all';selected=new Set();targets=new Set(getBodies().map(b=>b.id));suppressed=new Set();picking=false;hover=null;signature='';positionSignature='';
  panel=document.createElement('section');panel.id='circular-pattern-options';
  panel.innerHTML='<div data-circular-cavities><label>パターン化する穴・くぼみ<select id="circular-hole-mode"><option value="all">すべて</option><option value="selected">選択した穴・くぼみ</option></select></label><p id="circular-hole-status" role="status"></p><button type="button" id="circular-pick-holes" aria-pressed="false">画面で穴・くぼみを選択</button><div id="circular-hole-list" class="circular-list"></div><label>切り取るボディ<select id="circular-target-mode"><option value="all">すべて</option><option value="selected">選択したボディ</option></select></label><div id="circular-target-list" class="circular-list"></div><button type="button" id="circular-check-spacing">穴間の肉厚を確認</button><p id="circular-spacing-status" role="status">原型の穴と有効な配置間の最短距離を確認できます。</p><p>穴間の肉厚の目安です。外周や底面の壁厚は含みません。1 mm未満は注意として表示します。</p><p id="circular-hybrid-note" hidden>穴と対象ボディの選択は切り取り範囲に適用します。新規コピーは原型の形状を引き継ぎます。</p></div><details open><summary>配置位置ごとのオン・オフ</summary><p>画面の番号か下のボタンをクリックします。原型（位置1）は残ります。</p><div id="circular-position-list" class="circular-positions"></div></details>';
  fields.append(panel);
  $('circular-check-spacing').onclick=checkSpacing;
  $('circular-hole-mode').onchange=()=>{holeMode=$('circular-hole-mode').value;emit();};
  $('circular-target-mode').onchange=()=>{targetMode=$('circular-target-mode').value;emit();};
  $('circular-pick-holes').onclick=()=>{picking=!picking;hover=null;signature='';update();};
  renderTargets();update();
 }
 function renderTargets(){
  const list=$('circular-target-list');if(!list)return;list.replaceChildren();
  for(const body of getBodies()){const label=document.createElement('label'),input=document.createElement('input');label.className='circular-check';input.type='checkbox';input.checked=targets.has(body.id);input.setAttribute('aria-label','加工する '+body.name);input.dataset.bodyId=body.id;input.onchange=()=>{input.checked?targets.add(body.id):targets.delete(body.id);emit();};label.append(input,document.createTextNode(body.name));list.append(label);}
 }
 function toggleHole(key){loadError='';if(holeMode==='all'){holeMode='selected';$('circular-hole-mode').value='selected';}selected.has(key)?selected.delete(key):selected.add(key);renderHoles();emit();}
 function renderHoles(){
  const list=$('circular-hole-list');if(!list)return;list.replaceChildren();
  for(const entry of catalog){const label=document.createElement('label'),input=document.createElement('input');label.className='circular-check';input.type='checkbox';input.checked=selected.has(entry.key);input.dataset.cavityKey=entry.key;input.setAttribute('aria-label',entry.label);input.onchange=()=>{loadError='';selected.has(entry.key)?selected.delete(entry.key):selected.add(entry.key);emit();};label.onpointerenter=()=>{hover=entry.key;signature='';};label.onpointerleave=()=>{hover=null;signature='';};const sizes=entry.bounds[0].map((v,i)=>(entry.bounds[1][i]-v).toFixed(1));label.append(input,document.createTextNode(entry.label+' ／ '+sizes.join(' × ')+' mm'));list.append(label);}
 }
 async function loadCatalog(sourceId){
  const original=getFeatures(),request=++ticket;catalogKey=sourceId;revision=original;loading=true;loadError='';catalog=[];selected.clear();clearGeometry();
  try{const result=await kernel.run(original,{type:'circularPatternInfo',target:sourceId});if(request!==ticket||!active()||getFeatures()!==original)return;catalog=result.cavities;selected=pendingKeys?new Set(pendingKeys):new Set(catalog.map(e=>e.key));if(pendingKeys&&[...pendingKeys].some(key=>!catalog.some(e=>e.key===key)))loadError='保存した穴の形状が変わりました。穴を選び直してください';pendingKeys=null;restoreTarget=null;for(const entry of catalog){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(entry.vertices,3));geometry.setIndex(entry.triangles);const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xf6af35,transparent:true,opacity:.35,depthTest:false,depthWrite:false,side:THREE.DoubleSide}));mesh.userData.cavityKey=entry.key;mesh.renderOrder=45;group.add(mesh);}renderHoles();}
  catch(error){if(request===ticket)loadError=error.message;}
  finally{if(request===ticket){loading=false;signature='';emit();}}
 }
 function spec(){
  const extra={},p=getSpec();if(suppressed.size)extra.suppressedInstances=[...suppressed].filter(i=>i<p.count).sort((a,b)=>a-b);
  if(cavityPattern(p)){
   if(loading||catalogKey!==p.target||revision!==getFeatures())throw Error('穴・くぼみの候補を確認しています');
   if(loadError)throw Error(loadError);
   if(holeMode==='selected'){if(!selected.size)throw Error('穴・くぼみを1個以上選択してください');extra.cavityKeys=catalog.filter(e=>selected.has(e.key)).map(e=>e.key);}
   if(targetMode==='selected'){if(!targets.size)throw Error('加工対象のボディを1個以上選択してください');extra.cutTargets=getBodies().filter(b=>targets.has(b.id)).map(b=>b.id);}
  }
  return extra;
 }
 function spacingSpec(){return {...getSpec(),...spec()};}
 function clearSpacing(){++spacingTicket;spacingKey='';delete host.dataset.circularPatternSpacing;for(const mesh of [...spacingGroup.children]){spacingGroup.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}}
 function invalidateSpacing(){let key;try{key=JSON.stringify(spacingSpec());}catch{key='';}if(key===spacingKey)return;clearSpacing();spacingKey=key;const status=$('circular-spacing-status');if(status){status.textContent='条件を設定して「穴間の肉厚を確認」を押してください';delete status.dataset.status;}}
 async function checkSpacing(){
  let p;try{p=spacingSpec();}catch(error){$('circular-spacing-status').textContent=error.message;return;}
  clearSpacing();spacingKey=JSON.stringify(p);const request=++spacingTicket,original=getFeatures(),status=$('circular-spacing-status');status.textContent='穴間の最短距離を測定しています…';status.dataset.status='pending';
  try{const result=await kernel.run(original,{...p,type:'circularPatternSpacing'});if(request!==spacingTicket||!active()||getFeatures()!==original)return;
   status.dataset.status=result.status;status.textContent=result.minimum===null?'比較できる穴が2個以上ありません':(result.status==='connected'?'注意：穴が接触・重複します。穴間の肉厚 0.00 mm':(result.status==='thin'?'薄肉に注意：':'')+'穴間の最小距離 '+result.minimum.toFixed(2)+' mm')+' ／ '+result.pair.map(e=>'位置'+(e.position+1)+'・'+e.label).join(' ↔ ');
   const axis=new THREE.Vector3(...(p.axisVector||{X:[1,0,0],Y:[0,1,0],Z:[0,0,1]}[p.axis]||[0,0,1])).normalize(),origin=new THREE.Vector3(...(p.origin||[0,0,0]));
   for(const item of result.pair){const entry=catalog.find(e=>e.key===item.key);if(!entry)continue;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(entry.vertices,3));geometry.setIndex(entry.triangles);const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:result.status==='connected'?0xf04438:0xf6af35,transparent:true,opacity:.35,depthTest:false,depthWrite:false,side:THREE.DoubleSide}));const matrix=new THREE.Matrix4().makeTranslation(...origin.toArray()).multiply(new THREE.Matrix4().makeRotationAxis(axis,p.angle*item.position/p.count*Math.PI/180)).multiply(new THREE.Matrix4().makeTranslation(...origin.clone().negate().toArray()));mesh.applyMatrix4(matrix);mesh.renderOrder=44;spacingGroup.add(mesh);}spacingGroup.visible=true;
   host.dataset.circularPatternSpacing=JSON.stringify(result);
  }catch(error){if(request===spacingTicket){status.textContent=error.message;status.dataset.status='error';}}
 }
 function restore(p){
  suppressed=new Set(p.suppressedInstances||[]);holeMode=p.cavityKeys?'selected':'all';pendingKeys=p.cavityKeys?new Set(p.cavityKeys):null;restoreTarget=p.target;targetMode=p.cutTargets?'selected':'all';targets=new Set(p.cutTargets||getBodies().map(b=>b.id));$('circular-hole-mode').value=holeMode;$('circular-target-mode').value=targetMode;renderTargets();positionSignature='';signature='';
 }
 function togglePosition(i){suppressed.has(i)?suppressed.delete(i):suppressed.add(i);positionSignature='';emit();}
 function renderPositions(p){
  const key=JSON.stringify([p.count,p.angle,[...suppressed]]);if(key===positionSignature)return;positionSignature=key;const list=$('circular-position-list');list.replaceChildren();overlay.replaceChildren();
  if(!Number.isInteger(p.count)||p.count<1||p.count>20||!Number.isFinite(p.angle))return;
  suppressed=new Set([...suppressed].filter(i=>i<p.count));
  for(let i=1;i<p.count;i++){
   const enabled=!suppressed.has(i),button=document.createElement('button');button.type='button';button.dataset.instance=String(i);button.setAttribute('aria-pressed',String(enabled));button.textContent='位置'+(i+1)+' ／ '+(p.angle*i/p.count).toFixed(1)+'° '+(enabled?'ON':'OFF');button.onclick=()=>togglePosition(i);list.append(button);
   const marker=document.createElement('button');marker.type='button';marker.dataset.instance=String(i);marker.setAttribute('aria-pressed',String(enabled));marker.setAttribute('aria-label','配置'+(i+1)+(enabled?'を除外':'を有効にする'));marker.title=button.textContent;marker.textContent=String(i+1)+(enabled?'':' ×');marker.onclick=e=>{e.stopPropagation();togglePosition(i);};marker.onpointerdown=e=>e.stopPropagation();overlay.append(marker);
  }
 }
 function update(){
  if(!active()||!panel?.isConnected){spacingGroup.visible=false;group.visible=false;overlay.hidden=true;host.classList.remove('circular-hole-picking');document.body.classList.remove('circular-hole-picking');delete host.dataset.circularPatternOptions;return;}
  host.classList.toggle('circular-hole-picking',picking);document.body.classList.toggle('circular-hole-picking',picking);let p;try{p=getSpec();}catch{spacingGroup.visible=false;group.visible=false;overlay.hidden=true;return;}
  const cavities=cavityPattern(p);spacingGroup.visible=cavities&&!picking&&spacingGroup.children.length>0;panel.querySelector('[data-circular-cavities]').hidden=!cavities;
  if(cavities&&(catalogKey!==p.target||revision!==getFeatures())){if(restoreTarget!==p.target){holeMode='all';pendingKeys=null;$('circular-hole-mode').value='all';}loadCatalog(p.target);}
  $('circular-hole-list').hidden=holeMode!=='selected';$('circular-target-list').hidden=targetMode!=='selected';$('circular-hybrid-note').hidden=p.operation!=='新規かつ切り取り';
  $('circular-check-spacing').disabled=loading||!catalog.length;invalidateSpacing();
  $('circular-pick-holes').disabled=loading||!catalog.length;$('circular-pick-holes').setAttribute('aria-pressed',String(picking));$('circular-pick-holes').textContent=picking?'選択中：穴・くぼみをクリック':'画面で穴・くぼみを選択';
  $('circular-hole-status').textContent=loading?'穴・くぼみを確認しています…':loadError||(!catalog.length?'穴・くぼみがありません':(holeMode==='all'?catalog.length:selected.size)+' / '+catalog.length+' 個を加工'+(picking?' ／ 橙：選択中、灰：除外':''));
  renderPositions(p);
  const sig=JSON.stringify([cavities,picking,hover,holeMode,[...selected]]);if(sig!==signature){signature=sig;group.visible=cavities&&(picking||!!hover);for(const mesh of group.children){const chosen=holeMode==='all'||selected.has(mesh.userData.cavityKey);mesh.visible=picking||mesh.userData.cavityKey===hover;mesh.material.color.set(chosen?0xf6af35:0x89949e);mesh.material.opacity=mesh.userData.cavityKey===hover ? .65 : .35;}}
  overlay.hidden=picking;const source=getSource(p.target);let anchor=source?new THREE.Box3().setFromObject(source).getCenter(new THREE.Vector3()):null;
  const origin=new THREE.Vector3(...(p.origin||[0,0,0])),axis=new THREE.Vector3(...(p.axisVector||{X:[1,0,0],Y:[0,1,0],Z:[0,0,1]}[p.axis]||[0,0,1])).normalize();
  const choices=cavities?catalog.filter(e=>holeMode==='all'||selected.has(e.key)):[];if(choices.length){const radial=e=>{const v=new THREE.Vector3(...e.point).sub(origin);return v.clone().addScaledVector(axis,-v.dot(axis)).lengthSq();};anchor=new THREE.Vector3(...choices.reduce((a,b)=>radial(a)>radial(b)?a:b).point);}
  for(const marker of overlay.children){if(!anchor){marker.hidden=true;continue;}const i=Number(marker.dataset.instance),point=anchor.clone().sub(origin).applyAxisAngle(axis,p.angle*i/p.count*Math.PI/180).add(origin).project(camera);marker.hidden=point.z< -1||point.z>1||Math.abs(point.x)>1||Math.abs(point.y)>1;marker.style.left=(point.x+1)*host.clientWidth/2+'px';marker.style.top=(1-point.y)*host.clientHeight/2+'px';}
  host.dataset.circularPatternOptions=JSON.stringify({ready:!loading&&!loadError,cavityCount:catalog.length,holeMode,selectedKeys:[...selected],targetMode,cutTargets:[...targets],suppressedInstances:[...suppressed],picking});
 }
 fields.addEventListener('input',e=>{if(active()&&!panel?.contains(e.target)){signature='';update();}});fields.addEventListener('change',()=>{if(active()){signature='';update();}});
 dialog.addEventListener('close',()=>{clearSpacing();pendingKeys=null;restoreTarget=null;++ticket;loading=false;picking=false;group.visible=false;overlay.hidden=true;host.classList.remove('circular-hole-picking');document.body.classList.remove('circular-hole-picking');delete host.dataset.circularPatternOptions;});
 return {render,spec,restore,update,pick(e){if(!active()||!picking||!cavityPattern(getSpec()))return false;const box=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-box.left)/box.width*2-1,1-(e.clientY-box.top)/box.height*2),camera);const hit=ray.intersectObjects(group.children,false)[0];if(hit)toggleHole(hit.object.userData.cavityKey);return true;}};
}
