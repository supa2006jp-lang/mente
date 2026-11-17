import * as THREE from 'three';
import {basisFor} from './frames.js';

// A straight extrusion has a fixed section. Reuse its native tool mesh while
// distance changes; only the exact preview may enable committing the feature.
export const reusableUnextrudedPreview=batch=>batch.length>0&&batch.every(f=>
 f.unextrudedOnly&&f.mode==='solid'&&f.profile==='region'&&f.region?.outer?.length>=3&&!f.taperAngle&&!f.barrier&&!f.untilSolid&&
 !f.holesOnly&&!f.gridExtentPlane&&!f.endPlane&&!f.throughAll&&['new','join'].includes(f.operation)&&Number.isFinite(f.depth)&&Math.abs(f.depth)>1e-6);

const fields=['profile','mode','plane','frame','region','capHoles','symmetric','overlapTargets'];
const key=(feature,editingId)=>JSON.stringify([editingId,fields.map(field=>feature[field])]);
const dispose=entry=>{for(const part of entry.parts){part.geometry.dispose();part.edges.dispose();}};

export function createUnextrudedPreview({maxEntries=16,maxBytes=16*1024*1024}={}){
 const entries=new Map();let history=null,bytes=0;
 function clear(){for(const entry of entries.values())dispose(entry);entries.clear();history=null;bytes=0;}
 function scope(model){if(history!==model){clear();history=model;}}
 function store(model,batch,results,editingId=null){
  scope(model);
  if(!reusableUnextrudedPreview(batch)||results.length!==batch.length)return;
  for(const [index,feature] of batch.entries()){
   const id=key(feature,editingId);
   if(entries.has(id))continue;
   const outputs=results[index]?.outputs;
   if(!outputs?.length||outputs.some(output=>!output.vertices?.length||!output.triangles?.length))continue;
   const entry={depth:feature.depth,parts:[],bytes:id.length*2};
   try{
    for(const output of outputs){
     const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(output.vertices,3));
     geometry.setIndex(output.triangles);geometry.computeVertexNormals();
     const edges=new THREE.EdgesGeometry(geometry,25);
     entry.parts.push({geometry,edges});
     entry.bytes+=geometry.attributes.position.array.byteLength+geometry.attributes.normal.array.byteLength+
      geometry.index.array.byteLength+edges.attributes.position.array.byteLength;
    }
    if(entry.bytes>maxBytes||maxEntries<1){dispose(entry);continue;}
    entries.set(id,entry);bytes+=entry.bytes;
    while(entries.size>maxEntries||bytes>maxBytes){const oldest=entries.keys().next().value,old=entries.get(oldest);entries.delete(oldest);bytes-=old.bytes;dispose(old);}
   }catch(error){dispose(entry);throw error;}
  }
 }
 function storeExact(model,batch,result,editingId=null){
  if(!batch.every(f=>f.operation==='new')||result.features?.length!==batch.length)return;
  store(model,batch,result.features.map((feature,i)=>({outputs:feature.cadResult?.outputs?.filter(output=>output.id===batch[i].id)})),editingId);
 }
 function create(model,batch,editingId=null){
  scope(model);
  if(!reusableUnextrudedPreview(batch))return null;
  const found=batch.map(feature=>entries.get(key(feature,editingId)));
  if(found.some(entry=>!entry))return null;
  const group=new THREE.Group();group.userData.fastExtrusion=true;
  try{
   for(const [index,feature] of batch.entries()){
    const entry=found[index],id=key(feature,editingId);entries.delete(id);entries.set(id,entry);
    const n=basisFor(feature.region).n,offset=feature.region.offset,k=(feature.symmetric?Math.abs(feature.depth/entry.depth):feature.depth/entry.depth)-1,a=n.toArray();
    for(const part of entry.parts){
     const mesh=new THREE.Mesh(part.geometry.clone(),new THREE.MeshBasicMaterial({color:0x47bdd3,transparent:true,opacity:.3,depthWrite:false,depthTest:false,side:THREE.DoubleSide}));
     const edges=new THREE.LineSegments(part.edges.clone(),new THREE.LineBasicMaterial({color:0x1f849b,transparent:true,opacity:.7,depthTest:false}));
     mesh.renderOrder=15;edges.renderOrder=16;mesh.add(edges);
     mesh.matrix.set(1+k*a[0]*a[0],k*a[0]*a[1],k*a[0]*a[2],-k*offset*a[0],k*a[1]*a[0],1+k*a[1]*a[1],k*a[1]*a[2],-k*offset*a[1],k*a[2]*a[0],k*a[2]*a[1],1+k*a[2]*a[2],-k*offset*a[2],0,0,0,1);
     mesh.matrixAutoUpdate=false;group.add(mesh);
    }
   }
   return group;
  }catch(error){group.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});throw error;}
 }
 return {create,store,storeExact,clear,get size(){return entries.size;},get bytes(){return bytes;}};
}
