import * as THREE from 'three';
import {rebuild} from './geometry.js';
import {basisFor,planarFace,worldPoint} from './frames.js';
import {preciseGeometry} from './cad-coordinates.js';

function moveMatrix(spec){
 const pivot=new THREE.Vector3(...(spec.pivot||[0,0,0])),rotation=spec.rotation?new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...spec.rotation.map(v=>v*Math.PI/180),'ZYX')):new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(...({X:[1,0,0],Y:[0,1,0],Z:[0,0,1]}[spec.axis]||[0,0,1])),(spec.angle||0)*Math.PI/180);
 const matrix=new THREE.Matrix4().makeTranslation(...pivot.toArray()).multiply(rotation).multiply(new THREE.Matrix4().makeTranslation(...pivot.clone().negate().toArray()));
 const delta=new THREE.Vector3(spec.x||0,spec.y||0,spec.z||0),copy=spec.copy===true||spec.moveMode==='複製して移動';
 if(copy&&spec.reverseCopy&&delta.lengthSq()>1e-14){const n=delta.clone().normalize(),d=2*n.dot(pivot),mirror=new THREE.Matrix4().set(1-2*n.x*n.x,-2*n.x*n.y,-2*n.x*n.z,d*n.x,-2*n.y*n.x,1-2*n.y*n.y,-2*n.y*n.z,d*n.y,-2*n.z*n.x,-2*n.z*n.y,1-2*n.z*n.z,d*n.z,0,0,0,1);matrix.premultiply(mirror);}
 return matrix.premultiply(new THREE.Matrix4().makeTranslation(...delta.toArray()));
}

// Find the shape before consecutive fillets, following rigid moves/copies.
// Later cuts and unions use their current faces rather than an obsolete outline.
export function filletGridSource(features,bodyId){
 let source=null,id=bodyId;const transforms=[];
 for(let i=features.length-1;i>=0;i--){
  const feature=features[i],result=feature.cadResult||(feature.kind==='cadop'?feature:null),output=result?.outputs?.findIndex(o=>o.id===id)??-1;
  if(output>=0){
   const spec=feature.spec;
   if(spec?.type==='fillet'&&spec.suppressed===true)continue;
   if(spec?.type==='fillet'){source={index:i,bodyId:id,transforms:[...transforms]};continue;}
   if(spec?.type==='move'){
    const targets=[...new Set(spec.targets?.length?spec.targets:[spec.target])];
    transforms.push(moveMatrix(spec));if(spec.copy===true||spec.moveMode==='複製して移動')id=targets[output]||spec.target;
    continue;
   }
   break;
  }
  if(result?.remove?.includes(id))break;
  if(!result&&feature.kind!=='sketch'&&feature.kind!=='plane'&&feature.kind!=='referenceImage'&&(feature.operation==='new'?feature.id===id:feature.target===id))break;
 }
 return source?{...source,transforms:source.transforms.reverse()}:null;
}

export function createFilletGridReference(){
 let revision=null,faces=new WeakMap();const geometries=new Map();
 function clear(){for(const geometry of geometries.values())geometry?.dispose();geometries.clear();faces=new WeakMap();revision=null;}
 function reference(face,features){
  if(!face?.bodyId||!face.outer)return face;
  if(revision!==features){clear();revision=features;}
  if(faces.has(face))return faces.get(face);
  let output=face;
  try{
   if(!geometries.has(face.bodyId)){
    const source=filletGridSource(features,face.bodyId);let geometry=null;
    if(source){const bodies=rebuild(features.slice(0,source.index));try{const original=bodies.get(source.bodyId)?.geometry;geometry=original?preciseGeometry(original):null;}finally{for(const body of bodies.values())body.geometry.dispose();}
     if(geometry){for(const matrix of source.transforms){geometry.applyMatrix4(matrix);if(matrix.determinant()<0){const index=geometry.index;if(index){for(let i=0;i<index.count;i+=3){const value=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,value);}}else{const p=geometry.attributes.position;for(let i=0;i<p.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,i+1),b=new THREE.Vector3().fromBufferAttribute(p,i+2);p.setXYZ(i+1,...b.toArray());p.setXYZ(i+2,...a.toArray());}}} }geometry.computeVertexNormals();}
    }
    geometries.set(face.bodyId,geometry);
   }
   const geometry=geometries.get(face.bodyId);
   if(geometry){
    const p=geometry.attributes.position,index=geometry.index,count=index?.count??p.count,basis=basisFor(face),at=i=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i):i),target=face.cadFace?.point?new THREE.Vector3(...face.cadFace.point):worldPoint(face,face.outer[0]);let triangle=-1,distance=Infinity;
    for(let i=0;i<count;i+=3){const a=at(i),b=at(i+1),c=at(i+2),normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();if(normal.dot(basis.n)<.999999||[a,b,c].some(point=>Math.abs(point.dot(basis.n)-face.offset)>1e-4))continue;const near=new THREE.Triangle(a,b,c).closestPointToPoint(target,new THREE.Vector3()).distanceToSquared(target);if(near<distance){distance=near;triangle=i/3;}}
    if(triangle>=0){const original=planarFace(geometry,triangle),project=ring=>ring.map(point=>{const world=worldPoint(original,point);return [world.dot(basis.u),world.dot(basis.v)];});output={...face,id:face.id+'-before-fillet',outer:project(original.outer),holes:original.holes.map(project),area:original.area,filletGridReference:true};}
   }
  }catch{output=face;}
  faces.set(face,output);return output;
 }
 return {reference,clear};
}
