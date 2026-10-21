import * as THREE from 'three';

// Reflect existing display meshes immediately; boolean work starts only on apply.
export function createSolidMirrorPreview({scene,meshes,host}){
 let group=null;
 function clear(){
  if(group){scene.remove(group);group.traverse(object=>object.material?.dispose());group=null;}
  delete host.dataset.solidMirrorPreview;delete host.dataset.solidMirrorPlane;
 }
 function show(ids,spec){
  clear();const n=new THREE.Vector3(...spec.mirrorNormal).normalize(),origin=new THREE.Vector3(...spec.mirrorOrigin).addScaledVector(n,spec.offset||0),d=origin.dot(n);
  const {x,y,z}=n,reflection=new THREE.Matrix4().set(1-2*x*x,-2*x*y,-2*x*z,2*d*x,-2*y*x,1-2*y*y,-2*y*z,2*d*y,-2*z*x,-2*z*y,1-2*z*z,2*d*z,0,0,0,1);
  if(!reflection.elements.every(Number.isFinite))throw Error('ミラーの基準面を選択してください');
  group=new THREE.Group();
  for(const id of ids){const source=meshes.get(id);if(!source)continue;source.updateWorldMatrix(true,false);
   const preview=new THREE.Mesh(source.geometry,new THREE.MeshBasicMaterial({color:0x18a9ca,transparent:true,opacity:.3,depthTest:false,depthWrite:false,side:THREE.DoubleSide}));
   preview.matrixAutoUpdate=false;preview.matrix.multiplyMatrices(reflection,source.matrixWorld);preview.renderOrder=30;
   const edges=source.children.find(child=>child.isLineSegments);if(edges){const outline=new THREE.LineSegments(edges.geometry,new THREE.LineBasicMaterial({color:0x087f9c,transparent:true,opacity:.9,depthTest:false,depthWrite:false}));outline.renderOrder=31;outline.matrixAutoUpdate=false;outline.matrix.copy(edges.matrix);preview.add(outline);}
   group.add(preview);
  }
  scene.add(group);host.dataset.solidMirrorPreview=String(group.children.length);host.dataset.solidMirrorPlane=JSON.stringify({normal:n.toArray(),origin:origin.toArray(),bodyIds:[...ids]});
 }
 function setSnapped(snapped){group?.traverse(object=>{if(object.material?.color)object.material.color.setHex(snapped?(object.isMesh?0x28bd83:0x08754c):(object.isMesh?0x18a9ca:0x087f9c));});}
 return {show,clear,setSnapped};
}
