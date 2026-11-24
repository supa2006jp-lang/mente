// Bundle this manual browser regression page; it uses the production move tool.
import * as THREE from 'three';
import {createMoveTool} from '../src/move-tool.js';
import {solidReferencePoints} from '../src/reference-points.js';
const host=document.querySelector('#canvas-host'),canvas=document.querySelector('canvas'),results=document.querySelector('#results');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setSize(720,500);renderer.setClearColor(0xf6f9fc);
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-60,60,42,-42,.1,500);camera.position.set(70,-100,100);camera.up.set(0,0,1);camera.lookAt(0,0,6);camera.updateMatrixWorld(true);
const meshes=[];
for(const x of [-20,20]){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(20,16,12),new THREE.MeshBasicMaterial({color:0x888880}));mesh.position.set(x,0,6);mesh.userData.bodyId='body-'+x;
 const edges=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial({color:0x444444}));mesh.add(edges);mesh.userData.references=solidReferencePoints(mesh.geometry,edges.geometry);meshes.push(mesh);scene.add(mesh);
}
const controls={enabled:true},applied=[];let selectedIds=meshes.map(mesh=>mesh.userData.bodyId),snapGrid={enabled:false,step:10,plane:'XY'};
const tool=createMoveTool({scene,camera,canvas,host,getMeshes:()=>meshes,getSelection:()=>selectedIds,getGridPlane:()=>({normal:{XY:[0,0,1],XZ:[0,1,0],YZ:[1,0,0]}[snapGrid.plane],offset:0}),getGridSnap:()=>snapGrid,getControls:()=>controls,onStart(){},onApply:async spec=>applied.push(spec)});
function assert(value,message){if(!value)throw Error(message);results.textContent+='✓ '+message+'\n';}
const position=()=>JSON.parse(host.dataset.movePreview).position;
const closeTo=(a,b)=>Math.abs(a-b)<1e-6;
function pointer(type,x,y){const rect=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:rect.left+x,clientY:rect.top+y,button:0,pointerId:1}));}
function screen(world){const rect=canvas.getBoundingClientRect(),p=new THREE.Vector3(...world).project(camera);return [(p.x+1)*rect.width/2,(1-p.y)*rect.height/2];}
function groupGrip(){const [x,y,z]=position();return [x-23,y+2,z+6];}
function moveGrip(delta){const grip=groupGrip(),destination=screen(grip.map((v,i)=>v+delta[i]));pointer('pointermove',...screen(grip));pointer('pointermove',...destination);return destination;}
function set(id,value){const input=document.getElementById(id);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}
function chooseDirection(value){const input=document.querySelector('#move-direction');input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}));}
function start(ids=meshes.map(mesh=>mesh.userData.bodyId)){selectedIds=ids;tool.cancel();tool.start();for(const input of document.querySelectorAll('#move-point-filters input'))input.checked=true;}
document.querySelector('#run-free').onclick=()=>{
 results.textContent='';try{
 for(const [plane,normalIndex]of [['XY',2],['XZ',1],['YZ',0]]){
  snapGrid.plane=plane;start();chooseDirection('free');document.querySelector('#move-free-snap').checked=false;set('move-'+['x','y','z'][normalIndex],'7');const before=position();document.querySelector('#move-free').click();
  const delta=[5,7,4];delta[normalIndex]=0;const destination=moveGrip(delta),after=position();
  assert(after.every((v,i)=>closeTo(v,before[i]+delta[i])),plane+' free movement keeps the grabbed surface point under the cursor in an oblique view');
  assert(document.querySelector('#move-hint').textContent.includes(plane+'基準平面'),'the active reference plane is named in the hint');
  pointer('pointerdown',...destination);assert(position().every((v,i)=>closeTo(v,after[i])),'click keeps the reference-plane position');
 }
 snapGrid.plane='XY';
 start();set('move-x','5');const before=position();document.querySelector('#move-free').click();
 pointer('pointermove',25,440);pointer('pointermove',75,440);pointer('pointerdown',75,440);
 assert(position().every((v,i)=>closeTo(v,before[i]))&&!!host.dataset.moveFree,'blank canvas cannot start or finish the movement');
 pointer('pointermove',...screen(groupGrip()));assert(position().every((v,i)=>closeTo(v,before[i])),'touching the surface preserves the starting pose');
 moveGrip([5,4,0]);assert(position().every((v,i)=>closeTo(v,before[i]+[5,4,0][i])),'the selected surface point follows the cursor');assert(JSON.parse(host.dataset.movePreview).targets.length===2,'all selected bodies move together');
 window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(tool.active&&!host.dataset.moveFree,'Escape ends only free movement');assert(position().every((v,i)=>closeTo(v,before[i])),'Escape restores the exact starting pose');assert(document.querySelector('#move-x').value==='5','previous numerical movement is retained');
 for(const [direction,allowed]of [['X',[0]],['Y',[1]],['Z',[2]],['XY',[0,1]]]){
  snapGrid.plane=direction==='Z'?'XZ':'XY';
  chooseDirection(direction);document.querySelector('#move-free').click();const base=position(),destination=moveGrip(direction==='Z'?[4,0,6]:[4,6,0]),after=position();
  assert(after.some((v,i)=>allowed.includes(i)&&!closeTo(v,base[i]))&&after.every((v,i)=>allowed.includes(i)||closeTo(v,base[i])),direction+' constraint preserves the other coordinates');
  pointer('pointerdown',...destination);assert(tool.active&&!host.dataset.moveFree,'click fixes '+direction+' movement without applying');pointer('pointermove',450,300);assert(position().every((v,i)=>closeTo(v,after[i])),'cursor stops following after click');
 }
 document.querySelector('#move-free').click();moveGrip([4,0,5]);document.querySelector('[data-mode=rotate]').click();assert(!host.dataset.moveFree&&tool.active,'switching to rotation exits free movement');
 document.querySelector('#move-free').click();set('move-y','7');assert(!host.dataset.moveFree&&document.querySelector('#move-y').value==='7','numerical editing ends cursor following');
 tool.cancel();assert(!scene.children.some(o=>o.name==='move-destination-ghost')&&controls.enabled,'cancel cleans preview and restores controls');results.textContent+='PASS free movement lifecycle\n';
 }catch(error){results.textContent+='FAIL '+error.stack;}
};
document.querySelector('#run-ghost').onclick=async()=>{
 results.textContent='';try{
 start();chooseDirection('X');const method=document.querySelector('#move-method');method.value='copy';method.dispatchEvent(new Event('change'));const reverse=document.querySelector('#move-reverse-copy');reverse.checked=true;reverse.dispatchEvent(new Event('change'));
 document.querySelector('#move-point-to-point').click();const source=document.querySelector('#move-point-candidates [data-point="[-20,-8,12]"]');assert(!!source,'source point is offered');source.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
 const target=document.querySelector('#move-point-candidates [data-point="[30,-8,0]"]');assert(!!target,'destination point is offered');target.dispatchEvent(new Event('focus'));const before=position();
 assert(!!host.dataset.moveGhost,'hover shows a destination ghost');assert(JSON.parse(host.dataset.moveGhost).delta.join(',')==='50,0,0','ghost obeys the X constraint');
 const ghost=scene.children.find(o=>o.name==='move-destination-ghost');let count=0;ghost.traverse(o=>{if(o.isMesh){count++;assert(o.material.transparent&&!o.material.depthWrite,'ghost material is translucent without depth writes');}});assert(count===2,'ghost includes both selected bodies');assert(position().every((v,i)=>closeTo(v,before[i])),'hover does not move the actual preview');
 const ghostMatrix=ghost.matrix.clone(),childMatrix=ghost.children[0].matrix.clone();target.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));assert(!host.dataset.moveGhost&&!ghost.parent,'selecting the destination removes the ghost');
 const preview=scene.children.find(o=>o.isGroup&&o!==ghost&&o.children.length===1&&o.children[0].children.some(child=>child.userData.bodyId));assert(preview.matrixWorld.equals(ghostMatrix)&&preview.children[0].matrix.equals(childMatrix),'committed preview matches the mirrored grouped ghost');
 document.querySelector('#move-panel').requestSubmit();await Promise.resolve();await Promise.resolve();assert(applied.at(-1).targets.length===2&&applied.at(-1).copy&&applied.at(-1).reverseCopy&&applied.at(-1).x===50,'apply retains grouped copy, reflection and constrained translation');assert(!tool.active,'apply closes the move tool');results.textContent+='PASS grouped ghost / copy / apply\n';
 }catch(error){results.textContent+='FAIL '+error.stack;}
};
renderer.setAnimationLoop(()=>renderer.render(scene,camera));
let snapPointer;
function snapScene(){
 tool.cancel();snapGrid={enabled:false,step:10,plane:'XY'};meshes[1].visible=true;meshes[1].position.z=6;camera.position.set(0,0,100);camera.up.set(0,1,0);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 start([meshes[0].userData.bodyId]);chooseDirection('X');for(const input of document.querySelectorAll('#move-point-filters input'))input.checked=true;
 document.querySelector('#move-free-snap').checked=true;document.querySelector('#move-free').click();const [x,y]=screen([-20,0,12]);pointer('pointermove',x,y);snapPointer=[x+117,y];pointer('pointermove',...snapPointer);
}
document.querySelector('#run-snap').onclick=async()=>{
 results.textContent='';const savedCamera={position:camera.position.clone(),quaternion:camera.quaternion.clone(),up:camera.up.clone()};
 try{
 snapScene();assert(closeTo(Number(document.querySelector('#move-x').value),20),'a moving source point snaps exactly to the target body');assert(JSON.parse(host.dataset.moveFreeSnap).type==='point','point snap shows a green marker');
 window.dispatchEvent(new KeyboardEvent('keydown',{key:'Alt',altKey:true,bubbles:true}));assert(closeTo(Number(document.querySelector('#move-x').value),19.5)&&!host.dataset.moveFreeSnap,'Alt immediately restores raw cursor movement without a mouse event');
 window.dispatchEvent(new KeyboardEvent('keyup',{key:'Alt',bubbles:true}));assert(closeTo(Number(document.querySelector('#move-x').value),20)&&host.dataset.moveFreeSnap,'releasing Alt immediately restores attraction');
 for(const input of document.querySelectorAll('#move-point-filters input'))input.checked=false;document.querySelector('#move-point-filters').dispatchEvent(new Event('change',{bubbles:true}));assert(!host.dataset.moveFreeSnap&&closeTo(Number(document.querySelector('#move-x').value),19.5),'disabled point categories are not magnetic');
 const vertices=document.querySelector('[data-point-kind=vertex]');vertices.checked=true;vertices.dispatchEvent(new Event('change',{bubbles:true}));assert(JSON.parse(host.dataset.moveFreeSnap).target==='頂点','vertex-only filter changes the actual snap targets');
 meshes[1].position.z=16;pointer('pointermove',...snapPointer);assert(!host.dataset.moveFreeSnap,'matching screen coordinates cannot violate depth and X-only constraints');meshes[1].position.z=6;
 const enabled=document.querySelector('#move-free-snap');enabled.checked=false;enabled.dispatchEvent(new Event('change',{bubbles:true}));assert(!host.dataset.moveFreeSnap,'snap checkbox immediately releases attraction');enabled.checked=true;enabled.dispatchEvent(new Event('change',{bubbles:true}));assert(!!host.dataset.moveFreeSnap,'snap checkbox restores attraction');
 window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(tool.active&&!host.dataset.moveFreeSnap&&closeTo(Number(document.querySelector('#move-x').value),0),'Escape clears markers and restores the starting pose');
 meshes[1].visible=false;snapGrid.enabled=true;document.querySelector('#move-free').click();const [x,y]=screen([-20,0,12]);pointer('pointermove',x,y);pointer('pointermove',x+57.6,y);assert(closeTo(Number(document.querySelector('#move-x').value),10)&&JSON.parse(host.dataset.moveFreeSnap).type==='grid','free movement snaps its grab reference to the grid');assert(closeTo(Number(document.querySelector('#move-z').value),0),'grid snap preserves height');
 pointer('pointerdown',x+57.6,y);assert(!host.dataset.moveFree&&!host.dataset.moveFreeSnap&&closeTo(Number(document.querySelector('#move-x').value),10),'click retains snapped position and clears the overlay');
 document.querySelector('#move-panel').requestSubmit();await Promise.resolve();await Promise.resolve();assert(applied.at(-1).x===10&&applied.at(-1).target===meshes[0].userData.bodyId,'applied move uses the snapped coordinates');results.textContent+='PASS free point/grid attraction, filters, Alt, constraints, cancel, click and apply\n';
 }catch(error){results.textContent+='FAIL '+error.stack;}
 finally{tool.cancel();meshes[1].visible=true;meshes[1].position.z=6;snapGrid.enabled=false;camera.position.copy(savedCamera.position);camera.quaternion.copy(savedCamera.quaternion);camera.up.copy(savedCamera.up);camera.updateMatrixWorld(true);}
};
document.querySelector('#show-snap').onclick=()=>{results.textContent='移動中のボディのポイントが、右のボディのポイントに吸着。緑のマーカーを表示。Altで一時解除。';snapScene();};
