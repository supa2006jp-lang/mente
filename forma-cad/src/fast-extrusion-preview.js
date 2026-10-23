import * as THREE from 'three';
import {makeGeometry} from './geometry.js';
import {basisFor} from './frames.js';
import {planeCoordinates} from './regions.js';
import {depthToGridPlane} from './extrusion-extent.js';

// This is an immediate tool/range preview, never a validated commit result.
export function createFastExtrusionPreview({maxEntries=4,maxBytes=16*1024*1024}={}){
 const cache=new Map();let size=0;
 const fields=['profile','mode','side','plane','frame','width','height','diameter','wall','x','y','z','angle','points','closed','symmetric','holesOnly','capHoles','skipHoleWalls','taperAngle','taperMode','taperSide','taperReference'];
 function clear(){for(const entry of cache.values()){entry.geometry.dispose();entry.edges.dispose();}cache.clear();size=0;}
 function create(batch){const group=new THREE.Group();group.userData.fastExtrusion=true;
  try{for(let feature of batch){
   if(feature.gridExtentPlane)feature={...feature,depth:depthToGridPlane(feature,feature.gridExtentPlane)};
   const shape=Object.fromEntries(fields.map(k=>[k,feature[k]]));if(feature.region)shape.region=Object.fromEntries(['plane','frame','offset','outer','holes'].map(k=>[k,feature.region[k]]));
   const tapered=!!feature.taperAngle,key=JSON.stringify({...shape,...(tapered?{depth:feature.depth}:{})});let entry=cache.get(key);
   if(entry){cache.delete(key);cache.set(key,entry);}else{
    const geometry=makeGeometry({...feature,depth:tapered?feature.depth:1}),edges=new THREE.EdgesGeometry(geometry,25),bytes=geometry.attributes.position.array.byteLength+(geometry.index?.array.byteLength||0)+edges.attributes.position.array.byteLength;entry={geometry,edges,bytes};
    if(bytes<=maxBytes){cache.set(key,entry);size+=bytes;while(cache.size>maxEntries||size>maxBytes){const first=cache.keys().next().value,old=cache.get(first);old.geometry.dispose();old.edges.dispose();size-=old.bytes;cache.delete(first);}}
   }
   const cut=feature.operation==='cut',mesh=new THREE.Mesh(entry.geometry.clone(),new THREE.MeshBasicMaterial({color:cut?0xe78065:0x47bdd3,transparent:true,opacity:.3,depthWrite:false,depthTest:false,side:THREE.DoubleSide}));mesh.renderOrder=15;
   const edges=new THREE.LineSegments(entry.edges.clone(),new THREE.LineBasicMaterial({color:cut?0xb15240:0x1f849b,transparent:true,opacity:.7,depthTest:false}));edges.renderOrder=16;mesh.add(edges);
   if(!tapered){const n=basisFor(feature.region||feature).n,offset=feature.region?.offset??planeCoordinates(feature).offset,k=feature.depth-1,a=n.toArray();mesh.matrix.set(1+k*a[0]*a[0],k*a[0]*a[1],k*a[0]*a[2],-k*offset*a[0],k*a[1]*a[0],1+k*a[1]*a[1],k*a[1]*a[2],-k*offset*a[1],k*a[2]*a[0],k*a[2]*a[1],1+k*a[2]*a[2],-k*offset*a[2],0,0,0,1);mesh.matrixAutoUpdate=false;}
   group.add(mesh);if(!cache.has(key)){entry.geometry.dispose();entry.edges.dispose();}
  }return group;}catch(error){group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});throw error;}
 }
 return {create,clear,get size(){return cache.size;}};
}
