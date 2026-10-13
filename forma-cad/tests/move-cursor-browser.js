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
const controls={enabled:true},applied=[];let tool;
// Match the app's earlier global Escape handler: a submode handles it first.
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&tool?.cancelFreeMove()){event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
tool=createMoveTool({scene,camera,canvas,host,getMeshes:()=>meshes,getSelection:()=>meshes.map(m=>m.userData.bodyId),getControls:()=>controls,onStart(){},onApply:async spec=>applied.push(spec)});
function assert(value,message){if(!value)throw Error(message);results.textContent+='✓ '+message+'\n';}
const position=()=>JSON.parse(host.dataset.movePreview).position;
const closeTo=(a,b)=>Math.abs(a-b)<1e-6;
function pointer(type,x,y){const rect=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:rect.left+x,clientY:rect.top+y,button:0,pointerId:1}));}
function set(id,value){const input=document.getElementById(id);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}
function chooseDirection(value){const input=document.querySelector('#move-direction');input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}));}
function start(){tool.cancel();tool.start();}
document.querySelector('#run-free').onclick=()=>{
 results.textContent='';try{
 start();set('move-x','5');const before=position();document.querySelector('#move-free').click();pointer('pointermove',300,220);assert(position().every((v,i)=>closeTo(v,before[i])),'first cursor event preserves the starting pose');
 pointer('pointermove',380,260);assert(position().some((v,i)=>!closeTo(v,before[i])),'free movement follows the cursor');assert(JSON.parse(host.dataset.movePreview).targets.length===2,'all selected bodies move together');
 window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(tool.active&&!host.dataset.moveFree,'Escape ends only free movement');assert(position().every((v,i)=>closeTo(v,before[i])),'Escape restores the exact starting pose');assert(document.querySelector('#move-x').value==='5','previous numerical movement is retained');
 for(const [direction,allowed]of [['X',[0]],['Y',[1]],['Z',[2]],['XY',[0,1]]]){
  chooseDirection(direction);document.querySelector('#move-free').click();const base=position();pointer('pointermove',300,220);pointer('pointermove',380,260);const after=position();
  assert(after.some((v,i)=>allowed.includes(i)&&!closeTo(v,base[i]))&&after.every((v,i)=>allowed.includes(i)||closeTo(v,base[i])),direction+' constraint preserves the other coordinates');
  pointer('pointerdown',380,260);assert(tool.active&&!host.dataset.moveFree,'click fixes '+direction+' movement without applying');pointer('pointermove',450,300);assert(position().every((v,i)=>closeTo(v,after[i])),'cursor stops following after click');
 }
 document.querySelector('#move-free').click();pointer('pointermove',300,220);pointer('pointermove',330,240);document.querySelector('[data-mode=rotate]').click();assert(!host.dataset.moveFree&&tool.active,'switching to rotation exits free movement');
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
