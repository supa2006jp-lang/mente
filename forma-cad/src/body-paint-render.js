import * as THREE from 'three';
import {bodyPaint} from './body-face-paint.js';

const passes=new WeakMap();

export function syncBodyPaintRender(mesh){
 const paint=bodyPaint(mesh.geometry);
 const mixed=paint?.transparent&&paint.hasOpaqueFaces;
 let pass=passes.get(mesh);
 if(!mixed){if(pass)pass.visible=false;return;}
 if(!pass){
  pass=new THREE.Mesh(mesh.geometry,new THREE.MeshStandardMaterial());
  pass.userData.sharedGeometry=true;
  pass.raycast=()=>{};
  // Tool previews clone the body with their own appearance.
  pass.clone=()=>new THREE.Object3D();
  const enabled=()=>pass.visible&&pass.material.visible&&mesh.material.visible&&mesh.material.transparent&&
   mesh.material.opacity===1&&mesh.material.depthTest;
  pass.onBeforeRender=()=>{
   const source=mesh.material,material=pass.material;
   const active=enabled();
   material.depthWrite=active;
   material.colorWrite=active&&source.colorWrite;
   if(material.side!==source.side){material.side=source.side;material.needsUpdate=true;}
   material.clippingPlanes=source.clippingPlanes;
   material.clipIntersection=source.clipIntersection;
  };
  let previousDepthFunc;
  mesh.onBeforeRender=(_renderer,_scene,_camera,_geometry,material)=>{
   previousDepthFunc=material.depthFunc;
   // The opaque pass has already shaded these same fragments. Strict depth
   // testing skips them here while still allowing closer translucent faces.
   if(enabled())material.depthFunc=THREE.LessDepth;
  };
  mesh.onAfterRender=(_renderer,_scene,_camera,_geometry,material)=>{material.depthFunc=previousDepthFunc;};
  mesh.add(pass);passes.set(mesh,pass);
 }
 pass.visible=true;
 const material=pass.material;
 material.copy(mesh.material);
 material.setValues({opacity:1,transparent:false,alphaTest:.999,depthWrite:true,depthFunc:THREE.LessEqualDepth});
 material.needsUpdate=true;
 return material;
}
