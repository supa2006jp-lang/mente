import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {retainCadCoordinates} from './cad-coordinates.js';
import {applyBodyMeshPaint} from './body-appearance.js';
import {bodyPaint,facePaintReference,prepareBodyPaint} from './body-face-paint.js';
import {syncBodyPaintRender} from './body-paint-render.js';

export function volumeDisplayMeshes(mesh){return mesh.children.filter(child=>child.userData.volumeColor);}

// The fused mesh remains the picking surface. Transfer a face color to the
// outer triangles of each material region without recoloring its volume.
function surfacePaint(source){
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 const read=(g,i,out)=>out.fromBufferAttribute(g.attributes.position,g.index?g.index.getX(i):i);
 const layers=(bodyPaint(source)?.layers??[]).map(layer=>{
  const coordinates=[];
  for(const {start,count} of layer.ranges)for(let i=start;i<start+count;i++)coordinates.push(...read(source,i,a).toArray());
  const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(coordinates,3));
  return {color:layer.color,geometry,bvh:new MeshBVH(geometry),ranges:[]};
 });
 const point=new THREE.Vector3(),n=new THREE.Vector3(),m=new THREE.Vector3(),hit={};
 return {
  project(geometry){
   if(!layers.length)return geometry;
   for(const layer of layers)layer.ranges=[];
   for(let i=0;i<geometry.index.count;i+=3){
    read(geometry,i,a);read(geometry,i+1,b);read(geometry,i+2,c);
    point.copy(a).add(b).add(c).multiplyScalar(1/3);n.subVectors(b,a).cross(c.sub(a)).normalize();
    for(let j=layers.length-1;j>=0;j--){
     const layer=layers[j],found=layer.bvh.closestPointToPoint(point,hit,0,.09);
     if(!found)continue;
     const s=found.faceIndex*3;
     read(layer.geometry,s,a);read(layer.geometry,s+1,b);read(layer.geometry,s+2,c);
     if(m.subVectors(b,a).cross(c.sub(a)).normalize().dot(n)<.96)continue;
     const prev=layer.ranges.at(-1);
     if(prev&&prev.start+prev.count===i)prev.count+=3;else layer.ranges.push({start:i,count:3});
     break;
    }
   }
   return prepareBodyPaint(geometry,layers.flatMap(({ranges,color})=>ranges.length?[{...facePaintReference(geometry,ranges),color}]:[]));
  },
  dispose(){for(const layer of layers)layer.geometry.dispose();}
 };
}

export function setVolumeDisplay(mesh,parts){
 for(const child of volumeDisplayMeshes(mesh)){child.removeFromParent();child.geometry.dispose();child.traverse(object=>object.material?.dispose());}
 mesh.material.visible=!parts?.length;
 if(!parts?.length)return;
 const paint=surfacePaint(mesh.geometry);
 try{for(const part of parts){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.vertices,3));
  retainCadCoordinates(geometry,part.vertices);
  geometry.setIndex(part.triangles);
  if(part.normals?.length===part.vertices.length)geometry.setAttribute('normal',new THREE.Float32BufferAttribute(part.normals,3));
  else geometry.computeVertexNormals();
  const display=paint.project(geometry),style={color:part.color,opacity:part.opacity,customColor:true};
  if(display!==geometry)geometry.dispose();
  const child=new THREE.Mesh(display,new THREE.MeshStandardMaterial(applyBodyMeshPaint(display,style)));
  child.userData.volumeColor=part.color;
  child.userData.bodyAppearance=style;
  child.raycast=()=>{};
  syncBodyPaintRender(child);
  mesh.add(child);
 }}finally{paint.dispose();}
}
