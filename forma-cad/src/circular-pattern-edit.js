import * as THREE from 'three';
// Keep the current project intact while showing the input of an old operation.
// Closing or a failed replay restores visibility; only Apply changes history.
export function circularPatternEditView({scene,generated,objects}){
 const group=new THREE.Group(),bodies=new Map(),saved=[];
 try{
  for(const [id,body]of generated){const mesh=new THREE.Mesh(body.geometry,new THREE.MeshStandardMaterial({color:0xa3a197,roughness:.8}));mesh.userData.bodyId=id;group.add(mesh);bodies.set(id,mesh);}
  for(const object of objects.filter(Boolean)){saved.push([object,object.visible]);object.visible=false;}
  scene.add(group);
 }catch(error){for(const body of generated.values())body.geometry.dispose();group.traverse(o=>o.material?.dispose());throw error;}
 let closed=false;
 return {bodies,group,close(){if(closed)return;closed=true;scene.remove(group);group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});for(const [object,visible]of saved)object.visible=visible;}};
}
