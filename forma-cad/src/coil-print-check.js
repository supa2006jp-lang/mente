import * as THREE from 'three';
import {MeshBVH,CENTER} from 'three-mesh-bvh';
const offset=.002,supportDistance=.3,minimumAreaSquared=1e-16,pause=()=>new Promise(resolve=>setTimeout(resolve,0));
function cancelled(fn){if(fn?.()){const e=new Error('印刷チェックを中止しました');e.name='AbortError';throw e;}}
const stats=()=>({triangles:0,degenerate:0,thinTriangles:0,unsupportedTriangles:0});
function meshData(output){
 const {vertices,triangles}=output;
 if(!vertices||!triangles||vertices.length%3||triangles.length%3||!Array.from(vertices).every(Number.isFinite)||!Array.from(triangles).every(i=>Number.isInteger(i)&&i>=0&&i<vertices.length/3))throw Error('印刷チェック用のメッシュが不正です');
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(Array.from(triangles));geometry.computeBoundingBox();
 const count=triangles.length/3,normals=new Float64Array(count*3),centers=new Float64Array(count*3),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3(),normal=new THREE.Vector3();let degenerate=0;
 for(let t=0;t<count;t++){a.fromArray(vertices,triangles[t*3]*3);b.fromArray(vertices,triangles[t*3+1]*3);c.fromArray(vertices,triangles[t*3+2]*3);normal.crossVectors(ab.subVectors(b,a),ac.subVectors(c,a));if(normal.lengthSq()<=minimumAreaSquared){degenerate++;continue;}normal.normalize().toArray(normals,t*3);a.add(b).add(c).multiplyScalar(1/3).toArray(centers,t*3);}
 return {output,geometry,count,normals,centers,degenerate,bvh:count?new MeshBVH(geometry,{indirect:true,strategy:CENTER,targetLeafSize:10}):null};
}
function triangleVertices(mesh,t,target){const {vertices,triangles}=mesh.output;for(let j=0;j<3;j++){const i=triangles[t*3+j]*3;target.push(vertices[i],vertices[i+1],vertices[i+2]);}}
// World-space mesh warnings in the supplied print orientation. Overhang angle
// is measured from vertical; horizontal undersides are 90 degrees. This local
// surface check is not a slicer or proof of physically disconnected components.
export async function analyzeCoilPrint(outputs,{minThickness=.8,overhangAngle=50,shouldCancel}={}){
 if(!Array.isArray(outputs)||!Number.isFinite(minThickness)||minThickness<=offset*2||!Number.isFinite(overhangAngle)||overhangAngle<0||overhangAngle>=90)throw Error('印刷チェックの設定が不正です');
 const meshes=[],result={kind:'mesh-print-warning',outputs:[],stats:stats(),settings:{minThickness,overhangAngle,supportDistance},cancelled:false},centroid=new THREE.Vector3(),normal=new THREE.Vector3(),hitNormal=new THREE.Vector3(),ray=new THREE.Ray(),down=new THREE.Vector3(0,0,-1),bedTolerance=.03,overhangLimit=-Math.sin(overhangAngle*Math.PI/180);let lastYield=performance.now();
 try{
  for(const output of outputs){cancelled(shouldCancel);meshes.push(meshData(output));await pause();}
  for(const mesh of meshes){
   const entry={id:mesh.output.id,thin:[],unsupported:[],stats:{...stats(),triangles:mesh.count,degenerate:mesh.degenerate}};result.outputs.push(entry);
   for(let t=0;t<mesh.count;t++){
    if(t%512===0||performance.now()-lastYield>12){cancelled(shouldCancel);await pause();lastYield=performance.now();cancelled(shouldCancel);}
    normal.fromArray(mesh.normals,t*3);if(normal.lengthSq()===0)continue;centroid.fromArray(mesh.centers,t*3);
    ray.direction.copy(normal).negate();ray.origin.copy(centroid).addScaledVector(ray.direction,offset);
    // An inward ray must exit another outward-facing surface. BackSide skips
    // the starting face. Opposite normals exclude tangential seams.
    const hit=mesh.bvh.raycastFirst(ray,THREE.BackSide,offset*.5,minThickness-offset);
    if(hit&&hit.faceIndex!==t){hitNormal.fromArray(mesh.normals,hit.faceIndex*3);if(hit.distance+offset<minThickness-1e-5&&normal.dot(hitNormal)<-.25){triangleVertices(mesh,t,entry.thin);entry.stats.thinTriangles++;}}
    if(normal.z>=overhangLimit-1e-8)continue;
    const {vertices,triangles}=mesh.output,zs=[0,1,2].map(j=>vertices[triangles[t*3+j]*3+2]);
    // The bed is world Z=0, not each floating component's own lowest point.
    if(zs.every(z=>Math.abs(z)<=bedTolerance))continue;
    ray.direction.copy(down);ray.origin.copy(centroid).addScaledVector(down,offset);let supported=false;
    for(const candidate of meshes){if(candidate.bvh&&candidate.bvh.raycastFirst(ray,THREE.FrontSide,offset*.5,supportDistance-offset)){supported=true;break;}}
    if(!supported){triangleVertices(mesh,t,entry.unsupported);entry.stats.unsupportedTriangles++;}
   }
   for(const key of Object.keys(result.stats))result.stats[key]+=entry.stats[key];
  }
  cancelled(shouldCancel);return result;
 }finally{for(const mesh of meshes)mesh.geometry.dispose();}
}