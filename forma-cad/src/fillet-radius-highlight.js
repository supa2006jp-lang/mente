import * as THREE from 'three';

export function createFilletRadiusHighlight({scene,host,meshes}){
 let group=null;
 function clear(){group?.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});group?.removeFromParent();group=null;delete host.dataset.filletRadiusLimit;}
 function show(limiting){
  clear();const diagnostics=limiting?.diagnostics;if(!diagnostics)return;
  const exact=diagnostics.certainty==='faulty-contour',color=exact?0xef4438:0xe7a43b,ids=(diagnostics.bodyIds||[]).filter(id=>meshes.get(id)?.visible);if(!ids.length)return;
  group=new THREE.Group();
  for(const edge of diagnostics.edges||[]){
   if(edge.bodyId&&!ids.includes(edge.bodyId))continue;
   const points=(edge.points||[]).filter(p=>p.length===3&&p.every(Number.isFinite)).map(p=>new THREE.Vector3(...p));if(points.length<2)continue;
   const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,depthTest:false,depthWrite:false}));line.renderOrder=45;group.add(line);
  }
  for(const id of ids){const helper=new THREE.Box3Helper(new THREE.Box3().setFromObject(meshes.get(id)),color);helper.material.depthTest=false;helper.material.depthWrite=false;helper.renderOrder=44;group.add(helper);}
  scene.add(group);host.dataset.filletRadiusLimit=JSON.stringify({radius:limiting.radius,bodyIds:ids,certainty:diagnostics.certainty,edges:group.children.filter(o=>o.type==='Line').length});
 }
 return {show,clear};
}
