import * as THREE from 'three';
import {screenVertexCandidates} from './vertex-points.js';
import {screenMidpointCandidates,allMeshHits} from './selection-candidates.js';

// Use real boundary vertices and edge midpoints, never triangle tessellation
// points. A back-side reference must not win over the visible solid surface.
export function sketchPlaneReferencePick(meshes,camera,rect,clientX,clientY,tolerance=14){
 const x=clientX-rect.left,y=clientY-rect.top;if(x<0||y<0||x>rect.width||y>rect.height)return null;
 const visible=meshes.filter(m=>m.visible),candidates=[...screenVertexCandidates(visible,camera,rect.width,rect.height,x,y,tolerance).map(c=>({...c,kind:'vertex'})),...screenMidpointCandidates(visible,camera,rect.width,rect.height,x,y,[],tolerance).map(c=>({...c,kind:'midpoint'}))];
 candidates.sort((a,b)=>Math.abs(a.distance-b.distance)>.5?a.distance-b.distance:a.kind!==b.kind?a.kind==='vertex'?-1:1:a.depth-b.depth);
 const ray=new THREE.Raycaster();for(const c of candidates){const p=c.point.clone().project(camera);ray.setFromCamera(new THREE.Vector2(p.x,p.y),camera);const distance=ray.ray.origin.distanceTo(c.point),first=allMeshHits(ray,visible)[0];if(first&&first.distance<distance-.001)continue;return {point:c.point.clone(),kind:c.kind,bodyId:c.mesh.userData.bodyId,distance:c.distance};}return null;
}
