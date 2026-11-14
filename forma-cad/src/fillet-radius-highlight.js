import * as THREE from 'three';

export function createFilletRadiusHighlight({scene,host,meshes,camera}){
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
   if(exact&&edge.removable)line.userData.filletEdge={bodyId:edge.bodyId,selectionIndex:edge.selectionIndex};
  }
  for(const id of ids){const helper=new THREE.Box3Helper(new THREE.Box3().setFromObject(meshes.get(id)),color);helper.material.depthTest=false;helper.material.depthWrite=false;helper.renderOrder=44;group.add(helper);}
  scene.add(group);host.dataset.filletRadiusLimit=JSON.stringify({radius:limiting.radius,bodyIds:ids,certainty:diagnostics.certainty,edges:group.children.filter(o=>o.type==='Line').length});
 }
 function pick(event){
  if(!group||event.button!==0||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return null;
  const rect=host.getBoundingClientRect(),cursor=new THREE.Vector3(event.clientX-rect.left,event.clientY-rect.top,0);
  const project=(position,index)=>{
   const p=new THREE.Vector3().fromBufferAttribute(position,index).project(camera);
   return {point:new THREE.Vector3((p.x+1)*rect.width/2,(1-p.y)*rect.height/2,0),depth:p.z};
  };
  const segment=new THREE.Line3(),closest=new THREE.Vector3();let best=null,distance=9,depth=Infinity;
  for(const line of group.children){
   const edge=line.userData.filletEdge;if(!edge)continue;
   const position=line.geometry.attributes.position;let a=project(position,0);
   for(let i=1;i<position.count;i++){
    const b=project(position,i);
    segment.set(a.point,b.point).closestPointToPoint(cursor,true,closest);
    const gap=cursor.distanceTo(closest),z=Math.min(a.depth,b.depth);
    if(gap<9&&z>=-1&&z<=1&&(gap<distance-.5||Math.abs(gap-distance)<=.5&&z<depth)){
     best=edge;distance=gap;depth=z;
    }
    a=b;
   }
  }
  return best;
 }
 return {show,clear,pick};
}
