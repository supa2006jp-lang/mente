import * as THREE from 'three';
const palette=[0x65a9d8,0xe0b35e,0x75bc98,0xaf91d4,0x63c1c7,0xd392b0,0xadb969,0x8fabc6];
export function sectionBodyColor(index){return index<palette.length?palette[index]:new THREE.Color().setHSL((index*.61803398875)%1,.45,.63).getHex();}

// Use temporary materials so shared materials, QR colours and saved appearance
// remain intact. Restore the exact originals when inspection ends.
export function sectionBodyColors(){
 const saved=new Map();
 function restore(object){const entry=saved.get(object);object.material=entry.original;entry.materials.forEach(material=>material.dispose());saved.delete(object);}
 return (meshes,enabled)=>{
  const colors=new Map([...meshes.keys()].map((id,index)=>[id,sectionBodyColor(index)])),current=new Set();
  function apply(object,id){
   if(!object.isMesh||!object.material||!colors.has(id))return;
   current.add(object);let entry=saved.get(object);
   if(!entry){const original=object.material,materials=(Array.isArray(original)?original:[original]).map(material=>material.clone());entry={original,materials};saved.set(object,entry);object.material=Array.isArray(original)?materials:materials[0];}
   for(const material of entry.materials){material.color?.setHex(colors.get(id));if(material.vertexColors){material.vertexColors=false;material.needsUpdate=true;}}
  }
  if(enabled){
   for(const [id,mesh] of meshes)if(mesh.visible)mesh.traverse(object=>apply(object,id));
  }
  for(const object of saved.keys())if(!current.has(object))restore(object);
  return colors;
 };
}

export function sectionSelectionVisibility(){
 const saved=new Map();
 return (overlays,hidden)=>{
  const current=new Set();
  if(hidden)for(const overlay of overlays)overlay?.traverse(object=>{
   if(!object.isMesh||object.userData.planeId)return;
   for(const material of object.material?(Array.isArray(object.material)?object.material:[object.material]):[]){if(!saved.has(material))saved.set(material,material.visible);current.add(material);material.visible=false;}
  });
  for(const [material,visible] of saved)if(!current.has(material)){material.visible=visible;saved.delete(material);}
 };
}
