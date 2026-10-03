import * as THREE from 'three';

// An orthographic view can include points behind its current camera position.
// Use the full line/plane intersection when determining the visible grid extent.
export function planeViewBounds(camera,basis,offset,target){
 const direction=camera.getWorldDirection(new THREE.Vector3()),denominator=direction.dot(basis.n),points=[];
 if(Math.abs(denominator)>1e-4)for(const x of [-1,1])for(const y of [-1,1]){
  const origin=new THREE.Vector3(x,y,0).unproject(camera),point=origin.addScaledVector(direction,(offset-origin.dot(basis.n))/denominator);
  if(point.toArray().every(Number.isFinite))points.push([point.dot(basis.u),point.dot(basis.v)]);
 }
 if(points.length===4)return {u:[Math.min(...points.map(p=>p[0])),Math.max(...points.map(p=>p[0]))],v:[Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[1]))]};
 const center=target.clone().addScaledVector(basis.n,offset-target.dot(basis.n)),span=Math.max(camera.right-camera.left,camera.top-camera.bottom)/camera.zoom*2;
 return {u:[center.dot(basis.u)-span/2,center.dot(basis.u)+span/2],v:[center.dot(basis.v)-span/2,center.dot(basis.v)+span/2]};
}
export function viewportGridLayout(view,snapStep){
 let step=snapStep;while(Math.max(view.u[1]-view.u[0],view.v[1]-view.v[0])/step>180)step*=2;
 const quantum=5*step,u=Math.round((view.u[0]+view.u[1])/2/quantum)*quantum,v=Math.round((view.v[0]+view.v[1])/2/quantum)*quantum;
 const radius=Math.max(Math.abs(view.u[0]-u),Math.abs(view.u[1]-u),Math.abs(view.v[0]-v),Math.abs(view.v[1]-v))+5*step;
 const divisions=Math.max(100,Math.ceil(2*radius/step/10)*10),half=divisions*step/2;
 return {step,divisions,u,v,bounds:{u:[u-half,u+half],v:[v-half,v+half]}};
}

// Move along the view direction only: screen positions and zoom stay unchanged,
// while both rendering and picking start in front of the visible geometry.
export function fitCameraDepth(camera,target,objects){
 const direction=camera.position.clone().sub(target).normalize();if(!direction.lengthSq())return;
 let low=Infinity,high=-Infinity;const point=new THREE.Vector3();
 function visit(object){if(!object.visible)return;const g=object.geometry;if(g?.attributes?.position){if(!g.boundingBox)g.computeBoundingBox();const box=g.boundingBox;if(box&&!box.isEmpty())for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){point.set(x,y,z).applyMatrix4(object.matrixWorld).sub(target);const depth=point.dot(direction);low=Math.min(low,depth);high=Math.max(high,depth);}}for(const child of object.children)visit(child);}
 for(const object of objects){object.updateWorldMatrix(true,true);visit(object);}if(!Number.isFinite(low)||!Number.isFinite(high))return;
 const padding=Math.max(10,Math.max(camera.top-camera.bottom,camera.right-camera.left)/camera.zoom*.02),distance=Math.max(180,high+padding),far=Math.max(1000,distance-low+padding);
 const moved=Math.abs(camera.position.distanceTo(target)-distance)>.001,changed=Math.abs(camera.far-far)>.001;
 if(moved){camera.position.copy(target).addScaledVector(direction,distance);camera.updateMatrixWorld(true);}if(changed){camera.far=far;camera.updateProjectionMatrix();}
}
