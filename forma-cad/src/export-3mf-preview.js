import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {fitSelectionBox} from './selection-view.js';

export function createExport3mfPreview(viewport){
 const scene=new THREE.Scene(),objects=new THREE.Group(),bounds=new THREE.Box3(),target=new THREE.Vector3();
 const camera=new THREE.OrthographicCamera(-100,100,100,-100,.1,100000);
 camera.up.set(0,0,1);
 scene.background=new THREE.Color(0xeef4f8);
 scene.add(objects,new THREE.HemisphereLight(0xffffff,0x718ba1,2.3));
 const light=new THREE.DirectionalLight(0xffffff,1.8);
 light.position.set(-2,-3,5);scene.add(light);
 let renderer,controls,grid,frame=0,focusId=null,viewDirection=new THREE.Vector3(1,-1,.85);
 const ids=new Set();

 function draw(){
  frame=0;
  if(ids.size&&viewport.clientWidth&&viewport.clientHeight)renderer.render(scene,camera);
 }
 function schedule(){if(!frame&&ids.size)frame=requestAnimationFrame(draw);}
 function fit(){
  const width=viewport.clientWidth,height=viewport.clientHeight;
  if(!ids.size||!width||!height)return;
  renderer.setSize(width,height,false);
  camera.left=-100*width/height;camera.right=-camera.left;
  camera.far=Math.max(2000,bounds.getSize(target).length()*6);
  bounds.getCenter(target);
  camera.position.copy(target).add(viewDirection);
  camera.lookAt(target);
  controls.target.copy(fitSelectionBox(camera,bounds,width,height));
  controls.update();schedule();
 }
 function init(){
  if(renderer)return;
  renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.domElement.setAttribute('aria-label','3MFに含まれる形状の3Dプレビュー');
  viewport.append(renderer.domElement);
  controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=false;controls.minZoom=.002;controls.maxZoom=10000;
  controls.zoomToCursor=true;
  controls.addEventListener('change',schedule);
  renderer.domElement.addEventListener('webglcontextrestored',schedule);
  new ResizeObserver(fit).observe(viewport);
 }
 function clear(){
  cancelAnimationFrame(frame);frame=0;
  ids.clear();bounds.makeEmpty();focusId=null;
  delete viewport.dataset.selectedPart;
  for(const mesh of [...objects.children]){
   mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();
  }
  if(grid){grid.removeFromParent();grid.geometry.dispose();grid.material.dispose();grid=null;}
  renderer?.clear();
 }
 function focus(id){
  focusId=id;
  for(const mesh of objects.children){
   const selected=mesh.userData.id===id,overlay=mesh.userData.overlay;
   mesh.visible=!overlay||selected;
   const opacity=overlay ? .27 : (id!==null&&!selected ? .2 : 1);
   const material=mesh.material;
   const transparent=opacity<1;
   if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}
   material.opacity=opacity;material.depthWrite=!transparent;
   material.emissive.setHex(selected&&!overlay?0x24415a:0x000000);
   mesh.renderOrder=overlay?2:0;
  }
  if(id===null)delete viewport.dataset.selectedPart;
  else viewport.dataset.selectedPart=String(id);
  schedule();
 }
 function view(top=false){viewDirection.set(top?0:1,top?-.0001:-1,top?1:.85);fit();}
 function show(parts,plateSize){
  clear();
  try{
   init();
   for(const {id,vertices,triangles,color,overlay=false} of parts){
    if(!vertices?.length||!triangles?.length)continue;
    const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)).setIndex(triangles);
    geometry.computeVertexNormals();geometry.computeBoundingBox();
    const material=new THREE.MeshStandardMaterial({color,roughness:.77,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(geometry,material);mesh.userData={id,overlay};objects.add(mesh);
    if(!overlay)bounds.union(geometry.boundingBox);
    ids.add(id);
   }
   if(bounds.isEmpty())throw Error('出力する形状がありません');
   const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
   const span=Math.max(size.x,size.y,size.z,1);
   const step=10**Math.floor(Math.log10(span/6));
   const gridSize=plateSize||step*Math.ceil(span*1.3/step);
   grid=new THREE.GridHelper(gridSize,plateSize?18:Math.round(gridSize/step),0x839aaa,0xbbcdd8);
   grid.rotation.x=Math.PI/2;
   grid.position.set(plateSize?plateSize/2:Math.round(center.x/step)*step,plateSize?plateSize/2:Math.round(center.y/step)*step,0);
   scene.add(grid);
   bounds.expandByPoint(new THREE.Vector3(center.x,center.y,0));
   if(plateSize){
    bounds.expandByPoint(new THREE.Vector3(0,0,0));bounds.expandByPoint(new THREE.Vector3(plateSize,plateSize,0));
   }
   focus(null);view();return true;
  }catch{
   clear();return false;
  }
 }
 return {show,clear,focus,view,has:id=>ids.has(id),get focused(){return focusId;}};
}
