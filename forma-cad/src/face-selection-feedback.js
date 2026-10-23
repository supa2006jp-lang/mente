import * as THREE from 'three';
import {cadFaceGroup,cadFaceGeometry} from './face-selection.js';
import {cadPosition} from './cad-coordinates.js';
import {isFilletBodySuppressed} from './fillet-state.js';

export function faceSurfaceType(geometry,index,features=[],bodyId){
 const group=cadFaceGroup(geometry,index),planar=group&&geometry.userData.planarFaces;
 if(group&&planar)return planar.includes(group.faceId)?'plane':features.some(f=>f.spec?.type==='fillet'&&!isFilletBodySuppressed(f.spec,bodyId)&&(f.outputs||f.cadResult?.outputs||[]).some(o=>o.id===bodyId))?'fillet':'curve';
 return group?.cylinder?'curve':'unknown';
}
export function faceBoundary(geometry){
 const p=cadPosition(geometry),ix=geometry.index,edges=new Map(),at=i=>new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i):i),key=v=>v.toArray().map(x=>Math.round(x*1e6)).join(',');
 for(let i=0;i<(ix?.count||p.count);i+=3){const points=[at(i),at(i+1),at(i+2)];for(let j=0;j<3;j++){const a=points[j],b=points[(j+1)%3],id=[key(a),key(b)].sort().join('|');if(edges.has(id))edges.delete(id);else edges.set(id,[a,b]);}}
 return [...edges.values()];
}
const boundaryCache=new WeakMap();
export function preferNearbyPlanarFace(hit,{project,cameraDirection,tolerance=8,isVisible=()=>true}={}){
 const mesh=hit?.object,g=mesh?.geometry;if(!g?.userData.planarFaces?.length||faceSurfaceType(g,hit.faceIndex)==='plane')return hit;
 let records=boundaryCache.get(g);
 if(!records){records=[];for(const group of g.userData.faceGroups||[]){if(!g.userData.planarFaces.includes(group.faceId))continue;const selected=cadFaceGeometry(g,group),p=cadPosition(selected),normal=new THREE.Vector3().fromBufferAttribute(p,1).sub(new THREE.Vector3().fromBufferAttribute(p,0)).cross(new THREE.Vector3().fromBufferAttribute(p,2).sub(new THREE.Vector3().fromBufferAttribute(p,0))).normalize();try{records.push({group,normal,edges:faceBoundary(selected)});}finally{selected.dispose();}}boundaryCache.set(g,records);}
 mesh.updateMatrixWorld(true);const cursor=project(hit.point);let best=hit,distance=tolerance;
 for(const record of records){const normal=record.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld));if(normal.dot(cameraDirection)>=-.01)continue;
  for(const [a,b] of record.edges){const from=a.clone().applyMatrix4(mesh.matrixWorld),to=b.clone().applyMatrix4(mesh.matrixWorld),p=project(from),q=project(to);if(p.z< -1||p.z>1||q.z< -1||q.z>1)continue;const dx=q.x-p.x,dy=q.y-p.y,t=Math.max(0,Math.min(1,((cursor.x-p.x)*dx+(cursor.y-p.y)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(cursor.x-p.x-t*dx,cursor.y-p.y-t*dy);if(d>=distance)continue;
   const point=from.lerp(to,t),candidate={...hit,point,faceIndex:record.group.start/3,face:{...hit.face,normal:record.normal.clone()},planePreferred:true};if(!isVisible(candidate))continue;best=candidate;distance=d;
  }
 }
 return best;
}

export function createFaceSelectionFeedback({scene,host,getMeshes,getFeatures,getSelection,canUse,measurement}){
 const option=document.createElement('label');option.style.cssText='display:inline-flex;align-items:center;gap:4px;font-size:12px;margin-left:8px';option.title='フィレットとの境界から8px以内では、手前に見えている同じボディの平面を優先します';option.innerHTML='<input type="checkbox" id="prefer-planar-face">境界では平面を優先';document.getElementById('selection-mode').after(option);
 const badge=document.createElement('p');badge.id='selected-surface-type';badge.hidden=true;badge.style.cssText='font-weight:bold;font-size:13px;margin:6px 0';measurement.append(badge);let overlay=null,selection=null,model=null,enabled=null;
 function clear(){if(overlay){overlay.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});overlay.removeFromParent();overlay=null;}badge.hidden=true;delete host.dataset.selectedSurfaceTypes;}
 function sync(){
  const next=getSelection(),features=getFeatures(),active=canUse();if(next===selection&&model===features&&active===enabled)return;clear();selection=next;model=features;enabled=active;if(!active||!next.length)return;overlay=new THREE.Group();const types=[];
  for(const entry of next){const mesh=getMeshes().get(entry.bodyId);if(!mesh?.visible)continue;const curved=!entry.plane,type=curved&&features.some(f=>f.spec?.type==='fillet'&&!isFilletBodySuppressed(f.spec,entry.bodyId)&&(f.outputs||[]).some(o=>o.id===entry.bodyId))?'fillet':curved?'curve':'plane',color=type==='plane'?0x00aaa5:0xe59b29;types.push(type);mesh.updateMatrixWorld(true);
   const geometry=new THREE.BufferGeometry().setFromPoints(faceBoundary(entry.geometry).flat());geometry.applyMatrix4(mesh.matrixWorld);const line=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color,depthTest:false}));line.renderOrder=32;overlay.add(line);
  }
  scene.add(overlay);badge.hidden=!types.length;badge.textContent=[...new Set(types)].map(type=>type==='plane'?'平面（押し出し可）':type==='fillet'?'曲面（フィレットを含む）':'曲面').join(' ／ ');badge.style.color=types.every(t=>t==='plane')?'#008d87':'#a96b10';host.dataset.selectedSurfaceTypes=JSON.stringify(types);
 }
 return {sync,clear,get preferPlane(){return option.querySelector('input').checked;}};
}
