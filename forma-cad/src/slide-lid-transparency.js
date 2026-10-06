const saved=new WeakMap();
export function setSlideLidTransparency(mesh,enabled){
 if(!mesh||mesh.userData.slideLidTransparent===enabled)return;const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
 for(const material of materials){if(!saved.has(material))saved.set(material,{transparent:material.transparent,opacity:material.opacity,depthWrite:material.depthWrite});Object.assign(material,enabled?{transparent:true,opacity:.24,depthWrite:false}:saved.get(material));material.needsUpdate=true;}
 mesh.userData.slideLidTransparent=enabled;mesh.renderOrder=enabled?2:0;
}
export function slideLidBodyIds(features){const ids=new Set();for(const f of features){if(f.kind==='cadop'&&f.spec?.type==='slideLid')ids.add(f.spec.id+'-lid');for(const id of f.remove||f.cadResult?.remove||[])ids.delete(id);}return ids;}
