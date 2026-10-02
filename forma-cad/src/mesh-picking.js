import {MeshBVH,acceleratedRaycast,CENTER} from 'three-mesh-bvh';
// CAD face groups use the original triangle offsets. Indirect BVH keeps those
// offsets intact while accelerating picking on dense helical surfaces.
export function accelerateMeshPicking(mesh){
 const geometry=mesh.geometry;if(!geometry?.attributes.position)return mesh;
 if(!geometry.boundsTree){geometry.boundsTree=new MeshBVH(geometry,{indirect:true,strategy:CENTER,targetLeafSize:10});geometry.addEventListener('dispose',()=>{geometry.boundsTree=null;});}
 mesh.raycast=mesh.userData.displayRaycast||acceleratedRaycast;return mesh;
}
