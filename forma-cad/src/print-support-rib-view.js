import * as THREE from 'three';
export function createSupportRibView({host,canvas,camera,onToggle}){
 const labels=document.createElement('div');labels.dataset.supportRibLabels='';labels.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden';host.append(labels);
 const riskColor=item=>item.risk?.severity==='high'?0xb33690:item.risk?.severity==='caution'?0xeaa429:0x109bb5,restOpacity=item=>item.excluded?.28:item.risk?.severity==='high'?.7:item.risk?.severity==='caution'?.45:0;
 let group=null,items=[],meshes=[],markers=[],picking=false;
 function clear(){if(group){group.removeFromParent();group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}group=null;items=[];meshes=[];markers=[];labels.replaceChildren();delete host.dataset.supportRibPreview;}
 function show(data,parent){clear();items=data;group=new THREE.Group();parent.add(group);
  for(const item of items){const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(item.vertices,3)).setIndex(item.triangles);geometry.computeVertexNormals();const material=new THREE.MeshBasicMaterial({color:item.excluded?0xc63a48:riskColor(item),transparent:true,opacity:picking?.45:restOpacity(item),depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),mesh=new THREE.Mesh(geometry,material);mesh.userData.ribId=item.id;mesh.renderOrder=8;meshes.push(mesh);group.add(mesh);
   if(item.excluded){const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color:0xc63a48,transparent:true,opacity:.8}));edges.renderOrder=9;group.add(edges);}
   const point=geometry.boundingBox||(geometry.computeBoundingBox(),geometry.boundingBox),at=point.getCenter(new THREE.Vector3());at.setComponent(item.axis,item.center);const button=document.createElement('button');button.type='button';button.dataset.ribMarker=item.id;button.textContent=(item.excluded?'除外 ':'リブ ')+item.number;button.style.cssText='position:absolute;pointer-events:auto;padding:3px 5px;border:2px solid white;border-radius:5px;color:white;background:'+(item.excluded?'#b93143':'#087f9e')+';font-size:12px;white-space:nowrap;box-shadow:0 1px 4px #0005';button.onclick=e=>{e.stopPropagation();if(picking)onToggle(item.id);};labels.append(button);markers.push({button,point:at,excluded:item.excluded});
  }sync();
 }
 function sync(){for(const m of markers){const p=m.point.clone().project(camera);m.button.hidden=(!picking&&!m.excluded)||p.z<-1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1;m.button.style.pointerEvents=picking?'auto':'none';if(!m.button.hidden){m.button.style.left=(p.x+1)*host.clientWidth/2+'px';m.button.style.top=(1-p.y)*host.clientHeight/2+'px';m.button.style.transform='translate(-50%,-50%)';}}
  if(group)host.dataset.supportRibPreview=JSON.stringify({picking,ribs:items.map(({id,number,axis,center,bounds,excluded,risk})=>({id,number,axis,center,bounds,excluded,risk}))});
 }
 function setPicking(value){picking=value;for(let i=0;i<meshes.length;i++)meshes[i].material.opacity=picking?.45:restOpacity(items[i]);sync();}
 function pick(event){if(!group||!picking)return null;const b=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-b.left)/b.width*2-1,1-(event.clientY-b.top)/b.height*2),camera);return ray.intersectObjects(meshes,false)[0]?.object.userData.ribId||null;}
 return {show,clear,sync,pick,setPicking,get items(){return items;}};
}
