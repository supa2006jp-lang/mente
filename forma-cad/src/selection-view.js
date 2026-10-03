import * as THREE from 'three';
export function zoomAtPointer(camera,target,rect,x,y,zoom){
 const ndc=new THREE.Vector3((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2,0),before=ndc.clone().unproject(camera);
 camera.zoom=zoom;camera.updateProjectionMatrix();const delta=before.sub(ndc.unproject(camera));camera.position.add(delta);target.add(delta);camera.updateMatrixWorld(true);
}
export function fitSelectionBox(camera,box,width,height){
 if(box.isEmpty())return null;const center=box.getCenter(new THREE.Vector3()),inverse=camera.quaternion.clone().invert(),point=new THREE.Vector3();let left=Infinity,right=-Infinity,bottom=Infinity,top=-Infinity;
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){point.set(x,y,z).sub(center).applyQuaternion(inverse);left=Math.min(left,point.x);right=Math.max(right,point.x);bottom=Math.min(bottom,point.y);top=Math.max(top,point.y);}
 camera.zoom=THREE.MathUtils.clamp(200/(Math.max(top-bottom,(right-left)/(width/height),1)*1.25),.002,10000);
 const direction=camera.position.clone().sub(center);camera.getWorldDirection(direction).negate();camera.position.copy(center).addScaledVector(direction,Math.max(180,box.getSize(new THREE.Vector3()).length()*2));camera.updateProjectionMatrix();camera.updateMatrixWorld(true);return center;
}
