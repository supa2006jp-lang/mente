// Face grids and selection colours live outside the body meshes. Follow the
// same section plane, including overlays rebuilt while the section is open.
export function sectionOverlayClipping(){
 const saved=new Map();
 const restore=material=>{material.clippingPlanes=saved.get(material).original;material.needsUpdate=true;saved.delete(material);};
 return (objects,plane)=>{
  const current=new Set();
  if(plane)for(const object of objects)object?.traverse(node=>{
   for(const material of node.material?(Array.isArray(node.material)?node.material:[node.material]):[]){
    current.add(material);let entry=saved.get(material);
    if(!entry){entry={original:material.clippingPlanes,plane,applied:[...(material.clippingPlanes||[]),plane]};saved.set(material,entry);}
    if(entry.plane!==plane){entry.plane=plane;entry.applied=[...(entry.original||[]),plane];}
    if(material.clippingPlanes!==entry.applied){material.clippingPlanes=entry.applied;material.needsUpdate=true;}
   }
  });
  for(const material of saved.keys())if(!current.has(material))restore(material);
 };
}
