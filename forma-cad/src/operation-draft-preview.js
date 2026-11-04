import * as THREE from 'three';
export function createOperationDraftPreview({scene,meshes,host}){
 let group=null;
 function clear(){if(group){group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});group.removeFromParent();group=null;}delete host.dataset.machiningPreviewPhase;}
 function show(spec){clear();const ids=[...new Set([spec.target,...(spec.targets||[]),spec.other,...(spec.others||[])].filter(Boolean))];group=new THREE.Group();for(const id of ids){const mesh=meshes.get(id);if(!mesh)continue;const box=new THREE.Box3().setFromObject(mesh);if(!box.isEmpty())group.add(new THREE.Box3Helper(box,0x18a9ca));}scene.add(group);host.dataset.machiningPreviewPhase='draft';}
 return {show,clear};
}
