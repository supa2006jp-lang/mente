import * as THREE from 'three';
import {makeSketchGeometry} from './geometry.js';
import {basisFor} from './frames.js';
import {sketchLine} from './sketch-line.js';
import {captureProjectPreview} from './project-preview.js';

// Render only the saved selection, independent of the main camera, clipping,
// selection highlights, hidden-body display and in-progress tool previews.
export function captureSelectionThumbnail({renderer,data,meshes=[],features}){
 const clipping=renderer.clippingPlanes,localClipping=renderer.localClippingEnabled;renderer.clippingPlanes=[];renderer.localClippingEnabled=false;
 const temporary=[],sketches=[],parts=[],camera=new THREE.OrthographicCamera(-100,100,100,-100,.01,10000);
 camera.position.set(1,-1.3,1);camera.up.set(0,0,1);
 if(!data.solids.length&&data.sketches.length){const b=basisFor(data.sketches[0]);if(data.sketches.every(f=>Math.abs(basisFor(f).n.dot(b.n))>.9999)){camera.position.copy(b.n);camera.up.copy(b.v);}}
 camera.lookAt(new THREE.Vector3());camera.updateMatrixWorld(true);
 try{
  for(const f of data.sketches){const geometry=makeSketchGeometry(f);let object;if(f.profile==='point'){object=new THREE.Points(geometry,new THREE.PointsMaterial({color:0x245d99,size:7,sizeAttenuation:false}));sketches.push(object);}else{object=sketchLine(geometry,{color:0x245d99});sketches.push(object.children.at(-1));}temporary.push(object);}
  if(features)for(const f of features)for(const output of f.outputs||[]){const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(output.vertices,3));geometry.setIndex(output.triangles);geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry,25),new THREE.LineBasicMaterial()));temporary.push(mesh);parts.push(mesh);}
  return captureProjectPreview({renderer,camera,meshes:features?parts:meshes,sketches,width:320,height:240});
 }finally{renderer.clippingPlanes=clipping;renderer.localClippingEnabled=localClipping;for(const object of temporary)object.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
}
